# 🚀 Deploy Instructions - Fix Blank Page

## The Problem
Your app shows a blank page with "Uncaught SyntaxError" because the build process didn't work correctly.

## The Solution
I've restored the working configuration. Just run these 3 commands:

```bash
# 1. Install dependencies
npm install

# 2. Build
npm run build

# 3. Deploy
clasp push
```

## That's It!

After `clasp push` completes, refresh your web app. It should work normally.

## What Was Fixed

- ✅ Restored `vite-plugin-singlefile` (reliable bundler for GAS)
- ✅ Restored simple `index.html` (no problematic preloading)
- ✅ Restored CSS import in `app.js`
- ✅ **Kept** backend optimizations (they're good!)

## What's Still Optimized

Your backend has these improvements:
- Server-side caching (`CacheService`)
- Split data loading functions ready to use
- Faster API responses

## Verify After Deploy

1. Open your web app URL
2. Login page should load ✅
3. Login as employee - dashboard should work ✅
4. Login as admin - all tabs should work ✅

## If You Still See Issues

Clear your browser cache:
- Chrome: Ctrl+Shift+Delete → Clear cached images and files
- Or open in Incognito/Private window

## Questions?

The configuration is now back to the working state from before the optimization attempt. The backend improvements are still there and working fine.

---

**TL;DR:** Run `npm install && npm run build && clasp push` and you're good to go! 🎉
