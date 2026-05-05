# Requirements Document

## Introduction

The Group Schedule feature provides an alternative view of the monthly schedule, displaying groups instead of individual users. While the existing Monthly Schedule shows employees as rows with their assigned shifts per day, the Group Schedule aggregates data by group (position), showing which groups are assigned to which shifts on each day. This view is particularly useful for managers who need to understand group-level coverage and shift distribution across the organization.

The feature introduces a new "Group Schedule" view accessible from the admin panel, displaying a calendar grid where rows represent groups and cells show shift assignments using colored dot indicators. A legend below the table maps shift IDs to their time ranges and colors.

Key design decisions:
- Groups are derived from the existing Positions entity (stored in the Positions sheet)
- Shift assignments are aggregated from the existing Schedules data
- Multiple shifts per day are supported through colored dot indicators
- The view is admin-only, as it provides organization-wide scheduling visibility

## Glossary

- **Group_Schedule_View**: A calendar-style view displaying group shift assignments organized by day, accessible from the admin panel.
- **Group**: A logical grouping of employees, synonymous with Position in the current system. Groups are identified by a unique ID and name (e.g., "Operations", "Security", "Maintenance").
- **Shift**: A defined work period with a start time and end time. Shifts are identified by a unique ID.
- **Shift_Assignment**: The relationship between a group and a shift on a specific day. Multiple groups can be assigned to different shifts on the same day.
- **Colored_Dot_Indicator**: A small circular visual element used to represent a shift assignment in the schedule cell. Each shift has a unique color for visual differentiation.
- **Shift_Legend**: A visual guide displayed below the table that maps shift IDs to their time ranges and corresponding colors.
- **Schedule_Aggregation**: The process of computing group-level shift assignments from individual employee schedules.
- **ScheduleManagement**: The existing admin component for managing monthly employee schedules.
- **Admin_Panel**: The administrative interface accessible to users with the Admin role.

---

## Requirements

### Requirement 1: Group Schedule View Navigation

**User Story:** As an Admin, I want to access a Group Schedule view from the admin panel, so that I can see shift assignments organized by group instead of by individual employee.

#### Acceptance Criteria

1. THE Admin_Panel SHALL display a "Group Schedule" navigation item in the management section alongside the existing "Monthly Schedule" item.
2. WHEN an Admin clicks the "Group Schedule" navigation item, THE System SHALL display the Group_Schedule_View component.
3. THE Group_Schedule_View SHALL display a calendar grid with groups as rows and days of the month as columns.
4. THE Group_Schedule_View SHALL include month navigation controls (previous/next month buttons) consistent with the existing Monthly Schedule view.

---

### Requirement 2: Group Schedule Data Retrieval

**User Story:** As an Admin, I want the system to retrieve and aggregate schedule data by group, so that I can see which groups are assigned to which shifts on each day.

#### Acceptance Criteria

1. WHEN the Group_Schedule_View loads for a specific month, THE System SHALL retrieve all schedule entries for that month from the Schedules sheet.
2. THE System SHALL aggregate schedule entries by group_id and day, collecting unique shift_id values for each group-day combination.
3. IF a group has no scheduled employees on a particular day, THE System SHALL display an empty cell for that group-day combination.
4. THE System SHALL retrieve the list of all groups from the Positions sheet and display them as rows in the grid.
5. THE System SHALL retrieve all shifts from the Shifts sheet for use in the legend and color mapping.

---

### Requirement 3: Group Schedule Grid Display

**User Story:** As an Admin, I want to view a grid showing groups and their shift assignments, so that I can quickly understand coverage across the organization.

#### Acceptance Criteria

1. THE Group_Schedule_View SHALL display a table with a sticky first column containing group names.
2. THE table header SHALL display day numbers (1-31) as columns, with day-of-week labels below each day number.
3. THE table header SHALL highlight weekend days with a distinct visual style consistent with the existing Monthly Schedule view.
4. FOR each group-day cell, THE System SHALL display a Colored_Dot_Indicator for each shift assigned to that group on that day.
5. IF multiple shifts are assigned to a group on a single day, THE System SHALL display multiple Colored_Dot_Indicators horizontally within the cell.
6. THE cells SHALL have sufficient height and width to display multiple Colored_Dot_Indicators clearly without overflow.

---

### Requirement 4: Shift Visualization with Colored Dots

**User Story:** As an Admin, I want shifts represented by colored dots, so that I can quickly identify which shifts are assigned to each group without reading text.

#### Acceptance Criteria

