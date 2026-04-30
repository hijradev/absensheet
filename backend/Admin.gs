// Admin.gs

function checkAdmin(token) {
  const user = verifyToken(token);
  if (!user || user.role !== "Admin") throw new Error("Unauthorized");
  return user;
}

/**
 * NEW: Returns only dashboard data (stats + recap) for fast initial load.
 * Management data (employees, shifts, positions) loaded separately on-demand.
 */
function getDashboardData(token) {
  try {
    checkAdmin(token);
    const props = getProps();
    const currentYear = new Date().getFullYear();
    const attendanceDbId = props["ATTENDANCE_DB_ID_" + currentYear];

    const result = {
      stats: { tepatWaktu: 0, terlambat: 0, bolos: 0 },
      monthStats: { tepatWaktu: 0, terlambat: 0, bolos: 0, notPresent: 0 },
      recap: [],
      monthlyTrend: []
    };

    if (attendanceDbId) {
      const attData = getSheetData(attendanceDbId, "Attendance_Data");

      // Build employee name lookup
      const masterDbId = props.MASTER_DB_ID;
      const employeeMap = {};
      if (masterDbId) {
        const employees = getCachedEmployees(masterDbId);
        for (let i = 0; i < employees.length; i++) {
          employeeMap[employees[i].id] = employees[i].name;
        }
      }
      
      // Calculate current week range
      const now = new Date();
      const day = now.getDay() || 7; // 1-7 (Mon-Sun)
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - day + 1);
      weekStart.setHours(0, 0, 0, 0);
      
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      weekEnd.setHours(23, 59, 59, 999);
      
      const weekStartStr = Utilities.formatDate(weekStart, Session.getScriptTimeZone(), "yyyy-MM-dd");
      const weekEndStr = Utilities.formatDate(weekEnd, Session.getScriptTimeZone(), "yyyy-MM-dd");

      // Calculate current month range (e.g. "2026-04")
      const currentMonthKey = Utilities.formatDate(now, Session.getScriptTimeZone(), "yyyy-MM");
      
      const recapMap = {};
      // monthlyMap: key = "YYYY-MM", value = { onTime, late, absent, notPresent, totalRecords }
      const monthlyMap = {};

      for (let i = 1; i < attData.length; i++) {
        const empId = String(attData[i][1]);
        const rowDate = attData[i][0] instanceof Date
          ? Utilities.formatDate(attData[i][0], Session.getScriptTimeZone(), "yyyy-MM-dd")
          : String(attData[i][0]).substring(0, 10);

        if (!recapMap[empId]) {
          recapMap[empId] = {
            id: empId,
            name: employeeMap[empId] || empId,
            onTime: 0,
            late: 0,
            absent: 0,
            notPresent: 0
          };
        }

        // Monthly trend: group by "YYYY-MM"
        const monthKey = rowDate.substring(0, 7);
        if (!monthlyMap[monthKey]) {
          monthlyMap[monthKey] = { onTime: 0, late: 0, absent: 0, notPresent: 0, totalRecords: 0 };
        }

        monthlyMap[monthKey].totalRecords++;

        // Check if date is within current week
        const isInCurrentWeek = rowDate >= weekStartStr && rowDate <= weekEndStr;
        // Check if date is within current month
        const isInCurrentMonth = monthKey === currentMonthKey;

        const checkIn = attData[i][3];
        const checkOut = attData[i][5];

        if (checkIn === "Tepat Waktu") {
          monthlyMap[monthKey].onTime++;
          if (isInCurrentWeek) {
            recapMap[empId].onTime++;
            result.stats.onTime = (result.stats.onTime || 0) + 1;
          }
          if (isInCurrentMonth) {
            result.monthStats.tepatWaktu++;
          }
        } else if (checkIn === "Terlambat") {
          monthlyMap[monthKey].late++;
          if (isInCurrentWeek) {
            recapMap[empId].late++;
            result.stats.late = (result.stats.late || 0) + 1;
          }
          if (isInCurrentMonth) {
            result.monthStats.terlambat++;
          }
        } else if (checkIn === "Tidak Hadir") {
          monthlyMap[monthKey].notPresent++;
          if (isInCurrentWeek) {
            recapMap[empId].notPresent++;
            result.stats.notPresent = (result.stats.notPresent || 0) + 1;
          }
          if (isInCurrentMonth) {
            result.monthStats.notPresent++;
          }
        } else if (checkIn === "Bolos" || checkOut === "Bolos") {
          monthlyMap[monthKey].absent++;
          if (isInCurrentWeek) {
            recapMap[empId].absent++;
            result.stats.absent = (result.stats.absent || 0) + 1;
          }
          if (isInCurrentMonth) {
            result.monthStats.bolos++;
          }
        } else {
          monthlyMap[monthKey].notPresent++;
          if (isInCurrentWeek) {
            // If no specific match, default to not present
            recapMap[empId].notPresent++;
            result.stats.notPresent = (result.stats.notPresent || 0) + 1;
          }
          if (isInCurrentMonth) {
            result.monthStats.notPresent++;
          }
        }
      }

      // Sort by timeliness (onTime) descending — top performers first
      result.recap = Object.values(recapMap).sort((a, b) => b.onTime - a.onTime);

      // Build monthly trend array sorted chronologically
      const monthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
      result.monthlyTrend = Object.keys(monthlyMap)
        .sort()
        .map(function(key) {
          const m = monthlyMap[key];
          const total = m.totalRecords;
          const pct = total > 0 ? Math.round((m.onTime / total) * 100) : 0;
          const parts = key.split("-");
          const label = monthNames[parseInt(parts[1], 10) - 1] + " " + parts[0];
          return { month: key, label: label, percentage: pct, onTime: m.onTime, late: m.late, absent: m.absent, notPresent: m.notPresent, total: total };
        });
    }

    return successResponse(result);
  } catch (e) {
    return errorResponse(e.message);
  }
}

