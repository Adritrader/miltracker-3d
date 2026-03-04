/**
 * AlertPanel – sliding panel showing AI danger alerts on the right side
 */

import React, { useState } from 'react';
import * as Cesium from 'cesium';
import { timeAgo } from '../utils/geoUtils.js';

const SEVERITY_CONFIG = {
  critical: { label: 'CRITICAL', bg: 'bg-red-950/80',     border: 'border-red-700',    text: 'text-red-400',    dot: '#ff3b3b' },
  high:     { label: 'HIGH',     bg: 'bg-orange-950/80',  border: 'border-orange-700', text: 'text-orange-400', dot: '#fb923c' },
  medium:   { label: 'MED',      bg: 'bg-yellow-950/80',  border: 'border-yellow-700', text: 'text-yellow-400', dot: '#facc15' },
  low:      { label: 'LOW',      bg: 'bg-green-950/80',   border: 'border-green-800',  text: 'text-green-400',  dot: '#00ff88' },
};

const AlertItem = ({ alert, onFlyTo }) => {
  const cfg = SEVERITY_CONFIG[alert.severity] || SEVERITY_CONFIG.low;
  const hasGeo = alert.lat != null && alert.lon != null;

  return (
    <div
      className={`${cfg.bg} border ${cfg.border} rounded p-2 mb-1.5
                  ${alert.severity === 'critical' ? 'glow-critical' : ''}`}
    >
      <div className="flex items-start gap-1.5">
        <span className="text-xs leading-none mt-0.5 font-bold shrink-0" style={{ color: cfg.dot }}>■</span>
        <div className="flex-1 min-w-0">
          {/* Title row */}
          <div className="flex items-start justify-between gap-1">
            <span className={`${cfg.text} text-xs font-mono font-bold uppercase leading-tight`}>
              [{cfg.label}]&nbsp;{alert.title}
            </span>
            <span className="text-hud-text text-xs shrink-0 ml-1">{timeAgo(alert.timestamp)}</span>
          </div>

          {/* Date/time + source row */}
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            {alert.timestamp && (() => {
              const d = new Date(alert.timestamp);
              const dateStr = d.toLocaleDateString('es-ES', { day:'2-digit', month:'short', year:'2-digit' });
              const timeStr = d.toLocaleTimeString('es-ES', { hour:'2-digit', minute:'2-digit' });
              return (
                <span className="text-hud-amber text-xs font-mono font-bold tracking-wider">
                  {dateStr}&nbsp;{timeStr}
                </span>
              );
            })()}
            {alert.source && (
              <span className="text-hud-green text-xs font-mono">{alert.source}</span>
            )}
          </div>

          {/* Description */}
          {alert.message && alert.message !== alert.title && (
            <p className="text-hud-text text-xs mt-0.5 leading-relaxed line-clamp-2">{alert.message}</p>
          )}

          {/* Actions */}
          <div className="flex items-center gap-3 mt-1">
            {hasGeo && (
              <button
                onClick={() => onFlyTo?.(alert)}
                className="text-hud-amber text-xs hover:text-white transition-colors"
              >
                ⊕ FLY TO
              </button>
            )}
            {alert.url && (
              <a
                href={alert.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-hud-green text-xs hover:text-white transition-colors"
                onClick={e => e.stopPropagation()}
              >
                ↗ READ
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const AlertPanel = ({ alerts, aiInsight, viewer, onFlyTo, isMobile = false }) => {
  const [open, setOpen] = useState(!isMobile);
  const [tab, setTab] = useState('alerts'); // 'alerts' | 'ai'

  // Only show CRITICAL alerts
  const criticalAlerts = alerts.filter(a => a.severity === 'critical');
  const criticalCount  = criticalAlerts.length;

  const flyToAlert = (alert) => {
    if (viewer && !viewer.isDestroyed() && alert.lat != null && alert.lon != null) {
      viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(alert.lon, alert.lat, 2_000_000),
        duration: 2,
      });
    }
    onFlyTo?.(alert);
  };

  return (
    <div
      className="fixed top-4 z-50 transition-all duration-300"
      style={{
        right: isMobile ? 8 : 16,
        // On mobile: never go wider than 42vw so FilterPanel (left 48vw + gap) has room
        maxWidth: isMobile ? 'min(42vw, 220px)' : 320,
        width: isMobile ? undefined : (open ? 320 : 'auto'),
      }}
    >
      {/* Header toggle */}
      <div
        className="hud-panel px-3 py-2 flex items-center justify-between cursor-pointer mb-1"
        onClick={() => setOpen(!open)}
      >
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-red-400 text-sm shrink-0">⚠</span>
          <span className="hud-title truncate">{isMobile ? 'ALERTS' : 'INTEL ALERTS'}</span>
          {criticalCount > 0 && (
            <span className="bg-red-600 text-white text-xs px-1.5 py-0.5 rounded font-mono font-bold animate-pulse shrink-0">
              {criticalCount}{isMobile ? '' : ' CRITICAL'}
            </span>
          )}
        </div>
        <span className="text-hud-text text-sm">{open ? '▲' : '▼'}</span>
      </div>

      {open && (
        <div className="hud-panel animate-fade-in">
          {/* Tabs */}
          <div className="flex border-b border-hud-border" style={{ overflowX: 'hidden' }}>
            {['alerts', 'ai'].map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex-1 py-1.5 text-xs font-mono uppercase tracking-wide transition-colors
                  ${tab === t ? 'text-hud-green border-b-2 border-hud-green' : 'text-hud-text hover:text-white'}`}
              >
                {t === 'alerts'
                  ? (isMobile ? `⚠ ${criticalCount}` : `⚠ CRITICAL (${criticalCount})`)
                  : (isMobile ? '◈ AI' : '◈ AI INTEL')}
              </button>
            ))}
          </div>

          <div className="p-2 overflow-y-auto" style={{ maxHeight: 'min(28rem, 55vh)' }}>
            {tab === 'alerts' && (
              criticalAlerts.length > 0
                ? criticalAlerts.slice(0, 20).map(a => (
                    <AlertItem key={a.id} alert={a} onFlyTo={flyToAlert} />
                  ))
                : <div className="text-hud-text text-xs text-center py-4">No critical alerts</div>
            )}

            {tab === 'ai' && (
              aiInsight
                ? <AIInsightView insight={aiInsight} />
                : (
                  <div className="text-center py-4">
                    <div className="text-hud-text text-xs mb-2">AI analysis requires Gemini API key</div>
                    <div className="text-hud-text text-xs">Set GEMINI_API_KEY in backend .env</div>
                    <div className="text-hud-green text-xs mt-2">aistudio.google.com/app/apikey</div>
                  </div>
                )
            )}
          </div>
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
  <div className="space-y-2 text-xs font-mono">
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
    <div className="text-hud-text pt-1">
      Source: {insight.source} · {timeAgo(insight.timestamp)}
    </div>
  </div>
);

export default AlertPanel;
