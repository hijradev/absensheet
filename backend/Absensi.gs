// Absensi.gs
//
// Attendance_Data column schema:
//   A (0): date
//   B (1): employeeId
//   C (2): checkInTime
//   D (3): checkInStatus
//   E (4): checkOutTime
//   F (5): checkOutStatus
//   G (6): checkInLat       — decimal degrees or ""
//   H (7): checkInLng       — decimal degrees or ""
//   I (8): checkInDistance  — meters (integer) or ""
//   J (9): checkOutLat      — decimal degrees or ""
//   K (10): checkOutLng     — decimal degrees or ""
//   L (11): checkOutDistance — meters (integer) or ""
//   M (12): source          — "employee" | "qr" | "admin" | ""
//
// Backward compatibility: rows created before geofencing have only columns A–F.
// All read paths treat missing indices (row.length < 13) as "".

function getTodayStr() {
  const d = new Date();
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, '0') + "-" + String(d.getDate()).padStart(2, '0');
}

/**
 * Process check-in or check-out.
 * Uses cached Employees and Shifts to avoid redundant sheet reads.
 * Before: 3 SpreadsheetApp reads per call.
 * After:  1 read (Attendance_Data) + cache hits for Employees & Shifts.
 *
 * @param {string} token           - Employee auth token
 * @param {string} action          - "IN" or "OUT"
 * @param {Object} [locationPayload] - { latitude, longitude, accuracy } from browser Geolocation API
 */
function processAttendance(token, action, locationPayload) {
  const user = verifyToken(token);
  if (!user) return errorResponse("Invalid or expired session. Please login again.");

  // --- Check if employee is on leave today ---
  const todayStr = getTodayStr();
  const props = getProps();
  const leaveCheck = isEmployeeOnLeave(user.userId, todayStr);
  if (leaveCheck.onLeave) {
    return errorResponse(`You are on ${leaveCheck.leaveType} leave today. Attendance not required.`);
  }

  // --- Geofence validation (runs before any sheet writes) ---
  const locResult = validateLocation(locationPayload);
  if (!locResult.valid) {
    return errorResponse(locResult.error);
  }

  const currentYear = new Date().getFullYear();
  const attendanceDbId = props["ATTENDANCE_DB_ID_" + currentYear];
  if (!attendanceDbId) return errorResponse("Attendance DB for this year not configured.");

  // --- Resolve employee shift from cache (no sheet read if warm) ---
  const employees = getCachedEmployees(props.MASTER_DB_ID);
  const emp = employees.find(e => e.id === String(user.userId));
  if (!emp) return errorResponse("Employee not found.");

  const shifts = getCachedShifts(props.MASTER_DB_ID);
  const shiftData = shifts.find(s => s.id === emp.shift_id);
  if (!shiftData) return errorResponse("Shift data not found for user.");

  // --- Single read: today's attendance ---
  const now = new Date();
  const nowTime = now.getHours() * 60 + now.getMinutes();
  const timeStr = Utilities.formatDate(now, Session.getScriptTimeZone(), "HH:mm:ss");

  const attData = getSheetData(attendanceDbId, "Attendance_Data");
  let rowIndex = -1;
  let existingRow = null;

  for (let i = 1; i < attData.length; i++) {
    const rowDate = attData[i][0] instanceof Date
      ? Utilities.formatDate(attData[i][0], Session.getScriptTimeZone(), "yyyy-MM-dd")
      : String(attData[i][0]).substring(0, 10);
    if (rowDate === todayStr && String(attData[i][1]) === String(user.userId)) {
      rowIndex = i + 1; // 1-based for sheet
      existingRow = attData[i];
      break;
    }
  }

  // Extract location values from the validated payload (empty string when skipped/no payload)
  const locLat      = (locationPayload && !locResult.skipped) ? locationPayload.latitude  : "";
  const locLng      = (locationPayload && !locResult.skipped) ? locationPayload.longitude : "";
  const locDistance = (locationPayload && !locResult.skipped) ? locResult.distance        : "";

  if (action === 'IN') {
    if (rowIndex !== -1) return errorResponse("Already checked in today.");

    const shiftStart = parseTime(shiftData.start_time);
    const status = nowTime > shiftStart ? "Terlambat" : "Tepat Waktu";

    // Columns: A–F (core), G–I (check-in location), J–L (check-out location, empty), M (source)
    appendSheetData(attendanceDbId, "Attendance_Data", [
      todayStr, user.userId, timeStr, status, "", "",
      locLat, locLng, locDistance,
      "", "", "",
      "employee"
    ]);
    logActivity(user.userId, "Check In");
    return successResponse({ time: timeStr, status: status }, "Check In Successful");

  } else if (action === 'OUT') {
    if (rowIndex === -1) return errorResponse("You have not checked in today.");
    if (existingRow[4] !== "" && existingRow[4] !== null && existingRow[4] !== undefined) {
      return errorResponse("Already checked out today.");
    }

    const shiftEnd = parseTime(shiftData.end_time);
    let status = "Tepat Waktu";
    if (nowTime < shiftEnd) {
      status = "Pulang Awal";
    }

    existingRow[4] = timeStr;
    existingRow[5] = status;
    // Populate check-out location columns J–L (indices 9–11)
    existingRow[9]  = locLat;
    existingRow[10] = locLng;
    existingRow[11] = locDistance;
    // Preserve source if already set; otherwise mark as "employee"
    if (!existingRow[12]) {
      existingRow[12] = "employee";
    }
    updateSheetRow(attendanceDbId, "Attendance_Data", rowIndex, existingRow);
    logActivity(user.userId, "Check Out");
    return successResponse({ time: timeStr, status: status }, "Check Out Successful");
  }

  return errorResponse("Invalid action.");
}

