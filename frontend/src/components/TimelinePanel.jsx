/**
 * TimelinePanel — compact single-row video-controls bar at the bottom of the globe.
 * Position: fixed bottom-[68px] (above NewsPanel 40px + CoordinateHUD 28px).
 */

import { useCallback, useEffect, useRef, useState } from 'react';

const SPEEDS = [
  { label: '1×',  value: 1  },
  { label: '5×',  value: 5  },
  { label: '20×', value: 20 },
  { label: '60×', value: 60 },
];

function timeAgo(isoStr) {
  if (!isoStr) return '—';
  const s = Math.floor((Date.now() - new Date(isoStr).getTime()) / 1000);
  if (s < 60)  return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60)  return `${m}m`;
  const h = Math.floor(m / 60), rm = m % 60;
  return rm > 0 ? `${h}h${rm}m` : `${h}h`;
}
function fmtUtc(isoStr) {
  if (!isoStr) return '--:--';
  const d = new Date(isoStr);
  return `${String(d.getUTCHours()).padStart(2,'0')}:${String(d.getUTCMinutes()).padStart(2,'0')} UTC`;
}

function Btn({ onClick, title, active, danger, className = '', children }) {
  const base = 'flex items-center justify-center rounded border text-xs transition shrink-0 select-none';
  const clr  = active
    ? 'bg-amber-400/25 border-amber-400/60 text-amber-200 hover:bg-amber-400/40'
    : danger
      ? 'bg-white/5 border-white/10 text-white/50 hover:bg-red-500/20 hover:text-red-300'
      : 'bg-white/5 border-white/10 text-white/50 hover:bg-white/12 hover:text-white';
  return (
    <button onClick={onClick} title={title} className={`${base} ${clr} ${className}`}>
      {children}
    </button>
  );
}

