// Ілюстрації гри: планети, емблема місії, схема орбіт.
// Усе малюється в SVG з даних, тому нова ціль отримує свою картинку через поле "visual" у targets.json.
import { tr } from '../i18n.js';
import { phaseDeg, earthDistanceAu } from '../calc.js';
import { esc, fmt } from './dom.js';

let uid = 0;
const nextId = (p) => `${p}${++uid}`;
const DEFAULT_VISUAL = { light: '#cfd6e2', base: '#8a96ab', dark: '#3d4658', features: 'none' };

function planetBody(target, cx, cy, r, id) {
  const v = target?.visual || DEFAULT_VISUAL;
  const g = `${id}-g`;
  let features = '';
  if (v.features === 'mars') {
    features = `
      <ellipse cx="${cx - r * 0.25}" cy="${cy - r * 0.1}" rx="${r * 0.38}" ry="${r * 0.14}" fill="${v.dark}" opacity=".35" transform="rotate(-12 ${cx} ${cy})"/>
      <ellipse cx="${cx + r * 0.3}" cy="${cy + r * 0.35}" rx="${r * 0.28}" ry="${r * 0.1}" fill="${v.dark}" opacity=".3"/>
      <ellipse cx="${cx}" cy="${cy - r * 0.86}" rx="${r * 0.32}" ry="${r * 0.1}" fill="#fff" opacity=".75"/>`;
  } else if (v.features === 'rubble') {
    features = `<ellipse cx="${cx}" cy="${cy + r * 0.05}" rx="${r}" ry="${r * 0.12}" fill="${v.light}" opacity=".25"/>` +
      [[-0.4, -0.35, 0.13], [0.3, -0.2, 0.09], [0.05, 0.4, 0.15], [-0.2, 0.1, 0.07], [0.5, 0.3, 0.08], [-0.55, 0.35, 0.06], [0.15, -0.55, 0.07]]
        .map(([x, y, sz]) => `<circle cx="${cx + x * r}" cy="${cy + y * r}" r="${sz * r}" fill="${v.dark}" opacity=".5"/><circle cx="${cx + x * r - sz * r * 0.3}" cy="${cy + y * r - sz * r * 0.3}" r="${sz * r * 0.4}" fill="${v.light}" opacity=".35"/>`).join('');
  } else if (v.features === 'clouds') {
    features = [-0.55, -0.25, 0.05, 0.35, 0.62].map((y, k) => `<ellipse cx="${cx + (k % 2 ? 0.15 : -0.1) * r}" cy="${cy + y * r}" rx="${r * 1.1}" ry="${r * 0.11}" fill="${k % 2 ? v.light : v.dark}" opacity=".25" transform="rotate(-8 ${cx} ${cy})"/>`).join('');
  } else if (v.features === 'ice') {
    features = ['M -0.9 -0.3 Q -0.2 -0.1 0.8 -0.5', 'M -0.7 0.4 Q 0 0.1 0.9 0.3', 'M -0.4 -0.8 Q -0.1 0 0.2 0.9', 'M 0.3 -0.9 Q 0.5 -0.1 0.4 0.8']
      .map((d) => `<path d="${d.replace(/(-?\d+\.?\d*) (-?\d+\.?\d*)/g, (_, x, y) => `${cx + x * r} ${cy + y * r}`)}" fill="none" stroke="${v.dark}" stroke-width="${r * 0.04}" opacity=".7"/>`).join('');
  } else if (v.features === 'craters') {
    features = [[-0.35, -0.3, 0.16], [0.25, 0.1, 0.22], [-0.1, 0.45, 0.12], [0.4, -0.45, 0.09], [-0.5, 0.2, 0.08]]
      .map(([x, y, s]) => `<circle cx="${cx + x * r}" cy="${cy + y * r}" r="${s * r}" fill="${v.dark}" opacity=".28"/>`).join('');
  }
  return `
    <defs><radialGradient id="${g}" cx="35%" cy="32%" r="75%">
      <stop offset="0" stop-color="${v.light}"/><stop offset=".55" stop-color="${v.base}"/><stop offset="1" stop-color="${v.dark}"/>
    </radialGradient>
    <clipPath id="${id}-c"><circle cx="${cx}" cy="${cy}" r="${r}"/></clipPath></defs>
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#${g})"/>
    <g clip-path="url(#${id}-c)">${features}
      <circle cx="${cx + r * 0.55}" cy="${cy + r * 0.35}" r="${r * 1.05}" fill="#000" opacity=".22"/></g>`;
}

/** Невелика ілюстрація планети для картки цілі. */
export function planetSvg(target, size = 64) {
  const id = nextId('pl');
  return `<svg class="planet" width="${size}" height="${size}" viewBox="0 0 100 100" aria-hidden="true">${planetBody(target, 50, 50, 46, id)}</svg>`;
}

/**
 * Емблема місії, як нашивки NASA: кільце кольору класу, ціль, тип апарата,
 * зірки за кількістю приладів і код місії.
 */
