import { localDay } from './knowledge-store.js';
// The squirrel's pine cones, worked out from the review history every time (nothing is stored, so a new device or a
// restored backup shows the same number and it cannot be edited by hand):
//   +1  the first time a card is answered "understood" or "mastered" (a knowledge point learned),
//   +3  each day on which at least `goal` different cards were reviewed (the daily goal met),
//   +10 on every 7th consecutive goal day.
// Spending (the shop) comes later and will be subtracted from this total.
export const PINE = { learned: 1, goalDay: 3, week: 10 };
const LEARNED = ['understood', 'mastered'];

export function pineCones(events, goal, now = new Date()) {
  const today = localDay(now), gains = [];
  const sorted = [...(events || [])].sort((a, b) => a.at.localeCompare(b.at));
  const learned = new Set(), perDay = new Map();
  for (const event of sorted) {
    const day = localDay(event.at);
    if (!perDay.has(day)) perDay.set(day, new Set());
    perDay.get(day).add(event.cardId);
    if (LEARNED.includes(event.rating) && !learned.has(event.cardId)) { learned.add(event.cardId); gains.push([day, PINE.learned, 'learned']); }
  }
  const goalDays = [...perDay].filter(([, cards]) => cards.size >= Math.max(1, goal)).map(([day]) => day).sort();
  let run = 0, previous = '';
  for (const day of goalDays) {
    gains.push([day, PINE.goalDay, 'goal']);
    run = previous && dayAfter(previous) === day ? run + 1 : 1;
    if (run % 7 === 0) gains.push([day, PINE.week, 'week']);
    previous = day;
  }
  const todayGains = gains.filter(([day]) => day === today);
  return {
    total: gains.reduce((sum, [, amount]) => sum + amount, 0),
    today: todayGains.reduce((sum, [, amount]) => sum + amount, 0),
    learned: learned.size,
    learnedToday: todayGains.filter(([, , kind]) => kind === 'learned').length,
  };
}
function dayAfter(day) {
  const [y, m, d] = day.split('-').map(Number);
  return localDay(new Date(y, m - 1, d + 1, 12));
}

// How the squirrel feels: asleep late at night, full once today's goal is met, eating while you review, else hungry.
// It never gets ill or leaves; being hungry only changes its pose and words.
export function petMood(doneToday, goal, hour = new Date().getHours()) {
  if (hour >= 23 || hour < 6) return 'sleep';
  if (doneToday >= Math.max(1, goal)) return 'full';
  return doneToday > 0 ? 'eating' : 'hungry';
}
export const MOOD_POSE = { sleep: 'sleep', full: 'cheer', eating: 'wave', hungry: 'think' };
