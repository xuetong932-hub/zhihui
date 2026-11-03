import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createApp, publicConfigFromEnv } from '../server.mjs';
import { createFakeSupabase, FAKE_PREFIX, FAKE_CODE } from './fake-supabase.mjs';
import { createAuth, registrationErrors, validUsername, validConfig, validBirthdate, SESSION_KEY } from '../auth.js';
import { replaceLearningData, bindOwner, canUndo, undoLastRestore, setAsideLocalData, readBackups, readOwner, PROFILE_KEY } from '../local-space.js';
import { CHAT_KEY } from '../chat-store.js';

const memory = () => { const map = new Map(); return { getItem: key => map.has(key) ? map.get(key) : null, setItem: (key, value) => map.set(key, String(value)), removeItem: key => map.delete(key), map }; };
const today = new Date(2026, 10, 1);
const form = { username: '学习者_1', email: 'a@example.test', phone: '', region: 'SG', birthdate: '2000-01-01', method: 'email' };

test('registration form rules: required fields, username characters and real birthdays', () => {
  assert.deepEqual(registrationErrors(form, today), {});
  assert.deepEqual(Object.keys(registrationErrors({ ...form, username: 'a b', region: 'XX', birthdate: '2026-02-30' }, today)).sort(), ['birthdate', 'region', 'username']);
  assert.equal(registrationErrors({ ...form, method: 'phone' }, today).phone, 'phone', 'the chosen verification contact is required');
  assert.deepEqual(registrationErrors({ ...form, phone: '+8613800000000' }, today), {}, 'an optional extra contact is accepted when valid');
  assert.equal(registrationErrors({ ...form, phone: '138' }, today).phone, 'phone');
  for (const name of ['ab', 'Learner_2026', '知回用户']) assert.equal(validUsername(name), true, name);
  for (const name of ['a', 'x'.repeat(21), 'has space', 'a@b', '<b>', 'tab\tname']) assert.equal(validUsername(name), false, name);
  assert.equal(validBirthdate('2026-11-02', today), false, 'future dates are rejected');
});

