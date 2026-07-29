/**
 * AdBanner — Ezoic ad placeholder, shown only to free-tier users.
 *
 * Placement: fixed bottom-left corner on desktop, bottom-center on mobile.
 *
 * Configuration (set in .env):
 *   VITE_EZOIC_PLACEHOLDER  — Ezoic placeholder ID from your Ezoic dashboard (e.g. 101)
 *
 * Setup:
 *   1. Sign up at https://ezoic.com and add livewar3d.com
 *   2. Verify via their nameserver or script method
 *   3. Create an ad placeholder in Ezoic dashboard → get a numeric ID
 *   4. Set VITE_EZOIC_PLACEHOLDER=<that ID> in .env and Vercel env vars
 */

import { useEffect, useRef, useState } from 'react';

const PLACEHOLDER_ID = import.meta.env.VITE_EZOIC_PLACEHOLDER || '';

export default function AdBanner({ isMobile = false, newsPanelHeight = 0 }) {
  const divRef   = useRef(null);
  const defined  = useRef(false);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    if (!PLACEHOLDER_ID || defined.current) return;
    const id = Number(PLACEHOLDER_ID);
    if (!id) return;

    const run = () => {
      try {
        window.ezstandalone = window.ezstandalone || {};
        window.ezstandalone.cmd = window.ezstandalone.cmd || [];
        window.ezstandalone.cmd.push(() => {
          window.ezstandalone.define(id);
          window.ezstandalone.enable();
          window.ezstandalone.display();
        });
        defined.current = true;
      } catch { /* ezoic not loaded yet */ }
    };

    // Wait for Ezoic script to initialise (it loads async)
    if (typeof window.ezstandalone?.cmd !== 'undefined') {
      run();
    } else {
      const t = setTimeout(run, 1500);
      return () => clearTimeout(t);
    }
  }, []);

  // Hide if placeholder renders with 0 height (ad blocker or no fill)
  useEffect(() => {
    if (!PLACEHOLDER_ID) return;
    const t = setTimeout(() => {
      if (divRef.current && divRef.current.offsetHeight === 0) setHidden(true);
    }, 4000);
    return () => clearTimeout(t);
  }, []);

  if (!PLACEHOLDER_ID || hidden) return null;

  const bottomOffset = (isMobile ? 72 : 16) + newsPanelHeight;

  return (
    <div
      className="fixed z-[34] pointer-events-auto"
      style={
        isMobile
          ? { bottom: bottomOffset + 8, left: '50%', transform: 'translateX(-50%)', width: 320 }
          : { bottom: bottomOffset + 8, left: 16, width: 300 }
      }
    >
      <div className="text-[8px] font-mono text-hud-text/25 tracking-widest uppercase mb-0.5 text-center select-none">
        Advertisement
      </div>
      <div
        ref={divRef}
        id={`ezoic-pub-ad-placeholder-${PLACEHOLDER_ID}`}
        style={{ minHeight: 50 }}
      />
    </div>
  );
}


