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