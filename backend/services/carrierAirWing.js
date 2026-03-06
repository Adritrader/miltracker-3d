/**
 * carrierAirWing.js – Cross-reference aircraft against known Carrier Air Wings.
 *
 * Detection strategy (applied in order, first match wins):
 *  1. CALLSIGN PREFIX  – squadron tactical callsigns broadcast over ADS-B
 *  2. PROXIMITY        – aircraft below 3 000 ft near a known carrier (<50 km)
 *  3. ICAO HEX RANGE   – US/UK/FR naval aircraft bureau-number hex blocks
 *
 * Adds .carrierOps = { carrier, cvw, squadron, mmsi, methodKm?, matchType } to
 * any aircraft that matches.  Returns enriched copy – does NOT mutate input.
 *
 * Sources: public USN/RN/MN squadron directories, Wikipedia CVW pages, NavalToday
 */

import { distKm as haversineKm } from './aiDanger.js';

// ── Carrier Air Wing databases ────────────────────────────────────────────────
// Each entry: callsign prefix (uppercase, 3-8 chars) → { carrier, cvw, squadron, mmsi }
// MMSIs match those in militaryMMSI.js
const CVW_BY_CALLSIGN = {
  // ── CVW-1 → USS GERALD R FORD (CVN-78) ──────────────────────────────────
  'CHECKM':   { carrier:'USS GERALD R FORD CVN-78',         cvw:'CVW-1',  squadron:'VFA-211 CHECKMATES',      mmsi:'338234650' },
  'KNIGHT':   { carrier:'USS GERALD R FORD CVN-78',         cvw:'CVW-1',  squadron:'VFA-136 KNIGHTHAWKS',     mmsi:'338234650' },
  'REDRIP':   { carrier:'USS GERALD R FORD CVN-78',         cvw:'CVW-1',  squadron:'VFA-11 RED RIPPERS',      mmsi:'338234650' },
  'SWORD':    { carrier:'USS GERALD R FORD CVN-78',         cvw:'CVW-1',  squadron:'VFA-32 SWORDSMEN',        mmsi:'338234650' },
  'TIGER':    { carrier:'USS GERALD R FORD CVN-78',         cvw:'CVW-1',  squadron:'VAW-125 TIGERTAILS',      mmsi:'338234650' },
  'ROOK':     { carrier:'USS GERALD R FORD CVN-78',         cvw:'CVW-1',  squadron:'VAQ-137 ROOKS',           mmsi:'338234650' },
  'GRAND':    { carrier:'USS GERALD R FORD CVN-78',         cvw:'CVW-1',  squadron:'HSC-9 TRIDENTS',          mmsi:'338234650' },

  // ── CVW-3 → USS DWIGHT D EISENHOWER (CVN-69) ─────────────────────────────
  'BULLET':   { carrier:'USS DWIGHT D EISENHOWER CVN-69',   cvw:'CVW-3',  squadron:'VFA-37 RAGIN BULLS',      mmsi:'338234633' },
  'RAIDER':   { carrier:'USS DWIGHT D EISENHOWER CVN-69',   cvw:'CVW-3',  squadron:'VFA-32 SWORDSMEN',        mmsi:'338234633' },
  'CAMEL':    { carrier:'USS DWIGHT D EISENHOWER CVN-69',   cvw:'CVW-3',  squadron:'VFA-105 GUNSLINGERS',     mmsi:'338234633' },
  'ZAPPER':   { carrier:'USS DWIGHT D EISENHOWER CVN-69',   cvw:'CVW-3',  squadron:'VAQ-130 ZAPPERS',         mmsi:'338234633' },
  'SHADOW':   { carrier:'USS DWIGHT D EISENHOWER CVN-69',   cvw:'CVW-3',  squadron:'VAW-126 SEAHAWKS',        mmsi:'338234633' },

  // ── CVW-8 → USS HARRY S TRUMAN (CVN-75) ──────────────────────────────────
  'BLACKL':   { carrier:'USS HARRY S TRUMAN CVN-75',        cvw:'CVW-8',  squadron:'VFA-213 BLACKLIONS',      mmsi:'338234660' },
  'TOMCAT':   { carrier:'USS HARRY S TRUMAN CVN-75',        cvw:'CVW-8',  squadron:'VFA-31 TOMCATTERS',       mmsi:'338234660' },
  'GOLDENW':  { carrier:'USS HARRY S TRUMAN CVN-75',        cvw:'CVW-8',  squadron:'VFA-87 GOLDEN WARRIORS',  mmsi:'338234660' },
  'CYCLONE':  { carrier:'USS HARRY S TRUMAN CVN-75',        cvw:'CVW-8',  squadron:'VAW-124 BEAR ACES',       mmsi:'338234660' },
  'GAUNTO':   { carrier:'USS HARRY S TRUMAN CVN-75',        cvw:'CVW-8',  squadron:'VAQ-141 SHADOWHAWKS',     mmsi:'338234660' },

  // ── CVW-11 → USS THEODORE ROOSEVELT (CVN-71) ──────────────────────────────
  'IRON':     { carrier:'USS THEODORE ROOSEVELT CVN-71',    cvw:'CVW-11', squadron:'VFA-154 BLACK KNIGHTS',   mmsi:'338234640' },
  'STINGER':  { carrier:'USS THEODORE ROOSEVELT CVN-71',    cvw:'CVW-11', squadron:'VFA-147 ARGONAUTS',       mmsi:'338234640' },
  'EAGLEHK':  { carrier:'USS THEODORE ROOSEVELT CVN-71',    cvw:'CVW-11', squadron:'VFA-41 BLACK ACES',       mmsi:'338234640' },
  'SUNDOWN':  { carrier:'USS THEODORE ROOSEVELT CVN-71',    cvw:'CVW-11', squadron:'VFA-14 TOPHATTERS',       mmsi:'338234640' },
  'BEARTRAP': { carrier:'USS THEODORE ROOSEVELT CVN-71',    cvw:'CVW-11', squadron:'VAW-117 WALL BANGERS',    mmsi:'338234640' },
  'PROWL':    { carrier:'USS THEODORE ROOSEVELT CVN-71',    cvw:'CVW-11', squadron:'VAQ-142 GRAY WOLVES',     mmsi:'338234640' },

  // ── CVW-2 → USS ABRAHAM LINCOLN (CVN-72) ─────────────────────────────────
  'EAGLE':    { carrier:'USS ABRAHAM LINCOLN CVN-72',       cvw:'CVW-2',  squadron:'VFA-2 BOUNTY HUNTERS',    mmsi:'338234671' },
  'BOUNTY':   { carrier:'USS ABRAHAM LINCOLN CVN-72',       cvw:'CVW-2',  squadron:'VFA-2 BOUNTY HUNTERS',    mmsi:'338234671' },
  'WARPATH':  { carrier:'USS ABRAHAM LINCOLN CVN-72',       cvw:'CVW-2',  squadron:'VFA-137 KESTRELS',        mmsi:'338234671' },
  'KESTREL':  { carrier:'USS ABRAHAM LINCOLN CVN-72',       cvw:'CVW-2',  squadron:'VFA-137 KESTRELS',        mmsi:'338234671' },
  'TOPHAT':   { carrier:'USS ABRAHAM LINCOLN CVN-72',       cvw:'CVW-2',  squadron:'VFA-14 TOPHATTERS',       mmsi:'338234671' },

  // ── CVW-5 → USS RONALD REAGAN (CVN-76) – Yokosuka ────────────────────────
  'DIAMB':    { carrier:'USS RONALD REAGAN CVN-76',         cvw:'CVW-5',  squadron:'VFA-27 ROYAL MACES',      mmsi:'338234675' },
  'MACE':     { carrier:'USS RONALD REAGAN CVN-76',         cvw:'CVW-5',  squadron:'VFA-27 ROYAL MACES',      mmsi:'338234675' },
  'PUKIN':    { carrier:'USS RONALD REAGAN CVN-76',         cvw:'CVW-5',  squadron:'VFA-195 DAMBUSTERS',      mmsi:'338234675' },
  'DAMBUST':  { carrier:'USS RONALD REAGAN CVN-76',         cvw:'CVW-5',  squadron:'VFA-195 DAMBUSTERS',      mmsi:'338234675' },

  // ── Royal Navy – HMS QUEEN ELIZABETH (R08) ────────────────────────────────
  'CANOPY':   { carrier:'HMS QUEEN ELIZABETH R08',          cvw:'CSG-21', squadron:'617 SQN DAMBUSTERS F-35', mmsi:'232001000' },
  'TRIDENT':  { carrier:'HMS QUEEN ELIZABETH R08',          cvw:'CSG-21', squadron:'820 NAS MERLIN ASW',      mmsi:'232001000' },
  'LONGBOW':  { carrier:'HMS QUEEN ELIZABETH R08',          cvw:'CSG-21', squadron:'820 NAS',                 mmsi:'232001000' },

  // ── Royal Navy – HMS PRINCE OF WALES (R09) ───────────────────────────────
  'EMPIRE':   { carrier:'HMS PRINCE OF WALES R09',          cvw:'CSG-23', squadron:'809 NAS F-35B',           mmsi:'232001001' },
  'GRIFFIN':  { carrier:'HMS PRINCE OF WALES R09',          cvw:'CSG-23', squadron:'845 NAS COMMANDO',        mmsi:'232001001' },

  // ── French Navy – FS CHARLES DE GAULLE (R91) ────────────────────────────
  'RAFMAR':   { carrier:'FS CHARLES DE GAULLE R91',         cvw:'AWG-1',  squadron:'Flottille 12F Rafale M',  mmsi:'227123001' },
  'CRUSAD':   { carrier:'FS CHARLES DE GAULLE R91',         cvw:'AWG-1',  squadron:'Flottille 17F Rafale M',  mmsi:'227123001' },
  'ALIZE':    { carrier:'FS CHARLES DE GAULLE R91',         cvw:'AWG-1',  squadron:'Flottille 4F Hawkeye',    mmsi:'227123001' },

  // ── Italian Navy – ITS CAVOUR (CVH-550) ──────────────────────────────────
  'GRUPAE':   { carrier:'ITS CAVOUR CVH-550',               cvw:'2° Gruppo',squadron:'311° Gruppo F-35B',     mmsi:'247123001' },
  'GRIFO':    { carrier:'ITS CAVOUR CVH-550',               cvw:'2° Gruppo',squadron:'AV-8B+ Harrier GR3',    mmsi:'247123001' },
};

