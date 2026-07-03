/**
 * PricingModal — Subscription plans modal with monthly / annual toggle.
 *
 * Plans:
 *   FREE  — limited news (5 items), limited alerts (3), no AI insights
 *   PRO   — everything unlimited + AI threat analysis + history
 *
 * Calls /api/stripe/checkout to create a Stripe Checkout Session and
 * redirects the user to Stripe-hosted payment page.
 */

import React, { useState } from 'react';
import { supabase } from '../utils/supabaseClient.js';

const BACKEND = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

const PRICE_MONTHLY = import.meta.env.VITE_STRIPE_PRICE_MONTHLY || '';
const PRICE_ANNUAL  = import.meta.env.VITE_STRIPE_PRICE_ANNUAL  || '';

const FREE_FEATURES = [
  '✓ Live military aircraft (ADS-B)',
  '✓ Live warships tracking',
  '✓ Conflict events on globe',
  '✓ 5 latest news items',
  '✓ 3 threat alerts',
  '✗ AI threat analysis',
  '✗ Historical flight trails',
  '✗ Unlimited news feed',
  '✗ Advanced analytics',
];

const PRO_FEATURES = [
  '✓ Everything in Free',
  '✓ Unlimited news feed',
  '✓ All threat alerts (no cap)',
  '✓ AI threat analysis (Gemini)',
  '✓ Historical flight & ship trails',
  '✓ Advanced analytics dashboard',
  '✓ Timeline replay',
  '✓ SITREP capture',
  '✓ Priority support',
];

export default function PricingModal({ onClose, authUser, onOpenAuth }) {
  const [annual, setAnnual]   = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  const monthlyPrice = 9.99;
  const annualMonthly = 7.99;
  const annualTotal = (annualMonthly * 12).toFixed(2);
  const saving = Math.round((1 - annualMonthly / monthlyPrice) * 100);

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
      if (!priceId) throw new Error('Stripe prices not configured — set VITE_STRIPE_PRICE_MONTHLY / VITE_STRIPE_PRICE_ANNUAL');

      const res = await fetch(`${BACKEND}/api/stripe/checkout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
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
      className="fixed inset-0 z-[250] flex items-center justify-center p-4"
      style={{ background: 'rgba(5,8,16,0.90)', backdropFilter: 'blur(6px)' }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-2xl rounded-xl border border-hud-border/60 overflow-hidden shadow-2xl animate-fade-in"
        style={{ background: 'rgba(8,14,26,0.99)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-hud-border/30">
          <div>
            <div className="text-hud-green text-[9px] font-mono tracking-[0.25em] uppercase mb-1">MilTracker 3D</div>
            <h2 className="text-white text-lg font-mono font-bold tracking-wide">Upgrade to Pro</h2>
            <p className="text-hud-text/60 text-xs font-mono mt-0.5">
              Unlock unlimited tracking, AI analysis, and full data access.
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-hud-text/50 hover:text-white text-xl transition-colors leading-none"
          >×</button>
        </div>

        {/* Billing toggle */}
        <div className="flex justify-center gap-2 px-6 pt-5">
          <button
            onClick={() => setAnnual(false)}
            className={`px-4 py-1.5 rounded-l-md border text-xs font-mono transition-colors
              ${!annual
                ? 'bg-hud-green/20 border-hud-green text-hud-green'
                : 'border-hud-border/40 text-hud-text/50 hover:text-hud-text'}`}
          >
            Monthly
          </button>
          <button
            onClick={() => setAnnual(true)}
            className={`px-4 py-1.5 rounded-r-md border text-xs font-mono transition-colors flex items-center gap-1.5
              ${annual
                ? 'bg-hud-green/20 border-hud-green text-hud-green'
                : 'border-hud-border/40 text-hud-text/50 hover:text-hud-text'}`}
          >
            Annual
            <span className="text-[9px] px-1 py-0.5 rounded bg-hud-amber/20 text-hud-amber font-bold">
              -{saving}%
            </span>
          </button>
        </div>

        {/* Plans grid */}
        <div className="grid grid-cols-2 gap-4 px-6 py-5">

          {/* FREE */}
          <div className="rounded-lg border border-hud-border/30 p-4 flex flex-col">
            <div className="text-[9px] font-mono tracking-widest text-hud-text/40 uppercase mb-1">Free</div>
            <div className="text-white text-2xl font-mono font-bold mb-0.5">$0</div>
            <div className="text-hud-text/40 text-[10px] font-mono mb-4">forever</div>
            <ul className="space-y-1.5 flex-1">
              {FREE_FEATURES.map((f, i) => (
                <li key={i} className={`text-[11px] font-mono ${f.startsWith('✗') ? 'text-hud-text/30 line-through' : 'text-hud-text/70'}`}>
                  {f}
                </li>
              ))}
            </ul>
            <div className="mt-4">
              <div className="w-full py-2 rounded border border-hud-border/30 text-center text-xs font-mono text-hud-text/40">
                Current Plan
              </div>
            </div>
          </div>

          {/* PRO */}
          <div className="rounded-lg border border-hud-green/50 p-4 flex flex-col"
               style={{ background: 'rgba(0,255,136,0.03)' }}>
            <div className="flex items-center gap-2 mb-1">
              <div className="text-[9px] font-mono tracking-widest text-hud-green uppercase">Pro</div>
              <span className="text-[8px] font-mono px-1.5 py-0.5 rounded bg-hud-green/15 text-hud-green font-bold tracking-wider uppercase">
                Recommended
              </span>
            </div>
            <div className="flex items-end gap-1 mb-0.5">
              <span className="text-white text-2xl font-mono font-bold">
                ${annual ? annualMonthly : monthlyPrice}
              </span>
              <span className="text-hud-text/40 text-[10px] font-mono mb-1">/mo</span>
            </div>
            <div className="text-hud-text/40 text-[10px] font-mono mb-4">
              {annual ? `Billed as $${annualTotal}/yr` : 'Billed monthly'}
            </div>
            <ul className="space-y-1.5 flex-1">
              {PRO_FEATURES.map((f, i) => (
                <li key={i} className="text-[11px] font-mono text-hud-text/80">{f}</li>
              ))}
            </ul>
            <div className="mt-4">
              <button
                onClick={handleUpgrade}
                disabled={loading}
                className="w-full py-2.5 rounded border border-hud-green bg-hud-green/15
                           text-hud-green text-xs font-mono font-bold tracking-wider uppercase
                           hover:bg-hud-green/25 transition-colors duration-150 disabled:opacity-50"
              >
                {loading ? 'Redirecting…' : authUser ? `Upgrade to Pro →` : 'Sign in to Upgrade →'}
              </button>
              {error && (
                <p className="text-red-400 text-[10px] font-mono mt-2 text-center">{error}</p>
              )}
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="px-6 pb-5 text-center">
          <p className="text-hud-text/30 text-[10px] font-mono">
            Secure payment via Stripe · Cancel anytime · No hidden fees
          </p>
        </div>
      </div>
    </div>
  );
}
