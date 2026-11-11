// Етап 1. Брифінг: ціль, клас місії, наукове завдання.
import { t, esc, fmt } from './dom.js';
import { sunShare, platformFits, byId, launchMonths, windowInfo, bestLaunch, flightDays } from '../calc.js';
import { thumbHtml, zoomButton, bindZoom } from './gallery.js';
import { dayWord } from '../i18n.js';

export function render(root, app) {
  const { data, build } = app;
  const ready = build.target && build.cls && build.goal;

  root.innerHTML = `
    <section class="briefing-hero">
      <h1>Ви головний інженер космічної місії</h1>
      <p>Оберіть ціль і завдання, зберіть апарат із реальних компонентів і проведіть його через політ.
      Ідеального рішення немає: кожен прилад дає науку, але важить, коштує і споживає енергію.</p>
    </section>

    <fieldset class="choice-group">
      <legend>Куди летимо?</legend>
      <div class="choices" data-field="target">
        ${data.targets.map((x) => `
          <div class="choice-wrap"><button type="button" class="choice big" data-id="${esc(x.id)}" aria-pressed="${build.target === x.id}">
            <span class="choice-art">${thumbHtml('target', x, app.data)}</span>
            <span class="choice-name">${t(x.name)}</span>
            <span class="choice-desc">${t(x.summary)}</span>
            <span class="choice-stats">
              <span>Політ у вікно: ${fmt(x.flight_days)} ${dayWord(x.flight_days)}</span>
              <span class="stat-power">Сонце: ${Math.round(sunShare(x) * 100)}% земного</span>
            </span>
          </button>${zoomButton('target', x)}</div>`).join('')}
      </div>
    </fieldset>

    ${build.target ? launchPicker(app) : ''}

    <fieldset class="choice-group">
      <legend>Клас місії</legend>
      <p class="group-hint">Як у NASA: більше грошей — вищі очікування від науки. Бюджет включає ракету, апарат і роботу команди.</p>
      <div class="choices" data-field="cls">
        ${data.mission.classes.map((x) => `
          <button type="button" class="choice" data-id="${esc(x.id)}" aria-pressed="${build.cls === x.id}">
            <span class="choice-name">${t(x.name)}</span>
            <span class="choice-desc">${t(x.summary)}</span>
            <span class="choice-stats"><span class="stat-cost">Бюджет ${fmt(x.budget_musd)} млн $</span><span>Мета науки: ${fmt(x.science_target)}</span></span>
          </button>`).join('')}
      </div>
    </fieldset>

    <fieldset class="choice-group">
      <legend>Наукове завдання</legend>
      <p class="group-hint">Від завдання залежить, які прилади найцінніші.</p>
      <div class="choices" data-field="goal">
        ${data.mission.goals.map((x) => `
          <button type="button" class="choice" data-id="${esc(x.id)}" aria-pressed="${build.goal === x.id}">
            <span class="choice-name">${t(x.name)}</span>
            <span class="choice-desc">${t(x.summary)}</span>
          </button>`).join('')}
      </div>
    </fieldset>

    <div class="btn-row">
      <button type="button" class="btn" id="to-builder" ${ready ? '' : 'disabled'}>Перейти до конструктора</button>
      ${ready ? '' : '<span class="muted small" style="align-self:center">Оберіть ціль, клас і завдання</span>'}
    </div>`;

  root.querySelectorAll('[data-field] .choice').forEach((btn) => {
    btn.addEventListener('click', () => {
      const field = btn.closest('[data-field]').dataset.field;
      const changedTarget = field === 'target' && build.target !== btn.dataset.id;
      build[field] = btn.dataset.id;
      if (changedTarget) {
        build.launch = bestLaunch(byId(app.data.targets, build.target));
        build.antenna = null;
        build.rocket = null;
        const target = byId(app.data.targets, build.target);
        const platform = byId(app.data.components.platforms, build.platform);
        if (platform && !platformFits(platform, target)) { build.platform = null; build.instruments = []; }
      }
      app.render();
    });
  });
  root.querySelectorAll('[data-month]').forEach((btn) => btn.addEventListener('click', () => {
    build.launch = btn.dataset.month;
    const y = window.scrollY; app.render(); window.scrollTo(0, y);
  }));
  root.querySelector('#to-builder').addEventListener('click', () => app.go('builder'));
  bindZoom(root, app);
}

const monthName = (ym, opts = { month: 'long', year: 'numeric' }) => new Date(`${ym}-15T00:00:00Z`).toLocaleDateString('uk-UA', { ...opts, timeZone: 'UTC' });

/** Шкала запуску: висота стовпчика — яку частку маси ракета довезе в цей місяць. */
function launchPicker(app) {
  const target = byId(app.data.targets, app.build.target);
  if (!app.build.launch) app.build.launch = bestLaunch(target);
  const sel = app.build.launch;
  const info = windowInfo(target, sel);
  const days = flightDays({ target, launch: sel });
  if (!target.window) {
    return `<fieldset class="choice-group"><legend>Дата запуску</legend>
      <p class="group-hint">До Місяця можна летіти будь-якого місяця: він завжди поруч. Політ ~${fmt(days)} ${dayWord(days)}.</p></fieldset>`;
  }
  const months = launchMonths();
  return `<fieldset class="choice-group">
    <legend>Дата запуску</legend>
    <p class="group-hint">Планети рухаються, тому найкоротший шлях відкривається лише у «вікна запуску». Поза вікном ракета везе менше, а політ довший. ${esc(target.window.note)}</p>
    <div class="windows" role="group" aria-label="Місяці запуску">
      ${months.map((ym) => { const f = windowInfo(target, ym).factor; const year = ym.endsWith('-01') || ym === months[0];
        return `<button type="button" class="win${ym === sel ? ' is-sel' : ''}" data-month="${ym}" aria-pressed="${ym === sel}"
          aria-label="${monthName(ym)}: ${Math.round(f * 100)}% маси" title="${monthName(ym)}: ${Math.round(f * 100)}% маси">
          <span class="win-bar" style="height:${Math.round(f * 100)}%;opacity:${0.35 + 0.65 * f}"></span>
          ${year ? `<span class="win-year">${ym.slice(0, 4)}</span>` : ''}</button>`; }).join('')}
    </div>
    <p class="win-info"><b>${esc(monthName(sel))}</b>: ракета довезе <b>${Math.round(info.factor * 100)}%</b> маси від найкращого вікна, політ ~${fmt(days)} ${dayWord(days)}.
    ${info.factor < 0.9 ? `<span class="muted">Найближче вікно: ${esc(monthName(info.best))}</span>` : ''}</p>
  </fieldset>`;
}
