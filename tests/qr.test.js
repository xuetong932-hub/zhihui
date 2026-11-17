import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { qrMatrix } from '../qr.js';
// jsQR is a plain browser script (it sets self.jsQR); run it the same way here.
const sandbox = { self: {} };
vm.runInNewContext(readFileSync(new URL('../vendor/jsQR.js', import.meta.url), 'utf8'), sandbox);
const jsQR = sandbox.self.jsQR;

// Draw the matrix (4-module quiet zone, `scale` px per module) and read it back with jsQR.
function decode(text, { hole = 0, scale = 6 } = {}) {
  const { size, modules } = qrMatrix(text), total = (size + 8) * scale, data = new Uint8ClampedArray(total * total * 4).fill(255), centre = size / 2;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const inHole = hole && Math.abs(x + .5 - centre) < hole / 2 && Math.abs(y + .5 - centre) < hole / 2;
    if (!modules[y][x] || inHole) continue;
    for (let dy = 0; dy < scale; dy++) for (let dx = 0; dx < scale; dx++) { const i = (((y + 4) * scale + dy) * total + (x + 4) * scale + dx) * 4; data[i] = data[i + 1] = data[i + 2] = 0; }
  }
  return jsQR(data, total, total)?.data;
}

test('qr: codes of many lengths read back exactly', () => {
  for (const text of ['A', 'KB-7Q4M2X', 'https://zhihui.onrender.com/add/KB-7Q4M2X', '知回 · 小回', 'x'.repeat(60), 'y'.repeat(150)]) assert.equal(decode(text), text, text.slice(0, 20));
});
test('qr: the friend link still reads with 小回 covering the middle', () => {
  const link = 'https://zhihui.onrender.com/add/KB-7Q4M2X', { size } = qrMatrix(link);
  assert.ok(size <= 33, 'the link fits version 4 or lower');
  assert.equal(decode(link, { hole: 7 }), link);
});
test('qr: too long text is refused', () => assert.throws(() => qrMatrix('z'.repeat(400)), /qr-too-long/));
