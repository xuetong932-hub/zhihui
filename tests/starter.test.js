import test from 'node:test';
import assert from 'node:assert/strict';
import { starterQuestions, starterCards, hasStarterPack, isStarterCard, starterPackPanel } from '../starter-content.js';
import { validCard } from '../knowledge-store.js';
import { PRESET_MODULES, LEVELS } from '../modules.js';

test('starter questions: four per built-in module and level in each language; custom modules use their name', () => {
  for (const locale of ['zh', 'en']) for (const module of PRESET_MODULES) for (const level of LEVELS) {
    const list = starterQuestions(module, level, locale);
    assert.equal(list.length, 4, `${locale} ${module} ${level}`);
    assert.equal(new Set(list).size, 4);
    if (locale === 'en') assert.ok(list.every(q => !/[一-鿿]/.test(q)), 'English questions contain no Chinese');
  }
  assert.ok(starterQuestions('c-history1', 'beginner', 'zh', '历史').every(q => q.includes('历史')));
  assert.ok(starterQuestions('c-history1', 'some', 'en', 'History').every(q => q.includes('History')));
});

test('starter cards: six valid cards per built-in module, stable ids, nothing for custom modules', () => {
  const now = new Date('2026-11-02T08:00:00Z');
  for (const locale of ['zh', 'en']) for (const module of PRESET_MODULES) {
    const cards = starterCards(module, locale, now);
    assert.equal(cards.length, 6);
    assert.ok(cards.every(card => validCard(card) && isStarterCard(card) && card.module === module), `${locale} ${module}`);
    if (locale === 'en') assert.ok(cards.every(card => !/[一-鿿]/.test(card.title + card.summary + card.example)), 'English cards contain no Chinese');
  }
  assert.deepEqual(starterCards('coding', 'zh').map(c => c.id), starterCards('coding', 'en').map(c => c.id), 'same ids in both languages, so a pack is added once');
  assert.equal(hasStarterPack('c-history1'), false);
  assert.deepEqual(starterCards('c-history1', 'zh'), []);
  assert.equal(starterPackPanel({ modules: [], locale: 'zh' }), '');
  assert.match(starterPackPanel({ modules: [{ id: 'coding', name: '<编程>' }], locale: 'zh' }), /&#60;编程&#62;/, 'module names are escaped');
});
