// The squirrel on the pet page lives in a small physics world: it can be picked up, thrown, bounces off the edges of
// the screen and lands on the floor of its room, squashing and stretching like jelly on every hit. Idle, it strolls,
// hops and peeks out from the screen edges. The pure step functions are tested in Node; startPetPlay() is the DOM part.

export const PHYS = { gravity: 2600, wall: 0.62, floor: 0.4, ceiling: 0.5, air: 0.15, friction: 8, rest: 60, maxThrow: 3200 };

// Body: x = centre, y = feet, w/h = collision size. Box: left/right walls, top, floor (all in screen px).
// Returns the hits of this step as [{ side, speed }].
export function stepBody(body, dt, box) {
  const hits = [];
  if (body.held) return hits;
  body.vy += PHYS.gravity * dt;
  const drag = Math.exp(-PHYS.air * dt);
  body.vx *= drag; body.vy *= drag;
  body.x += body.vx * dt; body.y += body.vy * dt;
  const half = body.w / 2;
  if (body.x - half < box.left) { body.x = box.left + half; if (body.vx < 0) { hits.push({ side: 'left', speed: -body.vx }); body.vx = -body.vx * PHYS.wall; } }
  if (body.x + half > box.right) { body.x = box.right - half; if (body.vx > 0) { hits.push({ side: 'right', speed: body.vx }); body.vx = -body.vx * PHYS.wall; } }
  // The ceiling only counts while the room is tall enough on screen to hold the squirrel under it.
  if (box.floor - body.h > box.top && body.y - body.h < box.top) { body.y = box.top + body.h; if (body.vy < 0) { hits.push({ side: 'top', speed: -body.vy }); body.vy = -body.vy * PHYS.ceiling; } }
  if (body.y >= box.floor) {
    body.y = box.floor;
    if (body.vy > PHYS.rest) { hits.push({ side: 'floor', speed: body.vy }); body.vy = -body.vy * PHYS.floor; }
    else if (body.vy > 0) body.vy = 0;
  }
  body.grounded = body.y >= box.floor - 0.5 && body.vy === 0;
  if (body.grounded && !body.walking) { body.vx *= Math.exp(-PHYS.friction * dt); if (Math.abs(body.vx) < 4) body.vx = 0; }
  return hits;
}

// A damped spring toward target (semi-implicit Euler, stable for dt up to ~1/60 with these constants).
export function stepSpring(s, target, dt, k = 520, d = 12) {
  s.v += (k * (target - s.p) - d * s.v) * dt;
  s.p += s.v * dt;
  return s.p;
}

// Release speed from the last pointer samples [{ x, y, t }] (ms), capped so a flick cannot launch it into orbit.
export function throwVelocity(samples, now) {
  const recent = samples.filter(sample => now - sample.t <= 90);
  if (recent.length < 2) return { vx: 0, vy: 0 };
  const a = recent[0], b = recent[recent.length - 1], dt = Math.max(8, b.t - a.t) / 1000;
  let vx = (b.x - a.x) / dt, vy = (b.y - a.y) / dt;
  const speed = Math.hypot(vx, vy);
  if (speed > PHYS.maxThrow) { vx *= PHYS.maxThrow / speed; vy *= PHYS.maxThrow / speed; }
  return { vx, vy };
}

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
// WAAPI with a timer fallback: animations do not advance in a hidden page, the sequence must still go on.
const played = (animation, ms) => Promise.race([animation.finished.catch(() => {}), wait(ms + 60)]);

// A pine cone flying on an arc from one screen point to another (also used by app.js for the review page).
export function flyCone(svg, from, to, { ms = 520, lift = 70, spin = 1 } = {}) {
  const el = document.createElement('div');
  el.className = 'pet-cone-fly'; el.innerHTML = svg; document.body.append(el);
  const frames = [];
  for (let i = 0; i <= 12; i++) {
    const t = i / 12, x = from.x + (to.x - from.x) * t - 12, y = from.y + (to.y - from.y) * t - lift * 4 * t * (1 - t) - 12;
    frames.push({ transform: `translate(${x}px, ${y}px) rotate(${t * 360 * spin}deg) scale(${1 - t * 0.25})` });
  }
  el.style.transform = frames[0].transform;
  return played(el.animate(frames, { duration: ms, easing: 'cubic-bezier(.35,.1,.6,1)' }), ms).then(() => el.remove());
}

