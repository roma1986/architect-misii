// Формули гри (розділ 5 документа). Без DOM, тому працює і в браузері, і в Node.js.

export const G0 = 9.81;              // м/с²
export const ISP_S = 320;            // питомий імпульс двигунів апарата, с
export const DESIGN_MARGIN = 0.2;    // інженерний запас маси 20%
export const WARN_MARGIN = 0.15;     // запас менше 15% — жовта зона
export const RTG_DECAY = 0.96;       // РІТЕГ втрачає ~4% на рік
export const RATE_CAP_MBPS = 100;    // стеля швидкості зв’язку (близькі цілі)
export const MARGIN_PENALTY = 1.5;   // жовта зона збільшує шанс збою

export const byId = (list, id) => (list || []).find((x) => x.id === id) || null;
export const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

/** Перетворює вибір гравця (id) на повні об’єкти з даних. */
export function resolveBuild(data, build) {
  const c = data.components;
  return {
    target: byId(data.targets, build.target),
    cls: byId(data.mission.classes, build.cls),
    goal: byId(data.mission.goals, build.goal),
    rocket: byId(data.rockets, build.rocket),
    platform: byId(c.platforms, build.platform),
    instruments: (build.instruments || []).map((id) => byId(c.instruments, id)).filter(Boolean),
    power: byId(c.power, build.power),
    antenna: byId(c.antennas, build.antenna),
    extras: (build.extras || []).map((id) => byId(c.extras, id)).filter(Boolean),
    launch: build.launch || null,
    ...projectChoices(data, build),
  };
}

/**
 * Рішення рівня проєкту: клас ризику, резерв, випробування — для всіх;
 * траєкторія, двигун, орбіта, час антен — лише в «Режимі інженера» (інакше типові варіанти).
 */
function projectChoices(data, build) {
  const c = data.components;
  const m = data.mission;
  const eng = !!build.engineer;
  const target = byId(data.targets, build.target);
  const platform = byId(c.platforms, build.platform);
  const orbiter = !!platform && platform.type === 'orbiter';
  const pick = (list, id, fallback) => (eng && byId(list, id)) || byId(list, fallback) || (list || [])[0] || null;
  let propulsion = pick(c.propulsion, build.propulsion, 'chem');
  if (propulsion && propulsion.platform_types && !(platform && propulsion.platform_types.includes(platform.type))) propulsion = byId(c.propulsion, 'chem');
  return {
    engineer: eng,
    risk: byId(m.risk_classes, build.riskClass) || byId(m.risk_classes, 'C'),
    reservePct: build.reserve ?? 25,
    testing: byId(m.testing, build.testing) || byId(m.testing, 'std'),
    trajectory: target ? pick(target.trajectories, build.trajectory, 'direct') : null,
    propulsion,
    orbit: orbiter ? pick(c.orbits, build.orbit, 'standard') : byId(c.orbits, 'standard'),
    dsn: pick(c.dsn, build.dsn, 'std'),
    massGrowth: build.massGrowth || 0,
  };
}

// ---------- вікна запуску ----------
export const GAME_START = '2026-11';   // перший місяць, який можна обрати
export const LAUNCH_MONTHS = 48;       // скільки місяців уперед показуємо

const DAY = 86400000;
const monthDate = (ym) => new Date(`${ym}-15T00:00:00Z`);
export function addMonths(ym, n) {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 15));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}
export const launchMonths = () => Array.from({ length: LAUNCH_MONTHS }, (_, i) => addMonths(GAME_START, i));

/**
 * Наскільки вдалий місяць запуску. Біля оптимальної дати ракета везе всю масу,
 * далі від неї — потрібна більша швидкість, тож корисна маса падає, а політ довшає.
 */
export function windowInfo(target, ym) {
  if (!target?.window || !ym) return { factor: 1, offDays: 0, always: !target?.window };
  const w = target.window;
  const t = monthDate(ym).getTime();
  const ref = new Date(`${w.ref}T00:00:00Z`).getTime();
  const k = Math.round((t - ref) / DAY / w.synodic_days);
  const best = new Date(ref + k * w.synodic_days * DAY);
  const offDays = (t - best.getTime()) / DAY;
  const factor = 0.3 + 0.7 * Math.exp(-((offDays / w.sigma_days) ** 2));
  return { factor, offDays, best: best.toISOString().slice(0, 7) };
}

/** Найближчий до початку гри місяць з найкращим вікном. */
export function bestLaunch(target) {
  if (!target?.window) return GAME_START;
  const months = launchMonths();
  return months.find((m) => windowInfo(target, m).factor >= 0.9)
    || months.reduce((a, b) => (windowInfo(target, b).factor > windowInfo(target, a).factor ? b : a));
}

