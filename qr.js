// QR code generator for the friend code (byte mode, error correction M — about 15% may be covered, enough for 小回's
// head in the middle with level M kept to a small centre area). Versions 1–10 cover up to 213 bytes, plenty for a link.
// Follows ISO/IEC 18004: data + Reed–Solomon blocks, function patterns, zig-zag placement, the mask with the lowest
// penalty, format and version bits.
const ECC_PER_BLOCK = [0, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26];
const BLOCKS = [0, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5];
const FORMAT_M = 0; // error-correction level M in the format bits

const rawModules = version => {
  let result = (16 * version + 128) * version + 64;
  if (version >= 2) { const align = Math.floor(version / 7) + 2; result -= (25 * align - 10) * align - 55; if (version >= 7) result -= 36; }
  return result;
};
const dataCodewords = version => Math.floor(rawModules(version) / 8) - ECC_PER_BLOCK[version] * BLOCKS[version];

// GF(256) with the QR polynomial 0x11D.
function gfMultiply(x, y) {
  let z = 0;
  for (let i = 7; i >= 0; i--) { z = (z << 1) ^ ((z >>> 7) * 0x11d); z ^= ((y >>> i) & 1) * x; }
  return z & 0xff;
}
function rsDivisor(degree) {
  const result = new Array(degree).fill(0); result[degree - 1] = 1;
  let root = 1;
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < degree; j++) { result[j] = gfMultiply(result[j], root); if (j + 1 < degree) result[j] ^= result[j + 1]; }
    root = gfMultiply(root, 0x02);
  }
  return result;
}
function rsRemainder(data, divisor) {
  const result = new Array(divisor.length).fill(0);
  for (const byte of data) {
    const factor = byte ^ result.shift(); result.push(0);
    divisor.forEach((coef, i) => { result[i] ^= gfMultiply(coef, factor); });
  }
  return result;
}

function alignmentPositions(version) {
  if (version === 1) return [];
  const count = Math.floor(version / 7) + 2, step = Math.ceil((version * 4 + 4) / (count * 2 - 2)) * 2, result = [6];
  for (let pos = version * 4 + 10; result.length < count; pos -= step) result.splice(1, 0, pos);
  return result;
}

