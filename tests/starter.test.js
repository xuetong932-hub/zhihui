import test from 'node:test';
import assert from 'node:assert/strict';
import { starterQuestions, starterCards, hasStarterPack, isStarterCard, starterPackPanel } from '../starter-content.js';
import { validCard } from '../knowledge-store.js';
import { LEGACY_PRESETS as PRESET_MODULES, LEVELS } from '../modules.js';
import { registerCatalog } from '../i18n.js';

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

test('starter content follows the interface language; English example sentences stay in English', () => {
  registerCatalog('fr', { 'Present perfect': 'Present perfect (FR)', 'What is scope?': 'Qu’est-ce que la portée ?', 'Where should I start learning {name}?': 'Par où commencer en {name} ?' });
  const fr = starterCards('english', 'fr');
  assert.equal(fr[2].title, 'Present perfect (FR)');
  assert.equal(fr[2].example, 'I have lost my key. (I still can’t find it.)', 'examples are not translated');
  assert.equal(starterCards('english', 'zh-TW')[2].example, 'I have lost my key.（鑰匙現在還沒找到）');
  assert.equal(starterCards('english', 'zh')[0].example, 'She drinks coffee every morning.');
  assert.equal(starterQuestions('coding', 'some', 'fr')[0], 'Qu’est-ce que la portée ?');
  assert.equal(starterQuestions('c-chess', 'beginner', 'fr', 'échecs')[1], 'Par où commencer en échecs ?');
});

test('the one place to ask suggests a question from each original subject', async () => {
  const { ASK_MODULE } = await import('../modules.js');
  const list = starterQuestions(ASK_MODULE, 'beginner', 'zh');
  assert.equal(list.length, 4);
  assert.deepEqual(list, PRESET_MODULES.map(id => starterQuestions(id, 'beginner', 'zh')[0]));
  assert.equal(hasStarterPack(ASK_MODULE), false);
});

test('starter cards follow the interface language unless the user edited them', async () => {
  const { starterCards, localizeStarter } = await import('../starter-content.js');
  const card = starterCards('coding', 'zh')[0];
  assert.equal(localizeStarter(card, 'en').title, starterCards('coding', 'en')[0].title);
  assert.equal(localizeStarter({ ...card, title: '我的变量' }, 'en').title, '我的变量', 'an edited field stays');
  assert.equal(localizeStarter({ id: 'card-1', title: '变量' }, 'en').title, '变量', 'other cards are untouched');
});
