// Interface languages. The source text lives in the code as Chinese/English pairs, pick('中文', 'English'); other
// languages are catalogs in i18n/<code>.js keyed by the English text, loaded on demand. A string missing from a
// catalog falls back to English. Placeholders like {n} are filled from the vars object in every language.
// 'zh' (Simplified Chinese) and 'en' keep their codes so existing profiles and sync snapshots stay valid.
export const LOCALES = [
  { code: 'zh', name: '简体中文', intl: 'zh-CN', speech: 'zh-CN', chinese: true },
  { code: 'zh-TW', name: '繁體中文', intl: 'zh-TW', speech: 'zh-TW', chinese: true },
  { code: 'en', name: 'English', intl: 'en', speech: 'en-US' },
  { code: 'ja', name: '日本語', intl: 'ja', speech: 'ja-JP' },
  { code: 'ko', name: '한국어', intl: 'ko', speech: 'ko-KR' },
  { code: 'ms', name: 'Bahasa Melayu', intl: 'ms', speech: 'ms-MY' },
  { code: 'es', name: 'Español', intl: 'es', speech: 'es-ES' },
  { code: 'fr', name: 'Français', intl: 'fr', speech: 'fr-FR' },
  { code: 'pt', name: 'Português (Brasil)', intl: 'pt-BR', speech: 'pt-BR' },
  { code: 'de', name: 'Deutsch', intl: 'de', speech: 'de-DE' },
];
// Languages offered in the picker; a new one is added here once its catalog is complete.
export const ENABLED = ['zh', 'zh-TW', 'en', 'ja', 'ko', 'ms', 'es', 'fr', 'pt', 'de'];
export const LOCALE_CODES = LOCALES.map(item => item.code);
export const isLocale = code => LOCALE_CODES.includes(code);
const info = code => LOCALES.find(item => item.code === code) || LOCALES[2];
export const localeName = code => info(code).name;
export const intlLocale = code => info(code).intl;
export const speechLocale = code => info(code).speech;
export const isChineseLocale = code => Boolean(info(code).chinese);

// First visit: the best enabled match for the browser's languages, else English.
export function detectLocale(languages = globalThis.navigator?.languages || [globalThis.navigator?.language || 'en'], enabled = ENABLED) {
  for (const raw of languages) {
    const tag = String(raw || '').toLowerCase();
    const code = /^zh-(tw|hk|mo|hant)/.test(tag) || tag.includes('hant') ? 'zh-TW' : tag.startsWith('zh') ? 'zh' : tag.startsWith('pt') ? 'pt' : tag.split('-')[0];
    if (enabled.includes(code)) return code;
    if (code === 'zh-TW' && enabled.includes('zh')) return 'zh';
  }
  return enabled.includes('en') ? 'en' : enabled[0];
}

const catalogs = {};
let current = 'zh';
export const currentLocale = () => current;
export function registerCatalog(code, table) { catalogs[code] = table; }
const tried = new Set();
// True while a language still needs its catalog loaded (one attempt each; a failed load falls back to English).
export const needsCatalog = code => isLocale(code) && code !== 'zh' && code !== 'en' && !catalogs[code] && !tried.has(code);
// Loads a catalog for a language; Chinese and English need none.
export async function loadCatalog(code) {
  if (!needsCatalog(code)) return;
  tried.add(code);
  try { registerCatalog(code, (await import(`./i18n/${code}.js`)).default); } catch { /* Falls back to English text. */ }
}
export function setLocale(code) { current = isLocale(code) ? code : 'en'; if (globalThis.document) document.documentElement.lang = intlLocale(current); }

const fill = (text, vars) => vars ? text.replace(/\{(\w+)\}/g, (match, key) => key in vars ? String(vars[key]) : match) : text;
// The one translation function. The locale defaults to the current interface language.
export function translate(zh, en, vars, locale = current) {
  const text = locale === 'zh' ? zh : locale === 'en' ? en : catalogs[locale]?.[en] ?? en;
  return fill(text, vars);
}
export const pick = (zh, en, vars) => translate(zh, en, vars);
