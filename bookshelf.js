// Phone knowledge library as a bookshelf (after the Dog-ear reading app): every learning module is a book with its
// colour, icon, name and counts. Tap = pull it out (select), tap again / double tap = it flies to the middle, the cover
// opens and the book fills the screen; inside, a left table of contents lists the card categories. Long press =
// edit mode (books wobble, a sheet offers rename / cover colour / delete). knowledge-ui.js owns the state and data.
import { escapeHtml as e } from './chat-store.js';
import { pick } from './i18n.js';
import { COVER_COLORS, CUSTOM_ICONS, isPresetModule, ASK_MODULE } from './modules.js';
import { iconSvg } from './module-icons.js';

const PRESET_COLOR = { coding: 'sky', english: 'sage', work: 'honey', life: 'coral', health: 'rose', finance: 'olive', design: 'lavender', science: 'teal', humanities: 'honey', law: 'sky', mind: 'coral', other: 'sage' };
const PRESET_ART = ['coding', 'english', 'work', 'life'];
export function coverColor(profile, id) {
  const own = profile?.modules?.[id]?.color;
  if (COVER_COLORS.includes(own)) return own;
  if (PRESET_COLOR[id]) return PRESET_COLOR[id];
  let hash = 0;
  for (const ch of String(id)) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return COVER_COLORS[hash % COVER_COLORS.length];
}
const reduced = () => globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
// Animations do not advance in a hidden page; the sequence must still finish.
const played = (animation, ms) => Promise.race([animation.finished.catch(() => {}), wait(ms + 60)]);
const SPRING = 'cubic-bezier(.2,.9,.25,1.12)';

// Book heights in spine mode grow a little with the number of cards.
const tall = count => count >= 40 ? 3 : count >= 15 ? 2 : count >= 5 ? 1 : 0;
function bookHtml(book, { selected, editing, last }) {
  const note = pick('{n} 张 · {due} 待复习', '{n} cards · {due} due', { n: book.count, due: book.due });
  const art = PRESET_ART.includes(book.id) ? `<img src="/illustrations/icon-${book.id}.webp" alt="" decoding="async">` : iconSvg(book.icon, 30, '#ffffff');
  return `<div class="book-slot ${selected === book.id ? 'is-selected' : ''}"><button type="button" class="book cover-${book.color} tall-${tall(book.count)} ${selected === book.id ? 'is-selected' : last === book.id ? 'was-selected' : ''}" data-book="${book.id}" aria-label="${e(book.name)}，${e(note)}" aria-pressed="${selected === book.id}">
      <span class="book-spine" aria-hidden="true"><span class="book-art">${art}</span><strong class="book-title">${e(book.name)}</strong>${book.due ? '<span class="book-ribbon"></span>' : ''}</span>
      <span class="book-body"><span class="book-art">${art}</span><strong class="book-title">${e(book.name)}</strong><span class="book-note">${e(note)}</span>${book.due ? '<span class="book-ribbon" aria-hidden="true"></span>' : ''}</span></button>
      ${editing ? `<button type="button" class="book-x" data-book-delete="${book.id}" aria-label="${pick('删除「{name}」', 'Delete “{name}”', { name: e(book.name) })}">✕</button>` : ''}</div>`;
}

