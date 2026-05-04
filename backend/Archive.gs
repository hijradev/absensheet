// Archive.gs
//
// Data archiving and maintenance functions to prevent data overload in Google Sheets.
//
// Google Sheets has a 10 million cell limit per spreadsheet. For an attendance
// system with many employees, the Attendance_Data sheet can grow to hundreds of
// thousands of rows per year. This module handles:
//
//   1. Year-based attendance DB provisioning  — ensures a new spreadsheet is
//      created for each calendar year before it starts.
//   2. Activity log archiving                 — moves log rows older than N months
//      to an Archive sheet to keep the live sheet fast.
//   3. Leaves archiving                       — moves resolved leave records older
//      than N years to a Leaves_Archive sheet.
//   4. Email delivery log pruning             — caps the Email_Delivery_Log sheet
//      at a configurable maximum row count.
//   5. Scheduled maintenance trigger          — a single monthly trigger that runs
//      all of the above automatically.
//
// Admin toggle: set Script Property ARCHIVING_ENABLED = 'true' | 'false'.
// Default when the property is absent: enabled (true).
//
// All functions are safe to run manually from the GAS editor at any time.

// ============================================================================
// Admin toggle helpers
// ============================================================================

/**
 * Returns true when archiving is enabled (default: true).
 */
function isArchivingEnabled() {
  var val = PropertiesService.getScriptProperties().getProperty('ARCHIVING_ENABLED');
  // Default to enabled when the property has never been set
  return val === null ? true : val === 'true';
}

/**
 * Get archiving settings (admin only).
 * @param {string} token - Admin session token
 */
function getArchivingSettings(token) {
  try {
    checkAdmin(token);

    var props = PropertiesService.getScriptProperties();
    var enabled          = props.getProperty('ARCHIVING_ENABLED');
    var logMonths        = props.getProperty('ARCHIVE_LOG_MONTHS_TO_KEEP');
    var leavesYears      = props.getProperty('ARCHIVE_LEAVES_YEARS_TO_KEEP');
    var emailLogMaxRows  = props.getProperty('ARCHIVE_EMAIL_LOG_MAX_ROWS');
    var lastRunAt        = props.getProperty('ARCHIVE_LAST_RUN_AT');
    var lastRunResult    = props.getProperty('ARCHIVE_LAST_RUN_RESULT');

    return successResponse({
      enabled:         enabled === null ? true : enabled === 'true',
      logMonthsToKeep: logMonths       !== null ? parseInt(logMonths,       10) : 3,
      leavesYearsToKeep: leavesYears   !== null ? parseInt(leavesYears,     10) : 1,
      emailLogMaxRows: emailLogMaxRows  !== null ? parseInt(emailLogMaxRows, 10) : 100,
      lastRunAt:       lastRunAt   || null,
      lastRunResult:   lastRunResult || null
    });
  } catch (e) {
    return errorResponse(e.message);
  }
}

/**
 * Save archiving settings (admin only).
 * @param {string} token
 * @param {{ enabled: boolean, logMonthsToKeep: number, leavesYearsToKeep: number, emailLogMaxRows: number }} data
 */
function saveArchivingSettings(token, data) {
  try {
    var user = checkAdmin(token);

    if (!data || typeof data !== 'object') {
      return errorResponse('Invalid archiving settings data.');
    }

    var enabled         = typeof data.enabled === 'boolean' ? data.enabled : true;
    var logMonths       = parseInt(data.logMonthsToKeep,   10);
    var leavesYears     = parseInt(data.leavesYearsToKeep, 10);
    var emailLogMaxRows = parseInt(data.emailLogMaxRows,   10);

    if (isNaN(logMonths)       || logMonths       < 1 || logMonths       > 24)  return errorResponse('Log months to keep must be between 1 and 24.');
    if (isNaN(leavesYears)     || leavesYears     < 1 || leavesYears     > 10)  return errorResponse('Leaves years to keep must be between 1 and 10.');
    if (isNaN(emailLogMaxRows) || emailLogMaxRows < 10 || emailLogMaxRows > 1000) return errorResponse('Email log max rows must be between 10 and 1000.');

    PropertiesService.getScriptProperties().setProperties({
      'ARCHIVING_ENABLED':              enabled ? 'true' : 'false',
      'ARCHIVE_LOG_MONTHS_TO_KEEP':     String(logMonths),
      'ARCHIVE_LEAVES_YEARS_TO_KEEP':   String(leavesYears),
      'ARCHIVE_EMAIL_LOG_MAX_ROWS':     String(emailLogMaxRows)
    });

    // Set up or remove the monthly maintenance trigger
    if (enabled) {
      _setupArchiveTrigger();
    } else {
      _removeArchiveTrigger();
    }

    logActivity(user.userId, 'Updated archiving settings: enabled=' + enabled +
      ', logMonths=' + logMonths + ', leavesYears=' + leavesYears +
      ', emailLogMaxRows=' + emailLogMaxRows);

    return successResponse(null, 'Archiving settings saved successfully.');
  } catch (e) {
    return errorResponse(e.message);
  }
}

