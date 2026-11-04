import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultRegion, recommendKeywords, SOURCES } from '../discover-ui.js';
import { CURATED, curatedItems } from '../recommend-data.js';

test('curated picks: every built-in module has creators, books and papers in both regions, all with real links', () => {
  for (const moduleId of ['coding', 'english', 'work', 'life']) {
    for (const region of ['cn', 'global']) {
      for (const kind of ['creators', 'books', 'papers']) {
        const items = curatedItems(moduleId, kind, region);
        assert.ok(items.length >= 2, `${moduleId}/${kind}/${region}`);
        for (const item of items) {
          assert.match(item.url, /^https?:\/\/[a-z0-9.-]+\.[a-z]{2,}\//, item.name);
          assert.ok(item.name && item.zh && item.en, item.name);
        }
      }
    }
  }
  assert.ok(curatedItems('life', 'papers', 'cn').some(item => item.region === 'cn') && !curatedItems('life', 'papers', 'cn').some(item => item.region === 'global'), 'region-only papers stay in their region');
  assert.deepEqual(curatedItems('my-custom-module', 'books', 'cn'), [], 'custom modules have no picks');
  assert.deepEqual(Object.keys(CURATED).sort(), ['coding', 'english', 'life', 'work']);
});

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
