import test from 'node:test';
import assert from 'node:assert/strict';
import { FSRS_W, retrievability, memoryState, nextInterval, elapsedDays, MAX_INTERVAL } from '../fsrs.js';
import { validReviewEvent } from '../review-store.js';

test('FSRS-5 basics: 19 parameters, 90% recall at t = S, intervals and their bounds', () => {
  assert.equal(FSRS_W.length, 19);
  assert.ok(Math.abs(retrievability(7, 7) - 0.9) < 1e-9, 'recall is 90% when the elapsed days equal stability');
  assert.ok(retrievability(30, 7) < retrievability(7, 7));
  assert.equal(nextInterval(7.4), 7); assert.equal(nextInterval(0.2), 1); assert.equal(nextInterval(10000), MAX_INTERVAL);
  assert.equal(elapsedDays('2026-11-01T23:50:00', '2026-11-02T00:10:00'), 1, 'calendar days, not 24-hour blocks');
});

test('memory state: first grade sets stability; recalls grow it; a miss shrinks it; difficulty stays within 1–10', () => {
  assert.equal(memoryState([]), null);
  const first = memoryState([{ at: '2026-10-01T09:00:00', rating: 'understood' }]);
  assert.equal(first.s, FSRS_W[2]);
  const recalled = memoryState([{ at: '2026-10-01T09:00:00', rating: 'understood' }, { at: '2026-10-04T09:00:00', rating: 'understood' }]);
  assert.ok(recalled.s > first.s);
  const missed = memoryState([{ at: '2026-10-01T09:00:00', rating: 'understood' }, { at: '2026-10-04T09:00:00', rating: 'wrong' }]);
  assert.ok(missed.s < first.s); assert.ok(missed.d > recalled.d, 'a miss makes the card harder');
  const many = memoryState(Array.from({ length: 30 }, (_, i) => ({ at: new Date(2026, 0, 1 + i).toISOString(), rating: i % 2 ? 'wrong' : 'mastered' })));
  assert.ok(many.d >= 1 && many.d <= 10);
  assert.equal(validReviewEvent({ id: 'e', cardId: 'c', at: '2026-11-02T00:00:00Z', due: '2027-11-02T00:00:00Z', interval: 365, rating: 'mastered', answer: '', correct: true, explanation: '' }), true);
  assert.equal(validReviewEvent({ id: 'e', cardId: 'c', at: '2026-11-02T00:00:00Z', due: '2027-11-03T00:00:00Z', interval: 366, rating: 'mastered', answer: '', correct: true, explanation: '' }), false);
});
