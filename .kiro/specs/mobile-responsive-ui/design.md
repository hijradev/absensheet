# Design Document: Mobile-Responsive UI

## Overview

This design covers the full-stack responsive refactor of the Google Apps Script attendance management web app. The app currently has a desktop-first layout with a fixed 250px sidebar, wide data tables, and multi-column filter bars that break on small screens. The goal is to make every view — login, employee dashboard, and admin panel — fully usable on phones (≤767px) and tablets (768–1023px) without changing any backend logic.

The work spans four files that need changes:
- `index.html` — add viewport meta tag (already present, verify content)
- `src/frontend/style.css` — all new responsive CSS rules
- `backend/admin_partial.html` — hamburger button, sidebar overlay, navbar restructure
- `backend/employee_partial.html` — minor navbar adjustments
- `backend/login_partial.html` — tab switching JS hook (HTML already correct)
- `src/frontend/app.js` — hamburger toggle logic, sidebar auto-close, login tab switching

JS components (`AdminDashboard.js`, `DailyAttendance.js`, `UserManagement.js`, etc.) need minor changes for compact pagination and icon-only action buttons on mobile.

---

## Architecture

The responsive strategy follows a **CSS-first, JS-assisted** approach:

1. **CSS media queries** handle all layout changes (sidebar collapse, card stacking, column hiding, modal bottom-sheet positioning, touch target sizing).
2. **JS** handles only stateful interactions that CSS cannot express: hamburger toggle, sidebar overlay, login tab switching, and sidebar auto-close on nav item click.
3. **No new dependencies** are introduced. Tabler/Bootstrap breakpoints are reused where possible; custom breakpoints are added only where Tabler's grid doesn't cover the need.

### Breakpoint System

| Name | Range | CSS Variable |
|------|-------|-------------|
| Mobile | ≤767px | `@media (max-width: 767px)` |
| Tablet | 768px–1023px | `@media (min-width: 768px) and (max-width: 1023px)` |
| Desktop | ≥1024px | `@media (min-width: 1024px)` (default, no query needed) |

These align with Tabler's `md` breakpoint (768px) and add a custom tablet upper bound at 1023px.

### State Model for Sidebar

```
Sidebar states (mobile):
  HIDDEN   — translateX(-100%), overlay absent
  OPEN     — translateX(0),     overlay visible

Sidebar states (tablet):
  RAIL     — width: 60px, text labels hidden, icons only
  EXPANDED — width: 250px on hover/focus

Sidebar states (desktop):
  FULL     — width: 250px, always visible
```

The sidebar state is managed by toggling a CSS class (`sidebar-open`) on the `<body>` element. This keeps the JS minimal and lets CSS handle all visual transitions.

---

## Components and Interfaces

### Component Diagram

```
index.html
  └── #app-content (dynamic injection target)
        ├── login_partial.html
        │     ├── .login-tabs (mobile tab bar)
        │     ├── .login-panel-form
        │     └── .login-panel-scanner
        ├── employee_partial.html
        │     ├── .navbar (glass-header)
        │     └── .page-wrapper > .container-xl
        │           ├── .col-md-6 (check-in card)
        │           └── .col-md-6 (history card)
        └── admin_partial.html
              ├── .navbar (glass-header)
              │     ├── #btn-hamburger (NEW, mobile only)
              │     ├── .navbar-brand (org name)
              │     └── .logout-btn (icon-only on mobile)
              ├── .sidebar-overlay (NEW, mobile only)
              └── .admin-layout
                    ├── .admin-sidebar (slide-in on mobile, rail on tablet)
                    └── .admin-content
```

### New HTML Elements

**`#btn-hamburger`** — Added to admin navbar, visible only on mobile:
```html
<button id="btn-hamburger" class="btn btn-ghost-secondary d-lg-none me-2" 
        aria-label="Toggle navigation" aria-expanded="false" aria-controls="admin-sidebar">
  <!-- hamburger SVG icon -->
</button>
```

**`.sidebar-overlay`** — Added as sibling of `.admin-layout`, hidden by default:
```html
<div class="sidebar-overlay" id="sidebar-overlay" aria-hidden="true"></div>
```

**`.logout-icon-only`** — Span wrapping logout button text, hidden on mobile:
```html
<button class="btn btn-outline-danger logout-btn">
  <!-- logout SVG icon (always visible) -->
  <span class="logout-btn-text d-none d-lg-inline" data-i18n="common.logout">Logout</span>
</button>
```

