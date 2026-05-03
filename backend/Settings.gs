// Settings.gs - Admin settings management

/**
 * Get system settings
 */
function getSystemSettings(token) {
  try {
    checkAdmin(token);
    
    const props = getProps();
    
    return successResponse({
      organizationName: props.ORGANIZATION_NAME || '',
      language: props.DEFAULT_LANGUAGE || 'en'
    });
  } catch (e) {
    return errorResponse(e.message);
  }
}

/**
 * Save organization settings
 */
function saveOrganizationSettings(token, settingsData) {
  try {
    checkAdmin(token);
    
    // Validate input
    if (!settingsData || typeof settingsData !== 'object') {
      return errorResponse('Invalid settings data');
    }
    
    const { organizationName } = settingsData;
    
    if (!organizationName || typeof organizationName !== 'string') {
      return errorResponse('Organization name is required');
    }
    
    if (organizationName.length > 100) {
      return errorResponse('Organization name must be 100 characters or less');
    }
    
    // Save to properties
    PropertiesService.getScriptProperties().setProperty('ORGANIZATION_NAME', organizationName.trim());
    
    // Log activity
    const user = verifyToken(token);
    logActivity(user.userId, `Updated organization name to: ${organizationName.trim()}`);
    
    return successResponse(null, 'Organization settings saved successfully');
  } catch (e) {
    return errorResponse(e.message);
  }
}

/**
 * Save language preference
 */
function saveLanguagePreference(token, languageData) {
  try {
    checkAdmin(token);
    
    // Validate input
    if (!languageData || typeof languageData !== 'object') {
      return errorResponse('Invalid language data');
    }
    
    const { language } = languageData;
    
    if (!language || typeof language !== 'string') {
      return errorResponse('Language is required');
    }
    
    // Validate language code
    const validLanguages = ['en', 'id'];
    if (!validLanguages.includes(language)) {
      return errorResponse('Invalid language code');
    }
    
    // Save to properties
    PropertiesService.getScriptProperties().setProperty('DEFAULT_LANGUAGE', language);
    
    // Log activity
    const user = verifyToken(token);
    logActivity(user.userId, `Changed system language to: ${language}`);
    
    return successResponse(null, 'Language preference saved successfully');
  } catch (e) {
    return errorResponse(e.message);
  }
}

/**
 * Change admin password
 */
function changeAdminPassword(token, passwordData) {
  try {
    const user = checkAdmin(token);
    
    // Validate input
    if (!passwordData || typeof passwordData !== 'object') {
      return errorResponse('Invalid password data');
    }
    
    const { currentPassword, newPassword } = passwordData;
    
    if (!currentPassword || !newPassword) {
      return errorResponse('Current password and new password are required');
    }
    
    if (typeof currentPassword !== 'string' || typeof newPassword !== 'string') {
      return errorResponse('Invalid password format');
    }
    
    if (newPassword.length < 6) {
      return errorResponse('New password must be at least 6 characters long');
    }
    
    if (newPassword.length > 128) {
      return errorResponse('New password must be 128 characters or less');
    }
    
    if (currentPassword === newPassword) {
      return errorResponse('New password must be different from current password');
    }
    
    // Get current user data
    const props = getProps();
    if (!props.MASTER_DB_ID) {
      return errorResponse('System not initialized');
    }
    
    const employees = getCachedEmployees(props.MASTER_DB_ID);
    const emp = employees.find(e => e.id === user.userId);
    
    if (!emp) {
      return errorResponse('User not found');
    }
    
    // Verify current password
    const currentPasswordHash = hashPassword(currentPassword);
    if (currentPasswordHash !== emp.passwordHash) {
      return errorResponse('Current password is incorrect');
    }
    
    // Update password in spreadsheet
    const ss = SpreadsheetApp.openById(props.MASTER_DB_ID);
    const sheet = ss.getSheetByName('Employees');
    if (!sheet) {
      return errorResponse('Employees sheet not found');
    }
    
    const data = sheet.getDataRange().getValues();
    let updated = false;
    
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]) === user.userId) {
        // Update password hash (column B, index 1)
        const newPasswordHash = hashPassword(newPassword);
        sheet.getRange(i + 1, 2).setValue(newPasswordHash);
        updated = true;
        break;
      }
    }
    
    if (!updated) {
      return errorResponse('Failed to update password');
    }
    
    // Invalidate cache to force refresh
    invalidateMasterCache();
    
    // Log activity
    logActivity(user.userId, 'Changed password');
    
    return successResponse(null, 'Password changed successfully');
  } catch (e) {
    return errorResponse(e.message);
  }
}

/**
 * Get organization name for display
 */
function getOrganizationName() {
  try {
    const props = getProps();
    return props.ORGANIZATION_NAME || 'Attendance System';
  } catch (e) {
    return 'Attendance System';
  }
}

/**
 * Get current geofence configuration (admin only).
 * Reads GEOFENCE_ENABLED, WORK_LAT, WORK_LNG, GEOFENCE_RADIUS from Script Properties.
 *
 * @param {string} token - Admin session token
 * @returns {{ status: string, data: { enabled: boolean, latitude: number|null, longitude: number|null, radius: number|null } }}
 */
function getGeofenceSettings(token) {
  try {
    checkAdmin(token);

    var scriptProps = PropertiesService.getScriptProperties();
    var enabledStr  = scriptProps.getProperty('GEOFENCE_ENABLED');
    var latStr      = scriptProps.getProperty('WORK_LAT');
    var lngStr      = scriptProps.getProperty('WORK_LNG');
    var radiusStr   = scriptProps.getProperty('GEOFENCE_RADIUS');

    var enabled   = enabledStr === 'true';
    var latitude  = latStr    !== null ? parseFloat(latStr)    : null;
    var longitude = lngStr    !== null ? parseFloat(lngStr)    : null;
    var radius    = radiusStr !== null ? parseFloat(radiusStr) : null;

    // Treat NaN (malformed stored value) as null
    if (latitude  !== null && isNaN(latitude))  latitude  = null;
    if (longitude !== null && isNaN(longitude)) longitude = null;
    if (radius    !== null && isNaN(radius))    radius    = null;

    return successResponse({
      enabled:   enabled,
      latitude:  latitude,
      longitude: longitude,
      radius:    radius
    });
  } catch (e) {
    return errorResponse(e.message);
  }
}

