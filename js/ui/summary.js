// Етап 5. Підсумок: оцінка за трьома осями, причини, порівняння з реальною місією, фото NASA.
import { t, esc, fmt, pct, toast, missionUrl, copyText } from './dom.js';
import { score, reasons, comparison, mediaFor, OUTCOMES, TITLES } from '../explain.js';
import { patchSvg } from './visuals.js';
import { launchYear } from '../calc.js';
import { loadRecords, saveRecord, clearRecords } from './records.js';
import { tr } from '../i18n.js';

export function render(root, app) {
  const m = app.mission;
  if (!m || !m.done) { app.go(m ? 'flight' : 'builder'); return; }
  const sc = score(m);
  const rs = reasons(m);
  const real = comparison(m);
  const media = mediaFor(m);
  const title = TITLES[sc.title];
  if (app.demo) m.recordPlace = 0;   // демо-показ не потрапляє в рейтинг
  if (!m.recordPlace && m.recordPlace !== 0) {
    m.recordPlace = saveRecord({
      id: `${app.seed}:${JSON.stringify(app.build)}`, total: sc.total, title: title.name, outcome: sc.outcome,
      target: tr(m.r.target.name), cls: tr(m.r.cls.name), platform: tr(m.r.platform.name), seed: app.seed,
      date: new Date().toISOString().slice(0, 10),
    });
  }

  root.innerHTML = `
    <div class="summary-head">
      <div>
        <p class="outcome ${sc.outcome}">${OUTCOMES[sc.outcome]}</p>
        <h1>${esc(title.name)}</h1>
        <p class="muted">${esc(title.text)}</p>
      </div>
      <div class="summary-patch">
        ${patchSvg({ ...m.r, seed: app.seed, year: launchYear(m.r) }, 150)}
        <div class="total"><b class="num">${sc.total}</b><span class="muted small">загальна оцінка зі 100</span>
          <button type="button" class="link-btn" data-act="patch">Завантажити емблему</button></div>
      </div>
    </div>

    <div class="axes">
      ${axis('Наука', sc.science, `${fmt(m.s.science)} балів. Поріг ${fmt(m.r.cls.science_target * 0.6)}, база ${fmt(m.r.cls.science_target)} (риски на шкалі)`, 'var(--data)', [{ at: 60, label: 'Порогова місія' }, { at: 100, label: 'Базова місія' }])}
      ${axis('Ефективність бюджету', sc.efficiency, `${fmt(m.spent)} млн $ витрачено з ${fmt(m.r.cls.budget_musd)}`, 'var(--budget)')}
      ${axis('Надійність', sc.reliability, `${m.s.instruments.filter((i) => i.alive).length} з ${m.s.instruments.length} приладів працюють`, 'var(--mass)')}
    </div>

    <div class="two-col">
      <section class="panel">
        <h2>Чому так вийшло</h2>
        ${rs.main.length ? `<ol class="reasons">${rs.main.map((x) => `
          <li><span>${esc(x.text)}</span><span class="share">Втрачено ${pct(x.share)} можливої науки</span></li>`).join('')}</ol>`
          : '<p>Великих втрат не було: апарат зібрав майже все, що міг.</p>'}
        ${rs.extra.length ? `<ul class="notes">${rs.extra.map((x) => `<li class="${x.tone}">${esc(x.text)}</li>`).join('')}</ul>` : ''}
        <div class="btn-row">
          <button type="button" class="btn" data-act="rebuild">Змінити конструкцію</button>
          <button type="button" class="btn secondary" data-act="retry">Ця сама місія, нові події</button>
          <button type="button" class="btn secondary" data-act="new">Нова місія</button>
        </div>
        ${m.r.target.id === 'mars' && m.r.platform.type !== 'orbiter' && m.s.site && m.s.alive ? `
        <div class="colony-cta">
          <h3>Наступний крок: колонія на Марсі</h3>
          <p class="small">Апарат на поверхні. Спроєктуйте кисневий завод для першої експедиції з людьми.</p>
          <button type="button" class="btn" data-act="colony">Відкрити режим «Колонія»</button>
        </div>` : ''}
        <p class="small muted" style="margin-top:1rem">Код місії <b>${esc(app.seed)}</b>. <button type="button" class="link-btn" data-act="share">Скопіювати посилання</button>, щоб друг зіграв з тими самими подіями.</p>
      </section>

      <div>
        ${photo(media, m)}
        ${real ? compareTable(m, real) : ''}
        ${recordsTable(m.recordPlace)}
      </div>
    </div>`;

  root.querySelector('[data-act="rebuild"]').addEventListener('click', () => { app.mission = null; app.dev = null; app.go('builder'); });
  root.querySelector('[data-act="retry"]').addEventListener('click', () => { app.newSeed(); app.mission = null; app.dev = null; app.go('dev'); });
  root.querySelector('[data-act="new"]').addEventListener('click', () => { app.reset(); app.go('briefing'); });
  root.querySelector('[data-act="share"]').addEventListener('click', async () => {
    const url = missionUrl(app.build, app.seed);
    toast(await copyText(url) ? 'Посилання скопійовано' : url);
  });
  root.querySelector('[data-act="patch"]').addEventListener('click', () => {
    const svg = root.querySelector('.summary-patch svg').outerHTML.replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" ');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
    a.download = `emblema-misii-${app.seed}.svg`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });
  root.querySelector('[data-act="colony"]')?.addEventListener('click', () => app.go('colony'));
  root.querySelector('[data-act="clear-records"]')?.addEventListener('click', () => { clearRecords(); m.recordPlace = 0; app.render(); });
  const img = root.querySelector('.photo img');
  if (img) img.addEventListener('error', () => { img.closest('.photo').innerHTML = placeholder(media); });
}

