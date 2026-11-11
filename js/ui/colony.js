// Режим «Колонія на Марсі»: кисневий завод на основі результатів MOXIE.
// Чи встигнемо добути кисень для зворотної ракети й екіпажу, поки триває вікно запуску?
import { esc, fmt, pct } from './dom.js';
import { tr, dayWord, plural } from '../i18n.js';

export function colonyPlan(c, { units, reactors, solarM2 }) {
  const needW = units * c.moxie.power_w;
  const solarW = solarM2 * c.power.solar_w_per_m2_avg * c.power.solar_storm_factor;
  const reactorW = reactors * c.power.reactor_w;
  const haveW = solarW + reactorW;
  const uptime = needW > 0 ? Math.min(1, haveW / needW) : 0;
  const kgPerDay = (units * c.moxie.o2_g_per_h * 24 * uptime) / 1000;
  const crewT = c.needs.crew_o2_t_per_year * (c.needs.surface_days / 365);
  const goalT = c.needs.ascent_o2_t + crewT;
  const days = kgPerDay > 0 ? (goalT * 1000) / kgPerDay : Infinity;
  const massKg = units * c.moxie.mass_kg + reactors * c.power.reactor_kg + solarM2 * c.power.solar_kg_per_m2;
  return { needW, solarW, reactorW, haveW, uptime, kgPerDay, crewT, goalT, days, massKg, ok: days <= c.needs.window_days };
}

