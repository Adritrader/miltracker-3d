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
  {
    id: 'gibs_fire',
    label: '🔴 ACTIVE FIRE',
    desc: 'VIIRS 375m · NASA FIRMS thermal',
    layer: 'VIIRS_NOAA21_Fires_Day',
    baseLayer: 'VIIRS_NOAA21_CorrectedReflectance_TrueColor',
    extUrl: (lat, lon) => {
      const deg = 2.5;
      const v = `${(lon-deg).toFixed(3)},${(lat-deg*0.7).toFixed(3)},${(lon+deg).toFixed(3)},${(lat+deg*0.7).toFixed(3)}`;
      return `https://worldview.earthdata.nasa.gov/?p=geographic&l=VIIRS_NOAA21_Fires_Day,VIIRS_NOAA21_CorrectedReflectance_TrueColor,Coastlines_15m&t=${new Date().toISOString().split('T')[0]}&z=6&v=${v}`;
    },
  },
  {
    id: 'sentinel2',
    label: '🔵 SENTINEL-2',
    desc: '10m · ESA Copernicus · Opens externally',
    layer: null, // no GIBS layer — opens external portal
    extUrl: (lat, lon) => {
      const today = new Date().toISOString().split('T')[0];
      const from  = new Date(Date.now() - 30*86400*1000).toISOString().split('T')[0];
      return `https://browser.dataspace.copernicus.eu/?zoom=13&lat=${lat.toFixed(4)}&lng=${lon.toFixed(4)}&themeId=DEFAULT-THEME&layerId=1_TRUE_COLOR&datasetId=S2L2A&cloudCoverage=30&fromTime=${from}T00:00:00.000Z&toTime=${today}T23:59:59.000Z`;
    },
  },
];

/* Build a GIBS WMS GetMap URL → returns a real JPEG satellite image */
function buildGibsUrl(layer, lat, lon, dateStr, deg = 1.5) {
  const latMin = (lat - deg * 0.75).toFixed(4);
  const latMax = (lat + deg * 0.75).toFixed(4);
  const lonMin = (lon - deg).toFixed(4);
  const lonMax = (lon + deg).toFixed(4);
  const params = new URLSearchParams({
    SERVICE: 'WMS', REQUEST: 'GetMap', VERSION: '1.3.0',
    LAYERS: layer, CRS: 'CRS:84',
    BBOX: `${lonMin},${latMin},${lonMax},${latMax}`,
    WIDTH: '900', HEIGHT: '600',
    FORMAT: 'image/jpeg',
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
  const defaultSource = (title?.includes('FIRMS') || title?.includes('FIRE') || title?.includes('fire'))
    ? 'gibs_fire' : 'viirs';
  const [source,  setSource]  = useState(defaultSource);
  const [dayOff,  setDayOff]  = useState(0);
  const [imgError, setImgError] = useState(false);

  const sourceDef = SOURCES.find(s => s.id === source);
  const dateStr   = offsetDate(dayOff);
  const extUrl    = sourceDef?.extUrl?.(lat, lon) ?? null;

  // GIBS image URL — null for Sentinel-2 (external-only)
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

      {/* Panel */}
      <div
        className="fixed z-[61] hud-panel flex flex-col"
        style={{
          top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
          width: 'min(860px, calc(100vw - 24px))',
          maxHeight: 'calc(100vh - 80px)',
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
          {/* Sentinel-2 — external only */}
          {source === 'sentinel2' ? (
            <div className="flex flex-col items-center gap-4 p-8 text-center">
              <div className="text-4xl">🛰</div>
              <div className="hud-title text-sm">SENTINEL-2 · ESA COPERNICUS</div>
              <div className="text-hud-text text-xs font-mono max-w-xs">
                10m resolution optical imagery. Cannot be embedded — opens in the official ESA EO Browser.
              </div>
              <a
                href={extUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 px-4 py-2 rounded-lg border border-hud-green text-hud-green
                           font-mono text-xs bg-hud-green/10 hover:bg-hud-green/25 transition-all duration-150"
              >
                ↗ OPEN ESA COPERNICUS BROWSER
              </a>
              <div className="text-hud-text/50 text-[10px] font-mono">
                {lat.toFixed(4)}°, {lon.toFixed(4)}° — free, no login required
              </div>
            </div>
          ) : imgError ? (
            /* GIBS image load error */
            <div className="flex flex-col items-center gap-3 p-6 text-center">
              <div className="text-3xl">⚠</div>
              <div className="text-hud-amber text-xs font-mono">IMAGE UNAVAILABLE FOR THIS DATE</div>
              <div className="text-hud-text/60 text-[10px] font-mono">Try a different date — some areas have no coverage</div>
              <a href={extUrl} target="_blank" rel="noopener noreferrer"
                className="mt-1 text-xs font-mono text-hud-green hover:underline">
                ↗ Open in NASA Worldview
              </a>
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
            {source !== 'sentinel2' ? 'NASA GIBS WMS — public domain satellite imagery' : 'ESA Copernicus open data'}
          </span>
          {extUrl && source !== 'sentinel2' && (
            <a
              href={extUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] font-mono text-hud-green hover:underline"
            >
              ↗ OPEN IN NASA WORLDVIEW
            </a>
          )}
        </div>
      </div>
    </>
  );
};

export default SentinelPortalModal;
