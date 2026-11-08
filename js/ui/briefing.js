// Етап 1. Брифінг: ціль, клас місії, наукове завдання.
import { t, esc, fmt } from './dom.js';
import { sunShare } from '../calc.js';

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
          <button type="button" class="choice big" data-id="${esc(x.id)}" aria-pressed="${build.target === x.id}">
            <span class="choice-name">${t(x.name)}</span>
            <span class="choice-desc">${t(x.summary)}</span>
            <span class="choice-stats">
              <span>Політ: ${fmt(x.flight_days)} діб</span>
              <span class="stat-power">Сонце: ${Math.round(sunShare(x) * 100)}% земного</span>
            </span>
          </button>`).join('')}
      </div>
    </fieldset>

    <fieldset class="choice-group">
      <legend>Клас місії</legend>
      <p class="group-hint">Як у NASA: більше грошей — вищі очікування від науки. Бюджет включає ракету, апарат і роботу команди.</p>
      <div class="choices" data-field="cls">
        ${data.mission.classes.map((x) => `
          <button type="button" class="choice" data-id="${esc(x.id)}" aria-pressed="${build.cls === x.id}">
            <span class="choice-name">${t(x.name)}</span>
            <span class="choice-desc">${t(x.summary)}</span>
            <span class="choice-stats"><span class="stat-cost">Бюджет ${fmt(x.budget_musd)} млн $</span><span>Мета науки: ${fmt(x.science_target)}</span></span>
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
      const field = btn.parentElement.dataset.field;
      const changedTarget = field === 'target' && build.target !== btn.dataset.id;
      build[field] = btn.dataset.id;
      if (changedTarget) { build.antenna = null; build.rocket = null; build.instruments = build.instruments.filter((id) => id !== 'moxie'); }
      app.render();
    });
  });
  root.querySelector('#to-builder').addEventListener('click', () => app.go('builder'));
}
