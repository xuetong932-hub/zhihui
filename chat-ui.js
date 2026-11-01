import { providers, defaultConfig, validConfig } from './providers.js';
import { CHAT_KEY, CONFIG_KEY, loadChats, buildContext, escapeHtml as esc, renderAnswer, appendDraft, newTranscript } from './chat-store.js';
import { createKnowledgeUI } from './knowledge-ui.js';
import { createReviewUI } from './review-ui.js';
import {createDeviceUI} from './device-ui.js';
import {createCloudUI} from './cloud-ui.js';
import {attachModelHelp} from './model-help.js';
import {createAdminUI} from './admin-ui.js';
import {moduleLabel,activeModuleIds,isActiveModule,isCustomModule} from './modules.js';

const copy = {
  zh: {
    home: '首页', modelSettings: '模型设置', configured: '本页已配置', needsKey: '尚未配置 Key',
    modelTitle: '连接你的模型', modelHint: '选择服务商并填写自己的 Key。保存设置不会发起付费调用。',
    provider: '模型服务商', model: '模型名称', workspace: '业务空间 ID', workspaceHint: '从百炼控制台复制；中国区旧接口可留空，新加坡区必填。',
    key: 'API Key', keyHint: '仅在当前页面内存中使用，刷新或关闭后清除。不会写入聊天记录或浏览器存储。跨设备加密保存将在账号阶段接入。',
    search: '启用联网搜索', searchUnavailable: '当前接入的 DeepSeek 问答接口未启用搜索。需要联网时请选择千问。',
    cost: '模型与搜索可能消耗你在服务商处的额度。连续追问会发送本对话最近最多 10 轮完整问答，其他模块不会发送。',
    consent: '我同意通过本机服务将 API Key、当前问题及本对话近期上下文发送至以下服务商：',
    docs: '查看 Key 获取说明', save: '保存并返回', cancel: '返回', forget: '清除本页 Key',
    test: '测试连接', testHint: '测试会发送一条简短测试消息，可能消耗少量模型额度，不测试联网搜索。', testing: '正在测试…', testOk: '模型连接成功；联网搜索尚需实际提问验证。',
    saved: '模型设置已保存。', keyCleared: '本页 Key 已清除。', config: '请检查模型名称、服务地区及业务空间 ID。', keyError: '请输入有效 Key（8–512 位，不包含空格）。', consentError: '请先确认数据发送说明。',
    chatTitle: '从一个问题开始', chatHint: '只使用当前模块的基础水平和本对话上下文。答案由模型生成，请结合实际核实。',
    history: '当前对话', fresh: '新对话', unnamed: '新对话', ask: '你的问题', placeholder: '输入你想弄懂的问题…',
    send: '发送问题', sending: '正在回答…', stop: '停止等待', stopped: '已停止等待，服务商仍可能计费。',
    you: '你', assistant: '学习助手', empty: '还没有对话', emptyHint: '提出一个问题，或先配置自己的模型。',
    simpler: '再简单一点', example: '换个生活例子', simplerPrompt: '请把刚才的解释再讲简单一点，并解释关键术语。', examplePrompt: '请换一个贴近日常生活的例子，重新解释刚才的知识。',
    sources: '查看来源', noSources: '服务商没有返回可核验的搜索来源，无法确认已完成联网检索。',
    searchOff: '本次未联网', searchOn: '已返回搜索来源', searchMissing: '未返回搜索来源', truncated: '回答达到长度上限，可能不完整。可继续追问。',
    retry: '重新发送', restore: '放回输入框', failed: '发送未完成', storage: '本地保存失败，内容暂留在本页。为避免丢失，请先复制重要内容；本次未继续自动发送。',
    corrupt: '部分本地聊天数据无法读取。原始存储未主动删除；请先备份浏览器数据。',
    conflict: '聊天记录已在另一个页面更新。本页内容暂未覆盖保存，请先复制重要内容，再刷新查看最新记录。',
    length: '问题不能为空，且不能超过 8,000 字符。', pendingNotice: '正在等待模型回答，可停止等待。',
    'error-unauthorized': 'Key 无效或已失效，请检查对应服务商与地区。', 'error-balance': '服务商余额或额度不足，请到服务商处检查。',
    'error-forbidden': '服务商拒绝访问，请检查账号权限和地区。', 'error-rate': '服务商调用过于频繁，请稍后手动重试。',
    'error-model': '模型、业务空间或搜索参数不可用，请检查设置。', 'error-network': '无法连接模型服务。请检查本机网络后重试。',
    'error-timeout': '等待模型超时。问题已保留，重试可能再次计费。', 'error-filtered': '服务商未能提供此问题的回答，请调整问题。',
    'error-empty': '模型没有返回有效答案，请调整设置后重试。', 'error-upstream': '模型服务返回异常，请稍后重试。',
    'error-busy': '当前请求较多，请稍后重试。', 'error-generic': '请求未完成，请检查本机服务和模型设置后重试。',
    records: '条问答消息', open: '进入提问', back: '返回首页', networkLabel: '联网搜索', privacy: '问答只保存在当前浏览器。',
  },
  en: {
    home: 'Home', modelSettings: 'Model settings', configured: 'Key ready in this page', needsKey: 'Key not configured',
    modelTitle: 'Connect your model', modelHint: 'Choose a provider and enter your own key. Saving does not call the model.',
    provider: 'Model provider', model: 'Model name', workspace: 'Workspace ID', workspaceHint: 'Copy from Model Studio. Optional for the China legacy endpoint; required for Singapore.',
    key: 'API key', keyHint: 'Kept in this page’s memory only. Reloading or closing clears it. Never stored with chats or in browser storage. Encrypted cross-device storage comes with accounts later.',
    search: 'Enable web search', searchUnavailable: 'Search is not enabled in this DeepSeek adapter. Choose Qwen for web search.',
    cost: 'Model and search calls may use your provider balance. Follow-ups send up to 10 recent complete turns from this conversation only, never other modules.',
    consent: 'I agree to send my API key, current question and recent conversation context through the local service to this provider:',
    docs: 'How to get a key', save: 'Save and return', cancel: 'Back', forget: 'Clear key from this page',
    test: 'Test connection', testHint: 'Sends a short test message and may use a small amount of model credit. Does not test search.', testing: 'Testing…', testOk: 'Model connected. Search still needs a real question to verify.',
    saved: 'Model settings saved.', keyCleared: 'Key cleared from this page.', config: 'Check model name, provider region and workspace ID.', keyError: 'Enter a valid key (8–512 characters, no spaces).', consentError: 'Confirm the data-sharing notice first.',
    chatTitle: 'Start with a question', chatHint: 'Uses this module’s level and this conversation only. Answers are model-generated; verify important facts.',
    history: 'Conversation', fresh: 'New conversation', unnamed: 'New conversation', ask: 'Your question', placeholder: 'What would you like to understand?',
    send: 'Send question', sending: 'Generating an answer…', stop: 'Stop waiting', stopped: 'Stopped waiting. The provider may still charge for this request.',
    you: 'You', assistant: 'Learning assistant', empty: 'No messages yet', emptyHint: 'Ask a question, or configure your model first.',
    simpler: 'Explain more simply', example: 'Another everyday example', simplerPrompt: 'Please explain that more simply and define the key terms.', examplePrompt: 'Please explain that knowledge again using a different everyday example.',
    sources: 'View sources', noSources: 'The provider returned no verifiable search sources. A completed search cannot be confirmed.',
    searchOff: 'No web search', searchOn: 'Search sources returned', searchMissing: 'No search sources returned', truncated: 'The answer reached its length limit and may be incomplete. You can ask a follow-up.',
    retry: 'Send again', restore: 'Return to input', failed: 'Request incomplete', storage: 'Local saving failed; content remains in this page only. Copy important content. No further automatic request was sent.',
    corrupt: 'Some local chat data could not be read. Original storage was not deleted; back up browser data first.',
    conflict: 'Chats changed in another page. This page has not overwritten them. Copy important content, then reload for the latest records.',
    length: 'Enter a question of up to 8,000 characters.', pendingNotice: 'Waiting for the model. You can stop waiting.',
    'error-unauthorized': 'Invalid or expired key. Check the provider and region.', 'error-balance': 'Insufficient provider balance or quota. Check your provider account.',
    'error-forbidden': 'Provider denied access. Check permissions and region.', 'error-rate': 'Provider rate limit reached. Retry manually later.',
    'error-model': 'Model, workspace or search parameters are unavailable. Check settings.', 'error-network': 'Unable to reach the model. Check your local network.',
    'error-timeout': 'The model timed out. Your question is kept; retrying may incur another charge.', 'error-filtered': 'The provider could not answer this question. Try rephrasing.',
    'error-empty': 'The model returned no usable answer. Check settings and retry.', 'error-upstream': 'The model service returned an error. Try again later.',
    'error-busy': 'Too many active requests. Try again shortly.', 'error-generic': 'Request incomplete. Check the local service and model settings.',
    records: 'messages', open: 'Ask a question', back: 'Back to home', networkLabel: 'Web search', privacy: 'Conversations stay in this browser.',
  },
};

