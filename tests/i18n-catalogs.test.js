import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { ENABLED } from '../i18n.js';

const root = new URL('../', import.meta.url);
const source = JSON.parse(readFileSync(new URL('i18n/source.json', root), 'utf8'));
const placeholders = text => (text.match(/\{\w+\}/g) || []).sort().join();
const tags = text => (text.match(/<\/?[a-z][a-z0-9]*/gi) || []).sort().join();

test('i18n source list matches the code (run node tools/i18n-extract.mjs after changing text)', () => {
  execFileSync(process.execPath, [fileURLToPath(new URL('tools/i18n-extract.mjs', root)), '--check']);
});

test('every offered language has a catalog that covers the interface and keeps placeholders and tags', async () => {
  for (const code of ENABLED.filter(code => code !== 'zh' && code !== 'en')) {
    assert.ok(existsSync(new URL(`i18n/${code}.js`, root)), `i18n/${code}.js exists`);
    const catalog = (await import(new URL(`i18n/${code}.js`, root))).default;
    const keys = Object.keys(source), covered = keys.filter(en => typeof catalog[en] === 'string' && catalog[en].trim());
    assert.ok(covered.length / keys.length >= 0.98, `${code} covers ${covered.length}/${keys.length}`);
    for (const en of covered) {
      assert.equal(placeholders(catalog[en]), placeholders(en), `${code}: placeholders in "${en.slice(0, 40)}"`);
      assert.equal(tags(catalog[en]), tags(en), `${code}: tags in "${en.slice(0, 40)}"`);
    }
  }
});
