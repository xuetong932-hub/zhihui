"""Put a real app screenshot into the phone screen of a generated promo image.

Only the plain grey screen area is replaced (found by flood fill from the screen centre), so the notch, the rounded
corners and floating chips that overlap the screen stay on top. Like a real phone, the app starts below the status
bar: the strip under the notch is filled with the status-bar colour. Usage:
  python compose.py <promo> <screenshot> <out.png> <centre_x> <centre_y> <status_bar_px> [status_rgb_hex]
"""
import sys
from PIL import Image, ImageDraw, ImageFilter

promo_path, shot_path, out_path = sys.argv[1:4]
cx, cy, inset = int(sys.argv[4]), int(sys.argv[5]), int(sys.argv[6])
status = tuple(int((sys.argv[7] if len(sys.argv) > 7 else 'ffffff')[i:i + 2], 16) for i in (0, 2, 4))
promo = Image.open(promo_path).convert('RGB')
shot = Image.open(shot_path).convert('RGB')

probe = promo.copy()
ImageDraw.floodfill(probe, (cx, cy), (255, 0, 255), thresh=30)
mask = Image.new('L', promo.size, 0)
px, mp = probe.load(), mask.load()
xs, ys = [], []
for y in range(promo.height):
    for x in range(promo.width):
        if px[x, y] == (255, 0, 255):
            mp[x, y] = 255; xs.append(x); ys.append(y)
left, top, right, bottom = min(xs), min(ys), max(xs), max(ys)
# Grow the region by two pixels, but only over leftover screen-grey specks (never the dark notch and bezel or a
# white chip), then soften the edge into the bezel.
grown, src = mask.filter(ImageFilter.MaxFilter(5)).load(), promo.load()
for y in range(max(0, top - 3), min(promo.height, bottom + 4)):
    for x in range(max(0, left - 3), min(promo.width, right + 4)):
        if grown[x, y] and not mp[x, y]:
            r, g, b = src[x, y]
            if max(r, g, b) - min(r, g, b) < 26 and 150 < (r + g + b) / 3 < 240:
                mp[x, y] = 255
mask = mask.filter(ImageFilter.GaussianBlur(0.7))

box_w, box_h = right - left + 1, bottom - top + 1
layer = Image.new('RGB', promo.size, status)
scale = box_w / shot.width
fitted = shot.resize((box_w, round(shot.height * scale)), Image.LANCZOS)
layer.paste(fitted.crop((0, 0, box_w, box_h - inset)), (left, top + inset))
promo.paste(layer, (0, 0), mask)
promo.save(out_path, optimize=True)
print('screen box', (left, top, right, bottom), 'size', box_w, 'x', box_h, 'shot', fitted.size, '->', out_path)
