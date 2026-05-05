# Implementation Plan: Group Schedule Feature

## Overview

Implement the Group Schedule admin view, which aggregates monthly schedule data by group (position) and displays it as a calendar grid with colored dot indicators per shift. The implementation follows the same patterns as the existing `ScheduleManagement.js` component and `Schedule.gs` backend.

## Tasks

- [x] 1. Add `getGroupScheduleSummary` backend function to `backend/Schedule.gs`
  - [x] 1.1 Implement `getGroupScheduleSummary(token, year, month)` function
    - Verify the requesting user has Admin role using `verifyToken`
    - Call `ensureSchedulesSheet` to guarantee the sheet exists
    - Load schedules via `getCachedSchedules`, employees via `getCachedEmployees`, shifts via `getCachedShifts` (or direct sheet read fallback), and positions via `getCachedPositions` (or direct sheet read fallback)
    - Filter schedules to the requested `year` and `month`
    - Aggregate: for each schedule entry where `scheduleType === 'work'` and `shiftId` is non-empty, group by `(groupId, day)` and collect unique `shiftId` values
    - Assign colors to shifts using the deterministic palette `['#2fb344','#206bc4','#f76707','#d63939','#7c3aed','#0891b2','#db2777','#65a30d','#0d9488','#f59e0b']` — index into palette by shift array position, cycling with `index % palette.length`
    - Return `successResponse({ groups, shifts (with color), schedules (aggregated), year, month })`
    - Return `errorResponse` for auth failures or exceptions
    - _Requirements: 9.1, 9.2, 9.3, 10.1, 10.2, 10.3, 10.4_

  - [x] 1.2 Implement per-month caching for `getGroupScheduleSummary`
    - Define `CACHE_KEY_GROUP_SCHEDULE = 'group_schedule_'`
    - Before computing, check `CacheService.getScriptCache().get('group_schedule_' + year + '_' + month)`; if hit, parse and return cached data
    - After computing, store result with `CacheService.getScriptCache().put(cacheKey, JSON.stringify(data), 1800)` (30-minute TTL); wrap in try/catch to silently fail
    - _Requirements: 9.4_

  - [x] 1.3 Implement `invalidateGroupScheduleCache()` helper function
    - Iterate offsets `-1`, `0`, `+1` relative to the current month
    - Remove each `group_schedule_{year}_{month}` key from `CacheService.getScriptCache()`
    - Wrap in try/catch to silently fail
    - _Requirements: 9.5_

  - [x] 1.4 Add `invalidateGroupScheduleCache()` calls to existing write functions
    - In `saveBulkSchedule`: add `invalidateGroupScheduleCache()` immediately after the existing `invalidateSchedulesCache()` call
    - In `deleteScheduleEntry`: add `invalidateGroupScheduleCache()` immediately after the existing `invalidateSchedulesCache()` call
    - In `saveScheduleEntry`: add `invalidateGroupScheduleCache()` immediately after the existing `invalidateSchedulesCache()` call
    - _Requirements: 9.5_

