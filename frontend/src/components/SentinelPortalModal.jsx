/**
 * SentinelPortalModal – Satellite imagery portal for a given lat/lon
 * Uses NASA GIBS WMS API directly as <img> tags (CORS-open, no iframe blocking)
 * Provides "Open ↗" links to full external portals.
 */

import React, { useState, useMemo } from 'react';

/* ── GIBS WMS endpoint (CORS-open, returns actual JPEG imagery) ─────────── */
const GIBS_WMS = 'https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi';

const SOURCES = [
  {
    id: 'viirs',
    label: '🟢 VIIRS TRUE COLOR',
    desc: '375m · Daily · NOAA-21 VIIRS',
    layer: 'VIIRS_NOAA21_CorrectedReflectance_TrueColor',
    extUrl: (lat, lon) => {
      const deg = 1.2;
      const v = `${(lon-deg).toFixed(3)},${(lat-deg*0.7).toFixed(3)},${(lon+deg).toFixed(3)},${(lat+deg*0.7).toFixed(3)}`;
      return `https://worldview.earthdata.nasa.gov/?p=geographic&l=VIIRS_NOAA21_CorrectedReflectance_TrueColor,Coastlines_15m&t=${new Date().toISOString().split('T')[0]}&z=6&v=${v}`;
    },
  },
  {
    id: 'modis',
    label: '🟠 MODIS TRUE COLOR',
    desc: '250m · Daily · NASA Terra',
    layer: 'MODIS_Terra_CorrectedReflectance_TrueColor',
    extUrl: (lat, lon) => {
      const deg = 1.2;
      const v = `${(lon-deg).toFixed(3)},${(lat-deg*0.7).toFixed(3)},${(lon+deg).toFixed(3)},${(lat+deg*0.7).toFixed(3)}`;
      return `https://worldview.earthdata.nasa.gov/?p=geographic&l=MODIS_Terra_CorrectedReflectance_TrueColor,Coastlines_15m&t=${new Date().toISOString().split('T')[0]}&z=6&v=${v}`;
    },
  },
];

/* Build a GIBS WMS GetMap URL → returns a real JPEG satellite image.
 * Notes:
 * - CRS:84 = lon/lat axis order (needed for WMS 1.3.0 — avoids EPSG:4326 flip)
 * - Fire layer is transparent: combine with background layer
 * - GIBS has ~24h lag: yesterday is the safest date for daily products */
function buildGibsUrl(layers, lat, lon, dateStr, deg = 1.5) {
  const latMin = (lat - deg * 0.75).toFixed(4);
  const latMax = (lat + deg * 0.75).toFixed(4);
  const lonMin = (lon - deg).toFixed(4);
  const lonMax = (lon + deg).toFixed(4);
  const layerStr = Array.isArray(layers) ? layers.join(',') : layers;
  const params = new URLSearchParams({
    SERVICE: 'WMS', REQUEST: 'GetMap', VERSION: '1.3.0',
    LAYERS: layerStr,
    STYLES: '',
    CRS: 'CRS:84',
    BBOX: `${lonMin},${latMin},${lonMax},${latMax}`,
    WIDTH: '900', HEIGHT: '600',
    FORMAT: 'image/jpeg',
    TRANSPARENT: 'false',
    TIME: dateStr,
  });
  return `${GIBS_WMS}?${params.toString()}`;
}

/* Day-offset picker: 0 = today, 1 = yesterday, etc. */
const DAY_OPTIONS = [
  { label: 'TODAY',      offset: 0 },
  { label: 'YESTERDAY',  offset: 1 },
  { label: '3 DAYS AGO', offset: 3 },
  { label: '7 DAYS AGO', offset: 7 },
];
function offsetDate(offset) {
  const d = new Date(Date.now() - offset * 86400 * 1000);
  return d.toISOString().split('T')[0];
}

