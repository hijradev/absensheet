// Schedule.gs - Monthly Schedule Management

const CACHE_KEY_SCHEDULES = 'master_schedules';

/**
 * Invalidate schedules cache
 */
function invalidateSchedulesCache() {
  try {
    CacheService.getScriptCache().remove(CACHE_KEY_SCHEDULES);
  } catch (e) { }
}

/**
 * Get cached schedules data
 */
function getCachedSchedules(masterDbId) {
  try {
    const cached = CacheService.getScriptCache().get(CACHE_KEY_SCHEDULES);
    if (cached) return JSON.parse(cached);
  } catch (e) { /* cache miss */ }

  const data = getSheetData(masterDbId, "Schedules");
  const schedules = [];
  for (let i = 1; i < data.length; i++) {
    if (!data[i][0]) continue;
    schedules.push({
      id:          String(data[i][0]),
      employeeId:  String(data[i][1]),
      year:        Number(data[i][2]),
      month:       Number(data[i][3]),  // 1-12
      day:         Number(data[i][4]),  // 1-31
      shiftId:     String(data[i][5] || ""),
      groupId:     String(data[i][6] || ""),
      scheduleType: String(data[i][7] || "work"), // "work" | "off" | "holiday"
      notes:       String(data[i][8] || ""),
      createdAt:   String(data[i][9] || ""),
      createdBy:   String(data[i][10] || "")
    });
  }

  try {
    CacheService.getScriptCache().put(CACHE_KEY_SCHEDULES, JSON.stringify(schedules), 1800);
  } catch (e) { }
  return schedules;
}

/**
 * Ensure the Schedules sheet exists in the master DB
 */
function ensureSchedulesSheet(masterDbId) {
  const ss = SpreadsheetApp.openById(masterDbId);
  if (!ss.getSheetByName("Schedules")) {
    const sheet = ss.insertSheet("Schedules");
    sheet.appendRow([
      "id", "employee_id", "year", "month", "day",
      "shift_id", "group_id", "schedule_type", "notes",
      "created_at", "created_by"
    ]);
  }
}

/**
 * Get monthly schedules (admin: all or filtered; employee: own only)
 * Params: token, { year, month, employeeId, groupId, shiftId }
 */
function getMonthlySchedules(token, filters) {
  try {
    const user = verifyToken(token);
    if (!user) return errorResponse("Invalid session");

    filters = filters || {};
    const props = getProps();
    ensureSchedulesSheet(props.MASTER_DB_ID);

    const schedules = getCachedSchedules(props.MASTER_DB_ID);
    const employees = getCachedEmployees(props.MASTER_DB_ID);

    // Build lookup maps
    const empMap = {};
    employees.forEach(e => { empMap[e.id] = e; });

    let result = schedules;

    // Employees can only see their own schedule
    if (user.role !== "Admin") {
      result = result.filter(s => s.employeeId === user.userId);
    } else {
      if (filters.employeeId) result = result.filter(s => s.employeeId === filters.employeeId);
      if (filters.groupId)    result = result.filter(s => s.groupId    === filters.groupId);
      if (filters.shiftId)    result = result.filter(s => s.shiftId    === filters.shiftId);
    }

    if (filters.year)  result = result.filter(s => s.year  === Number(filters.year));
    if (filters.month) result = result.filter(s => s.month === Number(filters.month));

    // Enrich with employee info
    result = result.map(s => ({
      ...s,
      employeeName: (empMap[s.employeeId] || {}).name || s.employeeId,
      shiftStart:   "",
      shiftEnd:     ""
    }));

    // Attach shift times if available
    // Use cached data for shifts if available, otherwise fallback to sheet read
    let shifts = [];
    if (typeof getCachedShifts === 'function') {
        shifts = getCachedShifts(props.MASTER_DB_ID);
    } else if (typeof getCachedAdminData === 'function') {
        shifts = getCachedAdminData(props.MASTER_DB_ID);
    } else {
        const shiftData = getSheetData(props.MASTER_DB_ID, "Shifts");
        for (let i = 1; i < shiftData.length; i++) {
            if (shiftData[i][0]) {
                shifts.push({
                    id: String(shiftData[i][0]),
                    start_time: String(shiftData[i][1] || ""),
                    end_time: String(shiftData[i][2] || "")
                });
            }
        }
    }
    // Fallback: read shifts directly
    try {
      const shiftData = getSheetData(props.MASTER_DB_ID, "Shifts");
      const shiftMap = {};
      for (let i = 1; i < shiftData.length; i++) {
        if (shiftData[i][0]) {
          shiftMap[String(shiftData[i][0])] = {
            start_time: String(shiftData[i][1] || ""),
            end_time:   String(shiftData[i][2] || "")
          };
        }
      }
      result = result.map(s => {
        const sh = shiftMap[s.shiftId] || {};
        return { ...s, shiftStart: sh.start_time || "", shiftEnd: sh.end_time || "" };
      });
    } catch (e) { /* ignore */ }

    return successResponse(result);
  } catch (e) {
    return errorResponse("Error fetching schedules: " + e.message);
  }
}

