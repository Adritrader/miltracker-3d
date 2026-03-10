/**
 * FIRMSLayer – renders NASA FIRMS thermal anomaly hotspots on the globe.
 * Zoom-aware clustering identical to NewsLayer: far away → large fire clusters,
 * close in → individual hotspot pins.
 */

import { useEffect, useRef, useCallback } from 'react';
import * as Cesium from 'cesium';

// ── Fire cluster SVG (count badge) ──────────────────────────────────────────
function fireClusterIcon(count) {
  const fontSize = count > 99 ? 10 : count > 9 ? 11 : 13;
  const label = count > 999 ? '999+' : count > 99 ? '99+' : count;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48">
    <circle cx="24" cy="24" r="23" fill="#ff4400" fill-opacity="0.15" stroke="#ff4400" stroke-width="2"/>
    <circle cx="24" cy="24" r="16" fill="#ff4400" fill-opacity="0.85"/>
    <text x="24" y="29" text-anchor="middle" font-size="${fontSize}"
      font-family="'Courier New',monospace" font-weight="bold" fill="#fff">${label}</text>
  </svg>`;
  return `data:image/svg+xml;base64,${btoa(svg)}`;
}

// Single hotspot pin – orange flame symbol (no emoji in btoa — use SVG path instead)
const SINGLE_PIN = (() => {
  // Flame shape as SVG path, avoids btoa() emoji crash
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28">
    <circle cx="14" cy="14" r="13" fill="#ff6600" fill-opacity="0.18" stroke="#ff6600" stroke-width="1.5"/>
    <path d="M14 6 C14 6 18 10 18 14 C18 17 16.5 18.5 15 18.5 C15.8 17.5 16 16.5 15.5 15.5 C14.5 17 13 17.5 12.5 16 C11.5 17.5 11 19 13 21 C10 20 9 17.5 10 14.5 C9 15.5 8.5 16 8.5 16 C8.5 12 11 8 14 6Z"
      fill="#ff4400" opacity="0.9"/>
  </svg>`;
  return `data:image/svg+xml;base64,${btoa(svg)}`;
})();

const _clusterIconCache = new Map();
function getCachedClusterIcon(count) {
  if (!_clusterIconCache.has(count)) _clusterIconCache.set(count, fireClusterIcon(count));
  return _clusterIconCache.get(count);
}

// ── Grid-based clustering ────────────────────────────────────────────────────
function clusterFIRMS(items, clusterDeg) {
  if (clusterDeg <= 0) {
    return items.map(item => ({ lat: item.lat, lon: item.lon, items: [item], count: 1, topItem: item }));
  }
  const cells = new Map();
  for (const item of items) {
    const key = `${Math.floor(item.lon / clusterDeg)},${Math.floor(item.lat / clusterDeg)}`;
    if (!cells.has(key)) cells.set(key, []);
    cells.get(key).push(item);
  }
  return [...cells.values()].map(group => {
    const lat = group.reduce((s, i) => s + i.lat, 0) / group.length;
    const lon = group.reduce((s, i) => s + i.lon, 0) / group.length;
    return { lat, lon, items: group, count: group.length, topItem: group[0] };
  });
}

// ── Altitude → cluster degree buckets ───────────────────────────────────────
const ALT_BUCKETS = [
  { minAlt: 15e6, deg: 15   },
  { minAlt:  8e6, deg:  8   },
  { minAlt:  4e6, deg:  4   },
  { minAlt:  2e6, deg:  2   },
  { minAlt:  1e6, deg:  1   },
  { minAlt: 5e5,  deg:  0.5 },
  { minAlt: 2e5,  deg:  0.25},
  { minAlt:    0, deg:  0   },
];
function altToClusterDeg(alt) {
  for (const { minAlt, deg } of ALT_BUCKETS) if (alt > minAlt) return deg;
  return 0;
}

export default function FIRMSLayer({ viewer, firms = [], visible = true, onSelect }) {
  const dsRef         = useRef(null);
  const clusterDegRef = useRef(null);
  const rafRef        = useRef(null);

  const getDS = useCallback(() => {
    if (!viewer || viewer.isDestroyed()) return null;
    if (dsRef.current && !viewer.dataSources.contains(dsRef.current)) dsRef.current = null;
    if (!dsRef.current) {
      dsRef.current = new Cesium.CustomDataSource('firms');
      viewer.dataSources.add(dsRef.current);
    }
    return dsRef.current;
  }, [viewer]);

  const buildEntities = useCallback((deg) => {
    if (!viewer) return;
    const ds = getDS();
    if (!ds) return;

    ds.entities.removeAll();
    ds.show = visible;
    if (!visible || firms.length === 0) return;

    const valid = firms.filter(f => f.lat != null && f.lon != null);
    const clusters = clusterFIRMS(valid, deg).slice(0, 300);

    ds.entities.suspendEvents();
    try {
      clusters.forEach((cluster, i) => {
        const isSingle = cluster.count === 1;
        const entity = ds.entities.add({
          id: `firms-${i}`,
          position: Cesium.Cartesian3.fromDegrees(cluster.lon, cluster.lat, 100),
          billboard: {
            image: isSingle ? SINGLE_PIN : getCachedClusterIcon(cluster.count),
            width:  isSingle ? 28 : 48,
            height: isSingle ? 28 : 48,
            verticalOrigin: Cesium.VerticalOrigin.CENTER,
            disableDepthTestDistance: 2e6,
            scaleByDistance: new Cesium.NearFarScalar(1e5, isSingle ? 1.1 : 1.2, 1.5e7, isSingle ? 0.45 : 0.55),
            distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 2e7),
          },
        });
        entity._milData = isSingle
          ? { ...cluster.topItem, type: 'firms' }
          : { type: 'news-cluster', items: cluster.items };
      });
    } finally {
      ds.entities.resumeEvents();
    }
  }, [viewer, firms, visible, getDS]);

  // Initial + data rebuild
  useEffect(() => {
    if (!viewer) return;
    const alt = viewer.camera?.positionCartographic?.height ?? 8e6;
    const deg = altToClusterDeg(alt);
    clusterDegRef.current = deg;
    buildEntities(deg);
  }, [viewer, firms, visible, buildEntities]);

  // Zoom-aware re-cluster on camera move
  useEffect(() => {
    if (!viewer) return;
    const handler = () => {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        const alt = viewer.camera?.positionCartographic?.height ?? 8e6;
        const deg = altToClusterDeg(alt);
        if (deg !== clusterDegRef.current) {
          clusterDegRef.current = deg;
          buildEntities(deg);
        }
      });
    };
    const unsub = viewer.camera.changed.addEventListener(handler);
    return () => {
      cancelAnimationFrame(rafRef.current);
      try { viewer.camera.changed.removeEventListener(handler); } catch (_) {}
    };
  }, [viewer, buildEntities]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cancelAnimationFrame(rafRef.current);
      if (dsRef.current && !dsRef.current.isDestroyed?.()) {
        try { dsRef.current.entities.removeAll(); } catch (_) {}
      }
    };
  }, []);

  return null;
}
