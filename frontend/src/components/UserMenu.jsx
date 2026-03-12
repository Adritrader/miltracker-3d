/**
 * UserMenu — Avatar pill + dropdown for authenticated users.
 * Sections: Profile · Newsletter · Public API endpoints
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '../utils/supabaseClient.js';

const BACKEND = import.meta.env.VITE_BACKEND_URL || 'https://miltracker-3d-production.up.railway.app';

const API_ENDPOINTS = [
  { method: 'GET', path: '/api/aircraft',              label: 'Live military aircraft' },
  { method: 'GET', path: '/api/ships',                 label: 'Live military ships' },
  { method: 'GET', path: '/api/news',                  label: 'Latest intel news' },
  { method: 'GET', path: '/api/alerts',                label: 'Active alerts' },
  { method: 'GET', path: '/api/conflicts',             label: 'Conflict zones / hotspots' },
  { method: 'GET', path: '/api/status',                label: 'Server status' },
  { method: 'GET', path: '/api/history/trail/:id',     label: 'Entity trail history' },
  { method: 'GET', path: '/api/analytics/fleet',       label: 'Fleet composition analytics' },
];

export default function UserMenu({ user, onLogout, onOpenNewsletter }) {
  const [open, setOpen]       = useState(false);
  const [copied, setCopied]   = useState(null);
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

  const copyToClipboard = useCallback((text, key) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key);
      setTimeout(() => setCopied(null), 1500);
    }).catch(() => {});
  }, []);

  const handleLogout = async () => {
    setOpen(false);
    if (supabase) await supabase.auth.signOut();
    onLogout?.();
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

          {/* ── 2. NEWSLETTER ── */}
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

          {/* ── 3. PUBLIC API ── */}
          <div className="px-4 py-3 border-b border-hud-border/20">
            <div className="text-[9px] font-mono text-hud-text/40 tracking-widest uppercase mb-2">Public API</div>

            {/* Base URL copy row */}
            <button
              onClick={() => copyToClipboard(BACKEND, 'base')}
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded mb-2
                         border border-hud-border/30 bg-white/3
                         hover:bg-hud-border/20 transition-colors duration-100 group"
              title="Copy base URL"
            >
              <span className="text-hud-text/40 text-[9px] font-mono shrink-0">BASE</span>
              <span className="text-hud-green text-[10px] font-mono truncate flex-1 text-left">
                {BACKEND.replace('https://', '')}
              </span>
              <span className="text-[9px] text-hud-text/40 group-hover:text-hud-green transition-colors shrink-0">
                {copied === 'base' ? '✓' : '⎘'}
              </span>
            </button>

            {/* Endpoint rows */}
            <div className="flex flex-col gap-0.5 max-h-44 overflow-y-auto pr-0.5
                            scrollbar-thin scrollbar-thumb-hud-border/30">
              {API_ENDPOINTS.map((ep) => {
                const full = `${BACKEND}${ep.path}`;
                const key  = ep.path;
                return (
                  <button
                    key={key}
                    onClick={() => copyToClipboard(full, key)}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-left
                               hover:bg-hud-border/20 transition-colors duration-100 group"
                    title={`Copy: ${full}`}
                  >
                    <span className="text-hud-green/60 text-[8px] font-mono shrink-0 w-7">{ep.method}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-hud-text text-[9px] font-mono truncate">{ep.path}</div>
                      <div className="text-hud-text/40 text-[8px] font-mono truncate">{ep.label}</div>
                    </div>
                    <span className="text-[9px] text-hud-text/30 group-hover:text-hud-green transition-colors shrink-0">
                      {copied === key ? '✓' : '⎘'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── Sign out ── */}
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
