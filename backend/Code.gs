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
function doGet(e) {
  // We use evaluate() to allow templating if needed, 
  // but vite-plugin-singlefile creates a static index.html which we output directly.
  // The file should be named Index.html in GAS.
  var html = HtmlService.createHtmlOutputFromFile('index')
    .setTitle('Attendance System')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
  return html;
}

// Fallback if needed to include parts
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}
