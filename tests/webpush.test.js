import test from 'node:test';
import assert from 'node:assert/strict';
import { createECDH, createDecipheriv, hkdfSync, randomBytes, verify, createPublicKey } from 'node:crypto';
import { vapidKeys, vapidAuthorization, encryptPayload, sendPush, pushEndpointAllowed, validPublicKey } from '../webpush.mjs';

// What a browser does with the request body (RFC 8291 / 8188), so the encryption is checked end to end.
function browserDecrypt(body, userEcdh, auth) {
  const salt = body.subarray(0, 16), idLength = body.readUInt8(20), serverPublic = body.subarray(21, 21 + idLength), data = body.subarray(21 + idLength);
  const secret = userEcdh.computeSecret(serverPublic);
  const ikm = Buffer.from(hkdfSync('sha256', secret, auth, Buffer.concat([Buffer.from('WebPush: info\0'), userEcdh.getPublicKey(), serverPublic]), 32));
  const key = Buffer.from(hkdfSync('sha256', ikm, salt, Buffer.from('Content-Encoding: aes128gcm\0'), 16));
  const nonce = Buffer.from(hkdfSync('sha256', ikm, salt, Buffer.from('Content-Encoding: nonce\0'), 12));
  const decipher = createDecipheriv('aes-128-gcm', key, nonce); decipher.setAuthTag(data.subarray(-16));
  const plain = Buffer.concat([decipher.update(data.subarray(0, -16)), decipher.final()]);
  assert.equal(plain.at(-1), 2, 'last record ends with the 0x02 delimiter');
  return plain.subarray(0, -1).toString();
}

test('webpush: a browser can decrypt what we send', () => {
  const user = createECDH('prime256v1'); user.generateKeys(); const auth = randomBytes(16);
  const subscription = { p256dh: user.getPublicKey().toString('base64url'), auth: auth.toString('base64url') };
  const message = JSON.stringify({ title: '小回', body: '今天有 6 张卡片等你 🌰' });
  assert.equal(browserDecrypt(encryptPayload(message, subscription), user, auth), message);
});

test('webpush: the VAPID token is signed by our key and names the push service', () => {
  const keys = vapidKeys();
  assert.ok(validPublicKey(keys.publicKey));
  const header = vapidAuthorization('https://fcm.googleapis.com/fcm/send/abc', { ...keys, subject: 'mailto:test@example.com' }, Date.UTC(2026, 10, 17));
  const [, token, k] = header.match(/^vapid t=([^,]+), k=(.+)$/);
  assert.equal(k, keys.publicKey);
  const [h, c, s] = token.split('.');
  const claims = JSON.parse(Buffer.from(c, 'base64url'));
  assert.equal(claims.aud, 'https://fcm.googleapis.com');
  assert.equal(claims.sub, 'mailto:test@example.com');
  const point = Buffer.from(keys.publicKey, 'base64url');
  const publicKey = createPublicKey({ key: { kty: 'EC', crv: 'P-256', x: point.subarray(1, 33).toString('base64url'), y: point.subarray(33).toString('base64url') }, format: 'jwk' });
  assert.ok(verify('sha256', Buffer.from(`${h}.${c}`), { key: publicKey, dsaEncoding: 'ieee-p1363' }, Buffer.from(s, 'base64url')));
});

test('webpush: only real push services are contacted; 410 means the subscription is gone', async () => {
  assert.ok(pushEndpointAllowed('https://fcm.googleapis.com/fcm/send/x'));
  assert.ok(pushEndpointAllowed('https://web.push.apple.com/abc'));
  assert.ok(!pushEndpointAllowed('https://evil.example.com/x'));
  assert.ok(!pushEndpointAllowed('http://fcm.googleapis.com/x'));
  const user = createECDH('prime256v1'); user.generateKeys();
  const subscription = { endpoint: 'https://fcm.googleapis.com/fcm/send/x', p256dh: user.getPublicKey().toString('base64url'), auth: randomBytes(16).toString('base64url') };
  let seen = null;
  const result = await sendPush(subscription, { title: 't' }, { ...vapidKeys(), subject: 'mailto:a@b.c' }, { fetchImpl: async (url, init) => { seen = { url, init }; return { ok: false, status: 410 }; } });
  assert.deepEqual(result, { ok: false, status: 410, gone: true });
  assert.equal(seen.init.headers['Content-Encoding'], 'aes128gcm');
  assert.equal((await sendPush({ ...subscription, endpoint: 'https://evil.example.com/x' }, {}, { ...vapidKeys(), subject: 'mailto:a@b.c' }, { fetchImpl: () => { throw new Error('must not connect'); } })).gone, true);
});
