/**
 * SitrepCapture — Screenshot and 10-second cinematic video capture
 * - Screenshot: uses scene.postRender event to grab canvas right after Cesium renders
 * - Video: cinematic zoom-in â†’ MP4 (iOS) or WebM (desktop) via MediaRecorder
 * - Done modal: Download + social share grid (Twitter, WhatsApp, Telegram, Reddit, native)
 */

import React, { useState, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import * as Cesium from 'cesium';

const RECORD_SEC = 10;
const PAGE_URL   = () => window.location.href;
const SHARE_TEXTS = [
  '?? LiveWar3D — track military aircraft, warships & active conflict zones on a live 3D globe.\nhttps://livewar3d.com\n#LiveWar3D #MilitaryTracking #OSINT #War #Defense',
  '?? Real-time conflict zones, warships & military aircraft all in one place.\nOpen-source intel, updated live.\nhttps://livewar3d.com\n#LiveWar3D #BreakingNews #OSINT #MilAviation #NavalOps',
  '?? Monitoring active war zones worldwide — NATO movements, naval ops, airstrikes & more.\nhttps://livewar3d.com\n#LiveWar3D #MilitaryTracking #War #Geopolitics #Defense',
  '??? Live OSINT: military flights, naval movements & conflict alerts on a 3D globe.\nSee what\'s happening before the news does.\nhttps://livewar3d.com\n#OSINT #LiveWar3D #MilAviation #NavalOps #Intelligence',
  '?? Track the world\'s conflicts in real time — Ukraine, Middle East, Taiwan Strait & more.\nhttps://livewar3d.com\n#LiveWar3D #War #Ukraine #MiddleEast #Taiwan #Defense',
  '?? Live military intel — aircraft carriers, fighter jets, warships & breaking conflict news.\nAll on a 3D globe.\nhttps://livewar3d.com\n#LiveWar3D #MilitaryTracking #OSINT #Geopolitics',
  '?? Active conflict monitor — see what\'s happening worldwide right now.\nPowered by ADS-B, AIS & open-source intelligence.\nhttps://livewar3d.com\n#LiveWar3D #OSINT #War #LiveTracking #Defense',
  '?? SITREP: Live military tracking powered by LiveWar3D.\nAircraft, warships, conflict zones & more — updated in real time.\nhttps://livewar3d.com\n#LiveWar3D #SITREP #MilitaryTracking #War #OSINT',
  '??? 3D globe with live wars, naval ops & air patrols.\nTrack carriers, F-35 flights & active frontlines in real time.\nhttps://livewar3d.com\n#LiveWar3D #NavalOps #MilAviation #War #Defense',
  '? Real-time alerts: missile launches, naval intercepts & airstrike reports.\nLiveWar3D — the pulse of global conflict.\nhttps://livewar3d.com\n#LiveWar3D #BreakingNews #MilitaryTracking #OSINT #War',
  '??? Military aircraft live on your screen — tankers, bombers, ISR & fighters tracked in real time.\nhttps://livewar3d.com\n#LiveWar3D #MilAviation #AirForce #OSINT #Defense',
  '?? Warships, aircraft carriers & submarines tracked live.\nSee where the fleets are right now.\nhttps://livewar3d.com\n#LiveWar3D #NavalOps #USNavy #OSINT #MilitaryTracking',
];
const getShareText = () => SHARE_TEXTS[Math.floor(Math.random() * SHARE_TEXTS.length)];

// Pick best supported video mime — try every candidate and use the first that works
const MIME_CANDIDATES = [
  { mime: 'video/mp4;codecs=avc1.42E01E', ext: 'mp4'  },
  { mime: 'video/mp4;codecs=avc1',        ext: 'mp4'  },
  { mime: 'video/mp4',                    ext: 'mp4'  },
  { mime: 'video/webm;codecs=vp9',        ext: 'webm' },
  { mime: 'video/webm;codecs=vp8',        ext: 'webm' },
  { mime: 'video/webm',                   ext: 'webm' },
];
function bestMime() {
  for (const c of MIME_CANDIDATES) {
    if (MediaRecorder.isTypeSupported(c.mime)) return c;
  }
  return { mime: '', ext: 'webm' }; // browser picks codec
}

// -- Watermark helpers ---------------------------------------------------------------
const LOGO_URL = '/icon-192.png';

function drawWatermarkOnCtx(ctx, w, h, logoImg) {
  const pad      = 14;
  const fontSize = Math.max(11, Math.round(w / 90));
  const logoSize = fontSize * 2.6;

  ctx.save();
  ctx.shadowColor = '#000'; ctx.shadowBlur = 6;

  // Logo icon (bottom-right, above text)
  if (logoImg) {
    const lx = w - pad - logoSize;
    const ly = h - pad - fontSize * 2.4 - logoSize - 4;
    ctx.globalAlpha = 0.75;
    ctx.drawImage(logoImg, lx, ly, logoSize, logoSize);
  }

  // Name + domain text
  ctx.textAlign = 'right'; ctx.textBaseline = 'bottom';
  ctx.font = `bold ${fontSize}px 'Courier New', monospace`;
  ctx.globalAlpha = 0.55; ctx.fillStyle = '#ffffff';
  ctx.fillText('LiveWar3D', w - pad, h - pad - fontSize - 3);
  ctx.globalAlpha = 0.70; ctx.fillStyle = '#00ff88';
  ctx.fillText(window.location.hostname, w - pad, h - pad);
  ctx.restore();
}

function loadImage(src) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload  = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function addWatermark(dataUrl) {
  return new Promise(async resolve => {
    const [img, logo] = await Promise.all([loadImage(dataUrl), loadImage(LOGO_URL)]);
    if (!img) { resolve(dataUrl); return; }
    const c = document.createElement('canvas');
    c.width = img.width; c.height = img.height;
    const ctx = c.getContext('2d');
    ctx.drawImage(img, 0, 0);
    drawWatermarkOnCtx(ctx, c.width, c.height, logo);
    resolve(c.toDataURL('image/png'));
  });
}

// â”€â”€ Social share URL builders â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const NETWORKS = [
  {
    id: 'whatsapp',
    label: 'WhatsApp',
    color: '#25d366',
    url: () => `https://wa.me/?text=${encodeURIComponent(getShareText() + ' ' + PAGE_URL())}`,
  },
  {
    id: 'telegram',
    label: 'Telegram',
    color: '#0088cc',
    url: () => `https://t.me/share/url?url=${encodeURIComponent(PAGE_URL())}&text=${encodeURIComponent(getShareText())}`,
  },
  {
    id: 'reddit',
    label: 'Reddit',
    color: '#ff4500',
    url: () => `https://reddit.com/submit?url=${encodeURIComponent(PAGE_URL())}&title=${encodeURIComponent(getShareText())}`,
  },
];

