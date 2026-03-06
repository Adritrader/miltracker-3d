import { readFileSync, writeFileSync } from 'fs';

const file = new URL('../frontend/src/components/SitrepCapture.jsx', import.meta.url);
let txt = readFileSync(file, 'utf8');
let changed = 0;

// 1. Add handleTwitterShare before reset
const A_OLD = `  const reset = useCallback(() => {`;
const A_NEW = `  // Twitter: for video, auto-download + open Twitter compose so user can attach
  const handleTwitterShare = useCallback(() => {
    const tweetUrl = \`https://twitter.com/intent/tweet?text=\${encodeURIComponent(SHARE_TEXT)}&url=\${encodeURIComponent(PAGE_URL())}\`;
    window.open(tweetUrl, '_blank', 'noopener,noreferrer');
    // If it's a video, also trigger the download so user can attach it to the tweet
    if (captureType === 'video' && dlUrl) {
      const a = document.createElement('a');
      a.href = dlUrl;
      a.download = dlName;
      a.click();
    }
  }, [captureType, dlUrl, dlName]);

  const reset = useCallback(() => {`;

if (txt.includes(A_OLD)) { txt = txt.replace(A_OLD, A_NEW); changed++; }
else console.warn('WARN: anchor A not found');

// 2. Replace NETWORKS.map block in the done modal grid with Twitter button + note + rest
const B_OLD = `              {NETWORKS.map(n => (
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
              ))}`;
const B_NEW = `              {/* Twitter — for video: also triggers download so user can attach the file */}
              <button
                onClick={handleTwitterShare}
                className="hud-btn text-xs py-2 text-center block"
                style={{ borderColor: '#1d9bf060', color: '#1d9bf0' }}
              >
                Twitter / X{isVideo ? ' \u2193' : ''}
              </button>
              {isVideo && (
                <div className="col-span-2 text-[9px] font-mono text-amber-300/80 text-center -mt-1">
                  \u2191 descargando video &mdash; adjúntalo al tweet
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
              ))}`;

if (txt.includes(B_OLD)) { txt = txt.replace(B_OLD, B_NEW); changed++; }
else console.warn('WARN: anchor B not found');

writeFileSync(file, txt, 'utf8');
console.log(`Done — ${changed}/2 replacements applied`);
