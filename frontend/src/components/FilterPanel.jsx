/**
 * FilterPanel – HUD overlay controls in top-left corner
 * Mobile: hamburger button → slide-in drawer
 * Desktop: collapsible HUD panel
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
    <label
      className="flex items-center gap-2 cursor-pointer group select-none"
      onClick={(e) => { e.preventDefault(); onChange(!checked); }}
    >
      <div
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

/* ────────────────────────────────────────────────────────── */
/* Map Legend – complete reference for all map symbology      */
/* ────────────────────────────────────────────────────────── */
const ALT_STOPS = [
  { alt: '0',      color: '#00ffff', ft: '0' },
  { alt: '3 750',  color: '#00ff00', ft: '12 300' },
  { alt: '7 500',  color: '#ffff00', ft: '24 600' },
  { alt: '11 250', color: '#ff8000', ft: '36 900' },
  { alt: '15 000', color: '#ff0000', ft: '49 200' },
];

const EVENT_COLORS = [
  { label: 'Airstrike',  color: '#ff5500' },
  { label: 'Missile',    color: '#ff2200' },
  { label: 'Explosion',  color: '#ff7700' },
  { label: 'Artillery',  color: '#ffaa00' },
  { label: 'Drone',      color: '#cc44ff' },
  { label: 'Naval',      color: '#0099ff' },
  { label: 'Troops',     color: '#ffdd00' },
  { label: 'Casualties', color: '#ff0055' },
  { label: 'Fire',       color: '#ff6600' },
  { label: 'Cyber',      color: '#00ffcc' },
  { label: 'CBRN',       color: '#aaff00' },
];

const COUNTRY_COLORS = [
  { label: 'US / UK',  color: '#4488ff' },
  { label: 'France',   color: '#0055aa' },
  { label: 'Russia',   color: '#cc2222' },
  { label: 'China',    color: '#dd1111' },
  { label: 'Turkey',   color: '#cc4400' },
  { label: 'Ukraine',  color: '#ffcc00' },
  { label: 'Israel',   color: '#0066cc' },
  { label: 'Iran',     color: '#008800' },
  { label: 'Germany',  color: '#555555' },
];

const BASE_TYPES = [
  { code: 'AB', label: 'Airbase',     color: '#4af7ff' },
  { code: 'NB', label: 'Naval Base',  color: '#3399ff' },
  { code: 'MS', label: 'Missile/Nuc', color: '#ff6600' },
  { code: 'RD', label: 'Radar/Cmd',   color: '#00ff88' },
];

const NEWS_CATEGORIES = [
  { label: 'Attack/Blast', color: '#ff3b3b' },
  { label: 'Aircraft',     color: '#ff6600' },
  { label: 'Naval',        color: '#00aaff' },
  { label: 'Military',     color: '#ffaa00' },
  { label: 'General',      color: '#00ff88' },
];

