/**
 * trailStore.js – IndexedDB-backed persistence for aircraft & ship trails.
 *
 * Why IndexedDB instead of sessionStorage / Supabase?
 * - sessionStorage is tab-scoped & 5 MB max → trails lost on tab close.
 * - Supabase adds latency & cost for ephemeral local data.
 * - IndexedDB is local, async, ~unlimited storage, persists across sessions.
 *
 * Schema  (object store "trails"):
 *   key   = "<type>:<entityId>"   e.g. "aircraft:ae1234"
 *   value = { id, type, entityId, points: [{x,y,z,a?}], ts: epoch_ms }
 *
 * Trails older than MAX_AGE_MS (24 h) are pruned on startup.
 */

const DB_NAME    = 'miltracker_trails';
const DB_VERSION = 1;
const STORE      = 'trails';
const MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

/* ── singleton DB handle ────────────────────────────────── */
let _dbPromise;

function getDB() {
  if (_dbPromise) return _dbPromise;
  _dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id' });
        store.createIndex('type', 'type', { unique: false });
        store.createIndex('ts',   'ts',   { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => { _dbPromise = null; reject(req.error); };
  });
  return _dbPromise;
}

/* ── public API ─────────────────────────────────────────── */

/**
 * Save a trail map to IndexedDB.
 * @param {'aircraft'|'ship'} type
 * @param {Map<string, Array>} trailMap  entityId → points array.
 *   Aircraft points: { pos: Cartesian3, altM }  → stored as {x,y,z,a}
 *   Ship points:      Cartesian3                → stored as {x,y,z}
 */
export async function saveTrails(type, trailMap) {
  try {
    const db  = await getDB();
    const tx  = db.transaction(STORE, 'readwrite');
    const st  = tx.objectStore(STORE);
    const now = Date.now();

    for (const [entityId, pts] of trailMap.entries()) {
      if (!pts || pts.length === 0) continue;
      const points = type === 'aircraft'
        ? pts.map(p => ({ x: p.pos.x, y: p.pos.y, z: p.pos.z, a: p.altM }))
        : pts.map(p => ({ x: p.x,     y: p.y,     z: p.z }));
      st.put({ id: `${type}:${entityId}`, type, entityId, points, ts: now });
    }

    await new Promise((res, rej) => { tx.oncomplete = res; tx.onerror = () => rej(tx.error); });
  } catch { /* indexedDB unavailable — silent */ }
}

/**
 * Load all trails for a type from IndexedDB.
 * @param {'aircraft'|'ship'} type
 * @param {function} pointMapper  Converts stored {x,y,z,a?} → runtime format.
 * @returns {Promise<Map<string, Array>>}
 */
export async function loadTrails(type, pointMapper) {
  try {
    const db  = await getDB();
    const tx  = db.transaction(STORE, 'readonly');
    const idx = tx.objectStore(STORE).index('type');
    const req = idx.getAll(type);

    const rows = await new Promise((res, rej) => {
      req.onsuccess = () => res(req.result);
      req.onerror   = () => rej(req.error);
    });

    const map = new Map();
    for (const row of rows) {
      map.set(row.entityId, row.points.map(pointMapper));
    }
    return map;
  } catch {
    return new Map();
  }
}

/**
 * Remove trails older than MAX_AGE_MS. Call once on app start.
 */
export async function pruneOldTrails() {
  try {
    const db     = await getDB();
    const tx     = db.transaction(STORE, 'readwrite');
    const store  = tx.objectStore(STORE);
    const idx    = store.index('ts');
    const cutoff = Date.now() - MAX_AGE_MS;
    const range  = IDBKeyRange.upperBound(cutoff);
    const req    = idx.openCursor(range);

    req.onsuccess = () => {
      const cursor = req.result;
      if (cursor) { cursor.delete(); cursor.continue(); }
    };

    await new Promise((res, rej) => { tx.oncomplete = res; tx.onerror = () => rej(tx.error); });
  } catch { /* silent */ }
}
