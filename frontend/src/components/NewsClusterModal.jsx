/**
 * NewsClusterModal — shown when the user clicks a news cluster marker on the globe.
 * Displays a scrollable list of all news items in that cluster.
 * Clicking an item closes the modal and opens its full popup.
 */

import React from 'react';
import { timeAgo } from '../utils/geoUtils.js';

function getCategoryColor(item) {
  const t = (item.title || '').toLowerCase();
  if (/explosion|blast|strike|bomb|attack|missile|kill|dead/.test(t)) return 'text-red-400 border-red-500/50';
  if (/aircraft|fighter|drone|airstrike|warplane/.test(t))            return 'text-orange-400 border-orange-500/50';
  if (/naval|warship|submarine|fleet|vessel/.test(t))                  return 'text-blue-400 border-blue-500/50';
  if (/military|troops|soldiers|army|forces/.test(t))                  return 'text-amber-400 border-amber-500/50';
  return 'text-green-400 border-green-500/50';
}

function getCategoryDot(item) {
  const t = (item.title || '').toLowerCase();
  if (/explosion|blast|strike|bomb|attack|missile|kill|dead/.test(t)) return 'bg-red-500';
  if (/aircraft|fighter|drone|airstrike|warplane/.test(t))            return 'bg-orange-500';
  if (/naval|warship|submarine|fleet|vessel/.test(t))                  return 'bg-blue-500';
  if (/military|troops|soldiers|army|forces/.test(t))                  return 'bg-amber-500';
  return 'bg-green-500';
}

const NewsClusterModal = ({ items, onSelect, onClose }) => {
  if (!items || items.length === 0) return null;

  // Sort by publishedAt desc (newest first)
  const sorted = [...items].sort(
    (a, b) => new Date(b.publishedAt || b.firstSeenAt || 0) - new Date(a.publishedAt || a.firstSeenAt || 0)
  );

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40"
        style={{ background: 'rgba(0,0,0,0.65)' }}
        onClick={onClose}
      />

      {/* Modal */}
      <div
        className="fixed z-50 hud-panel"
        style={{
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 'min(520px, calc(100vw - 24px))',
          maxHeight: 'calc(100vh - 100px)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-hud-border shrink-0"
          style={{ background: 'rgba(0,0,0,0.4)' }}>
          <div>
            <div className="hud-title text-xs sm:text-sm text-hud-amber">NEWS CLUSTER</div>
            <div className="text-white font-mono font-bold text-sm sm:text-base">
              {items.length} EVENTS IN THIS AREA
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-hud-text hover:text-white text-xl leading-none px-2"
          >&times;</button>
        </div>

        {/* Scrollable list */}
        <div className="overflow-y-auto flex-1 divide-y divide-hud-border/30">
          {sorted.map((item, idx) => {
            const colors = getCategoryColor(item);
            const dot    = getCategoryDot(item);
            const ts     = item.publishedAt || item.firstSeenAt;
            return (
              <button
                key={item.id || idx}
                className={`w-full text-left px-4 py-3 hover:bg-white/5 transition-colors border-l-2 ${colors}`}
                onClick={() => { onClose(); onSelect(item); }}
              >
                <div className="flex items-start gap-3">
                  {/* Color dot */}
                  <span className={`mt-1.5 shrink-0 w-2 h-2 rounded-full ${dot}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-xs sm:text-sm font-mono leading-snug line-clamp-2">
                      {item.title}
                    </p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className="text-hud-amber text-xs font-mono">{item.source}</span>
                      {ts && (
                        <span className="text-hud-text text-xs">{timeAgo(ts)}</span>
                      )}
                    </div>
                  </div>
                  {/* Arrow */}
                  <span className="text-hud-text shrink-0 mt-1">›</span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 border-t border-hud-border/50 shrink-0"
          style={{ background: 'rgba(0,0,0,0.3)' }}>
          <p className="text-hud-text text-xs font-mono text-center">
            CLICK AN EVENT TO VIEW DETAILS · ESC TO CLOSE
          </p>
        </div>
      </div>
    </>
  );
};

export default NewsClusterModal;
