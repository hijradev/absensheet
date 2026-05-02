# Implementation Plan: Geofencing Feature

## Overview

Implement location-based attendance validation across three layers: a new `Geofencing.gs` backend module for Haversine math and validation, extensions to `Settings.gs` and `Absensi.gs` for geofence-aware processing, new columns G–M in `Attendance_Data`, a Geofence Settings card in the admin `Settings.js`, and a location status badge with conditional button visibility in the employee check-in UI (`DailyAttendance.js` area). Property-based tests use **fast-check** in the existing Node.js/Vite test environment.

## Tasks

- [x] 1. Create `backend/Geofencing.gs` with core math and validation functions
  - Implement `haversineDistance(lat1, lng1, lat2, lng2)` using the Haversine formula; return distance in meters as a number
  - Implement `validateLatLng(lat, lng)` returning `{ valid: boolean, error: string|null }`; accept lat ∈ [−90, 90] and lng ∈ [−180, 180]
  - Implement `validateLocation(payload)` returning `{ valid, skipped, distance, radius, error }`; read `GEOFENCE_ENABLED`, `WORK_LAT`, `WORK_LNG`, `GEOFENCE_RADIUS` from `PropertiesService.getScriptProperties()`; return `{ valid: true, skipped: true }` when disabled; return error when payload is missing/malformed and geofencing is enabled; return error with distance and radius when distance exceeds radius
  - _Requirements: 3.1, 3.2, 3.3, 3.5, 3.6_

  - [ ]* 1.1 Write property test — Property 1: Haversine symmetry
    - **Property 1: `haversineDistance(lat1, lng1, lat2, lng2)` equals `haversineDistance(lat2, lng2, lat1, lng1)` for all valid coordinate pairs**
    - **Validates: Requirements 3.1**
    - Use `fc.float({ min: -90, max: 90, noNaN: true })` and `fc.float({ min: -180, max: 180, noNaN: true })`; assert with `toBeCloseTo(..., 5)`; `numRuns: 100`
    - Tag: `// Feature: geofencing, Property 1: haversineDistance is symmetric`

  - [ ]* 1.2 Write property test — Property 2: Haversine self-distance is zero
    - **Property 2: `haversineDistance(lat, lng, lat, lng)` returns exactly 0 for any valid coordinate**
    - **Validates: Requirements 3.1**
    - Use `fc.float` for lat and lng in valid ranges; assert `toBe(0)`; `numRuns: 100`
    - Tag: `// Feature: geofencing, Property 2: haversineDistance(p, p) === 0`

  - [ ]* 1.3 Write property test — Property 3: Coordinate range validation
    - **Property 3: `validateLatLng` returns `valid: true` for all in-range inputs and `valid: false` with a non-empty error for all out-of-range inputs**
    - **Validates: Requirements 1.3, 1.4, 3.6**
    - Valid case: `fc.float({ min: -90, max: 90 })` × `fc.float({ min: -180, max: 180 })`; assert `valid === true`
    - Invalid lat case: `fc.oneof(fc.float({ min: -1000, max: -90.001 }), fc.float({ min: 90.001, max: 1000 }))` × valid lng; assert `valid === false` and `error` is truthy
    - `numRuns: 100` per sub-case
    - Tag: `// Feature: geofencing, Property 3: validateLatLng accepts valid and rejects invalid ranges`

  - [ ]* 1.4 Write property test — Property 4: Geofence boundary determines acceptance or rejection
    - **Property 4: distance ≤ radius → `validateLocation` returns `valid: true`; distance > radius → `valid: false` with distance and radius in response**
    - **Validates: Requirements 3.1, 3.2, 7.2**
    - Inject work location and radius via a mock `PropertiesService`; generate employee coordinates that are deterministically inside or outside the radius; `numRuns: 100`
    - Tag: `// Feature: geofencing, Property 4: inside geofence accepted, outside rejected`

  - [ ]* 1.5 Write property test — Property 5: Disabled geofence skips validation for all flows
    - **Property 5: when `GEOFENCE_ENABLED` is `"false"`, `validateLocation` returns `{ valid: true, skipped: true }` for any payload including null, undefined, and malformed objects**
    - **Validates: Requirements 2.6, 3.5, 7.3**
    - Use `fc.anything()` as the payload; mock `PropertiesService` to return `GEOFENCE_ENABLED = "false"`; `numRuns: 100`
    - Tag: `// Feature: geofencing, Property 5: disabled geofence always returns skipped=true`

