// Мініатюри для карток вибору і вікно «Детальніше».
// Якщо в data/photos.json є фото (npm run images), показуємо його; інакше — точну ілюстрацію.
import { tr, dayWord } from '../i18n.js';
import { esc, t, fmt, pct } from './dom.js';
import { planetSvg, craftSvg } from './visuals.js';
import { rocketSvg } from './stack.js';
import { rocketReliability, capacityTo, sunShare } from '../calc.js';

const ink = 'currentColor';

/** Піктограми приладів і компонентів (viewBox 48×48). Нові прилади можуть задати "icon" в JSON. */
const GLYPHS = {
  camera: `<rect x="8" y="16" width="32" height="20" rx="3" fill="none" stroke="${ink}" stroke-width="2.5"/><circle cx="24" cy="26" r="7" fill="none" stroke="${ink}" stroke-width="2.5"/><circle cx="24" cy="26" r="2.5" fill="${ink}"/><rect x="14" y="11" width="9" height="5" rx="1" fill="${ink}"/>`,
  spectrometer: `<path d="M10 36 L24 10 L38 36 Z" fill="none" stroke="${ink}" stroke-width="2.5"/><path d="M2 22 L17 24" stroke="${ink}" stroke-width="2"/><path d="M31 25 L46 18" stroke="#c8352b" stroke-width="2"/><path d="M31 27 L46 25" stroke="#e7a93a" stroke-width="2"/><path d="M31 29 L46 32" stroke="#2e7d5b" stroke-width="2"/><path d="M31 31 L46 39" stroke="#3556a8" stroke-width="2"/>`,
  laser: `<rect x="4" y="10" width="16" height="10" rx="2" fill="none" stroke="${ink}" stroke-width="2.5"/><path d="M20 15 L38 34" stroke="#c8352b" stroke-width="2.5"/><path d="M30 40 H46" stroke="${ink}" stroke-width="2.5"/><circle cx="38" cy="34" r="3" fill="#e7a93a"/><path d="M38 34 l4 -4 M38 34 l5 1 M38 34 l1 -5" stroke="#e7a93a" stroke-width="1.5"/>`,
  massspec: `<rect x="6" y="18" width="10" height="12" rx="2" fill="none" stroke="${ink}" stroke-width="2.5"/><path d="M16 24 Q34 24 36 40" fill="none" stroke="#7b4ba6" stroke-width="2"/><path d="M16 24 Q30 24 30 40" fill="none" stroke="#3556a8" stroke-width="2"/><path d="M26 42 H42" stroke="${ink}" stroke-width="2.5"/>`,
  radar: `<path d="M8 40 L20 28" stroke="${ink}" stroke-width="3"/><path d="M14 38 a12 12 0 0 1 10 -16" fill="none" stroke="${ink}" stroke-width="2.5"/><path d="M26 18 a16 16 0 0 1 8 8" fill="none" stroke="${ink}" stroke-width="2"/><path d="M28 12 a24 24 0 0 1 12 12" fill="none" stroke="${ink}" stroke-width="2"/><path d="M30 6 a32 32 0 0 1 16 16" fill="none" stroke="${ink}" stroke-width="2"/>`,
  gpr: `<rect x="10" y="8" width="28" height="10" rx="2" fill="none" stroke="${ink}" stroke-width="2.5"/><path d="M4 22 H44" stroke="${ink}" stroke-width="2"/><path d="M14 28 Q24 24 34 28 M10 34 Q24 28 38 34 M8 40 Q24 34 40 40" fill="none" stroke="${ink}" stroke-width="1.8"/>`,
  neutron: `<circle cx="24" cy="24" r="4" fill="${ink}"/><ellipse cx="24" cy="24" rx="18" ry="7" fill="none" stroke="${ink}" stroke-width="2"/><ellipse cx="24" cy="24" rx="18" ry="7" fill="none" stroke="${ink}" stroke-width="2" transform="rotate(60 24 24)"/><ellipse cx="24" cy="24" rx="18" ry="7" fill="none" stroke="${ink}" stroke-width="2" transform="rotate(-60 24 24)"/>`,
  magnetometer: `<path d="M14 10 V26 a10 10 0 0 0 20 0 V10" fill="none" stroke="${ink}" stroke-width="5"/><path d="M10 10 H18 M30 10 H38" stroke="#c8352b" stroke-width="5"/>`,
  seismometer: `<path d="M12 22 a12 12 0 0 1 24 0 Z" fill="none" stroke="${ink}" stroke-width="2.5"/><path d="M4 34 H12 L15 28 L19 42 L23 26 L27 40 L31 30 L34 34 H44" fill="none" stroke="${ink}" stroke-width="2"/>`,
  weather: `<path d="M24 44 V10" stroke="${ink}" stroke-width="2.5"/><path d="M24 12 L40 16 L24 20 Z" fill="${ink}"/><circle cx="14" cy="30" r="4" fill="none" stroke="${ink}" stroke-width="2"/><path d="M14 18 V26" stroke="${ink}" stroke-width="2"/>`,
  drill: `<rect x="18" y="4" width="12" height="12" rx="2" fill="none" stroke="${ink}" stroke-width="2.5"/><path d="M21 16 V36 L24 44 L27 36 V16" fill="none" stroke="${ink}" stroke-width="2.5"/><path d="M21 22 L27 26 M21 28 L27 32" stroke="${ink}" stroke-width="1.8"/>`,
  oxygen: `<circle cx="24" cy="24" r="17" fill="none" stroke="${ink}" stroke-width="2.5"/><text x="24" y="30" font-size="15" font-weight="700" text-anchor="middle" fill="${ink}" font-family="sans-serif">O₂</text>`,
  lidar: `<rect x="16" y="4" width="16" height="10" rx="2" fill="none" stroke="${ink}" stroke-width="2.5"/><path d="M20 14 L10 40 M24 14 V40 M28 14 L38 40" stroke="#c8352b" stroke-width="1.8" stroke-dasharray="3 3"/><path d="M4 42 Q14 38 24 42 T44 40" fill="none" stroke="${ink}" stroke-width="2"/>`,
  arm: `<path d="M6 10 L22 22 L30 38" fill="none" stroke="${ink}" stroke-width="3.5" stroke-linecap="round"/><circle cx="22" cy="22" r="3" fill="${ink}"/><path d="M24 38 H36 L33 44 H27 Z" fill="${ink}"/>`,
  solar: `<rect x="4" y="14" width="40" height="20" fill="#2b4a8a" stroke="#9fb4e0"/><path d="M14 14 V34 M24 14 V34 M34 14 V34 M4 24 H44" stroke="#9fb4e0" stroke-width="1.2"/>`,
  rtg: `<rect x="17" y="6" width="14" height="36" rx="3" fill="#6b6f78"/><path d="M9 12 H39 M9 20 H39 M9 28 H39 M9 36 H39" stroke="#6b6f78" stroke-width="3"/>`,
  dish: `<path d="M8 14 Q24 40 40 14" fill="#f3efe4" stroke="${ink}" stroke-width="2.5"/><path d="M24 27 V44 M18 44 H30" stroke="${ink}" stroke-width="2.5"/><path d="M24 27 L24 10" stroke="${ink}" stroke-width="1.5"/>`,
  smalldish: `<path d="M16 20 Q24 32 32 20" fill="#f3efe4" stroke="${ink}" stroke-width="2.5"/><path d="M24 26 V42 M18 42 H30" stroke="${ink}" stroke-width="2.5"/>`,
  lga: `<path d="M24 42 V14" stroke="${ink}" stroke-width="3"/><circle cx="24" cy="11" r="5" fill="${ink}"/><path d="M16 6 a12 12 0 0 0 0 10 M32 6 a12 12 0 0 1 0 10" fill="none" stroke="${ink}" stroke-width="1.8"/>`,
  relay: `<path d="M12 40 V12" stroke="${ink}" stroke-width="2.5"/><path d="M8 14 l8 -4 l-8 -4 M8 22 l8 -4 l-8 -4 M8 30 l8 -4 l-8 -4" fill="none" stroke="${ink}" stroke-width="1.8"/><rect x="30" y="8" width="12" height="8" rx="1" fill="#d4a84a"/><path d="M26 12 H30 M42 12 H46" stroke="#2b4a8a" stroke-width="3"/><path d="M18 26 Q26 22 32 18" fill="none" stroke="${ink}" stroke-dasharray="2 3"/>`,
  shield: `<path d="M24 4 L40 10 V24 Q40 36 24 44 Q8 36 8 24 V10 Z" fill="#9aa0aa" stroke="${ink}" stroke-width="2"/><path d="M18 24 L22 28 L31 18" fill="none" stroke="#fff" stroke-width="3"/>`,
  battery: `<rect x="8" y="14" width="30" height="20" rx="3" fill="none" stroke="${ink}" stroke-width="2.5"/><rect x="38" y="20" width="4" height="8" fill="${ink}"/><rect x="12" y="18" width="18" height="12" fill="#2e7d5b"/>`,
  backup: `<path d="M8 14 Q18 32 28 14" fill="#f3efe4" stroke="${ink}" stroke-width="2"/><path d="M22 22 Q32 40 42 22" fill="#f3efe4" stroke="${ink}" stroke-width="2"/><path d="M18 23 V40 M32 31 V44" stroke="${ink}" stroke-width="2"/>`,
};
const ID_GLYPH = {
  cam_hires: 'camera', panorama_cam: 'camera', ir_spectrometer: 'spectrometer', laser_spectrometer: 'laser', mass_spectrometer: 'massspec',
  orbital_radar: 'radar', sar: 'radar', gpr: 'gpr', neutron: 'neutron', magnetometer: 'magnetometer', seismometer: 'seismometer',
  weather: 'weather', drill: 'drill', moxie: 'oxygen', lidar: 'lidar', sample_arm: 'arm',
  lga: 'lga', hga_small: 'smalldish', hga_large: 'dish', relay_uhf: 'relay',
  backup_antenna: 'backup', big_battery: 'battery', radiation_vault: 'shield',
};

