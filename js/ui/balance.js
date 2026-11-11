// Графік перевірки балансу (tools/montecarlo.js → data/balance.json).
// Чистий рядок SVG: той самий код малює графік у грі і файл для слайда.

import { plural } from '../i18n.js';

export const CAUSE_NAMES = {
  none: 'майже без втрат', downlink: 'зв’язок не встигав', power: 'бракувало енергії', failure: 'відмови приладів',
  storm: 'пилова буря', sleep: 'сплячий режим у бурю', conjunction: 'сонячне з’єднання', mobility: 'ровер повільний',
  night: 'місячні ночі', skipped: 'порожня пробірка', reset: 'збій комп’ютера', clouds: 'хмари Венери',
  lost_launch: 'аварія ракети', lost_landing: 'аварійна посадка', lost_capture: 'не вийшов на орбіту', lost_night: 'замерз уночі',
  lost_storm: 'загинув у бурю', lost_platform: 'відмова платформи', lost_comms: 'втрата зв’язку', lost_power: 'енергія скінчилася',
  lost_touch: 'пошкоджено при торканні',
};

export function balanceSvg(b, { ink = 'currentColor', muted = '#8a93a3', bar = '#3556a8', bad = '#c8352b', font = 'IBM Plex Sans, Segoe UI, sans-serif' } = {}) {
  const W = 640; const H = 300;
  const left = { x: 40, y: 40, w: 300, h: 200 };
  const maxBin = Math.max(...b.bins, 1);
  const bw = left.w / b.bins.length;
  const hist = b.bins.map((v, i) => {
    const h = (v / maxBin) * left.h;
    return `<rect x="${left.x + i * bw + 2}" y="${left.y + left.h - h}" width="${bw - 4}" height="${h}" fill="${bar}" rx="2"/>`;
  }).join('');
  const ticks = [0, 50, 100].map((t) => `<text x="${left.x + (t / 100) * left.w}" y="${left.y + left.h + 16}" font-size="11" fill="${muted}" text-anchor="middle">${t}</text>`).join('');
  const causes = b.causes.slice(0, 6);
  const maxC = Math.max(...causes.map((c) => c.share), 0.01);
  const rx = 380; const rw = 220;
  const rows = causes.map((c, i) => {
    const y = 52 + i * 32;
    const w = (c.share / maxC) * (rw - 40);
    const lost = c.key.startsWith('lost_');
    return `<text x="${rx}" y="${y}" font-size="12" fill="${ink}">${CAUSE_NAMES[c.key] || c.key}</text>
      <rect x="${rx}" y="${y + 5}" width="${w}" height="9" rx="2" fill="${lost ? bad : bar}"/>
      <text x="${rx + w + 6}" y="${y + 13}" font-size="11" fill="${muted}">${Math.round(c.share * 100)}%</text>`;
  }).join('');
  return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" font-family="${font}" role="img" aria-label="Перевірка балансу: ${b.n} ${plural(b.n, ['місія', 'місії', 'місій'])}">
    <text x="${left.x}" y="20" font-size="14" font-weight="600" fill="${ink}">Оцінки ${b.n.toLocaleString('uk-UA')} випадкових місій</text>
    ${hist}
    <line x1="${left.x}" x2="${left.x + left.w}" y1="${left.y + left.h}" y2="${left.y + left.h}" stroke="${muted}"/>
    ${ticks}
    <text x="${left.x + left.w / 2}" y="${left.y + left.h + 34}" font-size="11" fill="${muted}" text-anchor="middle">загальна оцінка зі 100</text>
    <text x="${rx}" y="20" font-size="14" font-weight="600" fill="${ink}">Головна причина втрат</text>
    ${rows}
  </svg>`;
}
