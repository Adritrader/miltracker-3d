/**
 * patch-medialookup.mjs
 *
 * After running download-mil-images.mjs, run this to update
 * frontend/src/utils/mediaLookup.js so the W() helper serves
 * images from /images/mil/ instead of Wikimedia Commons.
 *
 * Usage (from repo root):
 *   node scripts/patch-medialookup.mjs
 *
 * Safe to run multiple times (idempotent).
 */

import fs   from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT  = path.join(__dirname, '..');
const MEDIA_FILE = path.join(REPO_ROOT, 'frontend/src/utils/mediaLookup.js');
const OUT_DIR    = path.join(REPO_ROOT, 'frontend/public/images/mil');

const src = fs.readFileSync(MEDIA_FILE, 'utf8');

// Check if already patched
if (src.includes('/* LOCAL_IMAGES */')) {
  console.log('mediaLookup.js already patched — nothing to do.');
  process.exit(0);
}

// Which filenames were actually downloaded?
const downloaded = new Set(
  fs.existsSync(OUT_DIR) ? fs.readdirSync(OUT_DIR) : []
);

// Replace the W() helper with a local-first version:
//   - if the file exists in /images/mil/<filename> → serve it locally
//   - otherwise fall back to Wikimedia (graceful degradation)
const OLD_W = `const W = (filename, w = 400) => {
  // encodeURIComponent over-encodes () which breaks Wikimedia lookup — keep them literal
  const encoded = encodeURIComponent(filename)
    .replace(/%28/g, '(').replace(/%29/g, ')').replace(/%2C/g, ',').replace(/%21/g, '!');
  return \`https://commons.wikimedia.org/wiki/Special:FilePath/\${encoded}?width=\${w}\`;
};`;

const NEW_W = `/* LOCAL_IMAGES */
// Images served from /images/mil/ (downloaded by scripts/download-mil-images.mjs).
// Falls back to Wikimedia Commons for any file not yet downloaded.
const DOWNLOADED = new Set(${JSON.stringify([...downloaded])});

const W = (filename, w = 400) => {
  // Use local copy if available
  if (DOWNLOADED.has(filename)) return \`/images/mil/\${filename}\`;
  // Fallback: Wikimedia Commons
  const encoded = encodeURIComponent(filename)
    .replace(/%28/g, '(').replace(/%29/g, ')').replace(/%2C/g, ',').replace(/%21/g, '!');
  return \`https://commons.wikimedia.org/wiki/Special:FilePath/\${encoded}?width=\${w}\`;
};`;

if (!src.includes(OLD_W.slice(0, 60))) {
  console.error('ERROR: Could not find the W() function — mediaLookup.js may have changed. Patch aborted.');
  process.exit(1);
}

const patched = src.replace(OLD_W, NEW_W);
fs.writeFileSync(MEDIA_FILE, patched, 'utf8');

console.log(`✅ mediaLookup.js patched — ${downloaded.size} local images mapped.`);
console.log('   Rebuild the frontend to pick up the change: cd frontend && npm run build');
