// Прості звуки через Web Audio: без файлів, нічого не завантажується. За замовчуванням вимкнено.
let ctx = null;
let enabled = false;

export function setSound(on) { enabled = on; if (on) audio(); }
export function soundOn() { return enabled; }

function audio() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function tone(freq, dur = 0.15, { type = 'sine', gain = 0.12, delay = 0 } = {}) {
  if (!enabled) return;
  const a = audio();
  if (!a) return;
  const t0 = a.currentTime + delay;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(a.destination);
  o.start(t0);
  o.stop(t0 + dur + 0.05);
}

/** Шум ракетного двигуна: відфільтрований білий шум, що наростає і стихає. */
function rumble(dur = 1.6) {
  if (!enabled) return;
  const a = audio();
  if (!a) return;
  const buf = a.createBuffer(1, a.sampleRate * dur, a.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const src = a.createBufferSource();
  src.buffer = buf;
  const f = a.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = 400;
  const g = a.createGain();
  const t0 = a.currentTime;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(0.35, t0 + 0.3);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(f).connect(g).connect(a.destination);
  src.start();
}

export const sfx = {
  tick: () => tone(880, 0.12, { type: 'square', gain: 0.05 }),
  liftoff: () => { tone(1320, 0.3, { type: 'square', gain: 0.05 }); rumble(); },
  decision: () => { tone(660, 0.12); tone(990, 0.18, { delay: 0.12 }); },
  good: () => { tone(523, 0.15); tone(659, 0.15, { delay: 0.1 }); tone(784, 0.3, { delay: 0.2 }); },
  bad: () => { tone(330, 0.25, { type: 'sawtooth', gain: 0.06 }); tone(247, 0.4, { type: 'sawtooth', gain: 0.06, delay: 0.2 }); },
};
