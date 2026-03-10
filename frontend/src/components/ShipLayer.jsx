/**
 * ShipLayer – renders warships as animated Cesium billboard entities
 * with a fading historical trail showing each ship's trajectory.
 */

import { useEffect, useRef, useCallback } from 'react';
import * as Cesium from 'cesium';
import { SHIP_SVG, getShipColor } from '../utils/icons.js';
import { isValidCoord } from '../utils/geoUtils.js';
import { resolveCountry } from '../utils/militaryFilter.js';
import { saveTrails as idbSaveTrails, loadTrails as idbLoadTrails } from '../utils/trailStore.js';

const MAX_TRAIL_POINTS = 60;         // ~30 min of history at 30-s intervals

// Duration (ms) over which entity position is linearly interpolated.
// Ships move slowly so a 20-second lerp window is smooth and realistic.
const SMOOTH_MS = 20_000;

// Ship trail point mapper: IndexedDB {x,y,z} → Cesium.Cartesian3
const shipPointFromDB = p => new Cesium.Cartesian3(p.x, p.y, p.z);

const ShipLayer = ({ viewer, ships, visible, onSelect, isMobile = false, trackedList = null, replayMode = false, historyTrack = {} }) => {
  const entityMapRef   = useRef(new Map());
  const trailEntityRef = useRef(new Map());
  const trailPointsRef = useRef(new Map());
  const prevIdsRef     = useRef(new Set());
  const dsCache        = useRef({}); // name → CustomDataSource (O(1) lookup)
  const saveTimerRef   = useRef(null); // debounce IDB writes (10s)

  // Load persisted trails from IndexedDB on mount
  useEffect(() => {
    let cancelled = false;
    idbLoadTrails('ship', shipPointFromDB).then(stored => {
      if (cancelled || stored.size === 0) return;
      const cur = trailPointsRef.current;
      for (const [id, pts] of stored.entries()) {
        const existing = cur.get(id);
        if (!existing || existing.length === 0) {
          cur.set(id, pts);
        } else {
          const merged = [...pts, ...existing].slice(-MAX_TRAIL_POINTS);
          cur.set(id, merged);
        }
      }
    });
    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Flush trails to IndexedDB immediately when page hides/closes
  useEffect(() => {
    const flush = () => {
      clearTimeout(saveTimerRef.current);
      if (trailPointsRef.current.size > 0) idbSaveTrails('ship', trailPointsRef.current);
    };
    const onVisChange = () => { if (document.visibilityState === 'hidden') flush(); };
    document.addEventListener('visibilitychange', onVisChange);
    window.addEventListener('beforeunload', flush);
    return () => {
      document.removeEventListener('visibilitychange', onVisChange);
      window.removeEventListener('beforeunload', flush);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // LOD constants — ships are always visible regardless of zoom level
  const MAX_RANGE   = 2e7;                    // 20 000 km (full-globe visibility)
  const LABEL_RANGE = isMobile ? 1.2e6 : 3e6;
  const TRAIL_RANGE = isMobile ? 0 : 2.5e6;  // disable trails on mobile

  const getDS = useCallback((name) => {
    if (!viewer || viewer.isDestroyed()) return null;
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

  // ── Replay trail overlay ───────────────────────────────────────────────────
  // Renders full historical track for each ship when timeline replay is active.
  useEffect(() => {
    if (!viewer) return;
    const ds = getDS('ship-replay-trails');
    if (!ds) return;

    if (!replayMode || !historyTrack || Object.keys(historyTrack).length === 0) {
      ds.entities.removeAll();
      return;
    }

    ds.entities.suspendEvents();
    try {
      ds.entities.removeAll();
      const CYAN = Cesium.Color.fromCssColorString('#22d3ee');
      for (const [id, points] of Object.entries(historyTrack)) {
        if (!points || points.length < 2) continue;
        const validPoints = points
          .filter(p => p.lat != null && p.lon != null)
          .map(p => Cesium.Cartesian3.fromDegrees(p.lon, p.lat, 10));
        if (validPoints.length < 2) continue;
        ds.entities.add({
          id: `replay-ship-${id}`,
          polyline: {
            positions: new Cesium.ConstantProperty(validPoints),
            width: 2.5,
            material: new Cesium.PolylineGlowMaterialProperty({
              glowPower: 0.2,
              taperPower: 0.9,
              color: CYAN.withAlpha(0.80),
            }),
            clampToGround: true,
            followSurface: true,
          },
        });
      }
    } finally {
      ds.entities.resumeEvents();
    }
  }, [viewer, replayMode, historyTrack, getDS]);

  // ── Main update loop ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!viewer) return;
    const shipDS  = getDS('ships');
    const trailDS = getDS('ship-trails');
    if (!shipDS || !trailDS) return;

    // Always sync datasource visibility first
    shipDS.show  = visible;
    trailDS.show = visible;
    if (!visible) {
      shipDS.entities.removeAll();
      trailDS.entities.removeAll();
      entityMapRef.current.clear();
      trailEntityRef.current.clear();
      prevIdsRef.current = new Set();
      return;
    }

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
        const isTracked = trackedList?.has(id);
        const color    = isTracked ? '#FFD700' : getShipColor(ship.flag);
        const iconUri  = SHIP_SVG(ship.heading || 0, color);

        // Build label: [FLAG_ISO] NAME
        const rawFlag    = ship.flag || ship.country || '';
        const resolved   = rawFlag ? resolveCountry(rawFlag) : null;
        const countryTag = (resolved && resolved.code !== '??') ? `[${resolved.code}]` : '';
        const shipLabel  = [countryTag, ship.name || id].filter(Boolean).join(' ');

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
          if (entity.billboard) entity.billboard.color = isTracked
            ? Cesium.Color.WHITE
            : Cesium.Color.WHITE;
          if (entity.label)     entity.label.text = new Cesium.ConstantProperty(shipLabel);
          if (entity.label)     entity.label.fillColor = Cesium.Color.fromCssColorString(isTracked ? '#FFD700' : '#00aaff');
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
              color: Cesium.Color.WHITE,
              verticalOrigin:   Cesium.VerticalOrigin.CENTER,
              horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
              scaleByDistance: new Cesium.NearFarScalar(5e4, 1.1, MAX_RANGE, 0.55),
              distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, MAX_RANGE),
              disableDepthTestDistance: 2e6,
            },
            label: {
              text: shipLabel,
              font: `bold ${isMobile ? 17 : 14}px "Share Tech Mono", monospace`,
              fillColor: Cesium.Color.fromCssColorString(isTracked ? '#FFD700' : '#00aaff'),
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
              disableDepthTestDistance: 2e6,
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
      // Persist trails to IndexedDB (debounced 5s)
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => idbSaveTrails('ship', trailPointsRef.current), 15_000);
    }
  }, [viewer, ships, visible, trackedList, getDS]);

  return null;
};

export default ShipLayer;