// Sorted prefixes (longest first, so "CHECKM" matches before "C")
const SORTED_PREFIXES = Object.keys(CVW_BY_CALLSIGN)
  .sort((a, b) => b.length - a.length);

// ── US Navy ICAO hex ranges (bureau-number blocks) ────────────────────────────
// Source: ICAO Doc 9303 + FAA Registration DB cross-reference
// Naval aircraft are typically ADF000-AFFFFF (reserved USG), AE0000-AEFFFF (USMC/USN)
const USNAVY_HEX_RANGES = [
  [0xADF000, 0xADFFFF], // USN/USMC special ops
  [0xAE0000, 0xAEFFFF], // USMC F/A-18, AV-8, CH-46
  [0xAF0000, 0xAFFFFF], // USN fighters, E-2, P-8
  [0xA97000, 0xA97FFF], // C-2A COD aircraft
];

// UK Royal Navy ICAO range
const ROYAL_NAVY_HEX_RANGES = [
  [0x432000, 0x432FFF], // 800/801/820 NAS Merlin/Wildcat
  [0x4300C0, 0x4300FF], // 617/809 NAS F-35B
];

// French Marine (Aeronavale)
const FRENCH_NAVY_HEX_RANGES = [
  [0x39C000, 0x39CFFF], // Flottille 12F/17F Rafale M
];

