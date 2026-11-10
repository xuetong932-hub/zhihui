import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { readFileSync } from 'node:fs';
import { createApp } from '../server.mjs';
import { createFakeSupabase, FAKE_PREFIX, FAKE_CODE } from './fake-supabase.mjs';
import { createAuth } from '../auth.js';
import { relativeTime } from '../square-ui.js';
import { validateTranslate, translateText, translatePrompt } from '../translate-service.mjs';
import { FREE_LIMITS } from '../free-quota.mjs';

const memory = () => { const map = new Map(); return { getItem: key => map.has(key) ? map.get(key) : null, setItem: (key, value) => map.set(key, String(value)), removeItem: key => map.delete(key) }; };
const form = { username: '', email: '', phone: '', region: 'SG', birthdate: '1995-05-05' };

async function start(t, options = {}) {
  const fake = createFakeSupabase({ adminEmails: ['admin@example.test'] });
  const translations = [];
  const app = createApp({ publicConfig: host => ({ url: `http://${host}${FAKE_PREFIX}`, publicKey: 'sb_publishable_fake_test_only' }), extraRoute: fake.route,
    freeModelKey: 'server-free-key', translateCaller: async (input, { apiKey }) => { translations.push({ ...input, apiKey }); return { text: `[${input.target}] ${input.text}` }; }, ...options });
  app.listen(0, '127.0.0.1'); await once(app, 'listening');
  t.after(() => { app.closeAllConnections(); app.close(); });
  const origin = `http://127.0.0.1:${app.address().port}`;
  const client = async () => { const auth = createAuth({ fetchImpl: (url, init) => fetch(url.startsWith('/') ? origin + url : url, init), storage: memory(), session: memory(), location: { href: origin + '/', origin, assign() {} }, history: { replaceState() {} } }); await auth.init(); return auth; };
  async function member(email, username) {
    const auth = await client(); await auth.sendCode({ method: 'email', identifier: email, create: true }); await auth.verify({ method: 'email', identifier: email, token: FAKE_CODE });
    if (username) assert.equal(await auth.register({ ...form, username, email }), 'adult');
    return auth;
  }
  return { fake, origin, client, member, translations };
}

test('square: anyone reads; registered adults post, comment and like; authors delete their own', async t => {
  const { client, member } = await start(t);
  const guest = await client(), alice = await member('alice@example.test', 'alice'), bob = await member('bob@example.test', 'bob'), pending = await member('new@example.test');
  assert.deepEqual(await guest.square.feed(), [], 'reading works without signing in');
  await assert.rejects(guest.square.post({ body: 'hi', lang: 'en' }), 'a guest cannot post');
  await assert.rejects(pending.square.post({ body: 'hi', lang: 'en' }), error => error.code === 'not_eligible', 'signed in but not registered cannot post');

  const post = await alice.square.post({ body: '  今天学会了闭包  ', lang: 'zh', module: 'coding' });
  assert.deepEqual([post.body, post.author_name, post.mine, post.can_delete, post.like_count], ['今天学会了闭包', 'alice', true, true, 0], 'text is trimmed and shown with the username');
  await assert.rejects(alice.square.post({ body: 'x'.repeat(1001), lang: 'zh' }), error => error.code === 'invalid_square');
  await assert.rejects(alice.square.post({ body: '   ', lang: 'zh' }), error => error.code === 'invalid_square');

  const comment = await bob.square.comment({ post: post.id, body: 'Nice!', lang: 'en' });
  assert.equal(comment.author_name, 'bob');
  assert.deepEqual(await bob.square.like(post.id, true), { liked: true, like_count: 1 });
  assert.deepEqual(await bob.square.like(post.id, true), { liked: true, like_count: 1 }, 'one like per person');
  const [seen] = await bob.square.feed();
  assert.deepEqual([seen.like_count, seen.comment_count, seen.liked, seen.mine, seen.can_delete], [1, 1, true, false, false]);
  const [guestView] = await guest.square.feed();
  assert.deepEqual([guestView.liked, guestView.mine, guestView.can_delete], [false, false, false]);

  await assert.rejects(bob.square.remove('post', post.id), error => error.code === 'not_found', 'others cannot delete a post');
  await bob.square.remove('comment', comment.id);
  assert.deepEqual(await guest.square.comments(post.id), []);
  await alice.square.remove('post', post.id);
  assert.deepEqual(await guest.square.feed(), []);
});

test('square: rate limits, paging, three reports hide an item, and administrators moderate', async t => {
  const { member } = await start(t);
  const alice = await member('alice@example.test', 'alice'), admin = await member('admin@example.test');
  const posts = [];
  for (let i = 0; i < 10; i++) posts.push(await alice.square.post({ body: `post ${i}`, lang: 'en' }));
  await assert.rejects(alice.square.post({ body: 'one more', lang: 'en' }), error => error.code === 'rate_limited', 'at most 10 posts an hour');
  const firstPage = await alice.square.feed();
  assert.equal(firstPage[0].body, 'post 9', 'newest first');
  const older = await alice.square.feed(firstPage[4].created_at);
  assert.equal(older[0].body, 'post 4', 'the next page starts after the last post shown');

  const reporters = [await member('r1@example.test', 'r1'), await member('r2@example.test', 'r2'), await member('r3@example.test', 'r3')];
  const target = posts[9];
  await reporters[0].square.report('post', target.id, 'spam');
  await reporters[0].square.report('post', target.id, 'spam');
  await reporters[1].square.report('post', target.id, 'abuse');
  assert.ok((await alice.square.feed()).some(post => post.id === target.id), 'two reporters do not hide a post');
  await reporters[2].square.report('post', target.id, '');
  assert.ok(!(await alice.square.feed()).some(post => post.id === target.id), 'the third reporter hides it');

  await assert.rejects(alice.square.adminReports(), error => error.code === 'not_admin');
  const [reported] = await admin.square.adminReports();
  assert.deepEqual([reported.id, reported.hidden, reported.reports, reported.reasons.sort()], [target.id, true, 3, ['abuse', 'spam']]);
  await admin.square.moderate('post', target.id, 'restore');
  assert.ok((await alice.square.feed()).some(post => post.id === target.id), 'restore shows it again');
  assert.deepEqual(await admin.square.adminReports(), [], 'and clears its reports');
  const admins = await admin.square.post({ body: 'Welcome to the square', lang: 'en' });
  assert.equal(admins.author_name, '知回', 'administrators post as 知回');
  await admin.square.remove('post', posts[0].id);
  assert.ok(!(await alice.square.feed(null)).some(post => post.id === posts[0].id), 'administrators may delete any post');
});