/**
 * Save (create or update) a single schedule entry — admin only
 * scheduleData: { id?, employeeId, year, month, day, shiftId, groupId, scheduleType, notes }
 */
function saveScheduleEntry(token, scheduleData) {
  try {
    const admin = verifyToken(token);
    if (!admin || admin.role !== "Admin") return errorResponse("Unauthorized");

    if (!scheduleData || typeof scheduleData !== "object") return errorResponse("Invalid data");

    const { employeeId, year, month, day, shiftId, groupId, scheduleType, notes } = scheduleData;

    if (!employeeId || !year || !month || !day) return errorResponse("employeeId, year, month, day are required");
    if (month < 1 || month > 12) return errorResponse("Invalid month");
    if (day < 1 || day > 31)     return errorResponse("Invalid day");

    const validTypes = ["work", "off", "holiday"];
    const type = validTypes.includes(scheduleType) ? scheduleType : "work";

    const props = getProps();
    ensureSchedulesSheet(props.MASTER_DB_ID);

    const now = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss");

    // Check if entry already exists for this employee/year/month/day
    const data = getSheetData(props.MASTER_DB_ID, "Schedules");
    let existingRowIndex = -1;
    let existingId = scheduleData.id || null;

    for (let i = 1; i < data.length; i++) {
      const rowId = String(data[i][0] || "");
      const rowEmp = String(data[i][1] || "");
      const rowYear = Number(data[i][2]);
      const rowMonth = Number(data[i][3]);
      const rowDay = Number(data[i][4]);

      if (existingId && rowId === existingId) {
        existingRowIndex = i + 1;
        break;
      }
      if (!existingId && rowEmp === String(employeeId) && rowYear === Number(year) && rowMonth === Number(month) && rowDay === Number(day)) {
        existingRowIndex = i + 1;
        existingId = rowId;
        break;
      }
    }

    const rowData = [
      existingId || ("SCH" + Date.now() + Math.floor(Math.random() * 1000)),
      String(employeeId),
      Number(year),
      Number(month),
      Number(day),
      String(shiftId || ""),
      String(groupId || ""),
      type,
      String(notes || ""),
      existingRowIndex === -1 ? now : (data[existingRowIndex - 1][9] || now),
      existingRowIndex === -1 ? admin.userId : (data[existingRowIndex - 1][10] || admin.userId)
    ];

    if (existingRowIndex !== -1) {
      updateSheetRow(props.MASTER_DB_ID, "Schedules", existingRowIndex, rowData);
    } else {
      appendSheetData(props.MASTER_DB_ID, "Schedules", rowData);
    }

    invalidateSchedulesCache();
    logActivity(admin.userId, `Schedule ${existingRowIndex !== -1 ? "Updated" : "Created"}: ${employeeId} ${year}-${String(month).padStart(2,"0")}-${String(day).padStart(2,"0")} (${type})`);

    return successResponse({ id: rowData[0], message: "Schedule saved successfully" });
  } catch (e) {
    return errorResponse("Error saving schedule: " + e.message);
  }
}

/**
 * Bulk save schedule entries for a month — admin only
 * entries: array of { employeeId, year, month, day, shiftId, groupId, scheduleType, notes }
 */
function saveBulkSchedule(token, entries) {
  try {
    const admin = verifyToken(token);
    if (!admin || admin.role !== "Admin") return errorResponse("Unauthorized");

    if (!Array.isArray(entries) || entries.length === 0) return errorResponse("No entries provided");

    const props = getProps();
    ensureSchedulesSheet(props.MASTER_DB_ID);

    const now = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss");
    const validTypes = ["work", "off", "holiday"];

    // Load existing data once
    const data = getSheetData(props.MASTER_DB_ID, "Schedules");

    // Build index: "empId_year_month_day" -> rowIndex (1-based)
    const existingIndex = {};
    for (let i = 1; i < data.length; i++) {
      if (!data[i][0]) continue;
      const key = `${data[i][1]}_${data[i][2]}_${data[i][3]}_${data[i][4]}`;
      existingIndex[key] = i + 1;
    }

    let saved = 0;
    for (const entry of entries) {
      const { employeeId, year, month, day, shiftId, groupId, scheduleType, notes } = entry;
      if (!employeeId || !year || !month || !day) continue;

      const type = validTypes.includes(scheduleType) ? scheduleType : "work";
      const key = `${employeeId}_${year}_${month}_${day}`;
      const existingRowIndex = existingIndex[key];

      const rowData = [
        existingRowIndex ? String(data[existingRowIndex - 1][0]) : ("SCH" + Date.now() + Math.floor(Math.random() * 1000) + saved),
        String(employeeId),
        Number(year),
        Number(month),
        Number(day),
        String(shiftId || ""),
        String(groupId || ""),
        type,
        String(notes || ""),
        existingRowIndex ? (data[existingRowIndex - 1][9] || now) : now,
        existingRowIndex ? (data[existingRowIndex - 1][10] || admin.userId) : admin.userId
      ];

      if (existingRowIndex) {
        updateSheetRow(props.MASTER_DB_ID, "Schedules", existingRowIndex, rowData);
      } else {
        appendSheetData(props.MASTER_DB_ID, "Schedules", rowData);
      }
      saved++;
    }

    invalidateSchedulesCache();
    logActivity(admin.userId, `Bulk Schedule Saved: ${saved} entries`);

    return successResponse({ saved, message: `${saved} schedule entries saved successfully` });
  } catch (e) {
    return errorResponse("Error saving bulk schedule: " + e.message);
  }
}

