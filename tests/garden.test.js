import test from 'node:test';
import assert from 'node:assert/strict';
import { dropsEarned, gardenState, pour, harvest, emptyGarden, cleanGarden, stageFor, STAGES, CANS, DROPS, HARVEST, HARVEST_CONES } from '../garden.js';

const at = (day, hour = 10) => new Date(`${day}T${String(hour).padStart(2, '0')}:00:00`).toISOString();

test('drops: asking, reviewing, first learned and a met goal count; each day is capped', () => {
  const events = [{ cardId: 'a', at: at('2026-11-01'), rating: 'understood' }, { cardId: 'a', at: at('2026-11-01', 11), rating: 'mastered' }, { cardId: 'b', at: at('2026-11-01'), rating: 'wrong' }];
  const one = dropsEarned({ events, questions: [at('2026-11-01')], goal: 2 });
  assert.equal(one.total, DROPS.ask + 3 * DROPS.review + DROPS.learned + DROPS.goalDay);
  const many = Array.from({ length: 80 }, (_, i) => ({ cardId: `c${i}`, at: at('2026-11-02'), rating: 'wrong' }));
  assert.equal(dropsEarned({ events: many, goal: 999 }).total, DROPS.dailyCap);
});

test('watering pours the whole can; the barrel keeps the rest; cans level up with what was poured', () => {
  let data = emptyGarden();
  let state = gardenState(data, 55);
  assert.deepEqual([state.inCan, state.barrel, state.can.level, state.stage.id], [20, 35, 1, 'seed']);
  const first = pour(data, 55, new Date('2026-11-03T10:00:00'));
  assert.ok(first.ok); assert.equal(first.drops, 20); assert.equal(first.growth, 20);
  data = first.data; state = gardenState(data, 55);
  assert.deepEqual([state.inCan, state.barrel, state.stage.id], [20, 15, 'seedling']);
  assert.equal(pour(gardenState(data, 20).balance ? data : data, 20).ok, false, 'nothing left to pour');
  const big = { version: 1, pours: [{ at: at('2026-11-04'), drops: 400, growth: 400 }], harvests: 0 };
  assert.equal(gardenState(big, 500).can.level, 3);
  assert.equal(pour(big, 500).growth, Math.round(60 * CANS[2].boost * 10) / 10, 'a better can grows more per drop');
});

test('stages go from the seed to the stars, height rises between stages, ripe cones only at the top', () => {
  assert.equal(STAGES.length, 12);
  assert.equal(stageFor(0).stage.id, 'seed');
  const mid = stageFor((STAGES[5].need + STAGES[6].need) / 2);
  assert.equal(mid.stage.id, 'wall'); assert.ok(mid.height > STAGES[5].height && mid.height < STAGES[6].height);
  const top = STAGES[11].need;
  const full = { version: 1, pours: [{ at: at('2026-11-05'), drops: 5000, growth: top + 2 * HARVEST + 10 }], harvests: 0 };
  assert.equal(gardenState(full, 5000).ripe, 2);
  const once = harvest(full, 5000);
  assert.ok(once.ok); assert.equal(gardenState(once.data, 5000).ripe, 1); assert.equal(gardenState(once.data, 5000).harvestCones, HARVEST_CONES);
  assert.equal(harvest(emptyGarden(), 0).ok, false);
  assert.deepEqual(cleanGarden({ pours: [{ at: 'x', drops: 3, growth: 3 }, { at: at('2026-11-05'), drops: 2, growth: 2 }], harvests: -1 }), { version: 1, pours: [{ at: at('2026-11-05'), drops: 2, growth: 2 }], harvests: 0 });
});
