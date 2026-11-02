const SEEN_KEY = 'knowledge-review.model-help-seen.v1';
let seenThisPage = false;

// welcome: show the first-visit pop-up about getting a key (skipped on the free allowance, which needs no key).
export function attachModelHelp(locale, { welcome: showWelcome = true } = {}) {
  const zh = locale === 'zh';
  const link = document.querySelector('#model-help-link');
  if (!link) return;
  const closeDialog = dialog => { dialog.close(); };
  function guide() {
    if (document.querySelector('#model-config-guide')) return;
    const dialog = document.createElement('dialog');
    dialog.id = 'model-config-guide';
    dialog.className = 'model-help-dialog';
    dialog.setAttribute('aria-labelledby', 'model-guide-title');
    dialog.innerHTML = zh ? `
      <div class="help-dialog-heading"><h2 id="model-guide-title">模型配置说明</h2><button type="button" class="text-button" data-close-help aria-label="关闭配置说明">关闭 ×</button></div>
      <p>准备好自己的模型服务账号和 API Key，按下面的步骤连接。</p>
      <ol class="help-steps">
        <li><h3>选择模型服务商</h3><p>需要联网搜索时选择千问。DeepSeek 当前仅接入普通问答。服务商、地区和 Key 必须对应。</p><p><a class="inline-link" href="https://help.aliyun.com/zh/model-studio/get-api-key" target="_blank" rel="noopener noreferrer">千问官方 Key 获取说明 ↗</a> · <a class="inline-link" href="https://api-docs.deepseek.com/" target="_blank" rel="noopener noreferrer">DeepSeek 官方接入说明 ↗</a></p></li>
        <li><h3>填写模型与业务空间</h3><p>模型名称默认已填好；若账号不支持，请改为该账号可用的模型名称。千问的业务空间 ID 从百炼控制台复制：新加坡区必填；中国区留空时使用旧版通用接口，填写后使用对应业务空间地址。DeepSeek 无需填写此项。</p></li>
        <li><h3>填写 API Key，确认使用说明</h3><p>将 Key 粘贴到密码输入框。需要联网时勾选“启用联网搜索”，再确认数据发送说明。Key 仅保留在本页内存，刷新或关闭后需重填；可配置加密云备份另行保存。</p></li>
        <li><h3>测试连接并保存</h3><p>点击“测试连接”，成功后点击“保存并返回”。测试只发送一条简短消息，不验证联网搜索；联网效果需要实际提问确认。保存设置本身不会调用模型。</p></li>
      </ol>
      <section class="help-note"><h3>费用和常见问题</h3><p>模型、联网搜索、知识提炼和复习出题或判题都可能消耗服务商额度，由你的服务商账号承担，App 不代收费用。</p><p>Key 无效：检查服务商、地区及 Key 是否对应。连接失败：检查网络、业务空间和模型名称。额度不足：前往服务商控制台检查。未返回来源时，App 不会将回答标为已完成联网核查。</p><p>请勿把 Key 发在聊天中。查看本说明不会读取或发送你的 Key，也不会丢失表单内容。</p></section>
      <div class="actions"><button type="button" class="primary-button" data-close-help>返回配置</button></div>` : `
      <div class="help-dialog-heading"><h2 id="model-guide-title">Model setup guide</h2><button type="button" class="text-button" data-close-help aria-label="Close setup guide">Close ×</button></div>
      <p>Use your own model provider account and API key.</p>
      <ol class="help-steps">
        <li><h3>Choose a provider</h3><p>Choose Qwen for web search. The current DeepSeek adapter supports Q&A without search. Match your provider, region and key.</p><p><a class="inline-link" href="https://help.aliyun.com/en/model-studio/get-api-key" target="_blank" rel="noopener noreferrer">Qwen key instructions ↗</a> · <a class="inline-link" href="https://api-docs.deepseek.com/" target="_blank" rel="noopener noreferrer">DeepSeek documentation ↗</a></p></li>
        <li><h3>Model and workspace</h3><p>A default model name is provided; change it if your account uses another model. Copy the Qwen workspace ID from Model Studio. Singapore requires it. Leaving it empty for China uses the legacy shared endpoint; providing it uses the workspace endpoint. DeepSeek does not require a workspace.</p></li>
        <li><h3>Enter your API key and confirm sharing</h3><p>Paste your key into the password field. Enable web search if needed, then confirm the sharing notice. The key stays in page memory and clears on reload or close. Encrypted cloud backup can be configured separately.</p></li>
        <li><h3>Test and save</h3><p>Test the connection, then save and return. The test sends a short message and does not test search. Verify search with a real question. Saving settings does not call the model.</p></li>
      </ol>
      <section class="help-note"><h3>Costs and troubleshooting</h3><p>Model calls, search, knowledge extraction and review generation or grading may use your provider balance. The app does not collect these payments.</p><p>For an invalid key, check the provider and region. For connection errors, check the network, workspace and model name. Check balance or quota in your provider’s console. Without returned sources, the app does not claim a verified web search.</p><p>Do not paste keys into chat. Opening this guide does not read or send your key or discard your form.</p></section>
      <div class="actions"><button type="button" class="primary-button" data-close-help>Back to setup</button></div>`;
    dialog.querySelectorAll('[data-close-help]').forEach(button => { button.onclick = () => closeDialog(dialog); });
    dialog.addEventListener('close', () => { dialog.remove(); document.querySelector('#model-help-link')?.focus(); }, { once: true });
    document.body.append(dialog);
    dialog.showModal();
  }
  link.onclick = event => { event.preventDefault(); guide(); };
  let seen = seenThisPage;
  try { seen ||= localStorage.getItem(SEEN_KEY) === 'true'; } catch { /* Fall back to this page only. */ }
  if (!showWelcome || seen || document.querySelector('#model-help-welcome')) return;
  const welcome = document.createElement('dialog');
  welcome.id = 'model-help-welcome';
  welcome.className = 'model-help-dialog model-help-welcome';
  welcome.setAttribute('aria-labelledby', 'model-welcome-title');
  welcome.setAttribute('aria-describedby', 'model-welcome-description');
  welcome.innerHTML = `<span class="help-location" aria-hidden="true">↗</span><h2 id="model-welcome-title">${zh ? '第一次连接模型？' : 'Connecting a model for the first time?'}</h2><p id="model-welcome-description">${zh ? '本页右上角有“配置说明”链接。里面有 Key 获取入口、填写步骤和常见问题，之后随时都能查看。' : 'Look for “Setup guide” at the top right of this page. It includes key instructions, setup steps and troubleshooting, and stays available anytime.'}</p><div class="actions"><button type="button" class="secondary-button" id="model-help-dismiss">${zh ? '知道了' : 'Got it'}</button><button type="button" class="primary-button" id="model-help-read">${zh ? '查看配置说明' : 'Read the guide'}</button></div>`;
  welcome.querySelector('#model-help-dismiss').onclick = () => welcome.close();
  welcome.querySelector('#model-help-read').onclick = () => { welcome.close(); guide(); };
  welcome.addEventListener('close', () => {
    seenThisPage = true;
    try { localStorage.setItem(SEEN_KEY, 'true'); } catch { /* Keep current-page acknowledgement. */ }
    welcome.remove();
    if (!document.querySelector('#model-config-guide')) document.querySelector('#model-help-link')?.focus();
  }, { once: true });
  document.body.append(welcome);
  welcome.showModal();
}
