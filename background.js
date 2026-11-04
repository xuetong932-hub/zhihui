import { pick } from './i18n.js';
// Page background: none, a built-in photo or the user's own image, shown under the page with adjustable opacity and blur.
// Kept per device like day/night: the choice in localStorage, an uploaded image (resized to ≤1920px JPEG) in IndexedDB.
// Nothing here is synced, exported or sent to a server. Cards and text keep their solid surfaces, so text stays readable.
const KEY = 'knowledge-review.background.v1', DB = 'knowledge-review.files', STORE = 'files', FILE = 'background';
// Built-in images: photos from Unsplash (free Unsplash License) and two anime scenes supplied by the product owner;
// sources are listed in docs/BACKGROUNDS.md.
export const PRESET_BACKGROUNDS = [
  { id: 'lake', zh: '湖光山色', en: 'Mountain lake' },
  { id: 'forest', zh: '林间光束', en: 'Forest light' },
  { id: 'sea', zh: '黄昏海面', en: 'Sunset sea' },
  { id: 'anime-day', zh: '动漫 · 晴空午后', en: 'Anime · Sunny afternoon' },
  { id: 'anime-night', zh: '动漫 · 城市夜色', en: 'Anime · City night' },
  { id: 'neon-street', zh: '霓虹雨巷', en: 'Neon alley' },
  { id: 'neon-city', zh: '未来城市', en: 'Future city' },
  { id: 'silhouette', zh: '紫色天空', en: 'Violet sky' },
];
// Any image the browser can decode is accepted; it is re-encoded as JPEG, so the stored copy stays small.
export const MAX_UPLOAD_BYTES = 30 * 1024 * 1024, MAX_SIDE = 2560;
// Fit: 'cover' fills the window and crops the overflow; 'contain' shows the whole image with the page colour around it.
// Position picks which part stays in view when cropping (or where the image sits when shown whole).
export const FITS = ['cover', 'contain'];
export const POSITIONS = ['left top', 'center top', 'right top', 'left center', 'center', 'right center', 'left bottom', 'center bottom', 'right bottom'];
export const DEFAULT_BACKGROUND = { choice: 'none', opacity: 60, blur: 0, fit: 'cover', position: 'center' };
const choices = () => ['none', 'custom', ...PRESET_BACKGROUNDS.map(item => `preset:${item.id}`)];
export const validBackground = value => Boolean(value && choices().includes(value.choice)
  && Number.isInteger(value.opacity) && value.opacity >= 10 && value.opacity <= 100 && Number.isInteger(value.blur) && value.blur >= 0 && value.blur <= 20
  && FITS.includes(value.fit) && POSITIONS.includes(value.position));
// Settings saved before fit and position existed are kept, with those two filled in.
export function loadBackground(raw) { try { const value = { ...DEFAULT_BACKGROUND, ...JSON.parse(raw) }; return validBackground(value) ? value : { ...DEFAULT_BACKGROUND }; } catch { return { ...DEFAULT_BACKGROUND }; } }
const read = () => { try { return loadBackground(localStorage.getItem(KEY)); } catch { return { ...DEFAULT_BACKGROUND }; } };
const write = value => { try { localStorage.setItem(KEY, JSON.stringify(value)); } catch { /* This page only. */ } };

function db() {
  return new Promise((resolve, reject) => { const request = indexedDB.open(DB, 1); request.onupgradeneeded = () => request.result.createObjectStore(STORE); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
}
async function fileOp(mode, action) {
  const base = await db();
  try { return await new Promise((resolve, reject) => { const tx = base.transaction(STORE, mode), request = action(tx.objectStore(STORE)); tx.oncomplete = () => resolve(request.result); tx.onerror = () => reject(tx.error); }); }
  finally { base.close(); }
}
const getImage = () => fileOp('readonly', store => store.get(FILE)).catch(() => null);
const putImage = blob => fileOp('readwrite', store => store.put(blob, FILE));
const deleteImage = () => fileOp('readwrite', store => store.delete(FILE)).catch(() => {});

// Decoding through a canvas drops metadata (such as location) and keeps the stored file small.
// Also used for photo questions, with a smaller maximum side.
export async function resizeImage(file, { maxSide = MAX_SIDE } = {}) {
  if (file.type && !file.type.startsWith('image/')) throw new Error('type');
  if (file.size > MAX_UPLOAD_BYTES) throw new Error('size');
  const bitmap = await createImageBitmap(file).catch(() => { throw new Error('decode'); });
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height)), canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale); canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height); bitmap.close();
  return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('decode')), 'image/jpeg', 0.85));
}

