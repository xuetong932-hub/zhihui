// 学习广场 (learning square): public posts with comments, likes, translation, reporting and the author's own delete.
// Everything is stored by the account service (cloud-schema.sql square_*), which checks sign-in, registration,
// length and rate limits on every write; this page only shows what it returns. Anyone may read; writing needs a
// registered adult account. Translation uses 知回's free model through /api/translate (50 a day).
import { escapeHtml as e } from './chat-store.js';
import { pick, intlLocale } from './i18n.js';
export const POST_MAX = 1000, COMMENT_MAX = 500;
const MODULES = ['coding', 'english', 'work', 'life'];
const REASONS = [['spam', '垃圾广告', 'Spam or advertising'], ['abuse', '冒犯或骚扰', 'Offensive or harassing'], ['harm', '不实或有害信息', 'False or harmful'], ['other', '其他', 'Other']];

// "3 minutes ago" in the interface language; older than a week shows the date.
export function relativeTime(iso, locale, now = Date.now()) {
  const seconds = Math.round((Date.parse(iso) - now) / 1000), format = new Intl.RelativeTimeFormat(intlLocale(locale), { numeric: 'auto' });
  const abs = Math.abs(seconds);
  if (abs < 60) return format.format(0, 'second');
  if (abs < 3600) return format.format(Math.round(seconds / 60), 'minute');
  if (abs < 86400) return format.format(Math.round(seconds / 3600), 'hour');
  if (abs < 7 * 86400) return format.format(Math.round(seconds / 86400), 'day');
  return new Date(iso).toLocaleDateString(intlLocale(locale));
}

