import test from 'node:test';
import assert from 'node:assert/strict';
import { memoryPoints, moduleCurves, moduleStyles, retention, stability, curveSvg, graphSvg, graphEdges, legend } from '../memory-viz.js';
import { buildDocx, crc32 } from '../docx.js';
import { uploadAsGoogleDoc } from '../google-docs.js';
import { emptyReviews, recordReview } from '../review-store.js';

const card = (id, extra = {}) => ({ id, title: `卡片 ${id}`, module: 'coding', category: '函数', status: 'active', extraction: 'ready', createdAt: '2026-10-25T09:00:00Z', origins: [{}], summary: 's', example: '', ...extra });
const labels = { locale: 'zh-CN', x: '日期', y: '保持率', today: '今天', todayDue: '今天复习', graph: 'g', filled: '实心', hollow: '空心', dueCount: n => `今天 ${n} 个`, rating: r => r || '未复习' };
const name = id => ({ coding: '编程', english: '英语' })[id];

test('points: today’s batch is filled on today; later reviews are hollow on their date; module curves average retention', () => {
  const data = emptyReviews(), now = new Date('2026-11-01T12:00:00');
  recordReview(data, 'later', { answer: 'a', correct: true, explanation: 'e', rating: 'mastered' }, new Date('2026-10-31T12:00:00'));
  const points = memoryPoints([card('due'), card('later'), card('paused', { status: 'paused' })], data, new Set(['due']), now);
  const byId = Object.fromEntries(points.map(p => [p.id, p]));
  assert.deepEqual(Object.keys(byId).sort(), ['due', 'later'], 'paused cards are left out');
  assert.equal(byId.due.today, true); assert.equal(byId.due.offset, 0);
  assert.equal(byId.later.today, false); assert.equal(byId.later.offset, 2, 'mastered yesterday with a 3-day interval: due in two days');
  const curve = moduleCurves([card('due'), card('later')], data, now).get('coding');
  assert.ok(curve.length > 20 && curve.every(p => p.retention >= 0 && p.retention <= 100));
  assert.ok(curve.find(p => p.offset === -1).retention > curve.find(p => p.offset === -1.5).retention, 'the curve rises at yesterday’s review');
  assert.equal(retention(3, 3), 90, 'about 90% when a card falls due'); assert.ok(retention(10, 1) < retention(10, 7));
  assert.equal(stability(null), 1); assert.equal(stability({ rating: 'wrong', interval: 0 }), 0.5);
});

test('colour and shape identify the module; filled means today; details are escaped data for the hover card', () => {
  const now = new Date('2026-11-01T12:00:00'), cards = [card('a', { title: '<script>x</script>' }), card('b'), card('c', { module: 'english', category: '' })];
  const points = memoryPoints(cards, emptyReviews(), new Set(['a']), now), styles = moduleStyles(['coding', 'english']);
  assert.notDeepEqual(styles.get('coding'), styles.get('english'));
  const curve = curveSvg(points, moduleCurves(cards, emptyReviews(), now), styles, name, labels, now);
  assert.match(curve, new RegExp(`fill="${styles.get('coding').color}"`), 'today’s point is filled with its module colour');
  assert.match(curve, /fill="#fff" stroke="#[0-9a-f]{6}" stroke-width="2"/, 'later points are hollow');
  assert.ok(!curve.includes('<script>')); assert.match(curve, /data-tip="[^"]*&lt;script&gt;/);
  assert.equal(graphEdges(points).length, 1, 'cards sharing a category in one module are linked');
  assert.match(graphSvg(points, styles, name, labels), /编程/);
  const key = legend(styles, name, points, labels);
  for (const text of ['编程 · 今天 1 个', '英语 · 今天 0 个', '实心', '空心']) assert.ok(key.includes(text), text);
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

import { keyPoints, buildMindmap, mindmapSvg } from '../mindmap.js';
import { relateKnowledge, expandMindmap } from '../knowledge-service.mjs';
import { defaultConfig } from '../providers.js';
const qwen = content => async () => Response.json({ output: { choices: [{ message: { content: JSON.stringify(content) }, finish_reason: 'stop' }] } });
const base = { config: defaultConfig(), apiKey: 'test-only-not-real', consent: true, module: 'coding', level: 'beginner', locale: 'zh' };

test('mind map branches come from the card, model branches are marked, and labels are escaped', () => {
  assert.deepEqual(keyPoints('第一点。第二点！\n- 第三点'), ['第一点。', '第二点！', '第三点']);
  const labels = { locale: 'zh-CN', points: '要点', example: '例子', belongs: '归属', related: '相关', questions: '提问', history: '复习', rating: r => r, ai: { prerequisites: '前置', subconcepts: '子概念', misconceptions: '误区', applications: '应用' } };
  const tree = buildMindmap(card('m', { title: '<b>闭包</b>', summary: '函数记住外部变量。常用于回调。', example: '背包', origins: [{ question: '什么是闭包？' }] }), { moduleName: () => '编程', related: ['作用域'], events: [], expansion: { prerequisites: ['函数'] }, labels });
  assert.deepEqual(tree.children.map(b => b.label), ['要点', '例子', '归属', '相关', '提问', '✦ 前置']);
  const svg = mindmapSvg(tree, new Set([0]));
  assert.ok(!svg.includes('<b>')); assert.match(svg, /\(\+2\)/, 'a collapsed branch shows how many items it hides');
});

test('model relations keep only links between known, different ideas; mind map expansion is trimmed', async () => {
  const cards = [{ id: 'a', title: '闭包' }, { id: 'b', title: '作用域' }];
  const { relations } = await relateKnowledge({ ...base, cards }, { fetchImpl: qwen({ relations: [{ a: 'a', b: 'b', label: '前置知识<script>' }, { a: 'b', b: 'a', label: '重复' }, { a: 'a', b: 'x', label: '未知' }, { a: 'a', b: 'a', label: '自己' }] }) });
  assert.deepEqual(relations, [{ a: 'a', b: 'b', label: '前置知识script' }]);
  await assert.rejects(relateKnowledge({ ...base, cards: cards.slice(0, 1) }), error => error.code === 'request');
  const branches = await expandMindmap({ ...base, card: { title: '闭包', summary: 's', example: '' } }, { fetchImpl: qwen({ prerequisites: ['函数', 3, ''], subconcepts: Array(8).fill('x'), misconceptions: [], applications: ['回调'] }) });
  assert.deepEqual(branches, { prerequisites: ['函数'], subconcepts: ['x', 'x', 'x', 'x', 'x'], misconceptions: [], applications: ['回调'] });
});
