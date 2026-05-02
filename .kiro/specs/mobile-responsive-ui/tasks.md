# Implementation Plan: Mobile-Responsive UI

## Overview

Implement full mobile responsiveness for the attendance management app across four files: `src/frontend/style.css`, `backend/admin_partial.html`, `backend/employee_partial.html`, and `src/frontend/app.js`, plus minor JS component changes in `DailyAttendance.js` and `UserManagement.js`. The approach is CSS-first with minimal JS for stateful interactions (sidebar toggle, login tab switching).

## Tasks

- [x] 1. Append responsive CSS sections to `src/frontend/style.css`
  - [x] 1.1 Add Admin Sidebar — Mobile CSS section (≤767px)
    - Append a clearly delimited `/* ===== RESPONSIVE: Admin Sidebar — Mobile ===== */` block
    - `.admin-sidebar`: `position: fixed`, `top: 0`, `left: 0`, `height: 100vh`, `z-index: 1040`, `transform: translateX(-100%)`, `transition: transform 0.25s ease`, `overflow-y: auto`, `width: 250px`
    - `body.sidebar-open .admin-sidebar`: `transform: translateX(0)`
    - `.sidebar-overlay`: `display: none`, `position: fixed`, `inset: 0`, `background: rgba(0,0,0,0.45)`, `z-index: 1039`
    - `body.sidebar-open .sidebar-overlay`: `display: block`
    - `.admin-layout` on mobile: `flex-direction: column`
    - `.admin-content` on mobile: `padding: 1rem`, `width: 100%`
    - `.admin-sidebar-item` on mobile: `min-height: 48px`, `padding: 0.75rem 1.5rem`
    - `.admin-sidebar-group-header` on mobile: `min-height: 48px`
    - _Requirements: 4.2, 4.4, 4.5, 4.6, 9.3_

  - [x] 1.2 Add Admin Sidebar — Tablet CSS section (768px–1023px)
    - Append `/* ===== RESPONSIVE: Admin Sidebar — Tablet ===== */` block
    - `.admin-sidebar`: `width: 60px`, `overflow: hidden`, `transition: width 0.2s ease`, `flex-shrink: 0`
    - `.admin-sidebar:hover, .admin-sidebar:focus-within`: `width: 250px`
    - Hide text labels, chevrons, and submenu groups when sidebar is not hovered/focused
    - Center icons in rail mode (remove left/right padding, `justify-content: center`)
    - `.admin-content` on tablet: `padding: 1.25rem`
    - _Requirements: 4.7_

  - [x] 1.3 Add Admin Navbar — Mobile CSS section
    - Append `/* ===== RESPONSIVE: Admin Navbar — Mobile ===== */` block
    - `#btn-hamburger` at ≤767px: `display: inline-flex`
    - `.logout-btn-text` at ≤767px: `display: none`
    - `.glass-header` at ≤767px: `position: sticky`, `top: 0`, `z-index: 1030`
    - `#btn-hamburger` at ≥768px: `display: none`
    - _Requirements: 10.1, 10.2, 10.4_

  - [x] 1.4 Add Data Tables — Mobile CSS section
    - Append `/* ===== RESPONSIVE: Data Tables — Mobile ===== */` block
    - `.table-responsive`: `overflow-x: auto`, `-webkit-overflow-scrolling: touch` (applies at all widths)
    - At ≤767px: `.col-hide-mobile { display: none !important }`
    - At ≤767px: `.btn-action-text { display: none }`
    - At ≤767px: `.pagination .page-item.page-number { display: none }`
    - At ≤767px: `.table { font-size: 0.8125rem }`
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

  - [x] 1.5 Add Filter Bars — Mobile CSS section
    - Append `/* ===== RESPONSIVE: Filter Bars — Mobile ===== */` block
    - At ≤767px: `.filter-bar-row { flex-direction: column !important; align-items: stretch !important; gap: 0.75rem !important }`
    - At ≤767px: `.filter-bar-row > * { width: 100% !important }`
    - At ≤767px: `.filter-bar-row .form-select, .filter-bar-row .form-control, .filter-bar-row input[type="date"] { width: 100% !important; min-width: unset !important }`
    - At ≤767px: `.export-btn-text { display: none }`
    - _Requirements: 7.2, 7.3, 7.4_

  - [x] 1.6 Add Modals — Bottom Sheet CSS section
    - Append `/* ===== RESPONSIVE: Modals — Bottom Sheet ===== */` block
    - At ≤767px: `.modal-overlay { align-items: flex-end; padding: 0 }`
    - At ≤767px: `.modal-overlay .modal-dialog { width: 100%; max-width: 100%; margin: 0; border-radius: 16px 16px 0 0; overflow: hidden }`
    - At ≤767px: `.modal-overlay .modal-content { border-radius: 16px 16px 0 0; max-height: 90vh; overflow-y: auto }`
    - At ≤767px: `.modal-body .row > [class*="col-"] { flex: 0 0 100%; max-width: 100% }`
    - _Requirements: 8.1, 8.2, 8.3_

  - [x] 1.7 Add Touch Targets — Mobile CSS section
    - Append `/* ===== RESPONSIVE: Touch Targets — Mobile ===== */` block
    - At ≤767px: `.btn { min-height: 44px; min-width: 44px }`
    - At ≤767px: `.form-control, .form-select { min-height: 44px; font-size: 16px }`
    - At ≤767px: `.page-link { min-height: 44px; min-width: 44px; display: flex; align-items: center; justify-content: center }`
    - _Requirements: 9.1, 9.2, 9.4_

  - [x] 1.8 Add Employee Dashboard — Mobile CSS section
    - Append `/* ===== RESPONSIVE: Employee Dashboard — Mobile ===== */` block
    - At ≤767px: `#btn-checkin, #btn-checkout { min-height: 52px; flex: 1 }`
    - At ≤767px: `#view-employee .navbar .navbar-nav { flex-wrap: nowrap; overflow: hidden }`
    - _Requirements: 3.3, 3.5_

