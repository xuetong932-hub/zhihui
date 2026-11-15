# Sound for the 30-second cut: synthesized effects timed to events in render.py, mixed under the music bed
# (ai/music.mp3 if present), then muxed with the rendered video. All effects are generated here, no samples.
# Usage: python sound.py [video.mp4] [--cut 15]  -> writes <video>-sound.mp4 (default: the 30-second cut)
import subprocess, sys, pathlib, tempfile, wave
import numpy as np, imageio_ffmpeg

HERE = pathlib.Path(__file__).parent
args = [a for a in sys.argv[1:] if a not in ('--cut', '15', '30')]
CUT = 15 if '15' in sys.argv[1:] else 30
SR = 48000; DUR = float(CUT)
FF = imageio_ffmpeg.get_ffmpeg_exe()
rng = np.random.default_rng(7)
mix = np.zeros((int(SR * DUR) + SR, 2), np.float32)

def env(n, attack, release):
    t = np.arange(n) / SR; a = np.clip(t / max(attack, 1e-4), 0, 1)
    return a * np.exp(-np.maximum(t - attack, 0) / max(release, 1e-4))

def lowpass(x, cutoff):  # one-pole, cutoff may vary per sample
    c = np.broadcast_to(np.asarray(cutoff, np.float32), x.shape)
    k = 1 - np.exp(-2 * np.pi * c / SR); y = np.empty_like(x); s = 0.0
    for i in range(len(x)): s += k[i] * (x[i] - s); y[i] = s
    return y

def add(at, sig, gain=1.0, pan=0.0):
    i = int(at * SR); sig = sig[: len(mix) - i]
    l, r = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
    mix[i:i + len(sig), 0] += sig * gain * l * 1.414; mix[i:i + len(sig), 1] += sig * gain * r * 1.414

def whoosh(length=0.7, lo=300, hi=4000, peak=0.6):
    n = int(length * SR); t = np.linspace(0, 1, n)
    shape = np.sin(np.pi * np.clip(t / peak, 0, 1) * 0.5) * np.exp(-np.maximum(t - peak, 0) * 6)
    return lowpass(rng.standard_normal(n).astype(np.float32), lo + (hi - lo) * shape) * shape * 0.5

def tick(freq=3200, length=0.025):  # soft key tick
    n = int(length * SR); t = np.arange(n) / SR
    return (np.sin(2 * np.pi * freq * t) * 0.4 + rng.standard_normal(n) * 0.3) * env(n, 0.001, 0.006)

def tap(freq=900):  # UI tap: short pitched click with a body
    n = int(0.12 * SR); t = np.arange(n) / SR
    return np.sin(2 * np.pi * freq * t * (1 - 0.3 * t / 0.12)) * env(n, 0.002, 0.03) * 0.8

def bell(freq, length=1.6):  # soft glassy chime
    n = int(length * SR); t = np.arange(n) / SR
    tone = sum(a * np.sin(2 * np.pi * freq * m * t) for m, a in [(1, 1), (2.01, 0.35), (3.02, 0.12), (4.2, 0.05)])
    return tone * env(n, 0.004, length / 4) * 0.35

def pop(freq=700):
    n = int(0.09 * SR); t = np.arange(n) / SR
    return np.sin(2 * np.pi * freq * (1 + 1.5 * np.exp(-t * 60)) * t) * env(n, 0.002, 0.025) * 0.6

def swell(length=2.6):  # airy rising noise for the light sweep
    n = int(length * SR); t = np.linspace(0, 1, n)
    shape = np.sin(np.pi * t) ** 1.5
    return lowpass(rng.standard_normal(n).astype(np.float32), 600 + 5000 * t) * shape * 0.25

# ---------- events (times follow render.py's scene timing) ----------
if CUT == 30:
    add(0.3, swell(), 0.9)                                         # S1 light sweeps the edge
    for k, ch in enumerate('Why do we forget what we learn?'):      # S2 typing: r1 typed from ~1.0 s at 1.1x speed
        at = 3.0 + (k * 0.095) / 1.1 + rng.uniform(-0.01, 0.01)
        if at < 5.75: add(at, tick(2800 + rng.uniform(-300, 300)), 0.25 if ch != ' ' else 0.15, rng.uniform(-0.2, 0.2))
    add(5.85, tap(820), 0.55)                                      # send
    add(6.0, whoosh(1.1, 200, 2500, 0.5), 0.8, 0.1)                # S3 the card lifts out of the phone
    add(8.15, bell(1046.5, 1.4), 0.45, 0.15)                       # card content appears
    ease = lambda x: 4 * x ** 3 if x < 0.5 else 1 - (-2 * x + 2) ** 3 / 2
    for j, r in enumerate([0.18, 0.38, 0.62, 0.86]):               # S4 review dots lift the curve
        x = next(v / 1000 for v in range(1001) if ease(v / 1000) >= r)
        add(10 + x * 2.6, pop(620 + 120 * j), 0.6, -0.5 + j * 0.33)
    add(14.29, tap(980), 0.5)                                      # S5 Show answer
    add(16.38, tap(760), 0.55); add(16.42, bell(1318.5, 0.9), 0.25) # Got it
    add(17.0, whoosh(1.4, 150, 1800, 0.45), 0.55, -0.3)            # S6 camera orbits
    add(21.37, tap(900), 0.45)                                     # S7 Translate
    add(22.7, bell(1568, 1.2), 0.3, 0.2)                           # translation appears
    for at in (23.4, 24.1, 24.6):                                  # language switches
        add(at, tap(1100), 0.25)
    add(25.0, whoosh(0.9, 200, 2200, 0.5), 0.5, 0.2)               # S8 shield turns
    add(27.5, bell(784, 2.2), 0.35); add(27.53, bell(1174.7, 2.2), 0.22)  # end card shimmer
    for t0 in (3.0, 10.0, 14.0, 21.0):                             # soft air on the other cuts
        add(t0 - 0.25, whoosh(0.5, 400, 3000, 0.6), 0.25)

