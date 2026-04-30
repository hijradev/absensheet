// Code.gs
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
