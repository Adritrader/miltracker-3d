/**
 * HistoryPanel — Query Supabase historical data (alerts, entity trails, daily stats)
 * Bottom-right button + slide-up panel with tabs: ALERTS | STATS | TRAIL
 */

import React, { useState, useCallback, useEffect, memo } from 'react';

const BACKEND = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

const SEV_COLOR = { critical: 'text-red-400', high: 'text-orange-400', medium: 'text-amber-400', low: 'text-green-400' };
const SEV_DOT   = { critical: 'bg-red-500',   high: 'bg-orange-500',  medium: 'bg-amber-500',  low: 'bg-green-500' };

function timeAgo(ts) {
  if (!ts) return '—';
  const s = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
  if (s < 60)    return `${s}s ago`;
  if (s < 3600)  return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

/** Shared styled select — taller touch targets, consistent look */
const HudSelect = ({ value, onChange, children, className = '' }) => (
  <select
    value={value}
    onChange={onChange}
    className={`appearance-none bg-[rgba(0,0,0,0.5)] border border-hud-border/60 rounded-md
      text-[11px] sm:text-xs font-mono text-hud-text px-2 py-1.5 min-h-[32px]
      focus:border-hud-green focus:outline-none hover:border-hud-green/50
      cursor-pointer transition-colors ${className}`}
    style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='%2388A0A8' viewBox='0 0 20 20'%3E%3Cpath d='M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 4px center', backgroundSize: '14px', paddingRight: '22px' }}
  >
    {children}
  </select>
);

/** Error banner */
const ErrorBanner = ({ message }) => message ? (
  <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-md bg-red-950/50 border border-red-500/30 text-red-300 text-[10px] sm:text-[11px] font-mono">
    <span>⚠</span> {message}
  </div>
) : null;

/** Empty state placeholder */
const EmptyState = ({ icon, message }) => (
  <div className="flex flex-col items-center justify-center py-8 text-center">
    <span className="text-2xl mb-2 opacity-40">{icon}</span>
    <span className="text-hud-text text-[11px] font-mono opacity-50">{message}</span>
  </div>
);

// ── Alerts tab ──────────────────────────────────────────────────────────────
const AlertsTab = ({ onFlyTo }) => {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [hours, setHours] = useState(24);
  const [severity, setSeverity] = useState('all');

  const fetchAlerts = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ hours });
      if (severity !== 'all') params.set('severity', severity);
      const r = await fetch(`${BACKEND}/api/history/alerts?${params}`);
      if (!r.ok) throw new Error(`Server error (${r.status})`);
      const data = await r.json();
      if (data?.error) throw new Error(data.error);
      setAlerts(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || 'Failed to load alerts');
      setAlerts([]);
    }
    setLoading(false);
  }, [hours, severity]);

  useEffect(() => { fetchAlerts(); }, [fetchAlerts]);

  return (
    <div className="space-y-2.5">
      {/* Filters row */}
      <div className="flex gap-2 items-center flex-wrap">
        <HudSelect value={hours} onChange={e => setHours(+e.target.value)}>
          <option value={6}>Last 6h</option>
          <option value={24}>Last 24h</option>
          <option value={48}>Last 48h</option>
          <option value={168}>Last 7d</option>
          <option value={336}>Last 14d</option>
        </HudSelect>
        <HudSelect value={severity} onChange={e => setSeverity(e.target.value)}>
          <option value="all">All severity</option>
          <option value="critical">🔴 Critical</option>
          <option value="high">🟠 High</option>
          <option value="medium">🟡 Medium</option>
        </HudSelect>
        <span className="text-hud-text/50 text-[10px] font-mono ml-auto">{alerts.length} results</span>
      </div>

      <ErrorBanner message={error} />

      {loading && <div className="text-hud-green text-xs font-mono animate-pulse text-center py-2">Loading alerts…</div>}

      {/* Alert list */}
      <div className="space-y-1 max-h-[42vh] overflow-y-auto pr-0.5 scrollbar-thin">
        {alerts.map((a, i) => (
          <div
            key={a.alert_id || i}
            className="group p-2 rounded-md border border-hud-border/30 hover:border-hud-green/50 bg-black/20 hover:bg-black/40 transition-all cursor-pointer"
            onClick={() => a.lat && a.lon && onFlyTo?.({ lat: a.lat, lon: a.lon })}
          >
            <div className="flex items-start gap-2">
              <span className={`w-2 h-2 rounded-full mt-1 shrink-0 ${SEV_DOT[a.severity] || 'bg-gray-500'}`} />
              <div className="flex-1 min-w-0">
                <div className="text-white text-[11px] sm:text-xs font-mono leading-snug truncate group-hover:text-hud-green transition-colors">
                  {a.title}
                </div>
                <div className="flex gap-2 mt-1 items-center flex-wrap">
                  <span className={`text-[9px] sm:text-[10px] font-mono font-bold ${SEV_COLOR[a.severity] || ''}`}>
                    {(a.severity || '').toUpperCase()}
                  </span>
                  {a.credibility != null && (
                    <span className="text-[9px] sm:text-[10px] font-mono text-hud-text/60">{Math.round(a.credibility)}%</span>
                  )}
                  <span className="text-[9px] sm:text-[10px] font-mono text-hud-text/40">{timeAgo(a.timestamp)}</span>
                  {a.region && <span className="text-[9px] sm:text-[10px] font-mono text-hud-cyan/70 truncate max-w-[100px]">{a.region}</span>}
                </div>
              </div>
            </div>
          </div>
        ))}
        {!loading && !error && alerts.length === 0 && (
          <EmptyState icon="🔍" message="No alerts found for this time range" />
        )}
      </div>
    </div>
  );
};

