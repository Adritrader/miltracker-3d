/**
 * AdBanner — Google AdSense banner, shown only to free-tier users.
 *
 * Placement: fixed bottom-left corner on desktop, bottom-center on mobile.
 *
 * Configuration (set in .env):
 *   VITE_ADSENSE_CLIENT  — publisher ID, e.g. ca-pub-6813391861469052
 *   VITE_ADSENSE_SLOT    — ad unit slot ID from AdSense console
 */

import { useEffect, useRef, useState } from 'react';

const CLIENT = import.meta.env.VITE_ADSENSE_CLIENT || 'ca-pub-6813391861469052';
const SLOT   = import.meta.env.VITE_ADSENSE_SLOT   || '';

export default function AdBanner({ isMobile = false, newsPanelHeight = 0 }) {
  const insRef = useRef(null);
  const pushed = useRef(false);
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    if (!SLOT || pushed.current) return;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
      pushed.current = true;
    } catch {
      setBlocked(true);
    }
  }, []);

  // Detect ad blocker: ins stays at 0 height when blocked
  useEffect(() => {
    if (!SLOT) return;
    const t = setTimeout(() => {
      if (insRef.current && insRef.current.offsetHeight === 0) setBlocked(true);
    }, 2500);
    return () => clearTimeout(t);
  }, []);

  if (!SLOT || blocked) return null;

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
      <ins
        ref={insRef}
        className="adsbygoogle"
        style={{ display: 'block' }}
        data-ad-client={CLIENT}
        data-ad-slot={SLOT}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </div>
  );
}

export default function AdBanner({ isMobile = false, newsPanelHeight = 0 }) {
  const insRef  = useRef(null);
  const pushed  = useRef(false);
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    if (!SLOT || pushed.current) return;
    try {
      const adsByGoogle = window.adsbygoogle || [];
      adsByGoogle.push({});
      window.adsbygoogle = adsByGoogle;
      pushed.current = true;
    } catch {
      setBlocked(true);
    }
  }, []);

  // Detect ad blocker: if the ins element has zero height after a short delay, it was blocked
  useEffect(() => {
    if (!SLOT) return;
    const t = setTimeout(() => {
      const el = insRef.current;
      if (el && el.offsetHeight === 0) setBlocked(true);
    }, 2500);
    return () => clearTimeout(t);
  }, []);

  // Don't render if no slot configured, or ad was blocked (silent fail)
  if (!SLOT || blocked) return null;

  // Desktop: 300×250 medium rectangle, bottom-left
  // Mobile:  320×50 mobile banner, bottom-center above news panel
  const bottomOffset = (isMobile ? 72 : 16) + newsPanelHeight;

  return (
    <div
      className="fixed z-[34] pointer-events-auto"
      style={
        isMobile
          ? { bottom: bottomOffset + 8, left: '50%', transform: 'translateX(-50%)' }
          : { bottom: bottomOffset + 8, left: 16 }
      }
    >
      {/* Label required by AdSense policy */}
      <div className="text-[8px] font-mono text-hud-text/25 tracking-widest uppercase mb-0.5 text-center select-none">
        Advertisement
      </div>
      <div
        className="rounded overflow-hidden border border-hud-border/20"
        style={
          isMobile
            ? { width: 320, height: 50 }
            : { width: 300, height: 250 }
        }
      >
        <ins
          ref={insRef}
          className="adsbygoogle"
          style={{ display: 'block', width: '100%', height: '100%' }}
          data-ad-client={CLIENT}
          data-ad-slot={SLOT}
          data-ad-format={isMobile ? 'banner' : 'rectangle'}
          data-full-width-responsive="false"
        />
      </div>
    </div>
  );
}
