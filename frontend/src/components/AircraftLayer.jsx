/**
 * AircraftLayer – renders military aircraft as animated Cesium billboard entities
 * with a fading historical trail showing each aircraft's trajectory.
 */

import { useEffect, useRef, useCallback } from 'react';
import * as Cesium from 'cesium';
import { AIRCRAFT_SVG, getAircraftColor } from '../utils/icons.js';
import { isValidCoord } from '../utils/geoUtils.js';
import { COUNTRY_FLAGS, icaoToCountry, getAircraftTypeName } from '../utils/militaryFilter.js';

/** Build two-line label text for a given aircraft */
function buildLabelText(ac) {
  const country = ac.country || icaoToCountry(ac.icao24 || '');
  const flag    = COUNTRY_FLAGS[country] || '';
  const line1   = `${flag} ${ac.callsign || 'UNKNOWN'}`.trim();

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

// Cache SVG icons by (heading rounded to 10°, color) to avoid re-encoding on every render
const _iconCache = new Map();
function getCachedIcon(heading, color) {
  const h = Math.round((heading || 0) / 10) * 10 % 360;
  const key = `${h}_${color}`;
  if (!_iconCache.has(key)) _iconCache.set(key, AIRCRAFT_SVG(h, color));
  return _iconCache.get(key);
}

const AircraftLayer = ({ viewer, aircraft, visible, onSelect }) => {
  const entityMapRef    = useRef(new Map()); // icao24 → billboard entity
  const trailEntityRef  = useRef(new Map()); // icao24 → polyline entity
  const trailPointsRef  = useRef(loadStoredTrails()); // icao24 → Cartesian3[] (persisted)
  const prevIdsRef      = useRef(new Set());

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
          const acEnt    = entityMapRef.current.get(id);
          const trailEnt = trailEntityRef.current.get(id);
          if (acEnt)    acDS.entities.remove(acEnt);
          if (trailEnt) trailDS.entities.remove(trailEnt);
          entityMapRef.current.delete(id);
          trailEntityRef.current.delete(id);
          trailPointsRef.current.delete(id);
        }
      }
      prevIdsRef.current = currentIds;

      // ── Add / update aircraft + trails ────────────────────────────────────
      for (const ac of aircraft) {
        if (!isValidCoord(ac.lat, ac.lon)) continue;

        const altM     = Math.max(ac.altitude || 0, 100);
        const position = Cesium.Cartesian3.fromDegrees(ac.lon, ac.lat, altM);
        const color    = getAircraftColor(ac.country);
        const iconUri  = getCachedIcon(ac.heading, color);

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
        if (pts.length >= 2) {
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
              },
            });
            trailEntityRef.current.set(ac.id, te);
          }
        }

        // ── Billboard / label ──────────────────────────────────────────────
        if (entityMapRef.current.has(ac.id)) {
          const entity = entityMapRef.current.get(ac.id);
          entity.position = position;
          if (entity.billboard) entity.billboard.image = iconUri;
          if (entity.label)     entity.label.text      = new Cesium.ConstantProperty(buildLabelText(ac));
          entity._milData = ac;
        } else {
          const entity = acDS.entities.add({
            id: `aircraft-${ac.id}`,
            position,
            billboard: {
              image: iconUri,
              width: 38,
              height: 38,
              verticalOrigin: Cesium.VerticalOrigin.CENTER,
              horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
              scaleByDistance: new Cesium.NearFarScalar(2e5, 0.8, 1.5e7, 1.6),
              distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 1.8e7),
              disableDepthTestDistance: Number.POSITIVE_INFINITY,
            },
            label: {
              text: buildLabelText(ac),
              font: 'bold 14px "Share Tech Mono", monospace',
              fillColor: Cesium.Color.fromCssColorString('#00ff88'),
              outlineColor: Cesium.Color.BLACK,
              outlineWidth: 3,
              style: Cesium.LabelStyle.FILL_AND_OUTLINE,
              verticalOrigin: Cesium.VerticalOrigin.TOP,
              pixelOffset: new Cesium.Cartesian2(0, 20),
              scaleByDistance: new Cesium.NearFarScalar(1.5e5, 1.2, 8e6, 0.0),
              showBackground: true,
              backgroundColor: new Cesium.Color(0, 0, 0, 0.5),
              backgroundPadding: new Cesium.Cartesian2(5, 3),
              disableDepthTestDistance: Number.POSITIVE_INFINITY,
            },
          });
          entity._milData = ac;
          entityMapRef.current.set(ac.id, entity);
        }
      }
    } finally {
      acDS.entities.resumeEvents();
      trailDS.entities.resumeEvents();
      // Persist trail history to sessionStorage after each update
      saveTrails(trailPointsRef.current);
    }
  }, [viewer, aircraft, getDS]);

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