- [x] 2. Create `GroupSchedule.js` frontend component in `src/frontend/components/`
  - [x] 2.1 Create the `GroupSchedule` class with constructor and state
    - Create `src/frontend/components/GroupSchedule.js`
    - Import `{ t }` from `'../i18n/i18n.js'`
    - Export `class GroupSchedule` with constructor accepting `(state, setState, callGas)`
    - Initialize instance properties: `this.year`, `this.month`, `this.filterGroup = ''`, `this.filterShift = ''`, `this.loading = false`, `this.groupScheduleData = null`
    - _Requirements: 1.3, 1.4_

  - [x] 2.2 Implement `loadData()` async method
    - Guard against concurrent calls with `if (this.loading) return`
    - Set `this.loading = true` and call `this._renderLoading()`
    - Call `this.callGas('getGroupScheduleSummary', this.state.token, this.year, this.month)`
    - On success: set `this.groupScheduleData = res.data`, set `this.loading = false`, call `this.render()`
    - On error: set `this.loading = false`, call `this._renderError(res?.message || this.t('groupSchedule.failedToLoad'))`
    - On exception: set `this.loading = false`, call `this._renderError(this.t('groupSchedule.connectionError'))`
    - _Requirements: 2.1, 7.1, 7.2_

  - [x] 2.3 Implement `render()` method — header and filter bar
    - Get container `document.getElementById('admin-view-group-schedule')`; return early if missing
    - If `this.groupScheduleData` is null, call `this.loadData()` and return
    - Destructure `{ groups, shifts, schedules }` from `this.groupScheduleData`
    - Render page header with pretitle (`adminPanel.management`) and title (`groupSchedule.groupSchedule`)
    - Render month navigation: previous-month button (`.js-gs-prev-month`), current month/year label (disabled button), next-month button (`.js-gs-next-month`) — use `t('employeeDashboard.months')[this.month - 1]`
    - Render filter card with group dropdown (`.js-gs-filter-group`) and shift dropdown (`.js-gs-filter-shift`), matching the layout of `ScheduleManagement.js`
    - _Requirements: 1.1, 1.2, 1.4, 6.1, 6.2, 6.3_

  - [x] 2.4 Implement `render()` method — calendar grid
    - Compute `daysInMonth = new Date(this.year, this.month, 0).getDate()` and build `days` array
    - Call `this._buildScheduleLookup(schedules)` to get `schedLookup` map keyed by `'groupId_day'`
    - Apply `this.filterGroup` to filter `groups` array
    - Render `<table>` with sticky header row: first `<th>` is the group name column (sticky, `z-index:3`), then one `<th>` per day showing day number and day-of-week abbreviation; highlight weekends with `table-warning`
    - For each filtered group, render a `<tr>`: first `<td>` is the sticky group name cell; for each day, render a `<td>` containing `<span>` dots for each shift in `schedLookup['groupId_day']`
    - Each dot: `class="rounded-circle d-inline-block"`, `style="width:12px; height:12px; background-color:{shift.color};"`, `title="{shiftId}: {start}–{end}"`, `aria-label="Shift {shiftId}"`
    - When `this.filterShift` is set and a cell does not contain that shift, add `opacity-25` to the `<td>`
    - If `filteredGroups.length === 0`, render a single colspan row with `t('groupSchedule.noGroupsFound')`
    - _Requirements: 1.3, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 4.3, 4.4, 6.2, 6.4, 7.3, 7.4, 8.1, 8.2, 8.3, 8.4_

  - [x] 2.5 Implement `render()` method — shift legend
    - After the grid card, render a legend card
    - For each shift in `shifts`, render a colored dot (same style as grid dots) followed by the formatted time range `"{start}–{end}"`
    - Use `t('groupSchedule.legend')` as the label
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

  - [x] 2.6 Implement `_attachListeners()`, `_renderLoading()`, `_renderError()`, and helper methods
    - `_attachListeners()`: attach click handlers to `.js-gs-prev-month` and `.js-gs-next-month` (decrement/increment `this.month`, wrap year, reset `this.groupScheduleData`, call `this.loadData()`); attach `change` handlers to `.js-gs-filter-group` and `.js-gs-filter-shift` (update filter properties, call `this.render()`)
    - `_renderLoading()`: render spinner with `t('groupSchedule.loading')` into `#admin-view-group-schedule`
    - `_renderError(msg)`: render alert with message and a retry button (`.js-gs-reload`) that calls `this.loadData()`; attach click listener
    - `_buildScheduleLookup(schedules)`: iterate schedules, build `{ 'groupId_day': shiftIds[] }` map
    - `_formatTime(str)`: extract `HH:mm` via regex, return empty string on falsy input — identical to `ScheduleManagement.js`
    - `escHtml(str)`: identical implementation to `ScheduleManagement.js`
    - `t(key)`: delegate to imported `t(key)`
    - _Requirements: 1.4, 6.5, 7.1, 7.2_

- [x] 3. Add navigation item and view container to `backend/admin_partial.html`
  - [x] 3.1 Add "Group Schedule" sidebar navigation item
    - In the Management submenu (`id="submenu-management-group"`), add a new `<div class="admin-sidebar-item admin-sidebar-subitem" data-view="group-schedule" id="nav-group-schedule">` immediately after the existing Monthly Schedule item (`id="nav-schedule"`)
    - Include the calendar SVG icon from the design document
    - Add `<span data-i18n="adminPanel.groupSchedule">Group Schedule</span>`
    - _Requirements: 1.1_

  - [x] 3.2 Add view container div
    - In the `<main class="admin-content">` section, add `<div id="admin-view-group-schedule" style="display: none;"><!-- Content will be rendered by the GroupSchedule component --></div>` immediately after the existing `#admin-view-schedule` div
    - _Requirements: 1.2_

