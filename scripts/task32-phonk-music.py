# « Phonk du Sahel » — musique PHONK procédurale (Task 32)
# Remplace « Odyssée du Sahel » : la salle veut du phonk pour la présentation.
# Ingrédients phonk authentiques (drift/memphis instrumental, synthèse pure) :
#   • cowbell 808 (2 oscillateurs carrés ~540/800 Hz + bandpass) jouant le riff
#     emblématique en ré mineur — LA signature phonk
#   • 808 sub saturé (tanh) avec pitch-glide descendant, D1/D2/Bb1/C2
#   • batterie half-time 140 BPM : kick 1 & 2.5, snare+clap sur 3, hats 16ths
#     avec rolls triplets — le pompé drift phonk
#   • nappe sombre (2 saws détunés + lowpass) Am→Bb→C→D
#   • crackle vinyle + hiss (ambiance memphis lo-fi), risers de section
#   • sidechain (pompé) sur la nappe/cowbell à chaque kick
# Bouclable ~161 s, memphis-mix lowpass 11 kHz, soft-clip, normalisation.
import numpy as np
from scipy.signal import butter, sosfilt, fftconvolve
from scipy.io import wavfile

SR = 44100
BPM = 140.0
BEAT = 60.0 / BPM          # 0.4286 s
BAR = 4 * BEAT             # 1.7143 s
NBARS = 94
TAIL = 3.0
DUR = NBARS * BAR + TAIL   # ~164 s
N = int(DUR * SR)
rng = np.random.default_rng(32)

L = np.zeros(N); R = np.zeros(N)

NOTE = {
    'D1': 36.71, 'D2': 73.42, 'F2': 87.31, 'G2': 98.00,
    'A2': 110.00, 'Bb1': 58.27, 'Bb2': 116.54, 'C2': 65.41, 'C3': 130.81,
    'D3': 146.83, 'F3': 174.61, 'G3': 196.00, 'A3': 220.00, 'Bb3': 233.08,
    'C4': 261.63, 'D4': 293.66, 'E4': 329.63, 'F4': 349.23, 'G4': 392.00,
    'A4': 440.00, 'Bb4': 466.16, 'C5': 523.25, 'D5': 587.33, 'E5': 659.26,
    'F5': 698.46, 'G5': 783.99, 'A5': 880.00,
}

def bt(bar, beat=0.0):
    return bar * BAR + beat * BEAT

def place(sig, t, gain=1.0, pan=0.0):
    i0 = int(t * SR)
    if i0 >= N: return
    i1 = min(N, i0 + len(sig))
    if i1 <= i0: return
    seg = sig[: i1 - i0] * gain
    th = (pan + 1) * np.pi / 4
    L[i0:i1] += seg * np.cos(th)
    R[i0:i1] += seg * np.sin(th)

def env_ad(n, a=0.004, d=0.25, curve=3.0):
    a_n = max(1, int(a * SR))
    d_n = max(1, n - a_n)
    att = np.linspace(0, 1, a_n, endpoint=False)
    dec = np.exp(-np.linspace(0, curve, d_n))
    return np.concatenate([att, dec])

def lp(freq, order=2):
    return butter(order, freq, 'low', fs=SR, output='sos')

def bp(lo, hi, order=2):
    return butter(order, [lo, hi], 'bandpass', fs=SR, output='sos')

def hp(freq, order=2):
    return butter(order, freq, 'high', fs=SR, output='sos')

# ── cowbell 808 : le son emblématique ────────────────────────────────
SOS_COW_BP = bp(700, 4200, 2)
def cowbell(f_lo=540.0, f_hi=800.0, dur=0.28, hard=1.0):
    n = int(dur * SR)
    t = np.arange(n) / SR
    sig = np.sign(np.sin(2*np.pi*f_lo*t)) * 0.6 + np.sign(np.sin(2*np.pi*f_hi*t)) * 0.4
    e = env_ad(n, a=0.002, d=dur, curve=6.0)
    sig = sosfilt(SOS_COW_BP, sig * e)
    # attaque métallique (clic)
    click = rng.standard_normal(int(0.004*SR)) * 0.5
    sig[:len(click)] += sosfilt(bp(2000, 6000, 2), click)
    return np.tanh(sig * 2.2 * hard) * 0.72

