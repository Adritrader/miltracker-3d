/**
 * AdBanner — Monetag ads, shown ONLY to free-tier users.
 *
 * The script is injected dynamically here so Pro users never load it.
 * This component is only rendered when !isPro (see App.jsx).
 */

import { useEffect } from 'react';

// In-Page Push (Banner) + Onclick (Popunder) — swapped from Multitag
// (Popunder + Push Notifications + Vignette combined), which was overloading
// mobile DOM/CPU and crashing Cesium's WebGL render loop. Root cause of the
// black-screen crash was the IonImageryProvider bug (fixed separately), so
// these lighter formats are now enabled on mobile too.
const AD_TAGS = [
  { src: 'https://nap5k.com/tag.min.js', zone: '11485282' }, // In-Page Push
  { src: 'https://al5sm.com/tag.min.js', zone: '11485407' }, // Onclick (Popunder)
];

export default function AdBanner() {
  useEffect(() => {
    const timer = setTimeout(() => {
      for (const { src, zone } of AD_TAGS) {
        if (document.querySelector(`script[data-zone="${zone}"]`)) continue;
        try {
          const script = document.createElement('script');
          script.src = src;
          script.setAttribute('data-zone', zone);
          script.setAttribute('data-cfasync', 'false');
          script.async = true;
          document.head.appendChild(script);
        } catch (_) { /* ignore ad script injection failures */ }
      }
    }, 3000); // delay so ad scripts don't compete with Cesium's WebGL init

    return () => {
      clearTimeout(timer);
      // Remove scripts if user upgrades to Pro mid-session
      for (const { zone } of AD_TAGS) {
        const el = document.querySelector(`script[data-zone="${zone}"]`);
        if (el) el.remove();
      }
    };
  }, []);

  // Monetag manages its own ad placement — no DOM node needed here
  return null;
}

