// Leaves.gs - Leave Management System

const CACHE_KEY_LEAVES = 'master_leaves';

/**
 * Get cached leaves data
 */
function getCachedLeaves(masterDbId) {
  try {
    const cached = CacheService.getScriptCache().get(CACHE_KEY_LEAVES);
    if (cached) return JSON.parse(cached);
  } catch (e) { /* cache miss or parse error — fall through */ }

  const data = getSheetData(masterDbId, "Leaves");
  const leaves = [];
  for (let i = 1; i < data.length; i++) {
    leaves.push({
      id: String(data[i][0]),
      employeeId: String(data[i][1]),
      leaveType: String(data[i][2]), // "Cuti", "Izin", "Sakit", "Libur"
      startDate: String(data[i][3]), // yyyy-MM-dd
      endDate: String(data[i][4]),   // yyyy-MM-dd
      status: String(data[i][5]),    // "pending", "approved", "rejected"
      reason: String(data[i][6] || ""),
      approvedBy: String(data[i][7] || ""),
      approvedAt: data[i][8] ? String(data[i][8]) : "",
      createdAt: String(data[i][9] || ""),
      createdBy: String(data[i][10] || "")
    });
  }

  try { 
    CacheService.getScriptCache().put(CACHE_KEY_LEAVES, JSON.stringify(leaves), 1800); 
  } catch (e) { }
  return leaves;
}

/**
 * Invalidate leaves cache
 */
function invalidateLeavesCache() {
  try {
    CacheService.getScriptCache().remove(CACHE_KEY_LEAVES);
  } catch (e) { }
}

/**
 * Check if an employee is on leave on a specific date
 */
function isEmployeeOnLeave(employeeId, dateStr) {
  const props = getProps();
  const leaves = getCachedLeaves(props.MASTER_DB_ID);
  
  const targetDate = new Date(dateStr);
  
  for (let i = 0; i < leaves.length; i++) {
    const leave = leaves[i];
    if (leave.employeeId === employeeId && 
        leave.status === "approved" &&
        leave.startDate <= dateStr && 
        leave.endDate >= dateStr) {
      return {
        onLeave: true,
        leaveType: leave.leaveType,
        leaveId: leave.id
      };
    }
  }
  
  return { onLeave: false };
}

/**
 * Create a new leave request
 */