export function shelfView({ books, mode, selected, last, editing, canAdd, sheet, menu, error, extra = '' }) {
  const chosen = books.find(book => book.id === selected);
  const sheetBook = books.find(book => book.id === sheet);
  return `<section class="shelf-wrap">
    <div class="shelf-bar"><h2>${pick('我的书架', 'My bookshelf')}</h2><div class="shelf-tools">
      ${editing ? `<button type="button" class="shelf-done" data-shelf-done>${pick('完成', 'Done')}</button>` : `<button type="button" class="shelf-tool" data-shelf-menu aria-haspopup="menu" aria-label="${pick('更多', 'More')}">⋯</button>`}
    </div></div>
    <p role="alert" class="error">${e(error || '')}</p>
    <div class="shelf shelf-spine ${editing ? 'is-editing' : ''}">${books.map(book => bookHtml(book, { selected, editing, last })).join('')}
      ${canAdd && !editing ? `<div class="book-slot"><button type="button" class="book book-new" data-book-new aria-label="${pick('新建一本书', 'New book')}"><span class="book-body"><span class="book-plus" aria-hidden="true">＋</span><span class="book-note">${pick('新书', 'New book')}</span></span></button></div>` : ''}</div>
    ${chosen && !editing ? `<div class="shelf-info" role="status"><span class="shelf-info-dot cover-${chosen.color}" aria-hidden="true"></span><div><strong>${e(chosen.name)}</strong><span>${pick('{n} 张卡片 · {due} 张待复习', '{n} cards · {due} due', { n: chosen.count, due: chosen.due })}</span></div><button type="button" class="primary-button" data-book-open="${chosen.id}">${pick('打开', 'Open')}</button></div>` : ''}
    ${extra}
  </section>
  ${sheetBook ? `<div class="book-sheet-layer" data-sheet-close><div class="book-sheet" role="menu" aria-label="${e(sheetBook.name)}"><strong>${e(sheetBook.name)}</strong>
    ${isPresetModule(sheetBook.id) ? '' : `<button type="button" role="menuitem" data-sheet="rename">${pick('改名', 'Rename')}</button>`}
    <button type="button" role="menuitem" data-sheet="color">${pick('换封面颜色', 'Cover colour')}</button>
    ${sheetBook.id === ASK_MODULE ? '' : `<button type="button" role="menuitem" class="danger" data-sheet="delete">${isPresetModule(sheetBook.id) ? pick('从书架移走', 'Remove from shelf') : pick('删除', 'Delete')}</button>`}
    <button type="button" role="menuitem" data-sheet="cancel">${pick('取消', 'Cancel')}</button></div></div>` : ''}
  ${menu ? `<div class="book-sheet-layer" data-sheet-close><div class="book-sheet" role="menu" aria-label="${pick('更多', 'More')}">
    <button type="button" role="menuitem" data-menu="trash">${pick('回收站', 'Trash')}</button>
    <button type="button" role="menuitem" data-menu="backfill">${pick('整理尚未入库的历史问答（调用模型）', 'Organize missing past Q&A (uses model)')}</button>
    <button type="button" role="menuitem" data-sheet="cancel">${pick('取消', 'Cancel')}</button></div></div>` : ''}`;
}

