// Покрокова симуляція місії. Без DOM: інтерфейс викликає advance() і choose(),
// а tools/montecarlo.js проганяє тисячі місій з автоматичною політикою рішень.

import {
  resolveBuild, checkBuild, isSurface, hasExtra, powerProduced, busPower, instrumentPower,
  earthDistanceAu, conjunctionBetween, downlinkPerDay, rocketReliability, stepFailProb,
  weight, idealSciencePerStep, clamp, byId, MARGIN_PENALTY, opsSteps, flightDays, siteSolarMult, siteHeaterMult,
} from './calc.js';
import { makeRng } from './rng.js';
import { rollEvents } from './events.js';
import { Development } from './dev.js';

export class Mission {
  constructor(data, build, seed, dev = null) {
    this.data = data;
    // Етап розробки міг змінити конструкцію (зняті прилади, нова дата запуску, приріст маси)
    this.dev = dev || new Development(data, build, seed).runAuto();
    build = this.dev.build;
    this.build = build;
    this.seed = seed;
    this.rng = makeRng(`${seed}`);
    this.r = resolveBuild(data, build);
    this.check = checkBuild(this.r);
    const thin = this.check.bars.mass.status === 'warn' || this.check.bars.power.status === 'warn';
    this.penalty = thin ? MARGIN_PENALTY : 1;
    const t = this.r.target;
    // Радіація (Юпітер): прилади й платформа ламаються частіше, сейф зменшує ефект
    this.radPenalty = t.radiation_mult ? (hasExtra(this.r, 'radiation_vault') ? 1.2 : t.radiation_mult) : 1;
    // Клас ризику і обсяг випробувань (з етапу розробки) множать шанс відмов
    this.relMult = this.dev.relMult;
    this.spent = this.dev.spent;

    this.s = {
      phase: 'launch',
      step: 0,
      steps: opsSteps(this.r),
      alive: true,
      lost: null,             // причина втрати місії
      site: null,
      siteMult: (t.science_value || 1) * (isSurface(this.r) ? 1 : (this.r.orbit?.science_mult ?? 1)),   // цінність цілі й висота орбіти
      siteSolar: 1,
      heater: 1,
      dust: 1,
      powerMult: 1,
      mobility: 1,
      storm: 0,               // скільки кроків ще триває буря
      stormsSeen: 0,
      stormMode: null,
      conjunctionPlan: null,
      priority: 'equal',
      priorityAsked: false,
      skipStep: false,
      extended: false,
      backupUsed: false,
      antenna: this.r.antenna,
      instruments: this.r.instruments.map((def) => ({ def, alive: true })),
      science: 0,
      bonusScience: 0,
      ideal: 0,               // скільки науки було б за ідеальних умов
      losses: {},             // причина → втрачена наука
      lossCount: {},          // причина → скільки кроків/разів
      happened: new Set(),
      prep: null,
    };
    this.pending = null;
    this.entries = [];
    this.timeline = [];
    if (this.dev.cancelled) {
      // Проєкт закрили ще до старту: перевитрата бюджету
      const s = this.s;
      s.alive = false; s.lost = 'cancelled'; s.phase = 'done';
      s.ideal = this.idealPerStep(true) * s.steps;
      this.loss('lost_cancelled', s.ideal, s.steps);
    }
  }

  // ---------- журнал ----------
  log(code, params = {}, tone = 'info', ev = null) {
    this.entries.push({ code, params, tone, step: this.s.step, phase: this.s.phase, event: ev });
  }
  fact(id) { this.entries.push({ code: 'fact', params: { id }, tone: 'fact', step: this.s.step, phase: this.s.phase }); }

  loss(cause, amount, count = 1) {
    if (amount <= 0) return;
    this.s.losses[cause] = (this.s.losses[cause] || 0) + amount;
    this.s.lossCount[cause] = (this.s.lossCount[cause] || 0) + count;
  }

  get done() { return this.s.phase === 'done'; }
  get aliveInstruments() { return this.s.instruments.filter((i) => i.alive).map((i) => i.def); }
  idealPerStep(all = true) {
    const list = all ? this.r.instruments : this.aliveInstruments;
    return idealSciencePerStep(list, this.r.goal, this.s.siteMult);
  }

  ask(decision) { this.pending = decision; return { kind: 'decision', decision }; }

  /** Гравець (або автоматична політика) обирає варіант. */
  choose(optionId) {
    const d = this.pending;
    if (!d) return;
    this.pending = null;
    this.log('choice', { decision: d.id, option: optionId }, 'decision');
    d.apply(optionId);
  }

