/**
 * AuthModal — Login / Register modal
 * - Google OAuth via Supabase (real redirect flow)
 * - Email/password login & register via Supabase
 * - reCAPTCHA v3 invisible on register (math CAPTCHA fallback when site key not set)
 * - Honeypot anti-bot field, terms + newsletter opt-in
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useGoogleReCaptcha } from 'react-google-recaptcha-v3';
import { supabase } from '../utils/supabaseClient.js';

const BACKEND     = import.meta.env.VITE_BACKEND_URL       || 'http://localhost:3001';
const RC_SITE_KEY = import.meta.env.VITE_RECAPTCHA_SITE_KEY || '';

// ── Simple math CAPTCHA ──────────────────────────────────────────────────────
function generateCaptcha() {
  const a = Math.floor(Math.random() * 12) + 1;
  const b = Math.floor(Math.random() * 10) + 1;
  return { question: `${a} + ${b}`, answer: String(a + b) };
}

// ── Modal overlay wrapper ────────────────────────────────────────────────────
const Overlay = ({ onClose, children }) => (
  <div
    className="fixed inset-0 z-[200] flex items-center justify-center p-4"
    style={{ background: 'rgba(5,8,16,0.85)', backdropFilter: 'blur(4px)' }}
    onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
  >
    {children}
  </div>
);

// ── Google login button ──────────────────────────────────────────────────────
const GoogleBtn = ({ onClick, loading }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={loading}
    className="w-full flex items-center justify-center gap-3 py-2.5 px-4 rounded
               border border-hud-border hover:border-white/30 transition-colors duration-150
               bg-white/5 hover:bg-white/10 text-white text-sm font-mono"
  >
    {/* Google G icon inline SVG */}
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.716v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.185l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
      <path d="M3.964 10.706A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.706V4.962H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.038l3.007-2.332z" fill="#FBBC05"/>
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.962L3.964 7.294C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
    </svg>
    Continue with Google
  </button>
);

