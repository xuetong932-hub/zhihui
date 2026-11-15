// 小回's sound effects, synthesised with the Web Audio API (no audio files): short, soft, bouncy squeaks, pops and
// chimes that fit a round little squirrel. Played only in answer to something the user did; the switch is kept on
// this device (我的 → 音效, and the speaker in the room). Volume stays low.
const KEY = 'knowledge-review.sfx.v1';
export const sfxOn = () => { try { return localStorage.getItem(KEY) !== 'off'; } catch { return true; } };
export const setSfx = on => { try { localStorage.setItem(KEY, on ? 'on' : 'off'); } catch { /* This visit only. */ } };

let ctx = null, master = null, lastAt = {};
function audio() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume?.(); return ctx; }
  const Ctx = globalThis.AudioContext || globalThis.webkitAudioContext;
  if (!Ctx) return null;
  ctx = new Ctx(); master = ctx.createGain(); master.gain.value = 0.55; master.connect(ctx.destination);
  return ctx;
}
// One voice: a pitch glide with a quick attack and soft release, optional vibrato (the "squeak").
function tone(a, { from, to = from, at = 0, dur = 0.12, type = 'sine', gain = 0.16, vibrato = 0 }) {
  const t = a.currentTime + at, osc = a.createOscillator(), env = a.createGain();
  osc.type = type; osc.frequency.setValueAtTime(from, t); osc.frequency.exponentialRampToValueAtTime(Math.max(30, to), t + dur);
  if (vibrato) { const lfo = a.createOscillator(), depth = a.createGain(); lfo.frequency.value = 28; depth.gain.value = vibrato; lfo.connect(depth).connect(osc.frequency); lfo.start(t); lfo.stop(t + dur + 0.05); }
  env.gain.setValueAtTime(0.0001, t); env.gain.exponentialRampToValueAtTime(gain, t + 0.012); env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(env).connect(master); osc.start(t); osc.stop(t + dur + 0.05);
}
// A breath of filtered noise sweeping between two frequencies (whoosh, puff, water).
function noise(a, { from, to = from, at = 0, dur = 0.2, gain = 0.12, q = 1.2 }) {
  const t = a.currentTime + at, len = Math.ceil(a.sampleRate * (dur + 0.05)), buffer = a.createBuffer(1, len, a.sampleRate), data = buffer.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  const src = a.createBufferSource(), filter = a.createBiquadFilter(), env = a.createGain();
  src.buffer = buffer; filter.type = 'bandpass'; filter.Q.value = q;
  filter.frequency.setValueAtTime(from, t); filter.frequency.exponentialRampToValueAtTime(Math.max(40, to), t + dur);
  env.gain.setValueAtTime(0.0001, t); env.gain.exponentialRampToValueAtTime(gain, t + 0.02); env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(filter).connect(env).connect(master); src.start(t); src.stop(t + dur + 0.05);
}
const notes = (a, list, step = 0.07, opts = {}) => list.forEach((f, i) => tone(a, { from: f, at: i * step, dur: 0.16, type: 'triangle', gain: 0.12, ...opts }));

export const SOUNDS = {
  tap: a => tone(a, { from: 1100, to: 1650, dur: 0.11, vibrato: 40 }),
  flip: a => { tone(a, { from: 520, to: 1500, dur: 0.32, type: 'triangle', gain: 0.14 }); tone(a, { from: 1500, to: 1900, at: 0.3, dur: 0.08 }); },
  ring: a => { tone(a, { from: 1320, dur: 0.14, type: 'triangle', gain: 0.1 }); tone(a, { from: 1760, at: 0.08, dur: 0.18, type: 'triangle', gain: 0.1 }); },
  wave: a => { tone(a, { from: 1200, to: 1600, dur: 0.09, vibrato: 30 }); tone(a, { from: 1250, to: 1700, at: 0.13, dur: 0.09, vibrato: 30 }); },
  cheer: a => notes(a, [880, 1175, 1568], 0.08, { type: 'sine', gain: 0.14 }),
  think: a => { tone(a, { from: 520, to: 480, dur: 0.14, gain: 0.12 }); tone(a, { from: 620, to: 980, at: 0.16, dur: 0.16, gain: 0.12 }); },
  shy: a => tone(a, { from: 1500, to: 820, dur: 0.3, vibrato: 25, gain: 0.12 }),
  stash: a => { tone(a, { from: 300, to: 900, dur: 0.07, gain: 0.16 }); noise(a, { from: 2400, to: 1800, at: 0.06, dur: 0.08, gain: 0.06, q: 3 }); },
  sleep: a => noise(a, { from: 500, to: 260, dur: 0.7, gain: 0.07, q: 0.8 }),
  lift: a => tone(a, { from: 1500, to: 2200, dur: 0.1, vibrato: 60, gain: 0.13 }),
  throw: a => noise(a, { from: 600, to: 2600, dur: 0.24, gain: 0.09, q: 1 }),
  bounce: (a, k = 0.5) => tone(a, { from: 360 + 380 * k, to: 140, dur: 0.18, gain: 0.06 + 0.1 * k }),
  land: a => tone(a, { from: 220, to: 90, dur: 0.12, gain: 0.12 }),
  water: a => { for (let i = 0; i < 7; i++) tone(a, { from: 1400 + Math.random() * 900, to: 900, at: 0.12 + i * 0.13, dur: 0.07, gain: 0.07 }); noise(a, { from: 1800, to: 1200, dur: 1.1, gain: 0.03, q: 0.7 }); },
  levelup: a => notes(a, [784, 988, 1175, 1568, 1976], 0.09),
  jar: a => { tone(a, { from: 700, to: 500, dur: 0.05, type: 'square', gain: 0.05 }); tone(a, { from: 1760, at: 0.06, dur: 0.22, type: 'triangle', gain: 0.1 }); },
  badge: a => notes(a, [659, 784, 1047, 1319], 0.1),
  wear: a => { tone(a, { from: 1568, dur: 0.12, type: 'triangle', gain: 0.1 }); tone(a, { from: 2093, at: 0.07, dur: 0.2, type: 'triangle', gain: 0.09 }); },
  set: a => notes(a, [1047, 1319, 1568, 2093], 0.08),
};
// Play one sound. Repeats of the same sound closer than `gap` ms are dropped (rapid wall hits stay pleasant).
export function sfx(name, strength, gap = 90) {
  if (!sfxOn() || !SOUNDS[name]) return;
  const now = globalThis.performance?.now?.() ?? Date.now();
  if (now - (lastAt[name] || 0) < gap) return;
  lastAt[name] = now;
  try { const a = audio(); if (a) SOUNDS[name](a, strength); } catch { /* No sound on this device. */ }
}
