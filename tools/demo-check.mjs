// Перевіряє, що демо-показ досі проходить за сценарієм (після будь-якої зміни даних чи формул).
// Запуск:  node tools/demo-check.mjs          — перевірка поточного коду місії
//          node tools/demo-check.mjs --find   — підібрати нові коди, якщо сценарій зламався
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadDataNode } from './node-data.js';
import { Mission } from '../js/sim.js';
import { Development } from '../js/dev.js';
import { score } from '../js/explain.js';
import { DEMO_SEED, DEMO_BUILDS, DEMO_EXPECT, demoFlightPolicy, demoDevPolicy } from '../js/demo-script.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const data = await loadDataNode(path.join(here, '..', 'data'));

function play(act, seed) {
  const dev = new Development(data, DEMO_BUILDS[act], seed).runAuto(demoDevPolicy);
  const m = new Mission(data, DEMO_BUILDS[act], seed, dev);
  if (!dev.cancelled) m.runAuto(demoFlightPolicy(act));
  const decisions = m.entries.filter((e) => e.code === 'choice').map((e) => e.params.decision);
  return { m, dev, sc: score(m), decisions };
}

/** Чи підходить код місії для сценарію: акт 1 гине в бурі після трьох рішень, акт 2 виконує базову місію. */
function fits(seed) {
  const a = play('demo1', seed);
  const problems = [];
  if (a.dev.cancelled || a.dev.descoped.length || a.dev.flags.waited) problems.push('акт 1: розробка пішла не за сценарієм (скасування, знятий прилад або перенесений старт)');
  if (a.m.s.lost !== 'storm') problems.push(`акт 1: апарат має загинути в бурі, а вийшло «${a.m.s.lost || 'місія вціліла'}»`);
  const want = DEMO_EXPECT.demo1.decisions;
  if (a.decisions.slice(0, want.length).join() !== want.join()) problems.push(`акт 1: рішення мають іти в порядку ${want.join(' → ')}, а йдуть ${a.decisions.join(' → ') || '—'}`);
  const b = play('demo2', seed);
  if (b.dev.cancelled || b.dev.descoped.length || b.dev.flags.waited) problems.push('акт 2: розробка пішла не за сценарієм');
  if (b.sc.outcome !== 'success') problems.push(`акт 2: має бути «базову місію виконано», а вийшло «${b.sc.outcome}»`);
  if (b.m.s.stormsSeen < 1) problems.push('акт 2: бурі не було, а підпис про неї розповідає');
  // Підписи показу згадують конкретні події, тому перевіряємо і їх
  const devEvents = (x) => x.dev.entries.filter((e) => e.code === 'event').map((e) => e.params.ev.id);
  const flightEvents = (x) => x.m.entries.filter((e) => e.code === 'event').map((e) => e.params.event.id);
  if (!devEvents(a).includes('software')) problems.push('акт 1: підпис каже про запізнення програм, а цієї події не було');
  if (b.dev.build.massGrowth > 0) problems.push('акт 2: підпис каже, що запас маси покрив зростання, а маса вийшла за запас');
  if (b.dev.reserve < b.dev.reserve0 - 0.5) problems.push('акт 2: підпис каже, що резерв цілий, а його витрачено');
  if (!flightEvents(b).includes('wheel_stuck')) problems.push('акт 2: підпис каже про заклинене колесо, а цієї події не було');
  if (!b.m.s.extended || b.m.s.steps <= b.m.r.target.ops_steps) problems.push('акт 2: підпис каже, що місію продовжили, а цього не сталося');
  return { problems, a, b };
}

if (process.argv.includes('--find')) {
  const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let found = 0;
  console.log('Шукаю коди місії, з якими сценарій працює…');
  for (let i = 0; i < 40000 && found < 8; i++) {
    const seed = `D${abc[i % 32]}${abc[(i >> 5) % 32]}${abc[(i >> 10) % 32]}`;
    const r = fits(seed);
    if (r.problems.length) continue;
    found++;
    console.log(`  ${seed}: акт 1 — ${r.a.sc.total} балів, акт 2 — ${r.b.sc.total} балів`);
  }
  console.log(found ? '\nВпишіть обраний код у DEMO_SEED і нові бали в DEMO_EXPECT (js/demo-script.js), оновіть числа в DEMO.md.' : 'Нічого не знайдено: змініть конструкції в js/demo-script.js.');
  process.exit(0);
}

const r = fits(DEMO_SEED);
const lines = [...r.problems];
if (r.a.sc.total !== DEMO_EXPECT.demo1.total) lines.push(`акт 1: у DEMO.md записано ${DEMO_EXPECT.demo1.total} балів, а виходить ${r.a.sc.total}`);
if (r.b.sc.total !== DEMO_EXPECT.demo2.total) lines.push(`акт 2: у DEMO.md записано ${DEMO_EXPECT.demo2.total} балів, а виходить ${r.b.sc.total}`);
console.log(`Код місії ${DEMO_SEED}: акт 1 — ${r.a.sc.total} балів (${r.a.m.s.lost ? `втрачено: ${r.a.m.s.lost}` : 'вцілів'}), акт 2 — ${r.b.sc.total} балів (${r.b.sc.outcome}).`);
if (lines.length) {
  console.log('\nДемо зламалося:');
  lines.forEach((l) => console.log(` - ${l}`));
  console.log('\nЩо робити: node tools/demo-check.mjs --find');
  process.exit(1);
}
console.log('Демо працює за сценарієм.');