// ============================================================================
// 1. Year-based attendance DB provisioning
// ============================================================================

/**
 * Ensures an Attendance_Data spreadsheet exists for the given year.
 * Creates one if it doesn't exist yet and stores its ID in Script Properties.
 * Safe to call multiple times — idempotent.
 *
 * @param {number} [year] - Defaults to the current year.
 * @returns {string} The spreadsheet ID.
 */
function provisionAttendanceDbForYear(year) {
  year = year || new Date().getFullYear();
  var key = 'ATTENDANCE_DB_ID_' + year;
  var props = PropertiesService.getScriptProperties();
  var existing = props.getProperty(key);
  if (existing) return existing;

  var attSS = SpreadsheetApp.create('Absensi_DB_Attendance_' + year);
  var sheet = attSS.getActiveSheet();
  sheet.setName('Attendance_Data');
  sheet.appendRow([
    'date', 'employee_id', 'check_in_time', 'check_in_status',
    'check_out_time', 'check_out_status',
    'check_in_lat', 'check_in_lng', 'check_in_distance',
    'check_out_lat', 'check_out_lng', 'check_out_distance', 'source'
  ]);

  props.setProperty(key, attSS.getId());
  logActivity('system', 'Provisioned new attendance DB for year ' + year + ': ' + attSS.getId());
  return attSS.getId();
}

// ============================================================================
// 2. Activity log archiving
// ============================================================================

/**
 * Moves Activity_Log rows older than `monthsToKeep` months to Activity_Log_Archive.
 * Skips if archiving is disabled.
 *
 * @param {number} [monthsToKeep=3]
 * @returns {{ archived: number, kept: number }}
 */
function archiveOldActivityLogs(monthsToKeep) {
  if (!isArchivingEnabled()) return { archived: 0, kept: 0, skipped: true };

  monthsToKeep = (typeof monthsToKeep === 'number' && !isNaN(monthsToKeep)) ? monthsToKeep : _getIntProp('ARCHIVE_LOG_MONTHS_TO_KEEP', 3);

  var props = getProps();
  if (!props.LOG_DB_ID) return { archived: 0, kept: 0 };

  var ss = SpreadsheetApp.openById(props.LOG_DB_ID);
  var sheet = ss.getSheetByName('Activity_Log');
  if (!sheet) return { archived: 0, kept: 0 };

  var data = sheet.getDataRange().getValues();
  if (data.length <= 1) return { archived: 0, kept: 0 };

  var cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - monthsToKeep);

  var archiveSheet = ss.getSheetByName('Activity_Log_Archive');
  if (!archiveSheet) {
    archiveSheet = ss.insertSheet('Activity_Log_Archive');
    archiveSheet.appendRow(['timestamp', 'user_id', 'action']);
    archiveSheet.getRange(1, 1, 1, 3).setFontWeight('bold');
    archiveSheet.setFrozenRows(1);
  }

  var toArchive = [];
  var toKeep    = [data[0]]; // header row

  for (var i = 1; i < data.length; i++) {
    var ts = data[i][0] instanceof Date ? data[i][0] : new Date(data[i][0]);
    if (!isNaN(ts.getTime()) && ts < cutoff) {
      toArchive.push(data[i]);
    } else {
      toKeep.push(data[i]);
    }
  }

  if (toArchive.length > 0) {
    var lastArchiveRow = archiveSheet.getLastRow();
    archiveSheet.getRange(lastArchiveRow + 1, 1, toArchive.length, toArchive[0].length)
      .setValues(toArchive);

    sheet.clearContents();
    sheet.getRange(1, 1, toKeep.length, toKeep[0].length).setValues(toKeep);
  }

  return { archived: toArchive.length, kept: toKeep.length - 1 };
}

// ============================================================================
// 3. Leaves archiving
// ============================================================================

