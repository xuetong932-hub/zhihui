// 小回's garden (成长页): learning earns water drops, Backy waters the beanstalk with a watering can, the beanstalk grows
// through 12 stages from a seed in the yard to the edge of space. Drops are worked out from the history (like pine
// cones, so they cannot be edited); what was poured and harvested is kept in profile.garden and travels with the
// encrypted cloud snapshot. Nothing here involves real money.
import { localDay } from './knowledge-store.js';

// Drops per thing done, and at most this many per day (so a burst of quick taps cannot fill the can).
export const DROPS = { ask: 2, review: 1, learned: 2, goalDay: 5, dailyCap: 50 };
// Watering cans: how much one holds (one watering pours it all), how much growth a drop gives, and the total poured
// that unlocks it.
export const CANS = [
  { level: 1, capacity: 20, boost: 1, need: 0 },
  { level: 2, capacity: 40, boost: 1.1, need: 100 },
  { level: 3, capacity: 60, boost: 1.2, need: 400 },
  { level: 4, capacity: 80, boost: 1.3, need: 1000 },
  { level: 5, capacity: 120, boost: 1.5, need: 2500 },
];
// Stages: growth needed and the height reached (metres; the last one is the edge of space).
export const STAGES = [
  { id: 'seed', need: 0, height: 0 }, { id: 'sprout', need: 5, height: 0.1 }, { id: 'seedling', need: 20, height: 1 },
  { id: 'roof', need: 50, height: 6 }, { id: 'village', need: 100, height: 30 }, { id: 'wall', need: 180, height: 120 },
  { id: 'hills', need: 300, height: 600 }, { id: 'tai', need: 480, height: 1545 }, { id: 'clouds', need: 720, height: 3000 },
  { id: 'snow', need: 1050, height: 5500 }, { id: 'everest', need: 1500, height: 8849 }, { id: 'stars', need: 2100, height: 100000 },
];
// After the last stage every HARVEST growth ripens a golden pine cone worth HARVEST_CONES pine cones.
export const HARVEST = 200, HARVEST_CONES = 10;
const LEARNED = ['understood', 'mastered'];

// Drops earned per local day from the history, each day capped. → { total, days: Map(day → drops) }
export function dropsEarned({ events = [], questions = [], goal = 10 }) {
  const days = new Map(), add = (day, n) => days.set(day, (days.get(day) || 0) + n), seen = new Set(), perDay = new Map();
  for (const at of questions) { const d = new Date(at); if (Number.isFinite(d.getTime())) add(localDay(d), DROPS.ask); }
  for (const event of [...events].sort((a, b) => a.at.localeCompare(b.at))) {
    const day = localDay(new Date(event.at));
    add(day, DROPS.review);
    if (LEARNED.includes(event.rating) && !seen.has(event.cardId)) { seen.add(event.cardId); add(day, DROPS.learned); }
    if (!perDay.has(day)) perDay.set(day, new Set());
    perDay.get(day).add(event.cardId);
  }
  for (const [day, ids] of perDay) if (ids.size >= Math.max(1, goal)) add(day, DROPS.goalDay);
  let total = 0;
  for (const [day, n] of days) { const capped = Math.min(n, DROPS.dailyCap); days.set(day, capped); total += capped; }
  return { total, days };
}

export const emptyGarden = () => ({ version: 1, pours: [], harvests: 0 });
export function cleanGarden(data) {
  const out = emptyGarden();
  if (!data || typeof data !== 'object') return out;
  for (const p of Array.isArray(data.pours) ? data.pours : []) {
    if (Number.isFinite(Date.parse(p?.at)) && Number.isInteger(p.drops) && p.drops > 0 && Number.isFinite(p.growth) && p.growth > 0) out.pours.push({ at: p.at, drops: p.drops, growth: p.growth });
  }
  out.harvests = Number.isInteger(data.harvests) && data.harvests > 0 ? data.harvests : 0;
  return out;
}
export const canFor = poured => [...CANS].reverse().find(can => poured >= can.need);
export function stageFor(growth) {
  let index = 0;
  STAGES.forEach((stage, i) => { if (growth >= stage.need) index = i; });
  const stage = STAGES[index], next = STAGES[index + 1] || null;
  const progress = next ? (growth - stage.need) / (next.need - stage.need) : 1;
  // Height between this stage and the next, so every watering shows the beanstalk getting taller.
  const height = next && index + 1 < STAGES.length - 1 ? stage.height + (next.height - stage.height) * progress : stage.height;
  return { index, stage, next, progress, height };
}

// Everything the garden page shows. earned: dropsEarned().total.
export function gardenState(data, earned) {
  const garden = cleanGarden(data), poured = garden.pours.reduce((n, p) => n + p.drops, 0), growth = garden.pours.reduce((n, p) => n + p.growth, 0);
  const can = canFor(poured), nextCan = CANS[can.level] || null, balance = Math.max(0, earned - poured);
  const inCan = Math.min(balance, can.capacity), last = STAGES[STAGES.length - 1];
  const ripe = growth >= last.need ? Math.floor((growth - last.need) / HARVEST) - garden.harvests : 0;
  return { ...stageFor(growth), growth, poured, balance, can, nextCan, inCan, barrel: balance - inCan, ripe: Math.max(0, ripe), harvested: garden.harvests, harvestCones: garden.harvests * HARVEST_CONES };
}
// Water once: the can pours all it holds. → { ok, data, drops, growth } or { ok: false }
export function pour(data, earned, now = new Date()) {
  const garden = cleanGarden(data), state = gardenState(garden, earned);
  if (!state.inCan) return { ok: false };
  const growth = Math.round(state.inCan * state.can.boost * 10) / 10;
  return { ok: true, drops: state.inCan, growth, data: { ...garden, pours: [...garden.pours, { at: now.toISOString(), drops: state.inCan, growth }] } };
}
export function harvest(data, earned) {
  const garden = cleanGarden(data);
  if (!gardenState(garden, earned).ripe) return { ok: false };
  return { ok: true, data: { ...garden, harvests: garden.harvests + 1 } };
}
