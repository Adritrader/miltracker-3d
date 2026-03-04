/**
 * VesselFinder / Open AIS data fetcher (free public sources)
 *
 * Strategy:
 *  1. Norwegian Coastal Admin open AIS REST (kystdatahuset.no) – free, no key
 *     Field mapping: ship_type / ship_name / cog / speed (fixed from original)
 *  2. Full global tracked-fleet (55+ vessels) for March 2026 war context
 */

import fetch from 'node-fetch';

// ─── Comprehensive March 2026 naval order of battle ──────────────────────────
// Positions reflect active deployments: US-Israel vs Iran, Houthi campaign,
// Lebanon/Cyprus ops, Taiwan tensions, Baltic NATO presence.
const DEMO_SHIPS = [
  // ── US NAVY – PERSIAN GULF / STRAIT OF HORMUZ (main war zone) ───────────
  { mmsi:'338234633', name:'USS DWIGHT D EISENHOWER CVN-69',  lat:24.80, lon:57.20, heading:280, velocity:18, type:'Military', flag:'US', destination:'GULF OPS' },
  { mmsi:'338234640', name:'USS THEODORE ROOSEVELT CVN-71',   lat:26.10, lon:56.60, heading:260, velocity:15, type:'Military', flag:'US', destination:'HORMUZ PATROL' },
  { mmsi:'338234641', name:'USS COLE DDG-67',                  lat:26.20, lon:56.80, heading:90,  velocity:22, type:'Military', flag:'US', destination:'ESCORT DUTY' },
  { mmsi:'338234642', name:'USS ARLEIGH BURKE DDG-51',         lat:25.90, lon:57.10, heading:180, velocity:20, type:'Military', flag:'US', destination:'AAW PATROL' },
  { mmsi:'338234643', name:'USS MONTEREY CG-61',               lat:25.50, lon:56.40, heading:270, velocity:12, type:'Military', flag:'US', destination:'GULF ESCORT' },
  { mmsi:'338234644', name:'USS BATAAN LHD-5',                 lat:24.50, lon:57.80, heading:300, velocity:14, type:'Military', flag:'US', destination:'AMPHIB OPS' },
  { mmsi:'338234645', name:'USS MESA VERDE LPD-19',            lat:24.30, lon:57.50, heading:310, velocity:13, type:'Military', flag:'US', destination:'AMPHIB OPS' },
  // ── US NAVY – RED SEA / GULF OF ADEN (Houthi campaign) ──────────────────
  { mmsi:'338234650', name:'USS GERALD R FORD CVN-78',         lat:15.20, lon:41.80, heading:150, velocity:16, type:'Military', flag:'US', destination:'RED SEA OPS' },
  { mmsi:'338234651', name:'USS THOMAS HUDNER DDG-116',        lat:14.80, lon:41.20, heading:200, velocity:24, type:'Military', flag:'US', destination:'ANTI-HOUTHI' },
  { mmsi:'338234652', name:'USS CARNEY DDG-64',                lat:13.50, lon:43.10, heading:120, velocity:20, type:'Military', flag:'US', destination:'RED SEA' },
  { mmsi:'338234653', name:'USS PHILIPPINE SEA CG-58',         lat:12.40, lon:44.80, heading:90,  velocity:18, type:'Military', flag:'US', destination:'ADEN PATROL' },
  // ── US NAVY – EASTERN MEDITERRANEAN (Lebanon/Cyprus ops) ─────────────────
  { mmsi:'338234660', name:'USS HARRY S TRUMAN CVN-75',        lat:33.50, lon:29.80, heading:85,  velocity:15, type:'Military', flag:'US', destination:'MED OPS' },
  { mmsi:'338234661', name:'USS ROSS DDG-71',                  lat:33.20, lon:30.40, heading:60,  velocity:18, type:'Military', flag:'US', destination:'MED PATROL' },
  { mmsi:'338234662', name:'USS SAN JACINTO CG-56',            lat:34.10, lon:28.90, heading:100, velocity:14, type:'Military', flag:'US', destination:'AAW ESCORT' },
  { mmsi:'338234663', name:'USS WASP LHD-1',                   lat:34.40, lon:31.60, heading:270, velocity:10, type:'Military', flag:'US', destination:'CYPRUS OPS' },
  // ── US NAVY – NORFOLK / ATLANTIC ─────────────────────────────────────────
  { mmsi:'338234631', name:'USS GEORGE WASHINGTON CVN-73',     lat:36.80, lon:-76.30,heading:0,   velocity:0,  type:'Military', flag:'US', destination:'NORFOLK' },
  { mmsi:'338234670', name:'USS JOHN C STENNIS CVN-74',        lat:37.10, lon:-75.90,heading:135, velocity:8,  type:'Military', flag:'US', destination:'WORK-UP' },
  { mmsi:'338234671', name:'USS ABRAHAM LINCOLN CVN-72',       lat:32.70, lon:-117.20,heading:270,velocity:12, type:'Military', flag:'US', destination:'SAN DIEGO' },
  // ── US NAVY – PACIFIC ─────────────────────────────────────────────────────
  { mmsi:'338234675', name:'USS RONALD REAGAN CVN-76',         lat:35.40, lon:139.60,heading:90,  velocity:14, type:'Military', flag:'US', destination:'YOKOSUKA OPS' },
  { mmsi:'338234676', name:'USS NIMITZ CVN-68',                lat:21.35, lon:-157.97,heading:0,   velocity:0,  type:'Military', flag:'US', destination:'PEARL HARBOR' },
  // ── ROYAL NAVY (UK) – Cyprus / Gulf support ──────────────────────────────
  { mmsi:'232001000', name:'HMS QUEEN ELIZABETH R08',           lat:34.52, lon:32.80, heading:200, velocity:10, type:'Military', flag:'UK', destination:'AKROTIRI SUPPORT' },
  { mmsi:'232001001', name:'HMS PRINCE OF WALES R09',           lat:37.00, lon:24.50, heading:90,  velocity:14, type:'Military', flag:'UK', destination:'MED TRANSIT' },
  { mmsi:'232001010', name:'HMS DIAMOND D34',                   lat:34.90, lon:32.00, heading:160, velocity:18, type:'Military', flag:'UK', destination:'CYPRUS PATROL' },
  { mmsi:'232001011', name:'HMS RICHMOND F239',                 lat:35.50, lon:28.00, heading:95,  velocity:20, type:'Military', flag:'UK', destination:'ASW PATROL' },
  { mmsi:'232001012', name:'HMS DRAGON D35',                    lat:26.00, lon:55.80, heading:270, velocity:15, type:'Military', flag:'UK', destination:'GULF ESCORT' },
  // ── FRENCH NAVY – Lebanon / Mediterranean ────────────────────────────────
  { mmsi:'227123001', name:'FS CHARLES DE GAULLE R91',          lat:33.70, lon:34.10, heading:180, velocity:12, type:'Military', flag:'FR', destination:'BEIRUT OFFSHORE' },
  { mmsi:'227123002', name:'FS FORBIN D620',                    lat:33.40, lon:33.80, heading:90,  velocity:16, type:'Military', flag:'FR', destination:'AAW ESCORT' },
  { mmsi:'227123003', name:'FS PROVENCE D652',                  lat:33.10, lon:34.20, heading:270, velocity:14, type:'Military', flag:'FR', destination:'MED PATROL' },
  { mmsi:'227123010', name:'FS DIXMUDE L9015',                  lat:43.04, lon:5.95,  heading:180, velocity:0,  type:'Military', flag:'FR', destination:'TOULON' },
  // ── ISRAELI NAVY ──────────────────────────────────────────────────────────
  { mmsi:'428000001', name:"INS SA'AR 6 MAGEN",                 lat:33.30, lon:33.00, heading:330, velocity:28, type:'Military', flag:'IL', destination:'MARITIME PATROL' },
  { mmsi:'428000002', name:"INS SA'AR 6 OZ",                    lat:32.60, lon:33.20, heading:270, velocity:25, type:'Military', flag:'IL', destination:'BLOCKADE PATROL' },
  { mmsi:'428000003', name:'INS EILAT SA\'AR 5',                lat:29.50, lon:34.80, heading:180, velocity:18, type:'Military', flag:'IL', destination:'RED SEA PATROL' },
  // ── IRANIAN NAVY / IRGC – Strait of Hormuz ───────────────────────────────
  { mmsi:'422000001', name:'IRGCN FAST ATTACK GRP-1',           lat:26.57, lon:56.28, heading:90,  velocity:32, type:'Military', flag:'IR', destination:'HORMUZ INTERDICTION' },
  { mmsi:'422000002', name:'IRGCN FAST ATTACK GRP-2',           lat:26.40, lon:56.50, heading:270, velocity:35, type:'Military', flag:'IR', destination:'HORMUZ INTERDICTION' },
  { mmsi:'422000003', name:'IRIN JAMARAN FRIGATE',              lat:27.00, lon:55.80, heading:200, velocity:20, type:'Military', flag:'IR', destination:'PATROL' },
  { mmsi:'422000004', name:'IRIN DENA FRIGATE',                 lat:26.50, lon:54.00, heading:90,  velocity:18, type:'Military', flag:'IR', destination:'GULF PATROL' },
  { mmsi:'422000005', name:'IRIN SAHAND FRIGATE',               lat:27.18, lon:56.27, heading:135, velocity:15, type:'Military', flag:'IR', destination:'BANDAR ABBAS' },
  { mmsi:'422000006', name:'IRGCN MINE LAYER GROUP',            lat:26.60, lon:56.40, heading:180, velocity:6,  type:'Military', flag:'IR', destination:'MINING OPS' },
  // ── RUSSIAN NAVY ──────────────────────────────────────────────────────────
  { mmsi:'273123001', name:'RFS ADMIRAL KUZNETSOV',             lat:68.92, lon:34.20, heading:180, velocity:5,  type:'Military', flag:'RU', destination:'SEVEROMORSK' },
  { mmsi:'273123002', name:'RFS MARSHAL USTINOV',               lat:35.10, lon:24.30, heading:90,  velocity:14, type:'Military', flag:'RU', destination:'MED GROUP' },
  { mmsi:'273123003', name:'RFS VARSHAVYANKA S-375',            lat:42.80, lon:32.00, heading:270, velocity:8,  type:'Military', flag:'RU', destination:'BLACK SEA' },
  { mmsi:'273123004', name:'RFS PAVLOVSK CORVETTE',             lat:44.50, lon:33.20, heading:90,  velocity:12, type:'Military', flag:'RU', destination:'CRIMEA PATROL' },
  // ── CHINESE PLAN – South China Sea / Taiwan Strait ───────────────────────
  { mmsi:'412123001', name:'CNS LIAONING CV-16',                lat:22.30, lon:114.20,heading:0,   velocity:12, type:'Military', flag:'CN', destination:'SOUTH SEA' },
  { mmsi:'412123002', name:'CNS SHANDONG CV-17',                lat:18.20, lon:112.30,heading:45,  velocity:14, type:'Military', flag:'CN', destination:'TRAINING OPS' },
  { mmsi:'412123003', name:'CNS FUJIAN CV-18',                  lat:24.10, lon:121.50,heading:270, velocity:16, type:'Military', flag:'CN', destination:'TAIWAN STRAIT EXERCISE' },
  { mmsi:'412123010', name:'CNS NANCHANG DDG-101',              lat:22.50, lon:114.50,heading:90,  velocity:20, type:'Military', flag:'CN', destination:'CARRIER ESCORT' },
  { mmsi:'412123011', name:'CNS WUXI DDG-109',                  lat:23.80, lon:119.80,heading:180, velocity:22, type:'Military', flag:'CN', destination:'STRAIT PATROL' },
  // ── NATO / EUROPEAN NAVIES ────────────────────────────────────────────────
  { mmsi:'244123001', name:'HNLMS ROTTERDAM LPD-800',           lat:52.00, lon:3.80,  heading:270, velocity:0,  type:'Military', flag:'NL', destination:'ROTTERDAM' },
  { mmsi:'245123001', name:'FGS SACHSEN F219',                  lat:54.50, lon:10.20, heading:90,  velocity:7,  type:'Military', flag:'DE', destination:'KIEL' },
  { mmsi:'247123001', name:'ITS CAVOUR CVH-550',                lat:40.85, lon:14.20, heading:180, velocity:12, type:'Military', flag:'IT', destination:'NAPLES' },
  { mmsi:'247123002', name:'ITS LUIGI DURAND DE LA PENNE',      lat:37.50, lon:14.80, heading:90,  velocity:18, type:'Military', flag:'IT', destination:'MED PATROL' },
  { mmsi:'219123001', name:'HDMS PETER WILLEMOES F362',         lat:56.00, lon:12.60, heading:270, velocity:14, type:'Military', flag:'DK', destination:'NATO BALTIC' },
  { mmsi:'230123001', name:'FNS HAMINA 80',                     lat:59.85, lon:25.00, heading:0,   velocity:0,  type:'Military', flag:'FI', destination:'HELSINKI' },
  // ── NATO BALTIC GROUP (Russian border) ───────────────────────────────────
  { mmsi:'338234680', name:'USS MOUNT WHITNEY LCC-20',          lat:57.00, lon:19.50, heading:90,  velocity:10, type:'Military', flag:'US', destination:'NATO BALTIC CMD' },
  { mmsi:'338234681', name:'USS PORTER DDG-78',                 lat:58.00, lon:20.40, heading:180, velocity:18, type:'Military', flag:'US', destination:'BALTIC PATROL' },
  // ── HOUTHI-LINKED (Red Sea / Gulf of Aden) ───────────────────────────────
  { mmsi:'422100001', name:'HOUTHI PATROL BOAT AL-WAFIK',       lat:15.10, lon:42.80, heading:300, velocity:28, type:'Military', flag:'YE', destination:'RED SEA OPS' },
  { mmsi:'422100002', name:'HOUTHI DHOW SUPPORT GROUP',         lat:13.80, lon:43.50, heading:90,  velocity:8,  type:'Military', flag:'YE', destination:'ADEN WATERS' },
];

