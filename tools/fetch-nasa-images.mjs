// Завантажує фото NASA: для підсумку, глобальні карти для вибору майданчика
// і фото кожного елемента, який можна обрати (мініатюри й вікно «Детальніше»).
// Запуск (потрібен інтернет, Node 18+):  node tools/fetch-nasa-images.mjs [--force]
// Джерело: NASA Image and Video Library API (https://images.nasa.gov), без ключа.
// Скрипт бере перший підхожий результат пошуку; щоб обрати інший, впишіть "nasa_id" у data/media.json.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const mediaPath = path.join(root, 'data', 'media.json');
const force = process.argv.includes('--force');
const API = 'https://images-api.nasa.gov';

const media = JSON.parse(await fs.readFile(mediaPath, 'utf8'));
const photosPath = path.join(root, 'data', 'photos.json');
const photos = JSON.parse(await fs.readFile(photosPath, 'utf8'));
const exists = (f) => fs.access(path.join(root, f)).then(() => true, () => false);

async function getJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json();
}

async function search(query) {
  const j = await getJson(`${API}/search?q=${encodeURIComponent(query)}&media_type=image`);
  return (j.collection?.items || []).slice(0, 12).map((it) => ({ id: it.data?.[0]?.nasa_id, data: it.data?.[0] || {} })).filter((x) => x.id);
}

async function assetUrl(id) {
  const j = await getJson(`${API}/asset/${encodeURIComponent(id)}`);
  const urls = (j.collection?.items || []).map((x) => x.href).filter((h) => /\.(jpe?g|png)$/i.test(h));
  return ['~large', '~medium', '~orig', ''].map((s) => urls.find((u) => u.includes(`${s}.`))).find(Boolean);
}

/** Розмір JPEG/PNG без сторонніх бібліотек. */
export function imageSize(buf) {
  if (buf[0] === 0x89 && buf[1] === 0x50) return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
  let i = 2;
  while (i < buf.length) {
    if (buf[i] !== 0xff) { i++; continue; }
    const marker = buf[i + 1];
    const len = buf.readUInt16BE(i + 2);
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) return { h: buf.readUInt16BE(i + 5), w: buf.readUInt16BE(i + 7) };
    i += 2 + len;
  }
  return null;
}

function credit(d) {
  return d.secondary_creator || d.photographer || (d.center ? `NASA/${d.center}` : 'NASA');
}

async function fetchItem(item) {
  if (!force && await exists(item.file)) { console.log(`= ${item.file} уже є`); return; }
  let candidates;
  try {
    candidates = item.nasa_id ? [{ id: item.nasa_id, data: {} }] : await search(item.query);
  } catch (e) {
    console.log(`! ${item.file}: пошук не вдався (${e.message}). Перевірте інтернет.`);
    return;
  }
  for (const c of candidates) {
    try {
      const url = await assetUrl(c.id);
      if (!url) continue;
      const res = await fetch(url.replace(/^http:/, 'https:'));
      if (!res.ok) continue;
      const buf = Buffer.from(await res.arrayBuffer());
      const size = imageSize(buf);
      if (item.aspect && (!size || Math.abs(size.w / size.h - item.aspect) > 0.15)) continue; // карта має бути 2:1
      if (buf.length > (item.maxBytes || 6_000_000)) continue; // не роздуваємо репозиторій
      await fs.mkdir(path.dirname(path.join(root, item.file)), { recursive: true });
      await fs.writeFile(path.join(root, item.file), buf);
      Object.assign(item, { nasa_id: c.id, title: c.data.title || item.title, credit: c.data.title ? credit(c.data) : item.credit, url: `https://images.nasa.gov/details/${c.id}` });
      console.log(`+ ${item.file} ← ${c.id} (${size ? `${size.w}×${size.h}` : '?'}, ${Math.round(buf.length / 1024)} КБ)`);
      return;
    } catch (e) {
      console.log(`  пропуск ${c.id}: ${e.message}`);
    }
  }
  console.log(`! ${item.file}: не знайдено підхожого зображення за запитом «${item.query}». Знайдіть вручну: ${item.search || `https://images.nasa.gov/search?q=${encodeURIComponent(item.query)}`}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    for (const item of [...media.items, ...(media.maps || [])]) await fetchItem(item);
    // Фото для мініатюр і вікна «Детальніше»: усе, що обирається в грі
    for (const [id, item] of Object.entries(photos)) {
      if (id.startsWith('_') || item.skip) continue;
      item.file = item.file || `img/items/${id}.jpg`;
      item.maxBytes = 2_500_000;
      await fetchItem(item);
      delete item.maxBytes;
      await fs.writeFile(photosPath, JSON.stringify(photos, null, 2));
    }
  } catch (e) {
    console.error(`Помилка: ${e.message}. Перевірте інтернет.`);
  }
  await fs.writeFile(mediaPath, JSON.stringify(media, null, 2));
  // Записуємо file лише для тих фото, що справді завантажено
  for (const [id, item] of Object.entries(photos)) {
    if (!id.startsWith('_') && item.file && !(await exists(item.file))) delete item.file;
  }
  await fs.writeFile(photosPath, JSON.stringify(photos, null, 2));
  console.log('\nГотово. Перегляньте картинки в img/: якщо якась не підходить, впишіть інший nasa_id у data/media.json і запустіть з --force.');
}