function checkIn(token, locationPayload) {
  return processAttendance(token, 'IN', locationPayload);
}

function checkOut(token, locationPayload) {
  return processAttendance(token, 'OUT', locationPayload);
}

/**
 * Returns all attendance records for a given date (admin only).
 * Enriches each record with employee name and shift info from cache.
 * @param {string} token - Admin auth token
 * @param {string} dateStr - Date in "yyyy-MM-dd" format; defaults to today
 */
function getDailyAttendance(token, dateStr) {
  try {
    const admin = verifyToken(token);
    if (!admin || admin.role !== "Admin") return errorResponse("Unauthorized");

    const props = getProps();
    const currentYear = new Date().getFullYear();
    const attendanceDbId = props["ATTENDANCE_DB_ID_" + currentYear];
    if (!attendanceDbId) return successResponse({ records: [], summary: { total: 0, tepatWaktu: 0, terlambat: 0, pulangAwal: 0, belumAbsen: 0 } });

    const targetDate = dateStr || getTodayStr();

    // Load attendance data for the target date
    const attData = getSheetData(attendanceDbId, "Attendance_Data");
    const employees = getCachedEmployees(props.MASTER_DB_ID);
    const shifts = getCachedShifts(props.MASTER_DB_ID);
    const positions = getCachedPositions(props.MASTER_DB_ID);

    // Build a lookup map for employees
    const empMap = {};
    employees.forEach(e => { empMap[e.id] = e; });

    // Build a lookup map for shifts
    const shiftMap = {};
    shifts.forEach(s => { shiftMap[s.id] = s; });

    // Build a lookup map for positions
    const posMap = {};
    positions.forEach(p => { posMap[p.id] = p; });

    // Collect attendance records for the target date
    const presentIds = new Set();
    const records = [];

    for (let i = 1; i < attData.length; i++) {
      const rowDate = attData[i][0] instanceof Date
        ? Utilities.formatDate(attData[i][0], Session.getScriptTimeZone(), "yyyy-MM-dd")
        : String(attData[i][0]).substring(0, 10);

      if (rowDate !== targetDate) continue;

      const empId = String(attData[i][1]);
      presentIds.add(empId);
      const emp = empMap[empId] || {};
      const shift = shiftMap[emp.shift_id] || {};
      const pos = posMap[emp.jabatan_id] || {};

      // Helper: read a column value, returning null if the index is missing or empty string
      const row = attData[i];
      const colOrNull = (idx) => {
        const v = row.length > idx ? row[idx] : "";
        return (v === "" || v === null || v === undefined) ? null : v;
      };

      records.push({
        employeeId:          empId,
        employeeName:        emp.name || "-",
        position:            pos.name || "-",
        shiftId:             emp.shift_id || "-",
        shiftStart:          shift.start_time || "-",
        shiftEnd:            shift.end_time || "-",
        checkInTime:         row[2] instanceof Date
          ? Utilities.formatDate(row[2], Session.getScriptTimeZone(), "HH:mm:ss")
          : String(row[2] || ""),
        checkInStatus:       String(row[3] || ""),
        checkOutTime:        row[4] instanceof Date
          ? Utilities.formatDate(row[4], Session.getScriptTimeZone(), "HH:mm:ss")
          : String(row[4] || ""),
        checkOutStatus:      String(row[5] || ""),
        checkInLat:          colOrNull(6),
        checkInLng:          colOrNull(7),
        checkInDistance:     colOrNull(8),
        checkOutLat:         colOrNull(9),
        checkOutLng:         colOrNull(10),
        checkOutDistance:    colOrNull(11),
        source:              colOrNull(12)
      });
    }

    // Find employees who haven't checked in
    employees.forEach(emp => {
      if (!presentIds.has(emp.id)) {
        const shift = shiftMap[emp.shift_id] || {};
        const pos = posMap[emp.jabatan_id] || {};
        
        // Check if employee is on leave
        const leaveCheck = isEmployeeOnLeave(emp.id, targetDate);
        
        records.push({
          employeeId:       emp.id,
          employeeName:     emp.name || "-",
          position:         pos.name || "-",
          shiftId:          emp.shift_id || "-",
          shiftStart:       shift.start_time || "-",
          shiftEnd:         shift.end_time || "-",
          checkInTime:      "",
          checkInStatus:    leaveCheck.onLeave ? leaveCheck.leaveType : "Tidak Hadir",
          checkOutTime:     "",
          checkOutStatus:   "",
          checkInLat:       null,
          checkInLng:       null,
          checkInDistance:  null,
          checkOutLat:      null,
          checkOutLng:      null,
          checkOutDistance: null,
          source:           leaveCheck.onLeave ? "leave" : null
        });
      }
    });

    // Sort: present first (by check-in time), absent last
    records.sort((a, b) => {
      if (a.checkInTime && !b.checkInTime) return -1;
      if (!a.checkInTime && b.checkInTime) return 1;
      return a.checkInTime.localeCompare(b.checkInTime);
    });

    // Summary
    const leaveTypes = ["Cuti", "Izin", "Sakit", "Libur"];
    const summary = {
      total:       employees.length,
      tepatWaktu:  records.filter(r => r.checkInStatus === "Tepat Waktu").length,
      terlambat:   records.filter(r => r.checkInStatus === "Terlambat").length,
      pulangAwal:  records.filter(r => r.checkOutStatus === "Pulang Awal").length,
      belumAbsen:  records.filter(r => r.checkInStatus === "Tidak Hadir").length,
      cuti:        records.filter(r => r.checkInStatus === "Cuti").length,
      izin:        records.filter(r => r.checkInStatus === "Izin").length,
      sakit:       records.filter(r => r.checkInStatus === "Sakit").length,
      libur:       records.filter(r => r.checkInStatus === "Libur").length,
      onLeave:     records.filter(r => leaveTypes.includes(r.checkInStatus)).length
    };

    return successResponse({ records, summary, date: targetDate });
  } catch (e) {
    return errorResponse(e.message);
  }
}

