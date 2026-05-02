# Requirements Document

## Introduction

This feature refactors the Google Apps Script-based attendance management web app to be fully mobile-responsive. The app currently has a desktop-first layout with a fixed-width sidebar, wide data tables, and multi-column filter bars that break on small screens. The goal is to make every view — login, employee dashboard, and admin panel — usable on phones and tablets without changing any backend logic.

The app uses Tabler (Bootstrap-based) CSS, vanilla JS components, and HTML partials injected at runtime. Responsive work spans `style.css`, the three HTML partials (`login_partial.html`, `employee_partial.html`, `admin_partial.html`), and the JS components that generate table rows and filter controls.

---

## Glossary

- **App**: The Google Apps Script attendance management web application.
- **Admin_Panel**: The admin view rendered from `admin_partial.html` and managed by JS components.
- **Employee_Dashboard**: The employee view rendered from `employee_partial.html`.
- **Login_Page**: The login view rendered from `login_partial.html`.
- **Sidebar**: The left-side navigation panel in the Admin_Panel (`admin-sidebar`).
- **Mobile_Viewport**: A screen with a CSS viewport width of 767px or less.
- **Tablet_Viewport**: A screen with a CSS viewport width between 768px and 1023px.
- **Desktop_Viewport**: A screen with a CSS viewport width of 1024px or more.
- **Data_Table**: Any HTML `<table>` element used to display records (attendance, users, shifts, reports, etc.).
- **Filter_Bar**: A row of search inputs, dropdowns, and buttons used to filter Data_Table content.
- **Hamburger_Menu**: A button that toggles the Sidebar open/closed on Mobile_Viewport.
- **Card_Stack**: A vertical list of summary cards replacing a horizontal row of cards on Mobile_Viewport.
- **Overlay**: A semi-transparent backdrop rendered behind the Sidebar when it is open on Mobile_Viewport.

---

## Requirements

### Requirement 1: Viewport Meta Tag

**User Story:** As a mobile user, I want the browser to render the app at the correct scale, so that I do not have to pinch-zoom to read content.

#### Acceptance Criteria

1. THE App SHALL include a `<meta name="viewport" content="width=device-width, initial-scale=1">` tag in the root HTML document.
2. WHEN the App is loaded on a Mobile_Viewport, THE App SHALL render content at 100% of the device width without horizontal overflow on the root `<body>` element.

---

### Requirement 2: Responsive Login Page

**User Story:** As an employee on a phone, I want to log in or scan my QR code without horizontal scrolling, so that I can record attendance quickly.

#### Acceptance Criteria

1. WHEN the Login_Page is displayed on a Desktop_Viewport, THE Login_Page SHALL render the login form and QR scanner side-by-side in a two-column layout.
2. WHEN the Login_Page is displayed on a Mobile_Viewport, THE Login_Page SHALL render the login form and QR scanner as a single-column layout with tab navigation to switch between them.
3. WHEN the Login_Page is displayed on a Mobile_Viewport, THE Login_Page SHALL display tab buttons labeled "Login" and "Scan QR" above the card body.
4. WHEN a user taps the "Scan QR" tab on a Mobile_Viewport, THE Login_Page SHALL hide the login form panel and show the QR scanner panel.
5. WHEN a user taps the "Login" tab on a Mobile_Viewport, THE Login_Page SHALL hide the QR scanner panel and show the login form panel.
6. WHEN the Login_Page is displayed on a Mobile_Viewport, THE Login_Page SHALL render the card with horizontal padding of no more than 1rem on each side.
7. THE Login_Page SHALL render the "Sign In" button at full width on all viewport sizes.

---

### Requirement 3: Responsive Employee Dashboard

**User Story:** As an employee on a phone, I want to check in, check out, and view my attendance history without horizontal scrolling, so that I can use the app comfortably on my phone.

#### Acceptance Criteria

