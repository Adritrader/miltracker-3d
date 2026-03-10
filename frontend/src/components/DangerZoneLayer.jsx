/**
 * DangerZoneLayer â€“ tactical zone overlays + alert markers.
 * Each zone is drawn as an actual geographic polygon outline (not a circle).
 * Falls back to an approximated circle if no polygon is defined for a zone.
 */

import { useEffect, useRef, useCallback } from 'react';
import * as Cesium from 'cesium';
import { ALERT_SVG } from '../utils/icons.js';

const SEV = {
  critical: { hex: '#ff2222', fill: 0.06, lineW: 2.2 },
  high:     { hex: '#ff6600', fill: 0.04, lineW: 1.8 },
  medium:   { hex: '#ffaa00', fill: 0.03, lineW: 1.4 },
  low:      { hex: '#00ff88', fill: 0.02, lineW: 1.2 },
};

// â”€â”€ Actual geographic polygon outlines for each zone â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Coordinates stored as flat [lon, lat, lon, lat, ...] (closed â€” first === last)
const ZONE_POLYGONS = {

  // Active conflict area â€” eastern Ukraine front line
  ukraine: [
    24.0,49.7, 26.0,50.9, 28.5,51.6, 31.0,51.8, 33.5,51.3,
    36.5,50.4, 39.5,49.0, 40.5,47.8, 39.0,46.8, 37.5,46.5,
    35.0,45.6, 33.0,45.5, 30.5,45.3, 28.0,45.6, 25.5,45.8,
    24.0,47.0, 24.0,49.7,
  ],

  // Gaza Strip + surroundings (~40 km Ã— 12 km)
  gaza: [
    34.21,31.20, 34.28,31.21, 34.40,31.35, 34.52,31.52,
    34.56,31.61, 34.48,31.75, 34.38,31.72, 34.24,31.60,
    34.21,31.42, 34.21,31.20,
  ],

  // Taiwan Strait â€” corridor between mainland China and Taiwan
  taiwan_strait: [
    119.2,21.8, 121.2,21.8, 122.8,24.0, 122.5,26.2,
    119.5,26.2, 118.2,24.5, 119.2,21.8,
  ],

  // South China Sea â€” nine-dash line approximate
  south_cs: [
    109.5,3.4, 116.0,3.5, 121.5,10.0, 121.0,16.0,
    118.5,21.5, 115.0,22.5, 110.5,21.0, 108.0,17.0,
    105.8,10.5, 108.0,6.5, 109.5,3.4,
  ],

  // Red Sea â€” elongated sea body
  red_sea: [
    32.3,29.5, 33.8,27.2, 35.0,25.5, 36.5,23.0,
    38.0,20.0, 39.5,17.5, 41.5,14.5, 43.2,12.2,
    44.0,11.4, 43.5,12.8, 42.0,14.0, 40.5,17.0,
    38.5,20.5, 37.0,23.5, 35.5,25.5, 34.5,27.5,
    33.0,29.5, 32.3,29.5,
  ],

  // Persian Gulf â€” the actual gulf shape
  persiangulf: [
    56.3,24.5, 58.0,22.7, 57.0,22.0, 55.5,22.3,
    53.0,22.8, 51.0,24.0, 48.5,27.0, 47.8,28.5,
    48.5,29.5, 50.0,30.0, 51.5,29.8, 53.5,29.0,
    55.5,26.5, 56.3,24.5,
  ],

  // Strait of Hormuz â€” narrow choke-point corridor
  strait_hormuz: [
    55.5,25.8, 56.2,24.6, 57.5,23.8, 59.0,22.6,
    60.5,22.3, 60.5,23.5, 59.0,24.2, 57.5,24.8,
    56.0,26.2, 55.5,25.8,
  ],

  // Iran â€” approximate country outline
  iran_airspace: [
    44.0,37.5, 46.5,39.3, 48.5,40.3, 50.5,40.4,
    53.5,40.4, 56.0,38.0, 58.5,37.4, 60.5,37.5,
    62.5,36.0, 61.5,34.0, 61.0,31.0, 60.0,28.5,
    58.0,27.0, 57.5,26.5, 55.5,26.2, 54.0,25.7,
    52.0,27.0, 50.5,26.5, 49.0,27.5, 47.5,30.5,
    46.0,33.0, 44.5,36.5, 44.0,37.5,
  ],

  // UAE â€” approximate territory
  uae_op_zone: [
    51.6,24.1, 53.0,24.2, 54.5,24.6, 55.8,25.8,
    56.4,26.6, 56.0,28.0, 55.0,27.2, 53.5,26.4,
    52.0,25.4, 51.6,24.1,
  ],

  // Korean Peninsula â€” roughly North Korea + buffer
  north_korea: [
    124.2,38.0, 125.5,40.2, 127.0,41.8, 129.0,42.3,
    130.5,41.6, 130.5,40.0, 129.5,37.5, 127.0,34.5,
    124.5,34.5, 123.0,36.5, 124.2,38.0,
  ],

  // Syria â€” country outline
  syria: [
    35.7,37.1, 37.5,37.5, 40.5,37.3, 42.5,37.1,
    42.3,35.0, 40.5,34.0, 38.5,33.5, 36.6,33.0,
    35.6,33.5, 35.0,34.5, 35.7,37.1,
  ],

  // Gulf of Aden / Somalia â€” coastal arc
  somalia: [
    41.0,12.0, 45.0,11.5, 50.5,11.5, 51.5,10.5,
    52.0,9.0,  51.5,8.0,  45.0,9.0,  41.0,11.0, 41.0,12.0,
  ],

  // NATO-Russia eastern flank (Baltic states to Arctic)
  russia_border: [
    14.0,54.5, 22.0,54.5, 26.0,57.0, 28.5,60.5,
    30.0,64.0, 28.5,69.5, 24.0,70.0, 22.0,69.0,
    21.0,65.5, 17.0,60.0, 14.0,57.0, 14.0,54.5,
  ],

  // Sahel â€” band across West/Central Africa (insurgency zone)
  sahel: [
    -18.0,10.5, -5.0,8.0,  5.0,9.0,  15.0,12.5,
     25.0,11.5, 35.5,10.0, 42.0,11.5, 42.0,18.0,
     35.0,20.0, 25.0,21.0, 15.0,23.0,  5.0,18.5,
     -5.0,16.0,-18.0,14.0,-18.0,10.5,
  ],

  // Israel–Lebanon front (northern Israel + southern Lebanon)
  israel_north: [
    35.0,33.0, 35.4,33.1, 35.7,33.2, 36.1,33.3, 36.6,33.4,
    36.6,33.9, 36.2,34.2, 35.8,34.5, 35.5,34.6, 35.1,34.5,
    34.9,34.2, 34.7,33.8, 34.7,33.3, 35.0,33.0,
  ],

  // Lebanese airspace
  lebanon: [
    35.1,33.1, 35.5,33.1, 36.0,33.3, 36.6,33.2, 36.6,34.0,
    36.5,34.7, 36.2,35.1, 35.8,35.4, 35.5,35.7, 35.1,35.7,
    35.1,35.1, 34.9,34.7, 34.9,33.6, 35.1,33.1,
  ],

  // Iran nuclear corridor (Natanz / Fordow / Isfahan)
  iran_nuclear: [
    49.5,31.5, 50.5,31.5, 52.5,32.0, 53.5,33.0, 53.5,34.5,
    52.5,35.5, 51.0,35.8, 49.5,35.5, 48.5,34.5, 48.5,33.0,
    49.5,31.5,
  ],

  // Gulf of Aden corridor
  gulf_aden: [
    42.5,10.5, 45.0,10.0, 48.0,10.0, 50.5,11.0, 52.0,11.5,
    52.0,13.0, 50.0,13.0, 46.5,12.5, 43.5,12.5, 41.5,12.0,
    42.5,10.5,
  ],

  // Iraq-Syria border ops zone
  iraq_syria: [
    38.0,31.5, 40.0,31.5, 42.5,32.0, 44.0,33.0, 44.0,35.5,
    42.0,36.5, 39.5,37.0, 37.5,37.0, 36.5,35.5, 37.0,33.5,
    38.0,31.5,
  ],
  // Mar 2026: Iran attacked US base in Kuwait + RAF Akrotiri in Cyprus
  kuwait: [
    46.5,28.5, 48.8,28.5, 49.1,29.0, 49.0,30.1, 47.7,30.1,
    46.5,29.5, 46.5,28.5,
  ],
  cyprus: [
    32.2,34.5, 34.6,34.5, 34.6,35.7, 33.3,35.7, 32.5,35.2,
    32.2,35.0, 32.2,34.5,
  ],
};

