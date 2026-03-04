/**
 * AircraftLayer – renders military aircraft as animated Cesium billboard entities
 * with a fading historical trail showing each aircraft's trajectory.
 */

import { useEffect, useRef, useCallback } from 'react';
import * as Cesium from 'cesium';
import { AIRCRAFT_SVG, HELICOPTER_SVG, getAircraftColor } from '../utils/icons.js';
import { isValidCoord } from '../utils/geoUtils.js';
import { icaoToCountry, getAircraftTypeName, resolveCountry, isHelicopter } from '../utils/militaryFilter.js';

/** Build two-line label text for a given aircraft */
function buildLabelText(ac) {
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
  const line2    = [typeName || ac.registration, altStr].filter(Boolean).join(' · ');

  return line2 ? `${line1}\n${line2}` : line1;
}

// Maximum trail length (one point appended each poll ≈ 30 s)
// 40 points ≈ ~20 minutes of history
const MAX_TRAIL_POINTS = 40;

// Duration (ms) over which entity position is linearly interpolated.
// Matches the aircraft poll interval so movement looks continuous.
const SMOOTH_MS = 10_000;
// Ghost: keep stale entities for this long before purging
const GHOST_TTL = 5 * 60_000;
const TRAIL_STORAGE_KEY = 'mlt_trails_v1';

function loadStoredTrails() {
  try {
    const raw = sessionStorage.getItem(TRAIL_STORAGE_KEY);
    if (!raw) return new Map();
    const parsed = JSON.parse(raw);
    const map = new Map();
    for (const [id, pts] of Object.entries(parsed)) {
      map.set(id, pts.map(p => new Cesium.Cartesian3(p.x, p.y, p.z)));
    }
    return map;
  } catch (_) { return new Map(); }
}

function saveTrails(trailPointsMap) {
  try {
    const obj = {};
    for (const [id, pts] of trailPointsMap.entries()) {
      obj[id] = pts.map(p => ({ x: p.x, y: p.y, z: p.z }));
    }
    sessionStorage.setItem(TRAIL_STORAGE_KEY, JSON.stringify(obj));
  } catch (_) { /* storage full — ignore */ }
}

// Cache SVG icons by (heading rounded to 10°, color, type) to avoid re-encoding on every render
const _iconCache = new Map();
function getCachedIcon(heading, color, helicopter = false) {
  const h = Math.round((heading || 0) / 10) * 10 % 360;
  const key = `${h}_${color}_${helicopter ? 'h' : 'a'}`;
  if (!_iconCache.has(key)) {
    _iconCache.set(key, helicopter ? HELICOPTER_SVG(h, color) : AIRCRAFT_SVG(h, color));
  }
  return _iconCache.get(key);
}

