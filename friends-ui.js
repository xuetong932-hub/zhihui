// 好友 (个人主页 → 好友): my friend code as text and QR code, 扫一扫 (camera, only when tapped), add by ID, requests
// received and sent, and the friends list. Everything goes through the account service (cloud-schema.sql friend_*);
// friends see each other's name and code only. Local mode has no account, so it only explains how to join.
import { escapeHtml as e } from './chat-store.js';
import { pick } from './i18n.js';
import { qrSvg } from './qr.js';

export const FRIEND_CODE = /KB-[2-9A-HJKMNP-Z]{6}/i;
export const friendLink = code => `${location.origin}/add/${code}`;
// The code inside whatever a QR code or a paste held (a link, the bare code, extra text), or ''.
export const codeIn = text => (String(text || '').match(FRIEND_CODE)?.[0] || '').toUpperCase();

const tr = (zh, en, vars) => pick(zh, en, vars);
const errorText = error => ({
  not_eligible: tr('登录并完成注册后才能添加好友。', 'Sign in and finish registering to add friends.'),
  not_found: tr('没有找到这个 ID。', 'No one has this ID.'),
  friend_self: tr('这是你自己的 ID。', 'That is your own ID.'),
  rate_limited: tr('操作太频繁了，稍后再试。', 'Too many requests. Try again later.'),
})[error?.code] || (error?.status === 404 ? tr('好友服务暂未开放。', 'Friends are not open yet.') : tr('连接失败，请稍后再试。', 'Could not connect. Try again later.'));

// A bottom sheet in the style of the background / display sheets. draw(layer, close) fills it.
function sheet(className, label, draw, onClose) {
  if (document.querySelector('.scene-sheet-layer')) return null;
  const layer = document.createElement('div');
  layer.className = `scene-sheet-layer ${className}`;
  const close = () => { onClose?.(); layer.classList.remove('open'); document.removeEventListener('keydown', onKey); setTimeout(() => layer.remove(), 220); };
  const onKey = event => { if (event.key === 'Escape') close(); };
  layer.addEventListener('click', event => { if (event.target === layer) close(); });
  document.addEventListener('keydown', onKey);
  layer.innerHTML = `<div class="scene-sheet" role="dialog" aria-modal="true" aria-label="${label}"><div class="scene-sheet-head"><h2>${label}</h2><button type="button" class="scene-close" data-sheet-close aria-label="${tr('关闭', 'Close')}">✕</button></div><div class="sheet-body"></div></div>`;
  layer.querySelector('[data-sheet-close]').onclick = close;
  document.body.append(layer); void layer.offsetWidth; layer.classList.add('open');
  draw(layer.querySelector('.sheet-body'), close);
  return close;
}

// jsQR (vendor/jsQR.js) is loaded only when the browser cannot read QR codes itself.
let jsqrLoading = null;
const loadJsQR = () => jsqrLoading ||= new Promise((resolve, reject) => {
  if (globalThis.jsQR) { resolve(globalThis.jsQR); return; }
  const script = document.createElement('script'); script.src = '/vendor/jsQR.js'; script.async = true;
  script.onload = () => resolve(globalThis.jsQR); script.onerror = () => { jsqrLoading = null; reject(new Error('jsqr')); };
  document.head.append(script);
});
async function nativeDetector() {
  try { if (!('BarcodeDetector' in globalThis)) return null; const formats = await globalThis.BarcodeDetector.getSupportedFormats?.(); return formats && !formats.includes('qr_code') ? null : new globalThis.BarcodeDetector({ formats: ['qr_code'] }); }
  catch { return null; }
}
// Read a QR code from a video frame or an image: the browser's detector when it has one, otherwise jsQR on a canvas.
async function readQR(source, canvas) {
  const detector = await nativeDetector();
  if (detector) { try { const found = await detector.detect(source); if (found[0]?.rawValue) return found[0].rawValue; } catch { /* fall back below */ } }
  const width = source.videoWidth || source.naturalWidth || source.width, height = source.videoHeight || source.naturalHeight || source.height;
  if (!width || !height) return '';
  const scale = Math.min(1, 800 / Math.max(width, height));
  canvas.width = Math.round(width * scale); canvas.height = Math.round(height * scale);
  const context = canvas.getContext('2d', { willReadFrequently: true });
  context.drawImage(source, 0, 0, canvas.width, canvas.height);
  const jsQR = await loadJsQR();
  return jsQR(context.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height, { inversionAttempts: 'dontInvert' })?.data || '';
}

