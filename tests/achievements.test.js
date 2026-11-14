import test from 'node:test';
import assert from 'node:assert/strict';
import { achievements, levelOf, newBadges, LEVELS } from '../achievements.js';

const at = (day, hour = 12) => new Date(`${day}T${String(hour).padStart(2, '0')}:00:00`).toISOString();
const days = (start, n) => Array.from({ length: n }, (_, i) => { const d = new Date(`${start}T12:00:00`); d.setDate(d.getDate() + i); return d.toISOString().slice(0, 10); });
const badge = (result, id) => result.badges.find(item => item.id === id);

test('levels follow the pine-cone thresholds', () => {
  assert.equal(levelOf(0).level, 1);
  assert.equal(levelOf(LEVELS[1]).level, 2);
  assert.equal(levelOf(LEVELS[5] + 5).level, 6);
  assert.equal(levelOf(LEVELS[5] + 5).next, null);
  assert.equal(levelOf(65).progress, (65 - 30) / 70);
});

test('nothing done: level 1, no badge earned', () => {
  const result = achievements({ events: [], goal: 3, cards: [], questions: [], books: 0 });
  assert.equal(result.level.level, 1);
  assert.ok(result.badges.every(item => item.tier === 0));
  assert.equal(badge(result, 'learned').next, 10);
});

test('learned knowledge points earn tiers on the day the threshold was crossed', () => {
  const cards = Array.from({ length: 12 }, (_, i) => ({ id: `k${i}`, module: 'coding' }));
  const events = cards.map((card, i) => ({ cardId: card.id, rating: 'understood', at: at(days('2026-03-01', 12)[i]) }));
  const learned = badge(achievements({ events, goal: 3, cards, questions: [], books: 0 }), 'learned');
  assert.equal(learned.tier, 1);
  assert.equal(learned.progress, 12);
  assert.deepEqual(learned.earned, [{ tier: 1, day: '2026-03-10' }]);
  assert.equal(learned.next, 50);
});

test('streak badge uses the best run of goal days; early and night reviews are counted', () => {
  const run = days('2026-04-01', 7).flatMap(day => [1, 2, 3].map(n => ({ cardId: `c${n}`, rating: 'fuzzy', at: at(day, n === 1 ? 7 : n === 2 ? 23 : 12) })));
  const result = achievements({ events: run, goal: 3, cards: [], questions: [], books: 0 });
  const streak = badge(result, 'streak');
  assert.equal(streak.tier, 2);
  assert.deepEqual(streak.earned.map(item => item.day), ['2026-04-03', '2026-04-07']);
  assert.equal(badge(result, 'early').progress, 7);
  assert.equal(badge(result, 'night').progress, 7);
});

test('a whole calendar month of goal days earns the month badge', () => {
  const events = days('2026-02-01', 28).map((day, i) => ({ cardId: `m${i}`, rating: 'fuzzy', at: at(day) }));
  assert.equal(badge(achievements({ events, goal: 1, cards: [], questions: [], books: 0 }), 'month').tier, 1);
  assert.equal(badge(achievements({ events: events.slice(1), goal: 1, cards: [], questions: [], books: 0 }), 'month').tier, 0);
});

test('first question and books; new badges are those not celebrated yet', () => {
  const result = achievements({ events: [], goal: 3, cards: [], questions: [at('2026-01-05')], books: 3 });
  assert.equal(badge(result, 'first').tier, 1);
  assert.equal(badge(result, 'books').tier, 2);
  assert.deepEqual(newBadges(result.badges, new Set(['first:1'])), [{ id: 'books', tier: 2 }]);
});
