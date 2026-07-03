/**
 * UserMenu — Avatar pill trigger + full centered modal panel for authenticated users.
 */

import React, { useState, useEffect } from 'react';
import { supabase } from '../utils/supabaseClient.js';

const BACKEND = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

const PRO_FEATURES = [
  'Unlimited news feed',
  'All threat alerts (no cap)',
  'AI threat analysis (Gemini)',
  'Historical flight & ship trails',
  'Timeline replay',
  'Live conflict cameras',
  'SITREP capture',
  'Advanced analytics',
];

export default function UserMenu({ user, onLogout, onOpenNewsletter, profile, isPro, onOpenPricing, onOpenAccount }) {
  const [open, setOpen]               = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);
  const [portalError, setPortalError] = useState('');

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open]);

  const name     = user.user_metadata?.full_name || user.user_metadata?.name || '';
  const email    = user.email || '';
  const avatar   = user.user_metadata?.avatar_url || user.user_metadata?.picture || '';
  const prov     = user?.app_metadata?.provider || 'email';
  const joinedAt = user.created_at
    ? new Date(user.created_at).toLocaleDateString('en-GB', { year: 'numeric', month: 'long', day: 'numeric' })
    : null;
  const initials = name
    ? name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
    : email.slice(0, 2).toUpperCase();

  const planLabel = isPro ? 'PRO' : 'FREE';
  const subStatus = profile?.subscription_status;
  const expiresAt = profile?.plan_expires_at
    ? new Date(profile.plan_expires_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })
    : null;

  const handleLogout = async () => {
    setOpen(false);
    if (supabase) await supabase.auth.signOut();
    onLogout?.();
  };

  const handleManageBilling = async () => {
    setPortalLoading(true);
    setPortalError('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const res = await fetch(`${BACKEND}/api/stripe/portal`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
      else throw new Error(data.error || 'Could not open billing portal');
    } catch (err) {
      setPortalError(err.message);
    } finally {
      setPortalLoading(false);
    }
  };

  return (
    <>
      {/* ── Avatar pill trigger ── */}
      <button
        onClick={() => setOpen(true)}
        className="hud-panel px-2 py-1 flex items-center gap-1.5
                   hover:border-hud-green transition-colors duration-150 group"
        title={name || email}
      >
        {avatar ? (
          <img src={avatar} alt={initials} className="w-5 h-5 rounded-full shrink-0 object-cover" />
        ) : (
          <span className="w-5 h-5 rounded-full shrink-0 flex items-center justify-center
                           bg-hud-green/20 text-hud-green text-[9px] font-bold leading-none">
            {initials}
          </span>
        )}
        <span className="hud-label text-xs text-hud-green max-w-[80px] truncate hidden sm:block">
          {name || email.split('@')[0]}
        </span>
        {isPro && (
          <span className="text-[8px] font-mono px-1.5 py-0.5 rounded bg-hud-green/20 text-hud-green font-bold leading-none hidden sm:block">
            PRO
          </span>
        )}
        <span className="text-hud-text/50 text-[10px] group-hover:text-hud-text/80 transition-opacity">▾</span>
      </button>

      {/* ── Full-screen modal panel ── */}
      {open && (
        <div
          className="fixed inset-0 z-[350] flex items-center justify-center p-4"
          style={{ background: 'rgba(5,8,16,0.88)', backdropFilter: 'blur(12px)' }}
          onMouseDown={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
        >
          <div
            className="w-full max-w-xl rounded-2xl shadow-2xl animate-fade-in overflow-hidden"
            style={{ background: 'rgba(10,17,32,1)', border: '1px solid rgba(255,255,255,0.1)' }}
          >
            {/* ── HEADER: profile ── */}
            <div className="relative px-7 pt-7 pb-6"
                 style={{ background: 'linear-gradient(135deg, rgba(0,255,136,0.06) 0%, rgba(0,100,255,0.04) 100%)' }}>
              <button
                onClick={() => setOpen(false)}
                className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full
                           text-white/40 hover:text-white hover:bg-white/10 transition-all text-lg"
              >×</button>

              <div className="flex items-center gap-5">
                {avatar ? (
                  <img src={avatar} alt={initials}
                       className="w-16 h-16 rounded-full object-cover shrink-0 ring-2 ring-hud-green/40" />
                ) : (
                  <span className="w-16 h-16 rounded-full shrink-0 flex items-center justify-center
                                   bg-hud-green/20 text-hud-green text-xl font-bold ring-2 ring-hud-green/30">
                    {initials}
                  </span>
                )}
                <div className="flex-1 min-w-0">
                  {name && (
                    <div className="text-white text-base font-mono font-bold truncate mb-0.5">{name}</div>
                  )}
                  <div className="text-white/60 text-sm font-mono truncate mb-2">{email}</div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold uppercase tracking-wider
                      ${isPro
                        ? 'bg-hud-green/25 text-hud-green border border-hud-green/40'
                        : 'bg-white/8 text-white/50 border border-white/15'}`}>
                      {planLabel}
                    </span>
                    <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold
                      ${prov === 'google' ? 'bg-blue-500/20 text-blue-300' : 'bg-white/8 text-white/50'}`}>
                      {prov === 'google' ? '⬤ Google' : '✉ Email'}
                    </span>
                    {subStatus && subStatus !== 'inactive' && (
                      <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold uppercase
                        ${subStatus === 'active' || subStatus === 'trialing'
                          ? 'bg-hud-green/15 text-hud-green'
                          : 'bg-hud-amber/15 text-hud-amber'}`}>
                        {subStatus}
                      </span>
                    )}
                  </div>
                  {joinedAt && (
                    <div className="text-white/30 text-[10px] font-mono mt-1.5">Member since {joinedAt}</div>
                  )}
                </div>
              </div>
            </div>

            {/* ── BODY ── */}
            <div className="px-7 py-5 space-y-5">

              {/* Subscription block */}
              <div className={`rounded-xl p-5 border ${isPro
                ? 'border-hud-green/40 bg-hud-green/5'
                : 'border-white/10 bg-white/3'}`}>
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="text-white/40 text-[10px] font-mono uppercase tracking-widest mb-1">Subscription</div>
                    <div className={`text-xl font-mono font-bold ${isPro ? 'text-hud-green' : 'text-white'}`}>
                      {isPro ? 'Pro Plan' : 'Free Plan'}
                    </div>
                    {isPro && expiresAt && (
                      <div className="text-white/50 text-xs font-mono mt-1">Renews {expiresAt}</div>
                    )}
                    {!isPro && (
                      <div className="text-white/40 text-xs font-mono mt-1">Upgrade to unlock all features</div>
                    )}
                  </div>
                  {isPro && (
                    <div className="text-3xl">🛡️</div>
                  )}
                </div>

                {isPro && (
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 mb-4">
                    {PRO_FEATURES.map((f, i) => (
                      <div key={i} className="flex items-center gap-1.5 text-[11px] font-mono text-white/70">
                        <span className="text-hud-green shrink-0 text-xs">✓</span>{f}
                      </div>
                    ))}
                  </div>
                )}

                {isPro ? (
                  <>
                    <button
                      onClick={handleManageBilling}
                      disabled={portalLoading}
                      className="w-full py-2.5 rounded-lg border border-white/20 bg-white/5
                                 text-sm font-mono text-white/70 font-medium
                                 hover:bg-white/10 hover:text-white hover:border-white/30
                                 transition-all duration-150 disabled:opacity-50"
                    >
                      {portalLoading ? 'Opening portal…' : '⚙  Manage billing & invoices'}
                    </button>
                    {portalError && (
                      <p className="text-red-400 text-[10px] font-mono mt-2 text-center">{portalError}</p>
                    )}
                  </>
                ) : (
                  <button
                    onClick={() => { setOpen(false); onOpenPricing?.(); }}
                    className="w-full py-3 rounded-lg border-2 border-hud-green bg-hud-green/15
                               text-sm font-mono text-hud-green font-bold tracking-wider uppercase
                               hover:bg-hud-green/25 hover:shadow-[0_0_24px_rgba(0,255,136,0.2)]
                               transition-all duration-200"
                  >
                    ⚡ Upgrade to Pro
                  </button>
                )}
              </div>

              {/* Actions grid */}
              <div className="grid grid-cols-2 gap-3">
                <ActionBtn
                  icon="⊞"
                  label="Account settings"
                  sub="Profile & preferences"
                  onClick={() => { setOpen(false); onOpenAccount?.(); }}
                />
                <ActionBtn
                  icon="✉"
                  label="Newsletter"
                  sub="Subscribe & manage"
                  onClick={() => { setOpen(false); onOpenNewsletter?.(); }}
                  color="amber"
                />
              </div>

              {/* Sign out */}
              <div className="pt-1 border-t border-white/8">
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-lg
                             text-sm font-mono text-red-400/80
                             hover:bg-red-500/10 hover:text-red-300
                             transition-colors duration-150"
                >
                  <span className="text-base w-5 text-center">⏻</span>
                  Sign out of {email}
                </button>
              </div>

            </div>
          </div>
        </div>
      )}
    </>
  );
}

function ActionBtn({ icon, label, sub, onClick, color = 'default' }) {
  const colorMap = {
    default: 'border-white/10 bg-white/4 hover:bg-white/8 hover:border-white/20 text-white',
    amber:   'border-hud-amber/25 bg-hud-amber/5 hover:bg-hud-amber/10 hover:border-hud-amber/50 text-hud-amber',
  };
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-start gap-1 px-4 py-3.5 rounded-xl border
                  transition-all duration-150 ${colorMap[color]}`}
    >
      <span className="text-lg leading-none">{icon}</span>
      <span className="text-xs font-mono font-semibold">{label}</span>
      <span className="text-[10px] font-mono opacity-50">{sub}</span>
    </button>
  );
}
