/**
 * UserMenu — Avatar pill + dropdown for authenticated users.
 */

import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../utils/supabaseClient.js';

const provider = (user) => user?.app_metadata?.provider || 'email';

export default function UserMenu({ user, onLogout, onOpenNewsletter, onOpenLegal }) {
  const [open, setOpen] = useState(false);
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
  const prov     = provider(user);
  const joinedAt = user.created_at ? new Date(user.created_at).toLocaleDateString('en-GB', { year: 'numeric', month: 'short', day: 'numeric' }) : null;
  const initials = name
    ? name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
    : email.slice(0, 2).toUpperCase();

  const close = (fn) => () => { setOpen(false); fn?.(); };

  const handleLogout = async () => {
    setOpen(false);
    if (supabase) await supabase.auth.signOut();
    onLogout?.();
  };

  return (
    <div ref={ref} className="relative shrink-0">
      {/* Avatar pill trigger */}
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
        <span className="text-hud-text text-[10px] opacity-50 group-hover:opacity-80 transition-opacity">▾</span>
      </button>

      {/* Dropdown */}
      {open && (
        <div
          className="absolute right-0 top-full mt-1 w-64 rounded-lg border border-hud-border/60
                     shadow-xl z-[300] overflow-hidden animate-fade-in"
          style={{ background: 'rgba(8,14,26,0.98)' }}
        >
          {/* ─ Header: avatar + name + email + provider badge ─ */}
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
                  ${ prov === 'google' ? 'bg-blue-500/20 text-blue-300' : 'bg-hud-green/15 text-hud-green' }`}>
                  {prov === 'google' ? '🔵 Google' : '✉ Email'}
                </span>
                {joinedAt && (
                  <span className="text-[9px] font-mono text-hud-text/40">since {joinedAt}</span>
                )}
              </div>
            </div>
          </div>

          {/* ─ Section: App ─ */}
          <div className="py-1 border-b border-hud-border/20">
            <div className="px-4 pt-1.5 pb-0.5">
              <span className="text-[9px] font-mono text-hud-text/40 tracking-widest uppercase">App</span>
            </div>

            {onOpenNewsletter && (
              <button
                onClick={close(onOpenNewsletter)}
                className="w-full flex items-center gap-2.5 px-4 py-2 text-left
                           text-xs font-mono text-hud-text hover:bg-hud-border/20 hover:text-hud-amber
                           transition-colors duration-100"
              >
                <span className="text-sm leading-none w-4 text-center">✉</span>
                Newsletter
              </button>
            )}

            <a
              href="https://github.com/Adritrader/miltracker-3d"
              target="_blank"
              rel="noreferrer noopener"
              onClick={() => setOpen(false)}
              className="w-full flex items-center gap-2.5 px-4 py-2 text-left
                         text-xs font-mono text-hud-text hover:bg-hud-border/20 hover:text-white
                         transition-colors duration-100"
            >
              <span className="text-sm leading-none w-4 text-center">⎋</span>
              Source / GitHub
            </a>

            <button
              onClick={() => { setOpen(false); window.location.reload(); }}
              className="w-full flex items-center gap-2.5 px-4 py-2 text-left
                         text-xs font-mono text-hud-text hover:bg-hud-border/20 hover:text-hud-green
                         transition-colors duration-100"
            >
              <span className="text-sm leading-none w-4 text-center">⟳</span>
              Refresh data
            </button>
          </div>

          {/* ─ Section: Legal ─ */}
          {onOpenLegal && (
            <div className="py-1 border-b border-hud-border/20">
              <div className="px-4 pt-1.5 pb-0.5">
                <span className="text-[9px] font-mono text-hud-text/40 tracking-widest uppercase">Legal</span>
              </div>
              {[['privacy', 'Privacy Policy'], ['terms', 'Terms of Service'], ['cookies', 'Cookie Policy']].map(([key, label]) => (
                <button
                  key={key}
                  onClick={close(() => onOpenLegal(key))}
                  className="w-full flex items-center gap-2.5 px-4 py-2 text-left
                             text-xs font-mono text-hud-text hover:bg-hud-border/20 hover:text-white
                             transition-colors duration-100"
                >
                  <span className="text-sm leading-none w-4 text-center">▢</span>
                  {label}
                </button>
              ))}
            </div>
          )}

          {/* ─ Sign out ─ */}
          <div className="py-1">
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
