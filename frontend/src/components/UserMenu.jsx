/**
 * UserMenu — Avatar pill + dropdown for authenticated users.
 * Shows avatar (or initials), display name, email and a logout button.
 */

import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../utils/supabaseClient.js';

export default function UserMenu({ user, onLogout }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const name    = user.user_metadata?.full_name || user.user_metadata?.name || '';
  const email   = user.email || '';
  const avatar  = user.user_metadata?.avatar_url || user.user_metadata?.picture || '';
  const initials = name
    ? name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
    : email.slice(0, 2).toUpperCase();

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
          <img
            src={avatar}
            alt={initials}
            className="w-5 h-5 rounded-full shrink-0 object-cover"
          />
        ) : (
          <span
            className="w-5 h-5 rounded-full shrink-0 flex items-center justify-center
                       bg-hud-green/20 text-hud-green text-[9px] font-bold leading-none"
          >
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
          className="absolute right-0 top-full mt-1 w-56 rounded-lg border border-hud-border/60
                     shadow-xl z-[300] overflow-hidden animate-fade-in"
          style={{ background: 'rgba(8,14,26,0.98)' }}
        >
          {/* User info header */}
          <div className="px-4 py-3 border-b border-hud-border/30 flex items-center gap-3">
            {avatar ? (
              <img src={avatar} alt={initials} className="w-9 h-9 rounded-full object-cover shrink-0" />
            ) : (
              <span className="w-9 h-9 rounded-full flex items-center justify-center
                               bg-hud-green/20 text-hud-green text-sm font-bold shrink-0">
                {initials}
              </span>
            )}
            <div className="min-w-0">
              {name && <div className="text-white text-xs font-mono truncate">{name}</div>}
              <div className="text-hud-text text-[10px] font-mono truncate opacity-70">{email}</div>
            </div>
          </div>

          {/* Menu items */}
          <div className="py-1">
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-left
                         text-xs font-mono transition-colors duration-150
                         text-red-400 hover:bg-red-500/10 hover:text-red-300"
            >
              <span className="text-sm leading-none">⏻</span>
              SIGN OUT
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
