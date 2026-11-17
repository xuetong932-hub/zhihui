import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { readFileSync } from 'node:fs';
import { createApp } from '../server.mjs';
import { vapidKeys } from '../webpush.mjs';
import { pushSettingsFromEnv, runPushTick } from '../push-service.mjs';

const keys = vapidKeys(), secret = 'x'.repeat(40);
const env = { VAPID_PUBLIC_KEY: keys.publicKey, VAPID_PRIVATE_KEY: keys.privateKey, VAPID_SUBJECT: 'mailto:ops@example.com', PUSH_SECRET: secret };
const account = { url: 'https://abc.supabase.co', publicKey: 'sb_publishable_test' };

test('push settings need a valid key pair, contact and a long secret', () => {
  assert.ok(pushSettingsFromEnv(env));
  assert.equal(pushSettingsFromEnv({ ...env, PUSH_SECRET: 'short' }), null);
  assert.equal(pushSettingsFromEnv({ ...env, VAPID_SUBJECT: 'ops' }), null);
  assert.equal(pushSettingsFromEnv({}), null);
});

test('push tick: sends each due reminder in its language and reports lines and gone subscriptions', async () => {
  const calls = [], sent = [];
  const fetchImpl = async (url, options) => {
    const body = JSON.parse(options.body); calls.push([url.split('/rpc/')[1], body]);
    if (url.endsWith('push_take_due')) return new Response(JSON.stringify([
      { endpoint: 'https://fcm.googleapis.com/a', p256dh: 'k', auth: 'a', locale: 'de', last_line: 0, kind: 'morning', n: 3, d: 0 },
      { endpoint: 'https://fcm.googleapis.com/b', p256dh: 'k', auth: 'a', locale: 'zh', last_line: -1, kind: 'streak', n: 2, d: 5 },
    ]), { status: 200 });
    return new Response(null, { status: 204 });
  };
  const send = async (sub, payload) => { sent.push([sub.endpoint, payload]); return sub.endpoint.endsWith('b') ? { ok: false, gone: true } : { ok: true, gone: false }; };
  const result = await runPushTick({ account, push: pushSettingsFromEnv(env), fetchImpl, send });
  assert.deepEqual(result, { due: 2, sent: 1, gone: 1 });
  assert.equal(calls[0][1].secret, secret);
  assert.match(sent[1][1].body, /5/); assert.equal(sent[1][1].title, '小回');
  const after = calls.find(([name]) => name === 'push_after')[1].results;
  assert.notEqual(after[0].line, 0, 'never the same line twice in a row');
  assert.equal(after[1].gone, true);
});

test('push routes: public key only with an account service, tick only with the secret', async () => {
  let ticks = 0;
  const app = createApp({ publicConfig: () => account, push: pushSettingsFromEnv(env), pushTick: async () => { ticks++; return { due: 0, sent: 0, gone: 0 }; } });
  app.listen(0, '127.0.0.1'); await once(app, 'listening');
  const origin = `http://127.0.0.1:${app.address().port}`;
  try {
    assert.equal((await (await fetch(origin + '/api/push/key')).json()).publicKey, keys.publicKey);
    assert.equal((await fetch(origin + '/api/push/tick', { method: 'POST' })).status, 403);
    assert.equal((await fetch(origin + '/api/push/tick', { method: 'POST', headers: { 'x-push-secret': 'y'.repeat(40) } })).status, 403);
    assert.equal(ticks, 0);
    assert.equal((await fetch(origin + '/api/push/tick', { method: 'POST', headers: { 'x-push-secret': secret } })).status, 200);
    assert.equal(ticks, 1);
  } finally { app.close(); }
  const off = createApp({ publicConfig: () => account, push: null });
  off.listen(0, '127.0.0.1'); await once(off, 'listening');
  try { assert.equal((await fetch(`http://127.0.0.1:${off.address().port}/api/push/key`)).status, 503); } finally { off.close(); }
});

test('push SQL: closed tables, secret-checked server functions', () => {
  const sql = readFileSync(new URL('../cloud-schema.sql', import.meta.url), 'utf8');
  assert.match(sql, /revoke all on public\.push_subscriptions, public\.push_config from anon, authenticated/);
  for (const name of ['push_take_due', 'push_after']) assert.match(sql, new RegExp(`function public\\.${name}[\\s\\S]*?if not public\\.push_secret_ok\\(secret\\) then raise exception 'denied'`));
  assert.doesNotMatch(sql.split('grant execute on function public.push_register')[1].split(';')[0], /push_secret_ok/);
});
