import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';

// A tab left open across a deploy asks for lazy chunks whose hashed filenames
// no longer exist. Reload once to pick up the new build instead of crashing;
// the timestamp guard prevents a reload loop if the chunk is really missing.
window.addEventListener('vite:preloadError', (event) => {
  try {
    const last = Number(sessionStorage.getItem('milt_chunk_reload') || 0);
    if (Date.now() - last < 60_000) return;
    sessionStorage.setItem('milt_chunk_reload', String(Date.now()));
  } catch { return; }
  event.preventDefault();
  window.location.reload();
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
);
