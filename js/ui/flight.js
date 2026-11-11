// Етапи 3–4. Запуск, переліт і центр керування з рішеннями гравця.
import { t, esc, fmt, pct } from './dom.js';
import { Mission } from '../sim.js';
import { logText, decisionText, optionInfo, eventFact, factSource } from '../explain.js';
import { busPower, instrumentPower, opsSteps } from '../calc.js';
import { orbitSvg, countdown } from './visuals.js';
import { rocketSvg } from './stack.js';
import { sfx } from './sound.js';
import { dayWord } from '../i18n.js';

export function render(root, app) {
  if (!app.dev || !app.dev.done || app.dev.cancelled) { app.go('dev'); return; }
  if (!app.mission) app.mission = new Mission(app.data, app.dev.build, app.seed, app.dev);
  const m = app.mission;
  const started = m.entries.length > 0;
  const last = m.timeline[m.timeline.length - 1];

  root.innerHTML = `
    <div class="flight">
      <div>
        <h1>${started ? 'Центр керування' : 'Готовність до старту'}</h1>
        <p class="muted">${t(m.r.target.name)} · ${t(m.r.platform.name)} · ${t(m.r.rocket.name)} · код ${esc(app.seed)}</p>
        ${m.pending ? decisionPanel(m) : controls(m, started)}
        ${telemetry(m, last)}
      </div>
      <div>
        <section class="panel" aria-live="polite">
          <h2>Журнал місії</h2>
          ${started ? `<ol class="log" reversed>${[...m.entries].reverse().map((e) => logItem(e, m)).join('')}</ol>` : '<p class="muted">Журнал почнеться після старту.</p>'}
        </section>
      </div>
    </div>`;

  root.querySelector('[data-act="step"]')?.addEventListener('click', (e) => {
    if (!started) { e.currentTarget.disabled = true; countdown(() => { m.advance(); after(m, app); }, sfx, rocketSvg(m.r.rocket, { flame: true, className: 'rocket' })); return; }
    m.advance(); after(m, app);
  });
  root.querySelector('[data-act="run"]')?.addEventListener('click', () => {
    let guard = 0;
    while (!m.done && !m.pending && guard++ < 200) m.advance();
    after(m, app);
  });
  root.querySelector('[data-act="summary"]')?.addEventListener('click', () => app.go('summary'));
  root.querySelector('[data-act="rebuild"]')?.addEventListener('click', () => { app.mission = null; app.dev = null; app.go('builder'); });
  root.querySelectorAll('[data-option]').forEach((b) => b.addEventListener('click', () => {
    m.choose(b.dataset.option);
    m.advance();
    after(m, app);
  }));
}

/** Після кожної дії: звук за подією і перемальовування. */
function after(m, app) {
  if (m.pending) sfx.decision();
  else if (m.done) (m.s.lost ? sfx.bad : sfx.good)();
  app.render();
}

function controls(m, started) {
  if (m.done) {
    return `<section class="panel">
      <h2>${m.s.lost ? 'Зв’язок з апаратом втрачено' : 'Місію завершено'}</h2>
      <div class="btn-row"><button type="button" class="btn" data-act="summary">Подивитися підсумок</button></div>
    </section>`;
  }
  if (!started) {
    return `<section class="panel">
      <p>Усі системи в нормі. Після старту зупинити місію вже не вийде.</p>
      <div class="btn-row">
        <button type="button" class="btn launch" data-act="step">Старт</button>
        <button type="button" class="btn secondary" data-act="rebuild">Повернутися до конструктора</button>
      </div>
    </section>`;
  }
  const phaseName = { cruise: 'Переліт', arrival: 'Прибуття', ops: 'Наукова програма', end: 'Завершення' }[m.s.phase] || '';
  return `<section class="panel">
    <h2>${phaseName}</h2>
    <div class="btn-row" style="margin-top:0">
      <button type="button" class="btn" data-act="step">Наступний крок</button>
      <button type="button" class="btn secondary" data-act="run">Летіти до наступного рішення</button>
    </div>
  </section>`;
}

function decisionPanel(m) {
  const d = m.pending;
  const info = decisionText(d, m);
  const map = d.id === 'site' ? siteMap(m) : '';
  return `<section class="panel decision" role="dialog" aria-labelledby="dec-title">
    <h2 id="dec-title">${esc(info.title)}</h2>
    <p>${esc(info.text)}</p>
    ${map}
    <div class="options">
      ${d.options.map((o) => { const oi = optionInfo(d.id, o, m); return `
        <button type="button" class="choice" data-option="${esc(o.id)}">
          <span class="choice-name">${esc(oi.label)}</span>
          <span class="choice-desc">${esc(oi.hint)}</span>
        </button>`; }).join('')}
    </div>
  </section>`;
}

