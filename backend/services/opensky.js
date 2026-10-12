/**
 * ADS-B Military Aircraft Fetcher
 *
 * Uses three fully free, no-registration APIs that expose a /mil endpoint
 * returning only military-tagged aircraft. Tried in order; first success wins.
 *
 *  1. api.adsb.lol    – ADS-B Exchange community feed  (no key, no account)
 *  2. opendata.adsb.fi – ADSB.fi open data             (no key, no account)
 *  3. api.airplanes.live – Airplanes.live community    (no key, no account)
 */

import fetch from 'node-fetch';

const SOURCES = [
  { name: 'adsb.lol',        url: 'https://api.adsb.lol/v2/mil' },
  { name: 'adsb.fi',         url: 'https://opendata.adsb.fi/api/v2/mil' },
  { name: 'airplanes.live',  url: 'https://api.airplanes.live/v2/mil' },
];

const HEADERS = { 'User-Agent': 'MilTracker3D/1.0', 'Accept': 'application/json' };
// 3s per source — aggressive timeout so the fallback chain completes within 9s total
// rather than 15s, safely under the 30s poll interval
const TIMEOUT_MS = 3000;
const MAX_AIRCRAFT = 500;

// Cache of last successful real data
let _lastRealAircraft = [];
let _lastSourceName = '';
// Last successful /mil result, kept separately from the merged cache so a
// /mil outage never re-serves stale merged positions as if they were fresh
let _lastGlobal = [];
let _lastGlobalAt = 0;
const GLOBAL_STALE_MS = 2 * 60 * 1000; // bridge a blip, never freeze aircraft

// ── Per-endpoint backoff (circuit breaker) ──────────────────────────────────
// A dead endpoint otherwise burns its full timeout on every 30s poll. After a
// failure, skip it for 30s, doubling per consecutive failure up to 10 min.
const BACKOFF_BASE_MS = 30 * 1000;
const BACKOFF_MAX_MS  = 10 * 60 * 1000;
const _backoff = new Map(); // key → { failures, until }

function isCoolingDown(key) {
  const b = _backoff.get(key);
  return !!b && Date.now() < b.until;
}
function recordFailure(key) {
  // Concurrent region fetches share a host: count one failure per window
  if (isCoolingDown(key)) return;
  const failures = (_backoff.get(key)?.failures || 0) + 1;
  const delay = Math.min(BACKOFF_BASE_MS * 2 ** (failures - 1), BACKOFF_MAX_MS);
  _backoff.set(key, { failures, until: Date.now() + delay });
}
function recordSuccess(key) {
  _backoff.delete(key);
}

/**
 * Normalise a raw aircraft object from any of the three APIs into our
 * internal format. All three return the same ADSB Exchange-derived schema.
 *
 * Key fields (feet for altitude, knots for speed):
 *   hex, flight, lat, lon, alt_baro, alt_geom, gs, track, baro_rate,
 *   on_ground (bool or "ground"), squawk, r, t, ownOp, year, mil
 */
function normalise(ac, sourceName) {
  const lat = ac.lat ?? ac.latitude;
  const lon = ac.lon ?? ac.longitude;
  if (lat == null || lon == null) return null;

  // altitude: prefer baro, fall back to geom — convert feet → metres
  const altFt = ac.alt_baro ?? ac.alt_geom ?? ac.altitude ?? 0;
  const altM  = altFt === 'ground' ? 0 : Math.round((+altFt || 0) * 0.3048);

  const icao24   = (ac.hex || ac.icao24 || '').toLowerCase().trim();
  const callsign = (ac.flight || ac.callsign || '').trim() || 'UNKNOWN';
  const country  = ac.ownOp || ac.origin_country || '';
  const onGround = ac.on_ground === true || ac.alt_baro === 'ground' || ac.ground === true;

  return {
    id:          icao24,
    icao24,
    callsign,
    country,
    registration: ac.r || '',
    aircraftType: ac.t || '',
    lat,
    lon,
    altitude:     altM,
    altitudeFt:   altFt === 'ground' ? 0 : (+altFt || 0),
    velocity:     ac.gs    ?? ac.velocity ?? 0,      // knots
    heading:      ac.track ?? ac.true_track ?? 0,
    vertical_rate: ac.baro_rate ?? ac.vertical_rate ?? 0,
    on_ground:    onGround,
    squawk:       ac.squawk || '',
    type:         'aircraft',
    source:       sourceName,
    dep_airport:  ac.origin      || ac.dep   || ac.departure   || '',
    arr_airport:  ac.destination || ac.dest  || ac.arrival     || '',
    lastSeen:     new Date().toISOString(),
  };
}

