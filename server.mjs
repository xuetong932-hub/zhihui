import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { callModel, ServiceError } from './model-service.mjs';
import { extractKnowledge } from './knowledge-service.mjs';
import { reviewTask } from './review-service.mjs';

const files = new Map([
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ...['app.js', 'chat-ui.js', 'chat-store.js', 'providers.js', 'knowledge-store.js', 'knowledge-ui.js','review-store.js','review-ui.js','device-ui.js','cloud-ui.js','model-help.js','local-space.js','snapshot-merge.js','auth.js','auth-ui.js','admin-ui.js','modules.js','memory-viz.js','memory-ui.js','docx.js','google-docs.js','sw.js'].map(name => [`/${name}`, [name, 'text/javascript; charset=utf-8']]),
  ['/manifest.webmanifest',['manifest.webmanifest','application/manifest+json']],['/icon.svg',['icon.svg','image/svg+xml']],
  ['/styles.css', ['styles.css', 'text/css; charset=utf-8']],
  ['/oauth-callback.html', ['oauth-callback.html', 'text/html; charset=utf-8']],
]);
const headers = {
  'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer',
  'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self' https://*.supabase.co https://www.googleapis.com; img-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
};
function json(response, status, data) {
  if (response.destroyed) return;
  response.writeHead(status, { ...headers, 'Content-Type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(data));
}
async function readJson(request) {
  if (!request.headers['content-type']?.startsWith('application/json')) throw new ServiceError('request', 415);
  const chunks = [];
  let bytes = 0;
  for await (const chunk of request) {
    bytes += chunk.length;
    if (bytes > 320 * 1024) throw new ServiceError('large', 413);
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
export function createApp({ modelCaller = callModel, knowledgeCaller = extractKnowledge,reviewCaller=reviewTask, publicConfig = () => publicConfigFromEnv(), extraRoute } = {}) {
  let activeRequests = 0;
  return http.createServer(async (request, response) => {
    // Prototype is loopback-only. Reject foreign origins and DNS-rebinding hosts.
    const host = request.headers.host || '';
    if (!/^(127\.0\.0\.1|localhost)(:\d+)?$/.test(host)) { json(response, 403, { error: 'origin' }); return; }
    if (request.headers.origin && request.headers.origin !== `http://${host}`) { json(response, 403, { error: 'origin' }); return; }
    const path = new URL(request.url, `http://${host}`).pathname;
    if (path === '/api/public-config') { if (request.method !== 'GET') { json(response, 405, { error: 'method' }); return; } json(response, 200, publicConfig(host)); return; }
    // Test servers mount extra routes (the fake account service); production passes none.
    if (extraRoute && await extraRoute(request, response, path)) return;
    if (path === '/api/chat' || path === '/api/test' || path === '/api/extract'||path==='/api/review-task') {
      if (request.method !== 'POST') { json(response, 405, { error: 'method' }); return; }
      if (activeRequests >= 2) { json(response, 429, { error: 'busy' }); return; }
      activeRequests++;
      const controller = new AbortController();
      response.on('close', () => { if (!response.writableEnded) controller.abort(); });
      try {
        let input = await readJson(request);
        if (path === '/api/test' && input && typeof input === 'object') input = { ...input, config: { ...input.config, search: false }, messages: [{ role: 'user', content: 'Reply only: OK' }] };
        const result = await (path==='/api/review-task'?reviewCaller:path === '/api/extract' ? knowledgeCaller : modelCaller)(input, { signal: controller.signal });
        json(response, 200, path === '/api/test' ? { ok: true } : result);
      } catch (error) {
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
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT || 4174);
  createApp().listen(port, '127.0.0.1', () => console.log(`Knowledge Review: http://127.0.0.1:${port}`));
}
