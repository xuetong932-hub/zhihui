import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SOUNDS, sfx, sfxOn, setSfx } from '../sfx.js';

test('sound effects: every sound the app asks for exists, the switch is remembered, no audio API means silence', () => {
  const code = ['app.js', 'pet-physics.js', 'badges-ui.js'].map(file => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8')).join('\n');
  const asked = [...code.matchAll(/sfx\('([a-z]+)'/g)].map(m => m[1]);
  for (const name of [...asked, 'wave', 'cheer', 'think', 'shy', 'stash', 'sleep']) assert.ok(SOUNDS[name], name);
  const store = new Map();
  globalThis.localStorage = { getItem: k => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) };
  assert.equal(sfxOn(), true, 'on by default');
  setSfx(false); assert.equal(sfxOn(), false);
  setSfx(true); assert.doesNotThrow(() => sfx('tap'), 'Node has no AudioContext: it just stays quiet');
  delete globalThis.localStorage;
});
