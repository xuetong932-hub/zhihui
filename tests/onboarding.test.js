import test from 'node:test';
import assert from 'node:assert/strict';
import { systemPrompt, validateRequest } from '../model-service.mjs';

const request = extra => ({ config: { version: 1, provider: 'qwen-cn', model: 'qwen-plus', workspace: '', search: false }, apiKey: 'test-key-123', consent: true, module: 'coding', level: 'beginner', locale: 'zh', messages: [{ role: 'user', content: '变量是什么？' }], ...extra });

test('first-run guide: brief answers only when asked, and the flag must be a boolean', () => {
  const config = request().config;
  const brief = systemPrompt({ module: 'coding', level: 'beginner', locale: 'zh', config, brief: true }), normal = systemPrompt({ module: 'coding', level: 'beginner', locale: 'zh', config });
  assert.match(brief, /约 150 字/); assert.doesNotMatch(brief, /四个清晰小标题/, 'the heading format is replaced, not contradicted');
  assert.match(normal, /四个清晰小标题/); assert.doesNotMatch(normal, /150 字/);
  assert.ok(validateRequest(request({ brief: true })));
  assert.ok(validateRequest(request()));
  assert.throws(() => validateRequest(request({ brief: 'yes' })), { code: 'request' });
});

test('speech errors are explained by cause; an intentional stop shows nothing', async () => {
  const { speechErrorText } = await import('../onboarding.js');
  assert.match(speechErrorText('not-allowed', true), /麦克风权限被拒绝/);
  assert.match(speechErrorText('network', true), /联网/);
  assert.match(speechErrorText('no-speech', false), /No speech/);
  assert.equal(speechErrorText('aborted', true), '');
  assert.match(speechErrorText('something-new', true), /没有完成/);
});