- [x] 2. Update `backend/admin_partial.html` — Navbar and sidebar structure
  - [x] 2.1 Add hamburger button and restructure logout button in the admin navbar
    - In the `<header>` navbar's `<div class="container-fluid px-3">`, add `#btn-hamburger` as the first child (before `<h1 class="navbar-brand">`):
      ```html
      <button id="btn-hamburger" class="btn btn-ghost-secondary d-lg-none me-2"
              aria-label="Toggle navigation" aria-expanded="false" aria-controls="admin-sidebar">
        <svg ...hamburger icon (3 horizontal lines)...></svg>
      </button>
      ```
    - Replace the plain text logout button with an icon + text version:
      ```html
      <button class="btn btn-outline-danger logout-btn">
        <svg ...logout/door icon...></svg>
        <span class="logout-btn-text d-none d-lg-inline" data-i18n="common.logout">Logout</span>
      </button>
      ```
    - Add `id="admin-sidebar"` attribute to `<aside class="admin-sidebar">`
    - _Requirements: 4.3, 10.1, 10.2, 10.3_

  - [x] 2.2 Add sidebar overlay div to `.admin-layout`
    - Insert `<div class="sidebar-overlay" id="sidebar-overlay" aria-hidden="true"></div>` as the first child of `<div class="admin-layout">` (before `<aside>`)
    - _Requirements: 4.4, 4.5_

  - [x] 2.3 Add `filter-bar-row` class to filter bar wrapper divs
    - In the Daily Attendance view (`#admin-view-attendance`): add class `filter-bar-row` to the `<div class="d-flex align-items-center gap-2 flex-wrap">` that wraps the date inputs, load button, and export buttons
    - In the Manual Attendance view (`#admin-view-manual-attendance`, if present): add `filter-bar-row` to its filter wrapper div
    - In the Activity Logs view (`#admin-view-logs`, if present): add `filter-bar-row` to its filter wrapper div
    - Add class `export-btn-text` to the text `<span>` inside each export/print button (CSV, Excel, Print) in the Daily Attendance filter bar
    - _Requirements: 7.2, 7.3, 7.4_

  - [x] 2.4 Add `col-hide-mobile` class to low-priority table columns
    - In the Daily Attendance table (`#admin-attendance-table`): add `col-hide-mobile` to the `<th>` and corresponding `<td>` elements for the "Group" and "Shift" columns
    - In the User Management table (`#admin-users-table`): add `col-hide-mobile` to the `<th>` for the "ID" column (the `<td>` cells are rendered by JS in `UserManagement.js` — note this for task 6)
    - _Requirements: 6.2_

- [x] 3. Update `backend/employee_partial.html` — Logout button icon
  - Restructure the logout button to include an SVG icon and a text span:
    ```html
    <button class="btn btn-outline-danger logout-btn">
      <svg ...logout/door icon...></svg>
      <span class="logout-btn-text d-none d-lg-inline" data-i18n="common.logout">Logout</span>
    </button>
    ```
  - _Requirements: 3.5, 10.2_

- [x] 4. Add `initAdminSidebar()` to `src/frontend/app.js`
  - [x] 4.1 Implement the `initAdminSidebar()` function
    - Define `function initAdminSidebar()` in `app.js`
    - Get references to `#btn-hamburger`, `#sidebar-overlay`, and `.admin-sidebar`
    - Implement `openSidebar()`: adds `sidebar-open` class to `document.body`, sets `aria-expanded="true"` on hamburger
    - Implement `closeSidebar()`: removes `sidebar-open` class from `document.body`, sets `aria-expanded="false"` on hamburger
    - Attach click listener to hamburger: toggle open/close based on current state
    - Attach click listener to overlay: call `closeSidebar()`
    - Attach click listeners to all `.admin-sidebar-item` and `.admin-sidebar-group-header` elements: call `closeSidebar()` when `window.innerWidth <= 767`
    - _Requirements: 4.3, 4.4, 4.5, 4.6_

  - [x] 4.2 Call `initAdminSidebar()` after admin partial injection
    - In the `loadView` function, after the admin partial HTML is injected and `render()` is called, add a call to `initAdminSidebar()`
    - Ensure the call is placed after the DOM is updated (after `contentDiv.innerHTML = html` and script re-execution)
    - _Requirements: 4.3, 4.4_