- [x] 2. Extend `backend/Settings.gs` with geofence configuration functions
  - Implement `getGeofenceSettings(token)`: call `checkAdmin(token)`; read `GEOFENCE_ENABLED`, `WORK_LAT`, `WORK_LNG`, `GEOFENCE_RADIUS` from Script Properties; return `{ enabled, latitude, longitude, radius }` (nulls if not yet configured)
  - Implement `saveGeofenceSettings(token, data)`: call `checkAdmin(token)`; validate `data.latitude` ∈ [−90, 90], `data.longitude` ∈ [−180, 180], `data.radius` ∈ [10, 50000]; on any validation failure return `errorResponse` without writing any property; on success write all four keys atomically and call `logActivity`
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8_

  - [ ]* 2.1 Write property test — Property 6: Geofence settings round-trip
    - **Property 6: saving a valid config via `saveGeofenceSettings` then reading it back via `getGeofenceSettings` returns an equivalent configuration**
    - **Validates: Requirements 1.2, 1.6**
    - Use `fc.boolean()`, `fc.float({ min: -90, max: 90 })`, `fc.float({ min: -180, max: 180 })`, `fc.integer({ min: 10, max: 50000 })`; mock `PropertiesService` and `checkAdmin`; assert `enabled`, `latitude` (toBeCloseTo 6), `longitude` (toBeCloseTo 6), `radius` match; `numRuns: 100`
    - Tag: `// Feature: geofencing, Property 6: save then read returns equivalent config`

  - [ ]* 2.2 Write property test — Property 7: Toggling enabled/disabled preserves coordinates
    - **Property 7: toggling `enabled` off then back on leaves `latitude`, `longitude`, and `radius` unchanged**
    - **Validates: Requirements 1.7**
    - Save a valid config; toggle `enabled` to false; toggle back to true; assert lat/lng/radius are identical; `numRuns: 100`
    - Tag: `// Feature: geofencing, Property 7: toggling enabled/disabled preserves lat/lng/radius`

  - [ ]* 2.3 Write property test — Property 8: Invalid radius rejected without side effects
    - **Property 8: `saveGeofenceSettings` with radius < 10 or > 50000 returns an error and does not modify any Script Properties**
    - **Validates: Requirements 1.5**
    - Use `fc.oneof(fc.integer({ min: -10000, max: 9 }), fc.integer({ min: 50001, max: 100000 }))`; capture properties before call; assert `status === 'error'`; assert properties are unchanged after call; `numRuns: 100`
    - Tag: `// Feature: geofencing, Property 8: invalid radius is rejected without modifying stored properties`

