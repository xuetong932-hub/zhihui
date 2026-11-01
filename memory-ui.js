import { memoryPoints, moduleCurves, moduleStyles, curveSvg, graphSvg, legend, attachVizInteraction } from './memory-viz.js';
import { latestReview } from './review-store.js';
import { buildDocx, DOCX_TYPE } from './docx.js';
import { googleToken, uploadAsGoogleDoc } from './google-docs.js';
import { escapeHtml as e, renderAnswer } from './chat-store.js';
// Library panels: forgetting curve, knowledge graph and export of reviewed knowledge (Word download, Google Docs).
export function createMemoryPanel({ locale, cards, reviews, dueIds, moduleName, modules, googleClientId, refresh }) {
  const text = (zh, en) => locale() === 'zh' ? zh : en;
  let exportModule = '', scope = 'reviewed', message = '', busy = false, docLink = '';
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
    if (tab === 'graph') return `<section class="panel"><h2>${text('知识图谱', 'Knowledge graph')}</h2><p><strong>${e(summary)}</strong></p><p>${text('每个圆心是一个学习模块，周围是它的知识点；同一模块中分类相同的知识点用虚线相连。颜色和形状代表模块，实心表示今天需要复习。把鼠标停在点上可查看详情。', 'Each hub is a module surrounded by its ideas; ideas sharing a category are joined by dashed lines. Colour and shape show the module; filled means review today. Hover a point for details.')}</p>${list.length ? graphSvg(list, style, moduleName, labels()) + legend(style, moduleName, list, labels()) : empty}${list.length > 150 ? `<p class="field-hint">${text('只显示前 150 个知识点。', 'Showing the first 150 ideas.')}</p>` : ''}</section>`;
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
  function bind(tab) {
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
  return { view, bind, get busy() { return busy; } };
}
