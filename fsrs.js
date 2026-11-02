// FSRS-5 (Free Spaced Repetition Scheduler). Formulas and default parameters follow the open-source FSRS project
// (open-spaced-repetition, MIT licence); this is an independent implementation without dependencies.
// Each card's memory state (difficulty D, stability S in days) is rebuilt from its review history, so nothing extra is
// stored. The default parameters were fitted on large public review data, not on this user's history.
export const FSRS_W = Object.freeze([0.40255, 1.18385, 3.173, 15.69105, 7.1949, 0.5345, 1.4604, 0.0046, 1.54575, 0.1192, 1.01925, 1.9395, 0.11, 0.29605, 2.2698, 0.2315, 2.9898, 0.51655, 0.6621]);
export const DESIRED_RETENTION = 0.9, MAX_INTERVAL = 365;
const W = FSRS_W, DECAY = -0.5, FACTOR = 19 / 81, DAY = 86400000;
// 知回 ratings → FSRS grades: Again 1, Hard 2, Good 3, Easy 4. "Still unclear" counts as Again.
export const GRADE = Object.freeze({ wrong: 1, unclear: 1, guessed: 2, understood: 3, mastered: 4 });
const clampD = d => Math.min(10, Math.max(1, d));
// Probability of recalling after `days` with stability `s` (FSRS power forgetting curve; 90% when days = s).
export const retrievability = (days, s) => Math.pow(1 + FACTOR * Math.max(0, days) / s, DECAY);
const initS = g => Math.max(0.1, W[g - 1]);
const initD = g => W[4] - Math.exp(W[5] * (g - 1)) + 1;
// Difficulty moves with the grade (damped near 10) and drifts back towards the default for an "Easy" card.
const nextD = (d, g) => { const damped = d - W[6] * (g - 3) * (10 - d) / 9; return clampD(W[7] * initD(4) + (1 - W[7]) * damped); };
const recallS = (d, s, r, g) => s * (Math.exp(W[8]) * (11 - d) * Math.pow(s, -W[9]) * (Math.exp(W[10] * (1 - r)) - 1) * (g === 2 ? W[15] : 1) * (g === 4 ? W[16] : 1) + 1);
const forgetS = (d, s, r) => Math.min(s, W[11] * Math.pow(d, -W[12]) * (Math.pow(s + 1, W[13]) - 1) * Math.exp(W[14] * (1 - r)));
const sameDayS = (s, g) => s * Math.exp(W[17] * (g - 3 + W[18]));
// Whole calendar days between two moments, in local time.
const localMidnight = value => { const d = new Date(value); d.setHours(0, 0, 0, 0); return d.getTime(); };
export const elapsedDays = (from, to) => Math.max(0, Math.round((localMidnight(to) - localMidnight(from)) / DAY));
// history: [{at, rating}] in time order. Returns {d, s, at} after the last review, or null for a card never reviewed.
export function memoryState(history) {
  let state = null;
  for (const review of history) {
    const g = GRADE[review.rating]; if (!g) continue;
    if (!state) { state = { d: clampD(initD(g)), s: initS(g), at: review.at }; continue; }
    const days = elapsedDays(state.at, review.at), r = retrievability(days, state.s);
    const s = days === 0 ? sameDayS(state.s, g) : g === 1 ? forgetS(state.d, state.s, r) : recallS(state.d, state.s, r, g);
    state = { d: nextD(state.d, g), s: Math.max(0.1, s), at: review.at };
  }
  return state;
}
// Days until recall is expected to fall to the desired retention (about S at 90%), between 1 and 365.
export function nextInterval(s, retention = DESIRED_RETENTION) {
  return Math.min(MAX_INTERVAL, Math.max(1, Math.round(s / FACTOR * (Math.pow(retention, 1 / DECAY) - 1))));
}
