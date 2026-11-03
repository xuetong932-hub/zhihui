import test from 'node:test';
import assert from 'node:assert/strict';
import { systemPrompt, validateRequest } from '../model-service.mjs';

const request = extra => ({ config: { version: 1, provider: 'qwen-cn', model: 'qwen-plus', workspace: '', search: false }, apiKey: 'test-key-123', consent: true, module: 'coding', level: 'beginner', locale: 'zh', messages: [{ role: 'user', content: '变量是什么？' }], ...extra });

test('first-run guide: brief answers only when asked, and the flag must be a boolean', () => {
  const config = request().config;
  assert.match(systemPrompt({ module: 'coding', level: 'beginner', locale: 'zh', config, brief: true }), /约 150 字/);
  assert.doesNotMatch(systemPrompt({ module: 'coding', level: 'beginner', locale: 'zh', config }), /150 字/);
  assert.ok(validateRequest(request({ brief: true })));
  assert.ok(validateRequest(request()));
  assert.throws(() => validateRequest(request({ brief: 'yes' })), { code: 'request' });
});