export default function TimelinePanel({
  snapshots = [],
  currentIndex = 0,
  playing = false,
  speed = 1,
  replayMode = false,
  currentTs = null,
  controls,
  alertPanelOpen = false,
}) {
  const fetchedRef = useRef(false);
  const [minimized, setMinimized] = useState(false);

  // Auto-minimize when Intel Alerts panel opens to avoid overlap
  useEffect(() => {
    if (alertPanelOpen) setMinimized(true);
  }, [alertPanelOpen]);

  const total   = snapshots.length;
  const startTs = snapshots[0]?.ts ?? null;
  const isLive  = !replayMode || currentIndex >= total - 1;
  const pct     = total > 1 ? (currentIndex / (total - 1)) * 100 : 100;

  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;
    controls?.requestHistory?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onSliderInput = useCallback((e) => {
    controls.seek(Math.round(Number(e.target.value)));
  }, [controls]);

  const onKey = useCallback((e) => {
    if (e.key === 'ArrowLeft')  { e.preventDefault(); controls.seek(currentIndex - 1); }
    if (e.key === 'ArrowRight') { e.preventDefault(); controls.seek(currentIndex + 1); }
    if (e.key === ' ')          { e.preventDefault(); controls.toggle(); }
  }, [controls, currentIndex]);

  // Block expansion while Intel Alerts panel is open — prevents overlap
  const lockedByAlert = alertPanelOpen;

  if (minimized || lockedByAlert) {
    return (
      <div className="fixed bottom-[68px] left-0 right-0 z-[45] flex justify-center pointer-events-auto">
        <button
          onClick={() => { if (!lockedByAlert) setMinimized(false); }}
          title={lockedByAlert ? 'Timeline hidden while Intel Feed is open' : 'Expand timeline'}
          style={{ cursor: lockedByAlert ? 'default' : 'pointer' }}
          className="group w-full max-w-2xl mx-4 h-3 flex items-center justify-center"
        >
          <div
            className="w-full h-1 rounded-full transition-opacity group-hover:opacity-100 opacity-40"
            style={{
              background: isLive
                ? 'linear-gradient(to right,rgba(52,211,153,0.2),rgba(52,211,153,0.7),rgba(52,211,153,0.2))'
                : `linear-gradient(to right,rgba(251,191,36,0.1),#fbbf24 ${pct}%,rgba(255,255,255,0.08) ${pct}%)`,
            }}
          />
          <span className="absolute text-[9px] text-white/35 group-hover:text-white/65 font-mono transition">
            {lockedByAlert ? '⚠ INTEL FEED OPEN' : '▲ TIMELINE'}
          </span>
        </button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-[68px] left-0 right-0 z-[45] flex justify-center pointer-events-none">
      <div className="w-full max-w-2xl mx-4 mb-1 pointer-events-auto select-none">
        <div
          className="rounded-xl border border-white/10 overflow-hidden"
          style={{ background: 'rgba(5,8,16,0.92)', backdropFilter: 'blur(16px)' }}
        >
          <div
            className="h-0.5"
            style={{
              background: isLive
                ? 'rgba(52,211,153,0.55)'
                : `linear-gradient(to right,rgba(251,191,36,0.85) ${pct}%,rgba(255,255,255,0.05) ${pct}%)`,
            }}
          />

          <div className="flex items-center gap-1.5 px-3 py-2">
            <Btn onClick={() => controls.seek(currentIndex - 5)} title="Back 5 frames" className="w-6 h-7">⏪</Btn>
            <Btn
              onClick={controls.toggle}
              title={playing ? 'Pause (Space)' : 'Play (Space)'}
              active={playing}
              className="w-8 h-8 rounded-full text-sm font-bold"
            >
              {playing ? '⏸' : '▶'}
            </Btn>
            <Btn onClick={() => controls.seek(currentIndex + 5)} title="Forward 5 frames" className="w-6 h-7">⏩</Btn>
            <Btn onClick={controls.stop} title="Stop — return to LIVE" danger className="w-6 h-7">⏹</Btn>

            <div className="w-px h-4 bg-white/10 mx-0.5 shrink-0" />

            <span className="hidden sm:block text-[10px] font-mono text-white/30 shrink-0 w-10 text-right">
              {total > 0 ? timeAgo(startTs) : '—'}
            </span>

            <div className="flex-1 min-w-0 mx-1">
              {total > 1 ? (
                <input
                  type="range"
                  min={0}
                  max={total - 1}
                  value={currentIndex}
                  onInput={onSliderInput}
                  onKeyDown={onKey}
                  aria-label="Timeline scrubber"
                  className="w-full h-1.5 rounded-full cursor-pointer focus:outline-none"
                  style={{
                    accentColor: '#fbbf24',
                    background: `linear-gradient(to right,#fbbf24 0%,#fbbf24 ${pct}%,rgba(255,255,255,0.12) ${pct}%,rgba(255,255,255,0.12) 100%)`,
                  }}
                />
              ) : (
                <div className="w-full h-1.5 rounded-full bg-white/10 animate-pulse" />
              )}
            </div>

            {isLive ? (
              <span className="shrink-0 flex items-center gap-1 text-[10px] font-bold font-mono
                               text-emerald-400 bg-emerald-500/15 px-1.5 py-0.5 rounded-full
                               border border-emerald-400/30">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                LIVE
              </span>
            ) : (
              <span className="shrink-0 text-[10px] font-mono text-amber-300/80 hidden sm:block">
                {fmtUtc(currentTs)}
              </span>
            )}

            <div className="w-px h-4 bg-white/10 mx-0.5 shrink-0 hidden sm:block" />

            <div className="hidden sm:flex items-center gap-0.5 shrink-0">
              {SPEEDS.map(({ label, value }) => (
                <button
                  key={value}
                  onClick={() => controls.setSpeed(value)}
                  className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold border transition shrink-0
                              ${speed === value
                                ? 'bg-amber-400/30 border-amber-400 text-amber-200'
                                : 'bg-white/5 border-white/10 text-white/30 hover:text-white/70'}`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="w-px h-4 bg-white/10 mx-0.5 shrink-0" />
            <Btn onClick={controls.requestHistory} title="Refresh history" className="w-6 h-6">↻</Btn>
            <Btn onClick={() => setMinimized(true)} title="Minimize" className="w-6 h-6">▼</Btn>
          </div>

          {replayMode && (
            <div className="flex items-center gap-2 px-3 pb-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              <span className="text-[10px] font-mono text-amber-300">
                REPLAY — frame {currentIndex + 1}/{total}
              </span>
              <button
                onClick={controls.stop}
                className="ml-auto text-[10px] font-mono font-bold px-2 py-0.5 rounded
                           bg-amber-400/20 border border-amber-400/30 text-amber-200
                           hover:bg-amber-400/40 transition"
              >
                RETURN LIVE
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}