function glyph(kind, item) {
  const key = item.icon || ID_GLYPH[item.id] || (kind === 'power' ? (item.type === 'rtg' ? 'rtg' : 'solar') : 'camera');
  return `<svg viewBox="0 0 48 48" class="glyph" aria-hidden="true">${GLYPHS[key] || GLYPHS.camera}</svg>`;
}

/** Ілюстрація елемента (без фото). */
export function illustration(kind, item, big = false) {
  if (kind === 'rocket') return rocketSvg(item, { className: big ? 'rocket-big' : 'rocket-thumb' });
  if (kind === 'target') return planetSvg(item, big ? 220 : 64);
  if (kind === 'platform') {
    const stub = { platform: item, instruments: [], extras: [], power: item.type === 'rover' ? null : { id: 'solar_m', type: 'solar' }, antenna: { id: item.type === 'orbiter' ? 'hga_large' : 'hga_small' }, target: null };
    return craftSvg(stub, '', { track: false });
  }
  return glyph(kind, item);
}

export const photoOf = (data, id) => (data.photos && data.photos[id] && data.photos[id].file ? data.photos[id] : null);

/** Мініатюра для картки: фото, якщо є, інакше ілюстрація. */
export function thumbHtml(kind, item, data) {
  const ph = photoOf(data, item.id);
  const ill = `<span class="thumb-ill thumb-${kind}">${illustration(kind, item)}</span>`;
  if (!ph) return `<span class="thumb">${ill}</span>`;
  return `<span class="thumb"><img src="${esc(ph.file)}" alt="" loading="lazy" onerror="this.remove()">${ill}</span>`;
}