export function createFriendsUI({ auth, getAccount, refresh }) {
  let data = null, loading = false, error = '', note = '';
  const signedIn = () => { const account = getAccount?.(); return Boolean(account && !account.local && auth?.user); };
  const load = async () => {
    if (loading || !signedIn()) return;
    loading = true; error = ''; refresh();
    try { data = await auth.friends.overview(); } catch (reason) { error = errorText(reason); }
    loading = false; refresh();
  };
  const run = async (task, done) => { note = ''; try { const result = await task(); done?.(result); await load(); } catch (reason) { note = errorText(reason); refresh(); } };

  function view() {
    const top = `<header class="book-top store-top friends-top"><button type="button" class="book-back" data-friends-back aria-label="${tr('返回', 'Back')}">‹</button><strong>${tr('好友', 'Friends')}</strong><span></span></header>`;
    if (!signedIn()) return `<section class="friends-page">${top}<div class="friends-empty"><img src="/illustrations/mascot-wave.webp" alt="" decoding="async"><p>${tr('登录并完成注册后，就有自己的好友 ID 和二维码，可以和朋友互相添加。', 'Sign in and finish registering to get your own friend ID and QR code and add friends.')}</p><button type="button" class="primary-button" data-signin>${tr('登录 / 注册', 'Sign in / Register')}</button></div></section>`;
    if (!data) return `<section class="friends-page">${top}<p class="friends-status" role="status">${error ? e(error) : tr('正在加载…', 'Loading…')}</p>${error ? `<button type="button" class="secondary-button" data-friends-retry>${tr('重试', 'Try again')}</button>` : ''}</section>`;
    const person = (item, actions) => `<li class="friend-row"><span class="friend-avatar" aria-hidden="true"><img src="/illustrations/mascot-head.webp" alt="" decoding="async"></span><span class="friend-who"><strong>${e(item.name)}</strong><small>${e(item.code)}</small></span><span class="friend-actions">${actions}</span></li>`;
    const list = (title, items, actions) => items.length ? `<section class="friends-list"><h2>${title}</h2><ul>${items.map(item => person(item, actions(item))).join('')}</ul></section>` : '';
    return `<section class="friends-page">${top}
      <div class="friend-card"><div class="friend-qr">${qrSvg(friendLink(data.code), { hole: 7, label: tr('我的好友二维码', 'My friend QR code') })}<img class="friend-qr-logo" src="/illustrations/mascot-head.webp" alt="" decoding="async"></div>
        <p class="friend-id"><span>${tr('我的 ID', 'My ID')}</span><strong>${e(data.code)}</strong><button type="button" class="friend-copy" data-friend-copy>${tr('复制', 'Copy')}</button></p>
        <p class="friend-hint">${tr('让朋友用知回扫一扫，或用手机相机扫码。', 'Friends can scan it in KnowBack or with their phone camera.')}</p></div>
      <div class="friend-buttons"><button type="button" class="primary-button" data-friend-scan>${tr('扫一扫', 'Scan')}</button><button type="button" class="secondary-button" data-friend-enter>${tr('输入 ID', 'Enter ID')}</button></div>
      <p class="friends-status" role="status">${e(note)}</p>
      ${list(tr('新的请求', 'Requests'), data.received, item => `<button type="button" class="friend-accept" data-friend-accept="${e(item.code)}">${tr('同意', 'Accept')}</button><button type="button" class="friend-plain" data-friend-decline="${e(item.code)}">${tr('拒绝', 'Decline')}</button>`)}
      ${list(tr('好友', 'Friends'), data.friends, item => `<button type="button" class="friend-plain" data-friend-remove="${e(item.code)}" data-name="${e(item.name)}">${tr('删除', 'Remove')}</button>`)}
      ${data.friends.length || data.received.length ? '' : `<p class="friends-none">${tr('还没有好友，扫一扫朋友的二维码吧。', 'No friends yet. Scan a friend’s QR code.')}</p>`}
      ${list(tr('已发送', 'Sent'), data.sent, item => `<button type="button" class="friend-plain" data-friend-cancel="${e(item.code)}">${tr('撤回', 'Cancel')}</button>`)}
      <button type="button" class="friend-reset" data-friend-reset>${tr('重置我的 ID 和二维码', 'Reset my ID and QR code')}</button>
    </section>`;
  }

  // Look a code up and offer the right next step: add, accept, or say how things stand.
  function openAdd(code) {
    const target = codeIn(code);
    sheet('friend-add-layer', tr('添加好友', 'Add a friend'), async (body, close) => {
      if (!target) { body.innerHTML = `<p class="friends-status">${tr('没有识别到好友 ID。', 'No friend ID found.')}</p>`; return; }
      body.innerHTML = `<p class="friends-status" role="status">${tr('正在查找…', 'Looking up…')}</p>`;
      try {
        const found = await auth.friends.lookup(target);
        const state = { self: tr('这是你自己。', 'That is you.'), friends: tr('你们已经是好友了。', 'You are already friends.'), sent: tr('已发送请求，等待对方同意。', 'Request sent; waiting for them.'), received: tr('对方想加你为好友。', 'They want to add you.') }[found.state] || '';
        const action = found.state === 'none' ? tr('发送好友请求', 'Send friend request') : found.state === 'received' ? tr('同意', 'Accept') : '';
        body.innerHTML = `<div class="friend-found"><span class="friend-avatar big" aria-hidden="true"><img src="/illustrations/mascot-head.webp" alt="" decoding="async"></span><strong>${e(found.name)}</strong><small>${e(found.code)}</small>${state ? `<p>${state}</p>` : ''}${action ? `<button type="button" class="primary-button" data-friend-send>${action}</button>` : ''}</div>`;
        body.querySelector('[data-friend-send]')?.addEventListener('click', () => { close(); run(() => found.state === 'received' ? auth.friends.respond(target, true) : auth.friends.request(target), result => { note = result === 'friends' ? tr('已成为好友！', 'You are friends now!') : tr('请求已发送。', 'Request sent.'); }); });
      } catch (reason) { body.innerHTML = `<p class="friends-status">${e(errorText(reason))}</p>`; }
    });
  }
  function openEnter() {
    sheet('friend-enter-layer', tr('输入 ID', 'Enter ID'), (body, close) => {
      body.innerHTML = `<form class="friend-enter"><label class="field-label" for="friend-code">${tr('好友 ID', 'Friend ID')}</label><input id="friend-code" autocomplete="off" autocapitalize="characters" spellcheck="false" maxlength="40" placeholder="KB-XXXXXX"><p class="friends-status" role="status"></p><button class="primary-button" type="submit">${tr('查找', 'Find')}</button></form>`;
      const form = body.querySelector('form'), input = body.querySelector('input');
      input.focus();
      form.onsubmit = event => { event.preventDefault(); const code = codeIn(input.value); if (!code) { body.querySelector('.friends-status').textContent = tr('ID 的格式是 KB- 加 6 个字母或数字。', 'An ID is KB- and 6 letters or digits.'); return; } close(); setTimeout(() => openAdd(code), 240); };
    });
  }
  // The camera opens only here, after the tap; it stops when the sheet closes or a code is found.
  function openScan() {
    let stream = null, stopped = false;
    const stop = () => { stopped = true; stream?.getTracks().forEach(track => track.stop()); };
    sheet('friend-scan-layer', tr('扫一扫', 'Scan'), async (body, close) => {
      body.innerHTML = `<div class="scan-frame"><video playsinline muted></video><span class="scan-box" aria-hidden="true"></span></div><p class="friends-status" role="status">${tr('正在打开相机…', 'Opening the camera…')}</p>
        <div class="friend-buttons"><label class="secondary-button scan-photo">${tr('从相册选择', 'Choose a photo')}<input type="file" accept="image/*" hidden></label><button type="button" class="secondary-button" data-scan-enter>${tr('输入 ID', 'Enter ID')}</button></div><canvas hidden></canvas>`;
      const video = body.querySelector('video'), status = body.querySelector('.friends-status'), canvas = body.querySelector('canvas');
      const found = text => { const code = codeIn(text); if (!code) { status.textContent = tr('这不是知回的好友二维码。', 'That is not a KnowBack friend code.'); return false; } stop(); close(); setTimeout(() => openAdd(code), 240); return true; };
      body.querySelector('[data-scan-enter]').onclick = () => { stop(); close(); setTimeout(openEnter, 240); };
      body.querySelector('input[type=file]').onchange = async event => {
        const file = event.target.files?.[0]; if (!file) return;
        const url = URL.createObjectURL(file), image = new Image();
        image.onload = async () => { try { const text = await readQR(image, canvas); if (!text) status.textContent = tr('图片里没有找到二维码。', 'No QR code in that picture.'); else found(text); } catch { status.textContent = tr('无法读取这张图片。', 'Could not read that picture.'); } finally { URL.revokeObjectURL(url); } };
        image.src = url;
      };
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
        if (stopped) { stop(); return; }
        video.srcObject = stream; await video.play();
        status.textContent = tr('把好友的二维码放进框里', 'Put the QR code inside the frame');
        const tick = async () => { if (stopped) return; try { const text = await readQR(video, canvas); if (text && found(text)) return; } catch { /* keep trying */ } setTimeout(tick, 280); };
        tick();
      } catch { status.textContent = tr('无法使用相机，可以从相册选择或输入 ID。', 'The camera is not available; choose a photo or enter the ID.'); }
    }, stop);
  }

  function bind() {
    document.querySelector('[data-friends-retry]')?.addEventListener('click', load);
    document.querySelector('[data-friend-scan]')?.addEventListener('click', openScan);
    document.querySelector('[data-friend-enter]')?.addEventListener('click', openEnter);
    document.querySelector('[data-friend-copy]')?.addEventListener('click', async () => { try { await navigator.clipboard.writeText(data.code); note = tr('ID 已复制', 'ID copied'); } catch { note = data.code; } refresh(); });
    document.querySelectorAll('[data-friend-accept]').forEach(button => { button.onclick = () => run(() => auth.friends.respond(button.dataset.friendAccept, true), () => { note = tr('已成为好友！', 'You are friends now!'); }); });
    document.querySelectorAll('[data-friend-decline]').forEach(button => { button.onclick = () => run(() => auth.friends.respond(button.dataset.friendDecline, false)); });
    document.querySelectorAll('[data-friend-cancel]').forEach(button => { button.onclick = () => run(() => auth.friends.remove(button.dataset.friendCancel)); });
    document.querySelectorAll('[data-friend-remove]').forEach(button => { button.onclick = () => { if (confirm(tr('删除好友「{name}」？', 'Remove {name} from your friends?', { name: button.dataset.name }))) run(() => auth.friends.remove(button.dataset.friendRemove)); }; });
    document.querySelector('[data-friend-reset]')?.addEventListener('click', () => { if (confirm(tr('重置后，旧的 ID 和二维码会失效。确定重置？', 'Your old ID and QR code will stop working. Reset?'))) run(() => auth.friends.resetCode(), () => { note = tr('已换成新的 ID', 'You have a new ID'); }); });
  }

  return { view, bind, load, openAdd, get requests() { return data?.received?.length || 0; }, get ready() { return Boolean(data); } };
}