export function patchSvg({ target, cls, platform, instruments = [], seed = '', year = 2026 }, size = 200) {
  const id = nextId('pt');
  const ring = cls?.color || '#566176';
  const top = target ? `${tr(target.name)} · ${year}` : 'Нова місія';
  const bottom = seed ? `Місія ${seed}` : 'Архітектор місії';
  const stars = [[78, 70], [100, 58], [124, 54], [148, 60], [168, 74], [88, 92]].slice(0, Math.min(6, instruments.length));
  const px = 146; const py = 160; const pr = 44;
  let craft = '';
  if (platform?.type === 'orbiter') {
    craft = `<ellipse cx="${px}" cy="${py}" rx="${pr + 16}" ry="${pr * 0.35}" fill="none" stroke="#fff" stroke-width="2" stroke-dasharray="4 4" transform="rotate(-18 ${px} ${py})"/>
      <rect x="${px - pr - 20}" y="${py - 4}" width="12" height="8" fill="#fff" transform="rotate(-18 ${px} ${py})"/>`;
  } else if (platform?.type === 'lander') {
    craft = `<g transform="translate(${px - 6} ${py - pr - 12})" fill="#fff" stroke="#fff" stroke-width="2">
      <rect x="0" y="0" width="14" height="8" rx="1"/><line x1="2" y1="8" x2="-4" y2="14"/><line x1="12" y1="8" x2="18" y2="14"/>
      <line x1="-14" y1="2" x2="0" y2="4"/><line x1="28" y1="2" x2="14" y2="4"/></g>`;
  } else if (platform?.type === 'rover') {
    craft = `<g transform="translate(${px - 10} ${py - pr - 12})" fill="#fff">
      <rect x="0" y="0" width="20" height="7" rx="1.5"/><rect x="14" y="-8" width="2.5" height="8"/><rect x="12" y="-10" width="7" height="3" rx="1"/>
      <circle cx="3" cy="10" r="3"/><circle cx="10" cy="10" r="3"/><circle cx="17" cy="10" r="3"/></g>`;
  }
  return `<svg class="patch" width="${size}" height="${size}" viewBox="0 0 240 240" role="img" aria-label="Емблема місії: ${esc(top)}, ${esc(bottom)}">
    <defs>
      <radialGradient id="${id}-sky" cx="40%" cy="35%" r="80%"><stop offset="0" stop-color="#25386b"/><stop offset="1" stop-color="#0b1530"/></radialGradient>
      <path id="${id}-top" d="M 28 120 A 92 92 0 0 1 212 120"/>
      <path id="${id}-bot" d="M 24 120 A 96 96 0 0 0 216 120"/>
      <clipPath id="${id}-in"><circle cx="120" cy="120" r="80"/></clipPath>
    </defs>
    <circle cx="120" cy="120" r="118" fill="${ring}"/>
    <circle cx="120" cy="120" r="114" fill="none" stroke="#f3efe4" stroke-width="3"/>
    <circle cx="120" cy="120" r="82" fill="#f3efe4"/>
    <circle cx="120" cy="120" r="80" fill="url(#${id}-sky)"/>
    <g clip-path="url(#${id}-in)">
      ${target ? planetBody(target, px, py, pr, `${id}-p`) : ''}
      <circle cx="66" cy="132" r="9" fill="#4a86d8"/><circle cx="63" cy="129" r="3" fill="#7fc08a" opacity=".8"/>
      ${target ? `<path d="M 74 126 Q 100 92 ${px - 8} ${py - pr - 6}" fill="none" stroke="#f3efe4" stroke-width="1.6" stroke-dasharray="3 4"/>` : ''}
      ${craft}
      ${stars.map(([x, y]) => `<path d="M ${x} ${y - 5} L ${x + 1.5} ${y - 1.5} L ${x + 5} ${y} L ${x + 1.5} ${y + 1.5} L ${x} ${y + 5} L ${x - 1.5} ${y + 1.5} L ${x - 5} ${y} L ${x - 1.5} ${y - 1.5} Z" fill="#f3efe4"/>`).join('')}
    </g>
    <text font-family="Unbounded, 'Segoe UI', sans-serif" font-weight="700" font-size="15" letter-spacing="1.5" fill="#f3efe4" text-anchor="middle">
      <textPath href="#${id}-top" startOffset="50%">${esc(top.toUpperCase())}</textPath></text>
    <text font-family="Unbounded, 'Segoe UI', sans-serif" font-weight="500" font-size="13" letter-spacing="2" fill="#f3efe4" text-anchor="middle" dominant-baseline="hanging">
      <textPath href="#${id}-bot" startOffset="50%">${esc(bottom.toUpperCase())}</textPath></text>
  </svg>`;
}

