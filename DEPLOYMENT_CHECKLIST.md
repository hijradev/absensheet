# Deployment Checklist

## Pre-Deployment

- [ ] Read `README_PERFORMANCE.md` for overview
- [ ] Review changes in `IMPLEMENTATION_SUMMARY.md`
- [ ] Backup current deployment (optional but recommended)

## Build & Deploy

```bash
# Step 1: Install dependencies
npm install
```
- [ ] No errors during install
- [ ] `vite-plugin-singlefile` removed from `node_modules/`

```bash
# Step 2: Build
npm run build
```
- [ ] Build completes without errors
- [ ] See output: "✓ Inlined style.css", "✓ Inlined app.js"
- [ ] See output: "✓ Copied backend/*.gs"
- [ ] See output: "✓ Copied appsscript.json"

```bash
# Step 3: Verify dist/
ls -lh dist/
```
- [ ] `dist/index.html` exists (~XXX KB)
- [ ] `dist/Auth.gs` exists
- [ ] `dist/Code.gs` exists
- [ ] `dist/Absensi.gs` exists
- [ ] `dist/Admin.gs` exists
- [ ] `dist/Helper.gs` exists
- [ ] `dist/Setup.gs` exists
- [ ] `dist/SeedData.gs` exists
- [ ] `dist/appsscript.json` exists
- [ ] NO `dist/app.js` (should be inlined)
- [ ] NO `dist/style.css` (should be inlined)

```bash
# Step 4: Deploy
clasp push
```
- [ ] Push completes without errors
- [ ] All files uploaded successfully

## Post-Deployment Testing

### Login & Authentication
- [ ] Login page loads
- [ ] Can login as employee
- [ ] Can login as admin
- [ ] Logout works

### Employee Dashboard
- [ ] Dashboard loads
- [ ] Shows employee name
- [ ] Check-in button works
- [ ] Check-out button works
- [ ] QR scanner opens/closes
- [ ] Attendance history table loads
- [ ] History shows recent records

### Admin Dashboard
- [ ] Dashboard loads **quickly** (should feel faster)
- [ ] Stats cards show numbers (On Time, Late, Absent, Overtime)
- [ ] Monthly recap table loads
- [ ] Sidebar navigation works

### Admin - User Management
- [ ] Click "User Management" tab
- [ ] Users table loads
- [ ] "Add New User" button opens form
- [ ] Can edit existing user
- [ ] Can delete user (with confirmation)
- [ ] Photo upload works

### Admin - Shift Management
- [ ] Click "Shift Management" tab
- [ ] Shifts table loads
- [ ] "Add New Shift" button opens form
- [ ] Can edit existing shift
- [ ] Can delete shift

### Admin - Position Management
- [ ] Click "Position (Jabatan) Management" tab
- [ ] Positions table loads
- [ ] "Add New Position" button opens form
- [ ] Can edit existing position
- [ ] Can delete position

### Admin - Daily Attendance
- [ ] Click "Daily Attendance" tab
- [ ] Date picker shows today's date
- [ ] Summary cards show stats
- [ ] Attendance table loads
- [ ] Filter by status works
- [ ] Search by employee works
- [ ] Pagination works
- [ ] "Export CSV" button works

### Admin - Activity Logs
- [ ] Click "Activity Logs" tab
- [ ] Logs table loads
- [ ] Shows recent activity

## Performance Verification

Open Browser DevTools (F12) → Network tab:

- [ ] Initial page load feels faster
- [ ] Admin dashboard loads in < 500ms
- [ ] See separate API calls: `getDashboardData`, `getAdminInitialData` (if frontend updated)
- [ ] No console errors

## Rollback (If Needed)

If anything is broken:

```bash
git checkout HEAD -- index.html vite.config.js package.json backend/Admin.gs
npm install
npm run build
clasp push
```

- [ ] Rollback completed
- [ ] Old version deployed
- [ ] Everything works again

## Success Criteria

✅ All tests pass
✅ Page loads faster than before
✅ No console errors
✅ All features work as expected

## Notes

- The backend is backward-compatible (old `getAdminAllData()` still exists)
- Frontend can be optionally updated later for even better performance
- See `QUICK_START.md` for frontend update guide

---

**Date Deployed**: _______________
**Deployed By**: _______________
**Status**: ⬜ Success  ⬜ Rollback  ⬜ Pending
