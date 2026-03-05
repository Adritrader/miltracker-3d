/**
 * TimelinePanel — persistent video-controls bar always visible at the bottom
 * of the globe. Like a YouTube / Netflix scrubber, not hidden behind a toggle.
 *
 * Layout (bottom of screen, full-width up to max-w-3xl):
 *
 *  ┌─────────────────────────────────────────────────────────────────────┐
 *  │  h h ago ●━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━○  15m ago  LIVE  │
 *  │  ⏮  ⏪  ▶  ⏩  ⏹   1×  5×  20×  60×  120×  12:45 UTC  48f  ↓   │
 *  └─────────────────────────────────────────────────────────────────────┘
 *
 *  Always rendered (no toggle button needed). Auto-fetches history on mount.
 *  Minimize ▼/▲ collapses to a 4-px accent hairline that is still clickable.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

const SPEEDS = [
  { label: '1×',   value: 1   },
  { label: '5×',   value: 5   },
  { label: '20×',  value: 20  },
  { label: '60×',  value: 60  },
  { label: '120×', value: 120 },
];

/* ── date formatting ───────────────────────────────────────────────────── */
function fmtTime(isoStr) {
  if (!isoStr) return '--:--';
  const d = new Date(isoStr);
  return `${String(d.getUTCHours()).padStart(2,'0')}:${String(d.getUTCMinutes()).padStart(2,'0')}:${String(d.getUTCSeconds()).padStart(2,'0')} UTC`;
}
function fmtDate(isoStr) {
  if (!isoStr) return '';
  return new Date(isoStr).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC',
  });
}
function timeAgo(isoStr) {
  if (!isoStr) return '—';
  const s = Math.floor((Date.now() - new Date(isoStr).getTime()) / 1000);
  if (s < 60)  return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60)  return `${m}m ago`;
  const h = Math.floor(m / 60), rm = m % 60;
  return rm > 0 ? `${h}h ${rm}m ago` : `${h}h ago`;
}

/* ── tiny reusable icon button ───────────────────────────────────────── */
function IconBtn({ onClick, title, active, danger, wide, children, className = '' }) {
  const base = 'flex items-center justify-center rounded-lg border text-xs transition select-none shrink-0';
  const variant = active
    ? 'bg-amber-400/25 border-amber-400/60 text-amber-200 hover:bg-amber-400/40'
    : danger
      ? 'bg-white/5 border-white/10 text-white/60 hover:bg-red-500/20 hover:border-red-400/40 hover:text-red-300'
      : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/15 hover:text-white/90';
  return (
    <button
      onClick={onClick}
      title={title}
      className={`${base} ${variant} ${className}`}
    >
      {children}
    </button>
  );
}

