// 知回 product page (/welcome): text in every interface language, a scripted demo (no model call), the FSRS forgetting
// curve, scroll reveals, a cursor glow and card tilt, and "install to computer" through the browser's own app install.
// Text is written as ['中文', 'English'] pairs; other languages come from the app's catalogs (i18n/<code>.js).
// Decorative motion is skipped when the visitor asks for reduced motion.
import { translate, setLocale, loadCatalog, savedLocale, isLocale, ENABLED, localeName, intlLocale, isChineseLocale } from '/i18n.js';

const LANG_KEY = 'knowledge-review.welcome-lang.v1', PROFILE_KEY = 'knowledge-review.profile.v1';
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
// The page's own saved choice, else the language chosen in the app, else English.
let lang = (() => {
  try {
    const saved = localStorage.getItem(LANG_KEY); if (ENABLED.includes(saved)) return saved;
    const app = savedLocale() || JSON.parse(localStorage.getItem(PROFILE_KEY) || 'null')?.locale; if (ENABLED.includes(app)) return app;
  } catch { /* English. */ }
  return 'en';
})();
const tr = (zh, en, vars) => translate(zh, en, vars, lang);
const pair = ([zh, en], vars) => tr(zh, en, vars);

const TEXT = {
  brand: ['知回', 'KnowBack'], navHow: ['怎么用', 'How it works'], navFeatures: ['功能', 'Features'], navDownload: ['下载', 'Download'], navFaq: ['常见问题', 'FAQ'], openApp: ['在线使用', 'Open the app'],
  badge: ['免费额度 · 无需自备 Key · 本地优先', 'Free allowance · No key needed · Local first'], title1: ['问一个问题，', 'Ask a question,'], title2: ['就记住它。', 'and remember it.'],
  lead: ['知回把你问 AI 的每一个问题，自动整理成知识卡片；再按遗忘曲线，在你快要忘记之前提醒你复习。学过的东西，真正留下来。', 'KnowBack turns every question you ask AI into a knowledge card, then reminds you to review it just before you would forget. What you learn finally stays.'],
  chip1: ['提问即笔记', 'Questions become notes'], chip2: ['FSRS 遗忘曲线复习', 'FSRS forgetting-curve review'], chip3: ['知识图谱与思维导图', 'Knowledge graph & mind maps'],
  ctaStart: ['立即开始', 'Start now'], ctaDesktop: ['安装到电脑', 'Install on computer'], ctaAndroid: ['下载安卓 App', 'Download Android app'],
  fine: ['网页版、电脑和安卓都能用，数据默认只存在你的设备上。', 'Works on the web, on computers and on Android. Your data stays on your device by default.'],
  demoTitle: ['知回 · 演示', 'KnowBack · Demo'], demoTag: ['演示，不调用模型', 'Demo, no model call'], demoHint: ['选一个问题试试：', 'Pick a question to try:'],
  howEyebrow: ['三步', 'Three steps'], howTitle: ['从一个问题，到一张记得住的卡片', 'From one question to a card you remember'],
  step1: ['提问', 'Ask'], step1d: ['打字、说话或拍照提问。按编程、英语、工作、生活分模块记录。', 'Type, speak or photograph a question. Coding, English, work and life each keep their own records.'],
  step2: ['自动成卡', 'It becomes a card'], step2d: ['回答后自动提炼成一张知识卡片：标题、要点和例子，不用自己做笔记。', 'Each answer is condensed into a knowledge card with a title, key points and an example. No note-taking needed.'],
  step3: ['按时复习', 'Review on time'], step3d: ['FSRS 算法算出每张卡片快要忘记的时候，提醒你复习，越记越牢。', 'FSRS works out when each card is about to fade and reminds you then, so it sticks a little longer each time.'],
  curveTitle: ['遗忘曲线：复习让记忆留得更久', 'Forgetting curve: reviews make memories last'], curveNote: ['按 FSRS-5 默认参数计算。把鼠标移到图上看看第几天还记得多少。', 'Computed with FSRS-5 default parameters. Move over the chart to see how much is left on each day.'],
  legendNo: ['不复习', 'No review'], legendYes: ['按知回复习', 'Reviewing with KnowBack'],
  featEyebrow: ['核心功能', 'Core features'], featTitle: ['学过的，都帮你留着', 'Everything you learn, kept for you'],
  num1: ['个学习模块', 'learning modules'], num2: ['条人工核对的推荐资源', 'hand-checked recommended resources'], num3: ['复习算法', 'review algorithm'], num4: ['次每日免费提问（登录后）', 'free questions a day (signed in)'],
  dlEyebrow: ['下载与安装', 'Download & install'], dlTitle: ['在你常用的设备上打开知回', 'Open KnowBack on the devices you use'],
  dlWeb: ['网页版', 'Web'], dlWebD: ['打开即用，电脑和手机浏览器都可以。', 'Opens right away in any browser, on computers and phones.'], dlWebBtn: ['在线使用', 'Open the app'],
  dlDesk: ['电脑（Windows / Mac）', 'Computer (Windows / Mac)'], dlDeskD: ['在 Chrome 或 Edge 中安装为独立窗口应用，开始菜单和任务栏里都有图标，自动更新。', 'Install from Chrome or Edge as its own app window, with an icon in the Start menu and taskbar. Updates itself.'], dlDeskBtn: ['安装到电脑（浏览器应用）', 'Install on computer (browser app)'],
  dlAndroid: ['安卓手机', 'Android phone'], dlAndroidD: ['下载安装包（约 1 MB），全屏打开。安装时选择"仍然安装"。', 'Download the installer (about 1 MB); it opens full screen. Choose "Install anyway" when asked.'], dlAndroidBtn: ['下载 APK', 'Download APK'],
  dlIos: ['iPhone / iPad', 'iPhone / iPad'], dlIosD: ['用 Safari 打开知回，点分享按钮，选"添加到主屏幕"。', 'Open KnowBack in Safari, tap Share, then "Add to Home Screen".'], dlIosBtn: ['用 Safari 打开', 'Open in Safari'],
  faqEyebrow: ['常见问题', 'FAQ'], faqTitle: ['你可能想知道', 'You might want to know'],
  finalTitle: ['下一个问题，就从知回开始问。', 'Ask your next question in KnowBack.'], footNote: ['学习记录默认保存在你的设备上', 'Your learning records stay on your device by default'],
  instTitle: ['安装到电脑', 'Install on computer'], close: ['知道了', 'Got it'],
};
const t = key => TEXT[key] ? pair(TEXT[key]) : key;

