import { latestReview, dueInfo } from './review-store.js';
import { memoryState, retrievability } from './fsrs.js';
import { normalizeQuestion, localDay } from './knowledge-store.js';
// Memory view for the knowledge library: a dated forgetting curve per module and a knowledge graph, as inline SVG.
// Retention uses the same FSRS-5 memory model as review scheduling (fsrs.js): stability is rebuilt from the card's
// reviews, so retention is about 90% when a card falls due. FSRS default parameters, not fitted to this user.
// Colour + shape identify the module; a filled marker means "in today's review", hollow means "later".
const DAY = 86400000, PAST = 14, AHEAD = 7;
const PALETTE = ['#2f6fb0', '#c0392b', '#2e7d4f', '#d68910', '#7b4fa6', '#16808a', '#b0487c', '#6b7c2e', '#a0522d', '#3949ab', '#00897b', '#8d6e63'];
const SHAPES = ['circle', 'square', 'triangle', 'diamond'];
export const esc = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
// Stability (days) of a card from its reviews in time order; a card never reviewed counts as 1 day.
export const stability = history => memoryState(history)?.s ?? 1;
export const retention = (days, s) => Math.round(retrievability(days, s) * 100);
// Each module gets its own colour (12, the app's maximum) and one of four shapes, so colour-blind users still see a difference.
export const moduleStyles = ids => new Map(ids.map((id, i) => [id, { color: PALETTE[i % PALETTE.length], shape: SHAPES[i % SHAPES.length] }]));
const dayStart = value => { const d = new Date(value); d.setHours(0, 0, 0, 0); return d; };
// Retention of one card at a moment, using the latest review at or before it.
function retentionAt(card, events, at) {
  if (at < new Date(card.createdAt)) return null;
  const history = events.filter(event => new Date(event.at) <= at), last = history.at(-1);
  return retention((at - new Date(last ? last.at : card.createdAt)) / DAY, stability(history));
}
// One point per active card: in today's batch (filled, on today), or later (hollow, on its review date within the window).
export function memoryPoints(cards, reviews, dueIds, now = new Date()) {
  const today = dayStart(now);
  return cards.filter(card => card.status === 'active' && card.extraction === 'ready').flatMap(card => {
    const last = latestReview(reviews, card.id), info = dueInfo(card, last);
    const dueDate = info.at ? new Date(info.at) : new Date(`${info.day}T00:00:00`);
    const inToday = dueIds.has(card.id), offset = inToday ? 0 : Math.max(0, Math.round((dayStart(dueDate) - today) / DAY));
    if (!inToday && offset > AHEAD) return [];
    const at = inToday ? now : dueDate, base = last ? new Date(last.at) : new Date(card.createdAt);
    return [{ id: card.id, title: card.title, module: card.module, category: card.category, today: inToday, offset: inToday ? 0 : Math.max(offset, dueDate <= now ? 1 : 0),
      retention: retention((Math.max(at, base) - base) / DAY, stability(reviews.events.filter(event => event.cardId === card.id && new Date(event.at) <= now).sort((a, b) => a.at.localeCompare(b.at)))), lastAt: last?.at || null, lastRating: last?.rating || null, nextDue: inToday ? localDay(now) : localDay(dueDate), asked: card.origins.length }];
  });
}
// Average retention per module for each day from PAST days ago to AHEAD days ahead (cards existing on that day only).
export function moduleCurves(cards, reviews, now = new Date()) {
  const active = cards.filter(card => card.status === 'active' && card.extraction === 'ready'), curves = new Map();
  for (const module of [...new Set(active.map(card => card.module))]) {
    const members = active.filter(card => card.module === module).map(card => ({ card, events: reviews.events.filter(event => event.cardId === card.id).sort((a, b) => a.at.localeCompare(b.at)) }));
    const line = [];
    for (let step = -PAST * 2; step <= AHEAD * 2; step++) {
      const at = new Date(now.getTime() + step * DAY / 2), values = members.map(({ card, events }) => retentionAt(card, events, at)).filter(value => value !== null);
      if (values.length) line.push({ offset: step / 2, retention: Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) });
    }
    curves.set(module, line);
  }
  return curves;
}
export function marker({ shape, color }, px, py, { r = 6, filled = true } = {}) {
  const x = Number(px), y = Number(py), paint = filled ? `fill="${color}" stroke="#fff" stroke-width="1.5"` : `fill="#fff" stroke="${color}" stroke-width="2"`;
  if (shape === 'triangle') return `<polygon points="${x},${y - r} ${x + r},${y + r * 0.8} ${x - r},${y + r * 0.8}" ${paint}/>`;
  if (shape === 'square') return `<rect x="${x - r * 0.85}" y="${y - r * 0.85}" width="${r * 1.7}" height="${r * 1.7}" ${paint}/>`;
  if (shape === 'diamond') return `<polygon points="${x},${y - r * 1.1} ${x + r},${y} ${x},${y + r * 1.1} ${x - r},${y}" ${paint}/>`;
  return `<circle cx="${x}" cy="${y}" r="${r}" ${paint}/>`;
}
// Details shown on hover or tap; the page fills the card with textContent, never as HTML.
const tip = (p, moduleName, labels) => esc(JSON.stringify({ title: p.title, module: moduleName(p.module), last: p.lastAt ? `${new Date(p.lastAt).toLocaleDateString(labels.locale)} · ${labels.rating(p.lastRating)}` : labels.rating(null), retention: `${p.retention}%`, next: p.today ? labels.todayDue : p.nextDue, asked: p.asked }));
function pointNode(p, style, moduleName, labels, x, y, r) {
  return `<g class="viz-point" tabindex="0" data-module="${esc(p.module)}" data-tip="${tip(p, moduleName, labels)}">${marker(style, x, y, { r, filled: p.today })}</g>`;
}
export function legend(styles, moduleName, points, labels) {
  return `<div class="viz-legend">${[...styles].map(([id, style]) => `<span data-legend-module="${esc(id)}"><svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">${marker(style, 8, 8, { r: 6 })}</svg>${esc(moduleName(id))} · ${esc(labels.dueCount(points.filter(p => p.module === id && p.today).length))}</span>`).join('')}
    <span class="viz-legend-note"><svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">${marker({ shape: 'circle', color: '#43505c' }, 8, 8, { r: 5 })}</svg>${esc(labels.filled)}</span><span class="viz-legend-note"><svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">${marker({ shape: 'circle', color: '#43505c' }, 8, 8, { r: 5, filled: false })}</svg>${esc(labels.hollow)}</span></div>`;
}
// labels: {locale, x, y, today, todayDue, filled, hollow, dueCount(n), rating(r), graph}
export function curveSvg(points, curves, styles, moduleName, labels, now = new Date()) {
  const W = 640, H = 320, L = 48, R = 16, T = 20, B = 44, x = offset => L + ((offset + PAST) / (PAST + AHEAD)) * (W - L - R), y = r => T + (1 - r / 100) * (H - T - B);
  const grid = [0, 25, 50, 75, 100].map(r => `<line x1="${L}" x2="${W - R}" y1="${y(r)}" y2="${y(r)}" stroke="#e6eaee"/><text x="${L - 8}" y="${y(r) + 4}" text-anchor="end" font-size="11" fill="#6c7784">${r}%</text>`).join('');
  const ticks = [-14, -7, 0, 7].map(offset => { const d = new Date(now.getTime() + offset * DAY); return `<text x="${x(offset)}" y="${H - B + 18}" text-anchor="middle" font-size="11" fill="#6c7784">${offset === 0 ? esc(labels.today) : `${d.getMonth() + 1}/${d.getDate()}`}</text>`; }).join('');
  // Each line also gets a wide transparent twin so it is easy to double-click (or double-tap) to open that module.
  const lines = [...curves].map(([module, line]) => { const d = line.map((p, i) => `${i ? 'L' : 'M'}${x(p.offset).toFixed(1)},${y(p.retention).toFixed(1)}`).join('');
    return `<path class="viz-curve" data-module="${esc(module)}" d="${d}" fill="none" stroke="${styles.get(module)?.color || '#999'}" stroke-width="2.2" stroke-linejoin="round"/><path class="viz-curve-hit" data-curve-module="${esc(module)}" d="${d}" fill="none" stroke="transparent" stroke-width="16"/>`; }).join('');
  // Several points on the same day spread sideways a little so none hide another.
  const slots = new Map();
  const dots = [...points].sort((a, b) => Number(a.today) - Number(b.today)).map(p => { const key = `${p.offset}`, n = slots.get(key) || 0; slots.set(key, n + 1); const dx = ((n % 5) - 2) * 5; return pointNode(p, styles.get(p.module), moduleName, labels, (x(p.offset) + dx).toFixed(1), y(p.retention).toFixed(1), p.today ? 6.5 : 5.5); }).join('');
  const todayX = x(0);
  return `<div class="viz-wrap"><svg class="viz" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(labels.y)}">${grid}${ticks}<rect x="${todayX}" y="${T}" width="${W - R - todayX}" height="${H - T - B}" fill="#f3f6f8"/><line x1="${todayX}" x2="${todayX}" y1="${T - 6}" y2="${H - B}" stroke="#30694f" stroke-width="1.5" stroke-dasharray="5 3"/><line x1="${L}" x2="${L}" y1="${T}" y2="${H - B}" stroke="#9aa4ad"/><line x1="${L}" x2="${W - R}" y1="${H - B}" y2="${H - B}" stroke="#9aa4ad"/>${lines}${dots}<text x="${(L + W - R) / 2}" y="${H - 6}" text-anchor="middle" font-size="12" fill="#43505c">${esc(labels.x)}</text><text x="14" y="${(T + H - B) / 2}" text-anchor="middle" font-size="12" fill="#43505c" transform="rotate(-90 14 ${(T + H - B) / 2})">${esc(labels.y)}</text></svg><div class="viz-tip" hidden></div></div>`;
}
// Knowledge graph: one hub per module, ideas around it, links between ideas sharing a category in a module.
export function graphEdges(points) {
  const edges = [], byKey = new Map();
  for (const p of points) {
    const key = p.category ? `${p.module}:${normalizeQuestion(p.category)}` : null;
    if (!key) continue;
    for (const other of byKey.get(key) || []) if (edges.length < 300) edges.push([other.id, p.id]);
    byKey.set(key, [...(byKey.get(key) || []), p]);
  }
  return edges;
}
export function graphSvg(points, styles, moduleName, labels) {
  const W = 640, H = 480, cx = W / 2, cy = H / 2, modules = [...new Set(points.map(p => p.module))], shown = points.slice(0, 150);
  const hub = new Map(modules.map((id, i) => { const a = (2 * Math.PI * i) / Math.max(1, modules.length) - Math.PI / 2, r = modules.length > 1 ? 150 : 0; return [id, { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) }]; }));
  const pos = new Map();
  for (const id of modules) {
    const members = shown.filter(p => p.module === id), h = hub.get(id);
    members.forEach((p, i) => { const a = (2 * Math.PI * i) / Math.max(1, members.length), r = 58 + 18 * (i % 3); pos.set(p.id, { x: Math.max(10, Math.min(W - 10, h.x + r * Math.cos(a))), y: Math.max(10, Math.min(H - 10, h.y + r * Math.sin(a))) }); });
  }
  const spokes = shown.map(p => { const a = hub.get(p.module), b = pos.get(p.id); return `<line class="viz-curve" data-module="${esc(p.module)}" x1="${a.x.toFixed(1)}" y1="${a.y.toFixed(1)}" x2="${b.x.toFixed(1)}" y2="${b.y.toFixed(1)}" stroke="${styles.get(p.module).color}" stroke-opacity=".35"/>`; }).join('');
  const links = graphEdges(shown).map(([a, b]) => { const p = pos.get(a), q = pos.get(b), module = shown.find(item => item.id === a).module; return `<line class="viz-curve" data-module="${esc(module)}" x1="${p.x.toFixed(1)}" y1="${p.y.toFixed(1)}" x2="${q.x.toFixed(1)}" y2="${q.y.toFixed(1)}" stroke="${styles.get(module).color}" stroke-dasharray="3 3"/>`; }).join('');
  const hubs = modules.map(id => { const h = hub.get(id), color = styles.get(id).color; return `<g class="viz-curve" data-module="${esc(id)}"><circle cx="${h.x.toFixed(1)}" cy="${h.y.toFixed(1)}" r="26" fill="#fff" stroke="${color}" stroke-width="2"/><text x="${h.x.toFixed(1)}" y="${(h.y + 4).toFixed(1)}" text-anchor="middle" font-size="12" fill="${color}">${esc(moduleName(id).slice(0, 6))}</text></g>`; }).join('');
  const nodes = shown.map(p => { const b = pos.get(p.id); return pointNode(p, styles.get(p.module), moduleName, labels, b.x.toFixed(1), b.y.toFixed(1), p.today ? 6 : 5); }).join('');
  return `<div class="viz-wrap"><svg class="viz" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(labels.graph)}">${spokes}${links}${hubs}${nodes}</svg><div class="viz-tip" hidden></div></div>`;
}
// Hover, focus or tap a point: enlarge it, highlight its module, dim the others and show a details card.
export function attachVizInteraction(root, labels) {
  root.querySelectorAll('.viz-wrap').forEach(wrap => {
    const svg = wrap.querySelector('svg'), card = wrap.querySelector('.viz-tip');
    const clear = () => { svg.classList.remove('focus'); wrap.querySelectorAll('.active').forEach(node => node.classList.remove('active')); card.hidden = true; };
    const show = point => {
      clear(); const info = JSON.parse(point.dataset.tip), module = point.dataset.module;
      svg.classList.add('focus'); point.classList.add('active');
      wrap.querySelectorAll('.viz-curve').forEach(node => { if (node.dataset.module === module) node.classList.add('active'); });
      card.replaceChildren(...[['strong', info.title], ['span', `${labels.module}：${info.module}`], ['span', `${labels.last}：${info.last}`], ['span', `${labels.estimate}：${info.retention}`], ['span', `${labels.next}：${info.next}`], ['span', `${labels.asked}：${info.asked}`]].map(([tag, text]) => Object.assign(document.createElement(tag), { textContent: text })));
      card.hidden = false;
      // Measure after layout (the first hover can arrive before it), and keep the card inside the chart.
      requestAnimationFrame(() => {
        const box = point.getBoundingClientRect(), outer = wrap.getBoundingClientRect();
        const left = Math.max(8, Math.min(box.left - outer.left + 14, outer.width - card.offsetWidth - 8)), top = box.top - outer.top - card.offsetHeight - 10;
        card.style.left = `${left}px`; card.style.top = `${top < 4 ? box.bottom - outer.top + 10 : top}px`;
      });
    };
    wrap.querySelectorAll('.viz-point').forEach(point => { point.onmouseenter = point.onfocus = point.onclick = () => show(point); });
    svg.onmouseleave = () => { if (!wrap.contains(document.activeElement)) clear(); };
    wrap.onkeydown = event => { if (event.key === 'Escape') clear(); };
  });
}
