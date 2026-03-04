/**
 * TrackingPanel – multi-entity tracking HUD
 * Sits on the right edge (vertically centred) and never overlaps top/bottom bars.
 * Each tracked entity shows live telemetry + FLY TO + UNTRACK.
 */
import React, { useState } from 'react';
import * as Cesium from 'cesium';
import { headingToCompass } from '../utils/geoUtils.js';

const TrackingPanel = ({ trackedList, aircraft, ships, viewer, onUntrack, onUntrackAll, isMobile = false }) => {
  const [open, setOpen] = useState(true);

  if (!trackedList || trackedList.size === 0) return null;

  const flyTo = (entity, type) => {
    if (!viewer || !entity?.lat || !entity?.lon) return;
    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(
        entity.lon, entity.lat,
        type === 'aircraft' ? 160_000 : 250_000
      ),
      // pitch -90° = top-down → entity is exactly at screen centre
      orientation: { heading: 0, pitch: Cesium.Math.toRadians(-90), roll: 0 },
      duration: 1.5,
    });
  };

  const entries = [...trackedList.entries()].map(([id, meta]) => {
    const type = meta.type;
    const entity =
      type === 'aircraft'
        ? aircraft.find(a => a.id === id || a.icao24 === id)
        : ships.find(s => (s.mmsi || s.id) === id);
    return { id, type, entity };
  });

  return (
    <div
      className="fixed z-30"
      style={{
        right: isMobile ? 8 : 16,
        top: '50%',
        transform: 'translateY(-50%)',
        maxHeight: 'calc(100vh - 180px)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Toggle header */}
      <div
        className="hud-panel px-3 py-1.5 flex items-center gap-2 cursor-pointer select-none mb-0.5"
        style={{ borderColor: '#4af766', borderRadius: '4px 4px 0 0' }}
        onClick={() => setOpen(o => !o)}
      >
        <span className="inline-block w-2 h-2 rounded-full bg-green-400 animate-pulse flex-shrink-0" />
        <span className="text-green-400 font-mono font-bold text-xs tracking-widest">TRACKING</span>
        <span className="ml-1 bg-green-700 text-green-200 rounded px-1.5 text-xs font-mono font-bold">
          {trackedList.size}
        </span>
        <span className="ml-auto text-hud-text text-xs">{open ? '▲' : '▼'}</span>
        {open && trackedList.size > 1 && (
          <button
            onClick={e => { e.stopPropagation(); onUntrackAll?.(); }}
            className="text-hud-text hover:text-red-400 text-xs font-mono ml-1 transition-colors"
            title="Untrack all"
          >CLR</button>
        )}
      </div>

      {/* Entity list */}
      {open && (
        <div
          className="hud-panel overflow-y-auto"
          style={{ borderColor: '#4af766', borderRadius: '0 0 4px 4px', minWidth: isMobile ? 180 : 220 }}
        >
          {entries.map(({ id, type, entity }) => {
            const label = entity?.callsign || entity?.name || id;
            const altFt = type === 'aircraft' && entity
              ? (entity.altitudeFt ?? Math.round((entity.altitude || 0) * 3.28084))
              : null;
            const speed = entity ? Math.round(entity.velocity || 0) : null;
            const hdg   = entity ? Math.round(entity.heading  || 0) : null;
            const alive = !!entity;

            return (
              <div
                key={id}
                className="border-b border-hud-border/40 last:border-b-0"
              >
                {/* Entity name + type badge + untrack */}
                <div className="flex items-center gap-1.5 px-2 pt-1.5 pb-0.5">
                  <span className={`text-xs ${type === 'aircraft' ? 'text-hud-green' : 'text-hud-blue'}`}>
                    {type === 'aircraft' ? '▲' : '▬'}
                  </span>
                  <span className={`font-mono font-bold text-xs truncate flex-1 ${alive ? 'text-white' : 'text-hud-text/50'}`}
                    style={{ maxWidth: isMobile ? 90 : 120 }}>
                    {label}
                  </span>
                  {!alive && (
                    <span className="text-xs text-yellow-600 font-mono">LOST</span>
                  )}
                  <button
                    onClick={() => onUntrack(id)}
                    className="text-hud-text hover:text-red-400 font-bold text-xs transition-colors ml-auto pl-1"
                    title="Stop tracking"
                  >&times;</button>
                </div>

                {/* Telemetry row */}
                {alive && (
                  <div className="flex items-center gap-2 px-2 pb-1 text-xs font-mono">
                    {altFt != null && (
                      <span className="text-hud-amber font-bold">
                        {entity?.on_ground ? 'GND' : `${Math.round(altFt / 100) * 100}ft`}
                      </span>
                    )}
                    {speed != null && (
                      <span className="text-hud-green">
                        {speed}{type === 'aircraft' ? 'kt' : 'kn'}
                      </span>
                    )}
                    {hdg != null && (
                      <span className="text-hud-text">
                        {hdg}&deg;&nbsp;{headingToCompass(hdg)}
                      </span>
                    )}
                  </div>
                )}

                {/* FLY TO button */}
                <div className="px-2 pb-1.5">
                  <button
                    onClick={() => flyTo(entity, type)}
                    disabled={!alive}
                    className="w-full text-center text-xs font-mono font-bold px-2 py-0.5 rounded border transition-colors
                      bg-hud-accent/10 border-hud-accent/40 text-hud-accent hover:bg-hud-accent/25
                      disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    &#x1F4CD; FLY TO
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default TrackingPanel;
