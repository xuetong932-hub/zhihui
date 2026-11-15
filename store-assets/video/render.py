# Draft cut of the 30-second KnowBack film (16:9, 1920x1080, 30 fps, H.264) from the real screen recordings,
# the S1 still and the AI S2 shot. Follows the script in PREPRODUCTION.md; AI shots not yet generated are replaced
# by motion graphics. Usage: python render.py [out.mp4]
import bisect, json, sys, tempfile, shutil, pathlib
import numpy as np, cv2, imageio_ffmpeg
from PIL import Image, ImageDraw, ImageFont

HERE = pathlib.Path(__file__).parent
W, H, FPS = 1920, 1080, 30
GREEN = (48, 105, 79)          # brand #30694F, RGB
INK = (29, 29, 31)
FONT_B, FONT_R = 'C:/Windows/Fonts/segoeuib.ttf', 'C:/Windows/Fonts/segoeui.ttf'
read = lambda p, flag=cv2.IMREAD_COLOR: cv2.imdecode(np.fromfile(str(p), np.uint8), flag)
smooth = lambda x: 0.0 if x <= 0 else 1.0 if x >= 1 else x * x * (3 - 2 * x)
ease = lambda x: 0.0 if x <= 0 else 1.0 if x >= 1 else (4 * x ** 3 if x < 0.5 else 1 - (-2 * x + 2) ** 3 / 2)

# ---------- sources ----------
class Recording:
    """Screen recording frames by time (seconds from the first frame), cached at the size asked for."""
    def __init__(self, name):
        self.dir = HERE / 'frames' / name
        meta = json.loads((self.dir / 'frames.json').read_text())
        t0 = meta['frames'][0]['t']
        self.times = [f['t'] - t0 for f in meta['frames']]; self.files = [f['file'] for f in meta['frames']]
        self.cache = {}
    def at(self, t, size):
        i = max(0, bisect.bisect_right(self.times, t) - 1)
        key = (i, size)
        if key not in self.cache:
            if len(self.cache) > 80: self.cache.clear()
            self.cache[key] = cv2.cvtColor(cv2.resize(read(self.dir / self.files[i]), size, interpolation=cv2.INTER_AREA), cv2.COLOR_BGR2RGB)
        return self.cache[key]

def load_video(path):
    tmp = pathlib.Path(tempfile.gettempdir()) / ('kb-' + pathlib.Path(path).name); shutil.copy(path, tmp)
    cap, out = cv2.VideoCapture(str(tmp)), []
    fps = cap.get(cv2.CAP_PROP_FPS)
    while True:
        ok, im = cap.read()
        if not ok: break
        out.append(cv2.cvtColor(im, cv2.COLOR_BGR2RGB))
    return out, fps

REC = {n: Recording(n) for n in ['r1-ask-phone', 'r2-cards-phone', 'r3-review-phone', 'r4-graph-desktop', 'r5-square-phone', 'r6-languages-phone']}
S1 = cv2.cvtColor(read(HERE / 'ai/s1-firstframe.png'), cv2.COLOR_BGR2RGB)
S2, S2_FPS = load_video(HERE / 'ai/s2-kling4.mp4')   # Kling 4.0 won the S2 test (turns to face the camera)
S2_TRACK = json.loads((HERE / 'ai/s2-kling4.track.json').read_text())
S3, S3_FPS = load_video(HERE / 'ai/s3-kling4.mp4')   # Kling 4.0: a card rises out of the phone
S3_TRACK = json.loads((HERE / 'ai/s3-kling4.track.json').read_text())
for i, tr in enumerate(S3_TRACK):  # a crossing card can break the screen scan; keep the previous box then
    x0, y0, x1, y1 = tr['screen']
    if i and (x1 - x0 > 320 or y1 - y0 < 400): tr['screen'] = S3_TRACK[i - 1]['screen']