1. THE System SHALL assign a unique color to each shift for visual differentiation.
2. THE System SHALL use a consistent color palette that provides clear visual distinction between shifts (e.g., distinct hues rather than shades of the same color).
3. THE Colored_Dot_Indicator SHALL be a circular element with a diameter of approximately 10-12 pixels.
4. THE Colored_Dot_Indicator SHALL be displayed in the center of the cell, with multiple dots arranged horizontally.
5. THE System SHALL ensure colors meet accessibility contrast requirements against the cell background.
6. THE System SHALL limit the number of distinct shift colors to a reasonable maximum (e.g., 10), using patterns or labels if more shifts exist.

---

### Requirement 5: Shift Legend Display

**User Story:** As an Admin, I want a legend showing shift IDs with their colors and time ranges, so that I can interpret the colored dots in the schedule grid.

#### Acceptance Criteria

1. THE Group_Schedule_View SHALL display a Shift_Legend below the table.
2. THE Shift_Legend SHALL list each shift ID alongside its assigned color and time range.
3. THE Shift_Legend SHALL display time ranges in the format "HH:mm – HH:mm" (e.g., "08:00 – 16:00").
4. THE Shift_Legend SHALL be displayed in a horizontal or compact grid layout to minimize vertical space usage.
5. THE Shift_Legend SHALL be visually distinct from the table with appropriate spacing or a subtle border.

---

### Requirement 6: Filter Functionality

**User Story:** As an Admin, I want to filter the Group Schedule view by group and shift, so that I can focus on specific areas of interest.

#### Acceptance Criteria

1. THE Group_Schedule_View SHALL provide a group filter dropdown allowing selection of a specific group or "All Groups".
2. WHEN a specific group is selected, THE System SHALL display only that group's row in the grid.
3. THE Group_Schedule_View SHALL provide a shift filter dropdown allowing selection of a specific shift or "All Shifts".
4. WHEN a specific shift is selected, THE System SHALL highlight or emphasize cells containing that shift's Colored_Dot_Indicator while dimming other cells.
5. WHEN filters are applied, THE System SHALL preserve the month selection and current view state.

---

### Requirement 7: Loading and Error States

**User Story:** As an Admin, I want clear feedback during loading and when errors occur, so that I understand the system state.

#### Acceptance Criteria

1. WHILE schedule data is being loaded, THE System SHALL display a loading indicator with a descriptive message.
2. IF an error occurs while fetching schedule data, THE System SHALL display an error message with a retry button.
3. IF no groups exist in the system, THE System SHALL display a message indicating that no groups are available.
4. IF no schedule data exists for the selected month, THE System SHALL display the grid with empty cells and a message indicating no schedules are set.

---

### Requirement 8: Accessibility and Responsive Design

**User Story:** As an Admin, I want the Group Schedule view to be accessible and usable on different screen sizes, so that I can use it effectively regardless of device or ability.

#### Acceptance Criteria

1. THE Group_Schedule_View SHALL support horizontal scrolling for the calendar grid on smaller screens.
2. THE sticky group name column SHALL remain visible during horizontal scrolling.
3. THE Colored_Dot_Indicators SHALL have associated accessible labels (e.g., aria-label) indicating the shift ID for screen readers.
4. THE table header and cells SHALL use semantic HTML elements (th, td) for proper accessibility.
5. THE filter controls and navigation buttons SHALL be keyboard accessible.

---

### Requirement 9: Backend API for Group Schedule Data

**User Story:** As a developer, I want a backend API endpoint that returns aggregated group schedule data, so that the frontend can efficiently render the Group Schedule view.

#### Acceptance Criteria

1. THE System SHALL provide a backend function `getGroupScheduleSummary` that accepts token, year, and month parameters.
2. THE `getGroupScheduleSummary` function SHALL verify that the requesting user has Admin role.
3. THE `getGroupScheduleSummary` function SHALL return a response containing:
   - groups: array of { id, name }
   - shifts: array of { id, start_time, end_time, color }
   - schedules: array of { groupId, day, shiftIds: string[] }
   - year: number
   - month: number
4. THE System SHALL cache the aggregated group schedule data with a 30-minute TTL to improve performance.
5. THE System SHALL invalidate the cache when schedule entries are modified via saveBulkSchedule or deleteScheduleEntry.

---

### Requirement 10: Color Assignment Algorithm

**User Story:** As a developer, I want a deterministic algorithm for assigning colors to shifts, so that colors remain consistent across page loads and users.

#### Acceptance Criteria

1. THE System SHALL assign colors to shifts using a deterministic algorithm based on shift ID or array index.
2. THE System SHALL use a predefined color palette ensuring visual distinction between colors.
3. WHEN the number of shifts exceeds the palette size, THE System SHALL cycle through the palette colors.
4. THE color assignment SHALL be computed on the backend and included in the API response for consistency.
