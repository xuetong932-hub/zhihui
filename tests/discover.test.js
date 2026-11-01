import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultRegion, recommendKeywords, SOURCES } from '../discover-ui.js';

test('recommendations: region, keywords from recent cards and real search links', () => {
  assert.equal(defaultRegion('CN', 'en'), 'cn');
  assert.equal(defaultRegion('US', 'zh'), 'global', 'the account region wins over the UI language');
  assert.equal(defaultRegion('', 'zh'), 'cn');
  assert.equal(defaultRegion(undefined, 'en'), 'global');
  const card = (title, createdAt, status = 'active') => ({ title, createdAt, status });
  const cards = [card('旧主题', '2026-10-01T00:00:00Z'), card('新主题', '2026-11-01T00:00:00Z'), card('已删除', '2026-11-02T00:00:00Z', 'deleted'), card('新主题', '2026-10-20T00:00:00Z')];
  assert.deepEqual(recommendKeywords(cards, ['编程']), ['新主题', '旧主题'], 'newest first, unique, active only');
  assert.deepEqual(recommendKeywords([], ['编程', '英语']), ['编程', '英语'], 'falls back to module names');
  const url = SOURCES.cn.creators[0].url('C++ & 闭包');
  assert.ok(url.startsWith('https://search.bilibili.com/') && url.includes('C%2B%2B%20%26%20'), 'keywords are URL-encoded');
  for (const region of Object.values(SOURCES)) for (const list of Object.values(region)) for (const source of list) assert.match(source.url('x'), /^https:\/\//);
});
