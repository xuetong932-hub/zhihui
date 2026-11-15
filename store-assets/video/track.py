# Find the phone screen (flat grey quad) in each frame of an AI clip; saves corners to <clip>.track.json.
import cv2, numpy as np, json, sys, tempfile, shutil
src = sys.argv[1]; tmp = tempfile.gettempdir() + '/kb-track.mp4'; shutil.copy(src, tmp)
cap = cv2.VideoCapture(tmp); quads = []
while True:
    ok, im = cap.read()
    if not ok: break
    h, w = im.shape[:2]
    g = cv2.cvtColor(im, cv2.COLOR_BGR2GRAY)
    # The dark bezel is a closed ring: fill it to get the phone, and the screen is the phone minus the dark pixels.
    dark = (g < 75).astype(np.uint8)
    n, lab, stats, _ = cv2.connectedComponentsWithStats(dark)
    ring = max(range(1, n), key=lambda i: stats[i, 4] if stats[i, 1] < h * 0.6 and stats[i, 3] > h * 0.25 else 0)
    body = np.zeros_like(dark); cs = cv2.findContours((lab == ring).astype(np.uint8), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)[0]
    cv2.drawContours(body, cs, -1, 1, -1)
    inner = cv2.erode(body * (1 - cv2.dilate(dark, np.ones((3, 3), np.uint8))), np.ones((3, 3), np.uint8))
    cnt = max(cv2.findContours(inner, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)[0], key=cv2.contourArea)
    hull = cv2.convexHull(cnt).reshape(-1, 2).astype(float)
    # Corners: extreme points along the diagonals (rounded corners make polygon fitting unstable).
    s, d = hull.sum(1), hull[:, 0] - hull[:, 1]
    quad = [hull[s.argmin()], hull[d.argmax()], hull[s.argmax()], hull[d.argmin()]]  # tl, tr, br, bl
    quads.append([[round(x, 1), round(y, 1)] for x, y in quad])
json.dump(quads, open(src.replace('.mp4', '.track.json'), 'w'))
# Smooth over time to remove jitter.
q = np.array(quads); k = 5
sm = np.array([q[max(0, i - k):i + k + 1].mean(0) for i in range(len(q))])
json.dump(sm.round(1).tolist(), open(src.replace('.mp4', '.track.json'), 'w'))
print(len(quads), 'frames; first', sm[0].round().tolist(), 'last', sm[-1].round().tolist())
