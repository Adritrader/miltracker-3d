/**
 * NewsLayer – renders geolocated news events as pins on the globe
 * Similar to liveuamap.com style markers
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

const NewsLayer = ({ viewer, news, visible, onSelect }) => {
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

    // Clear all news entities and re-render (news items change frequently)
    ds.entities.removeAll();
    entityMapRef.current.clear();

    if (!visible) return;

    // Filter only geolocated news
    const geoNews = news
      .map(geocodeNewsItem)
      .filter(n => n.lat && n.lon)
      .slice(0, 80); // limit to 80 pins for performance

    for (let _i = 0; _i < geoNews.length; _i++) {
      const item = geoNews[_i];
      const color = getNewsColor(item);
      const iconUri = NEWS_SVG(color);
      // Use index suffix to prevent duplicate IDs when item.id is undefined
      const safeId = `news-${item.id != null ? item.id : 'g'}-${_i}`;
      let entity;
      try {
      entity = ds.entities.add({
        id: safeId,
        position: Cesium.Cartesian3.fromDegrees(item.lon, item.lat, 200),
        billboard: {
          image: iconUri,
          width: 32,
          height: 32,
          verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
          scaleByDistance: new Cesium.NearFarScalar(2e5, 0.8, 1.5e7, 1.6),
          distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 1.8e7),
        },
        label: {
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
        },
      });
      } catch { continue; }
      entity._newsData = item;
      entity._milData  = { ...item, type: 'news' };
      entityMapRef.current.set(safeId, entity);
    }
  }, [viewer, news, visible, getDS]);

  // Click selection
  useEffect(() => {
    if (!viewer || viewer.isDestroyed() || !onSelect) return;
    const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
    handler.setInputAction((click) => {
      const picked = viewer.scene.pick(click.position);
      if (picked?.id?._newsData) onSelect(picked.id._newsData);
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
    return () => { if (!handler.isDestroyed()) handler.destroy(); };
  }, [viewer, onSelect]);

  return null;
};

export default NewsLayer;
