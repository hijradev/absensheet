# IMMEDIATE FIX - Restore Working Version

## Problem
The deployed version has a blank page with "Uncaught SyntaxError" because:
1. The script tags reference `/app.js` which doesn't exist in GAS
2. The JavaScript wasn't properly inlined
3. There are duplicate script tags

## Quick Fix (Restore Original Working Version)

Run these commands in order:

```bash
# 1. Go back to the commit before the changes
git log --oneline -5
# Find the commit hash BEFORE the performance changes

# 2. Restore the original working files
git checkout <commit-hash> -- index.html src/frontend/app.js package.json vite.config.js

# 3. Reinstall original dependencies
rm -rf node_modules package-lock.json
npm install

# 4. Build with original setup
npm run build

# 5. Deploy
clasp push
```

## Alternative: Manual Restore

If git isn't available, manually restore these files:

### 1. Restore `index.html` - Remove the preload section, keep it simple:

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="description" content="Employee Attendance System — check in, check out, and manage attendance records.">
    <title>Employee Attendance</title>
</head>
<body>
    <!-- All your HTML content -->
    
    <script type="module" src="/src/frontend/app.js"></script>
</body>
</html>
```

### 2. Restore `package.json`:

```json
{
  "name": "gas-absensi-spa",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build && mkdir -p dist && cp backend/*.gs dist/ && cp appsscript.json dist/",
    "preview": "vite preview"
  },
  "devDependencies": {
    "vite": "^5.2.0",
    "vite-plugin-singlefile": "^2.0.1"
  },
  "dependencies": {
    "html5-qrcode": "^2.3.8",
    "@tabler/core": "1.0.0-beta20"
  }
}
```

### 3. Restore `vite.config.js`:

```javascript
import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

export default defineConfig({
  plugins: [viteSingleFile()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
```

### 4. Restore `src/frontend/app.js` - Add back the CSS import at the top:

```javascript
import { Html5QrcodeScanner } from 'html5-qrcode';
import './style.css';  // <-- ADD THIS LINE BACK

// Rest of the file...
```

### 5. Delete the new files:

```bash
rm build-post.js
rm src/frontend/app-new.js
```

### 6. Reinstall and rebuild:

```bash
npm install
npm run build
clasp push
```

## What to Keep

The **backend optimizations** in `backend/Admin.gs` are good and can stay:
- `getDashboardData()` - Fast dashboard loading
- `getAdminInitialData()` - Lazy management data loading

These functions work fine even with the old frontend (it still calls `getAdminAllData()` which is kept for compatibility).

## Lesson Learned

The frontend build optimization was too aggressive. The safer approach is:
1. Keep using `vite-plugin-singlefile` (it works reliably)
2. Focus on backend optimizations (already done ✅)
3. Optimize CSS loading separately (can be done later with proper testing)

## After Restore

Your app should work exactly as it did before, with the bonus of having the optimized backend functions available for future use.
