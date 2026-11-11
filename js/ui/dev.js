// Етап 3. Розробка і випробування: резерв, зростання маси, тести, графік і вікно запуску.
import { t, esc, fmt, pct } from './dom.js';
import { tr } from '../i18n.js';
import { Development } from '../dev.js';
import { resolveBuild, checkBuild } from '../calc.js';
import { sfx } from './sound.js';

const monthName = (ym) => new Date(`${ym}-15T00:00:00Z`).toLocaleDateString('uk-UA', { month: 'long', year: 'numeric', timeZone: 'UTC' });

export function render(root, app) {
  const { data, build } = app;
  const r0 = resolveBuild(data, build);
  if (!r0.target || !checkBuild(r0).ok) { app.go('builder'); return; }
  if (!app.dev) app.dev = new Development(data, build, app.seed);
  const dev = app.dev;

  root.innerHTML = `
    <div class="flight">
      <div>
        <h1>Розробка і випробування</h1>
        <p class="muted">Від креслення до готового апарата минають роки. Саме тут місії найчастіше виходять за бюджет, важчають і пропускають вікно запуску.</p>
        ${!dev.started ? plan(app, dev) : dev.pending ? decisionPanel(dev) : controls(dev)}
        ${dev.started ? `<section class="panel" aria-live="polite"><h2>Хід розробки</h2>
          <ol class="log" reversed>${[...dev.entries].reverse().map((e) => logItem(e, dev)).join('')}</ol></section>` : ''}
      </div>
      <div>${status(dev)}</div>
    </div>`;

  root.querySelectorAll('[data-testing]').forEach((b) => b.addEventListener('click', () => {
    build.testing = b.dataset.testing;
    app.dev = null;
    const y = window.scrollY; app.render(); window.scrollTo(0, y);
  }));
  const step = () => {
    dev.advance();
    if (dev.pending) sfx.decision(); else if (dev.cancelled) sfx.bad(); else if (dev.done) sfx.good();
    app.render();
  };
  root.querySelector('[data-act="start"]')?.addEventListener('click', step);
  root.querySelector('[data-act="step"]')?.addEventListener('click', step);
  root.querySelector('[data-act="run"]')?.addEventListener('click', () => {
    let guard = 0;
    while (!dev.done && !dev.pending && guard++ < 50) dev.advance();
    if (dev.pending) sfx.decision(); else if (dev.cancelled) sfx.bad(); else sfx.good();
    app.render();
  });
  root.querySelectorAll('[data-option]').forEach((b) => b.addEventListener('click', () => { dev.choose(b.dataset.option); step(); }));
  root.querySelector('[data-act="launchpad"]')?.addEventListener('click', () => { app.mission = null; app.go('flight'); });
  root.querySelectorAll('[data-act="rebuild"]').forEach((b) => b.addEventListener('click', () => { app.dev = null; app.mission = null; app.go('builder'); }));
}

function plan(app, dev) {
  const r = dev.r;
  return `<section class="panel">
    <h2>План випробувань</h2>
    <p class="small muted">Що більше перевірок на Землі, то менше сюрпризів у космосі. Але тести коштують грошей і часу.</p>
    <div class="options">
      ${app.data.mission.testing.map((x) => `
        <button type="button" class="choice" data-testing="${x.id}" aria-pressed="${r.testing.id === x.id}">
          <span class="choice-name">${t(x.name)}</span>
          <span class="choice-desc">${t(x.summary)}</span>
          <span class="choice-stats">
            <span class="stat-cost">${x.cost_pct > 0 ? '+' : ''}${x.cost_pct}% вартості ${x.cost_pct < 0 ? '(повертається в резерв)' : x.cost_pct > 0 ? 'з резерву' : ''}</span>
            <span>+${x.months} міс. до графіка</span>
            <span>відмови ×${fmt(x.fail_mult, 1)}</span>
          </span>
        </button>`).join('')}
    </div>
    <div class="btn-row">
      <button type="button" class="btn" data-act="start">Почати розробку</button>
      <button type="button" class="btn secondary" data-act="rebuild">Повернутися до конструктора</button>
    </div>
  </section>`;
}

