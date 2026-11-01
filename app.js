import { createChatUI } from './chat-ui.js';
import { PROFILE_KEY as STORAGE_KEY } from './local-space.js';

const moduleIds = ['coding', 'english', 'work', 'life'];
const levels = ['beginner', 'some', 'advanced'];
const words = {
  zh: {
    brand: '知回', subtitle: '把好问题，变成记得住的知识。', language: 'English',
    preview: '本地体验版 · 设置与问答仅保存在当前浏览器', setup: '建立你的学习空间',
    setupHint: '先选感兴趣的领域，随时可以回来调整。', age: '成年确认',
    ageHint: '仅供年满 18 岁的用户使用。生日只用于本次判断，不保存完整生日。', birthday: '出生日期',
    ageFail: '此应用仅供年满 18 岁的用户使用。', ageInvalid: '请输入有效的出生日期。',
    ageDone: '已完成成年确认', areas: '学习模块', areasHint: '至少启用一个模块；各模块分别记录学习水平和复习进度。',
    coding: '编程', english: '英语', work: '工作知识', life: '生活常识',
    codingHint: '理解代码背后的逻辑', englishHint: '在真实情境中理解与表达', workHint: '把方法用到日常工作', lifeHint: '弄懂身边的为什么',
    beginner: '入门', some: '了解一些', advanced: '较熟悉', level: '当前基础',
    plan: '每日复习计划', planHint: '这是建议时长，完成后可以继续，也可以随时调整。', minutes: '分钟',
    start: '进入学习空间', save: '保存设置', cancel: '取消', chooseModule: '请至少启用一个学习模块。',
    storageError: '无法保存设置。请检查浏览器是否允许本地存储后重试。',
    hello: '今天，也多懂一点。', homeHint: '从一个好问题开始，让知识慢慢积累。', settings: '学习设置',
    today: '今日复习', emptyTitle: '你的知识库，等待第一个问题',
    emptyHint: '问答会自动整理到知识库。可在顶部进入逐题复习。', zero: '待复习',
    modulesTitle: '我的学习模块', isolated: '独立记录 · 按你的基础学习',
    next: '问答、知识整理与逐题复习已接入。设备提醒与账号同步可在顶部设置。',
    reviewPlan: '每日计划', weekly: '周日回顾', weekHint: '周日回顾一周知识，仍可自由提问。',
    notifications: '复习提醒', notificationHint: '后续接入系统通知时，将先征求你的同意。当前没有发送通知。',
    sunday: '今天是周日，适合回顾这一周的收获。', local: '本地保存',
  },
  en: {
    brand: 'Knowledge Review', subtitle: 'Turn good questions into lasting knowledge.', language: '中文',
    preview: 'Local preview · Settings and chats stay in this browser', setup: 'Make room for learning',
    setupHint: 'Choose your interests. You can adjust them anytime.', age: 'Age confirmation',
    ageHint: 'For adults aged 18 and over. Your birth date is checked here and is not stored.', birthday: 'Date of birth',
    ageFail: 'This app is only available to adults aged 18 and over.', ageInvalid: 'Enter a valid date of birth.',
    ageDone: 'Adult eligibility confirmed', areas: 'Learning modules', areasHint: 'Enable at least one. Each module has its own level and review progress.',
    coding: 'Coding', english: 'English', work: 'Work knowledge', life: 'Everyday knowledge',
    codingHint: 'Understand the logic behind code', englishHint: 'Understand and express ideas in context', workHint: 'Put useful methods into practice', lifeHint: 'Explore the reasons behind everyday things',
    beginner: 'Beginner', some: 'Some experience', advanced: 'Confident', level: 'Your starting level',
    plan: 'Daily review plan', planHint: 'A suggested duration, not a limit. Keep going or adjust it anytime.', minutes: 'min',
    start: 'Enter your learning space', save: 'Save settings', cancel: 'Cancel', chooseModule: 'Enable at least one learning module.',
    storageError: 'Unable to save. Allow browser storage and try again.',
    hello: 'Understand a little more today.', homeHint: 'Start with a good question. Build knowledge over time.', settings: 'Learning settings',
    today: 'Today’s review', emptyTitle: 'Your first question starts here',
    emptyHint: 'Q&A becomes knowledge cards. Open Review above to practice.', zero: 'to review',
    modulesTitle: 'My learning modules', isolated: 'Separate progress · Your own level',
    next: 'Q&A, knowledge cards and review are connected. Device and account settings are available above.',
    reviewPlan: 'Daily plan', weekly: 'Sunday recap', weekHint: 'Review the week on Sundays. New questions are always welcome.',
    notifications: 'Review reminders', notificationHint: 'We will ask permission before connecting system notifications. No notifications are being sent.',
    sunday: 'It’s Sunday. A good time to revisit what you learned this week.', local: 'Saved locally',
  },
};

