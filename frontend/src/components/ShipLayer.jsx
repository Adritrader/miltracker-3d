/**
 * ShipLayer – renders warships as animated Cesium billboard entities
 * with a fading historical trail showing each ship's trajectory.
 */

import { useEffect, useRef, useCallback } from 'react';
import * as Cesium from 'cesium';
import { SHIP_SVG, getShipColor } from '../utils/icons.js';
import { isValidCoord } from '../utils/geoUtils.js';
import { resolveCountry } from '../utils/militaryFilter.js';

const MAX_TRAIL_POINTS = 60;         // ~30 min of history at 30-s intervals

// Duration (ms) over which entity position is linearly interpolated.
// Ships move slowly so a 20-second lerp window is smooth and realistic.
const SMOOTH_MS = 20_000;
const TRAIL_STORAGE_KEY = 'mlt_ship_trails_v1';

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
  } catch { return new Map(); }
}

function saveTrails(trailPointsMap) {
  try {
    const obj = {};
    for (const [id, pts] of trailPointsMap.entries()) {
      obj[id] = pts.map(p => ({ x: p.x, y: p.y, z: p.z }));
    }
    sessionStorage.setItem(TRAIL_STORAGE_KEY, JSON.stringify(obj));
  } catch { /* storage full */ }
}