/**
 * Returns attendance records across a date range (admin only).
 * Each record includes the date field. Summary is aggregated across all days.
 * @param {string} token     - Admin auth token
 * @param {string} startDate - Start date "yyyy-MM-dd"
 * @param {string} endDate   - End date "yyyy-MM-dd"
 */
function getDailyAttendanceRange(token, startDate, endDate) {
  try {
    const admin = verifyToken(token);
    if (!admin || admin.role !== "Admin") return errorResponse("Unauthorized");

    if (!startDate || !/^\d{4}-\d{2}-\d{2}$/.test(startDate)) return errorResponse("Invalid start date.");
    if (!endDate   || !/^\d{4}-\d{2}-\d{2}$/.test(endDate))   return errorResponse("Invalid end date.");
    if (startDate > endDate) return errorResponse("Start date must be before or equal to end date.");

    // Limit range to 31 days to avoid timeouts
    const msPerDay = 24 * 60 * 60 * 1000;
    const daysDiff = Math.round((new Date(endDate) - new Date(startDate)) / msPerDay);
    if (daysDiff > 31) return errorResponse("Date range cannot exceed 31 days.");

    const props = getProps();
    const employees  = getCachedEmployees(props.MASTER_DB_ID);
    const shifts     = getCachedShifts(props.MASTER_DB_ID);
    const positions  = getCachedPositions(props.MASTER_DB_ID);

    const empMap = {};
    employees.forEach(e => { empMap[e.id] = e; });
    const shiftMap = {};
    shifts.forEach(s => { shiftMap[s.id] = s; });
    const posMap = {};
    positions.forEach(p => { posMap[p.id] = p; });

    // Collect all dates in range
    const dates = [];
    const cur = new Date(startDate);
    const end = new Date(endDate);
    while (cur <= end) {
      dates.push(Utilities.formatDate(cur, Session.getScriptTimeZone(), "yyyy-MM-dd"));
      cur.setDate(cur.getDate() + 1);
    }

    // Load attendance data — may span multiple year DBs
    const startYear = parseInt(startDate.substring(0, 4), 10);
    const endYear   = parseInt(endDate.substring(0, 4), 10);

    // Map: date -> Set of present employee IDs
    const presentByDate = {};
    dates.forEach(d => { presentByDate[d] = new Set(); });

    const records = [];

    for (let yr = startYear; yr <= endYear; yr++) {
      const attDbId = props["ATTENDANCE_DB_ID_" + yr];
      if (!attDbId) continue;

      const attData = getSheetData(attDbId, "Attendance_Data");
      for (let i = 1; i < attData.length; i++) {
        const rowDate = attData[i][0] instanceof Date
          ? Utilities.formatDate(attData[i][0], Session.getScriptTimeZone(), "yyyy-MM-dd")
          : String(attData[i][0]).substring(0, 10);

        if (rowDate < startDate || rowDate > endDate) continue;

        const empId = String(attData[i][1]);
        if (presentByDate[rowDate]) presentByDate[rowDate].add(empId);

        const emp   = empMap[empId] || {};
        const shift = shiftMap[emp.shift_id] || {};
        const pos   = posMap[emp.jabatan_id] || {};

        // Helper: read a column value, returning null if the index is missing or empty string
        const row = attData[i];
        const colOrNull = (idx) => {
          const v = row.length > idx ? row[idx] : "";
          return (v === "" || v === null || v === undefined) ? null : v;
        };

        records.push({
          date:             rowDate,
          employeeId:       empId,
          employeeName:     emp.name || "-",
          position:         pos.name || "-",
          shiftId:          emp.shift_id || "-",
          shiftStart:       shift.start_time || "-",
          shiftEnd:         shift.end_time || "-",
          checkInTime:      row[2] instanceof Date
            ? Utilities.formatDate(row[2], Session.getScriptTimeZone(), "HH:mm:ss")
            : String(row[2] || ""),
          checkInStatus:    String(row[3] || ""),
          checkOutTime:     row[4] instanceof Date
            ? Utilities.formatDate(row[4], Session.getScriptTimeZone(), "HH:mm:ss")
            : String(row[4] || ""),
          checkOutStatus:   String(row[5] || ""),
          checkInLat:       colOrNull(6),
          checkInLng:       colOrNull(7),
          checkInDistance:  colOrNull(8),
          checkOutLat:      colOrNull(9),
          checkOutLng:      colOrNull(10),
          checkOutDistance: colOrNull(11),
          source:           colOrNull(12)
        });
      }
    }

    // Add rows for each date where an employee has no attendance record
    dates.forEach(d => {
      employees.forEach(emp => {
        if (!presentByDate[d].has(emp.id)) {
          const shift = shiftMap[emp.shift_id] || {};
          const pos   = posMap[emp.jabatan_id] || {};
          
          // Check if employee is on leave
          const leaveCheck = isEmployeeOnLeave(emp.id, d);
          
          records.push({
            date:             d,
            employeeId:       emp.id,
            employeeName:     emp.name || "-",
            position:         pos.name || "-",
            shiftId:          emp.shift_id || "-",
            shiftStart:       shift.start_time || "-",
            shiftEnd:         shift.end_time || "-",
            checkInTime:      "",
            checkInStatus:    leaveCheck.onLeave ? leaveCheck.leaveType : "Tidak Hadir",
            checkOutTime:     "",
            checkOutStatus:   "",
            checkInLat:       null,
            checkInLng:       null,
            checkInDistance:  null,
            checkOutLat:      null,
            checkOutLng:      null,
            checkOutDistance: null,
            source:           leaveCheck.onLeave ? "leave" : null
          });
        }
      });
    });

    // Sort by date asc, then present first, then by check-in time
    records.sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      if (a.checkInTime && !b.checkInTime) return -1;
      if (!a.checkInTime && b.checkInTime) return 1;
      return a.checkInTime.localeCompare(b.checkInTime);
    });

    // Aggregate summary across all days
    const leaveTypes = ["Cuti", "Izin", "Sakit", "Libur"];
    const summary = {
      total:      employees.length * dates.length,
      tepatWaktu: records.filter(r => r.checkInStatus === "Tepat Waktu").length,
      terlambat:  records.filter(r => r.checkInStatus === "Terlambat").length,
      pulangAwal: records.filter(r => r.checkOutStatus === "Pulang Awal").length,
      belumAbsen: records.filter(r => r.checkInStatus === "Tidak Hadir").length,
      cuti:       records.filter(r => r.checkInStatus === "Cuti").length,
      izin:       records.filter(r => r.checkInStatus === "Izin").length,
      sakit:      records.filter(r => r.checkInStatus === "Sakit").length,
      libur:      records.filter(r => r.checkInStatus === "Libur").length,
      onLeave:    records.filter(r => leaveTypes.includes(r.checkInStatus)).length
    };

    return successResponse({ records, summary, startDate, endDate, isRange: true });
  } catch (e) {
    return errorResponse(e.message);
  }
}

