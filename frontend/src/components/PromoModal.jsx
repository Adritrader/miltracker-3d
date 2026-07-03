/**
 * PromoModal — One-time promotional modal shown to new visitors.
 *
 * Shows automatically after DELAY_MS on first visit (tracked via localStorage).
 * Also opens when user clicks "Upgrade to Pro" while not logged in.
 *
 * Displays Free vs Pro vs Annual plans with pricing and feature comparison.
 */

import React, { useState, useEffect } from 'react';
import { supabase } from '../utils/supabaseClient.js';

const BACKEND    = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
const DELAY_MS   = 12000; // 12 seconds
const STORAGE_KEY = 'milt_promo_seen';

const PRICE_MONTHLY  = import.meta.env.VITE_STRIPE_PRICE_MONTHLY || '';
const PRICE_ANNUAL   = import.meta.env.VITE_STRIPE_PRICE_ANNUAL  || '';

const FEATURES = [
  { label: 'Live military aircraft (ADS-B)',  free: true,  pro: true  },
  { label: 'Live warship tracking',           free: true,  pro: true  },
  { label: 'Conflict events on globe',        free: true,  pro: true  },
  { label: 'News feed',                       free: '5 items', pro: 'Unlimited' },
  { label: 'Threat alerts',                   free: '3 alerts', pro: 'Unlimited' },
  { label: 'AI threat analysis',              free: false, pro: true  },
  { label: 'Historical flight & ship trails', free: false, pro: true  },
  { label: 'Advanced analytics dashboard',    free: false, pro: true  },
  { label: 'Timeline replay',                 free: false, pro: true  },
  { label: 'SITREP capture',                  free: false, pro: true  },
];

