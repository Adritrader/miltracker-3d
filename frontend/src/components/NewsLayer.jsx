/**
 * NewsLayer – renders geolocated news events as pins on the globe.
 * Nearby items are CLUSTERED into a single badge marker (count shown).
 * Click a single pin  → onSelect(item)
 * Click a cluster pin → onClusterSelect([item, item, …])
 */

import { useEffect, useRef, useCallback } from 'react';
import * as Cesium from 'cesium';
import { NEWS_SVG } from '../utils/icons.js';
import { geocodeNewsItem } from './newsGeocoder.js';

// Pin color by category
function getNewsColor(item) {
  const text = (item.title || '').toLowerCase();
  if (/explosion|blast|strike|bomb|attack|missile|kill|dead/.test(text)) return '#ff3b3b';
  if (/aircraft|fighter|drone|airstrike|warplane/.test(text)) return '#ff6600';
  if (/naval|warship|submarine|fleet|vessel/.test(text)) return '#00aaff';
  if (/military|troops|soldiers|army|forces/.test(text)) return '#ffaa00';
  return '#00ff88';
}

// ── Cluster SVG icon with count badge ────────────────────────────────────────
function clusterIcon(count, color) {
  const fontSize = count > 99 ? 10 : count > 9 ? 12 : 14;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="46" height="46" viewBox="0 0 46 46">
    <circle cx="23" cy="23" r="22" fill="${color}" fill-opacity="0.18" stroke="${color}" stroke-width="2.5"/>
    <circle cx="23" cy="23" r="15" fill="${color}" fill-opacity="0.90"/>
    <text x="23" y="28" text-anchor="middle" font-size="${fontSize}" font-family="'Courier New',monospace" font-weight="bold" fill="#000">${count > 99 ? '99+' : count}</text>
  </svg>`;
  return `data:image/svg+xml;base64,${btoa(svg)}`;
}

// ── Grid-based clustering ─────────────────────────────────────────────────────
// Groups items whose centres fall in the same grid cell (clusterDeg × clusterDeg).
// Returns an array of cluster objects: { lat, lon, items[], count, color }
function clusterNews(items, clusterDeg = 2.0) {
  const cells = new Map();
  for (const item of items) {
    const cx = Math.floor(item.lon / clusterDeg);
    const cy = Math.floor(item.lat / clusterDeg);
    const key = `${cx},${cy}`;
    if (!cells.has(key)) cells.set(key, []);
    cells.get(key).push(item);
  }
  return [...cells.values()].map(group => {
    // Cluster centre = average position
    const lat = group.reduce((s, i) => s + i.lat, 0) / group.length;
    const lon = group.reduce((s, i) => s + i.lon, 0) / group.length;
    // Dominant color = highest priority item
    const priority = (item) => {
      const t = (item.title || '').toLowerCase();
      if (/explosion|blast|strike|bomb|attack|missile|kill|dead/.test(t)) return 5;
      if (/aircraft|fighter|drone|airstrike|warplane/.test(t)) return 4;
      if (/naval|warship|submarine|fleet|vessel/.test(t)) return 3;
      if (/military|troops|soldiers|army|forces/.test(t)) return 2;
      return 1;
    };
    const top = [...group].sort((a, b) => priority(b) - priority(a))[0];
    return { lat, lon, items: group, count: group.length, color: getNewsColor(top), topItem: top };
  });
}

const NewsLayer = ({ viewer, news, visible, onSelect, onClusterSelect }) => {
  const entityMapRef = useRef(new Map());
  const dsRef = useRef(null);

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

  useEffect(() => {
    if (!viewer) return;
    const ds = getDS();
    if (!ds) return;
    ds.show = visible;
  }, [viewer, visible, getDS]);

  useEffect(() => {
    if (!viewer) return;
    const ds = getDS();
    if (!ds) return;

    ds.entities.removeAll();
    entityMapRef.current.clear();

    if (!visible) return;

    const geoItems = news
      .map(geocodeNewsItem)
      .filter(n => n.lat && n.lon)
      .slice(0, 300);

    const clusters = clusterNews(geoItems, 2.0).slice(0, 120);

    for (let _i = 0; _i < clusters.length; _i++) {
      const cluster = clusters[_i];
      const isSingle = cluster.count === 1;
      const item = cluster.topItem;
      const color = cluster.color;
      const safeId = `news-cluster-${_i}`;

      try {
        const entity = ds.entities.add({
          id: safeId,
          position: Cesium.Cartesian3.fromDegrees(cluster.lon, cluster.lat, 200),
          billboard: {
            image: isSingle ? NEWS_SVG(color) : clusterIcon(cluster.count, color),
            width:  isSingle ? 32 : 46,
            height: isSingle ? 32 : 46,
            verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
            scaleByDistance: new Cesium.NearFarScalar(2e5, 0.8, 1.5e7, isSingle ? 1.6 : 1.8),
            distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 2e7),
          },
          label: isSingle ? {
            text: item.title?.slice(0, 45) + (item.title?.length > 45 ? '\u2026' : ''),
            font: 'bold 12px "Share Tech Mono", monospace',
            fillColor: Cesium.Color.fromCssColorString(color),
            outlineColor: Cesium.Color.BLACK,
            outlineWidth: 3,
            style: Cesium.LabelStyle.FILL_AND_OUTLINE,
            verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
            pixelOffset: new Cesium.Cartesian2(0, -30),
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
            scaleByDistance: new Cesium.NearFarScalar(1e4, 1.2, 4e6, 0.0),
            showBackground: true,
            backgroundColor: new Cesium.Color(0, 0, 0, 0.55),
            backgroundPadding: new Cesium.Cartesian2(5, 3),
          } : undefined,
        });
        entity._newsCluster = cluster;
        entity._newsData   = isSingle ? item : null;
        entity._milData    = isSingle ? { ...item, type: 'news' } : null;
        entityMapRef.current.set(safeId, entity);
      } catch { continue; }
    }
  }, [viewer, news, visible, getDS]);

  // Click handling — single → onSelect, cluster → onClusterSelect
  useEffect(() => {
    if (!viewer || viewer.isDestroyed()) return;
    const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
    handler.setInputAction((click) => {
      const picked = viewer.scene.pick(click.position);
      if (!picked?.id) return;
      const cluster = picked.id._newsCluster;
      if (!cluster) return;
      if (cluster.count === 1) {
        onSelect?.(cluster.topItem);
      } else {
        onClusterSelect?.(cluster.items);
      }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
    return () => { if (!handler.isDestroyed()) handler.destroy(); };
  }, [viewer, onSelect, onClusterSelect]);

  return null;
};

export default NewsLayer;