/**
 * Save a manual attendance record (admin only).
 * Supports adding or updating a record for any employee on any date.
 * Used for permissible absences (sick leave, permission, etc.) or corrections.
 *
 * @param {string} token - Admin auth token
 * @param {Object} data  - { employeeId, date, checkInTime, checkInStatus, checkOutTime, checkOutStatus }
 */
function saveManualAttendance(token, data) {
  try {
    const admin = checkAdmin(token);

    // --- Input validation ---
    if (!data || typeof data !== 'object') throw new Error("Invalid data.");
    const { employeeId, date, checkInTime, checkInStatus, checkOutTime, checkOutStatus } = data;

    if (!employeeId || typeof employeeId !== 'string' || employeeId.trim().length === 0 || employeeId.length > 50)
      throw new Error("Invalid Employee ID.");
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date))
      throw new Error("Invalid date format (yyyy-MM-dd required).");

    const validInStatuses  = ["Tepat Waktu", "Terlambat", "Izin", "Sakit", "Cuti", "Tidak Hadir"];
    const validOutStatuses = ["Tepat Waktu", "Pulang Awal", "Izin", "Sakit", "Cuti", ""];

    if (!validInStatuses.includes(checkInStatus))
      throw new Error("Invalid check-in status.");
    if (checkOutStatus && !validOutStatuses.includes(checkOutStatus))
      throw new Error("Invalid check-out status.");

    // Validate time format if provided (HH:mm or HH:mm:ss)
    const timeRegex = /^\d{2}:\d{2}(:\d{2})?$/;
    if (checkInTime && !timeRegex.test(checkInTime))
      throw new Error("Invalid check-in time format.");
    if (checkOutTime && !timeRegex.test(checkOutTime))
      throw new Error("Invalid check-out time format.");

    // --- Resolve attendance DB for the year of the given date ---
    const props = getProps();
    const year = parseInt(date.substring(0, 4), 10);
    const attendanceDbId = props["ATTENDANCE_DB_ID_" + year];
    if (!attendanceDbId) throw new Error("Attendance DB for year " + year + " not configured.");

    // --- Verify employee exists ---
    const employees = getCachedEmployees(props.MASTER_DB_ID);
    const emp = employees.find(e => e.id === String(employeeId).trim());
    if (!emp) throw new Error("Employee not found.");

    // --- Check for existing record ---
    const attData = getSheetData(attendanceDbId, "Attendance_Data");
    let rowIndex = -1;

    for (let i = 1; i < attData.length; i++) {
      const rowDate = attData[i][0] instanceof Date
        ? Utilities.formatDate(attData[i][0], Session.getScriptTimeZone(), "yyyy-MM-dd")
        : String(attData[i][0]).substring(0, 10);
      if (rowDate === date && String(attData[i][1]) === String(employeeId).trim()) {
        rowIndex = i + 1; // 1-based for sheet
        break;
      }
    }

    const rowData = [
      date,
      employeeId.trim(),
      checkInTime  || "",
      checkInStatus,
      checkOutTime || "",
      checkOutStatus || "",
      "", "", "",   // G–I: checkInLat, checkInLng, checkInDistance (not set by admin)
      "", "", "",   // J–L: checkOutLat, checkOutLng, checkOutDistance (not set by admin)
      "admin"       // M: source
    ];

    if (rowIndex === -1) {
      appendSheetData(attendanceDbId, "Attendance_Data", rowData);
      logActivity(admin.userId, "Manual Attendance Added: " + employeeId + " on " + date);
    } else {
      // Preserve existing row array length — update in place.
      // For pre-geofencing rows (length < 13), explicitly fill missing indices
      // 6–11 with "" so setValues never receives undefined/sparse entries.
      const existingRow = attData[rowIndex - 1];
      existingRow[0] = date;
      existingRow[1] = employeeId.trim();
      existingRow[2] = checkInTime  || "";
      existingRow[3] = checkInStatus;
      existingRow[4] = checkOutTime || "";
      existingRow[5] = checkOutStatus || "";
      // Preserve existing location columns G–L (indices 6–11).
      // If the row is a pre-geofencing row (fewer than 13 columns), fill the
      // missing location indices with "" rather than leaving them sparse/undefined.
      for (let col = 6; col <= 11; col++) {
        if (existingRow[col] === undefined) existingRow[col] = "";
      }
      // Always stamp source as "admin" (index 12)
      existingRow[12] = "admin";
      updateSheetRow(attendanceDbId, "Attendance_Data", rowIndex, existingRow);
      logActivity(admin.userId, "Manual Attendance Updated: " + employeeId + " on " + date);
    }

    return successResponse(null, rowIndex === -1 ? "Attendance record added." : "Attendance record updated.");
  } catch (e) {
    return errorResponse(e.message);
  }
}

