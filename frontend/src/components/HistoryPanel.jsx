/**
 * HistoryPanel — Query Supabase historical data (alerts, entity trails, daily stats)
 * Bottom-right button + slide-up panel with tabs: ALERTS | STATS | SEARCH
 */

import React, { useState, useCallback, useRef, useEffect, memo } from 'react';

const BACKEND = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

const SEVERITY_COLOR = {
  critical: 'text-red-400',
  high:     'text-orange-400',
  medium:   'text-amber-400',
  low:      'text-green-400',
};

const SEVERITY_DOT = {
  critical: 'bg-red-500',
  high:     'bg-orange-500',
  medium:   'bg-amber-500',
  low:      'bg-green-500',
};

function timeAgo(ts) {
  if (!ts) return '—';
  const s = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
  if (s < 60)    return `${s}s ago`;
  if (s < 3600)  return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

// ── Alerts tab ──────────────────────────────────────────────────────────────
const AlertsTab = ({ onFlyTo }) => {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hours, setHours] = useState(24);
  const [severity, setSeverity] = useState('all');

  const fetchAlerts = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ hours });
      if (severity !== 'all') params.set('severity', severity);
      const r = await fetch(`${BACKEND}/api/history/alerts?${params}`);
      const data = await r.json();
      setAlerts(Array.isArray(data) ? data : []);
    } catch { setAlerts([]); }
    setLoading(false);
  }, [hours, severity]);

  useEffect(() => { fetchAlerts(); }, [fetchAlerts]);

  return (
    <div className="space-y-2">
      {/* Filters */}
      <div className="flex gap-2 items-center">
        <select value={hours} onChange={e => setHours(+e.target.value)}
          className="bg-black/40 border border-hud-border rounded text-[10px] font-mono text-hud-text px-1.5 py-0.5">
          <option value={6}>6h</option>
          <option value={24}>24h</option>
          <option value={48}>48h</option>
          <option value={168}>7d</option>
          <option value={336}>14d</option>
        </select>
        <select value={severity} onChange={e => setSeverity(e.target.value)}
          className="bg-black/40 border border-hud-border rounded text-[10px] font-mono text-hud-text px-1.5 py-0.5">
          <option value="all">ALL</option>
          <option value="critical">CRITICAL</option>
          <option value="high">HIGH</option>
          <option value="medium">MEDIUM</option>
        </select>
        <span className="text-hud-text text-[10px] font-mono ml-auto">{alerts.length} results</span>
      </div>

      {loading && <div className="text-hud-green text-xs font-mono animate-pulse">Loading…</div>}

      {/* Alert list */}
      <div className="space-y-1 max-h-[45vh] overflow-y-auto pr-1">
        {alerts.map((a, i) => (
          <div
            key={a.alert_id || i}
            className="p-1.5 rounded border border-hud-border/40 hover:border-hud-green/40 transition-colors cursor-pointer"
            onClick={() => a.lat && a.lon && onFlyTo?.({ lat: a.lat, lon: a.lon })}
          >
            <div className="flex items-start gap-1.5">
              <span className={`w-1.5 h-1.5 rounded-full mt-1 shrink-0 ${SEVERITY_DOT[a.severity] || 'bg-gray-500'}`} />
              <div className="flex-1 min-w-0">
                <div className="text-white text-[11px] font-mono leading-snug truncate">{a.title}</div>
                <div className="flex gap-2 mt-0.5">
                  <span className={`text-[9px] font-mono font-bold ${SEVERITY_COLOR[a.severity] || ''}`}>
                    {(a.severity || '').toUpperCase()}
                  </span>
                  {a.credibility != null && (
                    <span className="text-[9px] font-mono text-hud-text">{Math.round(a.credibility)}% cred</span>
                  )}
                  <span className="text-[9px] font-mono text-hud-text/60">{timeAgo(a.timestamp)}</span>
                  {a.region && <span className="text-[9px] font-mono text-hud-cyan truncate">{a.region}</span>}
                </div>
              </div>
            </div>
          </div>
        ))}
        {!loading && alerts.length === 0 && (
          <div className="text-hud-text text-xs font-mono text-center py-4 opacity-60">No alerts in this time range</div>
        )}
      </div>
    </div>
  );
};

