// 会员中心 (个人主页 → 知回会员): who you are, the 知回会员 card (not open yet, nothing is charged), the perks it will
// bring, the pine cones you can spend, and today's tasks read from the learning history. The task rewards are the
// existing beanstalk and pine-cone rules; this page only shows them, it never grants anything itself.
import { escapeHtml as e } from './chat-store.js';
import { pick } from './i18n.js';
import { DROPS } from './garden.js';
import { localDay } from './knowledge-store.js';

const GOAL_CONES = 3;
const PERKS = () => [
  ['outfit', '/illustrations/world/shop.webp', pick('专属装扮', 'Member outfits'), pick('只有会员能穿的小回装扮。', 'Outfits for 小回 that only members can wear.')],
  ['drops', '/illustrations/grow/can-5.webp', pick('双倍水滴', 'Double drops'), pick('学习得到的水滴翻倍，通天藤长得更快。', 'Drops from learning count twice, so the beanstalk grows faster.')],
  ['frame', '/illustrations/world/frame.webp', pick('专属头像框', 'Member frames'), pick('会员专属的头像框。', 'Avatar frames for members.')],
  ['report', '/illustrations/world/report.webp', pick('学习报告', 'Learning report'), pick('每周一份学习小结：学了什么、记住了多少。', 'A weekly summary: what you learned and how much stuck.')],
];

// Today's tasks from the history. questions: dates of the user's questions; events: review events; goal: daily goal.
export function dailyTasks({ questions = [], events = [], goal = 10, now = new Date() }) {
  const today = localDay(now);
  const asked = questions.filter(at => localDay(new Date(at)) === today).length;
  const reviewed = new Set(events.filter(event => localDay(new Date(event.at)) === today).map(event => event.cardId)).size;
  const target = Math.max(1, goal);
  return [
    { id: 'ask', done: asked > 0, count: asked },
    { id: 'review', done: reviewed > 0, count: reviewed },
    { id: 'goal', done: reviewed >= target, count: Math.min(reviewed, target), target },
  ];
}

const TASK_TEXT = () => ({
  ask: { title: pick('提一个问题', 'Ask a question'), reward: pick('+{n} 水滴', '+{n} drops', { n: DROPS.ask }), go: pick('去提问', 'Ask'), icon: 'ask' },
  review: { title: pick('复习卡片', 'Review cards'), reward: pick('每张 +{n} 水滴', '+{n} drop each', { n: DROPS.review }), go: pick('去复习', 'Review'), icon: 'review' },
  goal: { title: pick('完成今日目标', 'Meet today’s goal'), reward: pick('+{n} 水滴 · +{c} 松果', '+{n} drops · +{c} cones', { n: DROPS.goalDay, c: GOAL_CONES }), go: pick('去完成', 'Go'), icon: 'goal' },
});
const TASK_ICON = {
  ask: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg>',
  review: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12a8 8 0 0 1 14-5.3L20 9M20 4v5h-5M20 12a8 8 0 0 1-14 5.3L4 15M4 20v-5h5"/></svg>',
  goal: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r=".8" fill="currentColor"/></svg>',
};

export function memberView({ name, level, title, avatar, balance, tasks, pine }) {
  const text = TASK_TEXT();
  const task = item => {
    const t = text[item.id];
    const note = item.id === 'review' && item.count ? pick('已复习 {n} 张', '{n} reviewed', { n: item.count }) : item.id === 'goal' ? `${item.count} / ${item.target} · ${t.reward}` : t.reward;
    return `<div class="member-task task-${item.id} ${item.done ? 'is-done' : ''}"><span class="member-task-icon">${TASK_ICON[t.icon]}</span><strong>${t.title}</strong><small>${note}</small>
      ${item.done ? `<span class="member-task-btn is-done">${pick('已完成', 'Done')}</span>` : `<button type="button" class="member-task-btn" data-member-task="${item.id}">${t.go}</button>`}</div>`;
  };
  return `<section class="member-page">
    <header class="book-top store-top member-top"><button type="button" class="book-back" data-member-back aria-label="${pick('返回', 'Back')}">‹</button><strong>${pick('会员中心', 'Member centre')}</strong><span></span></header>
    <div class="member-hero"><span class="member-avatar"><img src="${avatar}" alt="" decoding="async"></span><div class="member-who"><h1>${e(name)}</h1><span class="member-lv">Lv.${level} ${e(title)}</span></div>
      <img class="member-mascot" src="/illustrations/mascot-wave.webp" alt="" decoding="async"></div>
    <div class="member-card"><img src="/illustrations/world/vip.webp" alt="" decoding="async"><div><strong>${pick('知回会员', 'KnowBack Plus')}</strong><span>${pick('即将开放', 'Coming soon')}</span></div><button type="button" class="member-more" data-member-about>${pick('了解一下', 'Learn more')} ›</button></div>
    <div class="member-perks">${PERKS().map(([id, src, label]) => `<button type="button" class="member-perk" data-member-about="${id}"><img src="${src}" alt="" decoding="async"><span>${label}</span></button>`).join('')}</div>
    <div class="member-points"><span class="member-coin">${pine}</span><b>${balance}</b><span class="member-points-label">${pick('可用松果', 'Pine cones to spend')}</span><button type="button" class="member-exchange" data-member-shop>${pick('去兑换', 'Spend')}</button></div>
    <section class="member-tasks"><div class="section-heading"><h2>${pick('每日任务', 'Daily tasks')}</h2></div><div class="member-task-row">${tasks.map(task).join('')}</div></section>
  </section>`;
}

// "了解一下": what membership will bring. Plain bottom sheet; no prices, nothing to buy.
export function openMemberAbout(focus = '') {
  if (document.querySelector('.scene-sheet-layer')) return;
  const layer = document.createElement('div');
  layer.className = 'scene-sheet-layer';
  layer.innerHTML = `<div class="scene-sheet member-about" role="dialog" aria-modal="true" aria-label="${pick('知回会员', 'KnowBack Plus')}">
    <div class="scene-sheet-head"><h2>${pick('知回会员', 'KnowBack Plus')}</h2><button type="button" class="scene-close" data-sheet-close aria-label="${pick('关闭', 'Close')}">✕</button></div>
    <ul class="member-about-list">${PERKS().map(([id, src, label, note]) => `<li class="${id === focus ? 'is-focus' : ''}"><img src="${src}" alt="" decoding="async"><span><strong>${label}</strong><small>${note}</small></span></li>`).join('')}</ul>
    <p class="member-about-note">${pick('会员还没有开放，现在不会收取任何费用。', 'Membership is not open yet; nothing is charged.')}</p>
  </div>`;
  const close = () => { layer.classList.remove('open'); document.removeEventListener('keydown', onKey); setTimeout(() => layer.remove(), 220); };
  const onKey = event => { if (event.key === 'Escape') close(); };
  layer.addEventListener('click', event => { if (event.target === layer) close(); });
  layer.querySelector('[data-sheet-close]').onclick = close;
  document.addEventListener('keydown', onKey);
  document.body.append(layer); void layer.offsetWidth; layer.classList.add('open');
  layer.querySelector('[data-sheet-close]').focus({ preventScroll: true });
}
