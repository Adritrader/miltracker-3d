/**
 * CoordinateHUD – Bottom status bar
 * Shows: mouse lat/lon on globe · camera altitude · UTC clock · entity counts
 */

import React, { useEffect, useState, useRef, useCallback } from 'react';
import * as Cesium from 'cesium';

function fmtAlt(m) {
  if (!m || m <= 0) return '—';
  if (m >= 1_000_000) return `${(m / 1_000_000).toFixed(2)} Mm`;
  if (m >= 1_000)     return `${(m / 1_000).toFixed(0)} km`;
  return `${Math.round(m)} m`;
}

function fmtCoord(deg, posLabel, negLabel) {
  if (deg == null) return '—';
  const d = Math.abs(deg);
  const label = deg >= 0 ? posLabel : negLabel;
  return `${d.toFixed(4)}° ${label}`;
}

const Divider = () => <div className="coord-divider" />;

const Seg = ({ label, value, valueClass = 'text-hud-green', children }) => (
  <div className="flex items-center gap-2 px-3 h-full">
    {label && <span className="hud-label text-xs">{label}</span>}
    {value  && <span className={`font-mono text-xs font-bold ${valueClass}`}>{value}</span>}
    {children}
  </div>
);

const CoordinateHUD = ({ viewer, aircraft = [], ships = [], conflicts = [], connected = false, isMobile = false }) => {
  const [coords, setCoords]     = useState(null);   // { lat, lon }
  const [cameraAlt, setCamAlt]  = useState(null);
  const [utcTime, setUtcTime]   = useState('');
  const handlerRef = useRef(null);

  // UTC clock — 1s tick
  useEffect(() => {
    const tick = () => {
      const d = new Date();
      const hh = String(d.getUTCHours()).padStart(2, '0');
      const mm = String(d.getUTCMinutes()).padStart(2, '0');
      const ss = String(d.getUTCSeconds()).padStart(2, '0');
      setUtcTime(`${hh}:${mm}:${ss}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  // Cesium mouse coord + camera altitude
  useEffect(() => {
    if (!viewer || viewer.isDestroyed()) return;

    // Create our own handler so we don't stomp Globe3D's handler
    const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
    handlerRef.current = handler;

    handler.setInputAction((movement) => {
      if (!viewer || viewer.isDestroyed()) return;
      try {
        const ray = viewer.camera.getPickRay(movement.endPosition);
        if (ray) {
          const cartesian = viewer.scene.globe.pick(ray, viewer.scene);
          if (cartesian) {
            const carto = Cesium.Cartographic.fromCartesian(cartesian);
            setCoords({
              lat: Cesium.Math.toDegrees(carto.latitude),
              lon: Cesium.Math.toDegrees(carto.longitude),
            });
          }
        }
        setCamAlt(viewer.camera.positionCartographic.height);
      } catch (_) { /* viewer may be mid-render */ }
    }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

    return () => {
      if (handlerRef.current && !handlerRef.current.isDestroyed()) {
        handlerRef.current.destroy();
        handlerRef.current = null;
      }
    };
  }, [viewer]);

  // Reset camera to default view
  const resetCamera = useCallback(() => {
    if (!viewer || viewer.isDestroyed()) return;
    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(10, 40, 9_000_000),
      orientation: { heading: 0, pitch: -Cesium.Math.PI_OVER_TWO, roll: 0 },
      duration: 2,
    });
  }, [viewer]);

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-40 flex items-center"
      style={{
        height: '28px',
        background: 'rgba(5, 8, 16, 0.92)',
        backdropFilter: 'blur(6px)',
        borderTop: '1px solid rgba(30, 42, 58, 0.8)',
      }}
    >
      {/* Connection dot */}
      <div className="flex items-center gap-1.5 px-3 h-full border-r border-hud-border/50">
        <span
          className={`w-1.5 h-1.5 rounded-full shrink-0 ${connected ? 'bg-hud-green animate-blink' : 'bg-red-500'}`}
        />
        <span className="hud-label text-xs">{connected ? 'LIVE' : 'OFFLINE'}</span>
      </div>

      {/* Mouse cursor coordinates + camera altitude (desktop only) */}
      {!isMobile && (<>
        <Divider />
        <Seg label="CURSOR">
          <span className="font-mono text-xs text-hud-green">
            {coords ? fmtCoord(coords.lat, 'N', 'S') : '—'}
          </span>
          <span className="font-mono text-xs text-hud-green ml-1">
            {coords ? fmtCoord(coords.lon, 'E', 'W') : ''}
          </span>
        </Seg>
        <Divider />
        <Seg label="VIEW ALT" value={fmtAlt(cameraAlt)} valueClass="text-hud-blue" />
      </>)}

      {/* Entity counts */}
      <Divider />
      <div className="flex items-center gap-3 px-3 h-full">
        <span className="font-mono text-xs text-hud-text">
          ▲ <span className="text-hud-blue font-bold">{aircraft.length}</span>
        </span>
        <span className="font-mono text-xs text-hud-text">
          ▬ <span className="text-hud-blue font-bold">{ships.length}</span>
        </span>
        <span className="font-mono text-xs text-hud-text">
          ◆ <span className="text-orange-400 font-bold">{conflicts.length}</span>
        </span>
      </div>

      {/* Data source watermark (desktop only) */}
      {!isMobile && (
      <div className="flex-1 flex items-center justify-center h-full pointer-events-none select-none">
        <span className="text-hud-border text-xs font-mono opacity-50 tracking-wider">
          MILTRACKER 3D · PUBLIC SOURCES: ADSB.LOL / ADSB.FI / GDELT
        </span>
      </div>
      )}

      {/* Reset view button (desktop only) */}
      {!isMobile && (<>
        <Divider />
        <div className="px-2 h-full flex items-center">
          <button
            onClick={resetCamera}
            title="Reset camera to default view"
            className="hud-label text-xs px-2 py-0.5 rounded border border-hud-border/50
                       hover:border-hud-green hover:text-hud-green transition-colors duration-150"
          >
            ⊙ RESET
          </button>
        </div>
      </>)}

      {/* UTC Clock */}
      <Divider />
      <div className="flex items-center gap-2 px-3 h-full">
        <span className="hud-label text-xs">ZULU</span>
        <span className="font-mono text-xs text-hud-amber font-bold tracking-widest">
          {utcTime}Z
        </span>
      </div>
    </div>
  );
};

export default CoordinateHUD;