S6, S6_FPS = load_video(HERE / 'ai/s6-kling4-v2.mp4')   # Kling 4.0: laptop, camera orbits to the front
S6_TRACK = json.loads((HERE / 'ai/s6-kling4-v2.track.json').read_text())
S8, S8_FPS = load_video(HERE / 'ai/s8-kling4.mp4')   # Kling 4.0: privacy shield turns to camera
CARD = cv2.cvtColor(read(HERE / 'frames/r2-cards-phone/00000.jpg')[300:925, 51:1119], cv2.COLOR_BGR2RGB)  # real "Variables" card, cut at a line break
CARD = np.vstack([CARD, np.full((int(CARD.shape[1] / 1.56) - CARD.shape[0], CARD.shape[1], 3), CARD[-5, CARD.shape[1] // 2], np.uint8)])  # card white to the AI card's shape
ICON = read(HERE / '../../icon-512.png', cv2.IMREAD_UNCHANGED)

# ---------- drawing helpers ----------
def text_layer(parts, size, bold=True):
    """parts: [(text, rgb)] on one line -> RGBA array, tightly cropped."""
    font = ImageFont.truetype(FONT_B if bold else FONT_R, size)
    widths = [font.getlength(t) for t, _ in parts]
    img = Image.new('RGBA', (int(sum(widths)) + 8, int(size * 1.4)), (0, 0, 0, 0)); d = ImageDraw.Draw(img); x = 0
    for (t, c), w in zip(parts, widths): d.text((x, 0), t, font=font, fill=c + (255,)); x += w
    return np.array(img)

def paste(dst, rgba, x, y, alpha=1.0):
    """Alpha-composite an RGBA (or RGB) array onto dst at integer x, y, clipped to the frame."""
    h, w = rgba.shape[:2]; x, y = int(round(x)), int(round(y))
    x0, y0, x1, y1 = max(0, x), max(0, y), min(dst.shape[1], x + w), min(dst.shape[0], y + h)
    if x1 <= x0 or y1 <= y0 or alpha <= 0: return
    src = rgba[y0 - y:y1 - y, x0 - x:x1 - x]
    a = (src[..., 3:4] / 255.0 if src.shape[2] == 4 else np.ones(src.shape[:2] + (1,))) * alpha
    dst[y0:y1, x0:x1] = (src[..., :3] * a + dst[y0:y1, x0:x1] * (1 - a)).astype(np.uint8)

def caption(frame, parts, t, x, y, size=84, start=0.25, align='left'):
    """Apple-style super: fades in and rises 24 px."""
    if not CAPTIONS: return
    layer = CAP.setdefault((tuple(parts), size), text_layer(parts, size))
    k = ease((t - start) / 0.6)
    if align == 'center': x = x - layer.shape[1] / 2
    paste(frame, layer, x, y + 24 * (1 - k), k)
CAP = {}
CAPTIONS = True  # the vertical cut turns these off and sets its own

def rounded_mask(w, h, r):
    m = np.zeros((h, w), np.uint8); cv2.rectangle(m, (r, 0), (w - r, h), 255, -1); cv2.rectangle(m, (0, r), (w, h - r), 255, -1)
    for cx, cy in [(r, r), (w - r - 1, r), (r, h - r - 1), (w - r - 1, h - r - 1)]: cv2.circle(m, (cx, cy), r, 255, -1, cv2.LINE_AA)
    return m

def phone(frame, screen, cx, cy, scale=1.0):
    """Phone mockup (dark body, rounded screen) centred at cx, cy with a soft floor shadow."""
    sh, sw = screen.shape[:2]
    sw2, sh2 = int(sw * scale), int(sh * scale)
    scr = cv2.resize(screen, (sw2, sh2), interpolation=cv2.INTER_AREA) if scale != 1 else screen
    b = int(16 * scale); bw, bh = sw2 + 2 * b, sh2 + 2 * b; x, y = int(cx - bw / 2), int(cy - bh / 2)
    shadow = np.zeros(frame.shape[:2], np.float32); cv2.ellipse(shadow, (int(cx), y + bh + 10), (int(bw * 0.45), 22), 0, 0, 360, 1, -1)
    shadow = cv2.GaussianBlur(shadow, (0, 0), 18)[..., None] * 0.35
    frame[:] = (frame * (1 - shadow)).astype(np.uint8)
    body = np.zeros((bh, bw, 4), np.uint8); body[..., :3] = (28, 28, 30); body[..., 3] = rounded_mask(bw, bh, int(64 * scale))
    paste(frame, body, x, y)
    s = np.dstack([scr, rounded_mask(sw2, sh2, int(50 * scale))]); paste(frame, s, x + b, y + b)

def white(): return np.full((H, W, 3), 250, np.uint8)
SCREEN = (406, 878)            # phone screen size in the cut (1170x2532 scaled)
def rec(name, t, size=SCREEN): return REC[name].at(t, size)

# ---------- scenes (local time t from 0) ----------
def s1(t):  # 0:00-0:03 light sweeps the edge
    z = 1 + 0.05 * t / 3
    h, w = S1.shape[:2]; cw, ch = int(w / z), int(h / z)
    crop = S1[(h - ch) // 2:(h + ch) // 2, (w - cw) // 2:(w + cw) // 2]
    f = cv2.resize(crop, (W, H), interpolation=cv2.INTER_AREA).astype(np.float32)
    xs = np.linspace(0, 1, W)[None, :, None]; p = -0.2 + 1.5 * ease(t / 2.6)
    light = np.clip((p - xs) / 0.25, 0, 1) * 0.85 + 0.15
    glint = np.exp(-((xs - p) / 0.04) ** 2) * 0.6
    f = f * light + glint * f.mean(axis=2, keepdims=True) * 1.5
    return np.clip(f * smooth(t / 0.6), 0, 255).astype(np.uint8)

def s2(t):  # 0:03-0:06 AI phone on white, screen shows the question being typed
    i = min(len(S2) - 1, int((1.4 + t * 1.2) * S2_FPS)); f = cv2.resize(S2[i], (W, H), interpolation=cv2.INTER_CUBIC)
    q = np.array(S2_TRACK[i], np.float32) * (W / S2[i].shape[1]); q = q.mean(0) + (q - q.mean(0)) * 1.025  # cover the grey edge
    scr = rec('r1-ask-phone', 1.0 + t * 1.1, (585, 1266))
    hgt = cv2.getPerspectiveTransform(np.float32([[0, 0], [585, 0], [585, 1266], [0, 1266]]), q)
    warped = cv2.warpPerspective(scr, hgt, (W, H), flags=cv2.INTER_AREA)
    m = cv2.warpPerspective(rounded_mask(585, 1266, 70), hgt, (W, H))
    dark = cv2.dilate((cv2.cvtColor(f, cv2.COLOR_RGB2GRAY) < 70).astype(np.uint8), np.ones((5, 5), np.uint8))  # keep the notch
    m = (m * (1 - dark))[..., None] / 255.0
    f = (warped * m + f * (1 - m)).astype(np.uint8)
    caption(f, [('You ask.', INK)], t, 1180, 470, 96)
    return f

def s3(t):  # 0:06-0:10 AI: the answer on the phone, a card rises out of it and shows the real knowledge card
    i = min(len(S3) - 1, int((0.8 + t * 1.05) * S3_FPS)); src = S3[i]; sx = W / src.shape[1]
    f = cv2.resize(src, (W, H), interpolation=cv2.INTER_CUBIC); g = cv2.cvtColor(f, cv2.COLOR_RGB2GRAY)
    tr = S3_TRACK[i]; x0, y0, x1, y1 = [int(round(v * sx)) for v in tr['screen']]
    scr = rec('r1-ask-phone', 14.7 + t * 0.6, (x1 - x0, y1 - y0))
    m = np.zeros((H, W), np.float32); m[y0:y1, x0:x1] = rounded_mask(x1 - x0, y1 - y0, int((x1 - x0) * 0.11)) / 255.0
    m *= (g < 207)  # only where the grey screen shows, never over the card or the bezel
    if tr['card']: cx0, cy0, cx1, cy1 = [int(round(v * sx)) for v in tr['card']]; m[cy0 - 6:cy1 + 6, cx0 - 6:cx1 + 6] = 0
    m = cv2.GaussianBlur(m, (3, 3), 0)[..., None]; big = np.zeros_like(f); big[y0:y1, x0:x1] = scr
    f = (big * m + f * (1 - m)).astype(np.uint8)
    k = smooth((i - 62) / 14) if tr['card'] else 0
    if k > 0:
        pad = int((cx1 - cx0) * 0.025); w, h = cx1 - cx0 - 2 * pad, cy1 - cy0 - 2 * pad
        card = np.dstack([cv2.resize(CARD, (w, h), interpolation=cv2.INTER_AREA), rounded_mask(w, h, int(w * 0.03))])
        paste(f, card, cx0 + pad, cy0 + pad, k)
    caption(f, [('KnowBack', GREEN)], t, 1330, 400, 80)
    caption(f, [('keeps it.', INK)], t, 1330, 505, 80, start=0.4)
    return f

def s4(t):  # 0:10-0:14 forgetting curve lifted by reviews (motion graphics)
    f = white(); x0, x1, y0, y1 = 260, 1660, 330, 800
    xs = np.linspace(0, 1, 400)
    forget = np.exp(-xs * 4.5)
    reviews = [0.18, 0.38, 0.62, 0.86]; lifted = np.zeros_like(xs); last, s = 0, 1.0
    for i, x in enumerate(xs):
        for r in reviews:
            if last < r <= x: last, s = r, s * 2.2
        lifted[i] = np.exp(-(x - last) * 4.5 / s)
    def pts(ys, upto):
        n = max(2, int(len(xs) * upto)); return np.int32([[x0 + (x1 - x0) * xs[i], y1 - (y1 - y0) * ys[i]] for i in range(n)])
    big = np.zeros((H * 2, W * 2, 3), np.uint8); big[:] = 250
    cv2.line(big, (x0 * 2, y1 * 2), (x1 * 2, y1 * 2), (225, 225, 225), 4, cv2.LINE_AA)
    pr = ease(t / 2.6)
    cv2.polylines(big, [pts(forget, pr) * 2], False, (200, 200, 205), 10, cv2.LINE_AA)
    cv2.polylines(big, [pts(lifted, pr) * 2], False, GREEN, 14, cv2.LINE_AA)
    for r in reviews:
        if pr * 1.0 >= r:
            pop = smooth((pr - r) / 0.05); cx, cy = x0 + (x1 - x0) * r, y1 - (y1 - y0) * 1.0
            cv2.circle(big, (int(cx * 2), int(cy * 2)), int(18 * pop) + 1, GREEN, -1, cv2.LINE_AA)
    f = cv2.resize(big, (W, H), interpolation=cv2.INTER_AREA)
    caption(f, [('Then brings it ', INK), ('back.', GREEN)], t, W / 2, 140, 92, align='center')
    return f

def s5(t):  # 0:14-0:17 flashcard review, slow push towards the buttons
    f = white(); phone(f, rec('r3-review-phone', 1.3 + t * 1.05), 1420, 540 - 30 * ease(t / 3), 1.0 + 0.06 * ease(t / 3))
    caption(f, [('Right before you ', INK), ('forget.', GREEN)], t, 150, 470, 84)
    return f

def warp_into(f, screen, quad, radius=0.02, keep_dark=True):
    """Warp an RGB screen image into a tracked quad (tl, tr, br, bl), keeping dark bezel or notch pixels."""
    h, w = screen.shape[:2]; q = np.float32(quad); q = q.mean(0) + (q - q.mean(0)) * 1.02
    hm = cv2.getPerspectiveTransform(np.float32([[0, 0], [w, 0], [w, h], [0, h]]), q)
    warped = cv2.warpPerspective(screen, hm, (W, H), flags=cv2.INTER_AREA)
    m = cv2.warpPerspective(rounded_mask(w, h, max(2, int(w * radius))), hm, (W, H)).astype(np.float32)
    if keep_dark: m *= 1 - cv2.dilate((cv2.cvtColor(f, cv2.COLOR_RGB2GRAY) < 70).astype(np.uint8), np.ones((5, 5), np.uint8))
    m = (m / 255.0)[..., None]
    return (warped * m + f * (1 - m)).astype(np.uint8)

GRAPH = rec('r4-graph-desktop', 5.0, (1920, 1200))[:, 42:1878]  # real desktop graph page, cropped to the laptop screen shape

def s6(t):  # 0:17-0:21 AI: laptop, camera orbits to the front; the screen shows the real knowledge graph
    i = min(len(S6) - 1, int((0.6 + t * 1.1) * S6_FPS)); f = cv2.resize(S6[i], (W, H), interpolation=cv2.INTER_CUBIC)
    f = warp_into(f, GRAPH, np.array(S6_TRACK[i]) * (W / S6[i].shape[1]), radius=0.005)
    caption(f, [('See how your ideas ', INK), ('connect.', GREEN)], t, W / 2, 40, 72, align='center')
    return f

def s7(t):  # 0:21-0:25 square translation, then languages
    f = white()
    a, b = rec('r5-square-phone', 1.4 + t * 1.2), rec('r6-languages-phone', 1.9 + max(0, t - 2) * 2.3)
    k = smooth((t - 1.85) / 0.3); phone(f, (a * (1 - k) + b * k).astype(np.uint8), 1420, 540)
    caption(f, [('Learn together.', INK)], t, 170, 420, 84)
    caption(f, [('In your language.', GREEN)], t, 170, 530, 84, start=1.6)
    return f

def s8(t):  # 0:25-0:27 AI: privacy shield turns to camera, caption beside it
    i = min(len(S8) - 1, int((0.9 + t) * S8_FPS)); f = cv2.resize(S8[i], (W, H), interpolation=cv2.INTER_CUBIC)
    caption(f, [('Private', INK)], t, 1420, 420, 84, start=0.6)
    caption(f, [('by default.', GREEN)], t, 1420, 530, 84, start=0.9)
    return f

def s9(t):  # 0:27-0:30 end card with the real icon
    f = white(); k = ease(t / 0.8)
    icon = cv2.cvtColor(cv2.resize(ICON, (200, 200), interpolation=cv2.INTER_AREA), cv2.COLOR_BGRA2RGBA)
    paste(f, icon, W / 2 - 100, 300 + 20 * (1 - k), k)
    caption(f, [('KnowBack', INK)], t, W / 2, 530, 104, start=0.2, align='center')
    caption(f, [('Ask it. ', INK), ('Remember it.', GREEN)], t, W / 2, 680, 56, start=0.6, align='center')
    layer = CAP.setdefault('web', text_layer([('Web  ·  Android', (130, 130, 135))], 34, bold=False))
    paste(f, layer, W / 2 - layer.shape[1] / 2, 790, ease((t - 1.0) / 0.6))
    return f

SCENES = [(s1, 3), (s2, 3), (s3, 4), (s4, 4), (s5, 3), (s6, 4), (s7, 4), (s8, 2.5), (s9, 2.5)]
FADE = 0.3

def frame_at(T):
    start = 0
    for i, (fn, d) in enumerate(SCENES):
        if T < start + d or i == len(SCENES) - 1:
            t = T - start; f = fn(t)
            if i and t < FADE:  # cross-dissolve from the previous scene, which keeps running
                pfn, pd = SCENES[i - 1]; k = smooth(t / FADE)
                f = (pfn(pd + t) * (1 - k) + f * k).astype(np.uint8)
            if i == len(SCENES) - 1: f = (f * (1 - smooth((t - d + 0.5) / 0.5)) + 255 * smooth((t - d + 0.5) / 0.5)).astype(np.uint8)
            return f
        start += d

if __name__ == '__main__':
    out = sys.argv[1] if len(sys.argv) > 1 else str(HERE / 'drafts/knowback-30s-draft.mp4')
    pathlib.Path(out).parent.mkdir(exist_ok=True)
    total = sum(d for _, d in SCENES); tmp = pathlib.Path(tempfile.gettempdir()) / 'kb-render.mp4'
    writer = imageio_ffmpeg.write_frames(str(tmp), (W, H), fps=FPS, codec='libx264', pix_fmt_out='yuv420p', macro_block_size=1, output_params=['-crf', '17', '-preset', 'slow', '-movflags', '+faststart'])
    writer.send(None)
    for n in range(int(total * FPS)):
        writer.send(np.ascontiguousarray(frame_at(n / FPS)))
        if n % 90 == 0: print(f'{n / FPS:.0f}s', flush=True)
    writer.close(); shutil.move(str(tmp), out); print('wrote', out)
