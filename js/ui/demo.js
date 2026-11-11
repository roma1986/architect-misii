// Демо-показ: гра сама проходить сценарій «жадібна місія гине — виправлена перемагає».
// Ведучий натискає лише «Далі» (або пробіл), унизу — підпис до кожного кроку.
// Показ натискає справжні кнопки гри, тому журі бачить живий продукт, а не запис.
import { DEMO_SEED, DEMO_BUILDS, demoFlightPolicy, demoDevPolicy } from '../demo-script.js';
import { score } from '../explain.js';
import { toast } from './dom.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ACTS = { demo1: 'Акт 1 · Жадібна місія', demo2: 'Акт 2 · Виправлена місія', end: 'Тепер ваша черга' };

/** Кроки показу. run — що зробити, focus — що підсвітити, caption — підпис (рядок або функція). */
const STEPS = [
  {
    act: 'demo1', focus: '.windows',
    caption: 'Ми — головні інженери місії. Ціль — Марс, клас Flagship, завдання — шукати сліди життя. Старт у листопаді 2026: вікно до Марса відкривається раз на 26 місяців.',
    run: (d) => d.load('demo1', 'briefing'),
  },
  {
    act: 'demo1', focus: '.board',
    caption: 'Беремо все й одразу: шість приладів, великі сонячні панелі, маленьку антену. Резерв бюджету лише 15%. Усі чотири шкали зелені, тож летимо.',
    run: (d) => d.app.go('builder'),
  },
  {
    act: 'demo1', focus: '.stack-wrap',
    caption: 'Ровер важить близько тонни, а на старті — майже чотири: теплозахисний екран, парашут і перелітний модуль. Так само було в Perseverance.',
    run: () => {},
  },
  {
    act: 'demo1', focus: '[data-testing="min"]',
    caption: 'Між кресленням і стартом — роки розробки. Щоб зекономити, обираємо мінімальні випробування.',
    run: (d) => d.click('#launch'),
  },
  {
    act: 'demo1', focus: '.log',
    caption: (d) => `Програмне забезпечення запізнилося, як у місії Psyche. Резерв тане: залишилось ${Math.round(Math.max(0, d.app.dev.reserve))} млн $. Але апарат готовий.`,
    run: (d) => d.devRun(),
  },
  {
    act: 'demo1', focus: '.decision',
    caption: 'Старт! Сім місяців перельоту, і ми біля Марса. Де сідати? Цікавіші місця небезпечніші. Обираємо кратер Ґейл, де працює Curiosity.',
    run: async (d) => { await d.launch(); d.flightUntil('site'); },
  },
  {
    act: 'demo1', focus: '.decision',
    caption: 'Посадка вдалася. Перша проблема: прилади збирають більше даних, ніж маленька антена встигає передати. Що не передано, те втрачено.',
    run: (d) => { d.choose('site'); d.flightUntil('priority'); },
  },
  {
    act: 'demo1', focus: '.decision',
    caption: 'Пилова буря закрила Сонце: панелі дають лише 40%. Безпечно — заснути й перечекати. Але науки ж хочеться! Працюємо далі.',
    run: (d) => { d.choose('priority'); d.flightUntil('storm'); },
  },
  {
    act: 'demo1', focus: '.log',
    caption: 'Акумулятор розрядився, апарат замерз. Так у 2018 році замовк марсохід Opportunity. Кожна подія в грі — справжній випадок з історії.',
    run: (d) => { d.choose('storm'); d.flightUntil(null); },
  },
  {
    act: 'demo1', focus: '.reasons',
    caption: (d) => `${score(d.app.mission).total} балів зі 100. Гра не просто ставить оцінку, а пояснює причини: що саме пішло не так і скільки науки це коштувало.`,
    run: (d) => d.click('[data-act="summary"]'),
  },
  {
    act: 'demo2', focus: '.board',
    caption: 'Виправляємо помилки. Клас ризику B, резерв 25%, два РІТЕГи замість панелей, великий акумулятор, зв’язок через орбітер. Одним приладом жертвуємо.',
    run: (d) => d.load('demo2', 'builder'),
  },
  {
    act: 'demo2', focus: '.log',
    caption: 'Стандартні випробування. Апарат поважчав, але запас маси 20% це покрив. Графік витримано, резерв цілий.',
    run: (d) => { d.click('#launch'); d.devRun(); },
  },
  {
    act: 'demo2', focus: '.log',
    caption: 'Та сама буря приходить знову, але РІТЕГу Сонце не потрібне. Колесо заклинило — їдемо задом, як Spirit. NASA продовжує місію.',
    run: async (d) => { await d.launch(); d.flightUntil(null); },
  },
  {
    act: 'demo2', focus: '.summary-head',
    caption: (d) => `${score(d.app.mission).total} балів зі 100: базову місію виконано. Нижче — порівняння зі справжнім Perseverance і емблема нашої місії.`,
    run: (d) => d.click('[data-act="summary"]'),
  },
  {
    act: 'end', focus: null, last: true,
    caption: 'Ідеального апарата немає, є компроміси. У грі п’ять цілей — від Місяця до Європи, а в «Режимі інженера» можна керувати траєкторією, двигуном і орбітою. Спробуйте самі.',
    run: () => {},
  },
];

