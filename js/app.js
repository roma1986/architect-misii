// Точка входу: завантажує дані, тримає стан гри і перемикає екрани.
import { loadData } from './data.js';
import { randomSeed } from './rng.js';
import { decodeMission, toast } from './ui/dom.js';
import * as briefing from './ui/briefing.js';
import * as builder from './ui/builder.js';
import * as flight from './ui/flight.js';
import * as summary from './ui/summary.js';
import * as colony from './ui/colony.js';
import { renderAbout } from './ui/about.js';
import { setSound } from './ui/sound.js';

const SCREENS = { briefing, builder, flight, summary, colony };
const ORDER = ['briefing', 'builder', 'flight', 'summary'];

export const app = {
  data: null,
  build: emptyBuild(),
  seed: randomSeed(),
  mission: null,
  screen: 'briefing',
  root: document.getElementById('screen'),

  go(screen, { focus = true } = {}) {
    this.screen = screen;
    this.render();
    if (focus) { window.scrollTo(0, 0); this.root.focus({ preventScroll: true }); }
  },
  render() {
    SCREENS[this.screen].render(this.root, this);
    const idx = ORDER.indexOf(this.screen === 'colony' ? 'summary' : this.screen);
    document.querySelectorAll('.stages li').forEach((li) => {
      const i = ORDER.indexOf(li.dataset.stage);
      li.classList.toggle('is-current', i === idx);
      li.classList.toggle('is-done', i < idx);
      if (i === idx) li.setAttribute('aria-current', 'step'); else li.removeAttribute('aria-current');
    });
  },
  newSeed() { this.seed = randomSeed(); },
  reset() { this.build = emptyBuild(); this.newSeed(); this.mission = null; },
};

export function emptyBuild() {
  return { target: null, cls: null, goal: null, rocket: null, platform: null, instruments: [], power: null, antenna: null, extras: [] };
}

async function start() {
  try {
    app.data = await loadData();
  } catch (err) {
    app.root.innerHTML = `<div class="panel"><h2>Не вдалося завантажити дані гри</h2><p>${err.message}</p>
      <p class="muted">Якщо ви відкрили index.html прямо з диска, браузер блокує читання JSON. Запустіть локальний сервер: <code>python -m http.server</code> у папці проєкту і відкрийте http://localhost:8000.</p></div>`;
    return;
  }

  const modeToggle = document.getElementById('mode-toggle');
  modeToggle.addEventListener('change', () => {
    document.body.classList.toggle('mode-engineer', modeToggle.checked);
    document.body.classList.toggle('mode-cadet', !modeToggle.checked);
  });

  const soundToggle = document.getElementById('sound-toggle');
  soundToggle.addEventListener('change', () => setSound(soundToggle.checked));

  const about = document.getElementById('about');
  document.getElementById('about-btn').addEventListener('click', () => {
    renderAbout(document.getElementById('about-body'), app);
    about.showModal();
  });
  about.addEventListener('click', (e) => { if (e.target === about || e.target.closest('[data-close]')) about.close(); });

  // Демо для презентації: #demo1 — «жадібна» місія, яка провалиться; #demo2 — виправлена.
  const DEMOS = {
    demo1: { target: 'mars', cls: 'flagship', goal: 'life', launch: '2026-11', rocket: 'atlas_v_541', platform: 'rover_large', instruments: ['panorama_cam', 'laser_spectrometer', 'drill', 'gpr', 'weather', 'mass_spectrometer'], power: 'solar_l', antenna: 'hga_small', extras: [] },
    demo2: { target: 'mars', cls: 'flagship', goal: 'life', launch: '2026-11', rocket: 'atlas_v_541', platform: 'rover_large', instruments: ['panorama_cam', 'laser_spectrometer', 'drill', 'gpr', 'mass_spectrometer'], power: 'rtg_2', antenna: 'relay_uhf', extras: ['big_battery'] },
  };
  const demo = DEMOS[location.hash.slice(1)];
  if (demo) {
    app.build = { ...emptyBuild(), ...demo };
    app.seed = 'DBCA';
    app.go('builder', { focus: false });
    toast(`Демо-місія ${app.seed}`);
    return;
  }

  const m = location.hash.match(/^#m=(.+)$/);
  if (m) {
    const decoded = decodeMission(m[1]);
    if (decoded) {
      app.build = { ...emptyBuild(), ...decoded.build };
      app.seed = decoded.seed || app.seed;
      history.replaceState(null, '', location.pathname + location.search);
      app.go('builder', { focus: false });
      toast(`Завантажено місію ${app.seed}`);
      return;
    }
  }
  app.go('briefing', { focus: false });
}

start();
