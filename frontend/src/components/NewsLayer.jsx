/**
 * NewsLayer â€“ renders geolocated news events as pins on the globe.
 *
 * Clustering is ZOOM-AWARE:
 *  - Camera far away  â†’ large grid cells, many items bundled
 *  - Camera zooming in â†’ cells shrink, clusters split apart
 *  - Camera very close â†’ no clustering, every item shown individually
 *
 * Altitude â†’ clusterDeg mapping (quantised to avoid re-renders on tiny moves):
 *   > 15 000 km  â†’ 15Â°
 *   > 8 000 km   â†’  8Â°
 *   > 4 000 km   â†’  4Â°
 *   > 2 000 km   â†’  2Â°
 *   > 1 000 km   â†’  1Â°
 *   >   500 km   â†’  0.5Â°
 *   >   200 km   â†’  0.25Â°
 *   â‰¤   200 km   â†’  0   (no clustering â€“ individual pins)
 *
 * Click a single pin  â†’ onSelect(item)
 * Click a cluster pin â†’ onClusterSelect([item, item, â€¦])
 */

import { useEffect, useRef, useCallback } from 'react';
import * as Cesium from 'cesium';
import { NEWS_SVG } from '../utils/icons.js';
import { geocodeNewsItem } from './newsGeocoder.js';

// â”€â”€ Pin color by category â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function getNewsColor(item) {
  const text = (item.title || '').toLowerCase();
  if (/explosion|blast|strike|bomb|attack|missile|kill|dead/.test(text)) return '#ff3b3b';
  if (/aircraft|fighter|drone|airstrike|warplane/.test(text))             return '#ff6600';
  if (/naval|warship|submarine|fleet|vessel/.test(text))                  return '#00aaff';
  if (/military|troops|soldiers|army|forces/.test(text))                  return '#ffaa00';
  return '#00ff88';
}

