/**
 * ConflictLayer – renders real-world conflict events on the globe
 * Style inspired by liveuamap.com: each event type has its own icon/color.
 */

import { useEffect, useRef, useCallback } from 'react';
import * as Cesium from 'cesium';
import { isValidCoord, timeAgo } from '../utils/geoUtils.js';

// Professional military-style event type config — no emojis, pure geometry
const EVENT_STYLE = {
  airstrike:  { color: '#ff5500', scale: 1.0 },
  missile:    { color: '#ff2200', scale: 1.1 },
  explosion:  { color: '#ff7700', scale: 0.95 },
  artillery:  { color: '#ffaa00', scale: 0.9 },
  drone:      { color: '#cc44ff', scale: 0.95 },
  naval:      { color: '#0099ff', scale: 0.9 },
  troops:     { color: '#ffdd00', scale: 0.85 },
  conflict:   { color: '#ff6600', scale: 0.8 },
};

const SEVERITY_RING = {
  critical: '#ff0000',
  high:     '#ff4400',
  medium:   '#ff8800',
  low:      '#ffcc00',
};

// Cache canvas-drawn icons keyed by type_severity
const _iconCache = new Map();

/**
 * Draw a pure-geometry military symbol inside ctx.
 * All shapes use only lines, arcs, and polygons — zero emoji / text.
 */