export function isAdult(dateString, today = new Date()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString)) return null;
  const [year, month, day] = dateString.split('-').map(Number);
  const birth = new Date(year, month - 1, day);
  if (year < 1900 || birth.getFullYear() !== year || birth.getMonth() !== month - 1 || birth.getDate() !== day) return null;
  const current = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  if (birth > current) return null;
  let age = current.getFullYear() - year;
  if (current.getMonth() < month - 1 || (current.getMonth() === month - 1 && current.getDate() < day)) age--;
  return age >= 18;
}

export function validProfile(value) {
  return Boolean(value && value.version === 1 && ['zh', 'en'].includes(value.locale)
    && value.adultVerification?.isAdult === true
    && value.adultVerification?.method === 'self-declared-birthdate'
    && Number.isFinite(Date.parse(value.adultVerification?.verifiedAt))
    && [5, 10, 20].includes(value.dailyMinutes)
    && moduleIds.every(id => value.modules?.[id]
      && typeof value.modules[id].enabled === 'boolean' && levels.includes(value.modules[id].level))
    && moduleIds.some(id => value.modules[id].enabled));
}

function readProfile() {
  try { const saved = JSON.parse(localStorage.getItem(STORAGE_KEY)); if (validProfile(saved)) return saved; } catch { /* Show setup when local data is unavailable or invalid. */ }
  return undefined;
}

// Fields are found again by id, or by name inside a form identified by a data attribute.
export function focusSelector(element) {
  if (!element || element === document.body) return '';
  if (element.id) return `#${CSS.escape(element.id)}`;
  const form = element.closest?.('form[data-card-edit]');
  return form && element.name ? `form[data-card-edit="${CSS.escape(form.dataset.cardEdit)}"] [name="${CSS.escape(element.name)}"]` : '';
}

function captureFocus() {
  const element = document.activeElement, selector = focusSelector(element);
  if (!selector || !document.querySelector('#app')?.contains(element)) return null;
  let range = null;
  try { if (typeof element.selectionStart === 'number') range = [element.selectionStart, element.selectionEnd, element.selectionDirection]; } catch { /* Not a text field. */ }
  return { selector, range, scrollTop: element.scrollTop };
}

function restoreFocus(focus) {
  if (!focus) return;
  const element = document.querySelector(focus.selector);
  if (!element || element.disabled) return;
  element.focus({ preventScroll: true });
  if (focus.range) try { element.setSelectionRange(...focus.range); } catch { /* Field type has no selection. */ }
  element.scrollTop = focus.scrollTop;
}

