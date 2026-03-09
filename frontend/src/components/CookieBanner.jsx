/**
 * CookieBanner – GDPR/CCPA-compliant cookie consent bar.
 * Stores consent in localStorage under 'lw3d_cookie_consent'.
 * Provides links to Privacy Policy, Cookie Policy and Terms of Service.
 */

import React, { useState, useEffect } from 'react';

const STORAGE_KEY = 'lw3d_cookie_consent';

const CookieBanner = ({ onOpenLegal }) => {
  const [visible, setVisible] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) setVisible(true);
    } catch {
      setVisible(true);
    }
  }, []);

  const accept = (all) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        essential: true,
        analytics: all,
        timestamp: Date.now(),
      }));
    } catch { /* ignore */ }
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-[300] pointer-events-auto"
      style={{
        background: 'rgba(5,8,16,0.97)',
        borderTop: '1px solid rgba(0,255,136,0.2)',
        boxShadow: '0 -4px 32px rgba(0,229,255,0.06)',
        backdropFilter: 'blur(12px)',
      }}
    >
      {/* ── Main bar ──────────────────────────────────────────────────── */}
      <div className="max-w-7xl mx-auto px-4 py-3 flex flex-col sm:flex-row items-start sm:items-center gap-3">

        {/* Icon + Text */}
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <span className="text-lg shrink-0 mt-0.5" style={{ color: '#00ff88' }}>⬡</span>
          <div className="min-w-0">
            <p className="font-mono text-xs" style={{ color: '#c0cfe0', lineHeight: '1.6' }}>
              <span className="font-bold" style={{ color: '#00ff88' }}>LIVEWAR3D</span>
              {' '}uses essential cookies to operate this service, and optional analytics cookies to improve it.
              {' '}
              <button
                onClick={() => setExpanded(v => !v)}
                className="underline transition-colors"
                style={{ color: '#00e5ff' }}
              >
                {expanded ? 'Show less ▴' : 'More info ▾'}
              </button>
            </p>

            {/* Legal links */}
            <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1">
              {[
                { key: 'privacy',  label: 'Privacy Policy' },
                { key: 'cookies',  label: 'Cookie Policy'  },
                { key: 'terms',    label: 'Terms of Use'   },
              ].map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => onOpenLegal(key)}
                  className="font-mono text-xs underline transition-colors hover:opacity-100"
                  style={{ color: '#00e5ff', opacity: 0.7 }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* CTA buttons */}
        <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
          <button
            onClick={() => accept(false)}
            className="flex-1 sm:flex-none font-mono text-xs px-4 py-1.5 rounded border transition-all hover:opacity-80"
            style={{
              color: '#c0cfe0',
              borderColor: 'rgba(192,207,224,0.25)',
              background: 'transparent',
            }}
          >
            ESSENTIAL ONLY
          </button>
          <button
            onClick={() => accept(true)}
            className="flex-1 sm:flex-none font-mono text-xs px-4 py-1.5 rounded font-bold transition-all hover:opacity-90"
            style={{
              background: '#00ff88',
              color: '#050810',
              border: 'none',
            }}
          >
            ACCEPT ALL
          </button>
        </div>
      </div>

      {/* ── Expanded detail ────────────────────────────────────────────── */}
      {expanded && (
        <div
          className="max-w-7xl mx-auto px-4 pb-3"
          style={{ borderTop: '1px solid rgba(0,255,136,0.1)' }}
        >
          <div className="grid sm:grid-cols-2 gap-2 mt-2">
            {[
              {
                title: 'ESSENTIAL COOKIES',
                color: '#00ff88',
                desc: 'Required for the application to function: session preferences (filters, basemap, tracked entities). Cannot be disabled.',
              },
              {
                title: 'ANALYTICS COOKIES',
                color: '#00e5ff',
                desc: 'Anonymous usage data to understand how users interact with the globe and improve the experience. No personal data is collected.',
              },
            ].map(({ title, color, desc }) => (
              <div
                key={title}
                className="rounded p-2.5"
                style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${color}22` }}
              >
                <div className="font-mono text-xs font-bold mb-1" style={{ color }}>
                  {title}
                </div>
                <p className="font-mono text-xs" style={{ color: '#8a9bb0', lineHeight: '1.5' }}>
                  {desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default CookieBanner;
