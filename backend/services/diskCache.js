/**
 * diskCache.js – Persist aircraft / ships / news to disk so the server
 * serves real data immediately on restart without waiting for the first
 * API poll to complete.
 *
 * Files are written to  backend/data/*.cache.json
 * They are loaded synchronously at startup (tiny files, safe to block once).
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dir, '..', 'data');

// Ensure the data directory exists
if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });

function cachePath(key) {
  return join(DATA_DIR, `${key}.cache.json`);
}

// Default max age: 1 hour. Conflicts and news change often; aircraft are fresh from live ADS-B.
const CACHE_TTLS = {
  aircraft:  30 * 60_000,  // 30 min — ADS-B can go stale quickly
  ships:     60 * 60_000,  // 1 hour
  news:      60 * 60_000,  // 1 hour
  conflicts: 2 * 60 * 60_000, // 2 hours
};

/**
 * Load a cache file from disk. Returns the parsed value or `fallback` if the
 * file doesn't exist, is corrupt, or is older than its TTL.
 */
export function loadCache(key, fallback = []) {
  const file = cachePath(key);
  if (!existsSync(file)) return fallback;
  try {
    const raw = readFileSync(file, 'utf8');
    const parsed = JSON.parse(raw);
    const maxAge = CACHE_TTLS[key] ?? 60 * 60_000;
    const age = Date.now() - new Date(parsed.savedAt).getTime();
    if (age > maxAge) {
      console.log(`[Cache] ${key} cache expired (${Math.round(age / 60_000)}min old, max ${Math.round(maxAge / 60_000)}min) — ignoring`);
      return fallback;
    }
    console.log(`[Cache] Loaded ${key}: ${Array.isArray(parsed.data) ? parsed.data.length : '?'} items from disk (saved ${parsed.savedAt})`);
    return parsed.data ?? fallback;
  } catch (e) {
    console.warn(`[Cache] Could not read ${key} cache:`, e.message);
    return fallback;
  }
}

/**
 * Save data to disk asynchronously (fire-and-forget, never blocks the poll).
 */
export function saveCache(key, data) {
  const file = cachePath(key);
  const payload = JSON.stringify({ savedAt: new Date().toISOString(), data }, null, 0);
  // setImmediate so we never block the event loop
  setImmediate(() => {
    try {
      writeFileSync(file, payload, 'utf8');
    } catch (e) {
      console.warn(`[Cache] Could not write ${key} cache:`, e.message);
    }
  });
}
