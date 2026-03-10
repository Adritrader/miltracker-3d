/**
 * EntityPopup – HUD-style info panel for selected aircraft, ship, or news item
 * All logic pre-computed before JSX return to avoid IIFE-in-JSX issues.
 * v3 – no orphaned block-scope variables, no IIFEs in JSX
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import * as Cesium from 'cesium';
import {
  formatAltitude, formatSpeed, metersToFeet, msToKnots,
  headingToCompass, timeAgo
} from '../utils/geoUtils.js';
import { COUNTRY_FLAGS, icaoToCountry, getAircraftTypeName, resolveCountry, resolveAirport } from '../utils/militaryFilter.js';
import { PATTERNS } from '../utils/trajectoryAnalysis.js';
import {
  getAircraftImageUrl, getShipImageUrl, getBaseImageUrl, getConflictImageUrl, getCountryFallbackImage,
} from '../utils/mediaLookup.js';

const Row = ({ label, value, highlight }) => (
  <div className="flex justify-between items-center py-px border-b border-hud-border/40">
    <span className="hud-label text-[10px] sm:text-xs">{label}</span>
    <span className={`font-mono text-[10px] sm:text-xs font-bold ${highlight || 'text-white'}`}>{value ?? '—'}</span>
  </div>
);

/** Compact image banner shown at the top of every popup */
const EntityImage = ({ src, alt }) => {
  const [state, setState] = useState('loading'); // loading | ok | err
  useEffect(() => { setState('loading'); }, [src]);
  if (!src || state === 'err') return null;
  return (
    <div className="relative w-full overflow-hidden" style={{ height: 100 }}>
      {state === 'loading' && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60">
          <span className="text-hud-text text-xs font-mono animate-pulse">LOADING IMAGE…</span>
        </div>
      )}
      <img
        src={src}
        alt={alt}
        onLoad={() => setState('ok')}
        onError={() => setState('err')}
        className="w-full h-full"
        style={{
          objectFit: 'cover',
          objectPosition: 'center',
          display: state === 'loading' ? 'none' : 'block',
          filter: 'brightness(0.85) saturate(0.9)',
        }}
      />
      {/* scan-line overlay */}
      <div className="absolute inset-0 pointer-events-none"
        style={{ background: 'repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,0,0,0.15) 2px,rgba(0,0,0,0.15) 4px)' }}
      />
      {/* bottom vignette */}
      <div className="absolute bottom-0 left-0 right-0 h-8 pointer-events-none"
        style={{ background: 'linear-gradient(transparent, rgba(5,8,16,0.9))' }}
      />
    </div>
  );
};