// text → { size, modules: boolean[][] } (modules[y][x], true = dark).
export function qrMatrix(text) {
  const bytes = [...new TextEncoder().encode(String(text))];
  let version = 1;
  while (version <= 10) { const countBits = version < 10 ? 8 : 16; if (4 + countBits + bytes.length * 8 <= dataCodewords(version) * 8) break; version++; }
  if (version > 10) throw new Error('qr-too-long');
  const size = version * 4 + 17, capacity = dataCodewords(version) * 8;
  // Data bits: mode 0100, length, bytes, terminator, padding.
  const bits = [], push = (value, length) => { for (let i = length - 1; i >= 0; i--) bits.push((value >>> i) & 1); };
  push(4, 4); push(bytes.length, version < 10 ? 8 : 16); bytes.forEach(byte => push(byte, 8));
  push(0, Math.min(4, capacity - bits.length));
  push(0, (8 - bits.length % 8) % 8);
  for (let pad = 0xec; bits.length < capacity; pad ^= 0xec ^ 0x11) push(pad, 8);
  const data = []; for (let i = 0; i < bits.length; i += 8) data.push(bits.slice(i, i + 8).reduce((acc, bit) => (acc << 1) | bit, 0));
  // Reed–Solomon blocks, interleaved.
  const blockCount = BLOCKS[version], eccLength = ECC_PER_BLOCK[version], raw = Math.floor(rawModules(version) / 8);
  const shortBlocks = blockCount - raw % blockCount, shortLength = Math.floor(raw / blockCount), divisor = rsDivisor(eccLength), blocks = [];
  for (let i = 0, k = 0; i < blockCount; i++) {
    const chunk = data.slice(k, k + shortLength - eccLength + (i < shortBlocks ? 0 : 1)); k += chunk.length;
    const ecc = rsRemainder(chunk, divisor);
    if (i < shortBlocks) chunk.push(0);
    blocks.push(chunk.concat(ecc));
  }
  const codewords = [];
  for (let i = 0; i < blocks[0].length; i++) blocks.forEach((block, j) => { if (i !== shortLength - eccLength || j >= shortBlocks) codewords.push(block[i]); });

  const modules = Array.from({ length: size }, () => new Array(size).fill(false));
  const fixed = Array.from({ length: size }, () => new Array(size).fill(false));
  const set = (x, y, dark) => { modules[y][x] = dark; fixed[y][x] = true; };
  for (let i = 0; i < size; i++) { set(6, i, i % 2 === 0); set(i, 6, i % 2 === 0); }
  for (const [cx, cy] of [[3, 3], [size - 4, 3], [3, size - 4]]) {
    for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
      const x = cx + dx, y = cy + dy, dist = Math.max(Math.abs(dx), Math.abs(dy));
      if (x >= 0 && x < size && y >= 0 && y < size) set(x, y, dist !== 2 && dist !== 4);
    }
  }
  const align = alignmentPositions(version), last = align.length - 1;
  align.forEach((ay, i) => align.forEach((ax, j) => {
    if ((i === 0 && j === 0) || (i === 0 && j === last) || (i === last && j === 0)) return;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) set(ax + dx, ay + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
  }));
  const formatBits = mask => {
    const value = (FORMAT_M << 3) | mask; let rem = value;
    for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
    return ((value << 10) | rem) ^ 0x5412;
  };
  const drawFormat = mask => {
    const f = formatBits(mask), bit = i => ((f >>> i) & 1) === 1;
    for (let i = 0; i <= 5; i++) set(8, i, bit(i));
    set(8, 7, bit(6)); set(8, 8, bit(7)); set(7, 8, bit(8));
    for (let i = 9; i < 15; i++) set(14 - i, 8, bit(i));
    for (let i = 0; i < 8; i++) set(size - 1 - i, 8, bit(i));
    for (let i = 8; i < 15; i++) set(8, size - 15 + i, bit(i));
    set(8, size - 8, true);
  };
  drawFormat(0);
  if (version >= 7) {
    let rem = version; for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
    const v = (version << 12) | rem;
    for (let i = 0; i < 18; i++) { const dark = ((v >>> i) & 1) === 1, a = size - 11 + i % 3, b = Math.floor(i / 3); set(a, b, dark); set(b, a, dark); }
  }
  // Zig-zag placement of the codeword bits.
  for (let right = size - 1, i = 0; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < size; vert++) for (let j = 0; j < 2; j++) {
      const x = right - j, upward = ((right + 1) & 2) === 0, y = upward ? size - 1 - vert : vert;
      if (!fixed[y][x] && i < codewords.length * 8) { modules[y][x] = ((codewords[i >>> 3] >>> (7 - (i & 7))) & 1) === 1; i++; }
    }
  }
  const MASKS = [(x, y) => (x + y) % 2 === 0, (x, y) => y % 2 === 0, x => x % 3 === 0, (x, y) => (x + y) % 3 === 0,
    (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0, (x, y) => x * y % 2 + x * y % 3 === 0,
    (x, y) => (x * y % 2 + x * y % 3) % 2 === 0, (x, y) => ((x + y) % 2 + x * y % 3) % 2 === 0];
  const applyMask = mask => { for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (!fixed[y][x] && MASKS[mask](x, y)) modules[y][x] = !modules[y][x]; };
  // Penalty: runs of five or more, 2×2 blocks, finder-like patterns and dark/light balance (ISO rules N1–N4).
  const penalty = () => {
    let score = 0, dark = 0;
    const finderLike = line => { let n = 0; for (let i = 0; i + 11 <= line.length; i++) { const s = line.slice(i, i + 11).map(Number).join(''); if (s === '10111010000' || s === '00001011101') n++; } return n; };
    for (let pass = 0; pass < 2; pass++) for (let a = 0; a < size; a++) {
      const line = Array.from({ length: size }, (_, b) => pass ? modules[b][a] : modules[a][b]);
      let run = 1;
      for (let b = 1; b <= size; b++) {
        if (b < size && line[b] === line[b - 1]) run++;
        else { if (run >= 5) score += 3 + run - 5; run = 1; }
      }
      score += finderLike(line) * 40;
    }
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      if (modules[y][x]) dark++;
      if (x < size - 1 && y < size - 1) { const c = modules[y][x]; if (c === modules[y][x + 1] && c === modules[y + 1][x] && c === modules[y + 1][x + 1]) score += 3; }
    }
    return score + Math.floor(Math.abs(dark * 20 - size * size * 10) / (size * size)) * 10;
  };
  let best = 0, bestScore = Infinity;
  for (let mask = 0; mask < 8; mask++) {
    applyMask(mask); drawFormat(mask);
    const score = penalty();
    if (score < bestScore) { best = mask; bestScore = score; }
    applyMask(mask);
  }
  applyMask(best); drawFormat(best);
  return { size, version, modules };
}

// An SVG drawing of the code with a 4-module quiet zone; `hole` leaves a white square in the middle (in modules) for a logo.
export function qrSvg(text, { hole = 0, label = '' } = {}) {
  const { size, modules } = qrMatrix(text), total = size + 8, centre = size / 2;
  let path = '';
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    if (!modules[y][x]) continue;
    if (hole && Math.abs(x + .5 - centre) < hole / 2 && Math.abs(y + .5 - centre) < hole / 2) continue;
    path += `M${x + 4} ${y + 4}h1v1h-1z`;
  }
  return `<svg class="qr-svg" viewBox="0 0 ${total} ${total}" role="img" aria-label="${label}" shape-rendering="crispEdges"><rect width="${total}" height="${total}" fill="#fff"/><path d="${path}" fill="#1e293b"/></svg>`;
}