1. WHEN the Employee_Dashboard is displayed on a Desktop_Viewport, THE Employee_Dashboard SHALL render the check-in/check-out card and the recent history card side-by-side.
2. WHEN the Employee_Dashboard is displayed on a Mobile_Viewport, THE Employee_Dashboard SHALL render the check-in/check-out card and the recent history card stacked vertically in a single column.
3. WHEN the Employee_Dashboard is displayed on a Mobile_Viewport, THE Employee_Dashboard SHALL render the "Check In" and "Check Out" buttons at a minimum touch target size of 44×44 CSS pixels.
4. WHEN the Employee_Dashboard is displayed on a Mobile_Viewport, THE Employee_Dashboard SHALL wrap the recent history Data_Table in a horizontally scrollable container so that all columns remain accessible.
5. WHEN the Employee_Dashboard is displayed on a Mobile_Viewport, THE Employee_Dashboard navbar SHALL display only the language selector and logout button, without truncating or overflowing the viewport.

---

### Requirement 4: Responsive Admin Sidebar Navigation

**User Story:** As an admin on a phone or tablet, I want to navigate between admin views without the sidebar permanently occupying screen space, so that I have enough room to read data.

#### Acceptance Criteria

1. WHEN the Admin_Panel is displayed on a Desktop_Viewport, THE Admin_Panel SHALL render the Sidebar as a fixed left column of 250px width alongside the main content area.
2. WHEN the Admin_Panel is displayed on a Mobile_Viewport, THE Admin_Panel SHALL hide the Sidebar off-screen by default.
3. WHEN the Admin_Panel is displayed on a Mobile_Viewport, THE Admin_Panel SHALL render a Hamburger_Menu button in the navbar.
4. WHEN a user taps the Hamburger_Menu button on a Mobile_Viewport, THE Admin_Panel SHALL slide the Sidebar into view over the main content and display an Overlay behind it.
5. WHEN a user taps the Overlay on a Mobile_Viewport, THE Admin_Panel SHALL close the Sidebar and remove the Overlay.
6. WHEN a user selects a navigation item in the Sidebar on a Mobile_Viewport, THE Admin_Panel SHALL close the Sidebar automatically.
7. WHEN the Admin_Panel is displayed on a Tablet_Viewport, THE Admin_Panel SHALL render the Sidebar as a collapsed icon-only rail of 60px width, expanding to full width on hover or focus.

---

### Requirement 5: Responsive Admin Dashboard Stats and Charts

**User Story:** As an admin on a phone, I want to see attendance summary statistics and charts without horizontal scrolling, so that I can monitor performance on the go.

#### Acceptance Criteria

1. WHEN the Admin_Panel dashboard is displayed on a Desktop_Viewport, THE Admin_Panel SHALL render the four summary stat cards in a single horizontal row (4 columns).
2. WHEN the Admin_Panel dashboard is displayed on a Mobile_Viewport, THE Admin_Panel SHALL render the four summary stat cards as a Card_Stack of two cards per row (2 columns).
3. WHEN the Admin_Panel dashboard is displayed on a Mobile_Viewport, THE Admin_Panel SHALL render the pie chart and bar chart each at full width in a single column.
4. WHEN the Admin_Panel dashboard is displayed on a Desktop_Viewport, THE Admin_Panel SHALL render the pie chart and bar chart side-by-side (5/12 and 7/12 column widths).
5. WHEN the Admin_Panel dashboard charts are rendered on a Mobile_Viewport, THE Admin_Panel SHALL configure ApexCharts with a responsive breakpoint at 480px that reduces chart height to no more than 280px.

---

### Requirement 6: Responsive Data Tables

**User Story:** As an admin on a phone, I want to view and interact with data tables without the layout breaking, so that I can manage attendance records and users on mobile.

#### Acceptance Criteria

