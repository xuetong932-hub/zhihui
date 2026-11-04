// Lists every interface string as { English: 中文 } so translators (and tests) know what each catalog must cover.
// Sources: pick/tr/text/translate calls with two string literals, zh/en property pairs ({ zh: '…', en: '…' }),
// ['中文', 'English'] array pairs, and the keyed zh/en dictionaries in app.js and chat-ui.js.
// Usage: node tools/i18n-extract.mjs            → writes i18n/source.json
//        node tools/i18n-extract.mjs --check    → exits 1 if source.json is out of date
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('..', import.meta.url));
const FILES = [...readdirSync(root).filter(name => /\.(js|mjs)$/.test(name) && !['sw.js', 'i18n.js'].includes(name)), 'welcome/welcome.js'];

// A JS string literal ('…', "…" or `…` without ${}) starting at i → { value, end } or null.
function literal(src, i) {
  while (/\s/.test(src[i])) i++;
  const q = src[i]; if (!['\'', '"', '`'].includes(q)) return null;
  let value = '';
  for (let j = i + 1; j < src.length; j++) {
    const c = src[j];
    if (c === '\\') { const next = src[j + 1]; value += next === 'n' ? '\n' : next; j++; continue; }
    if (q === '`' && c === '$' && src[j + 1] === '{') return null;
    if (c === q) return { value, end: j + 1 };
    value += c;
  }
  return null;
}
const pairs = new Map();
// Code fragments caught by the pair patterns (e.g. ",\n    docs: ") are not interface text.
const add = (zh, en, where) => { if (!en || !zh || !/[㐀-鿿]/.test(zh) || !/[A-Za-z]/.test(en) || /^\s*[,;:]/.test(en) || /^[\s,]*\w+:\s*$/.test(en)) return; if (!pairs.has(en)) pairs.set(en, { zh, where }); };
for (const file of FILES) {
  const src = readFileSync(root + file, 'utf8');
  for (const m of src.matchAll(/\b(pick|tr|text|translate)\(/g)) {
    const a = literal(src, m.index + m[0].length); if (!a) continue;
    let k = a.end; while (/\s/.test(src[k])) k++; if (src[k] !== ',') continue;
    const b = literal(src, k + 1); if (!b) continue;
    add(a.value, b.value, file);
  }
  for (const m of src.matchAll(/\bzh:\s*/g)) {
    const a = literal(src, m.index + m[0].length); if (!a) continue;
    const rest = /^\s*,\s*en:\s*/.exec(src.slice(a.end)); if (!rest) continue;
    const b = literal(src, a.end + rest[0].length); if (b) add(a.value, b.value, file);
  }
  for (const m of src.matchAll(/\[\s*(?=['"`])/g)) {
    const a = literal(src, m.index + m[0].length); if (!a || !/[㐀-鿿]/.test(a.value)) continue;
    let k = a.end; while (/\s/.test(src[k])) k++; if (src[k] !== ',') continue;
    // The English half may name the product 知回 but contains no other Chinese.
    const b = literal(src, k + 1); if (!b || /[㐀-鿿]/.test(b.value.replaceAll('知回', ''))) continue;
    let e = b.end; while (/\s/.test(src[e])) e++; if (src[e] === ']') add(a.value, b.value, file);
  }
}
// Keyed dictionaries: const words/copy = { zh: { key: '…' }, en: { key: '…' } }.
for (const [file, name] of [['app.js', 'words'], ['chat-ui.js', 'copy'], ['modules.js', 'PRESET_NAMES'], ['background.js', 'words']]) {
  const src = readFileSync(root + file, 'utf8'), start = src.indexOf(`${name} = {`); if (start < 0) continue;
  const block = lang => { const i = src.indexOf(`${lang}: {`, start); let depth = 0; for (let j = i; j < src.length; j++) { if (src[j] === '{') depth++; else if (src[j] === '}' && --depth === 0) return src.slice(i, j); } return ''; };
  // Matches inside an earlier value (e.g. "…to this provider:") are text, not keys, so they are skipped.
  const entries = text => { const out = {}; let after = 0; for (const m of text.matchAll(/(['"]?)([\w-]+)\1:\s*(?=['"`])/g)) { if (m.index < after) continue; const v = literal(text, m.index + m[0].length); if (v) { out[m[2]] = v.value; after = v.end; } } return out; };
  const zh = entries(block('zh')), en = entries(block('en'));
  for (const key of Object.keys(en)) add(zh[key], en[key], `${file}#${key}`);
}
const source = Object.fromEntries([...pairs].sort(([a], [b]) => a.localeCompare(b)).map(([en, { zh }]) => [en, zh]));
const out = JSON.stringify(source, null, 1) + '\n';
if (process.argv.includes('--check')) {
  let current = ''; try { current = readFileSync(root + 'i18n/source.json', 'utf8'); } catch { /* Missing counts as stale. */ }
  if (current !== out) { console.error('i18n/source.json is out of date: run node tools/i18n-extract.mjs'); process.exit(1); }
} else { writeFileSync(root + 'i18n/source.json', out); console.log(`${Object.keys(source).length} strings`); }
