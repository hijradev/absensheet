// Setup.gs

function setupDatabase() {
  try {
    const folder = DriveApp.getRootFolder();
    
    // 1. Create Master DB
    const masterSS = SpreadsheetApp.create("Absensi_DB_Master");
    const empSheet = masterSS.getActiveSheet();
    empSheet.setName("Employees");
    empSheet.appendRow(["id", "password", "name", "shift_id", "role", "photo_url", "jabatan_id"]);
    // Sample Data — passwords are stored as SHA-256 hashes
    empSheet.appendRow(["E001", hashPassword("123456"), "John Doe", "S1", "Employee", "", "P1"]);
    empSheet.appendRow(["A001", hashPassword("admin123"), "Admin User", "S1", "Admin", "", "P1"]);
    
    const shiftSheet = masterSS.insertSheet("Shifts");
    shiftSheet.appendRow(["id", "start_time", "end_time"]);
    shiftSheet.appendRow(["S1", "08:00", "17:00"]);
    shiftSheet.appendRow(["S2", "09:00", "18:00"]);
    
    const posSheet = masterSS.insertSheet("Positions");
    posSheet.appendRow(["id", "name"]);
    posSheet.appendRow(["P1", "Staff"]);
    posSheet.appendRow(["P2", "Manager"]);

    // QR Codes sheet
    const qrSheet = masterSS.insertSheet("QR_Codes");
    qrSheet.appendRow(["employee_id", "qr_data_url", "generated_at"]);
    
    // Leaves sheet
    const leavesSheet = masterSS.insertSheet("Leaves");
    leavesSheet.appendRow([
      "id",           // Leave ID
      "employee_id",  // Employee ID
      "leave_type",   // Cuti/Izin/Sakit/Libur
      "start_date",   // yyyy-MM-dd
      "end_date",     // yyyy-MM-dd
      "status",       // pending/approved/rejected
      "reason",       // Reason for leave
      "approved_by",  // Admin who approved
      "approved_at",  // When approved
      "created_at",   // When created
      "created_by"    // Who created
    ]);
    
    // 2. Create Attendance DB for current year
    const currentYear = new Date().getFullYear();
    const attSS = SpreadsheetApp.create("Absensi_DB_Attendance_" + currentYear);
    const attSheet = attSS.getActiveSheet();
    attSheet.setName("Attendance_Data");
    attSheet.appendRow(["date", "employee_id", "check_in_time", "check_in_status", "check_out_time", "check_out_status"]);
    
    // 3. Create Log DB
    const logSS = SpreadsheetApp.create("Absensi_DB_Log");
    const logSheet = logSS.getActiveSheet();
    logSheet.setName("Activity_Log");
    logSheet.appendRow(["timestamp", "user_id", "action"]);
    
    // Save IDs to Script Properties
    PropertiesService.getScriptProperties().setProperties({
      "MASTER_DB_ID": masterSS.getId(),
      ["ATTENDANCE_DB_ID_" + currentYear]: attSS.getId(),
      "LOG_DB_ID": logSS.getId()
    });
    
    return "Setup Complete! Master ID: " + masterSS.getId();
  } catch (e) {
    return "Error during setup: " + e.message;
  }
}

/**
 * Ensures all necessary sheets and columns exist in the Master DB.
 * Can be run safely on existing database.
 */
function updateSchema() {
  try {
    const props = getProps();
    if (!props.MASTER_DB_ID) return "Master DB ID not found. Run setup first.";
    
    const ss = SpreadsheetApp.openById(props.MASTER_DB_ID);
    
    // 1. Update Employees
    const empSheet = ss.getSheetByName("Employees");
    if (empSheet) {
      const headers = empSheet.getRange(1, 1, 1, empSheet.getLastColumn()).getValues()[0];
      if (!headers.includes("photo_url")) empSheet.getRange(1, headers.length + 1).setValue("photo_url");
      if (!headers.includes("jabatan_id")) empSheet.getRange(1, empSheet.getLastColumn() + 1).setValue("jabatan_id");
    }
    
    // 2. Ensure Positions sheet
    if (!ss.getSheetByName("Positions")) {
      const posSheet = ss.insertSheet("Positions");
      posSheet.appendRow(["id", "name"]);
      posSheet.appendRow(["P1", "Staff"]);
    }
    
    // 3. Ensure folder for photos
    if (!props.PHOTO_FOLDER_ID) {
      const folder = DriveApp.createFolder("Absensi_Photos");
      PropertiesService.getScriptProperties().setProperty("PHOTO_FOLDER_ID", folder.getId());
    }

    // 4. Ensure QR_Codes sheet
    if (!ss.getSheetByName("QR_Codes")) {
      const qrSheet = ss.insertSheet("QR_Codes");
      qrSheet.appendRow(["employee_id", "qr_data_url", "generated_at"]);
    }

    // 5. Ensure Leaves sheet
    if (!ss.getSheetByName("Leaves")) {
      const leavesSheet = ss.insertSheet("Leaves");
      leavesSheet.appendRow([
        "id", "employee_id", "leave_type", "start_date", "end_date", 
        "status", "reason", "approved_by", "approved_at", "created_at", "created_by"
      ]);
    }

    return "Schema Update Complete!";
  } catch (e) {
    return "Error updating schema: " + e.message;
  }
}

/**
 * One-time migration: hashes all plaintext passwords in the Employees sheet.
 * Run this ONCE from the GAS editor after deploying the updated code.
 * It is safe to run on an already-migrated sheet — it will skip rows where
 * the password column already looks like a base64 SHA-256 hash (44 chars).
 */
function migratePasswordsToHash() {
  try {
    const props = getProps();
    if (!props.MASTER_DB_ID) return "Master DB ID not found. Run setup first.";

    const ss = SpreadsheetApp.openById(props.MASTER_DB_ID);
    const sheet = ss.getSheetByName("Employees");
    if (!sheet) return "Employees sheet not found.";

    const data = sheet.getDataRange().getValues();
    let migrated = 0;

    for (let i = 1; i < data.length; i++) {
      const plaintext = String(data[i][1]);
      // SHA-256 base64 is always 44 characters — skip if already hashed
      if (plaintext.length === 44) continue;
      sheet.getRange(i + 1, 2).setValue(hashPassword(plaintext));
      migrated++;
    }

    invalidateMasterCache();
    return "Migration complete. " + migrated + " password(s) hashed.";
  } catch (e) {
    return "Error during migration: " + e.message;
  }
}
