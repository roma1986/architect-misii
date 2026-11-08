// Випадкові події з data/events.json. Нову подію додають у JSON;
// новий ТИП ефекту — окремим case у applyEffect.

import { isSurface, idealSciencePerStep } from './calc.js';

export function matches(ev, m) {
  const w = ev.when || {};
  const r = m.r;
  if (w.target && !w.target.includes(r.target.id)) return false;
  if (w.platform_type && !w.platform_type.includes(r.platform.type)) return false;
  if (w.power_type && !w.power_type.includes(r.power.type)) return false;
  if (w.antenna && !w.antenna.includes(m.s.antenna.id)) return false;
  if (w.surface !== undefined && w.surface !== isSurface(r)) return false;
  if (ev.once && m.s.happened.has(ev.id)) return false;
  return true;
}

/** Розіграти випадкові події фази. Повертає список подій, що сталися. */
export function rollEvents(m, phase) {
  const happened = [];
  for (const ev of m.data.events.random) {
    if (ev.phase !== phase || !matches(ev, m)) continue;
    if (m.rng() < ev.prob) {
      m.s.happened.add(ev.id);
      applyEffect(m, ev);
      happened.push(ev);
    }
  }
  return happened;
}

export function applyEffect(m, ev) {
  const s = m.s;
  m.log('event', { event: ev }, ev.effect === 'dust_clean' || ev.effect === 'science_bonus' ? 'good' : 'bad', ev);
  switch (ev.effect) {
    case 'antenna_fail':
      m.failAntenna('event');
      break;
    case 'power_mult':
      s.powerMult *= ev.value;
      break;
    case 'dust_clean':
      s.dust = 1;
      break;
    case 'mobility':
      s.mobility *= ev.value;
      break;
    case 'lose_step':
      s.skipStep = true;
      break;
    case 'science_bonus': {
      const alive = s.instruments.filter((i) => i.alive).map((i) => i.def);
      const bonus = ev.value * idealSciencePerStep(alive, m.r.goal, s.siteMult);
      s.science += bonus;
      s.bonusScience += bonus;
      break;
    }
    default:
      console.warn('Невідомий ефект події:', ev.effect);
  }
}
