/**
 * useRealTimeData – connects to backend WebSocket and returns live data
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

export function useRealTimeData() {
  const socketRef = useRef(null);
  const [connected, setConnected] = useState(false);
  const [aircraft, setAircraft] = useState([]);
  const [aircraftSource, setAircraftSource] = useState('loading');
  const [ships, setShips] = useState([]);
  const [news, setNews] = useState([]);
  const [conflicts, setConflicts] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [dangerZones, setDangerZones] = useState([]);
  const [aiInsight, setAiInsight] = useState(null);
  const [lastUpdate, setLastUpdate] = useState({ aircraft: null, ships: null, news: null });

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
      const knownSources = ['adsb.lol', 'adsb.fi', 'airplanes.live'];
      if (list.length === 0) setAircraftSource('empty');
      else if (knownSources.includes(list[0]?.source)) setAircraftSource(list[0].source);
      else setAircraftSource('cached');
      setLastUpdate(prev => ({ ...prev, aircraft: timestamp }));
    });

    socket.on('ship_update', ({ ships: sh, timestamp }) => {
      setShips(sh || []);
      setLastUpdate(prev => ({ ...prev, ships: timestamp }));
    });

    socket.on('news_update', ({ news: nw, timestamp }) => {
      setNews(nw || []);
      setLastUpdate(prev => ({ ...prev, news: timestamp }));
    });

    socket.on('conflict_update', ({ conflicts: cf }) => {
      setConflicts(cf || []);
    });

    socket.on('danger_update', ({ dangerZones: dz, alerts: al }) => {
      setDangerZones(dz || []);
      setAlerts(al || []);
    });

    socket.on('ai_insight', (insight) => {
      setAiInsight(insight);
    });

    return () => socket.disconnect();
  }, []);

  return { connected, aircraft, aircraftSource, ships, news, conflicts, alerts, dangerZones, aiInsight, lastUpdate, reconnect };
}