/**
 * Save geofence configuration (admin only).
 * Validates all fields before writing; on any validation failure returns an
 * errorResponse without modifying any Script Property.
 *
 * @param {string} token - Admin session token
 * @param {{ enabled: boolean, latitude: number, longitude: number, radius: number }} data
 * @returns {{ status: string, message: string }}
 */
function saveGeofenceSettings(token, data) {
  try {
    var user = checkAdmin(token);

    if (!data || typeof data !== 'object') {
      return errorResponse('Invalid geofence settings data.');
    }

    var enabled   = data.enabled;
    var latitude  = data.latitude;
    var longitude = data.longitude;
    var radius    = data.radius;

    // Validate latitude
    if (typeof latitude !== 'number' || isNaN(latitude) || latitude < -90 || latitude > 90) {
      return errorResponse('Latitude must be between -90 and 90.');
    }

    // Validate longitude
    if (typeof longitude !== 'number' || isNaN(longitude) || longitude < -180 || longitude > 180) {
      return errorResponse('Longitude must be between -180 and 180.');
    }

    // Validate radius
    if (typeof radius !== 'number' || isNaN(radius) || radius < 10 || radius > 50000) {
      return errorResponse('Geofence radius must be between 10 and 50,000 meters.');
    }

    // All validations passed — write all four keys atomically
    var scriptProps = PropertiesService.getScriptProperties();
    scriptProps.setProperties({
      'GEOFENCE_ENABLED': enabled ? 'true' : 'false',
      'WORK_LAT':         String(latitude),
      'WORK_LNG':         String(longitude),
      'GEOFENCE_RADIUS':  String(radius)
    });

    // Log the configuration change
    logActivity(user.userId, 'Updated geofence settings: enabled=' + enabled + ', lat=' + latitude + ', lng=' + longitude + ', radius=' + radius + 'm');

    return successResponse(null, 'Geofence settings saved successfully.');
  } catch (e) {
    return errorResponse(e.message);
  }
}

/**
 * Get geofence settings without authentication (public endpoint).
 * Used by the standalone QR scanner page which has no auth token.
 * Only returns the enabled flag and work location coordinates — no sensitive data.
 *
 * @returns {{ status: string, data: { enabled: boolean, latitude?: number, longitude?: number, radius?: number } }}
 */
function getGeofenceSettingsPublic() {
  try {
    var scriptProps = PropertiesService.getScriptProperties();
    var enabled = scriptProps.getProperty('GEOFENCE_ENABLED') === 'true';
    var orgName = scriptProps.getProperty('ORGANIZATION_NAME') || 'Attendance System';

    if (!enabled) {
      return successResponse({ enabled: false, organizationName: orgName });
    }

    var lat = parseFloat(scriptProps.getProperty('WORK_LAT'));
    var lng = parseFloat(scriptProps.getProperty('WORK_LNG'));
    var radius = parseFloat(scriptProps.getProperty('GEOFENCE_RADIUS'));

    return successResponse({
      enabled: true,
      latitude: isNaN(lat) ? null : lat,
      longitude: isNaN(lng) ? null : lng,
      radius: isNaN(radius) ? null : radius,
      organizationName: orgName
    });
  } catch (e) {
    return successResponse({ enabled: false, organizationName: 'Attendance System' });
  }
}

// ============================================================================
// Monthly Report Email Configuration Functions
// ============================================================================

/**
 * Get email settings for monthly report delivery
 * @param {string} token - Admin session token
 * @returns {{ status: string, data: { enabled: boolean, recipient: string, scheduleDay: number, scheduleHour: number, scheduleMinute: number, triggerId: string|null } }}
 */
function getEmailSettings(token) {
  try {
    checkAdmin(token);
    
    const scriptProps = PropertiesService.getScriptProperties();
    const enabledStr = scriptProps.getProperty('MONTHLY_EMAIL_ENABLED');
    const recipient = scriptProps.getProperty('MONTHLY_EMAIL_RECIPIENT');
    const scheduleDayStr = scriptProps.getProperty('MONTHLY_EMAIL_SCHEDULE_DAY');
    const scheduleHourStr = scriptProps.getProperty('MONTHLY_EMAIL_SCHEDULE_HOUR');
    const scheduleMinuteStr = scriptProps.getProperty('MONTHLY_EMAIL_SCHEDULE_MINUTE');
    const triggerId = scriptProps.getProperty('MONTHLY_EMAIL_TRIGGER_ID');
    
    // Parse values with defaults
    const enabled = enabledStr === 'true';
    const scheduleDay = scheduleDayStr !== null ? parseInt(scheduleDayStr, 10) : 5;
    const scheduleHour = scheduleHourStr !== null ? parseInt(scheduleHourStr, 10) : 9;
    const scheduleMinute = scheduleMinuteStr !== null ? parseInt(scheduleMinuteStr, 10) : 0;
    
    return successResponse({
      enabled: enabled,
      recipient: recipient || '',
      scheduleDay: scheduleDay,
      scheduleHour: scheduleHour,
      scheduleMinute: scheduleMinute,
      triggerId: triggerId || null
    });
  } catch (e) {
    return errorResponse(e.message);
  }
}

