"""Menuet des bois · musique d'ambiance de la console (boucle ~24 s).

Menuet en Sol majeur, 3/4, ~120 bpm, structure AABB 16 mesures.
Voix : clavecin doux (mélodie), basse pincée (pulse 3/4), oiseaux discrets.
Rendu stéréo avec réflexions précoces, boucle sans couture (queue enroulée),
sortie OGG via ffmpeg : public/ambience/menuet-des-bois.ogg
"""
import numpy as np
import subprocess
import wave
from pathlib import Path

SR = 44100
BPM = 120.0
BEAT = 60.0 / BPM          # 0.5 s
BAR = 3 * BEAT             # 1.5 s
NBARS = 16
LOOP = NBARS * BAR         # 24 s
OUT = Path('/home/z/my-project/public/ambience')
OUT.mkdir(parents=True, exist_ok=True)


def midi(f: float) -> float:
    return 440.0 * 2 ** ((f - 69) / 12)


def pluck(freq: float, dur: float, vel: float, tau: float, wood: float = 0.0) -> np.ndarray:
    n = int(SR * dur)
    t = np.arange(n) / SR
    x = np.zeros(n)
    partials = [(1, 1.0), (2, 0.42), (3, 0.20), (4 + wood, 0.07)]
    for mult, g in partials:
        x += g * np.sin(2 * np.pi * freq * mult * t)
        x += g * 0.35 * np.sin(2 * np.pi * freq * mult * 1.0013 * t)
    x *= np.exp(-t / tau)
    k = max(1, int(0.004 * SR))
    ramp = np.ones(n)
    ramp[:k] = np.linspace(0, 1, k)
    x *= ramp
    noise = np.random.default_rng(int(freq)).normal(0, 1, n)
    x += 0.06 * noise * np.exp(-t / 0.006)
    return x * vel


def chirp(t0: float, base: float) -> list:
    return [(t0, base), (t0 + 0.09, base + 0.4), (t0 + 0.16, base - 0.2)]


MELODY = {
    1: [(74, 2), (67, 1)], 2: [(69, 2), (62, 1)], 3: [(71, 1), (72, 1), (69, 1)], 4: [(67, 3)],
    5: [(76, 2), (74, 1)], 6: [(72, 2), (71, 1)], 7: [(69, 1), (71, 1), (72, 1)], 8: [(74, 3)],
    9: [(79, 2), (76, 1)], 10: [(78, 2), (74, 1)], 11: [(76, 1), (74, 1), (71, 1)], 12: [(72, 3)],
    13: [(69, 1), (71, 1), (72, 1)], 14: [(74, 1), (71, 1), (67, 1)],
    15: [(69, 1), (74, 1), (71, 1)], 16: [(67, 3)],
}
BASS_ROOT = {1: 43, 2: 50, 3: 43, 4: 43, 5: 48, 6: 43, 7: 50, 8: 43,
             9: 43, 10: 50, 11: 52, 12: 48, 13: 50, 14: 43, 15: 50, 16: 43}
BIRDS = chirp(4 * BAR + BEAT * 2.4, 1568) + chirp(12 * BAR + BEAT * 0.6, 1397) \
    + chirp(15 * BAR + BEAT * 1.2, 1760)

events = []
for bar, notes in MELODY.items():
    t0 = (bar - 1) * BAR
    b = 0.0
    for note, beats in notes:
        events.append((t0 + b * BEAT, midi(note), beats * BEAT + 0.9, 0.34, 0.42, 0.05))
        b += beats
    root = BASS_ROOT[bar]
    events.append((t0, midi(root - 12), BEAT + 0.6, 0.20, 0.85, 0.0))
    events.append((t0 + 2 * BEAT, midi(root), BEAT + 0.4, 0.12, 0.5, 0.0))
    if bar % 4 == 2:
        events.append((t0 + BEAT, midi(root + 7), BEAT + 0.3, 0.09, 0.4, 0.0))
for t0, f in BIRDS:
    events.append((t0, f, 0.16, 0.05, 0.05, 0.6))

buf_len = int(SR * (LOOP + 2.0))
L = np.zeros(buf_len)
R = np.zeros(buf_len)
for t0, f, dur, vel, tau, wood in events:
    s = pluck(f, dur, vel, tau, wood)
    i0 = int(t0 * SR)
    i1 = min(i0 + len(s), buf_len)
    panR = 0.62 if f > 300 else 0.38
    L[i0:i1] += s[: i1 - i0] * (1 - panR)
    R[i0:i1] += s[: i1 - i0] * panR


def early_ref(x: np.ndarray, ms: float, g: float) -> np.ndarray:
    d = int(SR * ms / 1000)
    y = np.zeros(len(x) + d)
    y[: len(x)] += x
    y[d:] += x * g
    return y


L = early_ref(L, 97, 0.16)
R = early_ref(R, 97, 0.16)
L = early_ref(L, 171, 0.09)
R = early_ref(R, 171, 0.09)

n_loop = int(SR * LOOP)
Lloop = np.zeros(n_loop + int(SR * 2.0))
Rloop = np.zeros(n_loop + int(SR * 2.0))
Lloop[: len(L)] = L[: len(Lloop)]
Rloop[: len(R)] = R[: len(Rloop)]
Lw = Lloop[:n_loop].copy()
Rw = Rloop[:n_loop].copy()
tail_L = Lloop[n_loop: n_loop + int(SR * 2.0)]
tail_R = Rloop[n_loop: n_loop + int(SR * 2.0)]
Lw[: len(tail_L)] += tail_L
Rw[: len(tail_R)] += tail_R

fade = int(0.02 * SR)
Lw[:fade] *= np.linspace(0, 1, fade)
Rw[:fade] *= np.linspace(0, 1, fade)
peak = max(np.max(np.abs(Lw)), np.max(np.abs(Rw)))
Lw = Lw / peak * 0.5
Rw = Rw / peak * 0.5
stereo = np.stack([Lw, Rw], axis=1)
pcm = (np.clip(stereo, -1, 1) * 32767).astype('<i2')

wav_path = OUT / 'menuet-des-bois.wav'
with wave.open(str(wav_path), 'wb') as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(pcm.tobytes())

ogg_path = OUT / 'menuet-des-bois.ogg'
subprocess.run([
    'ffmpeg', '-y', '-i', str(wav_path), '-c:a', 'libvorbis', '-q:a', '4',
    str(ogg_path),
], check=True, capture_output=True)
wav_path.unlink()
print(f'OK -> {ogg_path}  ({LOOP:.1f}s boucle, {ogg_path.stat().st_size//1024} Ko)')
