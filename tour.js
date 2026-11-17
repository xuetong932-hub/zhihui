import { pick } from './i18n.js';
// Guided tour ("新手指引"): dims the page, rings one part of the home screen at a time and explains it in a small card
// with Back / Next (n/total) and a close button. Shown once per device after the first-run guide, and replayable.
// Each step lists candidate selectors (desktop top bar, phone tab bar); the first visible one is used and steps whose
// target is missing are skipped. Positions are set through CSSOM (element.style), which the page's CSP allows.
export const TOUR_KEY = 'knowledge-review.tour.v1';
export const tourDone = () => { try { return localStorage.getItem(TOUR_KEY) === '1'; } catch { return true; } };
const markDone = () => { try { localStorage.setItem(TOUR_KEY, '1'); } catch { /* Shown again next time. */ } };

export const TOUR_STEPS = [
  { targets: ['.home-scene-wrap .ask-bar', '.home-scene-wrap .ask-mic', '.home-scene-wrap .task-start[data-open-module]', '.module-open'], zh: '有问题就点这里问。回答会自动整理成知识卡片，归到对应的分类里。', en: 'Tap here to ask anything. Answers become knowledge cards, filed under the right subject.' },
  { targets: ['[data-tab="review"]', 'nav [data-review]'], zh: '每天到这里复习。系统按遗忘曲线安排，快忘的先复习。', en: 'Review here every day. The forgetting curve decides what comes up, so what you are about to forget comes first.' },
  { targets: ['[data-tab="pet"]'], zh: '这是小回。每天复习就能喂饱它，攒下的松果可以在商城换装饰。', en: 'This is Backy. Reviewing every day feeds it, and the pine cones you save buy decorations in the shop.' },
  { targets: ['[data-tab="library"]', 'nav [data-library]'], zh: '知识库里有全部卡片，还有记忆状态、知识图谱和思维导图。', en: 'The library holds all your cards, plus memory status, the knowledge graph and mind maps.' },
  { targets: ['[data-tab="discover"]', 'nav [data-recommend]'], zh: '这里有精选的博主、书籍和论文，学完可以去看更多。', en: 'Curated creators, books and papers to explore once you have learned something.' },
];
const visible = element => element && element.getClientRects().length > 0 && getComputedStyle(element).visibility !== 'hidden';
const findTarget = targets => { for (const selector of targets) { const element = [...document.querySelectorAll(selector)].find(visible); if (element) return element; } return null; };

export function createTour({ locale }) {
  let steps = [], index = 0, layer = null, ring = null, card = null;
  const tr = (zh, en, vars) => pick(zh, en, vars);
  function close() {
    markDone();
    window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true); document.removeEventListener('keydown', onKey, true);
    layer?.remove(); ring?.remove(); card?.remove(); layer = ring = card = null;
  }
  function onKey(event) {
    if (event.key === 'Escape') { event.preventDefault(); close(); }
    else if (event.key === 'ArrowRight') { event.preventDefault(); go(index + 1); }
    else if (event.key === 'ArrowLeft' && index > 0) { event.preventDefault(); go(index - 1); }
  }
  // Ring around the target and the card below it (above when there is no room), kept inside the window.
  function place() {
    const target = steps[index] && findTarget(steps[index].targets);
    if (!target || !card) return;
    const rect = target.getBoundingClientRect(), pad = 6, gap = 14, margin = 12;
    Object.assign(ring.style, { top: `${rect.top - pad}px`, left: `${rect.left - pad}px`, width: `${rect.width + pad * 2}px`, height: `${rect.height + pad * 2}px` });
    const width = Math.min(340, window.innerWidth - margin * 2), height = card.offsetHeight;
    const below = rect.bottom + pad + gap + height <= window.innerHeight - margin || rect.top - pad - gap - height < margin;
    const top = below ? Math.min(rect.bottom + pad + gap, window.innerHeight - height - margin) : rect.top - pad - gap - height;
    const left = Math.min(Math.max(rect.left + rect.width / 2 - width / 2, margin), window.innerWidth - width - margin);
    Object.assign(card.style, { width: `${width}px`, top: `${Math.max(margin, top)}px`, left: `${left}px` });
    card.dataset.side = below ? 'below' : 'above';
    card.style.setProperty('--arrow-left', `${Math.min(Math.max(rect.left + rect.width / 2 - left, 22), width - 22)}px`);
  }
  function go(next) {
    if (next >= steps.length) { close(); return; }
    index = Math.max(0, next);
    const step = steps[index], last = index === steps.length - 1;
    // Scroll only when the target is off screen (nav bars are fixed and always visible).
    const target = findTarget(step.targets), rect = target?.getBoundingClientRect();
    if (rect && (rect.top < 60 || rect.bottom > window.innerHeight - 100)) target.scrollIntoView({ block: 'center', behavior: 'instant' });
    card.innerHTML = `<button type="button" class="tour-close" aria-label="${tr('关闭新手指引', 'Close the guide')}">×</button>
      <p id="tour-text">${tr(step.zh, step.en)}</p>
      <div class="tour-actions">${index > 0 ? `<button type="button" class="text-button tour-back">${tr('上一步', 'Back')}</button>` : '<span></span>'}
        <button type="button" class="primary-button tour-next">${last ? tr('开始使用', 'Get started') : tr('下一步（{v0}/{v1}）', 'Next ({v0}/{v1})', { v0: index + 1, v1: steps.length })}</button></div>`;
    card.querySelector('.tour-close').onclick = close;
    card.querySelector('.tour-next').onclick = () => go(index + 1);
    const back = card.querySelector('.tour-back'); if (back) back.onclick = () => go(index - 1);
    place(); card.querySelector('.tour-next').focus({ preventScroll: true });
  }
  function start() {
    if (layer) return;
    steps = TOUR_STEPS.filter(step => findTarget(step.targets));
    if (!steps.length) { markDone(); return; }
    layer = document.createElement('div'); layer.className = 'tour-layer';
    ring = document.createElement('div'); ring.className = 'tour-ring'; ring.setAttribute('aria-hidden', 'true');
    card = document.createElement('div'); card.className = 'tour-card'; card.setAttribute('role', 'dialog'); card.setAttribute('aria-modal', 'true'); card.setAttribute('aria-labelledby', 'tour-text');
    document.body.append(layer, ring, card);
    window.addEventListener('resize', place); window.addEventListener('scroll', place, true); document.addEventListener('keydown', onKey, true);
    go(0);
  }
  return { start, close, get open() { return Boolean(layer); } };
}
