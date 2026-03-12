import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { createHash } from 'crypto';
import { fetchAircraft } from './services/opensky.js';
import { fetchShips } from './services/vesselFinder.js';
import { fetchGDELTNews, fetchNewsAPI, fetchRSSFeeds, geocodeNewsItem } from './services/newsService.js';
import { analyzeWithGemini, analyzeLocalDanger, alertsFromNews, computeHotspots, probeGeminiModel } from './services/aiDanger.js';
import { loadCache, saveCache } from './services/diskCache.js';
import { fetchConflictEvents } from './services/conflictService.js';
import { recordSnapshot, getHistory, getTimeRange, saveHistory } from './services/positionTracker.js';
import { enrichWithCarrierOps } from './services/carrierAirWing.js';

// ─── Operational zones — must match frontend/src/utils/militaryFilter.js ──────
const OPERATIONAL_ZONES = [
  { minLat:  8, maxLat: 43, minLon: 24, maxLon: 66 },   // Middle East
  { minLat: 43, maxLat: 58, minLon: 22, maxLon: 45 },   // Ukraine
  { minLat: 37, maxLat: 45, minLon: 38, maxLon: 53 },   // Caucasus
  { minLat: -5, maxLat: 16, minLon: 38, maxLon: 56 },   // Horn of Africa
  { minLat:  5, maxLat: 35, minLon:-18, maxLon: 42 },   // Sahel
  { minLat: 22, maxLat: 38, minLon: 60, maxLon: 82 },   // South Asia
  { minLat:  5, maxLat: 46, minLon:107, maxLon:145 },   // East Asia
  { minLat:  8, maxLat: 28, minLon: 92, maxLon:102 },   // Southeast Asia
  { minLat: 30, maxLat: 48, minLon:-12, maxLon: 36 },   // Mediterranean
  { minLat: 53, maxLat: 60, minLon: 14, maxLon: 30 },   // Baltic
  { minLat: 48, maxLat: 72, minLon:-30, maxLon: 15 },   // North Atlantic
  { minLat:-25, maxLat: 28, minLon: 55, maxLon:100 },   // Indian Ocean
  { minLat:  5, maxLat: 50, minLon:135, maxLon:180 },   // Western Pacific
  { minLat: 25, maxLat: 48, minLon:-85, maxLon:-55 },   // US East Coast
];
function isInOpZone(lat, lon) {
  if (lat == null || lon == null) return false;
  return OPERATIONAL_ZONES.some(z => lat >= z.minLat && lat <= z.maxLat && lon >= z.minLon && lon <= z.maxLon);
}
import { getCameras } from './services/cameraService.js';
import { maybeTweetAlert, tweetNow } from './services/twitterService.js';
import { archiveAlerts, snapshotPositions, upsertDailyStats, purgeOldSnapshots, isEnabled as supabaseEnabled, getEntityTrail, getRecentAlerts, getDailyStats, getActiveEntities, archiveConflicts, getRecentConflicts, archiveNews, getRecentNews, archiveAIInsight, getRecentInsights, analyticsFleetComposition, analyticsAircraftTypes, analyticsHourlyActivity, analyticsTopEntities, analyticsAltitudeDistribution, analyticsSpeedDistribution, analyticsConflictsByZone, analyticsConflictsByType, analyticsNewsBySource, analyticsAlertsBySeverity, subscribeNewsletter } from './services/supabaseStore.js';
import { identifyAircraft, enrichBatchWithIntel, getCachedIntel, getIntelCacheStats } from './services/aiAircraftIntel.js';

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
  // In production AND dev, reject unknown origins — B-M7: explicit whitelist always enforced
  console.warn(`[CORS] Blocked origin: ${origin}`);
  return cb(new Error(`CORS: origin ${origin} not allowed`), false);
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
// F-L16: security headers — helmet with relaxed CSP compatible with Railway/Socket.io
app.use(helmet({
  contentSecurityPolicy: false,  // CSP managed on frontend (Vercel headers)
  crossOriginEmbedderPolicy: false, // required for CesiumJS WebGL
}));

