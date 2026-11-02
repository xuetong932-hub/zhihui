// Isolated browser QA only. Not loaded by npm start; never calls external services.
import { createApp } from '../server.mjs';
import { validateRequest, ServiceError } from '../model-service.mjs';
import { createFakeSupabase, FAKE_PREFIX } from './fake-supabase.mjs';
import { readFileSync } from 'node:fs';
// Fake account service: every code is 123456. The administrator signs in with the username and password from
// tests/qa-admin.local.json (gitignored, never committed): {"username": "...", "password": "..."}.
let admin = null;
try { const value = JSON.parse(readFileSync(new URL('./qa-admin.local.json', import.meta.url), 'utf8')); if (typeof value.username === 'string' && typeof value.password === 'string') admin = { username: value.username, email: 'admin@admin.test', password: value.password }; } catch { console.log('No tests/qa-admin.local.json: no administrator account in the test service.'); }
const fake = createFakeSupabase({ adminEmails: [], seedAdmin: admin && { email: admin.email, password: admin.password } });
const app = createApp({publicConfig: host => ({ url: `http://${host}${FAKE_PREFIX}`, publicKey: 'sb_publishable_fake_test_only', ...(admin ? { adminLogin: { username: admin.username, email: admin.email } } : {}) }), extraRoute: fake.route,
  // The free allowance runs against the fake account service's free_quota and the test model below; no real key.
  freeModelKey: 'test-free-allowance-not-real',
  // Test responses for the user-triggered model features; clearly not real model output.
  relationCaller: async input => ({ relations: input.cards.slice(1).map((card, i) => ({ a: input.cards[i].id, b: card.id, label: '测试关系' })) }),
  mindmapCaller: async () => ({ prerequisites: ['测试：前置知识'], subconcepts: ['测试：子概念一', '测试：子概念二'], misconceptions: ['测试：常见误区'], applications: ['测试：延伸应用'] }),
  reviewCaller:async input=>input.task==='question'?{question:'测试题：请选择正确选项',options:['正确概念','干扰项一','干扰项二','干扰项三'],correctIndex:0,explanation:'这是隔离测试讲解，不是真实判题。'}:input.task==='grade'?{correct:!input.answer.includes('wrong'),explanation:'隔离测试判题与生活例子，不是真实模型输出。'}:{explanation:'隔离测试：换一个笔记本的例子继续解释。'}, knowledgeCaller: async input => ({learnable:true,module:input.module,title:'测试知识：闭包',summary:'仅为第三步验收的测试摘要，不是真实模型输出。',category:'测试分类',example:'独立笔记本。',duplicateId:input.candidates[0]?.id||null}), modelCaller: async (input, { signal }) => {
  validateRequest(input);
  const question = input.messages.at(-1).content;
  if (question.includes('TEST_ERROR')) throw new ServiceError('unauthorized', 401);
  if (question.includes('TEST_WAIT')) await new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, 15000);
    signal.addEventListener('abort', () => { clearTimeout(timer); reject(new ServiceError('cancelled', 499)); }, { once: true });
  });
  return { content: `## 直接回答\n仅用于浏览器验收的测试响应，非真实模型答案。\n## 分步骤解释\n当前模块：${input.module}；上下文消息数：${input.messages.length}。\n## 生活例子\n像给每个学科准备独立笔记本。\n## 简短总结\n<script>alert(1)</script>\n测试：${question}`, provider: input.config.provider, model: input.config.model, sources: input.config.search ? [{ url: 'https://example.com/', title: '测试来源（非知识依据）' }] : [], searchStatus: input.config.search ? 'sources-returned' : 'off', truncated: false, usage: { inputTokens: 10, outputTokens: 20 } };
} });
const port = Number(process.env.QA_PORT || 4175);
app.listen(port, '127.0.0.1', () => console.log(`Isolated QA fixture: http://127.0.0.1:${port} (not a real model)`));
