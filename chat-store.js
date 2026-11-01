import { safeSourceUrl } from './providers.js';
export const CHAT_KEY = 'knowledge-review.chats.v1';
export const CONFIG_KEY = 'knowledge-review.model.v1';
export const moduleIds = ['coding', 'english', 'work', 'life'];
export const emptyChats = () => ({ version: 1, modules: Object.fromEntries(moduleIds.map(id => [id, []])) });
export function loadChats(storage) {
  try {
    const data = JSON.parse(storage.getItem(CHAT_KEY));
    if (data?.version !== 1 || !moduleIds.every(id => Array.isArray(data.modules?.[id]))) return { chats: emptyChats(), issue: Boolean(data) };
    for (const threads of Object.values(data.modules)) {
      if (!Array.isArray(threads)) return { chats: emptyChats(), issue: true };
      for (const thread of threads) {
        if (typeof thread?.id !== 'string' || !Array.isArray(thread.messages) || typeof thread.title !== 'string') return { chats: emptyChats(), issue: true };
        for (const message of thread.messages) {
          if (!['user', 'assistant'].includes(message?.role) || typeof message.id !== 'string' || typeof message.content !== 'string' || !Number.isFinite(Date.parse(message.createdAt)) || !['done', 'pending', 'failed', 'cancelled'].includes(message.status)) return { chats: emptyChats(), issue: true };
          if (message.status === 'pending') message.status = 'failed';
          if (message.role === 'assistant') message.sources = Array.isArray(message.sources) ? message.sources.filter(source => typeof source?.url === 'string' && safeSourceUrl(source.url)).map(source => ({ url: safeSourceUrl(source.url), title: String(source.title || source.url) })) : [];
        }
      }
    }
    return { chats: data, issue: false };
  } catch { return { chats: emptyChats(), issue: true }; }
}
// Only completed pairs from the selected thread are sent. Failed turns are excluded.
export function buildContext(thread, question) {
  const pairs = [];
  for (let i = 0; i < thread.messages.length - 1; i++) {
    const user = thread.messages[i], answer = thread.messages[i + 1];
    if (user.role === 'user' && user.status === 'done' && answer.role === 'assistant' && answer.status === 'done') {
      pairs.push([{ role: 'user', content: user.content }, { role: 'assistant', content: answer.content }]); i++;
    }
  }
  const chosen = [];
  let size = question.length;
  for (const pair of pairs.slice(-10).reverse()) {
    const pairSize = pair[0].content.length + pair[1].content.length;
    if (size + pairSize > 60000 || pair.some(message => message.content.length > 24000)) break;
    chosen.unshift(...pair); size += pairSize;
  }
  return [...chosen, { role: 'user', content: question }];
}
export function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}
// Small Markdown subset. Raw HTML, images and inline links remain inert text.
export function renderAnswer(text) {
  return String(text).split(/(```[\s\S]*?(?:```|$))/g).map(part => {
    if (part.startsWith('```')) return `<pre><code>${escapeHtml(part.replace(/^```[^\n]*\n?/, '').replace(/```$/, ''))}</code></pre>`;
    return part.split('\n').map(line => {
      const formatted = escapeHtml(line).replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
      if (/^#{1,4}\s/.test(line)) return `<h4>${formatted.replace(/^#{1,4}\s/, '')}</h4>`;
      return `<div class="answer-line">${formatted || '<br>'}</div>`;
    }).join('');
  }).join('');
}
