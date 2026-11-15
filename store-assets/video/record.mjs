// Screen recordings of KnowBack for the promo video, from the real-model QA service (tests/browser-fixture.mjs with
// REAL_MODELS=1 on http://localhost:4176) in a throwaway headless Chrome profile. Answers, grading and translations
// are the real free model's output; accounts and data live only in the fake account service.
// Frames come from Chrome's screencast with their timestamps; assemble.py turns them into 30 fps MP4.
// Usage: node store-assets/video/record.mjs [clip ...]   (no clip names = all)
import { spawn } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const SCALE = Number(process.env.SCALE || 3);
const BASE = process.env.BASE || 'http://localhost:4176', PORT = 9334;
const OUT = new URL('./frames/', import.meta.url);
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const profile = mkdtempSync(join(tmpdir(), 'knowback-rec-'));
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, '--hide-scrollbars', `--force-device-scale-factor=${SCALE}`, `--window-size=${process.env.WIN || '390,844'}`, '--lang=en-US', '--accept-lang=en-US', '--no-first-run', '--no-default-browser-check', 'about:blank'], { stdio: 'ignore' });
let version;
for (let i = 0; i < 50 && !version; i++) { try { version = await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json(); } catch { await sleep(200); } }
const ws = new WebSocket(version.webSocketDebuggerUrl);
await new Promise(resolve => ws.addEventListener('open', resolve, { once: true }));
let seq = 0; const pending = new Map(), listeners = new Set();
ws.addEventListener('message', event => {
  const msg = JSON.parse(event.data);
  if (msg.id && pending.has(msg.id)) { const { resolve, reject } = pending.get(msg.id); pending.delete(msg.id); msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result); }
  else if (msg.method) for (const listener of listeners) listener(msg);
});
const send = (method, params = {}, sessionId) => new Promise((resolve, reject) => { const id = ++seq; pending.set(id, { resolve, reject }); ws.send(JSON.stringify({ id, method, params, sessionId })); });
const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
const page = (method, params) => send(method, params, sessionId);
await page('Page.enable'); await page('Runtime.enable');
const run = async code => { const r = await page('Runtime.evaluate', { expression: `(async () => { ${code} })()`, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text); return r.result.value; };
const go = async (url, wait = 2200) => { await page('Page.navigate', { url }); await sleep(wait); };
const PHONE = { width: 390, height: 844, deviceScaleFactor: 3, mobile: true }, DESKTOP = { width: 1440, height: 900, deviceScaleFactor: 4 / 3, mobile: false };

// Record while `act` runs: every screencast frame is saved with its timestamp.
async function record(name, metrics, act) {
  const dir = new URL(`./${name}/`, OUT); rmSync(dir, { recursive: true, force: true }); mkdirSync(dir, { recursive: true });
  const frames = [];
  const onFrame = msg => {
    if (msg.method !== 'Page.screencastFrame' || msg.sessionId !== sessionId) return;
    const { data, metadata, sessionId: frameSession } = msg.params;
    const file = `${String(frames.length).padStart(5, '0')}.jpg`;
    writeFileSync(new URL(file, dir), Buffer.from(data, 'base64'));
    frames.push({ file, t: metadata.timestamp });
    page('Page.screencastFrameAck', { sessionId: frameSession }).catch(() => {});
  };
  listeners.add(onFrame);
  await page('Page.startScreencast', { format: 'jpeg', quality: Number(process.env.Q || 80), maxWidth: Math.round(metrics.width * metrics.deviceScaleFactor), maxHeight: Math.round(metrics.height * metrics.deviceScaleFactor), everyNthFrame: 1 });
  const start = Date.now() / 1000;
  await sleep(600);
  await act();
  await sleep(800);
  await page('Page.stopScreencast');
  const end = Date.now() / 1000;
  listeners.delete(onFrame);
  writeFileSync(new URL('frames.json', dir), JSON.stringify({ start, end, frames }, null, 1));
  console.log(`recorded ${name}: ${frames.length} frames, ${(end - start).toFixed(1)} s`);
}

// Frame-exact recording on virtual time: the page clock stops, and each frame advances it by 1/30 s and takes a
// screenshot, so motion is perfectly even at 30 fps however slow capture is. `cue(k)` returns plain synchronous JS
// to run before frame k (a click, a scroll position), or nothing. Only for steps that do not wait on the network.
const FPS = 30, ease = x => x < 0.5 ? 4 * x ** 3 : 1 - (-2 * x + 2) ** 3 / 2;
async function film(name, seconds, cue = () => '') {
  const dir = new URL(`./${name}/`, OUT); rmSync(dir, { recursive: true, force: true }); mkdirSync(dir, { recursive: true });
  const frames = [], total = Math.round(seconds * FPS);
  await page('Emulation.setVirtualTimePolicy', { policy: 'pause' });
  for (let k = 0; k < total; k++) {
    const code = cue(k); if (code) await page('Runtime.evaluate', { expression: `(() => { ${code} })()` });
    const expired = new Promise(resolve => { const on = msg => { if (msg.method === 'Emulation.virtualTimeBudgetExpired') { listeners.delete(on); resolve(); } }; listeners.add(on); });
    await page('Emulation.setVirtualTimePolicy', { policy: 'advance', budget: 1000 / FPS }); await expired;
    const { data } = await page('Page.captureScreenshot', { format: 'jpeg', quality: 92 });
    const file = `${String(k).padStart(5, '0')}.jpg`; writeFileSync(new URL(file, dir), Buffer.from(data, 'base64')); frames.push({ file, t: k / FPS });
  }
  await page('Emulation.setVirtualTimePolicy', { policy: 'advance' });
  writeFileSync(new URL('frames.json', dir), JSON.stringify({ start: 0, end: total / FPS, frames }, null, 1));
  console.log(`filmed ${name}: ${total} frames, ${seconds} s`);
}
// Run sync JS at given seconds: timeline([[1.2, code], ...]).
const timeline = list => k => list.filter(([sec]) => Math.round(sec * FPS) === k).map(([, code]) => code).join(' ');
const tap = text => `[...document.querySelectorAll('main button')].find(b => b.textContent.trim().startsWith(${JSON.stringify(text)}))?.click();`;
const tapSel = sel => `document.querySelector(${JSON.stringify(sel)})?.click();`;
// Scroll by `px` between seconds a and b with ease-in-out.
const scrollCue = (from, px, a, b) => k => { const t = k / FPS; return t >= a && t <= b + 1 / FPS ? `window.scrollTo(0, ${(from + px * ease(Math.min(1, (t - a) / (b - a)))).toFixed(1)});` : ''; };

// Test data: a registered test user, English starter cards, a few reviews, sample square posts.
await go(`${BASE}/welcome`);
await run(`
  const base = '/fake-supabase', key = 'sb_publishable_fake_test_only';
  const call = async (path, body, token) => { const r = await fetch(base + path, { method: 'POST', headers: { apikey: key, Authorization: 'Bearer ' + (token || key), 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); const t = await r.text(); return t ? JSON.parse(t) : null; };
  const signup = async (email, username) => { await call('/auth/v1/otp', { email, create_user: true }); const s = await call('/auth/v1/verify', { email, token: '123456', type: 'email' }); await call('/rest/v1/rpc/complete_registration', { username, email, phone: null, region: 'MY', birthdate: '1995-05-05', policy_version: '2026-11' }, s.access_token); return s; };
  const s = await signup('mia@example.test', 'MiaChen');
  const feed = await call('/rest/v1/rpc/square_feed', { before_at: null, max_rows: 20 });
  if (!Array.isArray(feed) || feed.length < 3) {
    const posts = [['yuki@example.test', 'Yuki', 'ja', 'エビングハウスの忘却曲線を知って、復習のタイミングが大事だとわかりました。毎日少しずつ続けます！', 'english'],
      ['lucia@example.test', 'Lucía', 'es', '¿Algún consejo para recordar los verbos irregulares en inglés? Llevo una semana repasando cada día.', 'english'],
      ['sam@example.test', 'Sam', 'en', 'Finally understood closures: a function remembers the variables from where it was created. The counter example made it click.', 'coding']];
    for (const [email, username, lang, body, module] of posts) { const u = await signup(email, username); await call('/rest/v1/rpc/square_post', { body, lang, module }, u.access_token); }
  }
  const { starterCards } = await import('/starter-content.js');
  const now = new Date(), cards = ['coding', 'english', 'work', 'life'].flatMap(m => starterCards(m, 'en', now));
  const events = [['understood', 3], ['mastered', 16], ['understood', 3]].map(([rating, interval], i) => ({ id: crypto.randomUUID(), cardId: cards[i].id, at: new Date(now - (3 - i) * 60000).toISOString(), answer: '', correct: true, explanation: '', rating, interval, due: new Date(now.getTime() + interval * 86400000).toISOString(), seconds: 12 }));
  const set = (k, v) => localStorage.setItem('knowledge-review.' + k, typeof v === 'string' ? v : JSON.stringify(v));
  for (const [k, v] of Object.entries({ 'locale.v1': 'en', 'theme.v1': 'light', 'onboarding.v1': '1', 'tour.v1': '1', 'free-consent.v1': '1', 'photo-notice.v1': '1', 'recommend-region.v1': 'global', 'last-login.v1': 'email' })) set(k, v);
  set('session.v1', { access_token: s.access_token, refresh_token: s.refresh_token, expires_at: Date.now() + 3500000, user: s.user });
  set('local-owner.v1', { version: 1, url: location.origin + base, userId: s.user.id, label: 'MiaChen', boundAt: now.toISOString() });
  set('profile.v1', { version: 1, locale: 'en', dailyMinutes: 10, dailyGoal: 10, modules: { coding: { enabled: true, level: 'beginner' }, english: { enabled: true, level: 'beginner' }, work: { enabled: true, level: 'beginner' }, life: { enabled: true, level: 'beginner' } }, adultVerification: { isAdult: true, verifiedAt: now.toISOString(), method: 'server-birthdate' } });
  set('background.v1', { choice: 'none', opacity: 60, blur: 0, fit: 'cover', position: 'center' });
  set('model.v1', { version: 1, provider: 'zhipu-free', model: 'glm-4-flash-250414', workspace: '', search: false });
  set('knowledge.v1', { version: 1, cards, ignored: [] });
  set('reviews.v1', { version: 1, events });
  return true;
`);

const wait = ms => `await new Promise(r => setTimeout(r, ${ms}));`;
const clickSel = sel => `document.querySelector(${JSON.stringify(sel)})?.click(); ${wait(700)}`;
const clickText = text => `[...document.querySelectorAll('main button, .language-dialog button')].find(b => b.textContent.trim().startsWith(${JSON.stringify(text)}))?.click(); ${wait(700)}`;
async function typeSlowly(text, delay = 55) { for (const ch of text) { await page('Input.insertText', { text: ch }); await sleep(delay + Math.random() * 40); } }
async function smoothScroll(px, ms) { const steps = Math.round(ms / 16); for (let i = 0; i < steps; i++) { await run(`window.scrollBy(0, ${(px / steps).toFixed(2)});`); await sleep(16); } }
const waitFor = (expr, timeout = 45000) => run(`const t0 = Date.now(); while (!(${expr}) && Date.now() - t0 < ${timeout}) await new Promise(r => setTimeout(r, 200)); return Boolean(${expr});`);

// The graph's first layout: saved positions are cleared, then opening the tab lets the nodes settle from scratch.
async function graphClip(name, metrics, url, libraryButton) {
  await page('Emulation.setDeviceMetricsOverride', metrics); await go(url);
  await run(clickSel(libraryButton) + clickSel('[data-library-tab="graph"]') + wait(1500) + clickSel('#graph-reset') + wait(800) + clickSel('[data-library-tab="cards"]') + 'window.scrollTo(0, 0);');
  await film(name, 6.5, timeline([[0.4, tapSel('[data-library-tab="graph"]')], [0.45, `document.querySelector('#graph-host')?.scrollIntoView({ block: 'center' });`]]));
}
const CLIPS = {
  // Ask a question in Everyday knowledge, the real answer arrives, then the knowledge card is made.
  async 'r1-ask-phone'() {
    await page('Emulation.setDeviceMetricsOverride', PHONE); await go(`${BASE}/m/`);
    await run(clickSel('[data-open-module="life"]') + wait(600));
    await record('r1-ask-phone', PHONE, async () => {
      await run(`document.querySelector('#question')?.focus();`); await sleep(400);
      await typeSlowly('Why do we forget what we learn?');
      await sleep(500);
      await run(`document.querySelector('#question-form')?.requestSubmit();`);
      const answered = await waitFor(`[...document.querySelectorAll('main .message.assistant, main [data-role="assistant"], main article')].some(e => e.textContent.length > 200) || document.querySelector('main')?.innerText.length > 1200`, 60000);
      await sleep(2500); await smoothScroll(700, 2500); await sleep(2000);
      console.log('answer arrived:', answered);
    });
  },
  // Knowledge cards: a slow scroll through the library.
  async 'r2-cards-phone'() {
    await page('Emulation.setDeviceMetricsOverride', PHONE); await go(`${BASE}/m/`);
    await run(clickSel('[data-tab="library"]'));
    await run(`{ const h = [...document.querySelectorAll('main h2, main h3, main strong')].find(e => e.textContent.trim() === 'Variables'); h?.scrollIntoView({ block: 'start' }); window.scrollBy(0, -140); }`); await sleep(500);
    const y = await run('return window.scrollY;');
    await film('r2-cards-phone', 6.5, scrollCue(y, 1100, 0.8, 5.6));
  },
  // Flashcard review: recall, reveal the answer, rate "Got it", next card.
  async 'r3-review-phone'() {
    await page('Emulation.setDeviceMetricsOverride', PHONE); await go(`${BASE}/m/`);
    await run(clickSel('[data-tab="review"]') + `{ const s = [...document.querySelectorAll('main select')].find(x => [...x.options].some(o => o.value === 'flip')); if (s) { s.value = 'flip'; s.dispatchEvent(new Event('change', { bubbles: true })); } } ${wait(500)}` + clickText('Extra practice') + clickText('Start review'));
    await run('window.scrollTo(0, 0);');
    await film('r3-review-phone', 9, timeline([[1.6, tap('Show answer')], [3.8, tap('Got it')], [5.4, tap('Show answer')], [7.2, tap('Easy')]]));
  },
  // Knowledge graph settling into place after Reset layout (phone and desktop).
  async 'r4-graph-phone'() { await graphClip('r4-graph-phone', PHONE, `${BASE}/m/`, '[data-tab="library"]'); },
  async 'r4-graph-desktop'() { await graphClip('r4-graph-desktop', DESKTOP, `${BASE}/?desktop`, '.app-nav [data-library]'); },
  // Learning square: a Japanese post translated into English by the real model.
  async 'r5-square-phone'() {
    await page('Emulation.setDeviceMetricsOverride', PHONE); await go(`${BASE}/m/`);
    await run(clickSel('[data-tab="discover"]') + clickSel('[data-discover-tab="square"]') + wait(1500) + `{ const p = [...document.querySelectorAll('.square-post')].find(x => x.textContent.includes('Yuki')); p?.scrollIntoView({ block: 'center' }); }`); await sleep(600);
    await record('r5-square-phone', PHONE, async () => {
      await sleep(1200);
      await run(`[...document.querySelectorAll('.square-post')].find(x => x.textContent.includes('Yuki'))?.querySelector('[data-square-translate]')?.click();`);
      await waitFor(`[...document.querySelectorAll('.square-post')].some(x => x.textContent.includes('Machine-translated'))`, 30000); await sleep(2500);
    });
  },
  // Interface language: switch English → 日本語 → Español → Deutsch from the language dialog.
  async 'r6-languages-phone'() {
    await page('Emulation.setDeviceMetricsOverride', PHONE); await go(`${BASE}/m/`);
    await record('r6-languages-phone', PHONE, async () => {
      for (const name of ['日本語', 'Español', 'Deutsch', 'English']) {
        await sleep(900);
        await run(`document.querySelector('[data-tab="me"]')?.click(); ${wait(600)} document.querySelector('#language')?.click(); ${wait(800)}`);
        await run(`document.querySelector('.language-dialog [data-locale="${{ '日本語': 'ja', 'Español': 'es', 'Deutsch': 'de', 'English': 'en' }[name]}"]')?.click(); ${wait(1200)} document.querySelector('[data-tab="home"]')?.click();`);
        await sleep(1300);
      }
    });
  },
};
const wanted = process.argv.slice(2);
for (const [name, clip] of Object.entries(CLIPS)) if (!wanted.length || wanted.includes(name)) { try { await clip(); } catch (error) { console.log(`clip ${name} failed: ${error.message}`); } }
await send('Browser.close').catch(() => {}); ws.close(); chrome.kill(); await sleep(500);
try { rmSync(profile, { recursive: true, force: true }); } catch { /* Temp profile; Windows may hold a lock. */ }
