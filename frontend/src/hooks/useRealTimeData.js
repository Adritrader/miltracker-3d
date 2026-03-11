/**
 * useRealTimeData – connects to backend WebSocket and returns live data
 */

import { useEffect, useRef, useState, useMemo } from 'react';
import { io } from 'socket.io-client';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

// ── LocalStorage cache helpers ───────────────────────────────────────────────
const CACHE = {
  aircraft:    { key: 'milt_ac',  ttl: 30 * 60 * 1000  },  // 30 min
  ships:       { key: 'milt_sh',  ttl: 60 * 60 * 1000  },  // 60 min (matches backend diskCache TTL — I1)
  news:        { key: 'milt_nw',  ttl: 2  * 60 * 60 * 1000 }, // 2 h
  conflicts:   { key: 'milt_cf',  ttl: 2  * 60 * 60 * 1000 }, // 2 h
  alerts:      { key: 'milt_al',  ttl: 4  * 60 * 60 * 1000 }, // 4 h
  dangerZones: { key: 'milt_dz',  ttl: 24 * 60 * 60 * 1000 }, // 24 h (static zones)
  aiInsight:   { key: 'milt_ai',  ttl: 6  * 60 * 60 * 1000 }, // 6 h
};
function cacheLoad(type) {
  try {
    const raw = localStorage.getItem(CACHE[type].key);
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw);
    if (Date.now() - ts > CACHE[type].ttl) return null;
    return data;
  } catch { return null; }
}
function cacheSave(type, data) {
  try {
    localStorage.setItem(CACHE[type].key, JSON.stringify({ data, ts: Date.now() }));
  } catch {}
}

export function useRealTimeData() {
  const socketRef = useRef(null);
  const [connected, setConnected] = useState(false);
  const [aircraft, setAircraft] = useState(() => cacheLoad('aircraft') || []);
  // O9: use already-loaded aircraft state for aircraftSource init (avoids 2nd cacheLoad call)
  const [aircraftSource, setAircraftSource] = useState(() => (cacheLoad('aircraft') || []).length ? 'cached' : 'loading');
  const [ships, setShips] = useState(() => cacheLoad('ships') || []);
  const [news, setNews] = useState(() => cacheLoad('news') || []);
  const [conflicts, setConflicts] = useState(() => cacheLoad('conflicts') || []);
  const [alerts, setAlerts] = useState(() => cacheLoad('alerts') || []);
  const [hotspots, setHotspots] = useState(() => cacheLoad('hotspots') || []);
  const [dangerZones, setDangerZones] = useState(() => cacheLoad('dangerZones') || []);
  const [aiInsight, setAiInsight] = useState(() => cacheLoad('aiInsight'));
  const [aiError, setAiError] = useState(null);
  const [geminiEnabled, setGeminiEnabled] = useState(null); // null = unknown until server_info arrives
  // O5: split into 3 atomic states so each update only re-renders subscribers of that field
  const [lastAircraftUpdate, setLastAircraftUpdate] = useState(null);
  const [lastShipUpdate,     setLastShipUpdate]     = useState(null);
  const [lastNewsUpdate,     setLastNewsUpdate]     = useState(null);
  // lastUpdate: reconstructed object for backward-compatible prop passing (FilterPanel uses lastUpdate.aircraft)
  const lastUpdate = useMemo(
    () => ({ aircraft: lastAircraftUpdate, ships: lastShipUpdate, news: lastNewsUpdate }),
    [lastAircraftUpdate, lastShipUpdate, lastNewsUpdate]
  );
  // hasCachedData: snapshot-at-mount, never updated — O9: computed from already-loaded state,
  // avoids 4 extra cacheLoad() / localStorage reads at mount
  const hasCachedData = useRef(!!(aircraft.length || ships.length || news.length || conflicts.length)).current;
  const [isInitialLoad, setIsInitialLoad] = useState(() => !hasCachedData);
  // A6: ref tracks the latest timestamps received from the server so reconnect
  // 'request_data' can pass them as `since` — avoids re-sending unchanged data.
  // Using a ref (not state) so the value is always current inside closures.
  const lastUpdateRef = useRef({ aircraft: null, ships: null, news: null, conflicts: null });

  useEffect(() => {
    const socket = io(BACKEND_URL, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 10000,
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      // A6: pass last-known timestamps so server skips unchanged data on reconnect
      socket.emit('request_data', { since: lastUpdateRef.current });
    });
    socket.on('disconnect', () => setConnected(false));
    socket.on('connect_error', (e) => console.warn('[Socket] connect error:', e.message));

    socket.on('aircraft_update', ({ aircraft: ac, timestamp }) => {
      const list = ac || [];
      // Never replace good cached data with an empty server response (Railway cold start)
      if (list.length > 0) {
        setAircraft(list);
        cacheSave('aircraft', list);
        const knownSources = ['adsb.lol', 'adsb.fi', 'airplanes.live'];
        if (knownSources.includes(list[0]?.source)) setAircraftSource(list[0].source);
        else setAircraftSource('live');
      } else {
        setAircraftSource('empty');
      }
      setIsInitialLoad(false);
      setLastAircraftUpdate(timestamp);
      lastUpdateRef.current = { ...lastUpdateRef.current, aircraft: timestamp };
    });

    socket.on('ship_update', ({ ships: sh, timestamp }) => {
      const list = sh || [];
      if (list.length > 0) {
        setShips(list);
        cacheSave('ships', list);
      }
      setIsInitialLoad(false);
      setLastShipUpdate(timestamp);
      lastUpdateRef.current = { ...lastUpdateRef.current, ships: timestamp };
    });

    socket.on('news_update', ({ news: nw, timestamp }) => {
      const list = nw || [];
      if (list.length > 0) {
        setNews(list);
        cacheSave('news', list);
      }
      setLastNewsUpdate(timestamp);
      lastUpdateRef.current = { ...lastUpdateRef.current, news: timestamp };
    });

    socket.on('conflict_update', ({ conflicts: cf, timestamp }) => {
      const list = cf || [];
      if (list.length > 0) {
        setConflicts(list);
        cacheSave('conflicts', list);
      }
      lastUpdateRef.current = { ...lastUpdateRef.current, conflicts: timestamp };
    });

    socket.on('danger_update', ({ dangerZones: dz, alerts: al, hotspots: hs }) => {
      const zones = dz || [];
      const alrts = al || [];
      const spots = hs || [];
      // Always update alerts (they signal new threats even if empty means all-clear)
      setDangerZones(zones);
      setAlerts(alrts);
      setHotspots(spots);
      if (zones.length > 0) cacheSave('dangerZones', zones);
      cacheSave('alerts', alrts); // always save, even empty array = all-clear
      cacheSave('hotspots', spots);
      // B11: track last received danger timestamp so reconnect logic knows data is fresh
      lastUpdateRef.current = { ...lastUpdateRef.current, dangerZones: new Date().toISOString() };
    });

    socket.on('ai_insight', (insight) => {
      if (insight?.error) {
        setAiError(insight.error); // surface error in UI, don't overwrite a valid cached insight
      } else {
        setAiInsight(insight);
        setAiError(null);
        cacheSave('aiInsight', insight);
      }
    });

    socket.on('server_info', ({ geminiEnabled: ge }) => {
      setGeminiEnabled(!!ge);
    });

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
    };
  }, []);

  return { connected, aircraft, aircraftSource, ships, news, conflicts, alerts, hotspots, dangerZones, aiInsight, aiError, geminiEnabled, lastUpdate, isInitialLoad, hasCachedData, socketRef };
}
