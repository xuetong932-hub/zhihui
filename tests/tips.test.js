import test from 'node:test';
import assert from 'node:assert/strict';
import { pickTip, closeTip, readTips, writeTips } from '../tips.js';

const base = { today: '2026-11-16', due: 6, doneToday: 0, goalReached: false, canFull: true, daysAway: 0, newBadge: null };

test('tips: the mic first, then due cards, a full can, the goal, coming back, a new badge; none when all quiet', () => {
  let state = { off: false, usedMic: false, closed: {} };
  assert.equal(pickTip(base, state).id, 'mic');
  state = { ...state, usedMic: true };
  assert.deepEqual(pickTip(base, state), { id: 'due', n: 6 });
  assert.equal(pickTip({ ...base, doneToday: 3 }, state).id, 'water');
  assert.equal(pickTip({ ...base, due: 0, canFull: false, goalReached: true }, state).id, 'goal');
  assert.equal(pickTip({ ...base, due: 0, canFull: false, daysAway: 4 }, state).id, 'back');
  assert.deepEqual(pickTip({ ...base, due: 0, canFull: false, newBadge: 'streak:2' }, state), { id: 'badge', badge: 'streak:2' });
  assert.equal(pickTip({ ...base, due: 0, canFull: false }, state), null);
  assert.equal(pickTip(base, { ...state, off: true }), null);
});

test('tips: closing hides a daily tip until tomorrow and the mic tip for good; old days are dropped', () => {
  let state = { off: false, usedMic: false, closed: { 'due:2026-11-10': true } };
  state = closeTip(state, { id: 'mic' }, '2026-11-16');
  state = closeTip(state, { id: 'due', n: 6 }, '2026-11-16');
  assert.deepEqual(state.closed, { mic: true, 'due:2026-11-16': true });
  assert.equal(pickTip(base, state).id, 'water');
  assert.equal(pickTip({ ...base, today: '2026-11-17' }, state).id, 'due', 'a new day brings it back');
  const store = new Map(), storage = { getItem: k => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) };
  writeTips(state, storage);
  assert.deepEqual(readTips(storage), state);
  assert.deepEqual(readTips({ getItem: () => 'not json' }), { off: false, usedMic: false, closed: {} });
});