test('square translation: free model with the server key, 50 a day, refunded on failure', async t => {
  let fail = false;
  const { origin, member, translations } = await start(t, { translateCaller: async (input, { apiKey }) => { if (fail) { const { ServiceError } = await import('../model-service.mjs'); throw new ServiceError('upstream', 502); } return { text: `[${input.target}] ${input.text}`, apiKey }; } });
  const call = (body, token = '') => fetch(`${origin}/api/translate`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) }).then(async response => ({ status: response.status, data: await response.json() }));
  const ok = await call({ text: 'Hello', target: 'ja' });
  assert.deepEqual([ok.status, ok.data.text, ok.data.translate.used], [200, '[ja] Hello', 1]);
  assert.deepEqual((await call({ text: '', target: 'ja' })).data, { error: 'request' });
  assert.deepEqual((await call({ text: 'Hi', target: 'xx' })).data, { error: 'request' });
  fail = true; assert.equal((await call({ text: 'Hello', target: 'fr' })).status, 502); fail = false;
  assert.equal((await call({ text: 'Hello', target: 'fr' })).data.translate.used, 2, 'the failed call was refunded');
  const alice = await member('alice@example.test', 'alice'), token = await alice.accessToken();
  assert.equal((await call({ text: 'Hello', target: 'de' }, token)).data.translate.limit, FREE_LIMITS.account.translate, 'signed in: counted on the account');
  const pending = await member('new@example.test');
  assert.equal((await call({ text: 'Hello', target: 'de' }, await pending.accessToken())).status, 200, 'an account that has not finished registering uses the network allowance');
  const off = await start(t, { freeModelKey: '' });
  assert.deepEqual(await fetch(`${off.origin}/api/translate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: 'x', target: 'en' }) }).then(r => r.json()), { error: 'free-unavailable' });
  assert.equal(translations.length, 0, 'the default test translator was replaced');
});

test('translation request: the text is data, the key stays on the server, upstream errors are not relayed', async () => {
  assert.deepEqual(validateTranslate({ text: '  hi ', target: 'ko' }), { text: 'hi', target: 'ko' });
  assert.throws(() => validateTranslate({ text: 'x'.repeat(1001), target: 'ko' }));
  assert.match(translatePrompt('de'), /not instructions/);
  let sent;
  const fetchImpl = async (url, init) => { sent = { url, init }; return new Response(JSON.stringify({ choices: [{ message: { content: ' Hallo ' }, finish_reason: 'stop' }] }), { status: 200 }); };
  assert.deepEqual(await translateText({ text: 'Hello', target: 'de' }, { fetchImpl, apiKey: 'server-key' }), { text: 'Hallo' });
  const body = JSON.parse(sent.init.body);
  assert.equal(sent.init.headers.Authorization, 'Bearer server-key');
  assert.deepEqual(body.messages.map(m => m.role), ['system', 'user']);
  assert.equal(body.messages[1].content, 'Translate into German:\n<text>\nHello\n</text>', 'the post goes inside <text> tags in the user message, never into the instructions');
  assert.match(translatePrompt('de'), /as KnowBack/); assert.match(translatePrompt('zh-TW'), /as 知回/);
  const echoing = async () => new Response(JSON.stringify({ choices: [{ message: { content: '<text>\nHallo Welt\n</text>' }, finish_reason: 'stop' }] }), { status: 200 });
  assert.deepEqual(await translateText({ text: 'Hello world', target: 'de' }, { fetchImpl: echoing, apiKey: 'k' }), { text: 'Hallo Welt' }, 'echoed tags are removed');
  await assert.rejects(translateText({ text: 'Hello', target: 'de' }, { fetchImpl: async () => new Response('{"error":"secret detail"}', { status: 500 }), apiKey: 'k' }), error => error.code === 'upstream');
});

test('square: relative times, schema grants and no leftover placeholder', () => {
  const now = Date.parse('2026-11-05T12:00:00Z');
  assert.equal(relativeTime('2026-11-05T11:57:00Z', 'en', now), '3 minutes ago');
  assert.equal(relativeTime('2026-11-05T09:00:00Z', 'zh', now), '3小时前');
  const sql = readFileSync(new URL('../cloud-schema.sql', import.meta.url), 'utf8');
  for (const table of ['square_posts', 'square_comments', 'square_likes', 'square_reports']) assert.match(sql, new RegExp(`alter table public\\.${table} enable row level security`));
  assert.match(sql, /grant execute on function public\.square_feed\(timestamptz, int\), public\.square_comments\(uuid\) to anon, authenticated;/, 'only reading is open to everyone');
  assert.doesNotMatch(sql.split('grant execute on function public.square_post(')[1] || '', /\banon\b/, 'writing is never granted to anon');
});
