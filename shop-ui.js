// Shop page (pet tab → 商城), the item sheet with a nest preview, the furniture drawn in the squirrel's nest and the
// avatar frame. Data and rules: shop.js.
import { escapeHtml as e } from './chat-store.js';
import { pick } from './i18n.js';
import { ITEMS, itemById, canRefund } from './shop.js';

const NAME = {
  fern: () => pick('窗台绿植', 'Windowsill fern'), chime: () => pick('松果风铃', 'Pine-cone chime'), painting: () => pick('月夜挂画', 'Moonlit painting'),
  lamp: () => pick('蘑菇落地灯', 'Mushroom lamp'), shelf: () => pick('小书架', 'Wall shelf'), rug: () => pick('松果地毯', 'Pine-cone rug'),
  desk: () => pick('小书桌', 'Little desk'), lights: () => pick('星星串灯', 'Star lights'),
  'frame-vine': () => pick('藤蔓头像框', 'Vine frame'), 'frame-pine': () => pick('松果头像框', 'Pine frame'), 'frame-star': () => pick('星空头像框', 'Starry frame'),
  freeze: () => pick('连续保护卡', 'Streak shield'),
};
const DESC = {
  fern: () => pick('放在圆窗下，让小窝多一点绿意。', 'Sits under the round window and adds some green.'),
  chime: () => pick('挂在洞顶，风一吹就叮叮响。', 'Hangs from the ceiling and tinkles in the breeze.'),
  painting: () => pick('挂在右边墙上的一幅小画。', 'A small painting for the right-hand wall.'),
  lamp: () => pick('放在右边地上，晚上暖暖地亮着。', 'Stands on the right and glows warmly at night.'),
  shelf: () => pick('挂在右边墙上，放书和松果罐。', 'Hangs on the right-hand wall for books and cones.'),
  rug: () => pick('铺在坐垫下面的圆地毯。', 'A round rug under the cushion.'),
  desk: () => pick('小回专属的学习小桌。', 'Backy’s own little study desk.'),
  lights: () => pick('挂在洞顶的一串星星灯。', 'A string of star lights across the ceiling.'),
  'frame-vine': () => pick('戴在「我的」头像外圈。', 'Goes around your avatar in Me.'),
  'frame-pine': () => pick('戴在「我的」头像外圈。', 'Goes around your avatar in Me.'),
  'frame-star': () => pick('戴在「我的」头像外圈。', 'Goes around your avatar in Me.'),
  freeze: () => pick('某天没达标时自动保住连续天数，最多同时持有 2 张。', 'Keeps your streak alive on a day you miss the goal. Hold up to 2.'),
};
const TIER = () => ['', pick('普通', 'Common'), pick('稀有', 'Rare'), pick('珍贵', 'Precious')];
export const itemName = id => NAME[id]?.() || id;
export const itemImage = id => `/illustrations/shop/${id}.webp`;
const PINE = '<svg class="pine-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 6.4c3.4 0 5.6 3.2 5.6 7 0 4.2-2.6 7.4-5.6 7.4s-5.6-3.2-5.6-7.4c0-3.8 2.2-7 5.6-7Z" fill="#b8733d" stroke="#6b3f1f" stroke-width="1.2"/><path d="M12 3.2c.5 1 1.7 1.6 2.6 1.4-.3.9-1.2 1.6-2.1 1.7h-1c-.9-.1-1.8-.8-2.1-1.7.9.2 2.1-.4 2.6-1.4Z" fill="#4f8a5b"/></svg>';

// Furniture in the nest: one image per filled place, positioned by CSS class (the page CSP blocks style attributes).
export const decorLayer = (equipped, preview = null) => {
  const shown = { ...equipped }; if (preview) shown[itemById(preview).slot] = preview;
  return `<div class="pet-decor" aria-hidden="true">${Object.values(shown).map(id => `<img class="decor decor-${id}${id === preview ? ' is-preview' : ''}" src="${itemImage(id)}" alt="" decoding="async">`).join('')}</div>`;
};
export const frameImage = frame => frame ? `<img class="avatar-frame" src="${itemImage(frame)}" alt="" decoding="async">` : '';

const TABS = () => [['decor', pick('家具', 'Furniture')], ['frame', pick('头像框', 'Frames')], ['tool', pick('道具', 'Items')]];
export function shopView({ state, data, tab }) {
  const list = ITEMS.filter(item => item.kind === tab);
  return `<section class="shop-page">
    <header class="book-top store-top"><button type="button" class="book-back" data-shop-back aria-label="${pick('回到小窝', 'Back to the nest')}">‹</button><strong>${pick('小回的商城', 'Backy’s shop')}</strong><span class="shop-balance">${PINE}<b>${state.balance}</b></span></header>
    <div class="shop-tabs" role="tablist">${TABS().map(([id, label]) => `<button type="button" role="tab" aria-selected="${tab === id}" class="${tab === id ? 'active' : ''}" data-shop-tab="${id}">${label}</button>`).join('')}</div>
    <div class="shop-grid">${list.map(item => {
      const owned = item.kind === 'tool' ? state.shieldsHeld > 0 : state.owned.has(item.id), using = item.kind === 'decor' ? data.equipped[item.slot] === item.id : item.kind === 'frame' && data.frame === item.id;
      const badge = item.kind === 'tool' ? (state.shieldsHeld ? pick('持有 {n}', 'Have {n}', { n: state.shieldsHeld }) : '') : using ? pick('使用中', 'In use') : owned ? pick('已拥有', 'Owned') : '';
      return `<button type="button" class="shop-card tier-${item.tier}" data-shop-item="${item.id}"><span class="shop-art"><img src="${itemImage(item.id)}" alt="" loading="lazy" decoding="async"></span>
        <strong>${e(itemName(item.id))}</strong><span class="shop-price">${badge ? `<em>${badge}</em>` : `${PINE}${item.price}`}</span><i class="shop-tier" aria-hidden="true"></i></button>`;
    }).join('')}</div>
    ${tab === 'decor' ? `<p class="shop-note">${pick('买下的家具会直接放进小窝；同一个位置放新的会替换旧的。', 'Furniture goes straight into the nest; a new piece replaces the old one in that place.')}</p>` : ''}
  </section>`;
}

