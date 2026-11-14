import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { SCENES, SCENE_CATEGORIES, sceneById, sceneImage, sceneThumb } from '../scenes.js';

const file = path => new URL(`..${path}`, import.meta.url);

test('every scene picture and thumbnail exists, in a known category', () => {
  const cats = new Set(SCENE_CATEGORIES.map(([id]) => id));
  for (const scene of SCENES) {
    assert.ok(cats.has(scene.cat), scene.id);
    for (const dark of [false, true]) {
      assert.ok(existsSync(file(sceneImage(scene, dark).src)), `${scene.id} ${dark}`);
      assert.ok(existsSync(file(sceneThumb(scene, dark))), `${scene.id} thumb ${dark}`);
    }
  }
});

test('night mode uses the night picture when there is one; unknown ids fall back to the desk', () => {
  assert.deepEqual(sceneImage(sceneById('fresh'), true), { src: '/scenes/fresh-night.webp', own: true });
  assert.deepEqual(sceneImage(sceneById('lake'), true), { src: '/scenes/lake.webp', own: false });
  assert.equal(sceneById('nope').id, 'desk');
});
