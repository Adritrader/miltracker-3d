/**
 * NASA FIRMS Thermal Anomaly Service
 *
 * Fetches VIIRS Near-Real-Time (NRT) thermal anomalies over active conflict
 * zones. In war zones these detections frequently represent explosions, burning
 * vehicles, ammunition depot fires or artillery impacts — not just wildfires.
 *
 * API key — FREE: https://firms.modaps.eosdis.nasa.gov/api/area/
 *   Set  FIRMS_MAP_KEY=<your_key>  in backend/.env
 *   Without the key this module returns [] silently (no error).
 *
 * Endpoint format:
 *   GET /api/area/csv/{MAP_KEY}/VIIRS_NOAA20_NRT/{W,S,E,N}/{DAYS}
 */

import fetch from 'node-fetch';

const FIRMS_KEY  = process.env.FIRMS_MAP_KEY;
const BASE_URL   = 'https://firms.modaps.eosdis.nasa.gov/api/area/csv';
const SOURCE     = 'VIIRS_NOAA20_NRT';  // Near-Real-Time, ~3 h latency
const DAYS       = 1;                   // Last 24 hours

// ─── Bounding boxes for active conflict zones [W, S, E, N] ──────────────────
const ZONES = [
  { name: 'ukraine',    bbox: '22,43,45,58'  },
  { name: 'middle-east',bbox: '24,8,66,43'   },
  { name: 'horn-africa',bbox: '38,-5,56,16'  },
  { name: 'sahel',      bbox: '-18,5,42,35'  },
  { name: 'myanmar',    bbox: '92,8,102,28'  },
  { name: 'east-asia',  bbox: '107,5,135,46' },
  { name: 'south-asia', bbox: '60,22,82,38'  },
  { name: 'mediterranean', bbox: '-6,30,36,42' },
];

// ─── Persistent non-military hotspots to exclude (gas flares, volcanoes) ────
// Format: [lat, lon, radius_degrees]
const PERSISTENT_HOTSPOTS = [
  // Iraq/Kuwait/Iran gas flares
  [33.0, 46.0, 2.5], [29.5, 47.5, 1.5], [30.2, 48.2, 2.0],
  // Saudi Arabia gas/oil infrastructure
  [26.0, 49.5, 3.0], [27.5, 48.5, 2.0],
  // Southern Iranian oil fields
  [30.0, 50.0, 3.0], [32.0, 48.5, 2.0], [28.9, 50.8, 1.5],
  // Sudan oil fields
  [10.0, 29.5, 1.5],
  // West African coastal flaring
  [5.0, 5.0, 2.5], [4.0, 7.5, 1.5],
  // Mediterranean volcanoes
  [38.8, 15.2, 0.6], [37.7, 15.0, 0.6], // Stromboli, Etna
  [27.1, 27.6, 0.5], // Santorini caldera area
];

function isPersistentHotspot(lat, lon) {
  return PERSISTENT_HOTSPOTS.some(([hlat, hlon, r]) => {
    const dLat = lat - hlat;
    const dLon = lon - hlon;
    return dLat * dLat + dLon * dLon < r * r;
  });
}

// ─── CSV parser ──────────────────────────────────────────────────────────────
function parseCSV(csv) {
  const lines = csv.trim().split('\n');
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(h => h.trim());
  return lines.slice(1).map(line => {
    const vals = line.split(',');
    const row  = {};
    headers.forEach((h, i) => { row[h] = (vals[i] || '').trim(); });
    return row;
  });
}

// ─── FRP → event type & severity ────────────────────────────────────────────
function classifyFRP(frp) {
  const v = +frp;
  if (v > 1000) return { type: 'explosion', severity: 'critical' };
  if (v >  400) return { type: 'airstrike', severity: 'critical' };
  if (v >  150) return { type: 'explosion', severity: 'high'     };
  if (v >   50) return { type: 'artillery', severity: 'medium'   };
  return        { type: 'fire',             severity: 'low'      };
}

// ─── Fetch one zone ──────────────────────────────────────────────────────────
async function fetchZone({ name, bbox }) {
  const url = `${BASE_URL}/${FIRMS_KEY}/${SOURCE}/${bbox}/${DAYS}`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'MilTracker3D/1.0' },
    signal:  AbortSignal.timeout(18000),
  });
  if (!res.ok) throw new Error(`FIRMS HTTP ${res.status}`);
  const csv  = await res.text();
  const rows = parseCSV(csv);

  const events = [];
  for (const r of rows) {
    const lat  = +r.latitude;
    const lon  = +r.longitude;
    const frp  = +r.frp || 0;
    const conf = r.confidence || '';

    if (isNaN(lat) || isNaN(lon)) continue;
    // Minimum FRP threshold — exclude low-intensity wildfires
    if (frp < 50) continue;
    // Confidence check (numeric or text)
    const confNum = parseInt(conf, 10);
    if (!isNaN(confNum) && confNum < 50) continue;
    if (['low', 'l'].includes(conf.toLowerCase())) continue;
    // Skip persistent industrial/volcanic hotspots
    if (isPersistentHotspot(lat, lon)) continue;

    const date  = r.acq_date || new Date().toISOString().slice(0, 10);
    const time  = (r.acq_time || '0000').padStart(4, '0');
    const hour  = time.slice(0, 2);
    const min   = time.slice(2, 4);
    const publishedAt = (() => {
      try { return new Date(`${date}T${hour}:${min}:00Z`).toISOString(); }
      catch { return new Date().toISOString(); }
    })();

    const { type, severity } = classifyFRP(frp);
    // Tiny jitter so exact-overlapping detections don't stack
    const jLat = lat + (Math.random() - 0.5) * 0.015;
    const jLon = lon + (Math.random() - 0.5) * 0.015;
    const frpRounded = Math.round(frp);

    events.push({
      id:          `firms-${date}-${time}-${lat.toFixed(3)}-${lon.toFixed(3)}`,
      type,
      title:       `Thermal anomaly · ${frpRounded} MW FRP — ${name.replace('-', ' ')} (VIIRS NRT)`,
      url:         `https://firms.modaps.eosdis.nasa.gov/map/#d:${date};@${lon.toFixed(3)},${lat.toFixed(3)},13z`,
      lat:         jLat,
      lon:         jLon,
      country:     '',
      source:      'NASA FIRMS',
      publishedAt,
      tone:        -10,
      severity,
      frp,
      zone:        name,
    });
  }
  return events;
}

// ─── Main export ─────────────────────────────────────────────────────────────
export async function fetchFIRMSEvents() {
  if (!FIRMS_KEY) {
    // Key not configured — skip silently so app works without FIRMS
    return [];
  }

  const results = await Promise.allSettled(ZONES.map(fetchZone));
  const all = [];
  let rawTotal = 0;
  for (const r of results) {
    if (r.status === 'fulfilled') {
      all.push(...r.value);
      rawTotal += r.value.length;
    } else {
      console.warn('[FIRMS] Zone fetch failed:', r.reason?.message);
    }
  }

  // Deduplicate by 0.1° grid cell (same burning area detected in adjacent passes)
  const seen    = new Set();
  const deduped = all.filter(ev => {
    const key = `${(ev.lat / 0.1).toFixed(0)}_${(ev.lon / 0.1).toFixed(0)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Sort by FRP descending so the most intense events appear first
  deduped.sort((a, b) => (b.frp || 0) - (a.frp || 0));

  console.log(`[FIRMS] ${deduped.length} thermal anomalies (${rawTotal} raw across ${ZONES.length} zones)`);
  return deduped.slice(0, 300);
}
