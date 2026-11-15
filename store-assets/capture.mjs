// High-resolution screenshots of KnowBack for store posters, taken from the isolated QA server (tests/browser-fixture.mjs,
// http://localhost:4175) in a throwaway headless Chrome profile. Nothing here touches the live site or real accounts:
// it registers a test user on the fake account service, adds the English starter cards and a few flashcard reviews,
// then captures six pages in a phone (390x844 @3x) and a desktop (1440x900 @2x) layout.
// Usage: node store-assets/capture.mjs [path-to-chrome]
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CHROME = process.argv[2] || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const BASE = 'http://localhost:4175', PORT = 9333, OUT = new URL(process.env.OUT_DIR ? './' + process.env.OUT_DIR + '/' : './screenshots/', import.meta.url);
// Optional: PHONE_H / DESKTOP_H change the viewport height to match a poster's screen; ONLY=01,03 limits the pages.
const PHONE_H = Number(process.env.PHONE_H) || 844, DESKTOP_H = Number(process.env.DESKTOP_H) || 900, ONLY = (process.env.ONLY || '').split(',').filter(Boolean);
mkdirSync(OUT, { recursive: true });
const profile = mkdtempSync(join(tmpdir(), 'knowback-shots-'));
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, '--hide-scrollbars', '--lang=en-US', '--accept-lang=en-US', '--no-first-run', '--no-default-browser-check', 'about:blank'], { stdio: 'ignore' });
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

let version;
for (let i = 0; i < 50 && !version; i++) { try { version = await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json(); } catch { await sleep(200); } }
const ws = new WebSocket(version.webSocketDebuggerUrl);
await new Promise(resolve => ws.addEventListener('open', resolve, { once: true }));
let seq = 0; const pending = new Map();
ws.addEventListener('message', event => { const msg = JSON.parse(event.data); if (msg.id && pending.has(msg.id)) { const { resolve, reject } = pending.get(msg.id); pending.delete(msg.id); msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result); } });
const send = (method, params = {}, sessionId) => new Promise((resolve, reject) => { const id = ++seq; pending.set(id, { resolve, reject }); ws.send(JSON.stringify({ id, method, params, sessionId })); });
const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
const page = (method, params) => send(method, params, sessionId);
await page('Page.enable'); await page('Runtime.enable');
const run = async code => { const result = await page('Runtime.evaluate', { expression: `(async () => { ${code} })()`, awaitPromise: true, returnByValue: true }); if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text); return result.result.value; };
const go = async url => { await page('Page.navigate', { url }); await sleep(2200); };

