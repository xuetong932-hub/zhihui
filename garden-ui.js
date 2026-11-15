// 小回's beanstalk page (pet tab → 通天藤). One whole picture per stage — the camera follows the top of the beanstalk
// from the yard up past roofs, the Great Wall, Mount Tai, the sea of clouds and snowy peaks to the stars — so nothing
// is stitched. Learning fills the watering can (garden.js); Backy pours it, the beanstalk grows, and a new stage rises
// in from above. The five achievement categories hang on it as fruits (journey.js), tapped for their records.
import { escapeHtml as e } from './chat-store.js';
import { pick, intlLocale, currentLocale } from './i18n.js';
import { STAGES, CANS, DROPS, HARVEST_CONES } from './garden.js';
import { stepText } from './journey-ui.js';

export const stageName = id => ({
  seed: pick('种子', 'Seed'), sprout: pick('嫩芽', 'Sprout'), seedling: pick('小苗', 'Seedling'), roof: pick('超过屋顶', 'Above the roof'),
  village: pick('俯瞰村庄', 'Over the village'), wall: pick('长城烽火台', 'Great Wall beacon'), hills: pick('越过山岭', 'Over the hills'),
  tai: pick('泰山之巅', 'Top of Mount Tai'), clouds: pick('穿过云海', 'Through the clouds'), snow: pick('雪线之上', 'Above the snow line'),
  everest: pick('世界之巅', 'Top of the world'), stars: pick('摸到星星', 'Touching the stars'),
})[id];
const passed = id => ({
  seed: pick('种下了一颗种子', 'A seed is planted'), sprout: pick('冒芽啦', 'It sprouted'), seedling: pick('比小回还高了', 'Taller than Backy'),
  roof: pick('超过屋顶', 'Above the roof'), village: pick('超过村口的大树', 'Taller than the village tree'), wall: pick('超过长城烽火台', 'Past the Great Wall beacon'),
  hills: pick('越过了山岭', 'Over the hills'), tai: pick('超过泰山', 'Past Mount Tai'), clouds: pick('穿过云海', 'Through the sea of clouds'),
  snow: pick('来到雪线之上', 'Above the snow line'), everest: pick('超过珠穆朗玛峰', 'Past Mount Everest'), stars: pick('摸到星星了', 'Touching the stars'),
})[id];
export const canName = level => [pick('铁皮小水壶', 'Tin can'), pick('陶瓷水壶', 'Ceramic can'), pick('铜水壶', 'Copper can'), pick('银水壶', 'Silver can'), pick('金色花洒', 'Golden sprinkler')][level - 1];
const CAT_NAME = () => ({ ask: pick('提问', 'Asking'), review: pick('复习', 'Review'), habit: pick('坚持', 'Habit'), collect: pick('收集', 'Collecting'), pet: pick('小回', 'Backy') });
const CAT_ICON = { ask: '💬', review: '🔁', habit: '🔥', collect: '📚', pet: '🐿️' };
const number = n => new Intl.NumberFormat(intlLocale(currentLocale()), { maximumFractionDigits: n < 10 ? 1 : 0 }).format(n);
export const heightText = (m, top) => top ? pick('太空边缘', 'Edge of space') : m < 1 ? pick('{n} 厘米', '{n} cm', { n: number(m * 100) }) : pick('{n} 米', '{n} m', { n: number(m) });
const date = day => { const [y, m, d] = day.split('-').map(Number); return new Intl.DateTimeFormat(intlLocale(currentLocale()), { year: 'numeric', month: 'short', day: 'numeric' }).format(new Date(y, m - 1, d)); };
export const stageImage = id => `/illustrations/grow/${id}.webp`;

