// Перевірка балансу: генеруємо тисячі випадкових конструкцій, відкидаємо ті,
// що не проходять ліміти, і проганяємо решту через ту саму симуляцію, що й у грі.
// Запуск: node tools/montecarlo.js [кількість] [seed]
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs/promises';
import { loadDataNode } from './node-data.js';
import { resolveBuild, checkBuild, fits, platformFits, launchMonths, bestLaunch } from '../js/calc.js';
import { Mission, defaultPolicy, randomPolicy } from '../js/sim.js';
import { makeRng } from '../js/rng.js';
import { score } from '../js/explain.js';
import { balanceSvg } from '../js/ui/balance.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const N = Number(process.argv[2] || 10000);
const rng = makeRng(process.argv[3] || 'balance');
const data = await loadDataNode(path.join(here, '..', 'data'));
const C = data.components;

function randomBuild() {
  const target = rng.pick(data.targets);
  const platform = rng.pick(C.platforms.filter((p) => platformFits(p, target)));
  const r0 = { platform, target };
  const pool = C.instruments.filter((i) => fits(i, r0));
  const n = 1 + Math.floor(rng() * platform.slots);
  const instruments = [...pool].sort(() => rng() - 0.5).slice(0, n).map((i) => i.id);
  const antennas = C.antennas.filter((a) => fits(a, r0) && (!a.relay || target.has_relay));
  const extras = C.extras.filter(() => rng() < 0.3).map((e) => e.id);
  return {
    target: target.id, cls: rng.pick(data.mission.classes).id, goal: rng.pick(data.mission.goals).id,
    rocket: rng.pick(data.rockets).id, platform: platform.id, instruments,
    power: rng.pick(C.power).id, antenna: rng.pick(antennas).id, extras,
    launch: rng() < 0.7 ? bestLaunch(target) : rng.pick(launchMonths()),
    riskClass: rng.pick(['A', 'B', 'C', 'D']), reserve: rng.pick([15, 25, 35]), testing: rng.pick(['min', 'std', 'full']),
    engineer: rng() < 0.3, trajectory: rng.pick(['direct', 'alt']), propulsion: rng.pick(['chem', 'ion']), orbit: rng.pick(['standard', 'low']), dsn: rng.pick(['less', 'std', 'more']),
  };
}

const rows = [];
let tried = 0;
while (rows.length < N && tried < N * 50) {
  tried++;
  const build = randomBuild();
  const check = checkBuild(resolveBuild(data, build));
  if (!check.ok) continue;
  const policy = rng() < 0.5 ? defaultPolicy : randomPolicy;
  const m = new Mission(data, build, `mc${rows.length}`).runAuto(policy);
  const sc = score(m);
  const top = Object.entries(m.s.losses).sort((a, b) => b[1] - a[1])[0];
  rows.push({ build, science: m.s.science, sc, lost: m.s.lost, topLoss: top ? top[0] : 'none', power: m.r.power.type, cost: check.cost.total });
}

const pct = (arr, p) => { const s = [...arr].sort((a, b) => a - b); return s[Math.floor(p * (s.length - 1))] ?? 0; };
const round = (x) => Math.round(x);
console.log(`Перевірено конструкцій: ${tried}, придатних до запуску: ${rows.length} (${round(rows.length / tried * 100)}%)\n`);

console.log('Наука за класом місії (p25 / p50 / p75 / p90) і частка «успіху»:');
for (const cls of data.mission.classes) {
  const xs = rows.filter((r) => r.build.cls === cls.id);
  const sci = xs.map((r) => r.science);
  const ok = xs.filter((r) => r.sc.outcome === 'success').length;
  console.log(`  ${cls.id.padEnd(14)} n=${String(xs.length).padStart(5)}  ${round(pct(sci, .25))} / ${round(pct(sci, .5))} / ${round(pct(sci, .75))} / ${round(pct(sci, .9))}   ціль ${cls.science_target}   успіх ${round(ok / Math.max(1, xs.length) * 100)}%`);
}

const count = (key) => rows.reduce((m, r) => (m[r[key]] = (m[r[key]] || 0) + 1, m), {});
console.log('\nНайбільша причина втрати науки:');
Object.entries(count('topLoss')).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log(`  ${k.padEnd(18)} ${round(v / rows.length * 100)}%`));
console.log('\nМісія втрачена повністю:');
Object.entries(count('lost')).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log(`  ${String(k).padEnd(18)} ${round(v / rows.length * 100)}%`));

console.log('\nСередня оцінка науки за джерелом енергії і ціллю:');
for (const t of data.targets) for (const p of ['solar', 'rtg']) {
  const xs = rows.filter((r) => r.build.target === t.id && r.power === p);
  if (xs.length) console.log(`  ${t.id.padEnd(6)} ${p.padEnd(6)} ${round(xs.reduce((a, r) => a + r.sc.science, 0) / xs.length)} (n=${xs.length})`);
}

const best = [...rows].sort((a, b) => b.sc.total - a.sc.total).slice(0, 5);
console.log('\nНайкращі 5 (різні — отже, ідеальної збірки немає):');
best.forEach((r) => console.log(`  ${r.sc.total} | ${r.build.target} ${r.build.cls} ${r.build.goal} | ${r.build.platform} ${r.build.power} ${r.build.antenna} | ${r.build.instruments.join(',')}`));

// Гістограма оцінок для слайда і для екрана «Про дані»
const bins = Array(10).fill(0);
rows.forEach((r) => bins[Math.min(9, Math.floor(r.sc.total / 10))]++);
const balance = {
  date: new Date().toISOString().slice(0, 10),
  n: rows.length,
  valid_share: rows.length / tried,
  bins,
  classes: data.mission.classes.map((cls) => {
    const xs = rows.filter((r) => r.build.cls === cls.id);
    return { id: cls.id, n: xs.length, success: xs.filter((r) => r.sc.outcome === 'success').length / Math.max(1, xs.length) };
  }),
  causes: Object.entries(count('topLoss')).map(([key, v]) => ({ key, share: v / rows.length })).sort((a, b) => b.share - a.share),
  best: best.map((r) => ({ total: r.sc.total, ...r.build })),
};
await fs.mkdir(path.join(here, 'out'), { recursive: true });
await fs.writeFile(path.join(here, '..', 'data', 'balance.json'), JSON.stringify(balance, null, 2) + '\n');
await fs.writeFile(path.join(here, 'out', 'histogram.csv'), 'оцінка,кількість\n' + bins.map((b, i) => `${i * 10}-${i * 10 + 9},${b}`).join('\n'));
await fs.writeFile(path.join(here, 'out', 'balance.svg'), balanceSvg(balance, { ink: '#172238' }));
console.log('\nЗбережено: data/balance.json (графік у грі), tools/out/balance.svg (для слайда), tools/out/histogram.csv');
