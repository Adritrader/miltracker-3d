/**
 * NewsPanel – live news ticker at the bottom of the screen
 */

import React, { useState, useEffect, useRef } from 'react';
import { timeAgo } from '../utils/geoUtils.js';

/** Pick the best available timestamp for display: publishedAt (real article time) > firstSeenAt (poll time) */
function bestTs(item) {
  // publishedAt comes from GDELT seendate — unique per article.
  // firstSeenAt is the server poll time — same for every article in the same batch, so useless for display.
  const pub = item.publishedAt ? new Date(item.publishedAt) : null;
  if (pub && !isNaN(pub)) return item.publishedAt;
  return item.firstSeenAt || null;
}

/** Format a date string to compact date/time */
function fmtDate(d) {
  if (!d) return '';
  const dt = new Date(d);
  if (isNaN(dt)) return '';
  return dt.toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

const NewsPanel = ({ news, onSelectNews, isMobile = false, onHeightChange, onExpandedChange }) => {
  const [expanded, setExpanded] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(null);
  const [visibleCount, setVisibleCount] = useState(0);
  // B4: track first item's identity (not just array length) so trickle resets when new
  // content arrives even when the count stays the same (e.g. always 30 items max).
  const firstItemIdRef = useRef(null);
  const panelRef = useRef(null);

  // Report rendered panel height so parent can push Timeline/buttons up dynamically
  useEffect(() => {
    if (!panelRef.current || !onHeightChange) return;
    const ro = new ResizeObserver(entries => {
      for (const e of entries) onHeightChange(Math.round(e.contentRect.height));
    });
    ro.observe(panelRef.current);
    onHeightChange(Math.round(panelRef.current.getBoundingClientRect().height));
    return () => { ro.disconnect(); };
  }, [onHeightChange]);

  // Sort newest first — use publishedAt (real article time) so each article shows its actual age
  const recentNews = [...news]
    .sort((a, b) => new Date(bestTs(b) || 0) - new Date(bestTs(a) || 0))
    .slice(0, 30);

  // When new items arrive, reveal them one by one with a small delay
  useEffect(() => {
    if (recentNews.length === 0) return;
    if (visibleCount >= recentNews.length) {
      setVisibleCount(recentNews.length);
      return;
    }
    if (visibleCount < recentNews.length) {
      const t = setTimeout(() => setVisibleCount(v => Math.min(v + 1, recentNews.length)), 120);
      return () => clearTimeout(t);
    }
  }, [visibleCount, recentNews.length]);

  // B4: reset trickle animation when the top article changes (new batch arrived)
  useEffect(() => {
    const firstId = recentNews[0]?.id ?? null;
    if (firstId !== firstItemIdRef.current) {
      firstItemIdRef.current = firstId;
      setVisibleCount(0);
    }
  }, [recentNews]);

  const handleSelect = (item, idx) => {
    setSelectedIdx(idx);
    onSelectNews?.(item);
  };

  return (
    <div ref={panelRef} className={`fixed left-0 right-0 z-40 transition-all duration-150 ${expanded ? 'h-64' : 'h-10'}`}
         style={{ bottom: '28px' }}>
      {/* Ticker bar */}
      <div
        className="hud-panel border-t border-hud-border h-10 flex items-center gap-3 px-3 cursor-pointer select-none"
        onClick={() => {
          const next = !expanded;
          setExpanded(next);
          // Anticipate final height immediately so Timeline/buttons start their transition
          // in sync with the NewsPanel CSS animation (h-10=40px collapsed, h-64=256px expanded)
          if (onHeightChange) onHeightChange(next ? 256 : 40);
          if (onExpandedChange) onExpandedChange(next);
        }}
        style={{ borderRadius: 0 }}
      >
        <div className="flex items-center gap-1 shrink-0">
          <span className="w-2 h-2 rounded-full bg-hud-amber" />
          <span className="hud-title text-xs">INTEL FEED</span>
        </div>
        <div className="flex-1 overflow-hidden">
          {recentNews.length > 0 ? (
            <div
              className="flex gap-0 animate-ticker whitespace-nowrap"
              style={{
                width: 'max-content',
                // P2: 3s per item capped at 90s (was 6s/item, 3min max)
                animationDuration: `${Math.min(Math.max(recentNews.length * 3, 40), 90)}s`,
                // P2: pause ticker when panel is expanded — no GPU repaint while reading the list
                animationPlayState: expanded ? 'paused' : 'running',
              }}
            >
              {/* Duplicate items for seamless loop */}
              {[...recentNews, ...recentNews].slice(0, isMobile ? 20 : 40).map((item, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1 px-4 text-xs font-mono text-hud-text cursor-pointer hover:text-white"
                  onClick={(e) => { e.stopPropagation(); onSelectNews?.(item); }}
                >
                  <span className="text-hud-amber">&#x25B6;</span>
                  <span>{item.title?.slice(0, isMobile ? 55 : 90)}</span>
                  <span className="text-hud-border mx-2 opacity-50">&#x2022;&#x2022;&#x2022;</span>
                </span>
              ))}
            </div>
          ) : (
            <span className="text-hud-text text-xs">Waiting for news feed…</span>
          )}
        </div>
        <span className="text-hud-text text-xs shrink-0">{expanded ? '▼' : '▲'}</span>
      </div>

      {/* Expanded news list */}
      {expanded && (
        <div
          className="hud-panel border-t border-hud-border overflow-y-auto"
          style={{ height: 'calc(100% - 40px)', borderRadius: 0 }}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-0">
            {recentNews.slice(0, Math.max(visibleCount, recentNews.length)).map((item, i) => (
              <div
                key={item.id || `news-${i}`}
                onClick={() => handleSelect(item, i)}
                className={`px-3 py-2 border-b border-r border-hud-border/40 cursor-pointer
                  hover:bg-white/5 transition-all duration-200
                  ${selectedIdx === i ? 'bg-hud-green/10 border-l-2 border-l-hud-green' : ''}`}
                style={{
                  opacity: i < visibleCount ? 1 : 0,
                  transform: i < visibleCount ? 'translateY(0)' : 'translateY(8px)',
                  transition: 'opacity 0.25s ease, transform 0.25s ease',
                }}
              >
                <div className="flex items-start gap-2">
                  <span className="text-hud-amber text-xs mt-0.5 shrink-0">▶</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-xs font-mono leading-snug line-clamp-2">
                      {item.title}
                    </p>
                    <div className="flex flex-wrap gap-x-2 gap-y-0 mt-0.5 items-center">
                      <span className="text-hud-amber text-xs font-mono">{fmtDate(bestTs(item))}</span>
                      <span className="text-hud-border">·</span>
                      <span className="text-hud-text text-xs">{timeAgo(bestTs(item))}</span>
                      <span className="text-hud-border">·</span>
                      <span className="text-hud-text text-xs">{item.source}</span>
                      {item.lat && (
                        <>
                          <span className="text-hud-border">·</span>
                          <span className="text-hud-green text-xs">&#x25C9;</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
            {recentNews.length === 0 && (
              <div className="col-span-3 text-center text-hud-text py-8 text-sm">
                No news loaded yet — waiting for data feed
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NewsPanel;
