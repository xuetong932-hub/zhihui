import test from 'node:test';
import assert from 'node:assert/strict';
import { stepBody, stepSpring, throwVelocity, PHYS } from '../pet-physics.js';

const box = { left: 0, right: 400, top: 0, floor: 600 };
const make = over => ({ x: 200, y: 600, vx: 0, vy: 0, w: 100, h: 100, held: false, walking: false, grounded: true, ...over });
const run = (body, seconds) => { const hits = []; for (let t = 0; t < seconds; t += 1 / 120) hits.push(...stepBody(body, 1 / 120, box)); return hits; };

test('a thrown squirrel bounces off the wall, slower each time', () => {
  const body = make({ y: 300, vx: 1500, grounded: false });
  const hits = run(body, 0.4);
  const wall = hits.find(hit => hit.side === 'right');
  assert.ok(wall, 'hits the right wall');
  assert.ok(body.vx < 0 && Math.abs(body.vx) < wall.speed, 'comes back with less speed');
  assert.ok(body.x + body.w / 2 <= box.right);
});

test('a dropped squirrel bounces on the floor and comes to rest', () => {
  const body = make({ y: 200, grounded: false });
  const hits = run(body, 4);
  assert.ok(hits.filter(hit => hit.side === 'floor').length >= 2, 'bounces more than once');
  assert.equal(body.y, box.floor);
  assert.equal(body.grounded, true);
  assert.equal(body.vy, 0);
});

test('floor friction stops a sliding squirrel, but not a walking one', () => {
  const sliding = make({ vx: 300 });
  run(sliding, 2);
  assert.equal(sliding.vx, 0);
  const walking = make({ x: 100, vx: 90, walking: true });
  run(walking, 0.5);
  assert.ok(walking.vx > 80);
});

test('a held squirrel ignores gravity', () => {
  const body = make({ y: 300, held: true, grounded: false });
  run(body, 1);
  assert.equal(body.y, 300);
});

test('the ceiling is ignored when the room is scrolled too far up to fit the squirrel', () => {
  const body = make({ y: 60, vy: -500, grounded: false });
  const low = { ...box, floor: 80 };
  const hits = [];
  for (let t = 0; t < 0.05; t += 1 / 120) hits.push(...stepBody(body, 1 / 120, low));
  assert.equal(hits.some(hit => hit.side === 'top'), false);
});

test('the jelly spring settles on its target', () => {
  const s = { p: 0, v: 8 };
  for (let i = 0; i < 240; i++) stepSpring(s, 0, 1 / 60, 420, 9);
  assert.ok(Math.abs(s.p) < 0.01 && Math.abs(s.v) < 0.1);
});

test('throw speed comes from the last samples and is capped', () => {
  assert.deepEqual(throwVelocity([{ x: 0, y: 0, t: 0 }], 10), { vx: 0, vy: 0 });
  const slow = throwVelocity([{ x: 0, y: 0, t: 0 }, { x: 10, y: 0, t: 50 }], 50);
  assert.ok(Math.abs(slow.vx - 200) < 1e-9);
  const fast = throwVelocity([{ x: 0, y: 0, t: 0 }, { x: 900, y: 0, t: 20 }], 20);
  assert.ok(Math.abs(Math.hypot(fast.vx, fast.vy) - PHYS.maxThrow) < 1e-6);
  assert.deepEqual(throwVelocity([{ x: 0, y: 0, t: 0 }, { x: 50, y: 0, t: 20 }], 500), { vx: 0, vy: 0 });
});
