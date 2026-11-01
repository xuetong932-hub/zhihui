// Isolated QA only: an in-memory stand-in for the Supabase endpoints this app uses.
// It sends no email or SMS (every code is 123456), stores nothing on disk, and is never loaded by `npm start`.
// It mirrors cloud-schema.sql's rules (age check, unique username, admin-only list) so the browser flow can be
// exercised end to end; passing here is not evidence that the real project is configured correctly.
import { randomUUID } from 'node:crypto';
export const FAKE_PREFIX = '/fake-supabase';
export const FAKE_CODE = '123456';
const REGIONS = ['CN','HK','MO','TW','SG','MY','US','GB','CA','AU','JP','KR','OTHER'];

export function createFakeSupabase({ adminEmails = ['admin@example.test'], now = () => new Date() } = {}) {
  const users = new Map(), tokens = new Map(), refreshTokens = new Map(), eligibility = new Map(), profiles = new Map(), admins = new Set(), snapshots = new Map();
  const send = (response, status, data) => { response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); response.end(data === undefined ? '' : JSON.stringify(data)); };
  const fail = (response, status, message) => send(response, status, { code: String(status), message });
  async function body(request) { const chunks = []; for await (const chunk of request) chunks.push(chunk); try { return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'); } catch { return {}; } }
  const findUser = (email, phone) => [...users.values()].find(user => (email && user.email === email) || (phone && user.phone === phone));
  function session(user) {
    const access = randomUUID(), refresh = randomUUID(); tokens.set(access, user.id); refreshTokens.set(refresh, user.id);
    user.last_sign_in_at = now().toISOString();
    return { access_token: access, token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(now().getTime() / 1000) + 3600, refresh_token: refresh, user: { id: user.id, email: user.email, phone: user.phone, created_at: user.created_at } };
  }
  const caller = request => tokens.get((request.headers.authorization || '').replace(/^Bearer /, ''));
  const latestDate = () => { const d = new Date(now().getTime() - 12 * 3600000); return [d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()]; };
  function adult(birthdate) {
    const [y, m, d] = birthdate.split('-').map(Number), [cy, cm, cd] = latestDate();
    let age = cy - y; if (cm < m || (cm === m && cd < d)) age--; return age >= 18;
  }
  const maskEmail = value => value ? `${value.split('@')[0].slice(0, 2)}***@${value.split('@')[1]}` : null;
  const maskPhone = value => value ? (value.length > 7 ? `${value.slice(0, 3)}***${value.slice(-4)}` : '***') : null;
  const rpc = {
    my_account: id => [200, { status: eligibility.get(id) || 'missing', registered: profiles.has(id), username: profiles.get(id)?.username || null, region: profiles.get(id)?.region || null, is_admin: admins.has(id) }],
    complete_registration(id, input) {
      if (eligibility.get(id) === 'denied') return [400, 'denied'];
      if (profiles.has(id)) return [400, 'already_registered'];
      const { username, email, phone, region, birthdate, policy_version: policy } = input;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(birthdate || '') || !policy) return [400, 'invalid_registration'];
      const result = adult(birthdate) ? 'adult' : 'denied';
      if (result === 'denied') { eligibility.set(id, 'denied'); return [200, 'denied']; }
      if (typeof username !== 'string' || !/^[^\s\p{C}@<>"'`/\\]{2,20}$/u.test(username) || !REGIONS.includes(region) || (phone && !/^\+[1-9]\d{6,14}$/.test(phone))) return [400, 'invalid_registration'];
      if ([...profiles.values()].some(profile => profile.username.toLowerCase() === username.toLowerCase())) return [400, 'username_taken'];
      eligibility.set(id, 'adult'); profiles.set(id, { username, email: email || null, phone: phone || null, region, created_at: now().toISOString() });
      return [200, 'adult'];
    },
    admin_list_users(id, { search = '', max_rows: max = 200 }) {
      if (!admins.has(id)) return [400, 'not_admin'];
      const rows = [...profiles.entries()].filter(([, p]) => !search || p.username.toLowerCase().includes(String(search).toLowerCase()))
        .sort((a, b) => b[1].created_at.localeCompare(a[1].created_at)).slice(0, Math.min(Math.max(Number(max) || 200, 1), 500))
        .map(([userId, p]) => { const u = users.get(userId); return { username: p.username, region: p.region, email: maskEmail(u.email || p.email), phone: maskPhone(p.phone || u.phone || null), registered_at: p.created_at, last_sign_in_at: u.last_sign_in_at || null, eligibility: eligibility.get(userId) || 'missing' }; });
      return [200, rows];
    },
    delete_own_account(id) { users.delete(id); profiles.delete(id); eligibility.delete(id); admins.delete(id); snapshots.delete(id); return [200, null]; },
  };
  async function route(request, response, path) {
    if (!path.startsWith(FAKE_PREFIX + '/')) return false;
    const sub = path.slice(FAKE_PREFIX.length), url = new URL(request.url, 'http://fake'), method = request.method;
    if (sub === '/auth/v1/otp' && method === 'POST') {
      const { email, phone, create_user: create } = await body(request);
      if (!email && !phone) { fail(response, 400, 'missing identifier'); return true; }
      if (!findUser(email, phone)) {
        if (!create) { fail(response, 422, 'Signups not allowed for otp'); return true; }
        const user = { id: randomUUID(), email: email || '', phone: phone || '', created_at: now().toISOString() };
        users.set(user.id, user); if (email && adminEmails.includes(email)) admins.add(user.id);
      }
      send(response, 200, {}); return true;
    }
    if (sub === '/auth/v1/verify' && method === 'POST') {
      const { email, phone, token } = await body(request), user = findUser(email, phone);
      if (!user || token !== FAKE_CODE) { fail(response, 403, 'Token has expired or is invalid'); return true; }
      send(response, 200, session(user)); return true;
    }
    if (sub === '/auth/v1/token' && method === 'POST' && url.searchParams.get('grant_type') === 'refresh_token') {
      const { refresh_token: token } = await body(request), id = refreshTokens.get(token);
      if (!id || !users.has(id)) { fail(response, 400, 'Invalid Refresh Token'); return true; }
      refreshTokens.delete(token); send(response, 200, session(users.get(id))); return true;
    }
    if (sub === '/auth/v1/logout' && method === 'POST') { tokens.delete((request.headers.authorization || '').replace(/^Bearer /, '')); send(response, 204); return true; }
    if (sub.startsWith('/auth/v1/authorize')) { fail(response, 400, 'OAuth is not available in the test service'); return true; }
    const id = caller(request);
    if (!id || !users.has(id)) { fail(response, 401, 'JWT expired or invalid'); return true; }
    const name = sub.match(/^\/rest\/v1\/rpc\/([a-z_]+)$/)?.[1];
    if (name && method === 'POST' && rpc[name]) { const [status, data] = rpc[name](id, await body(request)); if (status >= 400) fail(response, status, data); else send(response, status, data); return true; }
    if (sub === '/rest/v1/learning_snapshots') {
      // Row-level rule from cloud-schema.sql: own row only, and only after the age gate passed.
      const ownRow = url.searchParams.get('user_id') === `eq.${id}`, isAdult = eligibility.get(id) === 'adult';
      if (method === 'GET') { send(response, 200, ownRow && isAdult && snapshots.has(id) ? [{ revision: snapshots.get(id).revision, envelope: snapshots.get(id).envelope }] : []); return true; }
      if (method === 'POST') { const row = await body(request); if (row.user_id !== id || !isAdult || snapshots.has(id)) { fail(response, 403, 'new row violates row-level security policy'); return true; } snapshots.set(id, { revision: row.revision, envelope: row.envelope }); send(response, 201, null); return true; }
      if (method === 'PATCH') { const row = await body(request), current = snapshots.get(id); if (!ownRow || !isAdult || !current || url.searchParams.get('revision') !== `eq.${current.revision}`) { send(response, 200, []); return true; } snapshots.set(id, { revision: row.revision, envelope: row.envelope }); send(response, 200, [{ revision: row.revision }]); return true; }
    }
    fail(response, 404, 'Not found'); return true;
  }
  return { route, users, profiles, eligibility, admins };
}
