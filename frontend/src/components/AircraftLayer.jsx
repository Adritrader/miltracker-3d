/**
 * AircraftLayer – renders military aircraft as animated Cesium billboard entities
 * with a fading historical trail showing each aircraft's trajectory.
 */

import { useEffect, useRef, useCallback } from 'react';
import * as Cesium from 'cesium';
import { AIRCRAFT_SVG, HELICOPTER_SVG, getAltitudeColor } from '../utils/icons.js';
import { isValidCoord } from '../utils/geoUtils.js';
import { icaoToCountry, getAircraftTypeName, resolveCountry, isHelicopter } from '../utils/militaryFilter.js';
import { saveTrails as idbSaveTrails, loadTrails as idbLoadTrails, pruneOldTrails } from '../utils/trailStore.js';
import { analyseTrajectory } from '../utils/trajectoryAnalysis.js';

/** Build two-line label text for a given aircraft */
function buildLabelText(ac, speedUnit = 'kt') {
  // Resolve country -> compact ISO tag displayed on canvas (emoji fail on Windows canvas)
  const rawCountry = ac.country || icaoToCountry(ac.icao24 || '');
  const resolved   = rawCountry ? resolveCountry(rawCountry) : null;
  const countryTag = (resolved && resolved.code !== '??') ? `[${resolved.code}]` : '';
  const line1      = [countryTag, ac.callsign || 'UNKNOWN'].filter(Boolean).join(' ');

  const typeName = getAircraftTypeName(ac.aircraftType || '');
  const altFt    = ac.altitudeFt != null
    ? ac.altitudeFt
    : Math.round((ac.altitude || 0) * 3.28084);
  const altStr   = ac.on_ground ? 'GND' : `${Math.round(altFt / 100) * 100}ft`;

  // Speed in user-selected unit
  const rawKt = ac.velocity || 0;
  const spdStr = rawKt > 0
    ? (speedUnit === 'kmh' ? `${Math.round(rawKt * 1.852)}km/h` : `${Math.round(rawKt)}kt`)
    : '';

  // Show route if available (e.g. "ETAR→LTAG")
  const route = (ac.dep_airport && ac.arr_airport)
    ? `${ac.dep_airport}→${ac.arr_airport}`
    : ac.dep_airport ? `${ac.dep_airport}→?` : ac.arr_airport ? `?→${ac.arr_airport}` : '';

  const parts = [typeName || ac.registration, altStr, spdStr, route].filter(Boolean);
  const line2 = parts.join(' · ');

  // Line 3: trajectory-inferred mission (if available)
  const mission = ac._trajAnalysis?.mission;
  const line3 = mission && mission !== 'Insufficient Data' ? `\u25c8 ${mission}` : '';

  const lines = [line1, line2, line3].filter(Boolean);
  return lines.join('\n');
}

// Maximum trail length (one point appended each poll ≈ 30 s)
// 40 points ≈ ~20 minutes of history
const MAX_TRAIL_POINTS = 40;

// Duration (ms) over which entity position is linearly interpolated.
// Matches the aircraft poll interval so movement looks continuous.
const SMOOTH_MS = 10_000;

// Aircraft trail point mapper: IndexedDB {x,y,z,a} → runtime {pos, altM}
const acPointFromDB = p => ({ pos: new Cesium.Cartesian3(p.x, p.y, p.z), altM: p.a || 0 });

// Cache SVG icons by (heading rounded to 10°, color, type) to avoid re-encoding on every render.
// Theoretical max: 36 headings × ~4 colors × 2 types = ~288 entries.
// Safety cap prevents unbounded growth if colors vary unexpectedly (e.g. HMR cycles). (P2)
const MAX_ICON_CACHE = 500;
const _iconCache = new Map();
function getCachedIcon(heading, color, helicopter = false) {
  const h = Math.round((heading || 0) / 10) * 10 % 360;
  const key = `${h}_${color}_${helicopter ? 'h' : 'a'}`;
  if (!_iconCache.has(key)) {
    if (_iconCache.size >= MAX_ICON_CACHE) _iconCache.clear(); // safety valve
    _iconCache.set(key, helicopter ? HELICOPTER_SVG(h, color) : AIRCRAFT_SVG(h, color));
  }
  return _iconCache.get(key);
}