// 1. Test user, English starter cards and a few reviews (same shapes the app itself writes).
await go(`${BASE}/welcome`);
const setup = await run(`
  const base = '/fake-supabase', key = 'sb_publishable_fake_test_only', email = 'mia@example.test';
  const call = async (path, body, token) => { const r = await fetch(base + path, { method: 'POST', headers: { apikey: key, Authorization: 'Bearer ' + (token || key), 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); const t = await r.text(); return t ? JSON.parse(t) : null; };
  await call('/auth/v1/otp', { email, create_user: true });
  const s = await call('/auth/v1/verify', { email, token: '123456', type: 'email' });
  await call('/rest/v1/rpc/complete_registration', { username: 'MiaChen', email, phone: null, region: 'MY', birthdate: '1996-04-12', policy_version: '2026-11' }, s.access_token);
  const { starterCards } = await import('/starter-content.js');
  const now = new Date(), cards = ['coding', 'english', 'work', 'life'].flatMap(m => starterCards(m, 'en', now));
  const ratings = [['understood', 3], ['mastered', 16], ['understood', 3], ['unclear', 0], ['understood', 3], ['mastered', 16]];
  const events = ratings.map(([rating, interval], i) => ({ id: crypto.randomUUID(), cardId: cards[i].id, at: new Date(now - (6 - i) * 60000).toISOString(), answer: '', correct: rating !== 'unclear', explanation: '', rating, interval, due: new Date(now.getTime() + Math.max(interval, 0.007) * 86400000).toISOString(), seconds: 12 }));
  const set = (k, v) => localStorage.setItem('knowledge-review.' + k, typeof v === 'string' ? v : JSON.stringify(v));
  set('locale.v1', 'en'); set('theme.v1', 'light'); set('onboarding.v1', '1'); set('tour.v1', '1'); set('free-consent.v1', '1'); set('photo-notice.v1', '1'); set('recommend-region.v1', 'global'); set('last-login.v1', 'email');
  set('session.v1', { access_token: s.access_token, refresh_token: s.refresh_token, expires_at: Date.now() + 3500000, user: s.user });
  set('local-owner.v1', { version: 1, url: location.origin + base, userId: s.user.id, label: 'MiaChen', boundAt: now.toISOString() });
  set('profile.v1', { version: 1, locale: 'en', dailyMinutes: 10, dailyGoal: 10, modules: { coding: { enabled: true, level: 'beginner' }, english: { enabled: true, level: 'beginner' }, work: { enabled: true, level: 'beginner' }, life: { enabled: true, level: 'beginner' } }, adultVerification: { isAdult: true, verifiedAt: now.toISOString(), method: 'server-birthdate' } });
  set('background.v1', { choice: 'none', opacity: 60, blur: 0, fit: 'cover', position: 'center' });
  set('model.v1', { version: 1, provider: 'zhipu-free', model: 'glm-4-flash-250414', workspace: '', search: false });
  set('knowledge.v1', { version: 1, cards, ignored: [] });
  set('reviews.v1', { version: 1, events });
  return { user: s.user.id, cards: cards.length, events: events.length };
`);
console.log('test data', setup);

// Sample learning-square posts from three test users, once per test-service run (the fake service keeps them in memory).
const seeded = await run(`
  const base = '/fake-supabase', key = 'sb_publishable_fake_test_only';
  const call = async (path, body, token) => { const r = await fetch(base + path, { method: 'POST', headers: { apikey: key, Authorization: 'Bearer ' + (token || key), 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); const t = await r.text(); return t ? JSON.parse(t) : null; };
  const feed = await call('/rest/v1/rpc/square_feed', { before_at: null, max_rows: 20 });
  if (Array.isArray(feed) && feed.length >= 3) return 'already ' + feed.length;
  const people = [
    ['yuki@example.test', 'Yuki', 'ja', 'エビングハウスの忘却曲線を知って、復習のタイミングが大事だとわかりました。毎日少しずつ続けます！', 'english'],
    ['lucia@example.test', 'Lucía', 'es', '¿Algún consejo para recordar los verbos irregulares en inglés? Llevo una semana repasando cada día.', 'english'],
    ['sam@example.test', 'Sam', 'en', 'Finally understood closures: a function remembers the variables from where it was created. The counter example made it click.', 'coding'],
  ];
  const ids = [], tokens = [];
  for (const [email, username, lang, body, module] of people) {
    await call('/auth/v1/otp', { email, create_user: true });
    const s = await call('/auth/v1/verify', { email, token: '123456', type: 'email' });
    await call('/rest/v1/rpc/complete_registration', { username, email, phone: null, region: 'SG', birthdate: '1994-03-03', policy_version: '2026-11' }, s.access_token);
    const post = await call('/rest/v1/rpc/square_post', { body, lang, module }, s.access_token);
    ids.push(post?.id); tokens.push(s.access_token);
  }
  await call('/rest/v1/rpc/square_comment', { post: ids[2], body: 'Same here! The counter example is the best.', lang: 'en' }, tokens[1]);
  for (const t of tokens.slice(0, 2)) await call('/rest/v1/rpc/square_like', { post: ids[2], liked: true }, t);
  await call('/rest/v1/rpc/square_like', { post: ids[0], liked: true }, tokens[2]);
  return 'seeded ' + ids.filter(Boolean).length;
`);
console.log('square', seeded);

