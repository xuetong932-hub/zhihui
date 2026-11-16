// 小回's speech bubble on home: one tip at a time, the most useful first. A closed tip stays closed (the mic tip for
// good, the daily ones until tomorrow). Kept on this device; 我的 → 小回提示 turns them all off.
const KEY = 'knowledge-review.tips.v1';
export const TIP_ORDER = ['mic', 'due', 'water', 'goal', 'back', 'badge'];

export function readTips(storage = globalThis.localStorage) {
  try { const data = JSON.parse(storage.getItem(KEY) || '{}'); return { off: data.off === true, usedMic: data.usedMic === true, closed: data.closed && typeof data.closed === 'object' ? data.closed : {} }; }
  catch { return { off: false, usedMic: false, closed: {} }; }
}
export function writeTips(data, storage = globalThis.localStorage) { try { storage.setItem(KEY, JSON.stringify(data)); } catch { /* This visit only. */ } }
// The key a closed tip is remembered under: the mic tip once, daily tips per day, the badge tip per badge tier.
export const tipKey = (tip, today) => tip.id === 'mic' ? 'mic' : tip.id === 'badge' ? `badge:${tip.badge}` : `${tip.id}:${today}`;

// ctx: { today, due, doneToday, goalReached, canFull, daysAway, newBadge ('id:tier' or null) } → the tip to show or null.
export function pickTip(ctx, state) {
  if (state.off) return null;
  const candidates = [
    !state.usedMic && { id: 'mic' },
    ctx.due > 0 && !ctx.doneToday && { id: 'due', n: ctx.due },
    ctx.canFull && { id: 'water' },
    ctx.goalReached && { id: 'goal' },
    ctx.daysAway >= 3 && { id: 'back' },
    ctx.newBadge && { id: 'badge', badge: ctx.newBadge },
  ].filter(Boolean);
  return candidates.find(tip => !state.closed[tipKey(tip, ctx.today)]) || null;
}
// Close a tip; old daily keys are dropped so the store stays small.
export function closeTip(state, tip, today) {
  const closed = Object.fromEntries(Object.entries(state.closed).filter(([key]) => !/:\d{4}-\d{2}-\d{2}$/.test(key) || key.endsWith(today)));
  return { ...state, closed: { ...closed, [tipKey(tip, today)]: true } };
}