// â”€â”€ Cluster SVG icon â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function clusterIcon(count, color) {
  const fontSize = count > 99 ? 10 : count > 9 ? 12 : 14;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="46" height="46" viewBox="0 0 46 46">
    <circle cx="23" cy="23" r="22" fill="${color}" fill-opacity="0.18" stroke="${color}" stroke-width="2.5"/>
    <circle cx="23" cy="23" r="15" fill="${color}" fill-opacity="0.90"/>
    <text x="23" y="28" text-anchor="middle" font-size="${fontSize}"
      font-family="'Courier New',monospace" font-weight="bold" fill="#000">${count > 99 ? '99+' : count}</text>
  </svg>`;
  return `data:image/svg+xml;base64,${btoa(svg)}`;
}

// Cache cluster icons to avoid re-encoding on every render
const _iconCache = new Map();
function getCachedClusterIcon(count, color) {
  const key = `${count}_${color}`;
  if (!_iconCache.has(key)) _iconCache.set(key, clusterIcon(count, color));
  return _iconCache.get(key);
}

// â”€â”€ Grid-based clustering â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// clusterDeg = 0 â†’ no clustering (individual pins)
function clusterNews(items, clusterDeg) {
  if (clusterDeg <= 0) {
    return items.map(item => ({
      lat: item.lat, lon: item.lon,
      items: [item], count: 1,
      color: getNewsColor(item), topItem: item,
    }));
  }

  const cells = new Map();
  for (const item of items) {
    const cx  = Math.floor(item.lon / clusterDeg);
    const cy  = Math.floor(item.lat / clusterDeg);
    const key = `${cx},${cy}`;
    if (!cells.has(key)) cells.set(key, []);
    cells.get(key).push(item);
  }

  const priority = (item) => {
    const t = (item.title || '').toLowerCase();
    if (/explosion|blast|strike|bomb|attack|missile|kill|dead/.test(t)) return 5;
    if (/aircraft|fighter|drone|airstrike|warplane/.test(t))             return 4;
    if (/naval|warship|submarine|fleet|vessel/.test(t))                  return 3;
    if (/military|troops|soldiers|army|forces/.test(t))                  return 2;
    return 1;
  };

  return [...cells.values()].map(group => {
    const lat = group.reduce((s, i) => s + i.lat, 0) / group.length;
    const lon = group.reduce((s, i) => s + i.lon, 0) / group.length;
    const top = [...group].sort((a, b) => priority(b) - priority(a))[0];
    return { lat, lon, items: group, count: group.length, color: getNewsColor(top), topItem: top };
  });
}

// â”€â”€ Camera altitude â†’ cluster degree (quantised buckets) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Fewer buckets = fewer unnecessary re-renders while still feeling responsive.
const ALT_BUCKETS = [
  { minAlt: 15e6, deg: 15   },   // > 15 000 km  (full-globe view)
  { minAlt:  8e6, deg:  8   },   // > 8 000 km
  { minAlt:  4e6, deg:  4   },   // > 4 000 km
  { minAlt:  2e6, deg:  2   },   // > 2 000 km
  { minAlt:  1e6, deg:  1   },   // > 1 000 km
  { minAlt: 5e5,  deg:  0.5 },   // > 500 km
  { minAlt: 2e5,  deg:  0.25},   // > 200 km
  { minAlt:    0, deg:  0   },   // â‰¤ 200 km  â†’ individual pins
];

function altToClusterDeg(altMetres) {
  for (const { minAlt, deg } of ALT_BUCKETS) {
    if (altMetres > minAlt) return deg;
  }
  return 0;
}

function getCameraAlt(viewer) {
  try {
    return viewer.camera.positionCartographic?.height ?? 8e6;
  } catch { return 8e6; }
}

// â”€â”€ Component â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const NewsLayer = ({ viewer, news, visible, onSelect, onClusterSelect, isMobile = false }) => {
  const entityMapRef  = useRef(new Map());
  const dsRef         = useRef(null);
  const clusterDegRef = useRef(null); // last rendered bucket

  const getDS = useCallback(() => {
    if (!viewer || viewer.isDestroyed()) return null;
    if (dsRef.current && !viewer.dataSources.contains(dsRef.current)) {
      dsRef.current = null;
    }
    if (!dsRef.current) {
      dsRef.current = new Cesium.CustomDataSource('news');
      viewer.dataSources.add(dsRef.current);
    }
    return dsRef.current;
  }, [viewer]);

  // F-C3: Remove DataSource on unmount
  useEffect(() => {
    return () => {
      if (!viewer || viewer.isDestroyed()) return;
      if (dsRef.current) {
        try { viewer.dataSources.remove(dsRef.current, true); } catch (_) {}
        dsRef.current = null;
      }
    };
  }, [viewer]);

  // â”€â”€ Build / rebuild all news entities for a given clusterDeg â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const buildEntities = useCallback((deg) => {
    if (!viewer) return;
    const ds = getDS();
    if (!ds) return;

    ds.entities.removeAll();
    entityMapRef.current.clear();
    ds.show = visible;

    if (!visible) return;

    const geoItems = news
      .map(geocodeNewsItem)
      .filter(n => n.lat && n.lon)
      .slice(0, 400);

    const maxClusters = deg <= 0 ? 250 : 150;
    const clusters = clusterNews(geoItems, deg).slice(0, maxClusters);

    // Larger icons on touch devices for easier tapping
    const singleW  = isMobile ? 40 : 32;
    const singleH  = isMobile ? 40 : 32;
    const clusterW = isMobile ? 56 : 46;
    const clusterH = isMobile ? 56 : 46;

    ds.entities.suspendEvents();
    try {
      for (let _i = 0; _i < clusters.length; _i++) {
        const cluster  = clusters[_i];
        const isSingle = cluster.count === 1;
        const item     = cluster.topItem;
        const color    = cluster.color;
        const safeId   = `news-cluster-${_i}`;

        const entity = ds.entities.add({
          id: safeId,
          position: Cesium.Cartesian3.fromDegrees(cluster.lon, cluster.lat, 200),
          billboard: {
            image: isSingle
              ? NEWS_SVG(color)
              : getCachedClusterIcon(cluster.count, color),
            width:  isSingle ? singleW : clusterW,
            height: isSingle ? singleH : clusterH,
            verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
            disableDepthTestDistance: 2e6,
            scaleByDistance: new Cesium.NearFarScalar(1e5, isSingle ? 1.1 : 1.2, 1.5e7, isSingle ? 0.5 : 0.6),
            distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 2e7),
          },
        });
        entity._newsCluster = cluster;
        entity._newsData    = isSingle ? item : null;
        // §0.18: always set _milData so Globe3D's single handler can route the click.
        // For clusters, Globe3D will call onEntityClick({ type:'news-cluster', items:[...] })
        // and App.jsx handleEntityClick will open the cluster modal.
        entity._milData     = isSingle
          ? { ...item, type: 'news' }
          : { type: 'news-cluster', items: cluster.items };
        entityMapRef.current.set(safeId, entity);
      }
    } finally {
      ds.entities.resumeEvents();
    }
  }, [viewer, news, visible, getDS, isMobile]);

  // â”€â”€ Visibility toggle â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // §0.1: Separate visibility effect removed — buildEntities already
  // handles visibility by clearing entities when !visible (no race possible).
  // â”€â”€ Rebuild when news data or viewer changes â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  useEffect(() => {
    if (!viewer) return;
    const deg = altToClusterDeg(getCameraAlt(viewer));
    clusterDegRef.current = deg;
    buildEntities(deg);
  }, [viewer, news, buildEntities]);

  // â”€â”€ Camera moveEnd â†’ re-cluster only when bucket changes â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  useEffect(() => {
    if (!viewer || viewer.isDestroyed()) return;

    const onMoveEnd = () => {
      const newDeg = altToClusterDeg(getCameraAlt(viewer));
      if (newDeg === clusterDegRef.current) return; // same bucket â€” skip
      clusterDegRef.current = newDeg;
      buildEntities(newDeg);
    };

    viewer.camera.moveEnd.addEventListener(onMoveEnd);
    return () => {
      if (!viewer.isDestroyed()) viewer.camera.moveEnd.removeEventListener(onMoveEnd);
    };
  }, [viewer, buildEntities]);

  // ── Click selection handled centrally by Globe3D (§0.18) ──────────────────
  // _milData is set on both single-item and cluster entities above so Globe3D's
  // screenSpaceEventHandler picks every click and App.jsx routes accordingly.

  return null;
};

export default NewsLayer;
