// Пояснення результату: оцінка, причини людською мовою, тексти журналу і рішень.
// Тексти зараз українською; для англійської версії додайте переклади в цьому файлі.

import { clamp, sunShare, isSurface, instrumentPower, busPower, opsSteps, siteSolarMult } from './calc.js';
import { tr, dayWord, plural } from './i18n.js';

const pct = (x) => Math.round(x * 100);
const fmt = (x, d = 0) => Number(x).toLocaleString('uk-UA', { maximumFractionDigits: d, minimumFractionDigits: d });

// ---------- оцінка ----------
export function score(m) {
  const s = m.s;
  const r = m.r;
  const target = r.cls.science_target;
  const cost = m.spent ?? m.check.cost.total;
  const science = clamp((s.science / target) * 100, 0, 150);
  const efficiency = clamp(((s.science / cost) / (target / r.cls.budget_musd)) * 100, 0, 150);
  const done = m.timeline.length / opsSteps(r);
  const alive = s.instruments.filter((i) => i.alive).length / Math.max(1, s.instruments.length);
  const reliability = clamp((s.alive ? alive : 0) * 50 + Math.min(1, done) * 50, 0, 100);
  const total = Math.round(0.6 * science / 1.5 + 0.2 * efficiency / 1.5 + 0.2 * reliability);

  let outcome = 'weak';
  if (s.lost && s.science < 1) outcome = 'lost';
  else if (science >= 100) outcome = 'success';
  else if (science >= 60) outcome = 'partial';

  let title;
  if (outcome === 'lost') title = 'lost';
  else if (outcome === 'success' && s.site && s.site.risk >= 0.15) title = 'bold';
  else if (outcome === 'success') title = efficiency >= science ? 'thrifty' : 'breakthrough';
  else if (efficiency >= 100) title = 'thrifty';
  else if (reliability >= 90 && outcome === 'partial') title = 'reliable';
  else title = 'learning';

  return { science: Math.round(science), efficiency: Math.round(efficiency), reliability: Math.round(reliability), total, outcome, title };
}

export const OUTCOMES = {
  success: 'Базову місію виконано',
  partial: 'Виконано порогову місію, але не базову',
  weak: 'Не виконано навіть порогову місію',
  lost: 'Місію втрачено',
};
export const TITLES = {
  breakthrough: { name: 'Науковий прорив', text: 'Ви зібрали більше науки, ніж очікували від місії цього класу.' },
  thrifty: { name: 'Ощадливий інженер', text: 'Багато науки на кожен вкладений мільйон.' },
  bold: { name: 'Сміливець', text: 'Ризикований майданчик окупився.' },
  reliable: { name: 'Надійний конструктор', text: 'Апарат пережив усе, але науки могло бути більше.' },
  learning: { name: 'Цінний урок', text: 'Причини нижче підкажуть, що змінити.' },
  lost: { name: 'Втрачена місія', text: 'Так буває і в NASA. Прочитайте, що пішло не так, і спробуйте ще раз.' },
};

// ---------- причини ----------
function stats(m) {
  const tl = m.timeline.filter((x) => x.produced > 0);
  const avgU = tl.length ? tl.reduce((a, x) => a + x.u, 0) / tl.length : 0;
  const collected = m.timeline.reduce((a, x) => a + (x.collected || 0), 0);
  const sent = m.timeline.reduce((a, x) => a + (x.sent || 0), 0);
  const maxDist = Math.max(...m.timeline.map((x) => x.dist), 0);
  const minDust = Math.min(...m.timeline.map((x) => x.dust ?? 1), 1);
  const avgProduced = tl.length ? tl.reduce((a, x) => a + x.produced, 0) / tl.length : 0;
  return { avgU, collected, sent, maxDist, minDust, avgProduced };
}

