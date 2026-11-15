"""Finish a generated poster: put real app screenshots into its blank device screens and the real app icon over the
generated logo, and paint out small unwanted marks.

Only the plain grey screen area is replaced (flood fill from a point inside it, limited to a clip box), so notches,
camera cut-outs, bezels and chips overlapping a screen stay on top. Like a real device, the app starts below the
status bar: the top `inset` pixels of the screen get the status-bar colour.

Usage (one JSON job file per poster):
  python poster.py job.json
job.json:
  {"input": "...png", "output": "...png",
   "screens": [{"shot": "...png", "point": [x, y], "clip": [x0, y0, x1, y1], "inset": 100}],
   "logo": {"icon": "../icon-512.png", "box": [x0, y0, x1, y1]},
   "erase": [[x0, y0, x1, y1]]}
"""
import json
import sys
from PIL import Image, ImageDraw, ImageFilter

job = json.load(open(sys.argv[1], encoding='utf-8'))
base = Image.open(job['input']).convert('RGB')


def place(image, screen):
    shot = Image.open(screen['shot']).convert('RGB')
    x0, y0, x1, y1 = screen.get('clip', [0, 0, image.width, image.height])
    probe = image.crop((x0, y0, x1, y1))
    px_point = (screen['point'][0] - x0, screen['point'][1] - y0)
    ImageDraw.floodfill(probe, px_point, (255, 0, 255), thresh=30)
    region = Image.new('L', probe.size, 0)
    pp, rp = probe.load(), region.load()
    xs, ys = [], []
    for y in range(probe.height):
        for x in range(probe.width):
            if pp[x, y] == (255, 0, 255):
                rp[x, y] = 255; xs.append(x); ys.append(y)
    left, top, right, bottom = min(xs), min(ys), max(xs), max(ys)
    # Cover leftover grey specks at the edge (never dark bezel or white chips), then soften the edge.
    src = image.crop((x0, y0, x1, y1)).load()
    grown = region.filter(ImageFilter.MaxFilter(5)).load()
    for y in range(max(0, top - 3), min(probe.height, bottom + 4)):
        for x in range(max(0, left - 3), min(probe.width, right + 4)):
            if grown[x, y] and not rp[x, y]:
                r, g, b = src[x, y]
                if max(r, g, b) - min(r, g, b) < 26 and 150 < (r + g + b) / 3 < 240:
                    rp[x, y] = 255
    region = region.filter(ImageFilter.GaussianBlur(0.7))
    box_w, box_h, inset = right - left + 1, bottom - top + 1, screen.get('inset', 0)
    fill = tuple(screen.get('status', [255, 255, 255]))
    layer = Image.new('RGB', probe.size, fill)
    fitted = shot.resize((box_w, round(shot.height * box_w / shot.width)), Image.LANCZOS)
    layer.paste(fitted.crop((0, 0, box_w, box_h - inset)), (left, top + inset))
    patch = image.crop((x0, y0, x1, y1))
    patch.paste(layer, (0, 0), region)
    image.paste(patch, (x0, y0))
    print('screen', (x0 + left, y0 + top, x0 + right, y0 + bottom), 'size', box_w, 'x', box_h, 'shot', shot.size)


def erase(image, box, feather=14):
    # box = [x0, y0, x1, y1] or [x0, y0, x1, y1, dx, dy]. With an offset, a clean patch of background from
    # (dx, dy) away is copied over the box so its texture matches; otherwise a flat colour sampled beside it.
    # The patch fades in over `feather` pixels so its edge does not show against soft shadows nearby.
    x0, y0, x1, y1 = box[:4]
    if len(box) == 6:
        dx, dy = box[4], box[5]
        patch = image.crop((x0 + dx, y0 + dy, x1 + dx, y1 + dy))
    else:
        # Sample the margin to the left of the box (posters keep it empty); fall back to the right edge.
        sample = (x0 - 6, (y0 + y1) // 2) if x0 >= 6 else (min(image.width - 1, x1 + 6), (y0 + y1) // 2)
        patch = Image.new('RGB', (x1 - x0, y1 - y0), image.getpixel(sample))
    mask = Image.new('L', patch.size, 255)
    if feather:
        mask = Image.new('L', patch.size, 0)
        ImageDraw.Draw(mask).rectangle([feather, feather, patch.width - feather, patch.height - feather], fill=255)
        mask = mask.filter(ImageFilter.GaussianBlur(feather / 2))
    image.paste(patch, (x0, y0), mask)


for box in job.get('erase', []):
    erase(base, box)
for screen in job.get('screens', []):
    place(base, screen)
if 'wordmark' in job:
    # Replace a garbled generated "icon + KnowBack" with the real one cropped from the app header. White becomes
    # transparent so it sits on the poster's own background.
    spec = job['wordmark']
    erase(base, spec['erase'], feather=spec.get('feather', 18))
    mark = Image.open(spec['from']).convert('RGB').crop(spec['crop'])
    alpha = mark.convert('L').point(lambda v: 0 if v > 245 else min(255, (255 - v) * 4))
    scale = spec['height'] / mark.height
    mark = mark.resize((round(mark.width * scale), spec['height']), Image.LANCZOS)
    alpha = alpha.resize(mark.size, Image.LANCZOS)
    rgba = mark.convert('RGBA'); rgba.putalpha(alpha)
    base.paste(rgba, tuple(spec['at']), rgba)
if 'logo' in job:
    x0, y0, x1, y1 = job['logo']['box']
    icon = Image.open(job['logo']['icon']).convert('RGBA').resize((x1 - x0, y1 - y0), Image.LANCZOS)
    erase(base, [x0, y0, x1, y1], feather=0)
    base.paste(icon, (x0, y0), icon)
base.save(job['output'], optimize=True)
print('saved', job['output'])
