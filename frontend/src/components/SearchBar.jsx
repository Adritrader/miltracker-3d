/**
 * SearchBar – Global entity search with flyTo (Roadmap §10.5)
 * Ctrl+K or clicking the bar opens it; ESC or blur when empty closes it.
 */

import React, { useState, useEffect, useRef } from 'react';
import * as Cesium from 'cesium';

const TYPE_ICON  = { aircraft: '▲', ship: '▬', conflict: '◆', news: '■' };
const TYPE_COLOR = {
  aircraft: 'text-hud-blue',
  ship:     'text-hud-blue',
  conflict: 'text-orange-400',
  news:     'text-hud-amber',
};

const SearchBar = ({ aircraft = [], ships = [], conflicts = [], news = [], viewer, onSelect, open, onOpen, onClose, isMobile = false }) => {
  const [query, setQuery]   = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [results, setResults] = useState([]);
  const [active, setActive]  = useState(0);
  const inputRef = useRef(null);

  // Debounce query changes by 250ms to avoid O(n) filter on every keystroke (O2)
  useEffect(() => {
    const id = setTimeout(() => setDebouncedQuery(query), 250);
    return () => clearTimeout(id);
  }, [query]);

  // Focus when opened
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 40);
    } else {
      setQuery('');
      setResults([]);
    }
  }, [open]);

  // Build results on debounced query change
  useEffect(() => {
    if (!debouncedQuery.trim()) { setResults([]); setActive(0); return; }
    const q = debouncedQuery.toLowerCase();

    const ac = aircraft
      .filter(a =>
        a.callsign?.toLowerCase().includes(q) ||
        a.icao24?.toLowerCase().includes(q) ||
        a.country?.toLowerCase().includes(q) ||
        (a.registration || '').toLowerCase().includes(q)
      )
      .slice(0, 4)
      .map(a => ({
        type: 'aircraft',
        label: a.callsign || a.icao24 || 'UNKNOWN',
        sub:   a.country || '',
        badge: a.on_ground ? 'GND' : `${Math.round((a.altitudeFt || a.altitude * 3.28 || 0) / 1000)}k ft`,
        data:  a,
      }));

    const sh = ships
      .filter(s =>
        s.name?.toLowerCase().includes(q) ||
        s.flag?.toLowerCase().includes(q) ||
        s.mmsi?.includes(q)
      )
      .slice(0, 3)
      .map(s => ({
        type: 'ship',
        label: s.name || s.mmsi,
        sub:   s.flag || '',
        badge: `${Math.round(s.velocity || 0)} kn`,
        data:  s,
      }));

    const cf = conflicts
      .filter(c =>
        c.country?.toLowerCase().includes(q) ||
        c.eventType?.toLowerCase().includes(q) ||
        c.title?.toLowerCase().includes(q)
      )
      .slice(0, 3)
      .map(c => ({
        type: 'conflict',
        label: (c.eventType || 'EVENT').toUpperCase(),
        sub:   c.country || '',
        badge: (c.severity || '').toUpperCase(),
        data:  c,
      }));

    const nw = news
      .filter(n => n.lat != null && (
        n.title?.toLowerCase().includes(q) ||
        n.source?.toLowerCase().includes(q)
      ))
      .slice(0, 2)
      .map(n => ({
        type: 'news',
        label: (n.title || 'NEWS').slice(0, 40),
        sub:   n.source || '',
        badge: '',
        data:  n,
      }));

    const combined = [...ac, ...sh, ...cf, ...nw].slice(0, 9);
    setResults(combined);
    setActive(0);
  }, [debouncedQuery, aircraft, ships, conflicts, news]);

  const select = (result) => {
    if (result.data.lat != null && viewer && !viewer.isDestroyed()) {
      const height = result.type === 'aircraft' ? 500_000 : 1_200_000;
      viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(result.data.lon, result.data.lat, height),
        duration: 1.8,
      });
    }
    onSelect?.(result.data);
    setQuery('');
    setResults([]);
    onClose?.();
  };

  const handleKey = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(a => Math.min(a + 1, results.length - 1)); }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setActive(a => Math.max(a - 1, 0)); }
    if (e.key === 'Enter' && results[active]) select(results[active]);
    if (e.key === 'Escape') { setQuery(''); onClose?.(); }
  };

  const handleBlur = () => {
    // Delay so onMouseDown on a result fires before blur closes
    setTimeout(() => { if (!query) onClose?.(); }, 150);
  };

  return (
    <div
      className={`fixed top-4 z-50 ${
        isMobile ? 'left-2 right-2' : 'right-4'
      }`}
      style={isMobile ? {} : { width: '13rem' }}
    >
      {/* Collapsed pill – hidden on mobile (search triggered from FilterPanel) */}
      {!open && !isMobile && (
        <button
          onClick={onOpen}
          className="w-full hud-panel px-3 py-1.5 flex items-center gap-2
                     hover:border-hud-green transition-colors duration-150 group"
        >
          <span className="text-hud-text group-hover:text-hud-green transition-colors text-sm select-none">⌕</span>
          <span className="hud-label text-xs flex-1 text-left">SEARCH ENTITIES</span>
          {!isMobile && (
            <span className="text-hud-text text-xs font-mono opacity-40 shrink-0 select-none">CTRL+K</span>
          )}
        </button>
      )}

      {/* Expanded search */}
      {open && (
        <div className="animate-fade-in">
          <div
            className="hud-panel flex items-center gap-2 px-3 py-1.5"
            style={{ borderColor: '#00ff88' }}
          >
            <span className="text-hud-green text-sm shrink-0 select-none">⌕</span>
            <input
              ref={inputRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={handleKey}
              onBlur={handleBlur}
              placeholder="callsign · ship · country · event..."
              className="flex-1 bg-transparent text-hud-green font-mono text-xs
                         outline-none placeholder-hud-text caret-hud-green"
              spellCheck={false}
              autoComplete="off"
            />
            <button
              onClick={() => { setQuery(''); onClose?.(); }}
              className="text-hud-text hover:text-white text-xs shrink-0 leading-none px-0.5"
            >✕</button>
          </div>

          {/* Results dropdown */}
          {results.length > 0 && (
            <div className="hud-panel mt-0.5 py-0.5 overflow-hidden">
              {results.map((r, i) => (
                <div
                  key={r.id || r.label || i}
                  className={`flex items-center gap-2 px-3 py-1.5 cursor-pointer transition-colors duration-100
                    ${i === active
                      ? 'bg-hud-green/10 border-l-2 border-hud-green'
                      : 'hover:bg-hud-border/30 border-l-2 border-transparent'
                    }`}
                  onMouseDown={() => select(r)}
                  onMouseEnter={() => setActive(i)}
                >
                  <span className={`text-xs shrink-0 ${TYPE_COLOR[r.type]}`}>{TYPE_ICON[r.type]}</span>
                  <span className="font-mono text-xs text-white flex-1 truncate">{r.label}</span>
                  <span className="text-hud-text text-xs shrink-0 truncate max-w-[60px]">{r.sub}</span>
                  {r.badge && (
                    <span className="text-hud-text text-xs font-mono shrink-0 opacity-60">{r.badge}</span>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* No results */}
          {query.trim() && results.length === 0 && (
            <div className="hud-panel mt-0.5 px-3 py-2 text-center">
              <span className="text-hud-text text-xs font-mono">
                NO MATCH · <span className="text-hud-green">{query.toUpperCase()}</span>
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SearchBar;