/**
 * Delete a schedule entry — admin only
 */
function deleteScheduleEntry(token, scheduleId) {
  try {
    const admin = verifyToken(token);
    if (!admin || admin.role !== "Admin") return errorResponse("Unauthorized");

    const props = getProps();
    const data = getSheetData(props.MASTER_DB_ID, "Schedules");
    let rowIndex = -1;

    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]) === String(scheduleId)) {
        rowIndex = i + 1;
        break;
      }
    }

    if (rowIndex === -1) return errorResponse("Schedule entry not found");

    deleteSheetRow(props.MASTER_DB_ID, "Schedules", rowIndex);
    invalidateSchedulesCache();
    logActivity(admin.userId, `Schedule Deleted: ${scheduleId}`);

    return successResponse({ message: "Schedule entry deleted successfully" });
  } catch (e) {
    return errorResponse("Error deleting schedule: " + e.message);
  }
}

/**
 * Get schedule summary for a month (admin: all employees; employee: own)
 * Returns a map: { "employeeId_day": scheduleEntry }
 */
function getMonthScheduleSummary(token, year, month) {
  try {
    const user = verifyToken(token);
    if (!user) return errorResponse("Invalid session");

    const props = getProps();
    ensureSchedulesSheet(props.MASTER_DB_ID);

    const schedules = getCachedSchedules(props.MASTER_DB_ID);
    const employees = getCachedEmployees(props.MASTER_DB_ID);
    const shifts    = (typeof getCachedShifts === 'function') ? getCachedShifts(props.MASTER_DB_ID) : [];
    const positions = (typeof getCachedPositions === 'function') ? getCachedPositions(props.MASTER_DB_ID) : [];

    const empMap = {};
    employees.forEach(e => { empMap[e.id] = e; });

    let result = schedules.filter(s => s.year === Number(year) && s.month === Number(month));

    if (user.role !== "Admin") {
      result = result.filter(s => s.employeeId === user.userId);
    }

    // Sort by day
    result.sort((a, b) => a.day - b.day);

    // Enrich
    result = result.map(s => ({
      ...s,
      employeeName: (empMap[s.employeeId] || {}).name || s.employeeId
    }));

    // Also return employee list for admin
    const empList = user.role === "Admin"
      ? employees.map(e => ({ id: e.id, name: e.name, shift_id: e.shift_id || "", jabatan_id: e.jabatan_id || "" }))
      : [{ id: user.userId, name: (empMap[user.userId] || {}).name || user.userId }];

    // Prepare shift and group maps for the frontend
    const shiftList = shifts.map(s => ({
        id: s.id,
        start_time: s.start_time,
        end_time: s.end_time
    }));

    const groupList = positions.map(p => ({
        id: p.id,
        name: p.name
    }));

    return successResponse({
      schedules: result,
      employees: empList,
      shifts: shiftList,
      groups: groupList,
      year: Number(year),
      month: Number(month)
    });
  } catch (e) {
    return errorResponse("Error fetching schedule summary: " + e.message);
  }
}

/**
 * Check if an employee has a day-off scheduled on a specific date
 */
function getEmployeeScheduleForDate(employeeId, dateStr) {
  try {
    const props = getProps();
    const schedules = getCachedSchedules(props.MASTER_DB_ID);
    const d = new Date(dateStr);
    const year = d.getFullYear();
    const month = d.getMonth() + 1;
    const day = d.getDate();

    const entry = schedules.find(s =>
      s.employeeId === employeeId &&
      s.year === year &&
      s.month === month &&
      s.day === day
    );

    return entry || null;
  } catch (e) {
    return null;
  }
}
