/**
 * Downloads the 59 images referenced in mediaLookup.js but not yet local.
 * Reads scripts/missing59.json, fetches each from Wikimedia Commons.
 */
import fs from 'fs';
import path from 'path';
import https from 'https';

const OUT_DIR = path.resolve('frontend/public/images/mil');
const list = JSON.parse(fs.readFileSync('scripts/missing59.json', 'utf8'));

const HEADERS = {
  'User-Agent': 'miltracker-image-bot/1.0 (https://github.com/Adritrader/miltracker-3d)',
};

function download(filename) {
  return new Promise((resolve) => {
    const dest = path.join(OUT_DIR, filename);
    if (fs.existsSync(dest)) { console.log(`  SKIP (exists): ${filename}`); resolve('skip'); return; }

    const encoded = encodeURIComponent(filename)
      .replace(/%28/g, '(').replace(/%29/g, ')').replace(/%2C/g, ',').replace(/%21/g, '!');
    const url = `https://commons.wikimedia.org/wiki/Special:FilePath/${encoded}?width=600`;

    const file = fs.createWriteStream(dest);
    const req = https.get(url, { headers: HEADERS }, (res) => {
      // Follow redirect (Wikimedia returns 302)
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        file.close();
        fs.unlink(dest, () => {});
        const redir = res.headers.location;
        const redirFile = fs.createWriteStream(dest);
        https.get(redir, { headers: HEADERS }, (res2) => {
          if (res2.statusCode !== 200) {
            redirFile.close(); fs.unlink(dest, () => {});
            console.log(`  FAIL (${res2.statusCode}): ${filename}`);
            resolve('fail'); return;
          }
          res2.pipe(redirFile);
          redirFile.on('finish', () => { redirFile.close(); console.log(`  OK: ${filename}`); resolve('ok'); });
          redirFile.on('error', () => { fs.unlink(dest, () => {}); console.log(`  ERR: ${filename}`); resolve('fail'); });
        }).on('error', () => { fs.unlink(dest, () => {}); console.log(`  ERR (net): ${filename}`); resolve('fail'); });
        return;
      }
      if (res.statusCode !== 200) {
        file.close(); fs.unlink(dest, () => {});
        console.log(`  FAIL (${res.statusCode}): ${filename}`);
        resolve('fail'); return;
      }
      res.pipe(file);
      file.on('finish', () => { file.close(); console.log(`  OK: ${filename}`); resolve('ok'); });
      file.on('error', () => { fs.unlink(dest, () => {}); console.log(`  ERR: ${filename}`); resolve('fail'); });
    });
    req.on('error', () => { fs.unlink(dest, () => {}); console.log(`  ERR (net): ${filename}`); resolve('fail'); });
    req.setTimeout(15000, () => { req.destroy(); fs.unlink(dest, () => {}); console.log(`  TIMEOUT: ${filename}`); resolve('fail'); });
  });
}

console.log(`Downloading ${list.length} missing images...\n`);
const results = { ok: 0, skip: 0, fail: [] };

// Download 4 at a time
for (let i = 0; i < list.length; i += 4) {
  const batch = list.slice(i, i + 4);
  const batchResults = await Promise.all(batch.map(download));
  batchResults.forEach((r, j) => {
    if (r === 'ok') results.ok++;
    else if (r === 'skip') results.skip++;
    else results.fail.push(batch[j]);
  });
  // Small delay between batches to be polite to Wikimedia
  await new Promise(r => setTimeout(r, 500));
}

console.log(`\n=== DONE ===`);
console.log(`Downloaded: ${results.ok}`);
console.log(`Skipped (existed): ${results.skip}`);
console.log(`Failed: ${results.fail.length}`);
if (results.fail.length > 0) {
  console.log('\nFailed files:');
  results.fail.forEach(f => console.log(' ', f));
  fs.writeFileSync('scripts/missing59-failed.json', JSON.stringify(results.fail, null, 2));
}
