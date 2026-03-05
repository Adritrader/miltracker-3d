/**
 * fix-failed-images.mjs
 * For each filename in failed-images.json:
 *   1. Query Wikimedia API for the 400px thumbnail URL (handles redirects / existence)
 *   2. Download if found
 *   3. If not found, try a fuzzy text search on Wikimedia Commons and download best hit
 * After all downloads, re-runs patch-ml.cjs to update W() set.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { createWriteStream } from 'fs';
import https from 'https';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const ROOT    = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const IMGDIR  = path.join(ROOT, 'frontend/public/images/mil');
const FAILED  = path.join(ROOT, 'scripts/failed-images.json');
const DELAY   = 300; // ms between requests — be polite to Wikimedia
const UA      = 'miltracker-image-fetcher/1.0 (https://github.com/Adritrader/miltracker-3d)';

mkdirSync(IMGDIR, { recursive: true });

const failed = JSON.parse(readFileSync(FAILED, 'utf8'));
console.log(`\nFixing ${failed.length} failed images...\n`);

const sleep = ms => new Promise(r => setTimeout(r, ms));

function fetch(url) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    const req = mod.get(url, {
      headers: {
        'User-Agent': UA,
        'Accept': 'application/json',
      },
      timeout: 20000,
    }, res => {
      // Follow redirects
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetch(res.headers.location).then(resolve).catch(reject);
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    const req = mod.get(url, { headers: { 'User-Agent': UA }, timeout: 30000 }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return downloadFile(res.headers.location, dest).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) { reject(new Error(`HTTP ${res.statusCode}`)); return; }
      const out = createWriteStream(dest);
      res.pipe(out);
      out.on('finish', () => { out.close(); resolve(); });
      out.on('error', reject);
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

/** Query Wikimedia API for a file's 400px URL. Returns url string or null. */
async function getWikimediaUrl(filename) {
  const encoded = encodeURIComponent('File:' + filename);
  const apiUrl  = `https://commons.wikimedia.org/w/api.php?action=query&prop=imageinfo&iiprop=url&iiurlwidth=400&titles=${encoded}&format=json&formatversion=2`;
  try {
    const res = await fetch(apiUrl);
    if (res.status !== 200) return null;
    const json = JSON.parse(res.body);
    const pages = json?.query?.pages;
    if (!pages || pages.length === 0) return null;
    const page = pages[0];
    if (page.missing) return null;
    return page.imageinfo?.[0]?.thumburl ?? page.imageinfo?.[0]?.url ?? null;
  } catch { return null; }
}

/** Search Wikimedia Commons for best hit and return its 400px URL. */
async function searchWikimedia(query) {
  // Remove file extension from query, replace _ with space
  const q = query.replace(/\.[^.]+$/, '').replace(/_/g, ' ');
  const apiUrl = `https://commons.wikimedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(q + ' filetype:bitmap')}&srnamespace=6&srlimit=3&format=json&formatversion=2`;
  try {
    const res = await fetch(apiUrl);
    if (res.status !== 200) return null;
    const json = JSON.parse(res.body);
    const results = json?.query?.search;
    if (!results || results.length === 0) return null;
    // Use first result — get the file's imageinfo
    const title = results[0].title; // e.g. "File:F-35A something.jpg"
    const encoded = encodeURIComponent(title);
    const infoUrl = `https://commons.wikimedia.org/w/api.php?action=query&prop=imageinfo&iiprop=url&iiurlwidth=400&titles=${encoded}&format=json&formatversion=2`;
    const res2 = await fetch(infoUrl);
    if (res2.status !== 200) return null;
    const json2 = JSON.parse(res2.body);
    const page  = json2?.query?.pages?.[0];
    return page?.imageinfo?.[0]?.thumburl ?? page?.imageinfo?.[0]?.url ?? null;
  } catch { return null; }
}

const stillFailed = [];
let downloadedCount = 0;

for (let i = 0; i < failed.length; i++) {
  const { filename } = failed[i];
  const dest = path.join(IMGDIR, filename);

  // Skip if already downloaded successfully
  if (existsSync(dest)) {
    try { if (readFileSync(dest).length > 1000) { console.log(`  SKIP ${filename}`); continue; } } catch {}
  }

  const pct = Math.round((i / failed.length) * 100);
  process.stdout.write(`[${String(i+1).padStart(3)}/${failed.length}] ${pct}% — ${filename.slice(0,60)}\r`);

  // 1. Try exact filename via Wikimedia API
  let url = await getWikimediaUrl(filename);
  await sleep(DELAY);

  // 2. If not found, search by filename as query
  if (!url) {
    url = await searchWikimedia(filename);
    await sleep(DELAY);
  }

  if (url) {
    try {
      await downloadFile(url, dest);
      const size = readFileSync(dest).length;
      if (size < 1000) { writeFileSync(dest, Buffer.alloc(0)); stillFailed.push(filename); console.log(`\n  TINY  ${filename} (${size}b)`); }
      else { downloadedCount++; console.log(`\n  OK    ${filename} (${Math.round(size/1024)}kb)`); }
    } catch (e) {
      stillFailed.push(filename);
      console.log(`\n  FAIL  ${filename} — ${e.message}`);
    }
  } else {
    stillFailed.push(filename);
    console.log(`\n  404   ${filename} (not on Wikimedia Commons)`);
  }

  await sleep(DELAY);
}

console.log(`\n\nDownloaded: ${downloadedCount} / ${failed.length}`);
console.log(`Still failing: ${stillFailed.length}`);
writeFileSync(path.join(ROOT, 'scripts/still-failed.json'), JSON.stringify(stillFailed.map(f => ({ filename: f })), null, 2));

// Re-run patch to update _LOCAL set in mediaLookup.js
console.log('\nPatching mediaLookup.js...');
try {
  execSync('node scripts/patch-ml.cjs', { cwd: ROOT, stdio: 'inherit' });
} catch (e) {
  console.error('Patch failed:', e.message);
}
console.log('Done.');
