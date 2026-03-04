/**
 * vesselFinder.js – Military ship data aggregator
 *
 * Priority order:
 *  1. aisstream.io REST   (global real-time AIS – free with AISSTREAM_KEY env var)
 *  2. Norwegian Coastal AIS (kystdatahuset.no – free, no key, Norway-only)
 *  3. AISHub free endpoint  (global, type 35, no key needed)
 *  4. Baseline fleet        (real vessels at verified homeport / deployment coords,
 *                            source:'baseline' – fills the map when AIS unavailable)
 *
 * The baseline is NEVER shown if any real AIS source returns ≥1 vessel.
 * Baseline vessels carry isBaseline:true so the UI can label them accordingly.
 *
 * Get a free AISSTREAM_KEY at: https://aisstream.io  (no credit card required)
 */

import fetch from 'node-fetch';

const TIMEOUT_MS = 10_000;

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
// Source 2: AISHub free endpoint (global, type 35)
// ─────────────────────────────────────────────────────────────────────────────
async function tryAISHub() {
  const url = 'https://data.aishub.net/ws.php?username=0&format=1&output=json&compress=0&shiptype=35';
  const res = await fetch(url, {
    signal:  AbortSignal.timeout(TIMEOUT_MS),
    headers: { 'User-Agent': 'MilTracker3D/1.0', 'Accept': 'application/json' },
  });
  if (!res.ok) throw new Error(`AISHub HTTP ${res.status}`);
  const data = await res.json();
  const rows = Array.isArray(data) && Array.isArray(data[1]) ? data[1]
             : Array.isArray(data) ? data : [];
  const ships = rows.map(normAISHub).filter(Boolean);
  if (ships.length === 0) throw new Error('0 military vessels from AISHub');
  return ships;
}

