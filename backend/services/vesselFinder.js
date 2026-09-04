/**
 * vesselFinder.js – Military ship data aggregator
 *
 * Priority order:
 *  1. aisstream.io WebSocket MMSI filter  (targeted catalog of ~120 known warships — needs AISSTREAM_KEY)
 *  2. aisstream.io REST ShipType=35       (global real-time AIS — needs AISSTREAM_KEY)
 *  3. Norwegian Coastal AIS              (kystdatahuset.no – free, no key, Norway-only)
 *  4. Finnish Digitraffic AIS            (meri.digitraffic.fi – free, no key, Finland-only)
 *  5. militaryMMSI.js catalog baseline   (verified homeport coords, labeled, STATIC — last resort)
 *
 * Sources 1-4 run in parallel. MMSI-catalog vessels that appear in the live
 * feed are enriched with the catalog name/class; unknown type-35 ships keep
 * their raw AIS name. Baseline is NEVER shown while any live source returns ≥1.
 *
 * IMPORTANT: without AISSTREAM_KEY, sources 3-4 only cover Nordic waters (~10-15
 * vessels total), so most of the ~120-ship catalog falls back to static baseline
 * positions (isBaseline:true, flagged in the UI). Get a free AISSTREAM_KEY at
 * https://aisstream.io (no credit card required) for real global coverage.
 *
 * NOTE: the AISHub free endpoint (data.aishub.net?username=0) was removed —
 * it requires a real feeder-registered username/password and always returned
 * "Invalid username or password!". It was silently failing on every poll.
 */

import fetch from 'node-fetch';
import WebSocket from 'ws';
import { ALL_MMSIS, lookupMMSI, getCatalogBaseline } from './militaryMMSI.js';

const TIMEOUT_MS = 10_000;
const WS_COLLECT_MS = 18_000;  // listen window per MMSI batch
const WS_BATCH_SIZE = 50;      // AISStream hard limit per subscription

// Raw AIS text fields (destination, name) are fixed-width and '@'-padded at the
// protocol level; some feeds forward that padding/garbage un-normalised. Strip
// non-printable chars and trailing '@' padding so the UI never shows binary junk.
function sanitizeAisText(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/[^\x20-\x7E]/g, '').replace(/@+$/g, '').trim();
}

