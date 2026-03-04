/**
 * MapLayerSwitcher – compact map basemap selector
 * 6 free basemaps, no API key required
 */
import React, { useState } from 'react';

export const BASEMAPS = {
  dark: {
    label: 'DARK',
    icon: '🌑',
    desc: 'Dark tactical',
  },
  satellite: {
    label: 'SAT',
    icon: '🛰',
    desc: 'Satellite imagery',
  },
  relief: {
    label: 'RELIEF',
    icon: '🏔',
    desc: 'Topographic relief',
  },
  street: {
    label: 'STREET',
    icon: '🗺',
    desc: 'OpenStreetMap',
  },
  light: {
    label: 'LIGHT',
    icon: '⬜',
    desc: 'Light minimal',
  },
  night: {
    label: 'NIGHT',
    icon: '🌙',
    desc: 'Dark no labels',
  },
};

const MapLayerSwitcher = ({ basemap, onBasemapChange, isMobile = false }) => {
  const [open, setOpen] = useState(false);
  const current = BASEMAPS[basemap] || BASEMAPS.dark;

  return (
    <div
      className="fixed z-30"
      style={{
        bottom: isMobile ? 84 : 80,
        right: isMobile ? 12 : 16,
      }}
    >
      {/* Expanded panel */}
      {open && (
        <div
          className="hud-panel mb-2 p-2"
          style={{ minWidth: 130 }}
        >
          <div className="hud-title text-xs mb-2 px-1">MAP LAYER</div>
          <div className="flex flex-col gap-1">
            {Object.entries(BASEMAPS).map(([key, bm]) => (
              <button
                key={key}
                onClick={() => { onBasemapChange(key); setOpen(false); }}
                className={`flex items-center gap-2 px-2 py-1.5 rounded text-xs font-mono transition-colors ${
                  basemap === key
                    ? 'bg-hud-accent/30 text-hud-accent border border-hud-accent/60'
                    : 'text-hud-text hover:text-white hover:bg-white/10'
                }`}
              >
                <span className="text-sm leading-none">{bm.icon}</span>
                <span className="font-bold">{bm.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Toggle button */}
      <button
        onClick={() => setOpen(o => !o)}
        className="hud-panel px-3 py-2 flex items-center gap-1.5 text-xs font-mono font-bold hover:text-white transition-colors"
        title="Switch map layer"
      >
        <span className="text-sm">{current.icon}</span>
        <span className="text-hud-text">{current.label}</span>
        <span className="text-hud-text/60 ml-1">{open ? '▲' : '▼'}</span>
      </button>
    </div>
  );
};

export default MapLayerSwitcher;
