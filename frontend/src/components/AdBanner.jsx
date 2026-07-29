/**
 * AdBanner — Monetag ads, shown ONLY to free-tier users.
 *
 * The script is injected dynamically here so Pro users never load it.
 * This component is only rendered when !isPro (see App.jsx).
 */

import { useEffect } from 'react';

const MONETAG_SRC  = 'https://quge5.com/88/tag.min.js';
const MONETAG_ZONE = '265147';

export default function AdBanner() {
  useEffect(() => {
    // Avoid double-injection on re-renders
    if (document.querySelector(`script[data-zone="${MONETAG_ZONE}"]`)) return;

    const script = document.createElement('script');
    script.src = MONETAG_SRC;
    script.setAttribute('data-zone', MONETAG_ZONE);
    script.setAttribute('data-cfasync', 'false');
    script.async = true;
    document.head.appendChild(script);

    return () => {
      // Remove script if user upgrades to Pro mid-session
      const el = document.querySelector(`script[data-zone="${MONETAG_ZONE}"]`);
      if (el) el.remove();
    };
  }, []);

  // Monetag manages its own ad placement — no DOM node needed here
  return null;
}

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


