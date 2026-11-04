import test from 'node:test';
import assert from 'node:assert/strict';
import { LOCALES, ENABLED, isLocale, savedLocale, saveLocale, translate, registerCatalog, loadCatalog, needsCatalog, intlLocale, speechLocale, isChineseLocale, localeName } from '../i18n.js';

test('i18n: ten languages, existing zh/en codes kept, only finished ones offered', () => {
  assert.deepEqual(LOCALES.map(item => item.code), ['zh', 'zh-TW', 'en', 'ja', 'ko', 'ms', 'es', 'fr', 'pt', 'de']);
  for (const code of ENABLED) assert.ok(isLocale(code));
  assert.ok(!isLocale('xx'));
  assert.equal(localeName('ja'), '日本語');
  assert.equal(intlLocale('pt'), 'pt-BR'); assert.equal(speechLocale('zh'), 'zh-CN');
  assert.ok(isChineseLocale('zh-TW') && !isChineseLocale('ja'));
});

test('i18n: no language until the user chooses one; the choice is remembered on this device', () => {
  const store = new Map();
  globalThis.localStorage = { getItem: key => store.get(key) ?? null, setItem: (key, value) => store.set(key, String(value)) };
  try {
    assert.equal(savedLocale(), null, 'first open: nothing chosen, so the app shows the language page in English');
    saveLocale('ja');
    assert.equal(savedLocale(), 'ja');
    saveLocale('xx');
    assert.equal(savedLocale(), 'ja', 'unknown codes are ignored');
    store.set('knowledge-review.locale.v1', 'tampered');
    assert.equal(savedLocale(), null, 'an invalid stored value counts as not chosen');
  } finally { delete globalThis.localStorage; }
});

test('i18n: catalogs are keyed by the English text, missing entries fall back to English, placeholders fill everywhere', () => {
  registerCatalog('de', { 'Review': 'Wiederholen', '{n} cards due': '{n} Karten fällig' });
  assert.equal(translate('复习', 'Review', undefined, 'zh'), '复习');
  assert.equal(translate('复习', 'Review', undefined, 'en'), 'Review');
  assert.equal(translate('复习', 'Review', undefined, 'de'), 'Wiederholen');
  assert.equal(translate('知识库', 'Library', undefined, 'de'), 'Library', 'missing → English');
  assert.equal(translate('{n} 张待复习', '{n} cards due', { n: 3 }, 'de'), '3 Karten fällig');
  assert.equal(translate('{n} 张待复习', '{n} cards due', { n: 3 }, 'zh'), '3 张待复习');
  assert.equal(translate('保留 {x}', 'Keep {x}', {}, 'en'), 'Keep {x}', 'unknown placeholders stay as written');
});

test('i18n: a saved language loads its catalog once, so a reload keeps that language', async () => {
  assert.equal(needsCatalog('zh'), false);
  assert.equal(needsCatalog('en'), false);
  assert.equal(needsCatalog('fr'), true, 'French needs its catalog before the first render');
  await loadCatalog('fr');
  assert.equal(needsCatalog('fr'), false);
  assert.notEqual(translate('开始复习', 'Start review', undefined, 'fr'), 'Start review');
});