const LOST_TEXT = {
  launch: (m) => `Ракета ${tr(m.r.rocket.name)} зазнала аварії на старті. Її надійність за історією польотів — ${pct((m.r.rocket.successes + 1) / (m.r.rocket.flights + 2))}%: навіть такий шанс іноді не спрацьовує.`,
  cancelled: (m) => `Проєкт закрили до старту: витрати сягнули ${fmt(m.spent)} млн $ при бюджеті ${fmt(m.r.cls.budget_musd)} млн $, а додаткових грошей не дали. Більший резерв або простіший апарат дали б шанс.`,
  capture: (m) => (m.s.navError
    ? 'Помилка в одиницях під час поправки курсу: апарат підійшов до цілі не тим курсом і не вийшов на орбіту. Саме так у 1999 році загинув Mars Climate Orbiter.'
    : 'Апарат не вийшов на орбіту цілі. Гальмування біля планети — один із найризикованіших моментів місії.'),
  landing: (m) => `Посадка в районі «${tr(m.s.site.name)}» закінчилася аварією. Ризик цього майданчика — ${pct(m.s.site.risk * m.penalty)}%.`,
  storm: () => 'Під час пилової бурі апарат працював далі, акумулятор розрядився, і апарат замерз.',
  night: () => 'Апарат не пережив місячну ніч: сонячні панелі 14 діб не дають енергії, а температура падає нижче −170 °C.',
  power: () => 'Енергії не вистачало навіть на обігрів і комп’ютер, і апарат вимкнувся назавжди.',
  platform: () => 'Відмовила сама платформа апарата (комп’ютер, двигун або паливна система).',
  comms: () => 'Зв’язок втрачено остаточно: резервної антени не було.',
  touch: () => 'Під час торкання астероїда зонд зачепив брилу і пошкодився. Біля тіла з майже нульовою гравітацією кожен дотик — ризик.',
};

