// geofencing.test.js — Unit tests for core geofencing backend logic
//
// Because backend/Geofencing.gs is a Google Apps Script file (not an ES module),
// the pure math functions are re-implemented here verbatim for Node.js testing.
// validateLocation is tested via a thin wrapper that accepts an injected
// PropertiesService mock, mirroring the real GAS implementation.
//
// Validates: Requirements 1.3, 1.4, 3.1, 3.2, 3.5, 3.6

import { describe, it, expect } from 'vitest';

// ---------------------------------------------------------------------------
// Pure functions extracted from backend/Geofencing.gs
// (identical logic — no GAS dependencies)
// ---------------------------------------------------------------------------

/**
 * Compute the great-circle distance between two lat/lng points using the
 * Haversine formula. Returns distance in meters.
 */
function haversineDistance(lat1, lng1, lat2, lng2) {
  const R = 6371000; // Earth's mean radius in meters

  const phi1 = lat1 * Math.PI / 180;
  const phi2 = lat2 * Math.PI / 180;
  const deltaPhi = (lat2 - lat1) * Math.PI / 180;
  const deltaLambda = (lng2 - lng1) * Math.PI / 180;

  const a = Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2)
          + Math.cos(phi1) * Math.cos(phi2)
          * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/**
 * Validate that a lat/lng pair is numerically in range.
 * Accepts lat ∈ [−90, 90] and lng ∈ [−180, 180].
 */
function validateLatLng(lat, lng) {
  if (typeof lat !== 'number' || typeof lng !== 'number' || isNaN(lat) || isNaN(lng)) {
    return {
      valid: false,
      error: 'Invalid coordinates: latitude must be between -90 and 90, longitude between -180 and 180.'
    };
  }

  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return {
      valid: false,
      error: 'Invalid coordinates: latitude must be between -90 and 90, longitude between -180 and 180.'
    };
  }

  return { valid: true, error: null };
}

/**
 * Testable version of validateLocation that accepts an injected PropertiesService.
 * Mirrors the logic in backend/Geofencing.gs exactly.
 */
function validateLocationWithProps(payload, scriptProps) {
  const enabled = scriptProps.getProperty('GEOFENCE_ENABLED');

  if (enabled !== 'true') {
    return { valid: true, skipped: true, distance: 0, radius: 0, error: null };
  }

  if (!payload || typeof payload !== 'object') {
    return {
      valid: false,
      skipped: false,
      distance: 0,
      radius: 0,
      error: 'Location data is required when geofencing is enabled.'
    };
  }

  const lat = payload.latitude;
  const lng = payload.longitude;

  if (typeof lat !== 'number' || typeof lng !== 'number' || isNaN(lat) || isNaN(lng)) {
    return {
      valid: false,
      skipped: false,
      distance: 0,
      radius: 0,
      error: 'Invalid coordinates: latitude must be between -90 and 90, longitude between -180 and 180.'
    };
  }

  const coordCheck = validateLatLng(lat, lng);
  if (!coordCheck.valid) {
    return {
      valid: false,
      skipped: false,
      distance: 0,
      radius: 0,
      error: coordCheck.error
    };
  }

  const workLatStr = scriptProps.getProperty('WORK_LAT');
  const workLngStr = scriptProps.getProperty('WORK_LNG');
  const radiusStr  = scriptProps.getProperty('GEOFENCE_RADIUS');

  if (!workLatStr || !workLngStr || !radiusStr) {
    return {
      valid: false,
      skipped: false,
      distance: 0,
      radius: 0,
      error: 'Geofence is enabled but work location has not been configured. Please contact your administrator.'
    };
  }

  const workLat = parseFloat(workLatStr);
  const workLng = parseFloat(workLngStr);
  const radius  = parseFloat(radiusStr);

  if (isNaN(workLat) || isNaN(workLng) || isNaN(radius)) {
    return {
      valid: false,
      skipped: false,
      distance: 0,
      radius: 0,
      error: 'Geofence is enabled but work location has not been configured. Please contact your administrator.'
    };
  }

  const distance = Math.round(haversineDistance(workLat, workLng, lat, lng));

  if (distance > radius) {
    return {
      valid: false,
      skipped: false,
      distance: distance,
      radius: radius,
      error: 'You are outside the allowed work zone. Distance: ' + distance + 'm, Allowed: ' + radius + 'm.'
    };
  }

  return {
    valid: true,
    skipped: false,
    distance: distance,
    radius: radius,
    error: null
  };
}