- [x] 3. Extend `backend/Absensi.gs` with location-aware attendance processing
  - Add `locationPayload` as a third parameter to `processAttendance(token, action, locationPayload)`: when geofencing is enabled, call `validateLocation(locationPayload)` before writing the record; on failure return `errorResponse` with distance and radius; on success append location columns G–I (check-in) or J–L (check-out) to the row; write `source = "employee"` in column M for new rows
  - Add `locationPayload` as a second parameter to `processAttendanceByQR(employeeId, locationPayload)` with the same validation semantics; write `source = "qr"` in column M
  - Update `saveManualAttendance` to write `source = "admin"` in column M (index 12) for both new appends and in-place updates; do not call `validateLocation` — admin entries bypass geofence unconditionally
  - Update `checkIn(token, locationPayload)` and `checkOut(token, locationPayload)` wrapper functions to pass `locationPayload` through to `processAttendance`
  - Update `getDailyAttendance` and `getDailyAttendanceRange` to read columns G–M and include `checkInLat`, `checkInLng`, `checkInDistance`, `checkOutLat`, `checkOutLng`, `checkOutDistance`, `source` in each record object; treat empty string as `null` for location fields
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 5.1, 5.2, 5.3, 6.1, 6.2, 7.1, 7.2, 7.3_

  - [ ]* 3.1 Write property test — Property 9: Location data stored on every valid attendance record
    - **Property 9: a valid location payload that passes geofence validation results in an attendance row with latitude, longitude, and computed distance in columns G–I (check-in) or J–L (check-out)**
    - **Validates: Requirements 3.4, 6.1, 6.2**
    - Mock `PropertiesService`, `SpreadsheetApp`, and `validateLocation` (returns valid); generate arbitrary valid payloads; assert the appended row contains the correct values at indices 6–8 or 9–11; `numRuns: 100`
    - Tag: `// Feature: geofencing, Property 9: valid location payload is persisted in attendance record`

  - [ ]* 3.2 Write property test — Property 10: Admin manual entry bypasses geofence regardless of state
    - **Property 10: `saveManualAttendance` succeeds regardless of `GEOFENCE_ENABLED` value and regardless of any location payload**
    - **Validates: Requirements 5.1, 5.2**
    - Use `fc.boolean()` for geofence enabled state; mock `PropertiesService`; assert `saveManualAttendance` returns `status === 'success'` in all cases; `numRuns: 100`
    - Tag: `// Feature: geofencing, Property 10: saveManualAttendance succeeds regardless of geofence state`

  - [ ]* 3.3 Write property test — Property 11: Admin manual entry stores source flag
    - **Property 11: every row written by `saveManualAttendance` contains `"admin"` at column index 12 (column M)**
    - **Validates: Requirements 5.3**
    - Mock `appendSheetData` and `updateSheetRow` to capture the written row; assert `row[12] === "admin"`; `numRuns: 100`
    - Tag: `// Feature: geofencing, Property 11: manual attendance records have source="admin"`

- [x] 4. Checkpoint — backend unit tests
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Add location columns G–M to `Attendance_Data` and verify backward compatibility
  - Document the column schema (G: checkInLat, H: checkInLng, I: checkInDistance, J: checkOutLat, K: checkOutLng, L: checkOutDistance, M: source) in a comment block at the top of `Absensi.gs`
  - Verify that all read paths in `getDailyAttendance` and `getDailyAttendanceRange` handle rows with fewer than 13 columns (pre-geofencing records) by defaulting missing indices to `""`
  - Verify that `saveManualAttendance` preserves existing row length when updating pre-geofencing rows (do not truncate columns A–F when writing back)
  - _Requirements: 6.4, 6.5_

  - [ ]* 5.1 Write property test — Property 12: Backward compatibility with pre-geofencing records
    - **Property 12: reading a row with only columns A–F via `getDailyAttendance` returns the record without error, with `null` or `""` for location fields, and does not alter columns A–F**
    - **Validates: Requirements 6.5**
    - Mock `getSheetData` to return rows of length 6; assert the returned record object has `checkInLat`, `checkInLng`, `checkInDistance`, `checkOutLat`, `checkOutLng`, `checkOutDistance` all falsy; assert `checkInTime`, `checkInStatus`, etc. are unchanged; `numRuns: 100`
    - Tag: `// Feature: geofencing, Property 12: old records (A-F only) are read without error`

- [x] 6. Add Geofence Settings card to `src/frontend/components/Settings.js`
  - Extend `constructor` to add `geofence: { enabled: false, latitude: '', longitude: '', radius: '' }` and `loading.geofence: false` to `this.currentSettings` and `this.loading`
  - Extend `loadData()` to also call `getGeofenceSettings` and populate `this.currentSettings.geofence`; handle the case where no geofence has been configured yet (null values → empty fields)
  - Add a Geofence Settings card to `render()` alongside the existing Organization and Language cards; include: enable/disable toggle, latitude input (type number, step any, min −90, max 90), longitude input (type number, step any, min −180, max 180), radius input (type number, min 10, max 50000, placeholder "meters"), "Use My Current Location" button, and Save button; use `aria-describedby` on each input pointing to a hint/error element
  - Add `handleGeofenceSave()` in `attachEventListeners()`: read form values, call `saveGeofenceSettings`, show success/error via existing `showSuccess`/`showError` helpers
  - Add `handleUseMyLocation()`: call `navigator.geolocation.getCurrentPosition`, populate lat/lng inputs on success, show error message on failure
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8_

