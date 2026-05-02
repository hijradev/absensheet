# Requirements Document

## Introduction

The Geofencing feature adds location-based validation to the attendance system. When an employee attempts to clock in or clock out, the system captures their GPS coordinates via the browser's Geolocation API and verifies that they are within a configured radius of the designated work location. Clock-in and clock-out requests that originate outside the allowed zone are rejected, preventing fraudulent remote attendance submissions.

The feature integrates with the existing `processAttendance` flow in `Absensi.gs`, adds a geofence configuration section to the admin Settings page, and surfaces location status feedback in the employee check-in UI.

Key design decisions:
- A **single global Work_Location** applies to all employees and shifts — no per-shift or per-employee locations.
- Poor GPS accuracy (>200 m) **hard-blocks** submission — the clock-in/clock-out button is hidden, not just disabled.
- **Admin-created attendance records bypass geofence validation** — no location data is required for manual entries.

## Glossary

- **Geofence**: A virtual geographic boundary defined by a center coordinate (latitude/longitude) and a radius in meters.
- **Work_Location**: The designated physical location where attendance is valid, represented as a latitude/longitude coordinate pair stored in Script Properties.
- **Geofence_Radius**: The maximum allowed distance (in meters) between an employee's reported location and the Work_Location center.
- **Location_Validator**: The backend Google Apps Script function responsible for computing the distance between two coordinates and determining whether a submitted location is within the Geofence.
- **Geolocation_Service**: The browser's `navigator.geolocation` API used by the frontend to obtain the employee's current GPS coordinates.
- **Attendance_System**: The Google Apps Script web application that manages employee attendance records.
- **Admin**: A user with the "Admin" role who can configure system settings.
- **Employee**: A user with the "Employee" role who submits attendance via check-in/check-out.
- **Haversine_Formula**: The standard spherical-geometry formula used to compute the great-circle distance between two latitude/longitude points.
- **Location_Payload**: The object `{ latitude, longitude, accuracy }` submitted by the frontend alongside a check-in or check-out request.

---

## Requirements

### Requirement 1: Geofence Configuration by Admin

**User Story:** As an Admin, I want to configure the work location and allowed radius, so that the system knows which geographic area is considered valid for attendance.

#### Acceptance Criteria

1. THE Attendance_System SHALL provide a Geofence Settings section within the existing admin Settings page for configuring a **single global Work_Location** that applies to all employees and all shifts.
2. WHEN an Admin submits a valid geofence configuration, THE Attendance_System SHALL persist the Work_Location latitude, Work_Location longitude, and Geofence_Radius to Script Properties.
3. IF the submitted latitude is outside the range −90 to 90 (inclusive), THEN THE Attendance_System SHALL return a descriptive validation error and reject the save.
4. IF the submitted longitude is outside the range −180 to 180 (inclusive), THEN THE Attendance_System SHALL return a descriptive validation error and reject the save.
5. IF the submitted Geofence_Radius is less than 10 meters or greater than 50,000 meters, THEN THE Attendance_System SHALL return a descriptive validation error and reject the save.
6. WHEN an Admin loads the Settings page, THE Attendance_System SHALL display the currently saved Work_Location and Geofence_Radius values, or empty fields if none have been configured.
7. WHERE geofencing is enabled, THE Attendance_System SHALL allow the Admin to toggle geofencing enforcement on or off without deleting the saved Work_Location and Geofence_Radius.
8. WHEN an Admin saves geofence settings, THE Attendance_System SHALL log the configuration change to the Activity_Log with the Admin's user ID and a description of the change.

---

### Requirement 2: Location Capture on Check-In / Check-Out

**User Story:** As an Employee, I want the app to automatically capture my GPS location when I clock in or out, so that I do not need to manually enter my coordinates.

#### Acceptance Criteria

1. WHEN an Employee initiates a check-in or check-out action and geofencing is enabled, THE Geolocation_Service SHALL request the device's current GPS position before submitting the attendance request.
2. WHILE the Geolocation_Service is acquiring the position, THE Attendance_System SHALL display a loading indicator and disable the check-in/check-out button to prevent duplicate submissions.
3. IF the Geolocation_Service returns an error (permission denied, position unavailable, or timeout), THEN THE Attendance_System SHALL display a descriptive error message and cancel the attendance submission.
4. IF the device reports a location accuracy worse than 200 meters, THEN THE Attendance_System SHALL hide the check-in/check-out button and display a descriptive error message indicating that GPS accuracy is insufficient, preventing the Employee from submitting attendance until a more accurate position is obtained.
5. WHEN the Geolocation_Service successfully returns a position, THE Attendance_System SHALL include the Location_Payload in the attendance submission request sent to the backend.
6. WHERE geofencing is disabled by the Admin, THE Attendance_System SHALL submit the attendance request without requesting or requiring a Location_Payload.

---

### Requirement 3: Server-Side Location Validation

