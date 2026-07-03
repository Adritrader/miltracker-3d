/**
 * PromoModal — Pricing modal shown to visitors and non-pro users.
 *
 * Shows automatically after DELAY_MS on first visit (tracked via localStorage).
 * Also opens when user clicks "Pricing" or "Upgrade to Pro".
 */

import React, { useState, useEffect } from 'react';
import { supabase } from '../utils/supabaseClient.js';

const BACKEND    = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
const DELAY_MS   = 12000;
const STORAGE_KEY = 'milt_promo_seen';

const PRICE_MONTHLY  = import.meta.env.VITE_STRIPE_PRICE_MONTHLY || '';
const PRICE_ANNUAL   = import.meta.env.VITE_STRIPE_PRICE_ANNUAL  || '';

const COMPARE = [
  { label: 'Live military aircraft (ADS-B)',    free: 'Limited',     pro: 'Full access'  },
  { label: 'Live warship tracking',             free: 'Limited',     pro: 'Full access'  },
  { label: 'Conflict events on globe',          free: '✓',           pro: '✓'            },
  { label: 'News feed',                         free: '5 items',     pro: 'Unlimited'    },
  { label: 'Threat alerts',                     free: '3 alerts',    pro: 'Unlimited'    },
  { label: 'AI threat analysis (Gemini)',       free: '—',           pro: '✓'            },
  { label: 'Historical flight & ship trails',   free: '—',           pro: '✓'            },
  { label: 'Timeline replay',                   free: '—',           pro: '✓'            },
  { label: 'Live conflict cameras',             free: '—',           pro: '✓'            },
  { label: 'SITREP capture',                    free: '—',           pro: '✓'            },
  { label: 'Advanced analytics dashboard',      free: '—',           pro: '✓'            },
];