/**
 * Try a single source. Returns normalised array or throws.
 */
async function trySource({ name, url }) {
  const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(TIMEOUT_MS) });

  if (res.status === 429) throw new Error(`rate-limited`);
  if (!res.ok)            throw new Error(`HTTP ${res.status}`);

  const data = await res.json();

  // All three APIs wrap aircraft in an "ac" array
  const raw = data.ac ?? data.aircraft ?? data.states ?? [];
  if (!Array.isArray(raw) || raw.length === 0) throw new Error('empty response');

  const aircraft = raw
    .map(ac => normalise(ac, name))
    .filter(Boolean)
    .slice(0, MAX_AIRCRAFT);

  if (aircraft.length === 0) throw new Error('0 aircraft after normalisation');
  return aircraft;
}

export async function fetchAircraft() {
  const [milResult, gulfResult, blackSeaResult, taiwanResult, koreaResult, medResult, balticResult] = await Promise.allSettled([
    fetchMilGlobal(),
    fetchRegion('gulf',       26.5, 56.0,  700),   // Persian Gulf / Iran / UAE
    fetchRegion('black-sea',  46.5, 33.0,  650),   // Ukraine / Donbas / Black Sea
    fetchRegion('taiwan-str', 24.0, 122.0, 500),   // Taiwan Strait / East China Sea
    fetchRegion('korea',      37.5, 127.5, 450),   // Korean Peninsula
    fetchRegion('east-med',   34.5, 33.5,  600),   // Eastern Mediterranean (Syria/Lebanon/Israel)
    fetchRegion('baltic',     57.0, 20.0,  500),   // Baltic — NATO/Russia border
  ]);

  const lists = [milResult, gulfResult, blackSeaResult, taiwanResult, koreaResult, medResult, balticResult]
    .map(r => r.status === 'fulfilled' ? r.value : []);
  const [, gulfList, blackSeaList, taiwanList, koreaList, medList, balticList] = lists;
  const { aircraft: milList, fresh: milFresh } =
    milResult.status === 'fulfilled' ? milResult.value : { aircraft: [], fresh: false };
  const regionLists = [gulfList, blackSeaList, taiwanList, koreaList, medList, balticList];

  // Merge, deduplicate by icao24 — first list wins, so a stale /mil fallback
  // goes last and never overrides fresh regional positions
  const ordered = milFresh ? [milList, ...regionLists] : [...regionLists, milList];
  const seen = new Set();
  const merged = [];
  for (const list of ordered) {
    for (const a of list) {
      if (!seen.has(a.icao24)) { merged.push(a); seen.add(a.icao24); }
    }
  }

  if (merged.length > 0) {
    _lastRealAircraft = merged;
    const regionSummary = [
      gulfList.length && `Gulf:${gulfList.length}`,
      blackSeaList.length && `BlackSea:${blackSeaList.length}`,
      taiwanList.length && `Taiwan:${taiwanList.length}`,
      koreaList.length && `Korea:${koreaList.length}`,
      medList.length && `EastMed:${medList.length}`,
      balticList.length && `Baltic:${balticList.length}`,
    ].filter(Boolean).join(' ');
    console.log(`[Aircraft] ${merged.length} total — global:${milList.length} regions:[${regionSummary}]`);
    return merged;
  }

  console.warn(`[Aircraft] All sources failed — serving ${_lastRealAircraft.length} cached`);
  return _lastRealAircraft;
}

async function fetchMilGlobal() {
  for (const source of SOURCES) {
    if (isCoolingDown(source.url)) continue;
    try {
      const aircraft = await trySource(source);
      recordSuccess(source.url);
      _lastGlobal     = aircraft;
      _lastGlobalAt   = Date.now();
      _lastSourceName = source.name;
      console.log(`[Aircraft] ${aircraft.length} military aircraft from ${source.name}`);
      return { aircraft, fresh: true };
    } catch (err) {
      recordFailure(source.url);
      console.warn(`[Aircraft] ${source.name} unavailable: ${err.message}`);
    }
  }
  // All sources failed or cooling down — reuse the last /mil result only while
  // it is recent enough to bridge a short outage
  const recent = Date.now() - _lastGlobalAt < GLOBAL_STALE_MS;
  return { aircraft: recent ? _lastGlobal : [], fresh: false };
}