// ---- Scripted demo: three sample questions, an answer typed out, the card it becomes, and a review rating. ----
// Next-review times follow FSRS-5 defaults for a new card (first stabilities ≈ 1, 3 and 16 days); a miss returns in 10 minutes.
const SAMPLES = [
  { module: ['生活常识', 'Everyday knowledge'], q: ['为什么冷冻肉要放冷藏室解冻？', 'Why thaw frozen meat in the fridge?'],
    a: ['冷藏室温度低于 4°C，细菌繁殖慢；室温解冻时肉的表面会长时间处在 4–60°C 的"危险温度区"，细菌会快速增加。', 'The fridge stays below 4°C, where bacteria grow slowly. Thawing at room temperature leaves the surface in the 4–60°C danger zone for hours.'],
    card: ['冷藏解冻更安全', 'Thaw meat in the fridge'], point: ['避开 4–60°C 危险温度区', 'Avoid the 4–60°C danger zone'] },
  { module: ['编程', 'Coding'], q: ['JavaScript 的闭包是什么？', 'What is a closure in JavaScript?'],
    a: ['闭包是函数和它创建时所在作用域的组合：内部函数在外部函数返回后，仍能访问外部的变量。常用于计数器和私有状态。', 'A closure is a function plus the scope it was created in: an inner function can still use the outer variables after the outer function returns. Handy for counters and private state.'],
    card: ['闭包 = 函数 + 作用域', 'Closure = function + scope'], point: ['外层返回后变量仍可访问', 'Outer variables live on'] },
  { module: ['英语', 'English'], q: ['现在完成时和一般过去时有什么区别？', 'Present perfect vs simple past?'],
    a: ['一般过去时说"过去某个时间发生了什么"（I lost my key yesterday）；现在完成时强调"对现在的影响"（I have lost my key，现在还没找到）。', 'Simple past says what happened at a past time (I lost my key yesterday). Present perfect stresses the effect now (I have lost my key — it is still missing).'],
    card: ['完成时看"现在"', 'Perfect tense looks at now'], point: ['过去时看"那时"', 'Past tense looks at then'] },
];
let demoIndex = 0, demoTimer = null;
const stage = document.getElementById('demo-stage');
function renderQuestions() {
  document.getElementById('demo-questions').innerHTML = SAMPLES.map((sample, i) => `<button type="button" class="q-chip ${i === demoIndex ? 'active' : ''}" data-q="${i}">${pair(sample.q)}</button>`).join('');
  document.querySelectorAll('[data-q]').forEach(button => { button.onclick = () => playDemo(Number(button.dataset.q)); });
}
function playDemo(index) {
  demoIndex = index; renderQuestions(); clearInterval(demoTimer);
  const sample = SAMPLES[index], answer = pair(sample.a);
  stage.innerHTML = `<div class="bubble me">${pair(sample.q)}</div><div class="bubble ai"><span id="typed"></span><span class="caret" aria-hidden="true"></span></div>`;
  const typed = document.getElementById('typed');
  let shown = 0;
  const finish = () => { typed.textContent = answer; stage.querySelector('.caret')?.remove(); showCard(sample); };
  if (reduced) { finish(); return; }
  // Wide scripts carry more per character, so they type slower.
  const step = isChineseLocale(lang) || lang === 'ja' || lang === 'ko' ? 2 : 4;
  demoTimer = setInterval(() => { shown += step; typed.textContent = answer.slice(0, shown); if (shown >= answer.length) { clearInterval(demoTimer); finish(); } }, 28);
}
function showCard(sample) {
  const card = document.createElement('div');
  card.className = 'k-card';
  card.innerHTML = `<div class="k-card-head"><span class="k-module">${pair(sample.module)}</span><span class="k-made">${tr('已整理成知识卡片', 'Saved as a knowledge card')}</span></div>
    <strong>${pair(sample.card)}</strong><p>${pair(sample.point)}</p>
    <div class="k-rate"><span>${tr('复习时你还记得吗？', 'Do you still remember it?')}</span>
      <button type="button" data-rate="again">${tr('忘了', 'Forgot')}</button><button type="button" data-rate="hard">${tr('模糊', 'Unsure')}</button><button type="button" data-rate="good">${tr('记住了', 'Remembered')}</button></div>
    <p class="k-next" aria-live="polite"></p>`;
  stage.append(card);
  const next = { again: tr('10 分钟后再复习一次', 'Back in 10 minutes'), hard: tr('下次复习：约 1 天后', 'Next review: in about 1 day'), good: tr('下次复习：约 3 天后，之后间隔越来越长', 'Next review: in about 3 days, then further apart') };
  card.querySelectorAll('[data-rate]').forEach(button => { button.onclick = () => { card.querySelectorAll('[data-rate]').forEach(b => b.classList.toggle('picked', b === button)); card.querySelector('.k-next').textContent = next[button.dataset.rate]; }; });
}