/** Схема Сонце–Земля–ціль на поточний день місії. Для Місяця — Земля і орбіта Місяця. */
export function orbitSvg(target, dayFromArrival = 0) {
  const W = 260; const H = 200; const cx = W / 2; const cy = H / 2;
  const id = nextId('or');
  const v = target.visual || DEFAULT_VISUAL;
  if (!target.orbit_au) {
    return `<svg class="orbit" viewBox="0 0 ${W} ${H}" role="img" aria-label="Земля і Місяць">
      <circle cx="${cx}" cy="${cy}" r="70" fill="none" stroke="var(--line)" stroke-dasharray="3 4"/>
      <circle cx="${cx}" cy="${cy}" r="14" fill="#4a86d8"/>
      <circle cx="${cx + 70 * Math.cos(dayFromArrival / 27.3 * 2 * Math.PI)}" cy="${cy + 70 * Math.sin(dayFromArrival / 27.3 * 2 * Math.PI)}" r="6" fill="${v.base}"/>
      <text x="${cx}" y="${H - 6}" text-anchor="middle" font-size="11" fill="var(--muted)">Сигнал іде ~1,3 с · 384 тис. км</text>
    </svg>`;
  }
  const scale = 82 / target.orbit_au;
  const rt = target.orbit_au * scale;
  const re = Math.min(Math.max(scale, 34), 82); // для далеких цілей орбіту Землі збільшено, щоб її було видно
  const notToScale = re !== scale;
  const ae = (-60 + (360 / 365.25) * dayFromArrival) * Math.PI / 180;
  const phase = phaseDeg(target, dayFromArrival);
  const at = ae - phase * Math.PI / 180;
  const ex = cx + re * Math.cos(ae); const ey = cy + re * Math.sin(ae);
  const tx = cx + rt * Math.cos(at); const ty = cy + rt * Math.sin(at);
  const off = Math.abs((((phase - 180) % 360) + 540) % 360 - 180);
  const conj = off < 12;
  const dist = earthDistanceAu(target, dayFromArrival);
  return `<svg class="orbit" viewBox="0 0 ${W} ${H}" role="img" aria-label="Схема орбіт: до Землі ${fmt(dist, 2)} а.о.${conj ? ', сонячне з\'єднання' : ''}">
    <defs><radialGradient id="${id}-sun"><stop offset="0" stop-color="#fff3c4"/><stop offset=".6" stop-color="#f4b63f"/><stop offset="1" stop-color="#f4b63f" stop-opacity="0"/></radialGradient></defs>
    <circle cx="${cx}" cy="${cy}" r="${re}" fill="none" stroke="var(--line)"/>
    <circle cx="${cx}" cy="${cy}" r="${rt}" fill="none" stroke="var(--line)"/>
    <circle cx="${cx}" cy="${cy}" r="16" fill="url(#${id}-sun)"/>
    <line x1="${ex}" y1="${ey}" x2="${tx}" y2="${ty}" stroke="${conj ? 'var(--bad)' : 'var(--data)'}" stroke-width="1.5" stroke-dasharray="4 3"/>
    <circle cx="${ex}" cy="${ey}" r="6" fill="#4a86d8"/>
    <circle cx="${tx}" cy="${ty}" r="6" fill="${v.base}"/>
    <text x="${ex}" y="${ey - 10}" text-anchor="middle" font-size="11" fill="var(--ink)">Земля</text>
    ${notToScale ? `<text x="4" y="12" font-size="10" fill="var(--muted)">Орбіта Землі не в масштабі</text>` : ''}
    <text x="${tx}" y="${ty - 10}" text-anchor="middle" font-size="11" fill="var(--ink)">${esc(tr(target.name))}</text>
    <text x="${cx}" y="${H - 4}" text-anchor="middle" font-size="11" fill="${conj ? 'var(--bad)' : 'var(--muted)'}">${conj ? 'Сонце між Землею і ціллю' : `До Землі ${fmt(dist, 2)} а.о. · сигнал ${fmt(dist * 8.32, 0)} хв`}</text>
  </svg>`;
}

/** Зворотний відлік і старт ракети. Без анімації, якщо в системі вимкнено рух. */
export function countdown(done, sfx = null) {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { done(); return; }
  const el = document.createElement('div');
  el.className = 'countdown';
  el.setAttribute('role', 'status');
  document.body.appendChild(el);
  const steps = ['3', '2', '1'];
  let i = 0;
  const tick = () => {
    if (i < steps.length) {
      el.innerHTML = `<span class="cd-num">${steps[i]}</span>`;
      sfx?.tick();
      i += 1;
      setTimeout(tick, 650);
      return;
    }
    sfx?.liftoff();
    el.innerHTML = `<div class="liftoff">
      <svg class="rocket" viewBox="0 0 60 200" aria-hidden="true">
        <path d="M30 4 C40 18 44 40 44 64 L44 150 L16 150 L16 64 C16 40 20 18 30 4 Z" fill="#f3efe4"/>
        <path d="M30 4 C36 12 40 24 42 36 L18 36 C20 24 24 12 30 4 Z" fill="#c8352b"/>
        <rect x="16" y="96" width="28" height="6" fill="#25386b"/>
        <path d="M16 120 L4 156 L16 150 Z M44 120 L56 156 L44 150 Z" fill="#c8352b"/>
        <path class="flame" d="M18 150 Q30 205 42 150 Z" fill="#ffb347"/>
        <path class="flame" d="M23 150 Q30 185 37 150 Z" fill="#fff3c4"/>
      </svg>
      <span class="cd-go">Старт</span></div>`;
    setTimeout(() => { el.remove(); done(); }, 1500);
  };
  tick();
}