### JS Interface: Sidebar Toggle

```javascript
// In app.js — initAdminSidebar()
function initAdminSidebar() {
  const hamburger = document.getElementById('btn-hamburger');
  const overlay   = document.getElementById('sidebar-overlay');
  const sidebar   = document.querySelector('.admin-sidebar');

  function openSidebar() {
    document.body.classList.add('sidebar-open');
    hamburger?.setAttribute('aria-expanded', 'true');
  }

  function closeSidebar() {
    document.body.classList.remove('sidebar-open');
    hamburger?.setAttribute('aria-expanded', 'false');
  }

  hamburger?.addEventListener('click', () => {
    document.body.classList.contains('sidebar-open') ? closeSidebar() : openSidebar();
  });

  overlay?.addEventListener('click', closeSidebar);

  // Auto-close on nav item click (mobile)
  sidebar?.querySelectorAll('.admin-sidebar-item, .admin-sidebar-group-header').forEach(item => {
    item.addEventListener('click', () => {
      if (window.innerWidth <= 767) closeSidebar();
    });
  });
}
```

### JS Interface: Login Tab Switching

```javascript
// In app.js — initLoginTabs()
function initLoginTabs() {
  const tabBtns   = document.querySelectorAll('.login-tab-btn');
  const formPanel = document.getElementById('login-panel-form');
  const scanPanel = document.getElementById('login-panel-scanner');
  if (!tabBtns.length || !formPanel || !scanPanel) return;

  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      tabBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const tab = btn.dataset.tab;
      if (tab === 'scanner') {
        formPanel.classList.add('hidden');
        scanPanel.classList.add('active');
      } else {
        formPanel.classList.remove('hidden');
        scanPanel.classList.remove('active');
      }
    });
  });
}
```

---

## Data Models

No new data models are introduced. This feature is purely presentational. The existing `state` object in `app.js` gains one new boolean field:

```javascript
// Added to state object in app.js
sidebarOpen: false,  // tracks sidebar open/closed state (mobile)
```

This field is not strictly required since the sidebar state is managed via a CSS class on `<body>`, but it can be useful for debugging and for future state serialization.

---

## CSS Architecture

### File: `src/frontend/style.css`

All new rules are appended in a clearly delimited section at the end of the file. Existing rules are not modified except where noted.

#### Section 1: Admin Sidebar — Mobile (≤767px)

```css
/* ===== RESPONSIVE: Admin Sidebar — Mobile ===== */
@media (max-width: 767px) {
  /* Sidebar slides off-screen by default */
  .admin-sidebar {
    position: fixed;
    top: 0;
    left: 0;
    height: 100vh;
    z-index: 1040;
    transform: translateX(-100%);
    transition: transform 0.25s ease;
    overflow-y: auto;
    width: 250px;
  }

  /* Sidebar open state — triggered by body.sidebar-open */
  body.sidebar-open .admin-sidebar {
    transform: translateX(0);
  }

  /* Overlay */
  .sidebar-overlay {
    display: none;
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.45);
    z-index: 1039;
  }

  body.sidebar-open .sidebar-overlay {
    display: block;
  }

  /* Admin layout: full width on mobile */
  .admin-layout {
    flex-direction: column;
  }

  .admin-content {
    padding: 1rem;
    width: 100%;
  }

  /* Navbar: hamburger on left, icon-only logout on right */
  .admin-navbar-brand {
    flex: 1;
    text-align: center;
  }

  /* Touch targets: sidebar nav items */
  .admin-sidebar-item {
    min-height: 48px;
    padding: 0.75rem 1.5rem;
  }

  .admin-sidebar-group-header {
    min-height: 48px;
  }
}
```

#### Section 2: Admin Sidebar — Tablet (768px–1023px)

