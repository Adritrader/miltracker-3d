/**
 * RegionActivity – military air activity per hotspot vs. the same hour
 * yesterday, from /api/activity/regions (polled every 5 min).
 */

import React, { useEffect, useState } from 'react';

const BACKEND = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
const POLL_MS = 5 * 60 * 1000;

export function useRegionActivity() {
  const [regions, setRegions] = useState([]);
  useEffect(() => {
    let alive = true;
    const load = () => fetch(`${BACKEND}/api/activity/regions`)
      .then(r => (r.ok ? r.json() : []))
      .then(d => { if (alive && Array.isArray(d)) setRegions(d); })
      .catch(() => {});
    load();
    const t = setInterval(load, POLL_MS);
    return () => { alive = false; clearInterval(t); };
  }, []);
  return regions;
}

const RegionActivity = ({ regions = [] }) => {
  // Only regions with a real baseline; biggest movers first
  const rows = regions
    .filter(r => r.changePct != null)
    .sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct))
    .slice(0, 4);
  if (!rows.length) return null;

  return (
    <div className="mt-1.5 pt-1 border-t border-hud-border/40">
      <div className="hud-label text-[9px] opacity-70 mb-0.5"
        title="Military-flagged aircraft airborne in each region, compared with the same hour yesterday">
        MIL AIR ACTIVITY VS 24H
      </div>
      {rows.map(r => {
        const up = r.changePct > 0;
        return (
          <div key={r.id} className="flex justify-between text-[10px] font-mono"
            title={`${r.now} aircraft now · ${r.dayAgo} at this hour yesterday`}>
            <span className="text-hud-text">{r.label}</span>
            <span className="text-white font-bold">
              <span className={up ? 'text-hud-amber' : r.changePct < 0 ? 'text-hud-blue' : 'text-hud-text'}>
                {up ? '▲' : r.changePct < 0 ? '▼' : '■'}
              </span>{' '}
              {up ? '+' : ''}{r.changePct}%
              <span className="text-hud-text font-normal"> ({r.now})</span>
            </span>
          </div>
        );
      })}
    </div>
  );
};

export default RegionActivity;
