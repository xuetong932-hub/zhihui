import test from 'node:test';
import assert from 'node:assert/strict';
import { TOUR_STEPS, TOUR_KEY } from '../tour.js';

test('guided tour: five steps, each with targets and text in one language per locale', () => {
  assert.equal(TOUR_STEPS.length, 5);
  assert.equal(TOUR_KEY, 'knowledge-review.tour.v1');
  for (const step of TOUR_STEPS) {
    assert.ok(step.targets.length > 0);
    assert.match(step.zh, /[一-鿿]/);
    assert.doesNotMatch(step.en, /[一-鿿]/, 'the English text has no Chinese');
  }
  // Desktop uses the top bar, phones the tab bar: every nav step lists both.
  for (const [tab, nav] of [['review', 'review'], ['library', 'library'], ['discover', 'recommend']]) {
    assert.ok(TOUR_STEPS.some(step => step.targets.includes(`[data-tab="${tab}"]`) && step.targets.includes(`nav [data-${nav}]`)), tab);
  }
});