const EntityPopup = ({ entity, viewer, onClose, isMobile = false, trackedList = null, onTrack, onUntrack, onSatellite, speedUnit = 'kt', onToggleSpeedUnit, altUnit = 'ft', onToggleAltUnit }) => {
  const panelRef  = useRef(null);
  const dragState = useRef({ active: false, startX: 0, startY: 0, startLeft: 0, startTop: 0 });
  const [pos, setPos] = useState(null); // null = centered, {left,top} = dragged
  const [dragging, setDragging] = useState(false);

  // Reset position when new entity is shown
  useEffect(() => { setPos(null); }, [entity]);

  const onDragStart = useCallback((e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    const rect = panelRef.current?.getBoundingClientRect();
    if (!rect) return;
    dragState.current = { active: true, startX: e.clientX, startY: e.clientY, startLeft: rect.left, startTop: rect.top };
    setDragging(true);
    const onMove = (me) => {
      if (!dragState.current.active) return;
      setPos({
        left: Math.max(0, dragState.current.startLeft + (me.clientX - dragState.current.startX)),
        top:  Math.max(70, dragState.current.startTop  + (me.clientY - dragState.current.startY)),
      });
    };
    const onUp = () => {
      dragState.current.active = false;
      setDragging(false);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, []);

  if (!entity) return null;

  // ── Entity type detection ─────────────────────────────────────────────────
  const isAircraft = entity.type === 'aircraft' || !!entity.icao24;
  const isShip     = entity.type_entity === 'ship' || !!entity.mmsi;
  const isConflict = entity.eventCategory === 'conflict' || entity.type === 'conflict';
  const isFirms    = entity.type === 'firms';
  const isBase     = entity.type === 'base';
  // B1: check entity.type === 'alert' explicitly; fall back to field presence for legacy data
  const isAlert    = !isAircraft && !isShip && !isConflict && !isFirms && !isBase &&
                     (entity.type === 'alert' || !!(entity.title && entity.message && entity.severity));
  const isNews     = !isAircraft && !isShip && !isConflict && !isFirms && !isBase && !isAlert &&
                     (entity.type === 'news' || entity.type === 'geo_event' || !!entity.source);

  // ── Pre-compute aircraft fields (before JSX) ──────────────────────────────
  let acCountryDisplay = '\u2753 Unknown';
  let acTypeName   = '';
  let acAltFt      = 0;
  let acVrStr      = '\u2014';
  if (isAircraft) {
    const rawCountry = entity.country || '';
    const icaoCode   = icaoToCountry(entity.icao24 || '');
    let resolved = rawCountry ? resolveCountry(rawCountry) : null;
    if (!resolved || resolved.code === '??') resolved = icaoCode ? resolveCountry(icaoCode) : null;
    if (!resolved || resolved.code === '??') resolved = { name: rawCountry || 'Unknown', emoji: '\u2753' };
    acCountryDisplay = `${resolved.emoji}\u00a0${resolved.name}`;
    acTypeName = getAircraftTypeName(entity.aircraftType || '');
    acAltFt    = entity.altitudeFt != null ? entity.altitudeFt : Math.round((entity.altitude || 0) * 3.28084);
    const vr   = entity.vertical_rate || 0;
    acVrStr    = vr
      ? `${vr > 0 ? '\u25b2' : '\u25bc'} ${Math.abs(Math.round(vr * 196.85)).toLocaleString()} fpm`
      : '\u2014';
  }

  // ── Pre-compute ship fields (before JSX) ──────────────────────────────────
  let shipFlagDisplay = '\u2753 Unknown';
  if (isShip) {
    const rawFlag = entity.flag || entity.country || '';
    let resolved = rawFlag ? resolveCountry(rawFlag) : null;
    if (!resolved || resolved.code === '??') resolved = { name: rawFlag || 'Unknown', emoji: '\u2753' };
    shipFlagDisplay = `${resolved.emoji}\u00a0${resolved.name}`;
  }

  // ── Tracking ──────────────────────────────────────────────────────────────
  const trackableId = isAircraft
    ? (entity.icao24 || entity.id)
    : isShip ? (entity.mmsi || entity.id) : null;
  const isTracking = !!trackableId && (trackedList?.has(trackableId) ?? false);

  // ── Image URL ─────────────────────────────────────────────────────────────
  let imageUrl = null;
  if (isNews) {
    imageUrl = entity.imageUrl || entity.urlToImage || null;
  } else if (isAircraft) {
    imageUrl = getAircraftImageUrl(entity.aircraftType);
    if (!imageUrl) {
      const raw = entity.country || icaoToCountry(entity.icao24 || '');
      const r   = raw ? resolveCountry(raw) : null;
      imageUrl  = r && r.code !== '??' ? getCountryFallbackImage(r.code) : null;
    }
  } else if (isShip)     imageUrl = getShipImageUrl(entity);
  else if (isBase)       imageUrl = getBaseImageUrl(entity.baseType);
  else if (isConflict)   imageUrl = getConflictImageUrl(entity.type || entity.eventType);
  // isFirms: no photo — thermal data speaks for itself

  // ── Fly to ────────────────────────────────────────────────────────────────
  const flyTo = () => {
    if (!viewer || !entity.lat || !entity.lon) return;
    // U3: use entity-type-specific altitude instead of a fixed 1.5Mm for all types
    const FLY_ALT = {
      aircraft: 500_000,
      ship:     800_000,
      firms:    200_000,
      base:     300_000,
      conflict: 400_000,
      news:     600_000,
      geo_event:600_000,
      alert:    500_000,
    };
    const alt = FLY_ALT[entity.type] ?? FLY_ALT[entity.type_entity] ?? 600_000;
    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(entity.lon, entity.lat, alt),
      duration: 2,
    });
  };

  // ── Severity color map ─────────────────────────────────────────────────────
  const SEVERITY_COLOR = {
    critical: 'text-red-400', high: 'text-orange-400',
    medium: 'text-yellow-400', low: 'text-green-400',
  };

  const borderColor = isAircraft ? '#4488ff' : isShip ? '#00aaff' : isConflict ? '#ff4400'
                    : isFirms ? '#ff6600' : isBase ? '#4af7ff' : isAlert ? '#ff3b3b' : '#ffaa00';

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40"
        style={{ background: 'rgba(0,0,0,0.55)' }}
        onClick={onClose}
      />

      {/* Centering overlay — constrained between top chrome and bottom chrome */}
      <div
        className="fixed z-50 flex items-center justify-center pointer-events-none"
        style={{ top: isMobile ? 62 : 72, left: 0, right: 0, bottom: isMobile ? 78 : 88 }}
      >
      {/* Panel – positioned by overlay when not dragged; draggable by header */}
      <div
        ref={panelRef}
        className="hud-panel pointer-events-auto"
        style={{
          borderColor,
          ...(pos
            ? { position: 'fixed', top: pos.top, left: pos.left, transform: 'none' }
            : { position: 'relative' }
          ),
          width: isMobile ? 'min(320px, calc(100vw - 24px))' : 'min(460px, calc(100vw - 32px))',
          maxHeight: '100%',
          overflowY: 'auto',
          userSelect: dragging ? 'none' : undefined,
        }}
      >
        {/* Header — drag handle */}
        <div
          className="flex items-center justify-between px-2 py-1.5 border-b border-hud-border select-none"
          style={{ background: 'rgba(0,0,0,0.4)', cursor: dragging ? 'grabbing' : 'grab' }}
          onMouseDown={onDragStart}
        >
          <div className="flex items-center gap-1.5">
            <span className="text-sm">
              {isAircraft ? '\u25b2' : isShip ? '\u25ac' : isConflict ? '\u25c6' : isFirms ? '\uD83D\uDD25' : isBase ? '\u2b21' : isAlert ? '\u26a0' : '\u25a0'}
            </span>
            <div>
              <div className="hud-title text-[10px] sm:text-xs">
                {isAircraft ? 'AIRCRAFT INTEL' : isShip ? 'VESSEL INTEL' : isConflict ? 'CONFLICT EVENT'
                 : isFirms ? 'THERMAL HOTSPOT' : isBase ? 'MILITARY FACILITY' : isAlert ? 'THREAT ALERT' : 'NEWS EVENT'}
              </div>
              <div className="text-white font-mono font-bold text-xs sm:text-sm truncate max-w-[160px] sm:max-w-[220px]">
                {isAircraft ? (entity.callsign || 'UNKNOWN')
                 : isShip    ? (entity.name || entity.mmsi)
                 : isConflict? (entity.eventType || entity.type || 'EVENT').toUpperCase()
                 : isFirms   ? `FRP ${entity.frp != null ? Number(entity.frp).toFixed(1) + ' MW' : '—'}`
                 : isBase    ? (entity.name || 'BASE')
                 : isAlert   ? (entity.title?.slice(0, 28) || 'ALERT')
                 : entity.source || 'NEWS'}
              </div>
            </div>
          </div>
          <button onClick={onClose} className="text-hud-text hover:text-white text-lg leading-none px-1">&times;</button>
        </div>

        {/* Photo banner */}
        <EntityImage src={imageUrl} alt={entity.name || entity.callsign || entity.title || ''} />

        {/* Body */}
        <div className="px-2 py-1 space-y-0">

          {/* ALERT */}
          {isAlert && (
            <>
              <Row label="SEVERITY" value={(entity.severity || '\u2014').toUpperCase()}
                highlight={SEVERITY_COLOR[entity.severity] || 'text-hud-amber'} />
              {entity.lat != null && <Row label="LOCATION" value={`${entity.lat?.toFixed(2)}\u00b0, ${entity.lon?.toFixed(2)}\u00b0`} />}
              {entity.entityId && <Row label="ENTITY ID" value={entity.entityId} />}
              <Row label="TIME" value={timeAgo(entity.timestamp)} />
              <div className="pt-1">
                <p className="text-white text-xs sm:text-sm font-mono leading-relaxed">{entity.title}</p>
                <p className="text-hud-text text-xs sm:text-sm mt-1 leading-relaxed">{entity.message}</p>
              </div>
            </>
          )}

          {/* BASE */}
          {isBase && (
            <>
              <Row label="COUNTRY" value={entity.country}             highlight="text-hud-amber" />
              <Row label="TYPE"    value={(entity.baseType || '').toUpperCase()} />
              <Row label="LAT"     value={entity.lat?.toFixed(4)}     highlight="text-hud-green" />
              <Row label="LON"     value={entity.lon?.toFixed(4)}     highlight="text-hud-green" />
              {entity.note && (
                <p className="text-hud-text text-xs sm:text-sm mt-1 leading-relaxed border-t border-hud-border/40 pt-1">
                  {entity.note}
                </p>
              )}
            </>
          )}

          {/* AIRCRAFT */}
          {isAircraft && (
            <>
              <Row label="CALLSIGN"  value={entity.callsign}                       highlight="text-hud-green" />
              {entity.registration && <Row label="REG"      value={entity.registration} highlight="text-hud-blue" />}
              {entity.aircraftType  && <Row label="AC TYPE" value={acTypeName}          highlight="text-white" />}
              <Row label="ICAO24"    value={entity.icao24} />
              <Row label="COUNTRY"   value={acCountryDisplay} />
              <div className="flex justify-between items-center py-px border-b border-hud-border/40">
                <span className="hud-label text-[10px] sm:text-xs">ALTITUDE</span>
                <span className="flex items-center gap-1">
                  <span className="font-mono text-[10px] sm:text-xs font-bold text-hud-amber">
                    {altUnit === 'm' ? `${Math.round(acAltFt / 3.28084).toLocaleString()} m` : `${acAltFt.toLocaleString()} ft`}
                  </span>
                  {onToggleAltUnit && (
                    <button
                      onClick={onToggleAltUnit}
                      className="px-1 py-px rounded border border-hud-border/50 text-[8px] sm:text-[9px] font-mono font-bold text-hud-text hover:text-hud-cyan hover:border-hud-cyan transition-colors"
                      title="Toggle ft / m"
                    >{altUnit === 'ft' ? 'M' : 'FT'}</button>
                  )}
                </span>
              </div>
              <div className="flex justify-between items-center py-px border-b border-hud-border/40">
                <span className="hud-label text-[10px] sm:text-xs">SPEED</span>
                <span className="flex items-center gap-1">
                  <span className="font-mono text-[10px] sm:text-xs font-bold text-hud-amber">
                    {speedUnit === 'kmh' ? `${Math.round((entity.velocity || 0) * 1.852)} km/h` : `${Math.round(entity.velocity || 0)} kt`}
                  </span>
                  {onToggleSpeedUnit && (
                    <button
                      onClick={onToggleSpeedUnit}
                      className="px-1 py-px rounded border border-hud-border/50 text-[8px] sm:text-[9px] font-mono font-bold text-hud-text hover:text-hud-cyan hover:border-hud-cyan transition-colors"
                      title="Toggle kt / km/h"
                    >{speedUnit === 'kt' ? 'KM/H' : 'KT'}</button>
                  )}
                </span>
              </div>
              <Row label="HEADING"   value={`${Math.round(entity.heading || 0)}\u00b0 ${headingToCompass(entity.heading || 0)}`} />
              <Row label="VERT RATE" value={acVrStr} />
              <Row label="SQUAWK"    value={entity.squawk || '\u2014'} />
              <Row label="STATUS"    value={entity.on_ground ? '\u25cf ON GROUND' : '\u25cf AIRBORNE'}
                highlight={entity.on_ground ? 'text-green-400' : 'text-hud-blue'} />
              <Row label="ORIGIN"    value={entity.dep_airport ? resolveAirport(entity.dep_airport) : '\u2014'} highlight={entity.dep_airport ? 'text-hud-green' : undefined} />
              <Row label="DEST"      value={entity.arr_airport ? resolveAirport(entity.arr_airport) : '\u2014'} highlight={entity.arr_airport ? 'text-hud-amber' : undefined} />
              <Row label="LAST SEEN" value={timeAgo(entity.lastSeen)} />
              {entity.carrierOps && (
                <div className="mt-1 rounded-lg border border-amber-400/40 bg-amber-950/40 p-1.5 space-y-0.5">
                  <div className="text-[8px] sm:text-[9px] font-mono font-bold text-amber-300/80 tracking-widest uppercase mb-0.5">
                    {"\u2708"} Carrier Air Wing
                  </div>
                  <Row label="CARRIER"  value={entity.carrierOps.carrier}  highlight="text-amber-300" />
                  {entity.carrierOps.cvw !== 'UNKNOWN CVW' &&
                    <Row label="CVW"    value={entity.carrierOps.cvw}      highlight="text-hud-blue" />}
                  {entity.carrierOps.squadron !== 'CARRIER OPS' &&
                    <Row label="SQ"     value={entity.carrierOps.squadron} highlight="text-hud-green" />}
                  <Row label="MATCH"    value={entity.carrierOps.matchType === 'callsign' ? 'Callsign' : entity.carrierOps.matchType === 'hex_range' ? 'ICAO Hex Range' : `Proximity ${entity.carrierOps.distanceKm}km`} />
                </div>
              )}
              {/* Trajectory Analysis */}
              {entity._trajAnalysis && entity._trajAnalysis.pattern !== 'UNKNOWN' && (
                <div className="mt-1 rounded-lg border border-cyan-400/40 bg-cyan-950/40 p-1.5 space-y-0.5">
                  <div className="text-[8px] sm:text-[9px] font-mono font-bold text-cyan-300/80 tracking-widest uppercase mb-0.5">
                    {"\u25C6"} TRAJECTORY INTELLIGENCE
                  </div>
                  <Row label="PATTERN"    value={entity._trajAnalysis.pattern.replace('_', ' ')}
                    highlight={{
                      [PATTERNS.ORBIT]:     'text-red-400',
                      [PATTERNS.RACETRACK]: 'text-orange-400',
                      [PATTERNS.LINEAR]:    'text-hud-green',
                      [PATTERNS.LOITER]:    'text-yellow-400',
                      [PATTERNS.ERRATIC]:   'text-red-300',
                      [PATTERNS.DESCENT]:   'text-hud-blue',
                      [PATTERNS.CLIMB]:     'text-hud-blue',
                    }[entity._trajAnalysis.pattern] || 'text-hud-amber'} />
                  <Row label="MISSION"    value={entity._trajAnalysis.mission} highlight="text-cyan-300" />
                  <Row label="CONFIDENCE" value={`${entity._trajAnalysis.confidence}%`}
                    highlight={entity._trajAnalysis.confidence >= 70 ? 'text-hud-green' : entity._trajAnalysis.confidence >= 45 ? 'text-hud-amber' : 'text-red-400'} />
                  {entity._trajAnalysis.metrics && (
                    <div className="grid grid-cols-2 gap-x-2 gap-y-0 mt-0.5 text-[8px] sm:text-[9px] font-mono text-hud-text">
                      <span>PATH: {entity._trajAnalysis.metrics.totalDistKm} km</span>
                      <span>DIRECT: {entity._trajAnalysis.metrics.directDistKm} km</span>
                      <span>ORBITS: {entity._trajAnalysis.metrics.orbits}</span>
                      <span>BBOX: {entity._trajAnalysis.metrics.bboxDiagKm} km</span>
                      <span>STRT: {entity._trajAnalysis.metrics.straightness}</span>
                      <span>{"\u0394"}ALT: {entity._trajAnalysis.metrics.altChangeM}m</span>
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {/* SHIP */}
          {isShip && (
            <>
              <Row label="NAME"        value={entity.name}            highlight="text-hud-blue" />
              <Row label="MMSI"        value={entity.mmsi} />
              <Row label="FLAG"        value={shipFlagDisplay} />
              <Row label="TYPE"        value={entity.type || 'Military'} />
              <div className="flex justify-between items-center py-px border-b border-hud-border/40">
                <span className="hud-label text-[10px] sm:text-xs">SPEED</span>
                <span className="flex items-center gap-1">
                  <span className="font-mono text-[10px] sm:text-xs font-bold text-hud-amber">
                    {speedUnit === 'kmh' ? `${Math.round((entity.velocity || 0) * 1.852)} km/h` : `${Math.round(entity.velocity || 0)} kn`}
                  </span>
                  {onToggleSpeedUnit && (
                    <button
                      onClick={onToggleSpeedUnit}
                      className="px-1 py-px rounded border border-hud-border/50 text-[8px] sm:text-[9px] font-mono font-bold text-hud-text hover:text-hud-cyan hover:border-hud-cyan transition-colors"
                      title="Toggle kt / km/h"
                    >{speedUnit === 'kt' ? 'KM/H' : 'KT'}</button>
                  )}
                </span>
              </div>
              <Row label="HEADING"     value={`${Math.round(entity.heading || 0)}\u00b0 ${headingToCompass(entity.heading || 0)}`} />
              <Row label="DESTINATION" value={entity.destination || '\u2014'} />
              <Row label="POSITION"    value={`${entity.lat?.toFixed(3)}\u00b0, ${entity.lon?.toFixed(3)}\u00b0`} />
              <Row label="SOURCE"      value={entity.source || 'AIS'} />
              <Row label="LAST SEEN"   value={timeAgo(entity.lastSeen)} />
              {entity.isBaseline && (
                <div className="mt-1 px-1 py-1 rounded bg-amber-900/30 border border-amber-500/40 text-amber-300 text-[10px] sm:text-xs font-mono leading-tight">
                  &#x26A0; No live AIS available &mdash; showing last known homeport / deployment position
                </div>
              )}
            </>
          )}

          {/* CONFLICT */}
          {isConflict && (
            <>
              <Row label="EVENT TYPE" value={(entity.eventType || entity.type || '\u2014').toUpperCase()} highlight="text-orange-400" />
              <Row label="SEVERITY"   value={(entity.severity || '\u2014').toUpperCase()}
                highlight={SEVERITY_COLOR[entity.severity] || 'text-hud-amber'} />
              <Row label="COUNTRY"    value={entity.country || '\u2014'} />
              <Row label="POSITION"   value={`${entity.lat?.toFixed(2)}\u00b0, ${entity.lon?.toFixed(2)}\u00b0`} />
              <Row label="SOURCE"     value={entity.source || 'GDELT'} />
              {(() => {
                const ts = entity.firstSeenAt || entity.publishedAt;
                return ts ? (
                  <>
                    <Row label="DETECTED" value={new Date(ts).toLocaleString('en-GB', {
                      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
                    })} />
                    <Row label="AGE" value={timeAgo(ts)} />
                  </>
                ) : null;
              })()}
              <div className="pt-2">
                <p className="text-white text-sm sm:text-base font-mono leading-relaxed">{entity.title}</p>
              </div>
            </>
          )}

          {/* NASA FIRMS THERMAL HOTSPOT */}
          {isFirms && (() => {
            const frp    = entity.frp    != null ? `${Number(entity.frp).toFixed(1)} MW` : '—';
            const bright = entity.brightness != null ? `${Number(entity.brightness).toFixed(0)} K` : '—';
            const conf   = entity.confidence != null
              ? ({ l: 'LOW', n: 'NOMINAL', h: 'HIGH' }[entity.confidence] ?? String(entity.confidence).toUpperCase())
              : '—';
            const sat    = entity.satellite != null
              ? ({ N: 'NOAA-20 (VIIRS)', T: 'Terra (MODIS)', A: 'Aqua (MODIS)' }[entity.satellite] ?? entity.satellite)
              : '—';
            const acqDate = entity.acq_date || '—';
            const acqTime = entity.acq_time
              ? `${String(entity.acq_time).padStart(4, '0').slice(0, 2)}:${String(entity.acq_time).padStart(4, '0').slice(2)} UTC`
              : '—';
            const dayNight = entity.daynight === 'D' ? 'DAYTIME' : entity.daynight === 'N' ? 'NIGHTTIME' : '—';
            const zone = entity.zone || entity.country || '—';
            return (
              <>
                {/* Visual FRP bar */}
                <div className="mb-2 p-2 rounded border border-orange-500/30 bg-orange-950/20">
                  <div className="flex items-center justify-between mb-1">
                    <span className="hud-label text-[10px]">FIRE RADIATIVE POWER</span>
                    <span className="text-orange-400 font-mono font-bold text-xs">{frp}</span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.min(100, (Number(entity.frp) || 0) / 3)}%`,
                        background: 'linear-gradient(to right, #ff6600, #ff2200)',
                      }}
                    />
                  </div>
                  <div className="text-orange-300/60 text-[9px] font-mono mt-0.5 text-right">
                    max ~300 MW typical conflict zone
                  </div>
                </div>
                <Row label="BRIGHTNESS" value={bright}   highlight="text-orange-400" />
                <Row label="CONFIDENCE" value={conf}     highlight={conf === 'HIGH' ? 'text-red-400' : conf === 'NOMINAL' ? 'text-amber-400' : 'text-hud-text'} />
                <Row label="SATELLITE"  value={sat}      highlight="text-hud-blue" />
                <Row label="ACQ DATE"   value={acqDate}  highlight="text-hud-green" />
                <Row label="ACQ TIME"   value={acqTime}  highlight="text-hud-green" />
                <Row label="PASS"       value={dayNight} />
                <Row label="ZONE"       value={zone} />
                <Row label="POSITION"   value={`${entity.lat?.toFixed(3)}°, ${entity.lon?.toFixed(3)}°`} />
                <Row label="SOURCE"     value="NASA FIRMS / VIIRS NRT" highlight="text-hud-amber" />
                <div className="mt-2 px-2 py-1.5 rounded bg-orange-950/30 border border-orange-500/20 text-orange-300/70 text-[10px] font-mono leading-snug">
                  ■ Thermal anomaly detected by satellite. In active conflict zones these signatures
                  correlate with artillery impacts, weapons fires, and burning infrastructure.
                </div>
              </>
            );
          })()}

          {/* NEWS */}
          {isNews && (
            <>
              <Row label="SOURCE"    value={entity.source}            highlight="text-hud-amber" />
              <Row label="PUBLISHED" value={timeAgo(entity.firstSeenAt || entity.publishedAt)} />
              {entity.lat && <Row label="LOCATION" value={`${entity.lat?.toFixed(2)}\u00b0, ${entity.lon?.toFixed(2)}\u00b0`} />}
              <div className="pt-1">
                <p className="text-white text-xs sm:text-sm font-mono leading-relaxed">{entity.title}</p>
                {entity.description && (
                  <p className="text-hud-text text-xs sm:text-sm mt-1 leading-relaxed line-clamp-3">{entity.description}</p>
                )}
              </div>
            </>
          )}

        </div>

        {/* Footer actions */}
        <div className="flex gap-2 px-2 pb-2 pt-1 flex-wrap">
          <button className="hud-btn-primary flex-1 text-center" onClick={flyTo}>
            &#x25B6; FLY TO
          </button>

          {(isAircraft || isShip) && trackableId && (
            <button
              className={`flex-1 text-center text-xs font-mono font-bold px-2 py-1 rounded border transition-colors ${
                isTracking
                  ? 'bg-red-900/40 border-red-500/70 text-red-400 hover:bg-red-900/60 animate-pulse'
                  : 'bg-hud-accent/10 border-hud-accent/50 text-hud-accent hover:bg-hud-accent/20'
              }`}
              onClick={() => isTracking ? onUntrack?.(trackableId) : onTrack?.(trackableId, isAircraft ? 'aircraft' : 'ship')}
            >
              {isTracking ? '\u25a0 UNTRACK' : '\u25cf TRACK'}
            </button>
          )}

          {isNews && entity.url && /^https?:\/\//i.test(entity.url) && (
            <a href={entity.url} target="_blank" rel="noopener noreferrer" className="hud-btn flex-1 text-center">
              &#x21D7; OPEN
            </a>
          )}
          {isConflict && entity.url && /^https?:\/\//i.test(entity.url) && (
            <a href={entity.url} target="_blank" rel="noopener noreferrer" className="hud-btn flex-1 text-center">
              &#x21D7; SOURCE
            </a>
          )}

          {/* SAT IMG — available for any geo-referenced entity */}
          {entity.lat != null && entity.lon != null && onSatellite && (
            <button
              className="hud-btn text-center text-xs"
              title="Open satellite imagery portal for this location"
              onClick={() => onSatellite({ lat: entity.lat, lon: entity.lon, title: entity.callsign || entity.name || entity.title || entity.type })}
            >
              &#x1F6F0; SAT IMG
            </button>
          )}
        </div>
      </div>
      </div>
    </>
  );
};

export default EntityPopup;
