import test from 'node:test';
import assert from 'node:assert/strict';
import { memoryStatus } from '../memory-viz.js';

const now = new Date('2026-11-15T12:00:00');
const card = (id, daysAgo) => ({ id, title: id, module: 'coding', status: 'active', extraction: 'ready', createdAt: new Date(now - daysAgo * 86400000).toISOString(), origins: [] });

test('memory status puts every active card in a band and counts the next 7 days', () => {
  const cards = [card('new', 0), card('old', 30), { ...card('paused', 1), status: 'paused' }];
  const status = memoryStatus(cards, { events: [] }, new Set(['old']), now);
  assert.equal(status.total, 2);
  assert.equal(Object.values(status.bands).flat().length, 2);
  assert.ok(status.bands.strong.some(item => item.id === 'new'), 'a card made just now is strongly remembered');
  assert.ok(!status.bands.strong.some(item => item.id === 'old'), 'a never-reviewed month-old card has faded');
  assert.equal(status.days.length, 7);
  assert.equal(status.days[0].count, 1, 'today counts the due card');
  assert.equal(status.days[0].day, '2026-11-15');
});

test('bands are ordered weakest first', () => {
  const status = memoryStatus([card('a', 40), card('b', 60)], { events: [] }, new Set(), now);
  const all = Object.values(status.bands).flat();
  for (const list of Object.values(status.bands)) for (let i = 1; i < list.length; i++) assert.ok(list[i - 1].retention <= list[i].retention);
  assert.equal(all.length, 2);
});
