/**
 * Geo utilities for MilTracker 3D
 */

// Haversine distance in km
export function distanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Convert meters to feet
export function metersToFeet(m) { return Math.round(m * 3.28084); }

// Convert m/s to knots
export function msToKnots(ms) { return Math.round(ms * 1.94384); }

// Convert m/s to km/h
export function msToKmh(ms) { return Math.round(ms * 3.6); }

// Degrees to compass heading label
export function headingToCompass(deg) {
  const dirs = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE',
    'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  return dirs[Math.round(deg / 22.5) % 16];
}

// Time ago formatter
export function timeAgo(isoString) {
  if (!isoString) return 'N/A';
  const seconds = Math.floor((Date.now() - new Date(isoString)) / 1000);
  if (seconds < 5) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

// Format altitude with ft / km
export function formatAltitude(meters) {
  if (!meters || meters <= 0) return 'GND';
  const ft = metersToFeet(meters);
  if (ft > 1000) return `${Math.round(ft / 100) / 10}k ft`;
  return `${ft} ft`;
}

// Format speed
export function formatSpeed(ms) {
  if (!ms || ms <= 0) return '0 kn';
  return `${msToKnots(ms)} kn`;
}

// Check if coordinate is valid
export function isValidCoord(lat, lon) {
  return typeof lat === 'number' && typeof lon === 'number' &&
    lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180 &&
    !isNaN(lat) && !isNaN(lon);
}
