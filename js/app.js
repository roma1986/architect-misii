// Точка входу: завантажує дані, тримає стан гри і перемикає екрани.
import { loadData } from './data.js';
import { randomSeed } from './rng.js';
import { decodeMission, toast } from './ui/dom.js';
import * as briefing from './ui/briefing.js';
import * as builder from './ui/builder.js';
import * as devScreen from './ui/dev.js';
import * as flight from './ui/flight.js';
import * as summary from './ui/summary.js';
import * as colony from './ui/colony.js';
import { renderAbout } from './ui/about.js';
import { setSound } from './ui/sound.js';
import { startDemo } from './ui/demo.js';
import { DEMO_BUILDS, DEMO_SEED } from './demo-script.js';

const SCREENS = { briefing, builder, dev: devScreen, flight, summary, colony };
const ORDER = ['briefing', 'builder', 'dev', 'flight', 'summary'];

export const app = {
  data: null,
  build: emptyBuild(),
  seed: randomSeed(),
  mission: null,
  dev: null,
  demo: null,
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
  reset() { const engineer = this.build.engineer; this.build = { ...emptyBuild(), engineer }; this.newSeed(); this.mission = null; this.dev = null; },
};

export function emptyBuild() {
  return {
    target: null, cls: null, goal: null, rocket: null, platform: null, instruments: [], power: null, antenna: null, extras: [],
    riskClass: 'C', reserve: 25, testing: 'std',
    engineer: false, trajectory: 'direct', propulsion: 'chem', orbit: 'standard', dsn: 'std',
  };
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
  const applyMode = (on) => {
    modeToggle.checked = on;
    document.body.classList.toggle('mode-engineer', on);
    document.body.classList.toggle('mode-cadet', !on);
  };
  app.applyMode = applyMode;
  modeToggle.addEventListener('change', () => {
    applyMode(modeToggle.checked);
    app.build.engineer = modeToggle.checked;
    // Режим змінює правила (траєкторії, двигуни, планетарний захист), тому розробку починаємо заново
    if (app.screen === 'briefing' || app.screen === 'builder' || (app.screen === 'dev' && !(app.dev && app.dev.started))) {
      app.dev = null;
      app.render();
    } else {
      toast('Нові правила режиму почнуть діяти з наступної місії');
    }
  });

  const soundToggle = document.getElementById('sound-toggle');
  soundToggle.addEventListener('change', () => setSound(soundToggle.checked));

  const about = document.getElementById('about');
  document.getElementById('about-btn').addEventListener('click', () => {
    renderAbout(document.getElementById('about-body'), app);
    about.showModal();
  });
  about.addEventListener('click', (e) => { if (e.target === about || e.target.closest('[data-close]')) about.close(); });
  const viewer = document.getElementById('viewer');
  viewer.addEventListener('click', (e) => { if (e.target === viewer || e.target.closest('[data-close]')) viewer.close(); });

  document.getElementById('demo-btn').addEventListener('click', () => startDemo(app));

  // Демо для презентації: #demo — показ з підписами; #demo1 і #demo2 — готові конструкції для гри вручну.
  const hash = location.hash.slice(1);
  if (hash === 'demo') {
    app.go('briefing', { focus: false });
    startDemo(app);
    return;
  }
  if (DEMO_BUILDS[hash]) {
    app.build = { ...emptyBuild(), ...DEMO_BUILDS[hash] };
    app.seed = DEMO_SEED;
    applyMode(false);
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
      applyMode(!!app.build.engineer);
      history.replaceState(null, '', location.pathname + location.search);
      app.go('builder', { focus: false });
      toast(`Завантажено місію ${app.seed}`);
      return;
    }
  }
  app.go('briefing', { focus: false });
}

start();