function sparkle(at) {
  const el = document.createElement('div');
  el.className = 'pet-cone-spark'; el.textContent = '✦'; document.body.append(el);
  const base = `translate(${at.x + 10}px, ${at.y - 18}px)`;
  el.style.transform = base;
  played(el.animate([{ transform: `${base} scale(.3)`, opacity: 0 }, { transform: `${base} scale(1.3) rotate(25deg)`, opacity: 1, offset: 0.4 }, { transform: `${base} translateY(-10px) scale(.8) rotate(45deg)`, opacity: 0 }], { duration: 600, easing: 'ease-out' }), 600).then(() => el.remove());
}
let current = null;   // the running world; a re-render replaces it at once so two squirrels never show
let saved = null;     // where the squirrel was, kept across re-renders of the page

// button: the squirrel button inside the pet scene; scene: the room it lives in.
// hooks: usual() -> the pose for its mood, ring() opens the actions ring, sleepy() -> true while it is asleep.
export function startPetPlay(button, scene, hooks) {
  current?.stop();
  const img = button.querySelector('img');
  const start = button.getBoundingClientRect(), room = scene.getBoundingClientRect();
  const w = start.width, floorGap = room.bottom - start.bottom, homeX = start.left + w / 2, roomLeft = room.left;
  const layer = document.createElement('div'), holder = document.createElement('div'), shadow = document.createElement('div');
  layer.className = 'pet-play'; holder.className = 'pet-body'; shadow.className = 'pet-shadow';
  holder.style.width = `${w}px`; shadow.style.width = `${w * 0.62}px`;
  // A body-level layer: the page's tab-switch animation transforms <main>, which would break position:fixed inside it.
  const spot = document.createElement('div'); // keeps the room's layout as it was
  spot.className = 'pet-spot'; spot.style.height = `${start.height}px`;
  button.replaceWith(spot);
  holder.append(button); layer.append(shadow, holder); document.body.append(layer);
  button.classList.add('is-free');

  const body = { x: saved?.x ?? start.left + w / 2, y: start.bottom, vx: 0, vy: 0, w: w * 0.96, h: w * 0.9, held: false, walking: false, grounded: true };
  const squash = { p: 0, v: 0 }, tilt = { p: 0, v: 0 };
  let origin = 'bottom', running = true, last = performance.now(), height = holder.offsetHeight || w;
  let flash = 0, spin = null, spins = 0, lastSpin = 0, idleAt = last + 2500, walkTo = null, peek = null, peekUntil = 0, peekBack = false, facing = 1, bobT = 0, dizzy = false;
  let pointer = null, lastTap = 0, pressTimer = 0, samples = [], stashing = false;

  const box = () => {
    // Walls are the app's own edges (the room's content box is inset), the floor is where the cushion is.
    const r = scene.getBoundingClientRect(), app = (document.getElementById('app') || document.body).getBoundingClientRect();
    const bar = document.querySelector('.tabbar')?.getBoundingClientRect();
    const floor = Math.min(r.bottom - floorGap, bar ? bar.top - 6 : innerHeight);
    const edge = peek ? w * 0.42 : 0;
    return { left: Math.max(0, app.left) - (peek === 'left' ? edge : 0), right: Math.min(innerWidth, app.right) + (peek === 'right' ? edge : 0), top: 0, floor };
  };
  // Dressed (shop outfits), the squirrel keeps its front-standing picture with the outfit on; only being lifted or
  // asleep has its own picture, shown without the outfit for that moment.
  const pose = name => {
    const dressed = button.classList.contains('is-dressed'), bare = dressed && ['lifted', 'sleep'].includes(name);
    if (dressed) button.classList.toggle('is-bare', bare);
    const src = dressed && !bare ? '/illustrations/mascot-stand.webp' : `/illustrations/mascot-${name}.webp`;
    if (img.getAttribute('src') !== src) img.src = src;
  };
  const settle = () => { pose(hooks.usual()); img.classList.remove('is-left'); };
  const show = (name, ms) => { pose(name); flash = performance.now() + ms; };
  const kick = (amount, side = 'bottom') => { origin = side; squash.v += amount; };
  img.addEventListener('load', () => { height = holder.offsetHeight || height; });

  function hit({ side, speed }) {
    const power = clamp(speed / 2400, 0, 1);
    kick(side === 'floor' ? 10 * power + 1 : -8 * power, side === 'floor' ? 'bottom' : side);
    if (speed > 900) navigator.vibrate?.(8);
  }

  function idle(now) {
    idleAt = now + 3500 + Math.random() * 4000;
    // Sleepy: walk back to the cushion (where it started) and stay there.
    if (hooks.sleepy()) { const home = homeX + (scene.getBoundingClientRect().left - roomLeft); if (Math.abs(body.x - home) > 6) walkTo = home; return; }
    const b = box(), roll = Math.random();
    if (roll < 0.45) { walkTo = clamp(b.left + w / 2 + Math.random() * (b.right - b.left - w), b.left + w / 2, b.right - w / 2); if (Math.abs(walkTo - body.x) < 50) walkTo = null; }
    else if (roll < 0.62) { peek = Math.random() < 0.5 ? 'left' : 'right'; walkTo = peek === 'left' ? -Infinity : Infinity; }
    else if (roll < 0.82) { kick(4); body.vy = -560; body.grounded = false; }
    else show(Math.random() < 0.5 ? 'wave' : 'think', 1400);
  }

  function frame(now) {
    if (!running) return;
    if (!scene.isConnected) { stop(); return; }
    const dt = Math.min(1 / 30, (now - last) / 1000); last = now;
    const b = box();
    // Walking (and walking out to peek from an edge) is driven here; the physics only keeps it on the floor.
    if (walkTo !== null && body.grounded && !body.held) {
      const target = clamp(walkTo, b.left + body.w / 2, b.right - body.w / 2), dir = Math.sign(target - body.x);
      if (Math.abs(target - body.x) < 4) {
        body.walking = false; body.vx = 0; walkTo = null; settle();
        if (peek && !peekBack) peekUntil = now + 2600; // lean out from the edge for a moment
        else { peek = null; peekBack = false; }
      } else { body.walking = true; body.vx = dir * 92; facing = dir; pose('walk'); img.classList.toggle('is-left', dir < 0); bobT += dt; }
    } else if (body.walking) { body.walking = false; }
    // Walk back in while the edge still allows the overhang, then drop it once fully inside.
    if (peekUntil && now > peekUntil) { peekUntil = 0; peekBack = true; walkTo = body.x < (b.left + b.right) / 2 ? body.x + w * 0.7 : body.x - w * 0.7; }
    for (let t = 0; t < dt; t += 1 / 120) stepBody(body, Math.min(1 / 120, dt - t), b).forEach(hit);
    if (!body.held && !body.walking && !peek && flash && now > flash) { flash = 0; settle(); }
    if (!body.held && body.grounded && walkTo === null && img.getAttribute('src')?.includes('lifted')) { if (dizzy) show('think', 1000); else settle(); dizzy = false; }
    if (!stashing && body.grounded && !body.held && walkTo === null && !peek && now > idleAt && !document.querySelector('.mascot-ring')) idle(now);

    // Jelly: one squash spring (positive flattens toward the last hit side), stretch along the flight direction,
    // a tilt that follows the drag or the flight, and an optional spin (double tap).
    const breathe = body.grounded && !body.walking ? Math.sin(now / 520) * (hooks.sleepy() ? 0.03 : 0.012) : 0;
    const q = stepSpring(squash, breathe, dt, 420, 9);
    const speed = Math.hypot(body.vx, body.vy), airborne = !body.grounded && !body.held;
    const stretch = airborne ? clamp(speed / 5200, 0, 0.16) : 0, angle = Math.atan2(body.vy, body.vx);
    const lean = body.held ? clamp(body.vx * 0.012, -28, 28) : airborne ? clamp(body.vx * 0.006, -16, 16) : peek && !body.walking ? (peek === 'left' ? 16 : -16) : 0;
    const r = stepSpring(tilt, lean, dt, 260, 14);
    let turn = 0;
    if (spin) { const k = clamp((now - spin.at) / spin.ms, 0, 1); turn = 360 * (1 - Math.pow(1 - k, 3)) * spin.dir; if (k >= 1) spin = null; }
    const bob = body.walking ? -Math.abs(Math.sin(bobT * 11)) * 7 : 0;
    const side = origin === 'left' || origin === 'right', sx = side ? 1 - q : 1 + q, sy = side ? 1 + q * 0.7 : 1 - q;
    holder.style.transformOrigin = origin === 'left' ? `0 ${height * 0.6}px` : origin === 'right' ? `${w}px ${height * 0.6}px` : origin === 'top' ? `${w / 2}px 0` : `${w / 2}px ${height}px`;
    holder.style.transform = `translate(${body.x - w / 2}px, ${body.y - height + bob}px) rotate(${r + turn}deg) rotate(${angle}rad) scale(${1 + stretch}, ${1 - stretch}) rotate(${-angle}rad) scale(${sx}, ${sy})`;
    const lift = clamp((b.floor - body.y) / 260, 0, 1);
    shadow.style.transform = `translate(${body.x - w * 0.31}px, ${b.floor - 9}px) scale(${1 - lift * 0.55}, ${1 - lift * 0.4})`;
    shadow.style.opacity = String(1 - lift * 0.7);
    requestAnimationFrame(frame);
  }

  // Gestures: tap = poke (jelly + hop), double tap = somersault (faster each time in a row), long press = actions
  // ring, press and drag = pick it up, let go = drop or throw.
  function down(event) {
    if (event.button > 0 || pointer || stashing) return;
    pointer = { id: event.pointerId, x: event.clientX, y: event.clientY, dx: event.clientX - body.x, dy: event.clientY - body.y, dragging: false, long: false };
    samples = [{ x: event.clientX, y: event.clientY, t: event.timeStamp }];
    holder.setPointerCapture?.(event.pointerId);
    pressTimer = setTimeout(() => { if (pointer && !pointer.dragging) { pointer.long = true; hooks.ring(); } }, 480);
  }
  function move(event) {
    if (!pointer || event.pointerId !== pointer.id) return;
    samples.push({ x: event.clientX, y: event.clientY, t: event.timeStamp }); if (samples.length > 8) samples.shift();
    if (!pointer.dragging && !pointer.long && Math.hypot(event.clientX - pointer.x, event.clientY - pointer.y) > 8) {
      pointer.dragging = true; clearTimeout(pressTimer); body.held = true; body.walking = false; walkTo = null; peek = null; peekUntil = 0; peekBack = false; spin = null;
      pose('lifted'); img.classList.remove('is-left'); kick(-5, 'top'); navigator.vibrate?.(6);
    }
    if (pointer.dragging) {
      const b = box(), prevX = body.x;
      body.x = clamp(event.clientX - pointer.dx, b.left + body.w / 2, b.right - body.w / 2);
      body.y = clamp(event.clientY - pointer.dy, Math.min(b.floor, b.top + body.h), b.floor);
      body.vx = body.vx * 0.6 + (body.x - prevX) * 24;
    }
  }
  function up(event) {
    if (!pointer || event.pointerId !== pointer.id) return;
    clearTimeout(pressTimer);
    const was = pointer; pointer = null; idleAt = performance.now() + 4000;
    if (was.dragging) {
      body.held = false; body.grounded = false;
      const v = event.type === 'pointercancel' ? { vx: 0, vy: 0 } : throwVelocity(samples, event.timeStamp);
      body.vx = v.vx; body.vy = v.vy; dizzy = Math.hypot(v.vx, v.vy) > 1500;
      return;
    }
    if (was.long || event.type === 'pointercancel') return;
    const now = performance.now();
    if (now - lastTap < 320) {
      lastTap = 0; spins = now - lastSpin < 1400 ? spins + 1 : 0; lastSpin = now;
      spin = { at: now, ms: Math.max(220, 720 * Math.pow(0.82, spins)), dir: facing || 1 };
      if (body.grounded) { body.vy = -780; body.grounded = false; }
      show('cheer', 1100);
    } else {
      lastTap = now;
      if (!peek) walkTo = null;
      kick(7); if (body.grounded) { body.vy = -380; body.grounded = false; }
      show(['wave', 'cheer', 'shy'][Math.floor(Math.random() * 3)], 900);
    }
  }
  holder.addEventListener('pointerdown', down);
  holder.addEventListener('pointermove', move);
  holder.addEventListener('pointerup', up);
  holder.addEventListener('pointercancel', up);
  button.addEventListener('contextmenu', event => event.preventDefault());
  // Keyboard: Enter / Space open the ring (no long press without a pointer).
  button.addEventListener('click', event => { if (event.detail === 0) hooks.ring(); });

  function stop() {
    if (!running) return;
    running = false; clearTimeout(pressTimer);
    saved = { x: body.x };
    layer.remove();
    if (current === world) current = null;
  }
  // New pine cones: one pops out above its head (learning bore fruit), it hugs it, walks to the jar and tosses it in.
  // The first cone gets the whole scene, up to four more follow quickly, the rest go in at once.
  // drop(k) is called as k cones land in the jar.
  const until = test => new Promise(resolve => { const timer = setInterval(() => { if (!running || test()) { clearInterval(timer); resolve(); } }, 40); });
  async function stash(count, jar, drop, svg) {
    if (stashing || count <= 0) return;
    stashing = true;
    await wait(700);
    const shown = Math.min(count, 5);
    for (let i = 0; i < shown && running; i++) {
      await until(() => body.grounded && !body.held);
      walkTo = null; peek = null; peekUntil = 0; peekBack = false;
      const head = { x: body.x, y: body.y - height - 14 };
      const pop = document.createElement('div');
      pop.className = 'pet-cone-fly'; pop.innerHTML = svg; document.body.append(pop);
      const at = (x, y, s) => `translate(${x - 12}px, ${y - 12}px) scale(${s})`;
      if (!i) pose('cheer');
      sparkle(head);
      await played(pop.animate([{ transform: at(head.x, head.y, 0), opacity: 0 }, { transform: at(head.x, head.y - 8, 1.35), opacity: 1, offset: 0.35 }, { transform: at(head.x, head.y, 1), offset: 0.65 }, { transform: at(body.x, body.y - height * 0.45, 0.8), opacity: 1 }], { duration: i ? 420 : 760, easing: 'ease-out', fill: 'forwards' }), i ? 420 : 760);
      pop.remove();
      pose('stash'); flash = 0; kick(i ? 3 : 6);
      if (!i && body.grounded) { body.vy = -380; body.grounded = false; }
      const r = jar.getBoundingClientRect(), spot = r.left + r.width * 0.62 + body.w / 2 + 4;
      if (Math.abs(body.x - spot) > 10) {
        await until(() => body.grounded);
        walkTo = spot;
        await until(() => walkTo === null);
        pose('stash');
      }
      await wait(i ? 60 : 260);
      kick(4);
      const mouth = jar.getBoundingClientRect();
      await flyCone(svg, { x: body.x - w * 0.2, y: body.y - height * 0.5 }, { x: mouth.left + mouth.width * 0.31, y: mouth.top + mouth.height * 0.22 }, { ms: i ? 380 : 540, lift: 54, spin: -1 });
      if (!running) break;
      drop(1);
      await wait(i ? 140 : 360);
    }
    if (running && count > shown) drop(count - shown);
    idleAt = performance.now() + 3000; flash = 0; settle(); stashing = false;
  }
  const world = { stop, stash };
  current = world;
  requestAnimationFrame(frame);
  return world;
}
