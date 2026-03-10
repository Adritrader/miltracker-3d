/**
 * trajectoryAnalysis.js – Infer mission type from aircraft trail geometry.
 *
 * Analyses a trail of Cartesian3+altitude points and computes:
 *  - straightness ratio (direct distance / total path length)
 *  - total heading change & average turn rate
 *  - number of completed orbits (cumulative heading wraps)
 *  - bounding box area vs path length (compactness)
 *  - altitude variance (constant cruise vs. changing)
 *
 * Then classifies into a FLIGHT_PATTERN and infers likely MISSION.
 */

import * as Cesium from 'cesium';

/* ── Pattern enum ───────────────────────────────────────── */
export const PATTERNS = {
  ORBIT:      'ORBIT',       // circling over an area
  RACETRACK:  'RACETRACK',   // elongated oval (tanker / AWACS pattern)
  LINEAR:     'LINEAR',      // straight-line transit
  LOITER:     'LOITER',      // slow movement in compact area, not full orbits
  DESCENT:    'DESCENT',     // consistent altitude loss (approach / landing)
  CLIMB:      'CLIMB',       // consistent altitude gain (departure)
  ERRATIC:    'ERRATIC',     // unpredictable heading changes (combat / training)
  UNKNOWN:    'UNKNOWN',
};

/* ── Mission inference map ──────────────────────────────── */
const MISSION_TABLE = {
  // pattern  → { default, overrides by aircraft category }
  [PATTERNS.ORBIT]: {
    default: 'ISR / Surveillance',
    overrides: {
      tanker:  'Aerial Refueling Orbit',
      awacs:   'Airborne Early Warning',
      isr:     'ISR / Reconnaissance',
      uav:     'UAV Surveillance Orbit',
      helo:    'Helicopter Patrol / SAR',
      fighter: 'Combat Air Patrol (CAP)',
      bomber:  'Holding / Loiter',
      cargo:   'Airdrop Pattern',
    },
  },
  [PATTERNS.RACETRACK]: {
    default: 'Patrol / Racetrack',
    overrides: {
      tanker:  'Refueling Racetrack',
      awacs:   'AWACS Patrol Pattern',
      isr:     'Signals Intelligence (SIGINT)',
      uav:     'Persistent Surveillance',
      fighter: 'Combat Air Patrol (CAP)',
      helo:    'Border Patrol',
    },
  },
  [PATTERNS.LINEAR]: {
    default: 'Transit / Ferry',
    overrides: {
      tanker:  'Tanker Repositioning',
      bomber:  'Potential Strike Route',
      cargo:   'Strategic Airlift',
      fighter: 'Intercept / Scramble',
      helo:    'Point-to-Point Transfer',
      uav:     'Transit to AO',
    },
  },
  [PATTERNS.LOITER]: {
    default: 'Loiter / Holding',
    overrides: {
      isr:     'Target Area Surveillance',
      uav:     'Persistent Overwatch',
      helo:    'CAS / Hover Ops',
      awacs:   'Station Keeping',
      fighter: 'Defensive Counter-Air',
    },
  },
  [PATTERNS.DESCENT]: { default: 'Approach / Landing' },
  [PATTERNS.CLIMB]:   { default: 'Departure / Climb Out' },
  [PATTERNS.ERRATIC]: {
    default: 'Combat Maneuver / Training',
    overrides: {
      fighter: 'Air Combat Manoeuvring (ACM)',
      helo:    'NOE / Tactical Flight',
      uav:     'Evasive Manoeuvre',
    },
  },
  [PATTERNS.UNKNOWN]: { default: 'Insufficient Data' },
};

/* ── Aircraft category helper ───────────────────────────── */
const TANKER_RE   = /^(KC|K35|K46|MRTT|A330M|A310M|IL78|KC1|VKNG)/i;
const AWACS_RE    = /^(E3|E7|E2|A50|E767|B350|KJ)/i;
const ISR_RE      = /^(RC|EP|MC12|E8|U2|TR1|RQ|MQ|HRON|P3|P8|GLEX|GL[5-7]|JSTR|ASTOR)/i;
const UAV_RE      = /^(MQ|RQ|BQM|HRON|MQ1|MQ4|MQ9|RQ4|ANKA|TB2|HRPN|WING|BAYRKTR)/i;
const HELO_RE     = /^(AH|UH|CH|MH|NH|MI|KA|H[0-9]|EC|AS|V22|S70|S61|LYNX|MRLX|TIGR|R44|B06)/i;
const FIGHTER_RE  = /^(F[0-9]|FA18|SU[0-9]|MIG|EF2K|EUFI|RFAL|GRPN|JAS|J[0-9]|TPHN|TORN)/i;
const BOMBER_RE   = /^(B52|B1|B2|B21|TU95|TU160|TU22|H6)/i;
const CARGO_RE    = /^(C1[0-9]|C5|C17|C130|C2|AN|IL76|A400|KC|HERC|Y20|C27)/i;