/** Кнопка «Детальніше» поверх картки. */
export function zoomButton(kind, item) {
  return `<button type="button" class="zoom" data-zoom-kind="${kind}" data-zoom-id="${esc(item.id)}" aria-label="Детальніше: ${esc(tr(item.name))}" title="Детальніше">
    <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6" fill="none" stroke="currentColor" stroke-width="2"/><path d="M15 15 L20 20" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg></button>`;
}

const LISTS = (d) => ({
  rocket: d.rockets, target: d.targets, platform: d.components.platforms, instrument: d.components.instruments,
  power: d.components.power, antenna: d.components.antennas, extra: d.components.extras,
});

function specRows(kind, x, ctx) {
  const rows = [];
  const add = (k, v) => { if (v !== undefined && v !== null && v !== '') rows.push([k, v]); };
  if (kind === 'rocket') {
    add('Висота', x.visual ? `${fmt(x.visual.height_m)} м` : '');
    add('Діаметр обтічника', x.visual ? `${fmt(x.visual.fairing_d_m, 1)} м` : '');
    add('На низьку орбіту', `${fmt(x.leo_kg)} кг`);
    if (ctx.target) add(`До цілі «${tr(ctx.target.name)}»`, `${fmt(capacityTo(x, ctx.target, ctx.launch))} кг`);
    add('Ціна запуску', `${fmt(x.cost_musd)} млн $`);
    add('Історія польотів', `${x.successes} успішних з ${x.flights}`);
    add('Надійність (правило Лапласа)', pct(rocketReliability(x)));
    add('Виробник', x.maker);
  } else if (kind === 'target') {
    add('Відстань від Сонця', `${x.sun_au} а.о.`);
    add('Сонячного світла', `${Math.round(sunShare(x) * 100)}% земного`);
    add('Політ у найкраще вікно', `${fmt(x.flight_days)} ${dayWord(x.flight_days)}`);
    add('Вікна запуску', x.window ? tr(x.window.note) : 'будь-коли');
    add('Посадка', { aeroshell: 'через атмосферу: теплозахист і парашут', propulsive: 'на двигунах', none: 'неможлива, лише орбіта' }[x.landing.type]);
  } else {
    add('Прототип', x.prototype);
    add('Маса', x.mass_kg !== undefined ? `${fmt(x.mass_kg)} кг` : '');
    add('Ціна', x.cost_musd !== undefined ? `${fmt(x.cost_musd)} млн $` : '');
    if (kind === 'instrument') {
      add('Потужність', `${fmt(x.power_w)} Вт, працює ${pct(x.duty)} часу`);
      add('Дані', `${fmt(x.data_mbit_per_day)} Мбіт на добу`);
      add('Надійність за місію', pct(x.reliability));
      add('Цінність для завдань', ctx.data.mission.goals.map((g) => `${tr(g.name)}: ${'★'.repeat(Math.round(x.weights[g.id] || 0)) || '·'}`).join('; '));
      add('Ставиться на', x.platforms.map((p) => ({ orbiter: 'орбітер', lander: 'посадкову станцію', rover: 'ровер' }[p])).join(', '));
    }
    if (kind === 'platform') {
      add('Споживання платформи', `${fmt(x.bus_power_w)} Вт`);
      add('Місць для приладів', x.slots);
      add('Робота команди', `${fmt(x.ops_musd_per_step)} млн $ за крок`);
    }
    if (kind === 'power') add('Потужність', x.type === 'solar' ? `${fmt(x.p1au_w)} Вт біля Землі; біля Марса ~${fmt(x.p1au_w * 0.43)} Вт, біля Юпітера ~${fmt(x.p1au_w * 0.037)} Вт` : `${fmt(x.p0_w)} Вт удень і вночі, −4% на рік`);
    if (kind === 'antenna') add('Швидкість', x.relay ? `~${fmt(x.relay_mbit_per_day)} Мбіт на добу через орбітер` : `${x.rate_1au_mbps} Мбіт/с на відстані 1 а.о., падає з квадратом відстані`);
  }
  add('Що спрощено в грі', x.simplified);
  if (x.prototype_facts) add('Реальний прототип', x.prototype_facts);
  return rows;
}

