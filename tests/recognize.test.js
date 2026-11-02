import test from 'node:test';
import assert from 'node:assert/strict';
import { validateRecognize, buildRecognize, extractRecognized, recognizeImage } from '../recognize-service.mjs';
import { createApp } from '../server.mjs';
import { FREE_LIMITS } from '../free-quota.mjs';

const image = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ==';
const config = provider => ({ version: 1, provider, model: provider === 'zhipu-free' ? 'glm-4-flash-250414' : provider === 'deepseek' ? 'deepseek-flash' : 'qwen-plus', workspace: provider === 'qwen-intl' ? 'ws1' : '', search: false });
const input = provider => ({ config: config(provider), apiKey: 'test-key-123', consent: true, locale: 'zh', image });

test('photo recognition requests: checks, provider endpoints and extracted text', async () => {
  assert.throws(() => validateRecognize(input('deepseek')), { code: 'vision-unsupported' });
  assert.throws(() => validateRecognize({ ...input('qwen-cn'), image: 'data:image/svg+xml;base64,PHN2Zz4=' }), { code: 'request' }, 'only raster photos');
  assert.throws(() => validateRecognize({ ...input('qwen-cn'), consent: false }), { code: 'consent' });
  const zhipu = buildRecognize(input('zhipu-free'));
  assert.equal(zhipu.body.model, 'glm-4v-flash');
  assert.equal(zhipu.body.messages[0].content[0].image_url.url, '/9j/4AAQSkZJRgABAQ==', '智谱 receives the bare Base64 data');
  const qwen = buildRecognize(input('qwen-cn'));
  assert.match(qwen.url, /^https:\/\/dashscope\.aliyuncs\.com\/compatible-mode\//); assert.equal(qwen.body.model, 'qwen-vl-ocr');
  assert.equal(qwen.body.messages[0].content[0].image_url.url, image);
  assert.deepEqual(extractRecognized({ choices: [{ message: { content: '```\n什么是闭包？\n```' } }] }), { text: '什么是闭包？' });
  assert.throws(() => extractRecognized({ choices: [{ message: { content: 'NO_TEXT' } }] }), { code: 'no-text' });
  const failing = async () => new Response('{"error":"secret details"}', { status: 401 });
  await assert.rejects(recognizeImage(input('qwen-cn'), { fetchImpl: failing }), { code: 'unauthorized' });
});

test('server: free photo recognition is counted on its own allowance', async () => {
  const server = createApp({ freeModelKey: 'server-free-key', publicConfig: () => ({}), recognizeCaller: async value => { assert.equal(value.apiKey, 'server-free-key'); return { text: '识别结果' }; } });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`, post = body => fetch(`${base}/api/recognize`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(async r => ({ status: r.status, data: await r.json() }));
  try {
    for (let i = 0; i < FREE_LIMITS.local.photo; i++) assert.deepEqual((await post({ ...input('zhipu-free'), apiKey: '' })).data, { text: '识别结果' });
    assert.deepEqual((await post({ ...input('zhipu-free'), apiKey: '' })).data, { error: 'free-limit-local' });
    const state = await fetch(`${base}/api/free-quota`).then(r => r.json());
    assert.deepEqual([state.photo.used, state.ask.used], [FREE_LIMITS.local.photo, 0], 'photos do not use question allowance');
  } finally { server.close(); }
});
