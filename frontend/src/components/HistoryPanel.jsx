/**
 * HistoryPanel — Full-screen intelligence dashboard with analytics & charts.
 * Opens centered (modal) with minimize button to collapse to bottom-right widget.
 * Tabs: OVERVIEW | ALERTS | EVENTS | NEWS | INTEL | TRAIL
 * Uses recharts for visualizations.
 */
import React, { useState, useCallback, useEffect, useMemo, memo } from 'react';
import { createPortal } from 'react-dom';
import {
  BarChart, Bar, AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from 'recharts';

const BACKEND = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

// ── Theme colors ────────────────────────────────────────────────────────────
const C = {
  green: '#00ff88', cyan: '#00e5ff', amber: '#ffb300', red: '#ff4444',
  orange: '#ff8800', purple: '#b388ff', blue: '#448aff', text: '#88a0a8',
  bg: 'rgba(5,8,16,0.97)', border: 'rgba(136,160,168,0.25)',
};
const PIE_COLORS = ['#00ff88','#00e5ff','#ff4444','#ffb300','#ff8800','#b388ff','#448aff','#80cbc4','#ef5350','#ab47bc','#26c6da','#66bb6a'];
const SEV_COLOR_MAP = { critical: C.red, high: C.orange, medium: C.amber, low: C.green };

// ── Helpers ─────────────────────────────────────────────────────────────────
function timeAgo(ts) {
  if (!ts) return '—';
  const s = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

async function fetchAPI(path) {
  const r = await fetch(`${BACKEND}${path}`);
  if (!r.ok) throw new Error(`${r.status}`);
  const d = await r.json();
  if (d?.error) throw new Error(d.error);
  return d;
}

// ── Shared UI components ────────────────────────────────────────────────────
const HudSelect = ({ value, onChange, children, className = '' }) => (
  <select value={value} onChange={onChange}
    className={`appearance-none bg-black/50 border border-white/10 rounded text-[11px] font-mono text-[#88a0a8] px-2 py-1.5 min-h-[32px] focus:border-[#00ff88] focus:outline-none hover:border-[#00ff88]/50 cursor-pointer transition-colors ${className}`}
    style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='%2388A0A8' viewBox='0 0 20 20'%3E%3Cpath d='M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 4px center', backgroundSize: '14px', paddingRight: '22px' }}>
    {children}
  </select>
);

const ErrorBanner = ({ msg }) => msg ? (
  <div className="flex items-center gap-1.5 px-2 py-1.5 rounded bg-red-950/50 border border-red-500/30 text-red-300 text-[10px] font-mono">
    <span>⚠</span> {msg}
  </div>
) : null;

const EmptyState = ({ icon, msg }) => (
  <div className="flex flex-col items-center justify-center py-10 text-center opacity-50">
    <span className="text-3xl mb-2">{icon}</span>
    <span className="text-[11px] font-mono">{msg}</span>
  </div>
);

const Loader = ({ text = 'Loading…' }) => (
  <div className="text-[#00ff88] text-xs font-mono animate-pulse text-center py-6">{text}</div>
);

const SectionTitle = ({ children }) => (
  <div className="text-[11px] font-mono font-bold text-[#88a0a8]/70 tracking-wider uppercase mb-2">{children}</div>
);

// Custom tooltip for recharts
const HudTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[rgba(5,8,16,0.95)] border border-white/15 rounded px-2.5 py-1.5 text-[11px] font-mono shadow-xl">
      {label && <div className="text-white/60 mb-1">{label}</div>}
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color || C.green }}>{p.name}: <span className="text-white">{typeof p.value === 'number' ? p.value.toLocaleString() : p.value}</span></div>
      ))}
    </div>
  );
};