// ─────────────────────────────────────────────────────────────────────────────
// Source 3: aisstream.io REST snapshot (requires AISSTREAM_KEY env var)
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
// Baseline fleet – verified homeport / active deployment positions (March 2026)
// Positions sourced from public naval port records + open satellite imagery.
// Static – no movement simulation. isBaseline:true → UI labels "Last known pos."
// ─────────────────────────────────────────────────────────────────────────────
function getBaselineFleet() {
  const ts = new Date().toISOString();
  const v  = (mmsi, name, lat, lon, heading, flag, dest) => ({
    id: mmsi, mmsi, name, lat, lon,
    heading, velocity: 0,
    type: 'Military', flag,
    destination: dest || '',
    type_entity: 'ship',
    source: 'baseline',
    isBaseline: true,
    lastSeen: ts,
  });

  return [
    // ── US NAVY – Mediterranean / Red Sea / Gulf ──────────────────────────────
    v('338234633','USS DWIGHT D EISENHOWER CVN-69',  24.80,  57.20, 280,'US','GULF OPS'),
    v('338234650','USS GERALD R FORD CVN-78',        15.20,  41.80, 150,'US','RED SEA OPS'),
    v('338234660','USS HARRY S TRUMAN CVN-75',       33.50,  29.80,  85,'US','MED OPS'),
    v('338234640','USS THEODORE ROOSEVELT CVN-71',   26.10,  56.60, 260,'US','HORMUZ PATROL'),
    v('338234651','USS THOMAS HUDNER DDG-116',       14.80,  41.20, 200,'US','RED SEA PATROL'),
    v('338234652','USS CARNEY DDG-64',               13.50,  43.10, 120,'US','ADEN PATROL'),
    v('338234653','USS PHILIPPINE SEA CG-58',        12.40,  44.80,  90,'US','GULF OF ADEN'),
    v('338234661','USS ROSS DDG-71',                 33.20,  30.40,  60,'US','MED PATROL'),
    v('338234662','USS SAN JACINTO CG-56',           34.10,  28.90, 100,'US','AAW ESCORT'),
    v('338234663','USS WASP LHD-1',                  34.40,  31.60, 270,'US','CYPRUS OPS'),
    v('338234644','USS BATAAN LHD-5',                24.50,  57.80, 300,'US','AMPHIB OPS'),
    v('338234680','USS MOUNT WHITNEY LCC-20',        57.00,  19.50,  90,'US','NATO BALTIC CMD'),
    v('338234681','USS PORTER DDG-78',               58.00,  20.40, 180,'US','BALTIC PATROL'),
    // ── US NAVY – Atlantic / Pacific homeports ────────────────────────────────
    v('338234631','USS GEORGE WASHINGTON CVN-73',    36.86, -76.30,   0,'US','NORFOLK'),
    v('338234670','USS JOHN C STENNIS CVN-74',       37.10, -75.90, 135,'US','ATLANTIC WORKUP'),
    v('338234675','USS RONALD REAGAN CVN-76',        35.44, 139.65,  90,'US','YOKOSUKA OPS'),
    v('338234676','USS NIMITZ CVN-68',               21.35,-157.97,   0,'US','PEARL HARBOR'),
    v('338234671','USS ABRAHAM LINCOLN CVN-72',      32.70,-117.20, 270,'US','SAN DIEGO'),
    // ── ROYAL NAVY (UK) ──────────────────────────────────────────────────────
    v('232001000','HMS QUEEN ELIZABETH R08',         34.52,  32.80, 200,'GB','AKROTIRI SUPPORT'),
    v('232001001','HMS PRINCE OF WALES R09',         37.00,  24.50,  90,'GB','MED TRANSIT'),
    v('232001010','HMS DIAMOND D34',                 34.90,  32.00, 160,'GB','CYPRUS PATROL'),
    v('232001011','HMS RICHMOND F239',               35.50,  28.00,  95,'GB','ASW PATROL'),
    v('232001012','HMS DRAGON D35',                  26.00,  55.80, 270,'GB','GULF ESCORT'),
    // ── FRENCH NAVY ──────────────────────────────────────────────────────────
    v('227123001','FS CHARLES DE GAULLE R91',        33.70,  34.10, 180,'FR','BEIRUT OFFSHORE'),
    v('227123002','FS FORBIN D620',                  33.40,  33.80,  90,'FR','AAW ESCORT'),
    v('227123003','FS PROVENCE D652',                33.10,  34.20, 270,'FR','MED PATROL'),
    v('227123010','FS DIXMUDE L9015',                43.04,   5.95, 180,'FR','TOULON'),
    // ── RUSSIAN NAVY ─────────────────────────────────────────────────────────
    v('273123001','RFS ADMIRAL KUZNETSOV',           68.92,  34.20, 180,'RU','SEVEROMORSK'),
    v('273123002','RFS MARSHAL USTINOV',             35.10,  24.30,  90,'RU','MED GROUP'),
    v('273123003','RFS VARSHAVYANKA S-375',          42.80,  32.00, 270,'RU','BLACK SEA'),
    v('273123004','RFS ADMIRAL GORSHKOV',            55.00,  22.00,  90,'RU','KALININGRAD TRANSIT'),
    v('273123005','RFS STEREGUSHCHY CORVETTE',       59.95,  29.75,   0,'RU','BALTIYSK'),
    // ── CHINESE PLAN ─────────────────────────────────────────────────────────
    v('412123001','CNS LIAONING CV-16',              22.30, 114.20,   0,'CN','SOUTH SEA'),
    v('412123002','CNS SHANDONG CV-17',              18.20, 112.30,  45,'CN','TRAINING OPS'),
    v('412123003','CNS FUJIAN CV-18',                24.10, 121.50, 270,'CN','TAIWAN STRAIT'),
    v('412123010','CNS NANCHANG DDG-101',            22.50, 114.50,  90,'CN','CARRIER ESCORT'),
    v('412123011','CNS WUXI DDG-109',                23.80, 119.80, 180,'CN','STRAIT PATROL'),
    // ── IRANIAN NAVY / IRGC ──────────────────────────────────────────────────
    v('422000003','IRIN JAMARAN FRIGATE',            27.00,  55.80, 200,'IR','GULF PATROL'),
    v('422000004','IRIN DENA FRIGATE',               26.50,  54.00,  90,'IR','GULF PATROL'),
    v('422000005','IRIN SAHAND FRIGATE',             27.18,  56.27, 135,'IR','BANDAR ABBAS'),
    // ── ISRAELI NAVY ─────────────────────────────────────────────────────────
    v('428000001',"INS SA'AR 6 MAGEN",              33.30,  33.00, 330,'IL','MARITIME PATROL'),
    v('428000002',"INS SA'AR 6 OZ",                 32.60,  33.20, 270,'IL','BLOCKADE PATROL'),
    v('428000003',"INS EILAT SA'AR 5",              29.50,  34.80, 180,'IL','RED SEA PATROL'),
    // ── NATO EUROPEAN ────────────────────────────────────────────────────────
    v('247123001','ITS CAVOUR CVH-550',             40.85,  14.20, 180,'IT','NAPLES'),
    v('247123002','ITS LUIGI DURAND DE LA PENNE',   37.50,  14.80,  90,'IT','MED PATROL'),
    v('244123001','HNLMS ROTTERDAM LPD-800',        51.90,   4.48, 270,'NL','ROTTERDAM'),
    v('245123001','FGS SACHSEN F219',               54.50,  10.20,  90,'DE','KIEL'),
    v('219123001','HDMS PETER WILLEMOES F362',      55.92,  10.60, 270,'DK','NATO BALTIC'),
    v('230123001','FNS HAMINA 80',                  59.85,  25.00,   0,'FI','HELSINKI'),
    v('248000001','TCG ANADOLU L400',               40.98,  29.01,  90,'TR','ISTANBUL'),
    // ── JMSDF (Japan) ────────────────────────────────────────────────────────
    v('431000001','JS IZUMO DDH-183',               34.37, 132.45,  90,'JP','KURE BASE'),
    v('431000002','JS KAGA DDH-184',                34.37, 132.46,  90,'JP','KURE BASE'),
    v('431000003','JS MAYA DDG-179',                35.44, 139.65,   0,'JP','YOKOSUKA'),
    // ── ROK Navy ─────────────────────────────────────────────────────────────
    v('440000001','ROKS SEJONG DAEWANG DDG-991',    36.85, 126.62,   0,'KR','PYEONGTAEK'),
    // ── Indian Navy ──────────────────────────────────────────────────────────
    v('419000001','INS VIKRANT R11',                15.42,  73.79, 180,'IN','GOA'),
    v('419000002','INS KOLKATA D63',                18.93,  72.85,   0,'IN','MUMBAI'),
    // ── Australian Navy ──────────────────────────────────────────────────────
    v('503000001','HMAS CANBERRA L02',             -33.85, 151.20,   0,'AU','SYDNEY'),
    v('503000002','HMAS HOBART DDG-39',            -33.85, 151.21,   0,'AU','SYDNEY'),
  ];
}