// ── Stats tab ───────────────────────────────────────────────────────────────
const StatsTab = () => {
  const [stats, setStats] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    setError('');
    fetch(`${BACKEND}/api/history/stats?days=14`)
      .then(r => { if (!r.ok) throw new Error(`Server error (${r.status})`); return r.json(); })
      .then(data => { if (data?.error) throw new Error(data.error); setStats(Array.isArray(data) ? data : []); })
      .catch(err => { setError(err.message || 'Failed to load stats'); setStats([]); })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-hud-green text-xs font-mono animate-pulse text-center py-4">Loading stats…</div>;
  if (error) return <ErrorBanner message={error} />;
  if (stats.length === 0) return <EmptyState icon="📊" message="No historical statistics yet — data accumulates daily" />;

  const maxAc = Math.max(...stats.map(s => s.aircraft_count || 0), 1);
  const maxAl = Math.max(...stats.map(s => s.alert_count || 0), 1);

  const BarChart = ({ data, maxVal, color, label, valueKey }) => (
    <div className="rounded-md border border-hud-border/20 bg-black/20 p-2">
      <div className="text-[10px] sm:text-[11px] font-mono text-hud-text/70 font-bold mb-1.5">{label}</div>
      <div className="flex items-end gap-[2px] h-14">
        {data.map((s, i) => (
          <div
            key={i}
            className="flex-1 flex flex-col items-center justify-end group/bar"
            title={`${s.date}: ${s[valueKey] || 0}`}
          >
            <div
              className={`w-full ${color} rounded-t-sm min-h-[2px] group-hover/bar:opacity-100 opacity-80 transition-opacity`}
              style={{ height: `${((s[valueKey] || 0) / maxVal) * 100}%` }}
            />
          </div>
        ))}
      </div>
      <div className="flex justify-between text-[8px] sm:text-[9px] font-mono text-hud-text/30 mt-1">
        <span>{data[0]?.date?.slice(5)}</span>
        <span>{data[data.length - 1]?.date?.slice(5)}</span>
      </div>
    </div>
  );

  return (
    <div className="space-y-3">
      <div className="text-hud-text/50 text-[10px] sm:text-[11px] font-mono">
        Last {stats.length} days — updated every 10 min
      </div>
      <BarChart data={stats} maxVal={maxAc} color="bg-hud-cyan/60" label="✈ AIRCRAFT TRACKED" valueKey="aircraft_count" />
      <BarChart data={stats} maxVal={maxAl} color="bg-red-500/60"  label="⚠ ALERTS GENERATED" valueKey="alert_count" />

      {/* Summary table */}
      <div className="rounded-md border border-hud-border/20 bg-black/20 p-2">
        <div className="text-[10px] sm:text-[11px] font-mono text-hud-text/70 font-bold mb-1.5">RECENT DAYS</div>
        <div className="space-y-0">
          <div className="flex gap-1 text-[8px] sm:text-[9px] font-mono text-hud-text/40 border-b border-hud-border/20 pb-1 mb-0.5">
            <span className="flex-[2]">DATE</span>
            <span className="flex-1 text-center">✈</span>
            <span className="flex-1 text-center">⛴</span>
            <span className="flex-1 text-center">◆</span>
            <span className="flex-1 text-center">⚠</span>
            <span className="flex-1 text-center">🔴</span>
          </div>
          {stats.slice(-7).reverse().map(s => (
            <div key={s.date} className="flex gap-1 text-[10px] sm:text-[11px] font-mono py-0.5 border-b border-hud-border/10 hover:bg-hud-green/5">
              <span className="text-hud-text/60 flex-[2]">{s.date?.slice(5)}</span>
              <span className="text-hud-cyan flex-1 text-center">{s.aircraft_count}</span>
              <span className="text-hud-blue flex-1 text-center">{s.ship_count}</span>
              <span className="text-orange-400 flex-1 text-center">{s.conflict_count}</span>
              <span className="text-red-400 flex-1 text-center">{s.alert_count}</span>
              <span className="text-red-300 flex-1 text-center">{s.critical_alerts}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ── Trail search tab ────────────────────────────────────────────────────────
const TrailTab = ({ onShowTrail, viewer, pendingTrailId, onPendingConsumed }) => {
  const [entityId, setEntityId] = useState('');
  const [hours, setHours] = useState(24);
  const [trail, setTrail] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [visibleCount, setVisibleCount] = useState(50); // virtualization: show N rows

  const search = useCallback(async (overrideId) => {
    const id = (overrideId || entityId).trim();
    if (!id) return;
    if (!overrideId) setEntityId(id);
    setLoading(true);
    setError('');
    setTrail(null);
    setVisibleCount(50);
    try {
      const r = await fetch(`${BACKEND}/api/history/trail/${encodeURIComponent(id)}?hours=${hours}`);
      if (!r.ok) throw new Error(`Server error (${r.status})`);
      const data = await r.json();
      if (data?.error) throw new Error(data.error);
      if (Array.isArray(data) && data.length > 0) {
        setTrail(data);
        onShowTrail?.(id, data);
      } else {
        setTrail([]);
        setError('No trail data found — aircraft may not have been tracked in this period');
      }
    } catch (err) {
      setError(err.message || 'Failed to fetch trail');
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
    <div className="space-y-2.5">
      <div className="text-hud-text/50 text-[10px] sm:text-[11px] font-mono">
        Search by ICAO hex, callsign, or MMSI
      </div>
      <div className="flex gap-1.5">
        <input
          type="text"
          value={entityId}
          onChange={e => setEntityId(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && search()}
          placeholder="e.g. ae0413, FORTE12, 211234567"
          className="flex-1 bg-[rgba(0,0,0,0.5)] border border-hud-border/60 rounded-md px-2 py-1.5 min-h-[32px]
            text-[11px] sm:text-xs font-mono text-white placeholder:text-hud-text/25
            focus:border-hud-green focus:outline-none transition-colors"
        />
        <HudSelect value={hours} onChange={e => setHours(+e.target.value)} className="shrink-0">
          <option value={6}>6h</option>
          <option value={24}>24h</option>
          <option value={48}>48h</option>
          <option value={168}>7d</option>
          <option value={336}>14d</option>
        </HudSelect>
        <button
          onClick={() => search()}
          disabled={loading || !entityId.trim()}
          className="hud-btn text-[11px] sm:text-xs px-3 py-1.5 min-h-[32px] disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <span className="pointer-events-none">{loading ? '…' : '🔍'}</span>
        </button>
      </div>

      <ErrorBanner message={error} />
      {loading && <div className="text-hud-green text-xs font-mono animate-pulse text-center py-2">Searching positions…</div>}

      {trail && trail.length > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="text-hud-green text-[10px] sm:text-[11px] font-mono font-bold">
              ✓ {trail.length} positions — trail drawn
            </span>
            <span className="text-hud-text/30 text-[9px] font-mono ml-auto">
              {new Date(trail[0].sampled_at).toLocaleDateString('en-GB', { timeZone: 'UTC' })}
            </span>
          </div>
          <div className="rounded-md border border-hud-border/20 bg-black/20 overflow-hidden">
            {/* Header row */}
            <div className="flex gap-1 text-[8px] sm:text-[9px] font-mono text-hud-text/40 px-2 py-1 border-b border-hud-border/20 bg-black/30">
              <span className="w-12">TIME</span>
              <span className="flex-1">POSITION</span>
              <span className="w-12 text-right">ALT</span>
              <span className="w-12 text-right">SPD</span>
            </div>
            {/* Virtualized rows — show first N then "load more" */}
            <div className="max-h-[28vh] overflow-y-auto scrollbar-thin">
              {trail.slice(0, visibleCount).map((p, i) => (
                <div key={i} className="flex gap-1 text-[9px] sm:text-[10px] font-mono px-2 py-[3px] border-b border-hud-border/10 hover:bg-hud-green/5">
                  <span className="text-hud-text/50 w-12">
                    {new Date(p.sampled_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' })}Z
                  </span>
                  <span className="text-hud-green/80 flex-1">{p.lat?.toFixed(3)}° {p.lon?.toFixed(3)}°</span>
                  <span className="text-hud-cyan/70 w-12 text-right">{p.altitude != null ? `${Math.round(p.altitude)}m` : '—'}</span>
                  <span className="text-hud-amber/70 w-12 text-right">{p.speed != null ? `${Math.round(p.speed)}kn` : '—'}</span>
                </div>
              ))}
            </div>
            {trail.length > visibleCount && (
              <button
                onClick={() => setVisibleCount(v => v + 100)}
                className="w-full py-1.5 text-[10px] font-mono text-hud-green/60 hover:text-hud-green hover:bg-hud-green/5 transition-colors border-t border-hud-border/20"
              >
                Show more ({trail.length - visibleCount} remaining)
              </button>
            )}
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

  // Cleanup trail polyline when panel closes
  const handleClose = useCallback(() => {
    setOpen(false);
    // Remove trail polyline from globe
    if (viewer && !viewer.isDestroyed()) {
      const existing = viewer.entities.getById('__history_trail__');
      if (existing) viewer.entities.remove(existing);
    }
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
        className="hud-btn text-xs px-3 py-2 min-h-[36px] font-bold bg-[rgba(5,8,16,0.82)] backdrop-blur-sm hover:bg-[rgba(5,8,16,0.95)] select-none"
        title="View historical data from database"
      >
        <span className="pointer-events-none">📊 HISTORY</span>
      </button>
    );
  }

  const tabs = [
    { id: 'alerts', label: 'ALERTS', icon: '⚠' },
    { id: 'stats',  label: 'STATS',  icon: '📈' },
    { id: 'trail',  label: 'TRAIL',  icon: '📍' },
  ];

  return (
    <div
      className="bg-[rgba(5,8,16,0.94)] border border-hud-border/60 rounded-lg shadow-2xl pointer-events-auto backdrop-blur-lg"
      style={{ width: isMobile ? 'calc(100vw - 24px)' : 360, maxHeight: isMobile ? '70vh' : '60vh', display: 'flex', flexDirection: 'column' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-hud-border/40 bg-[rgba(5,8,16,0.98)] rounded-t-lg shrink-0">
        <span className="text-[11px] sm:text-xs font-mono font-bold text-hud-green tracking-wider">📊 HISTORICAL DATABASE</span>
        <button
          onClick={handleClose}
          className="w-6 h-6 flex items-center justify-center rounded hover:bg-red-500/20 text-hud-text hover:text-red-400 transition-colors text-sm"
        >✕</button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-hud-border/30 shrink-0">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 py-2 text-[10px] sm:text-[11px] font-mono font-bold transition-all select-none
              ${tab === t.id
                ? 'text-hud-green border-b-2 border-hud-green bg-hud-green/5'
                : 'text-hud-text/50 hover:text-hud-text border-b-2 border-transparent hover:bg-white/3'}`}
          >
            <span className="pointer-events-none">{t.icon} {t.label}</span>
          </button>
        ))}
      </div>

      {/* Content — scrollable */}
      <div className="flex-1 overflow-y-auto px-3 py-2.5 scrollbar-thin">
        {tab === 'alerts' && <AlertsTab onFlyTo={handleFlyTo} />}
        {tab === 'stats' && <StatsTab />}
        {tab === 'trail' && <TrailTab onShowTrail={handleShowTrail} viewer={viewer} pendingTrailId={pendingTrailId} onPendingConsumed={() => setPendingTrailId(null)} />}
      </div>
    </div>
  );
};

export default memo(HistoryPanel);