let state = read(), objectUrl = '';
function layer() {
  let element = document.querySelector('.app-background');
  if (!element) { element = document.createElement('div'); element.className = 'app-background'; element.setAttribute('aria-hidden', 'true'); document.body.prepend(element); }
  return element;
}
// Styles are set through the CSSOM, which the page's style-src 'self' policy allows (inline style attributes are blocked).
async function apply() {
  const element = layer(); let url = '';
  if (state.choice.startsWith('preset:')) url = `/backgrounds/${state.choice.slice(7)}.jpg`;
  else if (state.choice === 'custom') { const blob = await getImage(); if (blob) { if (objectUrl) URL.revokeObjectURL(objectUrl); objectUrl = URL.createObjectURL(blob); url = objectUrl; } }
  element.style.backgroundImage = url ? `url("${url}")` : 'none';
  element.style.backgroundSize = state.fit; element.style.backgroundPosition = state.position;
  element.style.opacity = String(state.opacity / 100);
  element.style.setProperty('--bg-blur', `${state.blur}px`);
  document.documentElement.classList.toggle('has-background', Boolean(url));
}
export function initBackground() { apply(); }

const words = {
  zh: { title: '背景', none: '无背景', mine: '我的图片', upload: '上传图片', remove: '删除我的图片', opacity: '透明度', blur: '模糊', done: '完成', hint: '常见图片格式均可，不超过 30MB。图片只保存在这台设备，不会上传。', type: '请选择图片文件。', size: '图片超过 30MB，请换一张。', fit: '显示方式', cover: '铺满', contain: '完整显示', coverHint: '铺满窗口，超出的部分会被裁掉', containHint: '显示整张图片，周围留出页面底色', position: '对齐位置', ratio: (image, screen) => `图片比例 ${image}，当前窗口 ${screen}。`, crop: '比例不同：铺满时会裁掉一部分，可用“对齐位置”选择保留哪一块。', fits: '比例接近，铺满效果最好。', decode: '这张图片无法读取，请换一张。', save: '图片无法保存在此浏览器，可能是存储空间不足。', busy: '正在处理图片…', credit: '内置照片来自 Unsplash（Unsplash License）；动漫图片由知回提供。' },
  en: { title: 'Background', none: 'None', mine: 'My image', upload: 'Upload image', remove: 'Delete my image', opacity: 'Opacity', blur: 'Blur', done: 'Done', hint: 'Any common image format up to 30 MB. The image stays on this device and is never uploaded.', type: 'Please choose an image file.', size: 'The image is over 30 MB. Please choose another.', fit: 'Fit', cover: 'Fill', contain: 'Whole image', coverHint: 'Fills the window; overflow is cropped', containHint: 'Shows the whole image with the page colour around it', position: 'Position', ratio: (image, screen) => `Image ratio ${image}, window ${screen}.`, crop: 'Ratios differ: Fill crops part of the image; use Position to choose what stays.', fits: 'Ratios are close, so Fill works best.', decode: 'This image could not be read. Please choose another.', save: 'The image could not be saved in this browser; storage may be full.', busy: 'Processing image…', credit: 'Built-in photos from Unsplash (Unsplash License); anime images provided by 知回.' },
};
const esc = value => String(value).replace(/[&<>"']/g, char => `&#${char.charCodeAt(0)};`);

// The dialog changes the background live and remembers each change right away, like the day/night switch.
export async function openBackgroundDialog(locale) {
  const w = words[pick('zh', 'en')], dialog = document.createElement('dialog'); dialog.className = 'bg-dialog';
  const stored = await getImage(); if (stored && !objectUrl) objectUrl = URL.createObjectURL(stored);
  let message = '', busy = false, hasImage = Boolean(stored);
  const tile = (choice, label, image) => `<button type="button" class="bg-tile ${state.choice === choice ? 'active' : ''}" data-bg="${choice}" aria-pressed="${state.choice === choice}">${image ? `<img src="${image}" alt="" loading="lazy">` : '<span class="bg-empty"></span>'}<span class="bg-label">${esc(label)}</span></button>`;
  const draw = () => {
    dialog.innerHTML = `<form method="dialog" class="bg-panel"><div class="section-heading"><h2>${w.title}</h2><button class="text-button" value="done">${w.done}</button></div>
      <div class="bg-grid">${tile('none', w.none, '')}${PRESET_BACKGROUNDS.map(item => tile(`preset:${item.id}`, item[pick('zh', 'en')], `/backgrounds/${item.id}-thumb.jpg`)).join('')}${hasImage ? tile('custom', w.mine, objectUrl) : ''}</div>
      <div class="bg-upload"><label class="secondary-button bg-upload-button">${busy ? w.busy : `＋ ${w.upload}`}<input type="file" accept="image/*" hidden ${busy ? 'disabled' : ''}></label>${hasImage ? `<button type="button" class="text-button" data-remove>${w.remove}</button>` : ''}</div>
      <p class="field-hint">${w.hint}</p>${message ? `<p class="error" role="alert">${message}</p>` : ''}
      ${state.choice === 'none' ? '' : `<div class="bg-layout"><div><span class="bg-field">${w.fit}</span><div class="segmented bg-fit">${FITS.map(fit => `<button type="button" class="${state.fit === fit ? 'active' : ''}" data-fit="${fit}" aria-pressed="${state.fit === fit}" title="${w[`${fit}Hint`]}">${w[fit]}</button>`).join('')}</div><p class="field-hint">${w[`${state.fit}Hint`]}</p></div>
        <div><span class="bg-field">${w.position}</span><div class="bg-position" role="group" aria-label="${w.position}">${POSITIONS.map(position => `<button type="button" class="${state.position === position ? 'active' : ''}" data-position="${position}" aria-pressed="${state.position === position}" aria-label="${position}"><i></i></button>`).join('')}</div></div></div>
      <p class="field-hint" data-ratio></p>`}
      <label class="bg-slider">${w.opacity}<input type="range" min="10" max="100" step="5" value="${state.opacity}" data-opacity><output>${state.opacity}%</output></label>
      <label class="bg-slider">${w.blur}<input type="range" min="0" max="20" step="1" value="${state.blur}" data-blur><output>${state.blur}px</output></label>
      <p class="bg-credit">${w.credit}</p></form>`;
    dialog.querySelectorAll('.bg-tile img').forEach(img => { img.onerror = () => { const empty = document.createElement('span'); empty.className = 'bg-empty'; img.replaceWith(empty); }; });
    dialog.querySelectorAll('[data-bg]').forEach(button => { button.onclick = async () => { state = { ...state, choice: button.dataset.bg }; write(state); await apply(); draw(); }; });
    const slider = (selector, key, unit) => { const input = dialog.querySelector(selector); input.oninput = () => { state = { ...state, [key]: Number(input.value) }; input.nextElementSibling.textContent = `${input.value}${unit}`; write(state); apply(); }; };
    slider('[data-opacity]', 'opacity', '%'); slider('[data-blur]', 'blur', 'px');
    const bindChoice = (attribute, key) => dialog.querySelectorAll(`[data-${attribute}]`).forEach(button => { button.onclick = () => { state = { ...state, [key]: button.dataset[key] }; write(state); apply(); draw(); }; });
    bindChoice('fit', 'fit'); bindChoice('position', 'position');
    // Compare the image's proportions with the window so the user knows whether Fill will crop.
    const ratioNote = dialog.querySelector('[data-ratio]'), current = layer().style.backgroundImage.match(/url\("(.+)"\)/)?.[1];
    if (ratioNote && current) { const probe = new Image(); probe.onload = () => {
      const label = (a, b) => { const r = a / b, known = [[16, 9], [16, 10], [4, 3], [3, 2], [1, 1], [21, 9], [9, 16], [3, 4]].find(([x, y]) => Math.abs(x / y - r) < 0.03); return known ? known.join(':') : `${r.toFixed(2)}:1`; };
      const close = Math.abs(probe.naturalWidth / probe.naturalHeight - innerWidth / innerHeight) / (innerWidth / innerHeight) < 0.12;
      ratioNote.textContent = `${w.ratio(label(probe.naturalWidth, probe.naturalHeight), label(innerWidth, innerHeight))}${close ? w.fits : w.crop}`;
    }; probe.src = current; }
    dialog.querySelector('input[type=file]').onchange = async event => {
      const file = event.target.files[0]; if (!file) return;
      busy = true; message = ''; draw();
      try { const blob = await resizeImage(file); try { await putImage(blob); } catch { throw new Error('save'); } hasImage = true; state = { ...state, choice: 'custom' }; write(state); await apply(); }
      catch (error) { message = w[error.message] || w.decode; }
      busy = false; draw();
    };
    dialog.querySelector('[data-remove]')?.addEventListener('click', async () => { await deleteImage(); hasImage = false; if (state.choice === 'custom') state = { ...state, choice: 'none' }; write(state); await apply(); draw(); });
  };
  draw(); document.body.append(dialog);
  dialog.addEventListener('close', () => dialog.remove());
  dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
  dialog.showModal();
}
