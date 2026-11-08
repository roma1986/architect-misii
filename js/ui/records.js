// Рейтинг найкращих місій у цьому браузері (localStorage). Якщо сховище недоступне — просто не зберігаємо.
const KEY = 'architect-misii:records';
const MAX = 5;

export function loadRecords() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/** Зберегти результат, якщо такого ще немає. Повертає місце в рейтингу (1–5) або 0. */
export function saveRecord(rec) {
  const list = loadRecords().filter((r) => r.id !== rec.id);
  list.push(rec);
  list.sort((a, b) => b.total - a.total || a.date.localeCompare(b.date));
  const top = list.slice(0, MAX);
  try { localStorage.setItem(KEY, JSON.stringify(top)); } catch { /* сховище недоступне */ }
  const place = top.findIndex((r) => r.id === rec.id);
  return place >= 0 ? place + 1 : 0;
}

export function clearRecords() {
  try { localStorage.removeItem(KEY); } catch { /* немає доступу */ }
}
