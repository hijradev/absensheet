// Code.gs
//
// GAS Router / Entry Point
//
// In Google Apps Script, every top-level function defined in any .gs file is
// automatically callable from the client via google.script.run — no explicit
// export or registration is required.
//
// Attendance functions exposed to the client (defined in Absensi.gs):
//   checkIn(token, locationPayload)                    — employee check-in with optional GPS payload
//   checkOut(token, locationPayload)                   — employee check-out with optional GPS payload
//   processAttendanceByQR(employeeId, locationPayload) — QR-code attendance with optional GPS payload
//
// Geofence settings functions (defined in Settings.gs):
//   getGeofenceSettings(token)
//   saveGeofenceSettings(token, data)
//
// Monthly report email functions (defined in Settings.gs):
//   getEmailSettings(token)                            — retrieve email configuration
//   saveEmailSettings(token, emailData)                — save email config and manage trigger
//   sendManualMonthlyReport(token)                     — send current month's report on demand
//   getEmailDeliveryLogs(token)                        — retrieve last 10 delivery log entries
//
// Scheduled trigger handler (defined in Settings.gs, called by time-based trigger):
//   handleScheduledEmailSend()                         — generates and sends previous month's report
//

/**
 * Returns the URL of the web app.
 * Used by the frontend to open the standalone scanner in a new tab.
 */
function getScriptUrl() {
  return ScriptApp.getService().getUrl();
}

function doGet(e) {
  // Serve standalone scanner page when ?page=scanner is in the URL.
  // This page runs as a top-level document (not inside the GAS iframe),
  // which allows getUserMedia() / camera access for QR code scanning.
  if (e && e.parameter && e.parameter.page === 'scanner') {
    return HtmlService.createHtmlOutputFromFile('scanner_partial')
      .setTitle('QR Attendance Scanner')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');
  }

  // We use evaluate() to allow templating if needed, 
  // but vite-plugin-singlefile creates a static index.html which we output directly.
  // The file should be named Index.html in GAS.
  var html = HtmlService.createHtmlOutputFromFile('index')
    .setTitle('Attendance System')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
  return html;
}

function doPost(e) {
  try {
    const params = JSON.parse(e.postData.contents);
    const { action, employeeId, locationPayload } = params;

    if (action === 'processQR') {
      const result = processAttendanceByQR(employeeId, locationPayload);
      return ContentService.createTextOutput(JSON.stringify(result))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    if (action === 'getGeofence') {
      const result = getGeofenceSettingsPublic();
      return ContentService.createTextOutput(JSON.stringify(result))
        .setMimeType(ContentService.MimeType.JSON);
    }

    return ContentService.createTextOutput(JSON.stringify(errorResponse("Invalid action")))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify(errorResponse(err.message)))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// Fallback if needed to include parts
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}