```css
/* ===== RESPONSIVE: Admin Sidebar — Tablet ===== */
@media (min-width: 768px) and (max-width: 1023px) {
  .admin-sidebar {
    width: 60px;
    overflow: hidden;
    transition: width 0.2s ease;
    flex-shrink: 0;
  }

  .admin-sidebar:hover,
  .admin-sidebar:focus-within {
    width: 250px;
  }

  /* Hide text labels in rail mode */
  .admin-sidebar:not(:hover):not(:focus-within) .admin-sidebar-item span,
  .admin-sidebar:not(:hover):not(:focus-within) .admin-sidebar-group-label span,
  .admin-sidebar:not(:hover):not(:focus-within) .admin-sidebar-chevron,
  .admin-sidebar:not(:hover):not(:focus-within) .admin-sidebar-subitem span {
    display: none;
  }

  /* Center icons in rail mode */
  .admin-sidebar:not(:hover):not(:focus-within) .admin-sidebar-item,
  .admin-sidebar:not(:hover):not(:focus-within) .admin-sidebar-group-header {
    justify-content: center;
    padding-left: 0;
    padding-right: 0;
  }

  /* Hide submenu groups in rail mode */
  .admin-sidebar:not(:hover):not(:focus-within) .admin-sidebar-submenu {
    display: none;
  }

  .admin-content {
    padding: 1.25rem;
  }
}
```

#### Section 3: Admin Navbar — Mobile

```css
/* ===== RESPONSIVE: Admin Navbar — Mobile ===== */
@media (max-width: 767px) {
  /* Hamburger button — visible only on mobile */
  #btn-hamburger {
    display: inline-flex;
  }

  /* Logout text hidden on mobile */
  .logout-btn-text {
    display: none;
  }

  /* Navbar fixed at top */
  .glass-header {
    position: sticky;
    top: 0;
    z-index: 1030;
  }
}

@media (min-width: 768px) {
  #btn-hamburger {
    display: none;
  }
}
```

#### Section 4: Data Tables — Mobile

```css
/* ===== RESPONSIVE: Data Tables — Mobile ===== */

/* Ensure all table wrappers scroll horizontally */
.table-responsive {
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}

@media (max-width: 767px) {
  /* Hide low-priority columns */
  .col-hide-mobile {
    display: none !important;
  }

  /* Action button text hidden on mobile */
  .btn-action-text {
    display: none;
  }

  /* Compact pagination: hide page number buttons */
  .pagination .page-item.page-number {
    display: none;
  }

  /* Table font size reduction for readability */
  .table {
    font-size: 0.8125rem;
  }
}
```

#### Section 5: Filter Bars — Mobile

```css
/* ===== RESPONSIVE: Filter Bars — Mobile ===== */
@media (max-width: 767px) {
  /* Stack all filter bar children vertically */
  .filter-bar-row {
    flex-direction: column !important;
    align-items: stretch !important;
    gap: 0.75rem !important;
  }

  .filter-bar-row > * {
    width: 100% !important;
  }

  .filter-bar-row .form-select,
  .filter-bar-row .form-control,
  .filter-bar-row input[type="date"] {
    width: 100% !important;
    min-width: unset !important;
  }

  /* Export button text hidden on mobile */
  .export-btn-text {
    display: none;
  }
}
```

#### Section 6: Modals — Bottom Sheet on Mobile

```css
/* ===== RESPONSIVE: Modals — Bottom Sheet ===== */
@media (max-width: 767px) {
  .modal-overlay {
    align-items: flex-end;
    padding: 0;
  }

  .modal-overlay .modal-dialog {
    width: 100%;
    max-width: 100%;
    margin: 0;
    border-radius: 16px 16px 0 0;
    overflow: hidden;
  }

  .modal-overlay .modal-content {
    border-radius: 16px 16px 0 0;
    max-height: 90vh;
    overflow-y: auto;
  }

  /* Stack multi-column form rows */
  .modal-body .row > [class*="col-"] {
    flex: 0 0 100%;
    max-width: 100%;
  }
}
```

#### Section 7: Touch Targets — Mobile

```css
/* ===== RESPONSIVE: Touch Targets — Mobile ===== */
@media (max-width: 767px) {
  /* Minimum 44px touch targets for all buttons */
  .btn {
    min-height: 44px;
    min-width: 44px;
  }

  /* Minimum 44px height for form inputs */
  .form-control,
  .form-select {
    min-height: 44px;
    font-size: 16px; /* Prevents iOS Safari auto-zoom */
  }

  /* Pagination buttons */
  .page-link {
    min-height: 44px;
    min-width: 44px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
}
```

#### Section 8: Employee Dashboard — Mobile

