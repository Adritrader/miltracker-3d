/**
 * TrackingPanel – horizontal bottom strip, sits just above the NewsPanel.
 * Collapsed = 40px bar with horizontal entity pills.
 * Expanded = cards row above the bar.
 *
 * Layout stack (bottom → top):
 *   0–28px   CoordinateHUD
 *  28–68px   NewsPanel (collapsed)
 *  68–108px  TrackingPanel (collapsed)
 * 108px+     Globe / MapLayerSwitcher
 */
import React, { useState, useRef, useEffect, useMemo } from 'react';
import * as Cesium from 'cesium';

const PANEL_H_COLL  = 40;   // collapsed pill-bar height
const CARD_H        = 88;   // approx expanded card height

const TrackingPanel = ({ trackedList, aircraft, ships, viewer, onUntrack, onUntrackAll, isMobile = false, onHeightChange, newsPanelHeight = 40 }) => {
  const [expanded, setExpanded] = useState(false);
  const panelRef = useRef(null);

  // Report rendered height to parent so Timeline can move above us
  useEffect(() => {
    if (!panelRef.current || !onHeightChange) return;
    const ro = new ResizeObserver(entries => {
      for (const e of entries) onHeightChange(e.contentRect.height);
    });
    ro.observe(panelRef.current);
    return () => { ro.disconnect(); onHeightChange(0); };
  }, [onHeightChange]);

  // Must be called BEFORE any early return so hook call count is consistent every render
  const entries = useMemo(() => {
    if (!trackedList || trackedList.size === 0) return [];
    return [...trackedList.entries()].map(([id, meta]) => {
      const type   = meta.type;
      const entity = type === 'aircraft'
        ? aircraft.find(a => a.id === id || a.icao24 === id)
        : ships.find(s => (s.mmsi || s.id) === id);
      return { id, type, entity };
    });
  }, [trackedList, aircraft, ships]);

  if (!trackedList || trackedList.size === 0) return null;

  const flyTo = (entity, type) => {
    if (!viewer || !entity?.lat || !entity?.lon) return;
    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(
        entity.lon, entity.lat,
        type === 'aircraft' ? 160_000 : 250_000,
      ),
      orientation: { heading: 0, pitch: Cesium.Math.toRadians(-90), roll: 0 },
      duration: 1.5,
    });
  };

  return (
    <div
      ref={panelRef}
      className="fixed left-0 right-0"
      style={{ bottom: 28 + newsPanelHeight, zIndex: 38, transition: 'bottom 0.3s ease' }}
    >
      {/* ── Expanded cards –– open upward ───────────────────────── */}
      {expanded && (
        <div
          className="hud-panel overflow-x-auto"
          style={{
            borderRadius: 0,
            borderBottom: 'none',
            background: 'rgba(5,8,16,0.93)',
          }}
        >
          <div
            className="flex gap-2 px-3 py-2"
            style={{ minWidth: 'max-content' }}
          >
            {entries.map(({ id, type, entity }) => {
              const label  = entity?.callsign || entity?.name || id;
              const altFt  = type === 'aircraft' && entity
                ? (entity.altitudeFt ?? Math.round((entity.altitude || 0) * 3.28084))
                : null;
              const speed  = entity ? Math.round(entity.velocity || 0) : null;
              const hdg    = entity ? Math.round(entity.heading  || 0) : null;
              const alive  = !!entity;
              const acColor = type === 'aircraft' ? '#00ff88' : '#00aaff';

              return (
                <div
                  key={id}
                  className="flex flex-col gap-1 px-3 py-2 rounded"
                  style={{
                    minWidth: isMobile ? 140 : 170,
                    border: `1px solid ${acColor}33`,
                    background: `${acColor}08`,
                  }}
                >
                  {/* Header */}
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold" style={{ color: acColor }}>
                      {type === 'aircraft' ? '▲' : '▬'}
                    </span>
                    <span className={`font-mono font-bold text-xs truncate flex-1 ${alive ? 'text-white' : 'text-hud-text/40'}`}>
                      {label}
                    </span>
                    {!alive && <span className="text-yellow-600 text-xs font-mono">LOST</span>}
                    <button
                      onClick={() => onUntrack(id)}
                      className="text-hud-text hover:text-red-400 text-xs font-bold pl-1 transition-colors"
                    >&times;</button>
                  </div>

                  {/* Telemetry */}
                  {alive && (
                    <div className="flex gap-2 text-xs font-mono flex-wrap">
                      {altFt != null && (
                        <span className="text-hud-amber font-bold">
                          {entity.on_ground ? 'GND' : `${Math.round(altFt / 100) * 100}ft`}
                        </span>
                      )}
                      {speed != null && (
                        <span className="text-hud-green">
                          {speed}{type === 'aircraft' ? 'kt' : 'kn'}
                        </span>
                      )}
                      {hdg != null && (
                        <span className="text-hud-text">{hdg}&deg;</span>
                      )}
                    </div>
                  )}

                  {/* FLY TO */}
                  <button
                    onClick={() => flyTo(entity, type)}
                    disabled={!alive}
                    className="text-xs font-mono font-bold px-2 py-0.5 rounded border transition-colors
                      bg-hud-accent/10 border-hud-accent/40 text-hud-accent hover:bg-hud-accent/25
                      disabled:opacity-25 disabled:cursor-not-allowed w-full text-center mt-auto"
                  >
                    &#x25B6; FLY TO
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Collapsed pill bar ────────────────────────────────────── */}
      <div
        className="hud-panel flex items-center gap-2 px-3"
        style={{
          height: PANEL_H_COLL,
          borderRadius: 0,
          borderColor: '#4af76644',
          borderTop: '1px solid #4af76644',
          background: 'rgba(5,8,16,0.92)',
        }}
      >
        {/* Label + expand toggle */}
        <button
          className="flex items-center gap-1.5 shrink-0 select-none focus:outline-none"
          onClick={() => setExpanded(e => !e)}
        >
          <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          <span className="text-green-400 font-mono font-bold text-xs tracking-widest hidden sm:inline">TRACKING</span>
          <span className="bg-green-800/80 text-green-200 rounded px-1.5 text-xs font-mono font-bold">
            {trackedList.size}
          </span>
          <span className="text-hud-text/60 text-xs ml-0.5">{expanded ? '▼' : '▲'}</span>
        </button>

        {/* Divider */}
        <div className="w-px h-5 bg-hud-border/50 shrink-0" />

        {/* Horizontal scrollable pills */}
        <div
          className="flex-1 flex gap-2 overflow-x-auto"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {entries.map(({ id, type, entity }) => {
            const label  = entity?.callsign || entity?.name || id;
            const altFt  = type === 'aircraft' && entity
              ? (entity.altitudeFt ?? Math.round((entity.altitude || 0) * 3.28084))
              : null;
            const speed  = entity ? Math.round(entity.velocity || 0) : null;
            const alive  = !!entity;
            const acColor = type === 'aircraft' ? '#00ff88' : '#00aaff';

            return (
              <div
                key={id}
                className="flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-mono shrink-0"
                style={{ border: `1px solid ${acColor}44`, background: `${acColor}0d` }}
              >
                <span style={{ color: acColor }}>{type === 'aircraft' ? '▲' : '▬'}</span>
                <span className={`font-bold ${alive ? 'text-white' : 'text-hud-text/40'}`}
                  style={{ maxWidth: isMobile ? 72 : 90, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {label}
                </span>
                {alive && altFt != null && (
                  <span className="text-hud-amber hidden sm:inline">
                    {entity.on_ground ? 'GND' : `${Math.round(altFt / 100) * 100}ft`}
                  </span>
                )}
                {alive && speed != null && (
                  <span className="text-hud-green hidden md:inline">
                    {speed}{type === 'aircraft' ? 'kt' : 'kn'}
                  </span>
                )}
                {/* FLY TO icon */}
                <button
                  onClick={() => flyTo(entity, type)}
                  disabled={!alive}
                  className="text-hud-text hover:text-hud-accent transition-colors disabled:opacity-25"
                  title="Fly to"
                >&#x25B6;</button>
                {/* Untrack */}
                <button
                  onClick={() => onUntrack(id)}
                  className="text-hud-text hover:text-red-400 font-bold transition-colors"
                  title="Stop tracking"
                >&times;</button>
              </div>
            );
          })}
        </div>

        {/* Clear all (desktop only if > 1) */}
        {trackedList.size > 1 && (
          <button
            onClick={() => { onUntrackAll?.(); setExpanded(false); }}
            className="shrink-0 text-hud-text hover:text-red-400 text-xs font-mono border border-hud-border/40
              px-2 py-0.5 rounded transition-colors hidden sm:block"
            title="Untrack all"
          >CLR</button>
        )}
      </div>
    </div>
  );
};

export default TrackingPanel;
