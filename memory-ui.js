import { memoryPoints, moduleCurves, moduleStyles, curveSvg, legend, attachVizInteraction, graphEdges } from './memory-viz.js';
import { mountGraph } from './graph-view.js';
import { buildMindmap, mindmapSvg } from './mindmap.js';
// Saved model results: semantic relations between ideas and per-idea mind map expansions.
const RELATIONS_KEY = 'knowledge-review.relations.v1', MINDMAP_KEY = 'knowledge-review.mindmaps.v1';
import { latestReview } from './review-store.js';
import { buildDocx, DOCX_TYPE } from './docx.js';
import { googleToken, uploadAsGoogleDoc } from './google-docs.js';
import { escapeHtml as e, renderAnswer } from './chat-store.js';
// Library panels: forgetting curve, knowledge graph and export of reviewed knowledge (Word download, Google Docs).
export function createMemoryPanel({ locale, cards, reviews, dueIds, moduleName, modules, googleClientId, refresh, relate, expand, openTab }) {
  const text = (zh, en) => locale() === 'zh' ? zh : en;
  let exportModule = '', scope = 'reviewed', message = '', busy = false, docLink = '';
  // Graph and mind map state. Model results (semantic relations, mind map expansions) are saved on this device.
  let theme = 'light', relationMode = 'basic', graphMessage = '', mindmapId = '', mindmapMessage = '';
  const positions = new Map(), collapsed = new Set();
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
  const relationsFor = list => relationMode === 'semantic' ? semanticRelations(list).pairs : basicRelations(list);
  const relatedTitles = (card, list) => { const byId = new Map(list.map(item => [item.id, item.title])); return relationsFor(list).filter(p => p.a === card.id || p.b === card.id).map(p => `${byId.get(p.a === card.id ? p.b : p.a)}${p.label ? `（${p.label}）` : ''}`); };
  const ratingName0 = rating => ({ wrong: text('答错', 'Missed'), unclear: text('还不懂', 'Unclear'), guessed: text('猜对', 'Guessed'), understood: text('理解', 'Understood'), mastered: text('掌握', 'Mastered') })[rating] || text('未复习', 'Not reviewed');
  const labels = () => ({ locale: locale() === 'zh' ? 'zh-CN' : 'en', x: text('日期', 'Date'), y: text('估计记忆保持率', 'Estimated retention'), today: text('今天', 'Today'), todayDue: text('今天复习', 'Review today'), graph: text('知识图谱', 'Knowledge graph'),
    filled: text('实心：今天需要复习', 'Filled: review today'), hollow: text('空心：之后复习（画在复习日期上）', 'Hollow: review later (on its date)'), dueCount: n => text(`今天 ${n} 个`, `today ${n}`), rating: ratingName0,
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
    const data = reviews(), date = new Date().toLocaleDateString(locale() === 'zh' ? 'zh-CN' : 'en');
    const blocks = [{ style: 'Title', text: text('知回 · 我的知识整理', 'Knowledge Review · My notes') }, { style: 'Meta', text: text(`导出于 ${date} · 共 ${list.length} 个知识点`, `Exported ${date} · ${list.length} ideas`) }];
    for (const id of [...new Set(list.map(card => card.module))]) {
      blocks.push({ style: 'Heading1', text: moduleName(id) });
      for (const card of list.filter(item => item.module === id)) {
        const last = latestReview(data, card.id);
        blocks.push({ style: 'Heading2', text: card.title }, { style: 'Normal', text: card.summary });
        if (card.example) blocks.push({ style: 'Normal', text: `${text('生活例子：', 'Example: ')}${card.example}` });
        blocks.push({ style: 'Meta', text: [card.category, `${text('最近复习', 'Last review')}: ${last ? `${ratingName(last.rating)} · ${new Date(last.at).toLocaleDateString(locale() === 'zh' ? 'zh-CN' : 'en')}` : ratingName(null)}`, `${text('提问', 'Asked')} ${card.origins.length} ${text('次', 'times')}`].filter(Boolean).join(' · ') });
      }
    }
    return blocks;
  }
  const fileName = () => `knowledge-review-${new Date().toISOString().slice(0, 10)}`;
  function view(tab) {
    const list = points(), style = styles(), dueModules = [...new Set(list.filter(p => p.today).map(p => p.module))];
    const summary = dueModules.length ? text(`今天需要复习：${dueModules.map(id => `${moduleName(id)} ${list.filter(p => p.today && p.module === id).length} 个`).join('、')}。`, `Review today: ${dueModules.map(id => `${moduleName(id)} ${list.filter(p => p.today && p.module === id).length}`).join(', ')}.`) : text('今天没有需要复习的知识。', 'Nothing to review today.');
    const empty = `<p>${text('还没有可显示的知识点。', 'No ideas to show yet.')}</p>`;
    if (tab === 'curve') return `<section class="panel"><h2>${text('遗忘曲线', 'Forgetting curve')}</h2><p><strong>${e(summary)}</strong></p><p>${text('每条线是一个模块的平均记忆保持率：随时间下降，复习后回升。虚线是“今天”。实心点是今天要复习的知识，空心点是之后要复习的知识，画在它的复习日期上。把鼠标停在点上（手机上点一下）可查看详情。', 'Each line is a module’s average retention: it falls over time and rises after reviews. The dashed line is today. Filled points are ideas to review today; hollow points come later, on their review date. Hover a point (tap on a phone) for details.')}</p>${list.length ? curveSvg(list, moduleCurves(cards(), reviews()), style, moduleName, labels()) + legend(style, moduleName, list, labels()) : empty}<p class="field-hint">${text('保持率按常见的间隔复习近似公式估算（到期时约 90%），不是根据你的长期学习数据校准的结果。', 'Retention uses a common spaced-repetition approximation (about 90% when due), not a model calibrated on your long-term data.')}</p></section>`;
    if (tab === 'graph') {
      const semantic = semanticRelations(activeCards());
      return `<section class="panel"><h2>${text('知识图谱', 'Knowledge graph')}</h2><p><strong>${e(summary)}</strong></p><p>${text('拖动节点可以移动它（会固定在原处，双击解除固定）；拖动空白处平移，滚轮缩放。鼠标停在节点上会高亮相关知识，点击知识点打开它的思维导图。带光晕的是今天要复习的知识。', 'Drag a node to move it (it stays pinned; double-click to release). Drag the background to pan and scroll to zoom. Hover to highlight related ideas; click an idea to open its mind map. Glowing ideas are due today.')}</p>
        <div class="graph-toolbar"><div class="segmented" role="group" aria-label="${text('外观', 'Appearance')}"><button data-graph-theme="light" class="${theme === 'light' ? 'active' : ''}">${text('浅色', 'Light')}</button><button data-graph-theme="dark" class="${theme === 'dark' ? 'active' : ''}">${text('深色星空', 'Dark')}</button></div>
          <div class="segmented" role="group" aria-label="${text('连线关系', 'Connections')}"><button data-graph-relations="basic" class="${relationMode === 'basic' ? 'active' : ''}">${text('基础关系', 'Basic')}</button><button data-graph-relations="semantic" class="${relationMode === 'semantic' ? 'active' : ''}">${text('语义关系', 'Semantic')}</button></div>
          ${relationMode === 'semantic' ? `<button class="secondary-button" id="graph-analyze" ${busy ? 'disabled' : ''}>${semantic.at ? text('重新分析关联', 'Analyze again') : text('分析关联（调用模型）', 'Analyze relations (uses model)')}</button>` : ''}<button class="text-button" id="graph-reset">${text('重新排布', 'Reset layout')}</button></div>
        <p class="field-hint">${relationMode === 'basic' ? text('基础关系：同一模块中分类相同，或来自同一次对话的知识点相连。不调用模型。', 'Basic: ideas sharing a category in a module, or from the same conversation, are linked. No model call.') : semantic.at ? text(`语义关系：由模型于 ${new Date(semantic.at).toLocaleString(locale() === 'zh' ? 'zh-CN' : 'en')} 分析，共 ${semantic.pairs.length} 条，连线上标注关系。模型可能判断错误。`, `Semantic: analysed by the model at ${new Date(semantic.at).toLocaleString('en')}, ${semantic.pairs.length} links labelled with the relation. The model can be wrong.`) : text('语义关系：点击“分析关联”，将知识点标题（最多 60 个）发送给已配置的模型来找出概念之间的关系。会产生模型费用，结果只保存在本机。', 'Semantic: click Analyze to send up to 60 idea titles to your configured model to find conceptual relations. This uses model credit; results stay on this device.')}</p>
        ${activeCards().length ? `<div id="graph-host"></div>` : empty}<p class="verified" role="status">${busy ? text('正在分析…', 'Analysing…') : ''}</p><p class="error" role="alert">${e(graphMessage)}</p></section>`;
    }
    if (tab === 'mindmap') {
      const list = activeCards(), card = list.find(item => item.id === mindmapId) || list[0], expansion = card && store.read(MINDMAP_KEY, { items: {} }).items[card.id];
      if (card) mindmapId = card.id;
      const tree = card && buildMindmap(card, { moduleName, related: relatedTitles(card, list), events: reviews().events.filter(event => event.cardId === card.id).sort((a, b) => a.at.localeCompare(b.at)), expansion: expansion?.branches, labels: mindmapLabels() });
      return `<section class="panel"><h2>${text('思维导图', 'Mind map')}</h2><p>${text('选择一个知识点，查看它的要点、例子、相关知识、提问和复习记录。点击分支可以展开或收起。', 'Choose an idea to see its key points, example, related ideas, questions and review history. Click a branch to expand or collapse it.')}</p>
        ${card ? `<div class="library-controls"><label>${text('知识点', 'Idea')}<select id="mindmap-card">${list.map(item => `<option value="${item.id}" ${item.id === card.id ? 'selected' : ''}>${e(moduleName(item.module))} · ${e(item.title)}</option>`).join('')}</select></label><button class="secondary-button" id="mindmap-expand" ${busy ? 'disabled' : ''}>${expansion ? text('重新用模型展开', 'Expand again with model') : text('用模型展开（调用模型）', 'Expand with model (uses model)')}</button></div>
        <p class="field-hint">${expansion ? text(`带 ✦ 的分支由模型于 ${new Date(expansion.generatedAt).toLocaleString('zh-CN')} 生成，仅供参考，可能有误。`, `Branches marked ✦ were generated by the model at ${new Date(expansion.generatedAt).toLocaleString('en')}; they may be wrong.`) : text('默认只使用这张卡片已有的内容，不调用模型。“用模型展开”会把这张卡片的标题、解释和例子发给已配置的模型，补充前置知识、子概念、常见误区和延伸应用，会产生费用。', 'By default only this card’s own content is used. Expand sends the card’s title, explanation and example to your model to add prerequisites, sub-concepts, misconceptions and applications; this uses model credit.')}</p>
        ${mindmapSvg(tree, collapsed)}` : empty}<p class="verified" role="status">${busy ? text('正在展开…', 'Expanding…') : ''}</p><p class="error" role="alert">${e(mindmapMessage)}</p></section>`;
    }
    const chosen = selectedCards();
    return `<section class="panel"><h2>${text('导出复习好的知识', 'Export reviewed knowledge')}</h2><p>${text('选择范围后下载 Word 文档，或直接写入在线文档。只有你点击按钮时才会生成或发送。', 'Choose what to include, then download a Word document or send it to an online document. Nothing is generated or sent until you click.')}</p>
      <div class="library-controls"><label>${text('模块', 'Module')}<select id="export-module"><option value="">${text('全部', 'All')}</option>${modules().map(id => `<option value="${id}" ${id === exportModule ? 'selected' : ''}>${e(moduleName(id))}</option>`).join('')}</select></label><label>${text('范围', 'Include')}<select id="export-scope"><option value="reviewed" ${scope === 'reviewed' ? 'selected' : ''}>${text('已复习过的知识', 'Reviewed ideas')}</option><option value="stable" ${scope === 'stable' ? 'selected' : ''}>${text('已理解或掌握的知识', 'Understood or mastered')}</option><option value="all" ${scope === 'all' ? 'selected' : ''}>${text('全部知识点', 'All ideas')}</option></select></label></div>
      <p class="muted">${text(`将包含 ${chosen.length} 个知识点。`, `${chosen.length} ideas will be included.`)}</p>
      <div class="followups"><button class="primary-button" id="export-word" ${busy || !chosen.length ? 'disabled' : ''}>${text('下载 Word 文档', 'Download Word document')}</button><button class="secondary-button" id="export-google" ${busy || !chosen.length || !googleClientId() ? 'disabled' : ''}>${text('保存到 Google 文档', 'Save to Google Docs')}</button></div>
      <p class="field-hint">${googleClientId() ? text('将打开 Google 授权窗口，只请求“创建和访问本应用建立的文件”权限，上传后转换为 Google 文档。', 'A Google sign-in window opens asking only to create and access files this app makes; the upload is converted to a Google Doc.') : text('Google 文档：服务器尚未配置 GOOGLE_CLIENT_ID，暂不可用（见 cloud-setup.md）。', 'Google Docs: the server has no GOOGLE_CLIENT_ID configured yet (see cloud-setup.md).')}</p>
      <p class="field-hint">${text('飞书云文档：直接写入需要飞书开放平台应用的 App ID 和 Secret，目前未接通。可先下载 Word，再在飞书云文档中选择“导入”。', 'Feishu Docs: writing directly needs a Feishu Open Platform app (App ID and Secret) and is not connected yet. Download the Word file and use Import in Feishu Docs.')}</p>
      ${docLink ? `<p class="verified"><a class="inline-link" href="${e(docLink)}" target="_blank" rel="noopener noreferrer">${text('打开已创建的 Google 文档', 'Open the new Google Doc')} ↗</a></p>` : ''}
      <p class="verified" role="status">${busy ? text('正在处理…', 'Working…') : ''}</p><p class="error" role="alert">${e(message)}</p>
      ${chosen.length ? `<details><summary>${text('预览', 'Preview')}</summary>${chosen.slice(0, 20).map(card => `<h3>${e(card.title)}</h3><div class="knowledge-summary">${renderAnswer(card.summary)}</div>`).join('')}</details>` : ''}</section>`;
  }
  const mindmapLabels = () => ({ locale: locale() === 'zh' ? 'zh-CN' : 'en', points: text('核心要点', 'Key points'), example: text('生活例子', 'Example'), belongs: text('模块与分类', 'Module & category'), related: text('相关知识', 'Related ideas'), questions: text('原始提问', 'Questions asked'), history: text('复习记录', 'Review history'), rating: ratingName,
    ai: { prerequisites: text('前置知识', 'Prerequisites'), subconcepts: text('子概念', 'Sub-concepts'), misconceptions: text('常见误区', 'Misconceptions'), applications: text('延伸应用', 'Applications') } });
  const modelError = error => error?.message === 'key' ? text('请先在“模型设置”中配置 Key 并确认发送说明。', 'Configure your model key and sharing notice in Model settings first.') : text('模型请求未完成，请检查 Key 和网络后重试。', 'The model request did not finish. Check your key and network, then retry.');
  function bindGraph() {
    document.querySelectorAll('[data-graph-theme]').forEach(button => { button.onclick = () => { theme = button.dataset.graphTheme; refresh(); }; });
    document.querySelectorAll('[data-graph-relations]').forEach(button => { button.onclick = () => { relationMode = button.dataset.graphRelations; graphMessage = ''; refresh(); }; });
    const host = document.querySelector('#graph-host');
    if (host) {
      const list = activeCards(), today = dueIds(), style = moduleStyles([...new Set([...modules(), ...list.map(card => card.module)])]), data = reviews();
      const nodes = [...new Set(list.map(card => card.module))].map(id => ({ id: `hub:${id}`, label: moduleName(id), kind: 'hub', module: id, color: style.get(id).color, size: 3, detail: [['strong', moduleName(id)], ['span', text(`${list.filter(card => card.module === id).length} 个知识点`, `${list.filter(card => card.module === id).length} ideas`)]] }))
        .concat(list.slice(0, 160).map(card => { const last = latestReview(data, card.id); return { id: card.id, label: card.title.replace(/^示例：/, ''), kind: 'card', module: card.module, color: style.get(card.module).color, size: card.origins.length, today: today.has(card.id),
          detail: [['strong', card.title], ['span', `${text('模块', 'Module')}：${moduleName(card.module)}${card.category ? ` · ${card.category}` : ''}`], ['span', `${text('上次复习', 'Last review')}：${last ? `${new Date(last.at).toLocaleDateString(locale() === 'zh' ? 'zh-CN' : 'en')} · ${ratingName(last.rating)}` : ratingName(null)}`], ['span', today.has(card.id) ? text('今天需要复习', 'Review today') : text('今天不用复习', 'Not due today')], ['span', text('点击打开思维导图', 'Click to open its mind map')]] }; }));
      const links = list.slice(0, 160).map(card => ({ source: `hub:${card.module}`, target: card.id, kind: 'spoke' })).concat(relationsFor(list).map(p => ({ source: p.a, target: p.b, kind: 'relation', label: p.label })));
      const graph = mountGraph(host, { nodes, links, theme, positions, onOpen: id => { mindmapId = id; collapsed.clear(); openTab('mindmap'); } });
      document.querySelector('#graph-reset').onclick = () => { positions.clear(); graph.reset(); };
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
    if (select) select.onchange = () => { mindmapId = select.value; collapsed.clear(); mindmapMessage = ''; refresh(); };
    document.querySelectorAll('.mm-branch').forEach(node => { const toggle = () => { const i = Number(node.dataset.branch); if (collapsed.has(i)) collapsed.delete(i); else collapsed.add(i); refresh(); }; node.onclick = toggle; node.onkeydown = event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); toggle(); } }; });
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
      } catch (error) { mindmapMessage = modelError(error); }
      finally { busy = false; refresh(); }
    };
  }
  function bind(tab) {
    if (tab === 'graph') { bindGraph(); return; }
    if (tab === 'mindmap') { bindMindmap(); return; }
    if (tab !== 'export') { attachVizInteraction(document.querySelector('main'), labels()); return; }
    document.querySelector('#export-module').onchange = event => { exportModule = event.target.value; docLink = ''; refresh(); };
    document.querySelector('#export-scope').onchange = event => { scope = event.target.value; docLink = ''; refresh(); };
    document.querySelector('#export-word').onclick = () => {
      const bytes = buildDocx(documentBlocks(selectedCards()), { title: text('知回 · 我的知识整理', 'Knowledge Review · My notes') });
      const url = URL.createObjectURL(new Blob([bytes], { type: DOCX_TYPE })), a = document.createElement('a');
      a.href = url; a.download = `${fileName()}.docx`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    };
    document.querySelector('#export-google').onclick = async () => {
      if (busy) return; busy = true; message = ''; docLink = ''; refresh();
      try { const token = await googleToken(googleClientId()); const bytes = buildDocx(documentBlocks(selectedCards())); docLink = await uploadAsGoogleDoc(token, text('知回 · 我的知识整理', 'Knowledge Review notes'), bytes); }
      catch (error) { message = error.code === 'closed' ? text('授权窗口已关闭，未上传。', 'The sign-in window was closed. Nothing was uploaded.') : error.code === 'popup' ? text('浏览器阻止了授权窗口，请允许弹出窗口后重试。', 'The browser blocked the sign-in window. Allow pop-ups and try again.') : text('上传到 Google 文档未完成，请稍后重试。', 'Uploading to Google Docs did not finish. Try again later.'); }
      finally { busy = false; refresh(); }
    };
  }
  return { view, bind, select: id => { mindmapId = id; collapsed.clear(); }, get busy() { return busy; } };
}
