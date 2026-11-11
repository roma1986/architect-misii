// Завантаження даних. У браузері — через fetch, у Node.js (tools/) — через fs.
export const DATA_FILES = ['targets', 'mission', 'rockets', 'components', 'events', 'missions', 'media', 'colony', 'balance', 'photos', 'dev'];

export async function loadData(base = 'data/') {
  if (typeof window !== 'undefined' && window.__GAME_DATA__) return window.__GAME_DATA__;
  const entries = await Promise.all(DATA_FILES.map(async (name) => {
    const res = await fetch(`${base}${name}.json`);
    if (!res.ok) throw new Error(`Не вдалося завантажити ${name}.json (${res.status})`);
    return [name, await res.json()];
  }));
  return Object.fromEntries(entries);
}