test('only hosted projects with a public key are accepted; loopback only when the server provides it', () => {
  assert.equal(validConfig({ url: 'https://abc.supabase.co', publicKey: 'sb_publishable_x1234567' }), true);
  assert.equal(validConfig({ url: 'https://abc.supabase.co', publicKey: 'sb_secret_x1234567' }), false);
  assert.equal(validConfig({ url: 'http://127.0.0.1:4175/fake-supabase', publicKey: 'sb_publishable_x1234567' }), false);
  assert.equal(validConfig({ url: 'http://127.0.0.1:4175/fake-supabase', publicKey: 'sb_publishable_x1234567' }, { fromServer: true }), true);
  assert.deepEqual(publicConfigFromEnv({}), {});
  assert.deepEqual(publicConfigFromEnv({ SUPABASE_URL: 'https://abc.supabase.co/', SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_x1234567' }), { url: 'https://abc.supabase.co', publicKey: 'sb_publishable_x1234567' });
  assert.deepEqual(publicConfigFromEnv({ SUPABASE_URL: 'https://abc.supabase.co', SUPABASE_PUBLISHABLE_KEY: 'sb_secret_x1234567' }), {}, 'a server secret is never exposed');
});

test('Google and Apple sign-in are offered only when the account service has them switched on', async t => {
  const start = async options => {
    const fake = createFakeSupabase(options);
    const app = createApp({ publicConfig: host => ({ url: `http://${host}${FAKE_PREFIX}`, publicKey: 'sb_publishable_fake_test_only' }), extraRoute: fake.route });
    app.listen(0, '127.0.0.1'); await once(app, 'listening');
    t.after(() => { app.closeAllConnections(); app.close(); });
    const origin = `http://127.0.0.1:${app.address().port}`;
    const auth = createAuth({ fetchImpl: (url, options) => fetch(url.startsWith('/') ? origin + url : url, options), storage: memory(), session: memory(), location: { href: origin + '/', origin, assign() {} }, history: { replaceState() {} } });
    await auth.init(); return auth.oauthProviders;
  };
  assert.deepEqual(await start(), []);
  assert.deepEqual(await start({ oauth: ['apple'] }), ['apple']);
  assert.deepEqual(await start({ oauth: ['google', 'apple'] }), ['google', 'apple']);
});

test('sign-up, the server age check, admin listing and session restore work end to end against the test service', async t => {
  const fake = createFakeSupabase({ adminEmails: ['admin@example.test'] });
  const app = createApp({ publicConfig: host => ({ url: `http://${host}${FAKE_PREFIX}`, publicKey: 'sb_publishable_fake_test_only' }), extraRoute: fake.route });
  app.listen(0, '127.0.0.1'); await once(app, 'listening');
  t.after(() => { app.closeAllConnections(); app.close(); });
  const origin = `http://127.0.0.1:${app.address().port}`;
  const client = storage => createAuth({ fetchImpl: (url, options) => fetch(url.startsWith('/') ? origin + url : url, options), storage, session: memory(), location: { href: origin + '/', origin, assign() {} }, history: { replaceState() {} } });
  async function signUp(storage, email) { const auth = client(storage); await auth.init(); await auth.sendCode({ method: 'email', identifier: email, create: true }); await auth.verify({ method: 'email', identifier: email, token: FAKE_CODE }); return auth; }

  const minorAuth = await signUp(memory(), 'minor@example.test');
  assert.equal((await minorAuth.account()).status, 'missing');
  assert.equal(await minorAuth.register({ ...form, username: 'young', email: 'minor@example.test', birthdate: '2015-01-01' }), 'denied');
  await assert.rejects(minorAuth.register({ ...form, username: 'young', email: 'minor@example.test', birthdate: '1990-01-01' }), error => error.code === 'denied', 'a denied account cannot retry another birthday');
  assert.deepEqual(await minorAuth.api(`/rest/v1/learning_snapshots?user_id=eq.${minorAuth.user.id}&select=revision`), [], 'no data access before passing the age check');

  const storage = memory(), userAuth = await signUp(storage, 'learner@example.test');
  assert.equal(await userAuth.register({ ...form, email: 'learner@example.test', phone: '+6581234567' }), 'adult');
  assert.deepEqual(await userAuth.account(), { status: 'adult', registered: true, username: '学习者_1', region: 'SG', is_admin: false });
  await assert.rejects(userAuth.adminUsers(), error => error.code === 'not_admin');
  await assert.rejects(client(memory()).init().then(async () => {}).then(() => (async () => { const other = await signUp(memory(), 'other@example.test'); return other.register({ ...form, username: '学习者_1', email: 'other@example.test' }); })()), error => error.code === 'username_taken');
  await assert.rejects((async () => { const auth = client(memory()); await auth.init(); return auth.sendCode({ method: 'email', identifier: 'nobody@example.test', create: false }); })(), error => error.status === 422, 'signing in does not create accounts');

  const adminAuth = await signUp(memory(), 'admin@example.test');
  await adminAuth.register({ ...form, username: 'admin', email: 'admin@example.test' });
  const rows = await adminAuth.adminUsers('学习');
  assert.equal(rows.length, 1);
  assert.deepEqual({ ...rows[0], registered_at: null, last_sign_in_at: null }, { username: '学习者_1', region: 'SG', email: 'le***@example.test', phone: '+65***4567', registered_at: null, last_sign_in_at: null, eligibility: 'adult' });
  assert.ok(!JSON.stringify(await adminAuth.adminUsers()).includes('2000-01-01'), 'birthdays are never listed');

  const stored = JSON.parse(storage.getItem(SESSION_KEY)), oldToken = stored.access_token;
  storage.setItem(SESSION_KEY, JSON.stringify({ ...stored, expires_at: Date.now() - 1000 }));
  const restored = client(storage); await restored.init();
  assert.notEqual(restored.session.access_token, oldToken, 'an expired session is refreshed on start');
  assert.equal((await restored.account()).username, '学习者_1');
  await restored.signOut(); assert.equal(storage.getItem(SESSION_KEY), null);
});

test('the administrator signs in with a username and password and needs no registration', async t => {
  const fake = createFakeSupabase({ seedAdmin: { email: 'ops@example.test', password: 'test-only-pass' } });
  const testAdmin = { email: 'ops@example.test', password: 'test-only-pass' };
  const app = createApp({ publicConfig: host => ({ url: `http://${host}${FAKE_PREFIX}`, publicKey: 'sb_publishable_fake_test_only', adminLogin: { username: 'TestAdmin', email: 'ops@example.test' } }), extraRoute: fake.route });
  app.listen(0, '127.0.0.1'); await once(app, 'listening');
  t.after(() => { app.closeAllConnections(); app.close(); });
  const origin = `http://127.0.0.1:${app.address().port}`;
  const auth = createAuth({ fetchImpl: (url, options) => fetch(url.startsWith('/') ? origin + url : url, options), storage: memory(), session: memory(), location: { href: origin + '/', origin, assign() {} }, history: { replaceState() {} } });
  await auth.init();
  assert.equal(auth.adminEmail(' testadmin '), 'ops@example.test', 'the username maps to the configured account, ignoring case and spaces');
  assert.equal(auth.adminEmail('someone'), null);
  await assert.rejects(auth.signInWithPassword({ email: 'ops@example.test', password: 'wrong' }), error => error.status === 400);
  await auth.signInWithPassword(testAdmin);
  const account = await auth.account();
  assert.equal(account.is_admin, true); assert.equal(account.registered, false, 'no registration details were required');
  assert.deepEqual(await auth.api(`/rest/v1/learning_snapshots?user_id=eq.${auth.user.id}&select=revision`), [], 'the administrator may use sync');
  // The server only publishes the username mapping, never a password.
  assert.deepEqual(publicConfigFromEnv({ SUPABASE_URL: 'https://abc.supabase.co', SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_x1234567', ADMIN_USERNAME: 'Ava', ADMIN_LOGIN_EMAIL: 'ava@example.com' }), { url: 'https://abc.supabase.co', publicKey: 'sb_publishable_x1234567', adminLogin: { username: 'Ava', email: 'ava@example.com' } });
});

test('with sign-in required, other accounts’ local records are set aside and only their owner can swap them back', () => {
  const storage = memory(), alice = { url: 'u', userId: 'alice', label: 'alice' }, bob = { url: 'u', userId: 'bob', label: 'bob' };
  storage.setItem(PROFILE_KEY, '{"version":1}'); storage.setItem(CHAT_KEY, JSON.stringify({ version: 1, modules: { coding: [{ id: 't', title: 'alice', messages: [{ id: 'm' }] }] } }));
  bindOwner(storage, alice);
  setAsideLocalData(storage, bob);
  assert.equal(storage.getItem(CHAT_KEY), null); assert.equal(readOwner(storage).userId, 'bob');
  assert.equal(readBackups(storage)[0].owner.userId, 'alice');
  assert.equal(canUndo(storage, bob), false);
  assert.throws(() => undoLastRestore(storage, new Date(), bob), error => error.code === 'other-owner');
  assert.equal(canUndo(storage, alice), true);
  undoLastRestore(storage, new Date(), alice);
  assert.equal(JSON.parse(storage.getItem(CHAT_KEY)).modules.coding[0].title, 'alice'); assert.equal(readOwner(storage).userId, 'alice');
  replaceLearningData(storage, {}, bob);
  assert.equal(canUndo(storage, bob), false, 'Bob still cannot reach Alice’s records after another replacement');
});
