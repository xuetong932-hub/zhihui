import test from 'node:test';
import assert from 'node:assert/strict';
import { isAdult, validProfile } from '../app.js';

test('age eligibility uses local calendar dates and exact eighteenth birthday', () => {
  const today = new Date(2026, 10, 1);
  assert.equal(isAdult('2008-11-01', today), true);
  assert.equal(isAdult('2008-11-02', today), false);
  assert.equal(isAdult('2008-10-31', today), true);
  assert.equal(isAdult('2027-01-01', today), null);
  assert.equal(isAdult('2008-02-30', today), null);
  assert.equal(isAdult('', today), null);
});

test('stored profiles must have valid eligibility, module levels and a review plan', () => {
  const profile = {
    version: 1, locale: 'zh', dailyMinutes: 10,
    adultVerification: { isAdult: true, method: 'self-declared-birthdate', verifiedAt: '2026-11-01T00:00:00Z' },
    modules: Object.fromEntries(['coding', 'english', 'work', 'life'].map(id => [id, { enabled: id === 'coding', level: 'beginner' }])),
  };
  assert.equal(validProfile(profile), true);
  assert.equal(validProfile({ ...profile, adultVerification: undefined }), false);
  assert.equal(validProfile({ ...profile, dailyMinutes: -1 }), false);
  assert.equal(validProfile({ ...profile, modules: {} }), false);
  const disabled = structuredClone(profile);
  disabled.modules.coding.enabled = false;
  assert.equal(validProfile(disabled), false);
});
