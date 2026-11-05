import { memoryPoints, moduleCurves, moduleStyles, curveSvg, legend, attachVizInteraction, graphEdges } from './memory-viz.js';
import { mountGraph } from './graph-view.js';
import { buildMindmap, mindmapSvg } from './mindmap.js';
import { tap, downloadPng, downloadSvg, downloadText, nodeAt, editTree, validTree, treeMarkdown, safeFileName } from './viz-edit.js';
// Saved model results: semantic relations between ideas and per-idea mind map expansions.
const RELATIONS_KEY = 'knowledge-review.relations.v1', MINDMAP_KEY = 'knowledge-review.mindmaps.v1';
// The user's own edits, kept on this device and never overwritten by model results:
// graph layout per view and added/removed connections; mind maps edited by hand.
const GRAPH_KEY = 'knowledge-review.graph.v1', MINDMAP_EDIT_KEY = 'knowledge-review.mindmap-edits.v1';
const pairKey = (a, b) => [a, b].sort().join('|');
import { latestReview } from './review-store.js';
import { buildDocx, DOCX_TYPE } from './docx.js';
import { googleToken, uploadAsGoogleDoc } from './google-docs.js';
import { escapeHtml as e, renderAnswer } from './chat-store.js';
import { pick, intlLocale, currentLocale } from './i18n.js';
// Library panels: forgetting curve, knowledge graph and export of reviewed knowledge (Word download, Google Docs).
export function createMemoryPanel({ locale, cards, reviews, dueIds, moduleName, modules, googleClientId, refresh, relate, expand, updateCard = () => false, openTab }) {
  const text = (zh, en, vars) => pick(zh, en, vars);
  let exportModule = '', scope = 'reviewed', message = '', busy = false, docLink = '';
  // Graph and mind map state. Model results (semantic relations, mind map expansions) are saved on this device.
  // theme null = follow the app's day/night mode until the user picks one in the graph toolbar.
  let theme = null, relationMode = 'basic', graphMessage = '', mindmapId = '', mindmapMessage = '';
  const collapsed = new Set();
  // Zoomed-in views (double-click / double-tap): one module's curve, one module's graph, one mind map branch.
  let curveFocus = '', graphFocus = '', graphEdit = '', linksOpen = false, mindmapFocus = null, mindmapSelected = null, editNow = false;
  const graphEdits = () => { const saved = store.read(GRAPH_KEY, null); return { positions: saved?.positions && typeof saved.positions === 'object' ? saved.positions : {},
    added: Array.isArray(saved?.added) ? saved.added.filter(p => typeof p?.a === 'string' && typeof p?.b === 'string' && p.a !== p.b) : [], removed: Array.isArray(saved?.removed) ? saved.removed.filter(key => typeof key === 'string') : [] }; };
  const writeGraphEdits = change => { const next = graphEdits(); change(next); return store.write(GRAPH_KEY, { version: 1, ...next }); };
  // Layout per view ("all" or a module); nodes the user dragged are restored pinned where they were left.
  const layouts = new Map();
  function positionsFor(scopeKey) {
    if (!layouts.has(scopeKey)) layouts.set(scopeKey, new Map(Object.entries(graphEdits().positions[scopeKey] || {}).filter(([, p]) => Number.isFinite(p?.x) && Number.isFinite(p?.y)).map(([id, p]) => [id, { x: p.x, y: p.y, fixed: true }])));
    return layouts.get(scopeKey);
  }
  const saveLayout = scopeKey => writeGraphEdits(edits => { edits.positions[scopeKey] = Object.fromEntries([...positionsFor(scopeKey)].filter(([, p]) => p.fixed).slice(0, 400).map(([id, p]) => [id, { x: Math.round(p.x), y: Math.round(p.y) }])); });
  const graphTheme = () => theme || (document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light');
  const store = { read(key, fallback) { try { const value = JSON.parse(localStorage.getItem(key)); return value?.version === 1 ? value : fallback; } catch { return fallback; } }, write(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; } } };
  const activeCards = () => cards().filter(card => card.status === 'active' && card.extraction === 'ready');
  // Basic relations come from existing data: same category in a module, or ideas from the same conversation.
  function basicRelations(list) {
    const pairs = graphEdges(list.map(card => ({ id: card.id, module: card.module, category: card.category }))).map(([a, b]) => ({ a, b, label: '' })), seen = new Set(pairs.map(p => [p.a, p.b].sort().join('|')));
    const byThread = new Map();
    for (const card of list) for (const thread of new Set(card.origins.map(origin => origin.threadId))) byThread.set(thread, [...(byThread.get(thread) || []), card.id]);
    for (const ids of byThread.values()) for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length && pairs.length < 300; j++) { const key = [ids[i], ids[j]].sort().join('|'); if (!seen.has(key)) { seen.add(key); pairs.push({ a: ids[i], b: ids[j], label: '' }); } }
    return pairs;
  }
  const semanticRelations = list => { const ids = new Set(list.map(card => card.id)), saved = store.read(RELATIONS_KEY, null); return { at: saved?.generatedAt || null, pairs: (saved?.pairs || []).filter(p => ids.has(p.a) && ids.has(p.b) && p.a !== p.b) }; };
  // Connections the user removed stay hidden and ones they added are kept, in both basic and semantic modes.
  function relationsFor(list) {
    const ids = new Set(list.map(card => card.id)), edits = graphEdits(), removed = new Set(edits.removed);
    const pairs = (relationMode === 'semantic' ? semanticRelations(list).pairs : basicRelations(list)).filter(p => !removed.has(pairKey(p.a, p.b))), seen = new Set(pairs.map(p => pairKey(p.a, p.b)));
    for (const p of edits.added) if (ids.has(p.a) && ids.has(p.b) && !seen.has(pairKey(p.a, p.b)) && !removed.has(pairKey(p.a, p.b))) { seen.add(pairKey(p.a, p.b)); pairs.push({ a: p.a, b: p.b, label: '', custom: true }); }
    return pairs;
  }
  const relatedTitles = (card, list) => { const byId = new Map(list.map(item => [item.id, item.title])); return relationsFor(list).filter(p => p.a === card.id || p.b === card.id).map(p => `${byId.get(p.a === card.id ? p.b : p.a)}${p.label ? `（${p.label}）` : ''}`); };
  const ratingName0 = rating => ({ wrong: text('答错', 'Missed'), unclear: text('还不懂', 'Unclear'), guessed: text('猜对', 'Guessed'), understood: text('理解', 'Understood'), mastered: text('掌握', 'Mastered') })[rating] || text('未复习', 'Not reviewed');
  const labels = () => ({ locale: intlLocale(currentLocale()), x: text('日期', 'Date'), y: text('估计记忆保持率', 'Estimated retention'), today: text('今天', 'Today'), todayDue: text('今天复习', 'Review today'), graph: text('知识图谱', 'Knowledge graph'),
    filled: text('实心：今天需要复习', 'Filled: review today'), hollow: text('空心：之后复习（画在复习日期上）', 'Hollow: review later (on its date)'), dueCount: n => text('今天 {n} 个', 'today {n}', { n }), rating: ratingName0,
    module: text('模块', 'Module'), last: text('上次复习', 'Last review'), estimate: text('估计保持率', 'Estimated retention'), next: text('下次复习', 'Next review'), asked: text('提问次数', 'Times asked') });
  const points = () => memoryPoints(cards(), reviews(), dueIds());
  const styles = () => moduleStyles([...new Set([...modules(), ...cards().map(card => card.module)])]);
  const ratingName = rating => ({ wrong: text('答错', 'Missed'), unclear: text('还不懂', 'Unclear'), guessed: text('猜对', 'Guessed'), understood: text('理解', 'Understood'), mastered: text('掌握', 'Mastered') })[rating] || text('未复习', 'Not reviewed');
  function selectedCards() {
    const data = reviews();
    return cards().filter(card => ['active', 'paused'].includes(card.status) && card.extraction === 'ready' && (!exportModule || card.module === exportModule)).filter(card => {
      const last = latestReview(data, card.id);
      return scope === 'all' || (scope === 'reviewed' ? Boolean(last) : ['understood', 'mastered'].includes(last?.rating));
    });
  }
  // Layout: title and date, one heading per module, then each card with explanation, example and review status.
  function documentBlocks(list) {
    const data = reviews(), date = new Date().toLocaleDateString(intlLocale(currentLocale()));
    const blocks = [{ style: 'Title', text: text('知回 · 我的知识整理', 'KnowBack · My notes') }, { style: 'Meta', text: text('导出于 {date} · 共 {v0} 个知识点', 'Exported {date} · {v0} ideas', { date, v0: list.length }) }];
    for (const id of [...new Set(list.map(card => card.module))]) {
      blocks.push({ style: 'Heading1', text: moduleName(id) });
      for (const card of list.filter(item => item.module === id)) {
        const last = latestReview(data, card.id);
        blocks.push({ style: 'Heading2', text: card.title }, { style: 'Normal', text: card.summary });
        if (card.example) blocks.push({ style: 'Normal', text: `${text('生活例子：', 'Example: ')}${card.example}` });
        blocks.push({ style: 'Meta', text: [card.category, `${text('最近复习', 'Last review')}: ${last ? `${ratingName(last.rating)} · ${new Date(last.at).toLocaleDateString(intlLocale(currentLocale()))}` : ratingName(null)}`, `${text('提问', 'Asked')} ${card.origins.length} ${text('次', 'times')}`].filter(Boolean).join(' · ') });
      }
    }
    return blocks;
  }
  const fileName = () => `knowledge-review-${new Date().toISOString().slice(0, 10)}`;
  function view(tab) {
    const list = points(), style = styles(), dueModules = [...new Set(list.filter(p => p.today).map(p => p.module))];
    const summary = dueModules.length ? text('今天需要复习：{v0}。', 'Review today: {v1}.', { v0: dueModules.map(id => `${moduleName(id)} ${list.filter(p => p.today && p.module === id).length} 个`).join('、'), v1: dueModules.map(id => `${moduleName(id)} ${list.filter(p => p.today && p.module === id).length}`).join(', ') }) : text('今天没有需要复习的知识。', 'Nothing to review today.');
    const empty = `<p>${text('还没有可显示的知识点。', 'No ideas to show yet.')}</p>`;
    if (tab === 'curve' && curveFocus) return curveDetail(list, style);
    if (tab === 'curve') return `<section class="panel"><h2>${text('遗忘曲线', 'Forgetting curve')}</h2><p><strong>${e(summary)}</strong></p><p>${text('每条线是一个模块的平均记忆保持率：随时间下降，复习后回升。虚线是“今天”。实心点是今天要复习的知识，空心点是之后要复习的知识，画在它的复习日期上。把鼠标停在点上（手机上点一下）可查看详情。', 'Each line is a module’s average retention: it falls over time and rises after reviews. The dashed line is today. Filled points are ideas to review today; hollow points come later, on their review date. Hover a point (tap on a phone) for details.')}</p><p class="viz-hint">${text('双击一条曲线（或下方图例里的模块）查看这个模块的详情。', 'Double-click a line (or a module in the legend) to open that module.')}</p>${list.length ? curveSvg(list, moduleCurves(cards(), reviews()), style, moduleName, labels()) + legend(style, moduleName, list, labels()) : empty}<p class="field-hint">${text('保持率由复习安排所用的 FSRS 记忆模型估算（到期时约 90%），使用默认参数，不是根据你个人的长期学习数据校准的结果。', 'Retention comes from the FSRS memory model used for review scheduling (about 90% when due), with default parameters, not calibrated on your own long-term data.')}</p></section>`;
    if (tab === 'graph') {
      const semantic = semanticRelations(activeCards());
      const shown = graphCards(), editing = shown.find(card => card.id === graphEdit);
      return `<section class="panel"><div class="viz-head">${graphFocus ? backButton('graph-back') : ''}<h2>${text('知识图谱', 'Knowledge graph')}${graphFocus ? ` · ${e(moduleName(graphFocus))}` : ''}</h2></div>
        ${graphFocus ? '' : `<p><strong>${e(summary)}</strong></p>`}<p class="viz-hint">${graphFocus ? text('双击知识点修改标题；拖动节点调整位置（会被记住）；在下方“编辑连线”里添加或删除连线。点一下知识点打开它的思维导图。', 'Double-click an idea to rename it; drag nodes to arrange them (remembered); add or remove links under Edit links. Tap an idea to open its mind map.') : text('双击模块（大圆）只看这个模块；双击知识点修改标题。拖动节点调整位置，拖动空白处平移，滚轮缩放；点一下知识点打开它的思维导图。带光晕的是今天要复习的知识。', 'Double-click a module (large circle) to see only that module; double-click an idea to rename it. Drag nodes to arrange them, drag the background to pan, scroll to zoom; tap an idea to open its mind map. Glowing ideas are due today.')}</p>
        ${editing ? `<div class="viz-editor"><label class="field-label" for="graph-title">${text('修改标题', 'Rename idea')}</label><div class="viz-editor-row"><input id="graph-title" type="text" maxlength="120" value="${e(editing.title)}"><button class="primary-button" id="graph-title-save">${text('保存', 'Save')}</button><button class="text-button" id="graph-title-cancel">${text('取消', 'Cancel')}</button></div><p class="field-hint">${text('会同时修改知识库里这张卡片的标题。', 'This also renames the card in your library.')}</p></div>` : ''}
        <div class="graph-toolbar"><div class="segmented" role="group" aria-label="${text('外观', 'Appearance')}"><button data-graph-theme="light" class="${graphTheme() === 'light' ? 'active' : ''}">${text('浅色', 'Light')}</button><button data-graph-theme="dark" class="${graphTheme() === 'dark' ? 'active' : ''}">${text('深色星空', 'Dark')}</button></div>
          <div class="segmented" role="group" aria-label="${text('连线关系', 'Connections')}"><button data-graph-relations="basic" class="${relationMode === 'basic' ? 'active' : ''}">${text('基础关系', 'Basic')}</button><button data-graph-relations="semantic" class="${relationMode === 'semantic' ? 'active' : ''}">${text('语义关系', 'Semantic')}</button></div>
          ${relationMode === 'semantic' ? `<button class="secondary-button" id="graph-analyze" ${busy ? 'disabled' : ''}>${semantic.at ? text('重新分析关联', 'Analyze again') : text('分析关联（调用模型）', 'Analyze relations (uses model)')}</button>` : ''}<button class="text-button" id="graph-reset">${text('重新排布', 'Reset layout')}</button></div>
        <p class="field-hint">${relationMode === 'basic' ? text('基础关系：同一模块中分类相同，或来自同一次对话的知识点相连。不调用模型。', 'Basic: ideas sharing a category in a module, or from the same conversation, are linked. No model call.') : semantic.at ? text('语义关系：由模型于 {v0} 分析，共 {v1} 条，连线上标注关系。模型可能判断错误。', 'Semantic: analysed by the model at {v2}, {v1} links labelled with the relation. The model can be wrong.', { v0: new Date(semantic.at).toLocaleString(intlLocale(currentLocale())), v1: semantic.pairs.length, v2: new Date(semantic.at).toLocaleString('en') }) : text('语义关系：点击“分析关联”，将知识点标题（最多 60 个）发送给已配置的模型来找出概念之间的关系。会产生模型费用，结果只保存在本机。', 'Semantic: click Analyze to send up to 60 idea titles to your configured model to find conceptual relations. This uses model credit; results stay on this device.')}</p>
        ${shown.length ? `<div id="graph-host"></div>` : empty}${graphFocus && shown.length > 1 ? linksEditor(shown) : ''}<p class="verified" role="status">${busy ? text('正在分析…', 'Analysing…') : ''}</p><p class="error" role="alert">${e(graphMessage)}</p></section>`;
    }
    if (tab === 'mindmap') {
      const list = activeCards(), card = list.find(item => item.id === mindmapId) || list[0], expansion = card && store.read(MINDMAP_KEY, { items: {} }).items[card.id];
      if (card) mindmapId = card.id;
      const edited = card && editedTree(card.id), tree = card && (edited || autoTree(card, list));
      if (tree && mindmapFocus !== null && !tree.children?.[mindmapFocus]) mindmapFocus = null;
      if (tree && mindmapSelected !== null && !nodeAt(tree, mindmapSelected)) mindmapSelected = null;
      const node = tree && mindmapSelected !== null ? nodeAt(tree, mindmapSelected) : null, isRoot = mindmapSelected === '';
      return `<section class="panel"><div class="viz-head">${mindmapFocus !== null ? backButton('mm-back') : ''}<h2>${text('思维导图', 'Mind map')}${mindmapFocus !== null && tree ? ` · ${e(tree.children[mindmapFocus].label)}` : ''}</h2>${card ? `<div class="viz-downloads"><button class="text-button" id="mm-png">${text('下载 PNG', 'PNG')}</button><button class="text-button" id="mm-svg">${text('下载 SVG', 'SVG')}</button><button class="text-button" id="mm-md">${text('下载 Markdown', 'Markdown')}</button></div>` : ''}</div>
        <p class="viz-hint">${mindmapFocus !== null ? text('双击任意节点修改文字；选中节点后可添加子节点或删除。下载只包含这个分支。', 'Double-click any node to edit it; select a node to add a child or delete it. Downloads include this branch only.') : text('点击分支展开或收起；双击分支放大进入；双击其他节点修改文字。', 'Click a branch to expand or collapse it; double-click a branch to zoom in; double-click other nodes to edit them.')}</p>
        ${node ? `<div class="viz-editor"><label class="field-label" for="mm-input">${isRoot ? text('修改中心主题', 'Edit the centre') : text('修改节点', 'Edit node')}</label><div class="viz-editor-row"><input id="mm-input" type="text" maxlength="200" value="${e(node.label)}"><button class="primary-button" id="mm-save">${text('保存', 'Save')}</button></div>
          <div class="viz-editor-row"><button class="secondary-button" id="mm-add">＋ ${text('添加子节点', 'Add child')}</button><button class="text-button danger-text" id="mm-delete" ${isRoot ? 'disabled' : ''}>${text('删除', 'Delete')}</button><button class="text-button" id="mm-cancel">${text('取消', 'Cancel')}</button></div></div>` : ''}
        ${card && mindmapFocus === null ? `<div class="library-controls"><label>${text('知识点', 'Idea')}<select id="mindmap-card">${list.map(item => `<option value="${item.id}" ${item.id === card.id ? 'selected' : ''}>${e(moduleName(item.module))} · ${e(item.title)}</option>`).join('')}</select></label><button class="secondary-button" id="mindmap-expand" ${busy ? 'disabled' : ''}>${expansion ? text('重新用模型展开', 'Expand again with model') : text('用模型展开（调用模型）', 'Expand with model (uses model)')}</button></div>
        <p class="field-hint">${expansion ? text('带 ✦ 的分支由模型于 {v0} 生成，仅供参考，可能有误。', 'Branches marked ✦ were generated by the model at {v1}; they may be wrong.', { v0: new Date(expansion.generatedAt).toLocaleString('zh-CN'), v1: new Date(expansion.generatedAt).toLocaleString('en') }) : text('默认只使用这张卡片已有的内容，不调用模型。“用模型展开”会把这张卡片的标题、解释和例子发给已配置的模型，补充前置知识、子概念、常见误区和延伸应用，会产生费用。', 'By default only this card’s own content is used. Expand sends the card’s title, explanation and example to your model to add prerequisites, sub-concepts, misconceptions and applications; this uses model credit.')}</p>
        ${edited ? `<p class="field-hint">${text('这张思维导图已手动修改，模型展开只会追加新分支，不会覆盖你的修改。', 'This mind map was edited by hand; model expansion only adds new branches and never overwrites your edits.')} <button class="text-button" id="mm-reset">${text('恢复自动生成', 'Restore generated version')}</button></p>` : ''}` : ''}
        ${card ? mindmapSvg(tree, collapsed, { focus: mindmapFocus, selected: mindmapSelected }) : empty}<p class="verified" role="status">${busy ? text('正在展开…', 'Expanding…') : ''}</p><p class="error" role="alert">${e(mindmapMessage)}</p></section>`;
    }
    const chosen = selectedCards();
    return `<section class="panel"><h2>${text('导出复习好的知识', 'Export reviewed knowledge')}</h2><p>${text('选择范围后下载 Word 文档，或直接写入在线文档。只有你点击按钮时才会生成或发送。', 'Choose what to include, then download a Word document or send it to an online document. Nothing is generated or sent until you click.')}</p>
      <div class="library-controls"><label>${text('模块', 'Module')}<select id="export-module"><option value="">${text('全部', 'All')}</option>${modules().map(id => `<option value="${id}" ${id === exportModule ? 'selected' : ''}>${e(moduleName(id))}</option>`).join('')}</select></label><label>${text('范围', 'Include')}<select id="export-scope"><option value="reviewed" ${scope === 'reviewed' ? 'selected' : ''}>${text('已复习过的知识', 'Reviewed ideas')}</option><option value="stable" ${scope === 'stable' ? 'selected' : ''}>${text('已理解或掌握的知识', 'Understood or mastered')}</option><option value="all" ${scope === 'all' ? 'selected' : ''}>${text('全部知识点', 'All ideas')}</option></select></label></div>
      <p class="muted">${text('将包含 {v0} 个知识点。', '{v0} ideas will be included.', { v0: chosen.length })}</p>
      <div class="followups"><button class="primary-button" id="export-word" ${busy || !chosen.length ? 'disabled' : ''}>${text('下载 Word 文档', 'Download Word document')}</button><button class="secondary-button" id="export-google" ${busy || !chosen.length || !googleClientId() ? 'disabled' : ''}>${text('保存到 Google 文档', 'Save to Google Docs')}</button></div>
      <p class="field-hint">${googleClientId() ? text('将打开 Google 授权窗口，只请求“创建和访问本应用建立的文件”权限，上传后转换为 Google 文档。', 'A Google sign-in window opens asking only to create and access files this app makes; the upload is converted to a Google Doc.') : text('Google 文档：服务器尚未配置 GOOGLE_CLIENT_ID，暂不可用（见 cloud-setup.md）。', 'Google Docs: the server has no GOOGLE_CLIENT_ID configured yet (see cloud-setup.md).')}</p>
      <p class="field-hint">${text('飞书云文档：直接写入需要飞书开放平台应用的 App ID 和 Secret，目前未接通。可先下载 Word，再在飞书云文档中选择“导入”。', 'Feishu Docs: writing directly needs a Feishu Open Platform app (App ID and Secret) and is not connected yet. Download the Word file and use Import in Feishu Docs.')}</p>
      ${docLink ? `<p class="verified"><a class="inline-link" href="${e(docLink)}" target="_blank" rel="noopener noreferrer">${text('打开已创建的 Google 文档', 'Open the new Google Doc')} ↗</a></p>` : ''}
      <p class="verified" role="status">${busy ? text('正在处理…', 'Working…') : ''}</p><p class="error" role="alert">${e(message)}</p>
      ${chosen.length ? `<details><summary>${text('预览', 'Preview')}</summary>${chosen.slice(0, 20).map(card => `<h3>${e(card.title)}</h3><div class="knowledge-summary">${renderAnswer(card.summary)}</div>`).join('')}</details>` : ''}</section>`;
  }
  // Mind maps: generated from the card (plus any model expansion) until the user edits one; then the edited tree is used.
  const autoTree = (card, list) => { const expansion = store.read(MINDMAP_KEY, { items: {} }).items[card.id];
    return buildMindmap(card, { moduleName, related: relatedTitles(card, list), events: reviews().events.filter(event => event.cardId === card.id).sort((a, b) => a.at.localeCompare(b.at)), expansion: expansion?.branches, labels: mindmapLabels() }); };
  const mindmapEdits = () => { const saved = store.read(MINDMAP_EDIT_KEY, null); return saved?.items && typeof saved.items === 'object' ? saved.items : {}; };
  const editedTree = id => { const tree = mindmapEdits()[id]?.tree; return validTree(tree) ? tree : null; };
  function writeEditedTree(id, tree) {
    const items = mindmapEdits(); if (tree) items[id] = { editedAt: new Date().toISOString(), tree }; else delete items[id];
    // Keep the 200 most recently edited mind maps.
    const kept = Object.entries(items).sort((a, b) => String(b[1].editedAt).localeCompare(String(a[1].editedAt))).slice(0, 200);
    if (!store.write(MINDMAP_EDIT_KEY, { version: 1, items: Object.fromEntries(kept) })) { mindmapMessage = text('本机存储已满，修改未保存。', 'Local storage is full; the edit was not saved.'); return false; }
    return true;
  }
  // Ideas shown in the graph: all of them, or one module's after a double-click on its hub.
  const graphCards = () => activeCards().filter(card => !graphFocus || card.module === graphFocus);
  function linksEditor(list) {
    const titles = new Map(list.map(card => [card.id, card.title])), pairs = relationsFor(list);
    const options = list.map(card => `<option value="${e(card.id)}">${e(card.title)}</option>`).join('');
    return `<details class="viz-editor graph-links-editor" ${linksOpen ? 'open' : ''}><summary>${text('编辑连线（{v0} 条）', 'Edit links ({v0})', { v0: pairs.length })}</summary>
      <div class="viz-editor-row"><select id="link-a" aria-label="${text('知识点 A', 'Idea A')}">${options}</select><select id="link-b" aria-label="${text('知识点 B', 'Idea B')}">${options}</select><button class="secondary-button" id="link-add">${text('添加连线', 'Add link')}</button></div>
      <ul class="link-list">${pairs.map(p => `<li><span>${e(titles.get(p.a))} — ${e(titles.get(p.b))}${p.label ? ` <em>${e(p.label)}</em>` : ''}${p.custom ? ` <span class="pill">${text('手动', 'Manual')}</span>` : ''}</span><button class="text-button" data-link-remove="${e(pairKey(p.a, p.b))}">${text('删除', 'Remove')}</button></li>`).join('')}</ul></details>`;
  }
  const backButton = id => `<button class="secondary-button viz-back" id="${id}">← ${text('返回', 'Back')}</button>`;
  const dateText = value => new Date(value).toLocaleDateString(intlLocale(currentLocale()));
  // One module's curve, enlarged, with every idea in it: last and next review, estimated retention, quick actions.
  function curveDetail(allPoints, style) {
    const module = curveFocus, points = allPoints.filter(p => p.module === module), byId = new Map(points.map(p => [p.id, p])), data = reviews(), curve = moduleCurves(cards(), reviews()).get(module);
    const list = cards().filter(card => card.module === module && ['active', 'paused'].includes(card.status) && card.extraction === 'ready').sort((a, b) => (byId.get(a.id)?.offset ?? 999) - (byId.get(b.id)?.offset ?? 999));
    const rows = list.map(card => { const p = byId.get(card.id), last = latestReview(data, card.id), paused = card.status === 'paused';
      return `<li class="curve-row${p?.today ? ' is-today' : ''}"><div class="curve-row-main"><strong>${e(card.title)}</strong>${card.important ? `<span class="pill">${text('重点', 'Important')}</span>` : ''}${paused ? `<span class="pill">${text('已暂停', 'Paused')}</span>` : ''}</div>
        <div class="curve-row-meta"><span>${text('上次', 'Last')}：${last ? `${dateText(last.at)} · ${ratingName(last.rating)}` : ratingName(null)}</span><span>${text('下次', 'Next')}：${paused ? '—' : p ? (p.today ? text('今天', 'Today') : p.nextDue) : text('60 天后', 'In 60+ days')}</span><span>${text('保持率', 'Retention')}：${p ? `${Math.round(p.retention)}%` : '—'}</span></div>
        <div class="curve-row-actions"><button class="text-button" data-curve-important="${e(card.id)}">${card.important ? text('取消重点', 'Unmark') : text('标为重点', 'Mark important')}</button><button class="text-button" data-curve-pause="${e(card.id)}">${paused ? text('恢复复习', 'Resume') : text('暂停复习', 'Pause')}</button></div></li>`; }).join('');
    return `<section class="panel"><div class="viz-head">${backButton('curve-back')}<h2>${text('遗忘曲线', 'Forgetting curve')} · ${e(moduleName(module))}</h2></div>
      <p><strong>${text('共 {v0} 个知识点，今天需要复习 {v1} 个。', '{v0} ideas, {v1} due today.', { v0: list.length, v1: points.filter(p => p.today).length })}</strong></p>
      ${points.length && curve ? `<div class="curve-zoom">${curveSvg(points, new Map([[module, curve]]), style, moduleName, labels())}</div>` : ''}
      ${list.length ? `<ul class="curve-list">${rows}</ul>` : `<p>${text('这个模块还没有知识点。', 'No ideas in this module yet.')}</p>`}<p class="error" role="alert">${e(graphMessage)}</p></section>`;
  }
  const mindmapLabels = () => ({ locale: intlLocale(currentLocale()), points: text('核心要点', 'Key points'), example: text('生活例子', 'Example'), belongs: text('模块与分类', 'Module & category'), related: text('相关知识', 'Related ideas'), questions: text('原始提问', 'Questions asked'), history: text('复习记录', 'Review history'), rating: ratingName,
    ai: { prerequisites: text('前置知识', 'Prerequisites'), subconcepts: text('子概念', 'Sub-concepts'), misconceptions: text('常见误区', 'Misconceptions'), applications: text('延伸应用', 'Applications') } });
  const modelError = error => error?.message === 'key' ? text('请先在“模型设置”中配置 Key 并确认发送说明。', 'Configure your model key and sharing notice in Model settings first.') : text('模型请求未完成，请检查 Key 和网络后重试。', 'The model request did not finish. Check your key and network, then retry.');
  function bindGraph() {
    document.querySelectorAll('[data-graph-theme]').forEach(button => { button.onclick = () => { theme = button.dataset.graphTheme; refresh(); }; });
    document.querySelectorAll('[data-graph-relations]').forEach(button => { button.onclick = () => { relationMode = button.dataset.graphRelations; graphMessage = ''; refresh(); }; });
    const host = document.querySelector('#graph-host'), scopeKey = graphFocus || 'all', on = (selector, handler) => { const element = document.querySelector(selector); if (element) element.onclick = handler; };
    on('#graph-back', () => { graphFocus = ''; graphEdit = ''; refresh(); });
    on('#graph-title-cancel', () => { graphEdit = ''; refresh(); });
    on('#graph-title-save', () => {
      const value = document.querySelector('#graph-title').value.replace(/\s+/g, ' ').trim();
      if (!value || value.length > 120) { graphMessage = text('标题需为 1–120 个字。', 'Titles need 1–120 characters.'); refresh(); return; }
      graphMessage = updateCard(graphEdit, card => { card.title = value; }) ? '' : text('标题未保存，请刷新后重试。', 'The title was not saved. Reload and try again.'); graphEdit = ''; refresh();
    });
    const titleInput = document.querySelector('#graph-title'); if (titleInput) { titleInput.focus(); titleInput.onkeydown = event => { if (event.key === 'Enter') document.querySelector('#graph-title-save').click(); if (event.key === 'Escape') document.querySelector('#graph-title-cancel').click(); }; }
    const linkPanel = document.querySelector('.graph-links-editor'); if (linkPanel) linkPanel.ontoggle = () => { linksOpen = linkPanel.open; };
    on('#link-add', () => {
      const a = document.querySelector('#link-a').value, b = document.querySelector('#link-b').value; if (!a || a === b) { graphMessage = text('请选择两个不同的知识点。', 'Choose two different ideas.'); refresh(); return; }
      writeGraphEdits(edits => { edits.removed = edits.removed.filter(key => key !== pairKey(a, b)); if (!edits.added.some(p => pairKey(p.a, p.b) === pairKey(a, b))) edits.added.push({ a, b }); }); graphMessage = ''; refresh();
    });
    document.querySelectorAll('[data-link-remove]').forEach(button => { button.onclick = () => { const key = button.dataset.linkRemove; writeGraphEdits(edits => { edits.added = edits.added.filter(p => pairKey(p.a, p.b) !== key); if (!edits.removed.includes(key)) edits.removed.push(key); }); refresh(); }; });
    if (host) {
      const list = graphCards(), today = dueIds(), style = moduleStyles([...new Set([...modules(), ...list.map(card => card.module)])]), data = reviews();
      const nodes = [...new Set(list.map(card => card.module))].map(id => ({ id: `hub:${id}`, label: moduleName(id), kind: 'hub', module: id, color: style.get(id).color, size: 3, detail: [['strong', moduleName(id)], ['span', text('{v0} 个知识点', '{v0} ideas', { v0: list.filter(card => card.module === id).length })]] }))
        .concat(list.slice(0, 160).map(card => { const last = latestReview(data, card.id); return { id: card.id, label: card.title.replace(/^示例：/, ''), kind: 'card', module: card.module, color: style.get(card.module).color, size: card.origins.length, today: today.has(card.id),
          detail: [['strong', card.title], ['span', `${text('模块', 'Module')}：${moduleName(card.module)}${card.category ? ` · ${card.category}` : ''}`], ['span', `${text('上次复习', 'Last review')}：${last ? `${new Date(last.at).toLocaleDateString(intlLocale(currentLocale()))} · ${ratingName(last.rating)}` : ratingName(null)}`], ['span', today.has(card.id) ? text('今天需要复习', 'Review today') : text('今天不用复习', 'Not due today')], ['span', text('点一下打开思维导图 · 双击修改标题', 'Tap to open its mind map · double-click to rename')]] }; }));
      const links = list.slice(0, 160).map(card => ({ source: `hub:${card.module}`, target: card.id, kind: 'spoke' })).concat(relationsFor(list).map(p => ({ source: p.a, target: p.b, kind: 'relation', label: p.label })));
      const positions = positionsFor(scopeKey);
      const graph = mountGraph(host, { nodes, links, theme: graphTheme(), positions,
        onOpen: id => { mindmapId = id; mindmapFocus = null; mindmapSelected = null; collapsed.clear(); openTab('mindmap'); },
        // Double tap: a module hub zooms into (or back out of) that module; an idea opens its title editor.
        onDouble: node => { if (node.kind === 'hub') { graphFocus = graphFocus ? '' : node.module; graphEdit = ''; } else graphEdit = node.id; refresh(); },
        onMoved: () => saveLayout(scopeKey) });
      document.querySelector('#graph-reset').onclick = () => { positions.clear(); saveLayout(scopeKey); graph.reset(); };
    }
    const analyze = document.querySelector('#graph-analyze');
    if (analyze) analyze.onclick = async () => {
      if (busy) return; busy = true; graphMessage = ''; refresh();
      try {
        const list = activeCards().slice(0, 60), result = await relate(list.map(card => ({ id: card.id, title: card.title, module: moduleName(card.module), category: card.category })));
        if (!store.write(RELATIONS_KEY, { version: 1, generatedAt: new Date().toISOString(), pairs: result.relations })) graphMessage = text('本机存储已满，关系未保存。', 'Local storage is full; relations were not saved.');
      } catch (error) { graphMessage = modelError(error); }
      finally { busy = false; refresh(); }
    };
  }
  function bindMindmap() {
    const select = document.querySelector('#mindmap-card');
    if (select) select.onchange = () => { mindmapId = select.value; collapsed.clear(); mindmapFocus = null; mindmapSelected = null; mindmapMessage = ''; refresh(); };
    const card = activeCards().find(item => item.id === mindmapId), list = activeCards(), current = () => card && (editedTree(card.id) || autoTree(card, list));
    const on = (selector, handler) => { const element = document.querySelector(selector); if (element) element.onclick = handler; };
    // Overview: a tap folds a branch, a double tap zooms into it; other nodes are selected (tap) or edited (double tap).
    // Zoomed in: tap selects, double tap edits.
    document.querySelectorAll('.mm-node').forEach(node => {
      const path = node.dataset.path, branch = mindmapFocus === null && node.classList.contains('mm-branch');
      const single = () => { if (branch) { const i = Number(node.dataset.branch); if (collapsed.has(i)) collapsed.delete(i); else collapsed.add(i); } else mindmapSelected = path; refresh(); };
      const double = () => { if (branch) { mindmapFocus = Number(node.dataset.branch); mindmapSelected = null; } else { mindmapSelected = path; editNow = true; } refresh(); };
      node.onclick = () => tap(`mm:${mindmapId}:${mindmapFocus}:${path}`, single, double);
      node.onkeydown = event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); single(); } if (event.key === 'F2') { event.preventDefault(); mindmapSelected = path; editNow = true; refresh(); } };
    });
    const input = document.querySelector('#mm-input');
    if (input) { if (editNow) { input.focus(); input.select(); } editNow = false; input.onkeydown = event => { if (event.key === 'Enter') document.querySelector('#mm-save').click(); if (event.key === 'Escape') document.querySelector('#mm-cancel').click(); }; }
    const change = op => { const tree = current(); if (!tree) return null; const next = editTree(tree, { ...op, path: mindmapSelected }); if (!next) { mindmapMessage = text('这个修改无法完成（文字不能为空，层级最多 4 层）。', 'That change is not possible (text cannot be empty; at most 4 levels).'); refresh(); return null; } mindmapMessage = ''; return writeEditedTree(card.id, next) ? next : null; };
    on('#mm-back', () => { mindmapFocus = null; mindmapSelected = null; refresh(); });
    on('#mm-cancel', () => { mindmapSelected = null; refresh(); });
    on('#mm-save', () => { if (change({ op: 'rename', label: document.querySelector('#mm-input').value })) mindmapSelected = null; refresh(); });
    on('#mm-add', () => { const next = change({ op: 'add', label: text('新节点', 'New node') }); if (next) { const count = nodeAt(next, mindmapSelected).children.length; mindmapSelected = [mindmapSelected, count - 1].filter(part => part !== '').join('.'); editNow = true; } refresh(); });
    on('#mm-delete', () => { const path = mindmapSelected; if (change({ op: 'delete' })) { mindmapSelected = null; collapsed.clear(); if (!path.includes('.') || path === String(mindmapFocus)) mindmapFocus = null; } refresh(); });
    on('#mm-reset', () => { if (card && confirm(text('恢复后，你对这张思维导图的修改会被清除。继续吗？', 'Restoring clears your edits to this mind map. Continue?'))) { writeEditedTree(card.id, null); mindmapSelected = null; mindmapFocus = null; collapsed.clear(); refresh(); } });
    // Downloads cover what is on screen: the whole map, or the zoomed-in branch.
    const shownTree = () => { const tree = current(); return mindmapFocus !== null && tree?.children?.[mindmapFocus] ? tree.children[mindmapFocus] : tree; };
    const mmFile = () => `${safeFileName(text('知回-思维导图', 'mind-map'))}-${safeFileName(shownTree()?.label)}`, mmSvg = () => document.querySelector('svg.mindmap');
    on('#mm-svg', () => { if (mmSvg()) downloadSvg(mmSvg(), `${mmFile()}.svg`); });
    on('#mm-png', () => { if (mmSvg()) downloadPng(mmSvg(), `${mmFile()}.png`).catch(() => { mindmapMessage = text('图片生成失败，请改用 SVG。', 'The image could not be made; try SVG.'); refresh(); }); });
    on('#mm-md', () => { const tree = shownTree(); if (tree) downloadText(treeMarkdown(tree), `${mmFile()}.md`, 'text/markdown'); });
    const expandButton = document.querySelector('#mindmap-expand');
    if (expandButton) expandButton.onclick = async () => {
      const card = activeCards().find(item => item.id === mindmapId); if (!card || busy) return;
      busy = true; mindmapMessage = ''; refresh();
      try {
        const result = await expand(card), saved = store.read(MINDMAP_KEY, { version: 1, items: {} });
        saved.items[card.id] = { generatedAt: new Date().toISOString(), branches: result };
        // Keep the most recent 200 expansions so the stored data stays small.
        const kept = Object.entries(saved.items).sort((a, b) => b[1].generatedAt.localeCompare(a[1].generatedAt)).slice(0, 200);
        if (!store.write(MINDMAP_KEY, { version: 1, items: Object.fromEntries(kept) })) mindmapMessage = text('本机存储已满，展开结果未保存。', 'Local storage is full; the expansion was not saved.');
        // A hand-edited map keeps the user's version; new model branches (✦) are appended if not there yet.
        const edited = editedTree(card.id);
        if (edited) { const have = new Set((edited.children || []).map(branch => branch.label)), added = autoTree(card, activeCards()).children.filter(branch => branch.label.startsWith('✦') && !have.has(branch.label));
          if (added.length) writeEditedTree(card.id, { ...edited, children: [...(edited.children || []), ...added].slice(0, 40) }); }
      } catch (error) { mindmapMessage = modelError(error); }
      finally { busy = false; refresh(); }
    };
  }
  // Forgetting curve: double-click a line or a legend entry to open that module; the detail view has quick actions.
  function bindCurve() {
    document.querySelectorAll('[data-curve-module],[data-legend-module]').forEach(element => {
      const module = element.dataset.curveModule || element.dataset.legendModule;
      element.addEventListener('click', () => tap(`curve:${module}`, () => {}, () => { curveFocus = module; graphMessage = ''; refresh(); window.scrollTo(0, 0); }));
    });
    const back = document.querySelector('#curve-back'); if (back) back.onclick = () => { curveFocus = ''; refresh(); };
    const act = (attribute, change) => document.querySelectorAll(`[data-${attribute}]`).forEach(button => { button.onclick = () => { if (!updateCard(button.getAttribute(`data-${attribute}`), change)) graphMessage = text('未保存，请刷新后重试。', 'Not saved. Reload and try again.'); refresh(); }; });
    act('curve-important', card => { card.important = !card.important; card.reason = card.important ? 'manual' : ''; });
    act('curve-pause', card => { card.status = card.status === 'paused' ? 'active' : 'paused'; });
  }
  function bind(tab) {
    if (tab === 'graph') { bindGraph(); return; }
    if (tab === 'mindmap') { bindMindmap(); return; }
    if (tab !== 'export') { bindCurve(); attachVizInteraction(document.querySelector('main'), labels()); return; }
    document.querySelector('#export-module').onchange = event => { exportModule = event.target.value; docLink = ''; refresh(); };
    document.querySelector('#export-scope').onchange = event => { scope = event.target.value; docLink = ''; refresh(); };
    document.querySelector('#export-word').onclick = () => {
      const bytes = buildDocx(documentBlocks(selectedCards()), { title: text('知回 · 我的知识整理', 'KnowBack · My notes') });
      const url = URL.createObjectURL(new Blob([bytes], { type: DOCX_TYPE })), a = document.createElement('a');
      a.href = url; a.download = `${fileName()}.docx`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    };
    document.querySelector('#export-google').onclick = async () => {
      if (busy) return; busy = true; message = ''; docLink = ''; refresh();
      try { const token = await googleToken(googleClientId()); const bytes = buildDocx(documentBlocks(selectedCards())); docLink = await uploadAsGoogleDoc(token, text('知回 · 我的知识整理', 'KnowBack notes'), bytes); }
      catch (error) { message = error.code === 'closed' ? text('授权窗口已关闭，未上传。', 'The sign-in window was closed. Nothing was uploaded.') : error.code === 'popup' ? text('浏览器阻止了授权窗口，请允许弹出窗口后重试。', 'The browser blocked the sign-in window. Allow pop-ups and try again.') : text('上传到 Google 文档未完成，请稍后重试。', 'Uploading to Google Docs did not finish. Try again later.'); }
      finally { busy = false; refresh(); }
    };
  }
  return { view, bind, select: id => { mindmapId = id; mindmapFocus = null; mindmapSelected = null; collapsed.clear(); }, get busy() { return busy; } };
}
