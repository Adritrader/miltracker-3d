/**
 * UserMenu — Avatar pill + dropdown for authenticated users.
 * Sections: Profile · Subscription · Newsletter · Sign Out
 */

import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../utils/supabaseClient.js';

const BACKEND = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

export default function UserMenu({ user, onLogout, onOpenNewsletter, profile, isPro, onOpenPricing, onOpenAccount }) {
  const [open, setOpen] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);
  const ref = useRef(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const name     = user.user_metadata?.full_name || user.user_metadata?.name || '';
  const email    = user.email || '';
  const avatar   = user.user_metadata?.avatar_url || user.user_metadata?.picture || '';
  const prov     = user?.app_metadata?.provider || 'email';
  const joinedAt = user.created_at
    ? new Date(user.created_at).toLocaleDateString('en-GB', { year: 'numeric', month: 'short', day: 'numeric' })
    : null;
  const initials = name
    ? name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
    : email.slice(0, 2).toUpperCase();

  const planLabel  = isPro ? 'PRO' : 'FREE';
  const expiresAt  = profile?.plan_expires_at
    ? new Date(profile.plan_expires_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    : null;
  const subStatus  = profile?.subscription_status;

  const handleLogout = async () => {
    setOpen(false);
    if (supabase) await supabase.auth.signOut();
    onLogout?.();
  };

  const handleManageBilling = async () => {
    setPortalLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const res = await fetch(`${BACKEND}/api/stripe/portal`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch (err) {
      console.error('[UserMenu] billing portal error:', err.message);
    } finally {
      setPortalLoading(false);
    }
  };

  return (
    <div ref={ref} className="relative shrink-0">
      {/* ── Avatar pill trigger ── */}
      <button
        onClick={() => setOpen(o => !o)}
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
        {/* Pro badge on pill */}
        {isPro && (
          <span className="text-[8px] font-mono px-1 py-0.5 rounded bg-hud-green/20 text-hud-green font-bold leading-none hidden sm:block">
            PRO
          </span>
        )}
        <span className="text-hud-text text-[10px] opacity-50 group-hover:opacity-80 transition-opacity">▾</span>
      </button>

      {/* ── Dropdown ── */}
      {open && (
        <div
          className="absolute right-0 top-full mt-1 w-72 rounded-lg border border-hud-border/60
                     shadow-xl z-[300] overflow-hidden animate-fade-in"
          style={{ background: 'rgba(8,14,26,0.98)' }}
        >

          {/* ── 1. PROFILE ── */}
          <div className="px-4 py-3 border-b border-hud-border/30 flex items-center gap-3">
            {avatar ? (
              <img src={avatar} alt={initials} className="w-10 h-10 rounded-full object-cover shrink-0" />
            ) : (
              <span className="w-10 h-10 rounded-full flex items-center justify-center
                               bg-hud-green/20 text-hud-green text-sm font-bold shrink-0">
                {initials}
              </span>
            )}
            <div className="min-w-0 flex-1">
              {name && <div className="text-white text-xs font-mono truncate font-semibold">{name}</div>}
              <div className="text-hud-text text-[10px] font-mono truncate opacity-70">{email}</div>
              <div className="flex items-center gap-1.5 mt-1">
                <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded-sm font-bold uppercase tracking-wider
                  ${prov === 'google' ? 'bg-blue-500/20 text-blue-300' : 'bg-hud-green/15 text-hud-green'}`}>
                  {prov === 'google' ? '⬤ Google' : '✉ Email'}
                </span>
                {joinedAt && (
                  <span className="text-[9px] font-mono text-hud-text/40">since {joinedAt}</span>
                )}
              </div>
            </div>
          </div>

          {/* ── 2. SUBSCRIPTION ── */}
          <div className="px-4 py-3 border-b border-hud-border/20">
            <div className="text-[9px] font-mono text-hud-text/40 tracking-widest uppercase mb-2">Subscription</div>
            <div className="flex items-center justify-between mb-2">
              <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded
                ${isPro
                  ? 'bg-hud-green/20 text-hud-green border border-hud-green/30'
                  : 'bg-hud-border/20 text-hud-text/50 border border-hud-border/30'}`}>
                {planLabel}
              </span>
              {subStatus && subStatus !== 'inactive' && (
                <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded font-bold uppercase
                  ${subStatus === 'active' || subStatus === 'trialing'
                    ? 'text-hud-green bg-hud-green/10'
                    : 'text-hud-amber bg-hud-amber/10'}`}>
                  {subStatus}
                </span>
              )}
            </div>
            {isPro && expiresAt && (
              <div className="text-[10px] font-mono text-hud-text/40 mb-2">
                Renews {expiresAt}
              </div>
            )}
            {isPro ? (
              <button
                onClick={() => { setOpen(false); handleManageBilling(); }}
                disabled={portalLoading}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded
                           border border-hud-border/40 bg-white/3
                           text-xs font-mono text-hud-text/70
                           hover:bg-white/5 hover:text-white
                           transition-colors duration-150 disabled:opacity-50"
              >
                {portalLoading ? 'Opening…' : '⚙ Manage Billing'}
              </button>
            ) : (
              <button
                onClick={() => { setOpen(false); onOpenPricing?.(); }}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded
                           border border-hud-green/50 bg-hud-green/10
                           text-xs font-mono text-hud-green font-bold
                           hover:bg-hud-green/20 hover:border-hud-green
                           transition-colors duration-150"
              >
                ⚡ Upgrade to Pro
              </button>
            )}
          </div>

          {/* ── 3. NEWSLETTER ── */}
          <div className="px-4 py-3 border-b border-hud-border/20">
            <div className="text-[9px] font-mono text-hud-text/40 tracking-widest uppercase mb-2">Newsletter</div>
            <button
              onClick={() => { setOpen(false); onOpenNewsletter?.(); }}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded
                         border border-hud-amber/40 bg-hud-amber/5
                         text-xs font-mono text-hud-amber
                         hover:bg-hud-amber/15 hover:border-hud-amber/70
                         transition-colors duration-150"
            >
              <span>✉</span>
              <span>Subscribe / Manage newsletter</span>
            </button>
          </div>

          {/* ── Sign out ── */}
          <div className="py-1 border-t border-hud-border/20">
            <button
              onClick={() => { setOpen(false); onOpenAccount?.(); }}
              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-left
                         text-xs font-mono transition-colors duration-150
                         text-hud-text/60 hover:bg-white/5 hover:text-white"
            >
              <span className="text-sm leading-none w-4 text-center">⊞</span>
              Account settings
            </button>
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-left
                         text-xs font-mono transition-colors duration-150
                         text-red-400 hover:bg-red-500/10 hover:text-red-300"
            >
              <span className="text-sm leading-none w-4 text-center">⏻</span>
              Sign Out
            </button>
          </div>

        </div>
      )}
    </div>
  );
}