// Rate limit REST endpoints — 120 req/min per IP
// Dashboard opens ≈13 analytics calls at once + live data polling ≈ 20 req burst
const apiLimiter = rateLimit({
  windowMs: 60_000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});
app.use('/api/', apiLimiter);

// Optional REST API key check — set REST_API_KEY env var to enforce. (S3)
// If not set the check is a no-op so existing deployments keep working.
// B-C1: warn on startup if running in production without a key set
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
const GEMINI_COOLDOWN_MS = 30 * 60_000; // 30 minutes — free tier allows ~1500 req/day
let lastGeminiCallAt = 0; // epoch ms of last successful Gemini request
let geminiHasRun = false; // first run bypasses 'changed' requirement

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

// ─── AI Aircraft Intel endpoint ──────────────────────────────────────────────
// On-demand identification: /api/aircraft/intel?callsign=CONDR31&icao24=ae1234&type=B2
// B-C5: validate all user-supplied query params before passing to Gemini
const RE_CALLSIGN = /^[A-Z0-9 _-]{2,10}$/i;
const RE_ICAO24   = /^[0-9a-f]{6}$/i;
const RE_REG      = /^[A-Z0-9-]{2,12}$/i;
const RE_TYPE     = /^[A-Z0-9/-]{2,10}$/i;
const RE_COUNTRY  = /^[A-Za-z ]{2,50}$/;

app.get('/api/aircraft/intel', async (req, res) => {
  let { callsign, icao24, registration, type: aircraftType, country } = req.query;
  if (!callsign && !icao24 && !registration) {
    return res.status(400).json({ error: 'Provide at least one of: callsign, icao24, registration' });
  }
  // Sanitize — reject anything that doesn't match expected patterns
  if (callsign     && !RE_CALLSIGN.test(callsign))     return res.status(400).json({ error: 'Invalid callsign format' });
  if (icao24       && !RE_ICAO24.test(icao24))         return res.status(400).json({ error: 'Invalid icao24 format (6 hex chars)' });
  if (registration && !RE_REG.test(registration))      return res.status(400).json({ error: 'Invalid registration format' });
  if (aircraftType && !RE_TYPE.test(aircraftType))     aircraftType = undefined; // silently drop unknown type
  if (country      && !RE_COUNTRY.test(country))       country = undefined;
  // Normalize to uppercase where applicable
  if (callsign)     callsign     = callsign.toUpperCase().trim();
  if (icao24)       icao24       = icao24.toLowerCase().trim();
  if (registration) registration = registration.toUpperCase().trim();
  try {
    const intel = await identifyAircraft({ callsign, icao24, registration, aircraftType, country });
    res.json(intel || { confidence: 'UNAVAILABLE', reason: 'Gemini API key not set or rate limited' });
  } catch (err) {
    console.error('[AircraftIntel] REST error:', err.message);
    res.status(500).json({ error: 'Failed to identify aircraft' });
  }
});

// Cached intel lookup (no API call): /api/aircraft/intel/cached/:id
app.get('/api/aircraft/intel/cached/:id', (req, res) => {
  const intel = getCachedIntel(req.params.id);
  res.json(intel || { confidence: 'NOT_CACHED' });
});

// Intel cache stats
app.get('/api/aircraft/intel/stats', (req, res) => {
  res.json(getIntelCacheStats());
});

// ─── History endpoints (Supabase) ────────────────────────────────────────────

// Entity trail — e.g. /api/history/trail/a4b7c2?hours=24
app.get('/api/history/trail/:entityId', async (req, res) => {
  if (!supabaseEnabled()) return res.json([]);
  // B-C5: validate entityId to prevent injection via Supabase RPC
  const entityId = req.params.entityId;
  if (!entityId || !/^[a-zA-Z0-9_:.-]{1,64}$/.test(entityId)) {
    return res.status(400).json({ error: 'Invalid entityId' });
  }
  try {
    const hours = Math.min(Math.max(parseInt(req.query.hours) || 24, 1), 336); // max 14 days
    const data = await getEntityTrail(req.params.entityId, hours);
    res.json(data);
  } catch (err) {
    console.error('[History] trail error:', err.message);
    res.status(500).json({ error: 'Failed to fetch trail history' });
  }
});