  /** Просунути місію на один крок. Повертає опис того, що сталося. */
  advance() {
    if (this.pending) return { kind: 'decision', decision: this.pending };
    const s = this.s;
    switch (s.phase) {
      case 'launch': return this.doLaunch();
      case 'cruise': return this.doCruise();
      case 'arrival': return this.doArrival();
      case 'ops': return this.doOpsStep();
      case 'end': return this.doEnd();
      default: return { kind: 'done' };
    }
  }

  lose(cause) {
    const s = this.s;
    s.alive = false;
    s.lost = cause;
    // Наука, яку не встигли отримати на поточному кроці, теж записуємо на причину втрати
    const accounted = s.science - s.bonusScience + Object.values(s.losses).reduce((a, b) => a + b, 0);
    this.loss(`lost_${cause}`, s.ideal - accounted, 0);
    const remaining = Math.max(0, s.steps - s.step);
    this.loss(`lost_${cause}`, this.idealPerStep(true) * remaining, remaining);
    s.ideal += this.idealPerStep(true) * remaining;
    this.log('lost', { cause }, 'bad');
    const factId = { launch: 'launch_fail', capture: 'capture_fail', landing: 'landing_fail', storm: 'dust_storm', night: 'lunar_night', platform: 'platform_fail', comms: 'comms_lost', power: 'dust_storm', touch: 'touch_fail' }[cause];
    if (factId) this.fact(factId);
    s.phase = 'done';
    return { kind: 'lost', cause };
  }

  // ---------- фази ----------
  doLaunch() {
    const p = rocketReliability(this.r.rocket);
    this.log('launch', { rocket: this.r.rocket, p }, 'info');
    if (this.rng() > p) return this.lose('launch');
    this.log('launch_ok', {}, 'good');
    this.s.phase = 'cruise';
    return { kind: 'phase', phase: 'launch' };
  }

  doCruise() {
    this.log('cruise', { days: flightDays(this.r) }, 'info');
    rollEvents(this, 'cruise');
    if (!this.s.alive) return { kind: 'lost', cause: this.s.lost };
    this.s.phase = 'arrival';
    if (this.pending) return { kind: 'decision', decision: this.pending };
    return { kind: 'phase', phase: 'cruise' };
  }

  doArrival() {
    const r = this.r;
    const t = r.target;
    if (!isSurface(r)) {
      const p = t.orbit_capture_risk * this.penalty + (this.s.navError ? 0.4 : 0);
      if (this.rng() < p) return this.lose('capture');
      this.log('orbit_ok', {}, 'good');
    } else {
      if (!this.s.site) {
        return this.ask({
          id: 'site',
          options: t.sites.map((site) => ({ id: site.id, site })),
          apply: (id) => {
            const site = byId(t.sites, id);
            this.s.site = site;
            this.s.siteMult = (t.science_value || 1) * site.science_mult * (t.surface_science_mult || 1);
            this.s.siteSolar = siteSolarMult(site);
            this.s.heater = siteHeaterMult(site);
          },
        });
      }
      const p = clamp(this.s.site.risk * this.penalty * (0.7 + 0.3 * this.relMult) + (this.s.navError ? 0.4 : 0), 0, 0.95);
      this.log('landing', { site: this.s.site, p }, 'info');
      if (this.rng() < p) return this.lose('landing');
      this.log('landing_ok', { site: this.s.site }, 'good');
    }
    if (t.optical_mult && r.instruments.some((i) => i.optical)) this.fact('venus_clouds');
    if (t.radiation_mult) this.fact('radiation');
    rollEvents(this, 'arrival');
    if (!this.s.alive) return { kind: 'lost', cause: this.s.lost };
    this.s.phase = 'ops';
    return { kind: 'phase', phase: 'arrival' };
  }