// ---- Forgetting curve (FSRS-5): R(t) = (1 + F·t/S)^D with D = -0.5, F = 19/81. ----
const retention = (days, stability) => Math.pow(1 + (19 / 81) * days / stability, -0.5);
// Reviews at the days the scheduler would pick (90% target): stability grows after each successful review.
const REVIEWS = [{ day: 0, s: 1.2 }, { day: 1, s: 4 }, { day: 5, s: 11 }, { day: 16, s: 30 }];
const withReview = day => { const last = [...REVIEWS].reverse().find(review => review.day <= day); return retention(day - last.day, last.s); };
const W = 640, H = 260, DAYS = 30;
let PAD = { l: 44, r: 16, t: 16, b: 34 };
const x = day => PAD.l + (day / DAYS) * (W - PAD.l - PAD.r), y = r => PAD.t + (1 - r) * (H - PAD.t - PAD.b);
function path(fn) { let d = ''; for (let i = 0; i <= DAYS * 4; i++) { const day = i / 4; d += `${i ? 'L' : 'M'}${x(day).toFixed(1)},${y(fn(day)).toFixed(1)}`; } return d; }
function drawCurve() {
  const svg = document.getElementById('curve');
  const grid = [0, 0.25, 0.5, 0.75, 1].map(r => `<line x1="${PAD.l}" x2="${W - PAD.r}" y1="${y(r)}" y2="${y(r)}" class="grid"/><text x="${PAD.l - 8}" y="${y(r) + 4}" class="axis" text-anchor="end">${Math.round(r * 100)}%</text>`).join('');
  // Narrow screens get fewer, larger labels (the SVG scales down with the page).
  const narrow = svg.getBoundingClientRect().width < 500;
  svg.classList.toggle('narrow', narrow);
  PAD = narrow ? { l: 78, r: 44, t: 16, b: 44 } : { l: 44, r: 16, t: 16, b: 34 };
  const ticks = (narrow ? [0, 10, 20, 30] : [0, 5, 10, 15, 20, 25, 30]).map(day => `<text x="${x(day)}" y="${H - 12}" class="axis" text-anchor="middle">${tr('第{day}天', 'Day {day}', { day })}</text>`).join('');
  const marks = REVIEWS.slice(1).map(review => `<circle cx="${x(review.day)}" cy="${y(1)}" r="4" class="review-dot"/>`).join('');
  svg.innerHTML = `${grid}${ticks}<path d="${path(day => retention(day, 1.2))}" class="line no-review"/><path d="${path(withReview)}" class="line with-review"/>${marks}
    <line id="cursor-line" class="cursor-line" y1="${PAD.t}" y2="${H - PAD.b}" x1="-10" x2="-10"/>`;
  const readout = document.getElementById('curve-readout');
  const show = day => {
    svg.querySelector('#cursor-line').setAttribute('x1', x(day)); svg.querySelector('#cursor-line').setAttribute('x2', x(day));
    const vars = { day: Math.round(day), without: Math.round(retention(day, 1.2) * 100), with: Math.round(withReview(day) * 100) };
    readout.textContent = tr('第 {day} 天：不复习还记得约 {without}%，按知回复习约 {with}%', 'Day {day}: about {without}% left without review, about {with}% with KnowBack', vars);
  };
  svg.onpointermove = event => { const box = svg.getBoundingClientRect(), px = (event.clientX - box.left) / box.width * W; show(Math.min(DAYS, Math.max(0, (px - PAD.l) / (W - PAD.l - PAD.r) * DAYS))); };
  show(10);
}

