// Review reminders by push, server side. pg_cron calls POST /api/push/tick every 10 minutes with the shared secret;
// this takes the reminders due now from the account service (push_take_due), sends each with a line in 小回's voice
// in the device's language, and reports back which line went out and which subscriptions are gone (push_after).
// Settings come from the operator's environment: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT, PUSH_SECRET.
import { timingSafeEqual, createHash } from 'node:crypto';
import { sendPush, validPublicKey } from './webpush.mjs';
import { reminderLine } from './reminders.js';
import { isLocale, loadCatalog, needsCatalog } from './i18n.js';

export function pushSettingsFromEnv(env = process.env) {
  const publicKey = (env.VAPID_PUBLIC_KEY || '').trim(), privateKey = (env.VAPID_PRIVATE_KEY || '').trim();
  const subject = (env.VAPID_SUBJECT || '').trim(), secret = (env.PUSH_SECRET || '').trim();
  if (!validPublicKey(publicKey) || !/^[\w-]{43}$/.test(privateKey) || !/^(mailto:|https:\/\/)\S+$/.test(subject) || secret.length < 32) return null;
  return { vapid: { publicKey, privateKey, subject }, secret };
}
// Constant-time comparison of the caller's secret (hashed first so lengths always match).
export const secretMatches = (given, secret) => timingSafeEqual(createHash('sha256').update(String(given || '')).digest(), createHash('sha256').update(secret).digest());

export async function runPushTick({ account, push, fetchImpl = fetch, send = sendPush }) {
  const rpc = async (name, body) => {
    const response = await fetchImpl(`${account.url}/rest/v1/rpc/${name}`, { method: 'POST', redirect: 'error', signal: AbortSignal.timeout(15000),
      headers: { apikey: account.publicKey, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!response.ok) throw new Error('account');
    return response.status === 204 ? null : response.json().catch(() => null);
  };
  const due = await rpc('push_take_due', { secret: push.secret });
  const results = [];
  for (const item of Array.isArray(due) ? due : []) {
    const locale = isLocale(item.locale) ? item.locale : 'en';
    if (needsCatalog(locale)) await loadCatalog(locale);
    const line = reminderLine(item.kind, { n: item.n, d: item.d, locale, avoid: item.last_line });
    try {
      const sent = await send({ endpoint: item.endpoint, p256dh: item.p256dh, auth: item.auth }, { title: line.title, body: line.body, kind: item.kind }, push.vapid, { fetchImpl });
      results.push({ endpoint: item.endpoint, line: sent.ok ? line.index : null, gone: sent.gone });
    } catch { results.push({ endpoint: item.endpoint, line: null, gone: false }); }
  }
  if (results.length) await rpc('push_after', { secret: push.secret, results });
  return { due: results.length, sent: results.filter(r => r.line !== null).length, gone: results.filter(r => r.gone).length };
}