export function reasons(m) {
  const s = m.s;
  const r = m.r;
  const st = stats(m);
  const ideal = Math.max(1, s.ideal);
  const list = [];

  const texts = {
    failure: () => {
      const dead = s.instruments.filter((i) => !i.alive).map((i) => tr(i.def.name));
      return `Відмовили прилади: ${dead.join(', ')}. Кожен прилад має реальну надійність; резерву або запасу не було.`;
    },
    power: () => {
      if (r.power.type === 'solar') {
        const sun = pct(sunShare(r.target));
        let t = `Енергії вистачало лише на ${pct(st.avgU)}% роботи приладів. Біля цілі «${tr(r.target.name)}» Сонце дає ${sun}% земного світла`;
        if (isSurface(r) && r.target.dust_per_step > 0) t += `, а пил на панелях знизив вироблення до ${pct(st.minDust)}%`;
        if (isSurface(r) && s.site && s.siteSolar < 0.95) t += `. Майданчик на широті ${fmt(Math.abs(s.site.lat))}° отримує лише ${pct(s.siteSolar)}% сонця порівняно з екватором`;
        return t + '.';
      }
      return `РІТЕГ давав у середньому ${fmt(st.avgProduced)} Вт, а платформі й приладам потрібно ${fmt(busPower(r) + instrumentPower(r.instruments))} Вт. Прилади працювали ${pct(st.avgU)}% часу.`;
    },
    storm: () => 'Пилова буря закривала Сонце і камери: панелі давали 40% потужності, а знімки виходили мутними.',
    sleep: () => `Апарат перечікував бурю в сплячому режимі (${s.lossCount.sleep} крок.): безпечно, але без науки.`,
    downlink: () => {
      if (s.antenna.relay) return `Ретранслятор передає ~${fmt(s.antenna.relay_mbit_per_day)} Мбіт на добу, а прилади збирали більше. Передано лише ${pct(st.sent / Math.max(1, st.collected))}% даних.`;
      return `Антена «${tr(s.antenna.name)}» передала лише ${pct(st.sent / Math.max(1, st.collected))}% зібраних даних. Найбільша відстань до Землі — ${fmt(st.maxDist, 2)} а.о., і там сигнал слабший у ${fmt(st.maxDist ** 2, 1)} раза, ніж на відстані 1 а.о.`;
    },
    conjunction: () => s.conjunctionPlan === 'idle'
      ? 'Під час сонячного з’єднання апарат простоював без команд.'
      : 'Сонячне з’єднання на ~2 тижні перервало зв’язок. План, завантажений заздалегідь, зменшив втрати.',
    clouds: () => 'Хмари Венери непрозорі для світла: оптичні прилади бачили лише верхівки хмар. Радар бачить крізь хмари, тому Magellan склав карту саме ним.',
    mobility: () => 'Заклинило колесо: ровер їздив повільніше і досліджував менше місць.',
    night: () => 'Місячні ночі: половину часу сонячні панелі не працювали. РІТЕГ або ізотопні обігрівачі розв’язують цю проблему.',
    skipped: () => 'Прилад тимчасово не дав науки: пробірка виявилася порожньою, і спробу довелося повторювати.',
    reset: () => 'Збій комп’ютера забрав цілий крок роботи.',
  };

  for (const [key, val] of Object.entries(s.losses)) {
    if (val / ideal < 0.03) continue;
    const lostKey = key.startsWith('lost_') ? key.slice(5) : null;
    const text = lostKey ? LOST_TEXT[lostKey]?.(m) : texts[key]?.();
    if (text) list.push({ key, share: val / ideal, text, tone: 'bad' });
  }
  list.sort((a, b) => b.share - a.share);

  const extra = [];
  const dev = m.dev;
  if (dev) {
    if (dev.descoped.length) extra.push({ key: 'descoped', text: `Під час розробки довелося зняти: ${dev.descoped.map((i) => tr(i.name)).join(', ')}. Це мінус наука, яку ці прилади могли дати.`, tone: 'bad' });
    if (dev.flags.waited) extra.push({ key: 'waited', text: `Розробка затрималась, і старт перенесли на наступне вікно (${dev.build.launch}). Очікування з’їло частину резерву.`, tone: 'bad' });
    if (dev.flags.rush) extra.push({ key: 'rush', text: 'Щоб встигнути у вікно, скоротили випробування: відмови в польоті траплялися на 30% частіше.', tone: 'bad' });
    if (dev.flags.hiddenDefect) extra.push({ key: 'defect', text: 'Через мінімальні випробування один дефект не знайшли на Землі, і він полетів разом з апаратом.', tone: 'bad' });
    if (dev.overrun > 0 && !dev.cancelled) extra.push({ key: 'overrun', text: `Резерву не вистачило: перевитрата ${fmt(dev.overrun)} млн $ знизила оцінку ефективності.`, tone: 'bad' });
    if (m.r.risk.id === 'A' || m.r.risk.id === 'B') extra.push({ key: 'class', text: `${tr(m.r.risk.name)}: дубльовані системи зменшили шанс відмов до ${pct(m.r.risk.fail_mult)}% від звичайного.`, tone: 'good' });
    if (m.r.risk.id === 'D') extra.push({ key: 'class', text: 'Клас D: дешево, але без резерву відмови траплялися в 1,6 раза частіше.', tone: 'bad' });
  }
  if (m.penalty > 1) extra.push({ key: 'margin', text: 'Запас маси або енергії був менший за 15%, тому збої траплялися в 1,5 раза частіше. Реальні інженери закладають 15–30% запасу.', tone: 'bad' });
  if (s.bonusScience > 0) extra.push({ key: 'bonus', text: `Несподівана знахідка додала ${fmt(s.bonusScience)} балів науки.`, tone: 'good' });
  if (s.sampleScience) extra.push({ key: 'sample', text: `Зразок з району «${tr(s.sampleSite.name)}» дав ${fmt(s.sampleScience)} балів науки: лабораторії на Землі точніші за будь-який прилад у космосі.`, tone: 'good' });
  if (r.target.radiation_mult) extra.push(m.radPenalty > 1.5
    ? { key: 'rad', text: `Без радіаційного сейфа електроніка біля Юпітера ламалася в ${fmt(r.target.radiation_mult)} рази частіше.`, tone: 'bad' }
    : { key: 'rad', text: 'Радіаційний сейф захистив електроніку від радіації Юпітера.', tone: 'good' });
  if (r.target.surface_ops_steps && isSurface(r) && s.alive) extra.push({ key: 'heat', text: 'Посадковий апарат пропрацював ~2 години: довше на поверхні Венери не вижив жоден апарат.', tone: 'good' });
  if (s.backupUsed) extra.push({ key: 'backup', text: 'Резервна антена врятувала зв’язок.', tone: 'good' });
  if (s.extended) extra.push({ key: 'extended', text: 'Місію продовжили, бо апарат був у доброму стані.', tone: 'good' });
  if (r.power.type === 'rtg' && isSurface(r) && s.stormsSeen > 0) extra.push({ key: 'rtg', text: 'РІТЕГ не залежить від Сонця і пилу, тому буря не зупинила роботу.', tone: 'good' });
  return { main: list.slice(0, 3), extra, stats: st };
}

// ---------- порівняння і фото ----------
export function comparison(m) {
  const all = m.data.missions.filter((x) => x.target === m.r.target.id);
  const same = all.filter((x) => x.platform_type === m.r.platform.type);
  return same[0] || all[0] || null;
}

export function mediaFor(m) {
  return m.data.media.items.find((x) => x.target === m.r.target.id && x.platform_type === m.r.platform.type) || null;
}

