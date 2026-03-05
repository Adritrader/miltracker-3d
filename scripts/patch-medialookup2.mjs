/**
 * patch-medialookup2.mjs
 * Rewrites the W() helper in mediaLookup.js to serve local /images/mil/ files
 * first, falling back to Wikimedia Commons for anything not downloaded.
 */
import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT   = join(dirname(fileURLToPath(import.meta.url)), '..');
const LOOKUP = join(ROOT, 'frontend/src/utils/mediaLookup.js');
const IMGDIR = join(ROOT, 'frontend/public/images/mil');

// Build set of filenames that were actually downloaded
let downloaded;
try {
  downloaded = new Set(readdirSync(IMGDIR));
} catch {
  downloaded = new Set();
}
console.log(`Local images available: ${downloaded.size}`);

let src = readFileSync(LOOKUP, 'utf8');

// Guard against double-patching
if (src.includes('/* LOCAL_IMAGES_v2 */')) {
  console.log('Already patched — nothing to do.');
  process.exit(0);
}

// Build the new W() helper as a multi-line string (no template literals to avoid confusion)
const NEW_W = [
  '/* LOCAL_IMAGES_v2 */',
  'const DOWNLOADED_LOCAL = new Set(' + JSON.stringify([...downloaded]) + ');',
  '',
  'const W = (filename, w = 400) => {',
  '  if (DOWNLOADED_LOCAL.has(filename)) return `/images/mil/${filename}`;',
  '  // Fallback to Wikimedia for files not yet downloaded',
  '  const encoded = encodeURIComponent(filename)',
  "    .replace(/%28/g, '(').replace(/%29/g, ')').replace(/%2C/g, ',').replace(/%21/g, '!');",
  '  return `https://commons.wikimedia.org/wiki/Special:FilePath/${encoded}?width=${w}`;',
  '};',
].join('\n');

// Replace the original W() block — match from "const W = " to the closing "};"
// Use a regex that tolerates any whitespace / comment variations
const OLD_W_RE = /\/\*\*[\s\S]*?\*\/\s*\nconst W = \(filename[\s\S]*?\n\};\n/;
const simpleRE = /const W = \(filename[\s\S]*?\n\};\n/;

let replaced = false;
if (simpleRE.test(src)) {
  src = src.replace(simpleRE, NEW_W + '\n');
  replaced = true;
}

if (!replaced) {
  // Last-resort: insert after the closing comment block at the top
  const insertAfter = '*/\n\n';
  const idx = src.indexOf(insertAfter);
  if (idx !== -1) {
    src = src.slice(0, idx + insertAfter.length) + NEW_W + '\n\n' + src.slice(idx + insertAfter.length);
    replaced = true;
    console.log('Used fallback insertion after header comment.');
  }
}

if (!replaced) {
  console.error('ERROR: Could not find insertion point. Aborting.');
  process.exit(1);
}

writeFileSync(LOOKUP, src, 'utf8');
console.log(`Done — W() now serves ${downloaded.size} images locally, rest fall back to Wikimedia.`);
