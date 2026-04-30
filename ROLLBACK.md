# Quick Rollback Instructions

## The Issue

After the optimization, you're seeing a blank page because the JavaScript wasn't inlined into the HTML during the build process.

## Immediate Fix (Rollback to Working Version)

```bash
# 1. Restore original files
git checkout HEAD~1 -- index.html vite.config.js package.json src/frontend/app.js

# 2. Reinstall dependencies
npm install

# 3. Build
npm run build

# 4. Deploy
clasp push
```

## Alternative: Keep Backend Optimizations Only

If you want to keep the backend improvements (split data loading) but revert the frontend build changes:

```bash
# 1. Restore only frontend build files
git checkout HEAD~1 -- index.html vite.config.js package.json

# 2. Keep the backend changes
# (backend/Admin.gs already has the optimized functions)

# 3. Reinstall dependencies
npm install

# 4. Build
npm run build

# 5. Deploy
clasp push
```

This way you get:
- ✅ Backend split data loading (getDashboardData + getAdminInitialData)
- ✅ Server-side caching (already had it)
- ❌ CSS preloading (reverted)
- ❌ Build process optimization (reverted)

## Root Cause

The vite.config.js wasn't properly configured to:
1. Process the index.html as an entry point
2. Build the app.js and style.css files
3. Allow the post-build script to inline them

## Proper Fix (For Later)

The correct approach requires:

1. **Ensure Vite processes index.html**:
```javascript
// vite.config.js
import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html')
      }
    }
  }
});
```

2. **Test the build locally**:
```bash
npm run build
ls -lh dist/  # Should see app.js and style.css
```

3. **Verify post-build script runs**:
```bash
node build-post.js
# Should see: "✓ Inlined app.js", "✓ Inlined style.css"
```

4. **Check final HTML**:
```bash
grep "<script>" dist/index.html  # Should find inlined script
```

## Status

For now, **rollback to the working version** using the commands above. The backend optimizations (split data loading) are still valuable and can be kept.

The frontend build optimizations can be attempted again later with proper testing in a development environment first.