function controls(dev) {
  if (dev.cancelled) {
    return `<section class="panel decision"><h2>Проєкт закрито</h2>
      <p>Витрати перевищили бюджет, а додаткових грошей не дали. Апарат не полетить.</p>
      <div class="btn-row"><button type="button" class="btn" data-act="rebuild">Змінити конструкцію і спробувати ще раз</button></div></section>`;
  }
  if (dev.done) {
    const r = dev.r;
    return `<section class="panel"><h2>Апарат готовий до старту</h2>
      <p>Старт: <b>${esc(monthName(dev.build.launch))}</b>, приладів на борту: ${r.instruments.length}.
      Відмови в польоті: ×${fmt(dev.relMult, 2)} від звичайного.</p>
      <div class="btn-row">
        <button type="button" class="btn launch" data-act="launchpad">На стартовий майданчик</button>
        <button type="button" class="btn secondary" data-act="rebuild">Повернутися до конструктора</button>
      </div></section>`;
  }
  return `<section class="panel"><div class="btn-row" style="margin-top:0">
    <button type="button" class="btn" data-act="step">Наступний етап</button>
    <button type="button" class="btn secondary" data-act="run">До наступного рішення</button>
  </div></section>`;
}

function decisionPanel(dev) {
  const d = dev.pending;
  const p = d.params;
  const info = {
    overweight: { title: 'Апарат заважкий для ракети', text: `Після зростання маси апарат важить на ${fmt(p.over)} кг більше, ніж ракета довезе до цілі.` },
    money: { title: 'Резерв вичерпано', text: `Бракує ${fmt(p.deficit)} млн $. Можна зняти прилад (повертається ${pct(dev.cfg.descope_refund)} його ціни) або просити додаткові гроші.` },
    slip: { title: 'Не встигаємо до вікна запуску', text: `Розробка відстає від графіка на ${p.over} міс. Наступне вікно — ${monthName(p.next)}.` },
  }[d.id];
  const opt = (o) => {
    if (o.id.startsWith('drop:')) return { label: `Зняти: ${tr(o.instr.name)}`, hint: `Мінус ${fmt(o.instr.mass_kg)} кг і вся наука цього приладу. Найменш цінний для завдання — перший у списку.` };
    return {
      lightweight: { label: 'Полегшити конструкцію', hint: `Титан замість сталі, тонші кабелі: ${fmt(p.lwCost)} млн $ з резерву.` },
      ask: { label: 'Просити додаткові гроші', hint: `Шанс ${pct(dev.cfg.extra_money_chance)}. Якщо відмовлять, проєкт закриють.` },
      rush: { label: 'Скоротити випробування і встигнути', hint: 'Стартуємо вчасно, але відмови в польоті на 30% частіші.' },
      wait: { label: `Чекати наступного вікна (${monthName(p.next || dev.build.launch)})`, hint: `Очікування ~${p.months} міс. коштуватиме ${fmt(p.waitCost)} млн $ з резерву.` },
    }[o.id];
  };
  return `<section class="panel decision" role="dialog" aria-labelledby="dec-title">
    <h2 id="dec-title">${esc(info.title)}</h2>
    <p>${esc(info.text)}</p>
    <div class="options">${d.options.map((o) => { const x = opt(o); return `
      <button type="button" class="choice" data-option="${esc(o.id)}"><span class="choice-name">${esc(x.label)}</span><span class="choice-desc">${esc(x.hint)}</span></button>`; }).join('')}</div>
  </section>`;
}