// Recent alerts — e.g. /api/history/alerts?hours=48&severity=critical
app.get('/api/history/alerts', async (req, res) => {
  if (!supabaseEnabled()) return res.json([]);
  try {
    const hours = Math.min(Math.max(parseInt(req.query.hours) || 48, 1), 336);
    const severity = ['critical','high','medium','low'].includes(req.query.severity) ? req.query.severity : null;
    const limit = Math.min(parseInt(req.query.limit) || 200, 1000);
    const data = await getRecentAlerts(hours, severity, limit);
    res.json(data);
  } catch (err) {
    console.error('[History] alerts error:', err.message);
    res.status(500).json({ error: 'Failed to fetch alert history' });
  }
});

// Daily stats — e.g. /api/history/stats?days=14
app.get('/api/history/stats', async (req, res) => {
  if (!supabaseEnabled()) return res.json([]);
  try {
    const days = Math.min(Math.max(parseInt(req.query.days) || 14, 1), 90);
    const data = await getDailyStats(days);
    res.json(data);
  } catch (err) {
    console.error('[History] stats error:', err.message);
    res.status(500).json({ error: 'Failed to fetch daily stats' });
  }
});

// Active entities — e.g. /api/history/entities?type=aircraft&hours=24
app.get('/api/history/entities', async (req, res) => {
  if (!supabaseEnabled()) return res.json([]);
  try {
    const type = ['aircraft','ship'].includes(req.query.type) ? req.query.type : 'aircraft';
    const hours = Math.min(Math.max(parseInt(req.query.hours) || 24, 1), 336);
    const data = await getActiveEntities(type, hours);
    res.json(data);
  } catch (err) {
    console.error('[History] entities error:', err.message);
    res.status(500).json({ error: 'Failed to fetch entity list' });
  }
});

// Conflict events — e.g. /api/history/conflicts?hours=48&source=NASA%20FIRMS
app.get('/api/history/conflicts', async (req, res) => {
  if (!supabaseEnabled()) return res.json([]);
  try {
    const hours = Math.min(Math.max(parseInt(req.query.hours) || 48, 1), 336);
    const source = req.query.source || null;
    const data = await getRecentConflicts(hours, source, 500);
    res.json(data);
  } catch (err) {
    console.error('[History] conflicts error:', err.message);
    res.status(500).json({ error: 'Failed to fetch conflict history' });
  }
});

// News archive — e.g. /api/history/news?hours=48&source=BBC%20World
app.get('/api/history/news', async (req, res) => {
  if (!supabaseEnabled()) return res.json([]);
  try {
    const hours = Math.min(Math.max(parseInt(req.query.hours) || 48, 1), 336);
    const source = req.query.source || null;
    const data = await getRecentNews(hours, source, 200);
    res.json(data);
  } catch (err) {
    console.error('[History] news error:', err.message);
    res.status(500).json({ error: 'Failed to fetch news history' });
  }
});

// AI Insights — e.g. /api/history/insights?limit=10
app.get('/api/history/insights', async (req, res) => {
  if (!supabaseEnabled()) return res.json([]);
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 20, 1), 100);
    const data = await getRecentInsights(limit);
    res.json(data);
  } catch (err) {
    console.error('[History] insights error:', err.message);
    res.status(500).json({ error: 'Failed to fetch AI insights' });
  }
});

// ─── Analytics endpoints (Supabase RPC) ──────────────────────────────────────

const parseHours = (val, def, max = 336) => Math.min(Math.max(parseInt(val) || def, 1), max);

// A) Fleet composition — /api/analytics/fleet?hours=24
app.get('/api/analytics/fleet', async (req, res) => {
  if (!supabaseEnabled()) return res.json([]);
  try {
    const data = await analyticsFleetComposition(parseHours(req.query.hours, 24));
    res.json(data);
  } catch (err) {
    console.error('[Analytics] fleet error:', err.message);
    res.status(500).json({ error: 'Failed to fetch fleet composition' });
  }
});

