# Turn screencast frames (frames/<clip>/frames.json + jpgs, variable timing) into constant 30 fps MP4 in clips/.
# Each output frame shows the latest captured frame at that moment, so pauses hold and motion keeps real speed.
# Usage: python assemble.py [clip ...]
import json, sys, pathlib, shutil, tempfile, cv2, numpy as np
read = lambda path: cv2.imdecode(np.fromfile(str(path), np.uint8), cv2.IMREAD_COLOR)  # OpenCV cannot open non-ASCII paths

HERE = pathlib.Path(__file__).parent
FPS = 30
out_dir = HERE / 'clips'; out_dir.mkdir(exist_ok=True)
names = sys.argv[1:] or sorted(p.name for p in (HERE / 'frames').iterdir() if (p / 'frames.json').exists())
for name in names:
    src = HERE / 'frames' / name
    meta = json.loads((src / 'frames.json').read_text())
    frames = meta['frames']
    if not frames: print(f'{name}: no frames'); continue
    first = read(src / frames[0]['file'])
    h, w = first.shape[:2]; w -= w % 2; h -= h % 2
    t0, t1 = frames[0]['t'], max(meta['end'], frames[-1]['t'])
    tmp = pathlib.Path(tempfile.gettempdir()) / f'kb-{name}.mp4'
    writer = cv2.VideoWriter(str(tmp), cv2.VideoWriter_fourcc(*'mp4v'), FPS, (w, h))
    i, current, count = 0, first, int((t1 - t0) * FPS)
    for k in range(count):
        t = t0 + k / FPS
        while i + 1 < len(frames) and frames[i + 1]['t'] <= t:
            i += 1; current = read(src / frames[i]['file'])
        writer.write(cv2.resize(current, (w, h)) if current.shape[:2] != (h, w) else current)
    writer.release(); shutil.move(str(tmp), out_dir / f'{name}.mp4')
    print(f'{name}: {w}x{h}, {count / FPS:.1f} s, {len(frames)} source frames')