/**
 * Delete a manual attendance record (admin only).
 *
 * @param {string} token      - Admin auth token
 * @param {string} employeeId - Employee ID
 * @param {string} date       - Date in "yyyy-MM-dd" format
 */
function deleteManualAttendance(token, employeeId, date) {
  try {
    const admin = checkAdmin(token);

    if (!employeeId || !date) throw new Error("Employee ID and date are required.");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("Invalid date format.");

    const props = getProps();
    const year = parseInt(date.substring(0, 4), 10);
    const attendanceDbId = props["ATTENDANCE_DB_ID_" + year];
    if (!attendanceDbId) throw new Error("Attendance DB for year " + year + " not configured.");

    const attData = getSheetData(attendanceDbId, "Attendance_Data");
    let rowIndex = -1;

    for (let i = 1; i < attData.length; i++) {
      const rowDate = attData[i][0] instanceof Date
        ? Utilities.formatDate(attData[i][0], Session.getScriptTimeZone(), "yyyy-MM-dd")
        : String(attData[i][0]).substring(0, 10);
      if (rowDate === date && String(attData[i][1]) === String(employeeId)) {
        rowIndex = i + 1;
        break;
      }
    }

    if (rowIndex === -1) throw new Error("Attendance record not found.");

    const deleted = deleteSheetRow(attendanceDbId, "Attendance_Data", rowIndex);
    if (!deleted) throw new Error("Failed to delete record.");

    logActivity(admin.userId, "Manual Attendance Deleted: " + employeeId + " on " + date);
    return successResponse(null, "Attendance record deleted.");
  } catch (e) {
    return errorResponse(e.message);
  }
}

