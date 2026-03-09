/**
 * CameraModal – live viewer for conflict-zone cameras.
 * Displays an iframe (YouTube, panomax, EarthCam) or auto-refreshing snapshot image.
 */

import React, { useState, useEffect, useRef } from 'react';

const ZONE_LABELS = {
  ukraine:       'Ukraine Conflict Zone',
  lebanon:       'Israel–Lebanon Front',
  taiwan_strait: 'Taiwan Strait',
  south_cs:      'South China Sea',
  red_sea:       'Red Sea / Horn of Africa',
  persiangulf:   'Persian Gulf',
  bosphorus:     'Bosphorus / Dardanelles',
  korea:         'Korean Peninsula',
  baltic:        'Baltic – NATO Frontier',
  black_sea:     'Black Sea Operations',
};

const ZONE_COLORS = {
  ukraine:       '#ff6600',
  lebanon:       '#ff2222',
  taiwan_strait: '#ffaa00',
  south_cs:      '#ffaa00',
  red_sea:       '#ff6600',
  persiangulf:   '#ff2222',
  bosphorus:     '#00bfff',
  korea:         '#ff4488',
  baltic:        '#44aaff',
  black_sea:     '#00bcd4',
};

const CameraModal = ({ camera, onClose }) => {
  const [imgError, setImgError] = useState(false);
  const [imgTs, setImgTs] = useState(Date.now());
  const intervalRef = useRef(null);

  // Auto-refresh IMAGE type every 5 s
  useEffect(() => {
    setImgError(false);
    setImgTs(Date.now());
    if (camera?.feedType === 'IMAGE') {
      intervalRef.current = setInterval(() => setImgTs(Date.now()), 5000);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [camera]);

  if (!camera) return null;

  const zoneColor = ZONE_COLORS[camera.conflictZone] || '#00e5ff';
  const zoneLabel = ZONE_LABELS[camera.conflictZone] || camera.conflictZone;
  const isImage   = camera.feedType === 'IMAGE';

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="relative flex flex-col rounded-lg overflow-hidden"
        style={{
          width: 'min(92vw, 860px)',
          background: 'rgba(5,8,16,0.97)',
          border: `1px solid ${zoneColor}55`,
          boxShadow: `0 0 32px ${zoneColor}22`,
        }}
      >
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div
          className="flex items-center gap-3 px-4 py-2.5"
          style={{ borderBottom: `1px solid ${zoneColor}33`, background: 'rgba(0,0,0,0.4)' }}
        >
          {/* Camera icon */}
          <span className="text-lg" style={{ color: '#00e5ff' }}>📷</span>

          <div className="flex-1 min-w-0">
            <div className="font-mono font-bold text-sm text-white truncate">{camera.name}</div>
            <div className="font-mono text-xs" style={{ color: zoneColor }}>
              {zoneLabel} · {camera.location}
            </div>
          </div>

          {/* Live badge */}
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span className="text-red-400 font-mono font-bold text-xs tracking-wider">LIVE</span>
          </div>

          {/* Close */}
          <button
            onClick={onClose}
            className="text-hud-text hover:text-white text-lg font-bold leading-none ml-2 transition-colors"
            title="Close"
          >&times;</button>
        </div>

        {/* ── Feed area ──────────────────────────────────────────────────── */}
        <div className="relative" style={{ aspectRatio: '16/9', background: '#000' }}>
          {isImage ? (
            imgError ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                <span className="text-4xl">📡</span>
                <p className="text-hud-text font-mono text-sm text-center px-4">
                  Feed temporarily unavailable<br />
                  <span className="text-hud-text/40 text-xs">Stream may be offline or geo-restricted</span>
                </p>
              </div>
            ) : (
              <img
                key={imgTs}
                src={`${camera.feedUrl}&_t=${imgTs}`}
                alt={camera.name}
                className="w-full h-full object-contain"
                onError={() => setImgError(true)}
                style={{ display: 'block' }}
              />
            )
          ) : (
            <iframe
              src={camera.feedUrl}
              title={camera.name}
              className="w-full h-full border-0"
              allow="autoplay; fullscreen"
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
              referrerPolicy="no-referrer"
            />
          )}
        </div>

        {/* ── Footer ─────────────────────────────────────────────────────── */}
        <div
          className="flex items-center justify-between px-4 py-2 text-xs font-mono"
          style={{ borderTop: `1px solid ${zoneColor}22`, background: 'rgba(0,0,0,0.3)' }}
        >
          <div className="text-hud-text/60">
            {camera.lat.toFixed(4)}°N {camera.lon.toFixed(4)}°E
            {isImage && <span className="ml-2 text-hud-green">↻ 5s refresh</span>}
          </div>
          <div className="font-mono text-xs" style={{ color: zoneColor }}>
            {zoneLabel}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CameraModal;
