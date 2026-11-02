import test from 'node:test';
import assert from 'node:assert/strict';
import { createFreeQuota, FREE_LIMITS, FREE_BURST, chinaDay } from '../free-quota.mjs';
import { createApp } from '../server.mjs';
import { ServiceError } from '../model-service.mjs';

test('local free allowance: counts per IP and day, refunds, burst limit', async () => {
  let clock = new Date('2026-11-02T03:00:00Z');
  const quota = createFreeQuota({ now: () => clock });
  for (let i = 0; i < FREE_LIMITS.local.ask; i++) assert.equal((await quota.use({ ip: 'a', action: 'consume', kind: 'ask' })).allowed, true);
  assert.equal((await quota.use({ ip: 'a', action: 'consume', kind: 'ask' })).allowed, false, 'local mode stops at its daily limit');
  assert.equal((await quota.use({ ip: 'b', action: 'consume', kind: 'ask' })).allowed, true, 'another network has its own allowance');
  await quota.use({ ip: 'a', action: 'refund', kind: 'ask' });
  assert.equal((await quota.use({ ip: 'a', action: 'status' })).ask.used, FREE_LIMITS.local.ask - 1, 'a failed call is refunded');
  clock = new Date('2026-11-02T17:00:00Z'); // 01:00 next day in China
  assert.equal(chinaDay(clock), '2026-11-03');
  assert.equal((await quota.use({ ip: 'a', action: 'status' })).ask.used, 0, 'the allowance resets on the next China day');
  for (let i = 0; i < FREE_BURST.requests; i++) assert.equal(quota.burst('c'), true);
  assert.equal(quota.burst('c'), false, 'bursts are limited per IP');
});

async function serve(options) {
  const server = createApp(options); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const post = (path, body) => fetch(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(async response => ({ status: response.status, data: await response.json() }));
  return { server, base, post };
}
const freeInput = { config: { version: 1, provider: 'zhipu-free', model: 'glm-4-flash-250414', workspace: '', search: false }, apiKey: '', consent: true, module: 'coding', level: 'beginner', locale: 'zh', messages: [{ role: 'user', content: '闭包是什么' }] };

test('server free allowance: server key, local limit, refunds and unsupported features', async () => {
  const keys = [];
  let fail = false;
  const { server, base, post } = await serve({ freeModelKey: 'server-free-key', publicConfig: () => ({}),
    modelCaller: async input => { keys.push(input.apiKey); if (fail) throw new ServiceError('upstream', 502); return { content: 'ok' }; } });
  try {
    assert.equal((await fetch(`${base}/api/public-config`).then(r => r.json())).freeModel, true);
    fail = true; assert.equal((await post('/api/chat', { ...freeInput, apiKey: 'client-key-ignored' })).status, 502);
    fail = false;
    for (let i = 0; i < FREE_LIMITS.local.ask; i++) assert.equal((await post('/api/chat', freeInput)).status, 200, `call ${i + 1} is within the allowance (the failed one was refunded)`);
    const over = await post('/api/chat', freeInput);
    assert.deepEqual([over.status, over.data.error], [429, 'free-limit-local']);
    assert.ok(keys.every(key => key === 'server-free-key'), 'the server key is always used, never one from the client');
    assert.deepEqual((await post('/api/mindmap', freeInput)).data, { error: 'free-unsupported' });
    const state = await fetch(`${base}/api/free-quota`).then(r => r.json());
    assert.deepEqual([state.signedIn, state.ask.used, state.ask.limit], [false, FREE_LIMITS.local.ask, FREE_LIMITS.local.ask]);
  } finally { server.close(); }
  const off = await serve({ freeModelKey: '', publicConfig: () => ({}) });
  try { assert.deepEqual((await off.post('/api/chat', freeInput)).data, { error: 'free-unavailable' }); assert.equal((await fetch(`${off.base}/api/public-config`).then(r => r.json())).freeModel, undefined); }
  finally { off.server.close(); }
});