function status(dev) {
  const c = dev.check();
  const budget = dev.budget;
  const spentW = Math.min(100, (dev.base / budget) * 100);
  const usedRes = dev.reserve0 - Math.max(0, dev.reserve);
  const usedW = Math.min(100 - spentW, (Math.max(0, usedRes) / budget) * 100);
  const leftW = Math.min(100 - spentW - usedW, (Math.max(0, dev.reserve) / budget) * 100);
  const slack = dev.cfg.slack_months;
  const mW = Math.min(100, (dev.months / (slack * 2)) * 100);
  const massRatio = c.capacity ? c.mass.launch / c.capacity : 0;
  return `<section class="panel">
    <h2>Стан проєкту</h2>
    <div class="gauge" data-status="${dev.reserve < 0 ? 'fail' : dev.reserve < dev.reserve0 * 0.3 ? 'warn' : 'ok'}">
      <div class="gauge-head"><b>Бюджет</b><span class="num">${fmt(dev.spent)} / ${fmt(budget)} млн $</span></div>
      <div class="gauge-track seg-track">
        <span class="seg" style="width:${spentW}%;background:var(--budget)"></span>
        <span class="seg" style="width:${usedW}%;background:var(--bad)"></span>
        <span class="seg" style="width:${leftW}%;background:color-mix(in srgb, var(--budget) 35%, var(--surface))"></span>
      </div>
      <div class="gauge-note">${dev.reserve >= 0 ? `Резерву залишилось ${fmt(dev.reserve)} з ${fmt(dev.reserve0)} млн $` : `Перевитрата ${fmt(-dev.reserve)} млн $`}</div>
    </div>
    <div class="gauge" data-status="${dev.months > slack ? 'fail' : dev.months > slack * 0.7 ? 'warn' : 'ok'}">
      <div class="gauge-head"><b>Графік</b><span class="num">затримка ${dev.months} міс. з ${slack} допустимих</span></div>
      <div class="gauge-track"><span class="gauge-fill" style="width:${mW}%;background:var(--data)"></span><span class="tb-mark" style="left:50%"></span></div>
      <div class="gauge-note">Риска — межа, за якою апарат не встигає до вікна запуску.</div>
    </div>
    <div class="gauge" data-status="${massRatio > 1 ? 'fail' : massRatio > 0.85 ? 'warn' : 'ok'}">
      <div class="gauge-head"><b>Маса на старті</b><span class="num">${fmt(c.mass.launch)} / ${fmt(c.capacity)} кг</span></div>
      <div class="gauge-track"><span class="gauge-warnzone"></span><span class="gauge-fill" style="width:${Math.min(100, massRatio * 100)}%;background:var(--mass)"></span></div>
      <div class="gauge-note">${dev.build.massGrowth > 0 ? `Маса зросла на ${pct(dev.build.massGrowth)} понад закладений запас` : 'Зростання маси поки в межах запасу 20%'}</div>
    </div>
    <dl class="tele">
      <div><dt>Клас ризику</dt><dd>${t(dev.r.risk.name)}</dd></div>
      <div><dt>Випробування</dt><dd>${t(dev.r.testing.name)}</dd></div>
      <div><dt>Старт</dt><dd>${esc(monthName(dev.build.launch))}</dd></div>
      <div><dt>Відмови в польоті</dt><dd>×${fmt(dev.relMult, 2)}</dd></div>
    </dl>
  </section>`;
}

const WHY = { testing: 'випробування', lightweight: 'полегшення конструкції', wait: 'очікування вікна', delay: 'затримка' };

function logItem(e, dev) {
  const p = e.params;
  let text = '';
  switch (e.code) {
    case 'testing': text = `${tr(p.level.name)}: +${p.level.months} міс. до графіка.`; break;
    case 'spend': text = p.amount > 0 ? `Витрачено ${fmt(p.amount)} млн $ з резерву${WHY[p.why] ? ` (${WHY[p.why]})` : ''}. Залишок: ${fmt(p.left)} млн $.` : ''; break;
    case 'mass_growth': text = p.growth > 0.2
      ? `Апарат поважчав на ${pct(p.growth)} проти креслень: це більше за запас 20%. Маса на старті ${fmt(p.launch)} з ${fmt(p.capacity)} кг.`
      : `Апарат поважчав на ${pct(p.growth)} проти креслень, але запас 20% це покрив.`; break;
    case 'event': text = `${tr(p.ev.title)}. ${tr(p.ev.text)}${p.delay ? ` Затримка ${p.delay} міс.` : ''}`; break;
    case 'on_time': text = `Затримка ${p.months} міс. вкладається в запас графіка (${p.slack} міс.). Встигаємо до вікна.`; break;
    case 'late_no_window': text = `Розробка затрималась на ${p.over} міс. Старт перенесено на ${monthName(p.launch)}.`; break;
    case 'rushed': text = 'Випробування скорочено, щоб встигнути у вікно.'; break;
    case 'waited': text = `Старт перенесено на ${monthName(p.next)}.`; break;
    case 'descoped': text = `Прилад «${tr(p.instr.name)}» знято з апарата. Повернуто ${fmt(p.refund)} млн $.`; break;
    case 'lightweighted': text = 'Конструкцію полегшено: апарат знову вміщається в ракету.'; break;
    case 'money_granted': text = `Додаткові ${fmt(p.amount)} млн $ виділено. Більше просити не можна.`; break;
    case 'cancelled': text = 'Проєкт закрито через перевитрати.'; break;
    case 'ready': text = `Розробку завершено. Витрачено ${fmt(p.spent)} млн $.`; break;
    case 'choice': return '';
    default: text = e.code;
  }
  if (!text) return '';
  const fact = e.fact ? `<span class="fact-label" style="margin-top:.3rem">Це сталося насправді</span><span class="small">${esc(tr(e.fact))} ${e.fact.source ? `<a href="${esc(e.fact.source)}" target="_blank" rel="noopener">Джерело</a>` : ''}</span>` : '';
  return `<li class="${e.tone}">${esc(text)}${fact}</li>`;
}
