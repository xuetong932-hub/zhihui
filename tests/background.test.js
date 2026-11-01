import test from 'node:test';
import assert from 'node:assert/strict';
import { loadBackground, validBackground, DEFAULT_BACKGROUND, PRESET_BACKGROUNDS } from '../background.js';

test('background settings: valid choices load, anything else falls back to no background', () => {
  assert.deepEqual(loadBackground(null), DEFAULT_BACKGROUND);
  assert.deepEqual(loadBackground('not json'), DEFAULT_BACKGROUND);
  const preset = { choice: `preset:${PRESET_BACKGROUNDS[0].id}`, opacity: 40, blur: 6, fit: 'contain', position: 'right top' };
  assert.deepEqual(loadBackground(JSON.stringify(preset)), preset);
  assert.deepEqual(loadBackground(JSON.stringify({ choice: 'custom', opacity: 80, blur: 2 })), { choice: 'custom', opacity: 80, blur: 2, fit: 'cover', position: 'center' }, 'older settings gain the default fit and position');
  const base = { ...DEFAULT_BACKGROUND };
  assert.equal(validBackground({ ...base, choice: 'preset:../../etc' }), false, 'only listed presets');
  assert.equal(validBackground({ ...base, opacity: 5 }), false, 'opacity has a floor');
  assert.equal(validBackground({ ...base, blur: 30 }), false);
  assert.equal(validBackground({ ...base, opacity: 60.5 }), false);
  assert.equal(validBackground({ ...base, fit: 'stretch' }), false);
  assert.equal(validBackground({ ...base, position: 'url(x)' }), false, 'position goes into CSS, so only listed values');
});