  /** Перед кроком: перевірити, чи не потрібне рішення гравця. Кожна перевірка — раз на крок. */
  prepareStep() {
    const s = this.s;
    const r = this.r;
    const t = r.target;
    const d0 = s.step * t.step_days;
    const done = s.prep || (s.prep = {});

    // Пилова буря (Марс)
    if (!done.storm) {
      done.storm = true;
      if (s.storm === 0 && t.dust_storm_prob > 0 && this.rng() < t.dust_storm_prob) {
        s.storm = 2;
        s.stormsSeen += 1;
        s.stormMode = 'auto';
        this.log('storm_start', {}, 'bad');
        if (isSurface(r) && r.power.type === 'solar') {
          return this.ask({ id: 'storm', options: [{ id: 'sleep' }, { id: 'continue' }], apply: (id) => { s.stormMode = id; } });
        }
      }
    }

    // Сонячне з’єднання
    if (!done.conj) {
      done.conj = true;
      s.conjunctionNow = conjunctionBetween(t, d0, d0 + t.step_days);
      if (s.conjunctionNow) {
        return this.ask({ id: 'conjunction', options: [{ id: 'upload' }, { id: 'idle' }], apply: (id) => { s.conjunctionPlan = id; } });
      }
    }

    // Відбір зразка (зонд-пробовідбірник): у середині наукової програми
    if (!done.sample) {
      done.sample = true;
      const arm = s.instruments.find((i) => i.def.id === 'sample_arm' && i.alive);
      if (r.platform.sample_return && arm && !s.sampled && s.step >= Math.floor(t.ops_steps / 2)) {
        s.sampled = true;
        return this.ask({
          id: 'sample',
          options: [...t.sites.map((site) => ({ id: site.id, site })), { id: 'skip' }],
          apply: (id) => this.takeSample(id),
        });
      }
    }

    // Вузьке місце зв’язку: питаємо один раз за місію
    if (!done.prio) {
      done.prio = true;
      if (!s.priorityAsked) {
        const dist = earthDistanceAu(t, d0 + t.step_days / 2);
        const down = downlinkPerDay(s.antenna, t, dist, r.dsn);
        const coll = this.aliveInstruments.reduce((a, i) => a + i.data_mbit_per_day, 0);
        if (coll > 0 && down / coll < 0.6) {
          s.priorityAsked = true;
          return this.ask({ id: 'priority', options: [{ id: 'science' }, { id: 'equal' }], params: { share: down / coll }, apply: (id) => { s.priority = id; } });
        }
      }
    }
    return null;
  }

  doOpsStep() {
    const s = this.s;
    const decision = this.prepareStep();
    if (decision) return decision;
    s.prep = null;
    const out = this.runStep();
    if (!s.alive) return { kind: 'lost', cause: s.lost, step: out };
    if (s.step >= s.steps) s.phase = 'end';
    return { kind: 'step', step: out };
  }

