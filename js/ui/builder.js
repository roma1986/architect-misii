// Етап 2. Конструктор: ракета, платформа, прилади, енергія, зв’язок і чотири шкали.
import { t, esc, fmt, pct, toast, missionUrl, copyText } from './dom.js';
import { tr, plural } from '../i18n.js';
import {
  resolveBuild, checkBuild, capacityTo, rocketReliability, fits, weight, powerProduced,
  downlinkPerDay, earthDistanceAu, sunShare, solarFactor, isSurface, DESIGN_MARGIN, platformFits, bestLaunch, launchYear,
} from '../calc.js';
import { patchSvg, craftSvg } from './visuals.js';
import { rocketSvg, fairingSvg } from './stack.js';
import { thumbHtml, zoomButton, bindZoom } from './gallery.js';

const GAUGES = [
  { key: 'budget', name: 'Бюджет', color: 'var(--budget)' },
  { key: 'mass', name: 'Маса на старті', color: 'var(--mass)' },
  { key: 'power', name: 'Енергія біля цілі', color: 'var(--power)' },
  { key: 'data', name: 'Дані', color: 'var(--data)' },
];

const ISSUE_TEXT = {
  no_rocket: 'Оберіть ракету-носій.',
  no_platform: 'Оберіть платформу апарата.',
  no_power: 'Оберіть джерело енергії.',
  no_antenna: 'Оберіть антену.',
  no_instruments: 'Додайте хоча б один науковий прилад.',
  no_target: 'Поверніться на брифінг і оберіть ціль.',
  no_class: 'Поверніться на брифінг і оберіть клас місії.',
  no_goal: 'Поверніться на брифінг і оберіть завдання.',
  too_many_instruments: (i) => `На цій платформі місця лише для ${i.slots} приладів.`,
  instrument_misfit: (i) => `«${tr(i.item.name)}» не можна поставити на цю платформу.`,
  antenna_misfit: (i) => `«${tr(i.item.name)}» не підходить для цієї платформи.`,
  no_relay: 'Біля цієї цілі немає орбітера-ретранслятора.',
  rocket_target: 'Ця ракета не долетить до обраної цілі.',
  platform_target: 'Ця платформа не підходить для обраної цілі.',
  ion_power: 'Іонному двигуну потрібні сонячні панелі від 20 м². РІТЕГ чи малі панелі не дадуть досить енергії.',
  over_budget: 'Перевищено бюджет разом з резервом. Дешевша ракета, менше приладів або простіша платформа.',
  over_mass: 'Апарат заважкий для ракети. Візьміть потужнішу ракету або легші компоненти.',
  over_power: 'Приладам бракує енергії біля цілі. Більші панелі, РІТЕГ або менше приладів.',
};
const WARN_TEXT = {
  lunar_night: 'Місячна ніч триває 14 діб. Сонячний посадковий апарат може її не пережити: допоможе великий акумулятор або РІТЕГ.',
  data_bottleneck: 'Прилади збирають більше даних, ніж антена встигне передати. Частина науки не дійде до Землі.',
  radiation: 'Біля Юпітера сильна радіація: без радіаційного сейфа прилади ламатимуться втричі частіше.',
  clouds: 'Хмари Венери непрозорі: оптичні прилади дадуть лише 20% своєї науки. Радар бачить крізь хмари.',
  short_life: 'На поверхні Венери апарат проживе лише ~2 години (один крок), зате кожен прилад працює на повну.',
  off_window: 'Старт поза найкращим вікном: ракета довезе менше маси, а політ триватиме довше. Дату можна змінити на брифінгу.',
  thin_margin: 'Запас маси або енергії менше 15%: запуск можливий, але збої траплятимуться в 1,5 раза частіше.',
};

const stars = (w) => (w >= 3 ? '★★★' : w >= 2 ? '★★' : w >= 1 ? '★' : '·');

