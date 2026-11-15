import test from 'node:test';
import assert from 'node:assert/strict';
import { layoutMindmap } from '../mindmap-canvas.js';

const tree = { label: 'Idea', children: [
  { label: 'A', children: [{ label: 'a1' }, { label: 'a2' }] },
  { label: 'B', children: [{ label: 'b1' }] },
  { label: 'C' },
  { label: 'D', children: [{ label: 'd1', children: [{ label: 'deep' }] }] },
] };

test('mind map layout: idea in the middle, branches split right and left, details further out', () => {
  const nodes = layoutMindmap(tree);
  assert.equal(nodes.size, 10);
  assert.deepEqual([nodes.get('').x, nodes.get('').y], [0, 0]);
  assert.ok(nodes.get('0').x > 0 && nodes.get('1').x > 0, 'first half on the right');
  assert.ok(nodes.get('2').x < 0 && nodes.get('3').x < 0, 'second half on the left');
  assert.ok(nodes.get('0.0').x > nodes.get('0').x, 'details further out than their branch');
  assert.ok(nodes.get('3.0.0').x < nodes.get('3.0').x, 'left side grows to the left');
  assert.equal(nodes.get('0.1').parent, '0');
  assert.equal(nodes.get('0.1').color, nodes.get('0').color, 'details share their branch colour');
});

test('rows do not overlap within a side', () => {
  const nodes = layoutMindmap(tree), right = [...nodes.entries()].filter(([path, n]) => n.side === 1 && n.depth === 2).map(([, n]) => n.y).sort((a, b) => a - b);
  for (let i = 1; i < right.length; i++) assert.ok(right[i] - right[i - 1] >= 40);
});