export function createSquareUI({ auth, getAccount, locale, refresh, moduleName }) {
  const tr = (zh, en, vars) => pick(zh, en, vars);
  let posts = [], loaded = false, loading = false, hasMore = false, message = '', draft = '', draftModule = '', posting = false;
  const threads = new Map(), translations = new Map(), reporting = new Map();
  const available = () => Boolean(auth?.config);
  // Registered adults and administrators may write; the server checks again on every call.
  const canWrite = () => { const account = getAccount?.(); return Boolean(account && !account.local && auth?.user && (account.is_admin || (account.registered && account.status === 'adult'))); };
  const errorText = error => ({
    not_eligible: tr('登录并完成注册后才能发帖、评论和点赞。', 'Sign in and finish registering to post, comment and like.'),
    rate_limited: tr('发得太快了，请稍后再试。', 'You are posting too fast. Try again a little later.'),
    invalid_square: tr('内容为空或太长。', 'The text is empty or too long.'),
    not_found: tr('这条内容已被删除或隐藏。', 'This was deleted or hidden.'),
    'translate-limit': tr('今天的翻译次数已用完（每天 50 次），明天再来。', 'Today’s 50 translations are used up. Try again tomorrow.'),
    'free-unavailable': tr('翻译服务暂时不可用。', 'Translation is not available right now.'),
    filtered: tr('这段内容无法翻译。', 'This text cannot be translated.'),
    rate: tr('请求太频繁，请稍后再试。', 'Too many requests. Try again shortly.'),
  })[error?.code] || tr('连接失败，请检查网络后重试。', 'Could not connect. Check your network and try again.');

  async function load(more = false) {
    if (loading || !available()) return;
    loading = true; message = ''; refresh();
    try {
      const page = await auth.square.feed(more && posts.length ? posts.at(-1).created_at : null);
      const list = Array.isArray(page) ? page : [];
      posts = more ? [...posts, ...list.filter(item => !posts.some(post => post.id === item.id))] : list;
      hasMore = list.length >= 20; loaded = true;
    } catch (error) { message = errorText(error); }
    finally { loading = false; refresh(); }
  }
  async function publish() {
    const body = draft.trim();
    if (posting || !body || body.length > POST_MAX || !canWrite()) return;
    posting = true; message = ''; refresh();
    try { const post = await auth.square.post({ body, lang: locale(), module: draftModule || null }); posts = [post, ...posts.filter(item => item.id !== post.id)]; draft = ''; draftModule = ''; }
    catch (error) { message = errorText(error); }
    finally { posting = false; refresh(); }
  }
  const thread = id => { if (!threads.has(id)) threads.set(id, { open: false, list: null, loading: false, draft: '', sending: false, error: '' }); return threads.get(id); };
  async function openThread(id) {
    const state = thread(id); state.open = !state.open; refresh();
    if (!state.open || state.list || state.loading) return;
    state.loading = true; state.error = ''; refresh();
    try { const list = await auth.square.comments(id); state.list = Array.isArray(list) ? list : []; }
    catch (error) { state.error = errorText(error); }
    finally { state.loading = false; refresh(); }
  }
  async function sendComment(id) {
    const state = thread(id), body = state.draft.trim();
    if (state.sending || !body || body.length > COMMENT_MAX || !canWrite()) return;
    state.sending = true; state.error = ''; refresh();
    try {
      const comment = await auth.square.comment({ post: id, body, lang: locale() });
      state.list = [...(state.list || []), comment]; state.draft = '';
      const post = posts.find(item => item.id === id); if (post) post.comment_count = (post.comment_count || 0) + 1;
    } catch (error) { state.error = errorText(error); }
    finally { state.sending = false; refresh(); }
  }
  async function toggleLike(id) {
    const post = posts.find(item => item.id === id);
    if (!post || post.liking || !canWrite()) return;
    const liked = !post.liked; post.liking = true; post.liked = liked; post.like_count += liked ? 1 : -1; refresh();
    try { const result = await auth.square.like(id, liked); post.liked = result.liked; post.like_count = result.like_count; }
    catch (error) { post.liked = !liked; post.like_count += liked ? -1 : 1; message = errorText(error); }
    finally { post.liking = false; refresh(); }
  }
  // Translation into the interface language, kept for this page; the button switches between it and the original.
  async function translate(kind, item) {
    const key = `${kind}:${item.id}`, state = translations.get(key);
    if (state?.text) { state.showing = !state.showing; refresh(); return; }
    if (state?.loading) return;
    translations.set(key, { loading: true }); refresh();
    try {
      const token = await auth?.accessToken?.().catch(() => '') || '';
      const response = await fetch('/api/translate', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ text: item.body, target: locale() }) });
      const data = await response.json().catch(() => null);
      if (!response.ok || typeof data?.text !== 'string') throw { code: data?.error };
      translations.set(key, { text: data.text, showing: true });
    } catch (error) { translations.set(key, { error: errorText(error) }); }
    refresh();
  }
  async function remove(kind, id, postId) {
    if (!window.confirm(kind === 'post' ? tr('删除这条帖子？评论也会一起删除。', 'Delete this post? Its comments are deleted too.') : tr('删除这条评论？', 'Delete this comment?'))) return;
    try {
      await auth.square.remove(kind, id);
      if (kind === 'post') posts = posts.filter(item => item.id !== id);
      else { const state = thread(postId); state.list = (state.list || []).filter(item => item.id !== id); const post = posts.find(item => item.id === postId); if (post) post.comment_count = Math.max(0, post.comment_count - 1); }
    } catch (error) { message = errorText(error); }
    refresh();
  }
  async function report(kind, id, reason) {
    try { await auth.square.report(kind, id, reason); reporting.set(`${kind}:${id}`, 'sent'); }
    catch (error) { reporting.delete(`${kind}:${id}`); message = errorText(error); }
    refresh();
  }

  // Text shown for a post or comment: its translation when the reader asked for it, else the original.
  function bodyView(kind, item) {
    const state = translations.get(`${kind}:${item.id}`), translated = state?.text && state.showing;
    return `<p class="square-body" lang="${e(translated ? locale() : item.lang)}">${e(translated ? state.text : item.body)}</p>${state?.error ? `<p class="error" role="alert">${e(state.error)}</p>` : ''}${translated ? `<p class="field-hint">${tr('由智谱 AI 机器翻译', 'Machine-translated by Zhipu AI')}</p>` : ''}`;
  }
  function toolsView(kind, item, postId = item.id) {
    const key = `${kind}:${item.id}`, state = translations.get(key), report = reporting.get(key);
    const translateButton = item.lang !== locale() ? `<button type="button" class="text-button" data-square-translate="${kind}" data-id="${e(item.id)}" data-post="${e(postId)}" ${state?.loading ? 'disabled' : ''}>${state?.loading ? tr('翻译中…', 'Translating…') : state?.text && state.showing ? tr('显示原文', 'Show original') : tr('翻译', 'Translate')}</button>` : '';
    const deleteButton = item.can_delete ? `<button type="button" class="text-button" data-square-delete="${kind}" data-id="${e(item.id)}" data-post="${e(postId)}">${tr('删除', 'Delete')}</button>` : '';
    const reportButton = !item.mine && canWrite() ? report === 'sent' ? `<span class="field-hint">${tr('已举报，感谢反馈', 'Reported. Thank you.')}</span>` : `<button type="button" class="text-button" data-square-report="${kind}" data-id="${e(item.id)}" aria-expanded="${report === 'open'}">${tr('举报', 'Report')}</button>` : '';
    return `${translateButton}${deleteButton}${reportButton}`;
  }
  // The reasons to choose from, on their own row under the item once "举报" is pressed.
  function reasonsView(kind, item) {
    if (reporting.get(`${kind}:${item.id}`) !== 'open') return '';
    return `<div class="square-report" role="group" aria-label="${tr('举报原因', 'Reason for reporting')}"><span class="field-hint">${tr('举报原因：', 'Report reason:')}</span>${REASONS.map(([id, zh, en]) => `<button type="button" class="secondary-button" data-square-reason="${id}" data-kind="${kind}" data-id="${e(item.id)}">${tr(zh, en)}</button>`).join('')}<button type="button" class="text-button" data-square-report-cancel="${kind}" data-id="${e(item.id)}">${tr('取消', 'Cancel')}</button></div>`;
  }
  function commentsView(post) {
    const state = thread(post.id);
    if (!state.open) return '';
    const list = state.list || [];
    return `<div class="square-comments">
      ${state.loading ? `<p class="muted">${tr('正在加载…', 'Loading…')}</p>` : list.length ? list.map(comment => `<div class="square-comment"><div class="square-meta"><strong>${e(comment.author_name)}</strong><span class="muted">${e(relativeTime(comment.created_at, locale()))}</span></div>${bodyView('comment', comment)}<div class="square-tools">${toolsView('comment', comment, post.id)}</div>${reasonsView('comment', comment)}</div>`).join('') : `<p class="muted">${tr('还没有评论。', 'No comments yet.')}</p>`}
      ${canWrite() ? `<div class="square-reply"><textarea rows="2" maxlength="${COMMENT_MAX}" data-square-comment-input="${e(post.id)}" placeholder="${tr('写下你的评论……', 'Write a comment…')}">${e(state.draft)}</textarea><button type="button" class="secondary-button" data-square-comment-send="${e(post.id)}" ${state.sending || !state.draft.trim() ? 'disabled' : ''}>${state.sending ? tr('发送中…', 'Sending…') : tr('评论', 'Comment')}</button></div>` : ''}
      ${state.error ? `<p class="error" role="alert">${e(state.error)}</p>` : ''}</div>`;
  }
  function postView(post) {
    const state = thread(post.id);
    return `<article class="panel square-post" data-post="${e(post.id)}">
      <div class="square-meta"><span class="square-avatar" aria-hidden="true">${e([...post.author_name][0] || '?')}</span><div><strong>${e(post.author_name)}</strong><span class="muted"> · ${e(relativeTime(post.created_at, locale()))}</span>${post.module && MODULES.includes(post.module) ? `<span class="square-module">${e(moduleName(post.module))}</span>` : ''}</div></div>
      ${bodyView('post', post)}
      <div class="square-actions">
        <button type="button" class="square-action ${post.liked ? 'active' : ''}" data-square-like="${e(post.id)}" aria-pressed="${Boolean(post.liked)}" ${canWrite() ? '' : 'disabled'} aria-label="${tr('点赞', 'Like')}"><span aria-hidden="true">${post.liked ? '♥' : '♡'}</span> ${Number(post.like_count) || 0}</button>
        <button type="button" class="square-action ${state.open ? 'active' : ''}" data-square-thread="${e(post.id)}" aria-expanded="${state.open}" aria-label="${tr('评论', 'Comments')}"><span aria-hidden="true">💬</span> ${Number(post.comment_count) || 0}</button>
        <span class="square-tools">${toolsView('post', post)}</span>
      </div>
      ${reasonsView('post', post)}
      ${commentsView(post)}</article>`;
  }
  function composeView() {
    if (!canWrite()) {
      const local = getAccount?.()?.local;
      return `<section class="panel square-compose square-locked"><p>${tr('登录并完成注册后即可发帖、评论和点赞；不登录也可以浏览和翻译。', 'Sign in and finish registering to post, comment and like. You can read and translate without an account.')}</p>${local ? `<button type="button" class="primary-button" data-signin>${tr('登录 / 注册', 'Sign in / Register')}</button>` : ''}</section>`;
    }
    const length = [...draft.trim()].length;
    return `<section class="panel square-compose">
      <textarea id="square-draft" rows="3" maxlength="${POST_MAX}" placeholder="${tr('分享你今天学到的一点……', 'Share something you learned today…')}">${e(draft)}</textarea>
      <div class="square-compose-row"><label class="square-module-pick">${tr('学习模块', 'Learning module')}<select id="square-module"><option value="">${tr('不选择', 'None')}</option>${MODULES.map(id => `<option value="${id}" ${draftModule === id ? 'selected' : ''}>${e(moduleName(id))}</option>`).join('')}</select></label><span class="field-hint" id="square-count">${length}/${POST_MAX}</span></div>
      <div class="actions"><span class="field-hint">${tr('内容公开可见，请勿发布个人信息。翻译由智谱 AI 处理。', 'Posts are public; do not share personal information. Translation is done by Zhipu AI.')}</span><button class="primary-button" id="square-publish" ${posting || !length || length > POST_MAX ? 'disabled' : ''}>${posting ? tr('发布中…', 'Posting…') : tr('发布', 'Post')}</button></div></section>`;
  }
  function view() {
    const head = `<section class="intro"><span class="eyebrow">${tr('广场', 'Square')}</span><h1>${tr('学到的，说给大家听。', 'Share what you learn.')}</h1></section>`;
    if (!available()) return `${head}<p class="square-empty">${tr('广场需要连接账号服务，当前不可用。', 'The square needs the account service, which is not available here.')}</p>`;
    return `${head}${composeView()}
      ${message ? `<p class="error" role="alert">${e(message)}</p>` : ''}
      <div class="square-toolbar"><button type="button" class="text-button" id="square-refresh" ${loading ? 'disabled' : ''}>↻ ${tr('刷新', 'Refresh')}</button></div>
      <div class="square-feed">${posts.map(postView).join('')}</div>
      ${loading ? `<p class="square-empty">${tr('正在加载…', 'Loading…')}</p>` : loaded && !posts.length ? `<p class="square-empty">${tr('还没有人发帖，来写第一条吧。', 'No posts yet. Be the first to share.')}</p>` : ''}
      ${hasMore && !loading ? `<div class="square-more"><button type="button" class="secondary-button" id="square-more">${tr('加载更多', 'Load more')}</button></div>` : ''}`;
  }
  function bind() {
    const on = (selector, handler) => document.querySelectorAll(selector).forEach(element => { element.onclick = () => handler(element); });
    const input = document.querySelector('#square-draft');
    // Typing updates only the counter and the button, so the page is not redrawn on every key.
    if (input) input.oninput = () => {
      draft = input.value; const length = [...draft.trim()].length;
      const counter = document.querySelector('#square-count'), button = document.querySelector('#square-publish');
      if (counter) counter.textContent = `${length}/${POST_MAX}`;
      if (button) button.disabled = posting || !length || length > POST_MAX;
    };
    const module = document.querySelector('#square-module'); if (module) module.onchange = () => { draftModule = MODULES.includes(module.value) ? module.value : ''; };
    on('#square-publish', () => publish());
    on('#square-refresh', () => load());
    on('#square-more', () => load(true));
    on('[data-square-like]', button => toggleLike(button.dataset.squareLike));
    on('[data-square-thread]', button => openThread(button.dataset.squareThread));
    on('[data-square-comment-send]', button => sendComment(button.dataset.squareCommentSend));
    document.querySelectorAll('[data-square-comment-input]').forEach(area => { area.oninput = () => {
      const id = area.dataset.squareCommentInput, state = thread(id); state.draft = area.value;
      const button = [...document.querySelectorAll('[data-square-comment-send]')].find(item => item.dataset.squareCommentSend === id);
      if (button) button.disabled = state.sending || !state.draft.trim();
    }; });
    on('[data-square-translate]', button => { const kind = button.dataset.squareTranslate, id = button.dataset.id; const item = kind === 'post' ? posts.find(post => post.id === id) : thread(button.dataset.post).list?.find(comment => comment.id === id); if (item) translate(kind, item); });
    on('[data-square-delete]', button => remove(button.dataset.squareDelete, button.dataset.id, button.dataset.post));
    on('[data-square-report]', button => { reporting.set(`${button.dataset.squareReport}:${button.dataset.id}`, 'open'); refresh(); });
    on('[data-square-report-cancel]', button => { reporting.delete(`${button.dataset.squareReportCancel}:${button.dataset.id}`); refresh(); });
    on('[data-square-reason]', button => report(button.dataset.kind, button.dataset.id, button.dataset.squareReason));
  }
  // Opening the page loads the newest posts the first time.
  return { view, bind, open: () => { if (!loaded && !loading) void load(); }, get busy() { return posting; } };
}
