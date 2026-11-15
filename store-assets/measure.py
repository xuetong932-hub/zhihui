"""Print the box of the grey device screen that contains a given point (flood fill), for compose.py.
Usage: python measure.py <image> <x> <y> [<x> <y> ...]"""
import sys
from PIL import Image, ImageDraw

image = Image.open(sys.argv[1]).convert('RGB')
points = list(map(int, sys.argv[2:]))
for i in range(0, len(points), 2):
    x, y = points[i], points[i + 1]
    probe = image.copy()
    ImageDraw.floodfill(probe, (x, y), (255, 0, 255), thresh=30)
    px = probe.load()
    xs, ys = [], []
    for yy in range(image.height):
        for xx in range(image.width):
            if px[xx, yy] == (255, 0, 255):
                xs.append(xx); ys.append(yy)
    w, h = max(xs) - min(xs) + 1, max(ys) - min(ys) + 1
    print(f'point ({x},{y}) colour {image.getpixel((x, y))}: box x {min(xs)}-{max(xs)} y {min(ys)}-{max(ys)} size {w}x{h} aspect {w / h:.3f}')