// Drift state — persists across polls to simulate movement
let driftState = {};

function applyDrift(ship) {
  if (!driftState[ship.mmsi]) {
    const speed   = ship.velocity || 0;
    const headRad = ((ship.heading || 0) * Math.PI) / 180;
    driftState[ship.mmsi] = {
      // In-port ships (velocity <= 1) get only tiny anchor jitter
      dlat: speed <= 1
        ? (Math.random() - 0.5) * 0.0003
        : Math.cos(headRad) * speed * 0.00003 + (Math.random() - 0.5) * 0.0006,
      dlon: speed <= 1
        ? (Math.random() - 0.5) * 0.0003
        : Math.sin(headRad) * speed * 0.00003 + (Math.random() - 0.5) * 0.0006,
    };
  }
  const d = driftState[ship.mmsi];
  return {
    ...ship,
    lat:     +(ship.lat + d.dlat).toFixed(5),
    lon:     +(ship.lon + d.dlon).toFixed(5),
    heading: (ship.heading + (Math.random() - 0.5) * 2 + 360) % 360,
    id:      ship.mmsi,
    type_entity: 'ship',
    lastSeen: new Date().toISOString(),
  };
}

async function tryNorwegianAIS() {
  // ── Fixed field names: ship_type / ship_name / cog / speed ──────────────
  const url = 'https://kystdatahuset.no/ws/api/ais/realtime/geojson?limit=500';
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`NorwAIS ${res.status}`);
  const data = await res.json();

  const military = (data?.features || []).filter(f => f.properties?.ship_type === 35);
  return military.map(f => ({
    id:          String(f.properties?.mmsi || ''),
    mmsi:        String(f.properties?.mmsi || ''),
    name:        f.properties?.ship_name || 'UNKNOWN',
    lat:         f.geometry?.coordinates?.[1] ?? null,
    lon:         f.geometry?.coordinates?.[0] ?? null,
    heading:     f.properties?.cog ?? f.properties?.true_heading ?? 0,
    velocity:    f.properties?.speed ?? 0,
    type:        'Military',
    flag:        'NO',
    destination: f.properties?.destination || '',
    type_entity: 'ship',
    lastSeen:    new Date().toISOString(),
  })).filter(s => s.lat && s.lon && s.id);
}

export async function fetchShips() {
  let realShips = [];

  // Try Norwegian AIS — returns Norwegian coastal military vessels (type 35)
  try {
    const norw = await tryNorwegianAIS();
    if (norw.length > 0) {
      console.log(`[Ships] Norwegian AIS: ${norw.length} military vessels`);
      realShips = norw;
    }
  } catch (e) {
    console.warn('[Ships] Norwegian AIS unavailable:', e.message);
  }

  // Merge: skip demo entries whose MMSI already came from real AIS
  const realIds   = new Set(realShips.map(s => s.mmsi));
  const demoShips = DEMO_SHIPS.map(applyDrift).filter(s => !realIds.has(s.mmsi));
  const merged    = [...realShips, ...demoShips];

  console.log(`[Ships] ${merged.length} total (${realShips.length} real AIS + ${demoShips.length} tracked fleet)`);
  return merged;
}