export function render(root, app) {
  const { data, build } = app;
  const r = resolveBuild(data, build);
  if (!r.target || !r.cls || !r.goal) { app.go('briefing'); return; }
  if (!build.launch) { build.launch = bestLaunch(r.target); r.launch = build.launch; }
  const c = checkBuild(r);
  const C = data.components;
  const dist0 = earthDistanceAu(r.target, 0);

  const KIND = { rocket: 'rocket', platform: 'platform', instruments: 'instrument', power: 'power', antenna: 'antenna', extras: 'extra' };
  const card = (field, item, { multi = false, disabled = false, why = '', stats = '', desc = '' } = {}) => {
    const selected = multi ? build[field].includes(item.id) : build[field] === item.id;
    const kind = KIND[field];
    return `<div class="choice-wrap">
      <button type="button" class="choice${kind ? ' has-thumb' : ''}" data-field="${field}" data-id="${esc(item.id)}" data-multi="${multi}"
        aria-pressed="${selected}" ${disabled && !selected ? 'disabled' : ''}>
        ${kind ? thumbHtml(kind, item, data) : ''}
        <span class="choice-name">${t(item.name)}</span>
        ${item.prototype ? `<span class="choice-proto">Прототип: ${esc(item.prototype)}</span>` : ''}
        ${desc ? `<span class="choice-desc">${desc}</span>` : ''}
        <span class="choice-stats">${stats}</span>
        ${why ? `<span class="choice-why">${why}</span>` : ''}
      </button>${kind ? zoomButton(kind, item) : ''}</div>`;
  };
  // Рішення рівня проєкту (без фото): вибір порівнюємо з уже розв’язаним значенням r
  const pcard = (field, item, current, { stats = '', disabled = false, why = '' } = {}) => `<div class="choice-wrap">
      <button type="button" class="choice" data-field="${field}" data-id="${esc(item.id)}" data-multi="false"
        aria-pressed="${current === item.id}" ${disabled && current !== item.id ? 'disabled' : ''}>
        <span class="choice-name">${t(item.name)}</span>
        ${item.prototype ? `<span class="choice-proto">Приклади: ${esc(item.prototype)}</span>` : ''}
        ${item.summary ? `<span class="choice-desc">${t(item.summary)}</span>` : ''}
        <span class="choice-stats">${stats}</span>
        ${why ? `<span class="choice-why">${why}</span>` : ''}
      </button></div>`;
  const M = data.mission;
  const riskHtml = M.risk_classes.map((x) => pcard('riskClass', x, r.risk.id, {
    stats: `<span class="stat-cost">ціна ×${fmt(x.cost_mult, 2)}</span><span class="stat-mass">маса ×${fmt(x.mass_mult, 2)}</span><span>відмови ×${fmt(x.fail_mult, 2)}</span>`,
  })).join('');
  const reserveHtml = M.reserves.map((x) => pcard('reserve', x, r.reservePct, { stats: `<span class="stat-cost">${fmt(c.cost.total * x.id / 100)} млн $ відкладено</span>` })).join('');
  const orbiter = r.platform?.type === 'orbiter';
  const engHtml = !build.engineer ? '' : `
        <fieldset class="choice-group"><legend>Траєкторія <span class="eng-tag">інженер</span></legend>
          <p class="group-hint">Довший шлях дозволяє ракеті довезти більше, швидший — менше.</p>
          <div class="choices">${r.target.trajectories.map((x) => pcard('trajectory', x, r.trajectory.id, { stats: `<span class="stat-mass">маса ×${fmt(x.k_mult, 2)}</span><span>час польоту ×${fmt(x.time_mult, 2)}</span>` })).join('')}</div></fieldset>
        <fieldset class="choice-group"><legend>Двигун апарата <span class="eng-tag">інженер</span></legend>
          <div class="choices">${C.propulsion.map((x) => pcard('propulsion', x, r.propulsion.id, {
            disabled: !!x.platform_types && !orbiter, why: x.platform_types && !orbiter ? 'Лише для орбітальних апаратів' : '',
            stats: `<span>питомий імпульс ${fmt(x.isp_s)} с</span>${x.mass_kg ? `<span class="stat-mass">${fmt(x.mass_kg)} кг</span><span class="stat-cost">${fmt(x.cost_musd)} млн $</span><span>політ ×${fmt(x.time_mult, 1)}</span>` : ''}`,
          })).join('')}</div></fieldset>
        <fieldset class="choice-group"><legend>Орбіта біля цілі <span class="eng-tag">інженер</span></legend>
          <div class="choices">${C.orbits.map((x) => pcard('orbit', x, r.orbit.id, {
            disabled: !orbiter && x.id !== 'standard', why: !orbiter && x.id !== 'standard' ? 'Лише для орбітальних апаратів' : '',
            stats: x.id === 'standard' ? '' : `<span>наука ×${fmt(x.science_mult, 2)}</span><span class="stat-power">сонце ×${fmt(x.solar_mult, 2)}</span><span>+${fmt(x.dv_extra_kms, 2)} км/с</span>`,
          })).join('')}</div></fieldset>
        <fieldset class="choice-group"><legend>Час антен Deep Space Network <span class="eng-tag">інженер</span></legend>
          <p class="group-hint">Три комплекси антен на Землі обслуговують усі далекі місії. Не діє на ретрансляцію через орбітер.</p>
          <div class="choices">${C.dsn.map((x) => pcard('dsn', x, r.dsn.id, { stats: `<span class="stat-data">дані ×${fmt(x.hours_mult, 1)}</span>${x.ops_musd_per_step ? `<span class="stat-cost">${x.ops_musd_per_step > 0 ? '+' : ''}${fmt(x.ops_musd_per_step)} млн $ за крок</span>` : ''}` })).join('')}</div></fieldset>`;
  const pp = build.engineer && r.target.planetary_protection;
  const ppCost = pp && r.platform ? (isSurface(r) ? pp.surface_musd : pp.orbiter_musd) : 0;
  const baseStats = (x) => `
    ${x.mass_kg !== undefined ? `<span class="stat-mass">${fmt(x.mass_kg)} кг</span>` : ''}
    ${x.cost_musd !== undefined ? `<span class="stat-cost">${fmt(x.cost_musd)} млн $</span>` : ''}`;

  const rocketsHtml = data.rockets.map((x) => {
    const cap = capacityTo(x, r.target, r.launch, r.trajectory);
    return card('rocket', x, {
      disabled: cap === 0,
      why: cap === 0 ? 'Не долетить до цієї цілі' : '',
      desc: t(x.note),
      stats: `<span class="stat-mass">До цілі: ${fmt(cap)} кг</span><span class="stat-cost">${fmt(x.cost_musd)} млн $</span><span>Надійність ${pct(rocketReliability(x))}</span>`,
    });
  }).join('');

  const platformsHtml = C.platforms.map((x) => card('platform', x, {
    disabled: !platformFits(x, r.target),
    why: !platformFits(x, r.target) ? (x.only_targets ? 'Лише для астероїда' : 'На цю ціль не сядеш') : '',
    desc: t(x.summary),
    stats: `${baseStats(x)}<span class="stat-power">${fmt(x.bus_power_w)} Вт на себе</span><span>${x.slots} ${plural(x.slots, ['місце', 'місця', 'місць'])}</span>`,
  })).join('');

  const slotsFull = r.platform && build.instruments.length >= r.platform.slots;
  const instrHtml = C.instruments.map((x) => {
    const ok = r.platform ? fits(x, r) : true;
    const w = weight(x, r.goal);
    return card('instruments', x, {
      multi: true,
      disabled: !ok || slotsFull,
      why: !ok ? (x.only_targets ? 'Лише для Марса' : x.only_platforms ? 'Лише для зонда-пробовідбірника' : 'Не для цієї платформи') : '',
      stats: `${baseStats(x)}<span class="stat-power">${fmt(x.power_w)} Вт × ${pct(x.duty)} часу</span><span class="stat-data">${fmt(x.data_mbit_per_day)} Мбіт/добу</span><span title="Цінність для завдання">Цінність: ${stars(w)}</span>`,
    });
  }).join('');

  const powerHtml = C.power.map((x) => {
    const at = powerProduced({ ...r, power: x, platform: r.platform || C.platforms[0] });
    return card('power', x, {
      stats: `${baseStats(x)}<span class="stat-power">Біля цілі: ${fmt(at)} Вт</span>`,
    });
  }).join('');

  const antennaHtml = C.antennas.map((x) => {
    const ok = (r.platform ? fits(x, r) : true) && (!x.relay || r.target.has_relay);
    const down = downlinkPerDay(x, r.target, dist0, r.dsn);
    return card('antenna', x, {
      disabled: !ok,
      why: !ok ? (x.relay && !r.target.has_relay ? 'Немає ретранслятора біля цілі' : 'Не для цієї платформи') : '',
      stats: `${baseStats(x)}<span class="stat-data">${fmt(down)} Мбіт/добу</span>`,
    });
  }).join('');

  const extrasHtml = C.extras.map((x) => card('extras', x, { multi: true, desc: t(x.summary), stats: baseStats(x) })).join('');

  root.innerHTML = `
    <div class="builder">
      <div>
        <h1>Конструктор</h1>
        <p class="muted">Місія: ${t(r.target.name)}, ${t(r.cls.name)}, «${t(r.goal.name)}», старт ${esc(new Date(`${build.launch}-15T00:00:00Z`).toLocaleDateString('uk-UA', { month: 'long', year: 'numeric', timeZone: 'UTC' }))}. <button type="button" class="link-btn" id="back">Змінити</button></p>

        <fieldset class="choice-group"><legend>Клас ризику місії</legend>
          <p class="group-hint">${t(M.risk_note)}</p>
          <div class="choices">${riskHtml}</div></fieldset>
        <fieldset class="choice-group"><legend>Резерв бюджету</legend>
          <p class="group-hint">Гроші, відкладені на несподіванки під час розробки. Резерв входить у бюджет: що він більший, то менше лишається на апарат.</p>
          <div class="choices">${reserveHtml}</div></fieldset>
        <fieldset class="choice-group"><legend>Ракета-носій</legend>
          <p class="group-hint">До далекої цілі ракета везе лише частку маси, яку виводить на орбіту Землі${c.win.factor < 0.99 ? `, а поза вікном запуску — ще й ${pct(c.win.factor)} від неї` : ''}.</p>
          <div class="choices">${rocketsHtml}</div></fieldset>
        <fieldset class="choice-group"><legend>Платформа</legend><div class="choices">${platformsHtml}</div></fieldset>
        <fieldset class="choice-group"><legend>Наукові прилади ${r.platform ? `(${build.instruments.length} з ${r.platform.slots})` : ''}</legend>
          <p class="group-hint">Зірочки показують, наскільки прилад корисний для завдання «${t(r.goal.name)}».</p>
          <div class="choices">${instrHtml}</div></fieldset>
        <fieldset class="choice-group"><legend>Джерело енергії</legend>
          <p class="group-hint">Біля цілі «${t(r.target.name)}» Сонце дає ${pct(sunShare(r.target))} земного світла.</p>
          <div class="choices">${powerHtml}</div></fieldset>
        <fieldset class="choice-group"><legend>Зв’язок із Землею</legend>
          <p class="group-hint">Швидкість падає з квадратом відстані. Зараз до Землі ${fmt(dist0, dist0 < 0.01 ? 4 : 2)} а.о.</p>
          <div class="choices">${antennaHtml}</div></fieldset>
        <fieldset class="choice-group"><legend>Резервування</legend><div class="choices">${extrasHtml}</div></fieldset>
        ${engHtml}
        ${ppCost ? `<p class="pp-note"><b>Планетарний захист: +${fmt(ppCost)} млн $.</b> ${t(pp.note)}</p>` : ''}
      </div>

      <aside class="board" aria-label="Готовність місії">
        <div class="board-patch">
          ${patchSvg({ ...r, seed: app.seed, year: launchYear(r) }, 104)}
          <div><h2>Готовність місії</h2><p class="small muted">Емблема змінюється разом з апаратом: зірки — це прилади.</p></div>
        </div>
        <figure class="stack-wrap">
          <div class="stack-rocket">${rocketSvg(r.rocket)}<figcaption>${r.rocket ? `${t(r.rocket.name)}<br>${fmt(r.rocket.visual?.height_m)} м` : 'Оберіть ракету'}</figcaption></div>
          <div class="stack-fairing">${fairingSvg(r, c)}</div>
        </figure>
        <figure class="craft-wrap"><figcaption class="craft-cap">У польоті</figcaption>${craftSvg(r, r.platform ? `Суха маса ${fmt(c.mass.dry)} кг · на старті ${fmt(c.mass.launch)} кг` : '')}</figure>
        ${GAUGES.map((g) => gauge(g, c.bars[g.key], r, c)).join('')}
        ${massBar(c)}
        <ul class="issues">
          ${c.issues.map((i) => `<li>${esc(typeof ISSUE_TEXT[i.code] === 'function' ? ISSUE_TEXT[i.code](i) : ISSUE_TEXT[i.code] || i.code)}</li>`).join('')}
          ${c.warnings.map((w) => `<li class="warn">${esc(WARN_TEXT[w.code])}</li>`).join('')}
        </ul>
        <button type="button" class="btn launch" id="launch" ${c.ok ? '' : 'disabled'}>До розробки</button>
        <div class="btn-row" style="margin-top:.6rem">
          <button type="button" class="link-btn" id="share">Скопіювати посилання на місію</button>
        </div>
        <p class="small muted">Код місії: <b class="num">${esc(app.seed)}</b>. З тим самим кодом події повторюються.</p>
      </aside>
    </div>
    <div class="minibar" aria-hidden="true">
      ${GAUGES.map((g) => { const b = c.bars[g.key]; const w = b.limit > 0 ? Math.min(1, b.used / b.limit) : (b.used > 0 ? 1 : 0); return `<span class="mini" title="${g.name}"><i style="width:${w * 100}%;background:${b.status === 'fail' ? 'var(--bad)' : g.color}"></i></span>`; }).join('')}
      <button type="button" class="btn launch" data-launch ${c.ok ? '' : 'disabled'}>Далі</button>
    </div>`;

  root.querySelector('#back').addEventListener('click', () => app.go('briefing'));
  bindZoom(root, app);
  root.querySelectorAll('.choice').forEach((btn) => btn.addEventListener('click', () => select(app, r, btn)));
  const launch = () => { app.mission = null; app.dev = null; app.go('dev'); };
  root.querySelector('#launch').addEventListener('click', launch);
  root.querySelector('[data-launch]').addEventListener('click', launch);
  root.querySelector('#share').addEventListener('click', async () => {
    const url = missionUrl(build, app.seed);
    toast(await copyText(url) ? 'Посилання скопійовано' : url);
  });
}