export const MapLegend = ({ isMobile = false }) => {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState('main'); // main | events | countries

  if (!open) return (
    <button
      onClick={() => setOpen(true)}
      className="bg-hud-panel border border-hud-border text-hud-green text-[10px] font-mono font-bold
                 px-2.5 py-1.5 rounded hover:border-hud-green transition-colors select-none pointer-events-auto"
    >
      ◈ LEGEND
    </button>
  );

  const Tab = ({ id, label }) => (
    <button
      onClick={() => setTab(id)}
      className={`px-2 py-0.5 rounded text-[9px] font-mono font-bold transition-colors
        ${tab === id ? 'bg-hud-green/20 text-hud-green border border-hud-green/40' : 'text-hud-text hover:text-white border border-transparent'}`}
    >
      {label}
    </button>
  );

  const panelContent = (
    <div className="bg-hud-panel border border-hud-border rounded p-2.5 shadow-lg pointer-events-auto"
         style={{ width: isMobile ? 'calc(100vw - 32px)' : 290, maxWidth: 340, maxHeight: isMobile ? '75vh' : '70vh', overflowY: 'auto' }}>
      <div className="flex items-center justify-between mb-1.5">
        <span className="hud-title text-xs">MAP LEGEND</span>
        <button onClick={() => setOpen(false)} className="text-hud-text hover:text-white text-sm leading-none">✕</button>
      </div>

      {/* Tab row */}
      <div className="flex gap-1 mb-2">
        <Tab id="main" label="GENERAL" />
        <Tab id="events" label="EVENTS" />
        <Tab id="countries" label="COUNTRIES" />
      </div>

      {/* ─── MAIN TAB ─── */}
      {tab === 'main' && (
        <div className="space-y-2">
          {/* Entities */}
          <div>
            <div className="hud-label text-[10px] mb-1 opacity-70">ENTITIES</div>
            <div className="grid grid-cols-2 gap-y-0.5 gap-x-2 text-[10px] font-mono">
              <span className="text-white">✈ Aircraft</span>
              <span className="text-white">⬡ Mil Base</span>
              <span className="text-white">🚁 Helicopter</span>
              <span className="text-hud-amber">📰 News Event</span>
              <span style={{color:'#00aaff'}}>⚓ Warship</span>
              <span className="text-red-400">🔥 FIRMS Fire</span>
              <span className="text-orange-400">◆ Conflict Evt</span>
              <span className="text-red-500">⚠ Alert / Danger</span>
              <span style={{color:'#4af7ff'}}>⊕ Military Base</span>
              <span style={{color:'#00aaff'}}>📷 Live Cam</span>
            </div>
          </div>

          {/* Trail altitude gradient */}
          <div>
            <div className="hud-label text-[10px] mb-1 opacity-70">AIRCRAFT TRAIL – ALTITUDE</div>
            <div className="h-3 rounded" style={{ background: 'linear-gradient(to right, #00ffff 0%, #00ff00 25%, #ffff00 50%, #ff8000 75%, #ff0000 100%)' }} />
            <div className="flex justify-between text-[9px] font-mono mt-0.5">
              {ALT_STOPS.map(s => (
                <span key={s.alt} style={{ color: s.color }}>{s.alt}</span>
              ))}
            </div>
            <div className="text-[8px] font-mono text-hud-text opacity-60 mt-0.5 text-center">
              metres · trail fades older segments
            </div>
          </div>

          {/* Severity + Credibility side by side  */}
          <div className="flex gap-3">
            <div className="flex-1">
              <div className="hud-label text-[10px] mb-1 opacity-70">SEVERITY</div>
              <div className="flex flex-col gap-0.5 text-[10px] font-mono font-bold">
                <span style={{color:'#ff2222'}}>● CRITICAL</span>
                <span style={{color:'#ff6600'}}>● HIGH</span>
                <span style={{color:'#ffaa00'}}>● MEDIUM</span>
                <span style={{color:'#00ff88'}}>● LOW</span>
              </div>
            </div>
            <div className="flex-1">
              <div className="hud-label text-[10px] mb-1 opacity-70">CREDIBILITY</div>
              <div className="flex flex-col gap-0.5 text-[10px] font-mono font-bold">
                <span style={{ color: '#00ff88' }}>≥70 % HIGH</span>
                <span style={{ color: '#ffaa00' }}>≥45 % MED</span>
                <span style={{ color: '#ff6666' }}>&lt;45 % LOW</span>
              </div>
            </div>
          </div>

          {/* Alliances + special */}
          <div className="flex gap-3 text-[10px] font-mono">
            <div className="flex-1">
              <div className="hud-label text-[10px] mb-1 opacity-70">ALLIANCES</div>
              <div className="flex flex-col gap-0.5">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#4488ff] inline-block" /> NATO</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#ff4444] inline-block" /> ADVERSARY</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#ffaa00] inline-block" /> OTHER</span>
              </div>
            </div>
            <div className="flex-1">
              <div className="hud-label text-[10px] mb-1 opacity-70">SPECIAL</div>
              <div className="flex flex-col gap-0.5">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#FFD700] inline-block" /> Tracked</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-white inline-block" /> Default</span>
              </div>
            </div>
          </div>

          {/* Base types */}
          <div>
            <div className="hud-label text-[10px] mb-1 opacity-70">MILITARY BASE TYPES</div>
            <div className="grid grid-cols-2 gap-y-0.5 gap-x-2 text-[10px] font-mono">
              {BASE_TYPES.map(b => (
                <span key={b.code} style={{ color: b.color }}>[{b.code}] {b.label}</span>
              ))}
            </div>
          </div>

          {/* Danger zone rings */}
          <div>
            <div className="hud-label text-[10px] mb-1 opacity-70">DANGER ZONE PERIMETER</div>
            <div className="flex gap-2 text-[10px] font-mono font-bold">
              <span style={{color:'#ff2222'}}>━ CRIT</span>
              <span style={{color:'#ff6600'}}>━ HIGH</span>
              <span style={{color:'#ffaa00'}}>━ MED</span>
              <span style={{color:'#00ff88'}}>━ LOW</span>
            </div>
            <div className="text-[8px] font-mono text-hud-text opacity-60 mt-0.5">
              glow polyline · crosshair center pin
            </div>
          </div>

          {/* News categories */}
          <div>
            <div className="hud-label text-[10px] mb-1 opacity-70">NEWS PIN COLOURS</div>
            <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] font-mono">
              {NEWS_CATEGORIES.map(n => (
                <span key={n.label} style={{ color: n.color }}>● {n.label}</span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ─── EVENTS TAB ─── */}
      {tab === 'events' && (
        <div className="space-y-2">
          <div className="hud-label text-[10px] mb-1 opacity-70">CONFLICT EVENT TYPES</div>
          <div className="grid grid-cols-2 gap-y-0.5 gap-x-2 text-[10px] font-mono font-bold">
            {EVENT_COLORS.map(e => (
              <span key={e.label} style={{ color: e.color }}>◆ {e.label}</span>
            ))}
          </div>
          <div className="text-[8px] font-mono text-hud-text opacity-60 mt-1">
            Each event has a severity ring (CRIT / HIGH / MED / LOW) and unique SVG symbol.
            Cluster badges show event count when zoomed out.
          </div>

          {/* FIRMS detail */}
          <div>
            <div className="hud-label text-[10px] mb-1 opacity-70">NASA FIRMS HOTSPOTS</div>
            <div className="flex gap-3 text-[10px] font-mono">
              <span style={{color:'#ff6600'}}>🔥 Single</span>
              <span style={{color:'#ff4400'}}>⊙ Cluster</span>
            </div>
            <div className="text-[8px] font-mono text-hud-text opacity-60 mt-0.5">
              thermal anomalies via MODIS / VIIRS satellite
            </div>
          </div>
        </div>
      )}

      {/* ─── COUNTRIES TAB ─── */}
      {tab === 'countries' && (
        <div className="space-y-2">
          <div className="hud-label text-[10px] mb-1 opacity-70">AIRCRAFT / SHIP COLOURS BY COUNTRY</div>
          <div className="grid grid-cols-2 gap-y-0.5 gap-x-2 text-[10px] font-mono font-bold">
            {COUNTRY_COLORS.map(c => (
              <span key={c.label} className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ backgroundColor: c.color }} />
                {c.label}
              </span>
            ))}
          </div>
          <div className="text-[8px] font-mono text-hud-text opacity-60 mt-1">
            Icons use white by default — country colour applies when hex/MMSI is matched.
            Tracked entities override to gold (#FFD700).
          </div>
        </div>
      )}
    </div>
  );

  if (isMobile) {
    return (
      <>
        <div className="fixed inset-0 z-[60] bg-black/50" onClick={() => setOpen(false)} />
        <div className="fixed inset-0 z-[65] flex items-center justify-center pointer-events-none p-4">
          <div className="pointer-events-auto">{panelContent}</div>
        </div>
      </>
    );
  }

  return panelContent;
};

/* ────────────────────────────────────────────────────────── */
/* Shared inner panel content (used by desktop + drawer)     */
/* ────────────────────────────────────────────────────────── */
const PanelBody = ({ filters, set, spaceView, onSpaceViewChange, aircraftSource }) => (
  <>
    {/* Layer toggles */}
    <div className="hud-panel px-3 py-2 space-y-2">
      <div className="hud-title mb-1">LAYERS</div>
      <Toggle label="AIRCRAFT"     checked={filters.showAircraft}      onChange={v => set('showAircraft', v)} />
      <Toggle label="WARSHIPS"     checked={filters.showShips}         onChange={v => set('showShips', v)} />
      <Toggle label="CONFLICT EVTS"checked={filters.showConflicts}     onChange={v => set('showConflicts', v)} />
      <Toggle label="FIRMS HEAT"   checked={filters.showFIRMS ?? true} onChange={v => set('showFIRMS', v)} color="hud-amber" />
      <Toggle label="NEWS EVENTS"  checked={filters.showNews}          onChange={v => set('showNews', v)} />
      <Toggle label="DANGER ZONES" checked={filters.showDanger}        onChange={v => set('showDanger', v)} />
      <Toggle label="MIL BASES"    checked={filters.showBases}         onChange={v => set('showBases', v)} color="hud-amber" />
      <Toggle label="LIVE CAMS"    checked={filters.showCameras ?? true} onChange={v => set('showCameras', v)} color="hud-blue" />
      <Toggle label="ON GROUND"    checked={filters.showOnGround}      onChange={v => set('showOnGround', v)} />
      <div className="border-t border-hud-border/50 pt-2 mt-1">
        <Toggle label="SPACE VIEW" checked={spaceView} onChange={onSpaceViewChange} color="hud-blue" />
        <div className="text-hud-text text-xs mt-0.5 pl-11 opacity-60">Real atmosphere + lighting</div>
      </div>
    </div>

    {/* Alliance filter */}
    <div className="hud-panel px-3 py-2">
      <div className="hud-title mb-2">ALLIANCE / BLOC</div>
      <div className="grid grid-cols-2 gap-1">
        {[
          { value: 'ALL',             label: '🌐 ALL',         color: '#00ff88' },
          { value: 'NATO',            label: '🔵 NATO',        color: '#4488ff' },
          { value: 'Axis of Concern', label: '🔴 ADVERSARIES', color: '#ff4444' },
          { value: 'Other',           label: '⬜ OTHERS',      color: '#ffaa00' },
        ].map(opt => (
          <button
            key={opt.value}
            onClick={() => set('alliance', opt.value)}
            className={`text-xs font-mono px-2 py-1 rounded border transition-all duration-150 ${
              filters.alliance === opt.value
                ? 'border-current font-bold'
                : 'border-hud-border text-hud-text hover:border-hud-border/80'
            }`}
            style={filters.alliance === opt.value ? { color: opt.color, borderColor: opt.color, background: `${opt.color}18` } : {}}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>

    {/* Country filter */}
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

    {/* Mission type filter */}
    <div className="hud-panel px-3 py-2">
      <div className="hud-title mb-2">MISSION TYPE</div>
      <select
        value={filters.missionType || 'ALL'}
        onChange={e => set('missionType', e.target.value)}
        className="w-full bg-hud-bg border border-hud-border text-hud-green font-mono text-xs
                   px-2 py-1 rounded outline-none focus:border-hud-green cursor-pointer"
      >
        <option value="ALL">&#9654; ALL MISSIONS</option>
        <option value="FIGHTER">&#9651; FIGHTER</option>
        <option value="BOMBER">&#11044; BOMBER</option>
        <option value="ISR">&#9670; ISR / RECON</option>
        <option value="TANKER">&#9632; TANKER</option>
        <option value="TRANSPORT">&#9660; TRANSPORT</option>
        <option value="PATROL">&#9650; PATROL</option>
        <option value="HELICOPTER">&#9904; HELICOPTER</option>
      </select>
    </div>

    {/* Radar animation */}
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
  </>
);

/* ────────────────────────────────────────────────────────── */
/* Main FilterPanel                                           */
/* ────────────────────────────────────────────────────────── */
const FilterPanel = ({
  filters, onFilterChange,
  aircraftCount, shipCount, newsCount, conflictCount = 0, alertCount,
  connected, lastUpdate, aircraftSource = 'loading',
  spaceView = false, onSpaceViewChange,
  isMobile = false, onSearchOpen, onLoginClick,
}) => {
  const set = (key, value) => onFilterChange({ ...filters, [key]: value });
  const missionTime = useMissionClock();
  const [panelOpen,  setPanelOpen]  = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Close drawer when switching to desktop
  useEffect(() => { if (!isMobile) setDrawerOpen(false); }, [isMobile]);

  /* ── Status grid shared between mobile drawer header and desktop panel ── */
  const StatusGrid = () => (
    <>
      <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs font-mono mt-1">
        <span className="text-hud-text">▲ <span className="text-hud-blue font-bold">{aircraftCount}</span> aircraft</span>
        <span className="text-hud-text">▬ <span className="text-hud-blue font-bold">{shipCount}</span> ships</span>
        <span className="text-hud-text">■ <span className="text-hud-amber font-bold">{newsCount}</span> news</span>
        <span className="text-hud-text">⚠ <span className="text-red-400 font-bold">{alertCount}</span> alerts</span>
        <span className="text-hud-text">◆ <span className="text-orange-400 font-bold">{conflictCount}</span> events</span>
      </div>
      <div className="flex items-center justify-between mt-1">
        {lastUpdate?.aircraft && (
          <div className="text-hud-text text-xs">{timeAgo(lastUpdate.aircraft)}</div>
        )}
        <div className="text-hud-text text-xs font-mono ml-auto">
          <span className="hud-label">T+ </span>
          <span className="text-hud-amber">{missionTime}</span>
        </div>
      </div>
      {(() => {
        const badge = SOURCE_BADGE[aircraftSource] || SOURCE_BADGE.loading;
        return (
          <div className="flex items-center gap-1 mt-1">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: badge.color }} />
            <span className="font-mono text-xs" style={{ color: badge.color }}>{badge.label}</span>
          </div>
        );
      })()}
    </>
  );

  /* ══════════════════════════════════════════════════════════
     MOBILE — hamburger button + slide-in drawer
  ══════════════════════════════════════════════════════════ */
  if (isMobile) {
    return (
      <>
        {/* Hamburger pill button */}
        <button
          onClick={() => setDrawerOpen(true)}
          className="fixed left-4 z-50 bg-hud-panel flex items-center gap-2 px-3 py-2 rounded-lg
                     border border-hud-border active:scale-95 transition-transform duration-100 select-none"
          style={{ top: 11 }}
          aria-label="Open menu"
        >
          {/* Hamburger icon */}
          <div className="flex flex-col gap-[4px]">
            <span className="block w-4 h-[2px] bg-hud-green rounded" />
            <span className="block w-4 h-[2px] bg-hud-green rounded" />
            <span className="block w-4 h-[2px] bg-hud-green rounded" />
          </div>
          {/* Status dot */}
          <span className={`w-2 h-2 rounded-full ${connected ? 'bg-hud-green' : 'bg-red-500'}`} />
          {/* Alert badge */}
          {alertCount > 0 && (
            <span className="bg-red-500 text-white text-[10px] font-bold font-mono rounded-full min-w-[16px] h-4
                             flex items-center justify-center px-1 leading-none">
              {alertCount > 99 ? '99+' : alertCount}
            </span>
          )}
        </button>

        {/* Backdrop */}
        {drawerOpen && (
          <div
            className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-[1px]"
            onClick={() => setDrawerOpen(false)}
          />
        )}

        {/* Slide-in drawer */}
        <div
          className="fixed top-0 left-0 bottom-0 z-[70] w-72 flex flex-col
                     transition-transform duration-300 ease-in-out"
          style={{
            background: 'rgba(5,10,18,0.97)',
            borderRight: '1px solid rgba(0,255,136,0.18)',
            transform: drawerOpen ? 'translateX(0)' : 'translateX(-100%)',
          }}
        >
          {/* Drawer header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-hud-border/40 shrink-0">
            <span className="hud-title text-glitch text-sm">LIVEWAR3D</span>
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${connected ? 'bg-hud-green' : 'bg-red-500'}`} />
              <span className="hud-label text-xs">{connected ? 'LIVE' : 'OFFLINE'}</span>
              <button
                onClick={() => setDrawerOpen(false)}
                className="text-hud-text hover:text-hud-green text-lg leading-none ml-2 transition-colors duration-150"
                aria-label="Close menu"
              >✕</button>
            </div>
          </div>

          {/* Drawer status summary */}
          <div className="px-4 pt-2 pb-1 border-b border-hud-border/30 shrink-0">
            <StatusGrid />
          </div>

          {/* Search entities button */}
          <div className="px-4 pt-2 shrink-0">
            <button
              onClick={() => { setDrawerOpen(false); onSearchOpen?.(); }}
              className="w-full hud-btn text-xs px-3 py-2 flex items-center justify-center gap-2 rounded
                         border border-hud-border hover:border-hud-green transition-colors duration-150"
            >
              <span>⌕</span>
              <span className="hud-label tracking-wider">SEARCH ENTITIES</span>
            </button>
            <button
              onClick={() => { setDrawerOpen(false); onLoginClick?.(); }}
              className="w-full mt-1 hud-btn text-xs px-3 py-2 flex items-center justify-center gap-2 rounded
                         border border-hud-border hover:border-hud-amber transition-colors duration-150"
            >
              <span className="text-hud-amber">⊙</span>
              <span className="hud-label tracking-wider text-hud-amber">LOGIN / REGISTER</span>
            </button>
          </div>

          {/* Scrollable controls */}
          <div className="flex-1 overflow-y-auto px-2 py-2 space-y-2">
            <PanelBody
              filters={filters}
              set={set}
              spaceView={spaceView}
              onSpaceViewChange={onSpaceViewChange}
              aircraftSource={aircraftSource}
            />
          </div>
        </div>
      </>
    );
  }

  /* ══════════════════════════════════════════════════════════
     DESKTOP — original collapsible HUD panel
  ══════════════════════════════════════════════════════════ */
  return (
    <div className="fixed top-4 left-4 z-50 space-y-2 w-56">
      {/* Status bar */}
      <div className="hud-panel px-3 py-2">
        <div
          className="flex items-center justify-between mb-1 cursor-pointer select-none"
          onClick={() => setPanelOpen(p => !p)}
        >
          <span className="hud-title text-glitch">LIVEWAR3D</span>
          <div className="flex items-center gap-1">
            <span className={`w-2 h-2 rounded-full ${connected ? 'bg-hud-green' : 'bg-red-500'}`} />
            <span className="hud-label text-xs">{connected ? 'LIVE' : 'OFFLINE'}</span>
            <span className="text-hud-text text-xs ml-1">{panelOpen ? '▴' : '▾'}</span>
          </div>
        </div>
        <StatusGrid />
      </div>

      {/* Collapsible body */}
      {panelOpen && (
        <div className="space-y-2">
          <PanelBody
            filters={filters}
            set={set}
            spaceView={spaceView}
            onSpaceViewChange={onSpaceViewChange}
            aircraftSource={aircraftSource}
          />
        </div>
      )}
    </div>
  );
};

export default FilterPanel;