# ── 808 sub saturé avec pitch-glide ─────────────────────────────────
def sub808(freq, dur=0.55, glide_from=1.9, hard=1.0):
    n = int(dur * SR)
    t = np.arange(n) / SR
    f = freq * (1 + (glide_from - 1) * np.exp(-t / 0.045))
    ph = 2 * np.pi * np.cumsum(f) / SR
    sig = np.sin(ph) + 0.28 * np.sin(2*ph) + 0.12 * np.sin(3*ph)
    e = env_ad(n, a=0.003, d=dur, curve=3.2)
    sig = np.tanh(sig * 2.4 * hard) * e
    return sosfilt(lp(320), sig) * 0.9

# ── kick (thump court au-dessus du 808) ─────────────────────────────
def kick808(hard=1.0):
    n = int(0.16 * SR)
    t = np.arange(n) / SR
    f = 52 * (1 + 1.6 * np.exp(-t / 0.018))
    ph = 2 * np.pi * np.cumsum(f) / SR
    sig = np.sin(ph) * env_ad(n, a=0.001, d=0.16, curve=7.0)
    return np.tanh(sig * 3.0 * hard) * 0.95

# ── snare + clap memphis ─────────────────────────────────────────────
SOS_SN_BP = bp(150, 3200, 2)
def snare():
    n = int(0.18 * SR)
    noise = rng.standard_normal(n)
    noise = sosfilt(SOS_SN_BP, noise) * env_ad(n, a=0.001, d=0.18, curve=5.5)
    tone = np.sin(2*np.pi*185*np.arange(n)/SR) * env_ad(n, a=0.001, d=0.08, curve=6.0) * 0.5
    return np.tanh((noise + tone) * 1.8) * 0.7

def clap():
    n = int(0.25 * SR)
    out = np.zeros(n)
    for k, off in enumerate([0, 0.012, 0.024]):
        m = rng.standard_normal(n)
        m = sosfilt(bp(900, 3800, 2), m)
        g = env_ad(n, a=0.001, d=0.16 - k*0.03, curve=6.5)
        out += m * g * (1.0 - k*0.25)
    return out * 0.42

# ── hi-hats ──────────────────────────────────────────────────────────
SOS_HAT = bp(7500, 15000, 2)
def hat(open_=False):
    dur = 0.16 if open_ else 0.045
    n = int(dur * SR)
    m = rng.standard_normal(n)
    return sosfilt(SOS_HAT, m) * env_ad(n, a=0.0005, d=dur, curve=(4.0 if open_ else 8.0)) * 0.66

# ── nappe sombre ─────────────────────────────────────────────────────
def pad(freqs, dur, gain=1.0):
    n = int(dur * SR)
    t = np.arange(n) / SR
    sig = np.zeros(n)
    for i, f in enumerate(freqs):
        for det in (-0.006, 0.0, 0.007):
            ph = 2*np.pi*f*(1+det)*t + rng.uniform(0, 2*np.pi)
            sig += np.sin(ph + 0.4*np.sin(2*np.pi*0.13*t))
    sig /= (len(freqs) * 3)
    a_n = int(min(0.35, dur*0.3)*SR); r_n = int(min(0.6, dur*0.4)*SR)
    e = np.ones(n)
    e[:a_n] = np.linspace(0, 1, a_n)**1.5
    e[-r_n:] = np.linspace(1, 0, r_n)**1.5
    sig = sosfilt(lp(1050), sig * e)
    return sig * 0.5 * gain

# ── riser de section ──────────────────────────────────────────────────
def riser(dur=2.0):
    n = int(dur * SR)
    m = rng.standard_normal(n)
    m = sosfilt(bp(300, 6000, 2), m)
    e = np.linspace(0, 1, n) ** 2.2
    return m * e * 0.30

# ── crackle vinyle ────────────────────────────────────────────────────
def make_crackle(dur):
    n = int(dur * SR)
    floor = sosfilt(bp(2000, 8000, 1), rng.standard_normal(n)) * 0.012
    pops = np.zeros(n)
    n_pops = int(dur * 9)
    idx = rng.integers(0, n - 100, n_pops)
    amps = rng.uniform(0.02, 0.09, n_pops)
    for i, a in zip(idx, amps):
        ln = int(rng.uniform(20, 90))
        pops[i:i+ln] += rng.standard_normal(ln) * a * np.exp(-np.linspace(0, 5, ln))
    return sosfilt(lp(7500), floor + pops)