function axis(name, value, note, color, marks = []) {
  return `<div class="axis panel" style="margin:0">
    <div class="gauge-head"><span>${name}</span><b class="num">${value}</b></div>
    <div class="gauge-track"><span class="gauge-fill" style="width:${Math.min(100, value / 1.5)}%;background:${color}"></span>
      ${marks.map((mk) => `<span class="th-mark" style="left:${mk.at / 1.5}%" title="${mk.label}"></span>`).join('')}</div>
    <div class="gauge-note">${esc(note)}</div>
  </div>`;
}

function placeholder(media) {
  return `<div class="placeholder">Тут буде справжній знімок NASA.<br>
    ${media?.search ? `<a href="${esc(media.search)}" target="_blank" rel="noopener">Знайти в NASA Image Library</a>` : ''}</div>`;
}

function photo(media, m) {
  if (m.s.lost && m.s.science < 1) return '';
  return `<section class="panel"><h2>Знімок з місії</h2>
    <figure class="photo">
      ${media ? `<img src="${esc(media.file)}" alt="${esc(media.caption)}" loading="lazy">` : placeholder(media)}
      ${media ? `<figcaption>${esc(media.title || media.caption)}. Фото: ${esc(media.credit)}${media.url ? ` (<a href="${esc(media.url)}" target="_blank" rel="noopener">NASA Image Library</a>)` : ''}. Справжній знімок NASA, подібний до того, що зробив би ваш апарат.</figcaption>` : ''}
    </figure></section>`;
}

function compareTable(m, real) {
  const c = m.check;
  const rows = [
    ['Рік запуску', launchYear(m.r), real.year],
    ['Ракета', t(m.r.rocket.name), esc(real.rocket)],
    ['Маса на старті', `${fmt(c.mass.launch)} кг`, `${fmt(real.launch_mass_kg)} кг`],
    ['Маса апарата', `${fmt(c.mass.dry)} кг`, `${fmt(real.craft_mass_kg)} кг`],
    ['Вартість', `${fmt(m.spent)} млн $`, real.cost_musd ? `~${fmt(real.cost_musd)} млн $` : 'немає даних'],
    ['Приладів', m.r.instruments.length, real.instruments],
    ['Енергія', t(m.r.power.name), esc(real.power)],
  ];
  return `<section class="panel"><h2>Ваша місія і ${esc(real.name)}</h2>
    <div class="table-wrap"><table class="compare">
      <thead><tr><th></th><th>Ваша</th><th><a href="${esc(real.source)}" target="_blank" rel="noopener">${esc(real.name)}</a></th></tr></thead>
      <tbody>${rows.map((r) => `<tr><th scope="row">${r[0]}</th><td>${r[1]}</td><td>${r[2]}</td></tr>`).join('')}</tbody>
    </table></div>
    <p class="small muted" style="margin-top:.5rem">Дані реальних місій орієнтовні; джерело за посиланням.</p>
  </section>`;
}

function recordsTable(place) {
  const list = loadRecords();
  if (!list.length) return '';
  return `<section class="panel"><h2>Ваші найкращі місії</h2>
    ${place ? `<p class="small">Ця місія на ${place}-му місці.</p>` : ''}
    <div class="table-wrap"><table class="compare">
      <thead><tr><th>Місце</th><th>Оцінка</th><th>Місія</th><th>Код</th></tr></thead>
      <tbody>${list.map((r, i) => `<tr${i + 1 === place ? ' class="is-new"' : ''}><td>${i + 1}</td><td class="num"><b>${r.total}</b></td>
        <td>${esc(r.title)}<br><span class="small muted">${esc(r.target)}, ${esc(r.cls)}, ${esc(r.platform)}</span></td><td>${esc(r.seed)}</td></tr>`).join('')}</tbody>
    </table></div>
    <p class="small muted" style="margin-top:.5rem">Рейтинг зберігається лише в цьому браузері. <button type="button" class="link-btn" data-act="clear-records">Очистити</button></p>
  </section>`;
}
