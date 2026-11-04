// First-run guide for new users, shown once after registration and setup (or the first local-mode visit) and
// replayable later. Three steps, each skippable: choose voice or text → ask one question → a short answer, then a
// message explaining what 知回 does next (cards, forgetting-curve review, graph, mind maps and downloads, daily goal).
// The question is asked through the normal flow, so it is saved and becomes the user's first knowledge card.
import { starterQuestions } from './starter-content.js';
import { iconSvg } from './module-icons.js';
import { escapeHtml as e, renderAnswer } from './chat-store.js';
import { pick, translate, currentLocale, speechLocale } from './i18n.js';
export const ONBOARDING_KEY = 'knowledge-review.onboarding.v1';
export const onboardingDone = () => { try { return localStorage.getItem(ONBOARDING_KEY) === '1'; } catch { return true; } };
// The browser's speech-recognition error codes, explained for the user (shared with the question page).
export function speechErrorText(code, zh) {
  const words = {
    'not-allowed': ['麦克风权限被拒绝。请在浏览器或手机设置中允许本网站使用麦克风，或改用文字输入。', 'Microphone access was denied. Allow it for this site in your browser or phone settings, or type instead.'],
    'service-not-allowed': ['当前浏览器不允许使用语音识别，请换一个浏览器或改用文字输入。', 'This browser does not allow speech recognition. Try another browser or type instead.'],
    'audio-capture': ['没有找到可用的麦克风，请检查设备，或改用文字输入。', 'No microphone was found. Check your device or type instead.'],
    network: ['语音识别需要联网，现在连接不上识别服务，请改用文字输入。', 'Speech recognition needs a connection to its service, which is unavailable. Please type instead.'],
    'no-speech': ['没有听到声音，请靠近话筒再试一次。', 'No speech was heard. Move closer to the mic and try again.'],
  }[code];
  if (code === 'aborted') return '';
  // Phones on the home-network address (plain http) never get the microphone, whatever the permission says.
  if ((code === 'not-allowed' || code === 'service-not-allowed') && globalThis.isSecureContext === false) return pick('语音输入需要 HTTPS 网址，局域网地址（http）下手机浏览器不允许使用麦克风，请改用文字输入。', 'Voice input needs an HTTPS address. On the home-network (http) address, phone browsers block the microphone. Please type instead.');
  // zh (true/false) forces Chinese or English; without it the current interface language is used.
  const locale = zh === undefined ? currentLocale() : zh ? 'zh' : 'en';
  return words ? translate(words[0], words[1], undefined, locale) : (translate('语音识别没有完成，请重试或改用文字输入。', 'Speech recognition did not finish. Try again or type instead.', undefined, locale));
}
export const markOnboardingDone = () => { try { localStorage.setItem(ONBOARDING_KEY, '1'); } catch { /* Shown again next time. */ } };

