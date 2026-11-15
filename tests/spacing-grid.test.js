// Spacing grid (DESIGN.md): margins, paddings and gaps use 4px steps up to 16px and 8px steps above
// (4 8 12 16 24 32 48 ...), written as var(--sp-N) tokens for the common steps.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const onGrid = v => v === 0 || (v <= 16 ? v % 4 === 0 : v % 8 === 0);
// Geometry, not spacing: the ring buttons are 72px circles centred on their anchor with a negative half-size margin.
const EXCEPTIONS = ['margin:-36px 0 0 -36px'];

for (const file of ['styles.css', 'mobile/mobile.css']) {
  test(`${file}: every margin, padding and gap is on the spacing grid`, () => {
    const css = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
    const off = [];
    for (const [, prop, value] of css.matchAll(/(?:^|[{;\s])((?:margin|padding|gap|row-gap|column-gap)(?:-[a-z-]+)?)\s*:\s*([^;}]+)/g)) {
      if (EXCEPTIONS.includes(`${prop}:${value.trim()}`)) continue;
      for (const [, num] of value.matchAll(/-?(\d*\.?\d+)px/g)) if (!onGrid(Number(num))) off.push(`${prop}:${value.trim()}`);
    }
    assert.deepEqual(off, []);
  });
}

test('spacing tokens are defined once, on the grid', () => {
  const css = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
  for (const n of [4, 8, 12, 16, 24, 32, 48]) assert.match(css, new RegExp(`--sp-${n}:${n}px`));
});

// Type floor (DESIGN.md, 2026-11-15): no text smaller than 12px, and the token layer defines the scale, radii,
// shadows and motion that new components use.
for (const file of ['styles.css', 'mobile/mobile.css', 'welcome/welcome.css']) {
  test(`${file}: no font size below 12px`, () => {
    const css = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
    const small = [...css.matchAll(/font-size\s*:\s*(\d*\.?\d+)px/g)].map(match => Number(match[1])).filter(size => size < 12);
    assert.deepEqual(small, []);
  });
}
test('design tokens are defined at the top level', () => {
  const css = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
  const root = css.match(/^:root\{--fs-12:[^}]*\}/m)?.[0] || '';
  for (const token of ['--fs-12:12px', '--fs-34:34px', '--r-pill:999px', '--shadow-1:', '--ease-spring:', '--dur-2:250ms']) assert.ok(root.includes(token), token);
});
