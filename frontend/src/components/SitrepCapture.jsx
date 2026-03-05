/**
 * SitrepCapture – Screenshot and 6-second cinematic video capture
 * - Screenshot: hides HUD, forces render, downloads PNG
 * - Video: camera orbit + MediaRecorder → WebM download
 */

import React, { useState, useRef, useCallback } from 'react';

const RECORD_SEC = 6;

export default function SitrepCapture({ viewer, onUiHide, onUiShow }) {
  const [mode, setMode]         = useState(null);   // null | 'menu' | 'countdown' | 'done'
  const [countdown, setCountdown] = useState(RECORD_SEC);
  const [dlUrl, setDlUrl]       = useState(null);
  const [dlName, setDlName]     = useState('');
  const mediaRef  = useRef(null);
  const chunksRef = useRef([]);
  const rafRef    = useRef(null);

  // ── Screenshot ─────────────────────────────────────────────────────────────
  const takeScreenshot = useCallback(() => {
    if (!viewer) return;
    onUiHide?.();
    setMode('countdown');
    setCountdown(0);

    // Give React one tick to hide UI before capturing
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        try {
          viewer.scene.requestRender();
          // Force sync render so the canvas is fresh
          const canvas = viewer.canvas;
          const dataUrl = canvas.toDataURL('image/png');
          const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
          const name = `MILTRACKER-SITREP-${ts}.png`;
          const a = document.createElement('a');
          a.href = dataUrl;
          a.download = name;
          a.click();
          setDlUrl(dataUrl);
          setDlName(name);
          setMode('done');
        } catch (err) {
          console.error('[SITREP] screenshot failed', err);
          setMode(null);
        } finally {
          onUiShow?.();
        }
      });
    });
  }, [viewer, onUiHide, onUiShow]);

  // ── Video (cinematic orbit) ─────────────────────────────────────────────────
  const recordVideo = useCallback(() => {
    if (!viewer) return;

    // Check MediaRecorder support
    if (typeof MediaRecorder === 'undefined' || !viewer.canvas.captureStream) {
      alert('Your browser does not support video recording. Use Screenshot instead.');
      return;
    }

    onUiHide?.();
    setMode('countdown');
    setCountdown(RECORD_SEC);

    const canvas  = viewer.canvas;
    const stream  = canvas.captureStream(30);
    const mime    = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
      ? 'video/webm;codecs=vp9'
      : 'video/webm';

    const recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 8_000_000 });
    chunksRef.current = [];
    mediaRef.current  = recorder;

    recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: mime });
      const url  = URL.createObjectURL(blob);
      const ts   = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const name = `MILTRACKER-SITREP-${ts}.webm`;
      const a    = document.createElement('a');
      a.href = url; a.download = name; a.click();
      setDlUrl(url);
      setDlName(name);
      setMode('done');
      onUiShow?.();
      cancelAnimationFrame(rafRef.current);
    };

    recorder.start(100); // collect in 100ms chunks

    // Orbit the camera by a fixed angle per second
    const startTs = performance.now();
    const ORBIT_SPEED = (Math.PI * 2) / (RECORD_SEC * 60); // full rotation in RECORD_SEC s at 60fps

    const frame = () => {
      const elapsed = (performance.now() - startTs) / 1000;
      if (elapsed >= RECORD_SEC) {
        recorder.stop();
        return;
      }
      // Gentle right-orbit
      viewer.camera.rotateRight(-ORBIT_SPEED);
      setCountdown(Math.ceil(RECORD_SEC - elapsed));
      rafRef.current = requestAnimationFrame(frame);
    };

    rafRef.current = requestAnimationFrame(frame);
  }, [viewer, onUiHide, onUiShow]);

  const reset = () => {
    if (dlUrl) URL.revokeObjectURL(dlUrl);
    setMode(null);
    setDlUrl(null);
    setDlName('');
    setCountdown(RECORD_SEC);
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  if (mode === 'countdown') {
    return (
      <div
        className="fixed bottom-[120px] right-4 z-30 hud-panel px-3 py-2 flex items-center gap-3 pointer-events-none"
        style={{ minWidth: 160 }}
      >
        <span className="text-red-400 text-xl animate-pulse">⏺</span>
        <div>
          <div className="text-red-400 font-mono text-xs font-bold animate-pulse">
            {countdown === 0 ? 'CAPTURING…' : `REC ${countdown}s`}
          </div>
          <div className="text-hud-text text-[10px] font-mono">SITREP CAPTURE</div>
        </div>
      </div>
    );
  }

  if (mode === 'done') {
    return (
      <div className="fixed bottom-[120px] right-4 z-30 hud-panel px-3 py-2 space-y-2" style={{ minWidth: 180 }}>
        <div className="text-hud-green font-mono text-xs font-bold">✓ SITREP SAVED</div>
        <div className="text-hud-text font-mono text-[10px] truncate max-w-[160px]">{dlName}</div>
        <div className="flex gap-2">
          {dlUrl && (
            <a
              href={dlUrl}
              download={dlName}
              className="hud-btn text-xs px-2 py-1 flex-1 text-center"
            >
              ↓ AGAIN
            </a>
          )}
          <button onClick={reset} className="hud-btn text-xs px-2 py-1 flex-1 text-center">× CLOSE</button>
        </div>
      </div>
    );
  }

  if (mode === 'menu') {
    return (
      <div className="fixed bottom-[120px] right-4 z-30 hud-panel px-3 py-2 space-y-1.5" style={{ minWidth: 180 }}>
        <div className="hud-title text-xs mb-2">📷 SITREP CAPTURE</div>
        <button
          onClick={takeScreenshot}
          className="w-full hud-btn text-xs py-1.5 text-center"
        >
          📸 SCREENSHOT (PNG)
        </button>
        <button
          onClick={recordVideo}
          className="w-full hud-btn text-xs py-1.5 text-center"
        >
          🎬 VIDEO CLIP (6s WebM)
        </button>
        <div className="text-hud-text text-[10px] font-mono opacity-60">
          UI hidden during capture
        </div>
        <button
          onClick={() => setMode(null)}
          className="w-full text-hud-text text-[10px] font-mono hover:text-white transition-colors py-0.5"
        >
          cancel
        </button>
      </div>
    );
  }

  // Default: single trigger button
  return (
    <button
      onClick={() => setMode('menu')}
      className="fixed bottom-[120px] right-4 z-30 hud-btn text-xs px-3 py-1.5 font-bold"
      title="Generate SITREP — screenshot or cinematic video clip"
    >
      📷 SITREP
    </button>
  );
}