// ---- Features and FAQ: each is a [title, text] pair of ['中文', 'English'] pairs. ----
const ICON = { cards: '<rect x="3" y="5" width="14" height="14" rx="2"/><path d="M7 3h12a2 2 0 0 1 2 2v12"/>', curve: '<path d="M3 4v16h18"/><path d="M6 8c3 0 4 9 8 9s4-5 6-5"/>', graph: '<circle cx="6" cy="6" r="2.5"/><circle cx="18" cy="8" r="2.5"/><circle cx="10" cy="18" r="2.5"/><path d="M8 7.5l7.5 1M7 8.5l2.4 7.2M16.5 10l-5 6"/>', mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>', compass: '<circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/>', lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>' };
const FEATURES = [
  { icon: 'cards', title: ['提问即笔记', 'Questions become notes'], text: ['AI 回答自动提炼成知识卡片，相同的问题自动合并，不用手动整理。', 'Answers are condensed into knowledge cards automatically; repeated questions merge.'] },
  { icon: 'curve', title: ['FSRS 智能复习', 'FSRS smart review'], text: ['按 FSRS-5 遗忘曲线安排每张卡片的复习时间，快忘的先出现。', 'FSRS-5 schedules each card on its forgetting curve, so what is fading comes first.'] },
  { icon: 'graph', title: ['知识图谱与思维导图', 'Knowledge graph & mind maps'], text: ['卡片之间自动连线，点开主题即可展开思维导图，可编辑、可下载。', 'Cards link up on their own; open a topic as a mind map you can edit and download.'] },
  { icon: 'mic', title: ['说话、拍照也能问', 'Ask by voice or photo'], text: ['支持语音输入和拍照识别题目，在路上也能随手提问。', 'Speak a question or photograph it, and ask on the go.'] },
  { icon: 'compass', title: ['学完去哪看更多', 'Where to go next'], text: ['每个模块精选知名、可靠的博主、书籍和论文，链接人工核对。', 'Well-known, reliable creators, books and papers per module, every link checked by hand.'] },
  { icon: 'lock', title: ['本地优先，加密同步', 'Local first, encrypted sync'], text: ['记录默认只存在你的设备上；登录后可用你自己的口令加密同步到云端。', 'Records stay on your device; signed in, you can sync them encrypted with your own passphrase.'] },
];
const FAQ = [
  { q: ['收费吗？', 'Does it cost anything?'], a: ['不收费。登录后每天有 20 次免费提问和 30 次免费复习评分；不登录也能在本机使用，每天 3 次免费提问。也可以填自己的模型 Key，不受次数限制。', 'No. Signed in, you get 20 free questions and 30 free review gradings a day; without an account you can still use it on this device with 3 free questions a day. You can also add your own model key with no limit.'] },
  { q: ['我的数据存在哪里？', 'Where is my data stored?'], a: ['默认保存在你自己的浏览器或手机里，离线也能复习。只有你在"账号"页主动加密上传时，才会把加密后的内容存到云端，口令只有你知道。', 'In your own browser or phone by default, and reviews work offline. Only when you choose encrypted upload on the Account page is an encrypted copy stored in the cloud, and only you know the passphrase.'] },
  { q: ['需要自己准备 AI Key 吗？', 'Do I need my own AI key?'], a: ['不需要。知回自带免费额度，开箱即可提问；想要更多次数或换模型，可以在"模型设置"里填自己的 Key。', 'No. KnowBack comes with a free allowance. For more questions or another model, add your own key in Model settings.'] },
  { q: ['支持哪些设备？', 'Which devices are supported?'], a: ['电脑和手机浏览器都能直接用；电脑可以在 Chrome 或 Edge 中安装成独立窗口；安卓可以下载 App；iPhone 用 Safari 添加到主屏幕。', 'Any modern browser on computers and phones. On a computer, install it from Chrome or Edge as its own window; on Android, download the app; on iPhone, add it to the Home Screen from Safari.'] },
  { q: ['"安装到电脑"和普通软件有什么不同？', 'How is "install on computer" different from regular software?'], a: ['它由浏览器安装，打开后是独立窗口，有自己的图标，内容随网站自动更新。它不是 .exe 安装包，不需要管理员权限。', 'The browser installs it as its own window with its own icon, and it updates with the website. It is not an .exe installer and needs no admin rights.'] },
];
const icon = name => `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[name]}</svg>`;
function renderLists() {
  document.getElementById('feature-grid').innerHTML = FEATURES.map(feature => `<article class="feature tilt reveal in"><span class="feature-icon">${icon(feature.icon)}</span><h3>${pair(feature.title)}</h3><p>${pair(feature.text)}</p></article>`).join('');
  document.getElementById('faq-list').innerHTML = FAQ.map(item => `<details class="faq-item"><summary>${pair(item.q)}</summary><p>${pair(item.a)}</p></details>`).join('');
  bindTilt();
}

