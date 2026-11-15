import { localDay } from './knowledge-store.js';
import { pineGains } from './pet.js';
// The squirrel's level and achievement badges, worked out from the history every time (like the pine cones: nothing is
// stored, so they survive device changes and cannot be edited). Each badge has up to three tiers (bronze, silver, gold);
// the day a tier was reached is the day its threshold was crossed.

export const LEVELS = [0, 30, 100, 300, 800, 2000]; // pine cones needed for Lv1–Lv6
export const BADGES = [
  { id: 'first', tiers: [1] },            // first question asked
  { id: 'learned', tiers: [10, 50, 200] },  // knowledge points learned
  { id: 'streak', tiers: [3, 7, 30] },      // best run of goal days
  { id: 'reviews', tiers: [50, 300, 1000] },
  { id: 'cones', tiers: [50, 300, 1000] },
  { id: 'polymath', tiers: [3, 10, 30] },   // each of four modules has this many learned
  { id: 'early', tiers: [3, 15, 50] },      // reviews before 8:00
  { id: 'night', tiers: [3, 15, 50] },      // reviews from 22:00
  { id: 'books', tiers: [1, 3, 6] },        // books (custom modules) made
  { id: 'month', tiers: [1] },              // a whole calendar month of goal days
];
const LEARNED = ['understood', 'mastered'];

export function levelOf(cones) {
  let level = 1;
  LEVELS.forEach((need, i) => { if (cones >= need) level = i + 1; });
  const floor = LEVELS[level - 1], next = LEVELS[level] ?? null;
  return { level, cones, floor, next, progress: next === null ? 1 : (cones - floor) / (next - floor) };
}

const shift = (day, n) => { const [y, m, d] = day.split('-').map(Number); return localDay(new Date(y, m - 1, d + n, 12)); };
// Units: one entry per counted thing, oldest first, each the day it happened (null when the day is unknown).
function units({ events, goal, cards, questions, books }) {
  const sorted = [...(events || [])].sort((a, b) => a.at.localeCompare(b.at));
  const moduleOf = new Map((cards || []).map(card => [card.id, card.module]));
  const learnedDays = [], perModule = new Map(), polymath = [], seen = new Set(), perDay = new Map(), early = [], night = [];
  for (const event of sorted) {
    const at = new Date(event.at), day = localDay(at), hour = at.getHours();
    if (!perDay.has(day)) perDay.set(day, new Set());
    perDay.get(day).add(event.cardId);
    if (hour < 8) early.push(day);
    if (hour >= 22) night.push(day);
    if (LEARNED.includes(event.rating) && !seen.has(event.cardId)) {
      seen.add(event.cardId); learnedDays.push(day);
      const module = moduleOf.get(event.cardId);
      if (module) {
        perModule.set(module, (perModule.get(module) || 0) + 1);
        const top = [...perModule.values()].sort((a, b) => b - a);
        const level = top.length >= 4 ? top[3] : 0;
        while (polymath.length < level) polymath.push(day);
      }
    }
  }
  const goalDays = [...perDay].filter(([, ids]) => ids.size >= Math.max(1, goal)).map(([day]) => day).sort();
  const streak = []; let run = 0, previous = '';
  for (const day of goalDays) { run = previous && shift(previous, 1) === day ? run + 1 : 1; previous = day; while (streak.length < run) streak.push(day); }
  const months = [], met = new Set(goalDays);
  for (const key of [...new Set(goalDays.map(day => day.slice(0, 7)))].sort()) {
    const [y, m] = key.split('-').map(Number), last = new Date(y, m, 0).getDate();
    if (Array.from({ length: last }, (_, i) => `${key}-${String(i + 1).padStart(2, '0')}`).every(day => met.has(day))) months.push(`${key}-${String(last).padStart(2, '0')}`);
  }
  const cones = [];
  for (const [day, amount] of pineGains(events, goal).gains) for (let i = 0; i < amount; i++) cones.push(day);
  return {
    first: [...(questions || [])].sort().map(at => localDay(new Date(at))),
    learned: learnedDays, streak, reviews: sorted.map(event => localDay(new Date(event.at))), cones, polymath, early, night,
    books: Array.from({ length: books || 0 }, () => null), month: months,
  };
}

// → { level, badges: [{ id, tier (0–3 reached), tiers, progress, next (target or null), earned: [{ tier, day }] }], levelDays }
export function achievements(input) {
  const counted = units(input), cones = counted.cones.length;
  const badges = BADGES.map(({ id, tiers }) => {
    const list = counted[id], earned = tiers.map((need, i) => list.length >= need ? { tier: i + 1, day: list[need - 1] } : null).filter(Boolean);
    return { id, tiers, tier: earned.length, progress: list.length, next: tiers[earned.length] ?? null, earned };
  });
  // The day each level was reached (null for Lv1 and for levels not reached yet), for the growth tree.
  const levelDays = LEVELS.map((need, i) => i && counted.cones.length >= need ? counted.cones[need - 1] : null);
  return { level: levelOf(cones), badges, levelDays };
}

// Badge tiers not yet celebrated on this device ("id:tier" keys), newest tier of each badge only.
export function newBadges(badges, seen) {
  return badges.filter(badge => badge.tier && !seen.has(`${badge.id}:${badge.tier}`)).map(badge => ({ id: badge.id, tier: badge.tier }));
}