// B) Aircraft types — /api/analytics/aircraft-types?hours=24
app.get('/api/analytics/aircraft-types', async (req, res) => {
  if (!supabaseEnabled()) return res.json([]);
  try {
    const data = await analyticsAircraftTypes(parseHours(req.query.hours, 24));
    res.json(data);
  } catch (err) {
    console.error('[Analytics] aircraft-types error:', err.message);
    res.status(500).json({ error: 'Failed to fetch aircraft types' });
  }
});

// C) Hourly activity — /api/analytics/hourly-activity?hours=48
app.get('/api/analytics/hourly-activity', async (req, res) => {
  if (!supabaseEnabled()) return res.json([]);
  try {
    const data = await analyticsHourlyActivity(parseHours(req.query.hours, 48));
    res.json(data);
  } catch (err) {
    console.error('[Analytics] hourly-activity error:', err.message);
    res.status(500).json({ error: 'Failed to fetch hourly activity' });
  }
});

// D) Top entities — /api/analytics/top-entities?hours=24&limit=50
app.get('/api/analytics/top-entities', async (req, res) => {
  if (!supabaseEnabled()) return res.json([]);
  try {
    const hours = parseHours(req.query.hours, 24);
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 50, 1), 200);
    const data = await analyticsTopEntities(hours, limit);
    res.json(data);
  } catch (err) {
    console.error('[Analytics] top-entities error:', err.message);
    res.status(500).json({ error: 'Failed to fetch top entities' });
  }
});

// E) Altitude distribution — /api/analytics/altitude?hours=24
app.get('/api/analytics/altitude', async (req, res) => {
  if (!supabaseEnabled()) return res.json([]);
  try {
    const data = await analyticsAltitudeDistribution(parseHours(req.query.hours, 24));
    res.json(data);
  } catch (err) {
    console.error('[Analytics] altitude error:', err.message);
    res.status(500).json({ error: 'Failed to fetch altitude distribution' });
  }
});

// F) Speed distribution — /api/analytics/speed?hours=24
app.get('/api/analytics/speed', async (req, res) => {
  if (!supabaseEnabled()) return res.json([]);
  try {
    const data = await analyticsSpeedDistribution(parseHours(req.query.hours, 24));
    res.json(data);
  } catch (err) {
    console.error('[Analytics] speed error:', err.message);
    res.status(500).json({ error: 'Failed to fetch speed distribution' });
  }
});

// G) Conflicts by zone — /api/analytics/conflicts-by-zone?hours=72
app.get('/api/analytics/conflicts-by-zone', async (req, res) => {
  if (!supabaseEnabled()) return res.json([]);
  try {
    const data = await analyticsConflictsByZone(parseHours(req.query.hours, 72));
    res.json(data);
  } catch (err) {
    console.error('[Analytics] conflicts-by-zone error:', err.message);
    res.status(500).json({ error: 'Failed to fetch conflicts by zone' });
  }
});

// H) Conflicts by type — /api/analytics/conflicts-by-type?hours=72
app.get('/api/analytics/conflicts-by-type', async (req, res) => {
  if (!supabaseEnabled()) return res.json([]);
  try {
    const data = await analyticsConflictsByType(parseHours(req.query.hours, 72));
    res.json(data);
  } catch (err) {
    console.error('[Analytics] conflicts-by-type error:', err.message);
    res.status(500).json({ error: 'Failed to fetch conflicts by type' });
  }
});

// I) News by source — /api/analytics/news-by-source?hours=72
app.get('/api/analytics/news-by-source', async (req, res) => {
  if (!supabaseEnabled()) return res.json([]);
  try {
    const data = await analyticsNewsBySource(parseHours(req.query.hours, 72));
    res.json(data);
  } catch (err) {
    console.error('[Analytics] news-by-source error:', err.message);
    res.status(500).json({ error: 'Failed to fetch news by source' });
  }
});

// J) Alerts by severity — /api/analytics/alerts-by-severity?hours=72
app.get('/api/analytics/alerts-by-severity', async (req, res) => {
  if (!supabaseEnabled()) return res.json([]);
  try {
    const data = await analyticsAlertsBySeverity(parseHours(req.query.hours, 72));
    res.json(data);
  } catch (err) {
    console.error('[Analytics] alerts-by-severity error:', err.message);
    res.status(500).json({ error: 'Failed to fetch alerts by severity' });
  }
});

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

