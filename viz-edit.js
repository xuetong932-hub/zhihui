// Shared helpers for the editable library views (forgetting curve, knowledge graph, mind map):
// telling a tap from a double tap (mouse or touch), downloading a chart as SVG or PNG, and editing a mind map tree.

// Single vs double tap. One pending tap at a time, keyed so a page redraw between the two taps still counts.
// A single tap waits briefly so a double tap never also triggers the single action.
let pending = null;
export const TAP_DELAY = 260;
export function tap(key, single, double) {
  if (pending && pending.key === key) { clearTimeout(pending.timer); pending = null; double(); return; }
  if (pending) clearTimeout(pending.timer);
  pending = { key, timer: setTimeout(() => { pending = null; single(); }, TAP_DELAY) };
}

// Charts use CSS classes and variables, so computed styles are copied onto the clone to make a stand-alone file.
const STYLE_PROPS = ['fill', 'stroke', 'stroke-width', 'stroke-opacity', 'fill-opacity', 'opacity', 'stroke-dasharray', 'font-size', 'font-weight', 'font-family', 'text-anchor', 'display', 'visibility'];
export function standaloneSvg(svg, { box = null, background = '#ffffff', padding = 24 } = {}) {
  const clone = svg.cloneNode(true), source = [svg, ...svg.querySelectorAll('*')], target = [clone, ...clone.querySelectorAll('*')];
  source.forEach((node, i) => {
    const style = getComputedStyle(node), parts = STYLE_PROPS.map(prop => `${prop}:${style.getPropertyValue(prop)}`).filter(part => !part.endsWith(':'));
    target[i].setAttribute('style', parts.join(';'));
    target[i].removeAttribute('class'); target[i].removeAttribute('tabindex');
  });
  let [x, y, w, h] = (svg.getAttribute('viewBox') || `0 0 ${svg.clientWidth} ${svg.clientHeight}`).split(/\s+/).map(Number);
  if (box) {
    // The graph's world group is panned and zoomed; export its own extent without that transform.
    clone.querySelector(':scope > g:not(defs)')?.removeAttribute('transform');
    [x, y, w, h] = [box.x - padding, box.y - padding, box.width + padding * 2, box.height + padding * 2];
  }
  clone.setAttribute('viewBox', `${x} ${y} ${w} ${h}`); clone.setAttribute('width', w); clone.setAttribute('height', h);
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  Object.entries({ x, y, width: w, height: h, fill: background }).forEach(([key, value]) => rect.setAttribute(key, value));
  clone.insertBefore(rect, clone.firstChild);
  return { markup: new XMLSerializer().serializeToString(clone), width: w, height: h };
}
function save(blob, name) {
  const url = URL.createObjectURL(blob), link = document.createElement('a');
  link.href = url; link.download = name; document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export const downloadText = (text, name, type = 'text/plain') => save(new Blob([text], { type: `${type};charset=utf-8` }), name);
export function downloadSvg(svg, name, options) { save(new Blob([standaloneSvg(svg, options).markup], { type: 'image/svg+xml' }), name); }
// PNG at twice the size for sharp text; the SVG is drawn through a same-page blob image (allowed by img-src blob:).
export function downloadPng(svg, name, options) {
  const { markup, width, height } = standaloneSvg(svg, options), url = URL.createObjectURL(new Blob([markup], { type: 'image/svg+xml' }));
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const scale = 2, canvas = document.createElement('canvas'); canvas.width = Math.ceil(width * scale); canvas.height = Math.ceil(height * scale);
      canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height); URL.revokeObjectURL(url);
      canvas.toBlob(blob => { if (blob) { save(blob, name); resolve(); } else reject(new Error('png')); }, 'image/png');
    };
    image.onerror = () => { URL.revokeObjectURL(url); reject(new Error('png')); };
    image.src = url;
  });
}

// Mind map trees: {label, children?}. A path is the list of child indexes from the root, written "0.2" ("" = root).
export const MINDMAP_LIMITS = { label: 200, children: 40, depth: 4 };
export const parsePath = path => path === '' ? [] : String(path).split('.').map(Number);
export function nodeAt(tree, path) { return parsePath(path).reduce((node, i) => node?.children?.[i], tree) || null; }
export function cloneTree(tree) { return { label: tree.label, ...(tree.children?.length ? { children: tree.children.map(cloneTree) } : {}) }; }
export function validTree(tree, depth = 0) {
  return Boolean(tree && typeof tree.label === 'string' && tree.label.length <= MINDMAP_LIMITS.label && depth <= MINDMAP_LIMITS.depth
    && (tree.children === undefined || (Array.isArray(tree.children) && tree.children.length <= MINDMAP_LIMITS.children && tree.children.every(child => validTree(child, depth + 1)))));
}
const cleanLabel = value => String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, MINDMAP_LIMITS.label);
// Returns a new tree; the original is never changed. Invalid edits (empty label, too deep, deleting the root) return null.
export function editTree(tree, { op, path, label }) {
  const next = cloneTree(tree), at = parsePath(path), node = nodeAt(next, path);
  if (!node) return null;
  if (op === 'rename') { const value = cleanLabel(label); if (!value) return null; node.label = value; return next; }
  if (op === 'add') {
    if (at.length >= MINDMAP_LIMITS.depth || (node.children?.length || 0) >= MINDMAP_LIMITS.children) return null;
    node.children = [...(node.children || []), { label: cleanLabel(label) || '新节点' }]; return next;
  }
  if (op === 'delete') {
    if (!at.length) return null;
    const parent = nodeAt(next, at.slice(0, -1).join('.')); parent.children.splice(at.at(-1), 1);
    if (!parent.children.length) delete parent.children;
    return next;
  }
  return null;
}
// Outline for notes apps: the root as a heading, branches as subheadings, deeper levels as nested bullets.
export function treeMarkdown(tree) {
  const lines = [`# ${tree.label}`, ''];
  for (const branch of tree.children || []) {
    lines.push(`## ${branch.label}`);
    const walk = (node, depth) => { lines.push(`${'  '.repeat(depth)}- ${node.label}`); (node.children || []).forEach(child => walk(child, depth + 1)); };
    (branch.children || []).forEach(child => walk(child, 0));
    lines.push('');
  }
  return `${lines.join('\n').trim()}\n`;
}
export const safeFileName = value => String(value || 'knowledge-review').replace(/[\\/:*?"<>|\s]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'knowledge-review';
