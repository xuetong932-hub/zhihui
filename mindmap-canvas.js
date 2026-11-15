// Mind map on a free canvas (2026-11-15): it still looks like a mind map — the idea in the middle, branches to the
// right and left, details further out, joined by curves — but every node can be dragged anywhere (its sub-points move
// with it), the background pans, and pinch / wheel zooms. Moves are kept as offsets from the automatic layout, per
// node path, so the map can be redrawn after edits. Tap a node = select, double tap = edit (callbacks).
import { tap } from './viz-edit.js';
const NS = 'http://www.w3.org/2000/svg';
const el = (tag, attrs = {}) => { const node = document.createElementNS(NS, tag); for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value); return node; };
export const MM_COLORS = ['#2f6fb0', '#2e7d4f', '#d68910', '#7b4fa6', '#16808a', '#b0487c', '#c0392b', '#6b7c2e', '#3949ab', '#a0522d'];
const ROW = 40, SIZE = { 0: [156, 48], 1: [148, 34], 2: [176, 30] };
const short = (value, max) => { const text = String(value || '').replace(/\s+/g, ' ').trim(); return text.length > max ? `${text.slice(0, max - 1)}…` : text; };

// Automatic layout: Map path → { x, y (centre), w, h, depth, side (1 right / -1 left / 0 root), color, label, parent }.
export function layoutMindmap(tree) {
  const nodes = new Map(), kids = tree.children || [];
  const span = node => Math.max(1, (node.children || []).reduce((sum, child) => sum + span(child), 0));
  nodes.set('', { x: 0, y: 0, w: SIZE[0][0], h: SIZE[0][1], depth: 0, side: 0, color: '#30694f', label: tree.label, parent: null });
  const place = (node, path, depth, side, color, top, parent) => {
    const rows = span(node), [w, h] = SIZE[Math.min(depth, 2)], x = side * (depth === 1 ? 190 : 190 + (depth - 1) * 200);
    nodes.set(path, { x, y: top + rows * ROW / 2, w, h, depth, side, color, label: node.label, parent });
    let y = top;
    (node.children || []).forEach((child, i) => { place(child, `${path}.${i}`, depth + 1, side, color, y, path); y += span(child) * ROW; });
  };
  // First half of the branches on the right, the rest on the left, each side centred on the idea.
  const right = kids.map((child, i) => i).filter(i => i < Math.ceil(kids.length / 2)), left = kids.map((child, i) => i).filter(i => i >= Math.ceil(kids.length / 2));
  for (const [side, list] of [[1, right], [-1, left]]) {
    let y = -list.reduce((sum, i) => sum + span(kids[i]), 0) * ROW / 2;
    for (const i of list) { place(kids[i], String(i), 1, side, MM_COLORS[i % MM_COLORS.length], y, ''); y += span(kids[i]) * ROW; }
  }
  return nodes;
}