- [x] 4. Add translation keys to `src/frontend/i18n/languages.js`
  - [x] 4.1 Add English `groupSchedule` translation object
    - In the `en` object, add a `groupSchedule` key with the following string values:
      `groupSchedule`, `group`, `filterByGroup`, `filterByShift`, `allGroups`, `allShifts`, `legend`, `loading`, `failedToLoad`, `connectionError`, `noGroupsFound`, `noSchedulesForMonth`
    - Use the English strings from the design document
    - _Requirements: 1.1, 1.2, 1.3, 6.1, 6.3, 7.1, 7.2, 7.3, 7.4_

  - [x] 4.2 Add `groupSchedule` key to the `adminPanel` object (English)
    - In `en.adminPanel`, add `groupSchedule: 'Group Schedule'`
    - _Requirements: 1.1_

  - [x] 4.3 Add Bahasa Indonesia `groupSchedule` translation object
    - In the `id` (or `in`) object, add a `groupSchedule` key with the Indonesian strings from the design document
    - _Requirements: 1.1, 1.2, 1.3, 6.1, 6.3, 7.1, 7.2, 7.3, 7.4_

  - [x] 4.4 Add `groupSchedule` key to the `adminPanel` object (Bahasa Indonesia)
    - In the `id`/`in` `adminPanel` object, add `groupSchedule: 'Jadwal Grup'`
    - _Requirements: 1.1_

- [x] 5. Register `GroupSchedule` component in `src/frontend/app.js`
  - [x] 5.1 Add `currentGroupScheduleComponent` to application state
    - In the `state` object (around the `currentScheduleComponent` entry), add `currentGroupScheduleComponent: null`
    - _Requirements: 1.2_

  - [x] 5.2 Add `'group-schedule'` to the admin views list and group mapping
    - In the `forEach` array on line ~856 that iterates `['dashboard', 'users', ..., 'schedule']`, append `'group-schedule'`
    - In the `viewToGroup` map, add `'group-schedule': 'management-group'`
    - _Requirements: 1.1, 1.2_

  - [x] 5.3 Implement `renderGroupScheduleView()` async function
    - Follow the exact same pattern as `renderScheduleView()`:
      - If `state.currentGroupScheduleComponent` exists, call `.render()` and return
      - Otherwise, dynamically import `GroupSchedule` from `'./components/GroupSchedule.js'`
      - Instantiate `new GroupSchedule(state, setState, callGas)`, assign to `state.currentGroupScheduleComponent`
      - Call `await component.loadData()`
      - Wrap in try/catch and log errors
    - _Requirements: 1.2, 2.1_

  - [x] 5.4 Wire `renderGroupScheduleView()` into the admin render loop
    - In `renderAdminView()`, after the line `if (state.adminView === 'schedule') renderScheduleView();`, add `if (state.adminView === 'group-schedule') renderGroupScheduleView();`
    - _Requirements: 1.2_

  - [x] 5.5 Add mock GAS fallback for `getGroupScheduleSummary` in the dev mock block
    - In the `callGas` mock `setTimeout` block, add an `else if (functionName === 'getGroupScheduleSummary')` branch
    - Resolve with `{ status: 'success', data: { groups: [], shifts: [], schedules: [], year: args[1] || new Date().getFullYear(), month: args[2] || (new Date().getMonth() + 1) } }`
    - _Requirements: 9.1_

  - [x] 5.6 Reset `currentGroupScheduleComponent` on logout
    - Find the logout/reset state block (around line ~2634 where `currentScheduleComponent: null` is set)
    - Add `currentGroupScheduleComponent: null` to the same reset object
    - _Requirements: 1.2_

- [x] 6. Final checkpoint — verify end-to-end integration
  - Ensure all files compile without errors (check imports, export names, and function signatures)
  - Verify the sidebar nav item appears in the Management group and activates the correct view
  - Verify the `getGroupScheduleSummary` function is reachable from the frontend via `callGas`
  - Verify cache invalidation is called in all three write paths (`saveBulkSchedule`, `deleteScheduleEntry`, `saveScheduleEntry`)
  - Ask the user if any questions arise before considering the feature complete

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- The design document explicitly states PBT is **not applicable** for this feature; no property test sub-tasks are included
- All code should follow the patterns established in `ScheduleManagement.js` and the existing `Schedule.gs` functions
- The `escHtml`, `_formatTime`, and `t` helper methods are identical to those in `ScheduleManagement.js` — copy them verbatim
- Color palette and aggregation algorithm are fully specified in the design document's Implementation Details section
- The `id` language key in `languages.js` should be verified against the actual key used in the file (may be `id` or `in`)