/**
 * NEW: Returns management data (employees, shifts, positions, logs).
 * Called lazily when user opens a management tab.
 */
function getAdminInitialData(token) {
  try {
    checkAdmin(token);
    const props = getProps();
    const masterDbId = props.MASTER_DB_ID;
    const logDbId = props.LOG_DB_ID;
    const result = { employees: [], shifts: [], positions: [], logs: [] };

    if (masterDbId) {
      result.employees = sanitizeEmployeesForClient(getCachedEmployees(masterDbId));
      result.shifts    = getCachedShifts(masterDbId);
      result.positions = getCachedPositions(masterDbId);
    }

    if (logDbId) {
      const logData = getSheetData(logDbId, "Activity_Log");
      for (let i = logData.length - 1; i >= Math.max(1, logData.length - 100); i--) {
        result.logs.push({
          timestamp: logData[i][0] instanceof Date
            ? Utilities.formatDate(logData[i][0], Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss")
            : String(logData[i][0]),
          user_id: logData[i][1],
          action:  logData[i][2]
        });
      }
    }

    return successResponse(result);
  } catch (e) {
    return errorResponse(e.message);
  }
}

/**
 * NEW: Returns only activity logs (last 100 entries).
 * Called lazily when user opens the logs tab.
 */
function getActivityLogs(token) {
  try {
    checkAdmin(token);
    const props = getProps();
    const logDbId = props.LOG_DB_ID;
    const logs = [];

    if (logDbId) {
      const logData = getSheetData(logDbId, "Activity_Log");
      for (let i = logData.length - 1; i >= Math.max(1, logData.length - 100); i--) {
        logs.push({
          timestamp: logData[i][0] instanceof Date
            ? Utilities.formatDate(logData[i][0], Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss")
            : String(logData[i][0]),
          user_id: logData[i][1],
          action:  logData[i][2]
        });
      }
    }

    return successResponse(logs);
  } catch (e) {
    return errorResponse(e.message);
  }
}

/**
 * DEPRECATED: Use getDashboardData() + getAdminInitialData() instead.
 * Kept for backward compatibility during migration.
 */
function getAdminAllData(token) {
  try {
    checkAdmin(token);
    const props = getProps();
    const currentYear = new Date().getFullYear();
    const attendanceDbId = props["ATTENDANCE_DB_ID_" + currentYear];
    const masterDbId = props.MASTER_DB_ID;
    const logDbId = props.LOG_DB_ID;

    const result = {
      stats: { tepatWaktu: 0, terlambat: 0, bolos: 0 },
      logs: [],
      recap: [],
      management: { employees: [], shifts: [], positions: [], logs: [] }
    };

    // 1. Attendance stats & recap (must be fresh — changes frequently)
    if (attendanceDbId) {
      const attData = getSheetData(attendanceDbId, "Attendance_Data");

      // Build employee name lookup
      const empNameMap = {};
      if (masterDbId) {
        const employees = getCachedEmployees(masterDbId);
        for (let i = 0; i < employees.length; i++) {
          empNameMap[employees[i].id] = employees[i].name;
        }
      }
      
      // Calculate current month range
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      monthStart.setHours(0, 0, 0, 0);
      
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      monthEnd.setHours(23, 59, 59, 999);
      
      const monthStartStr = Utilities.formatDate(monthStart, Session.getScriptTimeZone(), "yyyy-MM-dd");
      const monthEndStr = Utilities.formatDate(monthEnd, Session.getScriptTimeZone(), "yyyy-MM-dd");
      
      const recapMap = {};

      for (let i = 1; i < attData.length; i++) {
        const empId = String(attData[i][1]);
        const rowDate = attData[i][0] instanceof Date
          ? Utilities.formatDate(attData[i][0], Session.getScriptTimeZone(), "yyyy-MM-dd")
          : String(attData[i][0]).substring(0, 10);

        if (!recapMap[empId]) {
          recapMap[empId] = {
            id: empId,
            name: empNameMap[empId] || empId,
            tepatWaktu: 0,
            terlambat: 0,
            bolos: 0
          };
        }

        // Check if date is within current month
        const isInCurrentMonth = rowDate >= monthStartStr && rowDate <= monthEndStr;

        if (attData[i][3] === "Tepat Waktu") { recapMap[empId].tepatWaktu++; if (isInCurrentMonth) result.stats.tepatWaktu++; }
        if (attData[i][3] === "Terlambat")   { recapMap[empId].terlambat++;  if (isInCurrentMonth) result.stats.terlambat++; }
        if (attData[i][5] === "Bolos")        { recapMap[empId].bolos++;      if (isInCurrentMonth) result.stats.bolos++; }
      }

      // Sort by timeliness (tepatWaktu) descending — top performers first
      result.recap = Object.values(recapMap).sort((a, b) => b.tepatWaktu - a.tepatWaktu);
    }

    // 2. Master data — served from cache when warm
    if (masterDbId) {
      result.management.employees = sanitizeEmployeesForClient(getCachedEmployees(masterDbId));
      result.management.shifts    = getCachedShifts(masterDbId);
      result.management.positions = getCachedPositions(masterDbId);
    }

    // 3. Activity logs (last 100)
    if (logDbId) {
      const logData = getSheetData(logDbId, "Activity_Log");
      for (let i = logData.length - 1; i >= Math.max(1, logData.length - 100); i--) {
        result.management.logs.push({
          timestamp: logData[i][0] instanceof Date
            ? Utilities.formatDate(logData[i][0], Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss")
            : String(logData[i][0]),
          user_id: logData[i][1],
          action:  logData[i][2]
        });
      }
      result.logs = result.management.logs.slice(0, 10);
    }

    return successResponse(result);
  } catch (e) {
    return errorResponse(e.message);
  }
}

/**
 * Returns report data filtered by period preset OR explicit date range.
 * Call as getReportData(token, "monthly") for preset
 * Call as getReportData(token, "2026-01-01", "2026-04-30") for custom range
 */
function getReportData(token, startDateOrPeriod, endDate) {
  try {
    checkAdmin(token);
    const props = getProps();
    const masterDbId = props.MASTER_DB_ID;

    const result = {
      reportData: [],
      summary: { totalOnTime: 0, totalLate: 0, totalAbsent: 0 }
    };

    if (!masterDbId) return successResponse(result);

    // Resolve period presets into concrete date strings
    var startDate;
    var presets = ['weekly', 'monthly', 'yearly'];
    if (presets.indexOf(startDateOrPeriod) !== -1) {
      var now = new Date();
      endDate = Utilities.formatDate(now, Session.getScriptTimeZone(), "yyyy-MM-dd");
      if (startDateOrPeriod === 'weekly') {
        var d = new Date(now);
        d.setDate(now.getDate() - 7);
        startDate = Utilities.formatDate(d, Session.getScriptTimeZone(), "yyyy-MM-dd");
      } else if (startDateOrPeriod === 'yearly') {
        startDate = now.getFullYear() + "-01-01";
      } else { // monthly
        startDate = Utilities.formatDate(
          new Date(now.getFullYear(), now.getMonth(), 1),
          Session.getScriptTimeZone(), "yyyy-MM-dd"
        );
      }
    } else {
      startDate = startDateOrPeriod;
    }

    if (!startDate || !endDate) return errorResponse("Please provide a start date and end date.");

    // Collect attendance data across all years that fall within the range
    var startYear = parseInt(startDate.substring(0, 4), 10);
    var endYear   = parseInt(endDate.substring(0, 4), 10);

    var attData = [];
    for (var y = startYear; y <= endYear; y++) {
      var dbId = props["ATTENDANCE_DB_ID_" + y];
      if (!dbId) continue;
      var rows = getSheetData(dbId, "Attendance_Data");
      for (var i = 1; i < rows.length; i++) {
        attData.push(rows[i]);
      }
    }

    var employees = getCachedEmployees(masterDbId);
    var positions = getCachedPositions(masterDbId);

    // Build lookup maps
    var positionMap = {};
    for (var i = 0; i < positions.length; i++) {
      positionMap[positions[i].id] = positions[i].name;
    }
    var employeeMap = {};
    for (var i = 0; i < employees.length; i++) {
      employeeMap[employees[i].id] = {
        name: employees[i].name,
        position: positionMap[employees[i].jabatan_id] || "N/A"
      };
    }

    // Aggregate data by employee within [startDate, endDate]
    var recapMap = {};
    for (var i = 0; i < attData.length; i++) {
      var row = attData[i];
      var rowDate = row[0] instanceof Date
        ? Utilities.formatDate(row[0], Session.getScriptTimeZone(), "yyyy-MM-dd")
        : String(row[0]).substring(0, 10);

      if (rowDate < startDate || rowDate > endDate) continue;

      var empId = String(row[1]);
      if (!recapMap[empId]) {
        recapMap[empId] = {
          employeeId:   empId,
          employeeName: employeeMap[empId] ? employeeMap[empId].name : empId,
          position:     employeeMap[empId] ? employeeMap[empId].position : "N/A",
          onTime:    0,
          late:      0,
          absent:    0,
          totalDays: 0
        };
      }

      recapMap[empId].totalDays++;

      if (row[3] === "Tepat Waktu") { recapMap[empId].onTime++;   result.summary.totalOnTime++; }
      if (row[3] === "Terlambat")   { recapMap[empId].late++;     result.summary.totalLate++;   }
      if (row[5] === "Bolos")       { recapMap[empId].absent++;   result.summary.totalAbsent++; }
    }

    result.reportData = Object.values(recapMap);
    return successResponse(result);
  } catch (e) {
    return errorResponse(e.message);
  }
}

function getRecap(token) {
  try {
    checkAdmin(token);
    const props = getProps();
    const currentYear = new Date().getFullYear();
    const attendanceDbId = props["ATTENDANCE_DB_ID_" + currentYear];
    if (!attendanceDbId) return successResponse([]);

    const attData = getSheetData(attendanceDbId, "Attendance_Data");
    const recap = {};
    for (let i = 1; i < attData.length; i++) {
      const empId = String(attData[i][1]);
      if (!recap[empId]) recap[empId] = { id: empId, tepatWaktu: 0, terlambat: 0, bolos: 0 };
      if (attData[i][3] === "Tepat Waktu") recap[empId].tepatWaktu++;
      if (attData[i][3] === "Terlambat")   recap[empId].terlambat++;
      if (attData[i][5] === "Bolos")        recap[empId].bolos++;
    }
    return successResponse(Object.values(recap));
  } catch (e) {
    return errorResponse(e.message);
  }
}

// ===== CRUD — invalidate cache after every write =====

function saveUser(token, userData) {
  try {
    const admin = checkAdmin(token);
    const props = getProps();

    // Input validation
    if (!userData || typeof userData !== 'object') throw new Error("Invalid data.");
    const { id, password, name, shift_id, role, photo_url, jabatan_id, isNew } = userData;
    if (!id || typeof id !== 'string' || id.trim().length === 0 || id.length > 50) throw new Error("Invalid Employee ID.");
    if (!name || typeof name !== 'string' || name.trim().length === 0 || name.length > 100) throw new Error("Invalid name.");
    if (isNew && (!password || typeof password !== 'string' || password.length < 6)) throw new Error("Password must be at least 6 characters.");
    if (!['Employee', 'Admin'].includes(role)) throw new Error("Invalid role.");

    // Hash the password before storing; if editing and password is blank, keep existing hash
    let passwordHash;
    if (isNew) {
      passwordHash = hashPassword(password);
    } else if (password && password.trim().length > 0) {
      if (password.length < 6) throw new Error("Password must be at least 6 characters.");
      passwordHash = hashPassword(password);
    } else {
      // No new password provided — preserve existing hash from sheet
      const existing = getCachedEmployees(props.MASTER_DB_ID).find(e => e.id === String(id));
      if (!existing) throw new Error("User not found.");
      passwordHash = existing.passwordHash;
    }

    const rowData = [id.trim(), passwordHash, name.trim(), shift_id || '', role, photo_url || '', jabatan_id || ''];

    if (isNew) {
      if (findRowIndex(props.MASTER_DB_ID, "Employees", id) !== -1) throw new Error("Employee ID already exists");
      appendSheetData(props.MASTER_DB_ID, "Employees", rowData);
      logActivity(admin.userId, "Created User: " + id);
    } else {
      const rowIndex = findRowIndex(props.MASTER_DB_ID, "Employees", id);
      if (rowIndex === -1) throw new Error("User not found");
      updateSheetRow(props.MASTER_DB_ID, "Employees", rowIndex, rowData);
      logActivity(admin.userId, "Updated User: " + id);
    }

    invalidateMasterCache();
    return successResponse(null, "User saved successfully");
  } catch (e) {
    return errorResponse(e.message);
  }
}

function deleteUser(token, userId) {
  try {
    const admin = checkAdmin(token);
    const props = getProps();
    const rowIndex = findRowIndex(props.MASTER_DB_ID, "Employees", userId);
    if (rowIndex === -1) throw new Error("User not found");
    const deleted = deleteSheetRow(props.MASTER_DB_ID, "Employees", rowIndex);
    if (!deleted) throw new Error("Failed to delete row from sheet");
    logActivity(admin.userId, "Deleted User: " + userId);
    invalidateMasterCache();
    return successResponse(null, "User deleted successfully");
  } catch (e) {
    return errorResponse(e.message);
  }
}

function saveShift(token, shiftData) {
  try {
    const admin = checkAdmin(token);
    const props = getProps();

    // Input validation
    if (!shiftData || typeof shiftData !== 'object') throw new Error("Invalid data.");
    const { id, start_time, end_time, isNew } = shiftData;
    if (!id || typeof id !== 'string' || id.trim().length === 0 || id.length > 50) throw new Error("Invalid Shift ID.");
    if (!start_time || !/^\d{2}:\d{2}$/.test(start_time)) throw new Error("Invalid start time format (HH:MM required).");
    if (!end_time   || !/^\d{2}:\d{2}$/.test(end_time))   throw new Error("Invalid end time format (HH:MM required).");

    const rowData = [id.trim(), start_time, end_time];

    if (isNew) {
      if (findRowIndex(props.MASTER_DB_ID, "Shifts", id) !== -1) throw new Error("Shift ID already exists");
      appendSheetData(props.MASTER_DB_ID, "Shifts", rowData);
      logActivity(admin.userId, "Created Shift: " + id);
    } else {
      const rowIndex = findRowIndex(props.MASTER_DB_ID, "Shifts", id);
      if (rowIndex === -1) throw new Error("Shift not found");
      updateSheetRow(props.MASTER_DB_ID, "Shifts", rowIndex, rowData);
      logActivity(admin.userId, "Updated Shift: " + id);
    }

    invalidateMasterCache();
    return successResponse(null, "Shift saved successfully");
  } catch (e) {
    return errorResponse(e.message);
  }
}

function deleteShift(token, shiftId) {
  try {
    const admin = checkAdmin(token);
    const props = getProps();
    const rowIndex = findRowIndex(props.MASTER_DB_ID, "Shifts", shiftId);
    if (rowIndex === -1) throw new Error("Shift not found");
    const deleted = deleteSheetRow(props.MASTER_DB_ID, "Shifts", rowIndex);
    if (!deleted) throw new Error("Failed to delete row from sheet");
    logActivity(admin.userId, "Deleted Shift: " + shiftId);
    invalidateMasterCache();
    return successResponse(null, "Shift deleted successfully");
  } catch (e) {
    return errorResponse(e.message);
  }
}

function savePosition(token, posData) {
  try {
    const admin = checkAdmin(token);
    const props = getProps();

    // Input validation
    if (!posData || typeof posData !== 'object') throw new Error("Invalid data.");
    const { id, name, isNew } = posData;
    if (!id || typeof id !== 'string' || id.trim().length === 0 || id.length > 50) throw new Error("Invalid Position ID.");
    if (!name || typeof name !== 'string' || name.trim().length === 0 || name.length > 100) throw new Error("Invalid position name.");

    const rowData = [id.trim(), name.trim()];

    if (isNew) {
      if (findRowIndex(props.MASTER_DB_ID, "Positions", id) !== -1) throw new Error("Position ID already exists");
      appendSheetData(props.MASTER_DB_ID, "Positions", rowData);
      logActivity(admin.userId, "Created Position: " + id);
    } else {
      const rowIndex = findRowIndex(props.MASTER_DB_ID, "Positions", id);
      if (rowIndex === -1) throw new Error("Position not found");
      updateSheetRow(props.MASTER_DB_ID, "Positions", rowIndex, rowData);
      logActivity(admin.userId, "Updated Position: " + id);
    }

    invalidateMasterCache();
    return successResponse(null, "Position saved successfully");
  } catch (e) {
    return errorResponse(e.message);
  }
}

function deletePosition(token, posId) {
  try {
    const admin = checkAdmin(token);
    const props = getProps();
    const rowIndex = findRowIndex(props.MASTER_DB_ID, "Positions", posId);
    if (rowIndex === -1) throw new Error("Position not found");
    const deleted = deleteSheetRow(props.MASTER_DB_ID, "Positions", rowIndex);
    if (!deleted) throw new Error("Failed to delete row from sheet");
    logActivity(admin.userId, "Deleted Position: " + posId);
    invalidateMasterCache();
    return successResponse(null, "Position deleted successfully");
  } catch (e) {
    return errorResponse(e.message);
  }
}

function uploadUserPhoto(token, base64Data, fileName) {
  try {
    checkAdmin(token);
    if (!base64Data || !fileName) throw new Error("Missing file data.");
    if (typeof fileName !== 'string' || fileName.length > 255) throw new Error("Invalid file name.");
    const url = uploadImageToDrive(base64Data, fileName);
    return successResponse(url);
  } catch (e) {
    return errorResponse(e.message);
  }
}

/**
 * Save a QR code (as base64 PNG data URL) for an employee to the Master DB.
 * Creates a "QR_Codes" sheet if it doesn't exist.
 * Columns: employee_id | qr_data_url | generated_at
 * If a record for the employee already exists, it is updated.
 */
function saveEmployeeQRCode(token, employeeId, qrDataUrl) {
  try {
    checkAdmin(token);

    if (!employeeId || typeof employeeId !== 'string' || employeeId.length > 50) {
      return errorResponse("Invalid employee ID.");
    }
    if (!qrDataUrl || typeof qrDataUrl !== 'string') {
      return errorResponse("Invalid QR data.");
    }
    // Validate it's a PNG data URL (starts with data:image/png;base64,)
    if (!qrDataUrl.startsWith('data:image/png;base64,')) {
      return errorResponse("QR data must be a PNG data URL.");
    }
    // Enforce a reasonable size limit (~200KB base64)
    if (qrDataUrl.length > 300000) {
      return errorResponse("QR data is too large.");
    }

    const props = getProps();
    if (!props.MASTER_DB_ID) return errorResponse("Master DB not configured.");

    const ss = SpreadsheetApp.openById(props.MASTER_DB_ID);
    let sheet = ss.getSheetByName("QR_Codes");
    if (!sheet) {
      sheet = ss.insertSheet("QR_Codes");
      sheet.appendRow(["employee_id", "qr_data_url", "generated_at"]);
    }

    const now = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss");
    const data = sheet.getDataRange().getValues();

    // Check if record already exists for this employee
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]) === String(employeeId)) {
        // Update existing row
        sheet.getRange(i + 1, 2).setValue(qrDataUrl);
        sheet.getRange(i + 1, 3).setValue(now);
        logActivity(token ? (verifyToken(token) || {}).userId : 'admin', "QR Code Updated: " + employeeId);
        return successResponse({ employeeId, generatedAt: now }, "QR code updated for employee " + employeeId);
      }
    }

    // Append new record
    sheet.appendRow([employeeId, qrDataUrl, now]);
    logActivity(token ? (verifyToken(token) || {}).userId : 'admin', "QR Code Saved: " + employeeId);
    return successResponse({ employeeId, generatedAt: now }, "QR code saved for employee " + employeeId);

  } catch (e) {
    return errorResponse("Error saving QR code: " + e.message);
  }
}

/**
 * Retrieve all saved QR codes from the Master DB.
 * Returns an array of { employeeId, qrDataUrl, generatedAt }.
 */
function getEmployeeQRCodes(token) {
  try {
    checkAdmin(token);

    const props = getProps();
    if (!props.MASTER_DB_ID) return errorResponse("Master DB not configured.");

    const data = getSheetData(props.MASTER_DB_ID, "QR_Codes");
    if (!data || data.length <= 1) return successResponse([], "No QR codes found.");

    const records = [];
    for (let i = 1; i < data.length; i++) {
      records.push({
        employeeId:  String(data[i][0]),
        qrDataUrl:   String(data[i][1]),
        generatedAt: data[i][2] instanceof Date
          ? Utilities.formatDate(data[i][2], Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss")
          : String(data[i][2])
      });
    }

    return successResponse(records);
  } catch (e) {
    return errorResponse("Error retrieving QR codes: " + e.message);
  }
}
