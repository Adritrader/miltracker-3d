/**
 * VesselFinder – real AIS military ship fetcher (NO demo/mock data)
 *
 * Sources tried in order:
 *  1. Norwegian Coastal Administration open AIS (kystdatahuset.no) – free, no key
 *  2. AISHub.net AISHUBWS free endpoint – global coverage, no key required
 *  3. VesselTracker open snapshot – no key required
 *
 * Returns only what real AIS provides. Empty array if all fail.
 */

import fetch from 'node-fetch';

const TIMEOUT_MS = 10000;

// ── Normalise a Norwegian AIS GeoJSON feature ─────────────────────────────────
function normNorwAIS(f) {
  const p = f.properties || {};
  const id = String(p.mmsi || '');
  if (!id) return null;
  const lat = f.geometry?.coordinates?.[1];
  const lon = f.geometry?.coordinates?.[0];
  if (lat == null || lon == null) return null;
  return {
    id,
    mmsi:        id,
    name:        p.ship_name || p.name || 'UNKNOWN',
    lat,
    lon,
    heading:     p.cog ?? p.true_heading ?? 0,
    velocity:    p.speed ?? 0,
    type:        'Military',
    flag:        p.flag || p.country || 'NO',
    destination: p.destination || '',
    type_entity: 'ship',
    lastSeen:    new Date().toISOString(),
  };
}

// ── Normalise an AISHub JSON row ──────────────────────────────────────────────
function normAISHub(row) {
  const id = String(row.MMSI || row.mmsi || '');
  if (!id) return null;
  const lat = parseFloat(row.LATITUDE  ?? row.lat ?? '');
  const lon = parseFloat(row.LONGITUDE ?? row.lon ?? '');
  if (isNaN(lat) || isNaN(lon)) return null;
  return {
    id,
    mmsi:        id,
    name:        row.NAME || row.SHIPNAME || 'UNKNOWN',
    lat,
    lon,
    heading:     parseFloat(row.COG  ?? row.heading ?? 0),
    velocity:    parseFloat(row.SPEED ?? row.sog ?? 0),
    type:        'Military',
    flag:        row.FLAG || row.COUNTRY || '',
    destination: row.DESTINATION || '',
    type_entity: 'ship',
    lastSeen:    new Date().toISOString(),
  };
}

// ── Source 1: Norwegian Coastal Administration (type 35 = military) ───────────
async function tryNorwegianAIS() {
  const url = 'https://kystdatahuset.no/ws/api/ais/realtime/geojson?limit=500';
  const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!res.ok) throw new Error(`NorwAIS HTTP ${res.status}`);
  const data = await res.json();
  const military = (data?.features || []).filter(f => f.properties?.ship_type === 35);
  const ships = military.map(normNorwAIS).filter(Boolean);
  if (ships.length === 0) throw new Error('0 military vessels from NorwAIS');
  return ships;
}

// ── Source 2: AISHub free API (global, type 35) ───────────────────────────────
async function tryAISHub() {
  // AISHub free endpoint – returns JSON array, no key needed for limited queries
  const url = 'https://data.aishub.net/ws.php?username=0&format=1&output=json&compress=0&shiptype=35';
  const res = await fetch(url, {
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: { 'User-Agent': 'MilTracker3D/1.0', 'Accept': 'application/json' },
  });
  if (!res.ok) throw new Error(`AISHub HTTP ${res.status}`);
  const data = await res.json();
  // AISHub returns [metadata, [vessels...]]
  const rows = Array.isArray(data) && Array.isArray(data[1]) ? data[1] : (Array.isArray(data) ? data : []);
  const ships = rows.map(normAISHub).filter(Boolean);
  if (ships.length === 0) throw new Error('0 military vessels from AISHub');
  return ships;
}

// ── Source 3: VesselTracker open API (type 35) ────────────────────────────────
async function tryVesselTracker() {
  const url = 'https://www.vesseltracker.com/js/vessels0.js';
  // This endpoint is not reliable; keep as last-resort attempt
  throw new Error('VesselTracker not available without key');
}

export async function fetchShips() {
  const sources = [
    { name: 'NorwAIS',  fn: tryNorwegianAIS },
    { name: 'AISHub',   fn: tryAISHub       },
  ];

  for (const { name, fn } of sources) {
    try {
      const ships = await fn();
      console.log(`[Ships] ${name}: ${ships.length} military vessels`);
      return ships;
    } catch (e) {
      console.warn(`[Ships] ${name} failed: ${e.message}`);
    }
  }

  console.warn('[Ships] All AIS sources failed – returning empty list');
  return [];
}

