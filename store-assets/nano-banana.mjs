// Generate or edit an image with Google's Nano Banana (Gemini image models) through the Gemini API.
// No dependencies; Node 18+.
//
// The API key is read from store-assets/gemini.local.json ({"GEMINI_API_KEY": "..."}, gitignored by
// *.local.json) or the GEMINI_API_KEY environment variable. It is never printed or written anywhere else.
//
// Usage:
//   node store-assets/nano-banana.mjs --prompt "text" [--prompt-file f.txt] [--ref a.png --ref b.jpg]
//        [--aspect 9:16] [--size 1K|2K|4K] [--model gemini-nano-banana-2.1] [--out file.png] [--dry-run]
//
// --dry-run prints the request (without the key) and the estimated price, and sends nothing.
// Every real run costs money: the API has no free tier for image output (prices below, checked 2026-11-14
// on aistudio.google.com/docs/pricing; Google may change them).

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/interactions';
const API_REVISION = '2026-05-20';
const DEFAULT_MODEL = 'gemini-nano-banana-2.1';
// USD per output image, by size.
const PRICES = {
  'gemini-nano-banana-2.1': { '1K': 0.0336, '2K': 0.0504, '4K': 0.113 },
  'gemini-3.1-flash-image': { '512px': 0.045, '1K': 0.067, '2K': 0.101, '4K': 0.151 },
  'gemini-3.1-flash-lite-image': { '1K': 0.0336 },
  'gemini-3-pro-image': { '1K': 0.134, '2K': 0.134, '4K': 0.24 },
};
const MIME = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' };

function parseArgs(argv) {
  const args = { refs: [], model: DEFAULT_MODEL, size: '1K', aspect: '', out: '', prompt: '', dryRun: false };
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i], value = argv[i + 1];
    if (flag === '--dry-run') { args.dryRun = true; continue; }
    if (value === undefined) throw new Error(`Missing value after ${flag}`);
    i += 1;
    if (flag === '--prompt') args.prompt = value;
    else if (flag === '--prompt-file') args.prompt = readFileSync(value, 'utf8').trim();
    else if (flag === '--ref') args.refs.push(value);
    else if (flag === '--aspect') args.aspect = value;
    else if (flag === '--size') args.size = value.toUpperCase().replace('PX', 'px');
    else if (flag === '--model') args.model = value;
    else if (flag === '--out') args.out = value;
    else throw new Error(`Unknown option ${flag}`);
  }
  if (!args.prompt) throw new Error('Give a prompt with --prompt "..." or --prompt-file file.txt');
  return args;
}

function apiKey() {
  if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY.trim();
  const file = join(HERE, 'gemini.local.json');
  if (existsSync(file)) {
    const key = String(JSON.parse(readFileSync(file, 'utf8')).GEMINI_API_KEY || '').trim();
    if (key && !key.startsWith('PASTE')) return key;
  }
  throw new Error('No API key: paste it into store-assets/gemini.local.json as {"GEMINI_API_KEY": "..."}');
}

// The image comes back as a content block {type: "image", data: <base64>, mime_type}; walk the whole
// response so this keeps working whichever step list or convenience field holds it.
function findImages(node, found = []) {
  if (Array.isArray(node)) node.forEach(item => findImages(item, found));
  else if (node && typeof node === 'object') {
    if (node.type === 'image' && typeof node.data === 'string' && node.data.length > 100) found.push(node);
    Object.values(node).forEach(value => findImages(value, found));
  }
  return found;
}
function findText(node, found = []) {
  if (Array.isArray(node)) node.forEach(item => findText(item, found));
  else if (node && typeof node === 'object') {
    if (node.type === 'text' && typeof node.text === 'string') found.push(node.text);
    Object.values(node).forEach(value => findText(value, found));
  }
  return found;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const input = [{ type: 'text', text: args.prompt }];
  for (const ref of args.refs) {
    const mime = MIME[extname(ref).toLowerCase()];
    if (!mime) throw new Error(`Unsupported reference image type: ${ref}`);
    input.push({ type: 'image', mime_type: mime, data: readFileSync(ref).toString('base64') });
  }
  const responseFormat = { type: 'image', mime_type: 'image/png', image_size: args.size };
  if (args.aspect) responseFormat.aspect_ratio = args.aspect;
  const body = { model: args.model, input, response_format: responseFormat };

  const price = PRICES[args.model]?.[args.size];
  const estimate = price === undefined ? 'unknown (check the pricing page)' : `about $${price} per image`;
  console.log(`Model ${args.model}, size ${args.size}${args.aspect ? `, aspect ${args.aspect}` : ''}, ${args.refs.length} reference image(s). Estimated cost: ${estimate}.`);
  if (args.dryRun) {
    const shown = { ...body, input: input.map(part => part.type === 'image' ? { ...part, data: `<${part.data.length} base64 chars>` } : part) };
    console.log(JSON.stringify(shown, null, 2));
    console.log('Dry run: nothing was sent.');
    return;
  }

  const response = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'x-goog-api-key': apiKey(), 'Content-Type': 'application/json', 'Api-Revision': API_REVISION },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  let json;
  try { json = JSON.parse(text); } catch { json = null; }
  if (!response.ok) {
    const message = json?.error?.message || text.slice(0, 500);
    throw new Error(`Gemini API error ${response.status}: ${message}`);
  }

  const images = findImages(json);
  const out = resolve(args.out || join(HERE, 'nano-banana', `image-${new Date().toISOString().replace(/[:.]/g, '-')}.png`));
  mkdirSync(dirname(out), { recursive: true });
  if (!images.length) {
    writeFileSync(`${out}.response.json`, JSON.stringify(json, null, 2));
    throw new Error(`No image in the response; saved it to ${out}.response.json`);
  }
  const image = images.at(-1);
  const ext = image.mime_type === 'image/jpeg' ? '.jpg' : '.png';
  const target = extname(out) ? out : out + ext;
  writeFileSync(target, Buffer.from(image.data, 'base64'));
  const notes = findText(json).join('\n').trim();
  if (notes) console.log(`Model text: ${notes.slice(0, 400)}`);
  console.log(`Saved ${target}`);
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