/** Відкрити вікно «Детальніше». */
export function openViewer(app, kind, id) {
  const dlg = document.getElementById('viewer');
  const item = (LISTS(app.data)[kind] || []).find((x) => x.id === id);
  if (!dlg || !item) return;
  const ph = photoOf(app.data, id);
  const ctx = { data: app.data, target: app.data.targets.find((x) => x.id === app.build.target), launch: app.build.launch };
  const desc = item.summary || item.note;
  dlg.querySelector('#viewer-title').textContent = tr(item.name);
  dlg.querySelector('#viewer-body').innerHTML = `
    <figure class="viewer-media">
      ${ph ? `<img src="${esc(ph.file)}" alt="${esc(ph.title || tr(item.name))}" onerror="this.closest('figure').classList.add('no-photo')">` : ''}
      <div class="viewer-ill${ph ? ' behind' : ''}">${illustration(kind, item, true)}</div>
      <figcaption>${ph ? `${esc(ph.title || '')}${ph.credit ? ` Фото: ${esc(ph.credit)}.` : ''} ${ph.url ? `<a href="${esc(ph.url)}" target="_blank" rel="noopener">Відкрити в NASA Image Library</a>` : ''}`
        : 'Ілюстрація гри. Фото NASA з’явиться після <code>npm run images</code>.'}</figcaption>
    </figure>
    <div class="viewer-info">
      ${desc ? `<p>${t(desc)}</p>` : ''}
      <table class="compare"><tbody>${specRows(kind, item, ctx).map(([k, v]) => `<tr><th scope="row">${esc(k)}</th><td>${esc(v)}</td></tr>`).join('')}</tbody></table>
      ${item.verified ? `<p class="verified small">✓ ${esc(item.verified.note)} ${(item.verified.urls || []).map((u, i) => `<a href="${esc(u)}" target="_blank" rel="noopener">джерело${item.verified.urls.length > 1 ? ` ${i + 1}` : ''}</a>`).join(' ')}</p>`
        : '<p class="unverified small">Значення орієнтовні й ще не звірені з джерелом.</p>'}
      ${item.source ? `<p class="small" style="margin-top:.4rem"><a href="${esc(item.source)}" target="_blank" rel="noopener">Сторінка прототипу</a></p>` : ''}
    </div>`;
  dlg.showModal();
}

/** Підключити всі кнопки «Детальніше» в межах root. */
export function bindZoom(root, app) {
  root.querySelectorAll('[data-zoom-kind]').forEach((b) => b.addEventListener('click', (e) => {
    e.stopPropagation();
    openViewer(app, b.dataset.zoomKind, b.dataset.zoomId);
  }));
}
