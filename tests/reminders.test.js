import test from 'node:test';
import assert from 'node:assert/strict';
import { planReminders, reminderLine, LINES, dueByDay } from '../reminders.js';

const local = (d, h, m = 0) => new Date(2026, 10, d, h, m);
const hours = slots => slots.map(s => `${new Date(s.at).getDate()} ${new Date(s.at).getHours()}:${s.kind}`);

test('reminders: at most two a day, morning from 09:00, evening only when not reviewed', () => {
  assert.deepEqual(hours(planReminders({ now: local(17, 7), due: [5, 3, 0] })), ['17 9:morning', '17 20:evening', '18 9:morning', '18 20:evening']);
  assert.deepEqual(hours(planReminders({ now: local(17, 12), due: [5, 3, 1] })), ['17 20:evening', '18 9:morning', '18 20:evening', '19 9:morning', '19 20:evening'], 'past 9:00 → no morning today');
  assert.deepEqual(hours(planReminders({ now: local(17, 12), due: [5, 0, 0], reviewedToday: true })), [], 'reviewed today → no evening');
  assert.deepEqual(hours(planReminders({ now: local(17, 21), due: [5, 0, 0] })), [], 'nothing late at night');
  assert.deepEqual(planReminders({ now: local(17, 7), due: [0, 0, 0] }), [], 'nothing due, nothing sent');
  const perDay = new Map(); for (const s of planReminders({ now: local(17, 0, 30), due: [9, 9, 9] })) { const d = new Date(s.at).getDate(); perDay.set(d, (perDay.get(d) || 0) + 1); }
  assert.ok([...perDay.values()].every(n => n <= 2));
  assert.ok(planReminders({ now: local(17, 0, 30), due: [9, 9, 9] }).every(s => new Date(s.at).getHours() >= 9));
});

test('reminders: a streak of two or more turns today’s evening reminder into a streak one', () => {
  const [, evening] = planReminders({ now: local(17, 7), due: [4], streak: 6 });
  assert.equal(evening.kind, 'streak'); assert.equal(evening.d, 6);
});

test('reminders: lines fill the numbers, never repeat the last one, and stay 小回’s own', () => {
  const line = reminderLine('morning', { n: 6, locale: 'zh', random: () => 0 });
  assert.equal(line.index, 0); assert.match(line.body, /6 张/);
  assert.notEqual(reminderLine('morning', { avoid: 0, random: () => 0 }).index, 0);
  assert.match(reminderLine('streak', { d: 12, locale: 'en', random: () => 0 }).body, /12-day/);
  for (const pool of Object.values(LINES)) for (const [zh, en] of pool) { assert.ok(zh.length <= 40, zh); assert.doesNotMatch(en, /Duo|owl|Duolingo/i); }
});

test('reminders: due counts per day follow the schedule and skip subjects left out', () => {
  const now = local(17, 8), card = (id, created, module = 'coding') => ({ id, module, status: 'active', extraction: 'ready', createdAt: created.toISOString() });
  const profile = { modules: { coding: { enabled: true }, work: { enabled: true } } };
  const cards = [card('a', local(16, 10)), card('b', local(17, 10)), card('c', local(16, 10), 'work')];
  assert.deepEqual(dueByDay(cards, { events: [] }, profile, now), [2, 3, 3]);
  assert.deepEqual(dueByDay(cards, { events: [] }, { ...profile, reviewPlan: { off: ['work'] } }, now), [1, 2, 2]);
});
