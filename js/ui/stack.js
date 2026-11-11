// Ракета в масштабі і розріз головного обтічника з корисним навантаженням.
// Розміри беруться з поля "visual" у data/rockets.json, тому нова ракета малюється без нового коду.
import { tr } from '../i18n.js';
import { esc, fmt } from './dom.js';
import { isSurface } from '../calc.js';

const S = 5;           // пікселів на метр (однаково для всіх ракет, тож висоти порівнювані)
const VB_W = 96;
const VB_H = 380;
const BASE = 366;      // низ першого ступеня
const DEFAULT_V = { height_m: 60, core_d_m: 3.7, s1_h_m: 35, fairing_d_m: 5, fairing_h_m: 13, core_color: '#e9e9e4', boosters: 0 };

/** Силует ракети збоку. opts.flame — полум’я двигунів (для старту). */
export function rocketSvg(rocket, { flame = false, className = 'rocket-side' } = {}) {
  if (!rocket) {
    return `<svg class="${className}" viewBox="0 0 ${VB_W} ${VB_H}" role="img" aria-label="Ракету не обрано">
      <path d="M48 40 Q60 70 60 110 V${BASE} H36 V110 Q36 70 48 40 Z" fill="none" stroke="var(--line)" stroke-dasharray="5 4"/>
      <text x="48" y="${BASE + 12}" font-size="9" text-anchor="middle" fill="var(--muted)">ракета?</text></svg>`;
  }
  const v = rocket.visual || DEFAULT_V;
  const cx = VB_W / 2;
  const coreW = v.core_d_m * S;
  const fairW = v.fairing_d_m * S;
  const top = BASE - v.height_m * S;
  const s1Top = BASE - v.s1_h_m * S;
  const fairBottom = top + v.fairing_h_m * S;
  const ink = '#1d1f24';
  const parts = [];

  // Бокові прискорювачі (позаду ядра, тому малюємо першими)
  if (v.boosters) {
    const bw = v.booster_d_m * S;
    const bh = v.booster_h_m * S;
    const perSide = v.boosters / 2;
    for (let side of [-1, 1]) {
      for (let k = perSide - 1; k >= 0; k--) {
        const off = coreW / 2 + bw / 2 + 0.6 + k * (bw * 0.55);
        const x = cx + side * off - bw / 2;
        const shade = k > 0 ? 'opacity=".75"' : '';
        if (v.booster_type === 'core') {
          const nose = 4.5 * S;
          parts.push(`<g ${shade}><rect x="${x}" y="${BASE - bh + nose}" width="${bw}" height="${bh - nose}" fill="${v.core_color}" stroke="${ink}" stroke-width=".6"/>
            <path d="M${x} ${BASE - bh + nose} Q${x + bw / 2} ${BASE - bh - 2} ${x + bw} ${BASE - bh + nose} Z" fill="${v.core_color}" stroke="${ink}" stroke-width=".6"/>
            <rect x="${x}" y="${BASE - bh + nose + 6}" width="${bw}" height="5" fill="${ink}"/>
            ${v.grid_fins ? `<rect x="${x + (side < 0 ? -2.5 : bw)}" y="${BASE - bh + nose + 12}" width="2.5" height="4" fill="${ink}"/>` : ''}
            ${v.legs ? `<path d="M${x + (side < 0 ? 0 : bw)} ${BASE - 2} l${side * 3} -14" stroke="${ink}" stroke-width="1.2"/>` : ''}</g>`);
        } else {
          const nose = 2.2 * S;
          parts.push(`<g ${shade}><rect x="${x}" y="${BASE - bh + nose}" width="${bw}" height="${bh - nose}" fill="${v.booster_color || '#eee'}" stroke="${ink}" stroke-width=".5"/>
            <path d="M${x} ${BASE - bh + nose} L${x + bw / 2} ${BASE - bh} L${x + bw} ${BASE - bh + nose} Z" fill="${v.booster_color || '#eee'}" stroke="${ink}" stroke-width=".5"/>
            <path d="M${x + 1} ${BASE} L${x - 0.5} ${BASE + 4} H${x + bw + 0.5} L${x + bw - 1} ${BASE} Z" fill="#555"/></g>`);
        }
      }
    }
  }

  // Перший ступінь
  parts.push(`<rect x="${cx - coreW / 2}" y="${s1Top}" width="${coreW}" height="${BASE - s1Top}" fill="${v.core_color}" stroke="${ink}" stroke-width=".7"/>`);
  if (v.interstage && v.interstage !== v.core_color) parts.push(`<rect x="${cx - coreW / 2}" y="${s1Top}" width="${coreW}" height="${3 * S}" fill="${v.interstage}" stroke="${ink}" stroke-width=".5"/>`);
  if (v.grid_fins) parts.push(`<rect x="${cx - coreW / 2 - 2.5}" y="${s1Top + 1.5}" width="2.5" height="4" fill="${ink}"/><rect x="${cx + coreW / 2}" y="${s1Top + 1.5}" width="2.5" height="4" fill="${ink}"/>`);
  if (v.legs) parts.push(`<path d="M${cx - coreW / 2} ${BASE - 1} l-2 -16 M${cx + coreW / 2} ${BASE - 1} l2 -16" stroke="${ink}" stroke-width="1.4"/>`);
  // Двигуни
  parts.push(`<path d="M${cx - coreW / 2 + 1} ${BASE} L${cx - coreW / 2} ${BASE + 5} H${cx + coreW / 2} L${cx + coreW / 2 - 1} ${BASE} Z" fill="#444"/>`);

  // Другий ступінь (від першого до обтічника)
  const s2W = Math.min(coreW, fairW);
  parts.push(`<rect x="${cx - s2W / 2}" y="${fairBottom}" width="${s2W}" height="${s1Top - fairBottom}" fill="#f4f4f1" stroke="${ink}" stroke-width=".6"/>`);
  if (fairW > coreW + 0.5) parts.push(`<path d="M${cx - coreW / 2} ${fairBottom + 4} L${cx - fairW / 2} ${fairBottom} H${cx + fairW / 2} L${cx + coreW / 2} ${fairBottom + 4} Z" fill="#f4f4f1" stroke="${ink}" stroke-width=".6"/>`);

  // Головний обтічник: циліндр + оживальна частина
  const fh = v.fairing_h_m * S;
  const cyl = fh * 0.55;
  parts.push(`<path d="M${cx - fairW / 2} ${fairBottom} V${fairBottom - cyl} Q${cx - fairW / 2} ${top + fh * 0.12} ${cx} ${top} Q${cx + fairW / 2} ${top + fh * 0.12} ${cx + fairW / 2} ${fairBottom - cyl} V${fairBottom} Z"
    fill="#fbfbf9" stroke="${ink}" stroke-width=".8" class="fairing-mark"/>`);
  parts.push(`<path d="M${cx} ${top + 2} V${fairBottom}" stroke="${ink}" stroke-width=".3" opacity=".5"/>`);

  if (flame) {
    parts.push(`<path class="flame" d="M${cx - coreW / 2} ${BASE + 5} Q${cx} ${BASE + 70} ${cx + coreW / 2} ${BASE + 5} Z" fill="#ffb347"/>
      <path class="flame" d="M${cx - coreW / 4} ${BASE + 5} Q${cx} ${BASE + 45} ${cx + coreW / 4} ${BASE + 5} Z" fill="#fff3c4"/>`);
  }
  const h = flame ? VB_H + 70 : VB_H;
  return `<svg class="${className}" viewBox="0 0 ${VB_W} ${h}" role="img" aria-label="${esc(tr(rocket.name))}: висота ${fmt(v.height_m)} м">
    ${parts.join('')}
    ${flame ? '' : `<path d="M4 ${BASE} V${BASE - 50 * S}" stroke="var(--line)"/><path d="M2 ${BASE} H7 M2 ${BASE - 25 * S} H7 M2 ${BASE - 50 * S} H7" stroke="var(--line)"/>
    <text x="9" y="${BASE - 50 * S + 3}" font-size="8" fill="var(--muted)">50 м</text>`}
  </svg>`;
}

