import { safeSourceUrl } from './providers.js';
import { PRESET_MODULES, isModuleId } from './modules.js';
export const KNOWLEDGE_KEY = 'knowledge-review.knowledge.v1';
export const moduleIds = PRESET_MODULES;
export const emptyKnowledge = () => ({ version: 1, cards: [], ignored: [] });
export function localDay(value) {
  const date = new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export function normalizeQuestion(text) { return text.normalize('NFKC').toLowerCase().replace(/[\p{P}\p{Z}\s]/gu, ''); }
// Limits follow what the app writes: extraction and edit forms cap card fields; questions ≤8,000 and answers ≤60,000 characters.
export const KNOWLEDGE_LIMITS = { cards: 20000, ignored: 100000, origins: 1000, sources: 30, id: 100, title: 120, summary: 2400, category: 60, example: 1200, question: 8000, answer: 60000, sourceTitle: 300, url: 2048 };
const text = (value, max) => typeof value === 'string' && value.length <= max;
const optionalDate = value => value === undefined || (typeof value === 'string' && Number.isFinite(Date.parse(value)));
function validOrigin(origin) {
  const L = KNOWLEDGE_LIMITS;
  return Boolean(origin && text(origin.id, L.id) && text(origin.threadId, L.id) && text(origin.question, L.question) && text(origin.answer, L.answer)
    && typeof origin.createdAt === 'string' && Number.isFinite(Date.parse(origin.createdAt)) && isModuleId(origin.sourceModule)
    && (origin.sources === undefined || Array.isArray(origin.sources)));
}
// Sources are display data, so unsafe or oversized entries are dropped rather than blocking the library.
export function cleanSources(sources) {
  const L = KNOWLEDGE_LIMITS;
  return (Array.isArray(sources) ? sources : []).flatMap(source => {
    const url = typeof source?.url === 'string' && source.url.length <= L.url ? safeSourceUrl(source.url) : null;
    return url ? [{ url, title: String(source.title || url).slice(0, L.sourceTitle) }] : [];
  }).slice(0, L.sources);
}
export function validCard(card) {
  const L = KNOWLEDGE_LIMITS;
  return Boolean(card && typeof card.id === 'string' && /^[a-zA-Z0-9_-]{1,100}$/.test(card.id) && isModuleId(card.module)
    && text(card.title, L.title) && text(card.summary, L.summary) && text(card.category, L.category) && text(card.example, L.example)
    && typeof card.createdAt === 'string' && Number.isFinite(Date.parse(card.createdAt)) && optionalDate(card.updatedAt)
    && ['active','paused','deleted','merged'].includes(card.status) && ['ready','pending'].includes(card.extraction) && typeof card.important === 'boolean'
    && [undefined, '', 'repeated', 'wrong', 'unclear', 'manual'].includes(card.reason) && (card.mergedInto === undefined || text(card.mergedInto, L.id))
    && Array.isArray(card.origins) && card.origins.length <= L.origins && card.origins.every(validOrigin));
}
export function loadKnowledge(raw) {
  if (!raw) return emptyKnowledge();
  const data = JSON.parse(raw), L = KNOWLEDGE_LIMITS;
  if (data?.version !== 1 || !Array.isArray(data.cards) || data.cards.length > L.cards || !Array.isArray(data.ignored) || data.ignored.length > L.ignored || !data.ignored.every(id => text(id, L.id))) throw new Error('invalid');
  const ids = new Set();
  for (const card of data.cards) {
    if (!validCard(card) || ids.has(card.id)) throw new Error('invalid');
    ids.add(card.id);
    for (const origin of card.origins) if (origin.sources !== undefined) origin.sources = cleanSources(origin.sources);
  }
  return data;
}
export function addKnowledge(data, origin, result) {
  if (data.ignored.includes(origin.id)) return null;
  const linked = data.cards.find(card => card.origins.some(item => item.id === origin.id));
  if (linked && linked.extraction === 'ready') return linked;
  if (linked && ['deleted','merged'].includes(linked.status)) return linked;
  if (result?.learnable === false) {
    data.ignored.push(origin.id);
    if (linked) linked.status = 'deleted';
    return null;
  }
  const targetModule = result?.module || origin.sourceModule;
  const match = data.cards.find(card => card.id !== linked?.id && ['active','paused'].includes(card.status) && card.module === targetModule &&
    (card.id === result?.duplicateId || card.origins.some(item => normalizeQuestion(item.question) === normalizeQuestion(origin.question))));
  if (match) {
    if (!match.origins.some(item => item.id === origin.id)) match.origins.push(origin);
    if (linked) linked.status = 'merged';
    match.important = true; match.reason = 'repeated'; match.updatedAt = origin.createdAt;
    return match;
  }
  const card = linked || { id: crypto.randomUUID(), createdAt: origin.createdAt, origins: [origin], status: 'active', important: false };
  Object.assign(card, { module: targetModule, title: result?.title || origin.question.slice(0,120), summary: result?.summary || origin.answer.slice(0,2400), category: result?.category || '', example: result?.example || '', extraction: result ? 'ready' : 'pending', updatedAt: origin.createdAt });
  if (!linked) data.cards.push(card);
  return card;
}
export function mergeCards(data, targetId, sourceId) {
  const target = data.cards.find(card => card.id === targetId), source = data.cards.find(card => card.id === sourceId);
  if (!target || !source || target === source || target.module !== source.module || !['active','paused'].includes(target.status) || !['active','paused'].includes(source.status)) throw new Error('merge');
  target.origins = [...new Map([...target.origins,...source.origins].map(origin => [origin.id, origin])).values()];
  target.important ||= source.important; source.status = 'merged'; source.mergedInto = target.id;
  return target;
}
