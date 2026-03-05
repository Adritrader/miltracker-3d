'use strict';
const fs = require('fs');
const path = require('path');

const ROOT   = path.join(__dirname, '..');
const LOOKUP = path.join(ROOT, 'frontend/src/utils/mediaLookup.js');
const IMGDIR = path.join(ROOT, 'frontend/public/images/mil');

let imgs = [];
try { imgs = fs.readdirSync(IMGDIR); } catch (e) { console.error('Cannot read img dir:', e.message); }
console.log('Local images:', imgs.length);

let src = fs.readFileSync(LOOKUP, 'utf8');

// If already patched, just update the _LOCAL Set contents
if (src.includes('/* LOCAL_IMAGES_v2 */')) {
  const setStart = src.indexOf('const _LOCAL = new Set(');
  const setEnd   = src.indexOf(');', setStart) + 2;
  if (setStart >= 0 && setEnd > 2) {
    const newSet = 'const _LOCAL = new Set(' + JSON.stringify(imgs) + ');';
    src = src.slice(0, setStart) + newSet + src.slice(setEnd);
    fs.writeFileSync(LOOKUP, src, 'utf8');
    console.log('Updated _LOCAL set — ' + imgs.length + ' images served locally.');
  } else {
    console.error('Cannot find _LOCAL set in patched file');
  }
  process.exit(0);
}

const s = src.indexOf('const W = (filename');
if (s < 0) { console.error('Cannot find W() start'); process.exit(1); }

const returnLINE = src.indexOf('https://commons', s);
const closeIdx   = src.indexOf('};\r\n', returnLINE);
// Fallback for LF-only files
const closeIdxLF = src.indexOf('};\n', returnLINE);
const useClose   = closeIdx >= 0 ? closeIdx + 4 : closeIdxLF + 3;
const e          = useClose;

console.log('Replacing bytes', s, '-', e);

// Build new W() — deliberately using concat, no template literals that could confuse
const setJson = JSON.stringify(imgs);
const newW = [
  '/* LOCAL_IMAGES_v2 */',
  'const _LOCAL = new Set(' + setJson + ');',
  '',
  'const W = (filename, w = 400) => {',
  "  if (_LOCAL.has(filename)) return '/images/mil/' + filename;",
  '  const encoded = encodeURIComponent(filename)',
  "    .replace(/%28/g, '(').replace(/%29/g, ')').replace(/%2C/g, ',').replace(/%21/g, '!');",
  "  return 'https://commons.wikimedia.org/wiki/Special:FilePath/' + encoded + '?width=' + w;",
  '};',
  '',
].join('\r\n');

const out = src.slice(0, s) + newW + src.slice(e);
fs.writeFileSync(LOOKUP, out, 'utf8');
console.log('Patched OK — ' + imgs.length + ' images served locally, rest via Wikimedia.');
