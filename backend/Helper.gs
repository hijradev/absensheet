// Helper.gs

const CACHE_TIMEOUT = 1800; // 30 minutes — short enough to reflect shift/employee changes promptly
const CACHE = CacheService.getScriptCache();

// Cache key prefixes
const CACHE_KEY_EMPLOYEES = 'master_employees';
const CACHE_KEY_SHIFTS     = 'master_shifts';
const CACHE_KEY_POSITIONS  = 'master_positions';

// Function to safely get Properties
function getProps() {
  return PropertiesService.getScriptProperties().getProperties();
}

// Format API Responses
function successResponse(data, message = "Success") {
  return { status: "success", message: message, data: data };
}

function errorResponse(message) {
  return { status: "error", message: message, data: null };
}

/**
 * One-time setup: generates a cryptographically random secret and stores it.
 * Called automatically by generateToken/verifyToken if not yet set.
 * Safe to call multiple times — only sets the key if it doesn't exist.
 */
function initSecretKey() {
  const existing = PropertiesService.getScriptProperties().getProperty("HMAC_SECRET");
  if (existing) return "HMAC_SECRET already set.";
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, Utilities.getUuid() + Date.now());
  const secret = Utilities.base64Encode(bytes);
  PropertiesService.getScriptProperties().setProperty("HMAC_SECRET", secret);
  return "HMAC_SECRET initialized successfully.";
}

// Retrieve the HMAC secret, auto-initializing it on first use if needed.
function getHmacSecret() {
  let secret = PropertiesService.getScriptProperties().getProperty("HMAC_SECRET");
  if (!secret) {
    // Auto-initialize on first use so the app works out of the box after deployment.
    const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, Utilities.getUuid() + Date.now());
    secret = Utilities.base64Encode(bytes);
    PropertiesService.getScriptProperties().setProperty("HMAC_SECRET", secret);
  }
  return secret;
}

// Hash a password with SHA-256. Used for both storage and verification.
function hashPassword(plaintext) {
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(plaintext));
  return Utilities.base64Encode(bytes);
}

// Generate a signed token
function generateToken(userId, role) {
  const payload = Utilities.base64Encode(JSON.stringify({ userId, role, exp: Date.now() + 1000 * 60 * 60 * 24 }));
  const signature = Utilities.base64Encode(Utilities.computeHmacSha256Signature(payload, getHmacSecret()));
  return payload + "." + signature;
}

function verifyToken(token) {
  if (!token) return null;
  try {
    const parts = token.split(".");
    if (parts.length !== 2) return null;
    const signature = Utilities.base64Encode(Utilities.computeHmacSha256Signature(parts[0], getHmacSecret()));
    if (signature !== parts[1]) return null;
    const decoded = JSON.parse(Utilities.newBlob(Utilities.base64Decode(parts[0])).getDataAsString());
    if (decoded.exp < Date.now()) return null;
    return decoded;
  } catch (e) {
    return null;
  }
}

// ===== SPREADSHEET HELPERS =====

function getSheetData(spreadsheetId, sheetName) {
  try {
    const ss = SpreadsheetApp.openById(spreadsheetId);
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet) return [];
    return sheet.getDataRange().getValues();
  } catch (e) {
    console.error("Error reading sheet:", e);
    return [];
  }
}

function appendSheetData(spreadsheetId, sheetName, rowData) {
  try {
    const ss = SpreadsheetApp.openById(spreadsheetId);
    let sheet = ss.getSheetByName(sheetName);
    if (!sheet) sheet = ss.insertSheet(sheetName);
    sheet.appendRow(rowData);
    return true;
  } catch (e) {
    console.error("Error appending to sheet:", e);
    return false;
  }
}

function updateSheetRow(spreadsheetId, sheetName, rowIndex, rowData) {
  try {
    const ss = SpreadsheetApp.openById(spreadsheetId);
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet) return false;
    sheet.getRange(rowIndex, 1, 1, rowData.length).setValues([rowData]);
    return true;
  } catch (e) {
    console.error("Error updating sheet row:", e);
    return false;
  }
}

function deleteSheetRow(spreadsheetId, sheetName, rowIndex) {
  try {
    const ss = SpreadsheetApp.openById(spreadsheetId);
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet) return false;
    sheet.deleteRow(rowIndex);
    return true;
  } catch (e) {
    console.error("Error deleting sheet row:", e);
    return false;
  }
}

function findRowIndex(spreadsheetId, sheetName, idValue, idColumnIndex = 0) {
  const data = getSheetData(spreadsheetId, sheetName);
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][idColumnIndex]) === String(idValue)) {
      return i + 1; // 1-indexed for SpreadsheetApp
    }
  }
  return -1;
}

// ===== MASTER DATA CACHE =====
// Employees, Shifts, and Positions rarely change — cache them to avoid
// repeated SpreadsheetApp.openById() calls on every check-in/check-out.

/**
 * Returns cached employees array, or reads from sheet and caches it.
 * Call invalidateMasterCache() after any write to Employees/Shifts/Positions.
 */
