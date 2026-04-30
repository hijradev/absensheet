/**
 * build-post.js
 *
 * Post-build step for Google Apps Script deployment.
 *
 * Vite outputs dist/index.html referencing dist/app.js and dist/style.css.
 * GAS requires a single self-contained HTML file (no external relative assets).
 * This script inlines the built JS and CSS directly into index.html, then
 * copies backend .gs files and appsscript.json into dist/.
 *
 * Result: dist/index.html is fully self-contained and ready to push via clasp.
 */

import fs from 'fs';
import path from 'path';

const DIST = './dist';

// --- Inline JS and CSS into index.html ---
let html = fs.readFileSync(path.join(DIST, 'index.html'), 'utf8');

// Inline CSS: replace <link rel="stylesheet" href="/style.css"> with <style>...</style>
const cssPath = path.join(DIST, 'style.css');
if (fs.existsSync(cssPath)) {
  const css = fs.readFileSync(cssPath, 'utf8');
  html = html.replace(
    /<link[^>]+href="[./]*style\.css"[^>]*>/,
    `<style>${css}</style>`
  );
  fs.unlinkSync(cssPath);
  console.log('  ✓ Inlined style.css');
}

// Inline JS: replace <script type="module" src="/app.js"></script> with <script>...</script>
const jsPath = path.join(DIST, 'app.js');
if (fs.existsSync(jsPath)) {
  const js = fs.readFileSync(jsPath, 'utf8');
  html = html.replace(
    /<script[^>]+src="[./]*app\.js"[^>]*><\/script>/,
    `<script>${js}</script>`
  );
  fs.unlinkSync(jsPath);
  console.log('  ✓ Inlined app.js');
}

fs.writeFileSync(path.join(DIST, 'index.html'), html);
console.log('  ✓ Wrote dist/index.html');

// --- Copy backend .gs files and appsscript.json ---
const backendFiles = fs.readdirSync('./backend').filter(f => f.endsWith('.gs'));
backendFiles.forEach(file => {
  fs.copyFileSync(path.join('./backend', file), path.join(DIST, file));
  console.log(`  ✓ Copied backend/${file}`);
});

fs.copyFileSync('./appsscript.json', path.join(DIST, 'appsscript.json'));
console.log('  ✓ Copied appsscript.json');

console.log(`\nBuild complete. ${backendFiles.length + 2} files in dist/`);
