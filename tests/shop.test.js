import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyShop, buy, refund, canRefund, shopState, equip, unequip, cleanShop, protectedStreak, freezeDates } from '../shop.js';

const now = new Date('2026-11-15T12:00:00');
const at = (days, hour = 12) => new Date(now.getTime() - days * 86400000 + (hour - 12) * 3600000);

test('buying spends cones, puts furniture in its place and refuses what cannot be bought', () => {
  let data = emptyShop();
  assert.deepEqual(buy(data, 'lamp', 50, { now }), { ok: false, error: 'funds' });
  const first = buy(data, 'lamp', 200, { now, id: 'a' });
  assert.ok(first.ok); data = first.data;
  assert.equal(data.equipped.floorRight, 'lamp');
  assert.equal(shopState(data, 200).balance, 110);
  assert.deepEqual(buy(data, 'lamp', 200, { now }), { ok: false, error: 'owned' });
  data = buy(data, 'desk', 400, { now, id: 'b' }).data;
  assert.equal(data.equipped.floorRight, 'desk', 'a new piece replaces the old one in that place');
  data = equip(data, 'lamp'); assert.equal(data.equipped.floorRight, 'lamp');
  data = unequip(data, 'lamp'); assert.equal(data.equipped.floorRight, undefined);
});

test('frames are put on when bought; streak shields are limited to two held', () => {
  let data = buy(emptyShop(), 'frame-vine', 100, { now, id: 'f' }).data;
  assert.equal(data.frame, 'frame-vine');
  data = buy(data, 'freeze', 500, { now, id: 's1' }).data;
  data = buy(data, 'freeze', 500, { now, id: 's2' }).data;
  assert.deepEqual(buy(data, 'freeze', 500, { now }), { ok: false, error: 'max' });
  assert.ok(buy(data, 'freeze', 500, { now, shieldsUsed: 1 }).ok, 'after one is used another can be bought');
});

test('a purchase can be returned within 24 hours, not later', () => {
  let data = buy(emptyShop(), 'rug', 200, { now: at(0.5), id: 'r' }).data;
  assert.equal(canRefund(data, data.purchases[0], { now }), true);
  const back = refund(data, 'r', { now });
  assert.ok(back.ok); assert.equal(shopState(back.data, 200).balance, 200); assert.equal(back.data.equipped.rug, undefined);
  data = buy(emptyShop(), 'rug', 200, { now: at(2), id: 'old' }).data;
  assert.equal(refund(data, 'old', { now }).ok, false);
});

test('streak shields bridge missed days only inside a streak', () => {
  const days = new Set(['2026-11-15', '2026-11-14', '2026-11-12', '2026-11-11']);
  const hit = day => days.has(day);
  assert.deepEqual(protectedStreak(hit, [], now), { streak: 2, used: 0 });
  assert.deepEqual(protectedStreak(hit, [at(5).toISOString()], now), { streak: 4, used: 1 }, 'the 13th is bridged');
  assert.deepEqual(protectedStreak(hit, [at(0).toISOString()], now), { streak: 2, used: 0 }, 'a shield bought today cannot cover an earlier day');
  assert.deepEqual(protectedStreak(() => false, [at(5).toISOString(), at(5).toISOString()], now), { streak: 0, used: 0 }, 'no streak, nothing used');
});

test('cleanShop drops anything malformed', () => {
  const data = cleanShop({ purchases: [{ id: 'x', item: 'lamp', at: now.toISOString(), price: 1 }, { id: 'y', item: 'fern', at: now.toISOString(), price: 25 }, { id: 'z', item: 'nope', at: now.toISOString(), price: 5 }], equipped: { floorRight: 'lamp', windowSill: 'fern' }, frame: 'frame-star' });
  assert.deepEqual(data.purchases.map(p => p.id), ['y']);
  assert.deepEqual(data.equipped, { windowSill: 'fern' });
  assert.equal(data.frame, null);
  assert.deepEqual(freezeDates(data), []);
});

test('a new user starts with an empty nest and no frame', async () => {
  const { decorLayer, frameImage } = await import('../shop-ui.js');
  const fresh = cleanShop(undefined);
  assert.deepEqual(fresh.equipped, {});
  assert.equal(fresh.frame, null);
  assert.doesNotMatch(decorLayer(fresh.equipped), /<img/);
  assert.equal(frameImage(fresh.frame), '');
});

test('every shop item has its picture', async () => {
  const { ITEMS } = await import('../shop.js');
  const { existsSync } = await import('node:fs');
  for (const item of ITEMS) assert.ok(existsSync(new URL(`../illustrations/shop/${item.id}.webp`, import.meta.url)), item.id);
});