# S3 shot tracking from brightness profiles: phone screen box (inside the dark bezel) every frame, and the card box
# once it has settled facing the camera (it is an axis-aligned rectangle wider than the phone).
# Saves ai/s3-kling4.track.json: [{"screen": [x0,y0,x1,y1], "card": [x0,y0,x1,y1] | null}, ...]
import cv2, numpy as np, json, tempfile, shutil
tmp = tempfile.gettempdir() + '/kb-s3.mp4'; shutil.copy('ai/s3-kling4.mp4', tmp)
cap = cv2.VideoCapture(tmp); out = []
def first(a): i = np.flatnonzero(a); return int(i[0]) if len(i) else None
while True:
    ok, im = cap.read()
    if not ok: break
    g = cv2.GaussianBlur(cv2.cvtColor(im, cv2.COLOR_BGR2GRAY), (3, 3), 0).astype(int); H, W = g.shape
    # Phone: dark bezel pixels on the centre column and on a row near the top of the screen.
    col = g[:, W // 2]; dark = np.flatnonzero(col < 70)
    top = dark[dark < H * 0.6]; bot = dark[dark > H * 0.6]
    y0 = int(top.max()) + 1 if len(top) else 0; y1 = int(bot.min()) - 1 if len(bot) else H - 1
    row = g[y0 + 12]; dk = np.flatnonzero(row < 70)
    left, right = dk[dk < W // 2], dk[dk > W // 2]
    x0 = int(left.max()) + 1 if len(left) else 0; x1 = int(right.min()) - 1 if len(right) else W - 1
    # Card: a row through the middle of the card, edges outside the phone where it meets the white set.
    card = None
    for yc in range(250, 330, 10):
        r = g[yc]; l = first(r[:x0 - 5][::-1] > 236); rr = first(r[x1 + 5:] > 236)
        if l is not None and rr is not None and l > 25 and rr > 25:
            cx0, cx1 = x0 - 5 - l, x1 + 5 + rr; c = g[:, cx0 + 20]
            t = first(c[:yc][::-1] > 236); b = first(c[yc:] > 236)
            if t is not None and b is not None: card = [cx0, yc - t, cx1, yc + b]; break
    out.append({'screen': [x0, y0, x1, y1], 'card': card})
json.dump(out, open('ai/s3-kling4.track.json', 'w'))
for i in range(0, 121, 10): print(i, out[i])