function select(app, r, btn) {
  const { build, data } = app;
  const { field, id } = btn.dataset;
  if (btn.dataset.multi === 'true') {
    const list = build[field];
    build[field] = list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
  } else {
    build[field] = field === 'reserve' ? Number(id) : id;
  }
  if (field === 'platform') {
    // Прибираємо те, що не стає на нову платформу
    const r2 = resolveBuild(data, build);
    build.instruments = r2.instruments.filter((i) => fits(i, r2)).slice(0, r2.platform.slots).map((i) => i.id);
    if (r2.antenna && !fits(r2.antenna, r2)) build.antenna = null;
  }
  const y = window.scrollY;
  app.render();
  window.scrollTo(0, y);
}

function gauge(g, b, r, c) {
  const ratio = b.limit > 0 ? b.used / b.limit : (b.used > 0 ? 1.01 : 0);
  const width = Math.min(1, ratio) * 100;
  let note = '';
  if (g.key === 'budget') note = `${b.used <= b.limit ? `Залишок ${fmt(b.limit - b.used)} млн $` : `Перевищено на ${fmt(b.used - b.limit)} млн $`}. З них резерв ${fmt(c.cost.reserve)} млн $ (${r.reservePct}%)`;
  if (g.key === 'mass') note = r.rocket ? `Ракета везе до цілі ${fmt(b.limit)} кг` : 'Оберіть ракету';
  if (g.key === 'power') note = r.power ? `Вироблення біля цілі ${fmt(b.limit)} Вт` : 'Оберіть джерело енергії';
  if (g.key === 'data') note = r.antenna ? `Антена передасть ${fmt(b.limit)} Мбіт/добу` : 'Оберіть антену';
  return `
    <div class="gauge" data-status="${b.status}">
      <div class="gauge-head"><b>${g.name}</b><span class="num">${fmt(b.used)} / ${fmt(b.limit)} ${b.unit}</span></div>
      <div class="gauge-track" role="meter" aria-label="${g.name}" aria-valuemin="0" aria-valuemax="${Math.round(b.limit)}" aria-valuenow="${Math.round(b.used)}">
        <span class="gauge-warnzone"></span>
        <span class="gauge-fill" style="width:${width}%;background:${g.color}"></span>
      </div>
      <div class="gauge-note">${note}</div>
      <div class="formula eng-only">${formula(g.key, r, c)}</div>
    </div>`;
}

