/**
 * config.js — single source for the backend base URL.
 *
 * Only http(s) URLs are accepted (F-L9: rejects file:// or javascript:// from
 * a bad env value). Trailing slashes are stripped so `${BACKEND}/api/...`
 * never produces a double slash.
 */
const RAW = (import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001').trim();

export const BACKEND = (/^https?:\/\//i.test(RAW) ? RAW : 'http://localhost:3001').replace(/\/+$/, '');
