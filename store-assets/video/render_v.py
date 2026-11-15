# Vertical 9:16 cut (1080x1920, 30 fps) of the same 30-second film, same timing as render.py so the same sound mix fits.
# Phone scenes are redrawn natively upright; AI scenes reuse the 16:9 composite (captions off), take a square around
# the subject and extend its backdrop above and below. Usage: python render_v.py [out.mp4]
import sys, pathlib, tempfile, shutil
import numpy as np, cv2, imageio_ffmpeg
import render as r

r.CAPTIONS = False
VW, VH, FPS = 1080, 1920, 30
INK, GREEN = r.INK, r.GREEN
ease, smooth = r.ease, r.smooth
CAP = {}

def cap(f, parts, t, y, size=88, start=0.25, x=None):
    """Centred super that fades in and rises, like the 16:9 cut."""
    layer = CAP.setdefault((tuple(parts), size), r.text_layer(parts, size))
    k = ease((t - start) / 0.6)
    r.paste(f, layer, (VW - layer.shape[1]) / 2 if x is None else x, y + 24 * (1 - k), k)

def extend(square, top=420):
    """Place a 1080x1080 square in the tall frame; above and below continue its edge colours, softly blurred."""
    f = np.empty((VH, VW, 3), np.uint8); bottom = VH - top - VW
    edge = lambda rows: np.median(rows.reshape(-1, 3), 0)[None, None, :]  # one backdrop colour, no streaks
    f[:top] = np.clip(edge(square[:24]), 0, 255).astype(np.uint8); f[top + VW:] = np.clip(edge(square[-24:]), 0, 255).astype(np.uint8)
    f[top:top + VW] = square
    for y0, rows, sgn in ((top, square[:160], 1), (top + VW, square[-160:], -1)):  # feather the seams
        band = 160; ramp = np.linspace(0, 1, band)[:, None, None]
        if sgn > 0: f[y0:y0 + band] = (f[y0 - 1] * (1 - ramp) + rows * ramp).astype(np.uint8)
        else: f[y0 - band:y0] = (rows * (1 - ramp) + f[y0] * ramp).astype(np.uint8)
    return f

def square_of(frame16, cx, size=1080, cy=540):
    """Square around the subject, scaled to 1080 (a smaller size zooms in)."""
    x0 = int(np.clip(cx - size / 2, 0, 1920 - size)); y0 = int(np.clip(cy - size / 2, 0, 1080 - size))
    sq = frame16[y0:y0 + size, x0:x0 + size]
    return sq if size == 1080 else cv2.resize(sq, (1080, 1080), interpolation=cv2.INTER_CUBIC)

def white(): return np.full((VH, VW, 3), 250, np.uint8)

