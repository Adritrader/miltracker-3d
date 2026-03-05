/**
 * SitrepCapture – Screenshot and 6-second cinematic video capture
 * - Screenshot: uses scene.postRender event to grab canvas right after Cesium renders
 * - Video: camera orbit + MediaRecorder → WebM download
 * - Done modal: centered overlay with Download + Share (Web Share API / clipboard fallback)
 */

import React, { useState, useRef, useCallback } from 'react';

const RECORD_SEC = 6;

// ── Centered overlay (same pattern as EntityPopup) ──────────────────────────
const ModalOverlay = ({ children, onClose }) => (
  <>
    <div
      className="fixed inset-0 z-[55]"
      style={{ background: 'rgba(0,0,0,0.70)' }}
      onClick={onClose}
    />
    <div
      className="fixed z-[56] flex items-center justify-center pointer-events-none"
      style={{ top: 72, left: 0, right: 0, bottom: 88 }}
    >
      <div className="pointer-events-auto">
        {children}
      </div>
    </div>
  </>
);

export default function SitrepCapture({ viewer, onUiHide, onUiShow }) {
  const [mode, setMode]            = useState(null); // null | 'menu' | 'capturing' | 'done'
  const [captureType, setCaptType] = useState(null); // 'screenshot' | 'video'
  const [countdown, setCountdown]  = useState(RECORD_SEC);
  const [dlUrl, setDlUrl]          = useState(null);
  const [dlName, setDlName]        = useState('');
  const [shareMsg, setShareMsg]    = useState('');
  const mediaRef    = useRef(null);
  const chunksRef   = useRef([]);
  const rafRef      = useRef(null);
  const postRenRef  = useRef(null); // Cesium postRender listener ref

  const mkTs = () => new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

  // ── Screenshot ──────────────────────────────────────────────────────────────
  const takeScreenshot = useCallback(() => {
    if (!viewer) return;
    setCaptType('screenshot');
    setMode('capturing');
    setCountdown(0);
    onUiHide?.();

    // Remove any stale postRender listener
    if (postRenRef.current) {
      try { viewer.scene.postRender.removeEventListener(postRenRef.current); } catch (_) {}
      postRenRef.current = null;
    }

    const onAfterRender = () => {
      try { viewer.scene.postRender.removeEventListener(onAfterRender); } catch (_) {}
      postRenRef.current = null;
      try {
        // Capture canvas immediately after Cesium has drawn this frame
        const dataUrl = viewer.canvas.toDataURL('image/png');
        const name    = `MILTRACKER-SITREP-${mkTs()}.png`;
        // Auto-trigger download
        const a = document.createElement('a');
        a.href = dataUrl; a.download = name; a.click();
        setDlUrl(dataUrl);
        setDlName(name);
        setMode('done');
      } catch (err) {
        console.error('[SITREP] screenshot failed', err);
        setMode(null);
      } finally {
        onUiShow?.();
      }
    };

    postRenRef.current = onAfterRender;
    viewer.scene.postRender.addEventListener(onAfterRender);
    viewer.scene.requestRender();
  }, [viewer, onUiHide, onUiShow]);

  // ── Video (cinematic orbit) ─────────────────────────────────────────────────
  const recordVideo = useCallback(() => {
    if (!viewer) return;
    if (typeof MediaRecorder === 'undefined' || !viewer.canvas.captureStream) {
      alert('Su navegador no soporta grabación de vídeo. Use Captura de Pantalla.');
      return;
    }
    setCaptType('video');
    setMode('capturing');
    setCountdown(RECORD_SEC);
    onUiHide?.();

    const canvas   = viewer.canvas;
    const stream   = canvas.captureStream(30);
    const mime     = MediaRecorder.isTypeSupported('video/webm;codecs=vp9') ? 'video/webm;codecs=vp9' : 'video/webm';
    const recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 8_000_000 });
    chunksRef.current = [];
    mediaRef.current  = recorder;

    recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
    recorder.onstop = () => {
      cancelAnimationFrame(rafRef.current);
      const blob = new Blob(chunksRef.current, { type: mime });
      const url  = URL.createObjectURL(blob);
      const name = `MILTRACKER-SITREP-${mkTs()}.webm`;
      const a    = document.createElement('a'); a.href = url; a.download = name; a.click();
      setDlUrl(url);
      setDlName(name);
      setMode('done');
      onUiShow?.();
    };

    recorder.start(100);
    const startTs    = performance.now();
    const ORBIT_SPD  = (Math.PI * 2) / (RECORD_SEC * 60);

    const frame = () => {
      const elapsed = (performance.now() - startTs) / 1000;
      if (elapsed >= RECORD_SEC) { recorder.stop(); return; }
      viewer.camera.rotateRight(-ORBIT_SPD);
      setCountdown(Math.ceil(RECORD_SEC - elapsed));
      rafRef.current = requestAnimationFrame(frame);
    };
    rafRef.current = requestAnimationFrame(frame);
  }, [viewer, onUiHide, onUiShow]);

  // ── Share ───────────────────────────────────────────────────────────────────
  const handleShare = useCallback(async () => {
    setShareMsg('');
    // Try Web Share API with image file (screenshots on mobile)
    if (captureType === 'screenshot' && dlUrl && navigator.share) {
      try {
        const res  = await fetch(dlUrl);
        const blob = await res.blob();
        const file = new File([blob], dlName, { type: 'image/png' });
        if (navigator.canShare?.({ files: [file] })) {
          await navigator.share({ files: [file], title: 'MilTracker 3D SITREP' });
          return;
        }
      } catch (_) {}
    }
    // Fallback: share page URL
    const pageUrl = window.location.href;
    if (navigator.share) {
      try { await navigator.share({ title: 'MilTracker 3D', url: pageUrl }); return; }
      catch (_) {}
    }
    // Last resort: copy URL to clipboard
    try {
      await navigator.clipboard.writeText(pageUrl);
      setShareMsg('✓ URL copiada al portapapeles');
    } catch (_) {
      setShareMsg(pageUrl.slice(0, 80));
    }
  }, [captureType, dlUrl, dlName]);

  const reset = useCallback(() => {
    if (dlUrl?.startsWith('blob:')) URL.revokeObjectURL(dlUrl);
    setMode(null); setDlUrl(null); setDlName(''); setShareMsg('');
    setCountdown(RECORD_SEC);
  }, [dlUrl]);

  // ── Capturing indicator ─────────────────────────────────────────────────────
  if (mode === 'capturing') {
    return (
      <div
        className="fixed bottom-[172px] right-4 z-[57] hud-panel px-3 py-2 flex items-center gap-3 pointer-events-none"
        style={{ minWidth: 160 }}
      >
        <span className="text-red-400 text-xl animate-pulse">&#x23FA;</span>
        <div>
          <div className="text-red-400 font-mono text-xs font-bold animate-pulse">
            {countdown === 0 ? 'CAPTURANDO…' : `REC ${countdown}s`}
          </div>
          <div className="text-hud-text text-[10px] font-mono">SITREP CAPTURE</div>
        </div>
      </div>
    );
  }

  // ── Done modal ──────────────────────────────────────────────────────────────
  if (mode === 'done') {
    return (
      <ModalOverlay onClose={reset}>
        <div className="hud-panel p-5 space-y-4" style={{ width: 'min(340px, calc(100vw - 32px))' }}>
          <div>
            <div className="hud-title text-xs mb-1 text-hud-green">&#x2713; SITREP GUARDADO</div>
            <div className="text-white font-mono font-bold text-sm">
              {captureType === 'screenshot' ? 'Captura PNG' : 'Vídeo WebM 6s'}
            </div>
            <div className="text-hud-text font-mono text-[10px] truncate mt-0.5 opacity-60">{dlName}</div>
          </div>

          {captureType === 'screenshot' && dlUrl && (
            <img
              src={dlUrl}
              alt="SITREP preview"
              className="w-full rounded border border-hud-border/50 object-cover"
              style={{ maxHeight: 160 }}
            />
          )}

          <div className="flex flex-col gap-2">
            {dlUrl && (
              <a
                href={dlUrl}
                download={dlName}
                className="hud-btn text-xs py-2 text-center w-full block"
              >
                &#x2193; DESCARGAR
              </a>
            )}
            <button onClick={handleShare} className="hud-btn text-xs py-2 text-center w-full">
              &#x2398; COMPARTIR
            </button>
            {shareMsg && (
              <div className="text-hud-green text-[10px] font-mono text-center break-all">{shareMsg}</div>
            )}
            <button onClick={reset} className="text-hud-text text-xs font-mono hover:text-white transition-colors py-1 text-center w-full">
              &times; CERRAR
            </button>
          </div>
        </div>
      </ModalOverlay>
    );
  }

  // ── Menu modal ──────────────────────────────────────────────────────────────
  if (mode === 'menu') {
    return (
      <ModalOverlay onClose={() => setMode(null)}>
        <div className="hud-panel p-5 space-y-3" style={{ width: 'min(300px, calc(100vw - 32px))' }}>
          <div className="hud-title text-xs">&#x1F4F7; SITREP CAPTURE</div>
          <button onClick={takeScreenshot} className="w-full hud-btn text-xs py-2.5 text-center">
            &#x1F4F8; CAPTURA DE PANTALLA (PNG)
          </button>
          <button onClick={recordVideo} className="w-full hud-btn text-xs py-2.5 text-center">
            &#x1F3AC; VÍDEO CINEMATIC (6s WebM)
          </button>
          <div className="text-hud-text text-[10px] font-mono opacity-60 text-center">
            La interfaz se oculta durante la captura
          </div>
          <button onClick={() => setMode(null)} className="w-full text-hud-text text-xs font-mono hover:text-white transition-colors py-1 text-center">
            &times; Cancelar
          </button>
        </div>
      </ModalOverlay>
    );
  }

  // ── Default: trigger button ─────────────────────────────────────────────────
  return (
    <button
      onClick={() => setMode('menu')}
      className="fixed bottom-[172px] right-4 z-30 hud-btn text-xs px-3 py-1.5 font-bold"
      title="Generar SITREP — captura de pantalla o vídeo cinematic"
    >
      &#x1F4F7; SITREP
    </button>
  );
}