/**
 * Розріз обтічника: адаптер, апарат у складеному вигляді, паливні баки, система посадки.
 * Вміст росте разом з масою на старті; при перевантаженні обтічник червоніє.
 */
export function fairingSvg(r, c) {
  const W = 230; const H = 300;
  const v = r.rocket?.visual || DEFAULT_V;
  const ratio = Math.min(3.2, Math.max(1.8, v.fairing_h_m / v.fairing_d_m));
  let fw = 112;
  let fh = fw * ratio;
  if (fh > 270) { fw *= 270 / fh; fh = 270; }
  const x0 = 12 + (112 - fw) / 2;
  const bottom = H - 14;
  const cylTop = bottom - fh * 0.55;
  const tip = bottom - fh;
  const cx = x0 + fw / 2;
  const over = c.capacity > 0 && c.mass.launch > c.capacity;
  const ink = 'var(--ink)';
  const stroke = over ? 'var(--bad)' : ink;
  const labels = [];

  // Адаптер
  const adH = 12;
  const adTop = bottom - adH;
  const adapter = `<path d="M${cx - fw * 0.36} ${bottom} L${cx - fw * 0.24} ${adTop} H${cx + fw * 0.24} L${cx + fw * 0.36} ${bottom} Z" fill="#9aa0aa" stroke="${ink}" stroke-width=".6"/>`;
  labels.push({ y: bottom - adH / 2, text: 'Адаптер' });

  let payload = '';
  if (r.platform) {
    const fill = c.capacity > 0 ? Math.cbrt(Math.min(1.25, c.mass.launch / c.capacity)) : 0.6;
    const avail = (adTop - (cylTop - (cylTop - tip) * 0.35));
    const ph = Math.max(40, avail * Math.min(1.08, fill));
    const pTop = adTop - ph;
    const pw = fw * 0.82;
    const foil = '#d4a84a';
    const total = Math.max(1, c.mass.launch);
    if (isSurface(r) && r.target?.landing?.type === 'aeroshell') {
      // Капсула: теплозахисний екран знизу, задній кожух, зверху перелітний модуль
      const shieldH = ph * 0.14; const backH = ph * 0.6; const cruiseH = ph * 0.14;
      const yShield = adTop - shieldH; const yBackTop = yShield - backH; const yCruise = yBackTop - cruiseH - 2;
      payload += `<path d="M${cx - pw / 2} ${yShield} Q${cx} ${adTop + 2} ${cx + pw / 2} ${yShield} Z" fill="#7a4a2a" stroke="${ink}" stroke-width=".6"/>
        <path d="M${cx - pw / 2} ${yShield} L${cx - pw * 0.22} ${yBackTop} H${cx + pw * 0.22} L${cx + pw / 2} ${yShield} Z" fill="#e8e6e0" stroke="${ink}" stroke-width=".6" fill-opacity=".9"/>
        ${craftMini(r, cx, yShield - 3, pw * 0.5, backH * 0.55)}
        <rect x="${cx - pw * 0.34}" y="${yCruise}" width="${pw * 0.68}" height="${cruiseH}" rx="2" fill="#2b4a8a" stroke="#9fb4e0" stroke-width=".6"/>
        <path d="M${cx - pw * 0.34 + 6} ${yCruise + cruiseH / 2} H${cx + pw * 0.34 - 6}" stroke="#9fb4e0" stroke-width=".5"/>`;
      labels.push({ y: yShield - backH / 2, text: `Апарат ${fmt(c.mass.dry)} кг` });
      labels.push({ y: yShield, text: `Посадка ${fmt(c.mass.edl)} кг` });
      labels.push({ y: yCruise + cruiseH / 2, text: 'Перелітний модуль' });
      labels.push({ y: yBackTop + backH * 0.15, text: 'Капсула' });
    } else {
      // Апарат зі складеними панелями і баками (видно в розрізі)
      const fuelShare = c.mass.fuel / total;
      const bodyH = ph; const bodyW = pw * 0.62;
      const bx = cx - bodyW / 2;
      const tankR = Math.max(5, Math.min(bodyW * 0.22, bodyW * 0.45 * Math.sqrt(fuelShare + 0.02)));
      const stowed = r.power?.type === 'solar'
        ? `<rect x="${bx - 7}" y="${pTop + 6}" width="6" height="${bodyH - 12}" fill="#2b4a8a" stroke="#9fb4e0" stroke-width=".5"/>
           <rect x="${bx + bodyW + 1}" y="${pTop + 6}" width="6" height="${bodyH - 12}" fill="#2b4a8a" stroke="#9fb4e0" stroke-width=".5"/>` : '';
      const legs = r.platform.type === 'lander' ? `<path d="M${bx} ${adTop - 2} l-6 -${bodyH * 0.4} M${bx + bodyW} ${adTop - 2} l6 -${bodyH * 0.4}" stroke="${ink}" stroke-width="1.6"/>` : '';
      const dish = r.antenna && !r.antenna.relay && r.antenna.id !== 'lga'
        ? `<path d="M${cx - bodyW * (r.antenna.id === 'hga_large' ? 0.48 : 0.22)} ${pTop + 2} Q${cx} ${pTop + 12} ${cx + bodyW * (r.antenna.id === 'hga_large' ? 0.48 : 0.22)} ${pTop + 2}" fill="#f3efe4" stroke="${ink}" stroke-width=".8"/>` : '';
      payload += `${legs}${stowed}
        <rect x="${bx}" y="${pTop + 6}" width="${bodyW}" height="${bodyH - 6}" rx="2" fill="${foil}" fill-opacity=".9" stroke="#8a6a24" stroke-width=".7"/>
        ${c.mass.fuel > 0 ? `<circle cx="${cx - bodyW * 0.2}" cy="${adTop - bodyH * 0.35}" r="${tankR}" fill="#cfd6e2" stroke="${ink}" stroke-width=".6"/>
        <circle cx="${cx + bodyW * 0.2}" cy="${adTop - bodyH * 0.35}" r="${tankR}" fill="#cfd6e2" stroke="${ink}" stroke-width=".6"/>` : ''}
        ${r.power?.type === 'rtg' ? `<rect x="${bx + 3}" y="${pTop + 10}" width="7" height="14" rx="1" fill="#6b6f78"/>` : ''}
        ${dish}
        ${r.instruments.slice(0, 6).map((ins, i) => `<rect x="${bx + 3 + i * ((bodyW - 6) / 6)}" y="${pTop + bodyH * 0.18}" width="${(bodyW - 6) / 6 - 2}" height="6" rx="1" fill="#566176"/>`).join('')}`;
      labels.push({ y: pTop + bodyH * 0.25, text: `Апарат ${fmt(c.mass.dry)} кг` });
      if (c.mass.fuel > 0) labels.push({ y: adTop - bodyH * 0.35, text: `Паливо ${fmt(c.mass.fuel)} кг` });
      if (r.power?.type === 'solar') labels.push({ y: pTop + bodyH * 0.6, text: 'Панелі складені' });
    }
  }

  // Підписи з виносками праворуч, без накладань
  labels.sort((a, b) => a.y - b.y);
  let lastY = -100;
  const lx = x0 + fw + 10;
  const callouts = labels.map((l) => {
    const y = Math.max(l.y, lastY + 13); lastY = y;
    return `<path d="M${cx + fw * 0.2} ${l.y} L${lx - 3} ${y}" stroke="var(--muted)" stroke-width=".5"/>
      <text x="${lx}" y="${y + 3}" font-size="9.5" fill="${ink}">${esc(l.text)}</text>`;
  }).join('');

  const shell = `<path d="M${x0} ${bottom} V${cylTop} Q${x0} ${tip + fh * 0.12} ${cx} ${tip} Q${x0 + fw} ${tip + fh * 0.12} ${x0 + fw} ${cylTop} V${bottom}"
    fill="none" stroke="${stroke}" stroke-width="${over ? 2 : 1.2}" stroke-dasharray="${over ? '0' : '0'}"/>`;
  const status = c.capacity
    ? `<text x="${W - 2}" y="${H - 2}" font-size="10" text-anchor="end" fill="${over ? 'var(--bad)' : 'var(--muted)'}">${over ? 'Перевантаження!' : `${fmt(c.mass.launch)} з ${fmt(c.capacity)} кг`}</text>` : '';
  return `<svg class="fairing" viewBox="0 0 ${W} ${H}" role="img" aria-label="Розріз головного обтічника: ${esc(labels.map((l) => l.text).join(', '))}">
    <path d="M${x0 - 4} ${bottom} H${x0 + fw + 4}" stroke="var(--line)" stroke-width="2"/>
    ${adapter}${payload}${shell}${callouts}${status}
    <text x="2" y="10" font-size="9.5" fill="var(--muted)">Розріз обтічника ⌀${fmt(v.fairing_d_m, 1)} м</text>
  </svg>`;
}

/** Маленький силует апарата всередині капсули. */
function craftMini(r, cx, baseY, w, h) {
  const ink = 'var(--ink)';
  if (r.platform.type === 'rover') {
    const wy = baseY - 4;
    return `<rect x="${cx - w / 2}" y="${baseY - h * 0.55}" width="${w}" height="${h * 0.3}" rx="2" fill="#e9e6df" stroke="${ink}" stroke-width=".5"/>
      ${[-0.38, 0, 0.38].map((k) => `<circle cx="${cx + k * w}" cy="${wy}" r="${Math.max(2.5, h * 0.12)}" fill="${ink}"/>`).join('')}`;
  }
  return `<path d="M${cx - w / 2} ${baseY - 2} L${cx - w * 0.3} ${baseY - h * 0.5} H${cx + w * 0.3} L${cx + w / 2} ${baseY - 2}" fill="#d4a84a" stroke="${ink}" stroke-width=".5"/>`;
}
