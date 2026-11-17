/**
 * RegionActivity – military air activity per hotspot vs. the same hour
 * yesterday, from /api/activity/regions (polled every 5 min).
 */

import React, { useEffect, useState } from 'react';

import { BACKEND } from '../utils/config.js';
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

const RegionActivity = ({ regions = [], isPro = false, onOpenPricing }) => {
  // Only regions with a real baseline; biggest movers first
  const rows = regions
    .filter(r => r.changePct != null)
    .sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct))
    .slice(0, 4);
  if (!rows.length) return null;

  // Pro feature: free users see the header and a teaser instead of the numbers
  if (!isPro) {
    return (
      <button
        type="button"
        onClick={onOpenPricing}
        className="mt-1.5 pt-1 border-t border-hud-border/40 w-full text-left group"
        title="Pro feature — military air activity per region vs. 24h ago"
      >
        <div className="hud-label text-[9px] opacity-70 mb-0.5 flex justify-between">
          <span>MIL AIR ACTIVITY VS 24H</span>
          <span className="text-hud-amber/70">🔒 PRO</span>
        </div>
        <div className="text-[10px] font-mono text-hud-text/60 group-hover:text-hud-green transition-colors">
          {rows.length} regions changed in the last 24h — upgrade to see where
        </div>
      </button>
    );
  }

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
