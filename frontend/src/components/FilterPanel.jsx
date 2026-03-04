/**
 * FilterPanel – HUD overlay controls in top-left corner
 */

import React, { useState, useEffect, useRef } from 'react';
import { timeAgo } from '../utils/geoUtils.js';

function useMissionClock() {
  const startRef = useRef(Date.now());
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - startRef.current) / 1000)), 1000);
    return () => clearInterval(id);
  }, []);
  const h  = String(Math.floor(elapsed / 3600)).padStart(2, '0');
  const m  = String(Math.floor((elapsed % 3600) / 60)).padStart(2, '0');
  const s  = String(elapsed % 60).padStart(2, '0');
  return `${h}:${m}:${s}`;
}

const COLOR_MAP = {
  'hud-green': { bg: 'rgba(0,255,136,0.2)', border: '#00ff88', dot: '#00ff88', text: 'text-hud-green' },
  'hud-blue':  { bg: 'rgba(0,170,255,0.2)', border: '#00aaff', dot: '#00aaff', text: 'text-hud-blue'  },
  'hud-amber': { bg: 'rgba(255,170,0,0.2)', border: '#ffaa00', dot: '#ffaa00', text: 'text-hud-amber'  },
};

const Toggle = ({ label, checked, onChange, color = 'hud-green' }) => {
  const c = COLOR_MAP[color] || COLOR_MAP['hud-green'];
  return (
    <label className="flex items-center gap-2 cursor-pointer group select-none">
      <div
        onClick={() => onChange(!checked)}
        className={`w-9 h-5 rounded-full border transition-colors duration-200 flex items-center px-0.5 cursor-pointer
          ${checked ? 'bg-opacity-30 border-opacity-80' : 'bg-transparent border-hud-border'}`}
        style={checked ? { background: c.bg, borderColor: c.border } : {}}
      >
        <div
          className="w-4 h-4 rounded-full transition-all duration-200"
          style={{
            background: checked ? c.dot : '#334',
            transform: checked ? 'translateX(16px)' : 'translateX(0)',
          }}
        />
      </div>
      <span className={`hud-label text-xs ${checked ? c.text : 'text-hud-text'}`}>{label}</span>
    </label>
  );
};

const SOURCE_BADGE = {
  'adsb.lol':       { label: 'adsb.lol',       color: '#00ff88' },
  'adsb.fi':        { label: 'adsb.fi',        color: '#00ff88' },
  'airplanes.live': { label: 'airplanes.live', color: '#00ff88' },
  cached:           { label: 'CACHED (REAL)',          color: '#ffb347' },
  empty:            { label: 'NO DATA YET',            color: '#ff4444' },
  loading:          { label: 'CONNECTING...',          color: '#aaa' },
};

