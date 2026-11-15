// The squirrel's store page (pet tab → 仓库): its level card and a badge wall in the metal-enamel style of the
// reference achievement set. Tap a badge = it grows in the middle and turns slowly with a metal sheen; a newly earned
// tier is celebrated once per device. Data comes from achievements.js (worked out from the history).
import { escapeHtml as e } from './chat-store.js';
import { pick } from './i18n.js';
import { BADGES } from './achievements.js';

export const levelTitle = level => [pick('小松苗', 'Sprout'), pick('拾果学徒', 'Cone gatherer'), pick('储粮能手', 'Keen storer'), pick('林间学者', 'Forest scholar'), pick('松林智者', 'Pine sage'), pick('森林守护者', 'Forest keeper')][level - 1];
const TIER = () => [pick('铜', 'Bronze'), pick('银', 'Silver'), pick('金', 'Gold')];
const NAME = {
  first: () => pick('初次提问', 'First question'), learned: () => pick('学会知识点', 'Ideas learned'), streak: () => pick('连续达标', 'Goal streak'),
  reviews: () => pick('复习达人', 'Reviewer'), cones: () => pick('松果收藏家', 'Cone collector'), polymath: () => pick('博学多才', 'All-rounder'),
  early: () => pick('早起鸟', 'Early bird'), night: () => pick('夜读', 'Night reader'), books: () => pick('藏书家', 'Book maker'), month: () => pick('全勤月', 'Perfect month'),
};
export const RULE = {
  first: () => pick('完成第一次提问', 'Ask your first question'), learned: n => pick('学会 {n} 个知识点', 'Learn {n} ideas', { n }),
  streak: n => pick('连续 {n} 天完成每日目标', 'Meet the daily goal {n} days in a row', { n }), reviews: n => pick('累计复习 {n} 次', 'Review {n} times', { n }),
  cones: n => pick('收集 {n} 颗松果', 'Collect {n} pine cones', { n }), polymath: n => pick('4 本书各学会 {n} 个知识点', 'Learn {n} ideas in each of 4 books', { n }),
  early: n => pick('早上 8 点前复习 {n} 次', 'Review before 8 am {n} times', { n }), night: n => pick('晚上 10 点后复习 {n} 次', 'Review after 10 pm {n} times', { n }),
  books: n => pick('自己建 {n} 本书', 'Make {n} books of your own', { n }), month: () => pick('一个自然月每天都完成目标', 'Meet the goal every day of a calendar month'),
};
export const badgeName = id => NAME[id]();
const stars = (tier, max) => max > 1 ? `<span class="badge-stars" aria-hidden="true">${Array.from({ length: max }, (_, i) => `<i class="${i < tier ? 'on' : ''}"></i>`).join('')}</span>` : '';
const tierLabel = (badge, tier) => badge.tiers.length > 1 ? TIER()[tier - 1] : '';

// Level card: avatar, Lv pill, title, progress bar and the cones needed for the next level.
export function levelCard(level, avatar) {
  const next = level.next === null ? pick('已经是最高等级啦', 'Top level reached') : pick('再收集 {n} 颗松果升到 Lv.{lv} {title}', '{n} more pine cones to Lv.{lv} {title}', { n: level.next - level.cones, lv: level.level + 1, title: levelTitle(level.level + 1) });
  return `<div class="level-card"><span class="level-avatar"><img src="${avatar}" alt="" decoding="async"></span>
      <div class="level-text"><span class="level-lv">Lv.${level.level}</span><strong>${levelTitle(level.level)}</strong>
      <span class="level-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(level.progress * 100)}" aria-label="${e(next)}"><i data-level="${Math.round(level.progress * 100)}"></i></span><span class="level-next">${e(next)}</span></div></div>`;
}
export const badgeCount = badges => ({ got: badges.reduce((sum, badge) => sum + badge.tier, 0), total: BADGES.reduce((sum, badge) => sum + badge.tiers.length, 0) });

// The squirrel's store: its level and pine cones; the badge wall lives on the profile page (我的 → avatar).
export function storeView({ level, badges, cones, mascot }) {
  const { got, total } = badgeCount(badges);
  return `<section class="store-page">
    <header class="book-top store-top"><button type="button" class="book-back" data-store-back aria-label="${pick('回到小窝', 'Back to the nest')}">‹</button><strong>${pick('小回的仓库', 'Backy’s store')}</strong><span></span></header>
    ${levelCard(level, `/illustrations/mascot-${mascot}.webp`)}
    <div class="store-stats"><span><b>${cones}</b>${pick('松果', 'pine cones')}</span><span><b>${got}/${total}</b>${pick('徽章', 'badges')}</span></div>
    <button type="button" class="store-link" data-go-badges>${pick('徽章墙在「我的 → 个人主页」', 'The badge wall is in Me → Profile')} ›</button>
  </section>`;
}