function drawSymbol(ctx, type, cx, cy, r, color) {
  ctx.strokeStyle = color;
  ctx.fillStyle   = color;
  ctx.lineWidth   = Math.max(1.5, r * 0.13);
  ctx.lineJoin    = 'round';
  ctx.lineCap     = 'round';
  ctx.globalAlpha = 1;

  switch (type) {

    // ── Airstrike: top-down attack aircraft (delta wing pointing down) ───────
    case 'airstrike': {
      // Fuselage
      ctx.beginPath();
      ctx.moveTo(cx,           cy - r * 0.85); // nose
      ctx.lineTo(cx + r * 0.2, cy + r * 0.1);
      ctx.lineTo(cx,           cy + r * 0.45); // tail centre
      ctx.lineTo(cx - r * 0.2, cy + r * 0.1);
      ctx.closePath();
      ctx.fill();
      // Left wing
      ctx.beginPath();
      ctx.moveTo(cx - r * 0.18, cy - r * 0.05);
      ctx.lineTo(cx - r * 0.9,  cy + r * 0.55);
      ctx.lineTo(cx - r * 0.05, cy + r * 0.15);
      ctx.closePath();
      ctx.fill();
      // Right wing
      ctx.beginPath();
      ctx.moveTo(cx + r * 0.18, cy - r * 0.05);
      ctx.lineTo(cx + r * 0.9,  cy + r * 0.55);
      ctx.lineTo(cx + r * 0.05, cy + r * 0.15);
      ctx.closePath();
      ctx.fill();
      // Tail fins
      ctx.beginPath();
      ctx.moveTo(cx - r * 0.1, cy + r * 0.35);
      ctx.lineTo(cx - r * 0.4, cy + r * 0.75);
      ctx.lineTo(cx,            cy + r * 0.45);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(cx + r * 0.1, cy + r * 0.35);
      ctx.lineTo(cx + r * 0.4, cy + r * 0.75);
      ctx.lineTo(cx,            cy + r * 0.45);
      ctx.closePath();
      ctx.fill();
      break;
    }

    // ── Missile: slim rocket body with nose cone and fins ──────────────────
    case 'missile': {
      const bw = r * 0.18; // half body width
      // Body
      ctx.beginPath();
      ctx.rect(cx - bw, cy - r * 0.55, bw * 2, r * 1.05);
      ctx.fill();
      // Nose cone (triangle)
      ctx.beginPath();
      ctx.moveTo(cx - bw, cy - r * 0.55);
      ctx.lineTo(cx,       cy - r * 1.05);
      ctx.lineTo(cx + bw, cy - r * 0.55);
      ctx.closePath();
      ctx.fill();
      // Left fin
      ctx.beginPath();
      ctx.moveTo(cx - bw, cy + r * 0.4);
      ctx.lineTo(cx - r * 0.55, cy + r * 0.9);
      ctx.lineTo(cx - bw, cy + r * 0.55);
      ctx.closePath();
      ctx.fill();
      // Right fin
      ctx.beginPath();
      ctx.moveTo(cx + bw, cy + r * 0.4);
      ctx.lineTo(cx + r * 0.55, cy + r * 0.9);
      ctx.lineTo(cx + bw, cy + r * 0.55);
      ctx.closePath();
      ctx.fill();
      break;
    }

    // ── Explosion: 8-spike starburst ─────────────────────────────────────
    case 'explosion': {
      const spikes = 8;
      ctx.beginPath();
      for (let i = 0; i < spikes * 2; i++) {
        const angle = (i * Math.PI) / spikes - Math.PI / 2;
        const rad   = i % 2 === 0 ? r * 0.95 : r * 0.42;
        const x = cx + Math.cos(angle) * rad;
        const y = cy + Math.sin(angle) * rad;
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fill();
      // Inner brighter core
      ctx.globalAlpha = 0.4;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.28, 0, Math.PI * 2);
      ctx.fill();
      break;
    }

    // ── Artillery: cannon barrel aimed upper-right + spoked wheel ──────────
    case 'artillery': {
      const wx  = cx - r * 0.3;    // wheel centre x
      const wy  = cy + r * 0.35;   // wheel centre y
      const wr  = r * 0.38;        // wheel radius
      // Wheel rim
      ctx.beginPath();
      ctx.arc(wx, wy, wr, 0, Math.PI * 2);
      ctx.stroke();
      // Spokes (4)
      for (let i = 0; i < 4; i++) {
        const a = (i * Math.PI) / 4;
        ctx.beginPath();
        ctx.moveTo(wx + Math.cos(a) * wr * 0.9, wy + Math.sin(a) * wr * 0.9);
        ctx.lineTo(wx - Math.cos(a) * wr * 0.9, wy - Math.sin(a) * wr * 0.9);
        ctx.stroke();
      }
      // Barrel (rotated rectangle: 45° upper-right)
      ctx.save();
      ctx.translate(cx + r * 0.05, cy - r * 0.05);
      ctx.rotate(-Math.PI / 4);
      ctx.beginPath();
      ctx.rect(-r * 0.09, -r * 0.65, r * 0.18, r * 0.72);
      ctx.fill();
      ctx.restore();
      // Carriage trail (line from wheel to lower-left)
      ctx.beginPath();
      ctx.moveTo(wx + wr * 0.7, wy);
      ctx.lineTo(cx + r * 0.5, cy + r * 0.55);
      ctx.stroke();
      break;
    }

    // ── Drone: X-frame quadrotor with propeller circles ───────────────────
    case 'drone': {
      const armLen = r * 0.78;
      const propR  = r * 0.25;
      const arms   = [45, 135, 225, 315];
      // Arms
      for (const deg of arms) {
        const a = (deg * Math.PI) / 180;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(a) * armLen, cy + Math.sin(a) * armLen);
        ctx.stroke();
      }
      // Propeller circles
      for (const deg of arms) {
        const a = (deg * Math.PI) / 180;
        ctx.beginPath();
        ctx.arc(cx + Math.cos(a) * armLen, cy + Math.sin(a) * armLen, propR, 0, Math.PI * 2);
        ctx.stroke();
      }
      // Centre body (filled square rotated 45°)
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(Math.PI / 4);
      ctx.beginPath();
      ctx.rect(-r * 0.2, -r * 0.2, r * 0.4, r * 0.4);
      ctx.fill();
      ctx.restore();
      break;
    }

    // ── Naval: top-down warship hull silhouette ─────────────────────────
    case 'naval': {
      // Outer hull
      ctx.beginPath();
      ctx.moveTo(cx,           cy - r * 0.95); // bow
      ctx.bezierCurveTo(cx + r * 0.55, cy - r * 0.55, cx + r * 0.5, cy + r * 0.45, cx, cy + r * 0.85);
      ctx.bezierCurveTo(cx - r * 0.5,  cy + r * 0.45, cx - r * 0.55, cy - r * 0.55, cx, cy - r * 0.95);
      ctx.closePath();
      ctx.globalAlpha = 0.9;
      ctx.fill();
      // Superstructure (darker rectangle)
      ctx.globalAlpha = 0.55;
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.ellipse(cx, cy, r * 0.22, r * 0.38, 0, 0, Math.PI * 2);
      ctx.fill();
      // Mast (line)
      ctx.globalAlpha = 0.9;
      ctx.strokeStyle = color;
      ctx.lineWidth = Math.max(1.2, r * 0.08);
      ctx.beginPath();
      ctx.moveTo(cx, cy - r * 0.35);
      ctx.lineTo(cx, cy - r * 0.78);
      ctx.stroke();
      // Cross-yard
      ctx.beginPath();
      ctx.moveTo(cx - r * 0.18, cy - r * 0.6);
      ctx.lineTo(cx + r * 0.18, cy - r * 0.6);
      ctx.stroke();
      break;
    }

    // ── Troops: NATO-style infantry box ────────────────────────────────
    case 'troops': {
      // NATO APP-6 ground unit: rectangle with X inside
      const bw = r * 0.72;
      const bh = r * 0.48;
      ctx.beginPath();
      ctx.rect(cx - bw, cy - bh, bw * 2, bh * 2);
      ctx.stroke();
      // Diagonal cross inside (infantry symbol)
      ctx.beginPath();
      ctx.moveTo(cx - bw, cy - bh);
      ctx.lineTo(cx + bw, cy + bh);
      ctx.moveTo(cx + bw, cy - bh);
      ctx.lineTo(cx - bw, cy + bh);
      ctx.stroke();
      break;
    }

    // ── Conflict / generic: warning diamond ────────────────────────────
    default: {
      // Diamond outline
      ctx.beginPath();
      ctx.moveTo(cx,       cy - r);
      ctx.lineTo(cx + r,   cy);
      ctx.lineTo(cx,       cy + r);
      ctx.lineTo(cx - r,   cy);
      ctx.closePath();
      ctx.globalAlpha = 0.85;
      ctx.fill();
      // Vertical bar (!) inside
      ctx.fillStyle = '#000';
      ctx.globalAlpha = 0.75;
      ctx.beginPath();
      ctx.rect(cx - r * 0.1, cy - r * 0.48, r * 0.2, r * 0.6);
      ctx.fill();
      // Dot below bar
      ctx.beginPath();
      ctx.arc(cx, cy + r * 0.32, r * 0.1, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
  }
}

function buildIcon(type, severity) {
  const key = `${type}_${severity}`;
  if (_iconCache.has(key)) return _iconCache.get(key);

  const style     = EVENT_STYLE[type] || EVENT_STYLE.conflict;
  const ringColor = SEVERITY_RING[severity] || SEVERITY_RING.medium;
  const typeColor = style.color;
  const size = 52;
  const cx   = size / 2;
  const cy   = size / 2;
  const r    = size * 0.34;

  const canvas = document.createElement('canvas');
  canvas.width  = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  // ── Subtle shadow glow (improves legibility on terrain) ─────────────
  ctx.shadowColor = ringColor;
  ctx.shadowBlur  = 8;

  // ── Minimal dark halo — just enough contrast, not a filled disc ──────
  // Draw a small semi-transparent circle only directly behind the symbol
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.88, 0, Math.PI * 2);
  ctx.fillStyle   = 'rgba(6, 10, 22, 0.58)';
  ctx.globalAlpha = 1;
  ctx.fill();
  ctx.shadowBlur = 0;

  // ── Severity ring: thin arc, top-right quadrant emphasised ───────────
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.95, -Math.PI * 0.1, Math.PI * 1.9);
  ctx.strokeStyle = ringColor;
  ctx.lineWidth   = 2;
  ctx.globalAlpha = 0.9;
  ctx.stroke();

  // ── Type symbol (drawn over everything) ──────────────────────────────
  ctx.globalAlpha = 1;
  ctx.shadowColor = typeColor;
  ctx.shadowBlur  = 4;
  drawSymbol(ctx, type, cx, cy, r * 0.78, typeColor);
  ctx.shadowBlur = 0;

  const uri = canvas.toDataURL();
  _iconCache.set(key, uri);
  return uri;
}

