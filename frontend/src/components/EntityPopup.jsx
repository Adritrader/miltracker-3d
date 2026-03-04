/**
 * EntityPopup – HUD-style info panel for selected aircraft, ship, or news item
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import * as Cesium from 'cesium';
import {
  formatAltitude, formatSpeed, metersToFeet, msToKnots,
  headingToCompass, timeAgo
} from '../utils/geoUtils.js';
import { COUNTRY_FLAGS, icaoToCountry, getAircraftTypeName, resolveCountry } from '../utils/militaryFilter.js';
import {
  getAircraftImageUrl, getShipImageUrl, getBaseImageUrl, getConflictImageUrl, getCountryFallbackImage,
} from '../utils/mediaLookup.js';

const Row = ({ label, value, highlight }) => (
  <div className="flex justify-between items-center py-0.5 border-b border-hud-border/40">
    <span className="hud-label text-xs">{label}</span>
    <span className={`font-mono text-xs font-bold ${highlight || 'text-white'}`}>{value ?? '—'}</span>
  </div>
);

/** Compact image banner shown at the top of every popup */
const EntityImage = ({ src, alt }) => {
  const [state, setState] = useState('loading'); // loading | ok | err
  useEffect(() => { setState('loading'); }, [src]);
  if (!src || state === 'err') return null;
  return (
    <div className="relative w-full overflow-hidden" style={{ height: 130 }}>
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

const EntityPopup = ({ entity, viewer, onClose, isMobile = false, trackedId = null, onTrack, onUntrack }) => {
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
        top:  Math.max(0, dragState.current.startTop  + (me.clientY - dragState.current.startY)),
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

  const isAircraft = entity.type === 'aircraft' || !!entity.icao24;
  const isShip     = entity.type_entity === 'ship' || !!entity.mmsi;
  const isConflict = entity.type === 'conflict';
  const isBase     = entity.type === 'base';
  const isAlert    = !isAircraft && !isShip && !isConflict && !isBase &&
                     !!(entity.title && entity.message && entity.severity);
  const isNews     = !isAircraft && !isShip && !isConflict && !isBase && !isAlert &&
                     (entity.type === 'news' || entity.type === 'geo_event' || !!entity.source);

  // ── Resolve media image ─────────────────────────────────────────────────
  // For aircraft: try specific type image, then country-generic fallback
  let imageUrl = null;
  if (isNews)     imageUrl = entity.imageUrl || entity.urlToImage || null;
  else if (isAircraft) {
    imageUrl = getAircraftImageUrl(entity.aircraftType);
    // Fallback: country-generic image based on resolved country
    if (!imageUrl) {
      const raw = entity.country || icaoToCountry(entity.icao24 || '');
      const r   = raw ? resolveCountry(raw) : null;
      imageUrl  = r && r.code !== '??' ? getCountryFallbackImage(r.code) : null;
    }
  }
  else if (isShip)     imageUrl = getShipImageUrl(entity);
  else if (isBase)     imageUrl = getBaseImageUrl(entity.baseType);
  else if (isConflict) imageUrl = getConflictImageUrl(entity.type || entity.eventType);

  const flyTo = () => {
    if (!viewer || !entity.lat || !entity.lon) return;
    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(entity.lon, entity.lat, 1_500_000),
      duration: 2,
    });
  };

  return (
    <>
      {/* Backdrop — no backdrop-filter to avoid WebGL canvas recomposite flash */}
      <div
        className="fixed inset-0 z-40"
        style={{ background: 'rgba(0,0,0,0.55)' }}
        onClick={onClose}
      />
      {/* Panel – centered by default; draggable by header */}
      <div
        ref={panelRef}
        className="fixed hud-panel z-50"
        style={{
          borderColor: isAircraft ? '#4488ff' : isShip ? '#00aaff' : isConflict ? '#ff4400' : isBase ? '#4af7ff' : isAlert ? '#ff3b3b' : '#ffaa00',
          ...(pos
            ? { top: pos.top, left: pos.left, transform: 'none' }
            : { top: '50%',   left: '50%',    transform: 'translate(-50%, -50%)' }
          ),
          width: isMobile ? 'min(340px, calc(100vw - 24px))' : 'min(460px, calc(100vw - 32px))',
          maxHeight: 'calc(100vh - 120px)',
          overflowY: 'auto',
          userSelect: dragging ? 'none' : undefined,
        }}
      >
      {/* Header — drag handle */}
      <div
        className="flex items-center justify-between px-3 py-2 border-b border-hud-border select-none"
        style={{ background: 'rgba(0,0,0,0.4)', cursor: dragging ? 'grabbing' : 'grab' }}
        onMouseDown={onDragStart}
      >
        <div className="flex items-center gap-2">
          <span className="text-lg">
            {isAircraft ? '▲' : isShip ? '▬' : isConflict ? '◆' : isBase ? '⬡' : isAlert ? '⚠' : '■'}
          </span>
          <div>
            <div className="hud-title text-xs">
              {isAircraft ? 'AIRCRAFT INTEL' : isShip ? 'VESSEL INTEL' : isConflict ? 'CONFLICT EVENT' : isBase ? 'MILITARY FACILITY' : isAlert ? 'THREAT ALERT' : 'NEWS EVENT'}
            </div>
            <div className="text-white font-mono font-bold text-sm truncate max-w-[160px]">
              {isAircraft ? (entity.callsign || 'UNKNOWN') :
               isShip    ? (entity.name    || entity.mmsi) :
               isConflict? (entity.eventType || entity.type || 'EVENT').toUpperCase() :
               isBase    ? (entity.name || 'BASE') :
               isAlert   ? (entity.title?.slice(0, 28) || 'ALERT') :
               entity.source || 'NEWS'}
            </div>
          </div>
        </div>
        <button onClick={onClose} className="text-hud-text hover:text-white text-lg leading-none px-1">✕</button>
      </div>

      {/* Photo banner */}
      <EntityImage src={imageUrl} alt={entity.name || entity.callsign || entity.title || ''} />

      {/* Body */}
      <div className="px-3 py-2 space-y-0.5">
        {isAlert && (() => {
          const SCOLOR = { critical:'text-red-400', high:'text-orange-400', medium:'text-yellow-400', low:'text-green-400' };
          const sc = SCOLOR[entity.severity] || 'text-hud-amber';
          return (
            <>
              <Row label="SEVERITY" value={(entity.severity || '—').toUpperCase()} highlight={sc} />
              {entity.lat != null && <Row label="LOCATION" value={`${entity.lat?.toFixed(2)}°, ${entity.lon?.toFixed(2)}°`} />}
              {entity.entityId && <Row label="ENTITY ID" value={entity.entityId} />}
              <Row label="TIME" value={timeAgo(entity.timestamp)} />
              <div className="pt-1">
                <p className="text-white text-xs font-mono leading-relaxed">{entity.title}</p>
                <p className="text-hud-text text-xs mt-1 leading-relaxed">{entity.message}</p>
              </div>
            </>
          );
        })()}
        {isBase && (
          <>
            <Row label="COUNTRY"   value={entity.country}  highlight="text-hud-amber" />
            <Row label="TYPE"      value={(entity.baseType || '').toUpperCase()} />
            <Row label="LAT"       value={entity.lat?.toFixed(4)} highlight="text-hud-green" />
            <Row label="LON"       value={entity.lon?.toFixed(4)} highlight="text-hud-green" />
            {entity.note && (
              <p className="text-hud-text text-xs mt-1 leading-relaxed border-t border-hud-border/40 pt-1">
                {entity.note}
              </p>
            )}
          </>
        )}
        {isAircraft && (() => {
            // Resolve country: try ownOp/country first, then ICAO prefix, then unknown
            const rawCountry = entity.country || '';
            const icaoCode   = icaoToCountry(entity.icao24 || '');
            let resolved = rawCountry ? resolveCountry(rawCountry) : null;
            // Only accept if it actually resolved (not the ??-unknown fallback)
            if (!resolved || resolved.code === '??') {
              resolved = icaoCode ? resolveCountry(icaoCode) : null;
            }
            if (!resolved || resolved.code === '??') {
              resolved = { name: rawCountry || 'Unknown', emoji: '\u2753' };
            }
            const countryDisplay = `${resolved.emoji}\u00a0${resolved.name}`;
            const typeName = getAircraftTypeName(entity.aircraftType || '');
            const altFt    = entity.altitudeFt != null
              ? entity.altitudeFt
              : Math.round((entity.altitude || 0) * 3.28084);
            const vr = entity.vertical_rate;
            const vrStr = vr
              ? `${vr > 0 ? '\u25b2' : '\u25bc'} ${Math.abs(Math.round(vr * 196.85)).toLocaleString()} fpm`
              : '\u2014';
            return (
              <>
                <Row label="CALLSIGN"    value={entity.callsign}                   highlight="text-hud-green" />
                {entity.registration && <Row label="REG" value={entity.registration} highlight="text-hud-blue" />}
                {entity.aircraftType  && <Row label="AC TYPE" value={typeName}       highlight="text-white" />}
                <Row label="ICAO24"     value={entity.icao24} />
                <Row label="COUNTRY"    value={countryDisplay} />
                <Row label="ALTITUDE"   value={`${altFt.toLocaleString()} ft`}       highlight="text-hud-amber" />
                <Row label="SPEED"      value={`${Math.round(entity.velocity || 0)} kt`} highlight="text-hud-amber" />
                <Row label="HEADING"    value={`${Math.round(entity.heading || 0)}\u00b0 ${headingToCompass(entity.heading || 0)}`} />
                <Row label="VERT RATE"  value={vrStr} />
                <Row label="SQUAWK"     value={entity.squawk || '\u2014'} />
                <Row label="STATUS"     value={entity.on_ground ? '\ud83d\udfe2 ON GROUND' : '\ud83d\udd35 AIRBORNE'} />
                <Row label="SOURCE"     value={entity.source || 'adsb'} highlight="text-hud-text" />
                <Row label="LAST SEEN"  value={timeAgo(entity.lastSeen)} />
              </>
            );
          })()}
            const typeName = getAircraftTypeName(entity.aircraftType || '');
            const altFt    = entity.altitudeFt != null
              ? entity.altitudeFt
              : Math.round((entity.altitude || 0) * 3.28084);
            const vr = entity.vertical_rate;
            const vrStr = vr
              ? `${vr > 0 ? '▲' : '▼'} ${Math.abs(Math.round(vr * 196.85)).toLocaleString()} fpm`
              : '—';
            return (
              <>
                <Row label="CALLSIGN"    value={entity.callsign}                   highlight="text-hud-green" />
                {entity.registration && <Row label="REG" value={entity.registration} highlight="text-hud-blue" />}
                {entity.aircraftType  && <Row label="AC TYPE" value={typeName}       highlight="text-white" />}
                <Row label="ICAO24"     value={entity.icao24} />
                <Row label="COUNTRY"    value={countryDisplay} />
                <Row label="ALTITUDE"   value={`${altFt.toLocaleString()} ft`}       highlight="text-hud-amber" />
                <Row label="SPEED"      value={`${Math.round(entity.velocity || 0)} kt`} highlight="text-hud-amber" />
                <Row label="HEADING"    value={`${Math.round(entity.heading || 0)}° ${headingToCompass(entity.heading || 0)}`} />
                <Row label="VERT RATE"  value={vrStr} />
                <Row label="SQUAWK"     value={entity.squawk || '—'} />
                <Row label="STATUS"     value={entity.on_ground ? '🟢 ON GROUND' : '🔵 AIRBORNE'} />
                <Row label="SOURCE"     value={entity.source || 'adsb'} highlight="text-hud-text" />
                <Row label="LAST SEEN"  value={timeAgo(entity.lastSeen)} />
              </>
            );
          })()}

        {isShip && (() => {
          const resolved = resolveCountry(entity.flag || entity.country || '');
          const flagDisplay = `${resolved.emoji} ${resolved.name}`;
          return (
            <>
              <Row label="NAME"        value={entity.name}        highlight="text-hud-blue" />
              <Row label="MMSI"        value={entity.mmsi} />
              <Row label="FLAG"        value={flagDisplay} />
              <Row label="TYPE"        value={entity.type || 'Military'} />
              <Row label="SPEED"       value={`${Math.round(entity.velocity || 0)} kn`} highlight="text-hud-amber" />
              <Row label="HEADING"     value={`${Math.round(entity.heading || 0)}° ${headingToCompass(entity.heading || 0)}`} />
              <Row label="DESTINATION" value={entity.destination || '—'} />
              <Row label="POSITION"    value={`${entity.lat?.toFixed(3)}°, ${entity.lon?.toFixed(3)}°`} />
              <Row label="LAST SEEN"   value={timeAgo(entity.lastSeen)} />
            </>
          );
        })()}

        {isConflict && (
          <>
            <Row label="EVENT TYPE" value={(entity.eventType || entity.type || '—').toUpperCase()} highlight="text-orange-400" />
            <Row label="SEVERITY"   value={(entity.severity || '—').toUpperCase()}
              highlight={entity.severity === 'critical' ? 'text-red-400' : entity.severity === 'high' ? 'text-orange-400' : 'text-hud-amber'} />
            <Row label="COUNTRY"    value={entity.country || '—'} />
            <Row label="POSITION"   value={`${entity.lat?.toFixed(2)}°, ${entity.lon?.toFixed(2)}°`} />
            <Row label="SOURCE"     value={entity.source || 'GDELT'} />
            {entity.publishedAt && <Row label="DATE"      value={new Date(entity.publishedAt).toLocaleString('es-ES', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' })} />}
            <Row label="REPORTED"   value={timeAgo(entity.publishedAt)} />
            <div className="pt-1">
              <p className="text-white text-xs font-mono leading-relaxed line-clamp-4">
                {entity.title}
              </p>
            </div>
          </>
        )}

        {isNews && (
          <>
            <Row label="SOURCE" value={entity.source} highlight="text-hud-amber" />
            <Row label="PUBLISHED" value={timeAgo(entity.publishedAt)} />
            {entity.lat && <Row label="LOCATION" value={`${entity.lat?.toFixed(2)}°, ${entity.lon?.toFixed(2)}°`} />}
            <div className="pt-1">
              <p className="text-white text-xs font-mono leading-relaxed">
                {entity.title}
              </p>
              {entity.description && (
                <p className="text-hud-text text-xs mt-1 leading-relaxed line-clamp-3">
                  {entity.description}
                </p>
              )}
            </div>
          </>
        )}
      </div>

      {/* Footer actions */}
      <div className="flex gap-2 px-3 pb-3 pt-1 flex-wrap">
        <button className="hud-btn-primary flex-1 text-center" onClick={flyTo}>
          📍 FLY TO
        </button>

        {/* TRACK button — only for aircraft and ships */}
        {(isAircraft || isShip) && (() => {
          const entityId = isAircraft ? (entity.icao24 || entity.id) : (entity.mmsi || entity.id);
          const isTracking = trackedId === entityId;
          return (
            <button
              className={`flex-1 text-center text-xs font-mono font-bold px-2 py-1 rounded border transition-colors ${
                isTracking
                  ? 'bg-red-900/40 border-red-500/70 text-red-400 hover:bg-red-900/60 animate-pulse'
                  : 'bg-hud-accent/10 border-hud-accent/50 text-hud-accent hover:bg-hud-accent/20'
              }`}
              onClick={() => {
                if (isTracking) {
                  onUntrack?.();
                } else {
                  onTrack?.(entityId, isAircraft ? 'aircraft' : 'ship');
                }
              }}
            >
              {isTracking ? '⏹ UNTRACK' : '📶 TRACK'}
            </button>
          );
        })()}

        {isNews && entity.url && (
          <a href={entity.url} target="_blank" rel="noopener noreferrer"
             className="hud-btn flex-1 text-center">
            🔗 OPEN
          </a>
        )}
        {isConflict && entity.url && (
          <a href={entity.url} target="_blank" rel="noopener noreferrer"
             className="hud-btn flex-1 text-center">
            🔗 SOURCE
          </a>
        )}
      </div>
      </div>
    </>
  );
};

export default EntityPopup;