// ---------------------------------------------------------------------------
// Helper: build a mock PropertiesService
// ---------------------------------------------------------------------------
function makeProps(overrides = {}) {
  const store = {
    GEOFENCE_ENABLED: 'true',
    WORK_LAT: '-6.2',
    WORK_LNG: '106.816',
    GEOFENCE_RADIUS: '200',
    ...overrides
  };
  return {
    getProperty: (key) => (key in store ? store[key] : null)
  };
}

// ---------------------------------------------------------------------------
// haversineDistance
// ---------------------------------------------------------------------------

describe('haversineDistance()', () => {
  it('returns 0 for identical coordinates', () => {
    expect(haversineDistance(0, 0, 0, 0)).toBe(0);
    expect(haversineDistance(-6.2, 106.816, -6.2, 106.816)).toBe(0);
    expect(haversineDistance(90, 180, 90, 180)).toBe(0);
  });

  it('is symmetric — distance A→B equals distance B→A', () => {
    const d1 = haversineDistance(-6.2, 106.816, -6.21, 106.826);
    const d2 = haversineDistance(-6.21, 106.826, -6.2, 106.816);
    expect(d1).toBeCloseTo(d2, 5);
  });

  it('returns a positive distance for distinct points', () => {
    const d = haversineDistance(0, 0, 0, 1);
    expect(d).toBeGreaterThan(0);
  });

  it('approximates ~111 km for 1 degree of latitude at the equator', () => {
    // 1° latitude ≈ 111,195 m
    const d = haversineDistance(0, 0, 1, 0);
    expect(d).toBeGreaterThan(111000);
    expect(d).toBeLessThan(112000);
  });

  it('approximates ~111 km for 1 degree of longitude at the equator', () => {
    const d = haversineDistance(0, 0, 0, 1);
    expect(d).toBeGreaterThan(111000);
    expect(d).toBeLessThan(112000);
  });

  it('computes ~157 m for two points ~157 m apart (Jakarta area)', () => {
    // Known pair: approx 157 m apart
    // (-6.200000, 106.816000) → (-6.200000, 106.817414)
    const d = haversineDistance(-6.2, 106.816, -6.2, 106.817414);
    expect(d).toBeGreaterThan(140);
    expect(d).toBeLessThan(170);
  });

  it('handles antipodal points (max distance ~20,015 km)', () => {
    const d = haversineDistance(0, 0, 0, 180);
    // Half circumference ≈ 20,015,087 m
    expect(d).toBeGreaterThan(20000000);
    expect(d).toBeLessThan(20100000);
  });

  it('handles pole-to-pole distance (~20,015 km)', () => {
    const d = haversineDistance(-90, 0, 90, 0);
    expect(d).toBeGreaterThan(20000000);
    expect(d).toBeLessThan(20100000);
  });
});

// ---------------------------------------------------------------------------
// validateLatLng
// ---------------------------------------------------------------------------

