# Weekly Attendance Stats Update

## Summary
Updated the dashboard's "Attendance Status Distribution" chart to display **weekly data** instead of daily data.

## Changes Made

### Backend Changes (`backend/Admin.gs`)

#### 1. Updated `getDashboardData()` function
- **Before**: Filtered attendance data by today's date (`todayStr`)
- **After**: Filters attendance data by current week (Monday to Sunday)
- **Logic**: 
  - Calculates the start of the week (Monday) and end of the week (Sunday)
  - Filters all attendance records within this date range
  - Aggregates stats for the entire week

#### 2. Updated `getAdminAllData()` function
- Applied the same weekly filtering logic for backward compatibility
- This function is deprecated but still used during migration

### Frontend Changes

#### 1. Updated `src/frontend/components/AdminDashboard.js`
- Changed pie chart donut label from `"Total Today"` to `"Total This Week"`
- This reflects the new weekly aggregation in the UI

#### 2. Updated `src/frontend/app.js`
- Changed pie chart donut label from `"Total Today"` to `"Total This Week"`
- Ensures consistency across all dashboard views

## Week Calculation Logic

The week is calculated as **Monday to Sunday**:
- If today is Sunday (day 0), go back 6 days to get Monday
- Otherwise, calculate offset to get to Monday (1 - dayOfWeek)
- Week ends on Sunday (6 days after Monday)

```javascript
const dayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
const weekStart = new Date(now);
weekStart.setDate(now.getDate() + mondayOffset);

const weekEnd = new Date(weekStart);
weekEnd.setDate(weekStart.getDate() + 6); // Sunday
```

## Impact

### What Changed
- Dashboard pie chart now shows attendance distribution for the **current week** (Monday-Sunday)
- Stats cards (On Time, Late, Absent, Overtime) now reflect **weekly totals**

### What Stayed the Same
- Monthly recap table remains unchanged
- Bar chart showing top 10 performance remains unchanged
- All other dashboard functionality remains the same

## Testing Recommendations

1. **Verify Weekly Range**: Check that the stats update correctly on different days of the week
2. **Week Boundaries**: Test on Sunday and Monday to ensure week calculation is correct
3. **Data Accuracy**: Compare weekly totals with actual attendance records
4. **UI Display**: Confirm the "Total This Week" label displays correctly in the pie chart

## Deployment

After making these changes:
1. Run the build process: `npm run build` or `./build.sh`
2. Deploy to Google Apps Script using clasp: `clasp push`
3. Test the dashboard to verify weekly stats are displaying correctly