export default function PromoModal({ authUser, onClose, onOpenAuth }) {
  const [annual, setAnnual]   = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  const monthlyPrice   = 9.99;
  const annualMonthly  = 6.66;
  const annualTotal    = (annualMonthly * 12).toFixed(2);
  const saving         = Math.round((1 - annualMonthly / monthlyPrice) * 100);
  const price          = annual ? annualMonthly : monthlyPrice;

  // Close on Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const handleUpgrade = async () => {
    if (!authUser) {
      onClose();
      onOpenAuth?.();
      return;
    }
    setLoading(true);
    setError('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error('Not authenticated');
      const priceId = annual ? PRICE_ANNUAL : PRICE_MONTHLY;
      if (!priceId) throw new Error('Payments not configured yet');
      const res = await fetch(`${BACKEND}/api/stripe/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ priceId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Checkout failed');
      window.location.href = data.url;
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center p-4 overflow-y-auto"
      style={{ background: 'rgba(5,8,16,0.93)', backdropFilter: 'blur(12px)' }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="relative w-full max-w-4xl rounded-2xl shadow-2xl animate-fade-in my-auto overflow-hidden"
        style={{ background: 'rgba(10,17,32,1)', border: '1px solid rgba(255,255,255,0.12)' }}
      >
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 w-8 h-8 flex items-center justify-center rounded-full
                     text-white/50 hover:text-white hover:bg-white/10 transition-all text-lg"
        >×</button>

        {/* ── HERO ── */}
        <div className="px-8 pt-8 pb-7 text-center"
             style={{ background: 'linear-gradient(180deg, rgba(0,255,136,0.07) 0%, transparent 100%)' }}>
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-5
                          bg-hud-green/10 border border-hud-green/30 text-hud-green text-[11px] font-mono tracking-widest uppercase">
            <span className="w-2 h-2 rounded-full bg-hud-green animate-pulse" />
            LiveWar3D
          </div>
          <h2 className="text-white text-2xl md:text-3xl font-mono font-bold tracking-wide mb-3">
            Real-Time Military Intelligence
          </h2>
          <p className="text-white/55 text-sm font-mono max-w-xl mx-auto leading-relaxed">
            Track live military aircraft, warships, AI threat analysis and global conflict events — all in one 3D globe.
          </p>

          {/* ── Billing toggle — pill style ── */}
          <div className="flex justify-center mt-7">
            <div className="relative flex rounded-xl p-1 gap-1"
                 style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
              <button
                onClick={() => setAnnual(false)}
                className={`relative px-6 py-2 rounded-lg text-sm font-mono font-bold transition-all duration-200 ${
                  !annual
                    ? 'text-white shadow-sm'
                    : 'text-white/40 hover:text-white/70'
                }`}
                style={!annual ? { background: 'rgba(255,255,255,0.12)' } : {}}
              >
                Monthly
              </button>
              <button
                onClick={() => setAnnual(true)}
                className={`relative flex items-center gap-2.5 px-6 py-2 rounded-lg text-sm font-mono font-bold transition-all duration-200 ${
                  annual
                    ? 'text-white shadow-sm'
                    : 'text-white/40 hover:text-white/70'
                }`}
                style={annual ? { background: 'rgba(0,255,136,0.18)', border: '1px solid rgba(0,255,136,0.35)' } : {}}
              >
                Annual
                <span className="text-[10px] font-mono font-black px-2 py-0.5 rounded-md tracking-wider"
                      style={{ background: 'rgba(255,170,0,0.25)', color: '#ffbb00', border: '1px solid rgba(255,170,0,0.4)' }}>
                  −{saving}%
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* ── PLAN CARDS ── */}
        <div className="grid md:grid-cols-2 gap-5 px-7 pb-7">

          {/* FREE */}
          <div className="rounded-2xl p-6 flex flex-col"
               style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.12)' }}>
            <div className="mb-5">
              <div className="text-white/50 text-[11px] font-mono tracking-[0.3em] uppercase mb-3">Free plan</div>
              <div className="flex items-end gap-1.5 mb-1">
                <span className="text-white text-5xl font-mono font-black">$0</span>
              </div>
              <div className="text-white/40 text-xs font-mono">No credit card required · forever</div>
            </div>

            <div className="space-y-2.5 flex-1 mb-6">
              {COMPARE.map((f, i) => {
                const available = f.free !== '—';
                return (
                  <div key={i} className="flex items-center justify-between gap-3">
                    <span className={`text-xs font-mono ${available ? 'text-white/70' : 'text-white/30'}`}>
                      {f.label}
                    </span>
                    <span className={`text-xs font-mono font-bold shrink-0 ${
                      available ? 'text-white/70' : 'text-white/20'
                    }`}>
                      {f.free}
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="py-3 rounded-xl text-center text-xs font-mono font-bold tracking-widest uppercase text-white/30"
                 style={{ border: '1px solid rgba(255,255,255,0.1)' }}>
              Current plan
            </div>
          </div>

          {/* PRO */}
          <div className="rounded-2xl p-6 flex flex-col relative"
               style={{
                 background: 'linear-gradient(135deg, rgba(0,255,136,0.08) 0%, rgba(0,200,100,0.04) 100%)',
                 border: '2px solid rgba(0,255,136,0.55)',
                 boxShadow: '0 0 40px rgba(0,255,136,0.08), inset 0 0 40px rgba(0,255,136,0.03)',
               }}>
            {/* Badge */}
            <div className="absolute -top-4 left-1/2 -translate-x-1/2">
              <span className="px-5 py-1.5 rounded-full text-[11px] font-mono font-black tracking-widest uppercase shadow-lg"
                    style={{ background: '#00ff88', color: '#050810' }}>
                MOST POPULAR
              </span>
            </div>

            <div className="mb-5 mt-2">
              <div className="text-hud-green text-[11px] font-mono tracking-[0.3em] uppercase mb-3">Pro plan</div>
              <div className="flex items-end gap-2 mb-1">
                <span className="text-white text-5xl font-mono font-black">${price.toFixed(2)}</span>
                <span className="text-white/50 text-sm font-mono mb-2">/month</span>
              </div>
              <div className="text-white/50 text-xs font-mono">
                {annual
                  ? `Billed $${annualTotal}/year · you save $${(monthlyPrice * 12 - parseFloat(annualTotal)).toFixed(2)}`
                  : 'Billed monthly · cancel anytime'}
              </div>
            </div>

            <div className="space-y-2.5 flex-1 mb-6">
              {COMPARE.map((f, i) => (
                <div key={i} className="flex items-center justify-between gap-3">
                  <span className="text-xs font-mono text-white/80">{f.label}</span>
                  <span className="text-xs font-mono font-bold shrink-0 text-hud-green">{f.pro}</span>
                </div>
              ))}
            </div>

            <button
              onClick={handleUpgrade}
              disabled={loading}
              className="w-full py-4 rounded-xl text-sm font-mono font-black tracking-wider uppercase
                         transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                background: loading ? 'rgba(0,255,136,0.15)' : 'rgba(0,255,136,0.2)',
                border: '2px solid rgba(0,255,136,0.7)',
                color: '#00ff88',
                boxShadow: '0 0 20px rgba(0,255,136,0.15)',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = 'rgba(0,255,136,0.3)';
                e.currentTarget.style.boxShadow = '0 0 32px rgba(0,255,136,0.3)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'rgba(0,255,136,0.2)';
                e.currentTarget.style.boxShadow = '0 0 20px rgba(0,255,136,0.15)';
              }}
            >
              {loading ? 'Redirecting to checkout…' :
               authUser ? `Get Pro${annual ? ' — Best Value' : ''} →` :
               'Create account & upgrade →'}
            </button>
            {error && <p className="text-red-400 text-[11px] font-mono mt-3 text-center">{error}</p>}
          </div>

        </div>

        {/* ── TRUST ── */}
        <div className="px-7 pb-6 border-t pt-4" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
          <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-1.5">
            {['🔒 Secure payment via Stripe', '✓ Cancel anytime', '✓ No hidden fees', '✓ Real data only'].map((t, i) => (
              <span key={i} className="text-white/35 text-[11px] font-mono">{t}</span>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}

/**
 * PromoModalTrigger — Mounts the modal automatically after DELAY_MS
 * on first visit (once per browser via localStorage).
 */
export function PromoModalTrigger({ authUser, isPro, onOpenAuth }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (isPro) return;
    if (localStorage.getItem(STORAGE_KEY)) return;

    const timer = setTimeout(() => {
      setShow(true);
      localStorage.setItem(STORAGE_KEY, '1');
    }, DELAY_MS);

    return () => clearTimeout(timer);
  }, [isPro]);

  if (!show) return null;

  return (
    <PromoModal
      authUser={authUser}
      onClose={() => setShow(false)}
      onOpenAuth={onOpenAuth}
    />
  );
}

const BACKEND    = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
const DELAY_MS   = 12000;
const STORAGE_KEY = 'milt_promo_seen';

const PRICE_MONTHLY  = import.meta.env.VITE_STRIPE_PRICE_MONTHLY || '';
const PRICE_ANNUAL   = import.meta.env.VITE_STRIPE_PRICE_ANNUAL  || '';

const COMPARE = [
  { label: 'Live military aircraft (ADS-B)',    free: 'Limited',     pro: 'Full access'  },
  { label: 'Live warship tracking',             free: 'Limited',     pro: 'Full access'  },
  { label: 'Conflict events on globe',          free: '✓',           pro: '✓'            },
  { label: 'News feed',                         free: '5 items',     pro: 'Unlimited'    },
  { label: 'Threat alerts',                     free: '3 alerts',    pro: 'Unlimited'    },
  { label: 'AI threat analysis (Gemini)',       free: '—',           pro: '✓'            },
  { label: 'Historical flight & ship trails',   free: '—',           pro: '✓'            },
  { label: 'Timeline replay',                   free: '—',           pro: '✓'            },
  { label: 'Live conflict cameras',             free: '—',           pro: '✓'            },
  { label: 'SITREP capture',                    free: '—',           pro: '✓'            },
  { label: 'Advanced analytics dashboard',      free: '—',           pro: '✓'            },
];

export default function PromoModal({ authUser, onClose, onOpenAuth }) {
  const [annual, setAnnual]   = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  const monthlyPrice   = 9.99;
  const annualMonthly  = 6.66;
  const annualTotal    = (annualMonthly * 12).toFixed(2);
  const saving         = Math.round((1 - annualMonthly / monthlyPrice) * 100);
  const price          = annual ? annualMonthly : monthlyPrice;

  const handleUpgrade = async () => {
    if (!authUser) {
      onClose();
      onOpenAuth?.();
      return;
    }
    setLoading(true);
    setError('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error('Not authenticated');
      const priceId = annual ? PRICE_ANNUAL : PRICE_MONTHLY;
      if (!priceId) throw new Error('Payments not configured yet');
      const res = await fetch(`${BACKEND}/api/stripe/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ priceId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Checkout failed');
      window.location.href = data.url;
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center p-3 overflow-y-auto"
      style={{ background: 'rgba(5,8,16,0.94)', backdropFilter: 'blur(10px)' }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="relative w-full max-w-4xl rounded-2xl border border-hud-border/50 shadow-2xl animate-fade-in my-auto"
        style={{ background: 'rgba(8,14,26,0.99)' }}
      >
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 w-7 h-7 flex items-center justify-center
                     rounded-full text-hud-text/40 hover:text-white hover:bg-white/10
                     transition-all duration-150 text-lg leading-none"
        >×</button>

        {/* ── TOP: Hero + toggle ── */}
        <div className="px-8 pt-8 pb-6 text-center"
             style={{ background: 'linear-gradient(180deg, rgba(0,255,136,0.04) 0%, transparent 100%)' }}>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-hud-green/30
                          bg-hud-green/5 text-hud-green text-[10px] font-mono tracking-widest uppercase mb-4">
            <span className="w-1.5 h-1.5 rounded-full bg-hud-green animate-pulse" />
            LiveWar3D
          </div>
          <h2 className="text-white text-2xl md:text-3xl font-mono font-bold tracking-wide mb-2">
            Real-Time Military Intelligence
          </h2>
          <p className="text-hud-text/50 text-sm font-mono max-w-xl mx-auto">
            Track live military aircraft, warships, AI threat analysis and global conflict events — all in one 3D globe.
          </p>

          {/* Billing toggle */}
          <div className="flex items-center justify-center gap-1 mt-6">
            <div className="flex rounded-lg border border-hud-border/40 overflow-hidden">
              <button
                onClick={() => setAnnual(false)}
                className={`px-5 py-2 text-xs font-mono font-bold transition-colors
                  ${!annual ? 'bg-hud-green/20 text-hud-green' : 'text-hud-text/40 hover:text-hud-text'}`}
              >Monthly</button>
              <button
                onClick={() => setAnnual(true)}
                className={`px-5 py-2 text-xs font-mono font-bold transition-colors flex items-center gap-2
                  ${annual ? 'bg-hud-green/20 text-hud-green' : 'text-hud-text/40 hover:text-hud-text'}`}
              >
                Annual
                <span className="text-[9px] px-1.5 py-0.5 rounded-sm bg-hud-amber/25 text-hud-amber font-bold tracking-wider">
                  −{saving}%
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* ── MIDDLE: Plan cards ── */}
        <div className="grid md:grid-cols-2 gap-4 px-6 pb-6">

          {/* FREE */}
          <div className="rounded-xl border border-hud-border/30 p-6 flex flex-col"
               style={{ background: 'rgba(255,255,255,0.01)' }}>
            <div className="mb-4">
              <div className="text-[9px] font-mono tracking-[0.25em] text-hud-text/40 uppercase mb-2">Free</div>
              <div className="flex items-end gap-1">
                <span className="text-white text-4xl font-mono font-bold">$0</span>
              </div>
              <div className="text-hud-text/30 text-[10px] font-mono mt-1">No credit card required</div>
            </div>

            <ul className="space-y-2 flex-1 mb-6">
              {COMPARE.map((f, i) => {
                const isFree = f.free !== '—';
                return (
                  <li key={i} className={`flex items-center justify-between text-[11px] font-mono gap-2
                    ${isFree ? 'text-hud-text/70' : 'text-hud-text/25'}`}>
                    <span className="truncate">{f.label}</span>
                    <span className={`shrink-0 font-bold ${isFree ? 'text-hud-text/60' : 'text-hud-text/20'}`}>
                      {f.free}
                    </span>
                  </li>
                );
              })}
            </ul>

            <div className="py-2.5 rounded-lg border border-hud-border/25 text-center
                            text-xs font-mono text-hud-text/30 tracking-wider">
              CURRENT PLAN
            </div>
          </div>

          {/* PRO */}
          <div className="rounded-xl border-2 border-hud-green/60 p-6 flex flex-col relative"
               style={{ background: 'linear-gradient(135deg, rgba(0,255,136,0.04) 0%, rgba(0,255,136,0.01) 100%)' }}>
            {/* Badge */}
            <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
              <span className="px-4 py-1 rounded-full bg-hud-green text-black text-[10px] font-mono font-bold tracking-widest uppercase shadow-lg">
                MOST POPULAR
              </span>
            </div>

            <div className="mb-4 mt-1">
              <div className="text-[9px] font-mono tracking-[0.25em] text-hud-green uppercase mb-2">Pro</div>
              <div className="flex items-end gap-1.5">
                <span className="text-white text-4xl font-mono font-bold">${price.toFixed(2)}</span>
                <span className="text-hud-text/40 text-xs font-mono mb-1.5">/month</span>
              </div>
              <div className="text-hud-text/40 text-[10px] font-mono mt-1">
                {annual
                  ? `Billed $${annualTotal}/year · save $${(monthlyPrice * 12 - parseFloat(annualTotal)).toFixed(2)}`
                  : 'Billed monthly · cancel anytime'}
              </div>
            </div>

            <ul className="space-y-2 flex-1 mb-6">
              {COMPARE.map((f, i) => (
                <li key={i} className="flex items-center justify-between text-[11px] font-mono gap-2 text-hud-text/80">
                  <span className="truncate">{f.label}</span>
                  <span className="shrink-0 font-bold text-hud-green">{f.pro}</span>
                </li>
              ))}
            </ul>

            <button
              onClick={handleUpgrade}
              disabled={loading}
              className="w-full py-3.5 rounded-xl border-2 border-hud-green bg-hud-green/15
                         text-hud-green text-sm font-mono font-bold tracking-wider uppercase
                         hover:bg-hud-green/25 hover:shadow-[0_0_20px_rgba(0,255,136,0.15)]
                         transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Redirecting to checkout…' :
               authUser ? `Get Pro${annual ? ' — Best Value' : ''} →` :
               'Create Account & Upgrade →'}
            </button>
            {error && <p className="text-red-400 text-[10px] font-mono mt-2 text-center">{error}</p>}
          </div>

        </div>

        {/* ── BOTTOM: Trust badges ── */}
        <div className="px-6 pb-6 border-t border-hud-border/10 pt-4">
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-1">
            {['🔒 Secure payment via Stripe', '✓ Cancel anytime', '✓ No hidden fees', '✓ Real data only'].map((t, i) => (
              <span key={i} className="text-hud-text/25 text-[10px] font-mono">{t}</span>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}

/**
 * PromoModalTrigger — Mounts the modal automatically after DELAY_MS
 * on first visit (once per browser via localStorage).
 */
export function PromoModalTrigger({ authUser, isPro, onOpenAuth }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (isPro) return;
    if (localStorage.getItem(STORAGE_KEY)) return;

    const timer = setTimeout(() => {
      setShow(true);
      localStorage.setItem(STORAGE_KEY, '1');
    }, DELAY_MS);

    return () => clearTimeout(timer);
  }, [isPro]);

  if (!show) return null;

  return (
    <PromoModal
      authUser={authUser}
      onClose={() => setShow(false)}
      onOpenAuth={onOpenAuth}
    />
  );
}