// Used only when no model is available: one prepared answer per built-in module, clearly labelled as an example.
const SAMPLE = {
  coding: { zh: "**变量就是给一份数据起的名字。** 程序通过这个名字读取和修改数据：比如购物车的总价存进 total，每加一件商品就更新 total，名字不变，里面的数在变。",
    en: "**A variable is a name for a piece of data.** The program reads and changes the data through that name: keep the cart total in total and update it whenever an item is added — the name stays, the value changes." },
  english: { zh: "**一般现在时用来说习惯、经常发生的事和客观事实。** 主语是他、她、它时，动词通常加 -s，例如 She drinks coffee every morning（她每天早上喝咖啡）。",
    en: "**Use the present simple for habits, repeated actions and facts.** With he, she or it the verb usually adds -s: She drinks coffee every morning." },
  work: { zh: "**一封清楚的工作邮件，先在标题和第一句说清目的。** 再分点写需要对方做什么、什么时候之前，最后附上联系方式。例如标题写“请在周五前确认方案 B”。",
    en: "**A clear work email states its purpose in the subject and first line.** Then list what you need and by when, and end with how to reach you — e.g. subject “Please confirm option B by Friday”." },
  life: { zh: "**冷冻肉放进冷藏室慢慢解冻最安全。** 温度一直较低，细菌不容易繁殖；放在室温下太久，表面容易滋生细菌。可以前一晚把第二天要吃的肉移到冷藏室。",
    en: "**Thawing frozen meat in the fridge is safest.** It stays cold the whole time, which limits bacteria; left at room temperature, the surface warms up and bacteria grow. Move tomorrow’s meat to the fridge the night before." },
};
const TOUR = [
  { icon: 'bookmark', title: { zh: "自动整理成知识卡片", en: "Knowledge cards, automatically" },
    body: { zh: "每次提问后，知回会把要点整理成一张知识卡片，存进知识库。", en: "After each question, the key points become a card in your library." } },
  { icon: 'repeat', title: { zh: "按遗忘曲线安排复习", en: "Reviews on the forgetting curve" },
    body: { zh: "在你快要忘记时安排复习：翻卡或用自己的话回答，几分钟就能完成。", en: "Review just before you would forget: flashcards or your own words, a few minutes a day." } },
  { icon: 'globe', title: { zh: "知识图谱", en: "Knowledge graph" },
    body: { zh: "问得越多，相关的知识会自动连起来，看清自己学过什么。", en: "The more you ask, the more related ideas connect, so you see what you have learned." } },
  { icon: 'book', title: { zh: "思维导图与下载", en: "Mind maps and downloads" },
    body: { zh: "把一个知识点展开成思维导图，或把复习好的知识汇总下载成 Word。", en: "Expand an idea into a mind map, or download what you have reviewed as a Word file." } },
  { icon: 'chart', title: { zh: "每日目标与打卡", en: "Daily goal and check-ins" },
    body: { zh: "每天定一个小目标，完成后生成打卡图，和朋友分享。", en: "Set a small daily goal and share a check-in image when you reach it." } },
];