// ─── reCAPTCHA v2 server-side verification ───────────────────────────────────
app.post('/api/auth/verify-recaptcha', async (req, res) => {
  const { token } = req.body || {};
  if (!token || typeof token !== 'string') {
    return res.status(400).json({ error: 'Missing reCAPTCHA token.' });
  }

  const secret = process.env.RECAPTCHA_SECRET_KEY;
  if (!secret) {
    // No secret configured — dev mode, allow through
    console.warn('[reCAPTCHA] RECAPTCHA_SECRET_KEY not set — skipping verification (dev mode).');
    return res.json({ valid: true });
  }

  try {
    const response = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `secret=${encodeURIComponent(secret)}&response=${encodeURIComponent(token)}`,
    });
    const data = await response.json();
    res.json({ valid: data.success === true });
  } catch (err) {
    console.error('[reCAPTCHA] verify error:', err.message);
    res.status(500).json({ error: 'reCAPTCHA verification service unavailable.' });
  }
});

// ─── Newsletter subscription ─────────────────────────────────────────────────
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
app.post('/api/newsletter/subscribe', async (req, res) => {
  const { email } = req.body || {};
  if (!email || typeof email !== 'string' || !EMAIL_PATTERN.test(email.trim())) {
    return res.status(400).json({ error: 'Invalid email address' });
  }
  if (!supabaseEnabled()) {
    // Gracefully accept even when DB is not wired — log for later import
    console.log('[Newsletter] subscription (no-db):', email.trim());
    return res.json({ ok: true });
  }
  try {
    await subscribeNewsletter(email.trim().toLowerCase());
    res.json({ ok: true });
  } catch (err) {
    // DB error (e.g. table not yet created) — log and accept gracefully
    console.error('[Newsletter] subscribe error:', err.message, '| email:', email.trim());
    res.json({ ok: true }); // don't surface DB errors to users
  }
});