/**
 * Moves resolved (approved/rejected) Leaves rows whose end_date is older than
 * `yearsToKeep` years to a Leaves_Archive sheet in the Master DB.
 * Skips if archiving is disabled.
 *
 * @param {number} [yearsToKeep=1]
 * @returns {{ archived: number, kept: number }}
 */
function archiveOldLeaves(yearsToKeep) {
  if (!isArchivingEnabled()) return { archived: 0, kept: 0, skipped: true };

  yearsToKeep = (typeof yearsToKeep === 'number' && !isNaN(yearsToKeep)) ? yearsToKeep : _getIntProp('ARCHIVE_LEAVES_YEARS_TO_KEEP', 1);

  var props = getProps();
  if (!props.MASTER_DB_ID) return { archived: 0, kept: 0 };

  var ss = SpreadsheetApp.openById(props.MASTER_DB_ID);
  var sheet = ss.getSheetByName('Leaves');
  if (!sheet) return { archived: 0, kept: 0 };

  var data = sheet.getDataRange().getValues();
  if (data.length <= 1) return { archived: 0, kept: 0 };

  var cutoffYear = new Date().getFullYear() - yearsToKeep;

  var archiveSheet = ss.getSheetByName('Leaves_Archive');
  if (!archiveSheet) {
    archiveSheet = ss.insertSheet('Leaves_Archive');
    archiveSheet.appendRow(data[0]); // copy header
    archiveSheet.getRange(1, 1, 1, data[0].length).setFontWeight('bold');
    archiveSheet.setFrozenRows(1);
  }

  var toArchive = [];
  var toKeep    = [data[0]];

  for (var i = 1; i < data.length; i++) {
    var endDate = String(data[i][4]); // end_date column (index 4)
    var status  = String(data[i][5]); // status column (index 5)
    var isResolved = (status === 'approved' || status === 'rejected');
    var isOld      = endDate.substring(0, 4) < String(cutoffYear);

    if (isResolved && isOld) {
      toArchive.push(data[i]);
    } else {
      toKeep.push(data[i]);
    }
  }

  if (toArchive.length > 0) {
    var lastArchiveRow = archiveSheet.getLastRow();
    archiveSheet.getRange(lastArchiveRow + 1, 1, toArchive.length, toArchive[0].length)
      .setValues(toArchive);

    sheet.clearContents();
    sheet.getRange(1, 1, toKeep.length, toKeep[0].length).setValues(toKeep);

    // Invalidate master cache since Leaves data changed
    invalidateMasterCache();
  }

  return { archived: toArchive.length, kept: toKeep.length - 1 };
}

// ============================================================================
// 4. Email delivery log pruning
// ============================================================================

/**
 * Keeps only the most recent `maxRows` rows in the Email_Delivery_Log sheet.
 * Older rows are permanently deleted (not archived — they are low-value metadata).
 * Skips if archiving is disabled.
 *
 * @param {number} [maxRows=100]
 * @returns {{ deleted: number, kept: number }}
 */
function pruneEmailDeliveryLog(maxRows) {
  if (!isArchivingEnabled()) return { deleted: 0, kept: 0, skipped: true };

  maxRows = (typeof maxRows === 'number' && !isNaN(maxRows)) ? maxRows : _getIntProp('ARCHIVE_EMAIL_LOG_MAX_ROWS', 100);

  var props = getProps();
  if (!props.MASTER_DB_ID) return { deleted: 0, kept: 0 };

  var ss = SpreadsheetApp.openById(props.MASTER_DB_ID);
  var sheet = ss.getSheetByName('Email_Delivery_Log');
  if (!sheet) return { deleted: 0, kept: 0 };

  var total = sheet.getLastRow();
  // total includes header row; data rows = total - 1
  var dataRows = total - 1;
  if (dataRows <= maxRows) return { deleted: 0, kept: dataRows };

  var rowsToDelete = dataRows - maxRows;
  // Delete oldest rows (row 2 through row 2 + rowsToDelete - 1)
  sheet.deleteRows(2, rowsToDelete);

  return { deleted: rowsToDelete, kept: maxRows };
}

// ============================================================================
// 5. Scheduled maintenance — runs all jobs in one trigger
// ============================================================================

/**
 * Master maintenance function called by the monthly time-based trigger.
 * Also callable manually from the GAS editor.
 *
 * Jobs run in order:
 *   1. Provision next year's attendance DB (idempotent)
 *   2. Archive old activity logs
 *   3. Archive old resolved leaves
 *   4. Prune email delivery log
 */
