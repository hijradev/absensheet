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

/**
 * Get the profile of the currently logged-in user (Employee or Admin).
 */
function getMyProfile(token) {
  try {
    const decoded = verifyToken(token);
    if (!decoded) return errorResponse("Unauthorized");

    const props = getProps();
    if (!props.MASTER_DB_ID) return errorResponse("System not initialized.");

    const employees = getCachedEmployees(props.MASTER_DB_ID);
    const emp = employees.find(e => e.id === decoded.userId);
    if (!emp) return errorResponse("User not found.");

    // Build position name lookup
    const positions = getCachedPositions(props.MASTER_DB_ID);
    const positionMap = {};
    positions.forEach(p => { positionMap[p.id] = p.name; });

    // Build shift lookup
    const shifts = getCachedShifts(props.MASTER_DB_ID);
    const shiftMap = {};
    shifts.forEach(s => { shiftMap[s.id] = s; });

    const profile = {
      id:           emp.id,
      name:         emp.name,
      role:         emp.role,
      shift_id:     emp.shift_id,
      shift:        shiftMap[emp.shift_id] || null,
      jabatan_id:   emp.jabatan_id,
      jabatan_name: positionMap[emp.jabatan_id] || '',
      photo_url:    emp.photo_url || ''
    };

    return successResponse(profile);
  } catch (e) {
    return errorResponse("Error loading profile: " + e.message);
  }
}

/**
 * Change the password of the currently logged-in user (Employee or Admin).
 */
function changeMyPassword(token, passwordData) {
  try {
    const decoded = verifyToken(token);
    if (!decoded) return errorResponse("Unauthorized");

    if (!passwordData || typeof passwordData !== 'object') return errorResponse("Invalid data.");
    const { currentPassword, newPassword } = passwordData;

    if (!currentPassword || !newPassword) return errorResponse("Current and new password are required.");
    if (typeof currentPassword !== 'string' || typeof newPassword !== 'string') return errorResponse("Invalid password format.");
    if (newPassword.length < 6) return errorResponse("New password must be at least 6 characters.");
    if (newPassword.length > 128) return errorResponse("New password must be 128 characters or less.");
    if (currentPassword === newPassword) return errorResponse("New password must be different from current password.");

    const props = getProps();
    if (!props.MASTER_DB_ID) return errorResponse("System not initialized.");

    const employees = getCachedEmployees(props.MASTER_DB_ID);
    const emp = employees.find(e => e.id === decoded.userId);
    if (!emp) return errorResponse("User not found.");

    if (hashPassword(currentPassword) !== emp.passwordHash) return errorResponse("Current password is incorrect.");

    const ss = SpreadsheetApp.openById(props.MASTER_DB_ID);
    const sheet = ss.getSheetByName('Employees');
    if (!sheet) return errorResponse("Employees sheet not found.");

    const data = sheet.getDataRange().getValues();
    let updated = false;
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]) === decoded.userId) {
        sheet.getRange(i + 1, 2).setValue(hashPassword(newPassword));
        updated = true;
        break;
      }
    }

    if (!updated) return errorResponse("Failed to update password.");

    invalidateMasterCache();
    logActivity(decoded.userId, "Changed own password");
    return successResponse(null, "Password changed successfully.");
  } catch (e) {
    return errorResponse("Error changing password: " + e.message);
  }
}

/**
 * Upload avatar for the currently logged-in user.
 * Accepts a base64 image data URL, uploads to Drive, saves URL to employee record.
 */
function uploadMyAvatar(token, base64Data, fileName) {
  try {
    const decoded = verifyToken(token);
    if (!decoded) return errorResponse("Unauthorized");

    if (!base64Data || !fileName) return errorResponse("Missing file data.");
    if (typeof fileName !== 'string' || fileName.length > 255) return errorResponse("Invalid file name.");

    const url = uploadImageToDrive(base64Data, fileName);

    // Save the URL back to the employee record
    const props = getProps();
    if (!props.MASTER_DB_ID) return errorResponse("System not initialized.");

    const ss = SpreadsheetApp.openById(props.MASTER_DB_ID);
    const sheet = ss.getSheetByName('Employees');
    if (!sheet) return errorResponse("Employees sheet not found.");

    const data = sheet.getDataRange().getValues();
    let updated = false;
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]) === decoded.userId) {
        sheet.getRange(i + 1, 6).setValue(url); // column F = photo_url
        updated = true;
        break;
      }
    }

    if (!updated) return errorResponse("User not found.");

    invalidateMasterCache();
    logActivity(decoded.userId, "Updated profile photo");
    return successResponse({ photo_url: url }, "Avatar updated successfully.");
  } catch (e) {
    return errorResponse("Error uploading avatar: " + e.message);
  }
}