// ─── Aircraft polling (every 15 seconds) ────────────────────────────────────
async function pollAircraft() {
  try {
    const raw = await fetchAircraft();
    // Enrich with carrier air wing detection
    let aircraft = enrichWithCarrierOps(raw, cache.ships);
    const carrierCount = aircraft.filter(a => a.carrierOps).length;
    if (carrierCount > 0) console.log(`[Carrier] ${carrierCount} aircraft tagged with carrier ops`);

    // Enrich with AI aircraft intel (throttled: max 5 new API calls per poll)
    if (process.env.GEMINI_API_KEY) {
      aircraft = await enrichBatchWithIntel(aircraft, 5).catch(err => {
        console.error('[AircraftIntel] Batch error:', err.message);
        return aircraft;
      });
    }

    cache.aircraft = aircraft;
    cache.lastAircraftUpdate = new Date().toISOString();

    // Refresh danger zones (static — no alert generation from positions)
    const zones = analyzeLocalDanger(aircraft, cache.ships, cache.news);
    cache.dangerZones = zones.dangerZones;

    // Record position snapshot for timeline replay
    recordSnapshot(aircraft, cache.ships);

    // Supabase: sample positions every 10 min + daily stats
    snapshotPositions(aircraft, cache.ships).catch(err => console.error('[Supabase] snapshot failed:', err.message));
    upsertDailyStats({
      aircraftCount:  aircraft.length,
      shipCount:      cache.ships.length,
      alertCount:     cache.alerts.length,
      conflictCount:  cache.conflicts.length,
      newsCount:      cache.news.length,
      criticalAlerts: cache.alerts.filter(a => a.severity === 'critical').length,
    }).catch(err => console.error('[Supabase] upsertDailyStats failed:', err.message));

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
      // Supabase: archive conflict events
      archiveConflicts(conflicts).catch(err => console.error('[Archive] conflicts failed:', err.message));
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

    // Geocode items that lack coordinates (NewsAPI/RSS often have null lat/lon)
    const merged = [...rssItems, ...gdeltItems, ...newsItems].map(geocodeNewsItem);
    const seenUrl   = new Set();
    const seenTitle = new Set();
    const freshNews = merged.filter(n => {
      // URL dedup
      if (n.url && seenUrl.has(n.url)) return false;
      if (n.url) seenUrl.add(n.url);
      // Title fingerprint dedup: SHA-256 of normalised (title+source) — B-M1
      const raw = ((n.title || '') + '|' + (n.source || '')).toLowerCase().replace(/[^a-z0-9|]/g, '');
      const titleFp = raw.length > 8 ? createHash('sha256').update(raw).digest('hex').slice(0, 16) : '';
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
      maybeTweetAlert(cache.alerts).catch(err => console.error('[Tweet] failed:', err.message));
      // Supabase: archive new alerts + news
      archiveAlerts(cache.alerts).catch(err => console.error('[Archive] alerts failed:', err.message));
      archiveNews(cache.news).catch(err => console.error('[Archive] news failed:', err.message));
    }

    // AI analysis — first run doesn't require 'changed'; subsequent runs need changed news + cooldown
    const cooldownOk = (Date.now() - lastGeminiCallAt) >= GEMINI_COOLDOWN_MS;
    const geminiReady = process.env.GEMINI_API_KEY
      && cache.news.length > 0
      && (changed || !geminiHasRun)
      && cooldownOk;

    if (geminiReady) {
      try {
        console.log('[AI] Requesting Gemini analysis…');
        const aiInsights = await analyzeWithGemini(cache.news.slice(0, 10), cache.aircraft, cache.ships);
        if (aiInsights) {
          cachedAiInsight = aiInsights;
          lastGeminiCallAt = Date.now();
          geminiHasRun = true;
          saveCache('ai_insight', aiInsights);
          io.emit('ai_insight', aiInsights);
          // Supabase: archive AI insight
          archiveAIInsight(aiInsights).catch(err => console.error('[Archive] ai_insight failed:', err.message));
          console.log('[AI] Analysis complete — threat:', aiInsights.threatLevel);
        }
      } catch (e) {
        console.error('[AI] Gemini error:', e.message);
        io.emit('ai_insight', { error: e.message, source: 'gemini_error', timestamp: new Date().toISOString() });
        // Don't block retries — allow next poll to try again
        if (!geminiHasRun) lastGeminiCallAt = 0;
      }
    } else if (process.env.GEMINI_API_KEY && !cooldownOk) {
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
  if (!process.env.REST_API_KEY && process.env.NODE_ENV === 'production') {
    console.warn('[Security] REST_API_KEY not set — REST endpoints are publicly accessible. Set this env var to restrict access.');
  }

  // Initial fetch
  pollAircraft();
  pollShips();
  pollNews();
  pollConflicts();

  // Probe Gemini on startup — logs which model is available (or why it failed)
  // Note: only calls listModels (no generateContent) — does NOT consume quota
  if (process.env.GEMINI_API_KEY) probeGeminiModel(process.env.GEMINI_API_KEY);
  // If no cached insight, allow Gemini on the very first news poll (no stagger).
  // If an insight already exists from disk cache, stagger by 5 min to avoid quota burn on rapid redeploys.
  lastGeminiCallAt = cachedAiInsight
    ? Date.now() - GEMINI_COOLDOWN_MS + 5 * 60_000  // allow after 5 min
    : 0;                                              // allow immediately

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

  // Supabase: purge old snapshots on startup and daily
  if (supabaseEnabled()) {
    purgeOldSnapshots();
    setInterval(purgeOldSnapshots, 24 * 60 * 60_000);
  }
});

// ─── Graceful shutdown (SIGTERM from Railway redeploy, SIGINT from Ctrl-C) ──
// Without this, Railway kills the process mid-write corrupting disk caches.
async function shutdown(signal) {
  console.log(`[Server] ${signal} received — shutting down gracefully`);
  // Stop accepting new HTTP/WebSocket connections
  io.close(() => console.log('[Server] Socket.io closed'));
  httpServer.close(() => {
    console.log('[Server] HTTP server closed — exiting');
    process.exit(0);
  });
  // Force exit after 5 seconds in case open connections stall the close
  setTimeout(() => {
    console.warn('[Server] Force-exiting after 5s timeout');
    process.exit(1);
  }, 5000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));
