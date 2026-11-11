// Сценарій демо-показу: дві конструкції, код місії і рішення, які гра обирає сама.
// Без DOM: цей файл використовують і показ у грі (js/ui/demo.js), і перевірка tools/demo-check.mjs.
import { defaultPolicy } from './sim.js';
import { defaultDevPolicy } from './dev.js';

/** Код місії: з ним події повторюються однаково. Якщо перевірка не проходить, знайдіть новий: node tools/demo-check.mjs --find */
export const DEMO_SEED = 'DBCA';

const BASE = {
  target: 'mars', cls: 'flagship', goal: 'life', launch: '2026-11', rocket: 'atlas_v_541', platform: 'rover_large',
  extras: [], engineer: false, trajectory: 'direct', propulsion: 'chem', orbit: 'standard', dsn: 'std',
};

export const DEMO_BUILDS = {
  // Акт 1. «Жадібна» місія: максимум приладів, сонячні панелі, мала антена, малий резерв, мінімум тестів
  demo1: {
    ...BASE, instruments: ['panorama_cam', 'laser_spectrometer', 'drill', 'gpr', 'weather', 'mass_spectrometer'],
    power: 'solar_l', antenna: 'hga_small', riskClass: 'C', reserve: 15, testing: 'min',
  },
  // Акт 2. Виправлена: клас B, резерв 25%, два РІТЕГи, акумулятор, ретрансляція, на один прилад менше
  demo2: {
    ...BASE, instruments: ['panorama_cam', 'laser_spectrometer', 'drill', 'gpr', 'mass_spectrometer'],
    power: 'rtg_2', antenna: 'relay_uhf', extras: ['big_battery'], riskClass: 'B', reserve: 25, testing: 'std',
  },
};

/** Що має вийти. Ці числа згадуються в DEMO.md, тому перевірка стежить і за ними. */
export const DEMO_EXPECT = {
  demo1: { total: 36, lost: 'storm', decisions: ['site', 'priority', 'storm'] },
  demo2: { total: 100, outcome: 'success' },
};

/** Рішення в польоті: акт 1 ризикує в бурі, акт 2 діє обережно. Майданчик в обох — кратер Ґейл. */
export function demoFlightPolicy(act) {
  return (decision, mission) => {
    if (decision.id === 'site' && decision.options.some((o) => o.id === 'gale')) return 'gale';
    if (decision.id === 'storm') return act === 'demo1' ? 'continue' : 'sleep';
    return defaultPolicy(decision, mission);
  };
}

export const demoDevPolicy = defaultDevPolicy;
