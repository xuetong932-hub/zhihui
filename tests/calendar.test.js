import test from 'node:test';
import assert from 'node:assert/strict';
import { activityByDay, intensity, monthWeeks, activeDaysIn } from '../calendar-ui.js';

test('calendar: activity per day counts each card once plus questions', () => {
  const at = (d, h) => new Date(2026, 10, d, h).toISOString();
  const activity = activityByDay({ events: [{ at: at(16, 9), cardId: 'a' }, { at: at(16, 10), cardId: 'a' }, { at: at(16, 11), cardId: 'b' }], questions: [at(16, 12), at(17, 8)] });
  assert.deepEqual(activity.get('2026-11-16'), { reviews: 2, questions: 1 });
  assert.deepEqual(activity.get('2026-11-17'), { reviews: 0, questions: 1 });
  assert.equal(activeDaysIn(activity, 2026, 10), 2);
  assert.equal(activeDaysIn(activity, 2026, 9), 0);
});

test('calendar: intensity steps against the goal', () => {
  assert.deepEqual([0, 1, 5, 10, 19, 20].map(n => intensity(n, 10)), [0, 1, 2, 3, 3, 4]);
});

test('calendar: November 2026 starts on a Sunday and fills whole weeks', () => {
  const weeks = monthWeeks(2026, 10);
  assert.equal(weeks[0][0], 1);
  assert.ok(weeks.every(week => week.length === 7));
  assert.equal(weeks.flat().filter(Boolean).length, 30);
  assert.equal(monthWeeks(2026, 9)[0].indexOf(1), 4, 'October 2026 starts on a Thursday');
});