/**
 * Save email settings for monthly report delivery
 * Validates email format and schedule parameters before saving
 * @param {string} token - Admin session token
 * @param {{ enabled: boolean, recipient: string, scheduleDay: number, scheduleHour: number, scheduleMinute: number }} emailData
 * @returns {{ status: string, message: string }}
 */
function saveEmailSettings(token, emailData) {
  try {
    const user = checkAdmin(token);
    
    // Validate input
    if (!emailData || typeof emailData !== 'object') {
      return errorResponse('Invalid email settings data');
    }
    
    const { enabled, recipient, scheduleDay, scheduleHour, scheduleMinute } = emailData;
    
    // Validate enabled flag
    if (typeof enabled !== 'boolean') {
      return errorResponse('Enabled flag must be a boolean');
    }
    
    // Validate recipient email if enabling automatic emails
    if (enabled) {
      if (!recipient || typeof recipient !== 'string') {
        return errorResponse('Email recipient is required when enabling automatic emails');
      }
      
      // Validate email format using regex pattern
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(recipient)) {
        return errorResponse('Invalid email format');
      }
    }
    
    // Validate schedule day (1-28)
    if (typeof scheduleDay !== 'number' || isNaN(scheduleDay)) {
      return errorResponse('Schedule day must be a number');
    }
    if (scheduleDay < 1 || scheduleDay > 28) {
      return errorResponse('Schedule day must be between 1 and 28');
    }
    if (!Number.isInteger(scheduleDay)) {
      return errorResponse('Schedule day must be an integer');
    }
    
    // Validate schedule hour (0-23)
    if (typeof scheduleHour !== 'number' || isNaN(scheduleHour)) {
      return errorResponse('Schedule hour must be a number');
    }
    if (scheduleHour < 0 || scheduleHour > 23) {
      return errorResponse('Schedule hour must be between 0 and 23');
    }
    if (!Number.isInteger(scheduleHour)) {
      return errorResponse('Schedule hour must be an integer');
    }
    
    // Validate schedule minute (0-59)
    if (typeof scheduleMinute !== 'number' || isNaN(scheduleMinute)) {
      return errorResponse('Schedule minute must be a number');
    }
    if (scheduleMinute < 0 || scheduleMinute > 59) {
      return errorResponse('Schedule minute must be between 0 and 59');
    }
    if (!Number.isInteger(scheduleMinute)) {
      return errorResponse('Schedule minute must be an integer');
    }
    
    // All validations passed - save settings
    const scriptProps = PropertiesService.getScriptProperties();
    scriptProps.setProperties({
      'MONTHLY_EMAIL_ENABLED': enabled ? 'true' : 'false',
      'MONTHLY_EMAIL_RECIPIENT': recipient || '',
      'MONTHLY_EMAIL_SCHEDULE_DAY': String(scheduleDay),
      'MONTHLY_EMAIL_SCHEDULE_HOUR': String(scheduleHour),
      'MONTHLY_EMAIL_SCHEDULE_MINUTE': String(scheduleMinute)
    });
    
    // Set up or remove trigger based on enabled state
    if (enabled) {
      // Create/update the trigger with the new schedule
      setupEmailScheduleTrigger(scheduleDay, scheduleHour, scheduleMinute);
    } else {
      // Remove the trigger if automatic emails are disabled
      removeEmailScheduleTrigger();
    }
    
    // Log activity
    logActivity(user.userId, 'Updated monthly email settings: enabled=' + enabled + ', recipient=' + recipient + ', schedule=' + scheduleDay + 'd ' + scheduleHour + ':' + scheduleMinute);
    
    return successResponse(null, 'Email settings saved successfully');
  } catch (e) {
    return errorResponse(e.message);
  }
}

/**
 * Log email delivery attempt
 * @param {string} recipient - Email address
 * @param {string} monthYear - Month/year in "YYYY-MM" format
 * @param {string} status - "success" or "failed"
 * @param {string} triggerType - "scheduled" or "manual"
 * @param {string} errorMessage - Error details if failed (optional)
 */
function logEmailDelivery(recipient, monthYear, status, triggerType, errorMessage) {
  try {
    const props = getProps();
    if (!props.MASTER_DB_ID) {
      throw new Error('System not initialized');
    }
    
    const ss = SpreadsheetApp.openById(props.MASTER_DB_ID);
    let logSheet = ss.getSheetByName('Email_Delivery_Log');
    
    // Create sheet if it doesn't exist
    if (!logSheet) {
      logSheet = ss.insertSheet('Email_Delivery_Log');
      // Set up headers (6 columns)
      logSheet.getRange(1, 1, 1, 6).setValues([[
        'Timestamp',
        'Recipient',
        'Month/Year',
        'Status',
        'Error Message',
        'Trigger Type'
      ]]);
      logSheet.getRange(1, 1, 1, 6).setFontWeight('bold');
      logSheet.setFrozenRows(1);
    }
    
    // Add log entry
    const timestamp = new Date().toISOString();
    logSheet.appendRow([
      timestamp,
      recipient,
      monthYear,
      status,
      errorMessage || '',
      triggerType
    ]);
    
  } catch (e) {
    // Log to console if sheet logging fails
    console.error('Failed to log email delivery: ' + e.message);
  }
}

/**
 * Get email delivery logs (last 10 entries)
 * @param {string} token - Admin session token
 * @returns {{ status: string, data: Array<{ timestamp: string, recipient: string, monthYear: string, status: string, errorMessage: string, triggerType: string }> }}
 */
