/**
 * aircraftPhotos.js — photo of the specific airframe (by ICAO24 hex) from
 * Planespotters.net's public photo API.
 *
 * Proxied through the backend because Planespotters requires a User-Agent with
 * a contact URL, and so results are cached across all visitors. Their terms
 * require showing the photographer and linking back to the photo page — the
 * frontend renders both from `photographer` and `link`.
 */

import fetch from 'node-fetch';

const API = 'https://api.planespotters.net/pub/photos/hex/';
const HEADERS = {
  'User-Agent': 'LiveWar3D/1.0 (+https://livewar3d.com/about.html)',
  'Accept': 'application/json',
};
const TIMEOUT_MS  = 5000;
const HIT_TTL_MS  = 7 * 24 * 3600 * 1000; // photos rarely change
const MISS_TTL_MS = 24 * 3600 * 1000;     // new photos do get uploaded
const MAX_CACHE   = 5000;
const RATE_LIMIT_COOLDOWN_MS = 5 * 60 * 1000;

const _cache    = new Map(); // hex → { photo, expires }
const _inflight = new Map(); // hex → Promise
let _cooldownUntil = 0;

const SAFE_URL = /^https:\/\/[a-z0-9.-]*planespotters\.net\//i;
const SAFE_IMG = /^https:\/\/[a-z0-9.-]*plnspttrs\.net\//i;

function remember(hex, photo) {
  _cache.delete(hex); // re-insert → most recent at the end (LRU order)
  _cache.set(hex, { photo, expires: Date.now() + (photo ? HIT_TTL_MS : MISS_TTL_MS) });
  if (_cache.size > MAX_CACHE) _cache.delete(_cache.keys().next().value);
}

async function lookup(hex) {
  const res = await fetch(API + hex, { headers: HEADERS, signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (res.status === 429) {
    _cooldownUntil = Date.now() + RATE_LIMIT_COOLDOWN_MS;
    throw new Error('rate-limited');
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  const p = data?.photos?.[0];
  const src = p?.thumbnail_large?.src || p?.thumbnail?.src;
  // Only pass through URLs on Planespotters' own domains
  if (!p || !SAFE_IMG.test(src || '') || !SAFE_URL.test(p.link || '')) return null;
  return {
    src,
    link: p.link,
    photographer: String(p.photographer || 'Unknown').slice(0, 80),
  };
}

/**
 * Returns `{ src, link, photographer }` or null when no photo exists.
 * Throws only on upstream failure (caller degrades to the type photo).
 */
export async function getAircraftPhoto(hex) {
  const cached = _cache.get(hex);
  if (cached && cached.expires > Date.now()) return cached.photo;
  if (Date.now() < _cooldownUntil) throw new Error('rate-limited');
  if (_inflight.has(hex)) return _inflight.get(hex);

  const p = lookup(hex)
    .then(photo => { remember(hex, photo); return photo; })
    .finally(() => _inflight.delete(hex));
  _inflight.set(hex, p);
  return p;
}
