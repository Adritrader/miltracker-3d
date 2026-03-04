/**
 * TimelinePanel – Scrubber + playback controls for position-replay mode.
 *
 * Layout (bottom-center of the globe):
 *  ┌───────────────────────────────────────────────────────┐
 *  │  ●───────────────────────────────  1h 22m ago  [LIVE] │
 *  │  [◄◄] [▶] [■]   [1×] [5×] [20×] [60×] [120×]        │
 *  │  00:12 UTC · 2 Mar 2026 ·  48 frames loaded          │
 *  └───────────────────────────────────────────────────────┘
 */

import { useCallback, useRef } from 'react';

const SPEEDS = [
  { label: '1×',   value: 1,   title: 'Normal (1× real-time)' },
  { label: '5×',   value: 5,   title: 'Fast (5× real-time)' },
  { label: '20×',  value: 20,  title: 'Very Fast (20× real-time)' },
  { label: '60×',  value: 60,  title: 'Extra Fast (60× real-time)' },
  { label: '120×', value: 120, title: 'Ultra (120× real-time)' },
];

function fmtTs(isoStr) {
  if (!isoStr) return '--:-- UTC';
  const d = new Date(isoStr);
  const hh  = String(d.getUTCHours()).padStart(2, '0');
  const mm  = String(d.getUTCMinutes()).padStart(2, '0');
  const ss  = String(d.getUTCSeconds()).padStart(2, '0');
  const day = d.toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric', timeZone:'UTC' });
  return `${hh}:${mm}:${ss} UTC · ${day}`;
}

function timeAgo(isoStr) {
  if (!isoStr) return '';
  const diff = Date.now() - new Date(isoStr).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  const rm = m % 60;
  return rm > 0 ? `${h}h ${rm}m ago` : `${h}h ago`;
}