function formula(key, r, c) {
  const m = c.mass;
  if (key === 'mass') {
    if (!r.platform) return 'Оберіть платформу';
    let s = `Σ ${fmt(m.sum)} кг${r.risk.mass_mult !== 1 ? ` (клас ризику ×${fmt(r.risk.mass_mult, 2)})` : ''} + ${DESIGN_MARGIN * 100}% запасу = ${fmt(m.dry)} кг`;
    if (m.fuel) s += `<br>+ паливо (Ціолковський, Isp ${fmt(isSurface(r) ? 320 : r.propulsion.isp_s)} с): ${fmt(m.fuel)} кг`;
    if (m.edl) s += `<br>+ система входу й посадки ×${r.target.landing.edl_factor}: ${fmt(m.edl)} кг`;
    return s;
  }
  if (key === 'power') {
    if (!r.power || !r.platform) return 'Оберіть платформу і джерело енергії';
    if (r.power.type === 'solar') return `P = ${fmt(r.power.p1au_w)} Вт × 1/${r.target.sun_au}² × ${solarFactor(r)} (${isSurface(r) ? 'поверхня: ніч, кут, атмосфера' : 'орбіта: тінь планети'}) = ${fmt(c.produced)} Вт`;
    return `РІТЕГ: ${fmt(r.power.p0_w)} Вт × 0,96^роки`;
  }
  if (key === 'data') {
    if (!r.antenna) return 'Оберіть антену';
    if (r.antenna.relay) return `Ретранслятор: ~${fmt(r.antenna.relay_mbit_per_day)} Мбіт/добу`;
    return `R = ${r.antenna.rate_1au_mbps} Мбіт/с × 1/${fmt(c.dist, 3)}² × ${fmt(r.antenna.contact_h * r.dsn.hours_mult)} год сеансу`;
  }
  return c.cost.items.map((i) => `${({ rocket: 'ракета', platform: 'платформа', instruments: 'прилади', power: 'енергія', antenna: 'антена', extras: 'резерв', landing: 'посадка', operations: 'робота команди', cruise: 'супровід перельоту', propulsion: 'двигун', protection: 'планетарний захист' })[i.label]}: ${fmt(i.cost)}`).join(' · ');
}

