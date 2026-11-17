// 学习日历 (我的 → learning summary → 学习日历): one month at a time, each day a rounded block whose colour shows how
// much was learned that day — cards reviewed plus questions asked — against the daily goal. Read from the history on
// this device; nothing is stored.
import { pick, currentLocale, intlLocale } from './i18n.js';
import { localDay } from './knowledge-store.js';

// day ('YYYY-MM-DD') → { reviews: distinct cards reviewed, questions: questions asked }
export function activityByDay({ events = [], questions = [] }) {
  const days = new Map(), get = day => { if (!days.has(day)) days.set(day, { reviews: 0, questions: 0, cards: new Set() }); return days.get(day); };
  for (const event of events) { const date = new Date(event.at); if (!Number.isFinite(date.getTime())) continue; const entry = get(localDay(date)); if (!entry.cards.has(event.cardId)) { entry.cards.add(event.cardId); entry.reviews += 1; } }
  for (const at of questions) { const date = new Date(at); if (Number.isFinite(date.getTime())) get(localDay(date)).questions += 1; }
  return new Map([...days].map(([day, entry]) => [day, { reviews: entry.reviews, questions: entry.questions }]));
}
// 0 nothing · 1 under half the goal · 2 under the goal · 3 goal met · 4 twice the goal or more.
export function intensity(amount, goal = 10) {
  if (!amount) return 0;
  const target = Math.max(1, goal);
  return amount >= target * 2 ? 4 : amount >= target ? 3 : amount * 2 >= target ? 2 : 1;
}
// The weeks of one month, Sunday first; null pads the first and last week.
export function monthWeeks(year, month) {
  const first = new Date(year, month, 1).getDay(), count = new Date(year, month + 1, 0).getDate(), cells = [];
  for (let i = 0; i < first; i++) cells.push(null);
  for (let day = 1; day <= count; day++) cells.push(day);
  while (cells.length % 7) cells.push(null);
  const weeks = []; for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}
const pad = n => String(n).padStart(2, '0');
const dayKey = (year, month, day) => `${year}-${pad(month + 1)}-${pad(day)}`;
export const activeDaysIn = (activity, year, month) => [...activity.keys()].filter(day => day.startsWith(`${year}-${pad(month + 1)}-`)).length;

// The sheet. streak: current day streak; goal: daily goal.
export function openLearningCalendar({ events, questions, goal, streak, now = new Date() }) {
  if (document.querySelector('.scene-sheet-layer')) return;
  const activity = activityByDay({ events, questions });
  const earliest = [...activity.keys()].sort()[0];
  const [minYear, minMonth] = earliest ? earliest.split('-').map(Number) : [now.getFullYear(), now.getMonth() + 1];
  let year = now.getFullYear(), month = now.getMonth(), picked = localDay(now);
  const today = localDay(now), locale = intlLocale(currentLocale());
  const title = new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'long' });
  const dayName = new Intl.DateTimeFormat(locale, { month: 'long', day: 'numeric' });
  const weekdays = Array.from({ length: 7 }, (_, i) => new Intl.DateTimeFormat(locale, { weekday: 'narrow' }).format(new Date(2026, 10, 15 + i)));
  const layer = document.createElement('div');
  layer.className = 'scene-sheet-layer calendar-layer';
  const atStart = () => year < minYear || (year === minYear && month + 1 <= minMonth);
  const atEnd = () => year === now.getFullYear() && month === now.getMonth();
  const detail = () => {
    const entry = activity.get(picked), [y, m, d] = picked.split('-').map(Number), name = dayName.format(new Date(y, m - 1, d));
    if (!entry) return `${name} · ${pick('没有学习记录', 'Nothing learned')}`;
    return `${name} · ${pick('复习 {n} 张', '{n} cards reviewed', { n: entry.reviews })} · ${pick('提问 {q} 次', '{q} questions', { q: entry.questions })}`;
  };
  const draw = () => {
    const cells = monthWeeks(year, month).map(week => week.map(day => {
      if (!day) return '<span class="cal-day is-empty"></span>';
      const key = dayKey(year, month, day), entry = activity.get(key), level = key > today ? -1 : intensity(entry ? entry.reviews + entry.questions : 0, goal);
      if (level < 0) return `<span class="cal-day is-future"><span>${day}</span></span>`;
      return `<button type="button" class="cal-day lv-${level} ${key === today ? 'is-today' : ''} ${key === picked ? 'is-picked' : ''}" data-cal-day="${key}" aria-pressed="${key === picked}" aria-label="${day}"><span>${day}</span></button>`;
    }).join('')).join('');
    layer.innerHTML = `<div class="scene-sheet calendar-sheet" role="dialog" aria-modal="true" aria-label="${pick('学习日历', 'Learning calendar')}">
      <div class="scene-sheet-head"><h2>${pick('学习日历', 'Learning calendar')}</h2><button type="button" class="scene-close" data-sheet-close aria-label="${pick('关闭', 'Close')}">✕</button></div>
      <div class="cal-nav"><button type="button" class="cal-step" data-cal-step="-1" aria-label="${pick('上个月', 'Previous month')}" ${atStart() ? 'disabled' : ''}>‹</button><strong>${title.format(new Date(year, month, 1))}</strong><button type="button" class="cal-step" data-cal-step="1" aria-label="${pick('下个月', 'Next month')}" ${atEnd() ? 'disabled' : ''}>›</button></div>
      <div class="cal-grid"><span class="cal-head">${weekdays.join('</span><span class="cal-head">')}</span>${cells}</div>
      <p class="cal-detail" role="status">${detail()}</p>
      <div class="cal-foot"><span>${pick('连续 {n} 天', '{n}-day streak', { n: streak })} · ${pick('本月学习 {m} 天', '{m} days this month', { m: activeDaysIn(activity, year, month) })}</span><span class="cal-legend">${pick('较少', 'Less')}<i class="lv-0"></i><i class="lv-1"></i><i class="lv-2"></i><i class="lv-3"></i><i class="lv-4"></i>${pick('更多', 'More')}</span></div>
    </div>`;
    layer.querySelector('[data-sheet-close]').onclick = close;
    layer.querySelectorAll('[data-cal-step]').forEach(button => { button.onclick = () => { month += Number(button.dataset.calStep); if (month < 0) { month = 11; year -= 1; } if (month > 11) { month = 0; year += 1; } draw(); }; });
    layer.querySelectorAll('[data-cal-day]').forEach(button => { button.onclick = () => { picked = button.dataset.calDay; draw(); layer.querySelector(`[data-cal-day="${picked}"]`)?.focus(); }; });
  };
  const close = () => { layer.classList.remove('open'); document.removeEventListener('keydown', onKey); setTimeout(() => layer.remove(), 220); document.querySelector('[data-me-calendar]')?.focus({ preventScroll: true }); };
  const onKey = event => { if (event.key === 'Escape') close(); };
  layer.addEventListener('click', event => { if (event.target === layer) close(); });
  document.addEventListener('keydown', onKey);
  draw(); document.body.append(layer); void layer.offsetWidth; layer.classList.add('open');
  layer.querySelector('.cal-day.is-today')?.focus({ preventScroll: true });
}
