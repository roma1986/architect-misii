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
  if (w.instrument && !m.s.instruments.some((i) => i.alive && w.instrument.includes(i.def.id))) return false;
  if (ev.once && m.s.happened.has(ev.id)) return false;
  if (ev.decision && m.pending) return false;
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
  const good = ['dust_clean', 'science_bonus', 'extra_steps'].includes(ev.effect);
  m.log('event', { event: ev }, good ? 'good' : ev.decision ? 'decision' : 'bad', ev);
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
    case 'skip_instrument':
      s.skipNext = ev.value;
      break;
    case 'extra_steps':
      s.steps += ev.value;
      break;
    case 'tipped': {
      const alive = s.instruments.filter((i) => i.alive);
      const n = Math.max(1, Math.floor(alive.length / 3));
      const off = [...alive].sort(() => m.rng() - 0.5).slice(0, n);
      off.forEach((i) => { i.alive = false; });
      m.log('tipped', { names: off.map((i) => i.def) }, 'bad');
      break;
    }
    case 'units_check':
      m.ask({
        id: 'units',
        options: [{ id: '4.45' }, { id: '0.45' }, { id: '1' }],
        apply: (id) => {
          if (id === '4.45') m.log('units_ok', {}, 'good');
          else { s.navError = true; m.log('units_bad', {}, 'bad'); }
        },
      });
      break;
    case 'wheel_decision':
      m.ask({
        id: 'wheel',
        options: [{ id: 'backwards' }, { id: 'risk' }],
        apply: (id) => {
          if (id === 'backwards') { s.mobility *= 0.7; m.log('wheel_backwards', {}, 'info'); return; }
          if (m.rng() < 0.5) { s.mobility *= 0.95; m.log('wheel_lucky', {}, 'good'); } else { s.mobility *= 0.3; m.log('wheel_stuck', {}, 'bad'); }
        },
      });
      break;
    default:
      console.warn('Невідомий ефект події:', ev.effect);
  }
}