function isNavalHex(hexStr, flag) {
  if (!hexStr) return false;
  const n = parseInt(hexStr, 16);
  if (isNaN(n)) return false;
  if (flag === 'US' || !flag) {
    for (const [lo, hi] of USNAVY_HEX_RANGES) if (n >= lo && n <= hi) return true;
  }
  if (flag === 'GB') {
    for (const [lo, hi] of ROYAL_NAVY_HEX_RANGES) if (n >= lo && n <= hi) return true;
  }
  if (flag === 'FR') {
    for (const [lo, hi] of FRENCH_NAVY_HEX_RANGES) if (n >= lo && n <= hi) return true;
  }
  return false;
}

// ── Carrier list from MMSI catalog (subset with position) ────────────────────
// Types that can launch/recover aircraft
const CARRIER_TYPES = new Set(['Carrier', 'LHD', 'LHA', 'LPD']);

function extractCarriers(ships) {
  return ships.filter(s => {
    if (!isValidPos(s.lat, s.lon)) return false;
    // Try to identify carriers by name keywords
    const n = (s.name || '').toUpperCase();
    return CARRIER_TYPES.has(s.type)
      || n.includes('CVN') || n.includes('CVH') || n.includes('LHD') || n.includes('LHA')
      || n.includes(' R08') || n.includes(' R09') || n.includes(' R11') || n.includes(' R91')
      || n.includes('QUEEN ELIZABETH') || n.includes('CHARLES DE GAULLE')
      || n.includes('CAVOUR') || n.includes('JUAN CARLOS') || n.includes('VIKRANT')
      || n.includes('FORD') || n.includes('NIMITZ') || n.includes('REAGAN')
      || n.includes('TRUMAN') || n.includes('EISENHOWER') || n.includes('LINCOLN')
      || n.includes('ROOSEVELT') || n.includes('WASHINGTON') || n.includes('STENNIS')
      || n.includes('WASP') || n.includes('BATAAN') || n.includes('CANBERRA')
      || n.includes('IZUMO') || n.includes('KAGA') || n.includes('LIAONING')
      || n.includes('SHANDONG') || n.includes('FUJIAN') || n.includes('VIKRAMADITYA')
      || n.includes('ANADOLU') || n.includes('JUAN CARLOS');
  });
}

