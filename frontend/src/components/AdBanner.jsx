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