  runStep() {
    const s = this.s;
    const r = this.r;
    const t = r.target;
    const stepDays = t.step_days;
    const d0 = s.step * stepDays;
    const years = (flightDays(r) + d0) / 365.25;
    const dist = earthDistanceAu(t, d0 + stepDays / 2);
    const solar = r.power.type === 'solar';
    const surface = isSurface(r);
    const battery = hasExtra(r, 'big_battery');
    s.step += 1;

    const idealAll = this.idealPerStep(true);
    s.ideal += idealAll;
    const tele = { step: s.step, day: d0, dist, storm: s.storm > 0, conjunction: !!s.conjunctionNow };

    // Відмови приладів (до роботи на цьому кроці не впливають — впливають далі)
    const aliveBefore = this.aliveInstruments.filter((i) => i.id !== s.skipNext);
    s.skipNext = null;
    const idealAlive = idealSciencePerStep(aliveBefore, r.goal, s.siteMult);
    const idealNotDead = idealSciencePerStep(this.aliveInstruments, r.goal, s.siteMult);
    this.loss('failure', idealAll - idealNotDead);
    this.loss('skipped', idealNotDead - idealAlive);

    // Кроки, на яких наука неможлива
    const night = t.surface_night_kills_solar && surface && solar && s.step % 2 === 0;
    const sleeping = s.storm > 0 && s.stormMode === 'sleep';
    if (night || sleeping || s.skipStep) {
      const cause = night ? 'night' : sleeping ? 'sleep' : 'reset';
      this.loss(cause, idealAlive);
      this.log(cause, {}, cause === 'reset' ? 'bad' : 'info');
      s.skipStep = false;
      if (night) {
        const pDie = battery ? 0.25 : 0.8;
        if (this.rng() < pDie) { this.endStorm(); this.lose('night'); return tele; }
        this.log('night_survived', {}, 'good');
      }
      this.endStorm();
      this.afterStep(tele, { produced: 0, u: 0, collected: 0, sent: 0, sci: 0 });
      return tele;
    }

    // Енергія
    const stormSolar = s.storm > 0 && solar && surface ? 0.4 : 1;
    const produced = powerProduced(r, { years, dust: surface && solar ? s.dust : 1, solarMult: stormSolar * (surface && solar ? s.siteSolar : 1) }) * s.powerMult;
    const bus = busPower(r) * (surface ? s.heater : 1);
    const instrDemand = instrumentPower(aliveBefore);
    let u = instrDemand > 0 ? clamp((produced - bus) / instrDemand, 0, 1) : 0;

    if (produced < bus) {
      u = 0;
      this.log('safe_mode', { produced, bus }, 'bad');
      const pDie = battery ? 0.05 : 0.15;
      if (this.rng() < pDie) { this.endStorm(); this.lose('power'); return tele; }
    }
    if (s.storm > 0 && s.stormMode === 'continue') {
      const pDie = battery ? 0.05 : 0.2;
      if (this.rng() < pDie) { this.endStorm(); this.lose('storm'); return tele; }
    }

    // Наука до урахування зв’язку: хмари (Венера), буря (Марс), рухливість ровера
    const cloudF = t.optical_mult ?? 1;
    const stormF = s.storm > 0 ? 0.6 : 1;
    const mob = r.platform.type === 'rover' ? s.mobility : 1;
    let cloudLoss = 0; let stormLoss = 0; let mobLoss = 0;
    const base = aliveBefore.map((i) => {
      const w = weight(i, r.goal) * i.science_base * s.siteMult;
      const c = i.optical ? cloudF : 1;
      const st = i.optical ? stormF : 1;
      cloudLoss += w * (1 - c);
      stormLoss += w * c * (1 - st);
      mobLoss += w * c * st * (1 - mob);
      const env = w * c * st * mob;
      return { i, ideal: w, env, worked: env * u, data: i.data_mbit_per_day * stepDays * u };
    });
    const envSum = base.reduce((a, b) => a + b.env, 0);
    const workedSum = base.reduce((a, b) => a + b.worked, 0);
    this.loss('clouds', cloudLoss);
    this.loss('storm', stormLoss);
    this.loss('mobility', mobLoss);
    this.loss(s.storm > 0 && solar && surface ? 'storm' : 'power', envSum - workedSum);

    // Зв’язок: скільки даних встигнемо передати
    let capacity = downlinkPerDay(s.antenna, t, dist, r.dsn) * stepDays;
    const fullCapacity = capacity;
    let idleFactor = 1;
    if (s.conjunctionNow) {
      capacity *= 0.5; // ~2 тижні без зв’язку
      if (s.conjunctionPlan === 'idle') idleFactor = 0.5;
    }
    const sentShares = allocate(base, capacity, s.priority);
    const sentFull = allocate(base, fullCapacity, s.priority);
    let sci = 0;
    let sent = 0;
    let sciNoConj = 0;
    base.forEach((b, k) => {
      sci += b.worked * sentShares[k] * idleFactor;
      sciNoConj += b.worked * sentFull[k];
      sent += b.data * sentShares[k];
    });
    this.loss('downlink', workedSum - sciNoConj);
    this.loss('conjunction', sciNoConj - sci);
    s.science += sci;

    this.afterStep(tele, { produced, u, collected: base.reduce((a, b) => a + b.data, 0), sent, sci, capacity });

    // Відмови після кроку
    const steps = s.steps;
    s.instruments.forEach((x) => {
      if (x.alive && this.rng() < stepFailProb(x.def.reliability, steps, this.penalty * this.radPenalty * this.relMult)) {
        x.alive = false;
        this.log('instrument_fail', { instr: x.def }, 'bad');
        if (!s.happened.has('fact_instr')) { s.happened.add('fact_instr'); this.fact('instrument_fail'); }
      }
    });
    if (this.rng() < stepFailProb(s.antenna.reliability, steps, this.penalty * this.radPenalty * this.relMult)) this.failAntenna('wear');
    if (s.alive && this.rng() < stepFailProb(r.platform.reliability, steps, this.penalty * this.radPenalty * this.relMult)) { this.lose('platform'); return tele; }

    if (s.alive) rollEvents(this, 'ops');
    if (s.alive && surface && solar) s.dust = Math.max(0.2, s.dust * (1 - t.dust_per_step));
    this.endStorm();
    return tele;
  }

  /** Торкнутися астероїда і взяти зразок. Зразок досліджують на Землі — це найцінніша наука. */
  takeSample(id) {
    const s = this.s;
    if (id === 'skip') { this.log('sample_skip', {}, 'info'); return; }
    const site = byId(this.r.target.sites, id);
    const arm = s.instruments.find((i) => i.def.id === 'sample_arm');
    const p = clamp(site.risk * this.penalty, 0, 0.9);
    this.log('touch', { site, p }, 'info');
    if (this.rng() < p) {
      arm.alive = false;
      this.log('touch_fail', { site }, 'bad');
      this.fact('touch_fail');
      if (this.rng() < 0.25) this.lose('touch');
      return;
    }
    const bonus = 12 * weight(arm.def, this.r.goal) * site.science_mult;
    s.science += bonus;
    s.sampleScience = bonus;
    s.sampleSite = site;
    this.log('touch_ok', { site, bonus }, 'good');
    this.fact('sample');
  }