// â”€â”€ Centered overlay â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const ModalOverlay = ({ children, onClose }) => createPortal(
  <div
    className="fixed inset-0 z-[55] flex items-center justify-center"
    style={{ background: 'rgba(0,0,0,0.70)' }}
    onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
  >
    <div onClick={(e) => e.stopPropagation()}>
      {children}
    </div>
  </div>,
  document.body
);

export default function SitrepCapture({ viewer, onUiHide, onUiShow, inline = false }) {
  const [mode, setMode]            = useState(null);
  const [captureType, setCaptType] = useState(null); // 'screenshot' | 'video'
  const [countdown, setCountdown]  = useState(RECORD_SEC);
  const [dlUrl, setDlUrl]          = useState(null);
  const [dlName, setDlName]        = useState('');
  const [dlMime, setDlMime]        = useState('');
  const [shareMsg, setShareMsg]    = useState('');
  const mediaRef      = useRef(null);
  const chunksRef     = useRef([]);
  const rafRef        = useRef(null);
  const postRenRef    = useRef(null);
  const safetyTimerRef = useRef(null);

  const mkTs = () => new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

  // â”€â”€ Screenshot â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const takeScreenshot = useCallback(() => {
    if (!viewer) return;
    setCaptType('screenshot');
    setMode('capturing');
    setCountdown(0);
    onUiHide?.();

    if (postRenRef.current) {
      try { viewer.scene.postRender.removeEventListener(postRenRef.current); } catch (_) {}
      postRenRef.current = null;
    }

    const onAfterRender = () => {
      try { viewer.scene.postRender.removeEventListener(onAfterRender); } catch (_) {}
      postRenRef.current = null;
      try {
        const raw  = viewer.canvas.toDataURL('image/png');
        const name = `LIVEWAR3D-SITREP-${mkTs()}.png`;
        addWatermark(raw)
          .then(dataUrl => {
            setDlUrl(dataUrl); setDlName(name); setDlMime('image/png'); setMode('done');
          })
          .catch(() => {
            setDlUrl(raw); setDlName(name); setDlMime('image/png'); setMode('done');
          })
          .finally(() => onUiShow?.());
      } catch (err) {
        console.error('[SITREP] screenshot failed', err);
        setMode(null);
        onUiShow?.();
      }
    };

    postRenRef.current = onAfterRender;
    viewer.scene.postRender.addEventListener(onAfterRender);
    viewer.scene.requestRender();
  }, [viewer, onUiHide, onUiShow]);

  // â”€â”€ Video (cinematic zoom-in) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const recordVideo = useCallback(() => {
    if (!viewer) return;
    if (typeof MediaRecorder === 'undefined' || !viewer.canvas.captureStream) {
      alert('Your browser does not support video recording. Use Screenshot instead.');
      return;
    }
    setCaptType('video');
    setMode('capturing');
    setCountdown(RECORD_SEC);
    onUiHide?.();

    const { mime } = bestMime();
    // Offscreen canvas: copies Cesium canvas each frame + adds watermark
    const wmCanvas = document.createElement('canvas');
    wmCanvas.width  = viewer.canvas.width;
    wmCanvas.height = viewer.canvas.height;
    const wmCtx = wmCanvas.getContext('2d');
    let videoLogo = null;
    loadImage(LOGO_URL).then(img => { videoLogo = img; });
    const copyFrame = () => {
      wmCtx.drawImage(viewer.canvas, 0, 0);
      drawWatermarkOnCtx(wmCtx, wmCanvas.width, wmCanvas.height, videoLogo);
    };
    viewer.scene.postRender.addEventListener(copyFrame);

    const canvas = wmCanvas;
    const stream = wmCanvas.captureStream(30);
    const _cleanup = () => { try { viewer.scene.postRender.removeEventListener(copyFrame); } catch(_) {} };

    let recorder;
    try {
      recorder = mime
        ? new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 8_000_000 })
        : new MediaRecorder(stream, { videoBitsPerSecond: 8_000_000 });
    } catch (err) {
      console.error('[SITREP] MediaRecorder creation failed:', err);
      try { recorder = new MediaRecorder(stream); } catch (err2) {
        console.error('[SITREP] MediaRecorder fallback failed:', err2);
        onUiShow?.(); setMode(null);
        alert('Video recording is not supported in this browser. Use Screenshot instead.');
        return;
      }
    }

    chunksRef.current = [];
    mediaRef.current  = recorder;

    const finish = () => {
      _cleanup();
      cancelAnimationFrame(rafRef.current); rafRef.current = null;
      if (safetyTimerRef.current) { clearTimeout(safetyTimerRef.current); safetyTimerRef.current = null; }
      const recMime = recorder.mimeType || mime || 'video/webm';
      const recExt  = recMime.includes('mp4') ? 'mp4' : 'webm';
      const blob = new Blob(chunksRef.current, { type: recMime });
      if (blob.size === 0) {
        console.warn('[SITREP] Video blob empty — nothing was recorded');
        onUiShow?.(); setMode(null);
        alert('Video was empty — make sure the canvas is visible and try again.');
        return;
      }
      const url  = URL.createObjectURL(blob);
      const name = `LIVEWAR3D-SITREP-${mkTs()}.${recExt}`;
      setDlUrl(url); setDlName(name); setDlMime(recMime);
      setMode('done'); onUiShow?.();
    };

    recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
    recorder.onstop  = finish;
    recorder.onerror = (e) => {
      console.error('[SITREP] MediaRecorder error:', e);
      cancelAnimationFrame(rafRef.current); rafRef.current = null;
      onUiShow?.(); setMode(null);
      alert('Video recording error. Use Screenshot instead.');
    };

    recorder.start(200);

    // Safety net — force-stop if onstop hasn't fired within RECORD_SEC + 5s
    safetyTimerRef.current = setTimeout(() => {
      if (recorder.state !== 'inactive') recorder.stop();
    }, (RECORD_SEC + 5) * 1000);

    const startCarto = viewer.camera.positionCartographic.clone();
    const startLon   = Cesium.Math.toDegrees(startCarto.longitude);
    const startLat   = Cesium.Math.toDegrees(startCarto.latitude);
    const startAlt   = startCarto.height;
    const endAlt     = Math.max(startAlt * 0.25, 5_000);
    const startHdg   = viewer.camera.heading;
    const startPitch = viewer.camera.pitch;
    const startTs    = performance.now();
    let lastCd       = RECORD_SEC;

    const frame = () => {
      if (!viewer || viewer.isDestroyed()) { recorder.stop(); return; }
      const elapsed = (performance.now() - startTs) / 1000;
      if (elapsed >= RECORD_SEC) { recorder.stop(); return; }
      const t     = elapsed / RECORD_SEC;
      const eased = t < 0.5 ? 2*t*t : -1 + (4 - 2*t)*t;
      const alt   = startAlt + (endAlt - startAlt) * eased;
      const hdg   = startHdg + Cesium.Math.toRadians(12) * t;
      viewer.camera.setView({
        destination: Cesium.Cartesian3.fromDegrees(startLon, startLat, alt),
        orientation: { heading: hdg, pitch: startPitch, roll: 0 },
      });
      const cd = Math.max(1, Math.ceil(RECORD_SEC - elapsed));
      if (cd !== lastCd) { lastCd = cd; setCountdown(cd); }
      rafRef.current = requestAnimationFrame(frame);
    };
    rafRef.current = requestAnimationFrame(frame);
  }, [viewer, onUiHide, onUiShow]);

  // â”€â”€ Native share (file) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const handleNativeShare = useCallback(async () => {
    setShareMsg('');
    if (!dlUrl) return;
    if (navigator.share) {
      try {
        const isData = dlUrl.startsWith('data:');
        const blob   = isData
          ? await fetch(dlUrl).then(r => r.blob())
          : await fetch(dlUrl).then(r => r.blob());
        const file = new File([blob], dlName, { type: dlMime });
        if (navigator.canShare?.({ files: [file] })) {
          await navigator.share({ files: [file], title: 'LiveWar3D SITREP', text: getShareText() });
          return;
        }
        // Share without file
        await navigator.share({ title: 'LiveWar3D', url: PAGE_URL(), text: getShareText() });
        return;
      } catch (e) {
        if (e.name === 'AbortError') return; // user cancelled
      }
    }
    // Fallback: copy URL
    try {
      await navigator.clipboard.writeText(PAGE_URL());
      setShareMsg('? URL copied');
    } catch (_) {
      setShareMsg(PAGE_URL().slice(0, 70));
    }
  }, [dlUrl, dlName, dlMime]);

  // Twitter: for video, auto-download + open Twitter compose so user can attach
  const handleTwitterShare = useCallback(() => {
    const tweetUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(getShareText())}&url=${encodeURIComponent(PAGE_URL())}`;
    window.open(tweetUrl, '_blank', 'noopener,noreferrer');
    // If it's a video, also trigger the download so user can attach it to the tweet
    if (captureType === 'video' && dlUrl) {
      const a = document.createElement('a');
      a.href = dlUrl;
      a.download = dlName;
      a.click();
    }
  }, [captureType, dlUrl, dlName]);

  const reset = useCallback(() => {
    cancelAnimationFrame(rafRef.current); rafRef.current = null;
    if (safetyTimerRef.current) { clearTimeout(safetyTimerRef.current); safetyTimerRef.current = null; }
    if (mediaRef.current?.state !== 'inactive') { try { mediaRef.current?.stop(); } catch (_) {} }
    if (dlUrl?.startsWith('blob:')) URL.revokeObjectURL(dlUrl);
    setMode(null); setDlUrl(null); setDlName(''); setDlMime(''); setShareMsg('');
    setCountdown(RECORD_SEC);
  }, [dlUrl]);

  // â”€â”€ Capturing indicator â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (mode === 'capturing') {
    return (
      <div
        className="fixed bottom-[172px] right-4 z-[57] hud-panel px-3 py-2 flex items-center gap-3 pointer-events-none"
        style={{ minWidth: 160 }}
      >
        <span className="text-red-400 text-xl animate-pulse">&#x23FA;</span>
        <div>
          <div className="text-red-400 font-mono text-xs font-bold animate-pulse">
            {countdown === 0 ? 'CAPTURING...' : `REC ${countdown}s`}
          </div>
          <div className="text-hud-text text-[10px] font-mono">SITREP CAPTURE</div>
        </div>
      </div>
    );
  }

  // â”€â”€ Done modal â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (mode === 'done') {
    const isVideo = captureType === 'video';
    return (
      <ModalOverlay onClose={reset}>
        <div className="hud-panel p-5 space-y-4" style={{ width: 'min(360px, calc(100vw - 32px))' }}>
          {/* Header */}
          <div>
            <div className="hud-title text-xs mb-1 text-hud-green">&#x2713; SITREP SAVED</div>
            <div className="text-white font-mono font-bold text-sm">
              {isVideo ? `${dlName.endsWith('.mp4') ? 'MP4' : 'WebM'} video ${RECORD_SEC}s` : 'Screenshot PNG'}
            </div>
            <div className="text-hud-text font-mono text-[10px] truncate mt-0.5 opacity-60">{dlName}</div>
          </div>

          {/* Screenshot preview */}
          {!isVideo && dlUrl && (
            <img
              src={dlUrl}
              alt="SITREP preview"
              className="w-full rounded border border-hud-border/50 object-cover"
              style={{ maxHeight: 140 }}
            />
          )}

          {/* Download */}
          {dlUrl && (
            <a href={dlUrl} download={dlName} className="hud-btn text-xs py-2 text-center w-full block">
              &#x2193; DOWNLOAD {dlName.split('.').pop().toUpperCase()}
            </a>
          )}

          {/* Social share grid */}
          <div>
            <div className="hud-title text-[10px] mb-2 opacity-70">SHARE</div>
            <div className="grid grid-cols-2 gap-2">
              {/* Native share â€” always first, shows WhatsApp/Telegram/etc sheet on mobile */}
              <button
                onClick={handleNativeShare}
                className="hud-btn text-xs py-2 text-center col-span-2"
              >
                &#x2197; Share file {isVideo ? '(video)' : '(image)'}
              </button>
              {/* Twitter — for video: also triggers download so user can attach the file */}
              <button
                onClick={handleTwitterShare}
                className="hud-btn text-xs py-2 text-center block"
                style={{ borderColor: '#1d9bf060', color: '#1d9bf0' }}
              >
                Twitter / X{isVideo ? ' ?' : ''}
              </button>
              {isVideo && (
                <div className="col-span-2 text-[9px] font-mono text-amber-300/80 text-center -mt-1">
                  ? downloading video — attach it to your tweet
                </div>
              )}
              {NETWORKS.map(n => (
                <a
                  key={n.id}
                  href={n.url()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hud-btn text-xs py-2 text-center block"
                  style={{ borderColor: n.color + '60', color: n.color }}
                >
                  {n.label}
                </a>
              ))}
            </div>
            {shareMsg && (
              <div className="text-hud-green text-[10px] font-mono text-center mt-2 break-all">{shareMsg}</div>
            )}
          </div>

          <button onClick={reset} className="text-hud-text text-xs font-mono hover:text-white transition-colors py-1 text-center w-full">
            &times; CLOSE
          </button>
        </div>
      </ModalOverlay>
    );
  }

  // â”€â”€ Menu modal â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (mode === 'menu') {
    return (
      <ModalOverlay onClose={() => setMode(null)}>
        <div className="hud-panel p-5 space-y-3" style={{ width: 'min(300px, calc(100vw - 32px))' }}>
          <div className="hud-title text-xs">&#x1F4F7; SITREP CAPTURE</div>
          <button onClick={takeScreenshot} className="w-full hud-btn text-xs py-2.5 text-center select-none">
            <span className="pointer-events-none">&#x1F4F8; SCREENSHOT (PNG)</span>
          </button>
          <button onClick={recordVideo} className="w-full hud-btn text-xs py-2.5 text-center select-none">
            <span className="pointer-events-none">&#x1F3AC; CINEMATIC VIDEO ({RECORD_SEC}s)</span>
          </button>
          <div className="text-hud-text text-[10px] font-mono opacity-60 text-center">
            UI is hidden during capture
          </div>
          <button onClick={() => setMode(null)} className="w-full text-hud-text text-xs font-mono hover:text-white transition-colors py-1 text-center">
            &times; Cancel
          </button>
        </div>
      </ModalOverlay>
    );
  }

  // â”€â”€ Default: trigger button â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  return (
    <button
      onClick={() => setMode('menu')}
      className={inline
        ? 'hud-btn text-xs px-3 py-2 font-bold select-none bg-[rgba(5,8,16,0.82)] backdrop-blur-sm hover:bg-[rgba(5,8,16,0.95)]'
        : 'fixed bottom-[172px] right-4 z-[51] hud-btn text-xs px-3 py-1.5 font-bold select-none bg-[rgba(5,8,16,0.82)] backdrop-blur-sm hover:bg-[rgba(5,8,16,0.95)]'
      }
      title="Generate SITREP — screenshot or video"
    >
      <span className="pointer-events-none">&#x1F4F7; SITREP</span>
    </button>
  );
}
