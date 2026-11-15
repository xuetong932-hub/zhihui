import { localDay } from './knowledge-store.js';
// The squirrel's shop (pet tab → 商城): pine cones earned by learning (pet.js) buy furniture for the nest, avatar
// frames and streak shields. Balance = cones earned − cones spent; earned is always worked out from the review history,
// spent comes from the purchase list kept on this device (and in the encrypted cloud snapshot).
// Nothing here involves real money.
export const SHOP_KEY = 'knowledge-review.shop.v1';
export const SLOTS = ['ceiling', 'rightWall', 'windowSill', 'floorRight', 'rug'];
// Backy's outfits (2026-11-15): one accessory per part, drawn over every pose (shop-ui.js wearLayer).
export const PARTS = ['head', 'face', 'neck', 'back'];
export const ITEMS = [
  { id: 'fern', kind: 'decor', slot: 'windowSill', price: 25, tier: 1 },
  { id: 'chime', kind: 'decor', slot: 'ceiling', price: 30, tier: 1 },
  { id: 'painting', kind: 'decor', slot: 'rightWall', price: 80, tier: 2 },
  { id: 'lamp', kind: 'decor', slot: 'floorRight', price: 90, tier: 2 },
  { id: 'shelf', kind: 'decor', slot: 'rightWall', price: 100, tier: 2 },
  { id: 'rug', kind: 'decor', slot: 'rug', price: 120, tier: 2 },
  { id: 'desk', kind: 'decor', slot: 'floorRight', price: 200, tier: 3 },
  { id: 'lights', kind: 'decor', slot: 'ceiling', price: 240, tier: 3 },
  { id: 'frame-sakura', kind: 'frame', price: 40, tier: 1 },
  { id: 'frame-snow', kind: 'frame', price: 40, tier: 1 },
  { id: 'frame-vine', kind: 'frame', price: 60, tier: 2 },
  { id: 'frame-pine', kind: 'frame', price: 80, tier: 2 },
  { id: 'frame-books', kind: 'frame', price: 100, tier: 2 },
  { id: 'frame-rainbow', kind: 'frame', price: 120, tier: 2 },
  { id: 'frame-squirrel', kind: 'frame', price: 180, tier: 3 },
  { id: 'frame-star', kind: 'frame', price: 300, tier: 3 },
  { id: 'frame-laurel', kind: 'frame', price: 400, tier: 3 },
  { id: 'hat-straw', kind: 'outfit', part: 'head', price: 40, tier: 1 },
  { id: 'hat-beanie', kind: 'outfit', part: 'head', price: 60, tier: 2 },
  { id: 'hat-grad', kind: 'outfit', part: 'head', price: 150, tier: 3, level: 3 },
  { id: 'face-blush', kind: 'outfit', part: 'face', price: 30, tier: 1 },
  { id: 'face-glasses', kind: 'outfit', part: 'face', price: 60, tier: 2 },
  { id: 'face-shades', kind: 'outfit', part: 'face', price: 80, tier: 2 },
  { id: 'neck-scarf', kind: 'outfit', part: 'neck', price: 40, tier: 1 },
  { id: 'neck-bell', kind: 'outfit', part: 'neck', price: 50, tier: 1 },
  { id: 'neck-bow', kind: 'outfit', part: 'neck', price: 70, tier: 2 },
  { id: 'back-pouch', kind: 'outfit', part: 'back', price: 60, tier: 2 },
  { id: 'back-bag', kind: 'outfit', part: 'back', price: 90, tier: 2 },
  { id: 'back-wings', kind: 'outfit', part: 'back', price: 200, tier: 3, level: 4 },
  { id: 'freeze', kind: 'tool', price: 30, tier: 1, max: 2 },
];
export const REFUND_HOURS = 24;
export const itemById = id => ITEMS.find(item => item.id === id) || null;
export const emptyShop = () => ({ version: 1, purchases: [], equipped: {}, frame: null, outfit: {} });
// Sets: wearing all four pieces of one set at once is celebrated in the dressing room.
export const SETS = [
  { id: 'scholar', items: ['hat-grad', 'face-glasses', 'neck-bow', 'back-bag'] },
  { id: 'explorer', items: ['hat-straw', 'face-shades', 'neck-scarf', 'back-pouch'] },
  { id: 'cosy', items: ['hat-beanie', 'face-blush', 'neck-bell', 'back-wings'] },
];
export const setProgress = outfit => SETS.map(set => ({ id: set.id, items: set.items, worn: set.items.filter(id => Object.values(outfit || {}).includes(id)).length }));
export const completeSets = outfit => setProgress(outfit).filter(set => set.worn === set.items.length).map(set => set.id);

// Keeps only well-formed data (an edited or older store never breaks the page).
export function cleanShop(data) {
  const out = emptyShop();
  if (!data || typeof data !== 'object') return out;
  for (const p of Array.isArray(data.purchases) ? data.purchases : []) {
    const item = itemById(p?.item);
    if (item && typeof p.id === 'string' && Number.isFinite(Date.parse(p.at)) && p.price === item.price) out.purchases.push({ id: p.id, item: item.id, at: p.at, price: p.price, ...(p.refunded ? { refunded: true } : {}) });
  }
  const owned = ownedSet(out);
  for (const slot of SLOTS) { const id = data.equipped?.[slot]; if (owned.has(id) && itemById(id).slot === slot) out.equipped[slot] = id; }
  if (owned.has(data.frame) && itemById(data.frame).kind === 'frame') out.frame = data.frame;
  for (const part of PARTS) { const id = data.outfit?.[part]; if (owned.has(id) && itemById(id).part === part) out.outfit[part] = id; }
  return out;
}
const live = data => data.purchases.filter(p => !p.refunded);
export const ownedSet = data => new Set(live(data).filter(p => itemById(p.item).kind !== 'tool').map(p => p.item));
export const spent = data => live(data).reduce((sum, p) => sum + p.price, 0);
export const freezeDates = data => live(data).filter(p => p.item === 'freeze').map(p => p.at);