const ConflictLayer = ({ viewer, conflicts, visible, onSelect }) => {
  const entityMapRef = useRef(new Map());
  const dsRef        = useRef(null);

  const getDS = useCallback(() => {
    if (!viewer || viewer.isDestroyed()) return null;
    if (dsRef.current && !viewer.dataSources.contains(dsRef.current)) {
      dsRef.current = null;
    }
    if (!dsRef.current) {
      dsRef.current = new Cesium.CustomDataSource('conflicts');
      viewer.dataSources.add(dsRef.current);
    }
    return dsRef.current;
  }, [viewer]);

  // visibility toggle
  useEffect(() => {
    if (!viewer) return;
    const ds = getDS();
    if (ds) ds.show = visible;
  }, [viewer, visible, getDS]);

  // render / update entities
  useEffect(() => {
    if (!viewer) return;
    const ds = getDS();
    if (!ds) return;

    ds.entities.removeAll();
    entityMapRef.current.clear();

    if (!visible || !conflicts.length) return;

    ds.entities.suspendEvents();
    try {
      for (let _ci = 0; _ci < conflicts.length; _ci++) {
        const ev = conflicts[_ci];
        if (!isValidCoord(ev.lat, ev.lon)) continue;

        const icon = buildIcon(ev.type || 'conflict', ev.severity || 'medium');
        const style = EVENT_STYLE[ev.type] || EVENT_STYLE.conflict;
        const ringColor = SEVERITY_RING[ev.severity] || SEVERITY_RING.medium;
        // Unique ID even when ev.id is undefined
        const safeId = `conflict-${ev.id != null ? ev.id : 'g'}-${_ci}`;

        let entity;
        try { entity = ds.entities.add({
          id:       safeId,
          position: Cesium.Cartesian3.fromDegrees(ev.lon, ev.lat, 0),
          billboard: {
            image:  icon,
            width:  Math.round(42 * style.scale),
            height: Math.round(42 * style.scale),
            verticalOrigin:   Cesium.VerticalOrigin.BOTTOM,
            horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
            scaleByDistance:  new Cesium.NearFarScalar(2e5, 0.8, 1.5e7, 1.6),
            distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 1.2e7),
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
          },
          label: {
            text:   (ev.type || 'event').toUpperCase(),
            font:   '11px "Share Tech Mono", monospace',
            fillColor: Cesium.Color.fromCssColorString(ringColor),
            outlineColor: Cesium.Color.fromCssColorString('#000'),
            outlineWidth: 2,
            style:  Cesium.LabelStyle.FILL_AND_OUTLINE,
            verticalOrigin: Cesium.VerticalOrigin.TOP,
            pixelOffset: new Cesium.Cartesian2(0, 4),
            scaleByDistance: new Cesium.NearFarScalar(5e4, 1.1, 3e6, 0.0),
            showBackground: true,
            backgroundColor: new Cesium.Color(0, 0, 0, 0.6),
            backgroundPadding: new Cesium.Cartesian2(4, 2),
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
          },
        }); } catch { continue; }
        entity._milData = { ...ev, type: 'conflict' };
        entityMapRef.current.set(safeId, entity);
      }
    } finally {
      ds.entities.resumeEvents();
    }
  }, [viewer, conflicts, visible, getDS]);

  // click selection
  useEffect(() => {
    if (!viewer || viewer.isDestroyed() || !onSelect) return;
    const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
    handler.setInputAction((click) => {
      const picked = viewer.scene.pick(click.position);
      if (Cesium.defined(picked?.id?._milData)) {
        const d = picked.id._milData;
        if (d.type === 'conflict') onSelect(d);
      }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
    return () => { if (!handler.isDestroyed()) handler.destroy(); };
  }, [viewer, onSelect]);

  return null;
};

export default ConflictLayer;
