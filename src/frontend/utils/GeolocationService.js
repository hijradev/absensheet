/**
 * GeolocationService — wraps navigator.geolocation.getCurrentPosition with a
 * Promise-based API and standardised error messages.
 *
 * Also exports haversineDistance for client-side UX distance computation
 * (the server is the authoritative validator).
 */

/**
 * Compute the great-circle distance between two lat/lng points using the
 * Haversine formula. Returns distance in meters.
 *
 * Uses the same formula as backend/Geofencing.gs (Earth radius = 6371000 m).
 *
 * @param {number} lat1
 * @param {number} lng1
 * @param {number} lat2
 * @param {number} lng2
 * @returns {number} distance in meters
 */
export function haversineDistance(lat1, lng1, lat2, lng2) {
    const R = 6371000; // Earth radius in metres
    const toRad = (deg) => (deg * Math.PI) / 180;

    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);

    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
        Math.sin(dLng / 2) * Math.sin(dLng / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

/**
 * GeolocationService — Promise-based wrapper around navigator.geolocation.
 */
export const GeolocationService = {
    /**
     * Request the device's current GPS position.
     *
     * @param {number} [timeoutMs=10000] - Maximum time to wait for a fix (ms).
     * @returns {Promise<{ latitude: number, longitude: number, accuracy: number }>}
     *   Resolves with the position on success.
     *   Rejects with a descriptive string message on failure.
     */
    getCurrentPosition(timeoutMs = 10000) {
        return new Promise((resolve, reject) => {
            if (!navigator.geolocation) {
                reject('Location services not supported by this browser.');
                return;
            }

            navigator.geolocation.getCurrentPosition(
                (position) => {
                    resolve({
                        latitude:  position.coords.latitude,
                        longitude: position.coords.longitude,
                        accuracy:  position.coords.accuracy,
                    });
                },
                (error) => {
                    switch (error.code) {
                        case error.PERMISSION_DENIED:
                            reject('Location permission denied. Please allow location access and try again.');
                            break;
                        case error.POSITION_UNAVAILABLE:
                            reject('Unable to determine your location. Please check your GPS signal.');
                            break;
                        case error.TIMEOUT:
                            reject('Location request timed out. Please try again.');
                            break;
                        default:
                            reject('Unable to determine your location. Please check your GPS signal.');
                    }
                },
                {
                    enableHighAccuracy: true,
                    timeout: timeoutMs,
                    maximumAge: 0,
                }
            );
        });
    },
};
