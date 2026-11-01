export const KNOWLEDGE_KEY = 'knowledge-review.knowledge.v1';
export const moduleIds = ['coding', 'english', 'work', 'life'];
export const emptyKnowledge = () => ({ version: 1, cards: [], ignored: [] });
export function localDay(value) {
  const date = new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export function normalizeQuestion(text) { return text.normalize('NFKC').toLowerCase().replace(/[\p{P}\p{Z}\s]/gu, ''); }
export function loadKnowledge(raw) {
  if (!raw) return emptyKnowledge();
  const data = JSON.parse(raw);
  if (data?.version !== 1 || !Array.isArray(data.cards) || !Array.isArray(data.ignored) || !data.ignored.every(id => typeof id === 'string')) throw new Error('invalid');
  const ids = new Set();
  for (const card of data.cards) {
    if (!card || typeof card.id !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(card.id) || ids.has(card.id) || !moduleIds.includes(card.module) || !['title','summary','category','example','createdAt'].every(key => typeof card[key] === 'string') || !Number.isFinite(Date.parse(card.createdAt)) || !['active','paused','deleted','merged'].includes(card.status) || !['ready','pending'].includes(card.extraction) || typeof card.important !== 'boolean' || !Array.isArray(card.origins)) throw new Error('invalid');
    ids.add(card.id);
    for (const origin of card.origins) if (!origin || !['id','threadId','question','answer','createdAt','sourceModule'].every(key => typeof origin[key] === 'string') || !Number.isFinite(Date.parse(origin.createdAt)) || !moduleIds.includes(origin.sourceModule)) throw new Error('invalid');
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