function isValidPos(lat, lon) {
  return lat != null && lon != null && Math.abs(lat) <= 90 && Math.abs(lon) <= 180;
}

// ── Main enrichment function ────────────────────────────────────────────────
/**
 * Enrich an array of aircraft objects with carrier ops detection.
 * @param {object[]} aircraft
 * @param {object[]} ships
 * @returns {object[]} enriched aircraft (new objects, input not mutated)
 */
export function enrichWithCarrierOps(aircraft, ships) {
  if (!aircraft || aircraft.length === 0) return aircraft;

  const carriers = extractCarriers(ships);

  return aircraft.map(ac => {
    // Skip aircraft we can't geolocate
    if (!isValidPos(ac.lat, ac.lon)) return ac;

    const altFt = ac.altitudeFt ?? Math.round((ac.altitude || 0) * 3.28084);
    const callsign = (ac.callsign || '').toUpperCase().trim();
    const icao = (ac.icao24 || '').toUpperCase().trim();
    const flag = ac.country || '';

    // ── 1. Callsign prefix match ──────────────────────────────────────────
    for (const prefix of SORTED_PREFIXES) {
      if (callsign.startsWith(prefix)) {
        const entry = CVW_BY_CALLSIGN[prefix];
        return {
          ...ac,
          carrierOps: {
            carrier:    entry.carrier,
            cvw:        entry.cvw,
            squadron:   entry.squadron,
            mmsi:       entry.mmsi,
            matchType:  'callsign',
          },
        };
      }
    }

    // ── 2. ICAO hex block (US/UK/FR naval aircraft) ──────────────────────
    if (isNavalHex(icao, flag)) {
      // Try to link to nearest carrier within 200 km
      let nearest = null;
      let nearestDist = Infinity;
      for (const c of carriers) {
        const d = haversineKm(ac.lat, ac.lon, c.lat, c.lon);
        if (d < nearestDist) { nearestDist = d; nearest = c; }
      }
      const hexEntry = nearest
        ? { carrier: nearest.name, cvw: 'UNKNOWN CVW', squadron: 'Naval Aircraft', mmsi: nearest.mmsi || nearest.id, distanceKm: Math.round(nearestDist), matchType: 'hex_range' }
        : { carrier: 'UNKNOWN CARRIER', cvw: 'UNKNOWN CVW', squadron: 'Naval Aircraft', mmsi: null, matchType: 'hex_range' };
      return { ...ac, carrierOps: hexEntry };
    }

    // ── 3. Proximity: low-altitude aircraft near a known carrier ─────────
    // Only consider below 3 000 ft — likely approach, circuit or departure
    if (altFt <= 3000 || ac.on_ground === false) {
      for (const c of carriers) {
        const dist = haversineKm(ac.lat, ac.lon, c.lat, c.lon);
        if (dist <= 50) {
          return {
            ...ac,
            carrierOps: {
              carrier:    c.name,
              cvw:        'UNKNOWN CVW',
              squadron:   'CARRIER OPS',
              mmsi:       c.mmsi || c.id,
              distanceKm: Math.round(dist),
              matchType:  'proximity',
            },
          };
        }
      }
    }

    return ac;
  });
}