// ── Stats tab ───────────────────────────────────────────────────────────────
const StatsTab = () => {
  const [stats, setStats] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch(`${BACKEND}/api/history/stats?days=14`)
      .then(r => r.json())
      .then(data => setStats(Array.isArray(data) ? data : []))
      .catch(() => setStats([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-hud-green text-xs font-mono animate-pulse">Loading…</div>;
  if (stats.length === 0) return <div className="text-hud-text text-xs font-mono text-center py-4 opacity-60">No historical data yet</div>;

  const maxAc = Math.max(...stats.map(s => s.aircraft_count || 0), 1);
  const maxAl = Math.max(...stats.map(s => s.alert_count || 0), 1);

  return (
    <div className="space-y-3">
      <div className="text-hud-text text-[10px] font-mono opacity-60">Last {stats.length} days — daily aggregates</div>

      {/* Mini bar chart */}
      <div>
        <div className="text-[9px] font-mono text-hud-text opacity-60 mb-1">AIRCRAFT TRACKED</div>
        <div className="flex items-end gap-px h-12">
          {stats.map((s, i) => (
            <div key={i} className="flex-1 flex flex-col items-center justify-end" title={`${s.date}: ${s.aircraft_count} aircraft`}>
              <div
                className="w-full bg-hud-cyan/60 rounded-t-sm min-h-[1px]"
                style={{ height: `${((s.aircraft_count || 0) / maxAc) * 100}%` }}
              />
            </div>
          ))}
        </div>
        <div className="flex justify-between text-[8px] font-mono text-hud-text/40 mt-0.5">
          <span>{stats[0]?.date?.slice(5)}</span>
          <span>{stats[stats.length - 1]?.date?.slice(5)}</span>
        </div>
      </div>

      <div>
        <div className="text-[9px] font-mono text-hud-text opacity-60 mb-1">ALERTS GENERATED</div>
        <div className="flex items-end gap-px h-12">
          {stats.map((s, i) => (
            <div key={i} className="flex-1 flex flex-col items-center justify-end" title={`${s.date}: ${s.alert_count} alerts (${s.critical_alerts} critical)`}>
              <div
                className="w-full bg-red-500/60 rounded-t-sm min-h-[1px]"
                style={{ height: `${((s.alert_count || 0) / maxAl) * 100}%` }}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Summary table */}
      <div className="text-[10px] font-mono space-y-0.5">
        {stats.slice(-5).reverse().map(s => (
          <div key={s.date} className="flex justify-between border-b border-hud-border/20 py-0.5">
            <span className="text-hud-text/70">{s.date}</span>
            <span className="text-hud-cyan">▲{s.aircraft_count}</span>
            <span className="text-hud-blue">▬{s.ship_count}</span>
            <span className="text-orange-400">◆{s.conflict_count}</span>
            <span className="text-red-400">⚠{s.alert_count}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

// ── Search entity trail tab ─────────────────────────────────────────────────
const TrailTab = ({ onShowTrail, viewer, pendingTrailId, onPendingConsumed }) => {
  const [entityId, setEntityId] = useState('');
  const [hours, setHours] = useState(24);
  const [trail, setTrail] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const search = useCallback(async (overrideId) => {
    const id = overrideId || entityId.trim();
    if (!id) return;
    if (!overrideId) setEntityId(id);
    setLoading(true);
    setError('');
    try {
      const r = await fetch(`${BACKEND}/api/history/trail/${encodeURIComponent(id)}?hours=${hours}`);
      const data = await r.json();
      if (Array.isArray(data) && data.length > 0) {
        setTrail(data);
        onShowTrail?.(id, data);
      } else {
        setTrail([]);
        setError('No trail data found for this entity');
      }
    } catch {
      setError('Failed to fetch trail');
    }
    setLoading(false);
  }, [entityId, hours, onShowTrail]);

  // Auto-search when pendingTrailId arrives from EntityPopup
  useEffect(() => {
    if (pendingTrailId) {
      setEntityId(pendingTrailId);
      search(pendingTrailId);
      onPendingConsumed?.();
    }
  }, [pendingTrailId]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-2">
      <div className="text-hud-text text-[10px] font-mono opacity-60">
        Search by ICAO hex, callsign, or MMSI
      </div>
      <div className="flex gap-1.5">
        <input
          type="text"
          value={entityId}
          onChange={e => setEntityId(e.target.value.toUpperCase())}
          onKeyDown={e => e.key === 'Enter' && search()}
          placeholder="e.g. AE0413 or MMSI"
          className="flex-1 bg-black/40 border border-hud-border rounded px-2 py-1 text-xs font-mono text-white placeholder:text-hud-text/30 focus:border-hud-green outline-none"
        />
        <select value={hours} onChange={e => setHours(+e.target.value)}
          className="bg-black/40 border border-hud-border rounded text-[10px] font-mono text-hud-text px-1.5 py-0.5">
          <option value={6}>6h</option>
          <option value={24}>24h</option>
          <option value={48}>48h</option>
          <option value={168}>7d</option>
        </select>
        <button onClick={search} className="hud-btn text-[10px] px-2">
          <span className="pointer-events-none">SEARCH</span>
        </button>
      </div>

      {loading && <div className="text-hud-green text-xs font-mono animate-pulse">Searching…</div>}
      {error && <div className="text-amber-400 text-[10px] font-mono">{error}</div>}

      {trail && trail.length > 0 && (
        <div className="space-y-1">
          <div className="text-hud-green text-[10px] font-mono">
            ✓ {trail.length} position records found — trail drawn on map
          </div>
          <div className="max-h-[30vh] overflow-y-auto pr-1 space-y-0.5">
            {trail.map((p, i) => (
              <div key={i} className="flex justify-between text-[9px] font-mono border-b border-hud-border/20 py-0.5">
                <span className="text-hud-text/60">{new Date(p.sampled_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' })}Z</span>
                <span className="text-hud-green">{p.lat?.toFixed(3)}° {p.lon?.toFixed(3)}°</span>
                {p.altitude != null && <span className="text-hud-cyan">{Math.round(p.altitude)}m</span>}
                {p.speed != null && <span className="text-hud-amber">{Math.round(p.speed)}kn</span>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ── Main panel ──────────────────────────────────────────────────────────────
const HistoryPanel = ({ viewer, onFlyTo, isMobile = false, externalTrailId = null }) => {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState('alerts');
  const [pendingTrailId, setPendingTrailId] = useState(null);

  // When externalTrailId changes (from EntityPopup TRAIL button), auto-open trail tab
  useEffect(() => {
    if (externalTrailId?.id) {
      setOpen(true);
      setTab('trail');
      setPendingTrailId(externalTrailId.id);
    }
  }, [externalTrailId]);

  const handleShowTrail = useCallback((entityId, trail) => {
    if (!viewer || viewer.isDestroyed()) return;
    const Cesium = window.Cesium;
    if (!Cesium) return;

    // Remove previous history trail
    const existing = viewer.entities.getById('__history_trail__');
    if (existing) viewer.entities.remove(existing);

    if (!trail || trail.length < 2) return;

    const positions = trail
      .filter(p => p.lat != null && p.lon != null)
      .map(p => Cesium.Cartesian3.fromDegrees(p.lon, p.lat, (p.altitude || 0)));

    if (positions.length < 2) return;

    viewer.entities.add({
      id: '__history_trail__',
      polyline: {
        positions,
        width: 3,
        material: new Cesium.PolylineGlowMaterialProperty({
          glowPower: 0.15,
          color: Cesium.Color.MAGENTA.withAlpha(0.8),
        }),
        clampToGround: false,
      },
    });

    // Fly to trail midpoint
    const mid = trail[Math.floor(trail.length / 2)];
    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(mid.lon, mid.lat, 2_000_000),
      duration: 1.5,
    });
  }, [viewer]);

  const handleFlyTo = useCallback((alert) => {
    if (!viewer || viewer.isDestroyed() || !alert?.lat || !alert?.lon) return;
    const Cesium = window.Cesium;
    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(alert.lon, alert.lat, 2_000_000),
      duration: 1.5,
    });
  }, [viewer]);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="hud-btn text-xs px-3 py-2 font-bold bg-[rgba(5,8,16,0.82)] backdrop-blur-sm hover:bg-[rgba(5,8,16,0.95)] select-none"
        title="View historical data from Supabase"
      >
        <span className="pointer-events-none">📊 HISTORY</span>
      </button>
    );
  }

  const Tab = ({ id, label, icon }) => (
    <button
      onClick={() => setTab(id)}
      className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold transition-colors select-none
        ${tab === id ? 'bg-hud-green/20 text-hud-green border border-hud-green/40' : 'text-hud-text hover:text-white border border-transparent'}`}
    >
      <span className="pointer-events-none">{icon} {label}</span>
    </button>
  );

  return (
    <div
      className="bg-[rgba(5,8,16,0.92)] border border-hud-border rounded shadow-lg pointer-events-auto backdrop-blur-md"
      style={{ width: isMobile ? 'calc(100vw - 32px)' : 340, maxHeight: isMobile ? '65vh' : '55vh', overflowY: 'auto' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-hud-border/50 sticky top-0 bg-[rgba(5,8,16,0.95)] z-10">
        <span className="hud-title text-xs">📊 HISTORICAL DATA</span>
        <button onClick={() => setOpen(false)} className="text-hud-text hover:text-white text-sm leading-none">✕</button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 px-3 py-2 border-b border-hud-border/30">
        <Tab id="alerts" label="ALERTS" icon="⚠" />
        <Tab id="stats" label="STATS" icon="📈" />
        <Tab id="trail" label="TRAIL" icon="📍" />
      </div>

      {/* Content */}
      <div className="px-3 py-2">
        {tab === 'alerts' && <AlertsTab onFlyTo={handleFlyTo} />}
        {tab === 'stats' && <StatsTab />}
        {tab === 'trail' && <TrailTab onShowTrail={handleShowTrail} viewer={viewer} pendingTrailId={pendingTrailId} onPendingConsumed={() => setPendingTrailId(null)} />}
      </div>
    </div>
  );
};

export default memo(HistoryPanel);
