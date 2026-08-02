/**
 * AdBanner — Monetag ads, shown ONLY to free-tier users.
 *
 * The script is injected dynamically here so Pro users never load it.
 * This component is only rendered when !isPro (see App.jsx).
 */

import { useEffect } from 'react';
import { useIsMobile } from '../hooks/useIsMobile.js';

// In-Page Push (Banner) format — swapped from Multitag (Popunder + Push
// Notifications + Vignette combined), which was overloading mobile DOM/CPU
// and crashing Cesium's WebGL render loop.
const MONETAG_SRC  = 'https://nap5k.com/tag.min.js';
const MONETAG_ZONE = '11485282';

export default function AdBanner() {
  // Still withheld on mobile until the lighter In-Page Push format is
  // confirmed stable there too.
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
  }, [isMobile]);

  // Monetag manages its own ad placement — no DOM node needed here
  return null;
}

