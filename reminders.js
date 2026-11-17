// Review reminders (push): when to remind and what 小回 says. At most two a day — a morning one from 09:00 when cards
// are due, an evening one at 20:00 only when that day has no review yet — planned for today and the next two days.
// The plan (times, kind, counts; no card content) is handed to the account service; the server sends what is due.
// The lines are written for 知回 in 小回's voice; one is picked at random, never the same twice in a row.
import { localDay } from './knowledge-store.js';
import { dueInfo, latestReview, planOf } from './review-store.js';
import { isActiveModule } from './modules.js';
import { translate } from './i18n.js';

export const MORNING_HOUR = 9, EVENING_HOUR = 20, PLAN_DAYS = 3;

const addDays = (date, n) => { const d = new Date(date); d.setDate(d.getDate() + n); return d; };
const at = (day, hour) => { const [y, m, d] = day.split('-').map(Number); return new Date(y, m - 1, d, hour, 0, 0, 0); };

// Cards due by the end of each of the next `days` days (today first), counting only cards that will need review.
export function dueByDay(cards, reviews, profile, now = new Date(), days = PLAN_DAYS) {
  const off = planOf(profile).off, counts = Array(days).fill(0), today = localDay(now);
  const reviewedToday = new Set(reviews.events.filter(event => localDay(event.at) === today).map(event => event.cardId));
  for (const card of cards) {
    if (card.status !== 'active' || card.extraction !== 'ready' || !isActiveModule(profile, card.module) || off.includes(card.module)) continue;
    const info = dueInfo(card, latestReview(reviews, card.id)), day = info.at ? localDay(info.at) : info.day;
    for (let i = 0; i < days; i++) if (day <= localDay(addDays(now, i)) && !(i === 0 && reviewedToday.has(card.id) && !info.at)) counts[i]++;
  }
  return counts;
}

// The slots to send: [{ at: ISO, kind: 'morning' | 'evening', n, d }]. reviewedToday drops today's evening reminder.
export function planReminders({ now = new Date(), due = [], reviewedToday = false, streak = 0 }) {
  const slots = [];
  for (let i = 0; i < due.length; i++) {
    const n = due[i]; if (!n) continue;
    const day = localDay(addDays(now, i)), morning = at(day, MORNING_HOUR), evening = at(day, EVENING_HOUR);
    if (morning > now) slots.push({ at: morning.toISOString(), kind: 'morning', n, d: i === 0 ? streak : 0 });
    if (evening > now && !(i === 0 && reviewedToday)) slots.push({ at: evening.toISOString(), kind: i === 0 && streak >= 2 ? 'streak' : 'evening', n, d: i === 0 ? streak : 0 });
  }
  return slots;
}

// 小回's lines. {n} = cards due, {d} = days in a row. English is the catalogue key for the other languages.
export const LINES = {
  morning: [
    ['小回把今天的 {n} 张卡片摆好了，就等你来翻～', 'Backy has laid out today’s {n} cards. Come flip them!'],
    ['早呀！脑袋最清醒的时候，复习 5 分钟正合适 🌰', 'Morning! Your mind is fresh — 5 minutes of review fits right in 🌰'],
    ['{n} 个知识点快要被忘掉了，小回在门口拦着它们呢！', '{n} ideas are about to slip away. Backy is holding the door!'],
    ['新的一天，先和昨天学的东西打个招呼吧', 'New day! Say hi to what you learned yesterday.'],
    ['小回泡好了一杯热可可，配 {n} 张卡片刚刚好 ☕', 'Backy made hot cocoa. It goes perfectly with {n} cards ☕'],
    ['记忆像小树苗，今天浇一点水，它就长高一点 🌱', 'Memory is a sprout: water it today and it grows a little 🌱'],
    ['趁早复习，一整天都会觉得自己很厉害', 'Review early and feel clever all day.'],
    ['今天的卡片已经排好队啦，第一张由你来翻', 'Today’s cards are lined up. You turn the first one.'],
    ['小回数了数：{n} 张。不多不少，正好一口气', 'Backy counted: {n} cards. Just one breath’s worth.'],
    ['早上好！松果已经准备好，就差你来领了', 'Good morning! The pine cones are ready to be collected.'],
  ],
  evening: [
    ['今天还没见到你……小回抱着松果等了一整天 🥺', 'Haven’t seen you today… Backy has been hugging pine cones all day 🥺'],
    ['睡前 3 分钟，把今天的 {n} 张卡片收进记忆里吧', '3 minutes before bed: tuck today’s {n} cards into memory.'],
    ['小回假装不在意，其实一直在看门口', 'Backy is pretending not to care. (Backy keeps looking at the door.)'],
    ['今天的卡片还在等你，它们说想你了', 'Today’s cards are still waiting. They say they miss you.'],
    ['通天藤今天还没喝到水，它有点蔫了…', 'The beanstalk hasn’t had water today. It’s drooping a little…'],
    ['再不来，小回就要把卡片读给自己听了 📖', 'Come soon, or Backy will start reading the cards aloud alone 📖'],
    ['一天的最后一件小事：复习 {n} 张，然后安心睡觉', 'One last small thing today: review {n} cards, then sleep well.'],
    ['趁今天还没结束，让记住的东西多留一会儿', 'Before today ends, help what you learned stay a little longer.'],
    ['小回把被子铺好了，复习完就能一起睡啦 🌙', 'Backy has made the bed. Review, then it’s bedtime for both 🌙'],
    ['今天的你还没来打卡，小回有点担心', 'You haven’t checked in today. Backy is a little worried.'],
  ],
  streak: [
    ['连续 {d} 天的记录就差今天了，小回替你捏一把汗！', 'Your {d}-day streak only needs today. Backy is nervous for you!'],
    ['{d} 天没断过！今天也别让它断在这里 🔥', '{d} days without a break! Don’t let it stop here 🔥'],
    ['小回在给你的连续 {d} 天记录站岗，快来接班', 'Backy is guarding your {d}-day streak. Come take over!'],
    ['已经坚持 {d} 天了，今天只要几分钟就能续上', 'You’ve kept it up for {d} days. A few minutes keeps it going.'],
    ['火苗 {d} 天没熄灭过，今晚再添一根柴吧 🔥', 'The flame has burned for {d} days. Add one more log tonight 🔥'],
  ],
};
// One line for a slot, in `locale`, avoiding the index `avoid` (the last one sent). Returns { index, title, body }.
export function reminderLine(kind, { n = 0, d = 0, locale = 'zh', avoid = -1, random = Math.random } = {}) {
  const pool = LINES[kind] || LINES.morning;
  let index = Math.floor(random() * pool.length);
  if (index === avoid && pool.length > 1) index = (index + 1) % pool.length;
  const [zh, en] = pool[index];
  return { index, title: translate('小回', 'Backy', undefined, locale), body: translate(zh, en, { n, d }, locale) };
}
