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
const DAYS       = 2;                   // Last 48 hours — one full satellite cycle

// ─── Bounding boxes for active conflict zones [W, S, E, N] ──────────────────
// minFRP: per-zone threshold — high for regions with seasonal agricultural burns,
// low for active war frontlines where small fires = artillery/drone impacts.
const ZONES = [
  // Active war fronts — low threshold catches artillery/FPV drone impacts
  { name: 'ukraine-front',      bbox: '28,46,42,52',   minFRP:  3 },
  { name: 'gaza-west-bank',     bbox: '34,31,36,33',   minFRP:  3 },
  { name: 'lebanon',            bbox: '35,33,37,34',   minFRP:  3 },
  { name: 'syria',              bbox: '35,32,43,37',   minFRP:  5 },
  { name: 'iraq-mosul',         bbox: '40,33,46,37',   minFRP: 10 },
  // Iran: tight boxes around conflict/nuclear sites only (avoid vast gas flare coverage)
  { name: 'iran-tehran',        bbox: '50,34,53,37',   minFRP: 30 }, // IRGC HQ + capital
  { name: 'iran-natanz',        bbox: '51,33,53,35',   minFRP: 30 }, // nuclear enrichment
  { name: 'iran-isfahan',       bbox: '51,31,53,33',   minFRP: 30 }, // air base + facility
  { name: 'hormuz-bandarabbas', bbox: '54,26,59,28',   minFRP: 30 }, // port/naval
  // Gulf States — high minFRP cuts routine gas-flare noise; real explosions are 300-2000 MW
  { name: 'bahrain',            bbox: '50,25,51.5,26.8', minFRP: 200 }, // BAPCO refinery + 5th Fleet
  { name: 'kuwait-city',        bbox: '47,28.5,48.5,30', minFRP: 200 }, // US air base + oil
  { name: 'uae-dubai-abudhabi', bbox: '53,24,56.5,25.8', minFRP: 200 }, // Dubai + Abu Dhabi
  { name: 'saudi-dhahran',      bbox: '49,25.5,51,27',   minFRP: 200 }, // Aramco Dhahran/Ras Tanura
  { name: 'yemen',              bbox: '42,12,54,19',   minFRP:  8 },
  // Red Sea Houthi corridor
  { name: 'red-sea-houthi',     bbox: '38,13,45,22',   minFRP: 15 },
  // Sudan — active RSF/SAF fighting; high threshold to skip Sahel burns
  { name: 'sudan-khartoum',     bbox: '30,13,37,18',   minFRP: 25 },
  { name: 'darfur',             bbox: '22,10,30,16',   minFRP: 30 },
  // Somalia
  { name: 'somalia',            bbox: '40,0,51,12',    minFRP: 40 },
  // Myanmar — junta airstrikes
  { name: 'myanmar-sagaing',    bbox: '93,19,98,25',   minFRP: 20 },
  // Kashmir / LoC
  { name: 'kashmir',            bbox: '73,32,77,36',   minFRP: 20 },
];

// ─── Persistent non-military hotspots to exclude (gas flares, volcanoes) ────
// Format: [lat, lon, radius_degrees]
const PERSISTENT_HOTSPOTS = [
  // Iraq/Kuwait/Iran gas flares (Khuzestan, Kirkuk, Basra, Rumaila)
  [33.0, 46.0, 2.5], [29.5, 47.5, 1.5], [30.2, 48.2, 2.0],
  [31.5, 47.5, 1.5], [30.8, 47.8, 1.0], [32.5, 45.8, 1.5],
  [33.8, 44.5, 1.5], // Baghdad area flares
  // Southern Iran / Khuzestan oil fields
  [30.0, 50.0, 3.0], [32.0, 48.5, 2.5], [28.9, 50.8, 2.0],
  [30.5, 49.5, 2.0], [31.5, 49.0, 2.0], [31.0, 50.5, 1.5],
  [29.5, 50.5, 2.0], [30.8, 48.8, 2.0],
  // Saudi Arabia / UAE oil/gas infrastructure — radii tightened so large explosions
  // at refineries (FRP > 300) can still be detected (see isPersistentHotspot bypass below)
  [27.5, 48.5, 1.5], // Saudi interior gas fields (away from coast)
  [25.7, 56.2, 1.5], // Oman Musandam gas
  // Sudan oil fields
  [10.0, 29.5, 1.5],
  // West African coastal flaring (Nigeria delta)
  [5.0, 5.0, 2.5], [4.0, 7.5, 1.5], [5.5, 6.5, 2.0],
  // Mediterranean volcanoes
  [38.8, 15.2, 0.6], [37.7, 15.0, 0.6], // Stromboli, Etna
  [27.1, 27.6, 0.5], // Santorini caldera area
];

// frp > 300 MW = almost certainly a major explosion/fire, not a routine gas flare
// (gas flares are typically 10-80 MW; refinery/depot fires are 300-2000+ MW)
const HOTSPOT_BYPASS_FRP = 300;

function isPersistentHotspot(lat, lon, frp = 0) {
  if (frp >= HOTSPOT_BYPASS_FRP) return false; // always show catastrophic events
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
// War-zone calibration (artillery/drone strikes = 5-40 MW, large strikes = 50-200 MW)
function classifyFRP(frp) {
  const v = +frp;
  if (v > 500) return { type: 'explosion', severity: 'critical' };
  if (v > 150) return { type: 'airstrike', severity: 'critical' };
  if (v >  50) return { type: 'explosion', severity: 'high'     };
  if (v >  15) return { type: 'artillery', severity: 'medium'   };
  if (v >   5) return { type: 'fire',      severity: 'low'      };
  return        { type: 'fire',            severity: 'low'      };
}

// ─── Fetch one zone ──────────────────────────────────────────────────────────
async function fetchZone({ name, bbox, minFRP = 5 }) {
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
    // Per-zone minimum FRP threshold
    if (frp < minFRP) continue;
    // Confidence check: VIIRS uses 'l','n','h' (low/nominal/high)
    const confLower = conf.toLowerCase();
    if (confLower === 'l' || confLower === 'low') continue;
    // Skip persistent industrial/volcanic hotspots (bypassed for very high FRP = real explosions)
    if (isPersistentHotspot(lat, lon, frp)) continue;

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

  // Deduplicate by 0.2° grid cell (same burning area in adjacent passes)
  const seen    = new Set();
  const deduped = all.filter(ev => {
    const key = `${(ev.lat / 0.2).toFixed(0)}_${(ev.lon / 0.2).toFixed(0)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Sort by FRP descending so the most intense events appear first
  deduped.sort((a, b) => (b.frp || 0) - (a.frp || 0));

  console.log(`[FIRMS] ${deduped.length} thermal anomalies (${rawTotal} raw across ${ZONES.length} zones)`);
  return deduped.slice(0, 400);
}
