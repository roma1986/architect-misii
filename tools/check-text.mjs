// Перевірка текстів: кодування, апострофи, російські літери, змішані алфавіти,
// нерозривні пробіли в SVG і CSS. Запуск: node tools/check-text.mjs (входить у npm run verify).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const SKIP = new Set(['node_modules', 'dist', '.git', 'out']);
const EXT = new Set(['.js', '.mjs', '.json', '.html', '.css', '.md']);
const files = [];
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(e.name)) continue;
    const p = path.join(dir, e.name);
    if (p === fileURLToPath(import.meta.url)) continue; // у цьому файлі самі шаблони пошуку
    if (e.isDirectory()) walk(p); else if (EXT.has(path.extname(e.name))) files.push(p);
  }
})(root);

const CY = 'А-ЯҐЄІЇа-яґєії';
const NB = '\u00a0';
const rules = [
  ['не UTF-8 або «кракозябри»', /\ufffd|Ð.|Ñ.|â€/],
  ['російська літера (ы, э, ъ, ё)', /[ыэъёЫЭЪЁ]/],
  ['прямий апостроф між літерами (потрібен ’)', new RegExp(`[${CY}]\\\\?'[${CY}]`)],
  ['слово зі змішаними алфавітами', new RegExp(`(?<![\\\\\\w])(?:[A-Za-z]+[${CY}]+|[${CY}]+[A-Za-z]+)`)],
  ['нерозривний пробіл у числових атрибутах SVG/CSS', new RegExp(`(?:viewBox|points|transform|style)="[^"]*${NB}`)],
  ['нерозривний пробіл у даних SVG-контуру d="…"', new RegExp(`\\sd="[^"]*${NB}`)],
];
let bad = 0;
for (const p of files) {
  const raw = fs.readFileSync(p);
  const text = raw.toString('utf8');
  if (raw.length !== Buffer.byteLength(text, 'utf8')) { console.log(`${path.relative(root, p)}: не UTF-8`); bad++; continue; }
  text.split('\n').forEach((line, i) => {
    for (const [name, rx] of rules) {
      const m = line.match(rx);
      if (m) { console.log(`${path.relative(root, p)}:${i + 1}: ${name}: «${m[0].replace(NB, '␣')}»`); bad++; }
    }
  });
}
if (bad) { console.log(`\nЗнайдено проблем: ${bad}`); process.exit(1); }
console.log(`Тексти в порядку (${files.length} файлів).`);
