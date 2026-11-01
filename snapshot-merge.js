import { moduleIds, normalizeQuestion } from './knowledge-store.js';
// Merges two learning snapshots without losing records: every thread, message, card origin and review
// event from both sides is kept by ID. `keep` wins for settings; for the same card ID the newer edit wins.
// Used by file import now and by duplicate-account merging later (docs/ACCOUNT_DESIGN.md §5.3).
const clone = value => structuredClone(value);
const stamp = card => card.updatedAt || card.createdAt || '';
const threadTime = thread => thread.createdAt || thread.messages[0]?.createdAt || '';
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

function mergeProfile(keep, other) {
  if (!keep) return other ? clone(other) : null;
  const result = clone(keep);
  // A module enabled on either side stays enabled; levels and other settings come from `keep`.
  if (other?.modules) for (const id of moduleIds) if (result.modules?.[id] && other.modules[id]?.enabled) result.modules[id].enabled = true;
  return result;
}

function mergeChats(keep, other, stats) {
  if (!keep && !other) return null;
  const result = { version: 1, modules: {} };
  for (const id of moduleIds) {
    const threads = new Map((keep?.modules?.[id] || []).map(thread => [thread.id, clone(thread)]));
    let addedThread = false;
    for (const thread of other?.modules?.[id] || []) {
      const existing = threads.get(thread.id);
      if (!existing) { threads.set(thread.id, clone(thread)); addedThread = true; stats.threads++; stats.messages += thread.messages.length; continue; }
      const messages = new Map(existing.messages.map(message => [message.id, message]));
      let added = false;
      for (const message of thread.messages) {
        if (!messages.has(message.id)) { messages.set(message.id, clone(message)); stats.messages++; added = true; }
        else if (!same(messages.get(message.id), message)) stats.conflicts++;
      }
      if (added) existing.messages = [...messages.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      if (!existing.title) existing.title = thread.title;
    }
    result.modules[id] = addedThread ? [...threads.values()].sort((a, b) => threadTime(a).localeCompare(threadTime(b))) : [...threads.values()];
  }
  return result;
}

function mergeKnowledge(keep, other, stats) {
  if (!keep && !other) return null;
  const cards = new Map((keep?.cards || []).map(card => [card.id, clone(card)]));
  for (const card of other?.cards || []) {
    const existing = cards.get(card.id);
    if (!existing) { cards.set(card.id, clone(card)); stats.cards++; continue; }
    if (same(existing, card)) continue;
    stats.conflicts++;
    const winner = stamp(card) > stamp(existing) ? clone(card) : existing;
    winner.origins = [...new Map([...existing.origins, ...card.origins].map(origin => [origin.id, origin])).values()].map(clone);
    winner.important = Boolean(existing.important || card.important);
    cards.set(card.id, winner);
  }
  const ignored = [...new Set([...(keep?.ignored || []), ...(other?.ignored || [])])];
  return { version: 1, cards: [...cards.values()], ignored };
}

function mergeReviews(keep, other, stats) {
  if (!keep && !other) return null;
  const events = new Map((keep?.events || []).map(event => [event.id, clone(event)]));
  for (const event of other?.events || []) {
    if (!events.has(event.id)) { events.set(event.id, clone(event)); stats.events++; }
    else if (!same(events.get(event.id), event)) stats.conflicts++;
  }
  return { version: 1, events: [...events.values()].sort((a, b) => a.at.localeCompare(b.at)) };
}

// Different cards in one module that share a normalized question; reported for manual merging, never merged automatically.
export function possibleDuplicates(knowledge) {
  const seen = new Map(); let count = 0;
  for (const card of knowledge?.cards || []) {
    if (!['active', 'paused'].includes(card.status)) continue;
    const keys = new Set(card.origins.map(origin => `${card.module}:${normalizeQuestion(origin.question)}`));
    for (const key of keys) { const ids = seen.get(key) || new Set(); if (ids.size && !ids.has(card.id)) count++; ids.add(card.id); seen.set(key, ids); }
  }
  return count;
}

export function mergeSnapshots(keep, other) {
  const stats = { threads: 0, messages: 0, cards: 0, events: 0, conflicts: 0, possibleDuplicates: 0 };
  const knowledge = mergeKnowledge(keep.knowledge, other.knowledge, stats);
  const snapshot = { version: 1, createdAt: new Date().toISOString(), profile: mergeProfile(keep.profile, other.profile),
    chats: mergeChats(keep.chats, other.chats, stats), knowledge, reviews: mergeReviews(keep.reviews, other.reviews, stats) };
  stats.possibleDuplicates = possibleDuplicates(knowledge);
  return { snapshot, stats };
}
