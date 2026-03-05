/**
 * SentinelPortalModal – Satellite imagery portal for a given lat/lon
 * Embeds NASA Worldview (MODIS daily) and Copernicus Browser (Sentinel-2 10m)
 */

import React, { useState, useMemo } from 'react';

const SOURCES = [
  { id: 'sentinel2', label: '🟢 SENTINEL-2', desc: '10m optical · 5-day revisit · ESA Copernicus' },
  { id: 'modis',     label: '🟠 MODIS DAILY', desc: '250m · Daily · NASA Terra/Aqua' },
  { id: 'gibs_fire', label: '🔴 ACTIVE FIRE', desc: 'VIIRS 375m · NASA FIRMS thermal' },
];

function buildSentinelUrl(lat, lon) {
  const today = new Date().toISOString().split('T')[0];
  const from  = new Date(Date.now() - 30 * 86400 * 1000).toISOString().split('T')[0];
  // Copernicus Dataspace EO Browser — no auth needed for browsing
  // zoom 13 ≈ ~10 km view
  return `https://browser.dataspace.copernicus.eu/?zoom=13&lat=${lat.toFixed(4)}&lng=${lon.toFixed(4)}&themeId=DEFAULT-THEME&layerId=1_TRUE_COLOR&datasetId=S2L2A&demSource3D=%22MAPZEN%22&cloudCoverage=30&fromTime=${from}T00%3A00%3A00.000Z&toTime=${today}T23%3A59%3A59.000Z`;
}

function buildWorldviewUrl(lat, lon) {
  const today = new Date().toISOString().split('T')[0];
  const deg = 1.2;
  const bbox = `${(lon - deg).toFixed(3)},${(lat - deg * 0.7).toFixed(3)},${(lon + deg).toFixed(3)},${(lat + deg * 0.7).toFixed(3)}`;
  return `https://worldview.earthdata.nasa.gov/?p=geographic&l=VIIRS_NOAA21_CorrectedReflectance_TrueColor,MODIS_Terra_CorrectedReflectance_TrueColor,Coastlines_15m&t=${today}&z=6&v=${bbox}&ab=on`;
}

function buildFireUrl(lat, lon) {
  const today = new Date().toISOString().split('T')[0];
  const deg = 2.5;
  const bbox = `${(lon - deg).toFixed(3)},${(lat - deg * 0.7).toFixed(3)},${(lon + deg).toFixed(3)},${(lat + deg * 0.7).toFixed(3)}`;
  return `https://worldview.earthdata.nasa.gov/?p=geographic&l=VIIRS_NOAA21_Fires_Day,VIIRS_NOAA21_CorrectedReflectance_TrueColor,MODIS_Fires_All,MODIS_Terra_CorrectedReflectance_TrueColor(hidden),Coastlines_15m&t=${today}&z=6&v=${bbox}`;
}

const SentinelPortalModal = ({ lat, lon, title, onClose }) => {
  const [source, setSource] = useState(
    // FIRMS conflict → default to fire view
    title?.includes('FIRMS') || title?.includes('FIRE') || title?.includes('fire')
      ? 'gibs_fire'
      : 'sentinel2'
  );

  const iframeUrl = useMemo(() => {
    if (!lat || !lon) return null;
    if (source === 'sentinel2') return buildSentinelUrl(lat, lon);
    if (source === 'modis')     return buildWorldviewUrl(lat, lon);
    if (source === 'gibs_fire') return buildFireUrl(lat, lon);
    return null;
  }, [lat, lon, source]);

  if (!lat || !lon) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[60]"
        style={{ background: 'rgba(0,0,0,0.7)' }}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className="fixed z-[61] hud-panel flex flex-col"
        style={{
          top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
          width: 'min(860px, calc(100vw - 24px))',
          height: 'min(620px, calc(100vh - 80px))',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-hud-border flex-shrink-0">
          <div>
            <div className="hud-title text-xs tracking-widest">🛰 SATELLITE PORTAL</div>
            <div className="text-white text-xs font-mono mt-0.5">
              {title && <span className="text-hud-amber mr-2">{title.slice(0, 40)}</span>}
              <span className="text-hud-text">{lat.toFixed(4)}°N, {lon.toFixed(4)}°E</span>
            </div>
          </div>
          <button onClick={onClose} className="text-hud-text hover:text-white text-xl leading-none px-2">&times;</button>
        </div>

        {/* Source tabs */}
        <div className="flex gap-1 px-3 py-2 border-b border-hud-border flex-shrink-0">
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
          <div className="ml-auto text-[10px] font-mono text-hud-text/60 self-center">
            {SOURCES.find(s => s.id === source)?.desc}
          </div>
        </div>

        {/* iframe */}
        <div className="relative flex-1 min-h-0">
          {iframeUrl ? (
            <iframe
              key={iframeUrl}
              src={iframeUrl}
              title="Satellite imagery"
              className="w-full h-full border-0"
              style={{ background: '#060d18' }}
              allow="fullscreen"
            />
          ) : (
            <div className="flex items-center justify-center h-full text-hud-text font-mono text-sm">
              No coordinates available.
            </div>
          )}
          {/* Loading overlay (hidden after iframe paints — CSS trick) */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none"
            style={{ background: '#060d18', zIndex: 1 }}>
            <span className="text-hud-text font-mono text-xs animate-pulse">LOADING SATELLITE DATA…</span>
          </div>
        </div>

        {/* Footer note */}
        <div className="px-3 py-1.5 border-t border-hud-border flex-shrink-0 flex items-center justify-between">
          <span className="text-[10px] font-mono text-hud-text/60">
            {source === 'sentinel2' && 'ESA Copernicus Dataspace — free access, no login required'}
            {source === 'modis' && 'NASA Worldview — MODIS/VIIRS true color composite'}
            {source === 'gibs_fire' && 'NASA FIRMS — VIIRS 375m active fire detection (I-band 4)'}
          </span>
          <a
            href={iframeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] font-mono text-hud-green hover:underline"
          >
            ↗ OPEN FULL SCREEN
          </a>
        </div>
      </div>
    </>
  );
};

export default SentinelPortalModal;