/* ── main component ──────────────────────────────────────────────────── */
export default function TimelinePanel({
  snapshots = [],
  currentIndex = 0,
  playing = false,
  speed = 1,
  replayMode = false,
  currentTs = null,
  controls,
}) {
  const sliderRef   = useRef(null);
  const fetchedRef  = useRef(false);
  const [minimized, setMinimized] = useState(false);

  const total   = snapshots.length;
  const startTs = snapshots[0]?.ts ?? null;
  const isLive  = !replayMode || currentIndex >= total - 1;
  const pct     = total > 1 ? (currentIndex / (total - 1)) * 100 : 100;

  /* Auto-fetch history once on mount (no button press needed) */
  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;
    controls?.requestHistory?.();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onSliderInput = useCallback((e) => {
    controls.seek(Math.round(Number(e.target.value)));
  }, [controls]);

  const onSliderKeyDown = useCallback((e) => {
    if (e.key === 'ArrowLeft')  { e.preventDefault(); controls.seek(currentIndex - 1); }
    if (e.key === 'ArrowRight') { e.preventDefault(); controls.seek(currentIndex + 1); }
    if (e.key === ' ')          { e.preventDefault(); controls.toggle(); }
  }, [controls, currentIndex]);

  /* ── MINIMIZED: hairline accent bar at very bottom ──────────────────── */
  if (minimized) {
    return (
      <div className="fixed top-0 left-0 right-0 z-30 flex justify-center pointer-events-auto">
        <button
          onClick={() => setMinimized(false)}
          title="Expand timeline controls"
          className="group relative w-full max-w-2xl mx-2 h-3 flex items-center justify-center"
        >
          <div
            className="w-full h-1 rounded-full transition-opacity group-hover:opacity-100 opacity-60"
            style={{
              background: isLive
                ? 'linear-gradient(to right, rgba(52,211,153,0.2), rgba(52,211,153,0.8), rgba(52,211,153,0.2))'
                : `linear-gradient(to right, rgba(251,191,36,0.1), #fbbf24 ${pct}%, rgba(255,255,255,0.15) ${pct}%)`,
            }}
          />
          <span className="absolute text-[9px] text-white/40 group-hover:text-white/70 font-mono transition pointer-events-none">
            ▼ TIMELINE
          </span>
        </button>
      </div>
    );
  }

  /* ── FULL PANEL ─────────────────────────────────────────────────────── */
  return (
    <div
      className="fixed top-0 left-0 right-0 z-30 flex justify-center pointer-events-none"
    >
      <div
        className="w-full max-w-2xl mx-2 mt-1.5 pointer-events-auto select-none"
      >
        {/* Glass card */}
        <div
          className="rounded-2xl border border-white/10 overflow-hidden"
          style={{ background: 'rgba(5,8,16,0.90)', backdropFilter: 'blur(18px)' }}
        >
          {/* Top accent line — green=live, amber=replay */}
          <div
            className="h-0.5 transition-colors duration-700"
            style={{
              background: isLive
                ? 'rgba(52,211,153,0.55)'
                : `linear-gradient(to right, rgba(251,191,36,0.8) ${pct}%, rgba(255,255,255,0.05) ${pct}%)`,
            }}
          />

          <div className="px-4 pt-2.5 pb-2.5 flex flex-col gap-2">

            {/* ── Row 1: scrubber ──────────────────────────────────── */}
            <div className="flex items-center gap-2">
              {/* oldest timestamp */}
              <span
                className="text-[10px] font-mono text-white/30 shrink-0 w-12 text-right leading-none"
                title={startTs ?? ''}
              >
                {total > 0 ? timeAgo(startTs) : '—'}
              </span>

              {/* track */}
              <div className="flex-1 flex items-center">
                {total > 0 ? (
                  <input
                    ref={sliderRef}
                    type="range"
                    min={0}
                    max={Math.max(0, total - 1)}
                    value={currentIndex}
                    onInput={onSliderInput}
                    onKeyDown={onSliderKeyDown}
                    aria-label="Timeline position scrubber"
                    className="w-full h-1.5 rounded-full cursor-pointer focus:outline-none"
                    style={{
                      accentColor: '#fbbf24',
                      background: `linear-gradient(to right,
                        #fbbf24 0%, #fbbf24 ${pct}%,
                        rgba(255,255,255,0.14) ${pct}%, rgba(255,255,255,0.14) 100%)`,
                    }}
                  />
                ) : (
                  <div className="w-full h-1.5 rounded-full bg-white/10 animate-pulse" />
                )}
              </div>

              {/* newest / LIVE */}
              {isLive ? (
                <span className="shrink-0 flex items-center gap-1 text-[10px] font-bold
                                 font-mono text-emerald-400 bg-emerald-500/15 px-2 py-0.5
                                 rounded-full border border-emerald-400/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse inline-block" />
                  LIVE
                </span>
              ) : (
                <span
                  className="shrink-0 text-[10px] font-mono text-amber-300/80 w-14 truncate leading-none"
                  title={currentTs ?? ''}
                >
                  {timeAgo(currentTs)}
                </span>
              )}
            </div>

            {/* ── Row 2: transport + speed + info + minimize ───────── */}
            <div className="flex items-center gap-1.5 flex-wrap">

              {/* Jump to start */}
              <IconBtn onClick={() => controls.seek(0)} title="Jump to oldest frame" className="w-7 h-7">
                ⏮
              </IconBtn>

              {/* Step back ×5 */}
              <IconBtn onClick={() => controls.seek(currentIndex - 5)} title="Back 5 frames (~2.5 min)" className="w-7 h-7 text-[11px]">
                ⏪
              </IconBtn>

              {/* Play / Pause (larger) */}
              <IconBtn
                onClick={controls.toggle}
                title={playing ? 'Pause (Space)' : 'Play (Space)'}
                active={playing}
                className="w-9 h-9 text-sm font-bold rounded-full"
              >
                {playing ? '⏸' : '▶'}
              </IconBtn>

              {/* Step forward ×5 */}
              <IconBtn onClick={() => controls.seek(currentIndex + 5)} title="Forward 5 frames (~2.5 min)" className="w-7 h-7 text-[11px]">
                ⏩
              </IconBtn>

              {/* Stop → return to live */}
              <IconBtn onClick={controls.stop} title="Stop — return to LIVE" danger className="w-7 h-7">
                ⏹
              </IconBtn>

              {/* Divider */}
              <div className="w-px h-4 bg-white/10 mx-0.5 shrink-0" />

              {/* Speed selector */}
              {SPEEDS.map(({ label, value }) => (
                <button
                  key={value}
                  onClick={() => controls.setSpeed(value)}
                  title={`Playback at ${label} real-time`}
                  className={`px-1.5 py-0.5 rounded-md text-[11px] font-mono font-bold
                              border transition shrink-0
                              ${speed === value
                                ? 'bg-amber-400/30 border-amber-400 text-amber-200'
                                : 'bg-white/5 border-white/10 text-white/35 hover:bg-white/15 hover:text-white/80'}`}
                >
                  {label}
                </button>
              ))}

              {/* Spacer */}
              <div className="flex-1 min-w-0" />

              {/* Timestamp + frame count */}
              <span className="hidden sm:block text-[10px] font-mono text-white/30 shrink-0 mr-1">
                {total > 0
                  ? `${fmtTime(currentTs)}  ·  ${fmtDate(currentTs)}  ·  ${replayMode ? `frame ${currentIndex + 1}/${total}` : `${total} frames`}`
                  : 'Fetching history…'}
              </span>

              {/* Refresh */}
              <IconBtn onClick={controls.requestHistory} title="Refresh history" className="w-6 h-6 text-[10px]">
                ↻
              </IconBtn>

              {/* Minimize */}
              <IconBtn onClick={() => setMinimized(true)} title="Minimize timeline" className="w-6 h-6 text-[10px]">
                ▼
              </IconBtn>
            </div>

            {/* ── Replay banner (only during active replay) ────────── */}
            {replayMode && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl
                              bg-amber-400/10 border border-amber-400/20">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse shrink-0" />
                <span className="text-[10px] font-mono text-amber-300">
                  REPLAY MODE — globe shows historical positions
                </span>
                <button
                  onClick={controls.stop}
                  className="ml-auto text-[10px] font-mono font-bold px-2 py-0.5 rounded-lg
                             bg-amber-400/20 hover:bg-amber-400/40 border border-amber-400/30
                             text-amber-200 transition"
                >
                  RETURN LIVE
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