const GULF_CENTER = { lat: 26.5, lon: 56.0, dist: 700 }; // 700 nm radius

const MIL_TYPE_CODES = new Set([
  'F15','F16','F18','F-15','F-16','F-18','F35','F-35','F14','F-14',
  'F22','F-22',                // F-22 Raptor
  'C130','C-130','C17','C-17','C5','E3','E-3','E8','P8','P-8',
  'B52','B-52','B2','B-2','B1','B-1',
  'KC135','KC-135','KC46','KC-46', // tankers
  'A10','A-10',
  'SU27','SU30','SU34','SU35','MIG29','MIG31','TU22','TU95','TU160',
  'CH47','UH60','AH64','EH101',
  'RC135',                     // RC-135 Rivet Joint (ISR)
  'U2',                        // U-2 Dragon Lady
  'MQ9','MQ-9',                // MQ-9 Reaper
  'RQ4','RQ-4',                // RQ-4 Global Hawk
  'E2','E-2',                  // E-2 Hawkeye (carrier AEW)
  'EA18','EA-18',              // EA-18G Growler (SEAD/EW)
  'IL76',                      // Il-76 Candid transport
  'IL20',                      // Il-20 Coot-A (ISR)
  // D1: European/Russian types previously missing
  'RAFA',                      // Dassault Rafale (all variants)
  'EUFI','EF19','TPHR',        // Eurofighter Typhoon
  'SU57',                      // Sukhoi Su-57 Felon
  'JAS3','JAS39','GRPE',       // Saab JAS-39 Gripen
  'TU16',                      // Tupolev Tu-160 alt code
  'T22M',                      // Tupolev Tu-22M3 Backfire
  'IL78',                      // Ilyushin Il-78 Midas tanker
  'A400','A40M',               // Airbus A400M Atlas
  'V22','V-22','CMV22',        // Bell-Boeing V-22 Osprey
  'J10','J11','J15','J16','J20', // PLAAF fighters
  'KF21','T50',                // Korean KF-21, Russian T-50/Su-57 proto
  'AN26','AN72','AN124',       // Russian/Ukrainian transports
  'A50',                       // A-50 Mainstay (AEW)
]);

/**
 * Generic: fetch all aircraft in a lat/lon radius (nm) and keep only interesting
 * ones — military-flagged, known type codes, or fast high-altitude movers.
 */
async function fetchRegion(label, lat, lon, distNm) {
  const urls = [
    `https://api.adsb.lol/v2/lat/${lat}/lon/${lon}/dist/${distNm}`,
    `https://opendata.adsb.fi/api/v2/lat/${lat}/lon/${lon}/dist/${distNm}`,
  ];
  for (const url of urls) {
    // Back off per host (all regions share it), not per region URL
    const host = new URL(url).host;
    if (isCoolingDown(host)) continue;
    try {
      const res = await fetch(url, {
        headers: HEADERS,
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) { recordFailure(host); continue; }
      recordSuccess(host);
      const data = await res.json();
      const raw = data.ac ?? data.aircraft ?? [];
      if (!Array.isArray(raw)) continue;

      const filtered = raw
        .filter(ac => {
          if (ac.mil === true || ac.military === true) return true;
          const t = (ac.t || ac.type || '').toUpperCase();
          if (MIL_TYPE_CODES.has(t)) return true;
          const alt = +(ac.alt_baro ?? ac.alt_geom ?? 0);
          const gs  = +(ac.gs ?? ac.velocity ?? 0);
          if (alt > 15000 && gs > 350) return true;
          return false;
        })
        .map(ac => normalise(ac, label))
        .filter(Boolean)
        .slice(0, 150);

      if (filtered.length > 0) {
        console.log(`[Region:${label}] ${filtered.length} aircraft`);
        return filtered;
      }
    } catch (e) {
      recordFailure(host);
      console.warn(`[Region:${label}]`, e.message);
    }
  }
  return [];
}

// B2: fetchGulfRegion() removed — was @deprecated dead code, replaced by fetchRegion()
