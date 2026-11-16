// Personal page (我的 → tap your avatar): avatar (own photo or a 小回 pose), level, the badge wall and features coming
// later (membership, learning report, avatar frames). The avatar is kept on this device only: a small square JPEG as a
// data URL in localStorage, shown through a blob: URL because the page's CSP allows blob: images but not data:.
import { escapeHtml as e } from './chat-store.js';
import { pick } from './i18n.js';

const KEY = 'knowledge-review.avatar.v1';
export const AVATAR_POSES = ['wave', 'cheer', 'think', 'shy', 'stash', 'sleep'];
const MAX = 200000; // characters of data URL kept at most (~150 KB)

export function validAvatar(value) {
  if (typeof value !== 'string') return false;
  if (value.startsWith('mascot:')) return AVATAR_POSES.includes(value.slice(7));
  return /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(value) && value.length <= MAX;
}
export function savedAvatar() {
  try { const value = localStorage.getItem(KEY); return validAvatar(value) ? value : null; } catch { return null; }
}
export function saveAvatar(value) {
  try { if (value === null) localStorage.removeItem(KEY); else if (validAvatar(value)) localStorage.setItem(KEY, value); else return false; return true; } catch { return false; }
}
let cached = { value: null, url: '' };
// The picture to show for a stored avatar value (default: 小回 waving).
export function avatarSrc(value = savedAvatar()) {
  if (!value) return '/illustrations/mascot-wave.webp';
  if (value.startsWith('mascot:')) return `/illustrations/mascot-${value.slice(7)}.webp`;
  if (cached.value === value) return cached.url;
  const [head, body] = value.split(',');
  const bytes = Uint8Array.from(atob(body), ch => ch.charCodeAt(0));
  if (cached.url) URL.revokeObjectURL(cached.url);
  cached = { value, url: URL.createObjectURL(new Blob([bytes], { type: head.slice(5, head.indexOf(';')) })) };
  return cached.url;
}
export const isPhotoAvatar = (value = savedAvatar()) => Boolean(value && !value.startsWith('mascot:'));

// A chosen photo → centre square, 256 px, JPEG (smallest everywhere; Safari cannot encode WebP).
export async function photoToAvatar(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((resolve, reject) => { const image = new Image(); image.onload = () => resolve(image); image.onerror = reject; image.src = url; });
    const side = Math.min(img.naturalWidth, img.naturalHeight), canvas = document.createElement('canvas');
    canvas.width = canvas.height = 256;
    canvas.getContext('2d').drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, 256, 256);
    for (const quality of [0.86, 0.75, 0.6]) { const data = canvas.toDataURL('image/jpeg', quality); if (data.length <= MAX) return data; }
    return null;
  } finally { URL.revokeObjectURL(url); }
}

const SOON = () => [['vip', pick('知回会员', 'KnowBack Plus')], ['report', pick('学习报告', 'Learning report')], ['frame', pick('头像框', 'Avatar frames')]];
export function profileView({ name, level, levelCard, badgeWall, frame = '' }) {
  return `<section class="profile-page">
    <header class="book-top store-top"><button type="button" class="book-back" data-profile-back aria-label="${pick('返回', 'Back')}">‹</button><strong>${pick('个人主页', 'Profile')}</strong><span></span></header>
    <div class="profile-hero"><span class="avatar-wrap profile-avatar-wrap"><button type="button" class="profile-avatar ${isPhotoAvatar() ? 'is-photo' : ''}" data-avatar-change aria-label="${pick('换头像', 'Change avatar')}"><img src="${avatarSrc()}" alt="" decoding="async"><span class="profile-avatar-edit" aria-hidden="true">✎</span></button>${frame}</span>
      <h1>${e(name)}</h1><span class="profile-lv">Lv.${level.level}</span></div>
    ${levelCard}
    <div class="section-heading" id="badge-wall"><h2>${pick('徽章墙', 'Badge wall')}</h2></div>
    ${badgeWall}
    <div class="section-heading"><h2>${pick('即将开放', 'Coming soon')}</h2></div>
    <div class="soon-row">${SOON().map(([id, label]) => `<button type="button" class="soon-card" data-soon="${id}"><img src="/illustrations/world/${id}.webp" alt="" decoding="async"><strong>${label}</strong><em>${pick('即将开放', 'Coming soon')}</em></button>`).join('')}</div>
  </section>`;
}

// Avatar sheet: from the photo library, one of 小回's poses, or back to the default.
export function openAvatarSheet(done) {
  const layer = document.createElement('div');
  layer.className = 'scene-sheet-layer';
  layer.innerHTML = `<div class="scene-sheet avatar-sheet" role="dialog" aria-modal="true" aria-label="${pick('换头像', 'Change avatar')}">
    <div class="scene-sheet-head"><h2>${pick('换头像', 'Change avatar')}</h2><button type="button" class="scene-close" data-sheet-close aria-label="${pick('关闭', 'Close')}">✕</button></div>
    <label class="primary-button avatar-upload">${pick('从相册选择', 'Choose a photo')}<input type="file" accept="image/*" hidden></label>
    <p class="avatar-note" role="status"></p>
    <h3>${pick('用小回当头像', 'Use Backy')}</h3>
    <div class="avatar-poses">${AVATAR_POSES.map(pose => `<button type="button" data-avatar-pose="${pose}" aria-label="${pose}"><img src="/illustrations/mascot-${pose}.webp" alt="" loading="lazy"></button>`).join('')}</div>
    <button type="button" class="text-button avatar-reset" data-avatar-reset>${pick('恢复默认', 'Reset to default')}</button></div>`;
  document.body.append(layer); void layer.offsetWidth; layer.classList.add('open');
  const close = () => { layer.classList.remove('open'); document.removeEventListener('keydown', onKey); setTimeout(() => layer.remove(), 220); };
  const onKey = event => { if (event.key === 'Escape') close(); };
  const finish = value => { if (saveAvatar(value)) { close(); done(); } else layer.querySelector('.avatar-note').textContent = pick('保存失败，请换一张小一点的图片。', 'Could not save. Try a smaller picture.'); };
  document.addEventListener('keydown', onKey);
  layer.addEventListener('click', event => { if (event.target === layer || event.target.closest('[data-sheet-close]')) close(); });
  layer.querySelectorAll('[data-avatar-pose]').forEach(button => { button.onclick = () => finish(`mascot:${button.dataset.avatarPose}`); });
  layer.querySelector('[data-avatar-reset]').onclick = () => finish(null);
  layer.querySelector('input[type="file"]').onchange = async event => {
    const file = event.target.files?.[0];
    if (!file) return;
    layer.querySelector('.avatar-note').textContent = pick('正在处理…', 'Processing…');
    const data = await photoToAvatar(file).catch(() => null);
    if (data) finish(data); else layer.querySelector('.avatar-note').textContent = pick('这张图片无法使用，请换一张。', 'This picture cannot be used. Try another.');
  };
}