// Inside a book: a header, a left table of contents (all, due, then each category) and the card list by chapter.
export function bookView({ book, chapters, total, dueCount, dueOnly, query, searching, chapter }) {
  const toc = `<button type="button" class="${!dueOnly && !chapter ? 'active' : ''}" data-toc="">${pick('全部', 'All')}<i>${total}</i></button>
    <button type="button" class="${dueOnly ? 'active' : ''}" data-toc-due>${pick('待复习', 'Due')}<i>${dueCount}</i></button><hr>
    ${chapters.map((item, i) => `<button type="button" class="${chapter === i ? 'active' : ''}" data-toc="${i}">${e(item.name)}<i>${item.cards.length}</i></button>`).join('')}`;
  const list = chapters.length ? chapters.map((item, i) => `<h3 class="book-chapter" id="book-chapter-${i}" data-chapter="${i}">${e(item.name)}</h3>${item.cards.map(card => `<button type="button" class="book-card" data-book-card="${card.id}">
      <strong>${e(card.title)}</strong><span class="book-card-sum">${e(card.summary.replace(/[#*`>\-\n]+/g, ' ').trim().slice(0, 70))}</span>
      <span class="book-card-tags">${card.due ? `<span class="tag-due">${pick('待复习', 'Due')}</span>` : ''}${card.important ? `<span class="tag-weak">${pick('重点', 'Key')}</span>` : ''}${card.status === 'paused' ? `<span>${pick('已暂停', 'Paused')}</span>` : ''}</span></button>`).join('')}`).join('')
    : `<p class="book-empty">${query ? pick('没有找到相关卡片', 'No matching cards') : dueOnly ? pick('这本书今天没有要复习的', 'Nothing due in this book today') : pick('这本书还是空的，提问后知识点会自动写进来。', 'This book is empty. Ask a question and its ideas are written here.')}</p>`;
  return `<section class="book-page cover-${book.color}">
    <header class="book-top"><button type="button" class="book-back" data-book-close aria-label="${pick('回到书架', 'Back to the shelf')}">‹</button><strong>${e(book.name)}</strong><button type="button" class="book-search-toggle" data-book-search aria-label="${pick('搜索', 'Search')}" aria-pressed="${searching}"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4 4"/></svg></button></header>
    ${searching ? `<div class="book-search"><input id="book-query" type="search" value="${e(query)}" placeholder="${pick('搜索这本书', 'Search this book')}" aria-label="${pick('搜索这本书', 'Search this book')}"></div>` : ''}
    <div class="book-spread"><nav class="book-toc" aria-label="${pick('目录', 'Contents')}"><span class="book-toc-title">${pick('目录', 'Contents')}</span>${toc}</nav><div class="book-cards">${list}</div></div>
  </section>`;
}

// One card opened from a book, full width, with a way back to the contents.
export const cardPageView = (book, cardHtml) => `<section class="book-page book-card-page cover-${book.color}"><header class="book-top"><button type="button" class="book-back" data-card-close aria-label="${pick('回到目录', 'Back to contents')}">‹</button><strong>${e(book.name)}</strong><span></span></header>${cardHtml}</section>`;

// Opening: the book flies to the middle and grows, the cover swings open on its spine, the page fills the screen.
export async function animateOpen(bookEl, done) {
  if (reduced() || !bookEl?.animate) { done(); return; }
  // Start from the turned-out cover when it is showing, else from the spine.
  const cover = bookEl.querySelector('.book-body'), r = (cover && cover.getBoundingClientRect().width > 50 ? cover : bookEl).getBoundingClientRect(), color = [...bookEl.classList].find(name => name.startsWith('cover-')) || '';
  const layer = document.createElement('div'), fly = document.createElement('div');
  layer.className = 'book-fly-layer'; fly.className = `book-fly ${color}`;
  fly.innerHTML = `<div class="book-fly-page"></div><div class="book-fly-cover">${bookEl.querySelector('.book-body').outerHTML}</div>`;
  layer.append(fly); document.body.append(layer);
  const w = Math.min(220, innerWidth * 0.56), h = w * 1.42, x = (innerWidth - w) / 2, y = (innerHeight - h) / 2 - 20;
  Object.assign(fly.style, { left: `${x}px`, top: `${y}px`, width: `${w}px`, height: `${h}px` });
  const from = `translate(${r.left - x}px, ${r.top - y}px) scale(${r.width / w}, ${r.height / h})`;
  void layer.offsetWidth; layer.classList.add('open');
  await played(fly.animate([{ transform: from }, { transform: 'none' }], { duration: 420, easing: SPRING, fill: 'forwards' }), 420);
  await played(fly.querySelector('.book-fly-cover').animate([{ transform: 'rotateY(0)' }, { transform: 'rotateY(-168deg)' }], { duration: 460, easing: 'cubic-bezier(.45,.05,.3,1)', fill: 'forwards' }), 460);
  const grow = `translate(${-x}px, ${-y}px) scale(${innerWidth / w}, ${innerHeight / h})`;
  fly.querySelector('.book-fly-cover').style.opacity = '0';
  await played(fly.animate([{ transform: 'none' }, { transform: grow }], { duration: 300, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'forwards' }), 300);
  done();
  await played(layer.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 220, fill: 'forwards' }), 220);
  layer.remove();
}

// Closing runs it backwards: the page shrinks to a book, the cover closes, and it flies back to its slot.
export async function animateClose(bookEl) {
  if (reduced() || !bookEl?.animate) return;
  const r = bookEl.getBoundingClientRect(), color = [...bookEl.classList].find(name => name.startsWith('cover-')) || '';
  const layer = document.createElement('div'), fly = document.createElement('div');
  layer.className = 'book-fly-layer open'; fly.className = `book-fly ${color}`;
  fly.innerHTML = `<div class="book-fly-page"></div><div class="book-fly-cover">${bookEl.querySelector('.book-body').outerHTML}</div>`;
  layer.append(fly); document.body.append(layer);
  const w = Math.min(220, innerWidth * 0.56), h = w * 1.42, x = (innerWidth - w) / 2, y = (innerHeight - h) / 2 - 20;
  Object.assign(fly.style, { left: `${x}px`, top: `${y}px`, width: `${w}px`, height: `${h}px` });
  bookEl.style.visibility = 'hidden';
  const cover = fly.querySelector('.book-fly-cover');
  cover.style.transform = 'rotateY(-168deg)';
  await played(fly.animate([{ transform: `translate(${-x}px, ${-y}px) scale(${innerWidth / w}, ${innerHeight / h})` }, { transform: 'none' }], { duration: 300, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'forwards' }), 300);
  await played(cover.animate([{ transform: 'rotateY(-168deg)' }, { transform: 'rotateY(0)' }], { duration: 380, easing: 'cubic-bezier(.45,.05,.3,1)', fill: 'forwards' }), 380);
  layer.classList.remove('open');
  await played(fly.animate([{ transform: 'none' }, { transform: `translate(${r.left - x}px, ${r.top - y}px) scale(${r.width / w}, ${r.height / h})` }], { duration: 380, easing: SPRING, fill: 'forwards' }), 380);
  bookEl.style.visibility = '';
  layer.remove();
}

// A small form dialog for a new book or a rename / colour change. Resolves to { name, color, icon } or null.
export function bookDialog({ title, name = '', color = 'sky', icon = 'bookmark', askName = true, askIcon = false }) {
  return new Promise(resolve => {
    const dialog = document.createElement('dialog');
    dialog.className = 'book-dialog';
    dialog.innerHTML = `<form method="dialog"><h2>${e(title)}</h2>
      ${askName ? `<label>${pick('书名', 'Name')}<input name="name" type="text" maxlength="20" required value="${e(name)}"></label>` : ''}
      <fieldset><legend>${pick('封面颜色', 'Cover colour')}</legend><div class="book-swatches">${COVER_COLORS.map(c => `<label class="book-swatch cover-${c}"><input type="radio" name="color" value="${c}" ${c === color ? 'checked' : ''}><span class="sr-only">${c}</span></label>`).join('')}</div></fieldset>
      ${askIcon ? `<fieldset><legend>${pick('图标', 'Icon')}</legend><div class="book-icons">${CUSTOM_ICONS.map(i => `<label class="book-icon-pick"><input type="radio" name="icon" value="${i}" ${i === icon ? 'checked' : ''}>${iconSvg(i, 20)}</label>`).join('')}</div></fieldset>` : ''}
      <div class="book-dialog-actions"><button type="button" class="text-button" value="cancel">${pick('取消', 'Cancel')}</button><button type="submit" class="primary-button" value="ok">${pick('好', 'OK')}</button></div></form>`;
    document.body.append(dialog);
    const form = dialog.querySelector('form');
    const finish = value => { dialog.close(); dialog.remove(); resolve(value); };
    dialog.querySelector('[value="cancel"]').onclick = () => finish(null);
    dialog.addEventListener('cancel', event => { event.preventDefault(); finish(null); });
    form.onsubmit = event => { event.preventDefault(); const data = new FormData(form); finish({ name: String(data.get('name') ?? name), color: String(data.get('color') || color), icon: String(data.get('icon') || icon) }); };
    dialog.showModal();
    (dialog.querySelector('input[name="name"]') || dialog.querySelector('input'))?.focus();
  });
}

// A yes / no confirmation for deleting a book.
export function confirmDialog(title, body, yes) {
  return new Promise(resolve => {
    const dialog = document.createElement('dialog');
    dialog.className = 'book-dialog';
    dialog.innerHTML = `<form method="dialog"><h2>${e(title)}</h2><p>${e(body)}</p><div class="book-dialog-actions"><button type="button" class="text-button" data-no>${pick('取消', 'Cancel')}</button><button type="submit" class="danger-button">${e(yes)}</button></div></form>`;
    document.body.append(dialog);
    const finish = value => { dialog.close(); dialog.remove(); resolve(value); };
    dialog.querySelector('[data-no]').onclick = () => finish(false);
    dialog.addEventListener('cancel', event => { event.preventDefault(); finish(false); });
    dialog.querySelector('form').onsubmit = event => { event.preventDefault(); finish(true); };
    dialog.showModal();
  });
}
