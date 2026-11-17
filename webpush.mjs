// Web Push without dependencies: VAPID (RFC 8292, ES256 JWT) and aes128gcm payload encryption (RFC 8291 / 8188),
// using only Node's crypto. Used by server.mjs to send review reminders.
import { createECDH, createPrivateKey, createPublicKey, createCipheriv, sign, hkdfSync, randomBytes } from 'node:crypto';

const b64u = buffer => Buffer.from(buffer).toString('base64url');
const fromB64u = text => Buffer.from(String(text), 'base64url');

// A new VAPID key pair as base64url strings: public = uncompressed P-256 point (65 bytes), private = 32-byte scalar.
export function vapidKeys() {
  const ecdh = createECDH('prime256v1'); ecdh.generateKeys();
  return { publicKey: b64u(ecdh.getPublicKey()), privateKey: b64u(ecdh.getPrivateKey()) };
}
const privateKeyObject = (publicKey, privateKey) => {
  const point = fromB64u(publicKey);
  return createPrivateKey({ key: { kty: 'EC', crv: 'P-256', d: b64u(fromB64u(privateKey)), x: b64u(point.subarray(1, 33)), y: b64u(point.subarray(33, 65)) }, format: 'jwk' });
};

// The Authorization header for one push service origin: "vapid t=<jwt>, k=<public key>".
export function vapidAuthorization(endpoint, { publicKey, privateKey, subject }, now = Date.now()) {
  const header = b64u(JSON.stringify({ typ: 'JWT', alg: 'ES256' }));
  const claims = b64u(JSON.stringify({ aud: new URL(endpoint).origin, exp: Math.floor(now / 1000) + 12 * 3600, sub: subject }));
  const signature = sign('sha256', Buffer.from(`${header}.${claims}`), { key: privateKeyObject(publicKey, privateKey), dsaEncoding: 'ieee-p1363' });
  return `vapid t=${header}.${claims}.${b64u(signature)}, k=${publicKey}`;
}

// Encrypt a payload for one subscription (keys.p256dh, keys.auth from PushSubscription.toJSON()). Returns the request body.
export function encryptPayload(payload, { p256dh, auth }, { salt = randomBytes(16), serverKeys } = {}) {
  const ecdh = createECDH('prime256v1');
  if (serverKeys) ecdh.setPrivateKey(serverKeys.privateKey); else ecdh.generateKeys();
  const serverPublic = ecdh.getPublicKey(), userPublic = fromB64u(p256dh), secret = ecdh.computeSecret(userPublic);
  const ikm = Buffer.from(hkdfSync('sha256', secret, fromB64u(auth), Buffer.concat([Buffer.from('WebPush: info\0'), userPublic, serverPublic]), 32));
  const key = Buffer.from(hkdfSync('sha256', ikm, salt, Buffer.from('Content-Encoding: aes128gcm\0'), 16));
  const nonce = Buffer.from(hkdfSync('sha256', ikm, salt, Buffer.from('Content-Encoding: nonce\0'), 12));
  const cipher = createCipheriv('aes-128-gcm', key, nonce);
  const body = Buffer.concat([cipher.update(Buffer.concat([Buffer.from(payload), Buffer.from([2])])), cipher.final(), cipher.getAuthTag()]);
  const header = Buffer.alloc(21); salt.copy(header, 0); header.writeUInt32BE(4096, 16); header.writeUInt8(serverPublic.length, 20);
  return Buffer.concat([header, serverPublic, body]);
}

// Only the push services browsers actually use; anything else is refused before we connect to it.
const PUSH_HOSTS = [/^fcm\.googleapis\.com$/, /^updates\.push\.services\.mozilla\.com$/, /(^|\.)push\.apple\.com$/, /\.notify\.windows\.com$/];
export const pushEndpointAllowed = endpoint => { try { const url = new URL(endpoint); return url.protocol === 'https:' && PUSH_HOSTS.some(host => host.test(url.hostname)); } catch { return false; } };

// Send one notification. Returns { ok, status, gone } — gone: the subscription no longer exists (404 / 410).
export async function sendPush(subscription, payload, vapid, { fetchImpl = fetch, ttl = 6 * 3600 } = {}) {
  if (!pushEndpointAllowed(subscription.endpoint)) return { ok: false, status: 0, gone: true };
  const response = await fetchImpl(subscription.endpoint, {
    method: 'POST', redirect: 'error', signal: AbortSignal.timeout(15000),
    headers: { Authorization: vapidAuthorization(subscription.endpoint, vapid), 'Content-Encoding': 'aes128gcm', 'Content-Type': 'application/octet-stream', TTL: String(ttl), Urgency: 'normal' },
    body: encryptPayload(JSON.stringify(payload), subscription),
  });
  return { ok: response.ok, status: response.status, gone: response.status === 404 || response.status === 410 };
}

// Exposed for tests: check a public key is a valid uncompressed P-256 point.
export const validPublicKey = key => { try { createPublicKey({ key: { kty: 'EC', crv: 'P-256', x: b64u(fromB64u(key).subarray(1, 33)), y: b64u(fromB64u(key).subarray(33, 65)) }, format: 'jwk' }); return fromB64u(key).length === 65; } catch { return false; } };