const FilterPanel = ({
  filters, onFilterChange,
  aircraftCount, shipCount, newsCount, conflictCount = 0, alertCount,
  connected, lastUpdate, aircraftSource = 'loading',
  spaceView = false, onSpaceViewChange,
  isMobile = false, onSearchOpen,
}) => {
  const set = (key, value) => onFilterChange({ ...filters, [key]: value });
  const missionTime = useMissionClock();
  const [panelOpen, setPanelOpen] = useState(!isMobile);
  useEffect(() => setPanelOpen(!isMobile), [isMobile]);

  return (
    <div
      className={`fixed top-4 left-4 z-50 space-y-2 ${isMobile ? 'max-w-[52vw]' : 'w-56'}`}
      style={isMobile ? { maxHeight: 'calc(100dvh - 180px)', overflowY: 'auto' } : {}}
    >
      {/* Status bar */}
      <div className="hud-panel px-3 py-2">
        <div
          className="flex items-center justify-between mb-1 cursor-pointer select-none"
          onClick={() => setPanelOpen(p => !p)}
        >
          <span className="hud-title text-glitch">MILTRACKER 3D</span>
          <div className="flex items-center gap-1">
            {isMobile && onSearchOpen && (
              <button
                onClick={(e) => { e.stopPropagation(); onSearchOpen(); }}
                className="text-hud-text hover:text-hud-green text-sm px-1 transition-colors duration-150"
                aria-label="Search entities"
              >⌕</button>
            )}
            <span
              className={`w-2 h-2 rounded-full ${connected ? 'bg-hud-green animate-blink' : 'bg-red-500'}`}
            />
            <span className="hud-label text-xs">{connected ? 'LIVE' : 'OFFLINE'}</span>
            <span className="text-hud-text text-xs ml-1">{panelOpen ? '▴' : '▾'}</span>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs font-mono mt-1">
          <span className="text-hud-text">▲ <span className="text-hud-blue font-bold">{aircraftCount}</span> aircraft</span>
          <span className="text-hud-text">▬ <span className="text-hud-blue font-bold">{shipCount}</span> ships</span>
          <span className="text-hud-text">■ <span className="text-hud-amber font-bold">{newsCount}</span> news</span>
          <span className="text-hud-text">⚠ <span className="text-red-400 font-bold">{alertCount}</span> alerts</span>
          <span className="text-hud-text">◆ <span className="text-orange-400 font-bold">{conflictCount}</span> events</span>
        </div>
        <div className="flex items-center justify-between mt-1">
          {lastUpdate?.aircraft && (
            <div className="text-hud-text text-xs">
              {timeAgo(lastUpdate.aircraft)}
            </div>
          )}
          <div className="text-hud-text text-xs font-mono ml-auto">
            <span className="hud-label">T+ </span>
            <span className="text-hud-amber">{missionTime}</span>
          </div>
        </div>
        {/* Data source badge */}
        {(() => {
          const badge = SOURCE_BADGE[aircraftSource] || SOURCE_BADGE.loading;
          return (
            <div className="flex items-center gap-1 mt-1">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: badge.color }} />
              <span className="font-mono text-xs" style={{ color: badge.color }}>
                {badge.label}
              </span>
            </div>
          );
        })()}
      </div>

      {/* Layer toggles */}
      {panelOpen && (
      <div className="hud-panel px-3 py-2 space-y-2">
        <div className="hud-title mb-1">LAYERS</div>
        <Toggle label="AIRCRAFT"     checked={filters.showAircraft}  onChange={v => set('showAircraft', v)} />
        <Toggle label="WARSHIPS"      checked={filters.showShips}     onChange={v => set('showShips', v)} />
        <Toggle label="CONFLICT EVTS" checked={filters.showConflicts} onChange={v => set('showConflicts', v)} />
        <Toggle label="NEWS EVENTS"   checked={filters.showNews}      onChange={v => set('showNews', v)} />
        <Toggle label="DANGER ZONES"  checked={filters.showDanger}    onChange={v => set('showDanger', v)} />
        <Toggle label="MIL BASES"     checked={filters.showBases}     onChange={v => set('showBases', v)}  color="hud-amber" />
        <Toggle label="ON GROUND"     checked={filters.showOnGround}  onChange={v => set('showOnGround', v)} />
        <div className="border-t border-hud-border/50 pt-2 mt-1">
          <Toggle
            label="SPACE VIEW"
            checked={spaceView}
            onChange={onSpaceViewChange}
            color="hud-blue"
          />
          <div className="text-hud-text text-xs mt-0.5 pl-11 opacity-60">
            Real atmosphere + lighting
          </div>
        </div>
      </div>
      )}

      {/* Country filter */}
      {panelOpen && !isMobile && (
      <div className="hud-panel px-3 py-2">
        <div className="hud-title mb-2">COUNTRY FILTER</div>
        <select
          value={filters.country}
          onChange={e => set('country', e.target.value)}
          className="w-full bg-hud-bg border border-hud-border text-hud-green font-mono text-xs
                     px-2 py-1 rounded outline-none focus:border-hud-green cursor-pointer"
        >
          <option value="ALL">🌐 ALL COUNTRIES</option>
          <option value="United States">🇺🇸 United States</option>
          <option value="Russia">🇷🇺 Russia</option>
          <option value="China">🇨🇳 China</option>
          <option value="United Kingdom">🇬🇧 United Kingdom</option>
          <option value="France">🇫🇷 France</option>
          <option value="Germany">🇩🇪 Germany</option>
          <option value="Israel">🇮🇱 Israel</option>
          <option value="Turkey">🇹🇷 Turkey</option>
          <option value="Iran">🇮🇷 Iran</option>
          <option value="Ukraine">🇺🇦 Ukraine</option>
        </select>
      </div>
      )}

      {/* Radar animation */}
      {panelOpen && !isMobile && (
      <div className="hud-panel px-3 py-2 flex items-center gap-3">
        <div className="relative w-8 h-8 shrink-0">
          <div className="absolute inset-0 rounded-full border border-hud-green opacity-30" />
          <div className="absolute inset-1 rounded-full border border-hud-green opacity-20" />
          <div
            className="absolute bottom-1/2 left-1/2 w-0.5 h-1/2 bg-hud-green radar-sweep opacity-80"
            style={{ transformOrigin: '50% 100%', transform: 'translateX(-50%)' }}
          />
          <div className="absolute top-1/2 left-1/2 w-1.5 h-1.5 bg-hud-green rounded-full -translate-x-1/2 -translate-y-1/2" />
        </div>
        <div>
          <div className="hud-title text-xs">ACTIVE SCAN</div>
          <div className="text-hud-text text-xs">30s refresh</div>
        </div>
      </div>
      )}
    </div>
  );
};

export default FilterPanel;
