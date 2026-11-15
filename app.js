import { createChatUI } from './chat-ui.js';
import { moduleStyles } from './memory-viz.js';
import { moduleIcon, iconSvg, CUSTOM_ICONS } from './module-icons.js';
import { localDay } from './knowledge-store.js';
import { streakDays } from './review-store.js';
import { DAILY_GOALS, DEFAULT_GOAL, goalOf, doneToday, goalStreak, weekSummary, openShareDialog } from './habit.js';
import { pineCones, petMood, MOOD_POSE } from './pet.js';
import { startPetPlay, flyCone } from './pet-physics.js';
import { achievements, newBadges } from './achievements.js';
import { storeView, showBadge, celebrateBadge, levelCard, badgeWall, levelTitle } from './badges-ui.js';
import { profileView, openAvatarSheet, avatarSrc, isPhotoAvatar } from './profile-ui.js';
import { cleanShop, shopState, buy, refund, equip, unequip, freezeDates, protectedStreak, wearOutfit, completeSets, itemById, ITEMS, PARTS, SETS } from './shop.js';
import { shopView, openItemSheet, decorLayer, frameImage, dressedSquirrel, isDressed, setName } from './shop-ui.js';
import { SCENES, SCENE_CATEGORIES, savedScene, saveScene, sceneImage, sceneThumb } from './scenes.js';
import { PROFILE_KEY as STORAGE_KEY } from './local-space.js';
import { createAuth } from './auth.js';
import { createAuthGate } from './auth-ui.js';
import { escapeHtml as esc } from './chat-store.js';
import { PRESET_MODULES as moduleIds, LEVELS as levels, MAX_CUSTOM_MODULES, isCustomModule, cleanModuleName, validModules, validDailyMinutes, newCustomModuleId, activeModuleIds, moduleLabel, withAllPresets, ASK_MODULE } from './modules.js';
import { pick, intlLocale, currentLocale, isLocale, setLocale, loadCatalog, needsCatalog, ENABLED, localeName, savedLocale, saveLocale } from './i18n.js';
// iOS Safari only applies :active to buttons when a touch listener exists (press-and-spring buttons in styles.css).
globalThis.document?.addEventListener('touchstart', () => {}, { passive: true });
const words = {
  zh: {
    brand: '知回', subtitle: '把好问题，变成记得住的知识。', language: 'English',
    preview: '体验版 · 学习记录保存在当前浏览器，可在账号页加密同步', setup: '建立你的学习空间',
    setupHint: '随时可以回来调整。', skipHint: '选择感兴趣的学习模块。也可以先跳过，使用默认设置（全部内置模块、入门），之后在“学习设置”中修改。',
    skip: '跳过，使用默认设置', areas: '知识分类', areasHint: '提问会自动归到亮着的分类里；也可以自己建书。',
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
    brand: 'KnowBack', subtitle: 'Turn good questions into lasting knowledge.', language: '中文',
    preview: 'Preview · Learning records stay in this browser; encrypted sync is on the Account page', setup: 'Make room for learning',
    setupHint: 'You can adjust these anytime.', skipHint: 'Choose the learning modules you want. You can also skip and use the defaults (all built-in modules, beginner) and change them later in Learning settings.',
    skip: 'Skip and use defaults', areas: 'Subjects', areasHint: 'Each question is filed into a subject that is on. You can also make your own books.',
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
  return Boolean(value && value.version === 1 && isLocale(value.locale)
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
  // Older profiles get the subjects added since they were saved; the next save stores them.
  try { const saved = JSON.parse(localStorage.getItem(STORAGE_KEY)); if (saved?.modules) saved.modules = withAllPresets(saved.modules); if (validProfile(saved)) return saved; } catch { /* Show setup when local data is unavailable or invalid. */ }
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
  // English until the user chooses. On first open the language page comes before sign-in, so every later page is
  // already in the chosen language; a profile made earlier counts as a choice.
  let locale = profile?.locale || savedLocale() || 'en';
  let choosingLanguage = !profile?.locale && !savedLocale();
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
  const t = key => pick(words.zh[key], words.en[key]);
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
    // New users skip the setup page: every subject is on and questions are filed automatically. Settings stay in 我的.
    if (!profile) {
      const defaults = { ...blankDraft(), adultVerification: adultRecord() };
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(defaults)); profile = defaults; } catch { /* Falls back to the setup page. */ }
    }
    if (profile) locale = profile.locale; else { openDraft(blankDraft()); editing = true; }
    chat = createChatUI({ getProfile: () => profile, getLocale: () => locale, refresh: () => render(), validateProfile: validProfile, auth, getAccount: () => account,
      shareCheckIn: () => openShareDialog({ locale, data: shareData() }),
      // The phone bookshelf adds, renames, recolours and removes books (modules). Same rules as the settings page:
      // removing archives the module (records kept); a custom module without records is deleted outright.
      // Returns '' on success or an error key.
      updateModules: change => {
        const modules = structuredClone(profile.modules);
        change(modules, { hasData: id => chat.moduleHasData(id) });
        if (!Object.values(modules).some(item => item.enabled && !item.archived)) return 'keepOne';
        if (Object.keys(modules).filter(id => isCustomModule(id) && !modules[id].archived).length > MAX_CUSTOM_MODULES) return 'tooMany';
        if (!validModules(modules)) return 'nameError';
        const next = { ...profile, modules };
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { return 'storageError'; }
        profile = next; chat.ensureModule(); render(); return '';
      },
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
    const name = key => ({ light: pick('白天', 'Day'), dark: pick('黑夜', 'Night') })[key];
    const label = pick('外观：{v0}，点击切换为{v1}', 'Appearance: {v0}. Click for {v1}', { v0: name(mode), v1: name(next) });
    return `<button class="text-button theme-toggle" id="theme-toggle" title="${label}" aria-label="${label}"><span aria-hidden="true">${mode === 'dark' ? '☾' : '☀'}</span><span class="theme-name">${name(mode)}</span></button>`;
  }

  // Phone layout (/m/): pages are switched from an icon tab bar at the bottom; appearance, language, account,
  // device and model settings move to the 我的 tab. The web layout is unchanged.
  const phone = document.documentElement.dataset.layout === 'mobile';
  // Five tabs with the squirrel's home in the middle as a raised round avatar; 发现 (recommendations and the square)
  // lives inside 知识库 on the phone, switched from the top of that page.
  const TABS = [
    ['home', 'house', ['home', 'chat'], () => pick('首页', 'Home')], ['review', 'repeat', ['review'], () => pick('复习', 'Review')],
    ['pet', '', ['pet'], () => pick('小回', 'Backy')],
    ['library', 'book', ['library', 'discover', 'recommend', 'square'], () => pick('知识库', 'Knowledge')], ['me', 'user', ['me', 'device', 'cloud', 'admin', 'model'], () => pick('我的', 'Me')],
  ];
  // Icon on top, its name below in the current language only (Chinese or English, never both).
  function tabBar(locked) {
    return `<nav class="tabbar" aria-label="${pick('主导航', 'Main')}"><span class="tab-pill" aria-hidden="true"></span>${TABS.map(([id, icon, pages, name]) => {
      const on = pages.includes(chat.page), label = name();
      if (id === 'pet') return `<button class="tab tab-pet ${on ? 'active' : ''}" data-tab="pet" aria-label="${label}" ${on ? 'aria-current="page"' : ''} ${locked ? 'disabled' : ''}><span class="pet-avatar"><img src="/illustrations/mascot-wave.webp" alt="" draggable="false"></span></button>`;
      return `<button class="tab ${on ? 'active' : ''}" data-tab="${id}" ${on ? 'aria-current="page"' : ''} ${locked ? 'disabled' : ''}>${iconSvg(icon, 24)}<span class="tab-label">${label}</span></button>`;
    }).join('')}</nav>`;
  }
  // 知识库 | 推荐 | 广场 switch at the top of those pages on the phone.
  const LIBRARY_PAGES = [['library', () => pick('知识库', 'Knowledge')], ['recommend', () => pick('推荐', 'For you')], ['square', () => pick('广场', 'Square')]];
  const librarySwitch = () => `<div class="segmented library-switch" role="group" aria-label="${pick('知识库', 'Knowledge')}">${LIBRARY_PAGES.map(([id, name]) => { const on = chat.page === id || (id === 'recommend' && chat.page === 'discover'); return `<button type="button" class="${on ? 'active' : ''}" data-lib-page="${id}" aria-pressed="${on}">${name()}</button>`; }).join('')}</div>`;
  // Tab switch motion: the capsule flows to the new tab like a drop. The leading edge arrives first and the trailing
  // edge follows a beat later, so it stretches (and flattens a little) on the way, then both settle with a small
  // spring. The new icon dips and pops back, the label colours cross-fade and the page is nudged in from the side
  // tapped; about 400 ms in all. It plays only when the active tab changes between renders (every render rebuilds
  // the bar), and reduced motion just places the capsule. Tabs share the bar equally, so % edges follow rotation.
  const TAB_SPRING = 'linear(0, .24 8%, .6 20%, .88 32%, 1.012 44%, 1.025 54%, 1.016 64%, 1.003 76%, .998 86%, 1)';
  const PAGE_FIXED = '.review-bar, #question-form, .photo-status'; // a transform would unpin these, so they only fade
  let shownTab = -1;
  function placeTabPill() {
    const bar = document.querySelector('.tabbar'), pill = bar?.querySelector('.tab-pill');
    const tabs = bar ? [...bar.querySelectorAll('.tab')] : [], index = tabs.findIndex(tab => tab.classList.contains('active'));
    if (!pill || index < 0) { shownTab = -1; if (pill) pill.hidden = true; return; }
    const edges = i => [`calc(${(i + 0.5) * 100 / tabs.length}% - 32px)`, `calc(${(tabs.length - i - 0.5) * 100 / tabs.length}% - 32px)`];
    const [left, right] = edges(index), previous = shownTab < tabs.length ? shownTab : -1;
    Object.assign(pill.style, { left, right, width: 'auto' });
    shownTab = index;
    if (previous < 0 || previous === index || !pill.animate || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const [oldLeft, oldRight] = edges(previous), forward = index > previous;
    const lead = { duration: 280, easing: TAB_SPRING }, trail = { duration: 340, delay: 60, easing: 'cubic-bezier(.3, .6, .25, 1)', fill: 'backwards' }; // only the front springs, so it never pinches
    pill.animate({ left: [oldLeft, left] }, forward ? trail : lead);
    pill.animate({ right: [oldRight, right] }, forward ? lead : trail);
    pill.animate([{ transform: 'scaleY(1)' }, { transform: 'scaleY(.86)', offset: 0.45 }, { transform: 'scaleY(1)' }], { duration: 400, easing: 'ease-in-out' });
    const lift = 'translateY(-1px) scale';
    tabs[index].querySelector('svg')?.animate([{ transform: `${lift}(1)` }, { transform: `${lift}(.8)`, offset: 0.3 }, { transform: `${lift}(1.12)`, offset: 0.7 }, { transform: `${lift}(1.06)` }], { duration: 400, easing: 'ease-out' });
    const on = getComputedStyle(tabs[index]).color, off = getComputedStyle(tabs[previous]).color, fade = { duration: 250, easing: 'ease' };
    tabs[index].animate({ color: [off, on] }, fade);
    tabs[previous].animate({ color: [on, off] }, fade);
    const shift = `translateX(${forward ? 24 : -24}px)`;
    for (const part of document.querySelector('main')?.children || []) {
      const pinned = part.matches(PAGE_FIXED) || part.querySelector(PAGE_FIXED);
      part.animate(pinned ? { opacity: [0.4, 1] } : { opacity: [0.4, 1], transform: [shift, 'none'] }, { duration: 400, easing: TAB_SPRING });
    }
  }
  // The Android app download is offered in a phone browser on Android, not inside the installed app itself.
  // The app reveals itself through the referrer on launch only, so that is remembered for the session.
  try { if (document.referrer.startsWith('android-app://')) sessionStorage.setItem('knowledge-review.in-app', '1'); } catch { /* Then only display mode decides. */ }
  const inAndroidApp = () => { try { return sessionStorage.getItem('knowledge-review.in-app') === '1'; } catch { return false; } };
  const androidBrowser = () => /Android/i.test(navigator.userAgent) && !matchMedia('(display-mode: standalone)').matches && !inAndroidApp();
  function meView() {
    const zh = locale === 'zh', dark = window.knowledgeReviewTheme?.theme === 'dark';
    const row = (attrs, icon, label, value = '') => `<button class="me-row" ${attrs}><span class="me-icon">${icon}</span><span class="me-label">${label}</span>${value ? `<span class="me-value">${value}</span>` : ''}<span class="me-chevron" aria-hidden="true">›</span></button>`;
    const name = account?.local ? (pick('本地模式', 'Local mode')) : account?.username || (account?.is_admin ? (pick('管理员', 'Administrator')) : (pick('已登录', 'Signed in')));
    const lv = petProgress().level;
    return `<button type="button" class="me-head" data-me-profile aria-label="${pick('个人主页', 'Profile')}"><span class="avatar-wrap"><span class="me-avatar ${isPhotoAvatar() ? 'is-photo' : ''}"><img src="${avatarSrc()}" alt="" decoding="async"></span>${frameImage(shopData().frame)}</span><div><h1>${esc(name)} <span class="me-lv">Lv.${lv.level} ${levelTitle(lv.level)}</span></h1><p>${account?.local ? (pick('记录只保存在这台设备', 'Records stay on this device')) : (pick('学习记录保存在本机，可在账号中加密同步', 'Records are kept here; encrypted sync is in Account'))}</p></div><span class="me-chevron" aria-hidden="true">›</span></button>
      ${meSummary()}
      <div class="me-group"><h2>${pick('学习', 'Learning')}</h2>${row('id="settings"', iconSvg('bookmark'), t('settings'), pick('目标 {v0} 张', 'Goal {v0}', { v0: goalOf(profile) }))}${row('id="theme-toggle"', iconSvg(dark ? 'moon' : 'sun'), pick('外观', 'Appearance'), dark ? (pick('黑夜', 'Night')) : (pick('白天', 'Day')))}${row('id="language"', iconSvg('globe'), pick('语言', 'Language'), localeName(locale))}</div>
      <div class="me-group"><h2>${pick('账号与设备', 'Account & device')}</h2>${account?.local ? row('data-signin', iconSvg('user'), pick('登录 / 注册', 'Sign in / Register')) : row('data-cloud', iconSvg('user'), pick('账号与同步', 'Account & sync'))}${row('data-device', iconSvg('camera'), pick('设备与提醒', 'Device & reminders'))}${account?.is_admin ? row('data-admin', iconSvg('chart'), pick('管理', 'Admin')) : ''}${row('data-model-settings', iconSvg('flask'), chat.homeText('modelSettings'))}${row('data-onboarding', iconSvg('compass'), pick('新手指引', 'Guided tour'))}</div>
      ${androidBrowser() ? `<div class="me-group"><h2>${pick('安卓 App', 'Android app')}</h2><a class="me-row" href="/zhihui.apk" download="zhihui.apk"><span class="me-icon">${iconSvg('download')}</span><span class="me-label">${pick('下载安卓 App', 'Download the Android app')}</span><span class="me-value">${pick('约 1 MB', 'About 1 MB')}</span><span class="me-chevron" aria-hidden="true">›</span></a><p class="me-note">${pick('安装时手机会提示"未知来源应用"，选择仍然安装即可。', 'Your phone will warn about an app from an unknown source; choose to install anyway.')}</p></div>` : ''}`;
  }
  // 我的 → learning summary: streak, live cards, cards reviewed in the last 7 days, with a bar for each day.
  function meSummary() {
    const { cards, week, reviewed } = weekSummary(chat.reviewEvents(), chat.knowledgeCards()), top = Math.max(1, ...week.map(item => item.count));
    const weekday = new Intl.DateTimeFormat(intlLocale(currentLocale()), { weekday: 'narrow' });
    const stat = (value, label) => `<span class="me-stat"><b>${value}</b><small>${label}</small></span>`;
    return `<button type="button" class="me-summary" data-me-library aria-label="${pick('学习小结，打开知识库', 'Learning summary, open the library')}"><span class="me-stats">${stat(shieldStreaks().any, pick('连续天数', 'Day streak'))}${stat(cards, pick('知识卡片', 'Cards'))}${stat(reviewed, pick('近 7 天复习', 'Reviewed, 7 days'))}</span>
      <span class="me-week" aria-hidden="true">${week.map((item, i) => { const [y, m, d] = item.day.split('-').map(Number); return `<span class="me-day ${i === 6 ? 'today' : ''}"><i data-bar="${Math.round(item.count / top * 100)}"></i><small>${weekday.format(new Date(y, m - 1, d))}</small></span>`; }).join('')}</span></button>`;
  }
  // Daily goal: cards reviewed today against the goal, days in a row it was met, and the check-in image once reached.
  function goalState() {
    const events = chat.reviewEvents(), goal = goalOf(profile);
    return { goal, done: doneToday(events), streak: shieldStreaks().any, goalStreak: shieldStreaks().goal };
  }
  function shareData() {
    const state = goalState(), date = new Intl.DateTimeFormat(intlLocale(currentLocale()), { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' }).format(new Date());
    const today = chat.reviewedToday();
    return { ...state, date, modules: [...new Set(today.map(card => moduleLabel(profile, card.module, locale)))], titles: today.map(card => card.title) };
  }
  const shareButton = className => `<button class="${className}" data-share-card>${pick('生成打卡图', 'Make check-in image')}</button>`;
  function goalBar() {
    const { goal, done, goalStreak: met } = goalState(), zh = locale === 'zh', reached = done >= goal;
    return `<div class="goal-bar ${reached ? 'reached' : ''}"><div class="goal-text"><strong>${pick('今日目标 {v0} / {goal} 张', 'Today’s goal {v0} / {goal}', { v0: Math.min(done, goal), goal })}</strong><span>${reached ? (pick('已完成 ✓', 'Done ✓')) : ''}${met ? (pick(' · 连续达成 {met} 天', ' · met {met} days in a row', { met })) : ''}</span></div>
      <progress max="${goal}" value="${Math.min(done, goal)}" aria-label="${pick('今日目标进度', 'Today’s goal progress')}"></progress>${reached ? shareButton('text-button goal-share') : ''}</div>`;
  }
  // Phone home, in the style of study apps: one task card with progress, today's list, then modules to ask in.
  // Squirrel actions (phone home). A tap makes the squirrel hop; a long press (or Enter / Space) opens a ring of six
  // round buttons around a larger copy of it in the middle of the screen, each showing one action. Choosing one
  // plays it on the home squirrel for a few seconds, then it returns to its usual pose for the day.
  // The pine cone (the squirrel's currency) as a small flat icon; 🌰 would read as a chestnut.
  const PINE_ICON = '<svg class="pine-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.2c.5 1 1.7 1.6 2.6 1.4-.3.9-1.2 1.6-2.1 1.7h-1c-.9-.1-1.8-.8-2.1-1.7.9.2 2.1-.4 2.6-1.4Z" fill="#4f8a5b"/><path d="M12 6.4c3.4 0 5.6 3.2 5.6 7 0 4.2-2.6 7.4-5.6 7.4s-5.6-3.2-5.6-7.4c0-3.8 2.2-7 5.6-7Z" fill="#b8733d" stroke="#6b3f1f" stroke-width="1.2"/><path d="M7.6 11.2c1.4 1 3 1.4 4.4 1.4s3-.4 4.4-1.4M6.9 14.6c1.6 1.1 3.3 1.6 5.1 1.6s3.5-.5 5.1-1.6M8.1 18c1.2.8 2.5 1.2 3.9 1.2s2.7-.4 3.9-1.2M12 6.6v13.9" fill="none" stroke="#6b3f1f" stroke-width=".9" stroke-linecap="round" opacity=".75"/><path d="M9.4 9.4c.6-.8 1.5-1.3 2.4-1.4" fill="none" stroke="#f3d3a8" stroke-width="1" stroke-linecap="round"/></svg>';
  const MASCOT_ACTIONS = [
    ['wave', () => pick('挥手', 'Wave'), '👋'], ['cheer', () => pick('开心', 'Cheer'), '🎉'], ['think', () => pick('思考', 'Think'), '💭'],
    ['shy', () => pick('害羞', 'Shy'), '😳'], ['stash', () => pick('藏松果', 'Stash a pine cone'), PINE_ICON], ['sleep', () => pick('睡觉', 'Sleep'), '😴'],
  ];
  const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  function playMascot(button, pose, hold = 3200) {
    const img = button.querySelector('img'), usual = button.dataset.pose, dressed = button.classList.contains('is-dressed');
    clearTimeout(button.mascotTimer);
    const stop = () => button.classList.remove(...[...button.classList].filter(name => name.startsWith('acting-')));
    if (!dressed) img.src = `/illustrations/mascot-${pose}.webp`;
    stop();
    void button.offsetWidth; // restart the animation when the same action is chosen twice
    if (!reducedMotion()) button.classList.add(`acting-${pose}`);
    button.mascotTimer = setTimeout(() => { if (button.isConnected) { if (!dressed) img.src = `/illustrations/mascot-${usual}.webp`; stop(); } }, hold);
  }
  function openMascotRing(button) {
    if (document.querySelector('.mascot-ring')) return;
    navigator.vibrate?.(12);
    const from = button.getBoundingClientRect(), current = button.querySelector('img').getAttribute('src');
    const layer = document.createElement('div');
    layer.className = 'mascot-ring'; layer.setAttribute('role', 'dialog'); layer.setAttribute('aria-modal', 'true'); layer.setAttribute('aria-label', pick('松鼠的动作', 'Squirrel actions'));
    layer.innerHTML = `<div class="ring-stage">${button.classList.contains('is-dressed') ? `<span class="ring-center dressed">${dressedSquirrel(shopData().outfit)}</span>` : `<img class="ring-center" src="${current}" alt="">`}${MASCOT_ACTIONS.map(([pose, name, icon]) => `<button type="button" class="ring-item" data-action="${pose}" aria-label="${name()}"><span class="ring-icon" aria-hidden="true">${icon}</span></button>`).join('')}</div>`;
    // Positions go through the CSSOM (the page's CSP blocks style attributes).
    layer.querySelectorAll('.ring-item').forEach((item, i) => { item.style.setProperty('--angle', `${i * 60 - 90}deg`); item.style.setProperty('--delay', `${i * 35}ms`); });
    document.body.append(layer);
    const center = layer.querySelector('.ring-center'), to = center.getBoundingClientRect();
    if (!reducedMotion() && center.animate) center.animate([{ transform: `translate(${from.left + from.width / 2 - (to.left + to.width / 2)}px, ${from.top + from.height / 2 - (to.top + to.height / 2)}px) scale(${from.width / to.width})` }, { transform: 'none' }], { duration: 380, easing: TAB_SPRING });
    void layer.offsetWidth; layer.classList.add('open'); // a forced layout lets the transition start from the closed state
    const close = () => { layer.classList.remove('open'); document.removeEventListener('keydown', onKey); setTimeout(() => layer.remove(), reducedMotion() ? 0 : 220); button.focus({ preventScroll: true }); };
    const onKey = event => { if (event.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    layer.addEventListener('click', event => {
      const item = event.target.closest('.ring-item');
      if (item) playMascot(button, item.dataset.action, item.dataset.action === 'sleep' ? 4500 : 3200);
      close();
    });
    layer.querySelector('.ring-item').focus({ preventScroll: true });
  }
  // The pine-cone jar on the pet page shows the cones the squirrel has already carried in. That number is kept on
  // this device only; the real count always comes from the review history (pet.js), so the jar catches up by playing
  // the stash scene for the difference.
  const JAR_KEY = 'knowledge-review.pet-jar.v1';
  function jarCount(total) {
    let n = NaN;
    try { n = Number.parseInt(localStorage.getItem(JAR_KEY), 10); } catch { /* This visit only. */ }
    return Number.isFinite(n) && n >= 0 ? Math.min(n, total) : 0;
  }
  function saveJarCount(n) { try { localStorage.setItem(JAR_KEY, String(n)); } catch { /* This visit only. */ } }
  // Cones pile up from the bottom of the jar (12 places); the tag shows the number.
  const JAR_SPOTS = [[0, 0], [15, 0], [30, 0], [7, 10], [23, 10], [0, 19], [15, 19], [30, 19], [7, 28], [23, 28], [4, 36], [26, 36]];
  function renderJar(jar, count, fresh = 0) {
    const pile = jar.querySelector('.pet-jar-pile'), shown = Math.min(count, JAR_SPOTS.length);
    pile.innerHTML = Array.from({ length: shown }, () => PINE_ICON).join('');
    [...pile.children].forEach((cone, i) => {
      cone.style.left = `${JAR_SPOTS[i][0]}px`; cone.style.bottom = `${JAR_SPOTS[i][1]}px`;
      cone.style.transform = `rotate(${(i * 47) % 50 - 25}deg)`;
      if (fresh && i >= shown - Math.min(fresh, shown) && count <= JAR_SPOTS.length) cone.classList.add('is-new');
    });
    jar.querySelector('.pet-jar-tag').textContent = String(count);
  }
  function bumpJar(jar) { jar.classList.remove('is-bump'); void jar.offsetWidth; jar.classList.add('is-bump'); }
  // While reviewing, every new pine cone flies from the middle of the screen to the squirrel in the tab bar.
  let lastCones = null;
  function flyNewCones() {
    if (!chat || !profile) return;
    const total = pineCones(chat.reviewEvents(), goalOf(profile)).total, before = lastCones;
    lastCones = total;
    const avatar = document.querySelector('.tab-pet .pet-avatar');
    if (before === null || total <= before || !avatar || chat.page === 'pet' || reducedMotion()) return;
    const to = avatar.getBoundingClientRect();
    flyCone(PINE_ICON, { x: innerWidth / 2, y: innerHeight * 0.42 }, { x: to.left + to.width / 2, y: to.top + to.height / 2 }, { ms: 700, lift: 120 })
      .then(() => { const tab = document.querySelector('.tab-pet'); if (tab) { tab.classList.remove('is-fed'); void tab.offsetWidth; tab.classList.add('is-fed'); } });
  }
  function bindMascot() {
    const button = document.querySelector('.today-mascot');
    if (!button) return;
    // On its own page the squirrel roams free (pet-physics.js); with reduced motion it stays on its cushion.
    const scene = button.closest('.pet-scene-wrap'), jar = scene?.querySelector('[data-pet-jar]');
    if (scene && jar) {
      const total = Number(jar.dataset.petJar) || 0;
      let stashed = jarCount(total);
      jar.onclick = () => bumpJar(jar);
      if (reducedMotion()) { stashed = total; saveJarCount(total); setTimeout(() => { if (button.isConnected) celebrateNewBadges(); }, 300); }
      renderJar(jar, stashed);
      if (!reducedMotion()) {
        const world = startPetPlay(button, scene, { usual: () => button.dataset.pose, sleepy: () => button.dataset.pose === 'sleep', ring: () => openMascotRing(button) });
        // New cones are carried to the jar first, then any newly earned badge is celebrated.
        const stashing = total > stashed ? world.stash(total - stashed, jar, k => { stashed += k; saveJarCount(stashed); renderJar(jar, stashed, k); bumpJar(jar); }, PINE_ICON) : new Promise(resolve => setTimeout(resolve, 900));
        stashing.then(() => { if (button.isConnected) celebrateNewBadges(); });
        return;
      }
    }
    let press = 0, opened = false, lastTap = 0;
    const cancel = () => { clearTimeout(press); press = 0; };
    button.addEventListener('pointerdown', event => { if (event.button > 0) return; opened = false; cancel(); press = setTimeout(() => { press = 0; opened = true; openMascotRing(button); }, 480); });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach(type => button.addEventListener(type, cancel));
    button.addEventListener('contextmenu', event => event.preventDefault());
    // A tap wobbles it like jelly, a double tap is a somersault; Enter / Space (keyboard) opens the ring, since a
    // long press is not possible there.
    button.addEventListener('click', event => {
      if (event.detail === 0) { openMascotRing(button); return; }
      if (opened) { opened = false; return; } // the click that ends a long press
      const now = performance.now(), double = now - lastTap < 320;
      lastTap = double ? 0 : now;
      if (reducedMotion()) { playMascot(button, button.dataset.pose, 900); return; }
      button.classList.remove('acting-jelly', 'acting-flip'); void button.offsetWidth;
      button.classList.add(double ? 'acting-flip' : 'acting-jelly');
      clearTimeout(button.mascotTimer);
      button.mascotTimer = setTimeout(() => button.classList.remove('acting-jelly', 'acting-flip'), 900);
    });
  }
  // Home background picker (phone home only): day / night at the top (the app's own two modes), then the scenes by
  // category as thumbnails. Choosing one swaps the home scene at once; the sheet stays open to try others.
  function openScenePicker(opener) {
    if (document.querySelector('.scene-sheet-layer')) return;
    const layer = document.createElement('div');
    layer.className = 'scene-sheet-layer';
    const draw = () => {
      const dark = document.documentElement.dataset.theme === 'dark', current = savedScene().id;
      layer.innerHTML = `<div class="scene-sheet" role="dialog" aria-modal="true" aria-label="${pick('背景', 'Background')}">
        <div class="scene-sheet-head"><h2>${pick('背景', 'Background')}</h2><button type="button" class="scene-close" data-scene-close aria-label="${pick('关闭', 'Close')}">✕</button></div>
        <div class="scene-mode" role="radiogroup" aria-label="${pick('白天 / 黑夜', 'Day / night')}"><button type="button" role="radio" aria-checked="${!dark}" data-scene-mode="light">☀ ${pick('白天', 'Day')}</button><button type="button" role="radio" aria-checked="${dark}" data-scene-mode="dark">☾ ${pick('黑夜', 'Night')}</button></div>
        <div class="scene-grid">${SCENES.map(scene => { const cat = SCENE_CATEGORIES.find(([id]) => id === scene.cat)[1](); return `<button type="button" class="scene-pick ${scene.id === current ? 'active' : ''}" data-scene="${scene.id}" aria-pressed="${scene.id === current}" aria-label="${cat} · ${scene.name()}"><img src="${sceneThumb(scene, dark)}" alt="" loading="lazy" decoding="async"><span>${scene.name()}</span><em>${cat}</em></button>`; }).join('')}</div>
      </div>`;
      layer.querySelectorAll('[data-scene]').forEach(button => { button.onclick = () => { saveScene(button.dataset.scene); render(); draw(); }; });
      layer.querySelectorAll('[data-scene-mode]').forEach(button => { button.onclick = () => { if (document.documentElement.dataset.theme !== button.dataset.sceneMode) window.knowledgeReviewTheme?.toggle(); render(); draw(); }; });
      layer.querySelector('[data-scene-close]').onclick = close;
    };
    const close = () => { layer.classList.remove('open'); document.removeEventListener('keydown', onKey); setTimeout(() => layer.remove(), 220); document.querySelector('[data-scene-picker]')?.focus({ preventScroll: true }); };
    const onKey = event => { if (event.key === 'Escape') close(); };
    layer.addEventListener('click', event => { if (event.target === layer) close(); });
    document.addEventListener('keydown', onKey);
    draw(); document.body.append(layer); void layer.offsetWidth; layer.classList.add('open');
    layer.querySelector('.scene-pick.active, .scene-pick')?.focus({ preventScroll: true });
  }
  // The squirrel's level and badges (achievements.js), and its store page (pet tab → 仓库).
  let petPage = 'room', mePage = 'main', shopTab = 'outfit', dressPart = 'head', dressLook = {}, dressNote = '', dressGood = false;
  // Shop (shop.js): purchases and furniture live in the profile (profile.shop) so they travel with the encrypted cloud
  // snapshot. Balance = pine cones earned (from history) − spent. Streak shields keep both streaks alive.
  const shopData = () => cleanShop(profile?.shop);
  const reviewDays = goalOnly => { const days = new Map(); for (const event of chat.reviewEvents()) { const day = localDay(event.at); if (!days.has(day)) days.set(day, new Set()); days.get(day).add(event.cardId); } const goal = goalOf(profile); return day => (days.get(day)?.size || 0) >= (goalOnly ? goal : 1); };
  const shieldStreaks = () => { const freezes = freezeDates(shopData()), goal = protectedStreak(reviewDays(true), freezes); return { goal: goal.streak, any: protectedStreak(reviewDays(false), freezes).streak, used: goal.used }; };
  const shopNow = () => shopState(shopData(), pineCones(chat.reviewEvents(), goalOf(profile)).total, shieldStreaks().used);
  function saveShop(next) {
    const candidate = { ...profile, shop: next };
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(candidate)); } catch { return false; }
    profile = candidate; return true;
  }
  const SHOP_ERRORS = { locked: () => pick('等级还不够', 'Your level is not high enough yet'), funds: () => pick('松果不够', 'Not enough pine cones'), owned: () => pick('已经拥有了', 'You already have it'), max: () => pick('最多同时持有 2 张', 'You can hold at most 2'), unknown: () => pick('买不了这个', 'This cannot be bought') };
  // With an outfit on, the home and room squirrel is the front-standing picture wearing it (shop-ui.js).
  const dressedClass = () => isDressed(shopData().outfit) ? 'dressed is-dressed' : '';
  const mascotPicture = pose => isDressed(shopData().outfit) ? dressedSquirrel(shopData().outfit) : `<img src="/illustrations/mascot-${pose}.webp" alt="" decoding="async" draggable="false">`;
  function petShopView() { return shopView({ state: shopNow(), data: shopData(), tab: shopTab, dress: { part: dressPart, look: dressLook, level: petProgress().level.level } }); }
  // Dressing room: taps change the look being tried on (dressLook: part → id, or null for bare); only 穿上 saves it.
  function tryOn(part, id) {
    const saved = shopData().outfit[part] || null, shown = part in dressLook ? dressLook[part] : saved;
    const next = id && shown !== id ? id : null;
    if (next === saved) delete dressLook[part]; else dressLook[part] = next;
  }
  function wearLook() {
    const level = petProgress().level.level, before = new Set(completeSets(shopData().outfit));
    let data = shopData();
    for (const id of new Set(Object.values(dressLook).filter(id => id && !shopNow().owned.has(id)))) {
      const result = buy(data, id, pineCones(chat.reviewEvents(), goalOf(profile)).total, { shieldsUsed: shieldStreaks().used, level });
      if (!result.ok) { dressNote = SHOP_ERRORS[result.error](); render(); return; }
      data = result.data; if (!saveShop(data)) { dressNote = pick('保存失败', 'Could not save'); render(); return; }
    }
    if (!saveShop(wearOutfit(shopData(), dressLook))) { dressNote = pick('保存失败', 'Could not save'); render(); return; }
    dressLook = {};
    const done = completeSets(shopData().outfit).filter(id => !before.has(id));
    dressGood = done.length > 0;
    dressNote = done.length ? pick('集齐「{name}」套装！', 'The {name} set is complete!', { name: setName(done[0]) }) : '';
    render();
    if (done.length) cheerDress();
  }
  function cheerDress() {
    const stage = document.querySelector('.dress-mascot');
    if (!stage) return;
    navigator.vibrate?.(20);
    stage.classList.remove('is-cheer'); void stage.offsetWidth; stage.classList.add('is-cheer');
    setTimeout(() => stage.classList.remove('is-cheer'), 1300);
  }
  function randomLook() {
    const level = petProgress().level.level;
    dressLook = {};
    for (const part of PARTS) {
      const options = ITEMS.filter(item => item.part === part && !(item.level > level)).map(item => item.id);
      const id = Math.random() < 0.2 ? null : options[Math.floor(Math.random() * options.length)];
      if (id !== (shopData().outfit[part] || null)) dressLook[part] = id;
    }
  }
  function openShopItem(id) {
    const earned = () => pineCones(chat.reviewEvents(), goalOf(profile)).total, used = () => shieldStreaks().used;
    openItemSheet(id, { state: shopNow, data: shopData, earned, shieldsUsed: used,
      onBuy: itemId => { const result = buy(shopData(), itemId, earned(), { shieldsUsed: used() }); if (!result.ok) return SHOP_ERRORS[result.error](); if (!saveShop(result.data)) return pick('保存失败', 'Could not save'); render(); return ''; },
      onRefund: purchaseId => { const result = refund(shopData(), purchaseId, { shieldsUsed: used() }); if (result.ok) { saveShop(result.data); render(); } },
      onEquip: itemId => { saveShop(equip(shopData(), itemId)); render(); },
      onUnequip: itemId => { saveShop(unequip(shopData(), itemId)); render(); } });
  }
  // 我的 → avatar: the personal page (avatar, level, badge wall, features coming later).
  function meProfileView() {
    const progress = petProgress(), name = account?.local ? pick('本地模式', 'Local mode') : account?.username || (account?.is_admin ? pick('管理员', 'Administrator') : pick('已登录', 'Signed in'));
    return profileView({ name, level: progress.level, levelCard: levelCard(progress.level, '/illustrations/mascot-cheer.webp'), badgeWall: badgeWall(progress.badges), frame: frameImage(shopData().frame) });
  }
  const openBadgeWall = () => { petPage = 'room'; mePage = 'profile'; chat.go('me'); requestAnimationFrame(() => document.querySelector('#badge-wall')?.scrollIntoView({ block: 'start' })); };
  const petProgress = () => achievements({ events: chat.reviewEvents(), goal: goalOf(profile), cards: chat.knowledgeCards(), questions: chat.questionDates(), books: Object.keys(profile?.modules || {}).filter(isCustomModule).length });
  function petStoreView() {
    const progress = petProgress();
    return storeView({ level: progress.level, badges: progress.badges, cones: progress.level.cones, mascot: 'cheer' });
  }
  // Badge tiers already celebrated on this device; the first visit marks what is there without a celebration.
  const BADGES_SEEN_KEY = 'knowledge-review.badges-seen.v1';
  async function celebrateNewBadges() {
    const { badges } = petProgress();
    let seen = null;
    try { seen = JSON.parse(localStorage.getItem(BADGES_SEEN_KEY) || 'null'); } catch { /* Treated as a first visit. */ }
    const keys = badges.flatMap(badge => badge.earned.map(item => `${badge.id}:${item.tier}`));
    const save = list => { try { localStorage.setItem(BADGES_SEEN_KEY, JSON.stringify(list)); } catch { /* This visit only. */ } };
    if (!Array.isArray(seen)) { save(keys); return; }
    const fresh = newBadges(badges, new Set(seen));
    save(keys);
    for (const item of fresh.slice(0, 3)) {
      if (chat.page !== 'pet' || petPage !== 'room') break;
      if (await celebrateBadge(badges.find(badge => badge.id === item.id), item.tier) === 'go') { openBadgeWall(); break; }
    }
  }
  // The squirrel's home (phone, middle tab): its tree-hollow room fills the top of the screen with the squirrel in the
  // middle, two chips (fed today, pine cones), a frosted "little world" panel and a short daily note written from the
  // day's reviews. Feeding = reviewing toward the daily goal; the store = pine cones earned by learning (pet.js).
  function petView() {
    const events = chat.reviewEvents(), today = localDay(new Date()), goal = goalOf(profile);
    const done = new Set(events.filter(event => localDay(event.at) === today).map(event => event.cardId)).size;
    const cones = pineCones(events, goal), mood = petMood(done, goal), streak = shieldStreaks().any, left = Math.max(0, goal - done), shop = shopNow();
    const [statusTitle, statusSub] = {
      sleep: [pick('小回在睡觉', 'Backy is asleep'), pick('明天见～', 'See you tomorrow~')],
      full: [pick('小回吃饱啦', 'Backy is full'), pick('心满意足', 'Happy and content')],
      eating: [pick('小回正在吃', 'Backy is eating'), pick('慢慢吃着呢', 'Taking its time')],
      hungry: [pick('小回有点饿', 'Backy is a bit hungry'), pick('等你来喂', 'Waiting for you')],
    }[mood];
    const hour = new Date().getHours();
    const greeting = hour >= 5 && hour < 11 ? pick('早上好呀～', 'Good morning~') : hour >= 11 && hour < 14 ? pick('中午好呀～', 'Good afternoon~') : hour >= 14 && hour < 18 ? pick('下午好呀～', 'Good afternoon~') : pick('晚上好呀～', 'Good evening~');
    const note = mood === 'sleep' ? pick('晚安，明天一起复习吧。', 'Good night. Let’s review together tomorrow.')
      : cones.learnedToday ? pick('今天你学会了 {n} 个知识点，我把 {n} 颗松果收进仓库啦。', 'You learned {n} ideas today, so I tucked {n} pine cones into my store.', { n: cones.learnedToday })
      : mood === 'full' ? pick('吃得好饱！仓库里已经有 {n} 颗松果了。', 'So full! My store now holds {n} pine cones.', { n: cones.total })
      : mood === 'eating' ? pick('再复习 {n} 张就吃饱啦。', '{n} more cards and I’m full.', { n: left })
      : pick('今天还没吃东西呢，复习几张卡片就能喂饱我。', 'I haven’t eaten today. Review a few cards to feed me.');
    const pose = MOOD_POSE[mood], fed = Math.min(100, Math.round(done / Math.max(1, goal) * 100)), progress = petProgress();
    return `<section class="pet-scene-wrap"><img class="home-scene pet-scene" src="/illustrations/pet-nest.webp" alt="" decoding="async">${decorLayer(shopData().equipped)}
        <div class="pet-hello"><h1>${pick('嗨，我是小回', 'Hi, I’m Backy')}</h1><p>${greeting}</p></div>
        <div class="pet-row"><div class="pet-status"><span class="pet-status-avatar"><img src="/illustrations/mascot-${pose}.webp" alt="" decoding="async"></span><span class="pet-status-text"><strong>${statusTitle}</strong><span>${statusSub}</span></span></div><span class="pet-chip">🍽 ${done}/${goal}</span></div>
        <button type="button" class="today-mascot pet-mascot ${dressedClass()}" data-pose="${pose}" aria-haspopup="dialog" aria-label="${pick('松鼠的动作', 'Squirrel actions')}">${mascotPicture(pose)}</button>
        <div class="pet-floor"><button type="button" class="pet-jar" data-pet-jar="${cones.total}" aria-label="${pick('松果罐，{n} 颗', 'Pine-cone jar, {n}', { n: cones.total })}"><img class="pet-jar-glass" src="/illustrations/pine-jar.webp" alt="" decoding="async"><span class="pet-jar-pile" aria-hidden="true"></span><span class="pet-jar-tag" aria-hidden="true"></span></button></div></section>
      <section class="m-section frost-panel pet-world"><div class="section-heading"><h2>${pick('小回的小世界', 'Backy’s little world')}</h2></div><div class="pet-tiles">
        <button type="button" class="pet-tile" data-pet-store><span class="pet-tile-icon">${PINE_ICON}</span><strong>${pick('仓库', 'Store')}</strong><span class="pet-tile-value">Lv.${progress.level.level}</span><span class="muted">${pick('松果 {n}', '{n} pine cones', { n: progress.level.cones })}</span></button>
        <button type="button" class="pet-tile" data-pet-feed><span class="pet-tile-icon">🍽</span><strong>${pick('喂食', 'Feed')}</strong><span class="pet-tile-value">${done}/${goal}</span><span class="pet-meter" role="presentation"><i data-fed="${fed}"></i></span></button>
        <div class="pet-tile"><span class="pet-tile-icon">🔥</span><strong>${pick('连续', 'Streak')}</strong><span class="pet-tile-value">${streak}</span><span class="muted">${pick('{n} 天', '{n} days', { n: streak })}</span></div>
        <button type="button" class="pet-tile" data-pet-shop><span class="pet-tile-icon">🛒</span><strong>${pick('商城', 'Shop')}</strong><span class="pet-tile-value">${shop.balance}</span><span class="muted">${pick('可用松果', 'to spend')}</span></button>
      </div></section>
      <section class="m-section pet-letter"><span class="pet-letter-avatar"><img src="/illustrations/mascot-cheer.webp" alt="" decoding="async"></span><div><h2>${pick('小回的信', 'A note from Backy')}</h2><p>${note}</p></div><span class="pet-letter-mark" aria-hidden="true">💌</span></section>`;
  }
  function homePhoneView() {
    const zh = locale === 'zh', due = chat.reviewCount(), events = chat.reviewEvents(), today = localDay(new Date());
    const done = new Set(events.filter(event => localDay(event.at) === today).map(event => event.cardId)).size, total = done + due, shields = shieldStreaks(), streak = shields.any;
    const goal = goalOf(profile), reached = done >= goal, met = shields.goal;
    const length = 2 * Math.PI * 42, progress = Math.min(1, done / goal);
    const ring = `<svg class="task-ring-svg" viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="42" fill="none" stroke="currentColor" stroke-opacity=".25" stroke-width="8"/><circle cx="50" cy="50" r="42" fill="none" stroke="currentColor" stroke-width="8" stroke-linecap="round" stroke-dasharray="${(length * progress).toFixed(1)} ${length.toFixed(1)}" transform="rotate(-90 50 50)"/></svg>`;
    const date = new Intl.DateTimeFormat(intlLocale(currentLocale()), { month: 'long', day: 'numeric', weekday: 'long' }).format(new Date());
    // Today's review is the page itself: a first-person desk scene fills the top of the screen behind the greeting,
    // the due count sits large on the wall with no card around it, the main action below it, and the desk stays in
    // view until the frosted module panel rises over the faded bottom of the scene.
    const status = due ? '' : total ? (pick('今天的复习完成了', 'Review done for today')) : (pick('还没有要复习的知识', 'Nothing to review yet'));
    const goalText = reached ? pick('今日目标完成 ✓', 'Goal reached ✓') : pick('今日目标 {v0} / {goal} 张', 'Today’s goal {v0} / {goal}', { v0: Math.min(done, goal), goal });
    const dark = document.documentElement.dataset.theme === 'dark', picture = sceneImage(savedScene(), dark);
    return `<section class="home-scene-wrap"><img class="home-scene ${picture.own ? 'is-night' : ''}" src="${picture.src}" alt="" decoding="async">
        <div class="m-hello"><span class="eyebrow">${date}</span><h1>${t('hello')}</h1><button type="button" class="scene-button" data-scene-picker aria-haspopup="dialog" aria-label="${pick('换背景', 'Change background')}"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3.5" y="4.5" width="17" height="15" rx="3"/><circle cx="9" cy="10" r="1.8"/><path d="m4 17 4.5-4.5 3.5 3.5 2.5-2.5 5.5 5"/></svg></button></div>
        <div class="today-status"><button type="button" class="today-mascot ${dressedClass()}" data-pose="${due ? 'wave' : total ? 'cheer' : 'think'}" aria-haspopup="dialog" aria-label="${pick('松鼠的动作', 'Squirrel actions')}">${mascotPicture(due ? 'wave' : total ? 'cheer' : 'think')}</button>${due ? `<p class="today-big"><strong>${due}</strong><span>${t('zero')}</span></p>` : `<p class="today-big today-done">${status}</p>`}
          <div class="today-meta"><span class="today-goal"><span class="task-ring" aria-hidden="true">${ring}</span>${goalText}</span><span><b>${streak}</b>${pick(' 天连续', ' day streak')}</span><span><b>${met}</b>${pick(' 天达成', ' days met')}</span></div></div>
        ${total ? `<button class="task-start" data-review>${due ? (pick('开始复习', 'Start review')) : (pick('再练一会', 'Practise more'))} →</button><button class="task-start task-ask" data-open-module="${ASK_MODULE}">${pick('继续提问', 'Keep asking')} →</button>` : `<button class="task-start" data-open-module="${ASK_MODULE}">${pick('去提问', 'Ask a question')} →</button>`}${reached ? shareButton('task-share') : ''}</section>
      ${chat.starterHome() ? `<div class="m-section frost-panel home-starter">${chat.starterHome()}</div>` : ''}
      <section class="m-section"><div class="section-heading"><h2>${pick('今日清单', 'Today’s list')}</h2></div>${reviewPreview()}</section>`;
  }

  function hideSplash() {
    const splash = document.getElementById('splash');
    if (!splash || splash.classList.contains('is-done')) return;
    // Ready before it faded in (fast start): drop it without ever showing it.
    if (parseFloat(getComputedStyle(splash).opacity) < 0.05) { splash.remove(); return; }
    splash.classList.add('is-done');
    setTimeout(() => splash.remove(), 320);
  }
  function renderPage() {
    setLocale(locale);
    // A saved language other than Chinese/English needs its catalog: load it, then render again in that language.
    if (needsCatalog(locale)) loadCatalog(locale).then(render);
    document.title = t('brand');
    // The phone loading screen (squirrel animation in mobile/index.html) stays up until the sign-in check is done.
    if (choosingLanguage || chat || !gate.loading) hideSplash();
    // The first-run guide is full-screen: no tab bar and no page navigation until it is finished or skipped.
    if (choosingLanguage) { renderLanguageChoice(); return; }
    const inApp = Boolean(chat), locked = inApp ? chat.locked : gate.busy, guide = inApp && chat.page === 'onboarding', tabs = phone && inApp && profile && !editing && !guide;
    app.innerHTML = `
      <header class="header"><a class="brand" href="${phone ? '/m/' : '/'}" aria-label="${t('brand')}"><span class="brand-mark" aria-hidden="true">↗</span>${t('brand')}</a>
        ${tabs ? '' : `<div class="header-actions">${inApp && profile && !editing && !guide ? chat.nav() : ''}${themeButton()}<button class="text-button" id="language" aria-haspopup="dialog" aria-label="${pick('界面语言', 'Interface language')}" ${locked ? 'disabled' : ''}><span aria-hidden="true">🌐</span> ${localeName(locale)}</button></div>`}</header>
      <main>${!inApp ? gate.view() : editing ? setupView() : tabs && chat.isHome ? homePhoneView() : tabs && chat.page === 'me' ? (mePage === 'profile' ? meProfileView() : meView()) : tabs && chat.page === 'pet' ? (petPage === 'store' ? petStoreView() : petPage === 'shop' ? petShopView() : petView()) : tabs && ['library', 'discover', 'recommend', 'square'].includes(chat.page) ? librarySwitch() + chat.view() : chat.isHome ? homeView() : chat.view()}</main>
      ${tabs ? tabBar(locked) : `<footer>${t('preview')}</footer>`}`;
    const on = (selector, handler) => { const element = document.querySelector(selector); if (element) element.onclick = handler; };
    document.querySelectorAll('[data-tab]').forEach(button => { button.onclick = () => { petPage = 'room'; mePage = 'main'; chat.go(button.dataset.tab); }; });
    document.querySelectorAll('[data-me-library]').forEach(button => { button.onclick = () => { chat.go('library'); window.scrollTo(0, 0); }; });
    document.querySelectorAll('.me-day i[data-bar]').forEach(bar => { bar.style.height = `${Math.max(4, Math.round(Number(bar.dataset.bar) * 0.48))}px`; /* 48px tallest */ });
    document.querySelectorAll('[data-me-profile]').forEach(button => { button.onclick = () => { mePage = 'profile'; render(); window.scrollTo(0, 0); }; });
    document.querySelectorAll('[data-profile-back]').forEach(button => { button.onclick = () => { mePage = 'main'; render(); window.scrollTo(0, 0); }; });
    document.querySelectorAll('[data-avatar-change]').forEach(button => { button.onclick = () => openAvatarSheet(() => render()); });
    document.querySelectorAll('[data-go-badges]').forEach(button => { button.onclick = openBadgeWall; });
    document.querySelectorAll('[data-pet-shop]').forEach(button => { button.onclick = () => { petPage = 'shop'; render(); window.scrollTo(0, 0); }; });
    document.querySelectorAll('[data-shop-back]').forEach(button => { button.onclick = () => { petPage = 'room'; render(); window.scrollTo(0, 0); }; });
    document.querySelectorAll('[data-shop-tab]').forEach(button => { button.onclick = () => { shopTab = button.dataset.shopTab; dressLook = {}; dressNote = ''; render(); }; });
    document.querySelectorAll('[data-dress-part]').forEach(button => { button.onclick = () => { dressPart = button.dataset.dressPart; dressNote = ''; render(); }; });
    document.querySelectorAll('[data-dress-item]').forEach(button => { button.onclick = () => {
      const item = itemById(button.dataset.dressItem);
      if (item?.level > petProgress().level.level) { dressNote = pick('升到 Lv.{n} 才能穿', 'Opens at Lv.{n}', { n: item.level }); render(); return; }
      tryOn(dressPart, item?.id || null); dressNote = ''; render();
    }; });
    document.querySelectorAll('[data-dress-set]').forEach(button => { button.onclick = () => {
      const level = petProgress().level.level, set = SETS.find(entry => entry.id === button.dataset.dressSet);
      dressLook = {}; for (const id of set.items) { const item = itemById(id); if (!(item.level > level) && id !== shopData().outfit[item.part]) dressLook[item.part] = id; }
      dressNote = set.items.some(id => itemById(id).level > level) ? pick('有一件要升级后才能穿', 'One piece opens at a higher level') : ''; render();
    }; });
    document.querySelector('[data-dress-random]')?.addEventListener('click', () => { randomLook(); dressNote = ''; render(); document.querySelector('.dress-mascot')?.classList.add('is-hop'); });
    document.querySelector('[data-dress-reset]')?.addEventListener('click', () => { dressLook = {}; dressNote = ''; render(); });
    document.querySelector('[data-dress-wear]')?.addEventListener('click', wearLook);
    const dressMsg = document.querySelector('.dress-msg'); if (dressMsg) { dressMsg.textContent = dressNote; dressMsg.classList.toggle('is-good', dressGood); dressNote = ''; dressGood = false; }
    document.querySelectorAll('[data-shop-item]').forEach(button => { button.onclick = () => openShopItem(button.dataset.shopItem); });
    document.querySelectorAll('[data-soon]').forEach(button => { button.onclick = () => { button.classList.remove('is-poke'); void button.offsetWidth; button.classList.add('is-poke'); }; });
    document.querySelectorAll('[data-scene-picker]').forEach(button => { button.onclick = () => openScenePicker(button); });
    document.querySelectorAll('[data-pet-store]').forEach(button => { button.onclick = () => { petPage = 'store'; render(); window.scrollTo(0, 0); }; });
    document.querySelectorAll('[data-store-back]').forEach(button => { button.onclick = () => { petPage = 'room'; render(); window.scrollTo(0, 0); }; });
    document.querySelectorAll('.level-bar i[data-level]').forEach(bar => { bar.style.width = `${bar.dataset.level}%`; });
    document.querySelectorAll('[data-badge]').forEach(button => { button.onclick = () => { const badge = petProgress().badges.find(item => item.id === button.dataset.badge); if (badge) showBadge(badge).then(() => button.focus({ preventScroll: true })); }; });
    document.querySelectorAll('[data-lib-page]').forEach(button => { button.onclick = () => chat.go(button.dataset.libPage); });
    document.querySelectorAll('[data-pet-feed]').forEach(button => { button.onclick = () => chat.go('review'); });
    // The feed meter's width goes through the CSSOM (the page's CSP blocks style attributes).
    document.querySelectorAll('.pet-meter i[data-fed]').forEach(bar => { bar.style.width = `${bar.dataset.fed}%`; });
    placeTabPill();
    bindMascot();
    if (tabs) flyNewCones();
    document.querySelectorAll('[data-share-card]').forEach(button => { button.onclick = () => openShareDialog({ locale, data: shareData() }); });
    // Day / night switch (theme.js applies it before paint and remembers it per device).
    on('#theme-toggle', () => { window.knowledgeReviewTheme?.toggle(); render(); });
    on('#language', () => openLanguageDialog(next => {
      if (inApp && profile && !editing) {
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...profile, locale: next })); }
        catch { errorKey = 'storageError'; editing = true; openDraft(profile); render(); return; }
        profile.locale = next;
      }
      locale = next; draft.locale = locale; saveLocale(next); loadCatalog(next).then(render);
    }));
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

  // First open: a full page asking for the interface language. Tapping a language previews the page in it; Continue
  // remembers it on this device and moves on to sign-in. It can be changed later from the language button.
  function renderLanguageChoice() {
    app.innerHTML = `<header class="header"><span class="brand"><span class="brand-mark" aria-hidden="true">↗</span>${t('brand')}</span></header>
      <main><section class="panel language-first" aria-labelledby="language-first-title">
        <h1 id="language-first-title">${pick('选择你的语言', 'Choose your language')}</h1>
        <p class="muted">${pick('之后可以随时在设置里更改。', 'You can change it any time in settings.')}</p>
        <div class="language-list">${ENABLED.map(code => `<button type="button" class="language-option ${code === locale ? 'active' : ''}" data-first-locale="${code}" lang="${code}" aria-pressed="${code === locale}">${localeName(code)}</button>`).join('')}</div>
        <button type="button" class="primary-button" id="language-continue">${pick('继续', 'Continue')} →</button>
      </section></main>`;
    document.querySelectorAll('[data-first-locale]').forEach(button => { button.onclick = () => {
      const next = button.dataset.firstLocale; if (!isLocale(next)) return;
      locale = next; draft.locale = next; loadCatalog(next).then(render);
    }; });
    document.querySelector('#language-continue').onclick = () => { saveLocale(locale); choosingLanguage = false; render(); window.scrollTo(0, 0); };
  }

  // Learning modules. After registration this step is optional; skipping saves the defaults.
  // Modules can be picked for bulk actions (select all, enable, disable, delete). Deleting archives a module with
  // its records kept (built-in modules always), or removes a custom module that has no records.
  // Every change stays in the draft until saved.
  const draftName = id => isCustomModule(id) ? draft.modules[id].name : moduleLabel(draft, id, locale);
  function moduleCard(id, index) {
    const item = draft.modules[id], custom = isCustomModule(id);
    return `<div class="module-option ${item.enabled ? 'selected' : ''} ${picked.has(id) ? 'picked' : ''}">
      <div class="module-label"><input type="checkbox" class="module-pick" data-pick="${id}" ${picked.has(id) ? 'checked' : ''} aria-label="${t('select')} ${esc(draftName(id))}"><span class="module-number">${String(index + 1).padStart(2, '0')}</span><span class="module-badge small" data-module-badge="${id}">${moduleIcon(draft, id, 16)}</span><strong data-module-title="${id}">${esc(draftName(id))}</strong><label class="enable-toggle"><input type="checkbox" data-module="${id}" ${item.enabled ? 'checked' : ''}>${t('enable')}</label></div>
      ${custom ? `<label class="level-label" for="name-${id}">${t('moduleName')} · ${t('customHint')}</label><input id="name-${id}" class="module-name-input" type="text" maxlength="20" data-module-name="${id}" value="${esc(item.name)}">
        <span class="level-label">${pick('图标', 'Icon')}</span><div class="icon-picker" role="group" aria-label="${pick('选择图标', 'Choose an icon')}">${CUSTOM_ICONS.map(name => `<button type="button" class="icon-choice ${(item.icon || 'bookmark') === name ? 'active' : ''}" data-module-icon="${id}" data-icon="${name}" aria-pressed="${(item.icon || 'bookmark') === name}">${iconSvg(name, 18)}</button>`).join('')}</div>` :`<p class="module-description">${t(`${id}Hint`)}</p>`}
      <label class="level-label" for="level-${id}">${t('level')}</label>
      <select id="level-${id}" data-level="${id}" ${item.enabled ? '' : 'disabled'}>${levels.map(level => `<option value="${level}" ${item.level === level ? 'selected' : ''}>${t(level)}</option>`).join('')}</select>
      <button type="button" class="text-button module-delete" data-delete-module="${id}">${t('deleteModule')}</button>
    </div>`;
  }
  function setupView() {
    // Built-in subjects are switched on or off as chips (their level adapts from reviews); books the user made keep
    // their cards with name, icon, level and delete. A built-in subject that was removed shows as an off chip.
    const visible = visibleModules().filter(isCustomModule), archived = Object.keys(draft.modules).filter(id => isCustomModule(id) && draft.modules[id].archived);
    const presetOn = id => draft.modules[id].enabled && !draft.modules[id].archived;
    const customCount = visible.filter(isCustomModule).length;
    return `<section class="intro"><span class="eyebrow">${t('brand')}</span><h1>${t(profile ? 'settings' : 'setup')}</h1><p>${t(profile ? 'setupHint' : 'skipHint')}</p></section>
      <form id="setup" novalidate>
        <section class="panel"><h2>${t('areas')}</h2><p>${t('areasHint')}</p>
          <div class="keyword-row preset-chips" role="group" aria-label="${t('areas')}">${moduleIds.map(id => `<button type="button" class="keyword-chip preset-chip ${presetOn(id) ? 'active' : ''}" data-preset="${id}" aria-pressed="${presetOn(id)}" ${id === ASK_MODULE ? 'disabled' : ''}>${moduleIcon(draft, id, 16)}${esc(draftName(id))}</button>`).join('')}</div>
          ${visible.length ? `<div class="module-toolbar"><button type="button" class="secondary-button" id="pick-all">${t('selectAll')}</button><button type="button" class="secondary-button" id="pick-none" ${picked.size ? '' : 'disabled'}>${t('clearSelection')}</button><span class="muted" id="pick-count">${t('selectedCount').replace('{n}', picked.size)}</span><span class="toolbar-gap"></span><button type="button" class="secondary-button" id="enable-picked" ${picked.size ? '' : 'disabled'}>${t('enableSelected')}</button><button type="button" class="secondary-button" id="disable-picked" ${picked.size ? '' : 'disabled'}>${t('disableSelected')}</button><button type="button" class="secondary-button danger-button" id="delete-picked" ${picked.size ? '' : 'disabled'}>${t('deleteSelected')}</button></div>` : ''}
          ${visible.length ? `<div class="module-grid">${visible.map(moduleCard).join('')}</div>` : ''}
          ${visible.length ? `<p class="field-hint">${t('deleteHint')}</p>` : ''}
          <div class="add-module"><label class="field-label" for="new-module-name">${t('addModule')}</label><div class="add-module-row"><input id="new-module-name" type="text" maxlength="20" placeholder="${t('newModulePlaceholder')}" value="${esc(newModuleName)}" ${customCount >= MAX_CUSTOM_MODULES ? 'disabled' : ''}><button type="button" class="secondary-button" id="add-module" ${customCount >= MAX_CUSTOM_MODULES ? 'disabled' : ''}>＋ ${t('addModule')}</button></div><p class="field-hint">${t('addHint')}</p></div>
          ${archived.length ? `<div class="archived-modules"><h3>${t('archived')}</h3>${archived.map(id => `<div class="archived-row"><span>${esc(draftName(id))}</span><button type="button" class="text-button" data-restore-module="${id}">${t('restore')}</button></div>`).join('')}</div>` : ''}
        </section>
        <section class="panel goal-settings"><h2>${pick('每日目标', 'Daily goal')}</h2><p>${pick('每天想复习多少张卡片？只用于激励和打卡，不改变复习安排；超过目标也可以继续练。', 'How many cards do you want to review each day? It is for motivation and check-ins only; review scheduling does not change, and you can keep going past it.')}</p>
          <div class="segmented goal-options" role="group" aria-label="${pick('每日目标', 'Daily goal')}">${DAILY_GOALS.map(goal => `<button type="button" class="${goalOf(draft) === goal ? 'active' : ''}" data-goal="${goal}" aria-pressed="${goalOf(draft) === goal}">${pick('{goal} 张', '{goal} cards', { goal })}</button>`).join('')}</div></section>
        ${profile ? `<p class="field-hint">${t('pendingChanges')}</p>` : ''}
        <p id="form-error" class="error" role="alert" tabindex="-1">${errorKey ? t(errorKey) : ''}</p>
        <div class="actions">${profile ? `<button type="button" class="secondary-button" id="cancel">${t('cancel')}</button>` : `<button type="button" class="secondary-button" id="skip-setup">${t('skip')}</button>`}<button class="primary-button" type="submit">${t(profile ? 'save' : 'start')} <span aria-hidden="true">→</span></button></div>
      </form>`;
  }

  // Today's queue as a short read-only list; review itself still starts from the button.
  function reviewPreview() {
    const zh = locale === 'zh', items = chat.reviewPreview(), shown = items.slice(0, 5);
    const button = `<button class="primary-button" data-review>${pick('进入复习', 'Open review')} →</button>`;
    const hasCards = activeModuleIds(profile).some(id => chat.knowledgeCount(id));
    if (!items.length) return `<div class="empty-state"><img class="empty-art mascot-art" src="/illustrations/mascot-${hasCards ? 'sleep' : 'think'}.webp" alt="" decoding="async"><h3>${hasCards ? (pick('今天没有到期的复习', 'Nothing due today')) : t('emptyTitle')}</h3><p>${hasCards ? (pick('新卡片从第二天开始复习；想现在练习，可以进入复习后选择“自主加练”。', 'New cards are reviewed from tomorrow. To practise now, open Review and choose Extra practice.')) : t('emptyHint')}</p>${button}</div>`;
    const styles = moduleStyles([...new Set([...activeModuleIds(profile), ...items.map(item => item.card.module)])]);
    const kinds = { new: pick('新学', 'New'), due: pick('到期', 'Due'), weak: pick('薄弱', 'Weak') };
    const ago = at => {
      if (!at) return ''; // the "New" tag already says it has never been reviewed
      const [y, m, d] = localDay(at).split('-').map(Number), now = new Date();
      const days = Math.round((new Date(now.getFullYear(), now.getMonth(), now.getDate()) - new Date(y, m - 1, d)) / 86400000);
      const when = days <= 0 ? (pick('今天', 'today')) : days === 1 ? (pick('昨天', 'yesterday')) : pick('{days} 天前', '{days} days ago', { days });
      return pick('上次复习：{when}', 'Last reviewed {when}', { when });
    };
    const rows = shown.map(({ card, last, kind }) => `<li class="preview-item"><div class="preview-main"><span class="preview-title">${esc(card.title)}</span><span class="preview-kind kind-${kind}">${kinds[kind]}</span></div>
      <div class="preview-meta"><span class="preview-module">${moduleIcon(profile, card.module, 14, styles.get(card.module)?.color)}${esc(moduleLabel(profile, card.module, locale))}</span>${last ? `<span>${ago(last)}</span>` : ''}</div></li>`).join('');
    const more = items.length > shown.length ? `<p class="preview-more">${pick('还有 {v0} 条', '{v0} more', { v0: items.length - shown.length })}</p>` : '';
    return `<ol class="review-preview">${rows}</ol>${more}<div class="preview-actions">${button}</div>`;
  }

  function homeView() {
    const date = new Intl.DateTimeFormat(intlLocale(currentLocale()), { dateStyle: 'full' }).format(new Date());
    return `<section class="intro home-intro art-intro"><div><span class="eyebrow">${date}</span><h1>${t('hello')}</h1><button class="secondary-button" id="settings">${t('settings')}</button></div><img class="intro-art home-art" src="/illustrations/home-hero.webp" alt="" decoding="async"></section>
      ${new Date().getDay() === 0 ? `<div class="sunday-note">${t('sunday')}</div>` : ''}${chat.starterHome()}
      <div class="dashboard"><section class="panel review-panel"><div class="section-heading"><h2>${t('today')}</h2><span class="pill">${chat.reviewCount()} ${t('zero')}</span></div>
        ${goalBar()}${reviewPreview()}</section>
        <aside class="panel plan-panel"><span class="eyebrow">${t('reviewPlan')}</span><p>${t('batchHint')}</p><hr><h3>${t('weekly')}</h3><p>${t('weekHint')}</p><h3>${t('notifications')}</h3><p>${t('notificationHint')}</p></aside></div>
      <section class="modules-section"><div class="section-heading"><h2>${t('modulesTitle')}</h2></div><div class="module-grid">${activeModuleIds(profile).filter(id => isCustomModule(id) || chat.knowledgeCount(id) || chat.messageCount(id)).map(id => `<article class="panel home-module"><span class="module-badge">${moduleIcon(profile, id, 22)}</span><span class="eyebrow">${t(profile.modules[id].level)}${isCustomModule(id) ? ` · ${t('customHint')}` : ''}</span><h3>${esc(moduleLabel(profile, id, locale))}</h3>${chat.messageCount(id) ? `<div class="module-count">${chat.messageCount(id)} <span>${chat.homeText('records')}</span></div>` : ''}<button class="secondary-button module-open" data-open-module="${id}">${chat.homeText('open')} →</button></article>`).join('')}</div></section>`;
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
    document.querySelectorAll('[data-preset]').forEach(button => { button.onclick = () => {
      const id = button.dataset.preset, on = !(draft.modules[id].enabled && !draft.modules[id].archived);
      if (!on && !keepsOneActive([id])) { showError('keepOne'); return; }
      Object.assign(draft.modules[id], { enabled: on, archived: false }); errorKey = ''; render();
    }; });
    const pickAll = document.querySelector('#pick-all');
    if (pickAll) pickAll.onclick = () => { visibleModules().filter(isCustomModule).forEach(id => picked.add(id)); errorKey = ''; render(); };
    if (document.querySelector('#pick-none')) document.querySelector('#pick-none').onclick = () => { picked.clear(); errorKey = ''; render(); };
    if (document.querySelector('#enable-picked')) document.querySelector('#enable-picked').onclick = () => { if (!picked.size) { showError('selectNone'); return; } for (const id of picked) draft.modules[id].enabled = true; errorKey = ''; render(); };
    if (document.querySelector('#disable-picked')) document.querySelector('#disable-picked').onclick = () => {
      if (!picked.size) { showError('selectNone'); return; }
      if (!keepsOneActive([...picked])) { showError('keepOne'); return; }
      for (const id of picked) draft.modules[id].enabled = false; errorKey = ''; render();
    };
    if (document.querySelector('#delete-picked')) document.querySelector('#delete-picked').onclick = () => { if (!picked.size) { showError('selectNone'); return; } deleteModules([...picked]); };
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
  // The page-background feature was removed (2026-11-14): drop its saved choice and any uploaded image on this device.
  try { localStorage.removeItem('knowledge-review.background.v1'); indexedDB.deleteDatabase('knowledge-review.files'); } catch { /* Storage blocked: nothing saved anyway. */ }
  if('serviceWorker'in navigator)navigator.serviceWorker.register('/sw.js').catch(()=>{});
}

if (typeof document !== 'undefined') boot();

// Interface language picker: each language is shown in its own name; only languages with a complete catalog are offered.
function openLanguageDialog(choose) {
  const current = currentLocale(), dialog = document.createElement('dialog');
  dialog.className = 'language-dialog';
  dialog.innerHTML = `<h2>${pick('界面语言', 'Interface language')}</h2><div class="language-list">${ENABLED.map(code => `<button type="button" class="language-option ${code === current ? 'active' : ''}" data-locale="${code}" lang="${code}" aria-pressed="${code === current}">${localeName(code)}</button>`).join('')}</div><div class="actions"><button type="button" class="secondary-button" data-close>${pick('关闭', 'Close')}</button></div>`;
  document.body.append(dialog);
  dialog.addEventListener('close', () => dialog.remove());
  dialog.querySelector('[data-close]').onclick = () => dialog.close();
  dialog.querySelectorAll('[data-locale]').forEach(button => { button.onclick = () => { dialog.close(); if (button.dataset.locale !== current) choose(button.dataset.locale); }; });
  dialog.showModal();
}