export function flightDays(r) {
  const f = windowInfo(r.target, r.launch).factor;
  const traj = r.trajectory?.time_mult ?? 1;
  const prop = r.propulsion?.time_mult ?? 1;
  return Math.round(r.target.flight_days * (1 + 0.4 * (1 - f)) * traj * prop);
}
export const launchYear = (r) => (r.launch ? Number(r.launch.slice(0, 4)) : 2026);

export const isSurface = (r) => !!r.platform && r.platform.type !== 'orbiter';
/** Скільки кроків триває наукова програма (на Венері посадковий апарат живе лише ~2 години). */
export const opsSteps = (r) => (isSurface(r) && r.target.surface_ops_steps ? r.target.surface_ops_steps : r.target.ops_steps);
export const hasExtra = (r, effect) => r.extras.some((e) => e.effect === effect);

/** Рівняння Ціолковського: яку частку від сухої маси становить паливо для Δv (км/с). */
export function fuelFraction(dvKms, isp = ISP_S) {
  return Math.exp((dvKms * 1000) / (isp * G0)) - 1;
}

/** Маса: сума компонентів → суха маса з запасом → паливо / система посадки → маса на старті. */
export function massBreakdown(r) {
  const parts = [r.platform, ...r.instruments, r.power, r.antenna, ...r.extras, r.propulsion].filter(Boolean);
  // Клас ризику: дубльовані системи важать більше
  const sum = parts.reduce((s, p) => s + (p.mass_kg || 0), 0) * (r.risk?.mass_mult ?? 1);
  const margin = sum * DESIGN_MARGIN;
  const growth = sum * (r.massGrowth || 0);   // зростання маси під час розробки понад запас
  const dry = sum + margin + growth;
  const isp = r.propulsion?.isp_s ?? ISP_S;
  const dvOrbit = r.orbit?.dv_extra_kms ?? 0;
  let fuel = 0;
  let edl = 0;
  const t = r.target;
  if (t && r.platform) {
    if (!isSurface(r)) {
      fuel = dry * fuelFraction(t.dv_capture_kms + dvOrbit, isp);
    } else if (t.landing.type === 'aeroshell') {
      edl = dry * t.landing.edl_factor; // теплозахист, парашут, гальмівна ступінь, перелітний модуль
    } else {
      fuel = dry * fuelFraction(t.dv_capture_kms + t.landing.dv_kms); // посадка на двигунах
    }
  }
  return { sum, margin, growth, dry, fuel, edl, launch: dry + fuel + edl };
}

/**
 * Скільки ракета доставить до цілі у найкраще вікно. Якщо є точне число виробника — беремо його,
 * інакше (маса на низьку навколоземну орбіту) × k цілі. Поза вікном — менше (множник windowInfo).
 */
export function capacityTo(rocket, target, launch = null, trajectory = null) {
  if (!rocket || !target) return 0;
  if (rocket.max_target && !rocket.max_target.includes(target.id)) return 0;
  const base = rocket.to_kg && rocket.to_kg[target.id] ? rocket.to_kg[target.id] : rocket.leo_kg * target.k_capacity;
  return Math.round(base * windowInfo(target, launch).factor * (trajectory?.k_mult ?? 1));
}

export function costBreakdown(r) {
  const items = [];
  const add = (label, cost) => { if (cost) items.push({ label, cost }); };
  const k = r.risk?.cost_mult ?? 1;   // клас ризику множить вартість «заліза»
  add('rocket', r.rocket?.cost_musd);
  add('platform', (r.platform?.cost_musd || 0) * k);
  add('instruments', r.instruments.reduce((s, i) => s + i.cost_musd, 0) * k);
  add('power', (r.power?.cost_musd || 0) * k);
  add('antenna', (r.antenna?.cost_musd || 0) * k);
  add('extras', r.extras.reduce((s, e) => s + e.cost_musd, 0) * k);
  add('propulsion', r.propulsion?.cost_musd);
  if (r.target && isSurface(r)) add('landing', r.target.landing.cost_musd);
  if (r.target && r.platform) add('operations', Math.max(0, r.platform.ops_musd_per_step + (r.dsn?.ops_musd_per_step || 0)) * opsSteps(r));
  if (r.target) add('cruise', r.target.cruise_ops_musd || 0);
  const pp = r.engineer && r.target?.planetary_protection;
  if (pp && r.platform) add('protection', isSurface(r) ? pp.surface_musd : pp.orbiter_musd);
  const total = items.reduce((s, i) => s + i.cost, 0);
  return { items, total, reserve: total * ((r.reservePct ?? 0) / 100) };
}