function getCachedEmployees(masterDbId) {
  try {
    const cached = CACHE.get(CACHE_KEY_EMPLOYEES);
    if (cached) return JSON.parse(cached);
  } catch (e) { /* cache miss or parse error — fall through */ }

  const data = getSheetData(masterDbId, "Employees");
  const employees = [];
  for (let i = 1; i < data.length; i++) {
    employees.push({
      id:           String(data[i][0]),
      passwordHash: String(data[i][1]), // stored as SHA-256 hash — never expose to frontend
      name:         String(data[i][2]),
      shift_id:     String(data[i][3]),
      role:         String(data[i][4]),
      photo_url:    data[i][5] || "",
      jabatan_id:   data[i][6] || ""
    });
  }

  try { CACHE.put(CACHE_KEY_EMPLOYEES, JSON.stringify(employees), CACHE_TIMEOUT); } catch (e) { }
  return employees;
}

/**
 * Returns a sanitized employee list safe to send to the frontend.
 * Strips the passwordHash field before returning.
 */
function sanitizeEmployeesForClient(employees) {
  return employees.map(({ passwordHash, ...safe }) => safe);
}

/**
 * Returns cached shifts array, or reads from sheet and caches it.
 */
function getCachedShifts(masterDbId) {
  try {
    const cached = CACHE.get(CACHE_KEY_SHIFTS);
    if (cached) return JSON.parse(cached);
  } catch (e) { /* cache miss */ }

  const data = getSheetData(masterDbId, "Shifts");
  const shifts = [];
  for (let i = 1; i < data.length; i++) {
    shifts.push({
      id:         String(data[i][0]),
      start_time: data[i][1] instanceof Date
        ? Utilities.formatDate(data[i][1], Session.getScriptTimeZone(), "HH:mm")
        : String(data[i][1]),
      end_time:   data[i][2] instanceof Date
        ? Utilities.formatDate(data[i][2], Session.getScriptTimeZone(), "HH:mm")
        : String(data[i][2])
    });
  }

  try { CACHE.put(CACHE_KEY_SHIFTS, JSON.stringify(shifts), CACHE_TIMEOUT); } catch (e) { }
  return shifts;
}

/**
 * Returns cached positions array, or reads from sheet and caches it.
 */
function getCachedPositions(masterDbId) {
  try {
    const cached = CACHE.get(CACHE_KEY_POSITIONS);
    if (cached) return JSON.parse(cached);
  } catch (e) { /* cache miss */ }

  const data = getSheetData(masterDbId, "Positions");
  const positions = [];
  for (let i = 1; i < data.length; i++) {
    positions.push({ id: String(data[i][0]), name: String(data[i][1]) });
  }

  try { CACHE.put(CACHE_KEY_POSITIONS, JSON.stringify(positions), CACHE_TIMEOUT); } catch (e) { }
  return positions;
}

/**
 * Invalidates all master data caches.
 * Must be called after any write to Employees, Shifts, or Positions sheets.
 */
function invalidateMasterCache() {
  try {
    CACHE.removeAll([CACHE_KEY_EMPLOYEES, CACHE_KEY_SHIFTS, CACHE_KEY_POSITIONS]);
  } catch (e) { }
}

// ===== IMAGE UPLOAD =====

function uploadImageToDrive(base64Data, fileName) {
  try {
    // Validate: only allow image MIME types
    const mimeMatch = base64Data.match(/^data:(image\/(jpeg|png|gif|webp));base64,/);
    if (!mimeMatch) throw new Error("Invalid file type. Only JPEG, PNG, GIF, and WebP are allowed.");

    // Validate: limit to ~2MB (base64 overhead ~1.37x, so 2MB raw ≈ 2.7MB base64)
    const base64Payload = base64Data.split(',')[1];
    if (!base64Payload || base64Payload.length > 2800000) throw new Error("Image exceeds the 2MB size limit.");

    const props = getProps();
    let folderId = props.PHOTO_FOLDER_ID;
    if (!folderId) {
      const folder = DriveApp.createFolder("Absensi_Photos");
      folderId = folder.getId();
      PropertiesService.getScriptProperties().setProperty("PHOTO_FOLDER_ID", folderId);
    }

    const folder = DriveApp.getFolderById(folderId);
    const contentType = mimeMatch[1];
    const bytes = Utilities.base64Decode(base64Payload);
    const blob = Utilities.newBlob(bytes, contentType, fileName);
    const file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    return file.getUrl().replace("view?usp=drivesdk", "view");
  } catch (e) {
    console.error("Error uploading image:", e);
    throw e;
  }
}

// ===== ACTIVITY LOG =====

function logActivity(userId, action) {
  const props = getProps();
  if (props.LOG_DB_ID) {
    appendSheetData(props.LOG_DB_ID, "Activity_Log", [new Date(), userId, action]);
  }
}

// ===== TIME HELPERS =====

function parseTime(timeStr) {
  if (timeStr instanceof Date) return timeStr.getHours() * 60 + timeStr.getMinutes();
  const parts = String(timeStr).split(":");
  return parseInt(parts[0]) * 60 + parseInt(parts[1]);
}