class Demo {
  constructor(app) {
    this.app = app;
    this.i = -1;
    this.busy = false;
    this.auto = false;
    this.acting = false;   // true, коли кнопку натискає сам показ
    this.timer = null;
    this.act = 'demo1';
  }

  start() {
    const { app } = this;
    app.demo = this;
    document.body.classList.add('demo-on');
    document.getElementById('mode-toggle').disabled = true;
    this.bar = document.createElement('div');
    this.bar.className = 'demo-bar';
    this.bar.setAttribute('role', 'region');
    this.bar.setAttribute('aria-label', 'Демо-показ');
    this.bar.innerHTML = `
      <div class="demo-text"><span class="demo-act"></span><p class="demo-caption" aria-live="polite"></p></div>
      <div class="demo-ctl">
        <span class="demo-progress num"></span>
        <label class="mode-switch"><input type="checkbox" data-demo="auto"><span>Автопоказ</span></label>
        <button type="button" class="btn" data-demo="next">Далі</button>
        <button type="button" class="btn secondary" data-demo="exit">Вийти</button>
      </div>`;
    document.body.appendChild(this.bar);
    this.bar.querySelector('[data-demo="next"]').addEventListener('click', () => this.next());
    this.bar.querySelector('[data-demo="exit"]').addEventListener('click', () => this.exit());
    this.bar.querySelector('[data-demo="auto"]').addEventListener('change', (e) => { this.auto = e.target.checked; this.schedule(); });

    // Під час показу гравець не керує грою сам: випадковий клік зіб’є сценарій
    this.onClick = (e) => {
      if (this.acting) return;
      if (e.target.closest('a, .zoom, [data-close]')) return;
      e.preventDefault(); e.stopPropagation();
      toast('У демо-показі натискайте «Далі». Щоб грати самому — «Вийти».');
    };
    app.root.addEventListener('click', this.onClick, true);
    this.onKey = (e) => {
      if (e.key === 'Escape' && !document.querySelector('dialog[open]')) { this.exit(); return; }
      if (![' ', 'ArrowRight', 'Enter'].includes(e.key)) return;
      if (e.target.closest('.demo-bar, dialog, .topbar')) return;
      e.preventDefault();
      this.next();
    };
    document.addEventListener('keydown', this.onKey);
    this.next();
  }

  // ---------- дії, з яких складаються кроки ----------
  /** Завантажити конструкцію акту і відкрити екран. */
  load(act, screen) {
    const { app } = this;
    this.act = act;
    app.build = JSON.parse(JSON.stringify(DEMO_BUILDS[act]));
    app.seed = DEMO_SEED;
    app.dev = null; app.mission = null;
    app.applyMode(false);
    app.go(screen);
  }

  /** Натиснути справжню кнопку гри. */
  click(selector) {
    const el = this.app.root.querySelector(selector);
    if (!el) throw new Error(`немає елемента ${selector}`);
    this.acting = true;
    try { el.click(); } finally { this.acting = false; }
  }
  option(id) { this.click(`[data-option="${CSS.escape(id)}"]`); }

  /** Пройти розробку до кінця з типовими рішеннями. */
  devRun() {
    this.click('[data-act="start"]');
    for (let guard = 0; guard < 80; guard++) {
      const dev = this.app.dev;
      if (dev.done) return;
      if (dev.pending) this.option(demoDevPolicy(dev.pending, dev));
      else this.click('[data-act="run"]');
    }
  }