// A streak that streak shields can keep alive: walking back from today (or yesterday while today is still open), a
// missed day uses one shield bought on or before it. Shields only count when they bridge to earlier streak days, so
// they are never used up on days before any activity. → { streak, used }
export function protectedStreak(hit, freezes, now = new Date()) {
  const shields = freezes.map(at => localDay(new Date(at))).sort(), taken = new Set();
  let day = localDay(now), streak = 0, pending = [];
  const prev = d => { const [y, m, n] = d.split('-').map(Number); return localDay(new Date(y, m - 1, n - 1, 12)); };
  if (!hit(day)) day = prev(day);
  for (let i = 0; i < 400; i++, day = prev(day)) {
    if (hit(day)) { streak++; pending.forEach(index => taken.add(index)); pending = []; continue; }
    const index = shields.findIndex((bought, k) => bought <= day && !taken.has(k) && !pending.includes(k));
    if (index < 0 || !streak) break;
    pending.push(index);
  }
  return { streak, used: taken.size };
}

// What the shop shows: balance, owned items, shields held.
export function shopState(data, earned, shieldsUsed = 0) {
  const shields = freezeDates(data).length;
  return { balance: earned - spent(data), owned: ownedSet(data), shieldsHeld: Math.max(0, shields - shieldsUsed), shieldsUsed };
}

// → { ok: true, data, purchase } or { ok: false, error: 'unknown' | 'owned' | 'funds' | 'max' | 'locked' }
// Some outfits open at a squirrel level (achievements.js); pass the current level.
export function buy(data, itemId, earned, { now = new Date(), shieldsUsed = 0, level = Infinity, id = `p-${now.getTime().toString(36)}-${Math.random().toString(36).slice(2, 7)}` } = {}) {
  const item = itemById(itemId), state = shopState(data, earned, shieldsUsed);
  if (!item) return { ok: false, error: 'unknown' };
  if (item.kind !== 'tool' && state.owned.has(item.id)) return { ok: false, error: 'owned' };
  if (item.max && state.shieldsHeld >= item.max) return { ok: false, error: 'max' };
  if (item.level && level < item.level) return { ok: false, error: 'locked' };
  if (state.balance < item.price) return { ok: false, error: 'funds' };
  const purchase = { id, item: item.id, at: now.toISOString(), price: item.price };
  const next = { ...data, purchases: [...data.purchases, purchase], equipped: { ...data.equipped }, frame: data.frame, outfit: { ...data.outfit } };
  // A new piece of furniture goes straight into its place; a new frame or outfit piece is put on.
  if (item.kind === 'decor') next.equipped[item.slot] = item.id;
  if (item.kind === 'frame') next.frame = item.id;
  if (item.kind === 'outfit') next.outfit[item.part] = item.id;
  return { ok: true, data: next, purchase };
}

// Within 24 hours a purchase can be returned for the full price (a shield only while it is unused).
export function canRefund(data, purchase, { now = new Date(), shieldsUsed = 0 } = {}) {
  if (!purchase || purchase.refunded || now - new Date(purchase.at) > REFUND_HOURS * 3600000) return false;
  if (purchase.item === 'freeze') return shopState(data, 0, shieldsUsed).shieldsHeld > 0;
  return true;
}
export function refund(data, purchaseId, options = {}) {
  const purchase = data.purchases.find(p => p.id === purchaseId);
  if (!canRefund(data, purchase, options)) return { ok: false };
  const next = { ...data, purchases: data.purchases.map(p => p.id === purchaseId ? { ...p, refunded: true } : p), equipped: { ...data.equipped }, frame: data.frame, outfit: { ...data.outfit } };
  for (const part of PARTS) if (next.outfit[part] === purchase.item) delete next.outfit[part];
  for (const slot of SLOTS) if (next.equipped[slot] === purchase.item) delete next.equipped[slot];
  if (next.frame === purchase.item) next.frame = null;
  return { ok: true, data: next };
}
export function equip(data, itemId) {
  const item = itemById(itemId);
  if (!item || !ownedSet(data).has(itemId)) return data;
  if (item.kind === 'decor') return { ...data, equipped: { ...data.equipped, [item.slot]: itemId } };
  if (item.kind === 'frame') return { ...data, frame: itemId };
  if (item.kind === 'outfit') return { ...data, outfit: { ...data.outfit, [item.part]: itemId } };
  return data;
}
export function unequip(data, itemId) {
  const item = itemById(itemId);
  if (item?.kind === 'frame') return { ...data, frame: data.frame === itemId ? null : data.frame };
  if (item?.kind === 'outfit') { const outfit = { ...data.outfit }; if (outfit[item.part] === itemId) delete outfit[item.part]; return { ...data, outfit }; }
  const equipped = { ...data.equipped };
  for (const slot of SLOTS) if (equipped[slot] === itemId) delete equipped[slot];
  return { ...data, equipped };
}

// Dressing room: put on a whole look at once (part → item id, or null to leave a part bare). Only owned pieces stick.
export function wearOutfit(data, look) {
  const owned = ownedSet(data), outfit = { ...data.outfit };
  for (const part of PARTS) {
    if (!(part in look)) continue;
    const id = look[part];
    if (id === null) delete outfit[part];
    else if (owned.has(id) && itemById(id)?.part === part) outfit[part] = id;
  }
  return { ...data, outfit };
}