  endStorm() {
    const s = this.s;
    if (s.storm > 0) {
      s.storm -= 1;
      if (s.storm === 0) {
        this.log('storm_end', {}, 'good');
        if (!s.happened.has('fact_storm')) { s.happened.add('fact_storm'); this.fact('dust_storm'); }
      }
    }
    if (s.conjunctionNow) {
      s.conjunctionNow = false;
      if (!s.happened.has('fact_conj')) { s.happened.add('fact_conj'); this.fact('conjunction'); }
    }
  }

  afterStep(tele, v) {
    Object.assign(tele, v, { science: this.s.science, dust: this.s.dust });
    this.timeline.push(tele);
    if (v.produced > 0) this.log('step', { sci: v.sci, u: v.u, sent: v.collected ? v.sent / v.collected : 1 }, 'info');
  }

  failAntenna(reason) {
    const s = this.s;
    if (!s.alive) return;
    if (hasExtra(this.r, 'backup_antenna') && !s.backupUsed) {
      s.backupUsed = true;
      this.log('backup_antenna', { reason }, 'good');
      return;
    }
    const lga = byId(this.data.components.antennas, 'lga');
    if (s.antenna.id !== 'lga' && !s.antenna.relay && lga) {
      s.antenna = lga;
      this.log('antenna_fallback', { reason }, 'bad');
    } else {
      this.lose('comms');
    }
  }

  doEnd() {
    const s = this.s;
    if (s.alive && isSurface(this.r) && this.r.target.surface_ops_steps) {
      s.phase = 'done';
      this.log('heat_end', {}, 'info');
      this.fact('venus_heat');
      return { kind: 'done' };
    }
    if (!s.extended && s.alive) {
      s.extended = true;
      const p = 0.4 + (this.r.power.type === 'rtg' ? 0.2 : 0) + (s.instruments.every((i) => i.alive) ? 0.1 : 0);
      if (this.rng() < p) {
        s.steps += 3;
        s.phase = 'ops';
        this.log('extended', { steps: 3 }, 'good');
        this.fact('extended');
        return { kind: 'phase', phase: 'extended' };
      }
    }
    s.phase = 'done';
    this.log('complete', {}, 'good');
    return { kind: 'done' };
  }

  /** Прогнати до кінця з автоматичними рішеннями (для Монте-Карло і швидкого демо). */
  runAuto(policy = defaultPolicy) {
    let guard = 0;
    while (!this.done && guard++ < 500) {
      const res = this.advance();
      if (res.kind === 'decision') this.choose(policy(res.decision, this));
    }
    return this;
  }
}

/** Розподіл каналу між приладами. Повертає частку переданих даних для кожного. */
function allocate(base, capacity, priority) {
  const total = base.reduce((a, b) => a + b.data, 0);
  if (total <= 0) return base.map(() => 1);
  if (capacity >= total) return base.map(() => 1);
  if (priority === 'equal') return base.map(() => capacity / total);
  // 'science': спершу дані з найбільшою наукою на мегабіт
  const order = base.map((b, k) => ({ k, value: b.data > 0 ? b.worked / b.data : Infinity }))
    .sort((a, b) => b.value - a.value);
  const shares = base.map(() => 0);
  let left = capacity;
  for (const { k } of order) {
    const d = base[k].data;
    if (d <= 0) { shares[k] = 1; continue; }
    const take = Math.min(d, left);
    shares[k] = take / d;
    left -= take;
  }
  return shares;
}

/** Обережна політика за замовчуванням. */
export function defaultPolicy(decision, m) {
  switch (decision.id) {
    case 'site': return [...decision.options].sort((a, b) => a.site.risk - b.site.risk)[0].id;
    case 'storm': return 'sleep';
    case 'conjunction': return 'upload';
    case 'priority': return 'science';
    case 'units': return '4.45';
    case 'wheel': return 'backwards';
    case 'sample': return [...decision.options].filter((o) => o.site).sort((a, b) => a.site.risk - b.site.risk)[0].id;
    default: return decision.options[0].id;
  }
}

export function randomPolicy(decision, m) {
  return m.rng.pick(decision.options).id;
}