/** Approximate geodetic circle fallback for zones without polygon data */
function circlePositions(lat, lon, radiusKm, N = 72) {
  const cosLat = Math.cos(lat * Math.PI / 180);
  const pts = [];
  for (let i = 0; i <= N; i++) {
    const a = (i * 2 * Math.PI) / N;
    pts.push(lon + (radiusKm / (111.32 * cosLat)) * Math.sin(a));
    pts.push(lat + (radiusKm / 111.32) * Math.cos(a));
  }
  return Cesium.Cartesian3.fromDegreesArray(pts);
}

/** Build a small SVG data-URI icon for the zone centre pin */
function centerPinSVG(color) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28">
    <circle cx="14" cy="14" r="11" fill="rgba(8,14,26,0.78)" stroke="${color}" stroke-width="1.8"/>
    <circle cx="14" cy="14" r="4"  fill="${color}" opacity="0.9"/>
    <line x1="14" y1="3"  x2="14" y2="8"  stroke="${color}" stroke-width="1.4" opacity="0.7"/>
    <line x1="14" y1="20" x2="14" y2="25" stroke="${color}" stroke-width="1.4" opacity="0.7"/>
    <line x1="3"  y1="14" x2="8"  y2="14" stroke="${color}" stroke-width="1.4" opacity="0.7"/>
    <line x1="20" y1="14" x2="25" y2="14" stroke="${color}" stroke-width="1.4" opacity="0.7"/>
  </svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}
