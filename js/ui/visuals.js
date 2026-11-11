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
      <text x="${cx}" y="${H - 6}" text-anchor="middle" font-size="11" fill="var(--muted)">Сигнал іде ~1,3 с · 384 тис. км</text>
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
  return `<svg class="orbit" viewBox="0 0 ${W} ${H}" role="img" aria-label="Схема орбіт: до Землі ${fmt(dist, 2)} а.о.${conj ? ', сонячне з’єднання' : ''}">
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
    <text x="${cx}" y="${H - 4}" text-anchor="middle" font-size="11" fill="${conj ? 'var(--bad)' : 'var(--muted)'}">${conj ? 'Сонце між Землею і ціллю' : `До Землі ${fmt(dist, 2)} а.о. · сигнал ${fmt(dist * 8.32, 0)} хв`}</text>
  </svg>`;
}

/** Зворотний відлік і старт ракети. Без анімації, якщо в системі вимкнено рух. */
export function countdown(done, sfx = null, rocketHtml = '') {
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
    el.innerHTML = `<div class="liftoff">${rocketHtml || ''}<span class="cd-go">Старт</span></div>`;
    setTimeout(() => { el.remove(); done(); }, 1500);
  };
  tick();
}

// ---------- схема апарата в конструкторі ----------
const PANEL_LEN = { solar_s: 34, solar_m: 56, solar_l: 78, solar_xl: 104 };
const INSTR_COLOR = {
  cam_hires: '#3556a8', panorama_cam: '#3556a8', ir_spectrometer: '#7b4ba6', laser_spectrometer: '#7b4ba6', mass_spectrometer: '#7b4ba6',
  orbital_radar: '#2e7d5b', sar: '#2e7d5b', gpr: '#2e7d5b', neutron: '#b8790c', magnetometer: '#b8790c', lidar: '#c8352b',
  seismometer: '#8a5a3c', weather: '#4a86d8', drill: '#566176', sample_arm: '#566176', moxie: '#c1572e',
};
let lastParts = new Set();

/**
 * Схема апарата, що «росте» з кожним вибором: корпус за типом платформи,
 * панелі за площею, РІТЕГ, антена за розміром, прилади, резервування.
 */