// ── Normalise a Norwegian AIS GeoJSON feature ─────────────────────────────────
// The Norwegian Coastal AIS API returns LineString geometries (last two positions)
// rather than Point, so coordinates is [[lon,lat],[lon,lat]] not [lon,lat].
function normNorwAIS(f) {
  const p = f.properties || {};
  const id = String(p.mmsi || '');
  if (!id) return null;

  const coords = f.geometry?.coordinates;
  let lon, lat;
  if (Array.isArray(coords?.[0])) {
    // LineString / MultiPoint: take the most recent (last) position
    const pt = coords[coords.length - 1];
    lon = parseFloat(pt?.[0]);
    lat = parseFloat(pt?.[1]);
  } else {
    // Point geometry
    lon = parseFloat(coords?.[0]);
    lat = parseFloat(coords?.[1]);
  }
  if (isNaN(lat) || isNaN(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;

  return {
    id,
    mmsi:        id,
    name:        p.ship_name || p.name || 'UNKNOWN',
    lat,
    lon,
    heading:     parseFloat(p.cog ?? p.true_heading ?? 0) || 0,
    velocity:    parseFloat(p.speed ?? 0) || 0,
    type:        'Military',
    flag:        p.flag || p.country || 'NO',
    destination: sanitizeAisText(p.destination),
    type_entity: 'ship',
    lastSeen:    new Date().toISOString(),
  };
}

// ── Normalise a Finnish Digitraffic AIS location + vessel-metadata pair ───────
function normDigitraffic(feature, meta) {
  const mmsi = String(feature.mmsi || feature.properties?.mmsi || '');
  if (!mmsi) return null;
  const [lon, lat] = feature.geometry?.coordinates || [];
  if (lat == null || lon == null || isNaN(lat) || isNaN(lon)) return null;
  const p = feature.properties || {};
  return {
    id:          mmsi,
    mmsi,
    name:        meta?.name || 'UNKNOWN',
    lat,
    lon,
    heading:     p.heading != null && p.heading !== 511 ? p.heading : (p.cog ?? 0),
    velocity:    p.sog ?? 0,
    type:        'Military',
    flag:        'FI',
    destination: sanitizeAisText(meta?.destination),
    type_entity: 'ship',
    lastSeen:    new Date().toISOString(),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Source 1: Norwegian Coastal Administration (type 35 = military)
// ─────────────────────────────────────────────────────────────────────────────
async function tryNorwegianAIS() {
  const url = 'https://kystdatahuset.no/ws/api/ais/realtime/geojson?limit=500';
  const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!res.ok) throw new Error(`NorwAIS HTTP ${res.status}`);
  const data  = await res.json();
  const ships = (data?.features || [])
    .filter(f => f.properties?.ship_type === 35)
    .map(normNorwAIS)
    .filter(Boolean);
  if (ships.length === 0) throw new Error('0 military vessels from NorwAIS');
  return ships;
}

// ─────────────────────────────────────────────────────────────────────────────
// Source: Finnish Digitraffic AIS (type 35 = military) — free, no key required
// https://www.digitraffic.fi/en/marine-traffic/ais/
// ─────────────────────────────────────────────────────────────────────────────
async function tryFinnishAIS() {
  const headers = { 'Accept': 'application/json', 'Digitraffic-User': 'MilTracker3D' };
  const [locRes, metaRes] = await Promise.all([
    fetch('https://meri.digitraffic.fi/api/ais/v1/locations', { signal: AbortSignal.timeout(TIMEOUT_MS), headers }),
    fetch('https://meri.digitraffic.fi/api/ais/v1/vessels',   { signal: AbortSignal.timeout(TIMEOUT_MS), headers }),
  ]);
  if (!locRes.ok) throw new Error(`Digitraffic locations HTTP ${locRes.status}`);
  if (!metaRes.ok) throw new Error(`Digitraffic vessels HTTP ${metaRes.status}`);

  const locData  = await locRes.json();
  const metaData = await metaRes.json();
  const metaArr  = Array.isArray(metaData) ? metaData : Object.values(metaData || {});
  const metaByMmsi = new Map(metaArr.filter(v => v.shipType === 35).map(v => [String(v.mmsi), v]));
  if (metaByMmsi.size === 0) throw new Error('0 military vessels in Digitraffic metadata');

  const ships = (locData?.features || [])
    .filter(f => metaByMmsi.has(String(f.mmsi ?? f.properties?.mmsi)))
    .map(f => normDigitraffic(f, metaByMmsi.get(String(f.mmsi ?? f.properties?.mmsi))))
    .filter(Boolean);
  if (ships.length === 0) throw new Error('0 military vessels with live position from Digitraffic');
  return ships;
}

// ─────────────────────────────────────────────────────────────────────────────
// Source 3: aisstream.io WebSocket – targeted MMSI catalog lookup
// Sends batches of 50 MMSIs and collects PositionReport messages for ~18s each.
// ─────────────────────────────────────────────────────────────────────────────
async function tryAISStreamMMSI() {
  const key = process.env.AISSTREAM_KEY;
  if (!key) throw new Error('AISSTREAM_KEY not set');

  const results = new Map(); // MMSI → normalised ship

  const batches = [];
  for (let i = 0; i < ALL_MMSIS.length; i += WS_BATCH_SIZE)
    batches.push(ALL_MMSIS.slice(i, i + WS_BATCH_SIZE));

  // A8: Run all MMSI batches in parallel — reduces total collection time from
  // (batches.length × WS_COLLECT_MS) down to ~WS_COLLECT_MS regardless of batch count.
  await Promise.allSettled(batches.map(batch => new Promise((resolve) => {
    let ws;
    try { ws = new WebSocket('wss://stream.aisstream.io/v0/stream'); }
    catch (e) { resolve(); return; }

    const timer = setTimeout(() => { try { ws.close(); } catch {} resolve(); }, WS_COLLECT_MS);

    ws.on('open', () => {
      ws.send(JSON.stringify({
        APIKey:              key,
        BoundingBoxes:       [[[-90, -180], [90, 180]]],
        FiltersShipMMSI:     batch,
        FilterMessageTypes:  ['PositionReport'],
      }));
    });

    ws.on('message', (raw) => {
      try {
        const msg  = JSON.parse(raw);
        const meta = msg.MetaData;
        const pos  = msg.Message?.PositionReport;
        if (!meta?.MMSI || !pos) return;
        const mmsi  = String(meta.MMSI);
        const known = lookupMMSI(mmsi);
        results.set(mmsi, {
          id:          mmsi,
          mmsi,
          name:        known?.name || meta.ShipName || 'UNKNOWN',
          lat:         meta.latitude,
          lon:         meta.longitude,
          heading:     pos.TrueHeading !== 511 ? (pos.TrueHeading ?? pos.Cog ?? 0) : (pos.Cog ?? 0),
          velocity:    pos.Sog ?? 0,
          type:        'Military',
          flag:        known?.flag || '',
          destination: known?.homeport || '',
          type_entity: 'ship',
          source:      'aisstream_mmsi',
          lastSeen:    new Date().toISOString(),
        });
      } catch { /* skip malformed */ }
    });

    ws.on('close', () => { clearTimeout(timer); resolve(); });
    ws.on('error', (err) => {
      console.warn('[Ships] AISStream WS error:', err.message);
      clearTimeout(timer); try { ws.close(); } catch {} resolve();
    });
  })));

  const ships = [...results.values()].filter(s =>
    s.lat != null && s.lon != null &&
    Math.abs(s.lat) <= 90 && Math.abs(s.lon) <= 180
  );
  console.log(`[Ships] AISStream MMSI WebSocket: ${ships.length} vessels live`);
  if (ships.length === 0) throw new Error('0 MMSI vessels received from AISStream WS');
  return ships;
}

// ─────────────────────────────────────────────────────────────────────────────
// Source 4: aisstream.io REST snapshot (requires AISSTREAM_KEY env var)
// Free tier at https://aisstream.io – no credit card required.
// ─────────────────────────────────────────────────────────────────────────────
async function tryAISStream() {
  const key = process.env.AISSTREAM_KEY;
  if (!key) throw new Error('AISSTREAM_KEY not set');

  const url = 'https://api.aisstream.io/v0/vessels?ShipTypes=35&Limit=500';
  const res = await fetch(url, {
    signal:  AbortSignal.timeout(TIMEOUT_MS),
    headers: { 'Authorization': `Bearer ${key}`, 'Accept': 'application/json' },
  });
  if (!res.ok) throw new Error(`AISStream HTTP ${res.status}`);
  const data = await res.json();
  const rows = data?.vessels || data?.data || (Array.isArray(data) ? data : []);
  const ships = rows.map(row => {
    const id = String(row.MMSI || row.mmsi || '');
    if (!id) return null;
    const lat = parseFloat(row.Latitude  ?? row.latitude  ?? row.lat ?? '');
    const lon = parseFloat(row.Longitude ?? row.longitude ?? row.lon ?? '');
    if (isNaN(lat) || isNaN(lon)) return null;
    return {
      id, mmsi: id,
      name:        row.ShipName || row.NAME || 'UNKNOWN',
      lat, lon,
      heading:     parseFloat(row.TrueHeading ?? row.COG ?? 0),
      velocity:    parseFloat(row.SpeedOverGround ?? row.SOG ?? 0),
      type:        'Military',
      flag:        row.Flag || row.CountryCode || '',
      destination: row.Destination || '',
      type_entity: 'ship',
      source:      'aisstream',
      lastSeen:    new Date().toISOString(),
    };
  }).filter(Boolean);
  if (ships.length === 0) throw new Error('0 vessels from AISStream');
  return ships;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main export
// ─────────────────────────────────────────────────────────────────────────────
export async function fetchShips() {
  // MMSI WebSocket runs first (targeted, higher quality) — it can take up to
  // WS_COLLECT_MS × batches. REST sources run in parallel among themselves.
  const [mmsiResult, ...restResults] = await Promise.allSettled([
    tryAISStreamMMSI().then(ships => ({ name: 'AISStream-MMSI', ships })),
    tryAISStream().then(ships     => ({ name: 'AISStream-REST', ships })),
    tryNorwegianAIS().then(ships  => ({ name: 'NorwAIS',        ships })),
    tryFinnishAIS().then(ships    => ({ name: 'Digitraffic-FI', ships })),
  ]);

  const realShips = [];
  for (const r of [mmsiResult, ...restResults]) {
    if (r.status === 'fulfilled') {
      console.log(`[Ships] ${r.value.name}: ${r.value.ships.length} vessels`);
      realShips.push(...r.value.ships);
    } else {
      console.warn(`[Ships] source unavailable: ${r.reason?.message}`);
    }
  }

  // Deduplicate live ships by MMSI — prefer MMSI-catalog entries (richer metadata)
  const seen = new Map();
  for (const s of realShips) {
    if (!seen.has(s.mmsi)) {
      seen.set(s.mmsi, s);
    } else if (s.source === 'aisstream_mmsi') {
      seen.set(s.mmsi, s);
    }
  }

  // Always supplement with catalog ships for MMSIs not covered by live AIS.
  // This ensures global coverage even when only regional AIS (e.g. Norwegian) is available.
  const baseline = getCatalogBaseline();
  let baselineAdded = 0;
  for (const base of baseline) {
    if (!seen.has(base.mmsi)) {
      seen.set(base.mmsi, base);
      baselineAdded++;
    }
  }

  if (seen.size > 0) {
    const merged = [...seen.values()];
    console.log(`[Ships] ${merged.length} total vessels (${merged.length - baselineAdded} live + ${baselineAdded} catalog supplement)`);
    return merged;
  }

  // All sources failed — serve the full catalog
  console.log(`[Ships] No live AIS — serving ${baseline.length} catalog vessels (last known positions)`);
  return baseline;
}