// ---- Language and theme ----
const select = document.getElementById('lang');
select.innerHTML = ENABLED.map(code => `<option value="${code}" lang="${code}">${localeName(code)}</option>`).join('');
async function applyLanguage() {
  await loadCatalog(lang);
  setLocale(lang);
  select.value = lang;
  select.setAttribute('aria-label', tr('界面语言', 'Interface language'));
  document.documentElement.lang = intlLocale(lang);
  document.querySelectorAll('[data-i18n]').forEach(element => { element.textContent = t(element.dataset.i18n); });
  document.title = tr('知回 · 提问即笔记，遗忘前复习', 'KnowBack · Questions become notes, reviewed before you forget');
  document.querySelector('meta[name="description"]')?.setAttribute('content', tr('知回：提问即笔记，遗忘前复习。AI 回答自动整理成知识卡片，按 FSRS 遗忘曲线安排复习。', 'KnowBack: questions become notes, reviewed before you forget. AI answers become knowledge cards, scheduled for review on the FSRS forgetting curve.'));
  document.getElementById('curve').setAttribute('aria-label', tr('遗忘曲线对比', 'Forgetting curve comparison'));
  document.getElementById('numbers').setAttribute('aria-label', tr('知回的数字', 'KnowBack in numbers'));
  renderQuestions(); renderLists(); drawCurve(); playDemo(demoIndex); updateInstall(); updateTheme();
}
select.onchange = () => { if (!isLocale(select.value)) return; lang = select.value; try { localStorage.setItem(LANG_KEY, lang); } catch { /* This visit only. */ } applyLanguage(); };
function updateTheme() { const dark = window.knowledgeReviewTheme?.theme === 'dark', button = document.getElementById('theme'); button.textContent = dark ? '☀' : '☾'; button.setAttribute('aria-label', dark ? tr('切换白天模式', 'Switch to day') : tr('切换黑夜模式', 'Switch to night')); }
document.getElementById('theme').onclick = () => { window.knowledgeReviewTheme?.toggle(); updateTheme(); };

