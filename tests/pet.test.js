import test from 'node:test';
import assert from 'node:assert/strict';
import { pineCones, petMood, PINE } from '../pet.js';

const at = (day, hour = 10) => new Date(`${day}T${String(hour).padStart(2, '0')}:00:00`).toISOString();
const ev = (cardId, day, rating = 'understood') => ({ cardId, at: at(day), rating });

test('pine cones: one per knowledge point learned, counted once per card', () => {
  const events = [ev('a', '2026-11-01', 'wrong'), ev('a', '2026-11-02'), ev('a', '2026-11-03', 'mastered'), ev('b', '2026-11-03', 'unclear')];
  const result = pineCones(events, 99, new Date(at('2026-11-03')));
  assert.equal(result.learned, 1);
  assert.equal(result.total, PINE.learned);
  assert.equal(result.today, 0, 'card a was learned yesterday');
});

test('pine cones: daily goal bonus and a weekly bonus on every 7th goal day in a row', () => {
  const days = Array.from({ length: 8 }, (_, i) => `2026-11-${String(i + 1).padStart(2, '0')}`);
  const events = days.flatMap((day, i) => [ev(`x${i}`, day, 'wrong'), ev(`y${i}`, day, 'wrong')]);
  const result = pineCones(events, 2, new Date(at('2026-11-08')));
  assert.equal(result.total, 8 * PINE.goalDay + PINE.week);
  assert.equal(result.today, PINE.goalDay);
  const broken = pineCones(events.filter(event => !event.at.startsWith('2026-11-04')), 2, new Date(at('2026-11-08')));
  assert.equal(broken.total, 7 * PINE.goalDay, 'a gap restarts the run');
});

test('pine cones: empty history and today counts', () => {
  assert.deepEqual(pineCones([], 10), { total: 0, today: 0, learned: 0, learnedToday: 0 });
  const today = pineCones([ev('a', '2026-11-05'), ev('b', '2026-11-05', 'mastered')], 2, new Date(at('2026-11-05', 18)));
  assert.equal(today.learnedToday, 2);
  assert.equal(today.today, 2 * PINE.learned + PINE.goalDay);
});

test('pet mood follows the day and the goal, and never gets worse than hungry', () => {
  assert.equal(petMood(0, 10, 23), 'sleep');
  assert.equal(petMood(10, 10, 12), 'full');
  assert.equal(petMood(3, 10, 12), 'eating');
  assert.equal(petMood(0, 10, 12), 'hungry');
});
