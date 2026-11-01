import { safeSourceUrl } from './providers.js';
export const CHAT_KEY = 'knowledge-review.chats.v1';
export const CONFIG_KEY = 'knowledge-review.model.v1';
export const moduleIds = ['coding', 'english', 'work', 'life'];
export const emptyChats = () => ({ version: 1, modules: Object.fromEntries(moduleIds.map(id => [id, []])) });
// Limits follow what the app writes: questions ≤8,000 characters, model answers ≤60,000, titles are the first 60 characters.
export const CHAT_LIMITS = { threads: 5000, messages: 5000, id: 100, title: 200, user: 8000, assistant: 60000, label: 100, sources: 30, sourceTitle: 300, url: 2048 };
const text = (value, max) => typeof value === 'string' && value.length <= max;
const optionalText = (value, max) => value === undefined || text(value, max);
function validMessage(message) {
  const L = CHAT_LIMITS;
  return Boolean(['user', 'assistant'].includes(message?.role) && text(message.id, L.id) && text(message.content, message.role === 'user' ? L.user : L.assistant)
    && typeof message.createdAt === 'string' && Number.isFinite(Date.parse(message.createdAt)) && ['done', 'pending', 'failed', 'cancelled'].includes(message.status)
    && optionalText(message.model, L.label) && optionalText(message.provider, L.label) && optionalText(message.error, L.label)
    && [undefined, 'off', 'sources-returned', 'no-sources'].includes(message.searchStatus) && [undefined, true, false].includes(message.truncated));
}
export function loadChats(storage) {
  const L = CHAT_LIMITS;
  try {
    const data = JSON.parse(storage.getItem(CHAT_KEY));
    if (data?.version !== 1 || !moduleIds.every(id => Array.isArray(data.modules?.[id]))) return { chats: emptyChats(), issue: Boolean(data) };
    for (const threads of Object.values(data.modules)) {
      if (!Array.isArray(threads) || threads.length > L.threads) return { chats: emptyChats(), issue: true };
      for (const thread of threads) {
        if (!text(thread?.id, L.id) || !Array.isArray(thread.messages) || thread.messages.length > L.messages || !text(thread.title, L.title)) return { chats: emptyChats(), issue: true };
        for (const message of thread.messages) {
          if (!validMessage(message)) return { chats: emptyChats(), issue: true };
          if (message.status === 'pending') message.status = 'failed';
          if (message.role === 'assistant') message.sources = (Array.isArray(message.sources) ? message.sources : []).flatMap(source => {
            const url = text(source?.url, L.url) ? safeSourceUrl(source.url) : null;
            return url ? [{ url, title: String(source.title || url).slice(0, L.sourceTitle) }] : [];
          }).slice(0, L.sources);
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
// Inserted text (follow-up prompts, restored questions, dictation) is appended so a typed draft is never replaced.
export function appendDraft(current, addition, separator = '\n') {
  const base = current || '', text = addition || '', max = CHAT_LIMITS.user;
  if (!text || base.trim() === text.trim()) return base.slice(0, max);
  if (!base.trim()) return text.slice(0, max);
  return `${base}${/\s$/.test(base) ? '' : separator}${text}`.slice(0, max);
}
// Only results from resultIndex onward are new; earlier ones were already delivered.
export function newTranscript(results, resultIndex = 0) {
  return Array.from(results).slice(resultIndex).filter(result => result.isFinal !== false).map(result => result[0].transcript).join(' ').trim();
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