// ---- Install on computer: the browser's own install prompt where available, else short instructions. ----
let installPrompt = null;
const installed = () => matchMedia('(display-mode: standalone)').matches;
window.addEventListener('beforeinstallprompt', event => { event.preventDefault(); installPrompt = event; updateInstall(); });
window.addEventListener('appinstalled', () => { installPrompt = null; updateInstall(); });
function updateInstall() {
  document.querySelectorAll('[data-install]').forEach(button => { if (installed()) { button.textContent = tr('已安装到这台电脑', 'Installed on this computer'); button.disabled = true; } });
}
function installSteps() {
  const ua = navigator.userAgent, safari = /Safari/.test(ua) && !/Chrome|Chromium|Edg/.test(ua), firefox = /Firefox/.test(ua);
  if (safari) return tr('<ol><li>Mac 上的 Safari：点菜单栏"文件"。</li><li>选"添加到程序坞"，确认名称后添加。</li></ol>', '<ol><li>In Safari on a Mac, open the File menu.</li><li>Choose "Add to Dock" and confirm.</li></ol>');
  if (firefox) return tr('<p>Firefox 不支持把网站安装成应用。请用 Chrome 或 Edge 打开这个页面再安装，或直接<a href="/">在线使用</a>。</p>', '<p>Firefox cannot install websites as apps. Open this page in Chrome or Edge to install, or just <a href="/">use it online</a>.</p>');
  return tr('<ol><li>用 Chrome 或 Edge 打开知回。</li><li>点地址栏右侧的"安装"图标（电脑加箭头），或在右上角菜单中选"应用 → 安装知回"。</li><li>安装后，开始菜单和任务栏里会出现知回图标。</li></ol>', '<ol><li>Open KnowBack in Chrome or Edge.</li><li>Click the install icon at the right of the address bar, or choose "Apps → Install KnowBack" in the top-right menu.</li><li>KnowBack then appears in the Start menu and taskbar.</li></ol>');
}
document.addEventListener('click', async event => {
  const button = event.target.closest('[data-install]'); if (!button || button.disabled) return;
  if (installPrompt) { installPrompt.prompt(); const choice = await installPrompt.userChoice.catch(() => null); if (choice?.outcome === 'accepted') installPrompt = null; updateInstall(); return; }
  const dialog = document.getElementById('install-dialog'); document.getElementById('install-steps').innerHTML = installSteps(); dialog.showModal();
});
document.getElementById('install-close').onclick = () => document.getElementById('install-dialog').close();