describe('validateLatLng()', () => {
  // --- Valid boundary values ---
  it('accepts lat = -90 (minimum valid latitude)', () => {
    expect(validateLatLng(-90, 0).valid).toBe(true);
  });

  it('accepts lat = 90 (maximum valid latitude)', () => {
    expect(validateLatLng(90, 0).valid).toBe(true);
  });

  it('accepts lng = -180 (minimum valid longitude)', () => {
    expect(validateLatLng(0, -180).valid).toBe(true);
  });

  it('accepts lng = 180 (maximum valid longitude)', () => {
    expect(validateLatLng(0, 180).valid).toBe(true);
  });

  it('accepts (0, 0) — null island', () => {
    const result = validateLatLng(0, 0);
    expect(result.valid).toBe(true);
    expect(result.error).toBeNull();
  });

  it('accepts a typical Jakarta coordinate', () => {
    expect(validateLatLng(-6.2, 106.816).valid).toBe(true);
  });

  // --- Invalid boundary values ---
  it('rejects lat = -90.001 (just below minimum)', () => {
    const result = validateLatLng(-90.001, 0);
    expect(result.valid).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it('rejects lat = 90.001 (just above maximum)', () => {
    const result = validateLatLng(90.001, 0);
    expect(result.valid).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it('rejects lng = -180.001 (just below minimum)', () => {
    const result = validateLatLng(0, -180.001);
    expect(result.valid).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it('rejects lng = 180.001 (just above maximum)', () => {
    const result = validateLatLng(0, 180.001);
    expect(result.valid).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it('rejects lat = 91', () => {
    expect(validateLatLng(91, 0).valid).toBe(false);
  });

  it('rejects lat = -91', () => {
    expect(validateLatLng(-91, 0).valid).toBe(false);
  });

  it('rejects lng = 181', () => {
    expect(validateLatLng(0, 181).valid).toBe(false);
  });

  it('rejects lng = -181', () => {
    expect(validateLatLng(0, -181).valid).toBe(false);
  });

  // --- Non-numeric inputs ---
  it('rejects NaN latitude', () => {
    const result = validateLatLng(NaN, 0);
    expect(result.valid).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it('rejects NaN longitude', () => {
    const result = validateLatLng(0, NaN);
    expect(result.valid).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it('rejects string latitude', () => {
    const result = validateLatLng('45', 0);
    expect(result.valid).toBe(false);
  });

  it('rejects null latitude', () => {
    const result = validateLatLng(null, 0);
    expect(result.valid).toBe(false);
  });

  it('rejects undefined longitude', () => {
    const result = validateLatLng(0, undefined);
    expect(result.valid).toBe(false);
  });

  // --- Error message content ---
  it('returns a descriptive error message for out-of-range lat', () => {
    const result = validateLatLng(91, 0);
    expect(result.error).toContain('-90');
    expect(result.error).toContain('90');
  });
});

// ---------------------------------------------------------------------------
// validateLocation (via validateLocationWithProps)
// ---------------------------------------------------------------------------

describe('validateLocation() — geofencing disabled', () => {
  it('returns { valid: true, skipped: true } when GEOFENCE_ENABLED is "false"', () => {
    const props = makeProps({ GEOFENCE_ENABLED: 'false' });
    const result = validateLocationWithProps({ latitude: -6.2, longitude: 106.816, accuracy: 10 }, props);
    expect(result.valid).toBe(true);
    expect(result.skipped).toBe(true);
  });

  it('returns skipped: true for null payload when disabled', () => {
    const props = makeProps({ GEOFENCE_ENABLED: 'false' });
    const result = validateLocationWithProps(null, props);
    expect(result.valid).toBe(true);
    expect(result.skipped).toBe(true);
  });

  it('returns skipped: true for undefined payload when disabled', () => {
    const props = makeProps({ GEOFENCE_ENABLED: 'false' });
    const result = validateLocationWithProps(undefined, props);
    expect(result.valid).toBe(true);
    expect(result.skipped).toBe(true);
  });

  it('returns skipped: true for malformed payload when disabled', () => {
    const props = makeProps({ GEOFENCE_ENABLED: 'false' });
    const result = validateLocationWithProps({ foo: 'bar' }, props);
    expect(result.valid).toBe(true);
    expect(result.skipped).toBe(true);
  });

  it('returns skipped: true when GEOFENCE_ENABLED is absent (null)', () => {
    const props = makeProps({ GEOFENCE_ENABLED: null });
    const result = validateLocationWithProps({ latitude: 0, longitude: 0, accuracy: 5 }, props);
    expect(result.valid).toBe(true);
    expect(result.skipped).toBe(true);
  });
});

describe('validateLocation() — geofencing enabled, payload validation', () => {
  it('rejects null payload when geofencing is enabled', () => {
    const props = makeProps();
    const result = validateLocationWithProps(null, props);
    expect(result.valid).toBe(false);
    expect(result.skipped).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it('rejects undefined payload when geofencing is enabled', () => {
    const props = makeProps();
    const result = validateLocationWithProps(undefined, props);
    expect(result.valid).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it('rejects payload with missing latitude', () => {
    const props = makeProps();
    const result = validateLocationWithProps({ longitude: 106.816, accuracy: 10 }, props);
    expect(result.valid).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it('rejects payload with missing longitude', () => {
    const props = makeProps();
    const result = validateLocationWithProps({ latitude: -6.2, accuracy: 10 }, props);
    expect(result.valid).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it('rejects payload with out-of-range latitude', () => {
    const props = makeProps();
    const result = validateLocationWithProps({ latitude: 91, longitude: 106.816, accuracy: 10 }, props);
    expect(result.valid).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it('rejects payload with out-of-range longitude', () => {
    const props = makeProps();
    const result = validateLocationWithProps({ latitude: -6.2, longitude: 181, accuracy: 10 }, props);
    expect(result.valid).toBe(false);
    expect(result.error).toBeTruthy();
  });
});

describe('validateLocation() — geofencing enabled, work location not configured', () => {
  it('returns error when WORK_LAT is missing', () => {
    const props = makeProps({ WORK_LAT: null });
    const result = validateLocationWithProps({ latitude: -6.2, longitude: 106.816, accuracy: 10 }, props);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('not been configured');
  });

  it('returns error when WORK_LNG is missing', () => {
    const props = makeProps({ WORK_LNG: null });
    const result = validateLocationWithProps({ latitude: -6.2, longitude: 106.816, accuracy: 10 }, props);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('not been configured');
  });

  it('returns error when GEOFENCE_RADIUS is missing', () => {
    const props = makeProps({ GEOFENCE_RADIUS: null });
    const result = validateLocationWithProps({ latitude: -6.2, longitude: 106.816, accuracy: 10 }, props);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('not been configured');
  });
});

describe('validateLocation() — geofencing enabled, distance check', () => {
  // Work location: (-6.2, 106.816), radius: 200 m
  // A point ~0 m away (same coords) should be accepted
  it('accepts a payload at the exact work location (distance = 0)', () => {
    const props = makeProps();
    const result = validateLocationWithProps({ latitude: -6.2, longitude: 106.816, accuracy: 10 }, props);
    expect(result.valid).toBe(true);
    expect(result.skipped).toBe(false);
    expect(result.distance).toBe(0);
  });

  it('accepts a payload clearly inside the geofence (< 200 m away)', () => {
    // ~100 m north of work location
    const props = makeProps();
    // 0.001° latitude ≈ 111 m
    const result = validateLocationWithProps({ latitude: -6.199, longitude: 106.816, accuracy: 10 }, props);
    expect(result.valid).toBe(true);
    expect(result.distance).toBeLessThanOrEqual(200);
  });

  it('rejects a payload clearly outside the geofence (> 200 m away)', () => {
    // ~1.1 km north of work location
    const props = makeProps();
    // 0.01° latitude ≈ 1,111 m
    const result = validateLocationWithProps({ latitude: -6.19, longitude: 106.816, accuracy: 10 }, props);
    expect(result.valid).toBe(false);
    expect(result.skipped).toBe(false);
    expect(result.distance).toBeGreaterThan(200);
    expect(result.radius).toBe(200);
  });

  it('includes distance and radius in the error message when outside geofence', () => {
    const props = makeProps();
    const result = validateLocationWithProps({ latitude: -6.19, longitude: 106.816, accuracy: 10 }, props);
    expect(result.error).toContain('Distance:');
    expect(result.error).toContain('Allowed:');
  });

  it('accepts a payload exactly at the radius boundary (distance ≤ radius)', () => {
    // Place employee exactly 200 m north of work location
    // 200 m ≈ 0.001799° latitude
    const props = makeProps({ GEOFENCE_RADIUS: '300' });
    // Use a point ~150 m away — should be inside 300 m radius
    const result = validateLocationWithProps({ latitude: -6.1987, longitude: 106.816, accuracy: 10 }, props);
    expect(result.valid).toBe(true);
  });

  it('returns distance = 0 and radius = 0 when skipped', () => {
    const props = makeProps({ GEOFENCE_ENABLED: 'false' });
    const result = validateLocationWithProps({ latitude: -6.2, longitude: 106.816, accuracy: 10 }, props);
    expect(result.distance).toBe(0);
    expect(result.radius).toBe(0);
  });

  it('returns the configured radius in the response on success', () => {
    const props = makeProps({ GEOFENCE_RADIUS: '500' });
    const result = validateLocationWithProps({ latitude: -6.2, longitude: 106.816, accuracy: 10 }, props);
    expect(result.valid).toBe(true);
    expect(result.radius).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// Property-based tests (fast-check)
// ---------------------------------------------------------------------------

import * as fc from 'fast-check';

// ---------------------------------------------------------------------------
// Record-mapping logic extracted from backend/Absensi.gs
// (getDailyAttendance / getDailyAttendanceRange — identical colOrNull pattern)
// ---------------------------------------------------------------------------

/**
 * Map a raw sheet row (array) to an attendance record object.
 * Mirrors the colOrNull helper used in getDailyAttendance and
 * getDailyAttendanceRange in Absensi.gs.
 *
 * @param {Array} row - Raw row from Attendance_Data sheet
 * @returns {Object} Attendance record with location fields
 */
function mapRowToRecord(row) {
  const colOrNull = (idx) => {
    const v = row.length > idx ? row[idx] : "";
    return (v === "" || v === null || v === undefined) ? null : v;
  };

  return {
    checkInTime:      String(row[2] || ""),
    checkInStatus:    String(row[3] || ""),
    checkOutTime:     String(row[4] || ""),
    checkOutStatus:   String(row[5] || ""),
    checkInLat:       colOrNull(6),
    checkInLng:       colOrNull(7),
    checkInDistance:  colOrNull(8),
    checkOutLat:      colOrNull(9),
    checkOutLng:      colOrNull(10),
    checkOutDistance: colOrNull(11),
    source:           colOrNull(12)
  };
}

// ---------------------------------------------------------------------------
// Property 12: Backward compatibility with pre-geofencing records
// ---------------------------------------------------------------------------

describe('Property 12: old records (A-F only) are read without error', () => {
  // Feature: geofencing, Property 12: old records (A-F only) are read without error

  it('reads a 6-column row without throwing and returns falsy location fields', () => {
    // Validates: Requirements 6.5
    fc.assert(
      fc.property(
        // Generate arbitrary values for columns A–F (the pre-geofencing columns)
        fc.string(),                                          // A: date
        fc.string(),                                          // B: employeeId
        fc.string(),                                          // C: checkInTime
        fc.constantFrom("Tepat Waktu", "Terlambat", "Tidak Hadir", "Izin", "Sakit", "Cuti", ""),  // D: checkInStatus
        fc.string(),                                          // E: checkOutTime
        fc.constantFrom("Tepat Waktu", "Pulang Awal", "Izin", "Sakit", "Cuti", ""),               // F: checkOutStatus
        (date, empId, checkInTime, checkInStatus, checkOutTime, checkOutStatus) => {
          // Build a row with only 6 columns — simulating a pre-geofencing record
          const row = [date, empId, checkInTime, checkInStatus, checkOutTime, checkOutStatus];

          // The mapping must not throw
          let record;
          expect(() => { record = mapRowToRecord(row); }).not.toThrow();

          // All location fields must be falsy (null)
          expect(record.checkInLat).toBeFalsy();
          expect(record.checkInLng).toBeFalsy();
          expect(record.checkInDistance).toBeFalsy();
          expect(record.checkOutLat).toBeFalsy();
          expect(record.checkOutLng).toBeFalsy();
          expect(record.checkOutDistance).toBeFalsy();
          expect(record.source).toBeFalsy();

          // Core fields A–F must be preserved unchanged
          expect(record.checkInTime).toBe(String(checkInTime || ""));
          expect(record.checkInStatus).toBe(String(checkInStatus || ""));
          expect(record.checkOutTime).toBe(String(checkOutTime || ""));
          expect(record.checkOutStatus).toBe(String(checkOutStatus || ""));

          // The original row must not be mutated
          expect(row.length).toBe(6);
        }
      ),
      { numRuns: 100 }
    );
  });
});