```css
/* ===== RESPONSIVE: Employee Dashboard — Mobile ===== */
@media (max-width: 767px) {
  /* Check In / Check Out buttons: full width, large touch target */
  #btn-checkin,
  #btn-checkout {
    min-height: 52px;
    flex: 1;
  }

  /* Navbar: prevent overflow */
  #view-employee .navbar .navbar-nav {
    flex-wrap: nowrap;
    overflow: hidden;
  }
}
```

#### Section 9: Login Page — Mobile (already partially done, verify)

The existing `@media (max-width: 767px)` block in `style.css` already handles the login split layout. The tab switching CSS is already present. No new rules needed here beyond verifying the existing rules are correct.

#### Section 10: ApexCharts — Responsive

The chart responsive breakpoints are configured in JS (in `app.js` `renderDashboardCharts()`), not CSS. The existing `responsive` array in the chart options needs to be updated:

```javascript
// In renderDashboardCharts() — pieOptions
responsive: [
  {
    breakpoint: 768,
    options: {
      chart: { height: 280 },
      legend: { position: 'bottom' }
    }
  },
  {
    breakpoint: 480,
    options: {
      chart: { height: 240, width: '100%' },
      legend: { position: 'bottom', fontSize: '11px' }
    }
  }
]

// In renderDashboardCharts() — barOptions
responsive: [
  {
    breakpoint: 768,
    options: {
      chart: { height: 280 },
      xaxis: { labels: { rotate: -45, style: { fontSize: '10px' } } }
    }
  },
  {
    breakpoint: 480,
    options: {
      chart: { height: 240 },
      xaxis: { labels: { rotate: -45, style: { fontSize: '9px' } } },
      dataLabels: { enabled: false }
    }
  }
]
```

---

## File-by-File Change Summary

### `index.html`

The viewport meta tag is already present:
```html
<meta name="viewport" content="width=device-width, initial-scale=1.0">
```
This satisfies Requirement 1.1. No change needed.

### `backend/admin_partial.html`

**Navbar changes:**
1. Add `#btn-hamburger` as first child of `.container-fluid`
2. Add `.logout-btn-text` span inside logout button (wrapping text only)
3. Add SVG icon to logout button (always visible)
4. Add `id="admin-sidebar"` to `<aside>` for ARIA

**Sidebar changes:**
1. Add `id="admin-sidebar"` to `<aside class="admin-sidebar">`

**Overlay:**
1. Add `<div class="sidebar-overlay" id="sidebar-overlay"></div>` as first child of `.admin-layout` (before `<aside>`)

**Filter bars:**
1. Add class `filter-bar-row` to the `d-flex` wrapper divs in Daily Attendance, Manual Attendance, and Logs filter bars
2. Add class `export-btn-text` to text spans inside export buttons in Daily Attendance and Reports views

**Table columns:**
1. Add class `col-hide-mobile` to low-priority `<th>` and `<td>` elements:
   - Daily Attendance table: hide "Group" and "Shift" columns on mobile
   - User Management table: hide "ID" column on mobile (name + role sufficient)
   - Manual Attendance table: hide "Group" column on mobile

**Action buttons:**
1. Add class `btn-action-text` to text spans inside edit/delete buttons (these are already icon-only `btn-icon` buttons, so this is a no-op — they have no text to hide)

**Pagination:**
1. Add class `page-number` to page number `<li>` elements in pagination (these are rendered by JS, so the JS components need updating)

### `backend/employee_partial.html`

**Navbar changes:**
1. Add SVG icon to logout button (currently text-only)
2. Add `.logout-btn-text` span wrapping the text

### `backend/login_partial.html`

No HTML changes needed. The tab structure is already correct. The JS tab switching logic needs to be wired up in `app.js`.

### `src/frontend/app.js`

**New functions:**
1. `initAdminSidebar()` — hamburger toggle, overlay click, nav item auto-close
2. `initLoginTabs()` — tab switching for login page

**Call sites:**
- `initAdminSidebar()` called after admin partial is injected (in `loadView('admin')` callback)
- `initLoginTabs()` called after login partial is injected (in `loadView('login')` callback, alongside `startLoginScanner`)

**Chart options:**
- Update `pieOptions.responsive` and `barOptions.responsive` in `renderDashboardCharts()` to add 768px breakpoint

### `src/frontend/components/DailyAttendance.js`

**`renderPagination()`:**
- Add class `page-number` to page number `<li>` elements so CSS can hide them on mobile
- The prev/next buttons already exist and will remain visible

### `src/frontend/components/UserManagement.js`