def v1(t):  # light sweep across an upright crop of the still
    z = 1 + 0.05 * t / 3; h, w = r.S1.shape[:2]; ch = int(h / z); cw = int(ch * VW / VH)
    crop = r.S1[(h - ch) // 2:(h + ch) // 2, (w - cw) // 2:(w + cw) // 2]
    f = cv2.resize(crop, (VW, VH), interpolation=cv2.INTER_AREA).astype(np.float32)
    xs = np.linspace(0, 1, VW)[None, :, None]; p = -0.2 + 1.5 * ease(t / 2.6)
    light = np.clip((p - xs) / 0.35, 0, 1) * 0.85 + 0.15; glint = np.exp(-((xs - p) / 0.06) ** 2) * 0.6
    f = f * light + glint * f.mean(axis=2, keepdims=True) * 1.5
    return np.clip(f * smooth(t / 0.6), 0, 255).astype(np.uint8)
def v2(t):
    f = extend(square_of(r.s2(t), 930, 1000, 540)); cap(f, [('You ask.', INK)], t, 190, 104); return f
def v3(t):
    f = extend(square_of(r.s3(t), 948, 960, 500)); cap(f, [('KnowBack', GREEN)], t, 150, 100); cap(f, [('keeps it.', INK)], t, 270, 100, 0.4); return f
def v4(t):
    f = white(); band = cv2.resize(r.s4(t)[230:1000], (VW, 433), interpolation=cv2.INTER_AREA); f[760:1193] = band
    cap(f, [('Then brings', INK)], t, 380, 100); cap(f, [('it ', INK), ('back.', GREEN)], t, 500, 100, 0.3); return f
def v5(t):
    f = white(); r.phone(f, r.rec('r3-review-phone', 1.3 + t * 1.05, (520, 1124)), 540, 1180 - 20 * ease(t / 3), 1.0 + 0.04 * ease(t / 3))
    cap(f, [('Right before', INK)], t, 140, 92); cap(f, [('you ', INK), ('forget.', GREEN)], t, 250, 92, 0.3); return f
def v6(t):
    f = extend(square_of(r.s6(t), 950)); cap(f, [('See how your', INK)], t, 150, 92); cap(f, [('ideas ', INK), ('connect.', GREEN)], t, 260, 92, 0.3); return f
def v7(t):
    f = white()
    a, b = r.rec('r5-square-phone', 1.4 + t * 1.2, (520, 1124)), r.rec('r6-languages-phone', 1.9 + max(0, t - 2) * 2.3, (520, 1124))
    k = smooth((t - 1.85) / 0.3); r.phone(f, (a * (1 - k) + b * k).astype(np.uint8), 540, 1180)
    cap(f, [('Learn together.', INK)], t, 140, 92); cap(f, [('In your language.', GREEN)], t, 250, 92, 1.6); return f
def v8(t):
    f = extend(square_of(r.s8(t), 960)); cap(f, [('Private', INK)], t, 160, 104, 0.6); cap(f, [('by default.', GREEN)], t, 285, 104, 0.9); return f
def v9(t):
    f = white(); k = ease(t / 0.8)
    icon = cv2.cvtColor(cv2.resize(r.ICON, (240, 240), interpolation=cv2.INTER_AREA), cv2.COLOR_BGRA2RGBA)
    r.paste(f, icon, VW / 2 - 120, 620 + 20 * (1 - k), k)
    cap(f, [('KnowBack', INK)], t, 900, 120, 0.2); cap(f, [('Ask it. ', INK), ('Remember it.', GREEN)], t, 1080, 64, 0.6)
    layer = CAP.setdefault('web', r.text_layer([('Web  ·  Android', (130, 130, 135))], 40, bold=False))
    r.paste(f, layer, (VW - layer.shape[1]) / 2, 1200, ease((t - 1.0) / 0.6)); return f

SCENES = [(v1, 3), (v2, 3), (v3, 4), (v4, 4), (v5, 3), (v6, 4), (v7, 4), (v8, 2.5), (v9, 2.5)]
FADE = 0.3

def frame_at(T):
    start = 0
    for i, (fn, d) in enumerate(SCENES):
        if T < start + d or i == len(SCENES) - 1:
            t = T - start; f = fn(t)
            if i and t < FADE:
                pfn, pd = SCENES[i - 1]; k = smooth(t / FADE); f = (pfn(pd + t) * (1 - k) + f * k).astype(np.uint8)
            return f
        start += d

if __name__ == '__main__':
    out = sys.argv[1] if len(sys.argv) > 1 else str(r.HERE / 'drafts/knowback-30s-vertical.mp4')
    total = sum(d for _, d in SCENES); tmp = pathlib.Path(tempfile.gettempdir()) / 'kb-render-v.mp4'
    w = imageio_ffmpeg.write_frames(str(tmp), (VW, VH), fps=FPS, codec='libx264', pix_fmt_out='yuv420p', macro_block_size=1, output_params=['-crf', '17', '-preset', 'slow', '-movflags', '+faststart'])
    w.send(None)
    for n in range(int(total * FPS)):
        w.send(np.ascontiguousarray(frame_at(n / FPS)))
        if n % 150 == 0: print(f'{n / FPS:.0f}s', flush=True)
    w.close(); shutil.move(str(tmp), out); print('wrote', out)
