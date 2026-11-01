import { latestReview } from './review-store.js';
import { normalizeQuestion } from './knowledge-store.js';
// Memory view for the knowledge library: an estimated forgetting curve and a knowledge graph as inline SVG.
// Retention uses a common approximation R = 0.9^(t / S): S (stability, days) is the card's current review interval,
// so retention is about 90% when a card falls due. It is an estimate, not a model calibrated on learning data.
const DAY = 86400000;
export const KINDS = ['due', 'weak', 'stable', 'new'];
const COLORS = { due: '#c0392b', weak: '#d68910', stable: '#2e7d4f', new: '#2f6fb0' };
const esc = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
export function stability(last) {
  if (!last) return 1;
  if (['wrong', 'unclear'].includes(last.rating)) return 0.5;
  return Math.max(1, last.interval || 1);
}
export const retention = (days, s) => Math.round(Math.pow(0.9, Math.max(0, days) / s) * 100);
// One point per active card. dueIds: cards in today's review queue (marked as due regardless of other state).
export function memoryPoints(cards, reviews, dueIds, now = new Date()) {
  return cards.filter(card => card.status === 'active' && card.extraction === 'ready').map(card => {
    const last = latestReview(reviews, card.id), since = new Date(last ? last.at : card.createdAt), days = Math.max(0, (now - since) / DAY), s = stability(last);
    const kind = dueIds.has(card.id) ? 'due' : !last ? 'new' : ['wrong', 'unclear', 'guessed'].includes(last.rating) ? 'weak' : 'stable';
    return { id: card.id, title: card.title, module: card.module, category: card.category, days, stability: s, retention: retention(days, s), kind, reviewed: Boolean(last), lastRating: last?.rating || null, lastAt: last?.at || null };
  });
}
function marker(kind, x, y, r = 6) {
  const fill = COLORS[kind];
  if (kind === 'weak') return `<polygon points="${x},${y - r} ${x + r},${y + r * 0.8} ${x - r},${y + r * 0.8}" fill="${fill}"/>`;
  if (kind === 'stable') return `<rect x="${x - r * 0.85}" y="${y - r * 0.85}" width="${r * 1.7}" height="${r * 1.7}" fill="${fill}"/>`;
  if (kind === 'new') return `<polygon points="${x},${y - r} ${x + r},${y} ${x},${y + r} ${x - r},${y}" fill="${fill}"/>`;
  return `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}" stroke="#fff" stroke-width="1.5"/>`;
}
export function legend(labels) {
  return `<div class="viz-legend">${KINDS.map(kind => `<span><svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">${marker(kind, 8, 8, 6)}</svg>${esc(labels[kind])}</span>`).join('')}</div>`;
}
// labels: {due, weak, stable, new, x, y, curve:(days)=>string}
export function curveSvg(points, labels) {
  const W = 640, H = 320, L = 48, R = 16, T = 16, B = 40, maxDays = Math.min(60, Math.max(14, Math.ceil(Math.max(0, ...points.map(p => p.days)))));
  const x = d => L + (Math.min(d, maxDays) / maxDays) * (W - L - R), y = r => T + (1 - r / 100) * (H - T - B);
  const grid = [0, 25, 50, 75, 100].map(r => `<line x1="${L}" x2="${W - R}" y1="${y(r)}" y2="${y(r)}" stroke="#e6eaee"/><text x="${L - 8}" y="${y(r) + 4}" text-anchor="end" font-size="11" fill="#6c7784">${r}%</text>`).join('');
  const ticks = Array.from({ length: 5 }, (_, i) => Math.round(maxDays * i / 4)).map(d => `<text x="${x(d)}" y="${H - B + 18}" text-anchor="middle" font-size="11" fill="#6c7784">${d}</text>`).join('');
  const curves = [1, 7, 30].map(s => { const path = Array.from({ length: 61 }, (_, i) => { const d = maxDays * i / 60; return `${i ? 'L' : 'M'}${x(d).toFixed(1)},${y(retention(d, s)).toFixed(1)}`; }).join(''); return `<path d="${path}" fill="none" stroke="#b7c0c8" stroke-dasharray="4 4"/><text x="${W - R - 4}" y="${y(retention(maxDays, s)) - 4}" text-anchor="end" font-size="10" fill="#8d979f">${esc(labels.curve(s))}</text>`; }).join('');
  const order = { stable: 0, new: 1, weak: 2, due: 3 };
  const dots = [...points].sort((a, b) => order[a.kind] - order[b.kind]).map(p => `<g>${marker(p.kind, x(p.days).toFixed(1), y(p.retention).toFixed(1))}<title>${esc(p.title)} · ${p.retention}% · ${esc(labels[p.kind])}</title></g>`).join('');
  return `<svg class="viz" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(labels.y)}">${grid}${ticks}${curves}<line x1="${L}" x2="${L}" y1="${T}" y2="${H - B}" stroke="#9aa4ad"/><line x1="${L}" x2="${W - R}" y1="${H - B}" y2="${H - B}" stroke="#9aa4ad"/>${dots}<text x="${(L + W - R) / 2}" y="${H - 6}" text-anchor="middle" font-size="12" fill="#43505c">${esc(labels.x)}</text><text x="14" y="${(T + H - B) / 2}" text-anchor="middle" font-size="12" fill="#43505c" transform="rotate(-90 14 ${(T + H - B) / 2})">${esc(labels.y)}</text></svg>`;
}
// Knowledge graph: one hub per module, cards around it, and links between cards that share a category or a question.
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
export function graphSvg(points, moduleName, labels) {
  const W = 640, H = 480, cx = W / 2, cy = H / 2, modules = [...new Set(points.map(p => p.module))], shown = points.slice(0, 150);
  const hub = new Map(modules.map((id, i) => { const a = (2 * Math.PI * i) / Math.max(1, modules.length) - Math.PI / 2, r = modules.length > 1 ? 150 : 0; return [id, { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) }]; }));
  const pos = new Map();
  for (const id of modules) {
    const members = shown.filter(p => p.module === id), h = hub.get(id);
    members.forEach((p, i) => { const a = (2 * Math.PI * i) / Math.max(1, members.length), r = 55 + 18 * (i % 3); pos.set(p.id, { x: Math.max(10, Math.min(W - 10, h.x + r * Math.cos(a))), y: Math.max(10, Math.min(H - 10, h.y + r * Math.sin(a))) }); });
  }
  const spokes = shown.map(p => { const a = hub.get(p.module), b = pos.get(p.id); return `<line x1="${a.x.toFixed(1)}" y1="${a.y.toFixed(1)}" x2="${b.x.toFixed(1)}" y2="${b.y.toFixed(1)}" stroke="#dde3e8"/>`; }).join('');
  const links = graphEdges(shown).map(([a, b]) => { const p = pos.get(a), q = pos.get(b); return `<line x1="${p.x.toFixed(1)}" y1="${p.y.toFixed(1)}" x2="${q.x.toFixed(1)}" y2="${q.y.toFixed(1)}" stroke="#9fbead" stroke-dasharray="3 3"/>`; }).join('');
  const hubs = modules.map(id => { const h = hub.get(id); return `<g><circle cx="${h.x.toFixed(1)}" cy="${h.y.toFixed(1)}" r="26" fill="#edf4ef" stroke="#30694f"/><text x="${h.x.toFixed(1)}" y="${(h.y + 4).toFixed(1)}" text-anchor="middle" font-size="12" fill="#24563f">${esc(moduleName(id).slice(0, 6))}</text></g>`; }).join('');
  const nodes = shown.map(p => { const b = pos.get(p.id); return `<g>${marker(p.kind, b.x.toFixed(1), b.y.toFixed(1), 5)}<title>${esc(p.title)} · ${esc(moduleName(p.module))}${p.category ? ` · ${esc(p.category)}` : ''} · ${esc(labels[p.kind])}</title></g>`; }).join('');
  return `<svg class="viz" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(labels.graph)}">${spokes}${links}${hubs}${nodes}</svg>`;
}