export function craftSvg(r, massText = '', { track = true } = {}) {
  const parts = [];
  const add = (key, svg, title = '') => parts.push({ key, svg: title ? `<g><title>${esc(title)}</title>${svg}</g>` : svg });
  const p = r.platform;
  const W = 300; const H = 170;
  if (!p) {
    return `<svg class="craft" viewBox="0 0 ${W} ${H}" role="img" aria-label="Апарат ще не зібрано">
      <rect x="110" y="60" width="80" height="50" rx="4" fill="none" stroke="var(--line)" stroke-dasharray="5 4"/>
      <text x="150" y="140" text-anchor="middle" font-size="12" fill="var(--muted)">Оберіть платформу</text></svg>`;
  }
  const foil = '#d4a84a'; const ink = 'var(--ink)';
  const panelLen = r.power?.type === 'solar' ? PANEL_LEN[r.power.id] || 50 : 0;
  const surface = p.type !== 'orbiter';
  const groundY = 150;
  let body; let deckY; let deckX; let deckW; let antX; let antY;

  if (!surface) {
    body = { x: 122, y: 58, w: 56, h: 46 };
    add('body', `<rect x="${body.x}" y="${body.y}" width="${body.w}" height="${body.h}" rx="3" fill="${foil}" stroke="#8a6a24"/>
      <path d="M${body.x} ${body.y + 15} H${body.x + body.w} M${body.x} ${body.y + 31} H${body.x + body.w}" stroke="#8a6a24" opacity=".5"/>`, tr(p.name));
    deckX = body.x + 4; deckW = body.w - 8; deckY = body.y + body.h; antX = 150; antY = body.y;
    if (panelLen) {
      const ph = 22; const y = body.y + body.h / 2 - ph / 2;
      const wing = (x, dir) => `<line x1="${dir > 0 ? body.x + body.w : body.x}" y1="${y + ph / 2}" x2="${x}" y2="${y + ph / 2}" stroke="${ink}" stroke-width="2"/>
        <rect x="${dir > 0 ? x : x - panelLen}" y="${y}" width="${panelLen}" height="${ph}" fill="#2b4a8a" stroke="#9fb4e0" stroke-width=".8"/>
        ${Array.from({ length: Math.max(1, Math.floor(panelLen / 14)) }, (_, i) => `<line x1="${(dir > 0 ? x : x - panelLen) + (i + 1) * 14}" y1="${y}" x2="${(dir > 0 ? x : x - panelLen) + (i + 1) * 14}" y2="${y + ph}" stroke="#9fb4e0" stroke-width=".5"/>`).join('')}`;
      add(`power-${r.power.id}`, wing(body.x + body.w + 6, 1) + wing(body.x - 6, -1), tr(r.power.name));
    }
  } else if (p.type === 'lander') {
    body = { x: 112, y: 92, w: 76, h: 24 };
    add('body', `<path d="M${body.x + 8} ${body.y} H${body.x + body.w - 8} L${body.x + body.w} ${body.y + body.h} H${body.x} Z" fill="${foil}" stroke="#8a6a24"/>
      <path d="M${body.x + 10} ${body.y + body.h} L${body.x - 4} ${groundY}" stroke="${ink}" stroke-width="2.5"/>
      <path d="M${body.x + body.w - 10} ${body.y + body.h} L${body.x + body.w + 4} ${groundY}" stroke="${ink}" stroke-width="2.5"/>
      <path d="M150 ${body.y + body.h} L150 ${groundY - 4}" stroke="${ink}" stroke-width="2"/>
      <ellipse cx="${body.x - 4}" cy="${groundY}" rx="7" ry="2.5" fill="${ink}"/><ellipse cx="${body.x + body.w + 4}" cy="${groundY}" rx="7" ry="2.5" fill="${ink}"/>`, tr(p.name));
    deckX = body.x + 10; deckW = body.w - 20; deckY = body.y; antX = body.x + body.w - 14; antY = body.y;
    if (panelLen) {
      const rr = 10 + panelLen / 6;
      add(`power-${r.power.id}`, [body.x - rr + 4, body.x + body.w + rr - 4].map((cx) => `<g><circle cx="${cx}" cy="${body.y + 4}" r="${rr}" fill="#2b4a8a" stroke="#9fb4e0"/>
        ${Array.from({ length: 6 }, (_, i) => `<line x1="${cx}" y1="${body.y + 4}" x2="${cx + rr * Math.cos(i * Math.PI / 3)}" y2="${body.y + 4 + rr * Math.sin(i * Math.PI / 3)}" stroke="#9fb4e0" stroke-width=".6"/>`).join('')}</g>`).join(''), tr(r.power.name));
    }
  } else {
    body = { x: 98, y: 98, w: 104, h: 20 };
    const wheels = [108, 150, 192].map((x) => `<circle cx="${x}" cy="${groundY - 9}" r="9" fill="${ink}"/><circle cx="${x}" cy="${groundY - 9}" r="3.5" fill="#999"/>`).join('');
    add('body', `<path d="M108 ${groundY - 9} L130 ${body.y + body.h} L150 ${groundY - 9} M150 ${groundY - 9} L172 ${body.y + body.h} L192 ${groundY - 9}" stroke="${ink}" stroke-width="2.5" fill="none"/>
      <rect x="${body.x}" y="${body.y}" width="${body.w}" height="${body.h}" rx="3" fill="#e9e6df" stroke="${ink}"/>${wheels}
      <path d="M${body.x + body.w - 12} ${body.y} V${body.y - 46}" stroke="${ink}" stroke-width="3"/>
      <rect x="${body.x + body.w - 22}" y="${body.y - 56}" width="22" height="11" rx="2" fill="#e9e6df" stroke="${ink}"/>
      <circle cx="${body.x + body.w - 4}" cy="${body.y - 50.5}" r="3" fill="#3556a8"/>`, tr(p.name));
    deckX = body.x + 6; deckW = body.w - 40; deckY = body.y; antX = body.x + 22; antY = body.y;
    if (panelLen) {
      const w = Math.min(150, body.w + panelLen * 0.6);
      add(`power-${r.power.id}`, `<rect x="${150 - w / 2 - 10}" y="${body.y - 6}" width="${w}" height="5" fill="#2b4a8a" stroke="#9fb4e0"/>`, tr(r.power.name));
    }
  }

  if (r.power?.type === 'rtg') {
    const n = r.power.id === 'rtg_2' ? 2 : 1;
    const bx = surface ? body.x - 6 : body.x - 4; const by = surface ? body.y + 2 : body.y + body.h + 4;
    add(`power-${r.power.id}`, Array.from({ length: n }, (_, i) => {
      const x = bx - i * 16;
      return `<g transform="rotate(${surface ? -35 : 0} ${x} ${by})"><rect x="${x - 12}" y="${by}" width="12" height="22" rx="2" fill="#6b6f78" stroke="${ink}"/>
        <path d="M${x - 16} ${by + 5} H${x + 4} M${x - 16} ${by + 11} H${x + 4} M${x - 16} ${by + 17} H${x + 4}" stroke="#6b6f78" stroke-width="2"/></g>`;
    }).join(''), tr(r.power.name));
  }

  const a = r.antenna;
  if (a) {
    let svg;
    if (a.relay) svg = `<path d="M${antX} ${antY} V${antY - 26}" stroke="${ink}" stroke-width="1.5"/><path d="M${antX - 3} ${antY - 6} l6 -4 l-6 -4 l6 -4 l-6 -4" stroke="${ink}" fill="none"/>`;
    else if (a.id === 'lga') svg = `<path d="M${antX} ${antY} V${antY - 14}" stroke="${ink}" stroke-width="2"/><circle cx="${antX}" cy="${antY - 16}" r="3" fill="${ink}"/>`;
    else {
      const rr = a.id === 'hga_large' ? 26 : 11;
      svg = `<path d="M${antX} ${antY} V${antY - 8}" stroke="${ink}" stroke-width="2"/>
        <path d="M${antX - rr} ${antY - 8 - rr * 0.55} Q${antX} ${antY - 8 + rr * 0.35} ${antX + rr} ${antY - 8 - rr * 0.55}" fill="#f3efe4" stroke="${ink}" stroke-width="1.5"/>
        <path d="M${antX} ${antY - 8} L${antX} ${antY - 8 - rr * 0.7}" stroke="${ink}"/>`;
    }
    add(`ant-${a.id}`, svg, tr(a.name));
  }

  r.instruments.forEach((ins, i) => {
    const n = r.instruments.length;
    const w = Math.min(14, (deckW - 2) / n - 2);
    const x = deckX + i * (w + 2);
    const y = surface ? deckY - 10 : deckY + 1;
    let extra = '';
    if (ins.id === 'drill' || ins.id === 'sample_arm') extra = `<path d="M${x + w / 2} ${y + 10} L${x + w / 2 + (surface ? 18 : 0)} ${y + (surface ? 30 : 34)}" stroke="${ink}" stroke-width="2"/>`;
    if (ins.id === 'orbital_radar' && !surface) extra = `<path d="M${x + w / 2} ${y + 10} L${x - 30} ${y + 40} M${x + w / 2} ${y + 10} L${x + w + 30} ${y + 40}" stroke="${ink}" stroke-width="1"/>`;
    add(`ins-${ins.id}`, `${extra}<rect x="${x}" y="${y}" width="${w}" height="9" rx="1.5" fill="${INSTR_COLOR[ins.id] || '#566176'}" stroke="${ink}" stroke-width=".6"/>`, tr(ins.name));
  });

  r.extras.forEach((e) => {
    if (e.effect === 'backup_antenna') add('ex-backup', `<path d="M${antX - 22} ${antY} V${antY - 10}" stroke="${ink}" stroke-width="1.5"/><circle cx="${antX - 22}" cy="${antY - 12}" r="2.5" fill="${ink}"/>`, tr(e.name));
    if (e.effect === 'big_battery') add('ex-battery', `<rect x="${body.x + body.w - 18}" y="${body.y + body.h - 9}" width="12" height="6" rx="1" fill="#2e7d5b"/>`, tr(e.name));
    if (e.effect === 'radiation_vault') add('ex-vault', `<rect x="${body.x + body.w / 2 - 10}" y="${body.y + body.h / 2 - 8}" width="20" height="16" rx="2" fill="#9aa0aa" stroke="${ink}"/>`, tr(e.name));
  });

  const keys = new Set(parts.map((x) => x.key));
  const out = parts.map((x) => `<g class="part${track && lastParts.size && !lastParts.has(x.key) ? ' is-new' : ''}">${x.svg}</g>`).join('');
  if (track) lastParts = keys;
  return `<svg class="craft" viewBox="0 0 ${W} ${H}" role="img" aria-label="Схема апарата: ${esc(tr(p.name))}, приладів ${r.instruments.length}">
    ${surface ? `<path d="M0 ${groundY + 2} H${W}" stroke="var(--line)" stroke-width="2"/>` : ''}
    ${out}
    ${massText ? `<text x="${W / 2}" y="${H - 2}" text-anchor="middle" font-size="11" fill="var(--muted)">${esc(massText)}</text>` : ''}
  </svg>`;
}