  /** Старт: стартовий майданчик → відлік → зліт. */
  async launch() {
    this.click('[data-act="launchpad"]');
    this.click('[data-act="step"]');
    for (let t = 0; t < 100; t++) {
      if (!document.querySelector('.countdown') && this.app.mission && this.app.mission.entries.length) return;
      await sleep(100);
    }
    throw new Error('старт не завершився');
  }

  /** Летіти далі, поки не з’явиться рішення stopId (або до кінця місії, якщо null). */
  flightUntil(stopId) {
    const policy = demoFlightPolicy(this.act);
    for (let guard = 0; guard < 300; guard++) {
      const m = this.app.mission;
      if (m.pending) {
        if (stopId && m.pending.id === stopId) return;
        this.option(policy(m.pending, m));
      } else if (m.done) {
        return;
      } else {
        this.click('[data-act="run"]');
      }
    }
  }

  /** Обрати варіант у рішенні, на якому показ зупинився. */
  choose(expectedId) {
    const m = this.app.mission;
    if (!m.pending || m.pending.id !== expectedId) return; // сценарій трохи відхилився: просто йдемо далі
    this.option(demoFlightPolicy(this.act)(m.pending, m));
  }

  // ---------- керування показом ----------
  async next() {
    if (this.busy) return;
    clearTimeout(this.timer);
    const prev = STEPS[this.i];
    if (prev && prev.last) {
      if (this.auto) { this.i = -1; } else { this.finish(); return; }
    }
    this.i += 1;
    const step = STEPS[this.i];
    this.busy = true;
    this.paint();
    try {
      await step.run(this);
      this.caption = typeof step.caption === 'function' ? step.caption(this) : step.caption;
      this.error = false;
    } catch (err) {
      console.error(err);
      this.caption = `Показ зійшов зі сценарію (${err.message}). Натисніть «Далі», щоб почати спочатку.`;
      this.error = true;
      this.i = -1;
    }
    this.busy = false;
    this.paint();
    this.highlight(this.error ? null : step.focus);
    this.schedule();
  }

  schedule() {
    clearTimeout(this.timer);
    if (!this.auto || this.busy) return;
    const ms = Math.min(11000, Math.max(4500, (this.caption || '').length * 60));
    this.timer = setTimeout(() => this.next(), ms);
  }

  paint() {
    const step = STEPS[Math.max(0, this.i)];
    const q = (s) => this.bar.querySelector(s);
    q('.demo-act').textContent = ACTS[step.act];
    q('.demo-caption').textContent = this.busy ? '…' : this.caption;
    q('.demo-progress').textContent = `${Math.max(1, this.i + 1)} / ${STEPS.length}`;
    const next = q('[data-demo="next"]');
    next.disabled = this.busy;
    next.textContent = step.last && !this.busy && !this.error ? 'Грати самому' : 'Далі';
  }

  highlight(selector) {
    document.querySelectorAll('.demo-focus').forEach((el) => el.classList.remove('demo-focus'));
    if (!selector) return;
    const el = this.app.root.querySelector(selector);
    if (!el) return;
    el.classList.add('demo-focus');
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    // Далекий стрибок робимо миттєво: плавне прокручування довгої сторінки займає секунди
    const far = Math.abs(el.getBoundingClientRect().top) > window.innerHeight * 1.5;
    el.scrollIntoView({ block: 'center', behavior: reduce || far ? 'auto' : 'smooth' });
  }

  /** Кінець показу: чиста гра з брифінгу. */
  finish() {
    this.exit(false);
    this.app.reset();
    this.app.go('briefing');
  }

  exit(note = true) {
    clearTimeout(this.timer);
    this.app.root.removeEventListener('click', this.onClick, true);
    document.removeEventListener('keydown', this.onKey);
    document.querySelectorAll('.demo-focus').forEach((el) => el.classList.remove('demo-focus'));
    this.bar.remove();
    document.body.classList.remove('demo-on');
    document.getElementById('mode-toggle').disabled = false;
    this.app.demo = null;
    if (note) toast('Демо-показ завершено. Далі граєте самі.');
  }
}

export function startDemo(app) {
  if (app.demo) return;
  new Demo(app).start();
}
