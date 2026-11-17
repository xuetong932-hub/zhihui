// Isolated QA only: an in-memory stand-in for the Supabase endpoints this app uses.
// It sends no email or SMS (every code is 123456), stores nothing on disk, and is never loaded by `npm start`.
// It mirrors cloud-schema.sql's rules (age check, unique username, admin-only list) so the browser flow can be
// exercised end to end; passing here is not evidence that the real project is configured correctly.
import { randomUUID } from 'node:crypto';
export const FAKE_PREFIX = '/fake-supabase';
export const FAKE_CODE = '123456';
const REGIONS = ['CN','HK','MO','TW','SG','MY','US','GB','CA','AU','JP','KR','OTHER'];

// seedAdmin: an administrator that exists from the start and signs in with a password (like an operator-created one).
export function createFakeSupabase({ adminEmails = ['admin@example.test'], seedAdmin = null, now = () => new Date(), oauth = [], failSend = false } = {}) {
  const users = new Map(), tokens = new Map(), refreshTokens = new Map(), eligibility = new Map(), profiles = new Map(), admins = new Set(), snapshots = new Map(), freeUsage = new Map();
  // A fixed id keeps the preset administrator the same account across test-service restarts.
  if (seedAdmin) { const user = { id: '00000000-0000-4000-8000-0000000000ad', email: seedAdmin.email, phone: '', password: seedAdmin.password, created_at: now().toISOString() }; users.set(user.id, user); admins.add(user.id); }
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
  // Learning square, mirroring the square_* functions in cloud-schema.sql (rules, limits, auto-hide after 3 reports).
  const posts = new Map(), comments = new Map(), likes = new Set(), reports = new Map();
  let lastStamp = 0;
  const stamp = () => { lastStamp = Math.max(now().getTime(), lastStamp + 1); return new Date(lastStamp).toISOString(); };
  const LANGS = ['zh', 'zh-TW', 'en', 'ja', 'ko', 'ms', 'es', 'fr', 'pt', 'de'];
  const canWrite = id => Boolean(id) && (admins.has(id) || (eligibility.get(id) === 'adult' && profiles.has(id)));
  const nameOf = id => profiles.get(id)?.username || '知回';
  const recent = (list, id, hours = 1) => list.filter(item => (item.author ?? item.reporter) === id && now().getTime() - Date.parse(item.created_at) < hours * 3600000).length;
  const postJson = (p, id) => ({ id: p.id, body: p.body, lang: p.lang, module: p.module, created_at: p.created_at, author_name: nameOf(p.author),
    like_count: [...likes].filter(key => key.startsWith(`${p.id}|`)).length, comment_count: [...comments.values()].filter(c => c.post_id === p.id && !c.hidden).length,
    liked: Boolean(id) && likes.has(`${p.id}|${id}`), mine: p.author === id, can_delete: p.author === id || admins.has(id) });
  const commentJson = (c, id) => ({ id: c.id, post_id: c.post_id, body: c.body, lang: c.lang, created_at: c.created_at, author_name: nameOf(c.author), mine: c.author === id, can_delete: c.author === id || admins.has(id) });
  const reportCount = (kind, target) => [...reports.keys()].filter(key => key.startsWith(`${kind}|${target}|`)).length;
  const clearReports = (kind, target) => { for (const key of [...reports.keys()]) if (key.startsWith(`${kind}|${target}|`)) reports.delete(key); };
  const square = {
    square_feed: (id, { before_at: before = null, max_rows: max = 20 }) => [200, [...posts.values()].filter(p => !p.hidden && (!before || p.created_at < before))
      .sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, Math.min(Math.max(Number(max) || 20, 1), 50)).map(p => postJson(p, id))],
    square_comments: (id, { post }) => [200, [...comments.values()].filter(c => c.post_id === post && !c.hidden).sort((a, b) => a.created_at.localeCompare(b.created_at)).slice(0, 200).map(c => commentJson(c, id))],
    square_post(id, { body, lang, module = null }) {
      if (!canWrite(id)) return [400, 'not_eligible'];
      if (recent([...posts.values()], id) >= 10) return [400, 'rate_limited'];
      const text = typeof body === 'string' ? body.trim() : '';
      if (!text || text.length > 1000 || !LANGS.includes(lang) || (module && !['coding', 'english', 'work', 'life'].includes(module))) return [400, 'invalid_square'];
      const p = { id: randomUUID(), author: id, body: text, lang, module: module || null, hidden: false, created_at: stamp() }; posts.set(p.id, p);
      return [200, postJson(p, id)];
    },
    square_comment(id, { post, body, lang }) {
      if (!canWrite(id)) return [400, 'not_eligible'];
      if (!posts.get(post) || posts.get(post).hidden) return [400, 'not_found'];
      if (recent([...comments.values()], id) >= 60) return [400, 'rate_limited'];
      const text = typeof body === 'string' ? body.trim() : '';
      if (!text || text.length > 500 || !LANGS.includes(lang)) return [400, 'invalid_square'];
      const c = { id: randomUUID(), post_id: post, author: id, body: text, lang, hidden: false, created_at: stamp() }; comments.set(c.id, c);
      return [200, commentJson(c, id)];
    },
    square_like(id, { post, liked }) {
      if (!canWrite(id)) return [400, 'not_eligible'];
      if (!posts.get(post) || posts.get(post).hidden) return [400, 'not_found'];
      if (liked) likes.add(`${post}|${id}`); else likes.delete(`${post}|${id}`);
      return [200, { liked: Boolean(liked), like_count: [...likes].filter(key => key.startsWith(`${post}|`)).length }];
    },
    square_delete(id, { kind, target }) {
      const store = kind === 'post' ? posts : kind === 'comment' ? comments : null;
      if (!store) return [400, 'invalid_square'];
      const item = store.get(target); if (!item || (item.author !== id && !admins.has(id))) return [400, 'not_found'];
      store.delete(target); if (kind === 'post') { for (const [key, c] of comments) if (c.post_id === target) comments.delete(key); for (const key of [...likes]) if (key.startsWith(`${target}|`)) likes.delete(key); }
      clearReports(kind, target); return [200, null];
    },
    square_report(id, { kind, target, reason = '' }) {
      if (!canWrite(id)) return [400, 'not_eligible'];
      const store = kind === 'post' ? posts : kind === 'comment' ? comments : null;
      if (!store) return [400, 'invalid_square'];
      if (!store.get(target)) return [400, 'not_found'];
      if (recent([...reports.values()], id) >= 30) return [400, 'rate_limited'];
      const key = `${kind}|${target}|${id}`; if (!reports.has(key)) reports.set(key, { reporter: id, reason: String(reason || '').slice(0, 200), created_at: stamp() });
      if (reportCount(kind, target) >= 3) store.get(target).hidden = true;
      return [200, null];
    },
    admin_square_reports(id) {
      if (!admins.has(id)) return [400, 'not_admin'];
      const items = [...[...posts.values()].map(p => ['post', p]), ...[...comments.values()].map(c => ['comment', c])]
        .filter(([kind, item]) => item.hidden || reportCount(kind, item.id) > 0)
        .map(([kind, item]) => { const own = [...reports.entries()].filter(([key]) => key.startsWith(`${kind}|${item.id}|`)).map(([, r]) => r);
          return { kind, id: item.id, body: item.body, author_name: nameOf(item.author), created_at: item.created_at, hidden: item.hidden, reports: own.length, reasons: own.map(r => r.reason).filter(Boolean), reported_at: own.map(r => r.created_at).sort().at(-1) || item.created_at }; })
        .sort((a, b) => b.reported_at.localeCompare(a.reported_at));
      return [200, items];
    },
    admin_square_moderate(id, { kind, target, action }) {
      if (!admins.has(id)) return [400, 'not_admin'];
      const store = kind === 'post' ? posts : kind === 'comment' ? comments : null;
      if (!store || !['hide', 'restore', 'delete'].includes(action)) return [400, 'invalid_square'];
      if (action === 'delete') store.delete(target); else if (store.get(target)) store.get(target).hidden = action === 'hide';
      if (action !== 'hide') clearReports(kind, target);
      return [200, null];
    },
  };
  const maskEmail = value => value ? `${value.split('@')[0].slice(0, 2)}***@${value.split('@')[1]}` : null;
  const maskPhone = value => value ? (value.length > 7 ? `${value.slice(0, 3)}***${value.slice(-4)}` : '***') : null;
  // Push reminders: the last registration per endpoint, for checking what a device sent.
  const pushes = new Map();
  const rpc = {
    push_register: (id, input) => { pushes.set(input.endpoint, input); return [200, null]; },
    push_unregister: (id, input) => { pushes.delete(input.endpoint); return [200, null]; },
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
    // Mirrors public.free_quota in cloud-schema.sql: 20 questions and 30 gradings per account per China day.
    free_quota(id, { action, kind = 'ask' }) {
      if (eligibility.get(id) !== 'adult' && !admins.has(id)) return [403, 'not_eligible'];
      if (!['status', 'consume', 'refund'].includes(action) || !['ask', 'grade', 'photo', 'translate'].includes(kind)) return [400, 'invalid_request'];
      const day = new Date(now().getTime() + 8 * 3600000).toISOString().slice(0, 10), key = `${id}|${day}`, limits = { ask: 20, grade: 30, photo: 20, translate: 50 };
      const used = freeUsage.get(key) || { ask: 0, grade: 0, photo: 0, translate: 0 }; let allowed = true;
      if (action === 'consume') { allowed = used[kind] < limits[kind]; if (allowed) used[kind]++; }
      if (action === 'refund' && used[kind] > 0) used[kind]--;
      freeUsage.set(key, used);
      return [200, { allowed, ask_used: used.ask, ask_limit: limits.ask, grade_used: used.grade, grade_limit: limits.grade, photo_used: used.photo, photo_limit: limits.photo, translate_used: used.translate, translate_limit: limits.translate }];
    },
    ...square,
    delete_own_account(id) { users.delete(id); profiles.delete(id); eligibility.delete(id); admins.delete(id); snapshots.delete(id); return [200, null]; },
  };
  async function route(request, response, path) {
    if (!path.startsWith(FAKE_PREFIX + '/')) return false;
    const sub = path.slice(FAKE_PREFIX.length), url = new URL(request.url, 'http://fake'), method = request.method;
    // A provider refusing to send (e.g. a trial SMS account and an unlisted number), as the real service reports it.
    if (sub === '/auth/v1/otp' && method === 'POST' && failSend) { send(response, 422, { code: 422, error_code: 'sms_send_failed', msg: 'Error sending confirmation OTP to provider: provider detail' }); return true; }
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
    if (sub === '/auth/v1/token' && method === 'POST' && url.searchParams.get('grant_type') === 'password') {
      const { email, password } = await body(request), user = findUser(email, null);
      if (!user || !user.password || user.password !== password) { fail(response, 400, 'Invalid login credentials'); return true; }
      send(response, 200, session(user)); return true;
    }
    if (sub === '/auth/v1/logout' && method === 'POST') { tokens.delete((request.headers.authorization || '').replace(/^Bearer /, '')); send(response, 204); return true; }
    // Public auth settings, as the real service reports them; options.oauth lists providers switched on.
    if (sub === '/auth/v1/settings' && method === 'GET') { send(response, 200, { external: { email: true, phone: true, google: oauth.includes('google'), apple: oauth.includes('apple') } }); return true; }
    if (sub.startsWith('/auth/v1/authorize')) { fail(response, 400, 'OAuth is not available in the test service'); return true; }
    const id = caller(request), name = sub.match(/^\/rest\/v1\/rpc\/([a-z_]+)$/)?.[1];
    // Reading the square is open to everyone (the public key alone), like the anon grant in cloud-schema.sql.
    if (['square_feed', 'square_comments'].includes(name) && method === 'POST') { const [status, data] = square[name](id && users.has(id) ? id : null, await body(request)); send(response, status, data); return true; }
    if (!id || !users.has(id)) { fail(response, 401, 'JWT expired or invalid'); return true; }
    if (name && method === 'POST' && rpc[name]) { const [status, data] = rpc[name](id, await body(request)); if (status >= 400) fail(response, status, data); else send(response, status, data); return true; }
    if (sub === '/rest/v1/learning_snapshots') {
      // Row-level rule from cloud-schema.sql: own row only, and only after the age gate passed.
      const ownRow = url.searchParams.get('user_id') === `eq.${id}`, isAdult = eligibility.get(id) === 'adult' || admins.has(id);
      if (method === 'GET') { send(response, 200, ownRow && isAdult && snapshots.has(id) ? [{ revision: snapshots.get(id).revision, envelope: snapshots.get(id).envelope }] : []); return true; }
      if (method === 'POST') { const row = await body(request); if (row.user_id !== id || !isAdult || snapshots.has(id)) { fail(response, 403, 'new row violates row-level security policy'); return true; } snapshots.set(id, { revision: row.revision, envelope: row.envelope }); send(response, 201, null); return true; }
      if (method === 'PATCH') { const row = await body(request), current = snapshots.get(id); if (!ownRow || !isAdult || !current || url.searchParams.get('revision') !== `eq.${current.revision}`) { send(response, 200, []); return true; } snapshots.set(id, { revision: row.revision, envelope: row.envelope }); send(response, 200, [{ revision: row.revision }]); return true; }
    }
    fail(response, 404, 'Not found'); return true;
  }
  return { route, users, profiles, eligibility, admins, posts, comments };
}
