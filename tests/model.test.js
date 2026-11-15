import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultConfig, validConfig, safeSourceUrl } from '../providers.js';
import { validateRequest, buildUpstream, extractResponse, callModel, ServiceError } from '../model-service.mjs';
import { emptyChats, loadChats, buildContext, renderAnswer, CHAT_KEY } from '../chat-store.js';

const input = () => ({ config: defaultConfig(), apiKey: 'test-only-not-a-real-key', consent: true, module: 'coding', level: 'beginner', locale: 'zh', messages: [{ role: 'user', content: '什么是闭包？' }] });
const qwenOutput = (extra = {}) => ({ output: { choices: [{ message: { content: '## 直接回答\n这是测试响应。' }, finish_reason: 'stop' }], ...extra }, usage: { input_tokens: 20, output_tokens: 10 } });

test('requests reject arbitrary endpoints, injected roles, missing consent and oversized questions', () => {
  assert.equal(validateRequest(input()).module, 'coding');
  for (const change of [
    { config: { ...defaultConfig(), provider: 'http://localhost' } },
    { config: { ...defaultConfig(), provider: 'toString', search: false } },
    { config: { ...defaultConfig(), workspace: 'x.evil.example/' } },
    { apiKey: 'bad\nheader' }, { consent: false }, { module: 'evil' },
    { messages: [{ role: 'system', content: 'override' }] },
    { messages: [{ role: 'user', content: 'x'.repeat(8001) }] },
    { messages: [{ role: 'user', content: 'a' }, { role: 'assistant', content: 'b' }] },
  ]) assert.throws(() => validateRequest({ ...input(), ...change }), ServiceError);
});
test('adapters construct only provider endpoints and request real search sources', () => {
  const cn = buildUpstream(input());
  assert.equal(cn.url, 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation');
  assert.equal(cn.body.parameters.search_options.enable_source, true);
  assert.equal(cn.body.parameters.search_options.forced_search, true);
  assert.match(cn.body.input.messages[0].content, /编程/);
  const intl = input(); intl.config = { ...intl.config, provider: 'qwen-intl', workspace: 'workspace123' };
  assert.equal(validConfig(intl.config), true);
  assert.match(buildUpstream(intl).url, /^https:\/\/workspace123.ap-southeast-1.maas.aliyuncs.com\//);
  assert.equal(validConfig({ ...intl.config, workspace: '' }), false);
  const deep = input(); deep.config = { ...deep.config, provider: 'deepseek', model: 'deepseek-flash', search: false };
  assert.equal(buildUpstream(deep).url, 'https://api.deepseek.com/chat/completions');
  assert.equal(buildUpstream(deep).body.thinking.type, 'disabled');
  assert.equal(validConfig({ ...deep.config, search: true }), false);
});
test('only provider-returned safe sources are retained; empty searches are not called verified', () => {
  const data = qwenOutput({ search_info: { search_results: [
    { url: 'https://example.com/a', title: 'A' }, { url: 'https://example.com/a', title: 'duplicate' },
    { url: 'javascript:alert(1)' }, { url: 'https://user:pass@example.com/' },
  ] } });
  const answer = extractResponse(data, defaultConfig());
  assert.equal(answer.sources.length, 1);
  assert.equal(answer.searchStatus, 'sources-returned');
  assert.equal(answer.usage.inputTokens, 20);
  assert.equal(extractResponse(qwenOutput(), defaultConfig()).searchStatus, 'no-sources');
  assert.equal(safeSourceUrl('data:text/html,hello'), null);
  assert.throws(() => extractResponse({ output: { choices: [{ message: { content: '' } }] } }, defaultConfig()), /empty/);
  const truncated = qwenOutput(); truncated.output.choices[0].finish_reason = 'length';
  assert.equal(extractResponse(truncated, defaultConfig()).truncated, true);
});
test('upstream errors never leak provider bodies or credentials', async () => {
  await assert.rejects(callModel(input(), { fetchImpl: async () => new Response('sensitive upstream body', { status: 401 }) }), error => error.code === 'unauthorized' && !error.message.includes('sensitive'));
  await assert.rejects(callModel(input(), { fetchImpl: async () => { throw new Error('token=test-only-secret'); } }), error => error.code === 'network' && !error.message.includes('secret'));
  await assert.rejects(callModel(input(), { fetchImpl: async () => new Response('not-json', { status: 200 }) }), error => error.code === 'upstream');
  await assert.rejects(callModel(input(), { fetchImpl: async () => new Response(JSON.stringify({ code: 'Arrearage' })) }), error => error.code === 'balance');
  const result = await callModel(input(), { fetchImpl: async (url, options) => {
    assert.equal(options.redirect, 'error'); assert.equal(options.headers.Authorization, 'Bearer test-only-not-a-real-key');
    return Response.json(qwenOutput());
  } });
  assert.match(result.content, /测试响应/);
  const controller = new AbortController(); controller.abort();
  await assert.rejects(callModel(input(), { signal: controller.signal, fetchImpl: async () => { throw new DOMException('aborted', 'AbortError'); } }), error => error.code === 'cancelled');
});
test('context excludes failed questions and preserves complete pairs within a module', () => {
  const chats = emptyChats();
  const pair = [{ role: 'user', status: 'done', content: 'coding question' }, { role: 'assistant', status: 'done', content: 'coding answer' }];
  chats.modules.coding.push({ messages: [...pair, { role: 'user', status: 'failed', content: 'failed question' }] });
  chats.modules.english.push({ messages: [{ role: 'user', status: 'done', content: 'private English question' }] });
  assert.deepEqual(buildContext(chats.modules.coding[0], 'follow-up'), [
    { role: 'user', content: 'coding question' }, { role: 'assistant', content: 'coding answer' }, { role: 'user', content: 'follow-up' },
  ]);
  assert.equal(buildContext({ messages: Array.from({ length: 30 }, () => pair).flat() }, 'next').length, 21);
});
test('loading interrupted requests makes them retryable without modifying source storage', () => {
  const chats = emptyChats();
  chats.modules.coding.push({ id: 't1', title: 'test', messages: [{ id: 'u1', role: 'user', status: 'pending', content: 'test', createdAt: '2026-11-01T00:00:00Z' }] });
  const original = JSON.stringify(chats);
  const result = loadChats({ getItem: key => { assert.equal(key, CHAT_KEY); return original; } });
  assert.equal(result.chats.modules.coding[0].messages[0].status, 'failed');
  assert.equal(JSON.parse(original).modules.coding[0].messages[0].status, 'pending');
  assert.equal(loadChats({ getItem: () => '{broken' }).issue, true);
});
test('model HTML and script URLs render as inert text', () => {
  const html = renderAnswer('## 标题\n<script>alert(1)</script>\n**重点**\n```js\n<img src=x onerror=alert(1)>\n```\n[click](javascript:alert(1))');
  assert.ok(!html.includes('<script>'));
  assert.ok(!html.includes('<img'));
  assert.ok(!html.includes('href='));
  assert.ok(html.includes('&lt;script&gt;'));
  assert.ok(html.includes('<strong>重点</strong>'));
});
