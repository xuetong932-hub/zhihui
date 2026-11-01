// 推荐 (interest recommendations) and 学习广场 (learning square). Both are placeholders until real services exist:
// recommendation cards are clearly marked examples (no invented creator names), while the search links are real and
// built from the user's own recent card titles or module names. The square has sample posts only and no backend.
import { escapeHtml as e } from './chat-store.js';
import { moduleIcon } from './module-icons.js';
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
export function defaultRegion(accountRegion, locale) { return accountRegion ? (accountRegion === 'CN' ? 'cn' : 'global') : (locale === 'zh' ? 'cn' : 'global'); }
// Keywords: titles of the most recent active cards (newest first, unique), else the names of enabled modules.
export function recommendKeywords(cards, moduleNames, limit = 6) {
  const titles = [...new Set(cards.filter(card => card.status === 'active').sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(card => card.title.trim().slice(0, 40)).filter(Boolean))];
  return (titles.length ? titles : moduleNames).slice(0, limit);
}

export function createDiscoverUI({ locale, cards, profile, modules, account, refresh: refreshView }) {
  const tr = (zh, en) => locale() === 'zh' ? zh : en;
  let region = null, keyword = '';
  const readRegion = () => { try { const saved = localStorage.getItem(REGION_KEY); return saved === 'cn' || saved === 'global' ? saved : null; } catch { return null; } };
  const currentRegion = () => region || readRegion() || defaultRegion(account()?.region, locale());
  const keywords = () => recommendKeywords(cards(), modules().map(item => item.name));
  const sample = () => `<span class="sample-badge">${tr('示例', 'Example')}</span>`;
  const KINDS = [
    { key: 'creators', zh: '博主与视频', en: 'Creators & videos', icon: '▶', sample: tr('示例博主', 'Example creator'), note: tr('接入推荐服务后，这里显示与你的主题相关的真实博主。', 'Real creators for your topic appear here once a recommendation service is connected.') },
    { key: 'books', zh: '书籍', en: 'Books', icon: '▤', sample: tr('示例书籍', 'Example book'), note: tr('接入后按你的语言推荐书籍。', 'Books in your language appear here once connected.') },
    { key: 'papers', zh: '论文', en: 'Papers', icon: '§', sample: tr('示例论文', 'Example paper'), note: tr('接入后推荐相关论文和综述。', 'Related papers and reviews appear here once connected.') },
  ];

  function recommendView() {
    const list = keywords(), area = currentRegion();
    if (!list.includes(keyword)) keyword = list[0] || '';
    const sources = SOURCES[area];
    const column = kind => `<section class="panel discover-column"><div class="section-heading"><h2><span class="discover-glyph" aria-hidden="true">${kind.icon}</span>${tr(kind.zh, kind.en)}</h2></div>
      ${[1, 2].map(n => `<article class="sample-card"><span class="sample-thumb" aria-hidden="true"></span><div><strong>${kind.sample} ${n}</strong> ${sample()}<p>${sources[kind.key][n - 1].name} · ${kind.note}</p></div></article>`).join('')}
      <div class="search-links"><span class="field-hint">${tr('现在就能用：', 'Works now:')}</span>${keyword ? sources[kind.key].map(source => `<a class="search-link" href="${e(source.url(keyword))}" target="_blank" rel="noopener noreferrer">${tr(`在 ${source.name} 搜索「${e(keyword)}」`, `Search ${source.name} for “${e(keyword)}”`)} <span aria-hidden="true">↗</span></a>`).join('') : ''}</div></section>`;
    return `<section class="intro"><span class="eyebrow">${tr('推荐', 'For you')}</span><h1>${tr('学完之后，去哪里看更多？', 'Where to go next')}</h1><p>${tr('根据你最近学习的内容和关注的模块，推荐博主、书籍和论文。推荐服务接入前，卡片为示例；搜索链接已可直接使用。', 'Creators, books and papers based on what you learned and the modules you follow. Cards are examples until a recommendation service is connected; search links already work.')}</p></section>
      <div class="discover-toolbar"><div class="segmented" role="group" aria-label="${tr('地区', 'Region')}">${[['cn', tr('中国区', 'China')], ['global', tr('海外', 'International')]].map(([id, label]) => `<button type="button" class="${area === id ? 'active' : ''}" data-region="${id}" aria-pressed="${area === id}">${label}</button>`).join('')}</div>
        <span class="muted">${area === 'cn' ? tr('抖音 · B站 · 豆瓣 · 知网', 'Douyin · Bilibili · Douban · CNKI') : tr('YouTube · Google Books · Google Scholar', 'YouTube · Google Books · Google Scholar')}</span></div>
      ${list.length ? `<div class="keyword-row"><span class="field-hint">${tr('根据你最近学习的：', 'Based on what you learned:')}</span>${list.map(word => `<button type="button" class="keyword-chip ${word === keyword ? 'active' : ''}" data-keyword="${e(word)}" aria-pressed="${word === keyword}">${e(word)}</button>`).join('')}</div>` : ''}
      <div class="discover-grid">${KINDS.map(column).join('')}</div>`;
  }

  const POSTS = [
    { module: 'coding', zh: '用“先写测试再写实现”的方式复习了闭包，三道题全对。有同样在学 JavaScript 的吗？', en: 'Reviewed closures by writing tests first; got all three right. Anyone else learning JavaScript?', likes: 12, replies: 3 },
    { module: 'english', zh: '整理了一张现在完成时和一般过去时的对照表，复习时比单看例句清楚多了。', en: 'Made a table comparing present perfect and simple past; much clearer than examples alone.', likes: 8, replies: 5 },
    { module: 'work', zh: '面试前用 STAR 法则把三段经历各写了一遍，第二天复习时几乎都记住了。', en: 'Wrote three experiences with the STAR method before an interview; remembered nearly all of it the next day.', likes: 15, replies: 2 },
  ];
  function squareView() {
    const p = profile();
    return `<section class="intro"><span class="eyebrow">${tr('学习广场', 'Learning square')}</span><h1>${tr('学习广场 · 即将开放', 'Learning square · coming soon')}</h1><p>${tr('以后可以在这里分享笔记、讨论问题、互相鼓励。现在还没有开放，下面是示例内容，展示开放后的样子。', 'Soon you can share notes, discuss questions and cheer each other on here. It is not open yet; the posts below are examples of how it will look.')}</p></section>
      <section class="panel square-compose" aria-disabled="true"><textarea disabled rows="3" placeholder="${tr('分享你今天学到的一点……', 'Share something you learned today…')}"></textarea><div class="actions"><span class="field-hint">${tr('开放后可发帖。现在不会保存或发送任何内容。', 'Posting opens later. Nothing is saved or sent now.')}</span><button class="primary-button" disabled>${tr('发布', 'Post')}</button></div></section>
      <div class="square-feed">${POSTS.map((post, i) => `<article class="panel square-post"><div class="square-author"><span class="square-avatar" aria-hidden="true">${String.fromCharCode(65 + i)}</span><div><strong>${tr(`示例用户 ${String.fromCharCode(65 + i)}`, `Example user ${String.fromCharCode(65 + i)}`)}</strong> ${sample()}<span class="square-module">${moduleIcon(p, post.module, 14)}${e(modules().find(item => item.id === post.module)?.name || '')}</span></div></div>
        <p>${tr(post.zh, post.en)}</p><div class="square-actions"><button class="text-button" disabled>♡ ${post.likes}</button><button class="text-button" disabled>💬 ${post.replies}</button></div></article>`).join('')}</div>`;
  }

  function bind(page) {
    if (page !== 'recommend') return;
    document.querySelectorAll('[data-region]').forEach(button => { button.onclick = () => { region = button.dataset.region; try { localStorage.setItem(REGION_KEY, region); } catch { /* This page only. */ } refreshView(); }; });
    document.querySelectorAll('[data-keyword]').forEach(button => { button.onclick = () => { keyword = button.dataset.keyword; refreshView(); }; });
  }
  return { recommendView, squareView, bind };
}