// Item sheet: picture (furniture shown in a little nest preview), what it is, price, and the right actions.
export function openItemSheet(itemId, { state, data, earned, shieldsUsed, onBuy, onRefund, onEquip, onUnequip }) {
  const item = itemById(itemId); if (!item) return;
  const layer = document.createElement('div');
  layer.className = 'scene-sheet-layer';
  const draw = () => {
    const owned = item.kind !== 'tool' && state().owned.has(item.id), using = item.kind === 'decor' ? data().equipped[item.slot] === item.id : item.kind === 'frame' && data().frame === item.id;
    const last = [...data().purchases].reverse().find(p => p.item === item.id && !p.refunded), refundable = last && canRefund(data(), last, { shieldsUsed: shieldsUsed() });
    const short = state().balance < item.price, maxed = item.max && state().shieldsHeld >= item.max;
    const art = item.kind === 'decor'
      ? `<div class="shop-preview"><img class="shop-preview-nest" src="/illustrations/pet-nest.webp" alt="" decoding="async">${decorLayer(data().equipped, item.id)}</div>`
      : `<div class="shop-big"><img src="${itemImage(item.id)}" alt="" decoding="async"></div>`;
    const actions = item.kind === 'tool'
      ? `<button type="button" class="primary-button" data-sheet-buy ${short || maxed ? 'disabled' : ''}>${maxed ? pick('已达持有上限', 'Holding the most') : short ? pick('松果不够', 'Not enough cones') : pick('{n} 松果买下', 'Buy for {n}', { n: item.price })}</button>`
      : owned ? (using ? `<button type="button" class="secondary-button" data-sheet-unequip>${item.kind === 'frame' ? pick('取下', 'Take off') : pick('收起来', 'Put away')}</button>` : `<button type="button" class="primary-button" data-sheet-equip>${item.kind === 'frame' ? pick('戴上', 'Put on') : pick('放进小窝', 'Put in the nest')}</button>`)
      : `<button type="button" class="primary-button" data-sheet-buy ${short ? 'disabled' : ''}>${short ? pick('松果不够（还差 {n}）', 'Not enough cones ({n} short)', { n: item.price - state().balance }) : pick('{n} 松果买下', 'Buy for {n}', { n: item.price })}</button>`;
    layer.innerHTML = `<div class="scene-sheet shop-sheet tier-${item.tier}" role="dialog" aria-modal="true" aria-label="${e(itemName(item.id))}">
      <div class="scene-sheet-head"><h2>${e(itemName(item.id))}</h2><button type="button" class="scene-close" data-sheet-close aria-label="${pick('关闭', 'Close')}">✕</button></div>
      ${art}<p class="shop-desc"><span class="shop-tier-pill">${TIER()[item.tier]}</span>${e(DESC[item.id]())}</p>
      <p class="shop-have">${PINE}${pick('你有 {n} 颗松果', 'You have {n} pine cones', { n: state().balance })}${item.kind === 'tool' ? ` · ${pick('持有 {n} 张', 'holding {n}', { n: state().shieldsHeld })}` : ''}</p>
      <div class="shop-actions">${actions}${refundable ? `<button type="button" class="text-button" data-sheet-refund>${pick('退回（24 小时内原价退）', 'Return (full price within 24 h)')}</button>` : ''}</div>
      <p class="shop-msg" role="status"></p></div>`;
    const on = (sel, fn) => { const el = layer.querySelector(sel); if (el) el.onclick = fn; };
    on('[data-sheet-close]', close);
    on('[data-sheet-buy]', () => { const error = onBuy(item.id); if (error) layer.querySelector('.shop-msg').textContent = error; else { draw(); celebrate(); } });
    on('[data-sheet-equip]', () => { onEquip(item.id); draw(); });
    on('[data-sheet-unequip]', () => { onUnequip(item.id); draw(); });
    on('[data-sheet-refund]', () => { onRefund(last.id); draw(); });
  };
  const celebrate = () => { const sheet = layer.querySelector('.shop-sheet'); sheet?.classList.remove('is-bought'); void sheet?.offsetWidth; sheet?.classList.add('is-bought'); navigator.vibrate?.(10); };
  const close = () => { layer.classList.remove('open'); document.removeEventListener('keydown', onKey); setTimeout(() => layer.remove(), 220); };
  const onKey = event => { if (event.key === 'Escape') close(); };
  layer.addEventListener('click', event => { if (event.target === layer) close(); });
  document.addEventListener('keydown', onKey);
  draw(); document.body.append(layer); void layer.offsetWidth; layer.classList.add('open');
}