/**
 * Get attendance records for a specific employee across a date range (admin only).
 * Used to pre-populate the manual attendance management table.
 *
 * @param {string} token      - Admin auth token
 * @param {string} employeeId - Employee ID (optional — if empty, returns all employees)
 * @param {string} startDate  - Start date "yyyy-MM-dd"
 * @param {string} endDate    - End date "yyyy-MM-dd"
 */
function getManualAttendanceRecords(token, employeeId, startDate, endDate) {
  try {
    checkAdmin(token);
    const props = getProps();

    if (!startDate || !/^\d{4}-\d{2}-\d{2}$/.test(startDate)) throw new Error("Invalid start date.");
    if (!endDate   || !/^\d{4}-\d{2}-\d{2}$/.test(endDate))   throw new Error("Invalid end date.");
    if (startDate > endDate) throw new Error("Start date must be before end date.");

    const startYear = parseInt(startDate.substring(0, 4), 10);
    const endYear   = parseInt(endDate.substring(0, 4), 10);

    const employees  = getCachedEmployees(props.MASTER_DB_ID);
    const positions  = getCachedPositions(props.MASTER_DB_ID);
    const posMap     = {};
    positions.forEach(p => { posMap[p.id] = p.name; });
    const empMap     = {};
    employees.forEach(e => { empMap[e.id] = e; });

    const records = [];

    // Collect records across potentially multiple year DBs
    for (let yr = startYear; yr <= endYear; yr++) {
      const attDbId = props["ATTENDANCE_DB_ID_" + yr];
      if (!attDbId) continue;

      const attData = getSheetData(attDbId, "Attendance_Data");
      for (let i = 1; i < attData.length; i++) {
        const rowDate = attData[i][0] instanceof Date
          ? Utilities.formatDate(attData[i][0], Session.getScriptTimeZone(), "yyyy-MM-dd")
          : String(attData[i][0]).substring(0, 10);

        if (rowDate < startDate || rowDate > endDate) continue;

        const empId = String(attData[i][1]);
        if (employeeId && empId !== String(employeeId)) continue;

        const emp = empMap[empId] || {};
        records.push({
          date:           rowDate,
          employeeId:     empId,
          employeeName:   emp.name || empId,
          position:       posMap[emp.jabatan_id] || "-",
          checkInTime:    attData[i][2] instanceof Date
            ? Utilities.formatDate(attData[i][2], Session.getScriptTimeZone(), "HH:mm:ss")
            : String(attData[i][2] || ""),
          checkInStatus:  String(attData[i][3] || ""),
          checkOutTime:   attData[i][4] instanceof Date
            ? Utilities.formatDate(attData[i][4], Session.getScriptTimeZone(), "HH:mm:ss")
            : String(attData[i][4] || ""),
          checkOutStatus: String(attData[i][5] || "")
        });
      }
    }

    // Sort by date desc, then employee
    records.sort((a, b) => {
      if (b.date !== a.date) return b.date.localeCompare(a.date);
      return a.employeeName.localeCompare(b.employeeName);
    });

    return successResponse({ records, employees: employees.map(e => ({ id: e.id, name: e.name })) });
  } catch (e) {
    return errorResponse(e.message);
  }
}

