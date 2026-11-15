import test from 'node:test';
import assert from 'node:assert/strict';
import { journey, JOURNEY_CATS } from '../journey.js';
import { achievements } from '../achievements.js';

const at = (day, hour = 10) => new Date(`${day}T${String(hour).padStart(2, '0')}:00:00`).toISOString();

test('growth tree: milestones oldest first with their days, the two closest next steps, the seed is the first question', () => {
  const events = Array.from({ length: 12 }, (_, i) => ({ cardId: `c${i}`, at: at('2026-11-0' + (1 + (i % 3))), rating: 'understood' }));
  const progress = achievements({ events, goal: 3, cards: events.map(e => ({ id: e.cardId, module: 'coding' })), questions: [at('2026-10-30', 9)], books: 0 });
  const tree = journey({ progress, questions: [at('2026-10-30', 9)], firstQuestion: { at: at('2026-10-30', 9), text: '什么是变量？' }, purchases: [{ id: 'p', item: 'hat-straw', at: at('2026-11-02'), price: 40 }] });
  assert.deepEqual(tree.seed, { day: '2026-10-30', text: '什么是变量？' });
  assert.ok(tree.items.some(item => item.key === 'badge:learned:1' && item.day && item.cat === 'collect' && item.frame === 'normal'));
  assert.ok(tree.items.some(item => item.key === 'badge:streak:1' && item.frame === 'normal'));
  assert.ok(tree.items.some(item => item.key === 'outfit:first' && item.day === '2026-11-02'));
  assert.ok(!tree.items.some(item => item.id === 'first'), 'the first question is the seed, not a branch');
  const days = tree.items.map(item => item.day);
  assert.deepEqual(days, [...days].sort());
  assert.equal(tree.upcoming.length, 2);
  assert.ok(tree.upcoming.every(step => step.have < step.need && JOURNEY_CATS.includes(step.cat)));
  assert.equal(tree.total, tree.items.length);
  // One limb per category, in order, holding exactly that category's milestones and its next goal.
  assert.deepEqual(tree.limbs.map(limb => limb.cat), JOURNEY_CATS);
  assert.equal(tree.limbs.reduce((n, limb) => n + limb.items.length, 0), tree.items.length);
  for (const limb of tree.limbs) { assert.ok(limb.items.every(item => item.cat === limb.cat)); assert.ok(!limb.next || limb.next.cat === limb.cat); }
});

test('growth tree: levels and question counts become branches; an empty history has no seed', () => {
  const progress = { badges: [{ id: 'first', tiers: [1], tier: 0, progress: 0, next: 1, earned: [] }], levelDays: [null, '2026-11-05', null] };
  const questions = Array.from({ length: 10 }, (_, i) => at('2026-11-0' + (1 + (i % 5))));
  const tree = journey({ progress, questions });
  assert.deepEqual(tree.items.map(item => item.key), ['ask:10', 'level:2']);
  assert.equal(tree.items[1].frame, 'goal');
  assert.equal(journey({ progress: { badges: [] } }).seed, null);
});