function getEmailDeliveryLogs(token) {
  try {
    checkAdmin(token);
    
    const props = getProps();
    if (!props.MASTER_DB_ID) {
      return errorResponse('System not initialized');
    }
    
    const ss = SpreadsheetApp.openById(props.MASTER_DB_ID);
    const logSheet = ss.getSheetByName('Email_Delivery_Log');
    
    // Return empty array if sheet doesn't exist yet
    if (!logSheet) {
      return successResponse([]);
    }
    
    const data = logSheet.getDataRange().getValues();
    
    // Return empty array if only headers exist
    if (data.length <= 1) {
      return successResponse([]);
    }
    
    // Get last 10 entries (excluding header row)
    const logs = [];
    const startRow = Math.max(1, data.length - 10);
    
    for (let i = data.length - 1; i >= startRow; i--) {
      logs.push({
        timestamp: data[i][0],
        recipient: data[i][1],
        monthYear: data[i][2],
        status: data[i][3],
        errorMessage: data[i][4] || '',
        triggerType: data[i][5] || 'scheduled'
      });
    }
    
    return successResponse(logs);
  } catch (e) {
    return errorResponse(e.message);
  }
}

/**
 * Send monthly report email with PDF attachment
 * Composes email with descriptive subject and explanatory body
 * Implements retry logic with exponential backoff for transient failures
 * @param {string} recipientEmail - Email address to send report to
 * @param {GoogleAppsScript.Base.Blob} pdfBlob - PDF report blob
 * @param {number} month - Month number (1-12)
 * @param {number} year - Year (e.g., 2024)
 * @param {number} retryCount - Current retry attempt (default 0)
 * @throws {Error} If email delivery fails after all retries
 */
