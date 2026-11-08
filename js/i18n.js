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
