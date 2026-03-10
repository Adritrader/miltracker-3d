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
import React, { useRef, useEffect, useMemo } from 'react';
import * as Cesium from 'cesium';

const PANEL_H = 40; // fixed pill-bar height

const TrackingPanel = ({ trackedList, aircraft, ships, viewer, onUntrack, onUntrackAll, isMobile = false, onHeightChange, newsPanelHeight = 40, speedUnit = 'kt', altUnit = 'ft' }) => {
  const panelRef = useRef(null);

  // Report rendered height to parent (Timeline, MapLayerSwitcher, SITREP).
  // The outer div is always in the DOM so panelRef.current is always set on mount.
  // ResizeObserver fires 0 when content is hidden, actual height when visible.
  useEffect(() => {
    if (!panelRef.current || !onHeightChange) return;
    const ro = new ResizeObserver(entries => {
      for (const e of entries) onHeightChange(Math.round(e.contentRect.height));
    });
    ro.observe(panelRef.current);
    onHeightChange(Math.round(panelRef.current.getBoundingClientRect().height));
    return () => { ro.disconnect(); };
  }, [onHeightChange]);  // stable ref — runs once on mount

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
      style={{ bottom: 28 + newsPanelHeight, zIndex: 38, transition: 'bottom 0.15s ease-out' }}
    >
      {/* Content only visible when tracking — outer div always in DOM for ResizeObserver */}
      {trackedList && trackedList.size > 0 && (<>
      {/* ── Pill bar ─────────────────────────────────────────────── */}
      <div
        className="hud-panel flex items-center gap-2 px-3"
        style={{
          height: PANEL_H,
          borderRadius: 0,
          borderColor: '#4af76644',
          borderTop: '1px solid #4af76644',
          background: 'rgba(5,8,16,0.92)',
        }}
      >
        {/* Label */}
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          <span className="text-green-400 font-mono font-bold text-xs tracking-widest hidden sm:inline">TRACKING</span>
          <span className="bg-green-800/80 text-green-200 rounded px-1.5 text-xs font-mono font-bold">
            {trackedList.size}
          </span>
        </div>

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
                    {entity.on_ground ? 'GND' : altUnit === 'm' ? `${Math.round(altFt / 3.28084)}m` : `${Math.round(altFt / 100) * 100}ft`}
                  </span>
                )}
                {alive && speed != null && (
                  <span className="text-hud-green hidden md:inline">
                    {type === 'aircraft' && speedUnit === 'kmh' ? `${Math.round(speed * 1.852)}km/h` : `${speed}${type === 'aircraft' ? 'kt' : 'kn'}`}
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
            onClick={() => onUntrackAll?.()}
            className="shrink-0 text-hud-text hover:text-red-400 text-xs font-mono border border-hud-border/40
              px-2 py-0.5 rounded transition-colors hidden sm:block"
            title="Untrack all"
          >CLR</button>
        )}
      </div>
      </>)}
    </div>
  );
};

export default TrackingPanel;
