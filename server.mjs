import http from 'node:http';
import { networkInterfaces } from 'node:os';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { callModel, ServiceError } from './model-service.mjs';
import { extractKnowledge, relateKnowledge, expandMindmap } from './knowledge-service.mjs';
import { reviewTask } from './review-service.mjs';
import { createFreeQuota, FREE_PROVIDER, FREE_KIND, FREE_UNSUPPORTED } from './free-quota.mjs';
import { recognizeImage } from './recognize-service.mjs';
import { translateText, validateTranslate } from './translate-service.mjs';

const files = new Map([
  // The web version is the app itself (mobile/index.html); mobile/wide.css lays it out for wide screens.
  ['/', ['mobile/index.html', 'text/html; charset=utf-8']],
  ...['app.js', 'chat-ui.js', 'chat-store.js', 'providers.js', 'knowledge-store.js', 'knowledge-ui.js','review-store.js','review-ui.js','device-ui.js','cloud-ui.js','model-help.js','local-space.js','snapshot-merge.js','auth.js','auth-ui.js','admin-ui.js','modules.js','module-icons.js','discover-ui.js','recommend-data.js','starter-content.js','habit.js','pet.js','pet-physics.js','splash.js','bookshelf.js','achievements.js','badges-ui.js','scenes.js','profile-ui.js','mindmap-canvas.js','shop.js','shop-ui.js','journey.js','journey-ui.js','garden.js','garden-ui.js','sfx.js','tips.js','fsrs.js','onboarding.js','tour.js', 'square-ui.js','i18n.js','theme.js','memory-viz.js','memory-ui.js','docx.js','google-docs.js','graph-view.js','mindmap.js','viz-edit.js','sw.js'].map(name => [`/${name}`, [name, 'text/javascript; charset=utf-8']]),
  ['/manifest.webmanifest',['manifest.webmanifest','application/manifest+json']],['/icon.svg',['icon.svg','image/svg+xml']],
  // PNG icons for installing to a phone (Android app package, home screen); made from icon.svg.
  ...['icon-192.png','icon-512.png','icon-maskable-512.png','apple-touch-icon.png'].map(name => [`/${name}`, [name, 'image/png']]),
  // Android app: the installer, and the file that proves the app and this site belong together (docs/ANDROID_APP.md).
  ['/zhihui.apk', ['downloads/zhihui.apk', 'application/vnd.android.package-archive']], ['/.well-known/assetlinks.json', ['.well-known/assetlinks.json', 'application/json']],
  ['/styles.css', ['styles.css', 'text/css; charset=utf-8']],
  // Interface illustrations and the squirrel mascot (generated in LibTV; source PNGs and convert.py live in store-assets/libtv/ui, untracked).
  ...['home-desk','pet-nest','home-hero','review-hero','icon-coding','icon-english','icon-work','icon-life','mascot-wave','mascot-think','mascot-cheer','mascot-sleep','mascot-shy','mascot-stash','mascot-lifted','mascot-walk','pine-jar',...['first','learned','streak','reviews','cones','polymath','early','night','books','month'].map(name => 'badges/' + name),...['fern','chime','painting','lamp','shelf','rug','desk','lights','frame-vine','frame-pine','frame-star','frame-sakura','frame-snow','frame-books','frame-rainbow','frame-squirrel','frame-laurel','freeze'].map(name => 'shop/' + name),...['hat-straw','hat-beanie','hat-grad','face-blush','face-glasses','face-shades','neck-scarf','neck-bell','neck-bow','body-sweater','body-overalls','body-raincoat','body-blazer','back-pouch','back-bag','back-wings'].flatMap(name => ['outfits/' + name, 'outfits/icons/' + name]),'mascot-stand',...['seed','sprout','seedling','roof','village','wall','hills','tai','clouds','snow','everest','stars','can-1','can-2','can-3','can-4','can-5'].map(name => 'grow/' + name),...['store','feed','streak','beanstalk','shop'].map(name => 'world/' + name)].map(name => [`/illustrations/${name}.webp`, [`illustrations/${name}.webp`, 'image/webp']]),
  // Home scene backgrounds (scenes.js; sources in docs/BACKGROUNDS.md) and their thumbnails.
  ...['sky-day','sky-night','desk-night','fresh-day','fresh-night','pixel-day','pixel-night','game-day','game-night','street-day','portrait-day','lake','forest','sea','neon-street','neon-city','silhouette','anime-day','anime-night'].flatMap(name => [name, name + '-thumb']).concat('desk-thumb').map(name => [`/scenes/${name}.webp`, [`scenes/${name}.webp`, 'image/webp']]),
  // Display font for headings: Smiley Sans / 得意黑 v2.0.1 (OFL-1.1, unmodified; licence in fonts/SmileySans-OFL.txt).
  ['/fonts/SmileySans-Oblique.woff2', ['fonts/SmileySans-Oblique.woff2', 'font/woff2']],
  // Phone layout: same app, its own entry page and styles (mobile/).
  // Interface languages beyond Chinese and English (i18n.js loads the chosen one on demand).
  ...['zh-TW', 'ja', 'ko', 'ms', 'es', 'fr', 'pt', 'de'].map(code => [`/i18n/${code}.js`, [`i18n/${code}.js`, 'text/javascript; charset=utf-8']]),
  // Product page (welcome/): what 知回 does, download and install links.
  ['/welcome', ['welcome/index.html', 'text/html; charset=utf-8']], ['/welcome/', ['welcome/index.html', 'text/html; charset=utf-8']], ['/welcome/welcome.css', ['welcome/welcome.css', 'text/css; charset=utf-8']], ['/welcome/welcome.js', ['welcome/welcome.js', 'text/javascript; charset=utf-8']],
  ['/m', ['mobile/index.html', 'text/html; charset=utf-8']], ['/m/', ['mobile/index.html', 'text/html; charset=utf-8']], ['/m/mobile.css', ['mobile/mobile.css', 'text/css; charset=utf-8']], ['/m/wide.css', ['mobile/wide.css', 'text/css; charset=utf-8']],
  ['/oauth-callback.html', ['oauth-callback.html', 'text/html; charset=utf-8']],
]);
const headers = {
  'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer',
  'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self' https://*.supabase.co https://www.googleapis.com; img-src 'self' blob:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
};
function json(response, status, data) {
  if (response.destroyed) return;
  response.writeHead(status, { ...headers, 'Content-Type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(data));
}
// Photo recognition carries one compressed image, so that route accepts a larger body.
async function readJson(request, limit = 320 * 1024) {
  if (!request.headers['content-type']?.startsWith('application/json')) throw new ServiceError('request', 415);
  const chunks = [];
  let bytes = 0;
  for await (const chunk of request) {
    bytes += chunk.length;
    if (bytes > limit) throw new ServiceError('large', 413);
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw new ServiceError('request'); }
}
// Account service settings come from the operator's environment; only the public (publishable) key is exposed.
export function publicConfigFromEnv(env = process.env) {
  const url = (env.SUPABASE_URL || '').trim().replace(/\/$/, ''), publicKey = (env.SUPABASE_PUBLISHABLE_KEY || '').trim();
  if (!(/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(url) && publicKey.length > 10 && !publicKey.startsWith('sb_secret_'))) return {};
  // Administrator username shown on the admin sign-in page, mapped to the email of the operator-created account.
  const username = (env.ADMIN_USERNAME || '').trim(), email = (env.ADMIN_LOGIN_EMAIL || '').trim();
  // Optional Google OAuth client for exporting to Google Docs (public identifier, not a secret).
  const googleClientId = (env.GOOGLE_CLIENT_ID || '').trim();
  return { url, publicKey, ...(username && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? { adminLogin: { username, email } } : {}), ...(/^[\w.-]+\.apps\.googleusercontent\.com$/.test(googleClientId) ? { googleClientId } : {}) };
}
// Home-network mode: this computer's private IPv4 addresses (10/8, 172.16/12, 192.168/16), which phones on the same
// Wi-Fi use to reach it. Public and link-local addresses are never included.
const isPrivate = ip => /^10\./.test(ip) || /^192\.168\./.test(ip) || /^172\.(1[6-9]|2\d|3[01])\./.test(ip);
// A caller on this computer or the home network (IPv4, or IPv4 mapped into IPv6).
export const isNearby = ip => { const v4 = String(ip).replace(/^::ffff:/, ''); return v4 === '::1' || /^127\./.test(v4) || isPrivate(v4); };
export function privateAddresses(interfaces = networkInterfaces()) {
  return [...new Set(Object.values(interfaces).flat().filter(item => item && item.family === 'IPv4' && !item.internal && isPrivate(item.address)).map(item => item.address))];
}
// Phone browsers opening the start page are sent to the phone layout; "/?desktop" keeps the desktop page.
const PHONE_AGENT = /Android.+Mobile|iPhone|iPod|Windows Phone|HarmonyOS.+Mobile/i;
export function createApp({ modelCaller = callModel, knowledgeCaller = extractKnowledge,reviewCaller=reviewTask, relationCaller = relateKnowledge, mindmapCaller = expandMindmap, recognizeCaller = recognizeImage, translateCaller = translateText, publicConfig = () => publicConfigFromEnv(), extraRoute,
  freeModelKey = (process.env.ZHIPU_API_KEY || '').trim(), freeQuota = createFreeQuota(), lanHosts = [], publicOrigin = '' } = {}) {
  // Public mode: served at one HTTPS address behind the host's proxy (e.g. Render), which terminates TLS.
  const publicHost = publicOrigin ? new URL(publicOrigin).hostname : '';
  const allowedHosts = new Set(['127.0.0.1', 'localhost', ...lanHosts, ...(publicHost ? [publicHost] : [])]);
  let activeRequests = 0;
  const bearer = request => (/^Bearer ([\w.-]{10,4096})$/.exec(request.headers.authorization || '') || [])[1] || '';
  // Behind the proxy every connection comes from the proxy, so the visitor is the first X-Forwarded-For entry.
  // A visitor can prepend a forged entry, which only affects the no-account allowance and burst limit.
  const clientIp = request => (publicHost && String(request.headers['x-forwarded-for'] || '').split(',')[0].trim()) || request.socket.remoteAddress || 'unknown';
  const publicHeaders = publicOrigin.startsWith('https://') ? { 'Strict-Transport-Security': 'max-age=31536000' } : {};
  return http.createServer(async (request, response) => {
    // Loopback by default; home-network mode adds only this computer's own private addresses.
    // Reject foreign origins and DNS-rebinding hosts.
    const host = request.headers.host || '', hostMatch = /^([\w.-]+)(:\d+)?$/.exec(host);
    if (!hostMatch || !allowedHosts.has(hostMatch[1].toLowerCase())) { json(response, 403, { error: 'origin' }); return; }
    // The Host header can be forged, so home-network mode also checks that the caller itself is on a private network.
    if (lanHosts.length && !isNearby(clientIp(request))) { json(response, 403, { error: 'origin' }); return; }
    const isPublic = publicHost && hostMatch[1].toLowerCase() === publicHost;
    if (request.headers.origin && request.headers.origin !== (isPublic ? publicOrigin : `http://${host}`)) { json(response, 403, { error: 'origin' }); return; }
    for (const [name, value] of Object.entries(isPublic ? publicHeaders : {})) response.setHeader(name, value);
    const url = new URL(request.url, `http://${host}`), path = url.pathname;
    if (path === '/' && !url.searchParams.has('desktop') && request.method === 'GET' && PHONE_AGENT.test(request.headers['user-agent'] || '')) {
      response.writeHead(302, { ...headers, Location: '/m/' }); response.end(); return;
    }
    if (path === '/api/public-config') { if (request.method !== 'GET') { json(response, 405, { error: 'method' }); return; } json(response, 200, { ...publicConfig(host), ...(freeModelKey ? { freeModel: true } : {}) }); return; }
    // Today's free allowance for this account (or, without a sign-in, for this device's network).
    if (path === '/api/free-quota') {
      if (request.method !== 'GET') { json(response, 405, { error: 'method' }); return; }
      if (!freeModelKey) { json(response, 503, { error: 'free-unavailable' }); return; }
      try { const { allowed, ...state } = await freeQuota.use({ token: bearer(request), ip: clientIp(request), action: 'status', account: publicConfig(host) }); json(response, 200, state); }
      catch (error) { json(response, error instanceof ServiceError ? error.status : 500, { error: error instanceof ServiceError ? error.code : 'internal' }); }
      return;
    }
    // Test servers mount extra routes (the fake account service); production passes none.
    if (extraRoute && await extraRoute(request, response, path)) return;
    // Learning square translation with the free model: 50 a day per account, or per network without one (also for a
    // signed-in account that has not finished registration). A failed call does not use up the allowance.
    if (path === '/api/translate') {
      if (request.method !== 'POST') { json(response, 405, { error: 'method' }); return; }
      if (activeRequests >= 4) { json(response, 429, { error: 'busy' }); return; }
      activeRequests++;
      const controller = new AbortController();
      response.on('close', () => { if (!response.writableEnded) controller.abort(); });
      let charged = null;
      try {
        if (!freeModelKey) throw new ServiceError('free-unavailable', 503);
        const input = validateTranslate(await readJson(request)), ip = clientIp(request), account = publicConfig(host);
        if (!freeQuota.burst(ip)) throw new ServiceError('rate', 429);
        let token = bearer(request), state;
        try { state = await freeQuota.use({ token, ip, action: 'consume', kind: 'translate', account }); }
        catch (error) { if (!(error instanceof ServiceError) || error.code !== 'signin' || !token) throw error; token = ''; state = await freeQuota.use({ token, ip, action: 'consume', kind: 'translate', account }); }
        if (!state.allowed) throw new ServiceError('translate-limit', 429);
        charged = { token, ip, kind: 'translate', account };
        const result = await translateCaller(input, { signal: controller.signal, apiKey: freeModelKey });
        charged = null;
        json(response, 200, { text: result.text, translate: state.translate });
      } catch (error) {
        if (charged) await freeQuota.use({ ...charged, action: 'refund' }).catch(() => {});
        json(response, error instanceof ServiceError ? error.status : 500, { error: error instanceof ServiceError ? error.code : 'internal' });
      } finally { activeRequests--; }
      return;
    }
    if (['/api/chat', '/api/test', '/api/extract', '/api/review-task', '/api/relations', '/api/mindmap', '/api/recognize'].includes(path)) {
      if (request.method !== 'POST') { json(response, 405, { error: 'method' }); return; }
      if (activeRequests >= 2) { json(response, 429, { error: 'busy' }); return; }
      activeRequests++;
      const controller = new AbortController();
      response.on('close', () => { if (!response.writableEnded) controller.abort(); });
      let charged = null;
      try {
        let input = await readJson(request, path === '/api/recognize' ? 3.5 * 1024 * 1024 : undefined);
        if (path === '/api/test' && input && typeof input === 'object') input = { ...input, config: { ...input.config, search: false }, messages: [{ role: 'user', content: 'Reply only: OK' }] };
        // Free allowance: check limits, count the call, then use the server's key (any key from the client is ignored).
        if (input?.config?.provider === FREE_PROVIDER) {
          if (!freeModelKey) throw new ServiceError('free-unavailable', 503);
          if (FREE_UNSUPPORTED.includes(path)) throw new ServiceError('free-unsupported', 403);
          const ip = clientIp(request), token = bearer(request), kind = FREE_KIND[path];
          if (!freeQuota.burst(ip)) throw new ServiceError('rate', 429);
          if (kind) {
            const state = await freeQuota.use({ token, ip, action: 'consume', kind, account: publicConfig(host) });
            if (!state.allowed) throw new ServiceError(state.signedIn ? 'free-limit' : 'free-limit-local', 429);
            charged = { token, ip, kind, account: publicConfig(host) };
          }
          input = { ...input, apiKey: freeModelKey };
        }
        const caller = { '/api/review-task': reviewCaller, '/api/extract': knowledgeCaller, '/api/relations': relationCaller, '/api/mindmap': mindmapCaller, '/api/recognize': recognizeCaller }[path] || modelCaller;
        const result = await caller(input, { signal: controller.signal });
        charged = null;
        json(response, 200, path === '/api/test' ? { ok: true } : result);
      } catch (error) {
        // A failed or cancelled call does not use up the allowance.
        if (charged) await freeQuota.use({ ...charged, action: 'refund' }).catch(() => {});
        json(response, error instanceof ServiceError ? error.status : 500, { error: error instanceof ServiceError ? error.code : 'internal' });
      } finally { activeRequests--; }
      return;
    }
    if (!['GET', 'HEAD'].includes(request.method)) { json(response, 405, { error: 'method' }); return; }
    const entry = files.get(path);
    if (!entry) { json(response, 404, { error: 'not-found' }); return; }
    try {
      const body = await readFile(fileURLToPath(new URL(entry[0], import.meta.url)));
      response.writeHead(200, { ...headers, 'Content-Type': entry[1] });
      response.end(request.method === 'HEAD' ? undefined : body);
    } catch { json(response, 500, { error: 'internal' }); }
  });
}
// Local development secrets: server.local.json (gitignored via *.local.json) may hold the operator settings below.
// Environment variables always win. Values are never logged, and are only read when this file is started directly.
// LAN ("true"/"1") opens home-network mode so phones on the same Wi-Fi can connect; it is off unless set.
const LOCAL_SETTINGS = ['ZHIPU_API_KEY', 'SUPABASE_URL', 'SUPABASE_PUBLISHABLE_KEY', 'ADMIN_USERNAME', 'ADMIN_LOGIN_EMAIL', 'GOOGLE_CLIENT_ID', 'LAN', 'PUBLIC_ORIGIN'];
async function loadLocalSettings() {
  let values;
  try { values = JSON.parse(await readFile(fileURLToPath(new URL('server.local.json', import.meta.url)), 'utf8')); } catch { return []; }
  const loaded = [];
  for (const name of LOCAL_SETTINGS) {
    const value = typeof values?.[name] === 'boolean' ? String(values[name]) : values?.[name];
    if (!process.env[name] && typeof value === 'string' && value.trim()) { process.env[name] = value.trim(); loaded.push(name); }
  }
  return loaded;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const loaded = await loadLocalSettings();
  if (loaded.length) console.log(`Loaded from server.local.json: ${loaded.join(', ')}`);
  const port = Number(process.env.PORT || 4174), lan = /^(1|true)$/i.test(process.env.LAN || ''), lanHosts = lan ? privateAddresses() : [];
  // Public HTTPS address: PUBLIC_ORIGIN, or the address Render gives the service (RENDER_EXTERNAL_URL).
  const publicOrigin = (process.env.PUBLIC_ORIGIN || process.env.RENDER_EXTERNAL_URL || '').trim().replace(/\/$/, '');
  if (publicOrigin && !/^https:\/\/[a-z0-9.-]+$/i.test(publicOrigin)) { console.error('PUBLIC_ORIGIN must look like https://example.com (no path).'); process.exit(1); }
  createApp({ lanHosts, publicOrigin }).listen(port, lan || publicOrigin ? '0.0.0.0' : '127.0.0.1', () => {
    if (publicOrigin) { console.log(`KnowBack (public): ${publicOrigin}`); return; }
    console.log(`KnowBack: http://127.0.0.1:${port}`);
    if (!lan) return;
    if (!lanHosts.length) console.log('Home-network mode is on, but this computer has no private network address. Connect to Wi-Fi and restart.');
    for (const ip of lanHosts) console.log(`On a phone on the same Wi-Fi: http://${ip}:${port}`);
    console.log('Home-network mode: anyone on this Wi-Fi can open the app. Sync, voice and install need HTTPS and are unavailable here.');
  });
}