function createLeaveRequest(token, leaveData) {
  try {
    const user = verifyToken(token);
    if (!user) return errorResponse("Invalid session");
    
    // Validate input
    if (!leaveData || typeof leaveData !== 'object') {
      return errorResponse("Invalid leave data");
    }
    
    const { employeeId, leaveType, startDate, endDate, reason } = leaveData;
    
    // Validation
    if (!employeeId || typeof employeeId !== 'string' || employeeId.trim().length === 0) {
      return errorResponse("Employee ID is required");
    }
    
    const validLeaveTypes = ["Cuti", "Izin", "Sakit", "Libur"];
    if (!leaveType || !validLeaveTypes.includes(leaveType)) {
      return errorResponse("Invalid leave type. Must be: Cuti, Izin, Sakit, or Libur");
    }
    
    if (!startDate || !/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
      return errorResponse("Invalid start date format (yyyy-MM-dd required)");
    }
    
    if (!endDate || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
      return errorResponse("Invalid end date format (yyyy-MM-dd required)");
    }
    
    if (startDate > endDate) {
      return errorResponse("Start date must be before or equal to end date");
    }
    
    // Check if employee exists
    const props = getProps();
    const employees = getCachedEmployees(props.MASTER_DB_ID);
    const emp = employees.find(e => e.id === String(employeeId));
    if (!emp) {
      return errorResponse("Employee not found");
    }
    
    // Check for overlapping approved leaves
    const leaves = getCachedLeaves(props.MASTER_DB_ID);
    const overlapping = leaves.filter(l => 
      l.employeeId === employeeId && 
      l.status === "approved" &&
      !(endDate < l.startDate || startDate > l.endDate)
    );
    
    if (overlapping.length > 0) {
      return errorResponse("Employee already has approved leave during this period");
    }
    
    // Generate unique ID
    const leaveId = "L" + Date.now() + Math.floor(Math.random() * 1000);
    
    const now = new Date();
    const nowStr = Utilities.formatDate(now, Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss");
    
    const rowData = [
      leaveId,
      employeeId.trim(),
      leaveType,
      startDate,
      endDate,
      user.role === "Admin" ? "approved" : "pending",
      reason || "",
      user.role === "Admin" ? user.userId : "",
      user.role === "Admin" ? nowStr : "",
      nowStr,
      user.userId
    ];
    
    // Append to Leaves sheet
    const appended = appendSheetData(props.MASTER_DB_ID, "Leaves", rowData);
    if (!appended) {
      return errorResponse("Failed to save leave request");
    }
    
    // Invalidate cache
    invalidateLeavesCache();
    
    // If admin is creating and approving immediately, create attendance records
    if (user.role === "Admin" && leaveData.autoCreateAttendance !== false) {
      createLeaveAttendanceRecords(leaveId, employeeId, leaveType, startDate, endDate);
    }
    
    logActivity(user.userId, `Leave ${user.role === "Admin" ? "Created & Approved" : "Requested"}: ${employeeId} ${startDate}-${endDate} (${leaveType})`);
    
    return successResponse({ 
      leaveId, 
      status: user.role === "Admin" ? "approved" : "pending",
      message: user.role === "Admin" ? 
        "Leave created and approved successfully" : 
        "Leave request submitted successfully"
    });
    
  } catch (e) {
    return errorResponse("Error creating leave request: " + e.message);
  }
}

/**
 * Create attendance records for approved leave
 */
function createLeaveAttendanceRecords(leaveId, employeeId, leaveType, startDate, endDate) {
  try {
    const props = getProps();
    
    // Convert dates to Date objects for iteration
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    // Iterate through each day of the leave period
    const current = new Date(start);
    while (current <= end) {
      const dateStr = Utilities.formatDate(current, Session.getScriptTimeZone(), "yyyy-MM-dd");
      const year = current.getFullYear();
      
      // Get attendance DB for this year
      const attendanceDbId = props["ATTENDANCE_DB_ID_" + year];
      if (attendanceDbId) {
        // Check if attendance record already exists for this date
        const attData = getSheetData(attendanceDbId, "Attendance_Data");
        let existingRowIndex = -1;
        
        for (let i = 1; i < attData.length; i++) {
          const rowDate = attData[i][0] instanceof Date
            ? Utilities.formatDate(attData[i][0], Session.getScriptTimeZone(), "yyyy-MM-dd")
            : String(attData[i][0]).substring(0, 10);
          
          if (rowDate === dateStr && String(attData[i][1]) === String(employeeId)) {
            existingRowIndex = i + 1;
            break;
          }
        }
        
        if (existingRowIndex === -1) {
          // Create new attendance record for leave day
          appendSheetData(attendanceDbId, "Attendance_Data", [
            dateStr,
            employeeId,
            "",           // checkInTime
            leaveType,    // checkInStatus
            "",           // checkOutTime
            "",           // checkOutStatus
            "", "", "",   // checkIn location
            "", "", "",   // checkOut location
            "leave"       // source
          ]);
        } else {
          // Update existing record to mark as leave
          const existingRow = attData[existingRowIndex - 1];
          existingRow[3] = leaveType; // checkInStatus
          existingRow[12] = "leave";   // source
          
          // Ensure row has proper length
          while (existingRow.length < 13) {
            existingRow.push("");
          }
          
          updateSheetRow(attendanceDbId, "Attendance_Data", existingRowIndex, existingRow);
        }
      }
      
      // Move to next day
      current.setDate(current.getDate() + 1);
    }
    
    return true;
  } catch (e) {
    console.error("Error creating leave attendance records:", e);
    return false;
  }
}

/**
 * Get all leave requests (admin only or own requests for employees)
 */
function getLeaveRequests(token, filters = {}) {
  try {
    const user = verifyToken(token);
    if (!user) return errorResponse("Invalid session");
    
    const props = getProps();
    const leaves = getCachedLeaves(props.MASTER_DB_ID);
    const employees = getCachedEmployees(props.MASTER_DB_ID);
    
    // Build employee name map
    const employeeMap = {};
    employees.forEach(emp => {
      employeeMap[emp.id] = emp.name;
    });
    
    let filteredLeaves = leaves;
    
    // Apply filters
    if (filters.employeeId) {
      filteredLeaves = filteredLeaves.filter(l => l.employeeId === filters.employeeId);
    }
    
    if (filters.status) {
      filteredLeaves = filteredLeaves.filter(l => l.status === filters.status);
    }
    
    if (filters.leaveType) {
      filteredLeaves = filteredLeaves.filter(l => l.leaveType === filters.leaveType);
    }
    
    if (filters.startDate) {
      filteredLeaves = filteredLeaves.filter(l => l.startDate >= filters.startDate);
    }
    
    if (filters.endDate) {
      filteredLeaves = filteredLeaves.filter(l => l.endDate <= filters.endDate);
    }
    
    // Employees can only see their own leaves
    if (user.role !== "Admin") {
      filteredLeaves = filteredLeaves.filter(l => l.employeeId === user.userId);
    }
    
    // Add employee name to each leave
    const result = filteredLeaves.map(leave => ({
      ...leave,
      employeeName: employeeMap[leave.employeeId] || leave.employeeId
    }));
    
    // Sort by creation date (newest first)
    result.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    
    return successResponse(result);
    
  } catch (e) {
    return errorResponse("Error fetching leave requests: " + e.message);
  }
}

/**
 * Update leave request status (admin only)
 */
function updateLeaveStatus(token, leaveId, status, notes = "") {
  try {
    const admin = verifyToken(token);
    if (!admin || admin.role !== "Admin") {
      return errorResponse("Unauthorized");
    }
    
    const validStatuses = ["pending", "approved", "rejected"];
    if (!validStatuses.includes(status)) {
      return errorResponse("Invalid status. Must be: pending, approved, or rejected");
    }
    
    const props = getProps();
    const leaves = getCachedLeaves(props.MASTER_DB_ID);
    const leaveIndex = leaves.findIndex(l => l.id === leaveId);
    
    if (leaveIndex === -1) {
      return errorResponse("Leave request not found");
    }
    
    const leave = leaves[leaveIndex];
    
    // Update in sheet
    const data = getSheetData(props.MASTER_DB_ID, "Leaves");
    let rowIndex = -1;
    
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]) === leaveId) {
        rowIndex = i + 1;
        break;
      }
    }
    
    if (rowIndex === -1) {
      return errorResponse("Leave request not found in sheet");
    }
    
    const rowData = data[rowIndex - 1];
    rowData[5] = status; // status column
    rowData[7] = admin.userId; // approvedBy
    rowData[8] = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss"); // approvedAt
    
    if (notes) {
      // Add notes to reason field or create new column if needed
      rowData[6] = (rowData[6] || "") + (rowData[6] ? "\n\n" : "") + "Admin notes: " + notes;
    }
    
    updateSheetRow(props.MASTER_DB_ID, "Leaves", rowIndex, rowData);
    
    // Invalidate cache
    invalidateLeavesCache();
    
    // If approved, create attendance records
    if (status === "approved") {
      createLeaveAttendanceRecords(
        leaveId, 
        leave.employeeId, 
        leave.leaveType, 
        leave.startDate, 
        leave.endDate
      );
    } else if (status === "rejected" && leave.status === "approved") {
      // If changing from approved to rejected, remove attendance records
      removeLeaveAttendanceRecords(leave.employeeId, leave.startDate, leave.endDate);
    }
    
    logActivity(admin.userId, `Leave ${status}: ${leave.employeeId} ${leave.startDate}-${leave.endDate} (${leave.leaveType})`);
    
    return successResponse({ 
      leaveId, 
      status,
      message: `Leave request ${status} successfully`
    });
    
  } catch (e) {
    return errorResponse("Error updating leave status: " + e.message);
  }
}