export function render(root, app) {
  const c = app.data.colony;
  const m = app.mission;
  const state = app.colony || (app.colony = { units: 100, reactors: 1, solarM2: 500 });
  const moxie = m?.s.instruments.find((i) => i.def.id === 'moxie');
  const runs = moxie ? m.timeline.filter((x) => x.u > 0).length : 0;

  root.innerHTML = `
    <section class="briefing-hero">
      <h1>Колонія на Марсі</h1>
      <p>Ваш апарат успішно сів. Наступний крок — експедиція з людьми. Щоб четверо астронавтів змогли повернутися,
      на Марсі заздалегідь треба добути ~${fmt(c.needs.ascent_o2_t)} т кисню для зворотної ракети. Спроєктуйте кисневий завод,
      який встигне до прильоту екіпажу: на це є одне вікно запуску, ~${fmt(c.needs.window_days)} ${dayWord(c.needs.window_days)}.</p>
      ${moxie ? `<p class="small">${moxie.alive ? `Ваш MOXIE відпрацював ${runs} ${plural(runs, ['сеанс', 'сеанси', 'сеансів'])} і добув ~${fmt(runs * c.moxie.o2_g_per_h)} г кисню. Тепер його треба збільшити.` : 'Ваш MOXIE відмовив, але дані встигли довести, що технологія працює.'}</p>` : ''}
    </section>

    <div class="flight">
      <div>
        <section class="panel">
          <h2>Кисневий завод</h2>
          ${slider('units', 'Блоки розміру MOXIE', 0, 600, 10, state.units, 'шт.')}
          <p class="small muted">Кожен блок: ${c.moxie.o2_g_per_h} г кисню на годину, ${c.moxie.power_w} Вт, ${c.moxie.mass_kg} кг.</p>
        </section>
        <section class="panel">
          <h2>Енергія</h2>
          ${slider('solarM2', 'Сонячне поле', 0, 6000, 100, state.solarM2, 'м²')}
          <p class="small muted">~${c.power.solar_w_per_m2_avg} Вт з квадратного метра в середньому за добу; бурі забирають у середньому чверть.</p>
          ${slider('reactors', 'Реактори Kilopower', 0, 10, 1, state.reactors, 'шт.')}
          <p class="small muted">${fmt(c.power.reactor_w / 1000)} кВт вдень і вночі, ~${fmt(c.power.reactor_kg)} кг кожен.</p>
        </section>
      </div>
      <div>
        <section class="panel" id="colony-result" aria-live="polite"></section>
        <section class="panel">
          <h2>Це сталося насправді</h2>
          <p class="small">${esc(tr(c.moxie.fact))} <a href="${esc(c.moxie.source)}" target="_blank" rel="noopener">Джерело</a></p>
          <p class="small">${esc(tr(c.needs.fact))}</p>
          <p class="small">${esc(tr(c.power.reactor_fact))} <a href="${esc(c.power.reactor_source)}" target="_blank" rel="noopener">Джерело</a></p>
          <p class="small muted">${esc(c.simplified)}</p>
        </section>
        <div class="btn-row"><button type="button" class="btn secondary" data-act="back">Повернутися до підсумку</button></div>
      </div>
    </div>`;

  const update = () => {
    const p = colonyPlan(c, state);
    const W = c.needs.window_days;
    const shownDays = Number.isFinite(p.days) ? p.days : W * 2;
    const max = Math.max(W, shownDays) * 1.05;
    root.querySelector('#colony-result').innerHTML = `
      <h2>${p.ok ? 'Кисень буде готовий вчасно' : 'Не встигаємо до прильоту екіпажу'}</h2>
      <p class="outcome ${p.ok ? 'success' : 'lost'}">${Number.isFinite(p.days) ? `Потрібно ${fmt(p.days)} ${dayWord(p.days)} із ${fmt(W)} доступних` : 'Завод не виробляє кисню'}</p>
      <div class="timeline-bar" role="img" aria-label="Час виробництва проти вікна запуску">
        <span class="tb-fill ${p.ok ? '' : 'over'}" style="width:${Math.min(100, (shownDays / max) * 100)}%"></span>
        <span class="tb-mark" style="left:${(W / max) * 100}%"></span>
      </div>
      <p class="small muted">Риска — момент, коли екіпаж має вилетіти із Землі.</p>
      <dl class="tele" style="margin-top:1rem">
        <div><dt>Потрібно кисню</dt><dd>${fmt(p.goalT, 1)} т <span class="muted small">(${fmt(c.needs.ascent_o2_t)} т ракеті + ${fmt(p.crewT, 1)} т на дихання)</span></dd></div>
        <div><dt>Виробництво</dt><dd>${fmt(p.kgPerDay, 1)} кг/добу</dd></div>
        <div><dt>Енергії потрібно</dt><dd>${fmt(p.needW / 1000, 1)} кВт</dd></div>
        <div><dt>Енергії є</dt><dd>${fmt(p.haveW / 1000, 1)} кВт <span class="muted small">(сонце ${fmt(p.solarW / 1000, 1)}, реактори ${fmt(p.reactorW / 1000)})</span></dd></div>
        <div><dt>Завод працює</dt><dd>${pct(p.uptime)} часу</dd></div>
        <div><dt>Маса на Марс</dt><dd>${fmt(p.massKg / 1000, 1)} т <span class="muted small">(≈ ${fmt(p.massKg / app.data.colony.perseverance_kg, 0)} марсоходів Perseverance)</span></dd></div>
      </dl>
      <p class="small" style="margin-top:.8rem">${hint(p)}</p>`;
  };

  root.querySelectorAll('input[type="range"]').forEach((inp) => inp.addEventListener('input', () => {
    state[inp.name] = Number(inp.value);
    root.querySelector(`output[for="${inp.id}"]`).textContent = `${fmt(inp.value)} ${inp.dataset.unit}`;
    update();
  }));
  root.querySelector('[data-act="back"]').addEventListener('click', () => app.go('summary'));
  update();
}

function slider(name, label, min, max, step, value, unit) {
  const id = `col-${name}`;
  return `<div class="slider">
    <div class="gauge-head"><label for="${id}"><b>${label}</b></label><output for="${id}" class="num">${fmt(value)} ${unit}</output></div>
    <input type="range" id="${id}" name="${name}" min="${min}" max="${max}" step="${step}" value="${value}" data-unit="${unit}">
  </div>`;
}

function hint(p) {
  if (p.uptime < 1) return `Енергії вистачає лише на ${pct(p.uptime)} роботи заводу. Додайте сонячних панелей або реактор.`;
  if (!p.ok) return 'Енергії досить, але блоків замало. Більше блоків — швидше, але кожен потребує ще 300 Вт.';
  if (p.haveW > p.needW * 1.6) return 'Встигаєте, але енергії набагато більше, ніж треба. Зайві панелі й реактори — це зайві тонни, які треба доставити на Марс.';
  return 'Збалансований завод. Спробуйте зменшити масу: що вигідніше — реактор чи поле панелей?';
}
