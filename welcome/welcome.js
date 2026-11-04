// 知回 product page (/welcome): bilingual text, a scripted demo (no model call), the FSRS forgetting curve, scroll
// reveals, a cursor glow and card tilt, and "install to computer" through the browser's own app install.
// Decorative motion is skipped when the visitor asks for reduced motion.
const LANG_KEY = 'knowledge-review.welcome-lang.v1';
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
let lang = (() => { try { const saved = localStorage.getItem(LANG_KEY); if (saved === 'zh' || saved === 'en') return saved; } catch { /* Fall back to the browser language. */ } return navigator.language?.startsWith('zh') ? 'zh' : 'en'; })();

const TEXT = {
  zh: {},
  en: {
    navHow: 'How it works', navFeatures: 'Features', navDownload: 'Download', navFaq: 'FAQ', openApp: 'Open the app',
    badge: 'Free allowance · No key needed · Local first', title1: 'Ask a question,', title2: 'and remember it.',
    lead: '知回 turns every question you ask AI into a knowledge card, then reminds you to review it just before you would forget. What you learn finally stays.',
    chip1: 'Questions become notes', chip2: 'FSRS forgetting-curve review', chip3: 'Knowledge graph & mind maps',
    ctaStart: 'Start now', ctaDesktop: 'Install on computer', ctaAndroid: 'Download Android app',
    fine: 'Works on the web, on computers and on Android. Your data stays on your device by default.',
    demoTitle: '知回 · Demo', demoTag: 'Demo, no model call', demoHint: 'Pick a question to try:',
    howEyebrow: 'Three steps', howTitle: 'From one question to a card you remember',
    step1: 'Ask', step1d: 'Type, speak or photograph a question. Coding, English, work and life each keep their own records.',
    step2: 'It becomes a card', step2d: 'Each answer is condensed into a knowledge card with a title, key points and an example. No note-taking needed.',
    step3: 'Review on time', step3d: 'FSRS works out when each card is about to fade and reminds you then, so it sticks a little longer each time.',
    curveTitle: 'Forgetting curve: reviews make memories last', curveNote: 'Computed with FSRS-5 default parameters. Move over the chart to see how much is left on each day.',
    legendNo: 'No review', legendYes: 'Reviewing with 知回',
    featEyebrow: 'Core features', featTitle: 'Everything you learn, kept for you',
    num1: 'learning modules', num2: 'hand-checked recommended resources', num3: 'review algorithm', num4: 'free questions a day (signed in)',
    dlEyebrow: 'Download & install', dlTitle: 'Open 知回 on the devices you use',
    dlWeb: 'Web', dlWebD: 'Opens right away in any browser, on computers and phones.', dlWebBtn: 'Open the app',
    dlDesk: 'Computer (Windows / Mac)', dlDeskD: 'Install from Chrome or Edge as its own app window, with an icon in the Start menu and taskbar. Updates itself.', dlDeskBtn: 'Install on computer (browser app)',
    dlAndroid: 'Android phone', dlAndroidD: 'Download the installer (about 1 MB); it opens full screen. Choose "Install anyway" when asked.', dlAndroidBtn: 'Download APK',
    dlIos: 'iPhone / iPad', dlIosD: 'Open 知回 in Safari, tap Share, then "Add to Home Screen".', dlIosBtn: 'Open in Safari',
    faqEyebrow: 'FAQ', faqTitle: 'You might want to know',
    finalTitle: 'Ask your next question in 知回.', footNote: 'Your learning records stay on your device by default',
    instTitle: 'Install on computer', close: 'Got it',
  },
};
// Chinese is the page's own markup; remember it so switching back restores it.
document.querySelectorAll('[data-i18n]').forEach(element => { TEXT.zh[element.dataset.i18n] = element.textContent; });
const t = key => (TEXT[lang][key] ?? TEXT.zh[key] ?? key);
const tr = (zh, en) => lang === 'zh' ? zh : en;

