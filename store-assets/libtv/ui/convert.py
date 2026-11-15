"""Turn the LibTV PNG illustrations (transparent, ~1.5K) into small WebP files for the app.

Each image is trimmed to its visible pixels, scaled to the width the UI needs (2x for sharp phones)
and saved as lossy WebP with alpha into ../../../illustrations/.
Usage: python convert.py
"""
from pathlib import Path
from PIL import Image

HERE = Path(__file__).resolve().parent
OUT = HERE.parents[2] / "illustrations"
# name -> output width in pixels
SIZES = {
    "home-hero": 880,
    "review-hero": 640,
    "done-state": 480,
    "icon-coding": 240,
    "icon-english": 240,
    "icon-work": 240,
    "icon-life": 240,
}

OUT.mkdir(exist_ok=True)
for name, width in SIZES.items():
    source = HERE / f"{name}.png"
    if not source.exists():
        print(f"missing {source.name}")
        continue
    image = Image.open(source).convert("RGBA")
    box = image.getchannel("A").point(lambda a: 255 if a > 8 else 0).getbbox()
    if box:
        pad = 8
        box = (max(0, box[0] - pad), max(0, box[1] - pad), min(image.width, box[2] + pad), min(image.height, box[3] + pad))
        image = image.crop(box)
    height = round(image.height * width / image.width)
    image = image.resize((width, height), Image.LANCZOS)
    target = OUT / f"{name}.webp"
    image.save(target, "WEBP", quality=82, method=6)
    print(f"{target.name}: {width}x{height}, {target.stat().st_size // 1024} KB")

# home-desk.webp (opaque 9:16 phone home scene) was made from home-desk-pov.png: resized to 900x1600, WebP quality 80.
