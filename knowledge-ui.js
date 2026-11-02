import { KNOWLEDGE_KEY, emptyKnowledge, loadKnowledge, addKnowledge, mergeCards, localDay, validCard } from './knowledge-store.js';
import { escapeHtml as e, renderAnswer } from './chat-store.js';
import { createMemoryPanel } from './memory-ui.js';
import { isStarterCard } from './starter-content.js';

export function createKnowledgeUI({ locale, enabled, moduleName, extract, refresh, origins, reviews, dueIds, googleClientId, relate, expand, starterPanel = () => '' }) {
  const text = (zh,en) => locale() === 'zh' ? zh : en;
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
  function view() { return tab === 'cards' ? cardsView().replace('</section>', '</section>' + tabs()) : `<section class="intro"><span class="eyebrow">${text('知识库', 'Knowledge library')}</span><h1>${text('让问过的，成为记得住的。', 'Keep what you learn.')}</h1></section>${tabs()}${panel.view(tab)}`; }
  function bind() {
    document.querySelectorAll('[data-library-tab]').forEach(button => { button.onclick = () => { if (busy || panel.busy) return; tab = button.dataset.libraryTab; refresh(); }; });
    document.querySelectorAll('[data-open-mindmap]').forEach(button => { button.onclick = () => { panel.select(button.dataset.openMindmap); tab = 'mindmap'; refresh(); window.scrollTo(0, 0); }; });
    if (tab === 'cards') cardsBind(); else panel.bind(tab);
  }
  function cardsView() {
    const visible = data.cards.filter(card => (trash ? card.status === 'deleted' : ['active','paused'].includes(card.status)) && (!moduleFilter || card.module === moduleFilter) && (!dateFilter || card.origins.some(origin => localDay(origin.createdAt) === dateFilter)) && (!query || `${card.title} ${card.summary} ${card.category} ${card.origins.map(origin=>origin.question).join(' ')}`.toLowerCase().includes(query.toLowerCase()))).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
    let day = '';
    return `<section class="intro"><span class="eyebrow">${text('知识库','Knowledge library')}</span><h1>${text('让问过的，成为记得住的。','Keep what you learn.')}</h1><p>${text('自动整理与分类；同义提问谨慎合并，重复提问标为重点。可在顶部进入逐题复习。','Automatic extraction and categories; repeated concepts are highlighted. Open Review above to practice one idea at a time.')}</p></section>
      <div class="panel library-controls"><label>${text('模块','Module')}<select id="knowledge-module"><option value="">${text('全部','All')}</option>${[...new Set([...moduleOptions(moduleFilter),...data.cards.map(card=>card.module)])].map(id=>`<option value="${id}" ${id===moduleFilter?'selected':''}>${name(id)}</option>`).join('')}</select></label><label>${text('提问日期','Question date')}<input id="knowledge-date" type="date" value="${e(dateFilter)}"></label><label>${text('搜索','Search')}<input id="knowledge-search" type="text" value="${e(query)}"></label><button class="secondary-button" id="knowledge-search-button">${text('筛选','Filter')}</button><button class="text-button" id="knowledge-trash">${text(trash?'返回知识库':'回收站',trash?'Back to library':'Trash')}</button></div>
      <p class="muted">${text('知识提炼会额外调用一次已配置模型，仅发送该条问答及当前模块最多 40 个候选标题；不额外搜索。未完成提炼的记录会保留，便于重试。','Extraction uses an additional model call: this Q&A and up to 40 candidate titles in its original module. No extra web search. Incomplete items are kept for retry.')}</p>
      <button class="secondary-button" id="knowledge-backfill" ${busy || blocked?'disabled':''}>${text('整理尚未入库的历史问答（调用模型）','Organize missing past Q&A (uses model)')}</button>
      <p role="status" class="verified">${busy?text('正在整理知识点…','Organizing knowledge…'):''}</p><p role="alert" class="error">${e(error)}</p>
      ${visible.length?visible.map(card=>{const currentDay=dateFilter||localDay(card.createdAt); const heading=currentDay!==day?`<h2 class="day-heading">${e(currentDay)}</h2>`:'';day=currentDay;return heading+cardView(card);}).join(''):`<section class="panel empty-state"><h3>${text('还没有符合条件的知识点','No matching knowledge yet')}</h3><p>${text('先完成一次问答，知识点会自动加入；已有历史可点击上方整理。','Complete a Q&A to add knowledge automatically, or organize existing chats above.')}</p></section>${!trash && !activeCount() ? starterPanel() : ''}`}`;
  }
  function cardView(card) {
    return `<article class="panel knowledge-card"><div class="section-heading"><span class="eyebrow">${name(card.module)} · ${e(card.category||text('待分类','Uncategorized'))}</span><span class="pill">${card.origins.length} ${text('次提问','questions')}</span></div><h3>${e(card.title)}</h3><div class="card-badges">${card.important?`<span class="pill">★ ${text('重点','Important')} · ${text(card.reason==='repeated'?'重复提问':card.reason==='wrong'?'复习答错':card.reason==='unclear'?'仍不理解':'手动标注',card.reason==='repeated'?'Repeated':card.reason==='wrong'?'Incorrect review':card.reason==='unclear'?'Still unclear':'Manual')}</span>`:''}${card.extraction==='pending'?`<span class="pill">${text('待提炼 · 原回答摘录','Pending · answer excerpt')}</span>`:''}${card.status==='paused'?`<span class="pill">${text('已暂停复习','Review paused')}</span>`:''}${isStarterCard(card)?`<span class="pill">${text('知回入门卡片','Starter card')}</span>`:''}</div><div class="knowledge-summary">${renderAnswer(card.summary)}</div>${card.example?`<p><strong>${text('生活例子','Everyday example')}</strong> · ${e(card.example)}</p>`:''}
      <details data-section="origins:${card.id}" ${opened(`origins:${card.id}`)}><summary>${text('查看原始问答与日期','Original Q&A and dates')} (${card.origins.length})</summary>${card.origins.map(origin=>`<section class="origin"><span class="muted">${e(new Date(origin.createdAt).toLocaleString(locale()==='zh'?'zh-CN':'en'))} · ${name(origin.sourceModule)}</span><h4>${e(origin.question)}</h4><div class="message-content">${renderAnswer(origin.answer)}</div></section>`).join('')}</details>
      ${card.status==='deleted'?`<button class="secondary-button" data-restore-card="${card.id}">${text('恢复','Restore')}</button>`:`<div class="card-actions"><button class="text-button" data-important="${card.id}">${text(card.important?'取消重点':'标为重点',card.important?'Unmark':'Mark important')}</button><button class="text-button" data-pause="${card.id}">${text(card.status==='paused'?'恢复复习':'暂停复习',card.status==='paused'?'Resume review':'Pause review')}</button><button class="text-button" data-open-mindmap="${card.id}">${text('思维导图','Mind map')}</button><button class="text-button" data-delete-card="${card.id}">${text('移入回收站','Move to trash')}</button>${card.extraction==='pending'?`<button class="secondary-button" data-extract-card="${card.id}">${text('重试提炼','Retry extraction')}</button>`:''}</div>
      <details data-section="edit:${card.id}" ${edits.has(card.id)?'open':opened(`edit:${card.id}`)}><summary>${text('编辑、调整分类或合并','Edit, recategorize or merge')}${edits.has(card.id)?` · ${text('有未保存的修改','Unsaved changes')}`:''}</summary><form data-card-edit="${card.id}"><label>${text('标题','Title')}<input name="title" type="text" value="${e(field(card,'title'))}" maxlength="120" required></label><label>${text('模块','Module')}<select name="module">${moduleOptions(card.module).map(id=>`<option value="${id}" ${field(card,'module')===id?'selected':''}>${name(id)}</option>`).join('')}</select></label><label>${text('分类','Category')}<input name="category" type="text" value="${e(field(card,'category'))}" maxlength="60"></label><label>${text('核心解释','Core explanation')}<textarea name="summary" maxlength="2400" required>${e(field(card,'summary'))}</textarea></label><label>${text('生活例子','Example')}<textarea name="example" maxlength="1200">${e(field(card,'example'))}</textarea></label><button class="secondary-button" type="submit">${text('保存修改','Save changes')}</button>${edits.has(card.id)?`<button class="text-button" type="button" data-discard-edit="${card.id}">${text('放弃修改','Discard changes')}</button>`:''}</form><div class="merge-row"><select data-merge-target="${card.id}" aria-label="${text('合并到','Merge into')}"><option value="">${text('选择同模块的目标卡片','Select a target in the same module')}</option>${data.cards.filter(other=>other.id!==card.id && other.module===card.module && ['active','paused'].includes(other.status)).map(other=>`<option value="${other.id}" ${mergeChoices.get(card.id)===other.id?'selected':''}>${e(other.title)}</option>`).join('')}</select><button class="secondary-button" data-merge-card="${card.id}">${text('合并到所选卡片','Merge into selected')}</button></div><p class="field-hint">${text('合并保留目标解释和全部原始问答；暂停不会删除记录。','Merging keeps the target explanation and all original Q&A. Pausing keeps records.')}</p></details>`}</article>`;
  }
  function cardsBind() {
    document.querySelector('#knowledge-module').onchange=event=>{moduleFilter=event.target.value;refresh();};
    document.querySelector('#knowledge-date').onchange=event=>{dateFilter=event.target.value;refresh();};
    document.querySelector('#knowledge-search').oninput=event=>{query=event.target.value;};
    document.querySelector('#knowledge-search-button').onclick=()=>refresh();
    document.querySelector('#knowledge-trash').onclick=()=>{trash=!trash;refresh();};
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
    document.querySelector('#knowledge-backfill').onclick=async()=>{if(busy||blocked)return;for(const origin of origins()){await ingest(origin);if(error)break;}};
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