**`renderPagination()`:**
- Add class `page-number` to page number `<li>` elements

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

This feature is primarily CSS layout and JS DOM manipulation. Most acceptance criteria are specific layout checks at specific viewport sizes (example-based tests). However, several criteria express universal properties that should hold across all instances of a class of elements or across a range of viewport widths. These are suitable for property-based testing.

**Property Reflection:** After reviewing all testable criteria, the following consolidations apply:
- Properties 3 (touch target buttons), 9 (touch target inputs), and 10 (sidebar nav items) all test minimum size constraints on interactive elements. They can be combined into one comprehensive touch target property.
- Properties 4 (table overflow) and 5 (column hiding) both test table container behavior. They are distinct enough to keep separate.
- Properties 6 (action buttons icon-only) and 7 (filter bar stacking) are distinct behaviors and remain separate.
- Properties 8 (modal width), 9 (modal form stacking), and 10 (modal bottom-sheet) all test modal behavior on mobile. They can be combined into one modal property.

After reflection, the final property set is:

### Property 1: Sign-In Button Full Width

*For any* viewport width, the Sign In button (`.btn.w-100` inside `#login-form`) SHALL have a computed width equal to the width of its parent container.

**Validates: Requirements 2.7**

### Property 2: Touch Target Minimum Size

*For any* interactive element (button, link, form input, select, sidebar nav item) rendered on a Mobile_Viewport (≤767px), the element SHALL have a computed height of at least 44px and, for buttons and links, a computed width of at least 44px.

**Validates: Requirements 3.3, 9.1, 9.2, 9.3**

### Property 3: Input Font Size Prevents iOS Zoom

*For any* `<input>` or `<select>` element rendered on a Mobile_Viewport (≤767px), the computed `font-size` SHALL be at least 16px.

**Validates: Requirements 9.4**

### Property 4: Data Table Horizontal Scroll

*For any* `.table-responsive` container in the app, the computed `overflow-x` SHALL be `auto` or `scroll`, regardless of viewport width.

**Validates: Requirements 6.1**

### Property 5: Mobile Column Hiding

*For any* table column marked with `.col-hide-mobile`, when the viewport width is ≤767px, the column's computed `display` SHALL be `none`.

**Validates: Requirements 6.2**

### Property 6: Sidebar Nav Item Auto-Close

*For any* `.admin-sidebar-item` element clicked while the sidebar is open on a Mobile_Viewport (≤767px), the sidebar SHALL transition to the closed state (body does not have class `sidebar-open`).

**Validates: Requirements 4.6**

### Property 7: Filter Bar Full-Width Stacking

*For any* `.filter-bar-row` container on a Mobile_Viewport (≤767px), every direct child element SHALL have a computed width equal to the container's width.

**Validates: Requirements 7.2**

### Property 8: Modal Mobile Behavior

*For any* modal (`.modal-overlay .modal-dialog`) displayed on a Mobile_Viewport (≤767px), the modal SHALL be positioned at the bottom of the viewport (top offset ≥ viewport height - modal height), have a width equal to the viewport width, and have rounded top corners (border-radius > 0 on top-left and top-right).

**Validates: Requirements 8.1, 8.3**

### Property 9: Navbar Fixed Position

*For any* viewport width, the admin navbar (`.glass-header`) SHALL have a computed `position` of `sticky` or `fixed` and a `top` value of `0px`.

**Validates: Requirements 10.4**

---

## Error Handling

### Sidebar State on View Change

When the user navigates to a different admin view while the sidebar is open on mobile, the sidebar must close. This is handled by the auto-close logic in `initAdminSidebar()` which attaches click listeners to all `.admin-sidebar-item` elements. If new nav items are added dynamically, the listener must be re-attached. The current implementation attaches listeners once after the admin partial is injected, which is sufficient since the sidebar HTML is static.

### Login Tab State on Scanner Start

When the user switches to the "Scan QR" tab on mobile, the QR scanner starts. If the user switches back to the "Login" tab, the scanner should stop to release the camera. The existing `startLoginScanner()` / `stopLoginScanner()` functions in `app.js` handle this. The `initLoginTabs()` function must call `stopLoginScanner()` when switching away from the scanner tab.

### Viewport Resize

