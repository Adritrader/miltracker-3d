import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { fetchAircraft } from './services/opensky.js';
import { fetchShips } from './services/vesselFinder.js';
import { fetchGDELTNews, fetchNewsAPI, fetchRSSFeeds } from './services/newsService.js';
import { analyzeWithGemini, analyzeLocalDanger, alertsFromNews, computeHotspots, probeGeminiModel } from './services/aiDanger.js';
import { loadCache, saveCache } from './services/diskCache.js';
import { fetchConflictEvents } from './services/conflictService.js';
import { recordSnapshot, getHistory, getTimeRange, saveHistory } from './services/positionTracker.js';
import { enrichWithCarrierOps } from './services/carrierAirWing.js';
import { getCameras } from './services/cameraService.js';
import { maybeTweetAlert, tweetNow } from './services/twitterService.js';

dotenv.config();

const ALLOWED_ORIGINS = (origin, cb) => {
  // Allow localhost (dev), Vercel deployments, and any domain set via env var
  const allowed = [
    /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/,
    /^https:\/\/.*\.vercel\.app$/,
    /^https:\/\/.*\.railway\.app$/,
    /^https:\/\/.*\.onrender\.com$/,
    /^https:\/\/(www\.)?livewar3d\.com$/,
  ];
  if (!origin) return cb(null, true); // server-to-server / curl
  // Support comma-separated list of extra allowed origins in env var
  const extraOrigins = (process.env.ALLOWED_ORIGIN || '').split(',').map(s => s.trim()).filter(Boolean);
  if (extraOrigins.includes(origin)) return cb(null, true);
  if (allowed.some(re => re.test(origin))) return cb(null, true);
  // In production, reject unknown origins. In dev, allow all.
  if (process.env.NODE_ENV === 'production') {
    console.warn(`[CORS] Blocked origin: ${origin}`);
    return cb(new Error(`CORS: origin ${origin} not allowed`), false);
  }
  cb(null, true); // dev-only fallback — set NODE_ENV=production in Railway to restrict
};

const app = express();
app.set('trust proxy', 1); // S4: respect X-Forwarded-For behind Railway proxy so rate-limiter uses real client IP
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: ALLOWED_ORIGINS, methods: ['GET', 'POST'] },
  maxHttpBufferSize: 5e6, // 5 MB — prevents silent disconnects with large payloads (A5)
});

app.use(compression());
app.use(cors({ origin: ALLOWED_ORIGINS }));
app.use(express.json());

// Rate limit REST endpoints — 30 req/min per IP (S4)
const apiLimiter = rateLimit({
  windowMs: 60_000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});
app.use('/api/', apiLimiter);

// Optional REST API key check — set REST_API_KEY env var to enforce. (S3)
// If not set the check is a no-op so existing deployments keep working.
app.use('/api/', (req, res, next) => {
  const secret = process.env.REST_API_KEY;
  if (!secret) return next();
  const provided = req.headers['x-api-key'];
  if (!provided || provided !== secret) {
    return res.status(401).json({ error: 'Unauthorized — missing or invalid X-Api-Key header.' });
  }
  next();
});

// ─── WebSocket change detection — avoid re-emitting identical data ───────────
const prevHash = { aircraft: '', ships: '', news: '', conflicts: '', danger: '' };
function hashArr(arr) {
  if (!arr || arr.length === 0) return '';
  // S3: use \x00 as field separator — printable chars like '|' can appear in callsigns/ids
  return arr.map(i =>
    [i.id || i.mmsi || '', i.lat ?? '', i.lon ?? '', Math.round(i.heading || i.track || 0), Math.round(i.altitudeFt || (i.altitude || 0) * 3.28)].join('\x00')
  ).join(',');
}
function hashDanger(zones, alerts) {
  const z = (zones || []).map(z => z.id || z.label || '').join(',');
  const a = (alerts || []).map(a => a.id || '').join(',');
  return `${z}|${a}`;
}

// ─── Conflict/news persistent accumulating stores ────────────────────────────
// Events are ADDED (never replaced) and expire after 72h.
// This preserves the original firstSeenAt so "1m ago" is accurate.
const CONFLICT_TTL = 72 * 60 * 60_000;  // 72 hours in ms
const NEWS_TTL     = 72 * 60 * 60_000;

// Rebuild stores from disk cache (only keep non-expired events)
function buildStore(diskItems, ttl) {
  const now = Date.now();
  const store = new Map();
  for (const item of (diskItems || [])) {
    const ts = item.firstSeenAt || item.publishedAt;
    if (ts && now - new Date(ts).getTime() < ttl) {
      store.set(item.id, item);
    }
  }
  return store;
}

