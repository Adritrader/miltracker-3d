/**
 * NewsletterModal — Quick newsletter subscription
 * POSTs to /api/newsletter/subscribe
 */

import React, { useState, useRef, useEffect } from 'react';

const BACKEND  = import.meta.env.VITE_BACKEND_URL || '';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function NewsletterModal({ onClose }) {
  const [email,   setEmail]   = useState('');
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');
  const [done,    setDone]    = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 80);
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!EMAIL_RE.test(email.trim())) {
      setError('Please enter a valid email address.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${BACKEND}/api/newsletter/subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      setDone(true);
    } catch (err) {
      setError(err.message || 'Subscription failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-4"
      style={{ background: 'rgba(5,8,16,0.85)', backdropFilter: 'blur(4px)' }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-sm rounded-xl border border-hud-border/60 overflow-hidden"
        style={{ background: 'rgba(8,14,26,0.98)', boxShadow: '0 0 40px rgba(0,255,136,0.08)' }}
      >
        {/* Header */}
        <div className="px-6 pt-5 pb-4 border-b border-hud-border/30 flex items-start justify-between">
          <div>
            <div className="hud-title text-base flex items-center gap-2">
              <span>✉</span> INTEL BRIEFINGS
            </div>
            <div className="text-hud-text text-xs font-mono mt-1 leading-relaxed max-w-[240px]">
              Get conflict situation reports and LiveWar3D updates delivered to your inbox.
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-hud-text hover:text-hud-green text-xl leading-none ml-4 mt-0.5 transition-colors"
            aria-label="Close"
          >✕</button>
        </div>

        <div className="px-6 py-5">
          {done ? (
            <div className="text-center py-4 space-y-3">
              <div className="text-hud-green text-3xl">✓</div>
              <div className="text-hud-green text-sm font-mono tracking-wider">SUBSCRIBED</div>
              <div className="text-hud-text text-xs font-mono">
                Intel briefings will be sent to <span className="text-white">{email}</span>
              </div>
              <button
                onClick={onClose}
                className="mt-2 px-6 py-2 rounded border border-hud-green/40 text-hud-green
                           text-xs font-mono tracking-widest hover:bg-hud-green/10 transition-colors"
              >
                CLOSE
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              <input
                ref={inputRef}
                type="email"
                autoComplete="email"
                placeholder="your@email.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full bg-white/5 border border-hud-border/50 rounded px-3 py-2.5
                           text-white text-sm font-mono placeholder-hud-text/50
                           focus:outline-none focus:border-hud-green transition-colors"
              />

              <p className="text-hud-text/60 text-xs font-mono leading-relaxed">
                No spam. Unsubscribe anytime. See our{' '}
                <a
                  href="#"
                  onClick={e => e.preventDefault()}
                  className="text-hud-amber hover:underline"
                >Privacy Policy</a>.
              </p>

              {error && <p className="text-red-400 text-xs font-mono">{error}</p>}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 rounded bg-hud-green/10 border border-hud-green/50
                           hover:bg-hud-green/20 hover:border-hud-green text-hud-green text-sm font-mono
                           tracking-widest transition-all duration-150 disabled:opacity-50"
              >
                {loading ? 'SUBSCRIBING...' : '✉ SUBSCRIBE'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
