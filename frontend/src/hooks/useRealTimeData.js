/**
 * useRealTimeData – connects to backend WebSocket and returns live data
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

// ── LocalStorage cache helpers ───────────────────────────────────────────────
const CACHE = {
  aircraft:    { key: 'milt_ac',  ttl: 30 * 60 * 1000  },  // 30 min
  ships:       { key: 'milt_sh',  ttl: 30 * 60 * 1000  },  // 30 min
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
  const [aircraftSource, setAircraftSource] = useState(() => cacheLoad('aircraft') ? 'cached' : 'loading');
  const [ships, setShips] = useState(() => cacheLoad('ships') || []);
  const [news, setNews] = useState(() => cacheLoad('news') || []);
  const [conflicts, setConflicts] = useState(() => cacheLoad('conflicts') || []);
  const [alerts, setAlerts] = useState(() => cacheLoad('alerts') || []);
  const [dangerZones, setDangerZones] = useState(() => cacheLoad('dangerZones') || []);
  const [aiInsight, setAiInsight] = useState(() => cacheLoad('aiInsight'));
  const [aiError, setAiError] = useState(null);
  const [geminiEnabled, setGeminiEnabled] = useState(null); // null = unknown until server_info arrives
  const [lastUpdate, setLastUpdate] = useState({ aircraft: null, ships: null, news: null });
  // hasCachedData: computed once at mount — true if any data was available before socket connects
  const hasCachedData = useRef(
    !!(cacheLoad('aircraft') || cacheLoad('ships') || cacheLoad('news') || cacheLoad('conflicts'))
  ).current;
  const [isInitialLoad, setIsInitialLoad] = useState(() => !hasCachedData);

  const reconnect = useCallback(() => {
    socketRef.current?.connect();
  }, []);

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
      socket.emit('request_data');
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
      setLastUpdate(prev => ({ ...prev, aircraft: timestamp }));
    });

    socket.on('ship_update', ({ ships: sh, timestamp }) => {
      const list = sh || [];
      if (list.length > 0) {
        setShips(list);
        cacheSave('ships', list);
      }
      setIsInitialLoad(false);
      setLastUpdate(prev => ({ ...prev, ships: timestamp }));
    });

    socket.on('news_update', ({ news: nw, timestamp }) => {
      const list = nw || [];
      if (list.length > 0) {
        setNews(list);
        cacheSave('news', list);
      }
      setLastUpdate(prev => ({ ...prev, news: timestamp }));
    });

    socket.on('conflict_update', ({ conflicts: cf }) => {
      const list = cf || [];
      if (list.length > 0) {
        setConflicts(list);
        cacheSave('conflicts', list);
      }
    });

    socket.on('danger_update', ({ dangerZones: dz, alerts: al }) => {
      const zones = dz || [];
      const alrts = al || [];
      // Always update alerts (they signal new threats even if empty means all-clear)
      setDangerZones(zones);
      setAlerts(alrts);
      if (zones.length > 0) cacheSave('dangerZones', zones);
      if (alrts.length > 0) cacheSave('alerts', alrts);
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

    return () => socket.disconnect();
  }, []);

  return { connected, aircraft, aircraftSource, ships, news, conflicts, alerts, dangerZones, aiInsight, aiError, geminiEnabled, lastUpdate, isInitialLoad, hasCachedData, reconnect, socketRef };
}