const SentinelPortalModal = ({ lat, lon, title, onClose }) => {
  const [source,  setSource]  = useState('viirs');
  const [dayOff,  setDayOff]  = useState(1);
  const [imgError, setImgError] = useState(false);

  const sourceDef = SOURCES.find(s => s.id === source);
  const dateStr   = offsetDate(dayOff);

  // GIBS image URL
  const imgUrl = useMemo(() => {
    if (!lat || !lon || !sourceDef?.layer) return null;
    return buildGibsUrl(sourceDef.layer, lat, lon, dateStr);
  }, [lat, lon, sourceDef, dateStr]);

  // Reset error when source or date changes
  React.useEffect(() => setImgError(false), [imgUrl]);

  if (!lat || !lon) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[60]"
        style={{ background: 'rgba(0,0,0,0.72)' }}
        onClick={onClose}
      />

      {/* Centering overlay */}
      <div
        className="fixed z-[61] flex items-center justify-center pointer-events-none"
        style={{ top: 72, left: 0, right: 0, bottom: 88 }}
      >
      {/* Panel */}
      <div
        className="hud-panel flex flex-col pointer-events-auto"
        style={{
          width: 'min(860px, calc(100vw - 24px))',
          maxHeight: '100%',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-hud-border flex-shrink-0">
          <div>
            <div className="hud-title text-xs tracking-widest">🛰 SATELLITE PORTAL</div>
            <div className="text-white text-xs font-mono mt-0.5">
              {title && <span className="text-hud-amber mr-2">{title.slice(0, 40)}</span>}
              <span className="text-hud-text">{lat.toFixed(4)}°, {lon.toFixed(4)}°</span>
            </div>
          </div>
          <button onClick={onClose} className="text-hud-text hover:text-white text-xl leading-none px-2">&times;</button>
        </div>

        {/* Source tabs */}
        <div className="flex flex-wrap gap-1 px-3 py-2 border-b border-hud-border flex-shrink-0">
          {SOURCES.map(s => (
            <button
              key={s.id}
              onClick={() => setSource(s.id)}
              className={`text-xs font-mono px-3 py-1 rounded border transition-all duration-150 ${
                source === s.id
                  ? 'bg-hud-green/20 border-hud-green text-hud-green'
                  : 'border-hud-border text-hud-text hover:border-hud-green/50 hover:text-hud-green'
              }`}
              title={s.desc}
            >
              {s.label}
            </button>
          ))}
          <span className="ml-auto text-[10px] font-mono text-hud-text/50 self-center hidden sm:block">{sourceDef?.desc}</span>
        </div>

        {/* Date picker (only for GIBS layers) */}
        {sourceDef?.layer && (
          <div className="flex gap-1 px-3 py-1.5 border-b border-hud-border/50 flex-shrink-0">
            {DAY_OPTIONS.map(d => (
              <button
                key={d.offset}
                onClick={() => setDayOff(d.offset)}
                className={`text-[10px] font-mono px-2 py-0.5 rounded border transition-all duration-150 ${
                  dayOff === d.offset
                    ? 'bg-hud-amber/20 border-hud-amber text-hud-amber'
                    : 'border-hud-border text-hud-text hover:border-hud-amber/50'
                }`}
              >
                {d.label}
              </button>
            ))}
            <span className="ml-auto text-[10px] font-mono text-hud-text/50 self-center">{dateStr}</span>
          </div>
        )}

        {/* Image area */}
        <div className="relative flex-1 min-h-0 flex items-center justify-center" style={{ minHeight: 320 }}>
          {imgError ? (
            <div className="flex flex-col items-center gap-3 p-6 text-center">
              <div className="text-3xl">&#9888;</div>
              <div className="text-hud-amber text-xs font-mono">IMAGE UNAVAILABLE FOR THIS DATE</div>
              <div className="text-hud-text/60 text-[10px] font-mono">Try a different date &mdash; some areas have no coverage</div>
            </div>
          ) : (
            /* GIBS WMS real satellite image */
            <div className="relative w-full h-full" style={{ minHeight: 320 }}>
              <img
                key={imgUrl}
                src={imgUrl}
                alt={`Satellite imagery ${dateStr}`}
                onError={() => setImgError(true)}
                className="w-full h-full"
                style={{ objectFit: 'cover', display: 'block' }}
              />
              {/* Coordinate crosshair */}
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                <div className="relative">
                  <div className="w-6 h-px bg-hud-green/80" />
                  <div className="absolute top-1/2 left-1/2 w-px h-6 bg-hud-green/80 -translate-x-1/2 -translate-y-1/2" />
                  <div className="absolute top-1/2 left-1/2 w-4 h-4 rounded-full border border-hud-green/60 -translate-x-1/2 -translate-y-1/2" />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-3 py-1.5 border-t border-hud-border flex-shrink-0 flex items-center justify-between">
          <span className="text-[10px] font-mono text-hud-text/50">
            NASA GIBS WMS \u2014 public domain satellite imagery
          </span>
          {lat && lon && (
            <a
              href={`https://firms.modaps.eosdis.nasa.gov/map/#d:${dateStr};@${lon.toFixed(4)},${lat.toFixed(4)},10z`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] font-mono text-hud-green hover:underline"
            >
              ↗ OPEN IN NASA FIRMS
            </a>
          )}
        </div>
      </div>
      </div>
    </>
  );
};

export default SentinelPortalModal;