// ---------- журнал ----------
const CAUSE_SHORT = { cancelled: 'проєкт скасовано через перевитрати', touch: 'зонд пошкоджено під час торкання', launch: 'аварія ракети', capture: 'не вдалося вийти на орбіту', landing: 'аварійна посадка', storm: 'буря розрядила акумулятор', night: 'апарат замерз уночі', power: 'забракло енергії', platform: 'відмова платформи', comms: 'зв’язок втрачено' };

export function logText(e, m) {
  const p = e.params;
  switch (e.code) {
    case 'launch': return `Старт на ${tr(p.rocket.name)}. Надійність за історією польотів: ${pct(p.p)}%.`;
    case 'launch_ok': return 'Ракета вивела апарат на траєкторію до цілі.';
    case 'cruise': return `Переліт триває ${fmt(p.days)} ${dayWord(p.days)}.`;
    case 'orbit_ok': return 'Гальмування успішне: апарат на орбіті.';
    case 'landing': return `Посадка в районі «${tr(p.site.name)}». Ризик: ${pct(p.p)}%.`;
    case 'landing_ok': return 'Посадка успішна! Перший сигнал з поверхні.';
    case 'storm_start': return 'Почалася пилова буря.';
    case 'storm_end': return 'Буря вщухла.';
    case 'choice': return `Рішення: ${optionLabel(p.decision, p.option, m)}.`;
    case 'event': return tr(p.event.title) + '.';
    case 'lost': return `Місію втрачено: ${CAUSE_SHORT[p.cause] || p.cause}.`;
    case 'instrument_fail': return `Відмовив прилад: ${tr(p.instr.name)}.`;
    case 'backup_antenna': return 'Головна антена відмовила, працює резервна.';
    case 'antenna_fallback': return 'Головна антена відмовила. Зв’язок лише через малу антену — дуже повільно.';
    case 'safe_mode': return `Безпечний режим: вироблено ${fmt(p.produced)} Вт, а платформі потрібно ${fmt(p.bus)} Вт.`;
    case 'night': return 'Місячна ніч: апарат вимкнено до світанку.';
    case 'night_survived': return 'Апарат пережив ніч.';
    case 'sleep': return 'Сплячий режим: чекаємо кінця бурі.';
    case 'reset': return 'Комп’ютер перезавантажувався весь крок.';
    case 'extended': return `NASA продовжило місію ще на ${p.steps} ${plural(p.steps, ['крок', 'кроки', 'кроків'])}!`;
    case 'complete': return 'Основну програму місії завершено.';
    case 'units_ok': return 'Одиниці перевірено й перераховано. Курс точний.';
    case 'units_bad': return 'Поправку застосовано з помилкою в одиницях. Апарат іде не тим курсом!';
    case 'tipped': return `Недоступні прилади: ${p.names.map((x) => tr(x.name)).join(', ')}.`;
    case 'wheel_backwards': return 'Ровер їздить задом наперед: повільніше, зате безпечно.';
    case 'wheel_lucky': return 'Пощастило: новий маршрут виявився безпечним.';
    case 'wheel_stuck': return 'Ровер застряг на складному маршруті і майже не рухається.';
    case 'heat_end': return 'Спека і тиск перемогли: апарат замовк. Але всі дані вже на Землі.';
    case 'touch': return `Зонд торкається поверхні в районі «${tr(p.site.name)}». Ризик: ${pct(p.p)}%.`;
    case 'touch_ok': return `Зразок узято! Капсула з ним полетить на Землю (+${fmt(p.bonus)} науки).`;
    case 'touch_fail': return 'Невдале торкання: маніпулятор пошкоджено, зразка немає.';
    case 'sample_skip': return 'Вирішили не ризикувати і не брати зразок.';
    case 'step': return `Науки +${fmt(p.sci, 1)}. Прилади працювали ${pct(p.u)}% часу, передано ${pct(Math.min(1, p.sent))}% даних.`;
    case 'fact': {
      const f = m.data.events.facts[p.id];
      return f ? tr(f) : '';
    }
    default: return e.code;
  }
}

export function factSource(e, m) {
  if (e.code === 'fact') return m.data.events.facts[e.params.id]?.source;
  if (e.code === 'event') return e.params.event.source;
  return null;
}
export function eventFact(e) {
  return e.code === 'event' && e.params.event.fact ? tr(e.params.event.fact) : null;
}