export default function PromoModal({ authUser, onClose, onOpenAuth }) {
  const [annual, setAnnual]   = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  const monthlyPrice   = 9.99;
  const annualMonthly  = 6.66;
  const annualTotal    = (annualMonthly * 12).toFixed(2);
  const saving         = Math.round((1 - annualMonthly / monthlyPrice) * 100);

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
      className="fixed inset-0 z-[300] flex items-center justify-center p-4"
      style={{ background: 'rgba(5,8,16,0.92)', backdropFilter: 'blur(8px)' }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-3xl rounded-2xl border border-hud-border/60 overflow-hidden shadow-2xl animate-fade-in"
        style={{ background: 'rgba(8,14,26,0.99)' }}
      >
        {/* Header */}
        <div className="relative px-8 pt-8 pb-4 text-center border-b border-hud-border/20"
             style={{ background: 'linear-gradient(180deg, rgba(0,255,136,0.05) 0%, transparent 100%)' }}>
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-hud-text/40 hover:text-white text-xl transition-colors leading-none"
          >×</button>
          <div className="text-hud-green text-[10px] font-mono tracking-[0.3em] uppercase mb-2">
            ◈ LiveWar3D
          </div>
          <h2 className="text-white text-2xl font-mono font-bold tracking-wide mb-1">
            Real-Time Military Intelligence
          </h2>
          <p className="text-hud-text/60 text-sm font-mono">
            Track live military aircraft, warships, and conflict events worldwide.
          </p>
        </div>

        {/* Billing toggle */}
        <div className="flex justify-center gap-0 px-6 pt-6">
          <button
            onClick={() => setAnnual(false)}
            className={`px-5 py-2 rounded-l-lg border text-xs font-mono font-bold transition-colors
              ${!annual
                ? 'bg-hud-green/20 border-hud-green text-hud-green'
                : 'border-hud-border/40 text-hud-text/40 hover:text-hud-text'}`}
          >
            Monthly
          </button>
          <button
            onClick={() => setAnnual(true)}
            className={`px-5 py-2 rounded-r-lg border-t border-b border-r text-xs font-mono font-bold transition-colors flex items-center gap-2
              ${annual
                ? 'bg-hud-green/20 border-hud-green text-hud-green'
                : 'border-hud-border/40 text-hud-text/40 hover:text-hud-text'}`}
          >
            Annual
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-hud-amber/20 text-hud-amber font-bold">
              SAVE {saving}%
            </span>
          </button>
        </div>

        {/* Plans */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 px-6 py-5">

          {/* FREE */}
          <div className="rounded-xl border border-hud-border/30 p-5 flex flex-col">
            <div className="text-[9px] font-mono tracking-widest text-hud-text/40 uppercase mb-2">Free</div>
            <div className="text-white text-3xl font-mono font-bold mb-0.5">$0</div>
            <div className="text-hud-text/30 text-[10px] font-mono mb-4">forever</div>
            <ul className="space-y-1.5 flex-1 mb-4">
              {FEATURES.map((f, i) => (
                <li key={i} className={`text-[11px] font-mono flex items-start gap-1.5
                  ${f.free ? 'text-hud-text/70' : 'text-hud-text/25 line-through'}`}>
                  <span className={f.free ? 'text-hud-green shrink-0' : 'text-hud-text/20 shrink-0'}>
                    {f.free ? '✓' : '✗'}
                  </span>
                  {f.label}{typeof f.free === 'string' ? ` (${f.free})` : ''}
                </li>
              ))}
            </ul>
            <div className="py-2 rounded border border-hud-border/30 text-center text-xs font-mono text-hud-text/30">
              Current Plan
            </div>
          </div>

          {/* PRO MONTHLY / ANNUAL */}
          <div className="md:col-span-2 rounded-xl border-2 border-hud-green/50 p-5 flex flex-col relative"
               style={{ background: 'rgba(0,255,136,0.03)' }}>
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full
                           bg-hud-green text-black text-[10px] font-mono font-bold tracking-widest uppercase">
              Most Popular
            </div>
            <div className="flex items-start justify-between mb-2">
              <div>
                <div className="text-[9px] font-mono tracking-widest text-hud-green uppercase mb-1">Pro</div>
                <div className="flex items-end gap-1">
                  <span className="text-white text-3xl font-mono font-bold">
                    ${annual ? annualMonthly : monthlyPrice}
                  </span>
                  <span className="text-hud-text/40 text-[11px] font-mono mb-1">/month</span>
                </div>
                <div className="text-hud-text/40 text-[10px] font-mono">
                  {annual ? `Billed $${annualTotal}/year — save $${(monthlyPrice * 12 - parseFloat(annualTotal)).toFixed(2)}` : 'Billed monthly, cancel anytime'}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 flex-1 mb-5 mt-3">
              {FEATURES.map((f, i) => (
                <div key={i} className="text-[11px] font-mono flex items-start gap-1.5 text-hud-text/80">
                  <span className="text-hud-green shrink-0">✓</span>
                  {f.label}{typeof f.pro === 'string' ? ` (${f.pro})` : ''}
                </div>
              ))}
            </div>

            <button
              onClick={handleUpgrade}
              disabled={loading}
              className="w-full py-3 rounded-lg border-2 border-hud-green bg-hud-green/15
                         text-hud-green text-sm font-mono font-bold tracking-wider uppercase
                         hover:bg-hud-green/25 transition-all duration-150
                         disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Redirecting to checkout…' :
               authUser ? `Get Pro ${annual ? '— Best Value' : ''} →` :
               'Sign in to Upgrade →'}
            </button>
            {error && <p className="text-red-400 text-[10px] font-mono mt-2 text-center">{error}</p>}
          </div>

        </div>

        {/* Footer */}
        <div className="px-6 pb-5 text-center border-t border-hud-border/10 pt-3">
          <p className="text-hud-text/25 text-[10px] font-mono">
            Secure payment via Stripe · Cancel anytime · No hidden fees · Zero fake data
          </p>
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
    // Don't show to pro users or if already seen
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
