// Auth.gs

function login(employeeId, password) {
  try {
    // Input validation
    if (!employeeId || !password) return errorResponse("Employee ID and password are required.");
    if (typeof employeeId !== 'string' || typeof password !== 'string') return errorResponse("Invalid input.");
    if (employeeId.length > 50 || password.length > 128) return errorResponse("Invalid credentials.");

    const props = getProps();
    if (!props.MASTER_DB_ID) {
      return errorResponse("System not initialized. Please run setup.");
    }

    const employees = getCachedEmployees(props.MASTER_DB_ID);
    if (!employees || employees.length === 0) {
      return errorResponse("No employees found.");
    }

    const emp = employees.find(e => e.id === String(employeeId));
    if (!emp) {
      // Constant-time-ish: hash anyway to avoid timing oracle
      hashPassword(password);
      return errorResponse("Invalid credentials.");
    }

    const submittedHash = hashPassword(password);
    if (submittedHash !== emp.passwordHash) {
      return errorResponse("Invalid credentials.");
    }

    const user = {
      id:       emp.id,
      name:     emp.name,
      shift_id: emp.shift_id,
      role:     emp.role
    };
    const token = generateToken(user.id, user.role);
    logActivity(user.id, "Login");
    return successResponse({ token, user }, "Login successful");
  } catch (e) {
    return errorResponse("Error during login: " + e.message);
  }
}