const ShipLayer = ({ viewer, ships, visible, onSelect, isMobile = false }) => {
  const entityMapRef   = useRef(new Map());
  const trailEntityRef = useRef(new Map());
  const trailPointsRef = useRef(loadStoredTrails());
  const prevIdsRef     = useRef(new Set());

  // LOD constants
  const MAX_RANGE   = isMobile ? 3e6 : 5.5e6;
  const LABEL_RANGE = isMobile ? 1e6 : 2.5e6;
  const TRAIL_RANGE = isMobile ? 0 : 1.8e6;   // disable trails on mobile

  const getDS = useCallback((name) => {
    if (!viewer || viewer.isDestroyed()) return null;
    for (let i = 0; i < viewer.dataSources.length; i++) {
      if (viewer.dataSources.get(i).name === name) return viewer.dataSources.get(i);
    }
    const ds = new Cesium.CustomDataSource(name);
    viewer.dataSources.add(ds);
    return ds;
  }, [viewer]);

  // ── Visibility toggle ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!viewer) return;
    const shipDS  = getDS('ships');
    const trailDS = getDS('ship-trails');
    if (shipDS)  shipDS.show  = visible;
    if (trailDS) trailDS.show = visible;
  }, [viewer, visible, getDS]);

  // ── Main update loop ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!viewer) return;
    const shipDS  = getDS('ships');
    const trailDS = getDS('ship-trails');
    if (!shipDS || !trailDS) return;

    const currentIds = new Set(ships.map(s => s.mmsi || s.id));

    shipDS.entities.suspendEvents();
    trailDS.entities.suspendEvents();
    try {
      // Remove stale entities
      for (const id of prevIdsRef.current) {
        if (!currentIds.has(id)) {
          const entity    = entityMapRef.current.get(id);
          const trailEnt  = trailEntityRef.current.get(id);
          if (entity)   shipDS.entities.remove(entity);
          if (trailEnt) trailDS.entities.remove(trailEnt);
          entityMapRef.current.delete(id);
          trailEntityRef.current.delete(id);
          trailPointsRef.current.delete(id);
        }
      }
      prevIdsRef.current = currentIds;

      // Add / update ships + trails
      for (const ship of ships) {
        if (!isValidCoord(ship.lat, ship.lon)) continue;
        const id       = ship.mmsi || ship.id;
        const position = Cesium.Cartesian3.fromDegrees(ship.lon, ship.lat, 0);
        const color    = getShipColor(ship.flag);
        const iconUri  = SHIP_SVG(ship.heading || 0, color);
        // Baseline vessels (no live AIS) get a dimmer appearance
        const isBase   = !!ship.isBaseline;

        // Build label: [FLAG_ISO] NAME  (+ marker for baseline)
        const rawFlag    = ship.flag || ship.country || '';
        const resolved   = rawFlag ? resolveCountry(rawFlag) : null;
        const countryTag = (resolved && resolved.code !== '??') ? `[${resolved.code}]` : '';
        const shipLabel  = [countryTag, ship.name || id, isBase ? '~' : ''].filter(Boolean).join(' ');

        // ── Trail history ───────────────────────────────────────────────────
        if (!trailPointsRef.current.has(id)) trailPointsRef.current.set(id, []);
        const pts  = trailPointsRef.current.get(id);
        const last = pts[pts.length - 1];
        // Minimum movement: 200 m (filters GPS jitter while at anchor)
        const moved = !last || Cesium.Cartesian3.distance(last, position) > 200;
        if (moved) {
          pts.push(position);
          if (pts.length > MAX_TRAIL_POINTS) pts.splice(0, pts.length - MAX_TRAIL_POINTS);
        }

        const cesiumColor = Cesium.Color.fromCssColorString(color);

        // ── Polyline trail ──────────────────────────────────────────────────
        if (TRAIL_RANGE > 0 && pts.length >= 2) {
          if (trailEntityRef.current.has(id)) {
            trailEntityRef.current.get(id).polyline.positions =
              new Cesium.ConstantProperty(pts.slice());
          } else {
            const te = trailDS.entities.add({
              id: `ship-trail-${id}`,
              polyline: {
                positions: new Cesium.ConstantProperty(pts.slice()),
                width: 1.5,
                material: new Cesium.PolylineGlowMaterialProperty({
                  glowPower: 0.10,
                  taperPower: 1.0,
                  color: cesiumColor.withAlpha(0.65),
                }),
                clampToGround: true,
                distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, TRAIL_RANGE),
              },
            });
            trailEntityRef.current.set(id, te);
          }
        } else if (TRAIL_RANGE === 0 && trailEntityRef.current.has(id)) {
          trailDS.entities.remove(trailEntityRef.current.get(id));
          trailEntityRef.current.delete(id);
        }

        // ── Billboard / label ───────────────────────────────────────────────
        if (entityMapRef.current.has(id)) {
          const entity = entityMapRef.current.get(id);
          // Smooth position transition: lerp from current displayed position
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
          if (entity.label)     entity.label.text = new Cesium.ConstantProperty(shipLabel);
          entity._milData = { ...ship, type_entity: 'ship' };
        } else {
          // Create smooth-moving entity — position driven by a lerp CallbackProperty
          const tr = { from: position, to: position, start: Date.now() };
          const posCallback = new Cesium.CallbackProperty(() => {
            const elapsed = Date.now() - tr.start;
            const t = Math.min(elapsed / SMOOTH_MS, 1);
            if (t >= 1) return tr.to;
            return Cesium.Cartesian3.lerp(tr.from, tr.to, t, new Cesium.Cartesian3());
          }, false);
          const entity = shipDS.entities.add({
            id: `ship-${id}`,
            position: posCallback,
            billboard: {
              image: iconUri,
              width:  46,
              height: 46,
              // Baseline vessels dimmed to indicate "last known position"
              color: isBase ? Cesium.Color.WHITE.withAlpha(0.45) : Cesium.Color.WHITE,
              verticalOrigin:   Cesium.VerticalOrigin.CENTER,
              horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
              scaleByDistance: new Cesium.NearFarScalar(5e4, 1.1, MAX_RANGE, 0.55),
              distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, MAX_RANGE),
              disableDepthTestDistance: Number.POSITIVE_INFINITY,
            },
            label: {
              text: shipLabel,
              font: `bold ${isMobile ? 17 : 14}px "Share Tech Mono", monospace`,
              fillColor: Cesium.Color.fromCssColorString('#00aaff'),
              outlineColor: Cesium.Color.BLACK,
              outlineWidth: 3,
              style: Cesium.LabelStyle.FILL_AND_OUTLINE,
              verticalOrigin: Cesium.VerticalOrigin.TOP,
              pixelOffset: new Cesium.Cartesian2(0, 22),
              scaleByDistance: new Cesium.NearFarScalar(1e4, isMobile ? 1.3 : 1.0, LABEL_RANGE, 0.0),
              distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, LABEL_RANGE),
              showBackground: true,
              backgroundColor: new Cesium.Color(0, 0, 0, 0.55),
              backgroundPadding: new Cesium.Cartesian2(5, 3),
              disableDepthTestDistance: Number.POSITIVE_INFINITY,
            },
          });
          entity._milData = { ...ship, type_entity: 'ship' };
          entity._transition = tr;
          entityMapRef.current.set(id, entity);
        }
      }
    } finally {
      shipDS.entities.resumeEvents();
      trailDS.entities.resumeEvents();
      saveTrails(trailPointsRef.current);
    }
  }, [viewer, ships, getDS]);

  return null;
};

export default ShipLayer;