const conflictStore = buildStore(loadCache('conflicts', []), CONFLICT_TTL);
const newsStore     = buildStore(loadCache('news',      []), NEWS_TTL);

// Load persisted AI insight (served immediately on connect, refreshed every ~30min)
let cachedAiInsight = loadCache('ai_insight', null);
const GEMINI_COOLDOWN_MS = 60 * 60_000; // 60 minutes — conserve free-tier quota
let lastGeminiCallAt = 0; // epoch ms of last successful Gemini request

// Merge fresh events into a store; returns { changed, items[] }
function mergeIntoStore(store, freshEvents, ttl, maxSize = Infinity) {
  const now = Date.now();
  const nowIso = new Date().toISOString();
  let changed = false;

  // Add events not yet seen — firstSeenAt = NOW (poll time) so articles added in
  // different polls get naturally different ages in the UI
  for (const ev of freshEvents) {
    if (!ev.id) continue;
    if (!store.has(ev.id)) {
      store.set(ev.id, { ...ev, firstSeenAt: nowIso });
      changed = true;
    }
  }

  // Expire events older than TTL — anchor on publishedAt (real article time) with firstSeenAt as fallback
  for (const [id, ev] of store.entries()) {
    const ts = ev.publishedAt || ev.firstSeenAt;
    if (!ts || now - new Date(ts).getTime() >= ttl) {
      store.delete(id);
      changed = true;
    }
  }

  const items = [...store.values()]
    .sort((a, b) => new Date(b.publishedAt || b.firstSeenAt || 0) - new Date(a.publishedAt || a.firstSeenAt || 0));
  // Enforce max store size — evict oldest entries beyond limit (B3/O15)
  if (isFinite(maxSize) && store.size > maxSize) {
    for (const item of items.slice(maxSize)) {
      store.delete(item.id);
    }
    changed = true;
    return { changed, items: items.slice(0, maxSize) };
  }
  return { changed, items };
}

// ─── In-memory cache (pre-loaded from disk so first connect serves real data)
let cache = {
  aircraft:           loadCache('aircraft',  []),
  ships:              loadCache('ships',     []),
  news:               [...newsStore.values()].sort((a,b) => new Date(b.publishedAt||b.firstSeenAt||0) - new Date(a.publishedAt||a.firstSeenAt||0)),
  conflicts:          [...conflictStore.values()].sort((a,b) => new Date(b.publishedAt||b.firstSeenAt||0) - new Date(a.publishedAt||a.firstSeenAt||0)),
  alerts:             [],
  hotspots:           [],
  dangerZones:        [],
  lastAircraftUpdate: null,
  lastShipUpdate:     null,
  lastNewsUpdate:     null,
  lastConflictUpdate: null,
};

// ─── REST endpoints ──────────────────────────────────────────────────────────
app.get('/api/status', (req, res) => {
  const firmsCount = cache.conflicts.filter(c => c.source === 'NASA FIRMS').length;
  res.json({
    status: 'online',
    clients: io.engine.clientsCount,
    aircraft: cache.aircraft.length,
    ships: cache.ships.length,
    news: cache.news.length,
    conflicts: cache.conflicts.length - firmsCount,
    firms: firmsCount,
    alerts: cache.alerts.length,
    lastAircraftUpdate: cache.lastAircraftUpdate,
    lastShipUpdate: cache.lastShipUpdate,
    lastNewsUpdate: cache.lastNewsUpdate,
    lastConflictUpdate: cache.lastConflictUpdate,
    version: process.env.npm_package_version || '2.1.0',
  });
});

app.get('/api/aircraft', (req, res) => res.json(cache.aircraft));
app.get('/api/ships',    (req, res) => res.json(cache.ships));
app.get('/api/news',     (req, res) => res.json(cache.news));
app.get('/api/alerts',   (req, res) => res.json(cache.alerts));
app.get('/api/hotspots', (req, res) => res.json(cache.hotspots));
app.get('/api/conflicts',(req, res) => res.json(cache.conflicts));
app.get('/api/cameras',  (req, res) => res.json(getCameras()));

