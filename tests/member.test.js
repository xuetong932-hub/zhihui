import test from 'node:test';
import assert from 'node:assert/strict';
import { dailyTasks } from '../member-ui.js';

test('daily tasks come from today’s history', () => {
  const now = new Date(2026, 10, 17, 15), today = new Date(2026, 10, 17, 9).toISOString(), yesterday = new Date(2026, 10, 16, 9).toISOString();
  const none = dailyTasks({ questions: [yesterday], events: [{ at: yesterday, cardId: 'a' }], goal: 2, now });
  assert.deepEqual(none.map(task => task.done), [false, false, false]);
  const some = dailyTasks({ questions: [today], events: [{ at: today, cardId: 'a' }, { at: today, cardId: 'a' }], goal: 2, now });
  assert.deepEqual(some.map(task => task.done), [true, true, false], 'the same card twice counts once');
  assert.equal(some[2].count, 1);
  const all = dailyTasks({ questions: [], events: [{ at: today, cardId: 'a' }, { at: today, cardId: 'b' }], goal: 2, now });
  assert.equal(all[2].done, true);
});