1. THE App SHALL wrap every Data_Table in a container with `overflow-x: auto` so that wide tables scroll horizontally on Mobile_Viewport without breaking the page layout.
2. WHEN a Data_Table is displayed on a Mobile_Viewport, THE App SHALL hide low-priority columns (such as employee ID sub-rows and shift time ranges) using CSS `display: none` at the appropriate breakpoint, while keeping primary columns (name, status, time) visible.
3. WHEN a Data_Table is displayed on a Mobile_Viewport, THE App SHALL render action buttons (edit, delete) as icon-only buttons without text labels to reduce column width.
4. WHEN pagination controls are displayed on a Mobile_Viewport, THE App SHALL render the pagination as a compact control showing only previous/next buttons and the current page indicator, hiding individual page number buttons.

---

### Requirement 7: Responsive Filter Bars

**User Story:** As an admin on a phone, I want to filter and search table data without the filter controls overflowing the screen, so that I can find records efficiently.

#### Acceptance Criteria

1. WHEN a Filter_Bar is displayed on a Desktop_Viewport, THE App SHALL render filter inputs and dropdowns in a multi-column horizontal row.
2. WHEN a Filter_Bar is displayed on a Mobile_Viewport, THE App SHALL render each filter input and dropdown stacked vertically at full width.
3. WHEN the Daily Attendance Filter_Bar is displayed on a Mobile_Viewport, THE Admin_Panel SHALL render the date range inputs, load button, and export buttons in a stacked vertical layout.
4. WHEN the Daily Attendance Filter_Bar is displayed on a Mobile_Viewport, THE Admin_Panel SHALL render the export buttons (CSV, Excel, Print) as icon-only buttons without text labels.

---

### Requirement 8: Responsive Modals and Forms

**User Story:** As an admin on a phone, I want to add or edit records using forms in modals without the modal overflowing the screen, so that I can manage data on mobile.

#### Acceptance Criteria

1. WHEN a modal is displayed on a Mobile_Viewport, THE App SHALL render the modal at a width of 100% of the viewport minus 2rem of horizontal margin.
2. WHEN a modal form is displayed on a Mobile_Viewport, THE App SHALL render multi-column form rows (e.g., photo upload + fields) as a single-column stacked layout.
3. WHEN a modal is displayed on a Mobile_Viewport, THE App SHALL position the modal at the bottom of the viewport using a bottom-sheet style with rounded top corners, to reduce thumb travel distance.
4. WHEN a modal is displayed on a Desktop_Viewport, THE App SHALL render the modal centered in the viewport at its standard width.

---

### Requirement 9: Touch-Friendly Interactive Elements

**User Story:** As a mobile user, I want all interactive elements to be large enough to tap accurately, so that I do not accidentally trigger the wrong action.

#### Acceptance Criteria

1. THE App SHALL render all clickable buttons and links with a minimum touch target size of 44×44 CSS pixels on Mobile_Viewport.
2. THE App SHALL render all form inputs (`<input>`, `<select>`) with a minimum height of 44px on Mobile_Viewport to meet touch target guidelines.
3. WHEN the Admin_Panel Sidebar navigation items are displayed on a Mobile_Viewport, THE Admin_Panel SHALL render each navigation item with a minimum height of 48px.
4. THE App SHALL set `font-size` on all `<input>` and `<select>` elements to a minimum of 16px on Mobile_Viewport to prevent automatic zoom on iOS Safari.

---

### Requirement 10: Responsive Admin Navbar

**User Story:** As an admin on a phone, I want the admin navbar to remain usable and uncluttered, so that I can access key actions without the header overflowing.

#### Acceptance Criteria

1. WHEN the Admin_Panel navbar is displayed on a Mobile_Viewport, THE Admin_Panel SHALL display the Hamburger_Menu button on the left and the organization name in the center or left of the navbar.
2. WHEN the Admin_Panel navbar is displayed on a Mobile_Viewport, THE Admin_Panel SHALL display the logout button on the right side of the navbar without text, using only an icon.
3. WHEN the Admin_Panel navbar is displayed on a Desktop_Viewport, THE Admin_Panel SHALL display the organization name on the left and the logout button with text on the right.
4. THE Admin_Panel navbar SHALL remain fixed at the top of the viewport on all viewport sizes so that navigation controls are always accessible.