// offsets: Map path → { x, y, fixed } (x / y = how far the user moved that node). Returns { destroy }.
export function mountMindmap(host, { tree, offsets = new Map(), selected = null, width = 760, height = 520, minScale = 0.35, onSelect = () => {}, onEdit = () => {}, onMoved = () => {} }) {
  host.replaceChildren();
  const layout = layoutMindmap(tree);
  const svg = el('svg', { viewBox: `0 0 ${width} ${height}`, class: 'mmc-svg', role: 'img', 'aria-label': tree.label });
  const world = el('g'), linkLayer = el('g'), nodeLayer = el('g');
  world.append(linkLayer, nodeLayer); svg.append(world); host.append(svg);
  const own = path => offsets.get(path) || { x: 0, y: 0 };
  // A node's position = its automatic place + its own move + every ancestor's move (sub-points follow their parent).
  const pos = path => { let x = layout.get(path).x, y = layout.get(path).y; for (let p = path; p !== null; p = layout.get(p).parent) { const o = own(p); x += o.x; y += o.y; } return { x, y }; };
  const items = new Map();
  for (const [path, node] of layout) {
    const g = el('g', { class: `mmc-node mmc-d${Math.min(node.depth, 2)}${path === selected ? ' is-selected' : ''}`, tabindex: '0', role: 'button', 'data-path': path });
    const title = el('title'); title.textContent = node.label; g.append(title);
    if (node.depth === 0) g.append(el('rect', { x: -node.w / 2, y: -node.h / 2, width: node.w, height: node.h, rx: 14, fill: node.color }));
    else if (node.depth === 1) g.append(el('rect', { x: -node.w / 2, y: -node.h / 2, width: node.w, height: node.h, rx: node.h / 2, fill: node.color, 'fill-opacity': '.14', stroke: node.color, 'stroke-width': 1.5 }));
    else g.append(el('rect', { x: -node.w / 2, y: -node.h / 2, width: node.w, height: node.h, rx: 8, class: 'mmc-leaf-box', stroke: node.color }));
    const text = el('text', { 'text-anchor': 'middle', y: node.depth === 0 ? 5 : 4.5, class: 'mmc-label', fill: node.depth === 0 ? '#fff' : node.depth === 1 ? node.color : 'var(--mm-text, #2b2b2b)' });
    text.textContent = short(node.label, node.depth === 0 ? 11 : node.depth === 1 ? 10 : 13);
    g.append(text); nodeLayer.append(g);
    const link = node.parent === null ? null : el('path', { class: 'mmc-link', stroke: node.color, 'stroke-width': node.depth === 1 ? 2.5 : 1.6, fill: 'none' });
    if (link) linkLayer.append(link);
    items.set(path, { g, link, node });
  }
  function draw() {
    for (const [path, { g, link, node }] of items) {
      const p = pos(path); g.setAttribute('transform', `translate(${p.x.toFixed(1)},${p.y.toFixed(1)})`);
      if (!link) continue;
      const parent = layout.get(node.parent), q = pos(node.parent), dir = p.x >= q.x ? 1 : -1;
      const x1 = q.x + dir * parent.w / 2, x2 = p.x - dir * node.w / 2, mid = (x1 + x2) / 2;
      link.setAttribute('d', `M${x1.toFixed(1)},${q.y.toFixed(1)} C${mid.toFixed(1)},${q.y.toFixed(1)} ${mid.toFixed(1)},${p.y.toFixed(1)} ${x2.toFixed(1)},${p.y.toFixed(1)}`);
    }
  }
  // View: fit everything at first; panning / zooming takes over afterwards.
  let scale = 1, tx = 0, ty = 0;
  const apply = () => world.setAttribute('transform', `translate(${tx},${ty}) scale(${scale})`);
  function fit() {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const [path, { node }] of items) { const p = pos(path); minX = Math.min(minX, p.x - node.w / 2); maxX = Math.max(maxX, p.x + node.w / 2); minY = Math.min(minY, p.y - node.h / 2); maxY = Math.max(maxY, p.y + node.h / 2); }
    const pad = 24; scale = Math.max(minScale, Math.min(1.2, width / (maxX - minX + pad * 2), height / (maxY - minY + pad * 2)));
    // When the whole map cannot fit at a readable size (phones), centre on the idea and let the user pan / pinch.
    const fits = scale * (maxX - minX + pad * 2) <= width + 1, root = pos('');
    tx = width / 2 - (fits ? (minX + maxX) / 2 : root.x) * scale; ty = height / 2 - (fits ? (minY + maxY) / 2 : root.y) * scale; apply();
  }
  const toView = event => { const box = svg.getBoundingClientRect(); return { x: (event.clientX - box.left) * width / box.width, y: (event.clientY - box.top) * height / box.height }; };
  // Drag a node: its own offset changes (sub-points follow); a short press without moving is a tap.
  let drag = null;
  for (const [path, { g }] of items) {
    g.addEventListener('pointerdown', event => { if (event.button > 0) return; event.stopPropagation(); const v = toView(event); drag = { path, start: v, base: { ...own(path) }, moved: false }; try { g.setPointerCapture(event.pointerId); } catch { /* synthetic event */ } });
    g.addEventListener('pointermove', event => {
      if (!drag || drag.path !== path) return; const v = toView(event), dx = (v.x - drag.start.x) / scale, dy = (v.y - drag.start.y) / scale;
      if (!drag.moved && Math.hypot(dx, dy) < 4) return; drag.moved = true;
      offsets.set(path, { x: drag.base.x + dx, y: drag.base.y + dy, fixed: true }); draw();
    });
    g.addEventListener('pointerup', () => { if (!drag || drag.path !== path) return; const moved = drag.moved; drag = null; if (moved) onMoved(); else tap(`mmc:${path}`, () => onSelect(path), () => onEdit(path)); });
    g.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect(path); } if (event.key === 'F2') { event.preventDefault(); onEdit(path); } });
  }
  // Background: one finger pans, two fingers pinch, the wheel zooms.
  const touches = new Map(); let pan = null, pinch = null;
  const pinchState = () => { const [a, b] = [...touches.values()], box = svg.getBoundingClientRect(); return { d: Math.hypot(a.x - b.x, a.y - b.y), px: ((a.x + b.x) / 2 - box.left) * width / box.width, py: ((a.y + b.y) / 2 - box.top) * height / box.height }; };
  svg.addEventListener('pointerdown', event => {
    touches.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (touches.size === 2) { pan = null; pinch = { ...pinchState(), scale, tx, ty }; return; }
    pan = { ...toView(event), tx, ty }; try { svg.setPointerCapture(event.pointerId); } catch { /* synthetic event */ }
  });
  svg.addEventListener('pointermove', event => {
    if (touches.has(event.pointerId)) touches.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pinch && touches.size === 2) { const now = pinchState(), next = Math.min(3, Math.max(0.35, pinch.scale * now.d / Math.max(1, pinch.d)));
      tx = now.px - (pinch.px - pinch.tx) * next / pinch.scale; ty = now.py - (pinch.py - pinch.ty) * next / pinch.scale; scale = next; apply(); return; }
    if (!pan) return; const v = toView(event); tx = pan.tx + v.x - pan.x; ty = pan.ty + v.y - pan.y; apply();
  });
  const release = event => { touches.delete(event.pointerId); if (touches.size < 2) pinch = null; pan = null; };
  svg.addEventListener('pointerup', release); svg.addEventListener('pointercancel', release);
  svg.addEventListener('wheel', event => { event.preventDefault(); const v = toView(event), next = Math.min(3, Math.max(0.35, scale * (event.deltaY < 0 ? 1.12 : 1 / 1.12))); tx = v.x - (v.x - tx) * next / scale; ty = v.y - (v.y - ty) * next / scale; scale = next; apply(); }, { passive: false });
  draw(); fit();
  return { svg };
}
