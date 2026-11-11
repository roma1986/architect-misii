// Етап «Розробка і випробування»: між конструктором і стартом.
// Резерв бюджету, зростання маси, випробування, зрив графіка і вікно запуску. Без DOM.
import {
  resolveBuild, checkBuild, byId, isSurface, weight, windowInfo, addMonths, DESIGN_MARGIN,
} from './calc.js';
import { makeRng } from './rng.js';

export class Development {
  constructor(data, build, seed) {
    this.data = data;
    this.cfg = data.dev;
    this.seed = seed;
    this.rng = makeRng(`${seed}-dev`);
    this.build = JSON.parse(JSON.stringify(build));
    this.build.massGrowth = 0;
    const c = this.check();
    this.base = c.cost.total;            // вартість проєкту без резерву
    this.reserve0 = c.cost.reserve;      // відкладений резерв
    this.reserve = this.reserve0;
    this.budget = this.r.cls.budget_musd;
    this.months = 0;                     // накопичена затримка
    this.relMult = this.r.risk.fail_mult * this.r.testing.fail_mult;
    this.launch0 = this.build.launch;
    this.descoped = [];
    this.flags = { rush: false, waited: false, hiddenDefect: false, extraMoney: false };
    this.entries = [];
    this.pending = null;
    this.done = false;
    this.cancelled = false;
    this.started = false;
    this.steps = ['testing', 'mass', ...this.cfg.events.map((e) => `event:${e.id}`), 'schedule', 'finish'];
  }

  get r() { return resolveBuild(this.data, this.build); }
  check() { return checkBuild(this.r); }
  get spent() { return this.base + (this.reserve0 - this.reserve); }
  get overrun() { return Math.max(0, -this.reserve); }

  log(code, params = {}, tone = 'info', fact = null) { this.entries.push({ code, params, tone, fact }); }
  ask(decision) { this.pending = decision; return { kind: 'decision', decision }; }
  choose(id) {
    const d = this.pending;
    if (!d) return;
    this.pending = null;
    this.log('choice', { decision: d.id, option: id }, 'decision');
    d.apply(id);
  }

  spend(amount, why) {
    this.reserve -= amount;
    if (amount > 0) this.log('spend', { amount, why, left: this.reserve }, this.reserve < 0 ? 'bad' : 'info');
  }

  /** Прилади, які можна зняти, від найменш цінного для завдання. */
  descopeOptions() {
    const r = this.r;
    return [...r.instruments]
      .sort((a, b) => a.science_base * weight(a, r.goal) - b.science_base * weight(b, r.goal))
      .slice(0, 3)
      .map((i) => ({ id: `drop:${i.id}`, instr: i }));
  }
  drop(id) {
    const r = this.r;
    const instr = byId(this.data.components.instruments, id);
    this.build.instruments = this.build.instruments.filter((x) => x !== id);
    this.descoped.push(instr);
    const refund = instr.cost_musd * r.risk.cost_mult * this.cfg.descope_refund;
    this.reserve += refund;
    this.log('descoped', { instr, refund }, 'bad');
  }

  /** Чи не закінчилися гроші і чи вміщається апарат у ракету. Повертає рішення або null. */
  guard() {
    if (this.reserve < 0 && !this.flags.extraMoney) {
      const opts = this.r.instruments.length > 1 ? this.descopeOptions() : [];
      return this.ask({
        id: 'money',
        params: { deficit: -this.reserve },
        options: [...opts, { id: 'ask' }],
        apply: (id) => {
          if (id.startsWith('drop:')) { this.drop(id.slice(5)); return; }
          if (this.rng() < this.cfg.extra_money_chance) {
            this.flags.extraMoney = true;
            this.log('money_granted', { amount: -this.reserve }, 'good');
          } else {
            this.cancel();
          }
        },
      });
    }
    if (this.reserve < 0 && this.spent > this.budget * 1.15) { this.cancel(); return { kind: 'cancelled' }; }
    const c = this.check();
    if (c.capacity > 0 && c.mass.launch > c.capacity) {
      const overPct = (c.mass.launch / c.capacity - 1) * 100;
      const lwCost = Math.max(5, overPct * this.cfg.lightweight_cost_pct_per_pct * this.base / 100);
      const opts = this.r.instruments.length > 1 ? this.descopeOptions() : [];
      return this.ask({
        id: 'overweight',
        params: { over: c.mass.launch - c.capacity, lwCost },
        options: [...opts, { id: 'lightweight' }],
        apply: (id) => {
          if (id.startsWith('drop:')) { this.drop(id.slice(5)); return; }
          // Полегшення конструкції: платимо і зменшуємо приріст маси рівно настільки, щоб вміститися
          let lo = -DESIGN_MARGIN; let hi = this.build.massGrowth;
          for (let i = 0; i < 30; i++) {
            const mid = (lo + hi) / 2;
            this.build.massGrowth = mid;
            const cc = this.check();
            if (cc.mass.launch > cc.capacity * 0.995) hi = mid; else lo = mid;
          }
          this.build.massGrowth = lo;
          this.log('lightweighted', { cost: lwCost }, 'info');
          this.spend(lwCost, 'lightweight');
        },
      });
    }
    return null;
  }

  cancel() {
    this.cancelled = true;
    this.done = true;
    this.log('cancelled', {}, 'bad', this.cfg.facts.cancelled);
  }