const AircraftLayer = ({ viewer, aircraft, visible, onSelect, isMobile = false, trackedList = null, replayMode = false, historyTrack = {}, speedUnit = 'kt' }) => {
  const entityMapRef    = useRef(new Map()); // icao24 → billboard entity
  const trailEntityRef  = useRef(new Map()); // icao24 → polyline entity[]
  const trailPointsRef  = useRef(new Map());         // icao24 → {pos,altM}[] (loaded async from IDB)
  const trailSegCountRef = useRef(new Map()); // icao24 → number of trail segments already rendered
  const trajCacheRef    = useRef(new Map()); // icao24 → {len, result} trajectory analysis cache
  const prevIdsRef      = useRef(new Set());
  const dsCache         = useRef({}); // name → CustomDataSource (O(1) lookup)
  const saveTimerRef    = useRef(null); // debounce IDB writes

  // Load persisted trails from IndexedDB on mount (async, merges with any already-collected points)
  useEffect(() => {
    let cancelled = false;
    pruneOldTrails(); // housekeeping — remove >24 h old trails
    idbLoadTrails('aircraft', acPointFromDB).then(stored => {
      if (cancelled || stored.size === 0) return;
      const cur = trailPointsRef.current;
      for (const [id, pts] of stored.entries()) {
        const existing = cur.get(id);
        if (!existing || existing.length === 0) {
          cur.set(id, pts);
        } else {
          // Prepend stored history before freshly-collected points
          const merged = [...pts, ...existing].slice(-MAX_TRAIL_POINTS);
          cur.set(id, merged);
        }
      }
    });
    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Flush trails to IndexedDB immediately when the page is about to close/hide
  useEffect(() => {
    const flush = () => {
      clearTimeout(saveTimerRef.current);
      if (trailPointsRef.current.size > 0) idbSaveTrails('aircraft', trailPointsRef.current);
    };
    const onVisChange = () => { if (document.visibilityState === 'hidden') flush(); };
    document.addEventListener('visibilitychange', onVisChange);
    window.addEventListener('beforeunload', flush);
    return () => {
      document.removeEventListener('visibilitychange', onVisChange);
      window.removeEventListener('beforeunload', flush);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // LOD constants — tighter on mobile to preserve frame rate
  const MAX_RANGE      = isMobile ? 2.5e6 : 4.5e6;  // hide billboard beyond this (m)
  const LABEL_RANGE    = isMobile ? 8e5   : 2e6;    // hide label beyond this
  const TRAIL_RANGE    = isMobile ? 4e5   : 9e5;    // hide trail beyond this

  // ── helper: get-or-create named datasource (O(1) via cache ref) ──────────────
  const getDS = useCallback((name) => {
    if (!viewer || viewer.isDestroyed()) return null;
    // Invalidate cached ref if it was removed from the viewer
    if (dsCache.current[name] && !viewer.dataSources.contains(dsCache.current[name])) {
      dsCache.current[name] = null;
    }
    if (!dsCache.current[name]) {
      dsCache.current[name] = new Cesium.CustomDataSource(name);
      viewer.dataSources.add(dsCache.current[name]);
    }
    return dsCache.current[name];
  }, [viewer]);

  // visibility is managed inside the main render loop below

  // ── Replay trail overlay ──────────────────────────────────────────────
  // When replayMode is active, draw the full historical track for each entity
  // as a bright amber polyline so the entire path is visible at once.
  useEffect(() => {
    if (!viewer) return;
    const ds = getDS('aircraft-replay-trails');
    if (!ds) return;

    if (!replayMode || !historyTrack || Object.keys(historyTrack).length === 0) {
      // Clear replay trails when not in replay mode
      ds.entities.removeAll();
      return;
    }

    ds.entities.suspendEvents();
    try {
      ds.entities.removeAll();
      const AMBER = Cesium.Color.fromCssColorString('#fbbf24');
      for (const [id, points] of Object.entries(historyTrack)) {
        // Only aircraft tracks (ships handled in ShipLayer)
        if (!points || points.length < 2) continue;
        // Check if this id belongs to an aircraft in current snapshot
        const validPoints = points
          .filter(p => p.lat != null && p.lon != null)
          .map(p => Cesium.Cartesian3.fromDegrees(p.lon, p.lat, Math.max((p.alt || 0) * 0.3048, 150)));
        if (validPoints.length < 2) continue;
        ds.entities.add({
          id: `replay-ac-${id}`,
          polyline: {
            positions: new Cesium.ConstantProperty(validPoints),
            width: 2,
            material: new Cesium.PolylineGlowMaterialProperty({
              glowPower: 0.25,
              taperPower: 0.8,
              color: AMBER.withAlpha(0.85),
            }),
            clampToGround: false,
            followSurface: false,
          },
        });
      }
    } finally {
      ds.entities.resumeEvents();
    }
  }, [viewer, replayMode, historyTrack, getDS]);

  // ── main update loop ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!viewer) return;
    const acDS    = getDS('aircraft');
    const trailDS = getDS('aircraft-trails');
    if (!acDS || !trailDS) return;

    // Always sync datasource visibility first
    acDS.show    = visible;
    trailDS.show = visible;
    if (!visible) {
      acDS.entities.removeAll();
      trailDS.entities.removeAll();
      entityMapRef.current.clear();
      trailEntityRef.current.clear();
      prevIdsRef.current = new Set();
      return;
    }

    const currentIds = new Set(aircraft.map(a => a.id));

    acDS.entities.suspendEvents();
    trailDS.entities.suspendEvents();
    try {

      // ── Remove entities for aircraft that disappeared ─────────────────────
      for (const id of prevIdsRef.current) {
        if (!currentIds.has(id)) {
          // Remove immediately when aircraft leaves ADS-B feed
          const acEnt    = entityMapRef.current.get(id);
          const trailSegs = trailEntityRef.current.get(id);
          if (acEnt)    acDS.entities.remove(acEnt);
          if (trailSegs) for (const seg of trailSegs) trailDS.entities.remove(seg);
          entityMapRef.current.delete(id);
          trailEntityRef.current.delete(id);
          trailSegCountRef.current.delete(id);
          trajCacheRef.current.delete(id);
        }
      }
      prevIdsRef.current = currentIds;

      // ── Add / update aircraft + trails ────────────────────────────────────
      for (const ac of aircraft) {
        if (!isValidCoord(ac.lat, ac.lon)) continue;

        const altM     = Math.max(ac.altitude || 0, 100);
        const position = Cesium.Cartesian3.fromDegrees(ac.lon, ac.lat, altM);
        const isTracked = trackedList?.has(ac.id);
        const iconColor = isTracked ? '#FFD700' : '#ffffff';
        const helo     = isHelicopter(ac.aircraftType);
        const iconUri  = getCachedIcon(ac.heading, iconColor, helo);

        // ── Append to trail history ─────────────────────────────────────────
        if (!trailPointsRef.current.has(ac.id)) {
          trailPointsRef.current.set(ac.id, []);
        }
        const pts = trailPointsRef.current.get(ac.id);

        // Only append if moved at least ~100 m (skip GPS jitter while on ground)
        const lastPt = pts[pts.length - 1];
        const moved = !lastPt || Cesium.Cartesian3.distance(lastPt.pos, position) > 100;
        if (moved) {
          pts.push({ pos: position, altM });
          if (pts.length > MAX_TRAIL_POINTS) pts.splice(0, pts.length - MAX_TRAIL_POINTS);
        }

        // ── Polyline trail (per-segment altitude gradient, incremental) ─
        if (TRAIL_RANGE > 0 && pts.length >= 2) {
          const segs = trailEntityRef.current.get(ac.id) || [];
          const renderedCount = trailSegCountRef.current.get(ac.id) || 0;

          // Trim excess segments if trail was pruned (cap overflow)
          const maxSegs = pts.length - 1;
          while (segs.length > maxSegs) {
            trailDS.entities.remove(segs.shift());
          }

          // Only add new segments that haven't been rendered yet
          const startIdx = Math.max(0, segs.length);
          for (let i = startIdx; i < maxSegs; i++) {
            const avgAlt = (pts[i].altM + pts[i + 1].altM) / 2;
            const segColor = Cesium.Color.fromCssColorString(getAltitudeColor(avgAlt));
            const alpha = 0.3 + 0.6 * (i / maxSegs);
            const seg = trailDS.entities.add({
              id: `trail-${ac.id}-${Date.now()}-${i}`,
              polyline: {
                positions: [pts[i].pos, pts[i + 1].pos],
                width: 2,
                material: segColor.withAlpha(alpha),
                clampToGround: false,
                followSurface: false,
                distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, TRAIL_RANGE),
              },
            });
            segs.push(seg);
          }

          trailEntityRef.current.set(ac.id, segs);
          trailSegCountRef.current.set(ac.id, segs.length);
        } else if (TRAIL_RANGE === 0 && trailEntityRef.current.has(ac.id)) {
          // mobile: remove existing trails
          const oldSegs = trailEntityRef.current.get(ac.id);
          if (oldSegs) for (const seg of oldSegs) trailDS.entities.remove(seg);
          trailEntityRef.current.delete(ac.id);
          trailSegCountRef.current.delete(ac.id);
        }

        // ── Trajectory analysis (cached — recompute only when trail grows) ─
        const trajCache = trajCacheRef.current.get(ac.id);
        if (!trajCache || trajCache.len !== pts.length) {
          const analysis = analyseTrajectory(pts, ac.aircraftType, helo);
          trajCacheRef.current.set(ac.id, { len: pts.length, result: analysis });
          ac._trajAnalysis = analysis;
        } else {
          ac._trajAnalysis = trajCache.result;
        }

        // ── Billboard / label ──────────────────────────────────────────────
        if (entityMapRef.current.has(ac.id)) {
          const entity = entityMapRef.current.get(ac.id);
          // Smooth position transition: lerp from current displayed position
          // to the new position over SMOOTH_MS so entities glide instead of snap
          if (!entity._transition) {
            // Old entity (no CallbackProperty yet) — replace position with lerp-driven one
            const tr0 = { from: position, to: position, start: Date.now() };
            entity._transition = tr0;
            entity.position = new Cesium.CallbackProperty(() => {
              const elapsed = Date.now() - tr0.start;
              const t = Math.min(elapsed / SMOOTH_MS, 1);
              if (t >= 1) return tr0.to;
              return Cesium.Cartesian3.lerp(tr0.from, tr0.to, t, new Cesium.Cartesian3());
            }, false);
          }
          const tr  = entity._transition;
          const cur = entity.position?.getValue?.(Cesium.JulianDate.now());
          tr.from   = (cur && isFinite(cur.x)) ? Cesium.Cartesian3.clone(cur) : tr.to;
          tr.to     = position;
          tr.start  = Date.now();
          if (entity.billboard) entity.billboard.image = iconUri;
          if (entity.label)     entity.label.text      = new Cesium.ConstantProperty(buildLabelText(ac, speedUnit));
          if (entity.label && isTracked) entity.label.fillColor = Cesium.Color.fromCssColorString('#FFD700');
          else if (entity.label)        entity.label.fillColor = Cesium.Color.fromCssColorString('#00ff88');
          entity._milData = ac;
        } else {
          // Create smooth-moving entity — position driven by a lerp CallbackProperty
          const tr = { from: position, to: position, start: Date.now() };
          const posCallback = new Cesium.CallbackProperty(() => {
            const elapsed = Date.now() - tr.start;
            const t = Math.min(elapsed / SMOOTH_MS, 1);
            if (t >= 1) return tr.to;
            return Cesium.Cartesian3.lerp(tr.from, tr.to, t, new Cesium.Cartesian3());
          }, false);
          const entity = acDS.entities.add({
            id: `aircraft-${ac.id}`,
            position: posCallback,
            billboard: {
              image: iconUri,
              width:  46,
              height: 46,
              verticalOrigin:   Cesium.VerticalOrigin.CENTER,
              horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
              // Shrink at distance but stay visible — 46px at close range, ~25px at far range
              scaleByDistance: new Cesium.NearFarScalar(5e4, 1.1, MAX_RANGE, 0.55),
              distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, MAX_RANGE),
              disableDepthTestDistance: 2e6,
            },
            label: {
              text: buildLabelText(ac, speedUnit),
              font: `bold ${isMobile ? 17 : 14}px "Share Tech Mono", monospace`,
              fillColor: Cesium.Color.fromCssColorString(isTracked ? '#FFD700' : '#00ff88'),
              outlineColor: Cesium.Color.BLACK,
              outlineWidth: 3,
              style: Cesium.LabelStyle.FILL_AND_OUTLINE,
              verticalOrigin: Cesium.VerticalOrigin.TOP,
              pixelOffset: new Cesium.Cartesian2(0, 20),
              scaleByDistance: new Cesium.NearFarScalar(1e4, isMobile ? 1.3 : 1.0, LABEL_RANGE, 0.0),
              distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, LABEL_RANGE),
              showBackground: true,
              backgroundColor: new Cesium.Color(0, 0, 0, 0.55),
              backgroundPadding: new Cesium.Cartesian2(5, 3),
              disableDepthTestDistance: 2e6,
            },
          });
          entity._milData = ac;
          entity._transition = tr;
          entityMapRef.current.set(ac.id, entity);
        }
      }
    } finally {
      acDS.entities.resumeEvents();
      trailDS.entities.resumeEvents();
      // Persist ALL trails to IndexedDB (unlimited storage, debounced 5 s)
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => idbSaveTrails('aircraft', trailPointsRef.current), 15_000);
    }
  }, [viewer, aircraft, visible, trackedList, speedUnit, getDS]);

  // ── Click selection handled centrally by Globe3D's screenSpaceEventHandler ─
  // (§0.18: removed per-layer handler — Globe3D picks _milData and calls onEntityClick)

  return null;
};

export default AircraftLayer;
