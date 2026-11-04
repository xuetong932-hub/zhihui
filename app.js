import { createChatUI } from './chat-ui.js';
import { moduleStyles } from './memory-viz.js';
import { moduleIcon, iconSvg, CUSTOM_ICONS } from './module-icons.js';
import { initBackground, openBackgroundDialog } from './background.js';
import { localDay } from './knowledge-store.js';
import { streakDays } from './review-store.js';
import { DAILY_GOALS, DEFAULT_GOAL, goalOf, doneToday, goalStreak, openShareDialog } from './habit.js';
import { PROFILE_KEY as STORAGE_KEY } from './local-space.js';
import { createAuth } from './auth.js';
import { createAuthGate } from './auth-ui.js';
import { escapeHtml as esc } from './chat-store.js';
import { PRESET_MODULES as moduleIds, LEVELS as levels, MAX_CUSTOM_MODULES, isCustomModule, cleanModuleName, validModules, validDailyMinutes, newCustomModuleId, activeModuleIds, moduleLabel } from './modules.js';
const words = {
  zh: {
    brand: '知回', subtitle: '把好问题，变成记得住的知识。', language: 'English',
    preview: '体验版 · 学习记录保存在当前浏览器，可在账号页加密同步', setup: '建立你的学习空间',
    setupHint: '随时可以回来调整。', skipHint: '选择感兴趣的学习模块。也可以先跳过，使用默认设置（全部内置模块、入门），之后在“学习设置”中修改。',
    skip: '跳过，使用默认设置', areas: '学习模块', areasHint: '至少启用一个模块；各模块分别记录学习水平和复习进度。',
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
    reviewPlan: '复习安排', weekly: '周日回顾', weekHint: '周日回顾一周知识，仍可自由提问。',
    notifications: '复习提醒', notificationHint: '后续接入系统通知时，将先征求你的同意。当前没有发送通知。',
    sunday: '今天是周日，适合回顾这一周的收获。', local: '本地保存',
    customHint: '自定义模块', moduleName: '模块名称', addModule: '添加模块', newModulePlaceholder: '新模块名称，例如：历史、摄影、理财',
    addHint: `最多 ${MAX_CUSTOM_MODULES} 个自定义模块，名称 1–20 字。`, deleteModule: '删除模块',
    archived: '已删除的模块（学习记录保留）', restore: '恢复',
    nameError: '模块名称需为 1–20 个字，且不能与其他自定义模块重名。', tooMany: `最多 ${MAX_CUSTOM_MODULES} 个自定义模块。`,
    enable: '启用', select: '选择', selectAll: '全选', clearSelection: '取消全选', enableSelected: '启用所选', disableSelected: '停用所选', deleteSelected: '删除所选',
    selectedCount: '已选 {n} 个', selectNone: '请先选择模块。', keepOne: '至少保留一个启用的模块。',
    deleteHint: '删除的模块会移到“已删除的模块”，学习记录保留，可随时恢复；没有记录的自定义模块会直接移除。',
    batchHint: '每天按到期和薄弱程度分批安排复习，长时间未打开也不会一次塞入全部积压。',
    pendingChanges: '以上修改在保存后生效；取消则不改动。',
  },
  en: {
    brand: 'Knowledge Review', subtitle: 'Turn good questions into lasting knowledge.', language: '中文',
    preview: 'Preview · Learning records stay in this browser; encrypted sync is on the Account page', setup: 'Make room for learning',
    setupHint: 'You can adjust these anytime.', skipHint: 'Choose the learning modules you want. You can also skip and use the defaults (all built-in modules, beginner) and change them later in Learning settings.',
    skip: 'Skip and use defaults', areas: 'Learning modules', areasHint: 'Enable at least one. Each module has its own level and review progress.',
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
    reviewPlan: 'Review schedule', weekly: 'Sunday recap', weekHint: 'Review the week on Sundays. New questions are always welcome.',
    notifications: 'Review reminders', notificationHint: 'We will ask permission before connecting system notifications. No notifications are being sent.',
    sunday: 'It’s Sunday. A good time to revisit what you learned this week.', local: 'Saved locally',
    customHint: 'Custom module', moduleName: 'Module name', addModule: 'Add module', newModulePlaceholder: 'New module name, e.g. History, Photography',
    addHint: `Up to ${MAX_CUSTOM_MODULES} custom modules, 1–20 characters each.`, deleteModule: 'Delete module',
    archived: 'Deleted modules (learning records kept)', restore: 'Restore',
    nameError: 'Module names must be 1–20 characters and not repeat another custom module.', tooMany: `Up to ${MAX_CUSTOM_MODULES} custom modules.`,
    enable: 'Enabled', select: 'Select', selectAll: 'Select all', clearSelection: 'Clear selection', enableSelected: 'Enable selected', disableSelected: 'Disable selected', deleteSelected: 'Delete selected',
    selectedCount: '{n} selected', selectNone: 'Select modules first.', keepOne: 'Keep at least one module enabled.',
    deleteHint: 'Deleted modules move to “Deleted modules” with their learning records kept and can be restored anytime; custom modules without records are removed.',
    batchHint: 'Review is scheduled in daily batches by due date and weakness, so a long break never arrives as one huge backlog.',
    pendingChanges: 'Changes apply when you save; Cancel leaves everything as it was.',
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
    // server-birthdate: decided at registration; operator-admin: administrator created by the operator;
    // self-declared: profiles from before accounts.
    && ['server-birthdate', 'operator-admin', 'self-declared-birthdate'].includes(value.adultVerification?.method)
    && Number.isFinite(Date.parse(value.adultVerification?.verifiedAt))
    && validDailyMinutes(value.dailyMinutes)
    // Daily review goal in cards (optional; profiles saved before it existed use the default).
    && (value.dailyGoal === undefined || DAILY_GOALS.includes(value.dailyGoal))
    && validModules(value.modules));
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
    version: 1, locale, dailyMinutes: 10, dailyGoal: DEFAULT_GOAL,
    modules: Object.fromEntries(moduleIds.map(id => [id, { enabled: true, level: 'beginner' }])),
  });
  let editing = false;
  // Settings draft plus its unsaved inputs: the new module name and the modules picked for bulk actions.
  let draft, newModuleName = '';
  const picked = new Set();
  const openDraft = value => { draft = structuredClone(value); newModuleName = ''; picked.clear(); };
  openDraft(profile || blankDraft());
  let errorKey = '';
  const app = document.querySelector('#app');
  const t = key => words[locale][key];
  // The gate runs first; the learning app is created after sign-in or after the user picks local mode ({ local: true }).
  const auth = createAuth();
  let chat = null, account = null;
  const gate = createAuthGate({ auth, locale: () => locale, refresh: () => render(), onReady: acct => {
    account = acct;
    profile = readProfile();
    // Administrators go straight into the app with default settings, changeable later in Learning settings.
    if (!profile && acct.is_admin) {
      const defaults = { ...blankDraft(), adultVerification: { isAdult: true, verifiedAt: new Date().toISOString(), method: 'operator-admin' } };
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(defaults)); profile = defaults; } catch { /* Falls back to the setup page. */ }
    }
    if (profile) locale = profile.locale; else { openDraft(blankDraft()); editing = true; }
    chat = createChatUI({ getProfile: () => profile, getLocale: () => locale, refresh: () => render(), validateProfile: validProfile, auth, getAccount: () => account,
      shareCheckIn: () => openShareDialog({ locale, data: shareData() }),
      signOut: async () => { await auth.signOut(); location.reload(); },
      adaptLevel: (id, level, at) => {
        const next = structuredClone(profile); next.modules[id].level = level; next.modules[id].adaptedAt = at;
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); profile = next; } catch { /* Keep prior level if saving fails. */ }
      }, reloadProfile: () => {
        // Called after cloud restore, import or undo replaced local data.
        profile = readProfile(); errorKey = '';
        if (profile) { locale = profile.locale; openDraft(profile); editing = false; }
        else { openDraft(blankDraft()); editing = true; }
      } });
    if (profile) chat.ensureModule();
    render();
    if (profile) chat.openingPopup();
  } });

  function render() {
    // Background callbacks (dictation, extraction, sign-in) redraw the page; keep the user's focus and caret.
    const focus = captureFocus();
    renderPage();
    restoreFocus(focus);
  }

  function themeButton() {
    const mode = window.knowledgeReviewTheme?.theme === 'dark' ? 'dark' : 'light', next = mode === 'dark' ? 'light' : 'dark';
    const name = key => ({ light: locale === 'zh' ? '白天' : 'Day', dark: locale === 'zh' ? '黑夜' : 'Night' })[key];
    const label = locale === 'zh' ? `外观：${name(mode)}，点击切换为${name(next)}` : `Appearance: ${name(mode)}. Click for ${name(next)}`;
    return `<button class="text-button theme-toggle" id="theme-toggle" title="${label}" aria-label="${label}"><span aria-hidden="true">${mode === 'dark' ? '☾' : '☀'}</span><span class="theme-name">${name(mode)}</span></button>`;
  }

  // Phone layout (/m/): pages are switched from an icon tab bar at the bottom; appearance, language, account,
  // device and model settings move to the 我的 tab. The web layout is unchanged.
  const phone = document.documentElement.dataset.layout === 'mobile';
  const TABS = [
    ['home', 'house', ['home', 'chat'], '首页', 'Home'], ['review', 'repeat', ['review'], '复习', 'Review'], ['library', 'book', ['library'], '知识库', 'Knowledge'],
    ['discover', 'compass', ['discover', 'recommend', 'square'], '发现', 'Discover'], ['me', 'user', ['me', 'device', 'cloud', 'admin', 'model'], '我的', 'Me'],
  ];
  // Icon on top, its name below in the current language only (Chinese or English, never both).
  function tabBar(locked) {
    return `<nav class="tabbar" aria-label="${locale === 'zh' ? '主导航' : 'Main'}">${TABS.map(([id, icon, pages, zh, en]) => {
      const on = pages.includes(chat.page), label = locale === 'zh' ? zh : en;
      return `<button class="tab ${on ? 'active' : ''}" data-tab="${id}" ${on ? 'aria-current="page"' : ''} ${locked ? 'disabled' : ''}>${iconSvg(icon, 24)}<span class="tab-label">${label}</span></button>`;
    }).join('')}</nav>`;
  }
  // The Android app download is offered in a phone browser on Android, not inside the installed app itself.
  // The app reveals itself through the referrer on launch only, so that is remembered for the session.
  try { if (document.referrer.startsWith('android-app://')) sessionStorage.setItem('knowledge-review.in-app', '1'); } catch { /* Then only display mode decides. */ }
  const inAndroidApp = () => { try { return sessionStorage.getItem('knowledge-review.in-app') === '1'; } catch { return false; } };
  const androidBrowser = () => /Android/i.test(navigator.userAgent) && !matchMedia('(display-mode: standalone)').matches && !inAndroidApp();
  function meView() {
    const zh = locale === 'zh', dark = window.knowledgeReviewTheme?.theme === 'dark';
    const row = (attrs, icon, label, value = '') => `<button class="me-row" ${attrs}><span class="me-icon">${icon}</span><span class="me-label">${label}</span>${value ? `<span class="me-value">${value}</span>` : ''}<span class="me-chevron" aria-hidden="true">›</span></button>`;
    const name = account?.local ? (zh ? '本地模式' : 'Local mode') : account?.username || (account?.is_admin ? (zh ? '管理员' : 'Administrator') : (zh ? '已登录' : 'Signed in'));
    return `<section class="me-head"><span class="me-avatar">${iconSvg('user', 28)}</span><div><h1>${esc(name)}</h1><p>${account?.local ? (zh ? '记录只保存在这台设备' : 'Records stay on this device') : (zh ? '学习记录保存在本机，可在账号中加密同步' : 'Records are kept here; encrypted sync is in Account')}</p></div></section>
      <div class="me-group"><h2>${zh ? '学习' : 'Learning'}</h2>${row('id="settings"', iconSvg('bookmark'), t('settings'), zh ? `目标 ${goalOf(profile)} 张` : `Goal ${goalOf(profile)}`)}${row('id="background-open"', iconSvg('palette'), zh ? '背景' : 'Background')}${row('id="theme-toggle"', iconSvg('bulb'), zh ? '外观' : 'Appearance', dark ? (zh ? '黑夜' : 'Night') : (zh ? '白天' : 'Day'))}${row('id="language"', iconSvg('globe'), zh ? '语言' : 'Language', zh ? '中文' : 'English')}</div>
      <div class="me-group"><h2>${zh ? '账号与设备' : 'Account & device'}</h2>${account?.local ? row('data-signin', iconSvg('user'), zh ? '登录 / 注册' : 'Sign in / Register') : row('data-cloud', iconSvg('user'), zh ? '账号与同步' : 'Account & sync')}${row('data-device', iconSvg('camera'), zh ? '设备与提醒' : 'Device & reminders')}${account?.is_admin ? row('data-admin', iconSvg('chart'), zh ? '管理' : 'Admin') : ''}${row('data-model-settings', iconSvg('flask'), chat.homeText('modelSettings'))}${row('data-onboarding', iconSvg('compass'), zh ? '产品演示' : 'Product tour')}${row('data-tour', iconSvg('bulb'), zh ? '新手指引' : 'Guided tour')}</div>
      ${androidBrowser() ? `<div class="me-group"><h2>${zh ? '安卓 App' : 'Android app'}</h2><a class="me-row" href="/zhihui.apk" download="zhihui.apk"><span class="me-icon">${iconSvg('download')}</span><span class="me-label">${zh ? '下载安卓 App' : 'Download the Android app'}</span><span class="me-value">${zh ? '约 1 MB' : 'About 1 MB'}</span><span class="me-chevron" aria-hidden="true">›</span></a><p class="me-note">${zh ? '安装时手机会提示"未知来源应用"，选择仍然安装即可。App 打开的仍是知回网站，内容随网站自动更新。' : 'Your phone will warn about an app from an unknown source; choose to install anyway. The app opens the 知回 website, so it updates with the site.'}</p></div>` : ''}
      <p class="development-note">${t('preview')}</p>`;
  }
  // Daily goal: cards reviewed today against the goal, days in a row it was met, and the check-in image once reached.
  function goalState() {
    const events = chat.reviewEvents(), goal = goalOf(profile);
    return { goal, done: doneToday(events), streak: streakDays(events), goalStreak: goalStreak(events, goal) };
  }
  function shareData() {
    const state = goalState(), date = new Intl.DateTimeFormat(locale === 'zh' ? 'zh-CN' : 'en', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' }).format(new Date());
    const today = chat.reviewedToday();
    return { ...state, date, modules: [...new Set(today.map(card => moduleLabel(profile, card.module, locale)))], titles: today.map(card => card.title) };
  }
  const shareButton = className => `<button class="${className}" data-share-card>${locale === 'zh' ? '生成打卡图' : 'Make check-in image'}</button>`;
  function goalBar() {
    const { goal, done, goalStreak: met } = goalState(), zh = locale === 'zh', reached = done >= goal;
    return `<div class="goal-bar ${reached ? 'reached' : ''}"><div class="goal-text"><strong>${zh ? `今日目标 ${Math.min(done, goal)} / ${goal} 张` : `Today’s goal ${Math.min(done, goal)} / ${goal}`}</strong><span>${reached ? (zh ? '已完成 ✓' : 'Done ✓') : ''}${met ? (zh ? ` · 连续达成 ${met} 天` : ` · met ${met} days in a row`) : ''}</span></div>
      <progress max="${goal}" value="${Math.min(done, goal)}" aria-label="${zh ? '今日目标进度' : 'Today’s goal progress'}"></progress>${reached ? shareButton('text-button goal-share') : ''}</div>`;
  }
  // Phone home, in the style of study apps: one task card with progress, today's list, then modules to ask in.
  function homePhoneView() {
    const zh = locale === 'zh', due = chat.reviewCount(), events = chat.reviewEvents(), today = localDay(new Date());
    const done = new Set(events.filter(event => localDay(event.at) === today).map(event => event.cardId)).size, total = done + due, streak = streakDays(events);
    const goal = goalOf(profile), reached = done >= goal, met = goalStreak(events, goal);
    const length = 2 * Math.PI * 42, progress = Math.min(1, done / goal);
    const ring = `<svg class="task-ring-svg" viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="42" fill="none" stroke="currentColor" stroke-opacity=".25" stroke-width="8"/><circle cx="50" cy="50" r="42" fill="none" stroke="currentColor" stroke-width="8" stroke-linecap="round" stroke-dasharray="${(length * progress).toFixed(1)} ${length.toFixed(1)}" transform="rotate(-90 50 50)"/></svg>`;
    const date = new Intl.DateTimeFormat(zh ? 'zh-CN' : 'en', { month: 'long', day: 'numeric', weekday: 'long' }).format(new Date());
    return `<section class="m-hello"><span class="eyebrow">${date}</span><h1>${t('hello')}</h1></section>
      <section class="task-card"><div class="task-top"><div class="task-ring">${ring}<div class="task-ring-text"><strong>${done}</strong><span>/ ${goal}</span></div></div>
        <div class="task-info"><h2>${reached ? (zh ? '今日目标完成 ✓' : 'Goal reached ✓') : (zh ? `今日目标 ${goal} 张` : `Today’s goal: ${goal}`)}</h2><p>${due ? (zh ? `还有 ${due} 个知识点待复习` : `${due} ideas left to review`) : total ? (zh ? '今天的复习完成了' : 'Review done for today') : (zh ? '还没有要复习的知识' : 'Nothing to review yet')}</p>
        <div class="task-stats"><span><b>${streak}</b>${zh ? ' 天连续' : ' day streak'}</span><span><b>${met}</b>${zh ? ' 天达成' : ' days met'}</span></div></div></div>
        ${total ? `<button class="task-start" data-review>${due ? (zh ? '开始复习' : 'Start review') : (zh ? '再练一会' : 'Practise more')} →</button>` : `<button class="task-start" data-open-module="${activeModuleIds(profile)[0]}">${zh ? '去提问' : 'Ask a question'} →</button>`}${reached ? shareButton('task-share') : ''}</section>
      ${chat.starterHome() ? `<div class="m-section">${chat.starterHome()}</div>` : ''}
      <section class="m-section"><div class="section-heading"><h2>${zh ? '今日清单' : 'Today’s list'}</h2><span class="pill">${due} ${t('zero')}</span></div>${reviewPreview()}</section>
      <section class="m-section"><div class="section-heading"><h2>${zh ? '继续提问' : 'Keep asking'}</h2></div><div class="module-strip">${activeModuleIds(profile).map(id => `<button class="strip-card" data-open-module="${id}"><span class="module-badge">${moduleIcon(profile, id, 22)}</span><strong>${esc(moduleLabel(profile, id, locale))}</strong><span class="muted">${chat.messageCount(id)} ${chat.homeText('records')}</span></button>`).join('')}</div></section>`;
  }

  function renderPage() {
    document.documentElement.lang = locale === 'zh' ? 'zh-CN' : 'en';
    document.title = t('brand');
    // The first-run guide is full-screen: no tab bar and no page navigation until it is finished or skipped.
    const inApp = Boolean(chat), locked = inApp ? chat.locked : gate.busy, guide = inApp && chat.page === 'onboarding', tabs = phone && inApp && profile && !editing && !guide;
    app.innerHTML = `
      <header class="header"><a class="brand" href="${phone ? '/m/' : '/'}" aria-label="${t('brand')}"><span class="brand-mark" aria-hidden="true">↗</span>${t('brand')}</a>
        ${tabs ? '' : `<div class="header-actions">${inApp && profile && !editing && !guide ? chat.nav() : ''}${themeButton()}<button class="text-button theme-toggle" id="background-open" aria-label="${locale === 'zh' ? '背景' : 'Background'}"><span aria-hidden="true">▧</span><span class="theme-name">${locale === 'zh' ? '背景' : 'Background'}</span></button><button class="text-button" id="language" ${locked ? 'disabled' : ''}>${t('language')}</button></div>`}</header>
      <main>${!inApp ? gate.view() : editing ? setupView() : tabs && chat.isHome ? homePhoneView() : tabs && chat.page === 'me' ? meView() : chat.isHome ? homeView() : chat.view()}</main>
      ${tabs ? tabBar(locked) : `<footer>${t('preview')}</footer>`}`;
    const on = (selector, handler) => { const element = document.querySelector(selector); if (element) element.onclick = handler; };
    document.querySelectorAll('[data-tab]').forEach(button => { button.onclick = () => chat.go(button.dataset.tab); });
    document.querySelectorAll('[data-share-card]').forEach(button => { button.onclick = () => openShareDialog({ locale, data: shareData() }); });
    // Day / night switch (theme.js applies it before paint and remembers it per device).
    on('#theme-toggle', () => { window.knowledgeReviewTheme?.toggle(); render(); });
    on('#background-open', () => openBackgroundDialog(locale));
    on('#language', () => {
      const next = locale === 'zh' ? 'en' : 'zh';
      if (inApp && profile && !editing) {
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...profile, locale: next })); }
        catch { errorKey = 'storageError'; editing = true; openDraft(profile); render(); return; }
        profile.locale = next;
      }
      locale = next; draft.locale = locale; render();
    });
    if (!inApp) { gate.bind(); return; }
    if (editing) bindSetup();
    else {
      const settings = document.querySelector('#settings');
      if (settings) settings.onclick = () => {
        if (chat.locked) return;
        openDraft(profile); errorKey = ''; editing = true; render(); window.scrollTo(0, 0);
      };
      chat.bind();
    }
  }

  // Learning modules. After registration this step is optional; skipping saves the defaults.
  // Modules can be picked for bulk actions (select all, enable, disable, delete). Deleting archives a module with
  // its records kept (built-in modules always), or removes a custom module that has no records.
  // Every change stays in the draft until saved.
  const draftName = id => isCustomModule(id) ? draft.modules[id].name : t(id);
  function moduleCard(id, index) {
    const item = draft.modules[id], custom = isCustomModule(id);
    return `<div class="module-option ${item.enabled ? 'selected' : ''} ${picked.has(id) ? 'picked' : ''}">
      <div class="module-label"><input type="checkbox" class="module-pick" data-pick="${id}" ${picked.has(id) ? 'checked' : ''} aria-label="${t('select')} ${esc(draftName(id))}"><span class="module-number">${String(index + 1).padStart(2, '0')}</span><span class="module-badge small" data-module-badge="${id}">${moduleIcon(draft, id, 16)}</span><strong data-module-title="${id}">${esc(draftName(id))}</strong><label class="enable-toggle"><input type="checkbox" data-module="${id}" ${item.enabled ? 'checked' : ''}>${t('enable')}</label></div>
      ${custom ? `<label class="level-label" for="name-${id}">${t('moduleName')} · ${t('customHint')}</label><input id="name-${id}" class="module-name-input" type="text" maxlength="20" data-module-name="${id}" value="${esc(item.name)}">
        <span class="level-label">${locale === 'zh' ? '图标' : 'Icon'}</span><div class="icon-picker" role="group" aria-label="${locale === 'zh' ? '选择图标' : 'Choose an icon'}">${CUSTOM_ICONS.map(name => `<button type="button" class="icon-choice ${(item.icon || 'bookmark') === name ? 'active' : ''}" data-module-icon="${id}" data-icon="${name}" aria-pressed="${(item.icon || 'bookmark') === name}">${iconSvg(name, 18)}</button>`).join('')}</div>` :`<p class="module-description">${t(`${id}Hint`)}</p>`}
      <label class="level-label" for="level-${id}">${t('level')}</label>
      <select id="level-${id}" data-level="${id}" ${item.enabled ? '' : 'disabled'}>${levels.map(level => `<option value="${level}" ${item.level === level ? 'selected' : ''}>${t(level)}</option>`).join('')}</select>
      <button type="button" class="text-button module-delete" data-delete-module="${id}">${t('deleteModule')}</button>
    </div>`;
  }
  function setupView() {
    const visible = visibleModules(), archived = Object.keys(draft.modules).filter(id => draft.modules[id].archived);
    const customCount = visible.filter(isCustomModule).length;
    return `<section class="intro"><span class="eyebrow">${t('brand')}</span><h1>${t(profile ? 'settings' : 'setup')}</h1><p>${t(profile ? 'setupHint' : 'skipHint')}</p></section>
      <form id="setup" novalidate>
        <section class="panel"><h2>${t('areas')}</h2><p>${t('areasHint')}</p>
          <div class="module-toolbar"><button type="button" class="secondary-button" id="pick-all">${t('selectAll')}</button><button type="button" class="secondary-button" id="pick-none" ${picked.size ? '' : 'disabled'}>${t('clearSelection')}</button><span class="muted" id="pick-count">${t('selectedCount').replace('{n}', picked.size)}</span><span class="toolbar-gap"></span><button type="button" class="secondary-button" id="enable-picked" ${picked.size ? '' : 'disabled'}>${t('enableSelected')}</button><button type="button" class="secondary-button" id="disable-picked" ${picked.size ? '' : 'disabled'}>${t('disableSelected')}</button><button type="button" class="secondary-button danger-button" id="delete-picked" ${picked.size ? '' : 'disabled'}>${t('deleteSelected')}</button></div>
          <div class="module-grid">${visible.map(moduleCard).join('')}</div>
          <p class="field-hint">${t('deleteHint')}</p>
          <div class="add-module"><label class="field-label" for="new-module-name">${t('addModule')}</label><div class="add-module-row"><input id="new-module-name" type="text" maxlength="20" placeholder="${t('newModulePlaceholder')}" value="${esc(newModuleName)}" ${customCount >= MAX_CUSTOM_MODULES ? 'disabled' : ''}><button type="button" class="secondary-button" id="add-module" ${customCount >= MAX_CUSTOM_MODULES ? 'disabled' : ''}>＋ ${t('addModule')}</button></div><p class="field-hint">${t('addHint')}</p></div>
          ${archived.length ? `<div class="archived-modules"><h3>${t('archived')}</h3>${archived.map(id => `<div class="archived-row"><span>${esc(draftName(id))}</span><button type="button" class="text-button" data-restore-module="${id}">${t('restore')}</button></div>`).join('')}</div>` : ''}
        </section>
        <section class="panel goal-settings"><h2>${locale === 'zh' ? '每日目标' : 'Daily goal'}</h2><p>${locale === 'zh' ? '每天想复习多少张卡片？只用于激励和打卡，不改变复习安排；超过目标也可以继续练。' : 'How many cards do you want to review each day? It is for motivation and check-ins only; review scheduling does not change, and you can keep going past it.'}</p>
          <div class="segmented goal-options" role="group" aria-label="${locale === 'zh' ? '每日目标' : 'Daily goal'}">${DAILY_GOALS.map(goal => `<button type="button" class="${goalOf(draft) === goal ? 'active' : ''}" data-goal="${goal}" aria-pressed="${goalOf(draft) === goal}">${locale === 'zh' ? `${goal} 张` : `${goal} cards`}</button>`).join('')}</div></section>
        ${profile ? `<p class="field-hint">${t('pendingChanges')}</p>` : ''}
        <p id="form-error" class="error" role="alert" tabindex="-1">${errorKey ? t(errorKey) : ''}</p>
        <div class="actions">${profile ? `<button type="button" class="secondary-button" id="cancel">${t('cancel')}</button>` : `<button type="button" class="secondary-button" id="skip-setup">${t('skip')}</button>`}<button class="primary-button" type="submit">${t(profile ? 'save' : 'start')} <span aria-hidden="true">→</span></button></div>
      </form>`;
  }

  // Today's queue as a short read-only list; review itself still starts from the button.
  function reviewPreview() {
    const zh = locale === 'zh', items = chat.reviewPreview(), shown = items.slice(0, 5);
    const button = `<button class="primary-button" data-review>${zh ? '进入复习' : 'Open review'} →</button>`;
    const hasCards = activeModuleIds(profile).some(id => chat.knowledgeCount(id));
    if (!items.length) return `<div class="empty-state"><div class="empty-icon" aria-hidden="true">✧</div><h3>${hasCards ? (zh ? '今天没有到期的复习' : 'Nothing due today') : t('emptyTitle')}</h3><p>${hasCards ? (zh ? '新卡片从第二天开始复习；想现在练习，可以进入复习后选择“自主加练”。' : 'New cards are reviewed from tomorrow. To practise now, open Review and choose Extra practice.') : t('emptyHint')}</p>${button}</div>`;
    const styles = moduleStyles([...new Set([...activeModuleIds(profile), ...items.map(item => item.card.module)])]);
    const kinds = { new: zh ? '新学' : 'New', due: zh ? '到期' : 'Due', weak: zh ? '薄弱' : 'Weak' };
    const ago = at => {
      if (!at) return zh ? '还没复习过' : 'Not reviewed yet';
      const [y, m, d] = localDay(at).split('-').map(Number), now = new Date();
      const days = Math.round((new Date(now.getFullYear(), now.getMonth(), now.getDate()) - new Date(y, m - 1, d)) / 86400000);
      const when = days <= 0 ? (zh ? '今天' : 'today') : days === 1 ? (zh ? '昨天' : 'yesterday') : zh ? `${days} 天前` : `${days} days ago`;
      return zh ? `上次复习：${when}` : `Last reviewed ${when}`;
    };
    const rows = shown.map(({ card, last, kind }) => `<li class="preview-item"><div class="preview-main"><span class="preview-title">${esc(card.title)}</span><span class="preview-kind kind-${kind}">${kinds[kind]}</span></div>
      <div class="preview-meta"><span class="preview-module">${moduleIcon(profile, card.module, 14, styles.get(card.module)?.color)}${esc(moduleLabel(profile, card.module, locale))}</span><span>${ago(last)}</span></div></li>`).join('');
    const more = items.length > shown.length ? `<p class="preview-more">${zh ? `还有 ${items.length - shown.length} 条` : `${items.length - shown.length} more`}</p>` : '';
    return `<ol class="review-preview">${rows}</ol>${more}<div class="preview-actions">${button}</div>`;
  }

  function homeView() {
    const date = new Intl.DateTimeFormat(locale === 'zh' ? 'zh-CN' : 'en', { dateStyle: 'full' }).format(new Date());
    return `<section class="intro home-intro"><div><span class="eyebrow">${date}</span><h1>${t('hello')}</h1><p>${t('homeHint')}</p></div><button class="secondary-button" id="settings">${t('settings')}</button></section>
      ${new Date().getDay() === 0 ? `<div class="sunday-note">${t('sunday')}</div>` : ''}${chat.starterHome()}
      <div class="dashboard"><section class="panel review-panel"><div class="section-heading"><h2>${t('today')}</h2><span class="pill">${chat.reviewCount()} ${t('zero')}</span></div>
        ${goalBar()}${reviewPreview()}</section>
        <aside class="panel plan-panel"><span class="eyebrow">${t('reviewPlan')}</span><p>${t('batchHint')}</p><hr><h3>${t('weekly')}</h3><p>${t('weekHint')}</p><h3>${t('notifications')}</h3><p>${t('notificationHint')}</p></aside></div>
      <section class="modules-section"><div class="section-heading"><h2>${t('modulesTitle')}</h2><span class="muted">${t('local')}</span></div><div class="module-grid">${activeModuleIds(profile).map(id => `<article class="panel home-module"><span class="module-badge">${moduleIcon(profile, id, 22)}</span><span class="eyebrow">${t(profile.modules[id].level)}${isCustomModule(id) ? ` · ${t('customHint')}` : ''}</span><h3>${esc(moduleLabel(profile, id, locale))}</h3><p>${t('isolated')}</p><div class="module-count">${chat.messageCount(id)} <span>${chat.homeText('records')}</span></div><button class="secondary-button module-open" data-open-module="${id}">${chat.homeText('open')} →</button></article>`).join('')}</div></section>
      <p class="development-note">${t('next')}</p>`;
  }

  function saveProfile(candidate) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(candidate)); }
    catch { errorKey = 'storageError'; render(); document.querySelector('#form-error').focus(); return; }
    profile = candidate; chat.ensureModule(); editing = false; render(); window.scrollTo(0, 0);
  }
  // The account service confirmed the user is an adult before the app opened.
  const adultRecord = () => profile?.adultVerification || { isAdult: true, verifiedAt: new Date().toISOString(), method: 'server-birthdate' };
  const visibleModules = () => Object.keys(draft.modules).filter(id => !draft.modules[id].archived);
  const visibleCustom = () => visibleModules().filter(isCustomModule);
  const nameTaken = (name, except) => visibleCustom().some(id => id !== except && draft.modules[id].name.toLowerCase() === name.toLowerCase());
  const showError = key => { errorKey = key; render(); document.querySelector('#form-error')?.focus(); };
  // Whether at least one module stays enabled if these ids are removed or disabled.
  const keepsOneActive = ids => visibleModules().some(id => !ids.includes(id) && draft.modules[id].enabled);
  function deleteModules(ids) {
    if (!keepsOneActive(ids)) { showError('keepOne'); return; }
    for (const id of ids) {
      if (isCustomModule(id) && !chat.moduleHasData(id)) delete draft.modules[id];
      else Object.assign(draft.modules[id], { archived: true, enabled: false }, isCustomModule(id) ? { name: cleanModuleName(draft.modules[id].name) || t('customHint') } : {});
      picked.delete(id);
    }
    errorKey = ''; render();
  }

  function bindSetup() {
    document.querySelectorAll('[data-module]').forEach(input => {
      input.onchange = () => {
        const id = input.dataset.module;
        if (!input.checked && !keepsOneActive([id])) { input.checked = true; showError('keepOne'); return; }
        draft.modules[id].enabled = input.checked; input.closest('.module-option').classList.toggle('selected', input.checked); document.querySelector(`#level-${id}`).disabled = !input.checked;
      };
    });
    document.querySelectorAll('[data-pick]').forEach(input => { input.onchange = () => { if (input.checked) picked.add(input.dataset.pick); else picked.delete(input.dataset.pick); errorKey = ''; render(); }; });
    document.querySelector('#pick-all').onclick = () => { visibleModules().forEach(id => picked.add(id)); errorKey = ''; render(); };
    document.querySelector('#pick-none').onclick = () => { picked.clear(); errorKey = ''; render(); };
    document.querySelector('#enable-picked').onclick = () => { if (!picked.size) { showError('selectNone'); return; } for (const id of picked) draft.modules[id].enabled = true; errorKey = ''; render(); };
    document.querySelector('#disable-picked').onclick = () => {
      if (!picked.size) { showError('selectNone'); return; }
      if (!keepsOneActive([...picked])) { showError('keepOne'); return; }
      for (const id of picked) draft.modules[id].enabled = false; errorKey = ''; render();
    };
    document.querySelector('#delete-picked').onclick = () => { if (!picked.size) { showError('selectNone'); return; } deleteModules([...picked]); };
    document.querySelectorAll('[data-delete-module]').forEach(button => { button.onclick = () => deleteModules([button.dataset.deleteModule]); });
    document.querySelectorAll('[data-level]').forEach(input => { input.onchange = () => { draft.modules[input.dataset.level].level = input.value; }; });
    document.querySelectorAll('[data-module-name]').forEach(input => { input.oninput = () => {
      const id = input.dataset.moduleName; draft.modules[id].name = input.value;
      document.querySelector(`[data-module-title="${id}"]`).textContent = input.value;
    }; });
    document.querySelectorAll('[data-goal]').forEach(button => { button.onclick = () => {
      draft.dailyGoal = Number(button.dataset.goal);
      document.querySelectorAll('[data-goal]').forEach(other => { const on = other === button; other.classList.toggle('active', on); other.setAttribute('aria-pressed', on); });
    }; });
    document.querySelectorAll('[data-module-icon]').forEach(button => { button.onclick = () => {
      const id = button.dataset.moduleIcon; draft.modules[id].icon = button.dataset.icon;
      document.querySelectorAll(`[data-module-icon="${id}"]`).forEach(other => { const on = other === button; other.classList.toggle('active', on); other.setAttribute('aria-pressed', on); });
      document.querySelector(`[data-module-badge="${id}"]`).innerHTML = moduleIcon(draft, id, 16);
    }; });
    const newName = document.querySelector('#new-module-name');
    if (newName) { newName.oninput = () => { newModuleName = newName.value; }; newName.onkeydown = event => { if (event.key === 'Enter') { event.preventDefault(); document.querySelector('#add-module').click(); } }; }
    document.querySelector('#add-module').onclick = () => {
      const name = cleanModuleName(newModuleName);
      if (visibleCustom().length >= MAX_CUSTOM_MODULES) { showError('tooMany'); return; }
      if (!name || name.length > 20 || nameTaken(name)) { showError('nameError'); return; }
      draft.modules[newCustomModuleId()] = { enabled: true, level: 'beginner', name };
      newModuleName = ''; errorKey = ''; render(); document.querySelector('#new-module-name')?.focus();
    };
    document.querySelectorAll('[data-restore-module]').forEach(button => { button.onclick = () => {
      const id = button.dataset.restoreModule;
      if (isCustomModule(id) && visibleCustom().length >= MAX_CUSTOM_MODULES) { showError('tooMany'); return; }
      if (isCustomModule(id) && nameTaken(draft.modules[id].name, id)) { showError('nameError'); return; }
      Object.assign(draft.modules[id], { archived: false, enabled: true }); errorKey = ''; render();
    }; });
    const cancel = document.querySelector('#cancel');
    if (cancel) cancel.onclick = () => { locale = profile.locale; editing = false; errorKey = ''; openDraft(profile); render(); };
    const skip = document.querySelector('#skip-setup');
    if (skip) skip.onclick = () => { errorKey = ''; saveProfile({ ...blankDraft(), locale, adultVerification: adultRecord() }); };
    document.querySelector('#setup').onsubmit = event => {
      event.preventDefault(); errorKey = '';
      const modules = structuredClone(draft.modules);
      for (const id of Object.keys(modules)) if (isCustomModule(id)) modules[id].name = cleanModuleName(modules[id].name);
      if (!Object.values(modules).some(item => item.enabled && !item.archived)) { showError('chooseModule'); return; }
      if (!validModules(modules)) { showError('nameError'); return; }
      // The daily duration is no longer a setting; the stored value is kept only for older app versions.
      const dailyMinutes = validDailyMinutes(draft.dailyMinutes) ? draft.dailyMinutes : 10;
      const candidate = { ...draft, modules, dailyMinutes, locale, adultVerification: adultRecord() };
      if (profile) for (const id of Object.keys(modules)) if (profile.modules[id] && profile.modules[id].level !== modules[id].level) modules[id].adaptedAt = new Date().toISOString();
      saveProfile(candidate);
    };
  }
  render();
  void gate.start();
  initBackground();
  if('serviceWorker'in navigator)navigator.serviceWorker.register('/sw.js').catch(()=>{});
}

if (typeof document !== 'undefined') boot();