function categorize(typeCode) {
  if (!typeCode) return 'unknown';
  const t = typeCode.trim().toUpperCase();
  if (UAV_RE.test(t))     return 'uav';
  if (TANKER_RE.test(t))  return 'tanker';
  if (AWACS_RE.test(t))   return 'awacs';
  if (ISR_RE.test(t))     return 'isr';
  if (HELO_RE.test(t))    return 'helo';
  if (FIGHTER_RE.test(t)) return 'fighter';
  if (BOMBER_RE.test(t))  return 'bomber';
  if (CARGO_RE.test(t))   return 'cargo';
  return 'unknown';
}

/* ── Geometry helpers ───────────────────────────────────── */

/** Convert Cartesian3 → {lat, lon} degrees */
function toDeg(cart) {
  const carto = Cesium.Cartographic.fromCartesian(cart);
  return {
    lat: Cesium.Math.toDegrees(carto.latitude),
    lon: Cesium.Math.toDegrees(carto.longitude),
  };
}

/** Haversine distance in metres */
function haversineM(a, b) {
  const R = 6371000;
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLon = (b.lon - a.lon) * Math.PI / 180;
  const sa = Math.sin(dLat / 2);
  const so = Math.sin(dLon / 2);
  const h = sa * sa + Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * so * so;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Bearing from A→B in degrees [0,360) */
function bearing(a, b) {
  const dLon = (b.lon - a.lon) * Math.PI / 180;
  const la = a.lat * Math.PI / 180;
  const lb = b.lat * Math.PI / 180;
  const y = Math.sin(dLon) * Math.cos(lb);
  const x = Math.cos(la) * Math.sin(lb) - Math.sin(la) * Math.cos(lb) * Math.cos(dLon);
  return ((Math.atan2(y, x) * 180 / Math.PI) + 360) % 360;
}

/** Signed angle difference (−180,+180] */
function angleDiff(a, b) {
  let d = b - a;
  while (d > 180) d -= 360;
  while (d <= -180) d += 360;
  return d;
}

/* ── Main analysis function ─────────────────────────────── */

/**
 * Analyse an aircraft's trail and return pattern + mission inference.
 *
 * @param {Array<{pos: Cesium.Cartesian3, altM: number}>} trailPoints
 * @param {string} [aircraftType] — ICAO type code for mission-specialised inference
 * @param {boolean} [isHelo] — helicopter flag
 * @returns {{ pattern, mission, confidence, metrics }}
 */
export function analyseTrajectory(trailPoints, aircraftType = '', isHelo = false) {
  if (!trailPoints || trailPoints.length < 5) {
    return {
      pattern: PATTERNS.UNKNOWN,
      mission: 'Insufficient Data',
      confidence: 0,
      metrics: null,
    };
  }

  // 1. Convert to lat/lon & compute pair-wise metrics
  const pts = trailPoints.map(p => ({ ...toDeg(p.pos), altM: p.altM }));
  const n = pts.length;

  let totalDist = 0;               // summed segment lengths (m)
  let totalAbsTurn = 0;             // sum of |turn angles|
  let totalSignedTurn = 0;          // sum of signed turns (detect net rotation)
  const bearings = [];
  const segDists = [];

  for (let i = 0; i < n - 1; i++) {
    const d = haversineM(pts[i], pts[i + 1]);
    segDists.push(d);
    totalDist += d;
    bearings.push(bearing(pts[i], pts[i + 1]));
  }

  for (let i = 0; i < bearings.length - 1; i++) {
    const turn = angleDiff(bearings[i], bearings[i + 1]);
    totalAbsTurn += Math.abs(turn);
    totalSignedTurn += turn;
  }

  // 2. Direct (start→end) distance
  const directDist = haversineM(pts[0], pts[n - 1]);

  // 3. Straightness ratio: 1.0 = perfectly straight, 0.0 = ended where it started
  const straightness = totalDist > 0 ? directDist / totalDist : 0;

  // 4. Completed orbits (how many full 360° rotations)
  const orbits = Math.abs(totalSignedTurn) / 360;

  // 5. Turn direction bias (1 = all same direction, 0 = random)
  const turnBias = totalAbsTurn > 0 ? Math.abs(totalSignedTurn) / totalAbsTurn : 0;

  // 6. Average turn rate per segment (°/segment ≈ °/30s)
  const avgTurnRate = bearings.length > 1 ? totalAbsTurn / (bearings.length - 1) : 0;

  // 7. Bounding box compactness (area of bbox vs total distance)
  let minLat = Infinity, maxLat = -Infinity, minLon = Infinity, maxLon = -Infinity;
  for (const p of pts) {
    if (p.lat < minLat) minLat = p.lat;
    if (p.lat > maxLat) maxLat = p.lat;
    if (p.lon < minLon) minLon = p.lon;
    if (p.lon > maxLon) maxLon = p.lon;
  }
  const bboxDiag = haversineM(
    { lat: minLat, lon: minLon },
    { lat: maxLat, lon: maxLon },
  );
  // Compactness: small bbox relative to path length → orbiting/loitering
  const compactness = totalDist > 0 ? bboxDiag / totalDist : 0;

  // 8. Altitude trend
  const altitudes = pts.map(p => p.altM);
  const altStart = altitudes[0];
  const altEnd = altitudes[n - 1];
  const altChange = altEnd - altStart;
  const altRange = Math.max(...altitudes) - Math.min(...altitudes);
  const altMean = altitudes.reduce((a, b) => a + b, 0) / n;
  const altVariance = altitudes.reduce((s, a) => s + (a - altMean) ** 2, 0) / n;
  const altStdDev = Math.sqrt(altVariance);

  // ── Pattern classification ───────────────────────────────────────
  let pattern = PATTERNS.UNKNOWN;
  let confidence = 0;

  // Check vertical-dominant patterns first
  const isSteadyDescent = altChange < -500 && (altChange / totalDist) < -0.05;
  const isSteadyClimb   = altChange >  500 && (altChange / totalDist) >  0.05;

  if (isSteadyDescent && straightness > 0.4) {
    pattern = PATTERNS.DESCENT;
    confidence = Math.min(0.9, 0.5 + straightness * 0.4);
  } else if (isSteadyClimb && straightness > 0.4) {
    pattern = PATTERNS.CLIMB;
    confidence = Math.min(0.9, 0.5 + straightness * 0.4);
  } else if (orbits >= 1.3 && turnBias > 0.65) {
    // Clear orbiting: >1.3 full turns, mostly same direction
    pattern = PATTERNS.ORBIT;
    confidence = Math.min(0.95, 0.5 + orbits * 0.15 + turnBias * 0.2);
  } else if (orbits >= 0.7 && compactness < 0.35 && turnBias > 0.5) {
    // Racetrack: partial orbits, elongated shape (low bboxDiag relative to path),
    // turns biased but not as strongly circling
    pattern = PATTERNS.RACETRACK;
    confidence = Math.min(0.85, 0.45 + turnBias * 0.2 + (1 - compactness) * 0.15);
  } else if (straightness > 0.75) {
    // Highly straight trajectory
    pattern = PATTERNS.LINEAR;
    confidence = Math.min(0.95, straightness);
  } else if (compactness < 0.25 && straightness < 0.35 && totalDist > 500) {
    // Compact area, not going anywhere, but not enough turns for orbit
    pattern = PATTERNS.LOITER;
    confidence = Math.min(0.8, 0.4 + (1 - compactness) * 0.2 + (1 - straightness) * 0.2);
  } else if (avgTurnRate > 25 && turnBias < 0.4 && straightness < 0.5) {
    // High turn rate in random directions
    pattern = PATTERNS.ERRATIC;
    confidence = Math.min(0.8, 0.3 + avgTurnRate / 80 + (1 - turnBias) * 0.2);
  } else if (straightness > 0.5) {
    pattern = PATTERNS.LINEAR;
    confidence = Math.min(0.7, straightness * 0.8);
  } else if (compactness < 0.35 && straightness < 0.5) {
    pattern = PATTERNS.LOITER;
    confidence = 0.4;
  } else {
    pattern = PATTERNS.UNKNOWN;
    confidence = 0.2;
  }

  // Clamp
  confidence = Math.round(confidence * 100);

  // ── Mission inference ────────────────────────────────────────────
  const cat = isHelo ? 'helo' : categorize(aircraftType);
  const missionEntry = MISSION_TABLE[pattern] || MISSION_TABLE[PATTERNS.UNKNOWN];
  const mission = (missionEntry.overrides && missionEntry.overrides[cat])
    || missionEntry.default;

  return {
    pattern,
    mission,
    confidence,
    metrics: {
      totalDistKm:  +(totalDist / 1000).toFixed(1),
      directDistKm: +(directDist / 1000).toFixed(1),
      straightness:  +straightness.toFixed(2),
      orbits:        +orbits.toFixed(2),
      turnBias:      +turnBias.toFixed(2),
      avgTurnRate:   +avgTurnRate.toFixed(1),
      compactness:   +compactness.toFixed(2),
      altChangeM:    Math.round(altChange),
      altStdDevM:    Math.round(altStdDev),
      bboxDiagKm:    +(bboxDiag / 1000).toFixed(1),
    },
  };
}