export default function AuthModal({ onClose, onOpenLegal }) {
  const [tab, setTab]             = useState('login');
  const [email, setEmail]         = useState('');
  const [password, setPassword]   = useState('');
  const [pwConfirm, setPwConfirm] = useState('');
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [newsletter, setNewsletter]   = useState(true);
  const [honeypot, setHoneypot]   = useState('');
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState('');
  const [success, setSuccess]     = useState('');

  // reCAPTCHA v3 (invisible) or math CAPTCHA fallback
  const { executeRecaptcha }      = useGoogleReCaptcha() || {};
  const [captcha, setCaptcha]     = useState(() => generateCaptcha());
  const [captchaInput, setCaptchaInput] = useState('');

  const emailRef = useRef(null);

  useEffect(() => {
    setTimeout(() => emailRef.current?.focus(), 80);
  }, [tab]);

  const resetForm = useCallback(() => {
    setEmail(''); setPassword(''); setPwConfirm('');
    setAcceptTerms(false); setNewsletter(true);
    setHoneypot(''); setError(''); setSuccess('');
    setCaptchaInput('');
    setCaptcha(generateCaptcha());
  }, []);

  const handleTabSwitch = useCallback((t) => {
    setTab(t);
    resetForm();
  }, [resetForm]);

  // ── Google OAuth (Supabase) ──────────────────────────────────────────────
  const handleGoogle = useCallback(async () => {
    if (!supabase) {
      setError('Auth not configured — set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
      return;
    }
    setLoading(true);
    setError('');
    const { error: authErr } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });
    if (authErr) {
      setError(authErr.message);
      setLoading(false);
    }
    // On success the browser navigates to Google — no need to reset loading
  }, []);

  // ── Email login ──────────────────────────────────────────────────────────
  const handleLogin = useCallback(async (e) => {
    e.preventDefault();
    if (!email || !password) { setError('Please fill all fields.'); return; }
    if (!supabase)            { setError('Auth not configured.'); return; }
    setLoading(true); setError('');
    try {
      const { error: authErr } = await supabase.auth.signInWithPassword({ email, password });
      if (authErr) throw authErr;
      setSuccess('Signed in! Welcome back.');
      setTimeout(onClose, 1200);
    } catch (err) {
      setError(err.message || 'Login failed. Check your credentials.');
    } finally {
      setLoading(false);
    }
  }, [email, password, onClose]);

  // ── Email register ───────────────────────────────────────────────────────
  const handleRegister = useCallback(async (e) => {
    e.preventDefault();
    setError('');

    if (honeypot) { setSuccess('Account created!'); return; } // silent bot reject

    if (!email || !password || !pwConfirm) { setError('Please fill all fields.'); return; }
    if (password !== pwConfirm)            { setError('Passwords do not match.'); return; }
    if (password.length < 8)               { setError('Password must be at least 8 characters.'); return; }
    if (!acceptTerms)                      { setError('You must accept the Terms & Privacy Policy.'); return; }

    // CAPTCHA check — v3 invisible when key is configured, math fallback otherwise
    if (RC_SITE_KEY && executeRecaptcha) {
      try {
        const token = await executeRecaptcha('register');
        const res   = await fetch(`${BACKEND}/api/auth/verify-recaptcha`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });
        const data = await res.json();
        if (!data.valid) {
          setError('reCAPTCHA verification failed. Please try again.');
          return;
        }
      } catch {
        setError('Could not verify reCAPTCHA. Please try again later.');
        return;
      }
    } else if (!RC_SITE_KEY) {
      // Math CAPTCHA fallback (dev / no key)
      if (captchaInput.trim() !== captcha.answer) {
        setError('Incorrect CAPTCHA answer. Please try again.');
        setCaptcha(generateCaptcha()); setCaptchaInput('');
        return;
      }
    }

    if (!supabase) { setError('Auth not configured.'); return; }

    setLoading(true);
    try {
      const { error: authErr } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { newsletter_opt_in: newsletter } },
      });
      if (authErr) throw authErr;
      setSuccess(
        'Account created! Check your email to confirm.' +
        (newsletter ? " You've been subscribed to the newsletter." : '')
      );
      setTimeout(onClose, 2500);
    } catch (err) {
      setError(err.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [honeypot, email, password, pwConfirm, acceptTerms, executeRecaptcha, captchaInput, captcha, newsletter, onClose]);

  return (
    <Overlay onClose={onClose}>
      <div
        className="w-full max-w-sm rounded-xl border border-hud-border/60 overflow-hidden"
        style={{ background: 'rgba(8,14,26,0.98)', boxShadow: '0 0 40px rgba(0,255,136,0.08)' }}
      >
        {/* Header */}
        <div className="px-6 pt-5 pb-4 border-b border-hud-border/30 flex items-center justify-between">
          <div>
            <div className="hud-title text-glitch text-base">LIVEWAR3D</div>
            <div className="text-hud-text text-xs font-mono mt-0.5">Secure Access Portal</div>
          </div>
          <button
            onClick={onClose}
            className="text-hud-text hover:text-hud-green text-xl leading-none transition-colors"
            aria-label="Close"
          >✕</button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-hud-border/30">
          {['login', 'register'].map(t => (
            <button
              key={t}
              onClick={() => handleTabSwitch(t)}
              className={`flex-1 py-2.5 text-xs font-mono tracking-widest uppercase transition-colors duration-150
                          ${tab === t
                            ? 'text-hud-green border-b-2 border-hud-green bg-hud-green/5'
                            : 'text-hud-text hover:text-white border-b-2 border-transparent'}`}
            >
              {t === 'login' ? 'Sign In' : 'Register'}
            </button>
          ))}
        </div>

        <div className="px-6 py-5 space-y-4">
          {/* Google button */}
          <GoogleBtn onClick={handleGoogle} loading={loading} />

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-hud-border/30" />
            <span className="text-hud-text text-xs font-mono">or</span>
            <div className="flex-1 h-px bg-hud-border/30" />
          </div>

          {/* ── Login form ── */}
          {tab === 'login' && (
            <form onSubmit={handleLogin} className="space-y-3" noValidate>
              <input
                ref={emailRef}
                type="email"
                autoComplete="email"
                placeholder="Email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full bg-white/5 border border-hud-border/50 rounded px-3 py-2
                           text-white text-sm font-mono placeholder-hud-text/50
                           focus:outline-none focus:border-hud-green transition-colors"
              />
              <input
                type="password"
                autoComplete="current-password"
                placeholder="Password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full bg-white/5 border border-hud-border/50 rounded px-3 py-2
                           text-white text-sm font-mono placeholder-hud-text/50
                           focus:outline-none focus:border-hud-green transition-colors"
              />
              {error   && <p className="text-red-400 text-xs font-mono">{error}</p>}
              {success && <p className="text-hud-green text-xs font-mono">{success}</p>}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 rounded bg-hud-green/10 border border-hud-green/50
                           hover:bg-hud-green/20 hover:border-hud-green text-hud-green text-sm font-mono
                           tracking-widest transition-all duration-150 disabled:opacity-50"
              >
                {loading ? 'SIGNING IN...' : 'SIGN IN'}
              </button>
            </form>
          )}

          {/* ── Register form ── */}
          {tab === 'register' && (
            <form onSubmit={handleRegister} className="space-y-3" noValidate>
              {/* Honeypot — invisible to humans, bots fill it */}
              <input
                type="text"
                name="website"
                tabIndex={-1}
                autoComplete="off"
                value={honeypot}
                onChange={e => setHoneypot(e.target.value)}
                style={{ position: 'absolute', left: '-9999px', opacity: 0, height: 0, pointerEvents: 'none' }}
                aria-hidden="true"
              />

              <input
                ref={emailRef}
                type="email"
                autoComplete="email"
                placeholder="Email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full bg-white/5 border border-hud-border/50 rounded px-3 py-2
                           text-white text-sm font-mono placeholder-hud-text/50
                           focus:outline-none focus:border-hud-green transition-colors"
              />
              <input
                type="password"
                autoComplete="new-password"
                placeholder="Password (min 8 chars)"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full bg-white/5 border border-hud-border/50 rounded px-3 py-2
                           text-white text-sm font-mono placeholder-hud-text/50
                           focus:outline-none focus:border-hud-green transition-colors"
              />
              <input
                type="password"
                autoComplete="new-password"
                placeholder="Confirm password"
                value={pwConfirm}
                onChange={e => setPwConfirm(e.target.value)}
                className="w-full bg-white/5 border border-hud-border/50 rounded px-3 py-2
                           text-white text-sm font-mono placeholder-hud-text/50
                           focus:outline-none focus:border-hud-green transition-colors"
              />

              {/* reCAPTCHA v3 is invisible — no widget shown. Math CAPTCHA fallback when no key */}
              {!RC_SITE_KEY && (
                <div className="rounded border border-hud-border/40 bg-white/3 px-3 py-2.5">
                  <p className="text-hud-text text-xs font-mono mb-2">
                    ◈ Human verification:{' '}
                    <span className="text-hud-amber font-bold">{captcha.question} = ?</span>
                  </p>
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="Your answer"
                    value={captchaInput}
                    onChange={e => setCaptchaInput(e.target.value)}
                    className="w-full bg-white/5 border border-hud-border/50 rounded px-3 py-1.5
                               text-white text-sm font-mono placeholder-hud-text/50
                               focus:outline-none focus:border-hud-amber transition-colors"
                  />
                </div>
              )}

              {/* Terms + Privacy */}
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={acceptTerms}
                  onChange={e => setAcceptTerms(e.target.checked)}
                  className="mt-0.5 accent-hud-green cursor-pointer shrink-0"
                />
                <span className="text-hud-text text-xs font-mono leading-relaxed">
                  I accept the{' '}
                  <a href="#" onClick={e => { e.preventDefault(); onOpenLegal?.('terms'); }} className="text-hud-amber hover:underline">Terms of Service</a>
                  {' '}and{' '}
                  <a href="#" onClick={e => { e.preventDefault(); onOpenLegal?.('privacy'); }} className="text-hud-amber hover:underline">Privacy Policy</a>
                </span>
              </label>

              {/* Newsletter opt-in */}
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={newsletter}
                  onChange={e => setNewsletter(e.target.checked)}
                  className="mt-0.5 accent-hud-green cursor-pointer shrink-0"
                />
                <span className="text-hud-text text-xs font-mono leading-relaxed">
                  Subscribe to the LiveWar3D newsletter — conflict updates & new features
                </span>
              </label>

              {error   && <p className="text-red-400 text-xs font-mono">{error}</p>}
              {success && <p className="text-hud-green text-xs font-mono">{success}</p>}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 rounded bg-hud-green/10 border border-hud-green/50
                           hover:bg-hud-green/20 hover:border-hud-green text-hud-green text-sm font-mono
                           tracking-widest transition-all duration-150 disabled:opacity-50"
              >
                {loading ? 'CREATING ACCOUNT...' : 'CREATE ACCOUNT'}
              </button>
            </form>
          )}
        </div>
      </div>
    </Overlay>
  );
}
