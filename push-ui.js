// Review reminders by push, device side. Turned on only by the user's tap (which asks the system for permission);
// the device then registers its push subscription with the next few reminder times (reminders.js) and re-plans
// them whenever the due cards change. Turning it off removes the subscription here and on the account service.
import { localDay } from './knowledge-store.js';
import { streakDays } from './review-store.js';
import { dueByDay, planReminders } from './reminders.js';

const PUSH_KEY = 'knowledge-review.push.v1';
const read = () => { try { const value = JSON.parse(localStorage.getItem(PUSH_KEY)); return value && typeof value.on === 'boolean' ? value : { on: false }; } catch { return { on: false }; } };
const write = value => { try { localStorage.setItem(PUSH_KEY, JSON.stringify(value)); } catch { /* Kept for this page only. */ } };
const keyBytes = key => Uint8Array.from(atob(key.replace(/-/g, '+').replace(/_/g, '/')), char => char.charCodeAt(0));

export function createPushReminders({ auth, cards, reviews, profile, locale }) {
  let state = read(), available = null, syncing = false;
  const supported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window && window.isSecureContext;
  // The server has push keys and the account service is configured; checked once.
  async function serverKey() {
    if (available !== null) return available;
    try { const response = await fetch('/api/push/key'); available = response.ok ? (await response.json()).publicKey || '' : ''; } catch { available = ''; }
    return available;
  }
  const subscription = async () => (await navigator.serviceWorker.ready).pushManager.getSubscription();
  function plan() {
    const events = reviews().events, now = new Date(), today = localDay(now);
    const due = dueByDay(cards(), reviews(), profile(), now);
    return planReminders({ now, due, reviewedToday: events.some(event => localDay(event.at) === today), streak: streakDays(events, now) });
  }
  // Send the current plan when it changed (or once a day), so the account service always holds the next reminders.
  async function sync({ force = false } = {}) {
    if (!state.on || syncing || !supported() || Notification.permission !== 'granted' || !auth?.config || !profile()) return;
    syncing = true;
    try {
      const sub = await subscription();
      if (!sub) { state = { on: false }; write(state); return; }
      const json = sub.toJSON(), slots = plan(), signature = JSON.stringify([json.endpoint, locale(), slots, localDay(new Date())]);
      if (!force && signature === state.signature) return;
      await auth.push.register({ endpoint: json.endpoint, p256dh: json.keys.p256dh, auth: json.keys.auth, locale: locale(), slots });
      state = { ...state, signature }; write(state);
    } catch { /* Tried again on the next change. */ } finally { syncing = false; }
  }
  return {
    // 'on' | 'off' | 'denied' | 'unsupported' (this browser) | 'unavailable' (no push service on this server)
    async status() {
      if (!supported()) return 'unsupported';
      if (!auth?.config || !await serverKey()) return 'unavailable';
      if (Notification.permission === 'denied') return 'denied';
      return state.on && Notification.permission === 'granted' ? 'on' : 'off';
    },
    async enable() {
      const key = await serverKey();
      if (!supported() || !key || !auth?.config) return 'unavailable';
      if (await Notification.requestPermission() !== 'granted') return 'denied';
      try {
        const registration = await navigator.serviceWorker.ready;
        await (await registration.pushManager.getSubscription())?.unsubscribe();
        await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(key) });
        state = { on: true }; write(state); await sync({ force: true });
        return state.signature ? 'on' : 'failed';
      } catch { return 'failed'; }
    },
    async disable() {
      state = { on: false }; write(state);
      try { const sub = await subscription(); if (sub) { const endpoint = sub.endpoint; await sub.unsubscribe(); await auth?.push.unregister(endpoint); } } catch { /* Gone here already. */ }
    },
    sync,
    // Re-plan when the app opens, every few minutes while it runs, and when it goes to the background (after reviewing).
    start() {
      setTimeout(() => sync(), 3000); setInterval(() => sync(), 5 * 60 * 1000);
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') sync(); });
    },
  };
}