function sendMonthlyReportEmail(recipientEmail, pdfBlob, month, year, retryCount) {
  // Default retry count to 0 if not provided
  if (typeof retryCount === 'undefined') {
    retryCount = 0;
  }
  
  const MAX_RETRIES = 3;
  
  try {
    // Validate input parameters
    if (!recipientEmail || typeof recipientEmail !== 'string') {
      throw new Error('Recipient email is required and must be a string');
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(recipientEmail)) {
      // Invalid recipient - disable automatic sending
      const scriptProps = PropertiesService.getScriptProperties();
      scriptProps.setProperty('MONTHLY_EMAIL_ENABLED', 'false');
      throw new Error('Invalid email format - automatic sending has been disabled');
    }
    
    if (!pdfBlob) {
      throw new Error('PDF blob is required');
    }
    
    if (typeof month !== 'number' || isNaN(month) || month < 1 || month > 12) {
      throw new Error('Month must be a number between 1 and 12');
    }
    
    if (typeof year !== 'number' || isNaN(year) || year < 2000 || year > 2100) {
      throw new Error('Year must be a valid year between 2000 and 2100');
    }
    
    // Check attachment size (Gmail limit is 25MB)
    const attachmentSize = pdfBlob.getBytes().length;
    const MAX_ATTACHMENT_SIZE = 25 * 1024 * 1024; // 25MB in bytes
    
    if (attachmentSize > MAX_ATTACHMENT_SIZE) {
      throw new Error('Attachment size (' + Math.round(attachmentSize / (1024 * 1024)) + 'MB) exceeds Gmail limit of 25MB');
    }
    
    // Get organization name for email content
    const orgName = getOrganizationName();
    
    // Get translations based on system language
    const tr = getPdfTranslations();
    
    // Format month name for subject and body
    const monthName = tr.monthNames[month - 1];
    
    // Compose descriptive subject line including month and year
    const subject = tr.emailSubject + ' - ' + monthName + ' ' + year;
    
    // Compose explanatory message body about the attachment
    const body = tr.emailGreeting + '\n\n' +
      tr.emailBody1 + ' ' + monthName + ' ' + year + '.\n\n' +
      tr.emailBody2 + '\n\n' +
      tr.emailBody3 + ' ' + orgName + (tr.emailBody4 ? ' ' + tr.emailBody4 : '.') + '\n\n' +
      tr.emailBody5 + '\n\n' +
      tr.emailRegards + '\n' +
      orgName + ' Attendance System';
    
    // Send email with PDF attachment via MailApp service
    MailApp.sendEmail({
      to: recipientEmail,
      subject: subject,
      body: body,
      attachments: [pdfBlob]
    });
    
  } catch (e) {
    // Categorize error types for appropriate handling
    const errorMessage = e.message || String(e);
    
    // Check for quota exceeded errors
    if (errorMessage.indexOf('quota') !== -1 || errorMessage.indexOf('limit') !== -1) {
      // Calculate next retry time (24 hours from now)
      const nextRetryTime = new Date();
      nextRetryTime.setHours(nextRetryTime.getHours() + 24);
      const retryTimestamp = Utilities.formatDate(nextRetryTime, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
      
      throw new Error('Email quota exceeded - retry scheduled for ' + retryTimestamp + ': ' + errorMessage);
    }
    
    // Check for invalid recipient errors (already handled above, but catch any others)
    if (errorMessage.indexOf('Invalid email') !== -1 || errorMessage.indexOf('invalid recipient') !== -1) {
      throw new Error('Invalid recipient: ' + errorMessage);
    }
    
    // Check for network/transient errors that can be retried
    const isTransientError = 
      errorMessage.indexOf('network') !== -1 ||
      errorMessage.indexOf('timeout') !== -1 ||
      errorMessage.indexOf('temporarily') !== -1 ||
      errorMessage.indexOf('Service error') !== -1 ||
      errorMessage.indexOf('Backend Error') !== -1;
    
    if (isTransientError && retryCount < MAX_RETRIES) {
      // Implement exponential backoff: 2^retryCount seconds
      const backoffSeconds = Math.pow(2, retryCount);
      
      console.log('Transient error detected (attempt ' + (retryCount + 1) + '/' + MAX_RETRIES + '). Retrying in ' + backoffSeconds + ' seconds...');
      
      // Wait for backoff period
      Utilities.sleep(backoffSeconds * 1000);
      
      // Retry the email send with incremented retry count
      return sendMonthlyReportEmail(recipientEmail, pdfBlob, month, year, retryCount + 1);
    }
    
    // If we've exhausted retries or it's a non-transient error, throw with context
    if (retryCount >= MAX_RETRIES) {
      throw new Error('Failed to send monthly report email after ' + MAX_RETRIES + ' retries: ' + errorMessage);
    } else {
      throw new Error('Failed to send monthly report email: ' + errorMessage);
    }
  }
}

/**
 * Set up a time-based trigger for scheduled monthly report emails
 * Removes any existing email schedule trigger before creating a new one
 * @param {number} day - Day of month (1-28)
 * @param {number} hour - Hour of day (0-23)
 * @param {number} minute - Minute of hour (0-59)
 * @returns {string} The trigger ID of the created trigger
 * @throws {Error} If trigger creation fails or parameters are invalid
 */
function setupEmailScheduleTrigger(day, hour, minute) {
  try {
    // Validate input parameters
    if (typeof day !== 'number' || isNaN(day)) {
      throw new Error('Day must be a number');
    }
    if (day < 1 || day > 28) {
      throw new Error('Day must be between 1 and 28');
    }
    if (!Number.isInteger(day)) {
      throw new Error('Day must be an integer');
    }
    
    if (typeof hour !== 'number' || isNaN(hour)) {
      throw new Error('Hour must be a number');
    }
    if (hour < 0 || hour > 23) {
      throw new Error('Hour must be between 0 and 23');
    }
    if (!Number.isInteger(hour)) {
      throw new Error('Hour must be an integer');
    }
    
    if (typeof minute !== 'number' || isNaN(minute)) {
      throw new Error('Minute must be a number');
    }
    if (minute < 0 || minute > 59) {
      throw new Error('Minute must be between 0 and 59');
    }
    if (!Number.isInteger(minute)) {
      throw new Error('Minute must be an integer');
    }
    
    // Remove any existing email schedule trigger first
    removeEmailScheduleTrigger();
    
    // Create a new time-based trigger
    // Note: Google Apps Script triggers run monthly on the specified day
    // If the day doesn't exist in a month (e.g., day 31 in February),
    // the trigger will run on the last day of that month automatically
    const trigger = ScriptApp.newTrigger('handleScheduledEmailSend')
      .timeBased()
      .onMonthDay(day)
      .atHour(hour)
      .nearMinute(minute)
      .create();
    
    // Get the trigger ID
    const triggerId = trigger.getUniqueId();
    
    // Store the trigger ID in PropertiesService for later management
    PropertiesService.getScriptProperties().setProperty('MONTHLY_EMAIL_TRIGGER_ID', triggerId);
    
    return triggerId;
    
  } catch (e) {
    throw new Error('Failed to set up email schedule trigger: ' + e.message);
  }
}

/**
 * Remove the existing email schedule trigger
 * Handles cases where trigger ID is invalid or trigger doesn't exist
 */
function removeEmailScheduleTrigger() {
  try {
    const scriptProps = PropertiesService.getScriptProperties();
    const triggerId = scriptProps.getProperty('MONTHLY_EMAIL_TRIGGER_ID');
    
    // If no trigger ID is stored, nothing to remove
    if (!triggerId) {
      return;
    }
    
    // Get all triggers for this project
    const allTriggers = ScriptApp.getProjectTriggers();
    
    // Find and delete the trigger with matching ID
    for (let i = 0; i < allTriggers.length; i++) {
      if (allTriggers[i].getUniqueId() === triggerId) {
        ScriptApp.deleteTrigger(allTriggers[i]);
        break;
      }
    }
    
    // Clear the stored trigger ID
    scriptProps.deleteProperty('MONTHLY_EMAIL_TRIGGER_ID');
    
  } catch (e) {
    // Log warning but don't throw - we want to continue with new trigger creation
    console.warn('Failed to remove existing trigger: ' + e.message);
  }
}

/**
 * Handle scheduled email send (called by time-based trigger)
 * Generates and sends monthly report for the previous month
 * Implements comprehensive error handling with detailed logging
 */
function handleScheduledEmailSend() {
  let recipient = 'unknown';
  let monthYear = '';
  
  try {
    // Get email settings
    const scriptProps = PropertiesService.getScriptProperties();
    const enabled = scriptProps.getProperty('MONTHLY_EMAIL_ENABLED') === 'true';
    recipient = scriptProps.getProperty('MONTHLY_EMAIL_RECIPIENT');
    
    // Check if automatic emails are enabled
    if (!enabled) {
      console.log('Automatic monthly emails are disabled. Skipping scheduled send.');
      return;
    }
    
    // Validate recipient
    if (!recipient) {
      throw new Error('No recipient email configured');
    }
    
    // Calculate previous month and year
    const now = new Date();
    let month = now.getMonth(); // 0-11 (0 = January)
    let year = now.getFullYear();
    
    // If current month is January (0), previous month is December of previous year
    if (month === 0) {
      month = 12;
      year = year - 1;
    }
    // Otherwise, getMonth() returns 0-indexed so the previous month is the current 0-indexed value
    // e.g. getMonth() = 3 (April) means previous month = March = 3 (1-indexed)
    
    const reportMonth = month; // already 1-indexed: either 12 (from Jan case) or getMonth() which equals previous month in 1-indexed
    monthYear = year + '-' + String(reportMonth).padStart(2, '0');
    
    // Generate PDF for previous month
    let pdfBlob;
    try {
      pdfBlob = generateMonthlyReportPDF(reportMonth, year);
    } catch (pdfError) {
      // Log PDF generation failure with specific error
      logEmailDelivery(recipient, monthYear, 'failed', 'scheduled', 'PDF generation failed: ' + pdfError.message);
      throw new Error('Failed to generate PDF report: ' + pdfError.message);
    }
    
    // Send email with PDF attachment (includes retry logic)
    try {
      sendMonthlyReportEmail(recipient, pdfBlob, reportMonth, year);
    } catch (emailError) {
      // Check if automatic sending was disabled due to invalid recipient
      const stillEnabled = scriptProps.getProperty('MONTHLY_EMAIL_ENABLED') === 'true';
      if (!stillEnabled) {
        // Log that automatic sending was disabled
        logEmailDelivery(recipient, monthYear, 'failed', 'scheduled', 'Invalid recipient - automatic sending disabled: ' + emailError.message);
      } else {
        // Log other email delivery failures
        logEmailDelivery(recipient, monthYear, 'failed', 'scheduled', emailError.message);
      }
      throw emailError;
    }
    
    // Log successful delivery
    logEmailDelivery(recipient, monthYear, 'success', 'scheduled', '');
    
    console.log('Successfully sent scheduled monthly report for ' + monthYear);
    
  } catch (e) {
    // Ensure error is logged even if logging above failed
    const errorMessage = e.message || String(e);
    
    // If monthYear wasn't set, calculate it for logging
    if (!monthYear) {
      const now = new Date();
      let month = now.getMonth(); // 0-11
      let year = now.getFullYear();
      if (month === 0) {
        month = 12;
        year = year - 1;
      }
      // month is now either 12 (January case) or the 0-indexed value which equals
      // the previous month in 1-indexed (e.g. getMonth()=3 → March = 3 in 1-indexed)
      monthYear = year + '-' + String(month).padStart(2, '0');
    }
    
    // Try to log the error if not already logged
    try {
      const scriptProps = PropertiesService.getScriptProperties();
      if (!recipient || recipient === 'unknown') {
        recipient = scriptProps.getProperty('MONTHLY_EMAIL_RECIPIENT') || 'unknown';
      }
      
      // Check if this error was already logged by checking recent logs
      const logs = getEmailDeliveryLogsInternal();
      const alreadyLogged = logs.length > 0 && 
        logs[0].monthYear === monthYear && 
        logs[0].status === 'failed' &&
        logs[0].triggerType === 'scheduled';
      
      if (!alreadyLogged) {
        logEmailDelivery(recipient, monthYear, 'failed', 'scheduled', errorMessage);
      }
    } catch (logError) {
      console.error('Failed to log error: ' + logError.message);
    }
    
    console.error('Failed to send scheduled monthly report for ' + monthYear + ': ' + errorMessage);
  }
}

/**
 * Internal function to get email delivery logs without token validation
 * Used by handleScheduledEmailSend to check if error was already logged
 * @returns {Array<{ timestamp: string, recipient: string, monthYear: string, status: string, errorMessage: string, triggerType: string }>}
 */
function getEmailDeliveryLogsInternal() {
  try {
    const props = getProps();
    if (!props.MASTER_DB_ID) {
      return [];
    }
    
    const ss = SpreadsheetApp.openById(props.MASTER_DB_ID);
    const logSheet = ss.getSheetByName('Email_Delivery_Log');
    
    if (!logSheet) {
      return [];
    }
    
    const data = logSheet.getDataRange().getValues();
    
    if (data.length <= 1) {
      return [];
    }
    
    // Get last 10 entries
    const logs = [];
    const startRow = Math.max(1, data.length - 10);
    
    for (let i = data.length - 1; i >= startRow; i--) {
      logs.push({
        timestamp: data[i][0],
        recipient: data[i][1],
        monthYear: data[i][2],
        status: data[i][3],
        errorMessage: data[i][4] || '',
        triggerType: data[i][5] || 'scheduled'
      });
    }
    
    return logs;
  } catch (e) {
    return [];
  }
}

/**
 * Send monthly report email manually (on-demand)
 * Generates and sends current month's report immediately
 * @param {string} token - Admin session token
 * @returns {{ status: string, message: string, data?: { recipient: string, monthYear: string } }}
 */
function sendManualMonthlyReport(token) {
  let recipient = 'unknown';
  let monthYear = '';
  
  try {
    // Authenticate admin user
    const user = checkAdmin(token);
    
    // Get email settings from PropertiesService
    const scriptProps = PropertiesService.getScriptProperties();
    recipient = scriptProps.getProperty('MONTHLY_EMAIL_RECIPIENT');
    
    // Validate recipient email is configured
    if (!recipient || recipient.trim() === '') {
      return errorResponse('No recipient email configured. Please configure email settings first.');
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(recipient)) {
      return errorResponse('Invalid recipient email format. Please update email settings.');
    }
    
    // Calculate current month and year
    const now = new Date();
    const currentMonth = now.getMonth() + 1; // getMonth() returns 0-11, we need 1-12
    const currentYear = now.getFullYear();
    
    monthYear = currentYear + '-' + String(currentMonth).padStart(2, '0');
    
    // Generate PDF report for current month using generateMonthlyReportPDF()
    let pdfBlob;
    try {
      pdfBlob = generateMonthlyReportPDF(currentMonth, currentYear);
    } catch (pdfError) {
      // Log PDF generation failure
      logEmailDelivery(recipient, monthYear, 'failed', 'manual', 'PDF generation failed: ' + pdfError.message);
      return errorResponse('Failed to generate PDF report: ' + pdfError.message);
    }
    
    // Send email using sendMonthlyReportEmail() (includes retry logic)
    try {
      sendMonthlyReportEmail(recipient, pdfBlob, currentMonth, currentYear);
    } catch (emailError) {
      // Log email delivery failure
      logEmailDelivery(recipient, monthYear, 'failed', 'manual', emailError.message);
      return errorResponse('Failed to send email: ' + emailError.message);
    }
    
    // Log successful delivery with triggerType="manual"
    logEmailDelivery(recipient, monthYear, 'success', 'manual', '');
    
    // Log activity
    logActivity(user.userId, 'Manually sent monthly report for ' + monthYear + ' to ' + recipient);
    
    // Return success response for UI feedback
    return successResponse(
      {
        recipient: recipient,
        monthYear: monthYear
      },
      'Monthly report sent successfully to ' + recipient
    );
    
  } catch (e) {
    // Handle any unexpected errors
    const errorMessage = e.message || String(e);
    
    // Try to log the error if we have recipient and monthYear
    if (recipient && recipient !== 'unknown' && monthYear) {
      try {
        logEmailDelivery(recipient, monthYear, 'failed', 'manual', errorMessage);
      } catch (logError) {
        console.error('Failed to log error: ' + logError.message);
      }
    }
    
    return errorResponse(errorMessage);
  }
}

/**
 * Generate a PDF report for monthly attendance data
 * Uses existing getReportData function with "monthly" period
 * @param {number} month - Month number (1-12)
 * @param {number} year - Year (e.g., 2024)
 * @returns {GoogleAppsScript.Base.Blob} PDF blob
 */
/**
 * Returns a translation map for PDF/email content based on the system language setting.
 */
function getPdfTranslations() {
  const lang = (PropertiesService.getScriptProperties().getProperty('DEFAULT_LANGUAGE') || 'en').toLowerCase();
  const translations = {
    en: {
      monthlyAttendanceReport: 'Monthly Attendance Report',
      noDataAvailable: 'No attendance data available for this month.',
      employeeId: 'Employee ID',
      employeeName: 'Employee Name',
      position: 'Position',
      onTime: 'On Time',
      late: 'Late',
      earlyLeave: 'Early Leave',
      totalDays: 'Total Days',
      summaryStatistics: 'Summary Statistics',
      totalOnTime: 'Total On Time',
      totalLate: 'Total Late',
      totalEarlyLeave: 'Total Early Leave',
      totalEmployees: 'Total Employees',
      emailSubject: 'Monthly Attendance Report',
      emailGreeting: 'Dear Administrator,',
      emailBody1: 'Please find attached the monthly attendance report for',
      emailBody2: 'This report contains a comprehensive summary of employee attendance data for the specified period, including on-time arrivals, late arrivals, early departures, and overall attendance statistics.',
      emailBody3: 'The report has been automatically generated by the',
      emailBody4: 'attendance management system.',
      emailBody5: 'If you have any questions or need additional information, please contact your system administrator.',
      emailRegards: 'Best regards,',
      monthNames: ['January','February','March','April','May','June','July','August','September','October','November','December']
    },
    id: {
      monthlyAttendanceReport: 'Laporan Absensi Bulanan',
      noDataAvailable: 'Tidak ada data absensi tersedia untuk bulan ini.',
      employeeId: 'ID Karyawan',
      employeeName: 'Nama Karyawan',
      position: 'Jabatan',
      onTime: 'Tepat Waktu',
      late: 'Terlambat',
      earlyLeave: 'Pulang Awal',
      totalDays: 'Total Hari',
      summaryStatistics: 'Ringkasan Statistik',
      totalOnTime: 'Total Tepat Waktu',
      totalLate: 'Total Terlambat',
      totalEarlyLeave: 'Total Pulang Awal',
      totalEmployees: 'Total Karyawan',
      emailSubject: 'Laporan Absensi Bulanan',
      emailGreeting: 'Kepada Yth. Administrator,',
      emailBody1: 'Terlampir laporan absensi bulanan untuk',
      emailBody2: 'Laporan ini berisi ringkasan lengkap data absensi karyawan untuk periode yang ditentukan, termasuk kedatangan tepat waktu, keterlambatan, kepulangan awal, dan statistik absensi secara keseluruhan.',
      emailBody3: 'Laporan ini dibuat secara otomatis oleh sistem manajemen absensi',
      emailBody4: '',
      emailBody5: 'Jika Anda memiliki pertanyaan atau membutuhkan informasi tambahan, silakan hubungi administrator sistem Anda.',
      emailRegards: 'Hormat kami,',
      monthNames: ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember']
    }
  };
  return translations[lang] || translations['en'];
}

function generateMonthlyReportPDF(month, year) {
  try {
    // Validate input parameters
    if (typeof month !== 'number' || isNaN(month) || month < 1 || month > 12) {
      throw new Error('Month must be a number between 1 and 12');
    }
    if (typeof year !== 'number' || isNaN(year) || year < 2000 || year > 2100) {
      throw new Error('Year must be a valid year between 2000 and 2100');
    }
    
    // Calculate date range for the specified month
    const startDate = Utilities.formatDate(
      new Date(year, month - 1, 1),
      Session.getScriptTimeZone(),
      'yyyy-MM-dd'
    );
    
    // Get last day of month
    const endDate = Utilities.formatDate(
      new Date(year, month, 0),
      Session.getScriptTimeZone(),
      'yyyy-MM-dd'
    );
    
    // Get report data using existing function
    // Note: getReportData requires a token, but we're calling it internally
    // We'll need to create a system token or modify the approach
    const props = getProps();
    const masterDbId = props.MASTER_DB_ID;
    
    if (!masterDbId) {
      throw new Error('System not initialized');
    }
    
    // Directly fetch report data without token (internal call)
    const result = {
      reportData: [],
      summary: { totalOnTime: 0, totalLate: 0, totalAbsent: 0 }
    };
    
    // Collect attendance data for the specified month
    const startYear = year;
    const endYear = year;
    
    let attData = [];
    for (let y = startYear; y <= endYear; y++) {
      const dbId = props['ATTENDANCE_DB_ID_' + y];
      if (!dbId) continue;
      const rows = getSheetData(dbId, 'Attendance_Data');
      for (let i = 1; i < rows.length; i++) {
        attData.push(rows[i]);
      }
    }
    
    const employees = getCachedEmployees(masterDbId);
    const positions = getCachedPositions(masterDbId);
    
    // Build lookup maps
    const positionMap = {};
    for (let i = 0; i < positions.length; i++) {
      positionMap[positions[i].id] = positions[i].name;
    }
    const employeeMap = {};
    for (let i = 0; i < employees.length; i++) {
      employeeMap[employees[i].id] = {
        name: employees[i].name,
        position: positionMap[employees[i].jabatan_id] || 'N/A'
      };
    }
    
    // Aggregate data by employee within date range
    const recapMap = {};
    for (let i = 0; i < attData.length; i++) {
      const row = attData[i];
      const rowDate = row[0] instanceof Date
        ? Utilities.formatDate(row[0], Session.getScriptTimeZone(), 'yyyy-MM-dd')
        : String(row[0]).substring(0, 10);
      
      if (rowDate < startDate || rowDate > endDate) continue;
      
      const empId = String(row[1]);
      if (!recapMap[empId]) {
        recapMap[empId] = {
          employeeId: empId,
          employeeName: employeeMap[empId] ? employeeMap[empId].name : empId,
          position: employeeMap[empId] ? employeeMap[empId].position : 'N/A',
          onTime: 0,
          late: 0,
          absent: 0,
          totalDays: 0
        };
      }
      
      recapMap[empId].totalDays++;
      
      if (row[3] === 'Tepat Waktu') { recapMap[empId].onTime++; result.summary.totalOnTime++; }
      if (row[3] === 'Terlambat') { recapMap[empId].late++; result.summary.totalLate++; }
      if (row[5] === 'Pulang Awal') { recapMap[empId].absent++; result.summary.totalAbsent++; }
    }
    
    result.reportData = Object.values(recapMap);
    
    // Get organization name
    const orgName = getOrganizationName();
    
    // Get translations based on system language
    const tr = getPdfTranslations();
    
    // Format month/year for display
    const monthYearLabel = tr.monthNames[month - 1] + ' ' + year;
    
    // Build HTML content for PDF
    let htmlContent = '<html><head><style>';
    htmlContent += 'body { font-family: Arial, sans-serif; margin: 20px; }';
    htmlContent += 'h1 { color: #333; text-align: center; margin-bottom: 5px; }';
    htmlContent += 'h2 { color: #666; text-align: center; margin-top: 5px; margin-bottom: 20px; font-size: 18px; }';
    htmlContent += 'table { width: 100%; border-collapse: collapse; margin-top: 20px; }';
    htmlContent += 'th { background-color: #4CAF50; color: white; padding: 10px; text-align: left; border: 1px solid #ddd; }';
    htmlContent += 'td { padding: 8px; border: 1px solid #ddd; }';
    htmlContent += 'tr:nth-child(even) { background-color: #f2f2f2; }';
    htmlContent += '.summary { margin-top: 20px; padding: 15px; background-color: #e8f5e9; border-radius: 5px; }';
    htmlContent += '.summary h3 { margin-top: 0; color: #2e7d32; }';
    htmlContent += '.no-data { text-align: center; padding: 40px; color: #999; font-size: 16px; }';
    htmlContent += '</style></head><body>';
    
    // Add header
    htmlContent += '<h1>' + orgName + '</h1>';
    htmlContent += '<h2>' + tr.monthlyAttendanceReport + ' - ' + monthYearLabel + '</h2>';
    
    // Check if there's data
    if (result.reportData.length === 0) {
      htmlContent += '<div class="no-data">' + tr.noDataAvailable + '</div>';
    } else {
      // Add employee attendance table
      htmlContent += '<table>';
      htmlContent += '<thead><tr>';
      htmlContent += '<th>' + tr.employeeId + '</th>';
      htmlContent += '<th>' + tr.employeeName + '</th>';
      htmlContent += '<th>' + tr.position + '</th>';
      htmlContent += '<th>' + tr.onTime + '</th>';
      htmlContent += '<th>' + tr.late + '</th>';
      htmlContent += '<th>' + tr.earlyLeave + '</th>';
      htmlContent += '<th>' + tr.totalDays + '</th>';
      htmlContent += '</tr></thead><tbody>';
      
      for (let i = 0; i < result.reportData.length; i++) {
        const emp = result.reportData[i];
        htmlContent += '<tr>';
        htmlContent += '<td>' + emp.employeeId + '</td>';
        htmlContent += '<td>' + emp.employeeName + '</td>';
        htmlContent += '<td>' + emp.position + '</td>';
        htmlContent += '<td>' + emp.onTime + '</td>';
        htmlContent += '<td>' + emp.late + '</td>';
        htmlContent += '<td>' + emp.absent + '</td>';
        htmlContent += '<td>' + emp.totalDays + '</td>';
        htmlContent += '</tr>';
      }
      
      htmlContent += '</tbody></table>';
      
      // Add summary statistics
      htmlContent += '<div class="summary">';
      htmlContent += '<h3>' + tr.summaryStatistics + '</h3>';
      htmlContent += '<p><strong>' + tr.totalOnTime + ':</strong> ' + result.summary.totalOnTime + '</p>';
      htmlContent += '<p><strong>' + tr.totalLate + ':</strong> ' + result.summary.totalLate + '</p>';
      htmlContent += '<p><strong>' + tr.totalEarlyLeave + ':</strong> ' + result.summary.totalAbsent + '</p>';
      htmlContent += '<p><strong>' + tr.totalEmployees + ':</strong> ' + result.reportData.length + '</p>';
      htmlContent += '</div>';
    }
    
    htmlContent += '</body></html>';
    
    // Convert HTML to PDF
    const pdfBlob = Utilities.newBlob(htmlContent, 'text/html', 'report.html')
      .getAs('application/pdf')
      .setName('Monthly_Attendance_Report_' + year + '_' + String(month).padStart(2, '0') + '.pdf');
    
    return pdfBlob;
    
  } catch (e) {
    throw new Error('Failed to generate PDF report: ' + e.message);
  }
}
