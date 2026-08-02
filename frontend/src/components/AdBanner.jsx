/**
 * AdBanner — Monetag ads, shown ONLY to free-tier users.
 *
 * The script is injected dynamically here so Pro users never load it.
 * This component is only rendered when !isPro (see App.jsx).
 */

import { useEffect } from 'react';
import { useIsMobile } from '../hooks/useIsMobile.js';

const MONETAG_SRC  = 'https://quge5.com/88/tag.min.js';
const MONETAG_ZONE = '265147';

export default function AdBanner() {
  // Monetag's in-page push/notification creatives run heavy DOM + timer loops
  // that reliably crash Cesium's WebGL rendering on mobile (RangeError:
  // Invalid array length) — reproduces on both the browser and the installed
  // PWA, so it isn't tab-backgrounding, it's raw memory/CPU contention on
  // constrained mobile GPUs. Skip loading the ad entirely on mobile viewports
  // until Monetag serves a lighter creative for this zone.
  const isMobile = useIsMobile();

  useEffect(() => {
    if (isMobile) return;
    // Avoid double-injection on re-renders
    if (document.querySelector(`script[data-zone="${MONETAG_ZONE}"]`)) return;

    // Delay injection so the ad script (heavy/aggressive on mobile) doesn't
    // compete with Cesium's WebGL context creation during initial page load.
    const timer = setTimeout(() => {
      if (document.querySelector(`script[data-zone="${MONETAG_ZONE}"]`)) return;
      try {
        const script = document.createElement('script');
        script.src = MONETAG_SRC;
        script.setAttribute('data-zone', MONETAG_ZONE);
        script.setAttribute('data-cfasync', 'false');
        script.async = true;
        document.head.appendChild(script);
      } catch (_) { /* ignore ad script injection failures */ }
    }, 3000);

    return () => {
      clearTimeout(timer);
      // Remove script if user upgrades to Pro mid-session
      const el = document.querySelector(`script[data-zone="${MONETAG_ZONE}"]`);
      if (el) el.remove();
    };
  }, []);

  // Monetag manages its own ad placement — no DOM node needed here
  return null;
}

