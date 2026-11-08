// Дрібні помічники для інтерфейсу.
import { tr } from '../i18n.js';

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const t = (v) => esc(tr(v));
export const fmt = (x, d = 0) => Number(x || 0).toLocaleString('uk-UA', { maximumFractionDigits: d, minimumFractionDigits: d });
export const pct = (x) => `${Math.round(x * 100)}%`;

export function toast(msg) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.setAttribute('role', 'status');
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2600);
}

/** Код місії: вибір гравця + seed у посиланні, щоб інший зіграв ту саму місію. */
export function encodeMission(build, seed) {
  const json = JSON.stringify({ ...build, seed });
  const b64 = btoa(String.fromCharCode(...new TextEncoder().encode(json)));
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
export function decodeMission(code) {
  try {
    const b64 = code.replace(/-/g, '+').replace(/_/g, '/');
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const obj = JSON.parse(new TextDecoder().decode(bytes));
    const { seed, ...build } = obj;
    return { build, seed };
  } catch {
    return null;
  }
}
export function missionUrl(build, seed) {
  const u = new URL(location.href);
  u.hash = `m=${encodeMission(build, seed)}`;
  return u.toString();
}
export async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch { return false; }
}
