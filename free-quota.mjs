// 知回 free allowance: the server holds the model key (env ZHIPU_API_KEY) and counts use per day (China time).
// Signed-in users: counted in the account service by the free_quota RPC (cloud-schema.sql), which also enforces the
// limits, so a client cannot change them. Local mode (no account): a small allowance counted per IP in memory.
// A burst limit per IP covers every free call, including knowledge extraction, which is not counted separately.
import { ServiceError } from './model-service.mjs';
export const FREE_PROVIDER = 'zhipu-free';
// photo: photo-question text recognition, counted on its own (not as a question).
export const FREE_LIMITS = Object.freeze({ account: { ask: 20, grade: 30, photo: 20 }, local: { ask: 3, grade: 5, photo: 3 } });
export const FREE_BURST = Object.freeze({ requests: 40, windowMs: 10 * 60 * 1000 });
// Which free calls use which allowance; extraction belongs to the question it came from.
export const FREE_KIND = Object.freeze({ '/api/chat': 'ask', '/api/review-task': 'grade', '/api/recognize': 'photo', '/api/extract': null, '/api/test': null });
export const FREE_UNSUPPORTED = Object.freeze(['/api/relations', '/api/mindmap']);
export const chinaDay = (now = new Date()) => new Date(now.getTime() + 8 * 3600000).toISOString().slice(0, 10);

export function createFreeQuota({ fetchImpl = fetch, now = () => new Date() } = {}) {
  const local = new Map(), bursts = new Map();
  const status = (used, limits, signedIn) => ({ signedIn, ask: { used: used.ask, limit: limits.ask }, grade: { used: used.grade, limit: limits.grade }, photo: { used: used.photo, limit: limits.photo } });
  function localUse(ip, action, kind) {
    const day = chinaDay(now()), key = `${day}|${ip}`;
    for (const old of local.keys()) if (!old.startsWith(day)) local.delete(old);
    const used = local.get(key) || { ask: 0, grade: 0, photo: 0 }, limits = FREE_LIMITS.local;
    let allowed = true;
    if (action === 'consume') { allowed = used[kind] < limits[kind]; if (allowed) used[kind]++; }
    if (action === 'refund' && used[kind] > 0) used[kind]--;
    local.set(key, used);
    return { ...status(used, limits, false), allowed };
  }
  async function accountUse(token, action, kind, account) {
    if (!account?.url || !account.publicKey) throw new ServiceError('free-unavailable', 503);
    let response;
    try {
      response = await fetchImpl(`${account.url}/rest/v1/rpc/free_quota`, { method: 'POST', redirect: 'error', signal: AbortSignal.timeout(15000),
        headers: { apikey: account.publicKey, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ action, kind: kind || 'ask' }) });
    } catch { throw new ServiceError('free-unavailable', 503); }
    if (response.status === 401 || response.status === 403) { await response.body?.cancel(); throw new ServiceError('signin', 401); }
    if (!response.ok) { await response.body?.cancel(); throw new ServiceError('free-unavailable', 503); }
    const data = await response.json().catch(() => null);
    const used = { ask: Number(data?.ask_used) || 0, grade: Number(data?.grade_used) || 0, photo: Number(data?.photo_used) || 0 }, limits = { ask: Number(data?.ask_limit) || FREE_LIMITS.account.ask, grade: Number(data?.grade_limit) || FREE_LIMITS.account.grade, photo: Number(data?.photo_limit) || FREE_LIMITS.account.photo };
    return { ...status(used, limits, true), allowed: data?.allowed !== false };
  }
  return {
    // action: 'status' | 'consume' | 'refund'. With a token the account allowance is used, otherwise the local one.
    use: async ({ token, ip, action, kind, account }) => token ? accountUse(token, action, kind, account) : localUse(ip || 'unknown', action, kind),
    // True while this IP stays under the burst limit (counts the call).
    burst(ip) {
      const at = now().getTime(), list = (bursts.get(ip) || []).filter(time => at - time < FREE_BURST.windowMs);
      if (list.length >= FREE_BURST.requests) { bursts.set(ip, list); return false; }
      list.push(at); bursts.set(ip, list); return true;
    },
  };
}
