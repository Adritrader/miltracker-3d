import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import { fetchAircraft } from './services/opensky.js';
import { fetchShips } from './services/vesselFinder.js';
import { fetchGDELTNews, fetchNewsAPI, fetchRSSFeeds } from './services/newsService.js';
import { analyzeWithGemini, analyzeLocalDanger, alertsFromNews } from './services/aiDanger.js';
import { loadCache, saveCache } from './services/diskCache.js';
import { fetchConflictEvents } from './services/conflictService.js';

dotenv.config();

const ALLOWED_ORIGINS = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: (origin, cb) => cb(null, !origin || ALLOWED_ORIGINS.test(origin)), methods: ['GET', 'POST'] }
});

app.use(cors({ origin: (origin, cb) => cb(null, !origin || ALLOWED_ORIGINS.test(origin)) }));
app.use(express.json());

// ─── In-memory cache (pre-loaded from disk so first connect serves real data)
let cache = {
  aircraft:           loadCache('aircraft',  []),
  ships:              loadCache('ships',     []),
  news:               loadCache('news',      []),
  conflicts:          loadCache('conflicts', []),
  alerts:             [],
  dangerZones:        [],
  lastAircraftUpdate: null,
  lastShipUpdate:     null,
  lastNewsUpdate:     null,
  lastConflictUpdate: null,
};

// ─── REST endpoints ──────────────────────────────────────────────────────────
app.get('/api/status', (req, res) => {
  res.json({
    status: 'online',
    clients: io.engine.clientsCount,
    aircraft: cache.aircraft.length,
    ships: cache.ships.length,
    news: cache.news.length,
    alerts: cache.alerts.length,
    lastAircraftUpdate: cache.lastAircraftUpdate,
    lastShipUpdate: cache.lastShipUpdate,
    lastNewsUpdate: cache.lastNewsUpdate,
    version: '1.0.0',
  });
});

app.get('/api/aircraft', (req, res) => res.json(cache.aircraft));
app.get('/api/ships',    (req, res) => res.json(cache.ships));
app.get('/api/news',     (req, res) => res.json(cache.news));
app.get('/api/alerts',   (req, res) => res.json(cache.alerts));
app.get('/api/conflicts',(req, res) => res.json(cache.conflicts));

// ─── Aircraft polling (every 15 seconds) ────────────────────────────────────
async function pollAircraft() {
  try {
    const aircraft = await fetchAircraft();
    cache.aircraft = aircraft;
    cache.lastAircraftUpdate = new Date().toISOString();

    // Refresh danger zones (static — no alert generation from positions)
    const zones = analyzeLocalDanger(aircraft, cache.ships, cache.news);
    cache.dangerZones = zones.dangerZones;

    io.emit('aircraft_update', { aircraft, timestamp: cache.lastAircraftUpdate });
    io.emit('danger_update', { dangerZones: cache.dangerZones, alerts: cache.alerts });
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
    io.emit('ship_update', { ships, timestamp: cache.lastShipUpdate });
    console.log(`[Ships] ${ships.length} vessels emitted`);
    if (ships.length > 0) saveCache('ships', ships);
  } catch (err) {
    console.error('[Ships] Poll error:', err.message);
  }
}

// ─── Conflict events polling (every 10 minutes) ─────────────────────────────
async function pollConflicts() {
  try {
    const conflicts = await fetchConflictEvents();
    cache.conflicts = conflicts;
    cache.lastConflictUpdate = new Date().toISOString();
    io.emit('conflict_update', { conflicts, timestamp: cache.lastConflictUpdate });
    console.log(`[Conflicts] ${conflicts.length} events emitted`);
    if (conflicts.length > 0) saveCache('conflicts', conflicts);
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

    // Merge and deduplicate by url — RSS first (has photos)
    const merged = [...rssItems, ...gdeltItems, ...newsItems];
    const seen = new Set();
    cache.news = merged.filter(n => {
      if (seen.has(n.url)) return false;
      seen.add(n.url);
      return true;
    }).slice(0, 100);

    cache.lastNewsUpdate = new Date().toISOString();

    // AI analysis on top headlines (if Gemini key present)
    if (process.env.GEMINI_API_KEY && cache.news.length > 0) {
      try {
        const aiInsights = await analyzeWithGemini(cache.news.slice(0, 10), cache.aircraft, cache.ships);
        if (aiInsights) {
          io.emit('ai_insight', aiInsights);
        }
      } catch (e) {
        console.error('[AI] Gemini error:', e.message);
      }
    }

    // Generate alerts from real breaking news (replaces rule-based heuristics)
    cache.alerts = alertsFromNews(cache.news);
    console.log(`[Alerts] ${cache.alerts.length} news-driven alerts generated (critical:${cache.alerts.filter(a=>a.severity==='critical').length})`);

    io.emit('news_update',   { news: cache.news,     timestamp: cache.lastNewsUpdate });
    io.emit('danger_update', { dangerZones: cache.dangerZones, alerts: cache.alerts });
    console.log(`[News] ${cache.news.length} items emitted`);
    if (cache.news.length > 0) saveCache('news', cache.news);
  } catch (err) {
    console.error('[News] Poll error:', err.message);
  }
}

// ─── Socket.io events ────────────────────────────────────────────────────────
io.on('connection', (socket) => {
  console.log(`[Socket] Client connected: ${socket.id}`);

  // Send cached data immediately on connect
  socket.emit('aircraft_update', { aircraft: cache.aircraft, timestamp: cache.lastAircraftUpdate });
  socket.emit('ship_update',     { ships: cache.ships,       timestamp: cache.lastShipUpdate });
  socket.emit('news_update',     { news: cache.news,         timestamp: cache.lastNewsUpdate });
  socket.emit('conflict_update', { conflicts: cache.conflicts, timestamp: cache.lastConflictUpdate });
  socket.emit('danger_update',   { dangerZones: cache.dangerZones, alerts: cache.alerts });

  socket.on('request_data', () => {
    socket.emit('aircraft_update', { aircraft: cache.aircraft, timestamp: cache.lastAircraftUpdate });
    socket.emit('ship_update',     { ships: cache.ships,       timestamp: cache.lastShipUpdate });
    socket.emit('news_update',     { news: cache.news,         timestamp: cache.lastNewsUpdate });
    socket.emit('conflict_update', { conflicts: cache.conflicts, timestamp: cache.lastConflictUpdate });
  });

  socket.on('disconnect', () => {
    console.log(`[Socket] Client disconnected: ${socket.id}`);
  });
});

// ─── Start polling ────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`\n🛰️  MilTracker 3D Backend running on port ${PORT}`);
  console.log(`   Aircraft polling: every 30 seconds (adsb.lol / adsb.fi / airplanes.live)`);
  console.log(`   Ships polling:    every 60 seconds`);
  console.log(`   News polling:     every 5 minutes\n`);

  // Initial fetch
  pollAircraft();
  pollShips();
  pollNews();
  pollConflicts();

  // Intervals
  setInterval(pollAircraft,   30_000);
  setInterval(pollShips,      60_000);
  setInterval(pollNews,    5 * 60_000);
  setInterval(pollConflicts, 10 * 60_000);
});