/**
 * Process attendance via QR code scan (no authentication required).
 * Automatically determines check-in vs check-out based on today's record.
 * @param {string} employeeId      - Employee ID from QR code
 * @param {Object} [locationPayload] - { latitude, longitude, accuracy } from browser Geolocation API
 */
function processAttendanceByQR(employeeId, locationPayload) {
  try {
    if (!employeeId || typeof employeeId !== 'string') {
      return errorResponse("Invalid employee ID.");
    }

    // --- Check if employee is on leave today ---
    const todayStr = getTodayStr();
    const props = getProps();
    const leaveCheck = isEmployeeOnLeave(employeeId, todayStr);
    if (leaveCheck.onLeave) {
      return errorResponse(`Employee is on ${leaveCheck.leaveType} leave today. Attendance not required.`);
    }

    // --- Geofence validation (runs before any sheet writes) ---
    const locResult = validateLocation(locationPayload);
    if (!locResult.valid) {
      return errorResponse(locResult.error);
    }

    const currentYear = new Date().getFullYear();
    const attendanceDbId = props["ATTENDANCE_DB_ID_" + currentYear];
    if (!attendanceDbId) return errorResponse("Attendance DB for this year not configured.");

    // Verify employee exists
    const employees = getCachedEmployees(props.MASTER_DB_ID);
    const emp = employees.find(e => e.id === String(employeeId));
    if (!emp) return errorResponse("Employee not found.");

    const shifts = getCachedShifts(props.MASTER_DB_ID);
    const shiftData = shifts.find(s => s.id === emp.shift_id);
    if (!shiftData) return errorResponse("Shift data not found for employee.");

    // Check today's attendance
    const now = new Date();
    const nowTime = now.getHours() * 60 + now.getMinutes();
    const timeStr = Utilities.formatDate(now, Session.getScriptTimeZone(), "HH:mm:ss");

    const attData = getSheetData(attendanceDbId, "Attendance_Data");
    let rowIndex = -1;
    let existingRow = null;

    for (let i = 1; i < attData.length; i++) {
      const rowDate = attData[i][0] instanceof Date
        ? Utilities.formatDate(attData[i][0], Session.getScriptTimeZone(), "yyyy-MM-dd")
        : String(attData[i][0]).substring(0, 10);
      if (rowDate === todayStr && String(attData[i][1]) === String(employeeId)) {
        rowIndex = i + 1;
        existingRow = attData[i];
        break;
      }
    }

    // Extract location values from the validated payload (empty string when skipped/no payload)
    const locLat      = (locationPayload && !locResult.skipped) ? locationPayload.latitude  : "";
    const locLng      = (locationPayload && !locResult.skipped) ? locationPayload.longitude : "";
    const locDistance = (locationPayload && !locResult.skipped) ? locResult.distance        : "";

    // Determine action: if no record or already checked out, do check-in; otherwise check-out
    if (rowIndex === -1) {
      // Check In
      const shiftStart = parseTime(shiftData.start_time);
      const status = nowTime > shiftStart ? "Terlambat" : "Tepat Waktu";

      // Columns: A–F (core), G–I (check-in location), J–L (check-out location, empty), M (source)
      appendSheetData(attendanceDbId, "Attendance_Data", [
        todayStr, employeeId, timeStr, status, "", "",
        locLat, locLng, locDistance,
        "", "", "",
        "qr"
      ]);
      logActivity(employeeId, "Check In (QR)");
      return successResponse({ 
        action: "checkin", 
        time: timeStr, 
        status: status,
        employeeName: emp.name 
      }, "Check In Successful");

    } else if (existingRow[4] !== "" && existingRow[4] !== null && existingRow[4] !== undefined) {
      // Already checked out
      return errorResponse("Already checked out today.");

    } else {
      // Check Out
      const shiftEnd = parseTime(shiftData.end_time);
      let status = "Tepat Waktu";
      if (nowTime < shiftEnd) {
        status = "Pulang Awal";
      }

      existingRow[4] = timeStr;
      existingRow[5] = status;
      // Populate check-out location columns J–L (indices 9–11)
      existingRow[9]  = locLat;
      existingRow[10] = locLng;
      existingRow[11] = locDistance;
      // Preserve source if already set; otherwise mark as "qr"
      if (!existingRow[12]) {
        existingRow[12] = "qr";
      }
      updateSheetRow(attendanceDbId, "Attendance_Data", rowIndex, existingRow);
      logActivity(employeeId, "Check Out (QR)");
      return successResponse({ 
        action: "checkout", 
        time: timeStr, 
        status: status,
        employeeName: emp.name 
      }, "Check Out Successful");
    }
  } catch (e) {
    return errorResponse("Error processing attendance: " + e.message);
  }
}

