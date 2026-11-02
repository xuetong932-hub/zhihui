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
// Every node carries data-path ("" root, "2" a branch, "2.0" a detail) so it can be selected, edited or zoomed into.
// focus = a branch index: draw only that branch, larger (its details become the middle column, their children the right).
export function mindmapSvg(tree, collapsed = new Set(), { focus = null, selected = null } = {}) {
  const zoomed = focus !== null && tree.children?.[focus], base = zoomed ? tree.children[focus] : tree, basePath = zoomed ? String(focus) : '';
  const path = (...indexes) => [basePath, ...indexes].filter(part => part !== '').join('.'), sel = value => value === selected ? ' mm-selected' : '';
  const kids = base.children || [], folded = i => !zoomed && collapsed.has(i);
  const W = zoomed ? 780 : 860, rowH = zoomed ? 40 : 30, rootX = 20, rootW = zoomed ? 180 : 190, branchX = zoomed ? 236 : 250, branchW = zoomed ? 200 : 190, leafX = zoomed ? 466 : 470;
  const fs = zoomed ? 15 : 13, leafFs = zoomed ? 14 : 12.5, rows = kids.reduce((sum, b, i) => sum + (folded(i) ? 1 : Math.max(1, b.children?.length || 0)), 0);
  const H = Math.max(160, rows * rowH + 40), parts = [], rootY = H / 2;
  let row = 0;
  kids.forEach((branch, i) => {
    const color = BRANCH_COLORS[((zoomed ? focus + i + 1 : i)) % BRANCH_COLORS.length], leaves = branch.children || [], count = folded(i) ? 1 : Math.max(1, leaves.length), top = 20 + row * rowH, y = top + (count * rowH) / 2;
    parts.push(`<path d="M${rootX + rootW},${rootY} C${rootX + rootW + 30},${rootY} ${branchX - 30},${y} ${branchX},${y}" stroke="${color}" stroke-width="2.5" fill="none" opacity=".8"/>`);
    const toggle = !zoomed && leaves.length ? `<text x="${branchX + branchW - 12}" y="${y + 5}" text-anchor="end" font-size="12" fill="${color}">${folded(i) ? '▸' : '▾'}</text>` : '';
    parts.push(`<g class="mm-node mm-branch${sel(path(i))}" data-path="${path(i)}" data-branch="${i}" tabindex="0" role="button" ${zoomed ? '' : `aria-expanded="${!folded(i)}"`}><rect x="${branchX}" y="${y - (zoomed ? 17 : 14)}" width="${branchW}" height="${zoomed ? 34 : 28}" rx="${zoomed ? 17 : 14}" fill="${color}" fill-opacity=".12" stroke="${color}"/><text x="${branchX + 14}" y="${y + 5}" font-size="${fs}" fill="${color}" font-weight="600"><title>${esc(branch.label)}</title>${esc(short(branch.label, zoomed ? 14 : 13))} ${folded(i) ? `(+${leaves.length})` : ''}</text>${toggle}</g>`);
    if (!folded(i)) leaves.forEach((leaf, j) => {
      const ly = top + j * rowH + rowH / 2, more = leaf.children?.length ? ` (+${leaf.children.length})` : '';
      parts.push(`<path d="M${branchX + branchW},${y} C${branchX + branchW + 15},${y} ${leafX - 15},${ly} ${leafX},${ly}" stroke="${color}" stroke-width="1.5" fill="none" opacity=".55"/><g class="mm-node mm-leaf${sel(path(i, j))}" data-path="${path(i, j)}" tabindex="0" role="button"><rect x="${leafX - 8}" y="${ly - rowH / 2 + 3}" width="${W - leafX}" height="${rowH - 6}" rx="6" fill="transparent" class="mm-hit"/><circle cx="${leafX}" cy="${ly}" r="3.5" fill="${color}"/><text x="${leafX + 10}" y="${ly + 4}" font-size="${leafFs}" fill="var(--mm-text)"><title>${esc(leaf.label)}</title>${esc(short(leaf.label, zoomed ? 20 : 30))}${more}</text></g>`);
    });
    row += count;
  });
  const root = `<g class="mm-node mm-root${sel(basePath)}" data-path="${basePath}" tabindex="0" role="button"><rect x="${rootX}" y="${rootY - 24}" width="${rootW}" height="48" rx="12" fill="${zoomed ? BRANCH_COLORS[focus % BRANCH_COLORS.length] : '#30694f'}"/><text x="${rootX + rootW / 2}" y="${rootY + 5}" text-anchor="middle" font-size="${zoomed ? 15 : 14}" font-weight="700" fill="#fff"><title>${esc(base.label)}</title>${esc(short(base.label, 12))}</text></g>`;
  return `<div class="mindmap-wrap"><svg class="mindmap" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(base.label)}">${parts.join('')}${root}</svg></div>`;
}
