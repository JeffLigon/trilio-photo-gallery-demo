// Build-time fetcher: downloads hero images for each entry and writes db/seed.sql
// Requires Node 18+ (global fetch). Internet access at build-time.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const seedsPath = path.join(root, 'seed-sources.json');
const mediaDir = path.join(root, 'public', 'media');
const outSql = path.join(root, 'db', 'seed.sql');

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0, 40);
const extFromCT = (ct, url) => {
  if (ct?.includes('image/webp')) return 'webp';
  if (ct?.includes('image/jpeg')) return 'jpg';
  if (ct?.includes('image/png')) return 'png';
  const m = url && url.match(/\.(webp|jpg|jpeg|png)(?:\?|$)/i);
  return m ? m[1].toLowerCase().replace('jpeg','jpg') : 'jpg';
};

async function getOgImage(u) {
  const res = await fetch(u, { redirect: 'follow' });
  const html = await res.text();
  let m = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i);
  if (m) return m[1];
  m = html.match(/<img[^>]+src=["']([^"']+)["']/i);
  if (m) return m[1];
  throw new Error('No image found for ' + u);
}

const raw = await fs.readFile(seedsPath, 'utf8');
const seeds = JSON.parse(raw).slice(0, 12);

await fs.mkdir(mediaDir, { recursive: true });

const rows = [];
let i = 1;
for (const e of seeds) {
  try {
    const imgUrl = await getOgImage(e.url);
    const head = await fetch(imgUrl, { method: 'HEAD' }).catch(()=>null);
    const ct = head?.headers.get('content-type') || '';
    const ext = extFromCT(ct, imgUrl);
    const fname = `blog-${String(i).padStart(2, '0')}-${slug(e.title)}.${ext}`;
    const dest = path.join(mediaDir, fname);

    const imgRes = await fetch(imgUrl);
    const buf = Buffer.from(await imgRes.arrayBuffer());
    await fs.writeFile(dest, buf);
    const stat = await fs.stat(dest);

    rows.push({ title: e.title, caption: e.caption, filename: fname, size: stat.size });
    console.log(`✓ ${e.title} → ${fname} (${Math.round(stat.size/1024)} KB)`);
    i++;
  } catch (err) {
    console.error('×', e.title, err.message);
  }
}

// Write seed SQL matching schema (filename column)
const lines = ['DELETE FROM photos;'];
for (const r of rows) {
  lines.push(
    "INSERT INTO photos (title, caption, filename, size_bytes) VALUES (" +
    [JSON.stringify(r.title), JSON.stringify(r.caption), JSON.stringify(r.filename), r.size].join(', ') +
    ");"
  );
}
await fs.mkdir(path.join(root, 'db'), { recursive: true });
await fs.writeFile(outSql, lines.join('\n') + '\n', 'utf8');
console.log('Wrote', outSql, 'with', rows.length, 'rows');