else:  # 15-second cut: ask 0, card 2.5, curve 6.0, review 9.0, end card 12.0 (render_short.py)
    for k, ch in enumerate('Why do we forget what we learn?'):
        at = max(0.0, (k * 0.095) / 1.1 + rng.uniform(-0.01, 0.01))
        if at < 2.3: add(at, tick(2800 + rng.uniform(-300, 300)), 0.25 if ch != ' ' else 0.15, rng.uniform(-0.2, 0.2))
    add(2.5, whoosh(1.1, 200, 2500, 0.5), 0.8, 0.1)
    add(4.65, bell(1046.5, 1.4), 0.45, 0.15)
    ease = lambda x: 4 * x ** 3 if x < 0.5 else 1 - (-2 * x + 2) ** 3 / 2
    for j, r in enumerate([0.18, 0.38, 0.62, 0.86]):
        x = next(v / 1000 for v in range(1001) if ease(v / 1000) >= r)
        add(6.0 + x * 2.6, pop(620 + 120 * j), 0.6, -0.5 + j * 0.33)
    add(9.29, tap(980), 0.5); add(11.38, tap(760), 0.55); add(11.42, bell(1318.5, 0.9), 0.25)
    add(12.0, bell(784, 2.2), 0.35); add(12.03, bell(1174.7, 2.2), 0.22)
    for t0 in (6.0, 9.0): add(t0 - 0.25, whoosh(0.5, 400, 3000, 0.6), 0.25)

# ---------- music bed ----------
music_path = HERE / 'ai/music.mp3'
if music_path.exists():
    raw = subprocess.run([FF, '-v', 'error', '-i', str(music_path), '-f', 'f32le', '-ac', '2', '-ar', str(SR), '-'], capture_output=True, check=True).stdout
    music = np.frombuffer(raw, np.float32).reshape(-1, 2).copy()
    if CUT == 15:  # the full section (7.5-17.5 s) crossfaded into the score's own ending (24.4-30 s)
        a, b, x = music[int(7.5 * SR):int(17.5 * SR)], music[int(24.4 * SR):int(30.0 * SR)], int(0.6 * SR)
        ramp = np.linspace(0, 1, x)[:, None]
        music = np.concatenate([a[:-x], a[-x:] * np.cos(ramp * np.pi / 2) + b[:x] * np.sin(ramp * np.pi / 2), b[x:]])
        music[:int(0.4 * SR)] *= np.linspace(0, 1, int(0.4 * SR))[:, None]  # ease in, the cut starts mid-phrase
    music = music[: int(SR * DUR)]
    n = len(music); fade = np.clip((n - np.arange(n)) / (SR * 1.2), 0, 1)[:, None]
    music *= fade * (0.8 / max(1e-6, np.abs(music).max()))
    sfx = mix[:n].copy()
    duck = np.convolve(np.abs(sfx).mean(1), np.ones(2400) / 2400, 'same')[:, None]  # gentle ducking under effects
    mix[:n] = music * (1 - np.clip(duck * 2.5, 0, 0.3)) + sfx * 0.9
out = mix[: int(SR * DUR)]
out *= 0.89 / max(1e-6, np.abs(out).max())                       # peak about -1 dBFS
wav = pathlib.Path(tempfile.gettempdir()) / 'kb-mix.wav'
with wave.open(str(wav), 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes((out * 32767).astype('<i2').tobytes())
video = pathlib.Path(args[0]) if args else HERE / 'drafts/knowback-30s-draft.mp4'
dst = video.with_name(video.stem + '-sound.mp4'); tmp = pathlib.Path(tempfile.gettempdir()) / 'kb-mux.mp4'
subprocess.run([FF, '-v', 'error', '-y', '-i', str(video), '-i', str(wav), '-c:v', 'copy', '-af', 'loudnorm=I=-14:TP=-1:LRA=11', '-ar', '48000', '-c:a', 'aac', '-b:a', '256k', '-shortest', '-movflags', '+faststart', str(tmp)], check=True)
tmp.replace(dst) if dst.drive == tmp.drive else (dst.write_bytes(tmp.read_bytes()), tmp.unlink())
print('music' if music_path.exists() else 'no music yet', '->', dst)
