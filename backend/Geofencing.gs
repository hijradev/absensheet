// Geofencing.gs - Core geofence math and location validation logic
//
// This module provides:
//   haversineDistance(lat1, lng1, lat2, lng2) - great-circle distance in meters
//   validateLatLng(lat, lng)                  - coordinate range validation
//   validateLocation(payload)                 - full geofence validation against Script Properties
//
// Script Properties consumed:
//   GEOFENCE_ENABLED  - "true" | "false"
//   WORK_LAT          - numeric string, work location latitude
//   WORK_LNG          - numeric string, work location longitude
//   GEOFENCE_RADIUS   - numeric string, allowed radius in meters

/**
 * Compute the great-circle distance between two lat/lng points using the
 * Haversine formula. Returns distance in meters.
 *
 * @param {number} lat1 - Latitude of point 1 in decimal degrees
 * @param {number} lng1 - Longitude of point 1 in decimal degrees
 * @param {number} lat2 - Latitude of point 2 in decimal degrees
 * @param {number} lng2 - Longitude of point 2 in decimal degrees
 * @returns {number} Distance in meters
 */
function haversineDistance(lat1, lng1, lat2, lng2) {
  var R = 6371000; // Earth's mean radius in meters

  var phi1 = lat1 * Math.PI / 180;
  var phi2 = lat2 * Math.PI / 180;
  var deltaPhi = (lat2 - lat1) * Math.PI / 180;
  var deltaLambda = (lng2 - lng1) * Math.PI / 180;

  var a = Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2)
        + Math.cos(phi1) * Math.cos(phi2)
        * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);

  var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/**
 * Validate that a lat/lng pair is numerically in range.
 * Accepts lat ∈ [−90, 90] and lng ∈ [−180, 180].
 *
 * @param {number} lat - Latitude to validate
 * @param {number} lng - Longitude to validate
 * @returns {{ valid: boolean, error: string|null }}
 */
function validateLatLng(lat, lng) {
  if (typeof lat !== 'number' || typeof lng !== 'number' || isNaN(lat) || isNaN(lng)) {
    return {
      valid: false,
      error: "Invalid coordinates: latitude must be between -90 and 90, longitude between -180 and 180."
    };
  }

  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return {
      valid: false,
      error: "Invalid coordinates: latitude must be between -90 and 90, longitude between -180 and 180."
    };
  }

  return { valid: true, error: null };
}

/**
 * Validate a submitted location payload against the configured geofence.
 * Reads GEOFENCE_ENABLED, WORK_LAT, WORK_LNG, GEOFENCE_RADIUS from Script Properties.
 *
 * Returns early with { valid: true, skipped: true } when geofencing is disabled.
 *
 * @param {{ latitude: number, longitude: number, accuracy: number }|null|undefined} payload
 * @returns {{ valid: boolean, skipped: boolean, distance: number, radius: number, error: string|null }}
 */
function validateLocation(payload) {
  var scriptProps = PropertiesService.getScriptProperties();
  var enabled = scriptProps.getProperty('GEOFENCE_ENABLED');

  // When geofencing is disabled, skip all validation
  if (enabled !== 'true') {
    return { valid: true, skipped: true, distance: 0, radius: 0, error: null };
  }

  // Geofencing is enabled — payload is required
  if (!payload || typeof payload !== 'object') {
    return {
      valid: false,
      skipped: false,
      distance: 0,
      radius: 0,
      error: "Location data is required when geofencing is enabled."
    };
  }

  var lat = payload.latitude;
  var lng = payload.longitude;

  // Validate payload coordinates
  if (typeof lat !== 'number' || typeof lng !== 'number' || isNaN(lat) || isNaN(lng)) {
    return {
      valid: false,
      skipped: false,
      distance: 0,
      radius: 0,
      error: "Invalid coordinates: latitude must be between -90 and 90, longitude between -180 and 180."
    };
  }

  var coordCheck = validateLatLng(lat, lng);
  if (!coordCheck.valid) {
    return {
      valid: false,
      skipped: false,
      distance: 0,
      radius: 0,
      error: coordCheck.error
    };
  }

  // Read work location from Script Properties
  var workLatStr = scriptProps.getProperty('WORK_LAT');
  var workLngStr = scriptProps.getProperty('WORK_LNG');
  var radiusStr  = scriptProps.getProperty('GEOFENCE_RADIUS');

  if (!workLatStr || !workLngStr || !radiusStr) {
    return {
      valid: false,
      skipped: false,
      distance: 0,
      radius: 0,
      error: "Geofence is enabled but work location has not been configured. Please contact your administrator."
    };
  }

  var workLat = parseFloat(workLatStr);
  var workLng = parseFloat(workLngStr);
  var radius  = parseFloat(radiusStr);

  if (isNaN(workLat) || isNaN(workLng) || isNaN(radius)) {
    return {
      valid: false,
      skipped: false,
      distance: 0,
      radius: 0,
      error: "Geofence is enabled but work location has not been configured. Please contact your administrator."
    };
  }

  // Compute distance using Haversine formula
  var distance = Math.round(haversineDistance(workLat, workLng, lat, lng));

  if (distance > radius) {
    return {
      valid: false,
      skipped: false,
      distance: distance,
      radius: radius,
      error: "You are outside the allowed work zone. Distance: " + distance + "m, Allowed: " + radius + "m."
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
