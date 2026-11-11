// «Про дані»: кожен компонент, його прототип, спрощення і джерело.
import { t, esc, fmt } from './dom.js';
import { rocketReliability } from '../calc.js';
import { balanceSvg } from './balance.js';
import { dayWord } from '../i18n.js';

const link = (url) => (url ? `<a href="${esc(url)}" target="_blank" rel="noopener">джерело</a>` : '');

export function renderAbout(root, app) {
  const d = app.data;
  const C = d.components;
  const table = (head, rows) => `<div class="table-wrap"><table><thead><tr>${head.map((h) => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table></div>`;

  root.innerHTML = `
    <p>Кожне число в грі має реальний прототип. Ми округлюємо числа, але зберігаємо співвідношення:
    скільки маси ракета везе до цілі, як слабшає Сонце з відстанню, як падає швидкість зв’язку.
    Значення приладів — ігрові, близькі до порядку величини прототипів.</p>

    ${d.balance?.n ? `<h3>Перевірка балансу</h3>
    <p>Ми згенерували ${fmt(d.balance.n)} випадкових конструкцій, які проходять усі ліміти, і зіграли їх тією самою симуляцією, що й у грі.
    Частка успіху: ${d.balance.classes.map((c) => `${t(d.mission.classes.find((x) => x.id === c.id)?.name || c.id)} — ${Math.round(c.success * 100)}%`).join(', ')}.
    Найкращі збірки летять до різних цілей і з різними приладами: ідеальної конструкції немає.</p>
    <div class="balance-chart">${balanceSvg(d.balance, { ink: 'var(--ink)', muted: 'var(--muted)', bar: 'var(--mass)', bad: 'var(--bad)' })}</div>` : ''}

    <h3>Звідки числа</h3>
    <p>У грі три види чисел, і ми їх не змішуємо:</p>
    <ul>
      <li><b>Перевірені з джерелом</b> (${[...d.targets, ...d.rockets, ...Object.values(C).flat(), ...d.missions].filter((x) => x.verified).length} об’єктів): відстані й періоди планет (NASA NSSDC), вантажопідйомність і розміри ракет (SpaceX, Wikipedia), маси апаратів і реальних місій, маса й потужність HiRISE, SEIS, SuperCam, Mastcam-Z, MOXIE, MMRTG, Kilopower. У вікні «Детальніше» такі значення позначені ✓ з посиланням.</li>
      <li><b>Реальні за порядком величини, але ще не звірені:</b> ціни ракет і приладів, маси решти приладів, швидкості антен, дати вікон запуску. Вони позначені як орієнтовні.</li>
      <li><b>Ігрові параметри, яких немає в реальності:</b> бали науки і цінність приладів для завдань, бюджети класів місій, ймовірності подій і ризики посадки, множник цінності Європи. Їх підібрано так, щоб баланс був чесним (див. графік вище), а не взято з джерел.</li>
    </ul>

    <h3>Головні спрощення</h3>
    <ul>
      <li>Орбіти планет вважаємо коловими; відстань до Землі і сонячне з’єднання рахуються з реальних періодів обертання.</li>
      <li>Паливо — за рівнянням Ціолковського з питомим імпульсом 320 с. Система посадки на Марс важить у 2,3 раза більше за апарат (як у Perseverance).</li>
      <li>Сонячна енергія: 1361 Вт/м² біля Землі × 1/r² × множник умов (ніч, кут, атмосфера).</li>
      <li>Надійність ракети — правило Лапласа: (успіхи + 1) / (польоти + 2).</li>
      <li>Розробка: апарат важчає на 8–30% проти креслень (понад запас 20% — проблема), події забирають гроші з резерву і додають місяці затримки; очікування наступного вікна коштує ~6% вартості проєкту на рік.</li>
      <li>Клас ризику A–D множить ціну, масу й частоту відмов; множники ігрові, сама класифікація — справжня практика NASA.</li>
      <li>Широта майданчика: сонячна енергія множиться на косинус широти, обігрів росте до +30%.</li>
            <li>Наука — умовні бали, що залежать від приладу, завдання, майданчика, енергії і переданих даних.</li>
    </ul>

    <h3>Ракети</h3>
    ${table(['Ракета', 'На низьку орбіту', 'Ціна', 'Польоти', 'Надійність', 'Спрощення', ''], d.rockets.map((x) => `<tr><td>${t(x.name)}</td><td>${fmt(x.leo_kg)} кг</td><td>${fmt(x.cost_musd)} млн $</td><td>${x.successes}/${x.flights}</td><td>${Math.round(rocketReliability(x) * 1000) / 10}%</td><td>${esc(x.simplified)}</td><td>${link(x.source)}</td></tr>`))}

    <h3>Платформи</h3>
    ${table(['Платформа', 'Прототип', 'Маса', 'Ціна', 'Спрощення', ''], C.platforms.map((x) => `<tr><td>${t(x.name)}</td><td>${esc(x.prototype)}</td><td>${fmt(x.mass_kg)} кг</td><td>${fmt(x.cost_musd)} млн $</td><td>${esc(x.simplified)}</td><td>${link(x.source)}</td></tr>`))}

    <h3>Прилади</h3>
    ${table(['Прилад', 'Прототип', 'Маса', 'Потужність', 'Дані/добу', 'Спрощення', ''], C.instruments.map((x) => `<tr><td>${t(x.name)}</td><td>${esc(x.prototype)}</td><td>${fmt(x.mass_kg)} кг</td><td>${fmt(x.power_w)} Вт</td><td>${fmt(x.data_mbit_per_day)} Мбіт</td><td>${esc(x.simplified)}</td><td>${link(x.source)}</td></tr>`))}

    <h3>Енергія і зв’язок</h3>
    ${table(['Компонент', 'Прототип', 'Маса', 'Спрощення', ''], [...C.power, ...C.antennas].map((x) => `<tr><td>${t(x.name)}</td><td>${esc(x.prototype)}</td><td>${fmt(x.mass_kg)} кг</td><td>${esc(x.simplified)}</td><td>${link(x.source)}</td></tr>`))}

    <h3>Цілі</h3>
    ${table(['Ціль', 'Відстань від Сонця', 'k маси', 'Політ', ''], d.targets.map((x) => `<tr><td>${t(x.name)}</td><td>${x.sun_au} а.о.</td><td>${x.k_capacity}</td><td>${fmt(x.flight_days)} ${dayWord(x.flight_days)}</td><td>${link(x.source)}</td></tr>`))}

    <p class="small muted">Зображення: NASA. Гра створена для NASA Space Apps Challenge 2026.</p>`;
}
