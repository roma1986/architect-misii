// Таблиця для звірки чисел із джерелами: кожне число з data/*.json одним рядком.
// Запуск: node tools/sources-checklist.mjs  →  tools/out/perevirka-danykh.csv (відкривається в Excel і Google Таблицях)
// Порядок роботи: відкрийте посилання з колонки «Джерело», впишіть правильне значення, поставте «так»,
// а потім виправте число у відповідному JSON і запустіть npm run check та npm run balance.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadDataNode } from './node-data.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const d = await loadDataNode(path.join(here, '..', 'data'));
const rows = [];
const name = (x) => (typeof x === 'object' && x ? x.uk || Object.values(x)[0] : x) || '';
const add = (file, obj, field, value, unit, priority = '') => {
  if (value === undefined || value === null) return;
  const ok = obj.verified && obj.verified.fields && obj.verified.fields.some((f) => field.startsWith(f));
  rows.push([file, obj.id, name(obj.name), field, value, unit, obj.prototype || '', obj.source || '', priority, ok ? 'так' : '', ok ? `${obj.verified.note} ${(obj.verified.urls || []).join(' ')}` : '', obj.simplified || '']);
};

for (const t of d.targets) {
  add('targets.json', t, 'sun_au', t.sun_au, 'а.о.');
  add('targets.json', t, 'period_days', t.period_days, 'діб');
  add('targets.json', t, 'flight_days', t.flight_days, 'діб', 'важливо');
  add('targets.json', t, 'k_capacity', t.k_capacity, 'частка від маси на низьку орбіту', 'важливо');
  add('targets.json', t, 'dv_capture_kms', t.dv_capture_kms, 'км/с');
  if (t.window) {
    add('targets.json', t, 'window.ref (дата найкращого вікна)', t.window.ref, 'дата', 'важливо');
    add('targets.json', t, 'window.synodic_days', t.window.synodic_days, 'діб');
  }
  if (t.landing?.edl_factor) add('targets.json', t, 'landing.edl_factor', t.landing.edl_factor, '× маси апарата');
  for (const s of t.sites) add('targets.json', { ...s, source: t.source }, `site ${s.id}: lat, lon`, `${s.lat}, ${s.lon}`, '°');
}
for (const r of d.rockets) {
  add('rockets.json', r, 'leo_kg', r.leo_kg, 'кг', 'важливо');
  for (const [k, v] of Object.entries(r.to_kg || {})) add('rockets.json', r, `to_kg.${k}`, v, 'кг', 'важливо');
  add('rockets.json', r, 'cost_musd', r.cost_musd, 'млн $');
  add('rockets.json', r, 'flights / successes', `${r.flights} / ${r.successes}`, 'польотів', 'важливо');
}
const C = d.components;
for (const [group, list] of Object.entries(C)) {
  for (const x of list) {
    add('components.json', x, 'mass_kg', x.mass_kg, 'кг', ['solar_xl', 'sar', 'radiation_vault'].includes(x.id) ? 'важливо' : '');
    add('components.json', x, 'power_w', x.power_w, 'Вт');
    add('components.json', x, 'p1au_w', x.p1au_w, 'Вт біля Землі');
    add('components.json', x, 'p0_w', x.p0_w, 'Вт', 'важливо');
    add('components.json', x, 'cost_musd', x.cost_musd, 'млн $');
    add('components.json', x, 'rate_1au_mbps', x.rate_1au_mbps, 'Мбіт/с на 1 а.о.');
    add('components.json', x, 'relay_mbit_per_day', x.relay_mbit_per_day, 'Мбіт/добу');
    add('components.json', x, 'data_mbit_per_day', x.data_mbit_per_day, 'Мбіт/добу');
    void group;
  }
}
for (const m of d.missions) {
  const o = { ...m, name: m.name };
  add('missions.json', o, 'year', m.year, 'рік');
  add('missions.json', o, 'launch_mass_kg', m.launch_mass_kg, 'кг', 'важливо');
  add('missions.json', o, 'craft_mass_kg', m.craft_mass_kg, 'кг');
  add('missions.json', o, 'cost_musd', m.cost_musd, 'млн $');
  add('missions.json', o, 'instruments', m.instruments, 'шт.');
}
const col = d.colony;
add('colony.json', { id: 'moxie', name: 'MOXIE', source: col.moxie.source, verified: col.moxie.verified ? { fields: ['o2'], note: col.moxie.verified } : null }, 'o2_g_per_h / power_w / mass_kg', `${col.moxie.o2_g_per_h} / ${col.moxie.power_w} / ${col.moxie.mass_kg}`, 'г/год, Вт, кг', 'важливо');
add('colony.json', { id: 'needs', name: 'Потреби експедиції', source: col.needs.source }, 'ascent_o2_t / crew_o2_t_per_year', `${col.needs.ascent_o2_t} / ${col.needs.crew_o2_t_per_year}`, 'т', 'важливо');
add('colony.json', { id: 'kilopower', name: 'Kilopower', source: col.power.reactor_source, verified: col.power.verified ? { fields: ['reactor'], note: col.power.verified, urls: [col.power.verified_url] } : null }, 'reactor_w / reactor_kg', `${col.power.reactor_w} / ${col.power.reactor_kg}`, 'Вт, кг', 'важливо');

const head = ['Файл', 'id', 'Назва', 'Поле', 'Значення в грі', 'Одиниці', 'Прототип', 'Джерело', 'Пріоритет', 'Перевірено (так/ні)', 'Правильне значення', 'Спрощення в грі'];
const csv = (v) => `"${String(v).replace(/"/g, '""')}"`;
const out = '\ufeff' + [head, ...rows].map((r) => r.map(csv).join(',')).join('\n');
await fs.mkdir(path.join(here, 'out'), { recursive: true });
await fs.writeFile(path.join(here, 'out', 'perevirka-danykh.csv'), out);
console.log(`Записано ${rows.length} рядків у tools/out/perevirka-danykh.csv (${rows.filter((r) => r[8]).length} позначено «важливо»).`);