// ---- Scripted demo: three sample questions, an answer typed out, the card it becomes, and a review rating. ----
// Next-review times follow FSRS-5 defaults for a new card (first stabilities ≈ 1, 3 and 16 days); a miss returns in 10 minutes.
const SAMPLES = [
  { module: { zh: '生活常识', en: 'Life' }, q: { zh: '为什么冷冻肉要放冷藏室解冻？', en: 'Why thaw frozen meat in the fridge?' },
    a: { zh: '冷藏室温度低于 4°C，细菌繁殖慢；室温解冻时肉的表面会长时间处在 4–60°C 的"危险温度区"，细菌会快速增加。', en: 'The fridge stays below 4°C, where bacteria grow slowly. Thawing at room temperature leaves the surface in the 4–60°C danger zone for hours.' },
    card: { zh: '冷藏解冻更安全', en: 'Thaw in the fridge' }, point: { zh: '避开 4–60°C 危险温度区', en: 'Avoid the 4–60°C danger zone' } },
  { module: { zh: '编程', en: 'Coding' }, q: { zh: 'JavaScript 的闭包是什么？', en: 'What is a closure in JavaScript?' },
    a: { zh: '闭包是函数和它创建时所在作用域的组合：内部函数在外部函数返回后，仍能访问外部的变量。常用于计数器和私有状态。', en: 'A closure is a function plus the scope it was created in: an inner function can still use the outer variables after the outer function returns. Handy for counters and private state.' },
    card: { zh: '闭包 = 函数 + 作用域', en: 'Closure = function + scope' }, point: { zh: '外层返回后变量仍可访问', en: 'Outer variables live on' } },
  { module: { zh: '英语', en: 'English' }, q: { zh: '现在完成时和一般过去时有什么区别？', en: 'Present perfect vs simple past?' },
    a: { zh: '一般过去时说"过去某个时间发生了什么"（I lost my key yesterday）；现在完成时强调"对现在的影响"（I have lost my key，现在还没找到）。', en: 'Simple past says what happened at a past time (I lost my key yesterday). Present perfect stresses the effect now (I have lost my key — it is still missing).' },
    card: { zh: '完成时看"现在"', en: 'Perfect tense looks at now' }, point: { zh: '过去时看"那时"', en: 'Past tense looks at then' } },
];
let demoIndex = 0, demoTimer = null;
const stage = document.getElementById('demo-stage');
function renderQuestions() {
  document.getElementById('demo-questions').innerHTML = SAMPLES.map((sample, i) => `<button type="button" class="q-chip ${i === demoIndex ? 'active' : ''}" data-q="${i}">${sample.q[lang]}</button>`).join('');
  document.querySelectorAll('[data-q]').forEach(button => { button.onclick = () => playDemo(Number(button.dataset.q)); });
}
function playDemo(index) {
  demoIndex = index; renderQuestions(); clearInterval(demoTimer);
  const sample = SAMPLES[index], answer = sample.a[lang];
  stage.innerHTML = `<div class="bubble me">${sample.q[lang]}</div><div class="bubble ai"><span id="typed"></span><span class="caret" aria-hidden="true"></span></div>`;
  const typed = document.getElementById('typed');
  let shown = 0;
  const finish = () => { typed.textContent = answer; stage.querySelector('.caret')?.remove(); showCard(sample); };
  if (reduced) { finish(); return; }
  demoTimer = setInterval(() => { shown += lang === 'zh' ? 2 : 4; typed.textContent = answer.slice(0, shown); if (shown >= answer.length) { clearInterval(demoTimer); finish(); } }, 28);
}
function showCard(sample) {
  const card = document.createElement('div');
  card.className = 'k-card';
  card.innerHTML = `<div class="k-card-head"><span class="k-module">${sample.module[lang]}</span><span class="k-made">${tr('已整理成知识卡片', 'Saved as a knowledge card')}</span></div>
    <strong>${sample.card[lang]}</strong><p>${sample.point[lang]}</p>
    <div class="k-rate"><span>${tr('复习时你还记得吗？', 'Do you still remember it?')}</span>
      <button type="button" data-rate="again">${tr('忘了', 'Forgot')}</button><button type="button" data-rate="hard">${tr('模糊', 'Unsure')}</button><button type="button" data-rate="good">${tr('记住了', 'Got it')}</button></div>
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
  const ticks = (narrow ? [0, 10, 20, 30] : [0, 5, 10, 15, 20, 25, 30]).map(day => `<text x="${x(day)}" y="${H - 12}" class="axis" text-anchor="middle">${tr(`第${day}天`, `Day ${day}`)}</text>`).join('');
  const marks = REVIEWS.slice(1).map(review => `<circle cx="${x(review.day)}" cy="${y(1)}" r="4" class="review-dot"/>`).join('');
  svg.innerHTML = `${grid}${ticks}<path d="${path(day => retention(day, 1.2))}" class="line no-review"/><path d="${path(withReview)}" class="line with-review"/>${marks}
    <line id="cursor-line" class="cursor-line" y1="${PAD.t}" y2="${H - PAD.b}" x1="-10" x2="-10"/>`;
  const readout = document.getElementById('curve-readout');
  const show = day => {
    svg.querySelector('#cursor-line').setAttribute('x1', x(day)); svg.querySelector('#cursor-line').setAttribute('x2', x(day));
    readout.textContent = tr(`第 ${Math.round(day)} 天：不复习还记得约 ${Math.round(retention(day, 1.2) * 100)}%，按知回复习约 ${Math.round(withReview(day) * 100)}%`,
      `Day ${Math.round(day)}: about ${Math.round(retention(day, 1.2) * 100)}% left without review, about ${Math.round(withReview(day) * 100)}% with 知回`);
  };
  svg.onpointermove = event => { const box = svg.getBoundingClientRect(), px = (event.clientX - box.left) / box.width * W; show(Math.min(DAYS, Math.max(0, (px - PAD.l) / (W - PAD.l - PAD.r) * DAYS))); };
  show(10);
}

// ---- Features and FAQ ----
const ICON = { cards: '<rect x="3" y="5" width="14" height="14" rx="2"/><path d="M7 3h12a2 2 0 0 1 2 2v12"/>', curve: '<path d="M3 4v16h18"/><path d="M6 8c3 0 4 9 8 9s4-5 6-5"/>', graph: '<circle cx="6" cy="6" r="2.5"/><circle cx="18" cy="8" r="2.5"/><circle cx="10" cy="18" r="2.5"/><path d="M8 7.5l7.5 1M7 8.5l2.4 7.2M16.5 10l-5 6"/>', mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>', compass: '<circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/>', lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>' };
const FEATURES = [
  { icon: 'cards', zh: ['提问即笔记', 'AI 回答自动提炼成知识卡片，相同的问题自动合并，不用手动整理。'], en: ['Questions become notes', 'Answers are condensed into knowledge cards automatically; repeated questions merge.'] },
  { icon: 'curve', zh: ['FSRS 智能复习', '按 FSRS-5 遗忘曲线安排每张卡片的复习时间，快忘的先出现。'], en: ['FSRS smart review', 'FSRS-5 schedules each card on its forgetting curve, so what is fading comes first.'] },
  { icon: 'graph', zh: ['知识图谱与思维导图', '卡片之间自动连线，点开主题即可展开思维导图，可编辑、可下载。'], en: ['Knowledge graph & mind maps', 'Cards link up on their own; open a topic as a mind map you can edit and download.'] },
  { icon: 'mic', zh: ['说话、拍照也能问', '支持语音输入和拍照识别题目，在路上也能随手提问。'], en: ['Ask by voice or photo', 'Speak a question or photograph it, and ask on the go.'] },
  { icon: 'compass', zh: ['学完去哪看更多', '每个模块精选知名、可靠的博主、书籍和论文，链接人工核对。'], en: ['Where to go next', 'Well-known, reliable creators, books and papers per module, every link checked by hand.'] },
  { icon: 'lock', zh: ['本地优先，加密同步', '记录默认只存在你的设备上；登录后可用你自己的口令加密同步到云端。'], en: ['Local first, encrypted sync', 'Records stay on your device; signed in, you can sync them encrypted with your own passphrase.'] },
];
const FAQ = [
  { zh: ['收费吗？', '不收费。登录后每天有 20 次免费提问和 30 次免费复习评分；不登录也能在本机使用，每天 3 次免费提问。也可以填自己的模型 Key，不受次数限制。'], en: ['Does it cost anything?', 'No. Signed in, you get 20 free questions and 30 free review gradings a day; without an account you can still use it on this device with 3 free questions a day. You can also add your own model key with no limit.'] },
  { zh: ['我的数据存在哪里？', '默认保存在你自己的浏览器或手机里，离线也能复习。只有你在"账号"页主动加密上传时，才会把加密后的内容存到云端，口令只有你知道。'], en: ['Where is my data stored?', 'In your own browser or phone by default, and reviews work offline. Only when you choose encrypted upload on the Account page is an encrypted copy stored in the cloud, and only you know the passphrase.'] },
  { zh: ['需要自己准备 AI Key 吗？', '不需要。知回自带免费额度，开箱即可提问；想要更多次数或换模型，可以在"模型设置"里填自己的 Key。'], en: ['Do I need my own AI key?', 'No. 知回 comes with a free allowance. For more questions or another model, add your own key in Model settings.'] },
  { zh: ['支持哪些设备？', '电脑和手机浏览器都能直接用；电脑可以在 Chrome 或 Edge 中安装成独立窗口；安卓可以下载 App；iPhone 用 Safari 添加到主屏幕。'], en: ['Which devices are supported?', 'Any modern browser on computers and phones. On a computer, install it from Chrome or Edge as its own window; on Android, download the app; on iPhone, add it to the Home Screen from Safari.'] },
  { zh: ['"安装到电脑"和普通软件有什么不同？', '它由浏览器安装，打开后是独立窗口，有自己的图标，内容随网站自动更新。它不是 .exe 安装包，不需要管理员权限。'], en: ['How is "install on computer" different from regular software?', 'The browser installs it as its own window with its own icon, and it updates with the website. It is not an .exe installer and needs no admin rights.'] },
];
const icon = name => `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[name]}</svg>`;
function renderLists() {
  document.getElementById('feature-grid').innerHTML = FEATURES.map(feature => `<article class="feature tilt reveal in"><span class="feature-icon">${icon(feature.icon)}</span><h3>${feature[lang][0]}</h3><p>${feature[lang][1]}</p></article>`).join('');
  document.getElementById('faq-list').innerHTML = FAQ.map(item => `<details class="faq-item"><summary>${item[lang][0]}</summary><p>${item[lang][1]}</p></details>`).join('');
  bindTilt();
}

// ---- Language and theme ----
function applyLanguage() {
  document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
  document.querySelectorAll('[data-i18n]').forEach(element => { element.textContent = t(element.dataset.i18n); });
  document.title = tr('知回 · 提问即笔记，遗忘前复习', '知回 · Questions become notes, reviewed before you forget');
  const langButton = document.getElementById('lang'); langButton.textContent = lang === 'zh' ? 'EN' : '中'; langButton.setAttribute('aria-label', lang === 'zh' ? 'English' : '中文');
  document.getElementById('curve').setAttribute('aria-label', tr('遗忘曲线对比', 'Forgetting curve comparison'));
  renderQuestions(); renderLists(); drawCurve(); playDemo(demoIndex); updateInstall(); updateTheme();
}
document.getElementById('lang').onclick = () => { lang = lang === 'zh' ? 'en' : 'zh'; try { localStorage.setItem(LANG_KEY, lang); } catch { /* This visit only. */ } applyLanguage(); };
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
  return tr('<ol><li>用 Chrome 或 Edge 打开知回。</li><li>点地址栏右侧的"安装"图标（电脑加箭头），或在右上角菜单中选"应用 → 安装知回"。</li><li>安装后，开始菜单和任务栏里会出现知回图标。</li></ol>', '<ol><li>Open 知回 in Chrome or Edge.</li><li>Click the install icon at the right of the address bar, or choose "Apps → Install 知回" in the top-right menu.</li><li>知回 then appears in the Start menu and taskbar.</li></ol>');
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
