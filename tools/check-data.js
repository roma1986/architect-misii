// Перевірка даних перед комітом: унікальні id, обов’язкові поля, джерела, ваги для всіх завдань.
// Запуск: node tools/check-data.js
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { loadDataNode } from './node-data.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const d = await loadDataNode(path.join(here, '..', 'data'));
const problems = [];
const need = (cond, msg) => { if (!cond) problems.push(msg); };

const REQUIRED = {
  platforms: ['id', 'type', 'name', 'mass_kg', 'cost_musd', 'bus_power_w', 'slots', 'ops_musd_per_step', 'reliability', 'source'],
  instruments: ['id', 'name', 'platforms', 'mass_kg', 'power_w', 'duty', 'cost_musd', 'data_mbit_per_day', 'science_base', 'reliability', 'weights', 'source'],
  power: ['id', 'type', 'name', 'mass_kg', 'cost_musd', 'reliability', 'source'],
  antennas: ['id', 'name', 'platforms', 'mass_kg', 'cost_musd', 'reliability', 'source'],
  extras: ['id', 'effect', 'name', 'mass_kg', 'cost_musd'],
};
const goals = d.mission.goals.map((g) => g.id);
const ids = new Set();
for (const [group, fields] of Object.entries(REQUIRED)) {
  for (const item of d.components[group]) {
    need(!ids.has(item.id), `Повторюється id «${item.id}»`);
    ids.add(item.id);
    fields.forEach((f) => need(item[f] !== undefined, `${group}/${item.id}: немає поля «${f}»`));
    if (group === 'instruments') goals.forEach((g) => need(item.weights?.[g] !== undefined, `${item.id}: немає ваги для завдання «${g}»`));
    if (group === 'power') need(item.type === 'solar' ? item.p1au_w : item.p0_w, `${item.id}: немає потужності`);
    if (group === 'antennas') need(item.relay ? item.relay_mbit_per_day : item.rate_1au_mbps, `${item.id}: немає швидкості`);
  }
}
for (const r of d.rockets) ['id', 'name', 'leo_kg', 'cost_musd', 'flights', 'successes', 'source'].forEach((f) => need(r[f] !== undefined, `rocket/${r.id}: немає «${f}»`));
for (const t of d.targets) {
  ['id', 'name', 'sun_au', 'k_capacity', 'dv_capture_kms', 'landing', 'flight_days', 'step_days', 'ops_steps', 'sites', 'source'].forEach((f) => need(t[f] !== undefined, `target/${t.id}: немає «${f}»`));
  need(t.orbit_au || t.earth_dist_au, `target/${t.id}: потрібне orbit_au (+period_days, theta0_deg) або earth_dist_au`);
}
for (const e of d.events.random) need(e.source, `event/${e.id}: немає джерела`);

if (problems.length) { console.log(`Знайдено проблем: ${problems.length}`); problems.forEach((p) => console.log(' - ' + p)); process.exit(1); }
console.log('Дані в порядку.');