// ── OVERVIEW TAB — KPI cards + charts ───────────────────────────────────────
const OverviewTab = ({ hours, onFlyTo }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true); setError('');
    Promise.all([
      fetchAPI(`/api/analytics/fleet?hours=${hours}`),
      fetchAPI(`/api/analytics/aircraft-types?hours=${hours}`),
      fetchAPI(`/api/analytics/hourly-activity?hours=${hours}`),
      fetchAPI(`/api/analytics/top-entities?hours=${hours}&limit=15`),
      fetchAPI(`/api/analytics/altitude?hours=${hours}`),
      fetchAPI(`/api/analytics/speed?hours=${hours}`),
      fetchAPI(`/api/analytics/alerts-by-severity?hours=${hours}`),
      fetchAPI(`/api/analytics/conflicts-by-type?hours=${hours}`),
      fetchAPI(`/api/analytics/news-by-source?hours=${hours}`),
      fetchAPI(`/api/history/stats?days=14`),
    ]).then(([fleet, acTypes, hourly, top, alt, speed, alertSev, conflictTypes, newsSrc, dailyStats]) => {
      setData({ fleet, acTypes, hourly, top, alt, speed, alertSev, conflictTypes, newsSrc, dailyStats });
    }).catch(err => setError(err.message)).finally(() => setLoading(false));
  }, [hours]);

  if (loading) return <Loader text="Loading analytics…" />;
  if (error) return <ErrorBanner msg={error} />;
  if (!data) return <EmptyState icon="📊" msg="No analytics data yet" />;

  // Compute KPIs — coerce count to number (Supabase RPC returns BIGINT as string)
  const totalAircraft = data.fleet.filter(f => f.entity_type === 'aircraft').reduce((s, f) => s + Number(f.count || 0), 0);
  const totalShips = data.fleet.filter(f => f.entity_type === 'ship').reduce((s, f) => s + Number(f.count || 0), 0);
  const totalAlerts = data.alertSev.reduce((s, a) => s + Number(a.count || 0), 0);
  const totalConflicts = data.conflictTypes.reduce((s, c) => s + Number(c.count || 0), 0);
  const countries = new Set(data.fleet.map(f => f.flag)).size;

  // Format hourly for area chart
  const hourlyChart = (data.hourly || []).map(h => ({
    time: new Date(h.hour).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }),
    Aircraft: h.aircraft_count || 0,
    Ships: h.ship_count || 0,
  }));

  // Top fleet countries (aircraft) — coerce count
  const topCountries = data.fleet
    .filter(f => f.entity_type === 'aircraft' && f.flag)
    .map(f => ({ ...f, count: Number(f.count) }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  // Aircraft types for pie — coerce count
  const acTypePie = (data.acTypes || []).slice(0, 8).map(t => ({ name: t.aircraft_type, value: Number(t.count) }));

  // Altitude for bar chart — coerce count
  const altChart = (data.alt || []).filter(a => a.bucket !== 'Unknown').map(a => ({ name: a.bucket?.replace(/[()]/g, '') || '?', count: Number(a.count) }));

  // Alert severity for pie — coerce count
  const alertPie = (data.alertSev || []).map(a => ({ name: a.severity, value: Number(a.count), color: SEV_COLOR_MAP[a.severity] || C.text }));

  return (
    <div className="space-y-5">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        {[
          { label: 'AIRCRAFT', value: totalAircraft, color: C.cyan, icon: '✈' },
          { label: 'SHIPS', value: totalShips, color: C.blue, icon: '⛴' },
          { label: 'ALERTS', value: totalAlerts, color: C.red, icon: '⚠' },
          { label: 'EVENTS', value: totalConflicts, color: C.orange, icon: '⚔' },
          { label: 'NATIONS', value: countries, color: C.purple, icon: '🌍' },
        ].map(kpi => (
          <div key={kpi.label} className="rounded-lg border border-white/10 bg-black/30 p-3 text-center">
            <div className="text-lg mb-0.5">{kpi.icon}</div>
            <div className="text-2xl font-bold font-mono" style={{ color: kpi.color }}>{kpi.value}</div>
            <div className="text-[10px] font-mono text-white/40 tracking-wider">{kpi.label}</div>
          </div>
        ))}
      </div>

      {/* Activity Timeline */}
      {hourlyChart.length > 0 && (
        <div>
          <SectionTitle>ACTIVITY TIMELINE (UTC)</SectionTitle>
          <div className="rounded-lg border border-white/10 bg-black/20 p-3">
            <ResponsiveContainer width="100%" height={160}>
              <AreaChart data={hourlyChart}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="time" tick={{ fill: '#88a0a8', fontSize: 10 }} interval="preserveStartEnd" />
                <YAxis tick={{ fill: '#88a0a8', fontSize: 10 }} width={35} />
                <Tooltip content={<HudTooltip />} />
                <Area type="monotone" dataKey="Aircraft" stroke={C.cyan} fill={C.cyan} fillOpacity={0.15} strokeWidth={2} />
                <Area type="monotone" dataKey="Ships" stroke={C.blue} fill={C.blue} fillOpacity={0.1} strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Two-column: Fleet + Aircraft Types */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {topCountries.length > 0 && (
          <div>
            <SectionTitle>FLEET BY NATION</SectionTitle>
            <div className="rounded-lg border border-white/10 bg-black/20 p-3">
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={topCountries} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis type="number" tick={{ fill: '#88a0a8', fontSize: 10 }} />
                  <YAxis type="category" dataKey="flag" tick={{ fill: '#88a0a8', fontSize: 10 }} width={40} />
                  <Tooltip content={<HudTooltip />} />
                  <Bar dataKey="count" name="Aircraft" fill={C.cyan} radius={[0,4,4,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
        {acTypePie.length > 0 && (
          <div>
            <SectionTitle>AIRCRAFT TYPES</SectionTitle>
            <div className="rounded-lg border border-white/10 bg-black/20 p-3">
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={acTypePie} cx="50%" cy="50%" outerRadius={65} dataKey="value" label={({ name, percent }) => `${name} ${(percent*100).toFixed(0)}%`} labelLine={false}
                    style={{ fontSize: 10, fontFamily: 'monospace' }}>
                    {acTypePie.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip content={<HudTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>

      {/* Two-column: Altitude + Alert Severity */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {altChart.length > 0 && (
          <div>
            <SectionTitle>ALTITUDE DISTRIBUTION</SectionTitle>
            <div className="rounded-lg border border-white/10 bg-black/20 p-3">
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={altChart}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="name" tick={{ fill: '#88a0a8', fontSize: 10 }} interval={0} angle={-15} textAnchor="end" height={40} />
                  <YAxis tick={{ fill: '#88a0a8', fontSize: 10 }} width={35} />
                  <Tooltip content={<HudTooltip />} />
                  <Bar dataKey="count" name="Positions" fill={C.amber} radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
        {alertPie.length > 0 && (
          <div>
            <SectionTitle>ALERT SEVERITY</SectionTitle>
            <div className="rounded-lg border border-white/10 bg-black/20 p-3">
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie data={alertPie} cx="50%" cy="50%" innerRadius={35} outerRadius={60} dataKey="value" paddingAngle={3}
                    label={({ name, value }) => `${name}: ${value}`} style={{ fontSize: 10, fontFamily: 'monospace' }}>
                    {alertPie.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                  <Tooltip content={<HudTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>

      {/* Daily Stats Table */}
      {data.dailyStats.length > 0 && (
        <div>
          <SectionTitle>DAILY STATS (LAST 14 DAYS)</SectionTitle>
          <div className="rounded-lg border border-white/10 bg-black/20 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-[11px] font-mono">
                <thead>
                  <tr className="text-white/40 border-b border-white/10">
                    <th className="text-left px-2 py-1.5">DATE</th>
                    <th className="text-center px-2 py-1.5">✈ AC</th>
                    <th className="text-center px-2 py-1.5">⛴ SHIPS</th>
                    <th className="text-center px-2 py-1.5">◆ CONF</th>
                    <th className="text-center px-2 py-1.5">⚠ ALERTS</th>
                    <th className="text-center px-2 py-1.5">📰 NEWS</th>
                    <th className="text-center px-2 py-1.5">🔴 CRIT</th>
                  </tr>
                </thead>
                <tbody>
                  {data.dailyStats.slice().reverse().map(s => (
                    <tr key={s.date} className="border-b border-white/5 hover:bg-white/3">
                      <td className="text-white/50 px-2 py-1">{s.date?.slice(5)}</td>
                      <td className="text-center px-2 py-1" style={{ color: C.cyan }}>{s.aircraft_count}</td>
                      <td className="text-center px-2 py-1" style={{ color: C.blue }}>{s.ship_count}</td>
                      <td className="text-center px-2 py-1" style={{ color: C.orange }}>{s.conflict_count}</td>
                      <td className="text-center px-2 py-1" style={{ color: C.red }}>{s.alert_count}</td>
                      <td className="text-center px-2 py-1" style={{ color: C.purple }}>{s.news_count}</td>
                      <td className="text-center px-2 py-1" style={{ color: C.red }}>{s.critical_alerts}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Top Tracked Entities */}
      {data.top.length > 0 && (
        <div>
          <SectionTitle>TOP TRACKED ENTITIES</SectionTitle>
          <div className="rounded-lg border border-white/10 bg-black/20 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-[11px] font-mono">
                <thead>
                  <tr className="text-white/40 border-b border-white/10">
                    <th className="text-left px-2 py-1.5">ID</th>
                    <th className="text-left px-2 py-1.5">CALLSIGN/NAME</th>
                    <th className="text-center px-2 py-1.5">TYPE</th>
                    <th className="text-center px-2 py-1.5">FLAG</th>
                    <th className="text-center px-2 py-1.5">SNAPS</th>
                  </tr>
                </thead>
                <tbody>
                  {data.top.map((e, i) => (
                    <tr key={e.entity_id || i} className="border-b border-white/5 hover:bg-white/3">
                      <td className="text-white/60 px-2 py-1 truncate max-w-[80px]">{e.entity_id}</td>
                      <td className="px-2 py-1 truncate max-w-[120px]" style={{ color: e.entity_type === 'aircraft' ? C.cyan : C.blue }}>{e.callsign || e.name || '—'}</td>
                      <td className="text-center px-2 py-1 text-white/40">{e.entity_type === 'aircraft' ? '✈' : '⛴'}</td>
                      <td className="text-center px-2 py-1 text-white/50">{e.flag || '—'}</td>
                      <td className="text-center px-2 py-1 text-[#00ff88]">{e.snapshots || e.snapshot_count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Conflict Types */}
      {data.conflictTypes.length > 0 && (
        <div>
          <SectionTitle>CONFLICT EVENT TYPES</SectionTitle>
          <div className="rounded-lg border border-white/10 bg-black/20 p-3">
            <ResponsiveContainer width="100%" height={140}>
              <BarChart data={data.conflictTypes.slice(0, 10)}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="event_type" tick={{ fill: '#88a0a8', fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={40} />
                <YAxis tick={{ fill: '#88a0a8', fontSize: 10 }} width={30} />
                <Tooltip content={<HudTooltip />} />
                <Bar dataKey="count" name="Events" fill={C.orange} radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* News Sources */}
      {data.newsSrc.length > 0 && (
        <div>
          <SectionTitle>NEWS SOURCES</SectionTitle>
          <div className="rounded-lg border border-white/10 bg-black/20 p-3">
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={data.newsSrc.slice(0, 10)} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis type="number" tick={{ fill: '#88a0a8', fontSize: 10 }} />
                <YAxis type="category" dataKey="source" tick={{ fill: '#88a0a8', fontSize: 10 }} width={90} />
                <Tooltip content={<HudTooltip />} />
                <Bar dataKey="count" name="Articles" fill={C.purple} radius={[0,4,4,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
};

// ── ALERTS TAB ──────────────────────────────────────────────────────────────
const AlertsTab = ({ onFlyTo }) => {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [hours, setHours] = useState(24);
  const [severity, setSeverity] = useState('all');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const p = new URLSearchParams({ hours });
      if (severity !== 'all') p.set('severity', severity);
      const data = await fetchAPI(`/api/history/alerts?${p}`);
      setAlerts(Array.isArray(data) ? data : []);
    } catch (err) { setError(err.message); setAlerts([]); }
    setLoading(false);
  }, [hours, severity]);

  useEffect(() => { load(); }, [load]);

  const SEV_DOT = { critical: 'bg-red-500', high: 'bg-orange-500', medium: 'bg-amber-500', low: 'bg-green-500' };
  const SEV_TXT = { critical: 'text-red-400', high: 'text-orange-400', medium: 'text-amber-400', low: 'text-green-400' };

  return (
    <div className="space-y-3">
      <div className="flex gap-2 items-center flex-wrap">
        <HudSelect value={hours} onChange={e => setHours(+e.target.value)}>
          <option value={6}>6h</option><option value={24}>24h</option><option value={48}>48h</option><option value={168}>7d</option><option value={336}>14d</option>
        </HudSelect>
        <HudSelect value={severity} onChange={e => setSeverity(e.target.value)}>
          <option value="all">All severity</option>
          <option value="critical">🔴 Critical</option><option value="high">🟠 High</option><option value="medium">🟡 Medium</option>
        </HudSelect>
        <span className="text-white/30 text-[10px] font-mono ml-auto">{alerts.length} results</span>
      </div>
      <ErrorBanner msg={error} />
      {loading && <Loader />}
      <div className="space-y-1.5">
        {alerts.map((a, i) => (
          <div key={a.alert_id || i}
            className="group p-2.5 rounded-lg border border-white/10 hover:border-[#00ff88]/40 bg-black/20 hover:bg-black/40 transition-all cursor-pointer"
            onClick={() => a.lat && a.lon && onFlyTo?.({ lat: a.lat, lon: a.lon })}>
            <div className="flex items-start gap-2">
              <span className={`w-2.5 h-2.5 rounded-full mt-0.5 shrink-0 ${SEV_DOT[a.severity] || 'bg-gray-500'}`} />
              <div className="flex-1 min-w-0">
                <div className="text-white text-[11px] font-mono leading-snug truncate group-hover:text-[#00ff88] transition-colors">{a.title}</div>
                <div className="flex gap-2 mt-1 items-center flex-wrap">
                  <span className={`text-[9px] font-mono font-bold ${SEV_TXT[a.severity] || ''}`}>{(a.severity || '').toUpperCase()}</span>
                  {a.credibility != null && <span className="text-[9px] font-mono text-white/40">{Math.round(a.credibility)}%</span>}
                  <span className="text-[9px] font-mono text-white/25">{timeAgo(a.timestamp)}</span>
                  {a.region && <span className="text-[9px] font-mono text-[#00e5ff]/60 truncate max-w-[100px]">{a.region}</span>}
                </div>
              </div>
            </div>
          </div>
        ))}
        {!loading && !error && alerts.length === 0 && <EmptyState icon="🔍" msg="No alerts found" />}
      </div>
    </div>
  );
};

// ── EVENTS (CONFLICT) TAB ───────────────────────────────────────────────────
const EventsTab = ({ onFlyTo }) => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [hours, setHours] = useState(48);
  const [source, setSource] = useState('all');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const p = new URLSearchParams({ hours });
      if (source !== 'all') p.set('source', source);
      const data = await fetchAPI(`/api/history/conflicts?${p}`);
      setItems(Array.isArray(data) ? data : []);
    } catch (err) { setError(err.message); setItems([]); }
    setLoading(false);
  }, [hours, source]);

  useEffect(() => { load(); }, [load]);

  const TYPE_EMOJI = { airstrike: '💥', missile: '🚀', explosion: '💣', fire: '🔥', drone: '🛸', artillery: '🎯', naval: '⚓', troops: '🪖', unrest: '✊', conflict: '⚔' };
  const SEV_TXT = { critical: 'text-red-400', high: 'text-orange-400', medium: 'text-amber-400', low: 'text-green-400' };

  return (
    <div className="space-y-3">
      <div className="flex gap-2 items-center flex-wrap">
        <HudSelect value={hours} onChange={e => setHours(+e.target.value)}>
          <option value={24}>24h</option><option value={48}>48h</option><option value={168}>7d</option><option value={336}>14d</option>
        </HudSelect>
        <HudSelect value={source} onChange={e => setSource(e.target.value)}>
          <option value="all">All sources</option>
          <option value="NASA FIRMS">🛰 FIRMS</option><option value="GDELT-GEO">GDELT</option><option value="ACLED">ACLED</option><option value="ReliefWeb">ReliefWeb</option>
        </HudSelect>
        <span className="text-white/30 text-[10px] font-mono ml-auto">{items.length}</span>
      </div>
      <ErrorBanner msg={error} />
      {loading && <Loader />}
      <div className="space-y-1.5">
        {items.map((c, i) => (
          <div key={c.event_id || i}
            className="group p-2.5 rounded-lg border border-white/10 hover:border-orange-500/40 bg-black/20 hover:bg-black/40 transition-all cursor-pointer"
            onClick={() => c.lat && c.lon && onFlyTo?.({ lat: c.lat, lon: c.lon })}>
            <div className="flex items-start gap-2">
              <span className="text-sm shrink-0">{TYPE_EMOJI[c.event_type] || '◆'}</span>
              <div className="flex-1 min-w-0">
                <div className="text-white text-[11px] font-mono leading-snug truncate group-hover:text-orange-300 transition-colors">{c.title}</div>
                <div className="flex gap-2 mt-1 items-center flex-wrap">
                  {c.severity && <span className={`text-[9px] font-mono font-bold ${SEV_TXT[c.severity] || ''}`}>{c.severity.toUpperCase()}</span>}
                  {c.frp != null && <span className="text-[9px] font-mono text-red-400">{c.frp.toFixed(1)} MW</span>}
                  {c.zone && <span className="text-[9px] font-mono text-[#00e5ff]/60 truncate max-w-[80px]">{c.zone}</span>}
                  <span className="text-[9px] font-mono text-white/20">{c.source}</span>
                  <span className="text-[9px] font-mono text-white/25 ml-auto">{timeAgo(c.published_at)}</span>
                </div>
              </div>
            </div>
          </div>
        ))}
        {!loading && !error && items.length === 0 && <EmptyState icon="⚔" msg="No conflict events found" />}
      </div>
    </div>
  );
};

// ── NEWS TAB ────────────────────────────────────────────────────────────────
const NewsTab = ({ onFlyTo }) => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [hours, setHours] = useState(48);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const data = await fetchAPI(`/api/history/news?hours=${hours}`);
      setItems(Array.isArray(data) ? data : []);
    } catch (err) { setError(err.message); setItems([]); }
    setLoading(false);
  }, [hours]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-3">
      <div className="flex gap-2 items-center">
        <HudSelect value={hours} onChange={e => setHours(+e.target.value)}>
          <option value={24}>24h</option><option value={48}>48h</option><option value={168}>7d</option><option value={336}>14d</option>
        </HudSelect>
        <span className="text-white/30 text-[10px] font-mono ml-auto">{items.length} articles</span>
      </div>
      <ErrorBanner msg={error} />
      {loading && <Loader />}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {items.map((n, i) => (
          <div key={n.news_id || i}
            className="group p-2.5 rounded-lg border border-white/10 hover:border-[#00e5ff]/40 bg-black/20 hover:bg-black/40 transition-all cursor-pointer"
            onClick={() => n.url ? window.open(n.url, '_blank', 'noopener') : (n.lat && n.lon && onFlyTo?.({ lat: n.lat, lon: n.lon }))}>
            <div className="flex gap-2">
              {n.image_url && <img src={n.image_url} alt="" className="w-14 h-14 rounded object-cover shrink-0 opacity-70 group-hover:opacity-100 transition-opacity" loading="lazy" />}
              <div className="flex-1 min-w-0">
                <div className="text-white text-[11px] font-mono leading-snug line-clamp-2 group-hover:text-[#00e5ff] transition-colors">{n.title}</div>
                <div className="flex gap-2 mt-1 items-center">
                  <span className="text-[9px] font-mono text-[#00e5ff]/60 truncate max-w-[100px]">{n.source}</span>
                  <span className="text-[9px] font-mono text-white/25 ml-auto">{timeAgo(n.published_at)}</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
      {!loading && !error && items.length === 0 && <EmptyState icon="📰" msg="No archived news" />}
    </div>
  );
};

// ── AI INTEL TAB ────────────────────────────────────────────────────────────
const IntelTab = () => {
  const [insights, setInsights] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true); setError('');
    fetchAPI('/api/history/insights?limit=10')
      .then(data => setInsights(Array.isArray(data) ? data : []))
      .catch(err => { setError(err.message); setInsights([]); })
      .finally(() => setLoading(false));
  }, []);

  const THREAT_BG = { LOW: 'border-green-500/30 bg-green-950/20', MEDIUM: 'border-amber-500/30 bg-amber-950/20', HIGH: 'border-orange-500/30 bg-orange-950/20', CRITICAL: 'border-red-500/30 bg-red-950/20' };
  const THREAT_CLR = { LOW: C.green, MEDIUM: C.amber, HIGH: C.orange, CRITICAL: C.red };

  if (loading) return <Loader text="Loading AI insights…" />;
  if (error) return <ErrorBanner msg={error} />;
  if (insights.length === 0) return <EmptyState icon="🤖" msg="No AI insights yet — Gemini analysis runs every 30 min when GEMINI_API_KEY is set" />;

  return (
    <div className="space-y-3">
      {insights.map((ins, i) => (
        <div key={i} className={`p-4 rounded-lg border ${THREAT_BG[ins.threat_level] || 'border-white/10 bg-black/20'}`}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-mono font-bold" style={{ color: THREAT_CLR[ins.threat_level] || C.text }}>
              🤖 THREAT LEVEL: {ins.threat_level || '?'}
            </span>
            <span className="text-[9px] font-mono text-white/30">{timeAgo(ins.analyzed_at)}{ins.model && ` · ${ins.model}`}</span>
          </div>
          {ins.summary && <p className="text-[11px] font-mono text-white/70 leading-relaxed mb-3">{ins.summary}</p>}
          {ins.hotspots?.length > 0 && (
            <div className="mb-2">
              <span className="text-[9px] font-mono text-white/40 font-bold">HOTSPOTS:</span>
              {ins.hotspots.map((h, j) => (
                <div key={j} className="text-[10px] font-mono text-orange-300/70 ml-2 mt-0.5">📍 {h.location} — {h.reason}</div>
              ))}
            </div>
          )}
          {ins.recommendations?.length > 0 && (
            <div>
              <span className="text-[9px] font-mono text-white/40 font-bold">WATCH:</span>
              {ins.recommendations.map((r, j) => (
                <div key={j} className="text-[10px] font-mono text-[#00e5ff]/60 ml-2 mt-0.5">▸ {r}</div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

// ── TRAIL TAB ───────────────────────────────────────────────────────────────
const TrailTab = ({ onShowTrail, viewer, pendingTrailId, onPendingConsumed }) => {
  const [entityId, setEntityId] = useState('');
  const [hours, setHours] = useState(24);
  const [trail, setTrail] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [visibleCount, setVisibleCount] = useState(50);

  const search = useCallback(async (overrideId) => {
    const id = (overrideId || entityId).trim();
    if (!id) return;
    if (!overrideId) setEntityId(id);
    setLoading(true); setError(''); setTrail(null); setVisibleCount(50);
    try {
      const data = await fetchAPI(`/api/history/trail/${encodeURIComponent(id)}?hours=${hours}`);
      if (Array.isArray(data) && data.length > 0) {
        setTrail(data);
        onShowTrail?.(id, data);
      } else {
        setTrail([]);
        setError('No trail data found for this period');
      }
    } catch (err) { setError(err.message); }
    setLoading(false);
  }, [entityId, hours, onShowTrail]);

  useEffect(() => {
    if (pendingTrailId) { setEntityId(pendingTrailId); search(pendingTrailId); onPendingConsumed?.(); }
  }, [pendingTrailId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Trail altitude chart
  const trailChart = useMemo(() => {
    if (!trail?.length) return [];
    return trail.filter((_, i) => i % Math.max(1, Math.floor(trail.length / 100)) === 0).map(p => ({
      time: new Date(p.sampled_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }),
      Altitude: p.altitude != null ? Math.round(p.altitude) : null,
      Speed: p.speed != null ? Math.round(p.speed) : null,
    }));
  }, [trail]);

  return (
    <div className="space-y-3">
      <div className="text-white/40 text-[10px] font-mono">Search by ICAO hex, callsign, or MMSI</div>
      <div className="flex gap-1.5">
        <input type="text" value={entityId} onChange={e => setEntityId(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && search()}
          placeholder="e.g. ae0413, FORTE12, 211234567"
          className="flex-1 bg-black/50 border border-white/10 rounded px-2.5 py-1.5 min-h-[32px] text-[11px] font-mono text-white placeholder:text-white/20 focus:border-[#00ff88] focus:outline-none transition-colors" />
        <HudSelect value={hours} onChange={e => setHours(+e.target.value)} className="shrink-0">
          <option value={6}>6h</option><option value={24}>24h</option><option value={48}>48h</option><option value={168}>7d</option><option value={336}>14d</option>
        </HudSelect>
        <button onClick={() => search()} disabled={loading || !entityId.trim()}
          className="bg-[#00ff88]/10 border border-[#00ff88]/30 rounded px-3 py-1.5 min-h-[32px] text-[11px] font-mono text-[#00ff88] hover:bg-[#00ff88]/20 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
          {loading ? '…' : '🔍'}
        </button>
      </div>
      <ErrorBanner msg={error} />
      {loading && <Loader text="Searching positions…" />}

      {trail && trail.length > 0 && (
        <div className="space-y-3">
          <div className="text-[#00ff88] text-[11px] font-mono font-bold">✓ {trail.length} positions — trail drawn on globe</div>

          {/* Altitude + Speed chart */}
          {trailChart.length > 2 && (
            <div className="rounded-lg border border-white/10 bg-black/20 p-3">
              <SectionTitle>ALTITUDE & SPEED PROFILE</SectionTitle>
              <ResponsiveContainer width="100%" height={140}>
                <AreaChart data={trailChart}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="time" tick={{ fill: '#88a0a8', fontSize: 8 }} interval="preserveStartEnd" />
                  <YAxis yAxisId="alt" tick={{ fill: '#88a0a8', fontSize: 8 }} width={40} />
                  <YAxis yAxisId="spd" orientation="right" tick={{ fill: '#88a0a8', fontSize: 8 }} width={35} />
                  <Tooltip content={<HudTooltip />} />
                  <Area yAxisId="alt" type="monotone" dataKey="Altitude" stroke={C.amber} fill={C.amber} fillOpacity={0.1} strokeWidth={2} unit="m" />
                  <Area yAxisId="spd" type="monotone" dataKey="Speed" stroke={C.cyan} fill="none" strokeWidth={1.5} strokeDasharray="4 2" unit="kn" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Position table */}
          <div className="rounded-lg border border-white/10 bg-black/20 overflow-hidden">
            <div className="flex gap-1 text-[8px] font-mono text-white/30 px-2.5 py-1.5 border-b border-white/10 bg-black/30">
              <span className="w-12">TIME</span>
              <span className="flex-1">POSITION</span>
              <span className="w-14 text-right">ALT</span>
              <span className="w-12 text-right">SPD</span>
              <span className="w-12 text-right">HDG</span>
            </div>
            <div className="max-h-[30vh] overflow-y-auto">
              {trail.slice(0, visibleCount).map((p, i) => (
                <div key={i} className="flex gap-1 text-[9px] font-mono px-2.5 py-[3px] border-b border-white/5 hover:bg-white/3">
                  <span className="text-white/40 w-12">{new Date(p.sampled_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' })}Z</span>
                  <span className="text-[#00ff88]/70 flex-1">{p.lat?.toFixed(3)}° {p.lon?.toFixed(3)}°</span>
                  <span className="text-[#ffb300]/60 w-14 text-right">{p.altitude != null ? `${Math.round(p.altitude)}m` : '—'}</span>
                  <span className="text-[#00e5ff]/60 w-12 text-right">{p.speed != null ? `${Math.round(p.speed)}kn` : '—'}</span>
                  <span className="text-white/30 w-12 text-right">{p.heading != null ? `${Math.round(p.heading)}°` : '—'}</span>
                </div>
              ))}
            </div>
            {trail.length > visibleCount && (
              <button onClick={() => setVisibleCount(v => v + 200)}
                className="w-full py-1.5 text-[10px] font-mono text-[#00ff88]/50 hover:text-[#00ff88] hover:bg-white/3 transition-colors border-t border-white/10">
                Show more ({trail.length - visibleCount} remaining)
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// ════════════════════════════════════════════════════════════════════════════
// MAIN PANEL — centered modal with minimize to widget
// ════════════════════════════════════════════════════════════════════════════
const HistoryPanel = ({ viewer, onFlyTo, isMobile = false, externalTrailId = null }) => {
  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(true); // true = bottom-right widget, false = full modal
  const [tab, setTab] = useState('overview');
  const [hours, setHours] = useState(24);
  const [pendingTrailId, setPendingTrailId] = useState(null);

  // External trail request from EntityPopup
  useEffect(() => {
    if (externalTrailId?.id) {
      setOpen(true);
      setMinimized(false);
      setTab('trail');
      setPendingTrailId(externalTrailId.id);
    }
  }, [externalTrailId]);

  const handleShowTrail = useCallback((entityId, trail) => {
    if (!viewer || viewer.isDestroyed()) return;
    const Cesium = window.Cesium;
    if (!Cesium) return;
    const existing = viewer.entities.getById('__history_trail__');
    if (existing) viewer.entities.remove(existing);
    if (!trail || trail.length < 2) return;
    const positions = trail.filter(p => p.lat != null && p.lon != null)
      .map(p => Cesium.Cartesian3.fromDegrees(p.lon, p.lat, (p.altitude || 0)));
    if (positions.length < 2) return;
    viewer.entities.add({
      id: '__history_trail__',
      polyline: {
        positions, width: 3,
        material: new Cesium.PolylineGlowMaterialProperty({ glowPower: 0.15, color: Cesium.Color.MAGENTA.withAlpha(0.8) }),
        clampToGround: false,
      },
    });
    const mid = trail[Math.floor(trail.length / 2)];
    viewer.camera.flyTo({ destination: Cesium.Cartesian3.fromDegrees(mid.lon, mid.lat, 2_000_000), duration: 1.5 });
  }, [viewer]);

  const handleClose = useCallback(() => {
    setOpen(false);
    setMinimized(true);
    if (viewer && !viewer.isDestroyed()) {
      const e = viewer.entities.getById('__history_trail__');
      if (e) viewer.entities.remove(e);
    }
  }, [viewer]);

  const handleFlyTo = useCallback((target) => {
    if (!viewer || viewer.isDestroyed() || !target?.lat || !target?.lon) return;
    const Cesium = window.Cesium;
    viewer.camera.flyTo({ destination: Cesium.Cartesian3.fromDegrees(target.lon, target.lat, 2_000_000), duration: 1.5 });
  }, [viewer]);

  // ── Closed state: simple button ──
  if (!open) {
    return (
      <button onClick={() => { setOpen(true); setMinimized(false); }}
        className="hud-btn text-xs px-3 py-2 min-h-[36px] font-bold bg-[rgba(5,8,16,0.82)] backdrop-blur-sm hover:bg-[rgba(5,8,16,0.95)] select-none"
        title="Intelligence Dashboard">
        <span className="pointer-events-none">📊 INTEL</span>
      </button>
    );
  }

  const tabs = [
    { id: 'overview', label: 'OVERVIEW', icon: '📊' },
    { id: 'alerts',   label: 'ALERTS',   icon: '⚠' },
    { id: 'events',   label: 'EVENTS',   icon: '⚔' },
    { id: 'news',     label: 'NEWS',     icon: '📰' },
    { id: 'intel',    label: 'AI INTEL', icon: '🤖' },
    { id: 'trail',    label: 'TRAIL',    icon: '📍' },
  ];

  // ── Minimized state: bottom-right compact widget ──
  if (minimized) {
    const widget = (
      <div className="fixed z-[52] pointer-events-auto" style={{ bottom: isMobile ? 72 : 16, right: isMobile ? 8 : 16 }}>
        <div className="bg-[rgba(5,8,16,0.96)] border border-white/15 rounded-lg shadow-2xl backdrop-blur-lg" style={{ width: isMobile ? 'calc(100vw - 16px)' : 380 }}>
          <div className="flex items-center justify-between px-3 py-2 border-b border-white/10">
            <span className="text-[11px] font-mono font-bold text-[#00ff88] tracking-wider">📊 INTEL DASHBOARD</span>
            <div className="flex gap-1">
              <button onClick={() => setMinimized(false)}
                className="w-6 h-6 flex items-center justify-center rounded hover:bg-white/10 text-white/50 hover:text-white text-xs transition-colors" title="Maximize">⬜</button>
              <button onClick={handleClose}
                className="w-6 h-6 flex items-center justify-center rounded hover:bg-red-500/20 text-white/50 hover:text-red-400 text-sm transition-colors">✕</button>
            </div>
          </div>
          <div className="flex border-b border-white/10 overflow-x-auto scrollbar-none">
            {tabs.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`shrink-0 px-2.5 py-1.5 text-[9px] font-mono font-bold transition-all select-none whitespace-nowrap ${
                  tab === t.id ? 'text-[#00ff88] border-b-2 border-[#00ff88] bg-[#00ff88]/5' : 'text-white/40 hover:text-white/60 border-b-2 border-transparent'}`}>
                {t.icon} {t.label}
              </button>
            ))}
          </div>
          <div className="max-h-[50vh] overflow-y-auto px-3 py-2.5 scrollbar-thin">
            {tab === 'overview' && <OverviewTab hours={hours} onFlyTo={handleFlyTo} />}
            {tab === 'alerts' && <AlertsTab onFlyTo={handleFlyTo} />}
            {tab === 'events' && <EventsTab onFlyTo={handleFlyTo} />}
            {tab === 'news' && <NewsTab onFlyTo={handleFlyTo} />}
            {tab === 'intel' && <IntelTab />}
            {tab === 'trail' && <TrailTab onShowTrail={handleShowTrail} viewer={viewer} pendingTrailId={pendingTrailId} onPendingConsumed={() => setPendingTrailId(null)} />}
          </div>
        </div>
      </div>
    );
    return createPortal(widget, document.body);
  }

  // ── Maximized state: centered full modal ──
  const modal = (
    <div className="fixed inset-0 z-[60] flex items-center justify-center pointer-events-auto" style={{ background: 'rgba(0,0,0,0.6)' }}
      onClick={e => { if (e.target === e.currentTarget) setMinimized(true); }}>
      <div className="bg-[rgba(5,8,16,0.98)] border border-white/15 rounded-xl shadow-2xl backdrop-blur-xl flex flex-col"
        style={{ width: isMobile ? 'calc(100vw - 16px)' : 'min(96vw, 1280px)', height: isMobile ? 'calc(100vh - 32px)' : 'min(92vh, 900px)' }}
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-sm font-mono font-bold text-[#00ff88] tracking-wider">📊 INTELLIGENCE DASHBOARD</span>
            <HudSelect value={hours} onChange={e => setHours(+e.target.value)} className="ml-2">
              <option value={6}>6h</option><option value={12}>12h</option><option value={24}>24h</option><option value={48}>48h</option><option value={168}>7d</option><option value={336}>14d</option>
            </HudSelect>
          </div>
          <div className="flex gap-1.5">
            <button onClick={() => setMinimized(true)}
              className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-white/10 text-white/50 hover:text-[#ffb300] text-xs transition-colors" title="Minimize">▄</button>
            <button onClick={handleClose}
              className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-red-500/20 text-white/50 hover:text-red-400 text-sm transition-colors" title="Close">✕</button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-white/10 px-2 shrink-0 overflow-x-auto scrollbar-none">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`shrink-0 px-4 py-2.5 text-[11px] font-mono font-bold transition-all select-none whitespace-nowrap ${
                tab === t.id ? 'text-[#00ff88] border-b-2 border-[#00ff88] bg-[#00ff88]/5' : 'text-white/40 hover:text-white/60 border-b-2 border-transparent hover:bg-white/3'}`}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {/* Content — scrollable */}
        <div className="flex-1 overflow-y-auto px-4 py-4 scrollbar-thin">
          {tab === 'overview' && <OverviewTab hours={hours} onFlyTo={handleFlyTo} />}
          {tab === 'alerts' && <AlertsTab onFlyTo={handleFlyTo} />}
          {tab === 'events' && <EventsTab onFlyTo={handleFlyTo} />}
          {tab === 'news' && <NewsTab onFlyTo={handleFlyTo} />}
          {tab === 'intel' && <IntelTab />}
          {tab === 'trail' && <TrailTab onShowTrail={handleShowTrail} viewer={viewer} pendingTrailId={pendingTrailId} onPendingConsumed={() => setPendingTrailId(null)} />}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-2 border-t border-white/10 shrink-0">
          <span className="text-[9px] font-mono text-white/20">LiveWar3D Intelligence · Data from Supabase PostgreSQL</span>
          <span className="text-[9px] font-mono text-white/20">Window: {hours}h · {new Date().toISOString().slice(0, 16)}Z</span>
        </div>
      </div>
    </div>
  );
  return createPortal(modal, document.body);
};

export default memo(HistoryPanel);