export function solarFactor(r) {
  return isSurface(r) ? r.target.surface_solar_factor : r.target.orbit_solar_factor * (r.orbit?.solar_mult ?? 1);
}

/** Широта майданчика: далі від екватора Сонце нижче. Майданчик може задати власний множник. */
export function siteSolarMult(site) {
  if (!site) return 1;
  if (site.solar_mult !== undefined) return site.solar_mult;
  return Math.max(0.3, Math.cos((site.lat || 0) * Math.PI / 180));
}
/** Холодніші (високоширотні) майданчики потребують більше енергії на обігрів. */
export function siteHeaterMult(site) {
  if (!site) return 1;
  return 1 + 0.3 * (1 - Math.cos((site.lat || 0) * Math.PI / 180));
}

/** Середня потужність біля цілі, Вт. Сонце слабшає як 1/r², РІТЕГ — на 4% на рік. */
export function powerProduced(r, { years = 0, dust = 1, solarMult = 1 } = {}) {
  if (!r.power || !r.target) return 0;
  if (r.power.type === 'solar') {
    return (r.power.p1au_w / (r.target.sun_au ** 2)) * solarFactor(r) * dust * solarMult;
  }
  return r.power.p0_w * RTG_DECAY ** years;
}

/** Частка земного сонячного світла біля цілі (для пояснень). */
export const sunShare = (target) => 1 / (target.sun_au ** 2);

export function busPower(r) { return r.platform ? r.platform.bus_power_w : 0; }
export function instrumentPower(instruments) {
  return instruments.reduce((s, i) => s + i.power_w * i.duty, 0);
}
export function powerDemand(r) { return busPower(r) + instrumentPower(r.instruments); }

/** Відстань Земля–ціль, а.о., через dayFromArrival діб після прибуття. Колові орбіти. */
export function earthDistanceAu(target, dayFromArrival = 0) {
  if (!target.orbit_au) return target.earth_dist_au;
  const theta = phaseDeg(target, dayFromArrival) * Math.PI / 180;
  const a = target.orbit_au;
  return Math.sqrt(1 + a * a - 2 * a * Math.cos(theta));
}

/** Кут між Землею і ціллю, якщо дивитися від Сонця. 180° — сонячне з’єднання. */
export function phaseDeg(target, dayFromArrival) {
  const rel = 360 / 365.25 - 360 / target.period_days;
  return target.theta0_deg + rel * dayFromArrival;
}

/** Чи проходить ціль за Сонцем у проміжку днів [d0, d1). */
export function conjunctionBetween(target, d0, d1) {
  if (!target.orbit_au) return false;
  const a = Math.floor((phaseDeg(target, d0) - 180) / 360);
  const b = Math.floor((phaseDeg(target, d1) - 180) / 360);
  return a !== b;
}

/** Скільки Мбіт на добу можна передати на Землю. */
export function downlinkPerDay(antenna, target, distAu, dsn = null) {
  if (!antenna || !target) return 0;
  if (antenna.relay) return target.has_relay ? antenna.relay_mbit_per_day : 0;
  const rate = Math.min(antenna.rate_1au_mbps / (distAu ** 2), RATE_CAP_MBPS);
  return rate * antenna.contact_h * (dsn?.hours_mult ?? 1) * 3600;
}

export function dataPerDay(instruments) {
  return instruments.reduce((s, i) => s + i.data_mbit_per_day, 0);
}

/** Надійність ракети за правилом Лапласа: (успіхи + 1) / (польоти + 2). */
export function rocketReliability(rocket) {
  return (rocket.successes + 1) / (rocket.flights + 2);
}

/** Шанс відмови за один крок, якщо надійність задано на всю місію. */
export function stepFailProb(reliability, steps, penalty = 1) {
  return clamp((1 - reliability ** (1 / steps)) * penalty, 0, 1);
}

export function weight(instr, goal) {
  if (!goal) return 1;
  const w = instr.weights?.[goal.id];
  return w === undefined ? 1 : w;
}

export function idealSciencePerStep(instruments, goal, siteMult = 1) {
  return instruments.reduce((s, i) => s + i.science_base * weight(i, goal), 0) * siteMult;
}

/** Чи можна поставити компонент на цю платформу і для цієї цілі. */
export function fits(item, r) {
  if (item.platforms && r.platform && !item.platforms.includes(r.platform.type)) return false;
  if (item.only_platforms && r.platform && !item.only_platforms.includes(r.platform.id)) return false;
  if (item.only_targets && r.target && !item.only_targets.includes(r.target.id)) return false;
  return true;
}