// garden: gardenState(); tree: journey(); squirrel: Backy's picture markup; rising: the stage id it just grew from.
export function gardenView({ garden, tree, squirrel, rising = null }) {
  const { stage, next, index, can, nextCan } = garden, top = index === STAGES.length - 1;
  const fruits = tree.limbs.filter(limb => limb.items.length || limb.next);
  return `<section class="garden-page">
    <header class="book-top store-top"><button type="button" class="book-back" data-tree-back aria-label="${pick('回到小窝', 'Back to the nest')}">‹</button><strong>${pick('通天藤', 'Beanstalk')}</strong><span class="tree-count" aria-label="${pick('已点亮 {n} 个', '{n} lit', { n: tree.total })}">🌿 <b>${tree.total}</b></span></header>
    <div class="garden-stage stage-${index}${rising ? ' is-rising' : ''}">
      ${rising ? `<img class="garden-scene garden-scene-old" src="${stageImage(rising)}" alt="" decoding="async">` : ''}
      <img class="garden-scene" src="${stageImage(stage.id)}" alt="${e(stageName(stage.id))}" decoding="async">
      <div class="garden-height"><strong>${heightText(garden.height, top)}</strong><span>${e(passed(stage.id))}</span></div>
      <div class="garden-fruits${index < 3 ? ' is-row' : ''}">${fruits.map(limb => `<button type="button" class="garden-fruit cat-${limb.cat}" data-garden-cat="${limb.cat}" aria-label="${CAT_NAME()[limb.cat]} ${limb.items.length}"><span aria-hidden="true">${CAT_ICON[limb.cat]}</span><b>${limb.items.length}</b></button>`).join('')}</div>
      <div class="garden-helper"><span class="garden-squirrel">${squirrel}</span><img class="garden-can" src="/illustrations/grow/can-${can.level}.webp" alt="" decoding="async"><span class="garden-drops" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></span></div>
      <p class="garden-toast" role="status"></p>
    </div>
    <div class="garden-panel">
      <div class="garden-can-row"><img src="/illustrations/grow/can-${can.level}.webp" alt="" decoding="async">
        <div class="garden-can-text"><strong>${canName(can.level)} <em>Lv.${can.level}</em></strong>
          <span class="garden-water" role="progressbar" aria-valuemin="0" aria-valuemax="${can.capacity}" aria-valuenow="${garden.inCan}"><b data-garden-fill="${Math.round(garden.inCan / can.capacity * 100)}"></b></span>
          <small>💧 ${garden.inCan} / ${can.capacity}${garden.barrel ? ` · ${pick('雨水桶 {n}', 'barrel {n}', { n: garden.barrel })}` : ''}</small></div>
        <button type="button" class="primary-button garden-pour" data-garden-pour ${garden.inCan ? '' : 'disabled'}>${pick('浇水', 'Water')}</button></div>
      ${garden.ripe ? `<button type="button" class="garden-harvest" data-garden-harvest>✨ ${pick('收获金松果（+{n} 松果）', 'Harvest a golden cone (+{n} pine cones)', { n: HARVEST_CONES })}</button>` : ''}
      <div class="garden-next">${next ? `<span>${pick('下一站', 'Next')} · ${e(stageName(next.id))}</span><span class="garden-bar"><b data-garden-fill="${Math.round(garden.progress * 100)}"></b></span>` : `<span>${pick('每浇 {n} 成长结一颗金松果', 'A golden cone every {n} growth', { n: 200 })}</span>`}
        ${nextCan ? `<small>${pick('再浇 {n} 滴，换成{name}', 'Pour {n} more drops for the {name}', { n: nextCan.need - garden.poured, name: canName(nextCan.level) })}</small>` : ''}</div>
      <p class="garden-rules">${pick('提问 +{a} · 复习 +{r} · 学会 +{l} · 完成目标 +{g} 💧，每天最多 {c}', 'Ask +{a} · review +{r} · learn +{l} · goal +{g} 💧, at most {c} a day', { a: DROPS.ask, r: DROPS.review, l: DROPS.learned, g: DROPS.goalDay, c: DROPS.dailyCap })}</p>
    </div>
    ${tree.seed ? `<div class="tree-seed"><strong>${pick('种下第一颗种子', 'The first seed')}</strong><small>${e(date(tree.seed.day))}</small>${tree.seed.text ? `<q>${e(tree.seed.text.slice(0, 60))}</q>` : ''}</div>` : ''}
  </section>`;
}

// A category fruit, opened: its milestones (newest first, with days) and its next goal.
export function openLimb(limb) {
  if (!limb) return;
  const layer = document.createElement('div');
  layer.className = 'scene-sheet-layer';
  const row = (step, locked) => { const text = stepText(step); return `<li class="limb-row frame-${step.frame}${locked ? ' is-locked' : ''}"><span class="tree-badge"><img src="${text.icon}" alt="" loading="lazy" decoding="async"></span><span><strong>${e(text.title)}</strong><small>${locked ? pick('进度 {have} / {need}', 'Progress {have} / {need}', { have: step.have, need: step.need }) : e(text.rule)}</small></span><em>${locked ? '' : e(date(step.day))}</em></li>`; };
  layer.innerHTML = `<div class="scene-sheet limb-sheet cat-${limb.cat}" role="dialog" aria-modal="true" aria-label="${CAT_NAME()[limb.cat]}">
    <div class="scene-sheet-head"><h2>${CAT_ICON[limb.cat]} ${CAT_NAME()[limb.cat]} · ${limb.items.length}</h2><button type="button" class="scene-close" data-sheet-close aria-label="${pick('关闭', 'Close')}">✕</button></div>
    <ol class="limb-list">${limb.next ? row(limb.next, true) : ''}${[...limb.items].reverse().map(step => row(step, false)).join('')}</ol></div>`;
  const close = () => { layer.classList.remove('open'); document.removeEventListener('keydown', onKey); setTimeout(() => layer.remove(), 220); };
  const onKey = event => { if (event.key === 'Escape') close(); };
  layer.addEventListener('click', event => { if (event.target === layer || event.target.closest('[data-sheet-close]')) close(); });
  document.addEventListener('keydown', onKey);
  document.body.append(layer); void layer.offsetWidth; layer.classList.add('open');
}
export { CANS };
