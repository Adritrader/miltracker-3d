/**
 * FlightProfile – altitude and speed over the last hours for one aircraft,
 * from the archived position snapshots (/api/history/trail). Two separate
 * sparklines (never a shared dual axis), each with a hover crosshair readout.
 */

import React, { useEffect, useMemo, useState } from 'react';

const BACKEND  = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
const HOURS    = 6;
const CACHE_MS = 2 * 60 * 1000;
const _cache   = new Map(); // hex → { at, points }

const W = 200;
const H = 34;
const PAD = 3;

function fmtTime(ts) {
  return new Date(ts).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

const Sparkline = ({ label, points, value, format, color }) => {
  const [hover, setHover] = useState(null); // index into points

  const geom = useMemo(() => {
    const t0 = points[0].t, t1 = points[points.length - 1].t;
    const vals = points.map(p => p[value]);
    const lo = Math.min(...vals), hi = Math.max(...vals);
    const span = hi - lo || 1;
    const x = t => PAD + ((t - t0) / (t1 - t0 || 1)) * (W - PAD * 2);
    const y = v => H - PAD - ((v - lo) / span) * (H - PAD * 2);
    const d = points.map((p, i) => `${i ? 'L' : 'M'}${x(p.t).toFixed(1)},${y(p[value]).toFixed(1)}`).join('');
    return { x, y, d, lo, hi };
  }, [points, value]);

  const onMove = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const fx = ((clientX - r.left) / r.width) * W;
    let best = 0;
    for (let i = 1; i < points.length; i++) {
      if (Math.abs(geom.x(points[i].t) - fx) < Math.abs(geom.x(points[best].t) - fx)) best = i;
    }
    setHover(best);
  };

  const hp = hover != null ? points[hover] : null;
  const last = points[points.length - 1];

  return (
    <div className="mt-0.5">
      <div className="flex justify-between items-baseline text-[9px] sm:text-[10px] font-mono">
        <span className="hud-label">{label}</span>
        <span className="text-white font-bold">
          {hp ? `${format(hp[value])} · ${fmtTime(hp.t)}` : format(last[value])}
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full block touch-none" style={{ height: H }}
        preserveAspectRatio="none" role="img"
        aria-label={`${label}: ${format(geom.lo)} to ${format(geom.hi)} over the last ${HOURS} hours`}
        onMouseMove={onMove} onTouchStart={onMove} onTouchMove={onMove}
        onMouseLeave={() => setHover(null)} onTouchEnd={() => setHover(null)}>
        <line x1={PAD} x2={W - PAD} y1={H - PAD} y2={H - PAD} stroke="rgba(255,255,255,0.12)" strokeWidth="1" />
        <path d={geom.d} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round"
          strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        {hp && (
          <>
            <line x1={geom.x(hp.t)} x2={geom.x(hp.t)} y1={0} y2={H}
              stroke="rgba(255,255,255,0.35)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
            <circle cx={geom.x(hp.t)} cy={geom.y(hp[value])} r="2.5" fill={color}
              stroke="rgba(5,8,16,1)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
          </>
        )}
      </svg>
      <div className="flex justify-between text-[8px] font-mono text-hud-text/70">
        <span>{fmtTime(points[0].t)}</span>
        <span>min {format(geom.lo)} · max {format(geom.hi)}</span>
        <span>{fmtTime(last.t)}</span>
      </div>
    </div>
  );
};

const FlightProfile = ({ icao24, altUnit = 'ft', speedUnit = 'kt' }) => {
  const [points, setPoints] = useState(null);

  useEffect(() => {
    if (!/^[0-9a-f]{6}$/i.test(icao24 || '')) { setPoints(null); return; }
    const hex = icao24.toLowerCase();
    const hit = _cache.get(hex);
    if (hit && Date.now() - hit.at < CACHE_MS) { setPoints(hit.points); return; }
    let alive = true;
    setPoints(null);
    fetch(`${BACKEND}/api/history/trail/${hex}?hours=${HOURS}`)
      .then(r => (r.ok ? r.json() : []))
      .then(rows => {
        const pts = (Array.isArray(rows) ? rows : [])
          .filter(r => r.sampled_at && r.altitude != null && r.speed != null)
          .map(r => ({ t: Date.parse(r.sampled_at), alt: +r.altitude, spd: +r.speed }))
          .filter(p => Number.isFinite(p.t));
        _cache.set(hex, { at: Date.now(), points: pts });
        if (_cache.size > 200) _cache.delete(_cache.keys().next().value);
        if (alive) setPoints(pts);
      })
      .catch(() => { if (alive) setPoints([]); });
    return () => { alive = false; };
  }, [icao24]);

  // Need a few samples spread over time for a meaningful profile
  if (!points || points.length < 3 || points[points.length - 1].t - points[0].t < 5 * 60 * 1000) return null;

  const fmtAlt = altUnit === 'm'
    ? v => `${Math.round(v).toLocaleString()} m`
    : v => `${Math.round(v * 3.28084).toLocaleString()} ft`;
  const fmtSpd = speedUnit === 'kmh'
    ? v => `${Math.round(v * 1.852)} km/h`
    : v => `${Math.round(v)} kt`;

  return (
    <div className="mt-1 rounded-lg border border-hud-border/50 bg-black/20 p-1.5">
      <div className="text-[8px] sm:text-[9px] font-mono font-bold text-hud-text tracking-widest uppercase">
        ◆ FLIGHT PROFILE · LAST {HOURS}H
      </div>
      <Sparkline label="ALTITUDE" points={points} value="alt" format={fmtAlt} color="#ffb000" />
      <Sparkline label="SPEED"    points={points} value="spd" format={fmtSpd} color="#4dd4ff" />
    </div>
  );
};

export default FlightProfile;