const _pinCache = {};
function getCenterPin(sev) {
  if (!_pinCache[sev]) _pinCache[sev] = centerPinSVG(SEV[sev]?.hex || '#ff6600');
  return _pinCache[sev];
}

const DangerZoneLayer = ({ viewer, dangerZones, alerts, visible }) => {
  const zoneEntitiesRef  = useRef([]);
  const alertEntitiesRef = useRef([]);
  const dsRef = useRef(null);

  const getDS = useCallback(() => {
    if (!viewer || viewer.isDestroyed()) return null;
    if (dsRef.current && !viewer.dataSources.contains(dsRef.current)) dsRef.current = null;
    if (!dsRef.current) {
      dsRef.current = new Cesium.CustomDataSource('danger_zones');
      viewer.dataSources.add(dsRef.current);
    }
    return dsRef.current;
  }, [viewer]);

  // ── Single unified effect for zones + alerts ─────────────────────────
  // Two separate effects sharing one datasource caused race conditions:
  // each effect could overwrite ds.show set by the other. One effect = no race.
  useEffect(() => {
    if (!viewer) return;
    const ds = getDS();
    if (!ds) return;

    // Always removeAll first — guaranteed clean slate, no stale entities
    ds.entities.removeAll();
    zoneEntitiesRef.current = [];
    alertEntitiesRef.current = [];
    ds.show = visible;

    if (!visible) return; // nothing more to do when layer is toggled off

    // ── Draw danger zones ───────────────────────────────────────────────
    for (const zone of dangerZones) {
      const s   = SEV[zone.severity] || SEV.medium;
      const col = Cesium.Color.fromCssColorString(s.hex);

      const polyCoords = ZONE_POLYGONS[zone.id];
      const positions  = polyCoords
        ? Cesium.Cartesian3.fromDegreesArray(polyCoords)
        : circlePositions(zone.lat, zone.lon, zone.radius);

      // 1. Perimeter polyline (no filled polygon — avoids overlapping fill artifacts)
      try {
        const borderE = ds.entities.add({
          id: `zone-border-${zone.id}`,
          polyline: {
            positions,
            width: s.lineW * 2,
            material: new Cesium.PolylineGlowMaterialProperty({
              color:     col.withAlpha(0.95),
              glowPower: 0.18,
              taperPower: 1.0,
            }),
            clampToGround: false,
            arcType: Cesium.ArcType.NONE,
          },
        });
        zoneEntitiesRef.current.push(borderE);
      } catch { /* skip */ }

      // 2. Centre pin + label
      try {
        const pinE = ds.entities.add({
          id: `zone-pin-${zone.id}`,
          position: Cesium.Cartesian3.fromDegrees(zone.lon, zone.lat, 500),
          billboard: {
            image: getCenterPin(zone.severity),
            width: 26, height: 26,
            verticalOrigin: Cesium.VerticalOrigin.CENTER,
            disableDepthTestDistance: 2e6,
            scaleByDistance: new Cesium.NearFarScalar(5e4, 2.2, 1.5e7, 0.3),
            distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 2e7),
          },
          label: {
            text: zone.name.toUpperCase(),
            font: 'bold 12px "Share Tech Mono", monospace',
            fillColor: col,
            outlineColor: Cesium.Color.BLACK,
            outlineWidth: 3,
            style: Cesium.LabelStyle.FILL_AND_OUTLINE,
            verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
            pixelOffset: new Cesium.Cartesian2(0, -28),
            disableDepthTestDistance: 2e6,
            showBackground: true,
            backgroundColor: new Cesium.Color(0, 0, 0, 0.65),
            backgroundPadding: new Cesium.Cartesian2(7, 4),
            scaleByDistance: new Cesium.NearFarScalar(5e4, 1.8, 1.2e7, 0.15),
          },
        });
        zoneEntitiesRef.current.push(pinE);
      } catch { /* skip */ }
    }

    // ── Draw alert markers ──────────────────────────────────────────────
    for (let i = 0; i < Math.min((alerts || []).length, 20); i++) {
      const alert = alerts[i];
      if (!alert.lat || !alert.lon) continue;
      const s = SEV[alert.severity] || SEV.medium;
      const alertIcon = ALERT_SVG(s.hex);
      try {
        const entity = ds.entities.add({
          id: `alert-${alert.id != null ? alert.id : 'a'}-${i}`,
          position: Cesium.Cartesian3.fromDegrees(alert.lon, alert.lat, 500),
          billboard: {
            image: alertIcon,
            width: 26, height: 26,
            verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
            disableDepthTestDistance: 2e6,
            scaleByDistance: new Cesium.NearFarScalar(5e4, 2.0, 1e7, 0.4),
          },
        });
        entity._alertData = alert;
        entity._milData   = { ...alert, type: 'alert' };
        alertEntitiesRef.current.push(entity);
      } catch { /* skip */ }
    }
  }, [viewer, dangerZones, alerts, visible, getDS]);

  return null;
};

export default DangerZoneLayer;