/**
 * Remove attendance records for rejected leave
 */
function removeLeaveAttendanceRecords(employeeId, startDate, endDate) {
  try {
    const props = getProps();
    
    // Convert dates to Date objects for iteration
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    // Iterate through each day of the leave period
    const current = new Date(start);
    while (current <= end) {
      const dateStr = Utilities.formatDate(current, Session.getScriptTimeZone(), "yyyy-MM-dd");
      const year = current.getFullYear();
      
      // Get attendance DB for this year
      const attendanceDbId = props["ATTENDANCE_DB_ID_" + year];
      if (attendanceDbId) {
        // Find and delete attendance record for this date
        const attData = getSheetData(attendanceDbId, "Attendance_Data");
        
        for (let i = 1; i < attData.length; i++) {
          const rowDate = attData[i][0] instanceof Date
            ? Utilities.formatDate(attData[i][0], Session.getScriptTimeZone(), "yyyy-MM-dd")
            : String(attData[i][0]).substring(0, 10);
          
          if (rowDate === dateStr && 
              String(attData[i][1]) === String(employeeId) &&
              String(attData[i][12] || "") === "leave") {
            
            deleteSheetRow(attendanceDbId, "Attendance_Data", i + 1);
            break;
          }
        }
      }
      
      // Move to next day
      current.setDate(current.getDate() + 1);
    }
    
    return true;
  } catch (e) {
    console.error("Error removing leave attendance records:", e);
    return false;
  }
}

