// Мова інтерфейсу. Дані в JSON мають поля { "uk": "...", "en": "..." }.
// tr() бере потрібну мову, а якщо перекладу немає — українську.

let lang = 'uk';
export function setLang(l) { lang = l; }
export function getLang() { return lang; }
export function tr(v) {
  if (v === null || v === undefined) return '';
  if (typeof v === 'string' || typeof v === 'number') return String(v);
  return v[lang] ?? v.uk ?? Object.values(v)[0] ?? '';
}

/**
 * Українська множина: plural(21, ['доба', 'доби', 'діб']) → 'доба'.
 * Форми: для 1 (21, 31…), для 2–4 (22, 23…), для решти (0, 5–20, 25…).
 */
export function plural(n, forms) {
  const a = Math.abs(Math.round(n)) % 100;
  const b = a % 10;
  if (a > 10 && a < 20) return forms[2];
  if (b === 1) return forms[0];
  if (b >= 2 && b <= 4) return forms[1];
  return forms[2];
}

export const dayWord = (n) => plural(n, ['доба', 'доби', 'діб']);
