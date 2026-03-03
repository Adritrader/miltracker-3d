/**
 * ShipLayer – renders warships as animated Cesium billboard entities
 */

import { useEffect, useRef, useCallback } from 'react';
import * as Cesium from 'cesium';
import { SHIP_SVG, getShipColor } from '../utils/icons.js';
import { isValidCoord } from '../utils/geoUtils.js';

const ShipLayer = ({ viewer, ships, visible, onSelect, isMobile = false }) => {
  const entityMapRef = useRef(new Map());
  const prevIdsRef = useRef(new Set());

  // LOD constants
  const MAX_RANGE   = isMobile ? 3e6 : 5.5e6;
  const LABEL_RANGE = isMobile ? 1e6 : 2.5e6;

  const getOrCreateDataSource = useCallback(() => {
    if (!viewer || viewer.isDestroyed()) return null;
    for (let i = 0; i < viewer.dataSources.length; i++) {
      if (viewer.dataSources.get(i).name === 'ships') return viewer.dataSources.get(i);
    }
    const ds = new Cesium.CustomDataSource('ships');
    viewer.dataSources.add(ds);
    return ds;
  }, [viewer]);

  useEffect(() => {
    if (!viewer) return;
    const ds = getOrCreateDataSource();
    if (!ds) return;
    ds.show = visible;
  }, [viewer, visible, getOrCreateDataSource]);

  useEffect(() => {
    if (!viewer) return;
    const ds = getOrCreateDataSource();
    if (!ds) return;

    const currentIds = new Set(ships.map(s => s.mmsi || s.id));

    // Remove stale
    for (const id of prevIdsRef.current) {
      if (!currentIds.has(id)) {
        const entity = entityMapRef.current.get(id);
        if (entity) ds.entities.remove(entity);
        entityMapRef.current.delete(id);
      }
    }
    prevIdsRef.current = currentIds;

    // Add / update
    for (const ship of ships) {
      if (!isValidCoord(ship.lat, ship.lon)) continue;
      const id = ship.mmsi || ship.id;
      const position = Cesium.Cartesian3.fromDegrees(ship.lon, ship.lat, 0);
      const color = getShipColor(ship.flag);
      const iconUri = SHIP_SVG(ship.heading || 0, color);

      if (entityMapRef.current.has(id)) {
        const entity = entityMapRef.current.get(id);
        entity.position = position;
        if (entity.billboard) entity.billboard.image = iconUri;
        entity._milData = { ...ship, type_entity: 'ship' };
      } else {
        const entity = ds.entities.add({
          id: `ship-${id}`,
          position,
          billboard: {
            image: iconUri,
            width:  46,
            height: 46,
            verticalOrigin:   Cesium.VerticalOrigin.CENTER,
            horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
            scaleByDistance: new Cesium.NearFarScalar(5e4, 1.1, MAX_RANGE, 0.55),
            distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, MAX_RANGE),
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
          },
          label: {
            text: ship.name || id,
            font: 'bold 14px "Share Tech Mono", monospace',
            fillColor: Cesium.Color.fromCssColorString('#00aaff'),
            outlineColor: Cesium.Color.BLACK,
            outlineWidth: 3,
            style: Cesium.LabelStyle.FILL_AND_OUTLINE,
            verticalOrigin: Cesium.VerticalOrigin.TOP,
            pixelOffset: new Cesium.Cartesian2(0, 22),
            scaleByDistance: new Cesium.NearFarScalar(1e4, 1.0, LABEL_RANGE, 0.0),
            distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, LABEL_RANGE),
            showBackground: true,
            backgroundColor: new Cesium.Color(0, 0, 0, 0.5),
            backgroundPadding: new Cesium.Cartesian2(5, 3),
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
          },
        });
        entity._milData = { ...ship, type_entity: 'ship' };
        entityMapRef.current.set(id, entity);
      }
    }
  }, [viewer, ships, getOrCreateDataSource]);

  return null;
};

export default ShipLayer;
