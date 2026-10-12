/**
 * regionActivity.js — military air activity per hotspot region, now vs. the
 * same hour yesterday ("+40% in the Gulf").
 *
 * Each fresh aircraft poll adds a sample (count of military-flagged aircraft
 * inside each region's radius) to an hourly bucket. Buckets cover ~26h and are
 * persisted with the disk cache so a restart doesn't wipe the baseline.
 * Only aircraft from the global /mil feeds are counted — the regional feeds
 * also include fast civilian traffic, which would make "military activity"
 * misleading.
 */

import { loadCache, saveCache } from './diskCache.js';
import { distKm } from './aiDanger.js';

// Same centres/radii as the regional polls in opensky.js (nm → km)
export const REGIONS = [
  { id: 'gulf',       label: 'Persian Gulf',   lat: 26.5, lon: 56.0,  radiusKm: 700 * 1.852 },
  { id: 'black-sea',  label: 'Black Sea / UA', lat: 46.5, lon: 33.0,  radiusKm: 650 * 1.852 },
  { id: 'taiwan-str', label: 'Taiwan Strait',  lat: 24.0, lon: 122.0, radiusKm: 500 * 1.852 },
  { id: 'korea',      label: 'Korea',          lat: 37.5, lon: 127.5, radiusKm: 450 * 1.852 },
  { id: 'east-med',   label: 'East Med',       lat: 34.5, lon: 33.5,  radiusKm: 600 * 1.852 },
  { id: 'baltic',     label: 'Baltic',         lat: 57.0, lon: 20.0,  radiusKm: 500 * 1.852 },
];

const MIL_SOURCES = new Set(['adsb.lol', 'adsb.fi', 'airplanes.live']);
const HOUR_MS     = 3600 * 1000;
const KEEP_HOURS  = 26;
const SAVE_EVERY_MS = 5 * 60 * 1000;
// Below this baseline a percentage is noise (1 → 4 aircraft is "+300%")
const MIN_BASELINE = 3;

// { [hourStartMs]: { [regionId]: { sum, n } } }
let buckets = loadCache('region_activity', {}) || {};
let lastSave = 0;

function prune(now) {
  const cutoff = now - KEEP_HOURS * HOUR_MS;
  for (const k of Object.keys(buckets)) if (+k < cutoff) delete buckets[k];
}

/** Record one poll's worth of aircraft. Call only with fresh (non-cached) data. */
export function recordRegionActivity(aircraft = [], now = Date.now()) {
  const hour = Math.floor(now / HOUR_MS) * HOUR_MS;
  const bucket = buckets[hour] || (buckets[hour] = {});
  const mil = aircraft.filter(a => MIL_SOURCES.has(a.source) && !a.on_ground);
  for (const r of REGIONS) {
    const count = mil.filter(a => distKm(r.lat, r.lon, a.lat, a.lon) <= r.radiusKm).length;
    const b = bucket[r.id] || (bucket[r.id] = { sum: 0, n: 0 });
    b.sum += count;
    b.n += 1;
  }
  prune(now);
  if (now - lastSave > SAVE_EVERY_MS) {
    lastSave = now;
    saveCache('region_activity', buckets);
  }
}

const avg = b => (b && b.n ? b.sum / b.n : null);

/** `[{ id, label, now, dayAgo, changePct }]` — changePct null when not meaningful. */
export function getRegionActivity(now = Date.now()) {
  const hour = Math.floor(now / HOUR_MS) * HOUR_MS;
  const cur  = buckets[hour] || {};
  const prev = buckets[hour - HOUR_MS] || {};
  const ago  = buckets[hour - 24 * HOUR_MS] || {};
  return REGIONS.map(r => {
    // Early in the hour the current bucket has few samples — fall back to the last full hour
    const nowAvg = (cur[r.id]?.n || 0) >= 3 ? avg(cur[r.id]) : (avg(prev[r.id]) ?? avg(cur[r.id]));
    const agoAvg = avg(ago[r.id]);
    const changePct = nowAvg != null && agoAvg != null && agoAvg >= MIN_BASELINE
      ? Math.round(((nowAvg - agoAvg) / agoAvg) * 100)
      : null;
    return {
      id: r.id,
      label: r.label,
      now: nowAvg != null ? Math.round(nowAvg) : null,
      dayAgo: agoAvg != null ? Math.round(agoAvg) : null,
      changePct,
    };
  });
}
