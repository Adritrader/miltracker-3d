/**
 * diskCache.js – Persist aircraft / ships / news to disk so the server
 * serves real data immediately on restart without waiting for the first
 * API poll to complete.
 *
 * Files are written to  backend/data/*.cache.json
 * They are loaded synchronously at startup (tiny files, safe to block once).
 */

import { readFileSync, writeFile, rename, mkdirSync, existsSync } from 'fs';
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
  aircraft:   30 * 60_000,         // 30 min
  ships:      60 * 60_000,         // 1 hour
  news:        60 * 60_000,         // 1 hour
  conflicts:   2 * 60 * 60_000,    // 2 hours
  ai_insight:       6 * 60 * 60_000,    // 6 hours — Gemini quota is limited
  aircraft_intel:  7 * 24 * 60 * 60_000, // 7 days — AI aircraft identifications
  history:         2 * 60 * 60_000,    // 2 hours — position tracker ring buffer (A4)
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
  const tmp  = file + '.tmp';
  const payload = JSON.stringify({ savedAt: new Date().toISOString(), data }, null, 0);
  // Write to .tmp first, then atomically rename — prevents JSON corruption if
  // the process is killed mid-write (B-C7 audit fix).
  writeFile(tmp, payload, 'utf8', (writeErr) => {
    if (writeErr) {
      console.warn(`[Cache] Could not write ${key} cache:`, writeErr.message);
      return;
    }
    rename(tmp, file, (renameErr) => {
      if (renameErr) console.warn(`[Cache] Could not rename ${key} cache:`, renameErr.message);
    });
  });
}
