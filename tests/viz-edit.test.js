import test from 'node:test';
import assert from 'node:assert/strict';
import { editTree, nodeAt, validTree, treeMarkdown, safeFileName, parsePath } from '../viz-edit.js';
import { mindmapSvg } from '../mindmap.js';

const tree = { label: '闭包', children: [{ label: '要点', children: [{ label: 'A' }, { label: 'B' }] }, { label: '例子', children: [{ label: '计数器' }] }] };

test('mind map edits return a new tree and never change the original', () => {
  assert.deepEqual(parsePath(''), []); assert.deepEqual(parsePath('1.0'), [1, 0]);
  assert.equal(nodeAt(tree, '0.1').label, 'B');
  const renamed = editTree(tree, { op: 'rename', path: '0.1', label: '  新的  要点 ' });
  assert.equal(nodeAt(renamed, '0.1').label, '新的 要点'); assert.equal(nodeAt(tree, '0.1').label, 'B');
  assert.equal(editTree(tree, { op: 'rename', path: '0', label: '   ' }), null, 'empty text is refused');
  const added = editTree(tree, { op: 'add', path: '1', label: '' });
  assert.equal(nodeAt(added, '1.1').label, '新节点');
  const removed = editTree(tree, { op: 'delete', path: '1.0' });
  assert.equal(nodeAt(removed, '1').children, undefined, 'an emptied branch drops its children list');
  assert.equal(editTree(tree, { op: 'delete', path: '' }), null, 'the root cannot be deleted');
  assert.equal(editTree(tree, { op: 'rename', path: '5', label: 'x' }), null);
  let deep = tree; for (let i = 0; i < 3; i++) deep = editTree(deep, { op: 'add', path: i === 0 ? '0.0' : `0.0${'.0'.repeat(i)}`, label: 'x' }) || deep;
  assert.equal(validTree(deep), true);
  assert.equal(editTree(deep, { op: 'add', path: '0.0.0.0', label: 'too deep' }), null, 'at most four levels below the root');
});

test('mind map validation, markdown outline and file names', () => {
  assert.equal(validTree(tree), true);
  assert.equal(validTree({ label: 'x', children: 'no' }), false);
  assert.equal(validTree({ label: 'x'.repeat(201) }), false);
  assert.equal(treeMarkdown(tree), '# 闭包\n\n## 要点\n- A\n- B\n\n## 例子\n- 计数器\n');
  assert.equal(safeFileName('知回 / 思维导图: 闭包?'), '知回-思维导图-闭包');
  assert.equal(safeFileName(''), 'knowledge-review');
});

test('mind map drawing marks paths, selection and the zoomed branch', () => {
  const overview = mindmapSvg(tree, new Set(), { selected: '0.1' });
  assert.match(overview, /data-path="0\.1"/); assert.match(overview, /mm-leaf mm-selected" data-path="0\.1"/);
  const zoomed = mindmapSvg(tree, new Set(), { focus: 1 });
  assert.match(zoomed, /mm-root" data-path="1"/); assert.match(zoomed, /data-path="1\.0"/); assert.doesNotMatch(zoomed, /data-path="0"/);
});
