// 小回's growth tree page (pet tab → 成长树), drawn as a vine. The leafy crown is today, with Backy on it and the next two goals still grey;
// scrolling down goes back in time along the trunk, one branch per milestone, left and right in turn; at the roots
// the seed shows the day of the first question. Data: journey.js.
import { escapeHtml as e } from './chat-store.js';
import { pick, intlLocale, currentLocale } from './i18n.js';
import { JOURNEY_CATS } from './journey.js';
import { badgeName, RULE, levelTitle } from './badges-ui.js';
import { itemName, itemIcon } from './shop-ui.js';

const CAT_NAME = () => ({ ask: pick('提问', 'Asking'), review: pick('复习', 'Review'), habit: pick('坚持', 'Habit'), collect: pick('收集', 'Collecting'), pet: pick('小回', 'Backy') });
const TIER = () => [pick('铜', 'Bronze'), pick('银', 'Silver'), pick('金', 'Gold')];
const date = day => {
  if (!day) return pick('很久以前', 'A while ago');
  const [y, m, d] = day.split('-').map(Number);
  return new Intl.DateTimeFormat(intlLocale(currentLocale()), { year: 'numeric', month: 'short', day: 'numeric' }).format(new Date(y, m - 1, d));
};
export function stepText(step) {
  if (step.kind === 'badge') return { title: `${badgeName(step.id)}${step.tiers.length > 1 ? ` · ${TIER()[step.tier - 1]}` : ''}`, rule: RULE[step.id](step.need), icon: `/illustrations/badges/${step.id}.webp` };
  if (step.kind === 'level') return { title: pick('升到 Lv.{n}', 'Reached Lv.{n}', { n: step.level }), rule: levelTitle(step.level), icon: '/illustrations/mascot-cheer.webp' };
  if (step.kind === 'ask') return { title: pick('提问 {n} 次', '{n} questions', { n: step.need }), rule: pick('累计提出 {n} 个问题', 'Asked {n} questions in all', { n: step.need }), icon: '/illustrations/badges/first.webp' };
  return { title: pick('第一件新衣服', 'First outfit piece'), rule: itemName(step.item), icon: itemIcon(step.item) };
}
const node = (step, locked) => {
  const text = stepText(step);
  const sub = locked ? pick('还差 {n}', '{n} to go', { n: step.need - step.have }) : date(step.day);
  return `<li class="tree-node cat-${step.cat} frame-${step.frame}${locked ? ' is-locked' : ''}">
    <button type="button" class="tree-step" data-tree-step="${e(step.key)}">
      <span class="tree-badge"><img src="${text.icon}" alt="" loading="lazy" decoding="async"></span>
      <span class="tree-text"><strong>${e(text.title)}</strong><small>${e(sub)}</small>${locked ? `<i class="tree-meter" role="presentation"><b data-tree-fill="${Math.round(step.ratio * 100)}"></b></i>` : ''}</span></button></li>`;
};
// tree: journey() output; squirrel: the picture markup for Backy on the canopy. The trunk forks into one limb per
// category, left and right in turn (小回 nearest the canopy, 提问 nearest the seed); each limb carries its milestones,
// newest at its tip, with its next goal greyed out above them.
const LIMB_ORDER = [...JOURNEY_CATS].reverse();
export function treeView({ tree, squirrel }) {
  const limb = (entry, i) => {
    const side = i % 2 ? 'left' : 'right', steps = [...(entry.next ? [node(entry.next, true)] : []), ...[...entry.items].reverse().map(step => node(step, false))];
    // The limb is one tendril: it leaves the main vine at the fork (bottom), curves out and rises past its milestones.
    return `<li class="tree-limb side-${side} cat-${entry.cat}">
      <svg class="limb-vine" viewBox="0 0 64 100" preserveAspectRatio="none" aria-hidden="true"><path d="M0 100 C 30 100 48 96 48 84 L 48 4" vector-effect="non-scaling-stroke"/><path d="M-2 98 C 28 98 45 94 45 84 L 45 4" class="hi" vector-effect="non-scaling-stroke"/></svg>
      <ol class="limb-steps">${steps.join('')}</ol>
      <div class="limb-fork"><span class="limb-name">${CAT_NAME()[entry.cat]} <b>${entry.items.length}</b></span></div></li>`;
  };
  return `<section class="tree-page">
    <header class="book-top store-top"><button type="button" class="book-back" data-tree-back aria-label="${pick('回到小窝', 'Back to the nest')}">‹</button><strong>${pick('小回的成长树', 'Backy’s growth tree')}</strong><span class="tree-count" aria-label="${pick('已点亮 {n} 个', '{n} lit', { n: tree.total })}">🌿 <b>${tree.total}</b></span></header>
    <div class="tree">
      <div class="tree-crown"><img class="tree-canopy" src="/illustrations/tree/vine-top.webp" alt="" decoding="async"><span class="tree-squirrel">${squirrel}</span></div>
      <ol class="tree-trunk">${LIMB_ORDER.map(cat => tree.limbs.find(entry => entry.cat === cat)).filter(entry => entry && (entry.items.length || entry.next)).map(limb).join('')}</ol>
      <div class="tree-roots"><img src="/illustrations/tree/vine-bottom.webp" alt="" decoding="async">
        ${tree.seed ? `<div class="tree-seed"><strong>${pick('种下第一颗种子', 'The first seed')}</strong><small>${e(date(tree.seed.day))}</small>${tree.seed.text ? `<q>${e(tree.seed.text.slice(0, 60))}</q>` : ''}</div>` : `<div class="tree-seed"><strong>${pick('提一个问题，种下第一颗种子', 'Ask a question to plant the first seed')}</strong></div>`}</div>
    </div>
  </section>`;
}
// One step, larger: what it is, how it was earned and when (or how far along it is).
export function openStep(step) {
  if (!step) return;
  const text = stepText(step), locked = step.have !== undefined;
  const layer = document.createElement('div');
  layer.className = 'scene-sheet-layer';
  layer.innerHTML = `<div class="scene-sheet tree-sheet cat-${step.cat} frame-${step.frame}${locked ? ' is-locked' : ''}" role="dialog" aria-modal="true" aria-label="${e(text.title)}">
    <div class="scene-sheet-head"><h2>${e(text.title)}</h2><button type="button" class="scene-close" data-sheet-close aria-label="${pick('关闭', 'Close')}">✕</button></div>
    <div class="tree-sheet-art"><span class="tree-badge"><img src="${text.icon}" alt="" decoding="async"></span></div>
    <p class="tree-sheet-rule"><span class="tree-cat">${CAT_NAME()[step.cat]}</span>${e(text.rule)}</p>
    <p class="tree-sheet-day">${locked ? pick('进度 {have} / {need}', 'Progress {have} / {need}', { have: step.have, need: step.need }) : pick('在 {day} 点亮', 'Lit on {day}', { day: date(step.day) })}</p></div>`;
  const close = () => { layer.classList.remove('open'); document.removeEventListener('keydown', onKey); setTimeout(() => layer.remove(), 220); };
  const onKey = event => { if (event.key === 'Escape') close(); };
  layer.addEventListener('click', event => { if (event.target === layer || event.target.closest('[data-sheet-close]')) close(); });
  document.addEventListener('keydown', onKey);
  document.body.append(layer); void layer.offsetWidth; layer.classList.add('open');
}