- [x] 7. Add location status badge and conditional button visibility to employee check-in UI
  - In the employee check-in/check-out view (employee partial HTML or `DailyAttendance.js` area), add a location status badge element with id `location-status-badge` and a distance display element; use both color and text label (not color alone) for accessibility: green "Within Zone", red "Outside Zone", yellow "Acquiring…", grey "Location Error" / "Location Disabled"
  - Implement a `GeolocationService` helper (inline or as a small module) that wraps `navigator.geolocation.getCurrentPosition` with a timeout; on success resolve with `{ latitude, longitude, accuracy }`; on error reject with a descriptive message matching the error table in the design
  - On page load (when geofencing is enabled): call `GeolocationService`, update the badge to "Acquiring…" while waiting; on success compute client-side distance using the same Haversine logic (for UX only) and update badge; hide the clock-in/out button (`display: none`) if `accuracy > 200` or distance > radius; show the button if inside the geofence with sufficient accuracy
  - When geofencing is disabled: do not call `GeolocationService`, do not render the badge, show the clock-in/out button unconditionally
  - Pass `locationPayload` to `checkIn` / `checkOut` calls; display the server error message if the backend rejects the request
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 4.1, 4.2, 4.3, 4.4, 4.5_

- [x] 8. Display location indicator in admin daily attendance table
  - In `DailyAttendance.js`, add a location indicator column to the attendance table header and rows
  - For each record: if `source === "admin"` display a neutral badge "Admin Entry"; if `checkInDistance` is a number and geofencing was active display a green "✓ In Zone" or red "✗ Out Zone" badge based on whether distance ≤ radius (use the radius from the record or fall back to the configured radius); if location fields are empty/null display "N/A"
  - Ensure the badge uses both color and text for accessibility (WCAG 1.4.1)
  - _Requirements: 5.4, 6.3, 6.4_

- [-] 9. Integration wiring and end-to-end validation
  - [x] 9.1 Wire `checkIn` and `checkOut` in `Code.gs` (or wherever the GAS router exposes functions) to accept and forward `locationPayload`
    - Confirm `checkIn(token, locationPayload)` and `checkOut(token, locationPayload)` are exported and callable from `google.script.run`
    - Confirm `processAttendanceByQR(employeeId, locationPayload)` is exported
    - _Requirements: 2.5, 7.1_

  - [ ]* 9.2 Write integration test — admin saves geofence settings and reads back the same values
    - Save `{ enabled: true, latitude: -6.2, longitude: 106.816, radius: 200 }` via `saveGeofenceSettings`; call `getGeofenceSettings`; assert all fields match
    - _Requirements: 1.2, 1.6_

  - [ ]* 9.3 Write integration test — employee check-in with valid location payload writes location columns
    - Mock `PropertiesService` with geofencing enabled and a work location; call `processAttendance` with a payload inside the geofence; assert the appended row has non-empty values at indices 6–8 and `"employee"` at index 12
    - _Requirements: 3.4, 6.1_

  - [ ]* 9.4 Write integration test — employee check-in outside geofence is rejected with distance info
    - Mock `PropertiesService` with geofencing enabled; call `processAttendance` with a payload outside the geofence; assert `status === 'error'` and the message contains distance and radius values
    - _Requirements: 3.2_

  - [ ]* 9.5 Write integration test — QR attendance with geofencing enabled and no payload is rejected
    - Mock `PropertiesService` with geofencing enabled; call `processAttendanceByQR(employeeId, undefined)`; assert `status === 'error'`
    - _Requirements: 7.1_

  - [ ]* 9.6 Write integration test — manual admin attendance entry bypasses geofence and stores source flag
    - Mock `PropertiesService` with geofencing enabled; call `saveManualAttendance` without a location payload; assert `status === 'success'` and the written row has `"admin"` at index 12
    - _Requirements: 5.1, 5.2, 5.3_

- [ ] 10. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- Each task references specific requirements for traceability
- Property tests use **fast-check** (`fc`) in the existing Node.js/Vite test environment with a lightweight mock for `PropertiesService` and `SpreadsheetApp`
- The server is the authoritative geofence validator; the client-side Haversine computation is for UX only
- Existing attendance rows (columns A–F) must never be truncated or corrupted by the new write paths
- Location status badges must use both color and text to satisfy WCAG 1.4.1 (use of color)