  /** Один крок розробки. */
  advance() {
    if (this.done) return { kind: 'done' };
    if (this.pending) return { kind: 'decision', decision: this.pending };
    this.started = true;
    const g = this.guard();
    if (g) return g;
    if (this.done) return { kind: 'done' };
    const step = this.steps.shift();
    if (!step) { this.done = true; return { kind: 'done' }; }
    const r = this.r;

    if (step === 'testing') {
      const t = r.testing;
      this.months += t.months;
      this.log('testing', { level: t }, 'info');
      this.spend(this.base * t.cost_pct / 100, 'testing');
    } else if (step === 'mass') {
      const mg = this.cfg.mass_growth;
      const bias = r.risk.id === 'D' ? 0.04 : r.risk.id === 'A' ? -0.03 : 0;
      const growth = mg.min + this.rng() * (mg.max - mg.min) + bias;
      this.build.massGrowth = Math.max(0, growth - DESIGN_MARGIN);
      const c = this.check();
      this.log('mass_growth', { growth, extra: this.build.massGrowth, launch: c.mass.launch, capacity: c.capacity }, growth > DESIGN_MARGIN ? 'bad' : 'good', mg.fact);
    } else if (step.startsWith('event:')) {
      const ev = byId(this.cfg.events, step.slice(6));
      const w = ev.when || {};
      const applies = (!w.landing_type || w.landing_type.includes(r.target.landing.type)) && (w.surface === undefined || w.surface === isSurface(r));
      if (!applies) return this.advance();
      const happens = this.rng() < ev.prob * (ev.good ? 1 : r.risk.dev_event_mult);
      const costPct = ev.cost_pct ? ev.cost_pct[0] + this.rng() * (ev.cost_pct[1] - ev.cost_pct[0]) : 0;
      const delay = ev.delay_months ? Math.round(ev.delay_months[0] + this.rng() * (ev.delay_months[1] - ev.delay_months[0])) : 0;
      if (!happens) return this.advance();
      if (ev.needs_testing && r.testing.id === 'min') {
        // Дефект є, але без випробувань його не знайшли: полетить разом з апаратом
        this.flags.hiddenDefect = true;
        this.relMult *= 1.25;
        return this.advance();
      }
      if (ev.mass_pct) this.build.massGrowth = Math.max(-0.05, this.build.massGrowth + ev.mass_pct / 100);
      this.months += delay;
      this.log('event', { ev, delay, cost: this.base * costPct / 100 }, ev.good ? 'good' : 'bad', { uk: ev.fact.uk, source: ev.source });
      this.spend(this.base * costPct / 100, ev.id);
    } else if (step === 'schedule') {
      const slack = this.cfg.slack_months;
      const over = this.months - slack;
      const t = r.target;
      if (over <= 0) {
        this.log('on_time', { months: this.months, slack }, 'good');
      } else if (!t.window) {
        const cost = this.base * 0.005 * over;
        this.build.launch = addMonths(this.build.launch, over);
        this.log('late_no_window', { over, launch: this.build.launch }, 'bad');
        this.spend(cost, 'delay');
      } else {
        const next = this.nextWindow();
        const years = t.window.synodic_days / 365.25;
        const waitCost = this.base * this.cfg.wait_cost_pct_per_year / 100 * years;
        return this.ask({
          id: 'slip',
          params: { over, next, waitCost, months: Math.round(years * 12) },
          options: [{ id: 'rush' }, { id: 'wait' }],
          apply: (id) => {
            if (id === 'rush') {
              this.flags.rush = true;
              this.relMult *= 1.3;
              this.log('rushed', {}, 'bad');
            } else {
              this.flags.waited = true;
              this.build.launch = next;
              this.log('waited', { next }, 'info', this.cfg.facts.wait);
              this.spend(waitCost, 'wait');
            }
          },
        });
      }
    } else if (step === 'finish') {
      this.done = true;
      this.log('ready', { spent: this.spent, left: this.reserve, rel: this.relMult }, 'good');
      return { kind: 'done' };
    }
    return { kind: 'step' };
  }

  /** Місяць наступного вікна запуску після поточного. */
  nextWindow() {
    const t = this.r.target;
    const months = Math.round(t.window.synodic_days / 30.44);
    let cand = addMonths(this.build.launch, months);
    // підправляємо на ±2 місяці до найкращого множника
    let best = cand;
    for (let d = -2; d <= 2; d++) {
      const m = addMonths(cand, d);
      if (windowInfo(t, m).factor > windowInfo(t, best).factor) best = m;
    }
    return best;
  }

  runAuto(policy = defaultDevPolicy) {
    let guard = 0;
    while (!this.done && guard++ < 200) {
      const res = this.advance();
      if (res.kind === 'decision') this.choose(policy(res.decision, this));
    }
    return this;
  }
}

/** Типова політика для автопроходу і перевірки балансу. */
export function defaultDevPolicy(decision, dev) {
  const drop = decision.options.find((o) => o.id.startsWith('drop:'));
  switch (decision.id) {
    case 'overweight': return drop && decision.params.lwCost > dev.reserve ? drop.id : 'lightweight';
    case 'money': return drop ? drop.id : 'ask';
    case 'slip': return decision.params.waitCost <= dev.reserve ? 'wait' : 'rush';
    default: return decision.options[0].id;
  }
}
