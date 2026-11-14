// 推荐 (recommendations): a hand-checked list of real creators, books and papers per built-in module
// (recommend-data.js), plus search links built from the user's own recent card titles or module names.
// The learning square has its own module, square-ui.js.
import { escapeHtml as e } from './chat-store.js';
import { moduleIcon } from './module-icons.js';
import { curatedItems } from './recommend-data.js';
import { pick, isChineseLocale, currentLocale } from './i18n.js';
const REGION_KEY = 'knowledge-review.recommend-region.v1';
const q = encodeURIComponent;
// Search targets per region and kind. Each builds a plain search URL; nothing is fetched by the app itself.
export const SOURCES = {
  cn: {
    creators: [{ name: 'B站', url: k => `https://search.bilibili.com/all?keyword=${q(k)}` }, { name: '抖音', url: k => `https://www.douyin.com/search/${q(k)}` }],
    books: [{ name: '豆瓣读书', url: k => `https://search.douban.com/book/subject_search?search_text=${q(k)}` }, { name: '微信读书', url: k => `https://weread.qq.com/web/search/global?keyword=${q(k)}` }],
    papers: [{ name: '知网', url: k => `https://kns.cnki.net/kns8s/defaultresult/index?kw=${q(k)}` }, { name: '百度学术', url: k => `https://xueshu.baidu.com/s?wd=${q(k)}` }],
  },
  global: {
    creators: [{ name: 'YouTube', url: k => `https://www.youtube.com/results?search_query=${q(k)}` }, { name: 'TikTok', url: k => `https://www.tiktok.com/search?q=${q(k)}` }],
    books: [{ name: 'Google Books', url: k => `https://www.google.com/search?tbm=bks&q=${q(k)}` }, { name: 'Open Library', url: k => `https://openlibrary.org/search?q=${q(k)}` }],
    papers: [{ name: 'Google Scholar', url: k => `https://scholar.google.com/scholar?q=${q(k)}` }, { name: 'arXiv', url: k => `https://arxiv.org/search/?query=${q(k)}&searchtype=all` }],
  },
};
// Region: the user's own choice on this device, else the account's region (Chinese mainland → cn), else the UI language.
export function defaultRegion(accountRegion, locale) { return accountRegion ? (accountRegion === 'CN' ? 'cn' : 'global') : (isChineseLocale(locale) ? 'cn' : 'global'); }
// Keywords: titles of the most recent active cards (newest first, unique), else the names of enabled modules.
export function recommendKeywords(cards, moduleNames, limit = 6) {
  const titles = [...new Set(cards.filter(card => card.status === 'active').sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(card => card.title.trim().slice(0, 40)).filter(Boolean))];
  return (titles.length ? titles : moduleNames).slice(0, limit);
}

export function createDiscoverUI({ locale, cards, profile, modules, account, refresh: refreshView }) {
  const tr = (zh, en, vars) => pick(zh, en, vars);
  let region = null, keyword = '', topic = '';
  const readRegion = () => { try { const saved = localStorage.getItem(REGION_KEY); return saved === 'cn' || saved === 'global' ? saved : null; } catch { return null; } };
  const currentRegion = () => region || readRegion() || defaultRegion(account()?.region, locale());
  // Search keywords come from the chosen module's cards, else that module's name.
  const keywords = moduleId => recommendKeywords(cards().filter(card => card.module === moduleId), modules().filter(item => item.id === moduleId).map(item => item.name));
  // Module shown first: the user's own pick, else the module of the newest active card, else the first module.
  const currentTopic = () => {
    const ids = modules().map(item => item.id);
    if (ids.includes(topic)) return topic;
    const newest = cards().filter(card => card.status === 'active' && ids.includes(card.module)).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
    return newest?.module || ids[0] || '';
  };
  const KINDS = [
    { key: 'creators', zh: '博主与视频', en: 'Creators & videos', icon: '▶' },
    { key: 'books', zh: '书籍', en: 'Books', icon: '▤' },
    { key: 'papers', zh: '论文与指南', en: 'Papers & guides', icon: '§' },
  ];

  function recommendView() {
    const area = currentRegion(), current = currentTopic(), list = keywords(current), p = profile();
    if (!list.includes(keyword)) keyword = list[0] || '';
    const sources = SOURCES[area];
    const item = entry => `<a class="pick-card" href="${e(entry.url)}" target="_blank" rel="noopener noreferrer"><strong>${e(entry.name)}${entry.kind === 'guide' ? ` <span class="pick-tag">${tr('权威指南', 'Guideline')}</span>` : ''} <span aria-hidden="true">↗</span></strong><p>${e(tr(entry.zh, entry.en))}</p></a>`;
    const column = kind => {
      const picks = curatedItems(current, kind.key, area);
      return `<section class="panel discover-column"><div class="section-heading"><h2><span class="discover-glyph" aria-hidden="true">${kind.icon}</span>${tr(kind.zh, kind.en)}</h2></div>
      ${picks.length ? picks.map(item).join('') : `<p class="muted">${tr('这个模块还没有精选资源，可以用下面的搜索。', 'No picks for this module yet; use the searches below.')}</p>`}
      <div class="search-links" role="group" aria-label="${tr('搜索更多：', 'Search more:')}">${keyword ? sources[kind.key].map(source => `<a class="search-link" href="${e(source.url(keyword))}" target="_blank" rel="noopener noreferrer">${tr('在 {v0} 搜索「{v1}」', 'Search {v0} for “{v1}”', { v0: source.name, v1: e(keyword) })} <span aria-hidden="true">↗</span></a>`).join('') : ''}</div></section>`;
    };
    return `<section class="intro"><span class="eyebrow">${tr('推荐', 'For you')}</span><h1>${tr('学完之后，去哪里看更多？', 'Where to go next')}</h1></section>
      <div class="discover-toolbar"><div class="segmented" role="group" aria-label="${tr('地区', 'Region')}">${[['cn', tr('中国区', 'China')], ['global', tr('海外', 'International')]].map(([id, label]) => `<button type="button" class="${area === id ? 'active' : ''}" data-region="${id}" aria-pressed="${area === id}">${label}</button>`).join('')}</div></div>
      <div class="keyword-row" role="group" aria-label="${tr('模块', 'Module')}">${modules().map(mod => `<button type="button" class="keyword-chip ${mod.id === current ? 'active' : ''}" data-topic="${e(mod.id)}" aria-pressed="${mod.id === current}">${moduleIcon(p, mod.id, 14)} ${e(mod.name)}</button>`).join('')}</div>
      <div class="discover-grid">${KINDS.map(column).join('')}</div>
      ${list.length ? `<div class="keyword-row" role="group" aria-label="${tr('搜索关键词（来自这个模块最近学的）：', 'Search keyword (from this module):')}">${list.map(word => `<button type="button" class="keyword-chip ${word === keyword ? 'active' : ''}" data-keyword="${e(word)}" aria-pressed="${word === keyword}">${e(word)}</button>`).join('')}</div>` : ''}`;
  }

  function bind(page) {
    if (page !== 'recommend') return;
    document.querySelectorAll('[data-region]').forEach(button => { button.onclick = () => { region = button.dataset.region; try { localStorage.setItem(REGION_KEY, region); } catch { /* This page only. */ } refreshView(); }; });
    document.querySelectorAll('[data-keyword]').forEach(button => { button.onclick = () => { keyword = button.dataset.keyword; refreshView(); }; });
    document.querySelectorAll('[data-topic]').forEach(button => { button.onclick = () => { topic = button.dataset.topic; refreshView(); }; });
  }
  return { recommendView, bind };
}