function getMyHistory(token) {
  const user = verifyToken(token);
  if (!user) return errorResponse("Invalid session");

  const props = getProps();
  const currentYear = new Date().getFullYear();
  const attendanceDbId = props["ATTENDANCE_DB_ID_" + currentYear];
  if (!attendanceDbId) return successResponse([], "No attendance DB found");

  const data = getSheetData(attendanceDbId, "Attendance_Data");
  const history = [];

  for (let i = data.length - 1; i >= 1; i--) {
    if (String(data[i][1]) === String(user.userId)) {
      history.push({
        date: data[i][0] instanceof Date
          ? Utilities.formatDate(data[i][0], Session.getScriptTimeZone(), "yyyy-MM-dd")
          : String(data[i][0]).substring(0, 10),
        checkInTime:    data[i][2] instanceof Date
          ? Utilities.formatDate(data[i][2], Session.getScriptTimeZone(), "HH:mm:ss")
          : String(data[i][2] || ""),
        checkInStatus:  String(data[i][3] || ""),
        checkOutTime:   data[i][4] instanceof Date
          ? Utilities.formatDate(data[i][4], Session.getScriptTimeZone(), "HH:mm:ss")
          : String(data[i][4] || ""),
        checkOutStatus: String(data[i][5] || "")
      });
      if (history.length >= 30) break;
    }
  }

  return successResponse(history);
}