# ══════════════════════════════════════════════════════════════════════
# ARRANGEMENT — 94 mesures, ré mineur, riff cowbell 2 mesures
# progression sub : D · D · Bb · C  (i · i · VI · VII)
# riff cowbell (16ths par mesure, '.' = silence) :
MEL = [  # [bar%2, beat, note, dur_beats, gain]
    (0, 0.0, 'D5', 0.5, 1.00), (0, 0.75, 'F5', 0.25, 0.85), (0, 1.5, 'A5', 0.5, 0.95),
    (0, 2.25, 'G5', 0.25, 0.85), (0, 2.5, 'F5', 0.5, 0.9), (0, 3.5, 'E5', 0.5, 0.8),
    (1, 0.0, 'D5', 0.75, 1.00), (1, 1.0, 'C5', 0.5, 0.85), (1, 1.75, 'D5', 0.75, 0.95),
    (1, 3.0, 'F5', 0.5, 0.85), (1, 3.5, 'E5', 0.5, 0.8),
]
SUB_ROOTS = ['D1', 'D1', 'Bb1', 'C2']

# sections : (bar_debut, nb_mesures, intensité 0..1, drums, hats_denses, nappe, octave_cow)
SECTIONS = [
    (0,  4,  0.30, False, False, True,  False),   # intro : crackle + nappe + cowbell teaser
    (4,  20, 0.55, True,  False, True,  False),   # verse A : drums half-time
    (24, 4,  0.35, False, False, True,  False),   # break 1
    (28, 20, 0.75, True,  True,  True,  False),   # verse B : hats denses
    (48, 4,  0.40, False, False, True,  False),   # break 2
    (52, 24, 1.00, True,  True,  True,  True),    # climax : cowbell doublé octave
    (76, 12, 0.60, True,  False, True,  False),   # descente
    (88, 6,  0.25, False, False, True,  False),   # outro
]

def section_at(bar):
    for (b0, n, *rest) in SECTIONS:
        if b0 <= bar < b0 + n:
            return rest
    return (0.25, False, False, True, False)

# ── sidechain : dips aux kicks ───────────────────────────────────────
duck = np.ones(N)
def duck_at(t):
    i0 = int(t * SR); n = int(0.16 * SR)
    if i0 >= N: return
    i1 = min(N, i0 + n)
    seg = 1 - 0.42 * np.exp(-np.linspace(0, 6, i1 - i0))
    duck[i0:i1] = np.minimum(duck[i0:i1], seg)