/**
 * Delete a leave request (admin only)
 */
function deleteLeaveRequest(token, leaveId) {
  try {
    const admin = verifyToken(token);
    if (!admin || admin.role !== "Admin") {
      return errorResponse("Unauthorized");
    }
    
    const props = getProps();
    
    // Find leave in sheet
    const data = getSheetData(props.MASTER_DB_ID, "Leaves");
    let rowIndex = -1;
    let leave = null;
    
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]) === leaveId) {
        rowIndex = i + 1;
        leave = {
          id: String(data[i][0]),
          employeeId: String(data[i][1]),
          leaveType: String(data[i][2]),
          startDate: String(data[i][3]),
          endDate: String(data[i][4]),
          status: String(data[i][5])
        };
        break;
      }
    }
    
    if (rowIndex === -1) {
      return errorResponse("Leave request not found");
    }
    
    // If leave was approved, remove attendance records
    if (leave.status === "approved") {
      removeLeaveAttendanceRecords(leave.employeeId, leave.startDate, leave.endDate);
    }
    
    // Delete from Leaves sheet
    const deleted = deleteSheetRow(props.MASTER_DB_ID, "Leaves", rowIndex);
    if (!deleted) {
      return errorResponse("Failed to delete leave request");
    }
    
    // Invalidate cache
    invalidateLeavesCache();
    
    logActivity(admin.userId, `Leave Deleted: ${leave.employeeId} ${leave.startDate}-${leave.endDate} (${leave.leaveType})`);
    
    return successResponse({ 
      leaveId,
      message: "Leave request deleted successfully"
    });
    
  } catch (e) {
    return errorResponse("Error deleting leave request: " + e.message);
  }
}

/**
 * Get leave balance for an employee
 */
