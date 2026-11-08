// Етап 5. Підсумок: оцінка за трьома осями, причини, порівняння з реальною місією, фото NASA.
import { t, esc, fmt, pct, toast, missionUrl, copyText } from './dom.js';
import { score, reasons, comparison, mediaFor, OUTCOMES, TITLES } from '../explain.js';

export function render(root, app) {
  const m = app.mission;
  if (!m || !m.done) { app.go(m ? 'flight' : 'builder'); return; }
  const sc = score(m);
  const rs = reasons(m);
  const real = comparison(m);
  const media = mediaFor(m);
  const title = TITLES[sc.title];

  root.innerHTML = `
    <div class="summary-head">
      <div>
        <p class="outcome ${sc.outcome}">${OUTCOMES[sc.outcome]}</p>
        <h1>${esc(title.name)}</h1>
        <p class="muted">${esc(title.text)}</p>
      </div>
      <div class="total"><b class="num">${sc.total}</b><span class="muted small">загальна оцінка зі 100</span></div>
    </div>

    <div class="axes">
      ${axis('Наука', sc.science, `${fmt(m.s.science)} з очікуваних ${fmt(m.r.cls.science_target)}`, 'var(--data)')}
      ${axis('Ефективність бюджету', sc.efficiency, `${fmt(m.check.cost.total)} млн $ витрачено`, 'var(--budget)')}
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
        <p class="small muted" style="margin-top:1rem">Код місії <b>${esc(app.seed)}</b>. <button type="button" class="link-btn" data-act="share">Скопіювати посилання</button>, щоб друг зіграв з тими самими подіями.</p>
      </section>

      <div>
        ${photo(media, m)}
        ${real ? compareTable(m, real) : ''}
      </div>
    </div>`;

  root.querySelector('[data-act="rebuild"]').addEventListener('click', () => { app.mission = null; app.go('builder'); });
  root.querySelector('[data-act="retry"]').addEventListener('click', () => { app.newSeed(); app.mission = null; app.go('flight'); });
  root.querySelector('[data-act="new"]').addEventListener('click', () => { app.reset(); app.go('briefing'); });
  root.querySelector('[data-act="share"]').addEventListener('click', async () => {
    const url = missionUrl(app.build, app.seed);
    toast(await copyText(url) ? 'Посилання скопійовано' : url);
  });
  const img = root.querySelector('.photo img');
  if (img) img.addEventListener('error', () => { img.closest('.photo').innerHTML = placeholder(media); });
}

function axis(name, value, note, color) {
  return `<div class="axis panel" style="margin:0">
    <div class="gauge-head"><span>${name}</span><b class="num">${value}</b></div>
    <div class="gauge-track"><span class="gauge-fill" style="width:${Math.min(100, value / 1.5)}%;background:${color}"></span></div>
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
      ${media ? `<figcaption>${esc(media.caption)}. Фото: ${esc(media.credit)}. Справжній знімок NASA, подібний до того, що зробив би ваш апарат.</figcaption>` : ''}
    </figure></section>`;
}

function compareTable(m, real) {
  const c = m.check;
  const rows = [
    ['Рік запуску', '2026', real.year],
    ['Ракета', t(m.r.rocket.name), esc(real.rocket)],
    ['Маса на старті', `${fmt(c.mass.launch)} кг`, `${fmt(real.launch_mass_kg)} кг`],
    ['Маса апарата', `${fmt(c.mass.dry)} кг`, `${fmt(real.craft_mass_kg)} кг`],
    ['Вартість', `${fmt(c.cost.total)} млн $`, real.cost_musd ? `~${fmt(real.cost_musd)} млн $` : 'немає даних'],
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