export function createChatUI({ getProfile, getLocale, refresh,validateProfile,adaptLevel,reloadProfile,auth,getAccount,signOut }) {
  let chatSnapshot = null;
  const loaded = loadChats({ getItem: key => { chatSnapshot = localStorage.getItem(key); return chatSnapshot; } });
  let chats = loaded.chats;
  let corrupt = loaded.issue;
  let config = defaultConfig();
  try { const stored = JSON.parse(localStorage.getItem(CONFIG_KEY)); if (validConfig(stored)) config = { version: 1, provider: stored.provider, model: stored.model, workspace: stored.workspace, search: stored.search }; } catch { /* Defaults are usable. */ }
  let page = 'home', returnPage = 'home', activeModule = 'coding';
  let apiKey = '', consent = false, busy = false, controller, notice = '';
  let modelDraft, keyDraft = '', consentDraft = false, modelError = '', testMessage = '', testing = false;
  const selected = {}, inputs = {};
  const t = key => copy[getLocale()][key] || copy[getLocale()]['error-generic'];
  const moduleName = id => moduleLabel(getProfile(), id, getLocale());
  // Custom modules get their conversation list on first use; built-in lists always exist.
  const threadsOf = id => (chats.modules[id] ||= []);
  // The server gets each module's name so custom modules can be explained and classified.
  const moduleInfo = id => ({ module: id, ...(isCustomModule(id) ? { moduleName: moduleName(id) } : {}) });
  const enabledModules = () => activeModuleIds(getProfile()).map(id => ({ id, name: moduleName(id) }));
  const ready = () => Boolean(apiKey && consent);
  const allOrigins = () => Object.entries(chats.modules).flatMap(([sourceModule,threads])=>threads.flatMap(thread=>thread.messages.flatMap((message,index)=> {
    const question=thread.messages[index-1];
    return message.role==='assistant'&&message.status==='done'&&question?.role==='user'&&question.status==='done'?[{id:message.id,threadId:thread.id,sourceModule,question:question.content,answer:message.content,createdAt:question.createdAt,sources:message.sources||[]}]:[];
  })));
  const library = createKnowledgeUI({locale:getLocale, enabled:()=>activeModuleIds(getProfile()), moduleName, refresh,
    // review is created below; these run only when the library renders.
    reviews:()=>review.events(), dueIds:()=>review.dueIds(), googleClientId:()=>auth?.googleClientId||'',
    // User-triggered model calls for the graph's semantic relations and mind map expansion.
    relate:cards=>{if(!ready())return Promise.reject(new Error('key'));const id=activeModuleIds(getProfile())[0];return request('/api/relations',{config:{...config},apiKey,consent,...moduleInfo(id),level:getProfile().modules[id].level,locale:getLocale(),cards});},
    expand:card=>{if(!ready())return Promise.reject(new Error('key'));return request('/api/mindmap',{config:{...config},apiKey,consent,...moduleInfo(card.module),level:getProfile().modules[card.module].level,locale:getLocale(),card:{title:card.title,summary:card.summary,example:card.example}});},
    origins:allOrigins, extract:async(origin,candidates)=> {
      if(!ready())throw new Error('key');
      return request('/api/extract',{config:{...config},apiKey,consent,...moduleInfo(origin.sourceModule),level:getProfile().modules[origin.sourceModule].level,locale:getLocale(),question:origin.question,answer:origin.answer.slice(0,24000),candidates,enabled:enabledModules()},controller?.signal);
    }});
  function saveChats() {
    if (corrupt) { notice = t('corrupt'); return false; }
    try {
      if (localStorage.getItem(CHAT_KEY) !== chatSnapshot) { notice = t('conflict'); return false; }
      const nextSnapshot = JSON.stringify(chats);
      localStorage.setItem(CHAT_KEY, nextSnapshot); chatSnapshot = nextSnapshot; return true;
    }
    catch { notice = t('storage'); return false; }
  }
  // The completion popup lets the user pick a module to ask in next.
  const review=createReviewUI({locale:getLocale,profile:getProfile,cards:library.cards,markWeak:library.markWeak,refresh,adaptLevel,
    modules:()=>activeModuleIds(getProfile()).map(id=>({id,name:moduleName(id)})),openModule:id=>openModule(id),goHome:()=>{page='home';refresh();},call:(task,card,answer)=>{
    if(!ready())return Promise.reject(new Error('key'));
    return request('/api/review-task',{config:{...config},apiKey,consent,...moduleInfo(card.module),level:getProfile().modules[card.module].level,locale:getLocale(),task,card:{title:card.title,summary:card.summary,example:card.example},answer});
  }});
  // The signed-in account as the local-data owner; backups of other accounts cannot be swapped in.
  const owner=()=>auth?.user&&auth.config?{url:auth.config.url,userId:auth.user.id,label:getAccount?.()?.username||''}:null;
  const admin=createAdminUI({locale:getLocale,refresh,auth});
  const device=createDeviceUI({locale:getLocale,refresh,validateProfile,reloadLocal,owner,due:()=>getProfile()?review.count():0,openReview:()=>{page='review';refresh();}});
  const cloud=createCloudUI({locale:getLocale,validateProfile,refresh,reloadLocal,auth,getAccount,owner,signOut,getModelKey:()=>({config:{...config},apiKey}),acceptModelKey:value=>{
    if(!validConfig(value?.config)||typeof value.apiKey!=='string'||!/^[\x21-\x7e]{8,512}$/.test(value.apiKey))return false;
    config={version:1,provider:value.config.provider,model:value.config.model,workspace:value.config.workspace,search:value.config.search};apiKey=value.apiKey;consent=false;
    try{localStorage.setItem(CONFIG_KEY,JSON.stringify(config));}catch{/* The key still works in this page after the notice is confirmed. */}
    return true;
  }});
  // Re-reads every learning store after a cloud restore or undo, so no page reload (which clears keys and sessions) is needed.
  function reloadLocal(){
    const next=loadChats({ getItem: key => { chatSnapshot = localStorage.getItem(key); return chatSnapshot; } });
    chats=next.chats;corrupt=next.issue;notice='';
    for(const id of Object.keys(selected))delete selected[id];
    reloadProfile();library.reload();review.reload();ensureModule();
  }
  function ensureModule(){const profile=getProfile();if(profile&&!isActiveModule(profile,activeModule))activeModule=activeModuleIds(profile)[0];}
  let recognition=null;
  function thread() { return threadsOf(activeModule).find(item => item.id === selected[activeModule]); }
  function newThread() {
    const item = { id: crypto.randomUUID(), title: '', createdAt: new Date().toISOString(), messages: [] };
    threadsOf(activeModule).push(item); selected[activeModule] = item.id;
    return item;
  }
  function openModule(id) {
    if (!isActiveModule(getProfile(), id) || busy || testing || library.busy || review.busy) return;
    activeModule = id;
    const existing = threadsOf(id);
    if (!existing.some(item => item.id === selected[id])) selected[id] = existing.at(-1)?.id;
    page = 'chat'; notice = ''; refresh();
  }
  function openModel() {
    if (busy || testing || library.busy || review.busy) return;
    returnPage = page;
    modelDraft = { ...config }; keyDraft = apiKey; consentDraft = consent;
    modelError = ''; testMessage = ''; page = 'model'; refresh();
  }
  function nav() {
    return `<nav class="app-nav" aria-label="${t('home')}"><button class="text-button" data-chat-home>${t('home')}</button><button class="text-button" data-review>${getLocale()==='zh'?'复习':'Review'}</button><button class="text-button" data-library>${getLocale()==='zh'?'知识库':'Knowledge'}</button><button class="text-button" data-device>${getLocale()==='zh'?'设备':'Device'}</button><button class="text-button" data-cloud>${getLocale()==='zh'?'账号':'Account'}</button>${getAccount?.()?.is_admin?`<button class="text-button" data-admin>${getLocale()==='zh'?'管理':'Admin'}</button>`:''}<button class="text-button" data-model-settings>${t('modelSettings')} <span class="status-dot ${ready() ? 'ready' : ''}" aria-hidden="true"></span></button></nav>`;
  }
  function view() { return page==='admin'?admin.view():page==='cloud'?cloud.view():page==='device'?device.view():page === 'review' ? review.view() : page === 'library' ? library.view() : page === 'model' ? modelView() : chatView(); }
  function modelView() {
    const p = providers[modelDraft.provider];
    return `<section class="intro model-intro"><div><span class="eyebrow">${t('modelSettings')}</span><h1>${t('modelTitle')}</h1><p>${t('modelHint')}</p></div><a class="inline-link model-help-link" id="model-help-link" href="#model-config-guide" aria-haspopup="dialog">${getLocale()==='zh'?'配置说明':'Setup guide'} ↗</a></section>
      <form id="model-form" class="panel model-form" novalidate><div class="form-grid">
        <label>${t('provider')}<select id="provider" ${testing ? 'disabled' : ''}>${Object.entries(providers).map(([id, value]) => `<option value="${id}" ${id === modelDraft.provider ? 'selected' : ''}>${value.name}</option>`).join('')}</select></label>
        <label>${t('model')}<input id="model-name" type="text" maxlength="100" value="${esc(modelDraft.model)}" required ${testing ? 'disabled' : ''}></label>
      </div>
      ${modelDraft.provider !== 'deepseek' ? `<label class="field-label" for="workspace">${t('workspace')}${p.workspaceRequired ? ' *' : ''}</label><input id="workspace" type="text" maxlength="63" value="${esc(modelDraft.workspace)}" ${testing ? 'disabled' : ''}><p class="field-hint">${t('workspaceHint')}</p>` : ''}
      <label class="field-label" for="api-key">${t('key')}</label><input id="api-key" type="password" autocomplete="off" spellcheck="false" maxlength="512" required aria-describedby="key-hint" ${testing ? 'disabled' : ''}><p id="key-hint" class="field-hint">${t('keyHint')}</p>
      <a class="inline-link" href="${p.docs}" target="_blank" rel="noopener noreferrer">${t('docs')} ↗</a>
      <div class="model-search"><label class="check-row"><input id="web-search" type="checkbox" ${modelDraft.search ? 'checked' : ''} ${!p.search || testing ? 'disabled' : ''}>${t('search')}</label>${!p.search ? `<p class="field-hint">${t('searchUnavailable')}</p>` : ''}</div>
      <div class="sharing-notice"><p>${t('cost')}</p><p>${getLocale()==='zh'?'回答后会额外调用一次模型整理知识：发送本条问答及当前模块最多 40 个已有知识标题，不额外联网。':'After each answer, an extra model call organizes knowledge using this Q&A and up to 40 titles in the original module, without additional search.'}</p><label class="check-row consent-row"><input id="model-consent" type="checkbox" ${consentDraft ? 'checked' : ''} ${testing ? 'disabled' : ''}><span>${t('consent')} <strong>${esc(p.name)}</strong></span></label></div>
      <p class="error" id="model-error" role="alert">${esc(modelError)}</p><p class="verified" id="connection-status" role="status">${esc(testMessage)}</p>
      <div class="test-row"><button type="button" class="secondary-button" id="test-connection" ${testing ? 'disabled' : ''}>${t(testing ? 'testing' : 'test')}</button><p class="field-hint">${t('testHint')}</p></div>
      <div class="actions model-actions"><button type="button" class="text-button" id="forget-key" ${testing ? 'disabled' : ''}>${t('forget')}</button><button type="button" class="secondary-button" id="model-back" ${testing ? 'disabled' : ''}>${t('cancel')}</button><button type="submit" class="primary-button" ${testing ? 'disabled' : ''}>${t('save')}</button></div></form>`;
  }
  function chatView() {
    const profile = getProfile();
    const threads = threadsOf(activeModule);
    const current = thread();
    const messages = current?.messages || [];
    const input = inputs[activeModule] || '';
    return `<section class="intro"><span class="eyebrow">${esc(moduleName(activeModule))}</span><h1>${t('chatTitle')}</h1><p>${t('chatHint')}</p></section>
      <div class="module-tabs" role="group" aria-label="${getLocale() === 'zh' ? '学习模块' : 'Learning modules'}">${activeModuleIds(profile).map(id => `<button class="module-tab ${id === activeModule ? 'active' : ''}" data-switch-module="${id}" aria-pressed="${id === activeModule}" ${busy ? 'disabled' : ''}>${esc(moduleName(id))}</button>`).join('')}</div>
      <section class="panel conversation-panel"><div class="chat-toolbar"><label class="thread-label" for="thread-select">${t('history')}</label><select id="thread-select" ${busy || !threads.length ? 'disabled' : ''}>${threads.length ? [...threads].reverse().map(item => `<option value="${esc(item.id)}" ${item.id === current?.id ? 'selected' : ''}>${esc(item.title || t('unnamed'))}</option>`).join('') : `<option>${t('unnamed')}</option>`}</select><button class="secondary-button" id="new-thread" ${busy ? 'disabled' : ''}>＋ ${t('fresh')}</button></div>
      <div class="connection-bar"><span class="status-dot ${ready() ? 'ready' : ''}"></span><span>${t(ready() ? 'configured' : 'needsKey')} · ${esc(providers[config.provider].name)} · ${esc(config.model)}</span><button class="text-button" data-model-settings ${busy ? 'disabled' : ''}>${t('modelSettings')}</button></div>
      <div class="messages" aria-label="${t('history')}" aria-busy="${busy}">${messages.length ? messages.map((message, index) => messageView(message, index === messages.length - 1)).join('') : `<div class="empty-state"><div class="empty-icon" aria-hidden="true">?</div><h3>${t('empty')}</h3><p>${t('emptyHint')}</p></div>`}</div>
      ${busy ? `<p class="pending-indicator" role="status">${t('sending')}</p>` : ''}
      <p class="error chat-notice" role="alert">${esc(notice || (corrupt ? t('corrupt') : ''))}</p>
      <form id="question-form"><label class="field-label" for="question">${t('ask')}</label><textarea id="question" rows="4" maxlength="8000" placeholder="${t('placeholder')}" ${busy ? 'disabled' : ''}>${esc(input)}</textarea><div class="composer-footer"><span class="muted">${t('privacy')}</span>${busy ? `<button type="button" id="stop-request" class="secondary-button">${t('stop')}</button>` : `<button type="button" id="voice-input" class="secondary-button">${getLocale()==='zh'?'语音输入':'Voice input'}</button><button type="submit" class="primary-button">${t('send')} →</button>`}</div><p class="field-hint">${getLocale()==='zh'?'语音由浏览器识别，可能使用浏览器服务商的云服务；点击后才请求权限。本 App 不保存录音，不支持时可用系统键盘语音输入。':'Speech recognition may use your browser provider’s cloud service. Permission is requested on click. No audio is stored by this app; use keyboard dictation if unsupported.'}</p></form>
      ${messages.at(-1)?.role === 'assistant' && !busy ? `<div class="followups"><button class="secondary-button" data-followup="simpler">${t('simpler')}</button><button class="secondary-button" data-followup="example">${t('example')}</button></div>` : ''}</section>`;
  }
  function messageView(message, last) {
    const date = new Intl.DateTimeFormat(getLocale() === 'zh' ? 'zh-CN' : 'en', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(message.createdAt));
    const assistant = message.role === 'assistant';
    return `<article class="message ${assistant ? 'assistant-message' : 'user-message'}"><div class="message-meta"><strong>${t(assistant ? 'assistant' : 'you')}</strong><time datetime="${esc(message.createdAt)}">${date}</time>${assistant ? `<span>${esc(message.model || '')}</span>` : ''}</div><div class="message-content">${assistant ? renderAnswer(message.content) : `<div class="user-text">${esc(message.content)}</div>`}</div>
      ${assistant ? `<div class="answer-meta"><span class="muted">${t(message.searchStatus === 'sources-returned' ? 'searchOn' : message.searchStatus === 'no-sources' ? 'searchMissing' : 'searchOff')}</span>${message.truncated ? `<p class="answer-warning">${t('truncated')}</p>` : ''}<details><summary>${t('sources')}${message.sources?.length ? ` (${message.sources.length})` : ''}</summary>${message.sources?.length ? `<ul class="source-list">${message.sources.map(source => `<li><a href="${esc(source.url)}" target="_blank" rel="noopener noreferrer">${esc(source.title)}</a></li>`).join('')}</ul>` : `<p>${t(message.searchStatus === 'off' ? 'searchOff' : 'noSources')}</p>`}</details></div>` : message.status === 'failed' || message.status === 'cancelled' ? `<div class="failure-row"><span>${t(message.status === 'cancelled' ? 'stopped' : 'failed')}${message.error ? ` · ${errorText(message.error)}` : ''}</span><button class="text-button" data-retry="${esc(message.id)}" ${busy ? 'disabled' : ''}>${t(last ? 'retry' : 'restore')}</button></div>` : ''}</article>`;
  }
  function errorText(code) { return t(`error-${code}`); }
  function bind() {
    const locked=()=>busy||testing||review.busy||library.busy||cloud.busy||admin.busy;
    document.querySelectorAll('[data-device]').forEach(button=>button.onclick=()=>{if(!locked()){page='device';refresh();}});
    document.querySelectorAll('[data-cloud]').forEach(button=>button.onclick=()=>{if(!locked()){page='cloud';refresh();}});
    document.querySelectorAll('[data-admin]').forEach(button=>button.onclick=()=>{if(!locked()){page='admin';admin.open();refresh();}});
    document.querySelectorAll('.app-nav button').forEach(button=>{button.disabled=locked();});
    document.querySelectorAll('[data-review]').forEach(button=>button.onclick=()=>{if(!busy&&!testing&&!review.busy&&!library.busy){page='review';refresh();}});
    document.querySelectorAll('[data-library]').forEach(button=>{button.onclick=()=>{if(!busy&&!testing&&!review.busy&&!library.busy){page='library';refresh();}};});
    document.querySelectorAll('[data-chat-home]').forEach(button => { button.onclick = () => { if (!busy && !testing&&!review.busy&&!library.busy) { page = 'home'; refresh(); } }; });
    document.querySelectorAll('[data-model-settings]').forEach(button => { button.onclick = openModel; });
    document.querySelectorAll('[data-open-module]').forEach(button => { button.onclick = () => openModule(button.dataset.openModule); });
    if (page === 'model') bindModel();
    if (page === 'chat') bindChat();
    if (page === 'library') library.bind();
    if (page === 'review') review.bind();
    if(page==='device')device.bind();
    if(page==='cloud')cloud.bind();
    if(page==='admin')admin.bind();
  }
  function draftError() {
    if (!validConfig(modelDraft)) return t('config');
    if (!/^[\x21-\x7e]{8,512}$/.test(keyDraft)) return t('keyError');
    if (!consentDraft) return t('consentError');
    return '';
  }
  function bindModel() {
    attachModelHelp(getLocale());
    document.querySelector('#api-key').value = keyDraft;
    const invalidate = () => { testMessage = ''; modelError = ''; document.querySelector('#model-error').textContent = ''; document.querySelector('#connection-status').textContent = ''; };
    document.querySelector('#provider').onchange = event => {
      const provider = event.target.value;
      modelDraft = { version: 1, provider, model: providers[provider].model, workspace: '', search: providers[provider].search };
      keyDraft = ''; consentDraft = false; modelError = ''; testMessage = ''; refresh();
    };
    document.querySelector('#model-name').oninput = event => { modelDraft.model = event.target.value.trim(); invalidate(); };
    const workspace = document.querySelector('#workspace');
    if (workspace) workspace.oninput = event => { modelDraft.workspace = event.target.value.trim(); consentDraft = false; document.querySelector('#model-consent').checked = false; invalidate(); };
    document.querySelector('#api-key').oninput = event => { keyDraft = event.target.value.trim(); invalidate(); };
    document.querySelector('#web-search').onchange = event => { modelDraft.search = event.target.checked; invalidate(); };
    document.querySelector('#model-consent').onchange = event => { consentDraft = event.target.checked; invalidate(); };
    document.querySelector('#model-back').onclick = () => { keyDraft = ''; page = returnPage; refresh(); };
    document.querySelector('#forget-key').onclick = () => { apiKey = ''; keyDraft = ''; consent = false; consentDraft = false; modelError = ''; testMessage = t('keyCleared'); refresh(); };
    document.querySelector('#model-form').onsubmit = event => {
      event.preventDefault(); if (testing) return;
      modelError = draftError();
      if (modelError) { refresh(); return; }
      try { localStorage.setItem(CONFIG_KEY, JSON.stringify(modelDraft)); }
      catch { modelError = t('storage'); refresh(); return; }
      config = { ...modelDraft }; apiKey = keyDraft; consent = consentDraft; keyDraft = ''; notice = ''; page = returnPage; refresh();
    };
    document.querySelector('#test-connection').onclick = async () => {
      modelError = draftError(); testMessage = '';
      if (modelError) { refresh(); return; }
      testing = true; refresh();
      try {
        await request('/api/test', { config: modelDraft, apiKey: keyDraft, consent: consentDraft, ...moduleInfo(activeModule), level: getProfile().modules[activeModule].level, locale: getLocale(), messages: [{ role: 'user', content: 'OK' }] });
        testMessage = t('testOk');
      } catch (error) { modelError = errorText(error.code); }
      finally { testing = false; refresh(); }
    };
  }
  async function request(path, body, signal) {
    try {
      const response = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(100000)]) : AbortSignal.timeout(100000) });
      const data = await response.json();
      if (!response.ok) throw Object.assign(new Error('Request failed'), { code: data.error });
      return data;
    } catch (error) {
      if (signal?.aborted) throw Object.assign(new Error('Cancelled'), { code: 'cancelled' });
      if (error.name === 'TimeoutError') throw Object.assign(new Error('Timeout'), { code: 'timeout' });
      throw error;
    }
  }
  function bindChat() {
    const voice=document.querySelector('#voice-input');if(voice)voice.onclick=()=>{
      if(recognition){recognition.stop();return;}
      const Speech=window.SpeechRecognition||window.webkitSpeechRecognition;
      if(!Speech){notice=getLocale()==='zh'?'浏览器未提供语音识别，请用系统键盘语音输入。':'Speech recognition is unavailable. Use keyboard dictation.';refresh();return;}
      const module=activeModule;recognition=new Speech();recognition.lang=getLocale()==='zh'?'zh-CN':'en-US';recognition.interimResults=false;
      // Append to the draft as it is now, so text typed while dictating is kept.
      recognition.onresult=event=>{const transcript=newTranscript(event.results,event.resultIndex);if(!transcript)return;inputs[module]=appendDraft(inputs[module],transcript,' ');const field=document.querySelector('#question');if(page==='chat'&&activeModule===module&&field)field.value=inputs[module];};
      recognition.onerror=()=>{notice=getLocale()==='zh'?'语音识别未完成，请检查权限或使用文字输入。':'Speech recognition incomplete. Check permissions or type instead.';};
      recognition.onend=()=>{recognition=null;refresh();};try{recognition.start();voice.textContent=getLocale()==='zh'?'停止语音':'Stop dictation';}catch{recognition=null;notice=getLocale()==='zh'?'无法启动语音识别。':'Could not start dictation.';refresh();}
    };
    document.querySelectorAll('[data-switch-module]').forEach(button => { button.onclick = () => openModule(button.dataset.switchModule); });
    // The module's draft stays in the box when switching or starting conversations.
    document.querySelector('#thread-select').onchange = event => { selected[activeModule] = event.target.value; notice = ''; refresh(); };
    document.querySelector('#new-thread').onclick = () => { if (busy) return; newThread(); notice = ''; saveChats(); refresh(); };
    document.querySelector('#question').oninput = event => { inputs[activeModule] = event.target.value; };
    document.querySelector('#question-form').onsubmit = event => { event.preventDefault(); void send(inputs[activeModule] || ''); };
    const stop = document.querySelector('#stop-request');
    if (stop) stop.onclick = () => controller?.abort();
    document.querySelectorAll('[data-followup]').forEach(button => { button.onclick = () => { inputs[activeModule] = appendDraft(inputs[activeModule], t(`${button.dataset.followup}Prompt`)); refresh(); document.querySelector('#question').focus(); }; });
    document.querySelectorAll('[data-retry]').forEach(button => { button.onclick = () => {
      const item = thread()?.messages.find(message => message.id === button.dataset.retry);
      if (!item) return;
      if (item === thread().messages.at(-1)) void send(item.content, item.id);
      else { inputs[activeModule] = appendDraft(inputs[activeModule], item.content); refresh(); document.querySelector('#question').focus(); }
    }; });
  }
  async function send(text, retryId) {
    if (busy || library.busy) return;
    const content = text.trim();
    if (!content || content.length > 8000) { notice = t('length'); refresh(); return; }
    if (!ready()) { if (!retryId) inputs[activeModule] = text; openModel(); return; }
    const current = thread() || newThread();
    const messages = buildContext(current, content);
    const user = retryId ? current.messages.find(item => item.id === retryId) : { id: crypto.randomUUID(), role: 'user', content, createdAt: new Date().toISOString() };
    if (!retryId) current.messages.push(user);
    if (!current.title) current.title = content.slice(0, 60);
    user.status = 'pending'; delete user.error; notice = '';
    if (!saveChats()) { user.status = 'failed'; if (!retryId) inputs[activeModule] = text; refresh(); return; }
    const sentModule = activeModule;
    const requestBody = { config: { ...config }, apiKey, consent, ...moduleInfo(sentModule), level: getProfile().modules[sentModule].level, locale: getLocale(), messages };
    // A retry resends a stored question; the box may hold a different draft that must stay.
    controller = new AbortController(); busy = true; if (!retryId) inputs[sentModule] = ''; refresh();
    try {
      const result = await request('/api/chat', requestBody, controller.signal);
      if (controller.signal.aborted) throw Object.assign(new Error('Cancelled'), { code: 'cancelled' });
      if (typeof result.content !== 'string') throw new Error('Invalid model response');
      user.status = 'done';
      current.messages.push({ id: crypto.randomUUID(), role: 'assistant', status: 'done', createdAt: new Date().toISOString(), ...result });
      saveChats();
      const answer=current.messages.at(-1);
      try { await library.ingest({id:answer.id,threadId:current.id,sourceModule:sentModule,question:user.content,answer:answer.content,createdAt:user.createdAt,sources:answer.sources||[]}); }
      catch { notice=getLocale()==='zh'?'回答已保存，知识提炼未完成。':'Answer saved; knowledge extraction incomplete.'; }
    } catch (error) {
      user.status = error.code === 'cancelled' ? 'cancelled' : 'failed';
      if (error.code === 'cancelled') delete user.error;
      else user.error = copy.zh[`error-${error.code}`] ? error.code : 'generic';
      notice = error.code === 'cancelled' ? t('stopped') : errorText(error.code);
      saveChats();
    } finally { busy = false; controller = null; requestBody.apiKey = ''; refresh(); }
  }
  return { nav, view, bind, openModule, openModel, get isHome() { return page === 'home'; },
    get locked() { return busy || testing || library.busy || review.busy || cloud.busy || admin.busy; },
    openingPopup:()=>device.openingPopup(),
    reviewCount:()=>review.count(),
    knowledgeCount: id => library.count(id),
    homeText: key => t(key), messageCount: id => (chats.modules[id] || []).reduce((sum, item) => sum + item.messages.filter(message => message.status === 'done').length, 0),
    ensureModule,
    // Whether deleting this module would hide records (then it is archived instead of removed).
    moduleHasData: id => (chats.modules[id] || []).some(item => item.messages.length) || library.cards().some(card => card.module === id),
  };
}