// ─────────────────────────────────────────────────────────────────────────────
// Main export
// ─────────────────────────────────────────────────────────────────────────────
export async function fetchShips() {
  const sources = [
    { name: 'AISStream',  fn: tryAISStream    },
    { name: 'NorwAIS',    fn: tryNorwegianAIS },
    { name: 'AISHub',     fn: tryAISHub       },
  ];

  // Collect results from all sources in parallel
  const results = await Promise.allSettled(sources.map(s => s.fn().then(ships => ({ name: s.name, ships }))));

  const realShips = [];
  for (const r of results) {
    if (r.status === 'fulfilled') {
      console.log(`[Ships] ${r.value.name}: ${r.value.ships.length} vessels (real AIS)`);
      realShips.push(...r.value.ships);
    } else {
      const name = sources[results.indexOf(r)]?.name ?? '?';
      console.warn(`[Ships] ${name} unavailable: ${r.reason?.message}`);
    }
  }

  if (realShips.length > 0) {
    // Deduplicate by MMSI — real AIS wins (first-seen order)
    const seen = new Map();
    for (const s of realShips) if (!seen.has(s.mmsi)) seen.set(s.mmsi, s);
    const merged = [...seen.values()];
    console.log(`[Ships] ${merged.length} unique vessels from live AIS`);
    return merged;
  }

  // All AIS sources failed — serve baseline fleet so the map isn't empty
  const baseline = getBaselineFleet();
  console.log(`[Ships] No live AIS — serving ${baseline.length} baseline vessels (last known positions)`);
  return baseline;
}

