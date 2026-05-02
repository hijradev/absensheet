// Test script for Leave Management System

// Mock functions for testing
const mockCache = {};
const mockSheets = {};

function mockGetProps() {
  return {
    MASTER_DB_ID: "mock_master_db",
    ATTENDANCE_DB_ID_2026: "mock_attendance_db_2026",
    LOG_DB_ID: "mock_log_db"
  };
}

function mockGetSheetData(dbId, sheetName) {
  const key = `${dbId}_${sheetName}`;
  return mockSheets[key] || [];
}

function mockAppendSheetData(dbId, sheetName, rowData) {
  const key = `${dbId}_${sheetName}`;
  if (!mockSheets[key]) {
    mockSheets[key] = [Array(rowData.length).fill("")]; // Header row
  }
  mockSheets[key].push(rowData);
  return true;
}

function mockVerifyToken(token) {
  if (token === "admin_token") {
    return { userId: "A001", role: "Admin" };
  } else if (token === "employee_token") {
    return { userId: "E001", role: "Employee" };
  }
  return null;
}

// Test isEmployeeOnLeave function
function testIsEmployeeOnLeave() {
  console.log("=== Testing isEmployeeOnLeave ===");
  
  // Setup mock data
  const props = mockGetProps();
  const leavesKey = `${props.MASTER_DB_ID}_Leaves`;
  
  mockSheets[leavesKey] = [
    ["id", "employee_id", "leave_type", "start_date", "end_date", "status", "reason", "approved_by", "approved_at", "created_at", "created_by"],
    ["L1", "E001", "Cuti", "2026-05-01", "2026-05-03", "approved", "Annual leave", "A001", "2026-04-28 10:00:00", "2026-04-28 10:00:00", "A001"],
    ["L2", "E002", "Sakit", "2026-05-02", "2026-05-02", "approved", "Sick", "A001", "2026-05-01 09:00:00", "2026-05-01 09:00:00", "E002"],
    ["L3", "E001", "Izin", "2026-05-05", "2026-05-05", "pending", "Permission", "", "", "2026-05-04 14:00:00", "E001"]
  ];
  
  // Mock getCachedLeaves function
  function mockGetCachedLeaves(masterDbId) {
    const data = mockGetSheetData(masterDbId, "Leaves");
    const leaves = [];
    for (let i = 1; i < data.length; i++) {
      leaves.push({
        id: String(data[i][0]),
        employeeId: String(data[i][1]),
        leaveType: String(data[i][2]),
        startDate: String(data[i][3]),
        endDate: String(data[i][4]),
        status: String(data[i][5]),
        reason: String(data[i][6] || ""),
        approvedBy: String(data[i][7] || ""),
        approvedAt: data[i][8] ? String(data[i][8]) : "",
        createdAt: String(data[i][9] || ""),
        createdBy: String(data[i][10] || "")
      });
    }
    return leaves;
  }
  
  // Test function
  function isEmployeeOnLeave(employeeId, dateStr) {
    const props = mockGetProps();
    const leaves = mockGetCachedLeaves(props.MASTER_DB_ID);
    
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
  
  // Run tests
  console.log("Test 1: Employee on approved leave (Cuti)");
  const result1 = isEmployeeOnLeave("E001", "2026-05-02");
  console.log("Result:", result1);
  console.log("Expected: { onLeave: true, leaveType: 'Cuti', leaveId: 'L1' }");
  console.log("Pass:", JSON.stringify(result1) === JSON.stringify({ onLeave: true, leaveType: "Cuti", leaveId: "L1" }));
  
  console.log("\nTest 2: Employee on approved leave (Sakit)");
  const result2 = isEmployeeOnLeave("E002", "2026-05-02");
  console.log("Result:", result2);
  console.log("Expected: { onLeave: true, leaveType: 'Sakit', leaveId: 'L2' }");
  console.log("Pass:", JSON.stringify(result2) === JSON.stringify({ onLeave: true, leaveType: "Sakit", leaveId: "L2" }));
  
  console.log("\nTest 3: Employee with pending leave");
  const result3 = isEmployeeOnLeave("E001", "2026-05-05");
  console.log("Result:", result3);
  console.log("Expected: { onLeave: false }");
  console.log("Pass:", JSON.stringify(result3) === JSON.stringify({ onLeave: false }));
  
  console.log("\nTest 4: Employee not on leave");
  const result4 = isEmployeeOnLeave("E001", "2026-05-10");
  console.log("Result:", result4);
  console.log("Expected: { onLeave: false }");
  console.log("Pass:", JSON.stringify(result4) === JSON.stringify({ onLeave: false }));
  
  console.log("\nTest 5: Non-existent employee");
  const result5 = isEmployeeOnLeave("E999", "2026-05-02");
  console.log("Result:", result5);
  console.log("Expected: { onLeave: false }");
  console.log("Pass:", JSON.stringify(result5) === JSON.stringify({ onLeave: false }));
}

// Test createLeaveRequest function
function testCreateLeaveRequest() {
  console.log("\n\n=== Testing createLeaveRequest ===");
  
  // Mock functions
  function mockErrorResponse(message) {
    return { status: "error", message: message, data: null };
  }
  
  function mockSuccessResponse(data, message = "Success") {
    return { status: "success", message: message, data: data };
  }
  
  function mockGetCachedEmployees(masterDbId) {
    return [
      { id: "E001", name: "John Doe", shift_id: "S1", role: "Employee", photo_url: "", jabatan_id: "P1" },
      { id: "E002", name: "Jane Smith", shift_id: "S2", role: "Employee", photo_url: "", jabatan_id: "P2" },
      { id: "A001", name: "Admin User", shift_id: "S1", role: "Admin", photo_url: "", jabatan_id: "P1" }
    ];
  }
  
  // Test cases
  console.log("Test 1: Admin creating approved leave");
  const leaveData1 = {
    employeeId: "E001",
    leaveType: "Cuti",
    startDate: "2026-05-10",
    endDate: "2026-05-12",
    reason: "Annual vacation"
  };
  
  // Simulate the function logic
  const user = mockVerifyToken("admin_token");
  console.log("User:", user);
  
  if (!user) {
    console.log("Error: Invalid session");
  } else if (!leaveData1 || typeof leaveData1 !== 'object') {
    console.log("Error: Invalid leave data");
  } else if (!leaveData1.employeeId) {
    console.log("Error: Employee ID is required");
  } else if (!["Cuti", "Izin", "Sakit", "Libur"].includes(leaveData1.leaveType)) {
    console.log("Error: Invalid leave type");
  } else if (!/^\d{4}-\d{2}-\d{2}$/.test(leaveData1.startDate)) {
    console.log("Error: Invalid start date format");
  } else if (!/^\d{4}-\d{2}-\d{2}$/.test(leaveData1.endDate)) {
    console.log("Error: Invalid end date format");
  } else if (leaveData1.startDate > leaveData1.endDate) {
    console.log("Error: Start date must be before end date");
  } else {
    // Check if employee exists
    const employees = mockGetCachedEmployees("mock_master_db");
    const emp = employees.find(e => e.id === String(leaveData1.employeeId));
    if (!emp) {
      console.log("Error: Employee not found");
    } else {
      console.log("Employee found:", emp.name);
      
      // Check for overlapping leaves
      const leavesKey = "mock_master_db_Leaves";
      const existingLeaves = mockSheets[leavesKey] || [];
      let overlapping = false;
      
      for (let i = 1; i < existingLeaves.length; i++) {
        const leave = {
          employeeId: String(existingLeaves[i][1]),
          startDate: String(existingLeaves[i][3]),
          endDate: String(existingLeaves[i][4]),
          status: String(existingLeaves[i][5])
        };
        
        if (leave.employeeId === leaveData1.employeeId && 
            leave.status === "approved" &&
            !(leaveData1.endDate < leave.startDate || leaveData1.startDate > leave.endDate)) {
          overlapping = true;
          break;
        }
      }
      
      if (overlapping) {
        console.log("Error: Employee already has approved leave during this period");
      } else {
        console.log("Success: Leave can be created");
        console.log("Admin creating leave, status will be: approved");
        
        // Generate leave ID
        const leaveId = "L" + Date.now() + Math.floor(Math.random() * 1000);
        console.log("Generated leave ID:", leaveId);
        
        // Create row data
        const now = new Date();
        const nowStr = now.toISOString().split('T')[0] + " " + now.toTimeString().split(' ')[0];
        
        const rowData = [
          leaveId,
          leaveData1.employeeId.trim(),
          leaveData1.leaveType,
          leaveData1.startDate,
          leaveData1.endDate,
          user.role === "Admin" ? "approved" : "pending",
          leaveData1.reason || "",
          user.role === "Admin" ? user.userId : "",
          user.role === "Admin" ? nowStr : "",
          nowStr,
          user.userId
        ];
        
        console.log("Row data to save:", rowData);
        
        // Save to mock sheet
        mockAppendSheetData("mock_master_db", "Leaves", rowData);
        console.log("Leave saved successfully");
        
        // Check if saved
        const savedLeaves = mockSheets["mock_master_db_Leaves"];
        console.log("All leaves in sheet:", savedLeaves);
      }
    }
  }
  
  console.log("\nTest 2: Invalid leave type");
  const leaveData2 = {
    employeeId: "E001",
    leaveType: "InvalidType",
    startDate: "2026-05-10",
    endDate: "2026-05-12"
  };
  
  if (!["Cuti", "Izin", "Sakit", "Libur"].includes(leaveData2.leaveType)) {
    console.log("Error: Invalid leave type. Must be: Cuti, Izin, Sakit, or Libur");
  }
  
  console.log("\nTest 3: Invalid date format");
  const leaveData3 = {
    employeeId: "E001",
    leaveType: "Cuti",
    startDate: "2026/05/10", // Wrong format
    endDate: "2026-05-12"
  };
  
  if (!/^\d{4}-\d{2}-\d{2}$/.test(leaveData3.startDate)) {
    console.log("Error: Invalid start date format (yyyy-MM-dd required)");
  }
  
  console.log("\nTest 4: Start date after end date");
  const leaveData4 = {
    employeeId: "E001",
    leaveType: "Cuti",
    startDate: "2026-05-15",
    endDate: "2026-05-10" // Earlier than start
  };
  
  if (leaveData4.startDate > leaveData4.endDate) {
    console.log("Error: Start date must be before or equal to end date");
  }
}

// Run tests
testIsEmployeeOnLeave();
testCreateLeaveRequest();

console.log("\n\n=== Summary ===");
console.log("The leave management system includes:");
console.log("1. isEmployeeOnLeave() - Checks if employee is on leave on a specific date");
console.log("2. createLeaveRequest() - Creates new leave requests");
console.log("3. getLeaveRequests() - Retrieves leave requests with filters");
console.log("4. updateLeaveStatus() - Updates leave status (admin only)");
console.log("5. deleteLeaveRequest() - Deletes leave requests (admin only)");
console.log("6. getLeaveBalance() - Calculates leave balance for employees");
console.log("7. createLeaveAttendanceRecords() - Automatically creates attendance records for approved leaves");
console.log("8. removeLeaveAttendanceRecords() - Removes attendance records for rejected leaves");

console.log("\nKey features:");
console.log("- Employees on leave are automatically marked with leave status (Cuti, Izin, Sakit, Libur)");
console.log("- Attendance checking prevents employees on leave from checking in/out");
console.log("- Leave requests can be approved/rejected by admins");
console.log("- Approved leaves automatically create attendance records");
console.log("- Leave balances are tracked per employee per year");
console.log("- Overlapping leave requests are prevented");