// ─── Admin: manual tweet trigger ─────────────────────────────────────────────
app.post('/api/admin/tweet', async (req, res) => {
  const secret = req.headers['x-admin-secret'];
  if (!secret || secret !== process.env.ADMIN_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    // Pick most recent critical alert, or post a generic launch tweet
    const alert = cache.alerts.find(a => a.severity === 'critical') || null;
    await tweetNow(alert);
    res.json({ ok: true, tweeted: alert?.title || 'Generic launch tweet' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Aircraft polling (every 15 seconds) ────────────────────────────────────
async function pollAircraft() {
  try {
    const raw = await fetchAircraft();
    // Enrich with carrier air wing detection
    const aircraft = enrichWithCarrierOps(raw, cache.ships);
    const carrierCount = aircraft.filter(a => a.carrierOps).length;
    if (carrierCount > 0) console.log(`[Carrier] ${carrierCount} aircraft tagged with carrier ops`);

    cache.aircraft = aircraft;
    cache.lastAircraftUpdate = new Date().toISOString();

    // Refresh danger zones (static — no alert generation from positions)
    const zones = analyzeLocalDanger(aircraft, cache.ships, cache.news);
    cache.dangerZones = zones.dangerZones;

    // Record position snapshot for timeline replay
    recordSnapshot(aircraft, cache.ships);

    const acHash = hashArr(aircraft);
    if (acHash !== prevHash.aircraft) {
      io.emit('aircraft_update', { aircraft, timestamp: cache.lastAircraftUpdate });
      prevHash.aircraft = acHash;
    }
    // Only emit danger_update when zones or alerts changed (P3)
    const dHash = hashDanger(cache.dangerZones, cache.alerts);
    if (dHash !== prevHash.danger) {
      io.emit('danger_update', { dangerZones: cache.dangerZones, alerts: cache.alerts, hotspots: cache.hotspots });
      prevHash.danger = dHash;
    }
    const knownSources = ['adsb.lol', 'adsb.fi', 'airplanes.live'];
    const isReal = aircraft.length > 0 && knownSources.includes(aircraft[0]?.source);
    console.log(`[Aircraft] ${aircraft.length} aircraft emitted (${isReal ? `REAL – ${aircraft[0].source}` : 'CACHED – awaiting next cycle'})`);
    if (isReal) saveCache('aircraft', aircraft);
  } catch (err) {
    console.error('[Aircraft] Poll error:', err.message);
  }
}

// ─── Ships polling (every 60 seconds) ────────────────────────────────────────
async function pollShips() {
  try {
    const ships = await fetchShips();
    cache.ships = ships;
    cache.lastShipUpdate = new Date().toISOString();
    const shipHash = hashArr(ships);
    if (shipHash !== prevHash.ships) {
      io.emit('ship_update', { ships, timestamp: cache.lastShipUpdate });
      prevHash.ships = shipHash;
    }
    console.log(`[Ships] ${ships.length} vessels emitted`);
    if (ships.length > 0) saveCache('ships', ships);
  } catch (err) {
    console.error('[Ships] Poll error:', err.message);
  }
}

// ─── Conflict events polling (every 10 minutes) ─────────────────────────────
async function pollConflicts() {
  try {
    const freshEvents = await fetchConflictEvents();
    const { changed, items: conflicts } = mergeIntoStore(conflictStore, freshEvents, CONFLICT_TTL, 500);
    if (changed) {
      cache.conflicts = conflicts;
      cache.lastConflictUpdate = new Date().toISOString();
      io.emit('conflict_update', { conflicts, timestamp: cache.lastConflictUpdate });
      saveCache('conflicts', conflicts);
      console.log(`[Conflicts] Store updated: ${conflicts.length} events total (${freshEvents.length} fetched)`);
    } else {
      console.log(`[Conflicts] No new events (${freshEvents.length} fetched, ${conflictStore.size} in store)`);
    }
  } catch (err) {
    console.error('[Conflicts] Poll error:', err.message);
  }
}

// ─── News polling (every 5 minutes) ──────────────────────────────────────────
async function pollNews() {
  try {
    const [gdelt, newsapi, rss] = await Promise.allSettled([
      fetchGDELTNews(),
      fetchNewsAPI(),
      fetchRSSFeeds(),
    ]);
    const gdeltItems = gdelt.status === 'fulfilled' ? gdelt.value : [];
    const newsItems  = newsapi.status === 'fulfilled' ? newsapi.value : [];
    const rssItems   = rss.status   === 'fulfilled' ? rss.value   : [];
    console.log(`[News] GDELT:${gdeltItems.length} NewsAPI:${newsItems.length} RSS:${rssItems.length}`);

    // Dedup by url first, then by title fingerprint (catches same story from different sources)
    const merged = [...rssItems, ...gdeltItems, ...newsItems];
    const seenUrl   = new Set();
    const seenTitle = new Set();
    const freshNews = merged.filter(n => {
      // URL dedup
      if (n.url && seenUrl.has(n.url)) return false;
      if (n.url) seenUrl.add(n.url);
      // Title fingerprint dedup: lowercase, strip punctuation, take first 10 words
      const titleFp = (n.title || '')
        .toLowerCase()
        .replace(/[^a-z0-9 ]/g, '')
        .split(/\s+/).slice(0, 10).join(' ');
      if (titleFp.length > 8 && seenTitle.has(titleFp)) return false;
      if (titleFp.length > 8) seenTitle.add(titleFp);
      const key = n.url || n.title;
      if (!key) return false;
      if (!n.id) n.id = `news-${encodeURIComponent(key).slice(0, 80)}`;
      return true;
    }).slice(0, 200);

    // Merge into persistent store — only add new items, preserve firstSeenAt
    const { changed, items: news } = mergeIntoStore(newsStore, freshNews, NEWS_TTL, 200);
    if (changed) {
      cache.news = news.slice(0, 100);
      cache.lastNewsUpdate = new Date().toISOString();
      saveCache('news', cache.news);
      // Re-compute alerts only when news changed — avoids unnecessary CPU + network (B11/O17)
      cache.alerts = alertsFromNews(cache.news, { aircraft: cache.aircraft, ships: cache.ships, conflicts: cache.conflicts });
      cache.hotspots = computeHotspots({ alerts: cache.alerts, aircraft: cache.aircraft, ships: cache.ships, conflicts: cache.conflicts });
      saveCache('alerts', cache.alerts);
      console.log(`[Alerts] ${cache.alerts.length} alerts (critical:${cache.alerts.filter(a=>a.severity==='critical').length}) | ${cache.hotspots.length} hotspots`);
      console.log(`[CrossRef] Credibility range: ${Math.min(...cache.alerts.map(a=>a.credibility||0))}%–${Math.max(...cache.alerts.map(a=>a.credibility||0))}%`);
      // Auto-tweet new critical alerts
      maybeTweetAlert(cache.alerts).catch(() => {});
    }

    // AI analysis — only when news changed AND 30-min cooldown has elapsed
    const geminiReady = process.env.GEMINI_API_KEY
      && cache.news.length > 0
      && changed
      && (Date.now() - lastGeminiCallAt) >= GEMINI_COOLDOWN_MS;

    if (geminiReady) {
      try {
        console.log('[AI] Requesting Gemini analysis…');
        const aiInsights = await analyzeWithGemini(cache.news.slice(0, 10), cache.aircraft, cache.ships);
        if (aiInsights) {
          cachedAiInsight = aiInsights;
          lastGeminiCallAt = Date.now();
          saveCache('ai_insight', aiInsights);
          io.emit('ai_insight', aiInsights);
          console.log('[AI] Analysis emitted.');
        }
      } catch (e) {
        console.error('[AI] Gemini error:', e.message);
        io.emit('ai_insight', { error: e.message, source: 'gemini_error', timestamp: new Date().toISOString() });
      }
    } else if (process.env.GEMINI_API_KEY && !geminiReady) {
      const waitMin = Math.ceil((GEMINI_COOLDOWN_MS - (Date.now() - lastGeminiCallAt)) / 60000);
      if (lastGeminiCallAt > 0) console.log(`[AI] Cooldown active — next call in ~${waitMin}m`);
    }

    if (changed) {
      io.emit('news_update', { news: cache.news, timestamp: cache.lastNewsUpdate });
      console.log(`[News] Store updated: ${cache.news.length} items total`);
    } else {
      console.log(`[News] No new items (${freshNews.length} fetched, ${newsStore.size} in store)`);
    }
    // Only emit danger_update when alerts or zones actually changed (B11/P3)
    const dangerHash = hashDanger(cache.dangerZones, cache.alerts);
    if (dangerHash !== prevHash.danger) {
      io.emit('danger_update', { dangerZones: cache.dangerZones, alerts: cache.alerts, hotspots: cache.hotspots });
      prevHash.danger = dangerHash;
    }
  } catch (err) {
    console.error('[News] Poll error:', err.message);
  }
}

// ─── Socket.io events ────────────────────────────────────────────────────────
const SERVER_INFO = {
  geminiEnabled: !!process.env.GEMINI_API_KEY,
};

io.on('connection', (socket) => {
  console.log(`[Socket] Client connected: ${socket.id}`);

  // Per-socket rate limiting for client-initiated events
  let lastRequestData    = 0;
  let lastRequestHistory = 0;

  // Inform client of server capabilities
  socket.emit('server_info', SERVER_INFO);

  // Send cached data immediately on connect
  socket.emit('aircraft_update', { aircraft: cache.aircraft, timestamp: cache.lastAircraftUpdate });
  socket.emit('ship_update',     { ships: cache.ships,       timestamp: cache.lastShipUpdate });
  socket.emit('news_update',     { news: cache.news,         timestamp: cache.lastNewsUpdate });
  socket.emit('conflict_update', { conflicts: cache.conflicts, timestamp: cache.lastConflictUpdate });
  socket.emit('danger_update',   { dangerZones: cache.dangerZones, alerts: cache.alerts, hotspots: cache.hotspots });
  // Serve persisted AI insight immediately — no need to wait for next Gemini poll
  if (cachedAiInsight) socket.emit('ai_insight', cachedAiInsight);

  socket.on('request_data', (payload = {}) => {
    const now = Date.now();
    if (now - lastRequestData < 5000) return; // 5 s cooldown — prevents flood
    lastRequestData = now;
    // A6: client can pass { since: { aircraft: ISOstring, ships: ISOstring, ... } }
    // so only stale slices are re-sent, reducing reconnect bandwidth.
    const since = (typeof payload === 'object' && payload !== null) ? (payload.since || {}) : {};
    const newer = (cacheTs, sinceTs) => !sinceTs || !cacheTs || new Date(cacheTs) > new Date(sinceTs);
    if (newer(cache.lastAircraftUpdate, since.aircraft))
      socket.emit('aircraft_update', { aircraft: cache.aircraft, timestamp: cache.lastAircraftUpdate });
    if (newer(cache.lastShipUpdate, since.ships))
      socket.emit('ship_update',     { ships: cache.ships,       timestamp: cache.lastShipUpdate });
    if (newer(cache.lastNewsUpdate, since.news))
      socket.emit('news_update',     { news: cache.news,         timestamp: cache.lastNewsUpdate });
    if (newer(cache.lastConflictUpdate, since.conflicts))
      socket.emit('conflict_update', { conflicts: cache.conflicts, timestamp: cache.lastConflictUpdate });
  });

  // Timeline history: client requests full snapshot buffer
  socket.on('request_history', () => {
    const now = Date.now();
    if (now - lastRequestHistory < 10000) return; // 10 s cooldown
    lastRequestHistory = now;
    const snapshots = getHistory();
    const range     = getTimeRange();
    socket.emit('history_data', { snapshots, range });
    console.log(`[History] Sent ${snapshots.length} snapshots to ${socket.id}`);
  });

  socket.on('disconnect', () => {
    console.log(`[Socket] Client disconnected: ${socket.id}`);
  });
});

// ─── Global error handler ────────────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('[Express] Unhandled error:', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

// ─── Start polling ────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`\n🛰️  LiveWar3D Backend running on port ${PORT}`);
  console.log(`   Aircraft polling: every 30 seconds (adsb.lol / adsb.fi / airplanes.live)`);
  console.log(`   Ships polling:    every 60 seconds`);
  console.log(`   News polling:     every 5 minutes\n`);

  // Initial fetch
  pollAircraft();
  pollShips();
  pollNews();
  pollConflicts();

  // Probe Gemini on startup — logs which model is available (or why it failed)
  // Note: only calls listModels (no generateContent) — does NOT consume quota
  if (process.env.GEMINI_API_KEY) probeGeminiModel(process.env.GEMINI_API_KEY);
  // Stagger first Gemini analysis by one full cooldown so a rapid redeploy
  // cycle doesn't burn quota — first real call will happen after first changed poll
  lastGeminiCallAt = Date.now() - GEMINI_COOLDOWN_MS + 5 * 60_000; // allow after 5 min

  // Intervals — use recursive setTimeout for pollShips to prevent overlap
  // if a fetch takes longer than the interval (B4)
  const scheduleAircraft = () => pollAircraft().finally(() => setTimeout(scheduleAircraft, 30_000));
  setTimeout(scheduleAircraft, 30_000); // recursive — prevents overlap if fetch > 30 s (A7)
  const scheduleShips = () => pollShips().finally(() => setTimeout(scheduleShips, 60_000));
  setTimeout(scheduleShips, 60_000);
  setInterval(pollNews,    5 * 60_000);
  setInterval(pollConflicts, 10 * 60_000);
  // Persist snapshot ring buffer to disk every 5 min so Railway redeploys retain history (A4)
  setInterval(saveHistory, 5 * 60_000);
});