function boot() {
  let profile = readProfile();
  let locale = profile?.locale || (navigator.language.startsWith('zh') ? 'zh' : 'en');
  const blankDraft = () => ({
    version: 1, locale, dailyMinutes: 10,
    modules: Object.fromEntries(moduleIds.map(id => [id, { enabled: true, level: 'beginner' }])),
  });
  let editing = !profile;
  let draft = profile ? structuredClone(profile) : blankDraft();
  let birthInput = '';
  let errorKey = '';
  const app = document.querySelector('#app');
  const t = key => words[locale][key];
  const chat = createChatUI({ getProfile: () => profile, getLocale: () => locale, refresh: () => render(),validateProfile:validProfile,adaptLevel:(id,level,at)=>{
    const next=structuredClone(profile);next.modules[id].level=level;next.modules[id].adaptedAt=at;
    try{localStorage.setItem(STORAGE_KEY,JSON.stringify(next));profile=next;}catch{/* Keep prior level if saving fails. */}
  },reloadProfile:()=>{
    // Called after cloud restore or undo replaced local data.
    profile = readProfile(); birthInput = ''; errorKey = '';
    if (profile) { locale = profile.locale; draft = structuredClone(profile); editing = false; }
    else { draft = blankDraft(); editing = true; }
  }});
  if (profile) chat.ensureModule();
  const todayString = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  };

  function render() {
    // Background callbacks (dictation, extraction, sign-in) redraw the page; keep the user's focus and caret.
    const focus = captureFocus();
    renderPage();
    restoreFocus(focus);
  }

  function renderPage() {
    document.documentElement.lang = locale === 'zh' ? 'zh-CN' : 'en';
    document.title = t('brand');
    app.innerHTML = `
      <header class="header"><a class="brand" href="/" aria-label="${t('brand')}"><span class="brand-mark" aria-hidden="true">↗</span>${t('brand')}</a>
        <div class="header-actions">${profile && !editing ? chat.nav() : ''}<button class="text-button" id="language" ${chat.locked ? 'disabled' : ''}>${t('language')}</button></div></header>
      <main>${editing ? setupView() : chat.isHome ? homeView() : chat.view()}</main>
      <footer>${t('preview')}</footer>`;
    document.querySelector('#language').onclick = () => {
      const next = locale === 'zh' ? 'en' : 'zh';
      if (profile && !editing) {
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...profile, locale: next })); }
        catch { errorKey = 'storageError'; editing = true; draft = structuredClone(profile); render(); return; }
        profile.locale = next;
      }
      locale = next; draft.locale = locale; render();
    };
    if (editing) bindSetup();
    else {
      const settings = document.querySelector('#settings');
      if (settings) settings.onclick = () => {
        if (chat.locked) return;
        draft = structuredClone(profile); birthInput = ''; errorKey = ''; editing = true; render(); window.scrollTo(0, 0);
      };
      chat.bind();
    }
  }

  function setupView() {
    return `<section class="intro"><span class="eyebrow">${t('brand')}</span><h1>${t('setup')}</h1><p>${t('setupHint')}</p></section>
      <form id="setup" novalidate>
        <section class="panel"><h2><span class="step">01</span>${t('age')}</h2>
          ${profile ? `<p class="verified">✓ ${t('ageDone')}</p>` : `<p>${t('ageHint')}</p><label class="date-label" for="birthday">${t('birthday')}</label><input id="birthday" name="birthday" type="date" min="1900-01-01" max="${todayString()}" required aria-describedby="form-error">`}
        </section>
        <section class="panel"><h2><span class="step">02</span>${t('areas')}</h2><p>${t('areasHint')}</p>
          <div class="module-grid">${moduleIds.map((id, i) => `<div class="module-option ${draft.modules[id].enabled ? 'selected' : ''}">
            <label class="module-label"><span class="module-number">0${i + 1}</span><strong>${t(id)}</strong><input type="checkbox" data-module="${id}" ${draft.modules[id].enabled ? 'checked' : ''}></label>
            <p class="module-description">${t(`${id}Hint`)}</p><label class="level-label" for="level-${id}">${t('level')}</label>
            <select id="level-${id}" data-level="${id}" ${draft.modules[id].enabled ? '' : 'disabled'}>${levels.map(level => `<option value="${level}" ${draft.modules[id].level === level ? 'selected' : ''}>${t(level)}</option>`).join('')}</select>
          </div>`).join('')}</div>
        </section>
        <section class="panel"><h2><span class="step">03</span>${t('plan')}</h2><p>${t('planHint')}</p>
          <div class="duration-options">${[5, 10, 20].map(minutes => `<label class="duration"><input type="radio" name="duration" value="${minutes}" ${draft.dailyMinutes === minutes ? 'checked' : ''}><span><strong>${minutes}</strong> ${t('minutes')}</span></label>`).join('')}</div>
        </section>
        <p id="form-error" class="error" role="alert" tabindex="-1">${errorKey ? t(errorKey) : ''}</p>
        <div class="actions">${profile ? `<button type="button" class="secondary-button" id="cancel">${t('cancel')}</button>` : ''}<button class="primary-button" type="submit">${t(profile ? 'save' : 'start')} <span aria-hidden="true">→</span></button></div>
      </form>`;
  }

  function homeView() {
    const date = new Intl.DateTimeFormat(locale === 'zh' ? 'zh-CN' : 'en', { dateStyle: 'full' }).format(new Date());
    return `<section class="intro home-intro"><div><span class="eyebrow">${date}</span><h1>${t('hello')}</h1><p>${t('homeHint')}</p></div><button class="secondary-button" id="settings">${t('settings')}</button></section>
      ${new Date().getDay() === 0 ? `<div class="sunday-note">${t('sunday')}</div>` : ''}
      <div class="dashboard"><section class="panel review-panel"><div class="section-heading"><h2>${t('today')}</h2><span class="pill">${chat.reviewCount()} ${t('zero')}</span></div>
        <div class="empty-state"><div class="empty-icon" aria-hidden="true">✧</div><h3>${chat.reviewCount()?(locale==='zh'?'今天的复习已准备好':'Your review is ready'):t('emptyTitle')}</h3><p>${t('emptyHint')}</p><button class="primary-button" data-review>${locale==='zh'?'进入复习':'Open review'} →</button></div></section>
        <aside class="panel plan-panel"><span class="eyebrow">${t('reviewPlan')}</span><div class="plan-value">${profile.dailyMinutes}<span>${t('minutes')}</span></div><hr><h3>${t('weekly')}</h3><p>${t('weekHint')}</p><h3>${t('notifications')}</h3><p>${t('notificationHint')}</p></aside></div>
      <section class="modules-section"><div class="section-heading"><h2>${t('modulesTitle')}</h2><span class="muted">${t('local')}</span></div><div class="module-grid">${moduleIds.filter(id => profile.modules[id].enabled).map(id => `<article class="panel home-module"><span class="eyebrow">${t(profile.modules[id].level)}</span><h3>${t(id)}</h3><p>${t('isolated')}</p><div class="module-count">${chat.messageCount(id)} <span>${chat.homeText('records')}</span></div><button class="secondary-button module-open" data-open-module="${id}">${chat.homeText('open')} →</button></article>`).join('')}</div></section>
      <p class="development-note">${t('next')}</p>`;
  }

  function bindSetup() {
    const birthday = document.querySelector('#birthday');
    if (birthday) { birthday.value = birthInput; birthday.oninput = event => { birthInput = event.target.value; }; }
    document.querySelectorAll('[data-module]').forEach(input => {
      input.onchange = () => { draft.modules[input.dataset.module].enabled = input.checked; input.closest('.module-option').classList.toggle('selected', input.checked); document.querySelector(`#level-${input.dataset.module}`).disabled = !input.checked; };
    });
    document.querySelectorAll('[data-level]').forEach(input => { input.onchange = () => { draft.modules[input.dataset.level].level = input.value; }; });
    document.querySelectorAll('[name="duration"]').forEach(input => { input.onchange = () => { draft.dailyMinutes = Number(input.value); }; });
    const cancel = document.querySelector('#cancel');
    if (cancel) cancel.onclick = () => { locale = profile.locale; editing = false; errorKey = ''; render(); };
    document.querySelector('#setup').onsubmit = event => {
      event.preventDefault(); errorKey = '';
      if (!profile) {
        const eligible = isAdult(birthInput);
        if (eligible !== true) errorKey = eligible === false ? 'ageFail' : 'ageInvalid';
      }
      if (!errorKey && !moduleIds.some(id => draft.modules[id].enabled)) errorKey = 'chooseModule';
      if (errorKey) { render(); document.querySelector('#form-error').focus(); return; }
      const candidate = { ...draft, locale, adultVerification: profile?.adultVerification || { isAdult: true, verifiedAt: new Date().toISOString(), method: 'self-declared-birthdate' } };
      if(profile)for(const id of moduleIds)if(profile.modules[id].level!==candidate.modules[id].level)candidate.modules[id].adaptedAt=new Date().toISOString();
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(candidate)); }
      catch { errorKey = 'storageError'; render(); document.querySelector('#form-error').focus(); return; }
      profile = candidate; chat.ensureModule(); editing = false; birthInput = ''; render(); window.scrollTo(0, 0);
    };
  }
  render();
  if(profile)chat.openingPopup();
  if('serviceWorker'in navigator)navigator.serviceWorker.register('/sw.js').catch(()=>{});
}

if (typeof document !== 'undefined') boot();
