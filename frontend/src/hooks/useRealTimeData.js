/**
 * useRealTimeData – connects to backend WebSocket and returns live data
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

// ── LocalStorage cache helpers ───────────────────────────────────────────────
const CACHE = {
  aircraft:    { key: 'milt_ac',  ttl: 5  * 60 * 1000 },
  ships:       { key: 'milt_sh',  ttl: 10 * 60 * 1000 },
  news:        { key: 'milt_nw',  ttl: 30 * 60 * 1000 },
  alerts:      { key: 'milt_al',  ttl: 60 * 60 * 1000 },
  dangerZones: { key: 'milt_dz',  ttl: 60 * 60 * 1000 },
  aiInsight:   { key: 'milt_ai',  ttl: 6  * 60 * 60 * 1000 }, // 6h — matches backend TTL
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
  const [conflicts, setConflicts] = useState([]);
  const [alerts, setAlerts] = useState(() => cacheLoad('alerts') || []);
  const [dangerZones, setDangerZones] = useState(() => cacheLoad('dangerZones') || []);
  const [aiInsight, setAiInsight] = useState(() => cacheLoad('aiInsight'));
  const [geminiEnabled, setGeminiEnabled] = useState(null); // null = unknown until server_info arrives
  const [lastUpdate, setLastUpdate] = useState({ aircraft: null, ships: null, news: null });
  const [isInitialLoad, setIsInitialLoad] = useState(() => !cacheLoad('aircraft') && !cacheLoad('ships'));

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
      setAircraft(list);
      setIsInitialLoad(false);
      const knownSources = ['adsb.lol', 'adsb.fi', 'airplanes.live'];
      if (list.length === 0) setAircraftSource('empty');
      else if (knownSources.includes(list[0]?.source)) setAircraftSource(list[0].source);
      else setAircraftSource('cached');
      setLastUpdate(prev => ({ ...prev, aircraft: timestamp }));
      cacheSave('aircraft', list);
    });

    socket.on('ship_update', ({ ships: sh, timestamp }) => {
      const list = sh || [];
      setShips(list);
      setIsInitialLoad(false);
      setLastUpdate(prev => ({ ...prev, ships: timestamp }));
      cacheSave('ships', list);
    });

    socket.on('news_update', ({ news: nw, timestamp }) => {
      const list = nw || [];
      setNews(list);
      setLastUpdate(prev => ({ ...prev, news: timestamp }));
      cacheSave('news', list);
    });

    socket.on('conflict_update', ({ conflicts: cf }) => {
      setConflicts(cf || []);
    });

    socket.on('danger_update', ({ dangerZones: dz, alerts: al }) => {
      const zones = dz || [];
      const alrts = al || [];
      setDangerZones(zones);
      setAlerts(alrts);
      cacheSave('dangerZones', zones);
      cacheSave('alerts', alrts);
    });

    socket.on('ai_insight', (insight) => {
      setAiInsight(insight);
      cacheSave('aiInsight', insight);
    });

    socket.on('server_info', ({ geminiEnabled: ge }) => {
      setGeminiEnabled(!!ge);
    });

    return () => socket.disconnect();
  }, []);

  return { connected, aircraft, aircraftSource, ships, news, conflicts, alerts, dangerZones, aiInsight, geminiEnabled, lastUpdate, isInitialLoad, reconnect };
}