function siteMap(m) {
  const sites = m.r.target.sites;
  const map = (m.data.media.maps || []).find((x) => x.target === m.r.target.id);
  const isMars = m.r.target.id === 'mars';
  const W = 400; const H = 200;
  const X = (lon) => ((lon + 180) / 360) * W;   // проста рівнопроміжна проєкція
  const Y = (lat) => ((90 - lat) / 180) * H;
  const grid = [];
  for (let lon = -120; lon <= 120; lon += 60) grid.push(`<line x1="${X(lon)}" x2="${X(lon)}" y1="0" y2="${H}"/>`);
  for (let lat = -60; lat <= 60; lat += 30) grid.push(`<line x1="0" x2="${W}" y1="${Y(lat)}" y2="${Y(lat)}"/>`);
  return `<svg class="sitemap" viewBox="0 0 ${W} ${H}" role="img" aria-label="Схема майданчиків посадки за реальними координатами">
    <defs><linearGradient id="shade" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity=".3"/><stop offset=".5" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".4"/></linearGradient></defs>
    <rect width="${W}" height="${H}" rx="8" fill="${isMars ? '#a65a35' : '#7d838e'}"/>
    ${map ? `<clipPath id="mapclip"><rect width="${W}" height="${H}" rx="8"/></clipPath>
    <image href="${esc(map.file)}" width="${W}" height="${H}" preserveAspectRatio="none" clip-path="url(#mapclip)"/>` : ''}
    <rect width="${W}" height="${H}" rx="8" fill="url(#shade)"/>
    <g stroke="#fff" stroke-opacity=".18" stroke-width="1">${grid.join('')}</g>
    ${sites.map((s) => {
      const x = X(s.lon); const y = Math.min(H - 14, Math.max(14, Y(s.lat))); const rr = 5 + s.risk * 35;
      const left = x > W * 0.7;
      return `<g><circle cx="${x}" cy="${y}" r="${rr}" fill="#fff" fill-opacity=".2" stroke="#fff" stroke-width="1.5"/>
        <circle cx="${x}" cy="${y}" r="2.5" fill="#fff"/>
        <text x="${left ? x - rr - 5 : x + rr + 5}" y="${y + 4}" fill="#fff" stroke="#000" stroke-opacity=".55" stroke-width="3" paint-order="stroke" font-size="12" text-anchor="${left ? 'end' : 'start'}" font-family="IBM Plex Sans, sans-serif">${t(s.name)}</text></g>`;
    }).join('')}
  </svg>
  <p class="small muted" style="text-align:center;margin-top:.3rem">Реальні координати, сітка через 30° і 60°. Розмір кола — ризик посадки.${map?.credit ? ` Карта: ${esc(map.credit)}.` : ''}</p>`;
}

function telemetry(m, last) {
  const s = m.s;
  const total = s.steps;
  const done = m.timeline.length;
  const cells = Array.from({ length: total }, (_, i) => {
    const cls = i < done ? 'done' : (s.lost && i === done ? 'lost' : '');
    return `<span class="${cls} ${i >= opsSteps(m.r) ? 'ext' : ''}" title="Крок ${i + 1}"></span>`;
  }).join('');
  const need = busPower(m.r) + instrumentPower(m.aliveInstruments);
  const target = m.r.cls.science_target;
  return `<section class="panel">
    <h2>Телеметрія</h2>
    <figure class="orbit-wrap">${orbitSvg(m.r.target, s.phase === 'launch' || s.phase === 'cruise' ? 0 : done * m.r.target.step_days)}</figure>
    <div class="track" aria-label="Кроки наукової програми: ${done} з ${total}">${cells}</div>
    <dl class="tele">
      <div><dt>Наука</dt><dd><span class="science-big num">${fmt(s.science)}</span> <span class="muted small">з ${fmt(target)}</span></dd></div>
      <div><dt>Крок</dt><dd>${done} з ${total} <span class="muted small">(${fmt(m.r.target.step_days)} ${dayWord(m.r.target.step_days)} кожен)</span></dd></div>
      <div><dt>Енергія</dt><dd>${last ? `${fmt(last.produced)} Вт з потрібних ${fmt(need)} Вт` : '—'}</dd></div>
      <div><dt>Прилади працюють</dt><dd>${last ? pct(last.u) : '—'} часу</dd></div>
      <div><dt>Дані за крок</dt><dd>${last && last.collected ? `передано ${pct(last.sent / last.collected)} з ${fmt(last.collected / 1000, 1)} Гбіт` : '—'}</dd></div>
      <div><dt>Відстань до Землі</dt><dd>${last ? `${fmt(last.dist, last.dist < 0.01 ? 4 : 2)} а.о.` : '—'}</dd></div>
      ${m.r.power.type === 'solar' && m.r.target.dust_per_step > 0 && m.r.platform.type !== 'orbiter' ? `<div><dt>Чистота панелей</dt><dd>${pct(s.dust)}</dd></div>` : ''}
      <div><dt>Антена</dt><dd>${t(s.antenna.name)}</dd></div>
    </dl>
    <div class="chips" aria-label="Стан приладів">
      ${s.instruments.map((i) => `<span class="chip ${i.alive ? '' : 'dead'}">${t(i.def.name)}</span>`).join('')}
    </div>
  </section>`;
}

function logItem(e, m) {
  const text = logText(e, m);
  if (!text) return '';
  const src = factSource(e, m);
  const stepTag = e.phase === 'ops' || e.phase === 'end' ? `<span class="step-tag">крок ${e.step}</span>` : '';
  if (e.code === 'fact') {
    return `<li class="fact"><span class="fact-label">Це сталося насправді</span>${esc(text)} ${src ? `<a href="${esc(src)}" target="_blank" rel="noopener">Джерело</a>` : ''}</li>`;
  }
  const fact = eventFact(e);
  return `<li class="${e.tone}">${stepTag}${esc(text)}${fact ? `<span class="fact-label" style="margin-top:.3rem">Це сталося насправді</span><span class="small">${esc(fact)} ${src ? `<a href="${esc(src)}" target="_blank" rel="noopener">Джерело</a>` : ''}</span>` : ''}</li>`;
}