// ---- Motion: scroll reveal, count-up, cursor glow, card tilt, magnetic buttons. ----
const revealer = 'IntersectionObserver' in window && !reduced ? new IntersectionObserver(entries => entries.forEach(entry => { if (entry.isIntersecting) { entry.target.classList.add('in'); revealer.unobserve(entry.target); } }), { threshold: 0.15 }) : null;
document.querySelectorAll('.reveal').forEach(element => revealer ? revealer.observe(element) : element.classList.add('in'));
const counter = new IntersectionObserver(entries => entries.forEach(entry => {
  if (!entry.isIntersecting) return; counter.unobserve(entry.target);
  const element = entry.target, to = Number(element.dataset.to), prefix = element.dataset.prefix || '';
  if (reduced) { element.textContent = prefix + to; return; }
  const start = performance.now(); const step = now => { const k = Math.min(1, (now - start) / 900); element.textContent = prefix + Math.round(to * (1 - Math.pow(1 - k, 3))); if (k < 1) requestAnimationFrame(step); }; requestAnimationFrame(step);
}), { threshold: 0.6 });
document.querySelectorAll('.count').forEach(element => counter.observe(element));
const fine = matchMedia('(hover: hover) and (pointer: fine)').matches && !reduced;
if (fine) {
  const glow = document.querySelector('.glow');
  window.addEventListener('pointermove', event => { glow.style.transform = `translate(${event.clientX - 300}px, ${event.clientY - 300}px)`; glow.classList.add('on'); });
  document.querySelectorAll('.magnetic').forEach(button => {
    button.addEventListener('pointermove', event => { const box = button.getBoundingClientRect(); button.style.transform = `translate(${(event.clientX - box.left - box.width / 2) * 0.15}px, ${(event.clientY - box.top - box.height / 2) * 0.25}px)`; });
    button.addEventListener('pointerleave', () => { button.style.transform = ''; });
  });
}
function bindTilt() {
  if (!fine) return;
  document.querySelectorAll('.tilt, .demo').forEach(element => {
    element.onpointermove = event => { const box = element.getBoundingClientRect(), px = (event.clientX - box.left) / box.width - 0.5, py = (event.clientY - box.top) / box.height - 0.5; element.style.transform = `perspective(900px) rotateX(${(-py * (element.classList.contains('demo') ? 5 : 7)).toFixed(2)}deg) rotateY(${(px * (element.classList.contains('demo') ? 7 : 9)).toFixed(2)}deg)`; };
    element.onpointerleave = () => { element.style.transform = ''; };
  });
}

if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
document.addEventListener('themechange', updateTheme);
let resizeTimer = null;
window.addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(drawCurve, 200); });
applyLanguage();
