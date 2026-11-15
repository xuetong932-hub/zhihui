# Contact strip of a clip's frames for review: python strip.py <clip> <out.jpg> k1 k2 ...
import sys, cv2, numpy as np
clip, out, ks = sys.argv[1], sys.argv[2], [int(k) for k in sys.argv[3:]]
ims = [cv2.imdecode(np.fromfile(f'frames/{clip}/{k:05d}.jpg', np.uint8), 1) for k in ks]
h = 700; ims = [cv2.resize(i, (int(i.shape[1] * h / i.shape[0]), h)) for i in ims]
cv2.imencode('.jpg', np.hstack(ims))[1].tofile(out)
