// 小回's growth tree (成长树): every milestone the history shows, with the day it happened, laid out on a tree that grows
// from the first question (the seed at its roots) up to today (the canopy). Like the badges it is worked out from the
// history each time, so nothing is stored. Inspired by branching achievement trees and long scrolling achievement
// screens in games; the art and layout are 知回's own (journey-ui.js).
import { localDay } from './knowledge-store.js';
import { itemById } from './shop.js';

export const JOURNEY_CATS = ['ask', 'review', 'habit', 'collect', 'pet'];
const BADGE_CAT = { first: 'ask', learned: 'collect', streak: 'habit', reviews: 'review', cones: 'pet', polymath: 'collect', early: 'review', night: 'review', books: 'collect', month: 'habit' };
const FRAMES = ['normal', 'goal', 'challenge'];
const ASK_STEPS = [10, 50, 100];
const frameOf = (tiers, tier) => tiers.length === 1 ? 'challenge' : FRAMES[tier - 1];
const dayOf = at => { const d = new Date(at); return Number.isFinite(d.getTime()) ? localDay(d) : null; };

// progress: achievements() output; questions: dates of the user's questions; firstQuestion: { at, text } or null;
// purchases: shop purchases. → { items (oldest first), limbs ([{ cat, items, next }] in JOURNEY_CATS order),
// upcoming (the two closest next steps), seed, total }
export function journey({ progress, questions = [], firstQuestion = null, purchases = [] }) {
  const items = [];
  for (const badge of progress.badges) {
    if (badge.id === 'first') continue; // the first question is the seed itself
    for (const step of badge.earned) items.push({ key: `badge:${badge.id}:${step.tier}`, kind: 'badge', id: badge.id, tier: step.tier, tiers: badge.tiers, need: badge.tiers[step.tier - 1], cat: BADGE_CAT[badge.id], frame: frameOf(badge.tiers, step.tier), day: step.day });
  }
  (progress.levelDays || []).forEach((day, i) => { if (i && day) items.push({ key: `level:${i + 1}`, kind: 'level', level: i + 1, cat: 'pet', frame: i + 1 >= 4 ? 'challenge' : 'goal', day }); });
  const asked = [...questions].filter(Boolean).sort();
  for (const need of ASK_STEPS) if (asked.length >= need) items.push({ key: `ask:${need}`, kind: 'ask', need, cat: 'ask', frame: need >= 100 ? 'goal' : 'normal', day: dayOf(asked[need - 1]) });
  const outfit = purchases.filter(p => !p.refunded && itemById(p.item)?.kind === 'outfit').sort((a, b) => a.at.localeCompare(b.at))[0];
  if (outfit) items.push({ key: 'outfit:first', kind: 'outfit', item: outfit.item, cat: 'pet', frame: 'normal', day: dayOf(outfit.at) });
  // Undated steps (books made before dates were kept) sit just above the seed.
  items.sort((a, b) => (a.day || '').localeCompare(b.day || '') || a.key.localeCompare(b.key));
  const upcoming = progress.badges.filter(badge => badge.next !== null && badge.id !== 'first')
    .map(badge => ({ key: `next:${badge.id}`, kind: 'badge', id: badge.id, tier: badge.tier + 1, tiers: badge.tiers, need: badge.next, have: badge.progress, cat: BADGE_CAT[badge.id], frame: frameOf(badge.tiers, badge.tier + 1), ratio: badge.progress / badge.next }))
    .sort((a, b) => b.ratio - a.ratio || a.need - b.need);
  // The tree forks into one limb per category: its milestones (oldest first) and its closest next goal.
  const limbs = JOURNEY_CATS.map(cat => ({ cat, items: items.filter(item => item.cat === cat), next: upcoming.find(step => step.cat === cat) || null }));
  const seedDay = firstQuestion?.at ? dayOf(firstQuestion.at) : asked[0] ? dayOf(asked[0]) : null;
  return { items, limbs, upcoming: upcoming.slice(0, 2), seed: seedDay ? { day: seedDay, text: firstQuestion?.text || '' } : null, total: items.length };
}