If the user resizes the browser from mobile to desktop while the sidebar is open (e.g., rotating a tablet), the sidebar overlay should be hidden and the sidebar should return to its normal desktop state. This is handled by CSS: on desktop (≥1024px), `.admin-sidebar` has no `transform` and `.sidebar-overlay` is not displayed regardless of the `sidebar-open` class on `<body>`. No JS resize handler is needed.

### Chart Resize

ApexCharts handles its own resize events internally. The `responsive` breakpoint configuration in the chart options ensures charts reflow correctly when the viewport changes. No additional resize handling is needed.

---

## Testing Strategy

### Unit Tests

Unit tests cover specific examples and edge cases:

1. **Login tab switching** — simulate click on each tab button, assert correct panel visibility
2. **Hamburger toggle** — simulate click, assert `body.sidebar-open` class is added/removed
3. **Overlay click closes sidebar** — simulate click on overlay, assert sidebar closes
4. **Sidebar auto-close on nav item** — simulate click on nav item at mobile width, assert sidebar closes
5. **Chart responsive options** — assert chart options contain responsive breakpoints at 480px and 768px with height ≤ 280px
6. **Export button text hidden** — at mobile viewport, assert `.export-btn-text` has `display: none`
7. **Logout button text hidden** — at mobile viewport, assert `.logout-btn-text` has `display: none`
8. **Modal centered on desktop** — at desktop viewport, assert modal is vertically and horizontally centered

### Property-Based Tests

Property-based tests use a PBT library (e.g., [fast-check](https://github.com/dubzzz/fast-check) for JavaScript) to verify universal properties across generated inputs. Each test runs a minimum of 100 iterations.

**Test configuration tag format:** `Feature: mobile-responsive-ui, Property {N}: {property_text}`

**Property 1: Sign-In Button Full Width**
- Generator: arbitrary viewport width (integer 320–2560)
- Test: render login partial at that width, assert button width === parent width
- Tag: `Feature: mobile-responsive-ui, Property 1: Sign-In button full width`

**Property 2: Touch Target Minimum Size**
- Generator: arbitrary mobile viewport width (integer 320–767), arbitrary interactive element selector from the set of all buttons/inputs/selects/nav-items
- Test: at that viewport width, assert element height ≥ 44px (48px for nav items)
- Tag: `Feature: mobile-responsive-ui, Property 2: Touch target minimum size`

**Property 3: Input Font Size Prevents iOS Zoom**
- Generator: arbitrary mobile viewport width (integer 320–767), arbitrary input/select element
- Test: assert computed font-size ≥ 16px
- Tag: `Feature: mobile-responsive-ui, Property 3: Input font size prevents iOS zoom`

**Property 4: Data Table Horizontal Scroll**
- Generator: arbitrary `.table-responsive` container (from the set of all such containers in the app)
- Test: assert computed overflow-x is "auto" or "scroll"
- Tag: `Feature: mobile-responsive-ui, Property 4: Data table horizontal scroll`

**Property 5: Mobile Column Hiding**
- Generator: arbitrary `.col-hide-mobile` column, arbitrary mobile viewport width (320–767)
- Test: assert computed display is "none"
- Tag: `Feature: mobile-responsive-ui, Property 5: Mobile column hiding`

**Property 6: Sidebar Nav Item Auto-Close**
- Generator: arbitrary `.admin-sidebar-item` element (from the set of all nav items)
- Test: open sidebar, click nav item at mobile width, assert `body.sidebar-open` is false
- Tag: `Feature: mobile-responsive-ui, Property 6: Sidebar nav item auto-close`

**Property 7: Filter Bar Full-Width Stacking**
- Generator: arbitrary `.filter-bar-row` container, arbitrary mobile viewport width (320–767)
- Test: assert all direct children have width === container width
- Tag: `Feature: mobile-responsive-ui, Property 7: Filter bar full-width stacking`

**Property 8: Modal Mobile Behavior**
- Generator: arbitrary modal (from the set of all modals in the app), arbitrary mobile viewport width (320–767)
- Test: open modal at that width, assert bottom positioning, full width, and rounded top corners
- Tag: `Feature: mobile-responsive-ui, Property 8: Modal mobile behavior`

**Property 9: Navbar Fixed Position**
- Generator: arbitrary viewport width (integer 320–2560)
- Test: assert navbar position is "sticky" or "fixed" and top is "0px"
- Tag: `Feature: mobile-responsive-ui, Property 9: Navbar fixed position`
