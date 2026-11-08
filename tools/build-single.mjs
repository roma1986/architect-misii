// Збирає гру в один файл dist/architect-misii.html (дані, стилі й код усередині).
// Зручно надіслати журі чи вчителю або відкрити без сервера.
// Потрібно один раз: npm install
// Увага: заміни робимо функціями, бо в коді є символи «$'», які String.replace трактує як шаблон.
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs/promises';
import { build } from 'esbuild';
import { loadDataNode } from './node-data.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const data = await loadDataNode(path.join(root, 'data'));
const res = await build({ entryPoints: [path.join(root, 'js/app.js')], bundle: true, format: 'iife', write: false, target: 'es2020' });
const js = res.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const css = await fs.readFile(path.join(root, 'style.css'), 'utf8');
let html = await fs.readFile(path.join(root, 'index.html'), 'utf8');
html = html
  .replace('<link rel="stylesheet" href="style.css">', () => `<style>\n${css}\n</style>`)
  .replace('<script type="module" src="js/app.js"></script>',
    () => `<script>window.__GAME_DATA__ = ${JSON.stringify(data).replace(/</g, '\\u003c')};</script>\n<script>\n${js}\n</script>`);
await fs.mkdir(path.join(root, 'dist'), { recursive: true });
await fs.writeFile(path.join(root, 'dist', 'architect-misii.html'), html);
console.log(`Готово: dist/architect-misii.html (${Math.round(html.length / 1024)} КБ)`);
