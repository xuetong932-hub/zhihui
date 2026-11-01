import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { request as httpRequest } from 'node:http';
import { createApp } from '../server.mjs';
import { ServiceError } from '../model-service.mjs';

test('HTTP routes enforce same origin, JSON and sanitized responses', async t => {
  const calls = [];
  const app = createApp({ modelCaller: async input => {
    calls.push(input);
    if (input.fail) throw new ServiceError('unauthorized', 401);
    return { content: 'controlled test answer', sources: [], searchStatus: 'off' };
  } });
  app.listen(0, '127.0.0.1'); await once(app, 'listening');
  t.after(() => { app.closeAllConnections(); app.close(); });
  const origin = `http://127.0.0.1:${app.address().port}`;
  const post = (path, body, headers = {}) => fetch(origin + path, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });
  const page = await fetch(origin);
  assert.equal(page.status, 200);
  assert.match(page.headers.get('content-security-policy'), /connect-src 'self'/);
  assert.equal((await fetch(origin + '/model-service.mjs')).status, 404);
  assert.equal((await fetch(origin + '/.env')).status, 404);
  assert.equal((await post('/api/chat', {}, { Origin: 'https://foreign.example' })).status, 403);
  const foreignHostStatus = await new Promise((resolve, reject) => {
    const request = httpRequest(origin + '/api/chat', { method: 'POST', headers: { Host: 'evil.example', 'Content-Type': 'application/json' } }, response => { response.resume(); resolve(response.statusCode); });
    request.on('error', reject); request.end('{}');
  });
  assert.equal(foreignHostStatus, 403);
  assert.equal((await post('/api/chat', {}, { 'Content-Type': 'text/plain' })).status, 415);
  assert.equal(calls.length, 0);
  const response = await post('/api/chat', { marker: 'isolated' }, { Origin: origin });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).content, 'controlled test answer');
  const failure = await post('/api/chat', { fail: true });
  assert.equal(failure.status, 401);
  assert.deepEqual(await failure.json(), { error: 'unauthorized' });
  await post('/api/test', { config: { search: true }, messages: [{ role: 'user', content: 'must not be sent' }] });
  assert.equal(calls.at(-1).config.search, false);
  assert.deepEqual(calls.at(-1).messages, [{ role: 'user', content: 'Reply only: OK' }]);
});
