import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT   = join(dirname(fileURLToPath(import.meta.url)), '..');
const LOOKUP = join(ROOT, 'frontend/src/utils/mediaLookup.js');
const IMGDIR = join(ROOT, 'frontend/public/images/mil');

let downloaded = [];
try { downloaded = readdirSync(IMGDIR); } catch {}
console.log(`Local images: ${downloaded.size ?? downloaded.length}`);

let src = readFileSync(LOOKUP, 'utf8');

if (src.includes('/* LOCAL_IMAGES_v2 */')) {
  console.log('Already patched.'); process.exit(0);
}

const start = src.indexOf('const W = (filename');
const returnIdx = src.indexOf('return `https://commons', start);
const end = src.indexOf(';\n', returnIdx) + 2;
if (start < 0 || end < 2) { console.error('Cannot locate W() block'); process.exit(1); }

// Build replacement — use concat to avoid any escaping nightmares
const lines = [
  '/* LOCAL_IMAGES_v2 */',
  'const _LOCAL = new Set(' + JSON.stringify(downloaded) + ');',
  '',
  'const W = (filename, w = 400) => {',
  '  if (_LOCAL.has(filename)) return `/images/mil/${filename}`;',
  "  const encoded = encodeURIComponent(filename)",
  "    .replace(/%28/g, '(').replace(/%29/g, ')').replace(/%2C/g, ',').replace(/%21/g, '!');",
  "  return `https://commons.wikimedia.org/wiki/Special:FilePath/${encoded}?width=${w}`;",
  '};',
];
const newW = lines.join('\r\n') + '\r\n';

src = src.slice(0, start) + newW + src.slice(end);
writeFileSync(LOOKUP, src, 'utf8');
console.log(`Done — ${downloaded.length} files served locally, rest via Wikimedia.`);