const AircraftLayer = ({ viewer, aircraft, visible, onSelect, isMobile = false, trackedList = null }) => {
  const entityMapRef    = useRef(new Map()); // icao24 → billboard entity
  const trailEntityRef  = useRef(new Map()); // icao24 → polyline entity
  const trailPointsRef  = useRef(loadStoredTrails()); // icao24 → Cartesian3[] (persisted)
  const prevIdsRef      = useRef(new Set());
  const ghostTimestampRef = useRef(new Map()); // id → epoch when it became ghost

  // LOD constants — tighter on mobile to preserve frame rate
  const MAX_RANGE      = isMobile ? 2.5e6 : 4.5e6;  // hide billboard beyond this (m)
  const LABEL_RANGE    = isMobile ? 8e5   : 2e6;    // hide label beyond this
  const TRAIL_RANGE    = isMobile ? 0     : 9e5;    // hide trail beyond this (0 = disable on mobile)

  // ── helper: get-or-create named datasource ─────────────────────────────────
  const getDS = useCallback((name) => {
    if (!viewer || viewer.isDestroyed()) return null;
    for (let i = 0; i < viewer.dataSources.length; i++) {
      if (viewer.dataSources.get(i).name === name) return viewer.dataSources.get(i);
    }
    const ds = new Cesium.CustomDataSource(name);
    viewer.dataSources.add(ds);
    return ds;
  }, [viewer]);

  // ── visibility toggle ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!viewer) return;
    const acDS    = getDS('aircraft');
    const trailDS = getDS('aircraft-trails');
    if (acDS)    acDS.show    = visible;
    if (trailDS) trailDS.show = visible;
  }, [viewer, visible, getDS]);

  // ── Ghost TTL purge — runs every 60 s to evict ghosts older than GHOST_TTL ─
  useEffect(() => {
    if (!viewer) return;
    const id = setInterval(() => {
      const acDS    = getDS('aircraft');
      const trailDS = getDS('aircraft-trails');
      if (!acDS || !trailDS) return;
      const now = Date.now();
      for (const [eid, ts] of [...ghostTimestampRef.current.entries()]) {
        if (now - ts > GHOST_TTL) {
          const acEnt    = entityMapRef.current.get(eid);
          const trailEnt = trailEntityRef.current.get(eid);
          if (acEnt)    acDS.entities.remove(acEnt);
          if (trailEnt) trailDS.entities.remove(trailEnt);
          entityMapRef.current.delete(eid);
          trailEntityRef.current.delete(eid);
          trailPointsRef.current.delete(eid);
          ghostTimestampRef.current.delete(eid);
        }
      }
    }, 60_000);
    return () => clearInterval(id);
  }, [viewer, getDS]);

  // ── main update loop ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!viewer) return;
    const acDS    = getDS('aircraft');
    const trailDS = getDS('aircraft-trails');
    if (!acDS || !trailDS) return;

    const currentIds = new Set(aircraft.map(a => a.id));

    acDS.entities.suspendEvents();
    trailDS.entities.suspendEvents();
    try {

      // ── Remove entities for aircraft that disappeared ─────────────────────
      for (const id of prevIdsRef.current) {
        if (!currentIds.has(id)) {
          if (!ghostTimestampRef.current.has(id)) {
            // Newly disappeared — ghost it instead of removing immediately
            const acEnt = entityMapRef.current.get(id);
            if (acEnt) {
              acEnt._ghost = true;
              if (acEnt.billboard) acEnt.billboard.color = Cesium.Color.WHITE.withAlpha(0.28);
              if (acEnt.label)     acEnt.label.fillColor  = Cesium.Color.fromCssColorString('#00ff88').withAlpha(0.35);
            }
            ghostTimestampRef.current.set(id, Date.now());
          }
        }
      }
      prevIdsRef.current = currentIds;

      // ── Add / update aircraft + trails ────────────────────────────────────
      for (const ac of aircraft) {
        if (!isValidCoord(ac.lat, ac.lon)) continue;

        const altM     = Math.max(ac.altitude || 0, 100);
        const position = Cesium.Cartesian3.fromDegrees(ac.lon, ac.lat, altM);
        const isTracked = trackedList?.has(ac.id);
        const color    = isTracked ? '#FFD700' : getAircraftColor(ac.country);
        const helo     = isHelicopter(ac.aircraftType);
        const iconUri  = getCachedIcon(ac.heading, color, helo);

        // ── Append to trail history ─────────────────────────────────────────
        if (!trailPointsRef.current.has(ac.id)) {
          trailPointsRef.current.set(ac.id, []);
        }
        const pts = trailPointsRef.current.get(ac.id);

        // Only append if moved at least ~100 m (skip GPS jitter while on ground)
        const last = pts[pts.length - 1];
        const moved = !last || Cesium.Cartesian3.distance(last, position) > 100;
        if (moved) {
          pts.push(position);
          if (pts.length > MAX_TRAIL_POINTS) pts.splice(0, pts.length - MAX_TRAIL_POINTS);
        }

        const cesiumColor = Cesium.Color.fromCssColorString(color);

        // ── Polyline trail ─────────────────────────────────────────────────
        if (TRAIL_RANGE > 0 && pts.length >= 2) {
          if (trailEntityRef.current.has(ac.id)) {
            // Update existing trail positions
            const te = trailEntityRef.current.get(ac.id);
            te.polyline.positions = new Cesium.ConstantProperty(pts.slice());
          } else {
            // Create trail entity
            const te = trailDS.entities.add({
              id: `trail-${ac.id}`,
              polyline: {
                positions: new Cesium.ConstantProperty(pts.slice()),
                width: 1.5,
                material: new Cesium.PolylineGlowMaterialProperty({
                  glowPower: 0.12,
                  taperPower: 1.0,      // fades toward the oldest end
                  color: cesiumColor.withAlpha(0.7),
                }),
                clampToGround: false,
                followSurface: false,
                distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, TRAIL_RANGE),
              },
            });
            trailEntityRef.current.set(ac.id, te);
          }
        } else if (TRAIL_RANGE === 0 && trailEntityRef.current.has(ac.id)) {
          // mobile: remove existing trails
          const te = trailEntityRef.current.get(ac.id);
          trailDS.entities.remove(te);
          trailEntityRef.current.delete(ac.id);
        }

        // ── Billboard / label ──────────────────────────────────────────────
        if (entityMapRef.current.has(ac.id)) {
          const entity = entityMapRef.current.get(ac.id);
          // If this entity was a ghost, un-ghost it
          if (entity._ghost) {
            entity._ghost = false;
            ghostTimestampRef.current.delete(ac.id);
            if (entity.billboard) entity.billboard.color = Cesium.Color.WHITE;
          }
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
          if (entity.label)     entity.label.text      = new Cesium.ConstantProperty(buildLabelText(ac));
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
              disableDepthTestDistance: Number.POSITIVE_INFINITY,
            },
            label: {
              text: buildLabelText(ac),
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
              disableDepthTestDistance: Number.POSITIVE_INFINITY,
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
      // Persist trail history to sessionStorage after each update
      saveTrails(trailPointsRef.current);
    }
  }, [viewer, aircraft, trackedList, getDS]);

  // ── Click selection ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!viewer || viewer.isDestroyed() || !onSelect) return;

    const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
    handler.setInputAction((click) => {
      const picked = viewer.scene.pick(click.position);
      if (Cesium.defined(picked?.id?._milData)) {
        const data = picked.id._milData;
        if (data.type === 'aircraft') onSelect(data);
      }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

    return () => {
      if (!handler.isDestroyed()) handler.destroy();
    };
  }, [viewer, onSelect]);

  return null;
};

export default AircraftLayer;