/** Чи підходить платформа для цілі (на астероїд не сядеш, пробовідбірник — лише для астероїда). */
export function platformFits(platform, target) {
  if (!platform || !target) return true;
  if (platform.only_targets && !platform.only_targets.includes(target.id)) return false;
  if (target.allowed_platform_types && !target.allowed_platform_types.includes(platform.type)) return false;
  return true;
}

function barStatus(used, limit, warnOnly = false) {
  if (limit <= 0) return used > 0 ? (warnOnly ? 'warn' : 'fail') : 'ok';
  const ratio = used / limit;
  if (ratio > 1) return warnOnly ? 'warn' : 'fail';
  if (ratio > 1 - WARN_MARGIN) return 'warn';
  return 'ok';
}

/**
 * Перевірка конструкції: чотири шкали + список проблем.
 * Кожна проблема має code, щоб інтерфейс показав зрозумілу підказку.
 */
export function checkBuild(r) {
  const issues = [];
  const need = (cond, code, params = {}) => { if (!cond) issues.push({ code, ...params }); };

  need(r.target, 'no_target');
  need(r.cls, 'no_class');
  need(r.goal, 'no_goal');
  need(r.rocket, 'no_rocket');
  need(r.platform, 'no_platform');
  need(r.power, 'no_power');
  need(r.antenna, 'no_antenna');
  need(r.instruments.length > 0, 'no_instruments');

  if (r.platform && r.target) need(platformFits(r.platform, r.target), 'platform_target');
  if (r.platform) {
    need(r.instruments.length <= r.platform.slots, 'too_many_instruments', { slots: r.platform.slots });
    r.instruments.filter((i) => !fits(i, r)).forEach((i) => issues.push({ code: 'instrument_misfit', item: i }));
    if (r.antenna) need(fits(r.antenna, r), 'antenna_misfit', { item: r.antenna });
  }
  if (r.antenna?.relay && r.target) need(r.target.has_relay, 'no_relay');
  if (r.rocket && r.target && r.rocket.max_target) need(r.rocket.max_target.includes(r.target.id), 'rocket_target');

  const mass = massBreakdown(r);
  const capacity = capacityTo(r.rocket, r.target, r.launch, r.trajectory);
  const win = windowInfo(r.target, r.launch);
  const cost = costBreakdown(r);
  const budget = r.cls ? r.cls.budget_musd : 0;
  const produced = powerProduced(r);
  const demand = powerDemand(r);
  const dist = r.target ? earthDistanceAu(r.target, 0) : 1;
  const downlink = downlinkPerDay(r.antenna, r.target, dist, r.dsn);
  const collected = dataPerDay(r.instruments);

  const bars = {
    budget: { used: cost.total + cost.reserve, limit: budget, unit: 'млн $', status: barStatus(cost.total + cost.reserve, budget) },
    mass: { used: mass.launch, limit: capacity, unit: 'кг', status: barStatus(mass.launch, capacity) },
    power: { used: demand, limit: produced, unit: 'Вт', status: barStatus(demand, produced) },
    data: { used: collected, limit: downlink, unit: 'Мбіт/добу', status: barStatus(collected, downlink, true) },
  };

  // Нижче — помилки, через які запуск неможливий. Шкала «дані» лише попереджає.
  if (r.cls && cost.total + cost.reserve > budget) issues.push({ code: 'over_budget' });
  if (r.propulsion?.min_p1au_w && !(r.power?.type === 'solar' && r.power.p1au_w >= r.propulsion.min_p1au_w)) issues.push({ code: 'ion_power' });
  if (r.rocket && r.target && r.platform && mass.launch > capacity) issues.push({ code: 'over_mass' });
  if (r.power && r.platform && demand > produced) issues.push({ code: 'over_power' });

  const warnings = [];
  if (win.factor < 0.9) warnings.push({ code: 'off_window', factor: win.factor, best: win.best });
  if (r.target?.surface_night_kills_solar && isSurface(r) && r.power?.type === 'solar') warnings.push({ code: 'lunar_night' });
  if (r.antenna && r.instruments.length && collected > downlink) warnings.push({ code: 'data_bottleneck' });
  if (bars.mass.status === 'warn' || bars.power.status === 'warn') warnings.push({ code: 'thin_margin' });
  if (r.target?.radiation_mult && !hasExtra(r, 'radiation_vault')) warnings.push({ code: 'radiation' });
  if (r.target?.optical_mult && r.instruments.some((i) => i.optical)) warnings.push({ code: 'clouds' });
  if (r.target?.surface_ops_steps && isSurface(r)) warnings.push({ code: 'short_life' });

  return {
    ok: issues.length === 0,
    issues, warnings, bars, mass, capacity, cost, produced, demand, downlink, collected, dist, win,
  };
}
