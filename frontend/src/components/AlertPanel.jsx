/**
 * AlertPanel – sliding panel showing AI danger alerts on the right side
 */

import React, { useState, useEffect, useRef } from 'react';
import * as Cesium from 'cesium';
import { timeAgo } from '../utils/geoUtils.js';

const SEVERITY_CONFIG = {
  critical: { label: 'CRITICAL', bg: 'bg-red-950/80',     border: 'border-red-700',    text: 'text-red-400',    dot: '#ff3b3b' },
  high:     { label: 'HIGH',     bg: 'bg-orange-950/80',  border: 'border-orange-700', text: 'text-orange-400', dot: '#fb923c' },
  medium:   { label: 'MED',      bg: 'bg-yellow-950/80',  border: 'border-yellow-700', text: 'text-yellow-400', dot: '#facc15' },
  low:      { label: 'LOW',      bg: 'bg-green-950/80',   border: 'border-green-800',  text: 'text-green-400',  dot: '#00ff88' },
};

const CRED_COLOR = (pct) => pct >= 70 ? '#00ff88' : pct >= 45 ? '#ffaa00' : '#ff6666';

const AlertItem = ({ alert, onFlyTo }) => {
  const cfg = SEVERITY_CONFIG[alert.severity] || SEVERITY_CONFIG.low;
  const hasGeo = alert.lat != null && alert.lon != null;
  const cred = alert.credibility ?? null;

  return (
    <div
      className={`${cfg.bg} border ${cfg.border} rounded p-2 mb-1.5
                  ${alert.severity === 'critical' ? 'glow-critical' : ''}`}
    >
      <div className="flex items-start gap-1.5">
        <span className="text-[10px] leading-none mt-0.5 font-bold shrink-0" style={{ color: cfg.dot }}>■</span>
        <div className="flex-1 min-w-0">
          {/* Title row */}
          <div className="flex items-start justify-between gap-1">
            <span className={`${cfg.text} text-[10px] font-mono font-bold uppercase leading-tight`}>
              [{cfg.label}]&nbsp;{alert.title}
            </span>
            <span className="text-hud-text text-[10px] shrink-0 ml-1">{timeAgo(alert.timestamp)}</span>
          </div>

          {/* Date/time + source + credibility row */}
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            {alert.timestamp && (() => {
              const d = new Date(alert.timestamp);
              const dateStr = d.toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'2-digit', timeZone: 'UTC' });
              const timeStr = d.toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit', timeZone: 'UTC' });
              return (
                <span className="text-hud-amber text-[10px] font-mono font-bold tracking-wider">
                  {dateStr}&nbsp;{timeStr}
                </span>
              );
            })()}
            {alert.source && (
              <span className="text-hud-green text-[10px] font-mono">{alert.source}</span>
            )}
            {cred != null && (
              <span
                className="text-[10px] font-mono font-bold px-1 py-0.5 rounded"
                style={{ color: CRED_COLOR(cred), background: 'rgba(0,0,0,0.4)' }}
                title={alert.credibilityReasons?.join(' · ') || 'Cross-referenced credibility'}
              >
                {cred}%
              </span>
            )}
          </div>

          {/* Description */}
          {alert.message && alert.message !== alert.title && (
            <p className="text-hud-text text-[10px] mt-0.5 leading-relaxed line-clamp-2">{alert.message}</p>
          )}

          {/* Credibility reasons (if available) */}
          {alert.credibilityReasons?.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-0.5">
              {alert.credibilityReasons.map((r, i) => (
                <span key={i} className="text-[9px] font-mono text-hud-text bg-white/5 rounded px-1 py-0.5">✓ {r}</span>
              ))}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-3 mt-1">
            {hasGeo && (
              <button
                onClick={() => onFlyTo?.(alert)}
                className="text-hud-amber text-[10px] hover:text-white transition-colors"
              >
                ⊕ FLY TO
              </button>
            )}
            {alert.url && /^https?:\/\//i.test(alert.url) && (
              <a
                href={alert.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-hud-green text-[10px] hover:text-white transition-colors"
                onClick={e => e.stopPropagation()}
              >
                &#x2197; READ
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// ── Local SITREP generator — builds a military ops brief from alert data ──────
function generateSitrep(alerts) {
  const now = new Date();
  const counts = { critical: 0, high: 0, medium: 0, low: 0 };
  const regions = {};
  const types   = {};

  for (const a of alerts) {
    counts[a.severity] = (counts[a.severity] || 0) + 1;
    const src = a.source || 'Unknown';
    regions[src] = (regions[src] || 0) + 1;
    const t = (() => {
      const title = (a.title || '').toLowerCase();
      if (/missile|ballistic|rocket/.test(title))  return 'Missile Activity';
      if (/airstrike|air strike|bomb/.test(title)) return 'Air Strikes';
      if (/naval|warship|fleet/.test(title))       return 'Naval Ops';
      if (/drone|uav|uas/.test(title))             return 'Drone Ops';
      if (/troops|ground|infantry/.test(title))    return 'Ground Forces';
      if (/nuclear|cbrn/.test(title))              return 'CBRN Threat';
      if (/cyber|hack/.test(title))                return 'Cyber Ops';
      return 'General Conflict';
    })();
    types[t] = (types[t] || 0) + 1;
  }

  const threatLevel =
    counts.critical >= 3 ? 'CRITICAL — Immediate escalation risk' :
    counts.critical >= 1 ? 'HIGH — Active conflict situations' :
    counts.high >= 3     ? 'ELEVATED — Multiple hostile incidents' :
                           'MODERATE — Routine surveillance posture';

  const topTypes    = Object.entries(types).sort((a,b) => b[1]-a[1]).slice(0,4);
  const topRegions  = Object.entries(regions).sort((a,b) => b[1]-a[1]).slice(0,4);

  return { threatLevel, counts, topTypes, topRegions, total: alerts.length, asOf: now };
}

const SitrepView = ({ alerts, aiInsight }) => {
  const s = generateSitrep(alerts);
  const isCrit = s.counts.critical > 0;
  return (
    <div className="space-y-3 text-xs font-mono">
      {/* Header */}
      <div className="border border-hud-border/50 rounded p-2 bg-black/30">
        <div className="hud-label mb-0.5">SITUATION REPORT</div>
        <div className="text-hud-text text-[10px]">
          {s.asOf.toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric', timeZone: 'UTC' })}&nbsp;
          {s.asOf.toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit', timeZone: 'UTC' })} UTC
        </div>
      </div>

      {/* Threat level */}
      <div className={`p-2 rounded border ${isCrit ? 'border-red-600/60 bg-red-950/40' : 'border-hud-amber/40 bg-yellow-950/20'}`}>
        <div className="hud-label mb-0.5">OVERALL THREAT LEVEL</div>
        <div className={`font-bold ${isCrit ? 'text-red-400' : 'text-hud-amber'}`}>{s.threatLevel}</div>
      </div>

      {/* Alert counts */}
      <div>
        <div className="hud-label mb-1">INCIDENTS BY SEVERITY</div>
        <div className="grid grid-cols-2 gap-1">
          {[['CRITICAL', s.counts.critical,'text-red-400'],
            ['HIGH',     s.counts.high,    'text-orange-400'],
            ['MEDIUM',   s.counts.medium,  'text-yellow-400'],
            ['LOW',      s.counts.low,     'text-green-400']
          ].map(([label, count, cls]) => (
            <div key={label} className="flex justify-between border border-hud-border/30 rounded px-2 py-1">
              <span className={`${cls} font-bold`}>{label}</span>
              <span className="text-white">{count || 0}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Incident types */}
      {s.topTypes.length > 0 && (
        <div>
          <div className="hud-label mb-1">INCIDENT TYPES</div>
          {s.topTypes.map(([type, cnt]) => (
            <div key={type} className="flex justify-between text-hud-text py-0.5 border-b border-hud-border/20">
              <span className="text-hud-blue">&#x25B6; {type}</span>
              <span className="text-white font-bold">{cnt}</span>
            </div>
          ))}
        </div>
      )}

      {/* Sources */}
      {s.topRegions.length > 0 && (
        <div>
          <div className="hud-label mb-1">TOP SOURCES</div>
          {s.topRegions.map(([src, cnt]) => (
            <div key={src} className="flex justify-between text-hud-text py-0.5 border-b border-hud-border/20">
              <span className="text-hud-green truncate max-w-[160px]">{src}</span>
              <span className="text-white font-bold">{cnt}</span>
            </div>
          ))}
        </div>
      )}

      {/* Latest critical headlines */}
      {s.counts.critical > 0 && (
        <div>
          <div className="hud-label mb-1">LATEST CRITICAL EVENTS</div>
          {alerts.filter(a => a.severity === 'critical').slice(0,4).map((a) => (
            <div key={a.id} className="text-red-300 py-0.5 border-b border-red-900/30 text-[10px] leading-snug">
              &#x25A0; {a.title}
            </div>
          ))}
        </div>
      )}

      {/* AI assessment if available — removed (AI integration not active) */}

      <div className="text-hud-text text-[10px] text-right">
        {s.total} total events tracked
      </div>
    </div>
  );
};

const AlertPanel = ({ alerts, hotspots = [], aiInsight, aiError = null, geminiEnabled = null, viewer, onFlyTo, isMobile = false, onOpenChange, onHeightChange }) => {
  const [open, setOpen] = useState(!isMobile);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const panelRef = useRef(null);

  // Notify parent when open state changes
  useEffect(() => { onOpenChange?.(open); }, [open, onOpenChange]);

  // Close drawer when switching to desktop
  useEffect(() => { if (!isMobile) setDrawerOpen(false); }, [isMobile]);

  // Measure panel height and report to parent so Timeline can move out of the way
  useEffect(() => {
    if (!panelRef.current || !onHeightChange) return;
    const ro = new ResizeObserver(entries => {
      for (const e of entries) onHeightChange(e.contentRect.height);
    });
    ro.observe(panelRef.current);
    return () => ro.disconnect();
  }, [onHeightChange]);
  const [tab, setTab] = useState('alerts'); // 'alerts' | 'sitrep' | 'ai'
  const [alertsExpanded, setAlertsExpanded] = useState(false);
  const [notifPerm, setNotifPerm] = useState(
    () => (typeof Notification !== 'undefined' ? Notification.permission : 'unsupported')
  );
  const seenAlertIds = useRef(new Set());

  // §10.3 — fire browser push notification for new CRITICAL alerts
  useEffect(() => {
    if (notifPerm !== 'granted') return;
    for (const alert of alerts) {
      if (alert.severity !== 'critical') continue;
      if (seenAlertIds.current.has(alert.id)) continue;
      seenAlertIds.current.add(alert.id);
      try {
        new Notification(`⚠ CRITICAL — ${alert.title}`, {
          body: alert.message || alert.source || '',
          icon: '/favicon.ico',
          tag:  alert.id, // deduplicates same alert across re-renders
        });
      } catch (_) {/* Safari / iframe sandbox */}
    }
  }, [alerts, notifPerm]);

  const requestNotifPermission = async () => {
    if (typeof Notification === 'undefined') return;
    const result = await Notification.requestPermission();
    setNotifPerm(result);
  };

  // Only show CRITICAL alerts
  const criticalAlerts = alerts.filter(a => a.severity === 'critical');
  const criticalCount  = criticalAlerts.length;
  const visibleAlerts  = alertsExpanded ? criticalAlerts : criticalAlerts.slice(0, 5);

  const flyToAlert = (alert) => {
    if (viewer && !viewer.isDestroyed() && alert.lat != null && alert.lon != null) {
      viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(alert.lon, alert.lat, 2_000_000),
        duration: 2,
      });
    }
    if (isMobile) setDrawerOpen(false);
    onFlyTo?.(alert);
  };

  /* ══════════════════════════════════════════════════════════
     Shared tab content (used by both mobile drawer and desktop panel)
  ══════════════════════════════════════════════════════════ */
  const TabContent = () => (
    <>
      {/* Tabs */}
      <div className="flex border-b border-hud-border" style={{ overflowX: 'hidden' }}>
        {['alerts', 'hotspots', 'sitrep'].map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-1.5 text-[10px] font-mono uppercase tracking-wide transition-colors
              ${tab === t ? 'text-hud-green border-b-2 border-hud-green' : 'text-hud-text hover:text-white'}`}
          >
            {t === 'alerts' ? `⚠ ${criticalCount}` : t === 'hotspots' ? `◉ ${hotspots.length}` : '≡ SITREP'}
          </button>
        ))}
      </div>

      <div className="p-2 overflow-y-auto" style={{ maxHeight: isMobile ? undefined : 'min(18rem, 38vh)' }}>
        {tab === 'alerts' && (
          criticalAlerts.length > 0
            ? (
              <>
                {visibleAlerts.map(a => (
                  <AlertItem key={a.id} alert={a} onFlyTo={flyToAlert} />
                ))}
                {criticalAlerts.length > 5 && (
                  <button
                    onClick={() => setAlertsExpanded(e => !e)}
                    className="w-full text-center text-[10px] font-mono text-hud-green hover:text-white py-1.5 border-t border-hud-border/40 mt-1 transition-colors"
                  >
                    {alertsExpanded
                      ? '▲ COLLAPSE'
                      : `▼ SEE ALL (${criticalAlerts.length})`}
                  </button>
                )}
              </>
            )
            : <div className="text-hud-text text-[10px] text-center py-4">No critical alerts</div>
        )}

        {tab === 'hotspots' && (
          hotspots.length > 0
            ? hotspots.map((h, i) => (
                <div
                  key={i}
                  className="border border-hud-border/40 rounded p-2 mb-1.5 cursor-pointer hover:border-hud-green/60 transition-colors"
                  onClick={() => flyToAlert({ lat: h.lat, lon: h.lon })}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-hud-amber text-[10px] font-mono font-bold uppercase">{h.label}</span>
                    <span className="text-white text-[10px] font-mono font-bold">{h.total} events</span>
                  </div>
                  <div className="flex gap-2 mt-1 flex-wrap">
                    {h.aircraft > 0 && <span className="text-hud-blue text-[9px] font-mono">▲ {h.aircraft} aircraft</span>}
                    {h.ships > 0 && <span className="text-hud-blue text-[9px] font-mono">▬ {h.ships} ships</span>}
                    {h.news > 0 && <span className="text-hud-amber text-[9px] font-mono">■ {h.news} news</span>}
                    {h.firms > 0 && <span className="text-red-400 text-[9px] font-mono">● {h.firms} thermal</span>}
                  </div>
                  <div className="text-hud-text text-[9px] mt-0.5">
                    ⊕ Click to fly to zone
                  </div>
                </div>
              ))
            : <div className="text-hud-text text-[10px] text-center py-4">Computing hotspots…</div>
        )}

        {tab === 'sitrep' && (
          alerts.length > 0
            ? <SitrepView alerts={alerts} />
            : <div className="text-hud-text text-[10px] text-center py-4">Waiting for alert data…</div>
        )}
      </div>
    </>
  );

  /* ══════════════════════════════════════════════════════════
     MOBILE — pill button (top-right) + right-side slide-in drawer
  ══════════════════════════════════════════════════════════ */
  if (isMobile) {
    return (
      <>
        {/* Alert pill button — top-right, mirrors hamburger on left */}
        <button
          onClick={() => setDrawerOpen(true)}
          className="fixed top-4 right-4 z-50 bg-hud-panel flex items-center gap-2 px-3 py-2 rounded-lg
                     border border-hud-border active:scale-95 transition-transform duration-100 select-none"
          aria-label="Open alerts"
        >
          <span className="text-red-400 text-xs">⚠</span>
          <span className="hud-label text-xs">ALERTS</span>
          {criticalCount > 0 && (
            <span className="bg-red-500 text-white text-[10px] font-bold font-mono rounded-full min-w-[16px] h-4
                             flex items-center justify-center px-1 leading-none animate-pulse">
              {criticalCount > 99 ? '99+' : criticalCount}
            </span>
          )}
          {/* §10.3 — notification bell */}
          {criticalCount > 0 && notifPerm === 'default' && (
            <button
              onClick={e => { e.stopPropagation(); requestNotifPermission(); }}
              title="Enable desktop notifications"
              className="text-hud-amber text-xs shrink-0 hover:text-white transition-colors"
            >🔔</button>
          )}
        </button>

        {/* Backdrop */}
        {drawerOpen && (
          <div
            className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-[1px]"
            onClick={() => setDrawerOpen(false)}
          />
        )}

        {/* Slide-in drawer from right */}
        <div
          className="fixed top-0 right-0 bottom-0 z-[70] w-72 flex flex-col
                     transition-transform duration-300 ease-in-out"
          style={{
            background: 'rgba(5,10,18,0.97)',
            borderLeft: '1px solid rgba(255,60,60,0.25)',
            transform: drawerOpen ? 'translateX(0)' : 'translateX(100%)',
          }}
        >
          {/* Drawer header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-hud-border/40 shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-red-400 text-sm">⚠</span>
              <span className="hud-title text-sm">INTEL ALERTS</span>
              {criticalCount > 0 && (
                <span className="bg-red-600 text-white text-[10px] px-1.5 py-0.5 rounded font-mono font-bold animate-pulse">
                  {criticalCount}
                </span>
              )}
            </div>
            <button
              onClick={() => setDrawerOpen(false)}
              className="text-hud-text hover:text-red-400 text-lg leading-none ml-2 transition-colors duration-150"
              aria-label="Close alerts"
            >✕</button>
          </div>

          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto">
            <div className="hud-panel m-0 border-0 rounded-none">
              <TabContent />
            </div>
          </div>
        </div>
      </>
    );
  }

  /* ══════════════════════════════════════════════════════════
     DESKTOP — original fixed panel (top-right)
  ══════════════════════════════════════════════════════════ */
  return (
    <div
      ref={panelRef}
      className="fixed z-50 transition-all duration-300"
      style={{
        top: 60,
        right: 16,
        maxWidth: 320,
        width: open ? 320 : 'auto',
      }}
    >
      {/* Header toggle */}
      <div
        className="hud-panel px-3 py-2 flex items-center justify-between cursor-pointer mb-1"
        onClick={() => setOpen(!open)}
      >
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-red-400 text-xs shrink-0">⚠</span>
          <span className="hud-title truncate">INTEL ALERTS</span>
          {criticalCount > 0 && (
            <span className="bg-red-600 text-white text-[10px] px-1 py-0.5 rounded font-mono font-bold animate-pulse shrink-0">
              {criticalCount} CRITICAL
            </span>
          )}
          {/* §10.3 — notification bell */}
          {criticalCount > 0 && notifPerm === 'default' && (
            <button
              onClick={e => { e.stopPropagation(); requestNotifPermission(); }}
              title="Enable desktop notifications for critical alerts"
              className="text-hud-amber text-xs shrink-0 hover:text-white transition-colors"
            >
              🔔
            </button>
          )}
          {notifPerm === 'granted' && criticalCount > 0 && (
            <span title="Desktop notifications ON" className="text-hud-green text-[10px] shrink-0">🔔</span>
          )}
        </div>
        <span className="text-hud-text text-xs">{open ? '▲' : '▼'}</span>
      </div>

      {open && (
        <div className="hud-panel animate-fade-in">
          <TabContent />
        </div>
      )}
    </div>
  );
};

const THREAT_COLORS = {
  CRITICAL: 'text-red-400', HIGH: 'text-orange-400',
  MEDIUM: 'text-yellow-400', LOW: 'text-hud-green',
};

const AIInsightView = ({ insight }) => (
  <div className="space-y-2 text-[10px] font-mono">
    <div className="flex items-center gap-2">
      <span className="hud-label">THREAT LEVEL</span>
      <span className={`font-bold ${THREAT_COLORS[insight.threatLevel] || 'text-white'}`}>
        {insight.threatLevel}
      </span>
    </div>
    <div className="border-t border-hud-border pt-2">
      <div className="hud-label mb-1">ASSESSMENT</div>
      <p className="text-hud-text leading-relaxed">{insight.summary}</p>
    </div>
    {insight.hotspots?.length > 0 && (
      <div className="border-t border-hud-border pt-2">
        <div className="hud-label mb-1">HOTSPOTS</div>
        {insight.hotspots.map((h, i) => (
          <div key={i} className="flex gap-1 text-hud-amber">
            <span>▶</span>
            <span>{h.location}: {h.reason}</span>
          </div>
        ))}
      </div>
    )}
    {insight.recommendations?.length > 0 && (
      <div className="border-t border-hud-border pt-2">
        <div className="hud-label mb-1">WATCH LIST</div>
        {insight.recommendations.map((r, i) => (
          <div key={i} className="flex gap-1 text-hud-text">
            <span className="text-hud-green">•</span>
            <span>{r}</span>
          </div>
        ))}
      </div>
    )}
    <div className="text-hud-text text-[10px] pt-1">
      Source: {insight.source} · {timeAgo(insight.timestamp)}
    </div>
  </div>
);

export default AlertPanel;