function getLeaveBalance(token, employeeId) {
  try {
    const user = verifyToken(token);
    if (!user) return errorResponse("Invalid session");
    
    // Employees can only check their own balance, admins can check any
    if (user.role !== "Admin" && user.userId !== employeeId) {
      return errorResponse("Unauthorized");
    }
    
    const props = getProps();
    const leaves = getCachedLeaves(props.MASTER_DB_ID);
    
    // Default annual leave quotas (can be configured per company)
    const annualQuotas = {
      "Cuti": 12,   // Annual leave days
      "Izin": 6,    // Permission days
      "Sakit": 12   // Sick leave days
    };
    
    // Calculate used leaves for current year
    const currentYear = new Date().getFullYear();
    const yearStart = currentYear + "-01-01";
    const yearEnd = currentYear + "-12-31";
    
    const usedLeaves = { "Cuti": 0, "Izin": 0, "Sakit": 0 };
    
    leaves.forEach(leave => {
      if (leave.employeeId === employeeId && 
          leave.status === "approved" &&
          leave.startDate >= yearStart && 
          leave.endDate <= yearEnd) {
        
        // Calculate number of days for this leave
        const start = new Date(leave.startDate);
        const end = new Date(leave.endDate);
        const daysDiff = Math.round((end - start) / (1000 * 60 * 60 * 24)) + 1;
        
        if (usedLeaves[leave.leaveType] !== undefined) {
          usedLeaves[leave.leaveType] += daysDiff;
        }
      }
    });
    
    // Calculate remaining balance
    const balance = {};
    Object.keys(annualQuotas).forEach(type => {
      balance[type] = {
        quota: annualQuotas[type],
        used: usedLeaves[type] || 0,
        remaining: annualQuotas[type] - (usedLeaves[type] || 0)
      };
    });
    
    return successResponse({
      employeeId,
      year: currentYear,
      balance
    });
    
  } catch (e) {
    return errorResponse("Error calculating leave balance: " + e.message);
  }
}

/**
 * Update Setup.gs to include Leaves sheet
 */
function addLeavesSheetToMasterDB() {
  try {
    const props = getProps();
    if (!props.MASTER_DB_ID) return "Master DB ID not found. Run setup first.";
    
    const ss = SpreadsheetApp.openById(props.MASTER_DB_ID);
    
    // Check if Leaves sheet already exists
    if (ss.getSheetByName("Leaves")) {
      return "Leaves sheet already exists.";
    }
    
    // Create Leaves sheet
    const leavesSheet = ss.insertSheet("Leaves");
    leavesSheet.appendRow([
      "id",           // 0 - Leave ID
      "employee_id",  // 1 - Employee ID
      "leave_type",   // 2 - Cuti/Izin/Sakit/Libur
      "start_date",   // 3 - yyyy-MM-dd
      "end_date",     // 4 - yyyy-MM-dd
      "status",       // 5 - pending/approved/rejected
      "reason",       // 6 - Reason for leave
      "approved_by",  // 7 - Admin who approved
      "approved_at",  // 8 - When approved
      "created_at",   // 9 - When created
      "created_by"    // 10 - Who created
    ]);
    
    // Set column widths
    leavesSheet.setColumnWidth(1, 100); // id
    leavesSheet.setColumnWidth(2, 100); // employee_id
    leavesSheet.setColumnWidth(3, 100); // leave_type
    leavesSheet.setColumnWidth(4, 120); // start_date
    leavesSheet.setColumnWidth(5, 120); // end_date
    leavesSheet.setColumnWidth(6, 100); // status
    leavesSheet.setColumnWidth(7, 200); // reason
    leavesSheet.setColumnWidth(8, 100); // approved_by
    leavesSheet.setColumnWidth(9, 150); // approved_at
    leavesSheet.setColumnWidth(10, 150); // created_at
    leavesSheet.setColumnWidth(11, 100); // created_by
    
    return "Leaves sheet created successfully.";
    
  } catch (e) {
    return "Error creating Leaves sheet: " + e.message;
  }
}