- [x] 5. Add `initLoginTabs()` to `src/frontend/app.js`
  - [x] 5.1 Implement the `initLoginTabs()` function
    - Define `function initLoginTabs()` in `app.js`
    - Query all `.login-tab-btn` elements, `#login-panel-form`, and `#login-panel-scanner`
    - Return early if no tab buttons are found (guard for non-mobile or missing DOM)
    - For each tab button, attach a click listener that:
      - Removes `active` class from all tab buttons, adds `active` to the clicked button
      - If `btn.dataset.tab === 'scanner'`: adds `hidden` class to form panel, adds `active` class to scanner panel
      - If `btn.dataset.tab === 'form'`: removes `hidden` from form panel, removes `active` from scanner panel, calls `stopLoginScanner()` if it exists
    - _Requirements: 2.4, 2.5_

  - [x] 5.2 Call `initLoginTabs()` after login partial injection
    - In the `loadView` function, in the `viewName === 'login'` branch (alongside the existing `setTimeout(startLoginScanner, 300)` call), add a call to `initLoginTabs()`
    - _Requirements: 2.4, 2.5_

- [x] 6. Update ApexCharts responsive breakpoints in `src/frontend/app.js`
  - In the `renderDashboardCharts()` function, update `pieOptions.responsive` to:
    ```javascript
    responsive: [
      { breakpoint: 768, options: { chart: { height: 280 }, legend: { position: 'bottom' } } },
      { breakpoint: 480, options: { chart: { height: 240, width: '100%' }, legend: { position: 'bottom', fontSize: '11px' } } }
    ]
    ```
  - Update `barOptions.responsive` to:
    ```javascript
    responsive: [
      { breakpoint: 768, options: { chart: { height: 280 }, xaxis: { labels: { rotate: -45, style: { fontSize: '10px' } } } } },
      { breakpoint: 480, options: { chart: { height: 240 }, xaxis: { labels: { rotate: -45, style: { fontSize: '9px' } } }, dataLabels: { enabled: false } } }
    ]
    ```
  - _Requirements: 5.3, 5.5_

- [x] 7. Checkpoint — Verify CSS and HTML changes render correctly
  - Ensure all tests pass, ask the user if questions arise.
  - Manually verify (or via automated test) that the sidebar overlay div is present in the admin partial, the hamburger button is present, and the CSS sections are appended to `style.css`

- [x] 8. Add `page-number` class to pagination items in `DailyAttendance.js`
  - In `src/frontend/components/DailyAttendance.js`, update the `paginationBtn()` method to add class `page-number` to the `<li>` element for page number buttons (not prev/next):
    ```javascript
    paginationBtn(pageNum, currentPage, label) {
        const active = pageNum === currentPage ? 'active' : '';
        return `<li class="page-item page-number ${active}">
            <button class="page-link js-att-page" data-page="${pageNum}">${label}</button>
        </li>`;
    }
    ```
  - Also add `page-number` class to the first-page and last-page `<li>` elements rendered directly in `renderPagination()` (the ellipsis boundary items)
  - _Requirements: 6.4_

  - [ ]* 8.1 Write unit tests for DailyAttendance pagination class
    - Test that `paginationBtn()` output includes `page-number` class on the `<li>` element
    - Test that prev/next `<li>` elements do NOT have `page-number` class
    - _Requirements: 6.4_

- [x] 9. Add `page-number` class to pagination items in `UserManagement.js`
  - In `src/frontend/components/UserManagement.js`, update the `renderPagination()` method to add class `page-number` to all page number `<li>` elements (the loop from `startPage` to `endPage`, plus the first-page and last-page boundary items):
    ```javascript
    // Change:
    <li class="page-item ${i === this.currentPage ? 'active' : ''}">
    // To:
    <li class="page-item page-number ${i === this.currentPage ? 'active' : ''}">
    ```
  - Apply the same `page-number` class to the boundary page items (page 1 and page `totalPages` rendered outside the main loop)
  - _Requirements: 6.4_

  - [ ]* 9.1 Write unit tests for UserManagement pagination class
    - Test that page number `<li>` elements include `page-number` class
    - Test that prev/next `<li>` elements do NOT have `page-number` class
    - _Requirements: 6.4_

- [x] 10. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.
  - Verify the complete feature by checking: sidebar toggle works on mobile viewport, login tabs switch correctly, pagination hides page numbers on mobile, filter bars stack vertically, modals appear as bottom sheets, touch targets meet 44px minimum

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- The design is CSS-first: all layout changes are driven by media queries; JS only handles stateful interactions
- `login_partial.html` requires no HTML changes — the tab structure is already correct
- `index.html` requires no changes — the viewport meta tag is already present
- The `col-hide-mobile` class on `<td>` cells in the Daily Attendance table is applied by `DailyAttendance.js` when it renders rows — the `<th>` headers in `admin_partial.html` need the class added, and the JS render method in `DailyAttendance.js` must also add it to the corresponding `<td>` cells
- ApexCharts responsive breakpoints are configured in JS options, not CSS
- Each task references specific requirements for traceability