function runMonthlyMaintenance() {
  if (!isArchivingEnabled()) {
    console.log('Archiving is disabled — skipping monthly maintenance.');
    PropertiesService.getScriptProperties().setProperty('ARCHIVE_LAST_RUN_RESULT', 'Skipped (archiving disabled)');
    return;
  }

  var results = {};
  var errors  = [];

  // 1. Provision next year's DB (run in October–December so it's ready on Jan 1)
  try {
    var nextYear = new Date().getFullYear() + 1;
    var newDbId  = provisionAttendanceDbForYear(nextYear);
    results.provision = 'OK (year=' + nextYear + ', id=' + newDbId + ')';
  } catch (e) {
    errors.push('provision: ' + e.message);
    results.provision = 'ERROR: ' + e.message;
  }

  // 2. Archive activity logs
  try {
    var logResult = archiveOldActivityLogs();
    results.activityLog = 'archived=' + logResult.archived + ', kept=' + logResult.kept;
  } catch (e) {
    errors.push('activityLog: ' + e.message);
    results.activityLog = 'ERROR: ' + e.message;
  }

  // 3. Archive old leaves
  try {
    var leavesResult = archiveOldLeaves();
    results.leaves = 'archived=' + leavesResult.archived + ', kept=' + leavesResult.kept;
  } catch (e) {
    errors.push('leaves: ' + e.message);
    results.leaves = 'ERROR: ' + e.message;
  }

  // 4. Prune email delivery log
  try {
    var emailResult = pruneEmailDeliveryLog();
    results.emailLog = 'deleted=' + emailResult.deleted + ', kept=' + emailResult.kept;
  } catch (e) {
    errors.push('emailLog: ' + e.message);
    results.emailLog = 'ERROR: ' + e.message;
  }

  var summary = JSON.stringify(results);
  var timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');

  PropertiesService.getScriptProperties().setProperties({
    'ARCHIVE_LAST_RUN_AT':     timestamp,
    'ARCHIVE_LAST_RUN_RESULT': summary
  });

  logActivity('system', 'Monthly maintenance completed: ' + summary);

  if (errors.length > 0) {
    console.error('Monthly maintenance completed with errors: ' + errors.join('; '));
  } else {
    console.log('Monthly maintenance completed successfully: ' + summary);
  }
}

/**
 * Run maintenance immediately (admin only, on-demand).
 * @param {string} token - Admin session token
 */
function runMaintenanceNow(token) {
  try {
    var user = checkAdmin(token);
    runMonthlyMaintenance();

    var props = PropertiesService.getScriptProperties();
    return successResponse({
      lastRunAt:     props.getProperty('ARCHIVE_LAST_RUN_AT'),
      lastRunResult: props.getProperty('ARCHIVE_LAST_RUN_RESULT')
    }, 'Maintenance completed successfully.');
  } catch (e) {
    return errorResponse(e.message);
  }
}

// ============================================================================
// Trigger management
// ============================================================================

/**
 * Creates a monthly time-based trigger for runMonthlyMaintenance on the 1st
 * of each month at 02:00. Removes any existing archive trigger first.
 */
function _setupArchiveTrigger() {
  _removeArchiveTrigger();

  var trigger = ScriptApp.newTrigger('runMonthlyMaintenance')
    .timeBased()
    .onMonthDay(1)
    .atHour(2)
    .nearMinute(0)
    .create();

  PropertiesService.getScriptProperties()
    .setProperty('ARCHIVE_TRIGGER_ID', trigger.getUniqueId());
}

/**
 * Removes the archive maintenance trigger if one exists.
 */
function _removeArchiveTrigger() {
  var props = PropertiesService.getScriptProperties();
  var triggerId = props.getProperty('ARCHIVE_TRIGGER_ID');
  if (!triggerId) return;

  var allTriggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < allTriggers.length; i++) {
    if (allTriggers[i].getUniqueId() === triggerId) {
      ScriptApp.deleteTrigger(allTriggers[i]);
      break;
    }
  }
  props.deleteProperty('ARCHIVE_TRIGGER_ID');
}

// ============================================================================
// Internal helpers
// ============================================================================

function _getIntProp(key, defaultValue) {
  var val = PropertiesService.getScriptProperties().getProperty(key);
  if (val === null) return defaultValue;
  var parsed = parseInt(val, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}
