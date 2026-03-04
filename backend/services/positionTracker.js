/**
 * positionTracker.js – Ring-buffer of position snapshots for every tracked entity.
 *
 * Called once after every aircraft+ship poll cycle (≈30 s).
 * Stores the last HISTORY_LIMIT snapshots (default 120 = 1 hour).
 *
 * Each snapshot is intentionally lightweight: only id, lat, lon, heading,
 * velocity and altitude are kept so the payload sent to the frontend is small.
 */

const HISTORY_LIMIT = 120; // snapshots — 30 s each → ~1 hour

/** @type {Array<{ts: string, aircraft: object[], ships: object[]}>} */
const snapshots = [];

/**
 * Record a new position snapshot.
 * @param {object[]} aircraft  full aircraft objects from pollAircraft
 * @param {object[]} ships     full ship objects from pollShips
 */
export function recordSnapshot(aircraft, ships) {
  const ts = new Date().toISOString();

  snapshots.push({
    ts,
    aircraft: aircraft.map(ac => ({
      id:        ac.id || ac.icao24,
      lat:       ac.lat,
      lon:       ac.lon,
      heading:   ac.heading ?? ac.track ?? 0,
      alt:       ac.altitudeFt ?? Math.round((ac.altitude || 0) * 3.28084),
      v:         ac.velocity ?? 0,
      on_ground: !!ac.on_ground,
      callsign:  ac.callsign || '',
      flag:      ac.country || '',
      name:      ac.registration || ac.callsign || '',
      carrierOps: ac.carrierOps || null,
    })),
    ships: ships.map(sh => ({
      id:      sh.id || sh.mmsi,
      lat:     sh.lat,
      lon:     sh.lon,
      heading: sh.heading ?? 0,
      v:       sh.velocity ?? 0,
      name:    sh.name || '',
      flag:    sh.flag || '',
      source:  sh.source || '',
    })),
  });

  // Trim to ring buffer size
  if (snapshots.length > HISTORY_LIMIT) {
    snapshots.splice(0, snapshots.length - HISTORY_LIMIT);
  }
}

/**
 * Returns the full snapshot list (oldest first).
 * The frontend stores this as-is and scrubs through it.
 */
export function getHistory() {
  return snapshots;
}

/**
 * Returns min/max timestamps for the current buffer.
 */
export function getTimeRange() {
  if (snapshots.length === 0) return { start: null, end: null, count: 0 };
  return {
    start: snapshots[0].ts,
    end:   snapshots[snapshots.length - 1].ts,
    count: snapshots.length,
  };
}