// ---------- рішення ----------
export function decisionText(d, m) {
  const t = m.r.target;
  switch (d.id) {
    case 'site': return {
      title: 'Оберіть місце посадки',
      text: 'Цікавіші місця небезпечніші: каміння, схили, кратери. Ризик посадки множиться на штраф за малий запас маси.',
    };
    case 'storm': return {
      title: 'Пилова буря!',
      text: 'Пил закрив Сонце: панелі дають лише 40% потужності, і так буде ще два кроки.',
    };
    case 'conjunction': return {
      title: `Сонце між Землею і ціллю «${tr(t.name)}»`,
      text: 'Найближчі ~2 тижні сигнал не пройде крізь сонячну корону. Нові команди надіслати не вийде.',
    };
    case 'priority': return {
      title: 'Канал зв’язку перевантажений',
      text: `Антена встигає передати лише ~${pct(d.params.share)}% даних, які збирають прилади. Решту буде перезаписано в пам’яті. Що передавати першим?`,
    };
    case 'units': return {
      title: 'Перевірте поправку курсу',
      text: 'Програма виробника видала імпульс двигунів: 1 фунт-сила-секунда. Навігація апарата приймає лише ньютон-секунди. Скільки ньютон-секунд вводимо?',
    };
    case 'wheel': return {
      title: 'Заклинило колесо',
      text: 'Одне з шести коліс більше не обертається. Попереду цікаві породи, але шлях кам’янистий.',
    };
    case 'sample': return {
      title: 'Час брати зразок',
      text: 'Зонд торкнеться поверхні на кілька секунд і вдихне пил струменем азоту. Цікавіші місця ризикованіші: навколо брили розміром з будинок.',
    };
    default: return { title: d.id, text: '' };
  }
}

export function optionInfo(decisionId, option, m) {
  const battery = m.r.extras.some((e) => e.effect === 'big_battery');
  const id = typeof option === 'string' ? option : option.id;
  switch (decisionId) {
    case 'site': {
      const site = m.r.target.sites.find((x) => x.id === id);
      const solar = m.r.power.type === 'solar' ? ` Сонце ${pct(siteSolarMult(site))}% від екваторіального.` : '';
      return { label: tr(site.name), hint: `Ризик ${pct(site.risk * m.penalty * (0.7 + 0.3 * m.relMult))}%, наука ×${fmt(site.science_mult, 1)}.${solar} ${tr(site.note)}` };
    }
    case 'storm': return id === 'sleep'
      ? { label: 'Сплячий режим', hint: 'Безпечно, але без науки, поки триває буря.' }
      : { label: 'Працювати далі', hint: `Наука є, але ${battery ? '5' : '20'}% шанс за крок розрядити акумулятор і втратити апарат.` };
    case 'conjunction': return id === 'upload'
      ? { label: 'Завантажити план заздалегідь', hint: 'Апарат працює сам; втрачається лише половина передачі даних.' }
      : { label: 'Чекати', hint: 'Простіше, але апарат простоює половину кроку.' };
    case 'units': return {
      '4.45': { label: '4,45 Н·с', hint: '1 фунт-сила ≈ 4,45 ньютона.' },
      '0.45': { label: '0,45 Н·с', hint: 'Фунт маси ≈ 0,45 кілограма.' },
      1: { label: '1 Н·с', hint: 'Залишити число як є.' },
    }[id];
    case 'wheel': return id === 'backwards'
      ? { label: 'Їхати задом наперед', hint: 'Як Spirit: повільніше, але безпечно. Рухливість −30%.' }
      : { label: 'Ризикнути маршрутом', hint: '50 на 50: або майже без втрат, або ровер застрягне.' };
    case 'sample': {
      if (id === 'skip') return { label: 'Не брати зразок', hint: 'Безпечно, але головна наука місії залишиться на астероїді.' };
      const site = m.r.target.sites.find((x) => x.id === id);
      return { label: tr(site.name), hint: `Ризик ${pct(site.risk * m.penalty)}%, цінність зразка ×${fmt(site.science_mult, 1)}. ${tr(site.note)}` };
    }
    case 'priority': return id === 'science'
      ? { label: 'Спершу найцінніше', hint: 'Дані з найбільшою наукою на мегабіт ідуть першими. Великі знімки можуть не потрапити на Землю.' }
      : { label: 'Порівну', hint: 'Кожен прилад передає однакову частку своїх даних.' };
    default: return { label: id, hint: '' };
  }
}

export function optionLabel(decisionId, optionId, m) {
  return optionInfo(decisionId, optionId, m).label;
}