function massBar(c) {
  if (!c.capacity && !c.mass.launch) return '';
  const total = Math.max(c.capacity, c.mass.launch, 1);
  const seg = (v, color, label) => (v > 0 ? `<span class="massbar-seg" style="width:${(v / total) * 100}%;background:${color}" title="${label}: ${fmt(v)} кг"></span>` : '');
  return `
    <div class="massbar">
      <div class="gauge-head"><b>Куди йдуть кілограми</b></div>
      <div class="massbar-track" style="margin-top:.4rem">
        ${seg(c.mass.sum, 'var(--mass)', 'Компоненти')}
        ${seg(c.mass.margin, 'color-mix(in srgb, var(--mass) 55%, var(--surface))', 'Запас 20%')}
        ${seg(c.mass.fuel, 'var(--fuel)', 'Паливо')}
        ${seg(c.mass.edl, 'var(--edl)', 'Система посадки')}
        ${c.capacity ? `<span class="massbar-cap" style="left:calc(${(c.capacity / total) * 100}% - 1px)" title="Вантажопідйомність до цілі"></span>` : ''}
      </div>
      <div class="massbar-legend">
        <span><i style="background:var(--mass)"></i>апарат ${fmt(c.mass.sum)}</span>
        <span><i style="background:color-mix(in srgb, var(--mass) 55%, var(--surface))"></i>запас</span>
        ${c.mass.fuel ? `<span><i style="background:var(--fuel)"></i>паливо ${fmt(c.mass.fuel)}</span>` : ''}
        ${c.mass.edl ? `<span><i style="background:var(--edl)"></i>посадка ${fmt(c.mass.edl)}</span>` : ''}
        ${c.capacity ? '<span>│ межа ракети</span>' : ''}
      </div>
    </div>`;
}
