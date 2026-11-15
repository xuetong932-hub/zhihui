# 15-second cut (ask -> card -> brought back -> review -> end card), 16:9 and 9:16, reusing the 30-second scenes.
# Scene starts: 0 ask, 2.5 card, 6.0 curve, 9.0 review, 12.0 end card (sound.py --cut 15 uses the same timing).
# Usage: python render_short.py
import pathlib, tempfile, shutil
import numpy as np, imageio_ffmpeg
import render as r
import render_v as v   # importing this turns off the 16:9 captions, so 16:9 scenes get theirs switched back on below

CUTS = {
    'knowback-15s': ((1920, 1080), [(r.s2, 2.5), (r.s3, 3.5), (r.s4, 3), (r.s5, 3), (r.s9, 3)], True),
    'knowback-15s-vertical': ((1080, 1920), [(v.v2, 2.5), (v.v3, 3.5), (v.v4, 3), (v.v5, 3), (v.v9, 3)], False),
}
FADE = 0.3

def frame_at(scenes, T):
    start = 0
    for i, (fn, d) in enumerate(scenes):
        if T < start + d or i == len(scenes) - 1:
            t = T - start; f = fn(t)
            if i and t < FADE:
                pfn, pd = scenes[i - 1]; k = r.smooth(t / FADE); f = (pfn(pd + t) * (1 - k) + f * k).astype(np.uint8)
            if i == 0 and t < 0.4: f = (f * r.smooth(t / 0.4) + 250 * (1 - r.smooth(t / 0.4))).astype(np.uint8)  # open from white
            return f
        start += d

for name, ((w, h), scenes, captions) in CUTS.items():
    r.CAPTIONS = captions
    tmp = pathlib.Path(tempfile.gettempdir()) / f'kb-{name}.mp4'
    writer = imageio_ffmpeg.write_frames(str(tmp), (w, h), fps=30, codec='libx264', pix_fmt_out='yuv420p', macro_block_size=1, output_params=['-crf', '17', '-preset', 'slow', '-movflags', '+faststart'])
    writer.send(None)
    for n in range(int(sum(d for _, d in scenes) * 30)): writer.send(np.ascontiguousarray(frame_at(scenes, n / 30)))
    writer.close(); shutil.move(str(tmp), r.HERE / f'drafts/{name}.mp4'); print('wrote', name)