// deps: locale(), modules() [{id, name}], level(id), freeOffered(), needsConsent(), giveConsent(), canAsk(),
// ask(module, text) → Promise<{answer, card} | {error}>, finish(), refresh()
export function createOnboarding(deps) {
  const zh = () => deps.locale() === 'zh', tr = (a, b, vars) => pick(a, b, vars);
  let step = 'choose', mode = 'text', module = '', text = '', result = null, error = '', busy = false, listening = false, recognition = null, agreed = false;
  const Speech = () => window.SpeechRecognition || window.webkitSpeechRecognition;
  const reset = () => { step = 'choose'; mode = 'text'; module = ''; text = ''; result = null; error = ''; busy = false; stopVoice(); };
  function stopVoice() { try { recognition?.stop(); } catch { /* Already stopped. */ } recognition = null; listening = false; }
  const currentModule = () => { const list = deps.modules(); if (!list.some(item => item.id === module)) module = list[0]?.id || ''; return module; };

  function header(title, sub) {
    return `<div class="onb-top"><span class="eyebrow">${tr('欢迎来到知回', 'Welcome to Knowledge Review')}</span><button class="text-button onb-skip" data-onb-skip>${tr('跳过', 'Skip')}</button></div><h1>${title}</h1>${sub ? `<p class="onb-sub">${sub}</p>` : ''}`;
  }
  function moduleTabs() {
    return `<div class="module-tabs onb-modules" role="group" aria-label="${tr('学习模块', 'Learning modules')}">${deps.modules().map(item => `<button class="module-tab ${item.id === currentModule() ? 'active' : ''}" data-onb-module="${e(item.id)}" aria-pressed="${item.id === currentModule()}">${item.icon}${e(item.name)}</button>`).join('')}</div>`;
  }
  const consentBox = () => deps.needsConsent() ? `<label class="check-row onb-consent"><input type="checkbox" data-onb-consent ${agreed ? 'checked' : ''}>${tr('我同意把问题发送给智谱 AI（知回免费额度）处理', 'I agree to send my question to Zhipu AI (the free allowance)')}</label>` : '';
  function chooseView() {
    return `${header(tr('先来问一个问题吧', 'Start with one question'), tr('知回会回答你，并把答案整理成记得住的知识。选一种提问方式：', 'Knowledge Review answers it and turns it into something you remember. Choose how to ask:'))}
      <div class="onb-choices"><button class="onb-choice" data-onb-mode="voice">${iconSvg('mic', 40)}<strong>${tr('语音提问', 'Ask by voice')}</strong><span>${tr('按下话筒，直接说出你的问题', 'Tap the mic and say your question')}</span></button>
      <button class="onb-choice" data-onb-mode="text">${iconSvg('keyboard', 40)}<strong>${tr('文字提问', 'Ask by typing')}</strong><span>${tr('从示例问题里选一个，或自己输入', 'Pick an example or type your own')}</span></button></div>`;
  }
  function askView() {
    const examples = starterQuestions(currentModule(), deps.level(currentModule()), deps.locale(), deps.modules().find(item => item.id === currentModule())?.name), noModel = !deps.canAsk() && !deps.needsConsent();
    const sendable = !busy && text.trim() && (!deps.needsConsent() || agreed);
    const voice = mode === 'voice', voiceOk = Boolean(Speech());
    return `${header(voice ? tr('说出你的问题', 'Say your question') : tr('选一个问题，或自己写', 'Pick a question or write your own'), noModel ? tr('当前没有可用的模型，下面先用示例回答带你看一遍流程；进入后可在“模型设置”中配置。', 'No model is available yet, so a sample answer shows you the flow; you can set up a model later in Model settings.') : '')}
      ${moduleTabs()}${noModel ? '' : consentBox()}
      ${voice ? (voiceOk ? `<div class="onb-voice"><button class="onb-mic ${listening ? 'listening' : ''}" data-onb-mic aria-label="${listening ? tr('停止', 'Stop') : tr('开始说话', 'Start speaking')}" ${noModel ? 'disabled' : ''}>${iconSvg('mic', 44)}</button><p>${listening ? tr('正在听…说完再点一下', 'Listening… tap again when done') : tr('点一下话筒开始说话', 'Tap the mic to start')}</p></div>`
        : `<p class="error">${tr('当前浏览器不支持语音识别，请用文字提问。', 'This browser cannot recognise speech. Please type instead.')}</p><button class="secondary-button" data-onb-mode="text">${tr('改用文字提问', 'Type instead')}</button>`)
        : `<div class="onb-examples">${(noModel ? examples.slice(0, 1) : examples).map(q => `<button class="onb-example" data-onb-example="${e(q)}">${e(q)}<span aria-hidden="true">→</span></button>`).join('')}</div>`}
      ${noModel ? '' : `<textarea class="onb-input" data-onb-text rows="3" maxlength="2000" placeholder="${tr('也可以在这里写下你的问题…', 'Or write your question here…')}">${e(text)}</textarea>
      <div class="onb-actions"><button class="text-button" data-onb-back>${tr('← 换一种方式', '← Change how to ask')}</button><button class="primary-button" data-onb-send ${sendable ? '' : 'disabled'}>${busy ? tr('正在回答…', 'Answering…') : tr('提问', 'Ask')} →</button></div>`}
      ${error ? `<p class="error" role="alert">${e(error)}</p>` : ''}`;
  }
  function answerView() {
    const card = result.card, words = TOUR.map(item => [item.icon, pick(item.title.zh, item.title.en), pick(item.body.zh, item.body.en)]);
    return `${header(tr('这就是知回', 'This is Knowledge Review'), '')}
      <div class="onb-chat"><div class="message user-message"><div class="message-content"><div class="user-text">${e(result.question)}</div></div></div>
        <div class="message assistant-message">${result.sample ? `<span class="pill">${tr('示例回答', 'Sample answer')}</span>` : ''}<div class="message-content">${renderAnswer(result.answer)}</div></div>
        <div class="message assistant-message onb-tour"><h3>${tr('知回接下来会帮你：', 'What happens next:')}</h3>
          <ol>${words.map(([icon, title, body], i) => `<li><span class="onb-tour-icon">${iconSvg(icon, 22)}</span><div><strong>${title}</strong><p>${body}</p>${i === 0 && card ? `<div class="onb-card"><span class="eyebrow">${tr('刚整理出的知识卡片', 'Your first card')}</span><strong>${e(card.title)}</strong><p>${e(card.summary.slice(0, 120))}${card.summary.length > 120 ? '…' : ''}</p></div>` : ''}${i === 1 && card ? `<p class="onb-when">${tr('这张卡片明天会出现在你的复习里。', 'This card will appear in your review tomorrow.')}</p>` : ''}</div></li>`).join('')}</ol></div></div>
      <div class="onb-actions"><button class="secondary-button" data-onb-again>${tr('再问一个', 'Ask another')}</button><button class="primary-button" data-onb-finish>${tr('进入知回', 'Start using Knowledge Review')} →</button></div>`;
  }
  function view() { return `<section class="onboarding">${step === 'choose' ? chooseView() : step === 'ask' ? askView() : answerView()}</section>`; }

  async function submit(question) {
    const q = question.trim(); if (!q || busy) return;
    if (!deps.canAsk() && !deps.needsConsent()) {
      result = { question: q, answer: (sample => pick(sample.zh, sample.en))(SAMPLE[currentModule()] || SAMPLE.life), card: null, sample: true }; step = 'answer'; deps.refresh(); return;
    }
    if (deps.needsConsent()) { if (!agreed) { error = tr('请先勾选同意说明。', 'Please tick the agreement first.'); deps.refresh(); return; } deps.giveConsent(); }
    busy = true; error = ''; text = q; stopVoice(); deps.refresh();
    const outcome = await deps.ask(currentModule(), q);
    busy = false;
    if (outcome?.answer) { result = { question: q, answer: outcome.answer, card: outcome.card, sample: false }; step = 'answer'; text = ''; }
    else error = outcome?.error || tr('这次没有得到回答，请稍后再试，或先跳过。', 'No answer this time. Try again later, or skip for now.');
    deps.refresh(); window.scrollTo(0, 0);
  }
  function startVoice() {
    const Recognition = Speech(); if (!Recognition) return;
    recognition = new Recognition(); recognition.lang = speechLocale(currentLocale()); recognition.interimResults = true; recognition.continuous = false;
    recognition.onresult = event => { text = [...event.results].map(item => item[0].transcript).join(''); const box = document.querySelector('[data-onb-text]'); if (box) box.value = text; const send = document.querySelector('[data-onb-send]'); if (send) send.disabled = !text.trim() || (deps.needsConsent() && !agreed); };
    recognition.onerror = event => { error = speechErrorText(event.error); listening = false; deps.refresh(); };
    recognition.onend = () => { listening = false; recognition = null; deps.refresh(); };
    try { recognition.start(); listening = true; error = ''; } catch { listening = false; }
    deps.refresh();
  }
  function bind() {
    const on = (selector, handler) => document.querySelectorAll(selector).forEach(element => { element.onclick = () => handler(element); });
    on('[data-onb-skip]', () => { stopVoice(); deps.finish(); });
    on('[data-onb-finish]', () => deps.finish());
    on('[data-onb-mode]', element => { mode = element.dataset.onbMode; step = 'ask'; error = ''; deps.refresh(); });
    on('[data-onb-back]', () => { stopVoice(); step = 'choose'; error = ''; deps.refresh(); });
    on('[data-onb-again]', () => { result = null; step = 'ask'; mode = 'text'; deps.refresh(); });
    on('[data-onb-module]', element => { module = element.dataset.onbModule; deps.refresh(); });
    on('[data-onb-example]', element => submit(element.dataset.onbExample));
    on('[data-onb-send]', () => submit(text));
    on('[data-onb-mic]', () => { if (listening) stopVoice(); else startVoice(); deps.refresh(); });
    const box = document.querySelector('[data-onb-text]'); if (box) box.oninput = () => { text = box.value; const send = document.querySelector('[data-onb-send]'); if (send) send.disabled = busy || !text.trim() || (deps.needsConsent() && !agreed); };
    const consent = document.querySelector('[data-onb-consent]'); if (consent) consent.onchange = () => { agreed = consent.checked; error = ''; const send = document.querySelector('[data-onb-send]'); if (send) send.disabled = busy || !text.trim() || !agreed; };
  }
  return { view, bind, reset, get busy() { return busy; } };
}