export function badgeWall(badges) {
  return `<div class="badge-wall">${badges.map(badge => {
      const last = badge.earned[badge.earned.length - 1];
      const sub = badge.tier ? (last.day ? last.day.slice(5).replace('-', '.') : pick('已获得', 'Earned')) : `${Math.min(badge.progress, badge.next)}/${badge.next}`;
      return `<button type="button" class="badge tier-${badge.tier}" data-badge="${badge.id}" aria-label="${e(badgeName(badge.id))}${badge.tier ? ` ${tierLabel(badge, badge.tier)}` : ''}，${e(sub)}">
        <span class="badge-art"><img src="/illustrations/badges/${badge.id}.webp" alt="" decoding="async">${badge.tier ? '' : '<span class="badge-lock" aria-hidden="true">🔒</span>'}</span>
        ${stars(badge.tier, badge.tiers.length)}<strong>${e(badgeName(badge.id))}</strong><span class="badge-sub">${e(sub)}</span></button>`;
    }).join('')}</div>`;
}

const reduced = () => globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
function overlay(html, className) {
  const layer = document.createElement('div');
  layer.className = `badge-layer ${className}`; layer.setAttribute('role', 'dialog'); layer.setAttribute('aria-modal', 'true');
  layer.innerHTML = html; document.body.append(layer);
  void layer.offsetWidth; layer.classList.add('open');
  return new Promise(resolve => {
    // Resolves with 'go' when "See it" was chosen.
    const close = choice => { layer.classList.remove('open'); document.removeEventListener('keydown', onKey); setTimeout(() => layer.remove(), reduced() ? 0 : 220); resolve(choice); };
    const onKey = event => { if (event.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    layer.addEventListener('click', event => { const button = event.target.closest('[data-badge-close]'); if (event.target === layer || button) close(button?.hasAttribute('data-badge-go') ? 'go' : undefined); });
    layer.querySelector('.primary-button[data-badge-close]')?.focus({ preventScroll: true });
  });
}

// One badge, large and turning, with its rule, the days each tier was reached and what the next tier needs.
export function showBadge(badge) {
  const rows = badge.tiers.map((need, i) => { const got = badge.earned[i];
    return `<li class="${got ? 'got' : ''}"><span>${tierLabel(badge, i + 1) || pick('达成', 'Done')}</span><span>${e(RULE[badge.id](need))}</span><span>${got ? (got.day || pick('已获得', 'Earned')) : `${Math.min(badge.progress, need)}/${need}`}</span></li>`; }).join('');
  return overlay(`<div class="badge-detail tier-${badge.tier}"><div class="badge-big"><img src="/illustrations/badges/${badge.id}.webp" alt="" decoding="async"><span class="badge-sheen" aria-hidden="true"></span></div>
    ${stars(badge.tier, badge.tiers.length)}<h2>${e(badgeName(badge.id))}</h2>
    <p>${badge.tier ? (tierLabel(badge, badge.tier) ? pick('已获得 · {tier}', '{tier} earned', { tier: tierLabel(badge, badge.tier) }) : pick('已获得', 'Earned')) : pick('还没有获得', 'Not earned yet')}</p>
    <ul class="badge-tiers">${rows}</ul><button type="button" class="primary-button" data-badge-close>${pick('好的', 'OK')}</button></div>`, 'is-detail');
}

// A newly earned tier: rays, the badge springs out turning, a sparkle, and its name.
export function celebrateBadge(badge, tier) {
  return overlay(`<div class="badge-celebrate"><span class="badge-rays" aria-hidden="true"></span><div class="badge-big tier-${tier}"><img src="/illustrations/badges/${badge.id}.webp" alt="" decoding="async"><span class="badge-sheen" aria-hidden="true"></span></div>
    <p class="badge-new">${pick('获得新徽章', 'New badge')}</p><h2>${e(badgeName(badge.id))}${tierLabel(badge, tier) ? ` · ${tierLabel(badge, tier)}` : ''}</h2>${stars(tier, badge.tiers.length)}
    <div class="badge-actions"><button type="button" class="text-button" data-badge-close data-badge-go>${pick('去看看', 'See it')}</button><button type="button" class="primary-button" data-badge-close>${pick('收下', 'Keep it')}</button></div></div>`, 'is-celebrate');
}