// 2. Pages: [name, phone steps, desktop steps]. Steps run in the page after it loads.
const click = sel => `document.querySelector(${JSON.stringify(sel)})?.click(); await new Promise(r => setTimeout(r, 900));`;
const clickText = text => `[...document.querySelectorAll('main button, main [role=tab], .language-dialog button')].find(b => b.textContent.trim().startsWith(${JSON.stringify(text)}))?.click(); await new Promise(r => setTimeout(r, 900));`;
const review = `${''}{ const sel = [...document.querySelectorAll('main select')].find(s => [...s.options].some(o => o.value === 'flip')); if (sel) { sel.value = 'flip'; sel.dispatchEvent(new Event('change', { bubbles: true })); } await new Promise(r => setTimeout(r, 500)); }
  ${clickText('Extra practice')} ${clickText('Start review')} ${clickText('Show answer')}`;
// Scroll an element near the top (cards list, graph canvas) so the poster shows content, not filters.
const scrollTo = (code, offset = 90) => `{ const el = ${code}; if (el) { el.scrollIntoView({ block: 'start' }); window.scrollBy(0, -${offset}); } await new Promise(r => setTimeout(r, 500)); }`;
const firstCard = scrollTo("[...document.querySelectorAll('main h2, main h3, main strong')].find(h => h.textContent.trim() === 'Variables')?.closest('article, section, .panel, div')", 120);
const graph = click('#graph-reset') + 'await new Promise(r => setTimeout(r, 4000));' + scrollTo("document.querySelector('#graph-host')", 70);
const PAGES = [
  ['01-home', '', ''],
  ['02-knowledge-cards', click('[data-tab="library"]') + firstCard, click('.app-nav [data-library]') + firstCard],
  ['03-review', click('[data-tab="review"]') + review, click('.app-nav [data-review]') + review],
  ['04-knowledge-graph', click('[data-tab="library"]') + clickText('Knowledge graph') + graph, click('.app-nav [data-library]') + clickText('Knowledge graph') + graph],
  ['05-learning-square', click('[data-tab="discover"]') + click('[data-discover-tab="square"]') + 'await new Promise(r => setTimeout(r, 1500));', click('.app-nav [data-square]') + 'await new Promise(r => setTimeout(r, 1500));'],
  ['06-languages', click('[data-tab="me"]') + `[...document.querySelectorAll('main button, main a')].find(b => /Language/.test(b.textContent))?.click(); await new Promise(r => setTimeout(r, 900));`, click('#language')],
];
const LAYOUTS = [
  ['phone', `${BASE}/m/`, { width: 390, height: PHONE_H, deviceScaleFactor: 3, mobile: true }],
  ['desktop', `${BASE}/?desktop`, { width: 1440, height: DESKTOP_H, deviceScaleFactor: 2, mobile: false }],
];
for (const [layout, url, metrics] of LAYOUTS) {
  await page('Emulation.setDeviceMetricsOverride', metrics);
  for (const [name, phoneSteps, desktopSteps] of PAGES.filter(([name]) => !ONLY.length || ONLY.some(prefix => name.startsWith(prefix)))) {
    await go(url);
    await run(`window.scrollTo(0, 0); ${layout === 'phone' ? phoneSteps : desktopSteps} await new Promise(r => setTimeout(r, 600));`);
    const shot = await page('Page.captureScreenshot', { format: 'png' });
    const file = new URL(`${name}-${layout}.png`, OUT);
    writeFileSync(file, Buffer.from(shot.data, 'base64'));
    console.log('saved', file.pathname.split('/').slice(-2).join('/'));
  }
}
await send('Browser.close').catch(() => {});
ws.close(); chrome.kill();
await sleep(500);
try { rmSync(profile, { recursive: true, force: true }); } catch { /* Temp profile; Windows may still hold a lock. */ }
