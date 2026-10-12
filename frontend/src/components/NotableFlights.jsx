/**
 * NotableFlights – transient toasts when a rare/newsworthy aircraft appears
 * airborne (emergency squawk, strategic bomber, nuclear command post, strategic
 * ISR). Detection is client-side over the live aircraft feed, so it never
 * touches the news-derived alert pipeline (tweets / Supabase archive).
 */

import React, { useEffect, useRef, useState } from 'react';
import { getNotableFlight, getAircraftTypeName } from '../utils/militaryFilter.js';

const TOAST_MS   = 12_000;
const MAX_TOASTS = 3;
const MUTE_KEY   = 'notableFlightsMuted';

const LEVEL_STYLE = {
  critical: 'border-red-500/70 text-red-300',
  high:     'border-orange-400/70 text-orange-300',
  medium:   'border-purple-400/60 text-purple-300',
};

function readMuted() {
  try { return localStorage.getItem(MUTE_KEY) === '1'; } catch { return false; }
}

const NotableFlights = ({ aircraft = [], onSelect, isMobile = false }) => {
  const [toasts, setToasts] = useState([]);
  const [muted, setMuted]   = useState(readMuted);
  const seenRef  = useRef(new Map()); // icao24 → reason already announced
  const firstRef = useRef(true);
  const timersRef = useRef(new Set());

  useEffect(() => () => { for (const t of timersRef.current) clearTimeout(t); }, []);

  const push = (toast) => {
    setToasts(prev => [toast, ...prev.filter(t => t.key !== toast.key)].slice(0, MAX_TOASTS));
    const t = setTimeout(() => {
      timersRef.current.delete(t);
      setToasts(prev => prev.filter(x => x.key !== toast.key));
    }, TOAST_MS);
    timersRef.current.add(t);
  };

  useEffect(() => {
    if (!aircraft.length) return;
    const fresh = [];
    for (const ac of aircraft) {
      const n = getNotableFlight(ac);
      if (!n) continue;
      const id = ac.icao24 || ac.id;
      // Re-announce only if the reason changed (e.g. a bomber starts squawking 7700)
      if (seenRef.current.get(id) === n.reason) continue;
      seenRef.current.set(id, n.reason);
      fresh.push({ ac, ...n });
    }
    if (seenRef.current.size > 2000) seenRef.current.clear();
    const first = firstRef.current;
    firstRef.current = false;
    if (muted || !fresh.length) return;

    // On first load everything is "new" — summarise instead of flooding
    if (first && fresh.length > 1) {
      push({ key: 'summary', level: 'medium', summary: fresh });
      return;
    }
    for (const f of fresh.slice(0, MAX_TOASTS)) {
      push({ key: f.ac.icao24 || f.ac.id, level: f.level, reason: f.reason, ac: f.ac });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aircraft]);

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    if (next) setToasts([]);
    try { localStorage.setItem(MUTE_KEY, next ? '1' : '0'); } catch { /* storage unavailable */ }
  };

  if (!toasts.length) return null;

  const describe = (ac) => {
    const type = getAircraftTypeName(ac.aircraftType || '') || ac.aircraftType || 'Aircraft';
    return `${type} · ${ac.callsign && ac.callsign !== 'UNKNOWN' ? ac.callsign : ac.icao24}`;
  };

  return (
    <div className="fixed z-30 left-1/2 -translate-x-1/2 flex flex-col gap-1.5 pointer-events-none"
      style={{ top: isMobile ? 52 : 80, width: isMobile ? 'calc(100vw - 24px)' : 380 }}>
      {toasts.map(t => (
        <div key={t.key}
          className={`hud-panel pointer-events-auto border px-2 py-1.5 font-mono text-xs ${LEVEL_STYLE[t.level] || LEVEL_STYLE.medium}`}>
          <div className="flex items-center justify-between gap-2">
            <span className="font-bold tracking-wider text-[10px]">
              ✈ {t.summary ? `${t.summary.length} NOTABLE FLIGHTS AIRBORNE` : t.reason.toUpperCase()}
            </span>
            <span className="flex items-center gap-2 shrink-0">
              <button onClick={toggleMute} className="text-[9px] text-hud-text hover:text-white" title="Stop notable flight notifications">
                MUTE
              </button>
              <button onClick={() => setToasts(prev => prev.filter(x => x.key !== t.key))}
                className="text-hud-text hover:text-white leading-none" aria-label="Dismiss">✕</button>
            </span>
          </div>
          {t.summary ? (
            <div className="mt-0.5 space-y-0.5">
              {t.summary.slice(0, 5).map(f => (
                <button key={f.ac.icao24 || f.ac.id} onClick={() => onSelect?.(f.ac)}
                  className="block w-full text-left text-white/90 hover:text-white truncate">
                  ▸ {describe(f.ac)} <span className="text-hud-text">— {f.reason}</span>
                </button>
              ))}
              {t.summary.length > 5 && <div className="text-hud-text">+{t.summary.length - 5} more</div>}
            </div>
          ) : (
            <button onClick={() => onSelect?.(t.ac)} className="mt-0.5 block w-full text-left text-white/90 hover:text-white truncate">
              ▸ {describe(t.ac)} <span className="text-hud-cyan">· VIEW</span>
            </button>
          )}
        </div>
      ))}
    </div>
  );
};

export default NotableFlights;
