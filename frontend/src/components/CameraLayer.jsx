/**
 * CameraLayer – renders live camera pins on the Cesium globe.
 * Sources: curated list from opencctv.org (conflict zones only).
 * Click a pin to open the CameraModal viewer.
 */

import { useEffect, useRef, useCallback } from 'react';
import * as Cesium from 'cesium';

const CAM_SVG = encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28">
  <circle cx="14" cy="14" r="12" fill="rgba(5,8,16,0.85)" stroke="#00e5ff" stroke-width="1.6"/>
  <rect x="7" y="10" width="10" height="8" rx="1.5" fill="#00e5ff" opacity="0.9"/>
  <polygon points="17,12 22,9 22,19 17,16" fill="#00e5ff" opacity="0.75"/>
  <circle cx="12" cy="14" r="2" fill="rgba(5,8,16,0.9)"/>
</svg>`);
const CAM_ICON = `data:image/svg+xml,${CAM_SVG}`;

const ZONE_COLORS = {
  ukraine:      '#ff6600',
  lebanon:      '#ff2222',
  taiwan_strait:'#ffaa00',
  south_cs:     '#ffaa00',
  red_sea:      '#ff6600',
};

function zoneBadgeColor(zone) {
  return ZONE_COLORS[zone] || '#00e5ff';
}

const CameraLayer = ({ viewer, cameras, visible, onSelect }) => {
  const dsRef  = useRef(null);
  const entRef = useRef([]);

  const getDS = useCallback(() => {
    if (!viewer || viewer.isDestroyed()) return null;
    if (dsRef.current && !viewer.dataSources.contains(dsRef.current)) dsRef.current = null;
    if (!dsRef.current) {
      dsRef.current = new Cesium.CustomDataSource('cameras');
      viewer.dataSources.add(dsRef.current);
    }
    return dsRef.current;
  }, [viewer]);

  useEffect(() => {
    if (!viewer) return;
    const ds = getDS();
    if (!ds) return;

    ds.entities.removeAll();
    entRef.current = [];
    ds.show = visible;
    if (!visible || !cameras?.length) return;

    for (const cam of cameras) {
      const col = Cesium.Color.fromCssColorString(zoneBadgeColor(cam.conflictZone));
      try {
        const e = ds.entities.add({
          id:       `camera-${cam.id}`,
          position: Cesium.Cartesian3.fromDegrees(cam.lon, cam.lat, 500),
          billboard: {
            image:  CAM_ICON,
            width:  26,
            height: 26,
            verticalOrigin: Cesium.VerticalOrigin.CENTER,
            disableDepthTestDistance: 2e6,
            scaleByDistance: new Cesium.NearFarScalar(1e5, 1.6, 5e6, 0.5),
            distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 8e6),
          },
          label: {
            text: cam.name.toUpperCase(),
            font: 'bold 11px "Share Tech Mono", monospace',
            fillColor: col,
            outlineColor: Cesium.Color.BLACK,
            outlineWidth: 3,
            style: Cesium.LabelStyle.FILL_AND_OUTLINE,
            verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
            pixelOffset: new Cesium.Cartesian2(0, -30),
            disableDepthTestDistance: 2e6,
            showBackground: true,
            backgroundColor: new Cesium.Color(0, 0, 0, 0.7),
            backgroundPadding: new Cesium.Cartesian2(6, 3),
            scaleByDistance: new Cesium.NearFarScalar(1e5, 1.1, 4e6, 0.2),
          },
          // carry metadata so click handler can reference it
          properties: { ...cam, type: 'camera' },
        });
        entRef.current.push(e);
      } catch { /* skip bad coords */ }
    }
  }, [viewer, cameras, visible, getDS]);

  // Click interception — delegate to parent via onSelect
  useEffect(() => {
    if (!viewer || !onSelect) return;
    const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
    handler.setInputAction((click) => {
      const picked = viewer.scene.pick(click.position);
      if (!picked?.id?.id) return;
      const entId = picked.id.id;
      if (!entId.startsWith('camera-')) return;
      const props = picked.id.properties;
      if (!props) return;
      // Build plain JS object from Cesium PropertyBag
      const cam = {};
      props.propertyNames.forEach(k => { cam[k] = props[k]?.getValue ? props[k].getValue() : props[k]; });
      onSelect(cam);
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
    return () => handler.destroy();
  }, [viewer, onSelect]);

  return null;
};

export default CameraLayer;