export default function TimelinePanel({
  snapshots,
  currentIndex,
  playing,
  speed,
  replayMode,
  currentTs,
  controls,
}) {
  const sliderRef = useRef(null);

  const total = snapshots.length;
  const startTs = snapshots[0]?.ts;
  const endTs   = snapshots[total - 1]?.ts;
  const isLive  = !replayMode || currentIndex >= total - 1;

  const onSliderInput = useCallback((e) => {
    const idx = Math.round(Number(e.target.value));
    controls.seek(idx);
  }, [controls]);

  const onSliderKeyDown = useCallback((e) => {
    if (e.key === 'ArrowLeft')  controls.seek(currentIndex - 1);
    if (e.key === 'ArrowRight') controls.seek(currentIndex + 1);
    if (e.key === ' ') { e.preventDefault(); controls.toggle(); }
  }, [controls, currentIndex]);

  // Request history when the panel mounts / user opens it
  // (called by parent via useEffect, but also available directly)
  if (total === 0) {
    return (
      <div
        className="absolute bottom-20 left-1/2 -translate-x-1/2 z-30
                   bg-black/80 backdrop-blur border border-white/10 rounded-xl
                   px-5 py-3 text-white/60 text-xs font-mono flex items-center gap-3
                   select-none pointer-events-auto"
        style={{ minWidth: 320 }}
      >
        <span className="animate-pulse text-amber-400/80">⧖</span>
        <span>Loading history… click TIMELINE to fetch.</span>
        <button
          onClick={controls.requestHistory}
          className="ml-auto px-3 py-1 rounded-lg bg-white/10 hover:bg-white/20
                     text-white/80 text-xs font-mono transition"
        >
          FETCH
        </button>
      </div>
    );
  }

  return (
    <div
      className="absolute bottom-20 left-1/2 -translate-x-1/2 z-30
                 bg-black/85 backdrop-blur-md border border-white/10 rounded-2xl
                 px-4 pt-3 pb-3 text-white select-none pointer-events-auto
                 flex flex-col gap-2"
      style={{ minWidth: 460, maxWidth: 660 }}
    >
      {/* ── Row 1: slider ──────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2">
        {/* left label */}
        <span className="text-[10px] font-mono text-white/40 shrink-0 w-14 text-right truncate"
              title={startTs}>
          {timeAgo(startTs)}
        </span>

        {/* slider */}
        <div className="relative flex-1 flex items-center h-6">
          <input
            ref={sliderRef}
            type="range"
            min={0}
            max={Math.max(0, total - 1)}
            value={currentIndex}
            onInput={onSliderInput}
            onKeyDown={onSliderKeyDown}
            className="w-full h-1 accent-amber-400 bg-white/20 rounded-full cursor-pointer
                       focus:outline-none"
            style={{
              background: `linear-gradient(to right,
                #fbbf24 0%,
                #fbbf24 ${total > 1 ? (currentIndex / (total - 1)) * 100 : 100}%,
                rgba(255,255,255,0.15) ${total > 1 ? (currentIndex / (total - 1)) * 100 : 100}%,
                rgba(255,255,255,0.15) 100%)`,
            }}
          />
        </div>

        {/* right label – LIVE badge or time-ago */}
        <div className="shrink-0 flex items-center gap-1">
          {isLive ? (
            <span className="flex items-center gap-1 text-[10px] font-bold font-mono
                             text-emerald-400 bg-emerald-500/20 px-2 py-0.5 rounded-full
                             border border-emerald-400/30">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse inline-block" />
              LIVE
            </span>
          ) : (
            <span className="text-[10px] font-mono text-amber-300/80 w-14 truncate"
                  title={currentTs}>
              {timeAgo(currentTs)}
            </span>
          )}
        </div>
      </div>

      {/* ── Row 2: controls ──────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Rewind to start */}
        <button
          onClick={() => controls.seek(0)}
          title="Jump to start"
          className="w-7 h-7 flex items-center justify-center rounded-lg
                     bg-white/5 hover:bg-white/15 border border-white/10
                     text-white/70 text-xs transition"
        >⏮</button>

        {/* Play / Pause */}
        <button
          onClick={controls.toggle}
          title={playing ? 'Pause' : 'Play'}
          className={`w-8 h-8 flex items-center justify-center rounded-full
                      border text-sm font-bold transition
                      ${playing
                        ? 'bg-amber-400/25 border-amber-400 text-amber-300 hover:bg-amber-400/40'
                        : 'bg-white/10 border-white/20 text-white hover:bg-white/20'}`}
        >
          {playing ? '⏸' : '▶'}
        </button>

        {/* Stop (return to live) */}
        <button
          onClick={controls.stop}
          title="Stop & return to live"
          className="w-7 h-7 flex items-center justify-center rounded-lg
                     bg-white/5 hover:bg-red-500/20 border border-white/10
                     hover:border-red-400/40 text-white/70 hover:text-red-300 text-xs transition"
        >⏹</button>

        <div className="w-px h-5 bg-white/10 mx-1" />

        {/* Speed buttons */}
        {SPEEDS.map(({ label, value, title }) => (
          <button
            key={value}
            onClick={() => controls.setSpeed(value)}
            title={title}
            className={`px-2 py-1 rounded-lg text-xs font-mono font-bold border transition
                        ${speed === value
                          ? 'bg-amber-400/30 border-amber-400 text-amber-200'
                          : 'bg-white/5 border-white/10 text-white/50 hover:bg-white/15 hover:text-white/80'}`}
          >
            {label}
          </button>
        ))}

        {/* Fetch / refresh history */}
        <button
          onClick={controls.requestHistory}
          title="Refresh history from server"
          className="ml-auto w-7 h-7 flex items-center justify-center rounded-lg
                     bg-white/5 hover:bg-white/15 border border-white/10
                     text-white/50 hover:text-white/80 text-xs transition"
        >↻</button>
      </div>

      {/* ── Row 3: timestamp + info ───────────────────────────────────────── */}
      <div className="flex items-center justify-between text-[10px] font-mono text-white/35">
        <span>{fmtTs(currentTs)}</span>
        <span>
          {replayMode
            ? `frame ${currentIndex + 1} / ${total}`
            : `${total} frames · ~${Math.round(total * 0.5)}min history`}
        </span>
      </div>
    </div>
  );
}
