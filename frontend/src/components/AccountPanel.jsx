/**
 * AccountPanel — Full account modal with profile, subscription, billing, and preferences.
 * Opened from the UserMenu dropdown.
 */

import React, { useState } from 'react';
import { supabase } from '../utils/supabaseClient.js';

const BACKEND = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

const SECTION = { ACCOUNT: 'account', SUBSCRIPTION: 'subscription', PREFERENCES: 'preferences' };

export default function AccountPanel({ user, profile, isPro, onClose, onOpenPricing, onOpenNewsletter, onLogout, speedUnit, altUnit, onToggleSpeedUnit, onToggleAltUnit }) {
  const [section, setSection]       = useState(SECTION.ACCOUNT);
  const [portalLoading, setPortalLoading] = useState(false);
  const [portalError, setPortalError]     = useState('');

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

  const planLabel  = isPro ? 'PRO' : 'FREE';
  const subStatus  = profile?.subscription_status;
  const expiresAt  = profile?.plan_expires_at
    ? new Date(profile.plan_expires_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })
    : null;

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

  const handleLogout = async () => {
    onClose();
    if (supabase) await supabase.auth.signOut();
    onLogout?.();
  };

  const tabs = [
    { id: SECTION.ACCOUNT,      label: 'Account'      },
    { id: SECTION.SUBSCRIPTION, label: 'Subscription' },
    { id: SECTION.PREFERENCES,  label: 'Preferences'  },
  ];

  return (
    <div
      className="fixed inset-0 z-[350] flex items-center justify-center p-4"
      style={{ background: 'rgba(5,8,16,0.92)', backdropFilter: 'blur(10px)' }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-lg rounded-2xl border border-hud-border/50 shadow-2xl animate-fade-in overflow-hidden"
        style={{ background: 'rgba(8,14,26,0.99)' }}
      >
        {/* ── Header ── */}
        <div className="flex items-center gap-4 px-6 py-5 border-b border-hud-border/30"
             style={{ background: 'linear-gradient(135deg, rgba(0,255,136,0.04) 0%, transparent 100%)' }}>
          {/* Avatar */}
          {avatar ? (
            <img src={avatar} alt={initials}
                 className="w-14 h-14 rounded-full object-cover shrink-0 border border-hud-border/40" />
          ) : (
            <span className="w-14 h-14 rounded-full flex items-center justify-center shrink-0
                             bg-hud-green/15 text-hud-green text-lg font-bold border border-hud-green/20">
              {initials}
            </span>
          )}
          <div className="flex-1 min-w-0">
            {name && <div className="text-white text-sm font-mono font-semibold truncate">{name}</div>}
            <div className="text-hud-text/60 text-xs font-mono truncate">{email}</div>
            <div className="flex items-center gap-2 mt-1.5">
              <span className={`text-[9px] font-mono px-2 py-0.5 rounded-sm font-bold uppercase tracking-wider
                ${isPro
                  ? 'bg-hud-green/20 text-hud-green border border-hud-green/30'
                  : 'bg-hud-border/20 text-hud-text/50 border border-hud-border/30'}`}>
                {planLabel}
              </span>
              <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded font-bold uppercase tracking-wider
                ${prov === 'google' ? 'bg-blue-500/15 text-blue-300' : 'bg-white/5 text-hud-text/50'}`}>
                {prov === 'google' ? '⬤ Google' : '✉ Email'}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-full
                       text-hud-text/40 hover:text-white hover:bg-white/10
                       transition-all duration-150 text-lg leading-none shrink-0"
          >×</button>
        </div>

        {/* ── Tab nav ── */}
        <div className="flex border-b border-hud-border/20">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setSection(t.id)}
              className={`flex-1 py-3 text-[10px] font-mono tracking-widest uppercase transition-colors duration-150
                ${section === t.id
                  ? 'text-hud-green border-b-2 border-hud-green -mb-px'
                  : 'text-hud-text/40 hover:text-hud-text/70'}`}
            >{t.label}</button>
          ))}
        </div>

        {/* ── Tab content ── */}
        <div className="px-6 py-5 min-h-[240px]">

          {/* ACCOUNT */}
          {section === SECTION.ACCOUNT && (
            <div className="space-y-4">
              <InfoRow label="Full name"    value={name || '—'} />
              <InfoRow label="Email"        value={email} />
              <InfoRow label="Login method" value={prov === 'google' ? 'Google OAuth' : 'Email / Password'} />
              {joinedAt && <InfoRow label="Member since" value={joinedAt} />}

              <div className="pt-3 border-t border-hud-border/20 space-y-2">
                <button
                  onClick={() => { onClose(); onOpenNewsletter?.(); }}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-lg
                             border border-hud-amber/30 bg-hud-amber/5
                             text-xs font-mono text-hud-amber
                             hover:bg-hud-amber/10 hover:border-hud-amber/60
                             transition-colors duration-150"
                >
                  <span>✉</span>
                  <span>Newsletter preferences</span>
                </button>
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-lg
                             border border-red-500/20 bg-red-500/5
                             text-xs font-mono text-red-400
                             hover:bg-red-500/10 hover:border-red-400/40
                             transition-colors duration-150"
                >
                  <span>⏻</span>
                  <span>Sign out</span>
                </button>
              </div>
            </div>
          )}

          {/* SUBSCRIPTION */}
          {section === SECTION.SUBSCRIPTION && (
            <div className="space-y-4">
              {/* Plan card */}
              <div className={`rounded-xl border p-4
                ${isPro ? 'border-hud-green/40 bg-hud-green/5' : 'border-hud-border/30 bg-white/2'}`}>
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="text-[9px] font-mono tracking-widest text-hud-text/40 uppercase mb-1">Current plan</div>
                    <div className={`text-lg font-mono font-bold ${isPro ? 'text-hud-green' : 'text-white'}`}>
                      {planLabel}
                    </div>
                  </div>
                  {subStatus && subStatus !== 'inactive' && (
                    <span className={`text-[9px] font-mono px-2 py-1 rounded font-bold uppercase tracking-wider
                      ${subStatus === 'active' || subStatus === 'trialing'
                        ? 'text-hud-green bg-hud-green/15 border border-hud-green/30'
                        : 'text-hud-amber bg-hud-amber/15 border border-hud-amber/30'}`}>
                      {subStatus}
                    </span>
                  )}
                </div>
                {isPro && expiresAt && (
                  <div className="text-[10px] font-mono text-hud-text/40 mb-1">
                    Renews on {expiresAt}
                  </div>
                )}
                {!isPro && (
                  <p className="text-[10px] font-mono text-hud-text/40">
                    Upgrade to Pro for unlimited data, AI analysis, history trails, timeline replay and more.
                  </p>
                )}
              </div>

              {/* What's included */}
              {isPro && (
                <div className="space-y-1.5">
                  <div className="text-[9px] font-mono tracking-widest text-hud-text/30 uppercase mb-2">Included in your plan</div>
                  {['Unlimited news feed', 'All threat alerts', 'AI threat analysis (Gemini)',
                    'Historical flight & ship trails', 'Timeline replay', 'Live conflict cameras',
                    'SITREP capture', 'Advanced analytics'].map((f, i) => (
                    <div key={i} className="flex items-center gap-2 text-[11px] font-mono text-hud-text/70">
                      <span className="text-hud-green shrink-0">✓</span>{f}
                    </div>
                  ))}
                </div>
              )}

              {/* CTA */}
              <div className="pt-2">
                {isPro ? (
                  <>
                    <button
                      onClick={handleManageBilling}
                      disabled={portalLoading}
                      className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg
                                 border border-hud-border/40 bg-white/3
                                 text-xs font-mono text-hud-text/70
                                 hover:bg-white/6 hover:text-white
                                 transition-colors duration-150 disabled:opacity-50"
                    >
                      {portalLoading ? 'Opening portal…' : '⚙ Manage billing & invoices'}
                    </button>
                    {portalError && (
                      <p className="text-red-400 text-[10px] font-mono mt-2 text-center">{portalError}</p>
                    )}
                  </>
                ) : (
                  <button
                    onClick={() => { onClose(); onOpenPricing?.(); }}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3.5 rounded-lg
                               border-2 border-hud-green/60 bg-hud-green/10
                               text-sm font-mono text-hud-green font-bold tracking-wider uppercase
                               hover:bg-hud-green/20 hover:border-hud-green
                               transition-all duration-150"
                  >
                    ⚡ Upgrade to Pro
                  </button>
                )}
              </div>
            </div>
          )}

          {/* PREFERENCES */}
          {section === SECTION.PREFERENCES && (
            <div className="space-y-4">
              <div className="text-[9px] font-mono tracking-widest text-hud-text/30 uppercase mb-3">Display units</div>

              <PrefRow
                label="Speed unit"
                value={speedUnit === 'kt' ? 'Knots (kt)' : 'km/h'}
                onToggle={onToggleSpeedUnit}
                options={['kt', 'kmh']}
                current={speedUnit}
                labels={{ kt: 'kt', kmh: 'km/h' }}
              />
              <PrefRow
                label="Altitude unit"
                value={altUnit === 'ft' ? 'Feet (ft)' : 'Metres (m)'}
                onToggle={onToggleAltUnit}
                options={['ft', 'm']}
                current={altUnit}
                labels={{ ft: 'ft', m: 'm' }}
              />

              <div className="pt-4 border-t border-hud-border/20">
                <div className="text-[9px] font-mono tracking-widest text-hud-text/30 uppercase mb-3">Data</div>
                <div className="text-[10px] font-mono text-hud-text/40 leading-relaxed">
                  All map preferences (filters, basemap, tracked entities) are stored locally in your browser.
                  They persist across sessions automatically.
                </div>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

function InfoRow({ label, value }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-[10px] font-mono text-hud-text/40 uppercase tracking-wider shrink-0">{label}</span>
      <span className="text-xs font-mono text-hud-text/80 text-right">{value}</span>
    </div>
  );
}

function PrefRow({ label, onToggle, options, current, labels }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-[10px] font-mono text-hud-text/40 uppercase tracking-wider">{label}</span>
      <div className="flex rounded-md border border-hud-border/40 overflow-hidden">
        {options.map(opt => (
          <button
            key={opt}
            onClick={() => { if (current !== opt) onToggle(); }}
            className={`px-3 py-1.5 text-[10px] font-mono font-bold transition-colors duration-150
              ${current === opt
                ? 'bg-hud-green/20 text-hud-green'
                : 'text-hud-text/40 hover:text-hud-text'}`}
          >{labels[opt]}</button>
        ))}
      </div>
    </div>
  );
}