# nappe : progression Am→Bb→C→Dm (voisés graves) sur toute la durée
PAD_CHORDS = [
    ['A2', 'C3', 'E4'], ['Bb2', 'D3', 'F4'], ['C3', 'G3', 'C4'], ['D3', 'A3', 'D4'],
]
for p0 in range(0, NBARS - 7, 8):
    for k in range(8):
        bar = p0 + k
        inten = section_at(bar)[0]
        freqs = [NOTE[x] for x in PAD_CHORDS[(bar // 2) % 4]]
        sig = pad(freqs, BAR * 2 + 0.3, gain=0.5 + 0.5 * inten)
        place(sig * 0.9, bt(bar), gain=1.0, pan=-0.18)
        place(sig, bt(bar), gain=0.55, pan=0.35)

# drums + sub + cowbell, mesure par mesure
for bar in range(NBARS):
    inten, drums, hats_dense, _, cow_oct = section_at(bar)
    t_bar = bt(bar)

    # kick : 1, 2.5 (+ pickup 3.75 au climax)
    kicks = [0.0, 2.5] if drums else []
    if drums and inten >= 1.0:
        kicks.append(3.75)
    for kb in kicks:
        place(kick808(hard=inten), t_bar + kb * BEAT, gain=0.95, pan=0.0)
        duck_at(t_bar + kb * BEAT)

    # snare + clap : beat 3 (half-time)
    if drums:
        place(snare(), t_bar + 2.0 * BEAT, gain=0.8, pan=0.08)
        place(clap(), t_bar + 2.0 * BEAT, gain=0.9, pan=-0.2)

    # 808 sub : suit la progression, long à 1, court au « & » de 2
    if drums:
        root = SUB_ROOTS[(bar // 2) % 4]
        place(sub808(NOTE[root], dur=0.62, hard=1.0), t_bar + 0.0 * BEAT, gain=1.0)
        if inten >= 0.55:
            place(sub808(NOTE[root] * 2, dur=0.30, hard=0.9), t_bar + 1.75 * BEAT, gain=0.8)

    # hats : 8ths de base, 16ths + rolls dans les passages denses
    if drums:
        step = 0.5 if not hats_dense else 0.25
        b = 0.0
        while b < 4.0:
            open_ = (hats_dense and abs(b - 3.5) < 1e-9)
            g = 0.55 if (b % 1.0 == 0.0) else 0.35
            place(hat(open_), t_bar + b * BEAT, gain=g * (0.5 + 0.5 * inten), pan=0.12)
            b += step
        if hats_dense and bar % 2 == 1:  # roll triplet sur la fin
            for k in range(3):
                tt = t_bar + (3.0 + k * 0.25) * BEAT
                place(hat(), tt, gain=0.3 + 0.1 * k, pan=-0.1)

    # riff cowbell (1 passe sur les 2 mesures impaires au télescopage intro)
    if cow_oct or inten >= 0.5:
        for (mb, beat, note, durb, g) in MEL:
            if bar % 2 != mb:
                continue
            if not drums and inten < 0.45 and (bar % 4) >= 2:
                continue  # teaser : le riff ne joue que par fragments aux intros
            sig = cowbell(NOTE[note], dur=durb * BEAT + 0.12, hard=0.8 + 0.4 * inten)
            place(sig, t_bar + beat * BEAT, gain=g * (0.5 + 0.5 * inten), pan=-0.06)
            if cow_oct:  # climax : doublé à l'octave inférieure (wider)
                sig2 = cowbell(NOTE[note] / 2, dur=durb * BEAT + 0.10, hard=0.9)
                place(sig2, t_bar + beat * BEAT, gain=0.42, pan=0.3)

# risers avant verse B (bar 28) et climax (bar 52)
for bar_riser in (28, 52):
    place(riser(2 * BEAT * 2), bt(bar_riser) - 2 * BEAT * 2, gain=0.8, pan=0.0)

# crackle vinyle en continu (memphis lo-fi)
crk = make_crackle(DUR)
place(crk, 0, gain=0.85, pan=0.0)

# ── sidechain appliqué aux pistes « pompées » ─────────────────────────
# (on reconstruit léger : la nappe et le cowbell partagent la même
#  enveloppe de duck — pour rester simple, on l'applique globalement au
#  master bus avec une profondeur modérée, fidèle au mix phonk)
duck_env = 1 - 0.30 * (1 - duck)
L *= duck_env; R *= duck_env

# ── mix memphis : lowpass global lo-fi + léger boost sub ─────────────
L = sosfilt(lp(11000), L)
R = sosfilt(lp(11000), R)
sub_boost = sosfilt(lp(120), L + R) * 0.22
L += sub_boost; R += sub_boost

# ── reverb courte sombre (pièce) ──────────────────────────────────────
def make_ir(seed, decay=1.9, dur=0.55):
    n = int(dur * SR)
    r = np.random.default_rng(seed)
    ir = r.standard_normal(n) * np.exp(-np.linspace(0, decay * 4, n))
    ir[0] = 0
    return ir / np.sqrt(np.sum(ir**2) + 1e-9)

wet = 0.13
Lw = fftconvolve(L, make_ir(11))[:N] * wet
Rw = fftconvolve(R, make_ir(23))[:N] * wet
L = L + Lw; R = R + Rw

# ── master : soft-clip musical + normalisation + fades ────────────────
L = np.tanh(L * 1.35) / np.tanh(1.35)
R = np.tanh(R * 1.35) / np.tanh(1.35)
peak = max(np.abs(L).max(), np.abs(R).max())
L *= 0.93 / peak; R *= 0.93 / peak
fi = int(0.6 * SR); fo = int(2.8 * SR)
L[:fi] *= np.linspace(0, 1, fi); R[:fi] *= np.linspace(0, 1, fi)
L[-fo:] *= np.linspace(1, 0, fo); R[-fo:] *= np.linspace(1, 0, fo)

stereo = np.stack([L, R], axis=1).astype(np.float32)
wav_path = '/home/z/my-project/scripts/task32-phonk.wav'
wavfile.write(wav_path, SR, stereo)

# vérification : RMS par tranches de 10 s (le phonk doit pomper)
win = int(SR * 10)
n_win = len(stereo) // win
rms = np.sqrt(np.mean(stereo[: n_win * win].reshape(n_win, win, 2) ** 2, axis=(1, 2)))
print(f'OK · {DUR:.1f}s · {DUR/60:.2f} min · {NBARS} mesures @ {BPM:.0f} BPM · RMS global {np.sqrt(np.mean(stereo**2)):.4f}')
print('RMS/10s :', ' '.join(f'{v:.3f}' for v in rms))

import subprocess
ogg_path = '/home/z/my-project/public/ambience/phonk-du-sahel.ogg'
subprocess.run(['ffmpeg', '-y', '-i', wav_path, '-c:a', 'libvorbis', '-q:a', '4', ogg_path], check=True, capture_output=True)
import os
print(f'OGG -> {ogg_path} ({os.path.getsize(ogg_path)//1024} Ko)')
