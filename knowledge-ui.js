import { KNOWLEDGE_KEY, emptyKnowledge, loadKnowledge, addKnowledge, mergeCards, localDay, validCard } from './knowledge-store.js';
import { escapeHtml as e, renderAnswer } from './chat-store.js';
import { createMemoryPanel } from './memory-ui.js';
import { isStarterCard } from './starter-content.js';
import { pick, intlLocale, currentLocale } from './i18n.js';
import { shelfView, bookView, cardPageView, coverColor, animateOpen, animateClose, bookDialog, confirmDialog } from './bookshelf.js';
import { moduleIconName } from './module-icons.js';
import { isPresetModule, isCustomModule, MAX_CUSTOM_MODULES, newCustomModuleId, cleanModuleName } from './modules.js';

export function createKnowledgeUI({ locale, enabled, moduleName, extract, refresh, origins, reviews, dueIds, googleClientId, relate, expand, starterPanel = () => '', phone = () => false, getProfile = () => null, updateModules = () => 'unsupported' }) {
  const text = (zh, en, vars) => pick(zh, en, vars);
  const name = id => e(moduleName(id));
  // Active modules, plus a card's own module when it is disabled or deleted so the edit form never moves it silently.
  const moduleOptions = current => [...new Set([...enabled(), ...(current ? [current] : [])])];
  let snapshot = null, data = emptyKnowledge(), error = '', blocked = false, busy = false;
  let moduleFilter = '', dateFilter = '', query = '', trash = false;
  // Unsaved edits, merge choices and open sections survive page redraws until saved or discarded.
  const edits = new Map(), mergeChoices = new Map(), openSections = new Set();
  const field = (card, key) => edits.get(card.id)?.[key] ?? card[key];
  const opened = key => openSections.has(key) ? 'open' : '';
  function load() {
    snapshot = null; data = emptyKnowledge(); error = ''; blocked = false; edits.clear(); mergeChoices.clear(); openSections.clear();
    try { snapshot = localStorage.getItem(KNOWLEDGE_KEY); data = loadKnowledge(snapshot); }
    catch { blocked = true; error = text('知识数据无法读取，未覆盖原记录。','Knowledge data could not be read. Original data was not overwritten.'); }
  }
  load();
  function save() {
    if (blocked) return false;
    try {
      if (localStorage.getItem(KNOWLEDGE_KEY) !== snapshot) throw new Error('conflict');
      const raw = JSON.stringify(data); localStorage.setItem(KNOWLEDGE_KEY,raw); snapshot = raw; return true;
    } catch { error = text('保存失败或其他页面更新了知识库。请先复制本页重要内容，再刷新。','Saving failed or another page updated knowledge. Copy important content before reloading.'); return false; }
  }
  async function ingest(origin) {
    if (blocked) return;
    const known = data.cards.find(card => card.origins.some(item => item.id === origin.id));
    if (data.ignored.includes(origin.id) || (known && (known.extraction === 'ready' || ['deleted','merged'].includes(known.status)))) return;
    addKnowledge(data,origin,null);
    if (!save()) return;
    busy = true; error = ''; refresh();
    try {
      const candidates = data.cards.filter(card => card.module === origin.sourceModule && ['active','paused'].includes(card.status) && !card.origins.some(item => item.id === origin.id)).slice(-40).map(({id,title})=>({id,title}));
      const result = await extract(origin,candidates);
      addKnowledge(data,origin,result); save();
    } catch { error = text('问答已保留；知识提炼未完成，可在知识库中重试。重试会调用模型。','Q&A is kept. Knowledge extraction is incomplete; retry in the library (uses the model).'); }
    finally { busy = false; refresh(); }
  }
  // Library tabs: cards, forgetting curve, knowledge graph, export.
  let tab = 'cards';
  // The chart views can rename a card (graph) or mark it important / pause it (curve detail); saved like the card list.
  const updateCard = (id, change) => { const card = data.cards.find(item => item.id === id); if (!card || blocked) return false; change(card); card.updatedAt = new Date().toISOString(); return save(); };
  const panel = createMemoryPanel({ locale, cards: () => data.cards, reviews, dueIds, moduleName, modules: enabled, googleClientId, refresh, relate, expand, updateCard, openTab: next => { tab = next; refresh(); } });
  const tabs = () => `<div class="module-tabs library-tabs" role="tablist">${[['cards', text('知识卡片', 'Cards')], ['curve', text('遗忘曲线', 'Forgetting curve')], ['graph', text('知识图谱', 'Knowledge graph')], ['mindmap', text('思维导图', 'Mind map')], ['export', text('导出', 'Export')]].map(([id, label]) => `<button class="module-tab ${tab === id ? 'active' : ''}" role="tab" aria-selected="${tab === id}" data-library-tab="${id}">${label}</button>`).join('')}</div>`;
  function view() { if (tab === 'cards' && phone() && !trash && shelf.open) return bookPage(); return tab === 'cards' ? cardsView().replace('</section>', '</section>' + tabs()) : `<section class="intro"><span class="eyebrow">${text('知识库', 'Knowledge library')}</span><h1>${text('让问过的，成为记得住的。', 'Keep what you learn.')}</h1></section>${tabs()}${panel.view(tab)}`; }
  function bind() {
    document.querySelectorAll('[data-library-tab]').forEach(button => { button.onclick = () => { if (busy || panel.busy) return; tab = button.dataset.libraryTab; refresh(); }; });
    document.querySelectorAll('[data-open-mindmap]').forEach(button => { button.onclick = () => { panel.select(button.dataset.openMindmap); tab = 'mindmap'; refresh(); window.scrollTo(0, 0); }; });
    if (tab === 'cards') { cardsBind(); if (phone() && !trash) shelfBind(); } else panel.bind(tab);
  }
  // ---- Phone bookshelf (bookshelf.js draws it; the state lives here) ----
  const SHELF_MODE_KEY = 'knowledge-review.shelf-mode.v1';
  const shelf = { open: null, card: null, selected: null, last: null, editing: false, sheet: null, menu: false, dueOnly: false, searching: false, query: '', closing: null, error: '',
    mode: (() => { try { return localStorage.getItem(SHELF_MODE_KEY) === 'spine' ? 'spine' : 'cover'; } catch { return 'cover'; } })() };
  const liveCards = () => data.cards.filter(card => ['active', 'paused'].includes(card.status));
  function books() {
    const due = new Set(dueIds()), live = liveCards(), profile = getProfile();
    return enabled().map(id => { const mine = live.filter(card => card.module === id);
      return { id, name: moduleName(id), color: coverColor(profile, id), icon: moduleIconName(profile, id), count: mine.length, due: mine.filter(card => due.has(card.id)).length }; });
  }
  const canAdd = () => Object.entries(getProfile()?.modules || {}).filter(([id, item]) => isCustomModule(id) && !item.archived).length < MAX_CUSTOM_MODULES;
  function shelfHtml() {
    return shelfView({ books: books(), mode: shelf.mode, selected: shelf.selected, last: shelf.last, editing: shelf.editing, canAdd: canAdd(), sheet: shelf.sheet, menu: shelf.menu, error: shelf.error,
      extra: `<p role="status" class="verified">${busy ? text('正在整理知识点…', 'Organizing knowledge…') : ''}</p><p role="alert" class="error">${e(error)}</p>${!activeCount() ? starterPanel() : ''}` });
  }
  function bookPage() {
    const book = books().find(item => item.id === shelf.open);
    if (!book) { shelf.open = null; shelf.card = null; return cardsView().replace('</section>', '</section>' + tabs()); }
    if (shelf.card) { const card = data.cards.find(item => item.id === shelf.card); if (card) return cardPageView(book, `<p role="alert" class="error">${e(error)}</p>${cardView(card)}`); shelf.card = null; }
    const due = new Set(dueIds()), q = shelf.query.trim().toLowerCase();
    const mine = liveCards().filter(card => card.module === book.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(card => ({ ...card, due: due.has(card.id) }));
    const shown = mine.filter(card => (!shelf.dueOnly || card.due) && (!q || `${card.title} ${card.summary} ${card.category}`.toLowerCase().includes(q)));
    const other = text('待分类', 'Uncategorized'), groups = new Map();
    for (const card of shown) { const key = card.category?.trim() || other; if (!groups.has(key)) groups.set(key, []); groups.get(key).push(card); }
    const chapters = [...groups].map(([name, cards]) => ({ name, cards })).sort((a, b) => (a.name === other) - (b.name === other) || a.name.localeCompare(b.name, intlLocale(currentLocale())));
    return bookView({ book, chapters, total: mine.length, dueCount: mine.filter(card => card.due).length, dueOnly: shelf.dueOnly, query: shelf.query, searching: shelf.searching, chapter: null });
  }
  const SHELF_ERRORS = { keepOne: () => text('书架上至少要留一本书。', 'Keep at least one book on the shelf.'), nameError: () => text('书名需为 1–20 个字，且不能和别的书重名。', 'Book names must be 1–20 characters and not repeat another book.'),
    tooMany: () => text('最多 {n} 本自己建的书。', 'Up to {n} books of your own.', { n: MAX_CUSTOM_MODULES }), storageError: () => text('保存失败，请稍后再试。', 'Could not save. Try again later.') };
  const applyModules = change => { const result = updateModules(change); shelf.error = result ? (SHELF_ERRORS[result] || SHELF_ERRORS.storageError)() : ''; if (result) refresh(); return !result; };
  function openBook(id) {
    const el = document.querySelector(`[data-book="${id}"]`);
    animateOpen(el, () => { Object.assign(shelf, { open: id, card: null, selected: null, last: null, dueOnly: false, searching: false, query: '' }); refresh(); window.scrollTo(0, 0); });
  }
  async function deleteBook(id) {
    const book = books().find(item => item.id === id);
    if (!book) return;
    const body = isPresetModule(id) ? text('卡片都会保留，可以在学习设置里放回书架。', 'Its cards are kept; you can put it back in the learning settings.')
      : book.count ? text('卡片都会保留，可以在学习设置里恢复。', 'Its cards are kept and can be restored in the learning settings.') : text('这本书还是空的，会直接删除。', 'This book is empty and will be removed.');
    const title = isPresetModule(id) ? text('把「{name}」从书架移走？', 'Remove “{name}” from the shelf?', { name: book.name }) : text('删除「{name}」？', 'Delete “{name}”?', { name: book.name });
    shelf.sheet = null;
    if (!await confirmDialog(title, body, isPresetModule(id) ? text('移走', 'Remove') : text('删除', 'Delete'))) { refresh(); return; }
    const slot = document.querySelector(`[data-book="${id}"]`)?.closest('.book-slot');
    if (slot?.animate && !matchMedia('(prefers-reduced-motion: reduce)').matches) await Promise.race([slot.animate([{ transform: 'none', opacity: 1 }, { transform: 'translateY(16px) scale(.6) rotate(-8deg)', opacity: 0 }], { duration: 280, easing: 'ease-in', fill: 'forwards' }).finished.catch(() => {}), new Promise(r => setTimeout(r, 340))]);
    if (shelf.selected === id) shelf.selected = null;
    applyModules((modules, { hasData }) => { if (isCustomModule(id) && !hasData(id)) delete modules[id]; else Object.assign(modules[id], { archived: true, enabled: false }); });
  }
  function shelfBind() {
    if (shelf.open) {
      document.querySelector('[data-book-close]')?.addEventListener('click', () => { shelf.closing = shelf.open; Object.assign(shelf, { open: null, card: null }); refresh(); });
      document.querySelector('[data-card-close]')?.addEventListener('click', () => { shelf.card = null; refresh(); window.scrollTo(0, 0); });
      document.querySelector('[data-book-search]')?.addEventListener('click', () => { shelf.searching = !shelf.searching; if (!shelf.searching) shelf.query = ''; refresh(); document.querySelector('#book-query')?.focus(); });
      const input = document.querySelector('#book-query');
      if (input) input.oninput = () => { shelf.query = input.value; refresh(); const next = document.querySelector('#book-query'); next?.focus(); next?.setSelectionRange(next.value.length, next.value.length); };
      document.querySelectorAll('[data-book-card]').forEach(button => { button.onclick = () => { shelf.card = button.dataset.bookCard; refresh(); window.scrollTo(0, 0); }; });
      document.querySelector('[data-toc-due]')?.addEventListener('click', () => { shelf.dueOnly = !shelf.dueOnly; refresh(); window.scrollTo(0, 0); });
      const tocButtons = [...document.querySelectorAll('[data-toc]')];
      tocButtons.forEach(button => { button.onclick = () => {
        if (button.dataset.toc === '') { if (shelf.dueOnly) { shelf.dueOnly = false; refresh(); } window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
        const top = document.querySelector(`#book-chapter-${button.dataset.toc}`)?.getBoundingClientRect().top;
        if (top !== undefined) window.scrollTo({ top: window.scrollY + top - 64, behavior: 'smooth' });
      }; });
      // The chapter being read is highlighted in the contents.
      const chapters = [...document.querySelectorAll('[data-chapter]')];
      const mark = () => { if (!chapters[0]?.isConnected) { removeEventListener('scroll', mark); return; }
        let current = -1; for (const heading of chapters) if (heading.getBoundingClientRect().top < 140) current = Number(heading.dataset.chapter);
        tocButtons.forEach(button => button.classList.toggle('active', button.dataset.toc === '' ? current < 0 && !shelf.dueOnly : button.dataset.toc === String(current))); };
      if (chapters.length) { addEventListener('scroll', mark, { passive: true }); mark(); }
      return;
    }
    if (shelf.closing) { const el = document.querySelector(`[data-book="${shelf.closing}"]`); shelf.closing = null; el?.scrollIntoView({ block: 'center' }); animateClose(el); }
    document.querySelectorAll('[data-book]').forEach(button => {
      const id = button.dataset.book;
      let press = 0, long = false;
      button.addEventListener('pointerdown', event => { if (event.button > 0) return; long = false; clearTimeout(press); press = setTimeout(() => { long = true; navigator.vibrate?.(12); Object.assign(shelf, { editing: true, sheet: id, selected: null }); refresh(); }, 500); });
      ['pointerup', 'pointerleave', 'pointercancel'].forEach(type => button.addEventListener(type, () => clearTimeout(press)));
      button.addEventListener('contextmenu', event => event.preventDefault());
      button.addEventListener('click', () => {
        if (long) { long = false; return; }
        if (shelf.editing) { shelf.sheet = id; refresh(); return; }
        if (shelf.selected === id) { openBook(id); return; }
        Object.assign(shelf, { last: shelf.selected, selected: id }); refresh();
      });
    });
    document.querySelector('[data-book-open]')?.addEventListener('click', event => openBook(event.currentTarget.dataset.bookOpen));
    // A tap on the shelf itself (not a book) turns the chosen book back into its spine.
    document.querySelector('.shelf')?.addEventListener('click', event => { if (shelf.selected && !event.target.closest('button')) { Object.assign(shelf, { last: shelf.selected, selected: null }); refresh(); } });
    document.querySelector('[data-shelf-mode]')?.addEventListener('click', () => { shelf.mode = shelf.mode === 'cover' ? 'spine' : 'cover'; try { localStorage.setItem(SHELF_MODE_KEY, shelf.mode); } catch { /* This visit only. */ } refresh(); });
    document.querySelector('[data-shelf-menu]')?.addEventListener('click', () => { shelf.menu = true; refresh(); });
    document.querySelector('[data-shelf-done]')?.addEventListener('click', () => { Object.assign(shelf, { editing: false, sheet: null }); refresh(); });
    document.querySelectorAll('[data-book-delete]').forEach(button => { button.onclick = () => deleteBook(button.dataset.bookDelete); });
    document.querySelector('[data-sheet-close]')?.addEventListener('click', event => { if (event.target === event.currentTarget) { Object.assign(shelf, { sheet: null, menu: false }); refresh(); } });
    document.querySelectorAll('[data-menu]').forEach(button => { button.onclick = async () => {
      shelf.menu = false;
      if (button.dataset.menu === 'trash') { trash = true; refresh(); return; }
      refresh(); if (busy || blocked) return; for (const origin of origins()) { await ingest(origin); if (error) break; }
    }; });
    document.querySelectorAll('[data-sheet]').forEach(button => { button.onclick = async () => {
      const id = shelf.sheet, action = button.dataset.sheet, item = getProfile()?.modules?.[id];
      if (action === 'cancel' || !id) { Object.assign(shelf, { sheet: null, menu: false }); refresh(); return; }
      if (action === 'delete') { deleteBook(id); return; }
      shelf.sheet = null; refresh();
      const answer = await bookDialog({ title: action === 'rename' ? text('改名', 'Rename') : text('换封面颜色', 'Cover colour'), name: moduleName(id), color: coverColor(getProfile(), id), askName: action === 'rename' });
      if (!answer || !item) return;
      applyModules(modules => { if (action === 'rename') modules[id].name = cleanModuleName(answer.name); modules[id].color = answer.color; });
    }; });
    document.querySelector('[data-book-new]')?.addEventListener('click', async () => {
      const used = new Set(books().map(book => book.color));
      const answer = await bookDialog({ title: text('新书', 'New book'), color: ['lavender', 'teal', 'rose', 'olive', 'sky', 'sage', 'honey', 'coral'].find(c => !used.has(c)) || 'lavender', askIcon: true });
      if (!answer) return;
      const name = cleanModuleName(answer.name);
      if (!name) return;
      applyModules(modules => { modules[newCustomModuleId()] = { enabled: true, level: 'beginner', name, icon: answer.icon, color: answer.color }; });
    });
  }
  function cardsView() {
    if (phone() && !trash) return `<section class="intro"><span class="eyebrow">${text('知识库','Knowledge library')}</span><h1>${text('让问过的，成为记得住的。','Keep what you learn.')}</h1></section>${shelfHtml()}`;
    const visible = data.cards.filter(card => (trash ? card.status === 'deleted' : ['active','paused'].includes(card.status)) && (!moduleFilter || card.module === moduleFilter) && (!dateFilter || card.origins.some(origin => localDay(origin.createdAt) === dateFilter)) && (!query || `${card.title} ${card.summary} ${card.category} ${card.origins.map(origin=>origin.question).join(' ')}`.toLowerCase().includes(query.toLowerCase()))).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
    let day = '';
    return `<section class="intro"><span class="eyebrow">${text('知识库','Knowledge library')}</span><h1>${text('让问过的，成为记得住的。','Keep what you learn.')}</h1></section>
      <div class="panel library-controls"><label>${text('模块','Module')}<select id="knowledge-module"><option value="">${text('全部','All')}</option>${[...new Set([...moduleOptions(moduleFilter),...data.cards.map(card=>card.module)])].map(id=>`<option value="${id}" ${id===moduleFilter?'selected':''}>${name(id)}</option>`).join('')}</select></label><label>${text('提问日期','Question date')}<input id="knowledge-date" type="date" value="${e(dateFilter)}"></label><label>${text('搜索','Search')}<input id="knowledge-search" type="text" value="${e(query)}"></label><button class="secondary-button" id="knowledge-search-button">${text('筛选','Filter')}</button><button class="text-button" id="knowledge-trash">${(trash?text('返回知识库','Back to library'):text('回收站','Trash'))}</button></div>
      <div class="backfill-row"><button class="secondary-button" id="knowledge-backfill" ${busy || blocked?'disabled':''}>${text('整理尚未入库的历史问答（调用模型）','Organize missing past Q&A (uses model)')}</button><details class="backfill-note"><summary aria-label="${text('关于整理','About organizing')}">ⓘ</summary><p class="muted">${text('知识提炼会额外调用一次已配置模型，仅发送该条问答及当前模块最多 40 个候选标题；不额外搜索。未完成提炼的记录会保留，便于重试。','Extraction uses an additional model call: this Q&A and up to 40 candidate titles in its original module. No extra web search. Incomplete items are kept for retry.')}</p></details></div>
      <p role="status" class="verified">${busy?text('正在整理知识点…','Organizing knowledge…'):''}</p><p role="alert" class="error">${e(error)}</p>
      ${visible.length?visible.map(card=>{const currentDay=dateFilter||localDay(card.createdAt); const heading=currentDay!==day?`<h2 class="day-heading">${e(currentDay)}</h2>`:'';day=currentDay;return heading+cardView(card);}).join(''):`<section class="panel empty-state"><h3>${text('还没有符合条件的知识点','No matching knowledge yet')}</h3><p>${text('先完成一次问答，知识点会自动加入；已有历史可点击上方整理。','Complete a Q&A to add knowledge automatically, or organize existing chats above.')}</p></section>${!trash && !activeCount() ? starterPanel() : ''}`}`;
  }
  function cardView(card) {
    return `<article class="panel knowledge-card"><div class="section-heading"><span class="eyebrow">${name(card.module)} · ${e(card.category||text('待分类','Uncategorized'))}</span>${card.origins.length?`<span class="pill">${card.origins.length} ${text('次提问','questions')}</span>`:''}</div><h3>${e(card.title)}</h3><div class="card-badges">${card.important?`<span class="pill">★ ${text('重点','Important')} · ${text(card.reason==='repeated'?'重复提问':card.reason==='wrong'?'复习答错':card.reason==='unclear'?'仍不理解':'手动标注',card.reason==='repeated'?'Repeated':card.reason==='wrong'?'Incorrect review':card.reason==='unclear'?'Still unclear':'Manual')}</span>`:''}${card.extraction==='pending'?`<span class="pill">${text('待提炼 · 原回答摘录','Pending · answer excerpt')}</span>`:''}${card.status==='paused'?`<span class="pill">${text('已暂停复习','Review paused')}</span>`:''}${isStarterCard(card)?`<span class="pill">${text('知回入门卡片','Starter card')}</span>`:''}</div><div class="knowledge-summary">${renderAnswer(card.summary)}</div>${card.example?`<p><strong>${text('生活例子','Everyday example')}</strong> · ${e(card.example)}</p>`:''}
      ${card.origins.length?`<details data-section="origins:${card.id}" ${opened(`origins:${card.id}`)}><summary>${text('查看原始问答与日期','Original Q&A and dates')} (${card.origins.length})</summary>${card.origins.map(origin=>`<section class="origin"><span class="muted">${e(new Date(origin.createdAt).toLocaleString(intlLocale(currentLocale())))} · ${name(origin.sourceModule)}</span><h4>${e(origin.question)}</h4><div class="message-content">${renderAnswer(origin.answer)}</div></section>`).join('')}</details>`:''}
      ${card.status==='deleted'?`<button class="secondary-button" data-restore-card="${card.id}">${text('恢复','Restore')}</button>`:`<div class="card-actions"><button class="text-button" data-important="${card.id}">${text(card.important?'取消重点':'标为重点',card.important?'Unmark':'Mark important')}</button><button class="text-button" data-pause="${card.id}">${(card.status==='paused'?text('恢复复习','Resume review'):text('暂停复习','Pause review'))}</button><button class="text-button" data-open-mindmap="${card.id}">${text('思维导图','Mind map')}</button><button class="text-button" data-delete-card="${card.id}">${text('移入回收站','Move to trash')}</button>${card.extraction==='pending'?`<button class="secondary-button" data-extract-card="${card.id}">${text('重试提炼','Retry extraction')}</button>`:''}</div>
      <details data-section="edit:${card.id}" ${edits.has(card.id)?'open':opened(`edit:${card.id}`)}><summary>${text('编辑、调整分类或合并','Edit, recategorize or merge')}${edits.has(card.id)?` · ${text('有未保存的修改','Unsaved changes')}`:''}</summary><form data-card-edit="${card.id}"><label>${text('标题','Title')}<input name="title" type="text" value="${e(field(card,'title'))}" maxlength="120" required></label><label>${text('模块','Module')}<select name="module">${moduleOptions(card.module).map(id=>`<option value="${id}" ${field(card,'module')===id?'selected':''}>${name(id)}</option>`).join('')}</select></label><label>${text('分类','Category')}<input name="category" type="text" value="${e(field(card,'category'))}" maxlength="60"></label><label>${text('核心解释','Core explanation')}<textarea name="summary" maxlength="2400" required>${e(field(card,'summary'))}</textarea></label><label>${text('生活例子','Example')}<textarea name="example" maxlength="1200">${e(field(card,'example'))}</textarea></label><button class="secondary-button" type="submit">${text('保存修改','Save changes')}</button>${edits.has(card.id)?`<button class="text-button" type="button" data-discard-edit="${card.id}">${text('放弃修改','Discard changes')}</button>`:''}</form><div class="merge-row"><select data-merge-target="${card.id}" aria-label="${text('合并到','Merge into')}"><option value="">${text('选择同模块的目标卡片','Select a target in the same module')}</option>${data.cards.filter(other=>other.id!==card.id && other.module===card.module && ['active','paused'].includes(other.status)).map(other=>`<option value="${other.id}" ${mergeChoices.get(card.id)===other.id?'selected':''}>${e(other.title)}</option>`).join('')}</select><button class="secondary-button" data-merge-card="${card.id}">${text('合并到所选卡片','Merge into selected')}</button></div><p class="field-hint">${text('合并保留目标解释和全部原始问答；暂停不会删除记录。','Merging keeps the target explanation and all original Q&A. Pausing keeps records.')}</p></details>`}</article>`;
  }
  function cardsBind() {
    // The filter row exists only in the list view (the phone bookshelf has its own controls).
    const control = selector => document.querySelector(selector) || {};
    control('#knowledge-module').onchange=event=>{moduleFilter=event.target.value;refresh();};
    control('#knowledge-date').onchange=event=>{dateFilter=event.target.value;refresh();};
    control('#knowledge-search').oninput=event=>{query=event.target.value;};
    control('#knowledge-search-button').onclick=()=>refresh();
    control('#knowledge-trash').onclick=()=>{trash=!trash;refresh();};
    const mutate = (selector,action) => document.querySelectorAll(selector).forEach(button=>{button.disabled=busy||blocked;button.onclick=()=>{action(data.cards.find(card=>card.id===button.dataset[Object.keys(button.dataset)[0]]));save();refresh();};});
    mutate('[data-important]',card=>{card.important=!card.important;card.reason=card.important?'manual':'';});
    mutate('[data-pause]',card=>{card.status=card.status==='paused'?'active':'paused';});
    mutate('[data-delete-card]',card=>{card.status='deleted';});
    mutate('[data-restore-card]',card=>{card.status='active';});
    document.querySelectorAll('[data-extract-card]').forEach(button=>{button.disabled=busy||blocked;button.onclick=()=>ingest(data.cards.find(card=>card.id===button.dataset.extractCard).origins[0]);});
    document.querySelectorAll('[data-card-edit]').forEach(form=>{form.onsubmit=event=>{event.preventDefault();if(busy||blocked)return;const card=data.cards.find(item=>item.id===form.dataset.cardEdit);const fields=new FormData(form);if(!fields.get('title').trim()||!fields.get('summary').trim())return;const edited={...card,extraction:'ready'};for(const key of ['title','summary','category','example','module'])edited[key]=String(fields.get(key)).trim();
      // Never save an edit the loader would later reject.
      if(!validCard(edited)){error=text('修改内容超出长度限制或模块无效，未保存。','The edit exceeds length limits or uses an invalid module. Not saved.');refresh();return;}
      Object.assign(card,edited);error='';if(save())edits.delete(card.id);refresh();};
      form.oninput=form.onchange=()=>{const card=data.cards.find(item=>item.id===form.dataset.cardEdit);if(!card)return;const fields=new FormData(form),draft={};for(const key of ['title','summary','category','example','module'])draft[key]=String(fields.get(key));
        if(['title','summary','category','example','module'].every(key=>draft[key]===card[key]))edits.delete(card.id);else edits.set(card.id,draft);};});
    document.querySelectorAll('[data-discard-edit]').forEach(button=>{button.onclick=()=>{edits.delete(button.dataset.discardEdit);refresh();};});
    document.querySelectorAll('[data-merge-target]').forEach(select=>{select.onchange=()=>{if(select.value)mergeChoices.set(select.dataset.mergeTarget,select.value);else mergeChoices.delete(select.dataset.mergeTarget);};});
    document.querySelectorAll('details[data-section]').forEach(details=>{details.ontoggle=()=>{if(details.open)openSections.add(details.dataset.section);else openSections.delete(details.dataset.section);};});
    document.querySelectorAll('[data-merge-card]').forEach(button=>{button.disabled=busy||blocked;button.onclick=()=>{const target=document.querySelector(`[data-merge-target="${button.dataset.mergeCard}"]`).value;if(!target)return;mergeCards(data,target,button.dataset.mergeCard);mergeChoices.delete(button.dataset.mergeCard);edits.delete(button.dataset.mergeCard);save();refresh();};});
    control('#knowledge-backfill').onclick=async()=>{if(busy||blocked)return;for(const origin of origins()){await ingest(origin);if(error)break;}};
  }
  // Starter cards: added only when the user asks; cards already in the library (same id) are skipped.
  function addCards(list) {
    if (blocked) return 0;
    const have = new Set(data.cards.map(card => card.id)), fresh = list.filter(card => !have.has(card.id) && validCard(card));
    if (!fresh.length) return 0;
    data.cards.push(...fresh);
    if (save()) return fresh.length;
    data.cards.splice(data.cards.length - fresh.length); return 0;
  }
  function activeCount() { return data.cards.filter(card => ['active','paused'].includes(card.status)).length; }
  return {view,bind,ingest,reload:load,addCards,activeCount,hasCard:id=>data.cards.some(card=>card.id===id),get busy(){return busy||panel.busy;},cards:()=>data.cards,markWeak(id,reason){const card=data.cards.find(item=>item.id===id);if(card){card.important=true;card.reason=reason;save();}},count:module=>data.cards.filter(card=>card.module===module&&card.status==='active').length};
}
