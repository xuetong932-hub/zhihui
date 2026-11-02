import test from 'node:test';
import assert from 'node:assert/strict';
import { goalOf, doneToday, goalStreak, reminderCalendar, DEFAULT_GOAL } from '../habit.js';
import { validProfile } from '../app.js';

const at = (day, hour = 10) => new Date(`${day}T${String(hour).padStart(2, '0')}:00:00`).toISOString();
const reviews = (day, count, offset = 0) => Array.from({ length: count }, (_, i) => ({ cardId: `c${i + offset}`, at: at(day) }));

test('daily goal: default, distinct cards today, and days in a row it was met', () => {
  assert.equal(goalOf({}), DEFAULT_GOAL); assert.equal(goalOf({ dailyGoal: 20 }), 20); assert.equal(goalOf({ dailyGoal: 7 }), DEFAULT_GOAL);
  const now = new Date('2026-11-02T20:00:00');
  const events = [...reviews('2026-10-30', 5), ...reviews('2026-10-31', 5), ...reviews('2026-11-01', 5), ...reviews('2026-11-02', 3), { cardId: 'c0', at: at('2026-11-02', 11) }];
  assert.equal(doneToday(events, now), 3, 'the same card twice counts once');
  assert.equal(goalStreak(events, 5, now), 3, 'today is not met yet, so the streak runs to yesterday');
  assert.equal(goalStreak([...events, ...reviews('2026-11-02', 2, 3)], 5, now), 4, 'meeting today extends it');
  assert.equal(goalStreak(events, 10, now), 0);
});

test('profiles accept only the listed goals; older profiles without one stay valid', () => {
  const base = { version: 1, locale: 'zh', dailyMinutes: 10, adultVerification: { isAdult: true, verifiedAt: '2026-11-02T00:00:00.000Z', method: 'operator-admin' }, modules: { coding: { enabled: true, level: 'beginner' }, english: { enabled: true, level: 'beginner' }, work: { enabled: true, level: 'beginner' }, life: { enabled: true, level: 'beginner' } } };
  assert.equal(validProfile(base), true);
  assert.equal(validProfile({ ...base, dailyGoal: 20 }), true);
  assert.equal(validProfile({ ...base, dailyGoal: 7 }), false);
});

test('calendar reminder: one daily event at the chosen local time with an alert', () => {
  const ics = reminderCalendar({ time: '07:30', locale: 'zh', url: 'https://example.test/m/', now: new Date('2026-11-02T03:00:00Z') });
  assert.match(ics, /^BEGIN:VCALENDAR\r\n/); assert.match(ics, /RRULE:FREQ=DAILY/); assert.match(ics, /DTSTART:2026110\dT073000\r\n/);
  assert.match(ics, /BEGIN:VALARM[\s\S]*TRIGGER:PT0M[\s\S]*END:VALARM/); assert.match(ics, /SUMMARY:知回 · 每日复习/);
  assert.match(reminderCalendar({ time: 'bad', locale: 'en', url: 'https://example.test/' }), /T190000\r\n/, 'falls back to 19:00');
});
