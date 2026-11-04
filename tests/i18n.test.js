import test from 'node:test';
import assert from 'node:assert/strict';
import { LOCALES, ENABLED, isLocale, detectLocale, translate, registerCatalog, loadCatalog, needsCatalog, intlLocale, speechLocale, isChineseLocale, localeName } from '../i18n.js';

test('i18n: ten languages, existing zh/en codes kept, only finished ones offered', () => {
  assert.deepEqual(LOCALES.map(item => item.code), ['zh', 'zh-TW', 'en', 'ja', 'ko', 'ms', 'es', 'fr', 'pt', 'de']);
  for (const code of ENABLED) assert.ok(isLocale(code));
  assert.ok(!isLocale('xx'));
  assert.equal(localeName('ja'), '日本語');
  assert.equal(intlLocale('pt'), 'pt-BR'); assert.equal(speechLocale('zh'), 'zh-CN');
  assert.ok(isChineseLocale('zh-TW') && !isChineseLocale('ja'));
});

test('i18n: first visit follows the browser language among enabled ones, else English', () => {
  const all = LOCALES.map(item => item.code);
  assert.equal(detectLocale(['zh-CN'], all), 'zh');
  assert.equal(detectLocale(['zh-TW'], all), 'zh-TW');
  assert.equal(detectLocale(['zh-Hant-HK'], all), 'zh-TW');
  assert.equal(detectLocale(['pt-PT'], all), 'pt');
  assert.equal(detectLocale(['ja-JP', 'en'], all), 'ja');
  assert.equal(detectLocale(['ru-RU'], all), 'en');
  assert.equal(detectLocale(['zh-TW'], ['zh', 'en']), 'zh', 'Traditional falls back to Simplified while it is not offered');
  assert.equal(detectLocale(['de-DE'], ['zh', 'en']), 'en');
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
