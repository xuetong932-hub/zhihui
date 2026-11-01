import { esc } from './memory-viz.js';
// Mind map of one idea: built from the card itself (key points, example, module and category, related ideas,
// original questions, review history), plus optional model-suggested branches the user asked for.
const BRANCH_COLORS = ['#2f6fb0', '#2e7d4f', '#d68910', '#7b4fa6', '#16808a', '#b0487c', '#c0392b', '#6b7c2e', '#3949ab', '#a0522d'];
const short = (value, max) => { const text = String(value || '').replace(/\s+/g, ' ').trim(); return text.length > max ? `${text.slice(0, max - 1)}…` : text; };
export function keyPoints(summary) {
  return String(summary || '').split(/(?<=[。！？!?；;])|\n+/).map(part => part.replace(/^[-*\d.、\s]+/, '').trim()).filter(part => part.length > 1).slice(0, 6);
}
// labels: {points, example, belongs, related, questions, history, ai:{prerequisites, subconcepts, misconceptions, applications}, rating(r), locale}
export function buildMindmap(card, { moduleName, related = [], events = [], expansion = null, labels }) {
  const branch = (label, items) => items.length ? [{ label, children: items.map(text => ({ label: text })) }] : [];
  const children = [
    ...branch(labels.points, keyPoints(card.summary)),
    ...branch(labels.example, card.example ? [card.example] : []),
    ...branch(labels.belongs, [moduleName(card.module), card.category].filter(Boolean)),
    ...branch(labels.related, related.slice(0, 5)),
    ...branch(labels.questions, card.origins.map(origin => origin.question).slice(0, 4)),
    ...branch(labels.history, events.slice(-3).reverse().map(event => `${new Date(event.at).toLocaleDateString(labels.locale)} · ${labels.rating(event.rating)}`)),
    ...(expansion ? Object.entries(labels.ai).flatMap(([key, label]) => branch(`✦ ${label}`, (expansion[key] || []).slice(0, 5))) : []),
  ];
  return { label: card.title, children };
}
// Horizontal tree: the idea on the left, branches in the middle, details on the right; branches can collapse.
export function mindmapSvg(tree, collapsed = new Set()) {
  const W = 860, rowH = 30, rootX = 20, branchX = 250, leafX = 470, rows = tree.children.reduce((sum, b, i) => sum + (collapsed.has(i) ? 1 : Math.max(1, b.children.length)), 0);
  const H = Math.max(160, rows * rowH + 40), parts = [];
  let row = 0;
  const rootY = H / 2;
  tree.children.forEach((branch, i) => {
    const color = BRANCH_COLORS[i % BRANCH_COLORS.length], count = collapsed.has(i) ? 1 : Math.max(1, branch.children.length), top = 20 + row * rowH, y = top + (count * rowH) / 2;
    parts.push(`<path d="M${rootX + 190},${rootY} C${rootX + 220},${rootY} ${branchX - 30},${y} ${branchX},${y}" stroke="${color}" stroke-width="2.5" fill="none" opacity=".8"/>`);
    parts.push(`<g class="mm-branch" data-branch="${i}" tabindex="0" role="button" aria-expanded="${!collapsed.has(i)}"><rect x="${branchX}" y="${y - 14}" width="190" height="28" rx="14" fill="${color}" opacity=".12" stroke="${color}"/><text x="${branchX + 14}" y="${y + 5}" font-size="13" fill="${color}" font-weight="600">${esc(short(branch.label, 13))} ${collapsed.has(i) ? `(+${branch.children.length})` : ''}</text><text x="${branchX + 178}" y="${y + 5}" text-anchor="end" font-size="12" fill="${color}">${collapsed.has(i) ? '▸' : '▾'}</text></g>`);
    if (!collapsed.has(i)) branch.children.forEach((leaf, j) => {
      const ly = top + j * rowH + rowH / 2;
      parts.push(`<path d="M${branchX + 190},${y} C${branchX + 205},${y} ${leafX - 15},${ly} ${leafX},${ly}" stroke="${color}" stroke-width="1.5" fill="none" opacity=".55"/><circle cx="${leafX}" cy="${ly}" r="3.5" fill="${color}"/><text x="${leafX + 10}" y="${ly + 4}" font-size="12.5" fill="var(--mm-text)"><title>${esc(leaf.label)}</title>${esc(short(leaf.label, 30))}</text>`);
    });
    row += count;
  });
  const root = `<g><rect x="${rootX}" y="${rootY - 24}" width="190" height="48" rx="12" fill="#30694f"/><text x="${rootX + 95}" y="${rootY + 5}" text-anchor="middle" font-size="14" font-weight="700" fill="#fff"><title>${esc(tree.label)}</title>${esc(short(tree.label, 12))}</text></g>`;
  return `<div class="mindmap-wrap"><svg class="mindmap" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(tree.label)}">${parts.join('')}${root}</svg></div>`;
}
