import test from 'node:test';
import assert from 'node:assert/strict';
import { memoryPoints, retention, stability, curveSvg, graphSvg, graphEdges, legend } from '../memory-viz.js';
import { buildDocx, crc32 } from '../docx.js';
import { uploadAsGoogleDoc } from '../google-docs.js';
import { emptyReviews, recordReview } from '../review-store.js';

const card = (id, extra = {}) => ({ id, title: `卡片 ${id}`, module: 'coding', category: '函数', status: 'active', extraction: 'ready', createdAt: '2026-10-25T09:00:00Z', origins: [{}], summary: 's', example: '', ...extra });
const labels = { due: '今天复习', weak: '薄弱', stable: '已掌握', new: '新学', x: 'x', y: 'y', graph: 'g', curve: s => `S${s}` };

test('memory points classify today’s due, weak, stable and new cards with an estimated retention', () => {
  const data = emptyReviews(), now = new Date('2026-11-01T12:00:00Z');
  recordReview(data, 'weak', { answer: 'a', correct: false, explanation: 'e', rating: 'wrong' }, new Date('2026-10-31T12:00:00Z'));
  recordReview(data, 'stable', { answer: 'a', correct: true, explanation: 'e', rating: 'mastered' }, new Date('2026-10-30T12:00:00Z'));
  recordReview(data, 'due', { answer: 'a', correct: true, explanation: 'e', rating: 'understood' }, new Date('2026-10-30T12:00:00Z'));
  const points = memoryPoints([card('weak'), card('stable'), card('due'), card('new'), card('paused', { status: 'paused' })], data, new Set(['due']), now);
  assert.deepEqual(Object.fromEntries(points.map(p => [p.id, p.kind])), { weak: 'weak', stable: 'stable', due: 'due', new: 'new' }, 'paused cards are left out; due wins over other states');
  assert.equal(retention(0, 3), 100); assert.equal(retention(3, 3), 90, 'about 90% when a card falls due');
  assert.ok(retention(10, 1) < retention(10, 7), 'higher stability forgets more slowly');
  assert.equal(stability(null), 1); assert.equal(stability({ rating: 'wrong', interval: 0 }), 0.5);
});

test('the curve and graph mark each state with its own shape and colour, with escaped titles and a legend', () => {
  const points = memoryPoints([card('a', { title: '<script>x</script>' }), card('b'), card('c', { module: 'english', category: '' })], emptyReviews(), new Set(['a']), new Date('2026-11-01T12:00:00Z'));
  const curve = curveSvg(points, labels);
  assert.match(curve, /<circle[^>]+#c0392b/); assert.match(curve, /<polygon[^>]+#2f6fb0/);
  assert.ok(!curve.includes('<script>')); assert.match(curve, /&lt;script&gt;/);
  assert.equal(graphEdges(points).length, 1, 'cards sharing a category in one module are linked');
  assert.match(graphSvg(points, id => id === 'coding' ? '编程' : '英语', labels), /编程/);
  const key = legend(labels);
  for (const name of ['今天复习', '薄弱', '已掌握', '新学']) assert.ok(key.includes(name));
});

test('Word export is a valid stored ZIP with the document parts and escaped text', () => {
  const bytes = buildDocx([{ style: 'Title', text: '知回' }, { style: 'Heading2', text: 'A & B <c>' }, { style: 'Normal', text: '第一行\n第二行' }]);
  assert.deepEqual([...bytes.slice(0, 4)], [0x50, 0x4b, 0x03, 0x04], 'starts with a ZIP local header');
  const text = new TextDecoder().decode(bytes);
  for (const part of ['[Content_Types].xml', '_rels/.rels', 'word/document.xml', 'word/styles.xml', 'word/_rels/document.xml.rels']) assert.ok(text.includes(part), part);
  assert.ok(text.includes('A &amp; B &lt;c&gt;')); assert.ok(text.includes('<w:br/>')); assert.ok(text.includes('w:eastAsia="Microsoft YaHei"'));
  const end = bytes.length - 22; assert.deepEqual([...bytes.slice(end, end + 4)], [0x50, 0x4b, 0x05, 0x06], 'ends with the central directory record');
  assert.equal(bytes[end + 10], 6, 'six files');
  assert.equal(crc32(new TextEncoder().encode('123456789')), 0xcbf43926, 'standard CRC-32 check value');
});

test('Google upload asks Drive to convert the Word file into a Google Doc and returns its link', async () => {
  let request;
  const link = await uploadAsGoogleDoc('test-token', '知回', new Uint8Array([1, 2, 3]), async (url, options) => { request = { url, options }; return Response.json({ id: 'abcdefghij123' }); });
  assert.equal(link, 'https://docs.google.com/document/d/abcdefghij123/edit');
  assert.match(request.url, /upload\/drive\/v3\/files\?uploadType=multipart/);
  assert.equal(request.options.headers.Authorization, 'Bearer test-token');
  assert.match(await request.options.body.text(), /"mimeType":"application\/vnd.google-apps.document"/);
  await assert.rejects(uploadAsGoogleDoc('t', 'n', new Uint8Array(), async () => new Response('{}', { status: 403 })), error => error.code === 'http-403');
});
