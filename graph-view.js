// Interactive knowledge graph (no dependencies): a small force simulation drawn as SVG.
// Drag a node to move it (it stays pinned until Reset layout), drag the background to pan, scroll to zoom.
// Hover highlights a node and its neighbours; a tap on an idea calls onOpen(id), a double tap on any node calls
// onDouble(node), and onMoved() reports a finished drag so the layout can be saved.
import { tap } from './viz-edit.js';
const NS = 'http://www.w3.org/2000/svg';
const el = (tag, attrs = {}) => { const node = document.createElementNS(NS, tag); for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value); return node; };
// nodes: [{id, label, kind:'hub'|'card', module, color, size, today, detail}], links: [{source, target, kind:'spoke'|'relation', label}]
// positions: Map shared across re-renders so the layout does not jump when the page redraws.
export function mountGraph(host, { nodes, links, theme = 'light', positions = new Map(), onOpen = () => {}, onDouble = () => {}, onMoved = () => {}, width = 760, height = 520 }) {
  host.replaceChildren();
  const wrap = document.createElement('div'); wrap.className = `graph-canvas graph-${theme}`;
  const svg = el('svg', { viewBox: `0 0 ${width} ${height}`, class: 'graph-svg', role: 'img' });
  const defs = el('defs'), glow = el('filter', { id: 'graph-glow', x: '-60%', y: '-60%', width: '220%', height: '220%' });
  glow.append(el('feGaussianBlur', { stdDeviation: '4', result: 'blur' })); const merge = el('feMerge'); merge.append(el('feMergeNode', { in: 'blur' }), el('feMergeNode', { in: 'SourceGraphic' })); glow.append(merge); defs.append(glow); svg.append(defs);
  const world = el('g'), linkLayer = el('g', { class: 'graph-links' }), nodeLayer = el('g', { class: 'graph-nodes' });
  world.append(linkLayer, nodeLayer); svg.append(world); wrap.append(svg); host.append(wrap);
  const tip = document.createElement('div'); tip.className = 'viz-tip graph-tip'; tip.hidden = true; wrap.append(tip);
  const byId = new Map(), neighbours = new Map(nodes.map(node => [node.id, new Set()]));
  nodes.forEach((node, i) => {
    const saved = positions.get(node.id), angle = (i / Math.max(1, nodes.length)) * Math.PI * 2;
    Object.assign(node, saved || { x: width / 2 + Math.cos(angle) * (node.kind === 'hub' ? 140 : 220) + (Math.random() - 0.5) * 40, y: height / 2 + Math.sin(angle) * (node.kind === 'hub' ? 110 : 180) + (Math.random() - 0.5) * 40 }, { vx: 0, vy: 0 });
    byId.set(node.id, node);
  });
  const edges = links.filter(link => byId.has(link.source) && byId.has(link.target)).map(link => { neighbours.get(link.source).add(link.target); neighbours.get(link.target).add(link.source); return { ...link, a: byId.get(link.source), b: byId.get(link.target) }; });
  for (const edge of edges) {
    edge.path = el('path', { class: `graph-link graph-link-${edge.kind}`, stroke: edge.kind === 'spoke' ? edge.b.color : edge.a.color, fill: 'none' });
    linkLayer.append(edge.path);
    if (edge.label) { edge.text = el('text', { class: 'graph-link-label', 'text-anchor': 'middle' }); edge.text.textContent = edge.label; linkLayer.append(edge.text); }
  }
  for (const node of nodes) {
    const g = el('g', { class: `graph-node graph-${node.kind}${node.today ? ' graph-today' : ''}`, tabindex: '0' }), r = node.kind === 'hub' ? 22 : 6 + Math.min(8, node.size * 2);
    if (node.today) g.append(el('circle', { r: r + 6, class: 'graph-halo', fill: node.color }));
    g.append(el('circle', { r, fill: node.kind === 'hub' ? 'var(--graph-hub-fill)' : node.color, stroke: node.color, 'stroke-width': node.kind === 'hub' ? 2.5 : 1.5, filter: node.kind === 'hub' ? '' : 'url(#graph-glow)' }));
    const label = el('text', { y: node.kind === 'hub' ? 4 : r + 13, 'text-anchor': 'middle', class: 'graph-label' }); label.textContent = node.label.length > 14 ? `${node.label.slice(0, 13)}…` : node.label;
    g.append(label); node.el = g; node.r = r; nodeLayer.append(g);
  }
  // View transform for zoom and pan. Until the user pans or zooms, the view keeps every node (and its label) in
  // sight: larger graphs spread wider than the canvas, so it zooms out to fit them.
  let scale = 1, tx = 0, ty = 0, alpha = positions.size ? 0.3 : 1, frame = 0, userView = false;
  const applyView = () => world.setAttribute('transform', `translate(${tx},${ty}) scale(${scale})`);
  function fit() {
    if (userView || dragging || !nodes.length) return;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const node of nodes) { minX = Math.min(minX, node.x - node.r - 40); maxX = Math.max(maxX, node.x + node.r + 40); minY = Math.min(minY, node.y - node.r - 12); maxY = Math.max(maxY, node.y + node.r + 24); }
    scale = Math.max(0.25, Math.min(1, width / (maxX - minX), height / (maxY - minY)));
    tx = (width - (minX + maxX) * scale) / 2; ty = (height - (minY + maxY) * scale) / 2;
    applyView();
  }
  const toWorld = event => { const box = svg.getBoundingClientRect(); return { x: ((event.clientX - box.left) * width / box.width - tx) / scale, y: ((event.clientY - box.top) * height / box.height - ty) / scale }; };
  function draw() {
    for (const edge of edges) {
      const mx = (edge.a.x + edge.b.x) / 2, my = (edge.a.y + edge.b.y) / 2, dx = edge.b.x - edge.a.x, dy = edge.b.y - edge.a.y, bend = edge.kind === 'relation' ? 0.18 : 0.06;
      const cx = mx - dy * bend, cy = my + dx * bend;
      edge.path.setAttribute('d', `M${edge.a.x.toFixed(1)},${edge.a.y.toFixed(1)} Q${cx.toFixed(1)},${cy.toFixed(1)} ${edge.b.x.toFixed(1)},${edge.b.y.toFixed(1)}`);
      if (edge.text) { edge.text.setAttribute('x', ((mx + cx) / 2).toFixed(1)); edge.text.setAttribute('y', ((my + cy) / 2).toFixed(1)); }
    }
    for (const node of nodes) { node.el.setAttribute('transform', `translate(${node.x.toFixed(1)},${node.y.toFixed(1)})`); positions.set(node.id, { x: node.x, y: node.y, fixed: node.fixed }); }
  }
  // Repulsion between all nodes, springs along links, a gentle pull to the centre; cools down over time.
  function tick() {
    for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) {
      // Repulsion falls off with distance (1/d) so nodes spread over the canvas instead of clumping.
      const a = nodes[i], b = nodes[j]; let dx = b.x - a.x, dy = b.y - a.y; const d = Math.max(Math.hypot(dx, dy), 6), force = (a.kind === 'hub' && b.kind === 'hub' ? 260 : a.kind === 'hub' || b.kind === 'hub' ? 120 : 70) * alpha / d;
      dx /= d; dy /= d; a.vx -= dx * force; a.vy -= dy * force; b.vx += dx * force; b.vy += dy * force;
    }
    for (const edge of edges) {
      // Relation links pull more gently than module spokes so dense relations do not collapse the layout.
      const target = edge.kind === 'spoke' ? 80 + edge.b.r * 2 : 140, dx = edge.b.x - edge.a.x, dy = edge.b.y - edge.a.y, d = Math.max(1, Math.hypot(dx, dy)), k = (d - target) * (edge.kind === 'spoke' ? 0.04 : 0.012) * alpha;
      edge.a.vx += dx / d * k; edge.a.vy += dy / d * k; edge.b.vx -= dx / d * k; edge.b.vy -= dy / d * k;
    }
    for (const node of nodes) {
      node.vx += (width / 2 - node.x) * 0.004 * alpha; node.vy += (height / 2 - node.y) * 0.004 * alpha;
      if (node.fixed || node === dragging) { node.vx = node.vy = 0; continue; }
      node.vx *= 0.82; node.vy *= 0.82; node.x += node.vx; node.y += node.vy;
    }
    alpha *= 0.985; draw(); fit();
    if (alpha > 0.01 && host.isConnected) frame = requestAnimationFrame(tick); else frame = 0;
  }
  const reheat = (value = 0.4) => { alpha = Math.max(alpha, value); if (!frame && host.isConnected) frame = requestAnimationFrame(tick); };
  // Hover highlight and details.
  const focus = node => {
    wrap.classList.add('graph-focus');
    for (const other of nodes) other.el.classList.toggle('graph-active', other === node || neighbours.get(node.id).has(other.id));
    for (const edge of edges) edge.path.classList.toggle('graph-active', edge.a === node || edge.b === node);
    if (node.detail) { tip.replaceChildren(...node.detail.map(([tag, value]) => Object.assign(document.createElement(tag), { textContent: value }))); tip.hidden = false;
      requestAnimationFrame(() => { const box = node.el.getBoundingClientRect(), outer = wrap.getBoundingClientRect(); tip.style.left = `${Math.max(8, Math.min(box.right - outer.left + 8, outer.width - tip.offsetWidth - 8))}px`; tip.style.top = `${Math.max(8, box.top - outer.top - 8)}px`; }); }
  };
  const blur = () => { wrap.classList.remove('graph-focus'); nodes.forEach(node => node.el.classList.remove('graph-active')); edges.forEach(edge => edge.path.classList.remove('graph-active')); tip.hidden = true; };
  // Pointer: drag nodes, pan background, click to open.
  let dragging = null, panning = null, moved = false;
  for (const node of nodes) {
    node.el.addEventListener('pointerenter', () => { if (!dragging && !panning) focus(node); });
    node.el.addEventListener('pointerleave', () => { if (!dragging) blur(); });
    node.el.addEventListener('focus', () => focus(node)); node.el.addEventListener('blur', blur);
    node.el.addEventListener('pointerdown', event => { event.stopPropagation(); dragging = node; moved = false; node.el.setPointerCapture(event.pointerId); reheat(0.3); });
    node.el.addEventListener('pointermove', event => { if (dragging !== node) return; const p = toWorld(event); moved ||= Math.hypot(p.x - node.x, p.y - node.y) > 2; node.x = p.x; node.y = p.y; node.fixed = true; reheat(0.25); });
    node.el.addEventListener('pointerup', () => {
      if (dragging === node && !moved) tap(`graph:${node.id}`, () => { if (node.kind === 'card') onOpen(node.id); }, () => onDouble(node));
      else if (dragging === node) onMoved();
      dragging = null;
    });
    node.el.addEventListener('keydown', event => { if (event.key === 'Enter') { if (node.kind === 'card') onOpen(node.id); else onDouble(node); } });
  }
  svg.addEventListener('pointerdown', event => { panning = { x: event.clientX, y: event.clientY, tx, ty }; svg.setPointerCapture(event.pointerId); blur(); });
  svg.addEventListener('pointermove', event => { if (!panning) return; userView = true; const box = svg.getBoundingClientRect(); tx = panning.tx + (event.clientX - panning.x) * width / box.width; ty = panning.ty + (event.clientY - panning.y) * height / box.height; applyView(); });
  svg.addEventListener('pointerup', () => { panning = null; });
  svg.addEventListener('wheel', event => {
    event.preventDefault(); userView = true; const box = svg.getBoundingClientRect(), px = (event.clientX - box.left) * width / box.width, py = (event.clientY - box.top) * height / box.height;
    const next = Math.min(3, Math.max(0.4, scale * (event.deltaY < 0 ? 1.12 : 1 / 1.12)));
    tx = px - (px - tx) * next / scale; ty = py - (py - ty) * next / scale; scale = next; applyView();
  }, { passive: false });
  for (const node of nodes) if (positions.get(node.id)?.fixed) node.fixed = true;
  applyView(); draw(); fit(); reheat(alpha);
  return { reset: () => { userView = false; nodes.forEach(node => { node.fixed = false; }); reheat(1); } };
}
