import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';
import { createApp, privateAddresses, isNearby } from '../server.mjs';

const PHONE = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36';
async function serve(options) { const app = createApp(options); app.listen(0, '127.0.0.1'); await once(app, 'listening'); return app; }
// fetch() cannot set Host, so requests go through http.request.
const get = (app, path, headers) => new Promise((resolve, reject) => {
  http.get({ host: '127.0.0.1', port: app.address().port, path, headers }, response => { response.resume(); resolve(response); }).on('error', reject);
});

test('home-network mode is off by default: only loopback hosts are served', async () => {
  const app = await serve();
  try {
    assert.equal((await get(app, '/', { Host: 'localhost:4174' })).statusCode, 200);
    assert.equal((await get(app, '/', { Host: '192.168.1.5:4174' })).statusCode, 403);
  } finally { app.close(); }
});

test('home-network mode serves this computer\'s private address and nothing else', async () => {
  const app = await serve({ lanHosts: ['192.168.1.5'] });
  try {
    assert.equal((await get(app, '/', { Host: '192.168.1.5:4174' })).statusCode, 200);
    assert.equal((await get(app, '/', { Host: '192.168.1.9:4174' })).statusCode, 403, 'another address on the network');
    assert.equal((await get(app, '/', { Host: 'evil.example:4174' })).statusCode, 403, 'DNS rebinding');
    assert.equal((await get(app, '/api/public-config', { Host: '192.168.1.5:4174', Origin: 'http://evil.example' })).statusCode, 403);
  } finally { app.close(); }
});

test('phones opening the start page get the phone layout; ?desktop keeps the desktop page', async () => {
  const app = await serve();
  try {
    const phone = await get(app, '/', { Host: 'localhost', 'User-Agent': PHONE });
    assert.equal(phone.statusCode, 302); assert.equal(phone.headers.location, '/m/');
    assert.equal((await get(app, '/?desktop', { Host: 'localhost', 'User-Agent': PHONE })).statusCode, 200);
    assert.equal((await get(app, '/', { Host: 'localhost', 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130.0' })).statusCode, 200);
    assert.equal((await get(app, '/m/', { Host: 'localhost', 'User-Agent': PHONE })).statusCode, 200);
  } finally { app.close(); }
});

test('public mode serves only its HTTPS address, checks its origin and sends HSTS', async () => {
  const app = await serve({ publicOrigin: 'https://zhihui.onrender.com' });
  try {
    const page = await get(app, '/', { Host: 'zhihui.onrender.com' });
    assert.equal(page.statusCode, 200); assert.match(page.headers['strict-transport-security'], /max-age=/);
    assert.equal((await get(app, '/api/public-config', { Host: 'zhihui.onrender.com', Origin: 'https://zhihui.onrender.com' })).statusCode, 200);
    assert.equal((await get(app, '/api/public-config', { Host: 'zhihui.onrender.com', Origin: 'http://zhihui.onrender.com' })).statusCode, 403);
    assert.equal((await get(app, '/', { Host: 'other.onrender.com' })).statusCode, 403);
    assert.equal((await get(app, '/', { Host: 'localhost' })).headers['strict-transport-security'], undefined);
  } finally { app.close(); }
});

test('public mode counts the no-account allowance per visitor, not per proxy', async () => {
  const seen = [];
  const freeQuota = { burst: () => true, use: async ({ ip }) => { seen.push(ip); return { allowed: true, signedIn: false }; } };
  const app = await serve({ publicOrigin: 'https://zhihui.onrender.com', freeModelKey: 'test-free-allowance-not-real', freeQuota });
  try {
    await get(app, '/api/free-quota', { Host: 'zhihui.onrender.com', 'X-Forwarded-For': '203.0.113.7, 10.0.0.1' });
    assert.deepEqual(seen, ['203.0.113.7']);
  } finally { app.close(); }
});

test('only private IPv4 addresses count as the home network', () => {
  const interfaces = { wifi: [{ family: 'IPv4', address: '192.168.1.5', internal: false }, { family: 'IPv6', address: 'fe80::1', internal: false }],
    lo: [{ family: 'IPv4', address: '127.0.0.1', internal: true }], vpn: [{ family: 'IPv4', address: '172.20.0.3', internal: false }], wan: [{ family: 'IPv4', address: '8.8.8.8', internal: false }] };
  assert.deepEqual(privateAddresses(interfaces), ['192.168.1.5', '172.20.0.3']);
  for (const ip of ['127.0.0.1', '::1', '::ffff:192.168.1.20', '10.0.0.8', '172.31.2.2']) assert.ok(isNearby(ip), ip);
  for (const ip of ['8.8.8.8', '::ffff:1.2.3.4', '172.32.0.1', '2001:db8::1']) assert.ok(!isNearby(ip), ip);
});