**User Story:** As an Admin, I want the server to validate employee location on every check-in and check-out, so that attendance cannot be submitted from outside the designated work area.

#### Acceptance Criteria

1. WHEN the backend receives a check-in or check-out request and geofencing is enabled, THE Location_Validator SHALL compute the distance between the submitted Location_Payload coordinates and the configured Work_Location using the Haversine_Formula.
2. IF the computed distance exceeds the configured Geofence_Radius, THEN THE Location_Validator SHALL reject the request and return an error response containing the computed distance and the allowed radius.
3. IF the submitted Location_Payload is missing or malformed when geofencing is enabled, THEN THE Location_Validator SHALL reject the request with a descriptive error.
4. WHEN the Location_Validator accepts a location, THE Attendance_System SHALL record the submitted latitude, longitude, and computed distance in the attendance record.
5. WHERE geofencing is disabled, THE Location_Validator SHALL skip all location checks and process the attendance request normally.
6. THE Location_Validator SHALL validate that submitted latitude values are numeric and within −90 to 90, and submitted longitude values are numeric and within −180 to 180, before performing distance computation.

---

### Requirement 4: Location Feedback in Employee UI

**User Story:** As an Employee, I want to see my current location status before clocking in, so that I know whether I am within the valid attendance zone.

#### Acceptance Criteria

1. WHEN an Employee opens the check-in/check-out view and geofencing is enabled, THE Attendance_System SHALL display a location status indicator showing whether the Employee is inside or outside the Geofence.
2. WHEN the Employee's computed distance from the Work_Location is within the Geofence_Radius, THE Attendance_System SHALL display a visual indicator (e.g., green badge) confirming the Employee is within the valid zone and SHALL show the check-in/check-out button.
3. WHEN the Employee's computed distance from the Work_Location exceeds the Geofence_Radius, THE Attendance_System SHALL hide the check-in/check-out button, display a visual indicator (e.g., red badge), and show the distance to the Work_Location in meters so the Employee understands why submission is blocked.
4. IF the Geolocation_Service returns an error or reports accuracy worse than 200 meters, THEN THE Attendance_System SHALL hide the check-in/check-out button and display a descriptive message explaining that location cannot be determined accurately enough to allow submission.
5. WHERE geofencing is disabled, THE Attendance_System SHALL not display any location status indicator in the employee check-in/check-out view and SHALL show the check-in/check-out button unconditionally.

---

### Requirement 5: Admin Manual Attendance Entry Bypass

**User Story:** As an Admin, I want to create attendance records manually without geofence restrictions, so that I can correct or enter attendance data for employees regardless of location.

#### Acceptance Criteria

1. WHEN an Admin creates or edits an attendance record through the admin interface, THE Attendance_System SHALL bypass all geofence validation and process the record without requiring a Location_Payload.
2. THE Location_Validator SHALL skip distance computation for attendance records submitted via the admin manual entry flow, regardless of whether geofencing is enabled.
3. WHEN an Admin creates a manual attendance record, THE Attendance_System SHALL store a flag on the record indicating it was admin-entered, so that the absence of location data can be distinguished from pre-geofencing records.
4. WHEN an Admin views a manually entered attendance record, THE Attendance_System SHALL display a neutral indicator (e.g., "Admin Entry") in the location column rather than a geofence pass/fail status.

---

### Requirement 6: Location Data in Attendance Records and Reports

**User Story:** As an Admin, I want attendance records to include location data, so that I can audit whether employees were physically present at the work location.

#### Acceptance Criteria

1. WHEN an attendance record is created with geofencing enabled, THE Attendance_System SHALL store the check-in latitude, check-in longitude, and distance from Work_Location alongside the existing attendance fields.
2. WHEN an attendance record includes a check-out with geofencing enabled, THE Attendance_System SHALL store the check-out latitude, check-out longitude, and distance from Work_Location for the check-out event.
3. WHEN an Admin views the daily attendance table, THE Attendance_System SHALL display a location indicator for each record showing whether the check-in location was within the Geofence.
4. WHERE geofencing is disabled or a record was created before geofencing was enabled, THE Attendance_System SHALL display a neutral indicator (e.g., "N/A") for the location column.
5. THE Attendance_System SHALL preserve all existing attendance record fields and behavior when adding location columns, ensuring backward compatibility with records created before the geofencing feature was enabled.

---

### Requirement 7: QR Code Attendance and Geofencing

**User Story:** As an Admin, I want QR code-based attendance to also enforce geofencing, so that employees cannot scan a QR code from a remote location.

#### Acceptance Criteria

1. WHEN a QR code attendance scan is processed and geofencing is enabled, THE Attendance_System SHALL require a Location_Payload to be submitted alongside the employee ID.
2. IF the Location_Payload submitted with a QR scan is outside the Geofence, THEN THE Attendance_System SHALL reject the QR attendance request with a descriptive error.
3. WHERE geofencing is disabled, THE Attendance_System SHALL process QR code attendance without requiring a Location_Payload.
