/**
 * download-mil-images.mjs
 *
 * Extracts every Wikimedia filename referenced in mediaLookup.js,
 * downloads the image at 400 px wide from Wikimedia Commons,
 * and saves it to  frontend/public/images/mil/
 *
 * Usage (from repo root):
 *   node scripts/download-mil-images.mjs
 *
 * After running, update the W() helper in mediaLookup.js to serve local files.
 */

import https from 'https';
import http  from 'http';
import fs    from 'fs';
import path  from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.join(__dirname, '..');
const MEDIA_FILE = path.join(REPO_ROOT, 'frontend/src/utils/mediaLookup.js');
const OUT_DIR    = path.join(REPO_ROOT, 'frontend/public/images/mil');

const WIDTH      = 400;   // px — matches the default in W()
const DELAY_MS   = 180;   // ms between requests — be polite to Wikimedia
const MAX_RETRY  = 3;

// ── Read all W('…') calls from mediaLookup.js ────────────────────────────────
const src = fs.readFileSync(MEDIA_FILE, 'utf8');
const matches = [...src.matchAll(/W\('([^']+)'/g)].map(m => m[1]);
const unique  = [...new Set(matches)];
console.log(`Found ${unique.length} unique Wikimedia filenames.`);

// ── Create output directory ───────────────────────────────────────────────────
fs.mkdirSync(OUT_DIR, { recursive: true });

// ── Helpers ───────────────────────────────────────────────────────────────────
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function buildWikimediaUrl(filename) {
  const encoded = encodeURIComponent(filename)
    .replace(/%28/g, '(').replace(/%29/g, ')').replace(/%2C/g, ',').replace(/%21/g, '!');
  return `https://commons.wikimedia.org/wiki/Special:FilePath/${encoded}?width=${WIDTH}`;
}

/**
 * Follow up to 10 redirects and return the final URL + response.
 */
function fetchFollowRedirects(url, redirectCount = 0) {
  return new Promise((resolve, reject) => {
    if (redirectCount > 10) return reject(new Error('Too many redirects'));
    const lib = url.startsWith('https') ? https : http;
    const req = lib.get(url, {
      headers: {
        'User-Agent': 'MilTrackerImageDownloader/1.0 (github.com/Adritrader/miltracker-3d)',
        'Accept': 'image/jpeg,image/png,image/webp,image/*',
      },
    }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        const next = res.headers.location.startsWith('http')
          ? res.headers.location
          : new URL(res.headers.location, url).href;
        resolve(fetchFollowRedirects(next, redirectCount + 1));
      } else {
        resolve(res);
      }
    });
    req.on('error', reject);
    req.setTimeout(20000, () => { req.destroy(); reject(new Error('Timeout')); });
  });
}

async function downloadFile(filename) {
  const localPath = path.join(OUT_DIR, filename);
  if (fs.existsSync(localPath) && fs.statSync(localPath).size > 1000) {
    return 'skip';
  }

  const url = buildWikimediaUrl(filename);
  let lastErr;

  for (let attempt = 1; attempt <= MAX_RETRY; attempt++) {
    try {
      const res = await fetchFollowRedirects(url);
      if (res.statusCode !== 200) {
        lastErr = new Error(`HTTP ${res.statusCode}`);
        res.resume();
        await sleep(500 * attempt);
        continue;
      }
      const ct = res.headers['content-type'] || '';
      if (!ct.startsWith('image/')) {
        lastErr = new Error(`Not an image: ${ct}`);
        res.resume();
        continue;
      }

      // Detect extension from Content-Type
      const ext = ct.includes('png') ? '.png' : ct.includes('webp') ? '.webp' : '.jpg';
      // If the filename has no extension, append one
      const finalName = /\.\w{2,4}$/.test(filename) ? filename : filename + ext;
      const finalPath = path.join(OUT_DIR, finalName);

      await new Promise((resolve, reject) => {
        const ws = fs.createWriteStream(finalPath);
        res.pipe(ws);
        ws.on('finish', resolve);
        ws.on('error', reject);
        res.on('error', reject);
      });

      // Verify size
      if (fs.statSync(finalPath).size < 500) {
        fs.unlinkSync(finalPath);
        lastErr = new Error('File too small (< 500 bytes)');
        continue;
      }

      return 'ok';
    } catch (e) {
      lastErr = e;
      await sleep(600 * attempt);
    }
  }
  throw lastErr;
}

// ── Main loop ─────────────────────────────────────────────────────────────────
let ok = 0, skipped = 0, failed = 0;
const failedList = [];

for (let i = 0; i < unique.length; i++) {
  const filename = unique[i];
  const pct = Math.round((i / unique.length) * 100);
  process.stdout.write(`\r[${String(i+1).padStart(3)}/${unique.length}] ${pct}% — ${filename.slice(0,60).padEnd(60)}`);

  try {
    const result = await downloadFile(filename);
    if (result === 'skip') skipped++; else ok++;
  } catch (e) {
    failed++;
    failedList.push({ filename, error: e.message });
    // write a placeholder so we don't retry forever on re-run
  }

  if (i < unique.length - 1) await sleep(DELAY_MS);
}

console.log('\n');
console.log(`✅ Downloaded : ${ok}`);
console.log(`⏭  Skipped    : ${skipped} (already exist)`);
console.log(`❌ Failed     : ${failed}`);

if (failedList.length) {
  console.log('\nFailed files:');
  failedList.forEach(f => console.log(`  ${f.filename}  →  ${f.error}`));
  fs.writeFileSync(
    path.join(__dirname, 'failed-images.json'),
    JSON.stringify(failedList, null, 2)
  );
  console.log('\nSaved to scripts/failed-images.json');
}

console.log(`\nImages saved to: ${OUT_DIR}`);
console.log('\nNext step: run  node scripts/patch-medialookup.mjs  to switch to local paths.');
