# « Odyssée du Sahel » v2 — PLUS ÉPIQUE (Task 29)
# Basé sur task27-epic-music.py, amplifié : chœurs formantiques, braams quinte+octave + staccato,
# anvil métallique + crash de cymbales, toms denses, cordes aiguës doublant les cors au climax final,
# cor grave pédale, tempo 74 BPM. Ré mineur · 48 mesures · bouclable.
import numpy as np
from scipy.signal import fftconvolve, butter, sosfilt, lfilter

SR = 44100
BPM = 74.0
BEAT = 60.0 / BPM          # 0.811 s
BAR = 4 * BEAT             # 3.243 s
NBARS = 48
TAIL = 7.0
DUR = NBARS * BAR + TAIL   # ~162.7 s
N = int(DUR * SR)
rng = np.random.default_rng(29)

L = np.zeros(N); R = np.zeros(N)

NOTE = {
    'D1': 36.71, 'D2': 73.42, 'E2': 82.41, 'F2': 87.31, 'G2': 98.00, 'A1': 55.00,
    'A2': 110.00, 'Bb1': 58.27, 'Bb2': 116.54, 'C3': 130.81, 'C#3': 138.59,
    'D3': 146.83, 'E3': 164.81, 'F3': 174.61, 'G3': 196.00, 'A3': 220.00,
    'Bb3': 233.08, 'C4': 261.63, 'C#4': 277.18, 'D4': 293.66, 'E4': 329.63,
    'F4': 349.23, 'G4': 392.00, 'A4': 440.00, 'Bb4': 466.16, 'C5': 523.25,
    'D5': 587.33, 'E5': 659.26, 'F5': 698.46,
}

def t2s(t): return int(t * SR)

def place(sig, t, gain=1.0, pan=0.0):
    i0 = t2s(t)
    if i0 >= N: return
    i1 = min(N, i0 + len(sig))
    seg = sig[: i1 - i0] * gain
    th = (pan + 1) * np.pi / 4
    L[i0:i1] += seg * np.cos(th)
    R[i0:i1] += seg * np.sin(th)

def env_adsr(n, a=0.01, d=0.08, s=0.72, r=0.08):
    a_n, d_n, r_n = int(a*SR), int(d*SR), int(r*SR)
    s_n = max(0, n - a_n - d_n - r_n)
    if s_n == 0:
        e = np.linspace(0, 1, max(2, n), endpoint=False) ** 2
        return e
    return np.concatenate([
        np.linspace(0, 1, a_n, endpoint=False),
        np.linspace(1, s, d_n, endpoint=False),
        np.full(s_n, s),
        np.linspace(s, 0, r_n, endpoint=False),
    ])

LP2800 = butter(2, 2800, 'low', fs=SR, output='sos')
LP2200 = butter(2, 2200, 'low', fs=SR, output='sos')
LP900  = butter(2, 900,  'low', fs=SR, output='sos')
# formants « ah » (choeur)
BP_AH1 = butter(2, [620, 820],  'bandpass', fs=SR, output='sos')
BP_AH2 = butter(2, [1100, 1400],'bandpass', fs=SR, output='sos')
BP_AH3 = butter(2, [2400, 3000],'bandpass', fs=SR, output='sos')
HP3000 = butter(2, 3000, 'high', fs=SR, output='sos')

def osc(freq, n, nh=22, detune=0.0, vib_hz=0.0, vib_depth=0.0, drift=0.0):
    t = np.arange(n) / SR
    f = freq * (1 + detune)
    if vib_hz:
        f = f * (1 + vib_depth * np.sin(2*np.pi*vib_hz*np.maximum(0, t-0.25)))
    if drift:
        f = f * (1 + drift * np.sin(2*np.pi*0.23*t))
    ph = 2*np.pi*np.cumsum(f)/SR
    out = np.zeros(n)
    for h in range(1, nh+1):
        if freq*h > 19000: break
        out += np.sin(h*ph) / h
    return out * (2/np.pi)

def saw_lp(freq, n, sos, **kw):
    return sosfilt(sos, osc(freq, n, **kw))

# ── instruments ─────────────────────────────────────────────
def ostinato_note(freq, dur):
    n = int(dur*SR)
    body = saw_lp(freq, n, LP2800, nh=26, detune=0.004)
    body += 0.5 * saw_lp(freq, n, LP2800, nh=26, detune=-0.004)
    return body * env_adsr(n, a=0.014, d=0.05, s=0.68, r=0.09)

def horn(freq, dur, soft=False):
    n = int(dur*SR)
    body = saw_lp(freq, n, LP2200, nh=22, vib_hz=5.2, vib_depth=0.004, drift=0.002)
    body += 0.6 * saw_lp(freq, n, LP2200, nh=18, detune=0.005)
    bright = osc(freq, n, nh=30) - saw_lp(freq, n, LP2200, nh=30)
    body += 0.5 * bright * (1 - np.exp(-np.arange(n)/SR/0.12))
    e = env_adsr(n, a=0.09 if soft else 0.055, d=0.10, s=0.82, r=0.16)
    return body * e * (0.85 if soft else 1.0)

def string_hi(freq, dur):
    # cordes aiguës brillantes, doublement octave haute des cors
    n = int(dur*SR)
    body = saw_lp(freq, n, LP2800, nh=30, detune=0.006, vib_hz=5.8, vib_depth=0.004)
    body += 0.6 * saw_lp(freq, n, LP2800, nh=30, detune=-0.005, vib_hz=5.1, vib_depth=0.003)
    return body * env_adsr(n, a=0.10, d=0.12, s=0.78, r=0.22)

def choir(freq, dur, level=0.11):
    # chœur synthétique : saws désaccordés -> formants « ah »
    n = int(dur*SR)
    out = np.zeros(n)
    for det, oct2 in [(-0.007, 1.0), (0.006, 1.0), (0.0, 2.0), (-0.004, 2.0)]:
        out += saw_lp(freq*oct2, n, LP900, nh=10, detune=det, vib_hz=4.6, vib_depth=0.0035, drift=0.0012)
    out /= 4.0
    f1 = sosfilt(BP_AH1, out); f2 = sosfilt(BP_AH2, out); f3 = sosfilt(BP_AH3, out)
    voice = f1*1.0 + f2*0.55 + f3*0.22
    # souffle de soufflerie
    voice += 0.10 * lfilter([1.0], [1.0, -0.9], rng.standard_normal(n)) * np.exp(-np.arange(n)/SR/(dur*0.6))
    return voice * env_adsr(n, a=0.55, d=0.3, s=0.82, r=0.8) * level

def taiko(f0=115.0, f1=46.0, dur=0.55, ring=0.13, slap=0.5):
    n = int(dur*SR); t = np.arange(n)/SR
    f = f1 + (f0-f1)*np.exp(-t/0.055)
    body = np.sin(2*np.pi*np.cumsum(f)/SR) * np.exp(-t/ring)
    s = lfilter([1.0], [1.0, -0.94], rng.standard_normal(n)) * np.exp(-t/0.022) * slap
    return body + s

def anvil(dur=1.4, level=0.12):
    # percussion métallique : partiels inharmoniques + transitoire
    n = int(dur*SR); t = np.arange(n)/SR
    out = np.zeros(n)
    for f, g, dec in [(1870, 1.0, 0.35), (2410, 0.7, 0.22), (3160, 0.5, 0.16), (4290, 0.3, 0.10)]:
        out += g * np.sin(2*np.pi*f*t) * np.exp(-t/dec)
    out *= 0.6
    out += 0.5 * sosfilt(HP3000, rng.standard_normal(n)) * np.exp(-t/0.02)
    return out * env_adsr(n, a=0.002, d=0.05, s=0.25, r=dur*0.5) * level

def cymbal_crash(dur=2.0, level=0.10):
    n = int(dur*SR); t = np.arange(n)/SR
    x = sosfilt(HP3000, rng.standard_normal(n))
    return x * np.exp(-t/0.55) * level

def timp_roll(beats, gain0=0.08, gain1=0.30):
    g = np.linspace(gain0, gain1, beats)
    dt = BEAT*4/beats
    t = 0.0
    sigs = []
    for i in range(beats):
        s = taiko(100, 44, 0.35, ring=0.09, slap=0.35)
        sigs.append((s, t, g[i]))
        t += dt * (1 - 0.08*i/beats)
    return sigs

def braam(freq, dur=6.0, level=0.30):
    n = int(dur*SR); t = np.arange(n)/SR
    out = np.zeros(n)
    layers = [(freq, 1.0), (freq*1.004, 0.8), (freq*0.5, 0.9), (freq*2, 0.35),
              (freq*1.5, 0.45), (freq*3.0, 0.18)]   # v2 : quinte + octave-quinte
    for f, g in layers:
        out += g * saw_lp(f, n, LP900, nh=12, drift=0.0016)
    out += 0.7*np.sin(2*np.pi*freq*0.25*t)          # sub renforcé
    out += 0.05*lfilter([1],[1,-0.97],rng.standard_normal(n))*np.exp(-t/0.6)
    e = np.minimum(1, t/0.32) * np.exp(-t/2.6)
    return out * e * level

def braam_hit(freq, level=0.22):
    # staccato : attaque franche, corps court — frappe de climax
    n = int(1.1*SR); t = np.arange(n)/SR
    out = np.zeros(n)
    for f, g in [(freq, 1.0), (freq*1.004, 0.8), (freq*0.5, 1.0), (freq*1.5, 0.5)]:
        out += g * saw_lp(f, n, LP900, nh=12, drift=0.001)
    e = np.minimum(1, t/0.06) * np.exp(-t/0.45)
    return out * e * level

def riser(dur, amp=0.11):
    n = int(dur*SR); t = np.arange(n)/SR
    f = 146.83 * (587.33/146.83) ** (t/dur)
    ph = 2*np.pi*np.cumsum(f)/SR
    tone = (np.sin(ph) + 0.4*np.sin(2*ph)) * (t/dur)**1.6
    noise = lfilter([1.0, -0.85], [1.0, -0.65], rng.standard_normal(n)) * (t/dur)**2.2
    return (tone*0.55 + noise*0.45) * amp

def swell(dur, amp=0.05):
    n = int(dur*SR)
    x = lfilter([1.0], [1.0, -0.965], rng.standard_normal(n))
    return x * (np.linspace(0, 1, n)**2) * amp

def pad_chord(freqs, dur, level=0.15):
    n = int(dur*SR)
    out = np.zeros(n)
    for f in freqs:
        out += saw_lp(f, n, LP900, nh=12, detune=0.0025, drift=0.001)
        out += 0.6 * saw_lp(f, n, LP900, nh=12, detune=-0.003)
    out /= max(1, len(freqs))
    return out * env_adsr(n, a=0.7, d=0.2, s=0.85, r=0.9) * level

# ── arrangement ────────────────────────────────────────────
def bt(bar, beat=1.0):
    return (bar-1)*BAR + (beat-1)*BEAT

CH = {
    'Dm': ['D2','D3','F3','A3'], 'Bb': ['Bb2','D3','F3'],
    'F':  ['F2','A2','C3','F3'], 'C':  ['C3','E3','G3'],
    'Gm': ['G2','G3','Bb3','D4'], 'A':  ['A2','A3','C#4','E4'],
}
def ch(name): return [NOTE[x] for x in CH[name]]

# 1) DRONE sub D (renforcé)
drone_n = int((NBARS-2)*BAR*SR)
t_dr = np.arange(drone_n)/SR
drone = (np.sin(2*np.pi*NOTE['D1']*t_dr) + 0.62*np.sin(2*np.pi*NOTE['D2']*t_dr) + 0.25*np.sin(2*np.pi*NOTE['A1']*t_dr))
drone *= (1 + 0.20*np.sin(2*np.pi*0.07*t_dr))
drone *= np.minimum(1, t_dr/6.0) * np.minimum(1, ((NBARS-2)*BAR - t_dr)/6.0)
place(drone*0.18, 0.0)

# 2) INTRO b1-4 : swell + taiko lointain + cor lointain + riser
place(swell(2*BAR, 0.05), bt(1))
for bar, beat in [(2,1),(4,1),(4,3)]:
    place(taiko(), bt(bar,beat), 0.22)
place(horn(NOTE['A3'], 1.4*BEAT, soft=True), bt(3,1), 0.16)
place(horn(NOTE['D3'], 2.6*BEAT, soft=True), bt(3,3), 0.18)
place(riser(2*BEAT, 0.08), bt(4,3))

# 3) OSTINATO b5-46
PROG = {
    **{b: 'Dm' for b in range(5, 13)},
    **{b: ('Dm','Bb','F','C')[(b-13)%4] for b in range(13, 21)},
    **{b: ('Dm','Bb','Gm','A')[(b-21)%4] for b in range(21, 29)},
    **{b: ('Dm','Bb','F','C')[(b-29)%4] for b in range(29, 37)},
}
PROG[37], PROG[38] = 'Gm', 'Gm'
PROG[39], PROG[40] = 'A', 'A'
for b in range(41, 49):
    PROG[b] = {41:'Dm',42:'Dm',43:'Bb',44:'Bb',45:'Gm',46:'Gm',47:'A',48:'Dm'}[b]

INT3 = {'Dm': 0.0, 'Bb': 3.0, 'F': 5.0, 'C': 7.0, 'Gm': 10.0, 'A': 12.0}

def root_of(name):
    f0 = NOTE[CH[name][0].replace('1','2')] if CH[name][0].endswith('1') else NOTE[CH[name][0]]
    return f0

def ost_bar(bar, name, gain):
    r = root_of(name)
    third, fifth = r*2**(INT3[name]/12), r*2**(7/12)
    seq = [r, r, third, fifth, r*2, fifth, third, r]
    for i, f in enumerate(seq):
        if bar >= 47: break
        place(ostinato_note(f, 0.19), bt(bar, 1+i*0.5), gain, pan=(-0.25 if i%2 else 0.25))

for b in range(5, 47):
    g = 0.10 if b < 13 else (0.115 if b < 21 else (0.13 if b < 29 else (0.14 if b < 37 else (0.085 if b < 39 else 0.13))))
    ost_bar(b, PROG[b], g)

# 4) PADS
b = 5
while b <= 48:
    place(pad_chord(ch(PROG[b]), 2*BAR+0.3, 0.16 if b >= 21 else 0.13), bt(b))
    b += 2

# 5) TAIKO / TIMBALES — batterie densifiée v2
for b in range(5, 47):
    if b in (37, 38):  # break : pulsation cardiaque
        for beat in (1, 2, 3, 4):
            place(taiko(80, 40, 0.4, ring=0.11, slap=0.25), bt(b, beat), 0.16)
        continue
    acc = 0.26 if b < 21 else 0.32
    place(taiko(), bt(b,1), acc)
    place(taiko(), bt(b,3), acc*0.6)
    if b >= 17:
        place(taiko(110,48,0.35,ring=0.08,slap=0.3), bt(b,2.5), acc*0.42)
        place(taiko(110,48,0.35,ring=0.08,slap=0.3), bt(b,4), acc*0.48)
    if b >= 29:  # v2 : doubles croches de guerre vers les climaxes
        place(taiko(130,60,0.30,ring=0.06,slap=0.38), bt(b,4.5), acc*0.36)
        place(taiko(130,60,0.30,ring=0.06,slap=0.38), bt(b,2.75), acc*0.30)

for beats, bar, g0, g1 in [(8, 19, 0.07, 0.26), (16, 27, 0.07, 0.30),
                          (8, 35, 0.07, 0.24), (16, 39, 0.08, 0.36),
                          (16, 47, 0.09, 0.38)]:
    for i, (s, t, g) in enumerate(timp_roll(beats, g0, g1)):
        place(s, bt(bar) + t, g)

# 6) BRAAMS v2 — quinte+octave, niveau +, staccato au downbeat des climaxes
for bar, lvl in [(21, 0.34), (29, 0.36), (41, 0.38), (47, 0.24)]:
    place(braam(NOTE['D2'], 6.0, lvl), bt(bar))
    place(braam_hit(NOTE['D2'], 0.20), bt(bar, 1), pan=0.0)
    place(cymbal_crash(2.2, 0.11), bt(bar, 1))

# 7) ANVIL — frappes métalliques sur les climaxes
for bar, g in [(21, 0.11), (29, 0.12), (41, 0.13), (48, 0.10)]:
    place(anvil(1.4, g), bt(bar, 1), pan=0.12)
place(anvil(1.2, 0.09), bt(24, 1), pan=-0.12)
place(anvil(1.2, 0.09), bt(33, 1), pan=-0.12)

# 8) RISERS
place(riser(2*BAR, 0.11), bt(19))
place(riser(2*BAR, 0.11), bt(37))
place(riser(2*BAR, 0.12), bt(39))
place(riser(1*BAR, 0.10), bt(47))

# 9) CHŒURS v2 — entrée au climax 1, fort au final
b = 21
while b <= 28:
    place(choir(NOTE[CH[PROG[b]][0]] * 2, 2*BAR+0.4, 0.085), bt(b))
    b += 2
# break : chœur murmurant sur la dominante (tension)
place(choir(NOTE['A2']*2, 2*BAR, 0.045), bt(37))
place(choir(NOTE['A2']*2, 2*BAR, 0.055), bt(39))
# final : chœur ff qui change d'accord toutes les mesures
for b in range(41, 48):
    place(choir(NOTE[CH[PROG[b]][0]] * 2, BAR+0.3, 0.115), bt(b))

# 10) COR GRAVE PÉDALE — plateau b29-36, glisse le spectre vers le bas
for b in range(29, 37, 2):
    place(horn(NOTE['D2'], 2*BAR*0.96, soft=True), bt(b), 0.13)
    place(horn(NOTE['A1']*2, 2*BAR*0.96, soft=True), bt(b+1 if b+1 < 37 else 36), 0.10)

# 11) MÉLODIE de cors héroïque
MEL = [
    (21,1,2,'D4'), (21,3,2,'F4'), (22,1,4,'A4'),
    (23,1,2,'G4'), (23,3,1,'F4'), (23,4,1,'E4'), (24,1,4,'D4'),
    (25,1,2,'F4'), (25,3,2,'G4'), (26,1,4,'A4'),
    (27,1,2,'G4'), (27,3,2,'A4'), (28,1,4,'A4'),
    (29,1,2,'D5'), (29,3,2,'C5'), (30,1,4,'Bb4'),
    (31,1,2,'A4'), (31,3,2,'G4'), (32,1,4,'F4'),
    (33,1,2,'G4'), (33,3,2,'A4'), (34,1,4,'Bb4'),
    (35,1,2,'A4'), (35,3,2,'G4'), (36,1,2,'F4'), (36,3,2,'E4'),
    (41,1,2,'A4'), (41,3,2,'D5'), (42,1,6,'D5'),
    (43,3,2,'C5'), (44,1,4,'Bb4'),
    (45,1,2,'G4'), (45,3,2,'F4'), (46,1,4,'E4'),
    (47,1,8,'D4'),
]
for bar, beat, dbeats, note in MEL:
    soft = bar in (27, 28, 35, 36)
    g = 0.21 if bar >= 41 else 0.185
    place(horn(NOTE[note], dbeats*BEAT*0.96, soft=soft), bt(bar, beat), g)
    if bar >= 41:
        # v2 : cordes aiguës doublant les cors à l'octave au climax final
        place(string_hi(NOTE[note]*2, dbeats*BEAT*0.94), bt(bar, beat), 0.105)

# 12) FINAL : frappe + anvil + souffle descendant (mesure 48) puis silence → boucle propre
place(taiko(120, 44, 0.9, ring=0.22, slap=0.7), bt(48,1), 0.46)
place(swell(BAR*1.5, 0.045), bt(48,1))

# ── réverbération (IR décroissante décorélée stéréo, hall plus large v2) ──
def make_ir(seed, dur=2.7, decay=0.5):
    r = np.random.default_rng(seed)
    n = int(dur*SR)
    ir = r.standard_normal(n) * np.exp(-np.arange(n)/SR/decay)
    ir[0] = 1.0
    return ir / np.sqrt(np.sum(ir**2))

wet = 0.22
Lw = fftconvolve(L, make_ir(11))[:N] * wet
Rw = fftconvolve(R, make_ir(23))[:N] * wet
L = L + Lw; R = R + Rw

# ── master : soft-clip musical + normalisation + fades ─────
L = np.tanh(L*1.3)/np.tanh(1.3)
R = np.tanh(R*1.3)/np.tanh(1.3)
peak = max(np.abs(L).max(), np.abs(R).max())
L *= 0.94/peak; R *= 0.94/peak
fi = int(0.05*SR); fo = int(1.2*SR)
L[:fi] *= np.linspace(0,1,fi); R[:fi] *= np.linspace(0,1,fi)
L[-fo:] *= np.linspace(1,0,fo); R[-fo:] *= np.linspace(1,0,fo)

stereo = np.stack([L, R], axis=1).astype(np.float32)
wav_path = '/home/z/my-project/scripts/task29-odyssee-v2.wav'
from scipy.io import wavfile
wavfile.write(wav_path, SR, stereo)

# courbe RMS par section (vérification épique)
win = int(SR*2)
rms_t = np.sqrt(np.mean(stereo[:int(len(stereo)/win)*win].reshape(-1, win, 2)**2, axis=(1,2)))
print(f'OK · {DUR:.1f}s · {DUR/60:.2f} min · RMS global {np.sqrt(np.mean(stereo**2)):.4f} · peak {np.abs(stereo).max():.3f}')
marks = [(0,'intro'), (21,'climax1'), (30,'plateau'), (37,'break'), (41.5,'climax final'), (47,'outro')]
for bar, lbl in marks:
    i = int((bt(bar)-1 if bar > 1 else 0)*SR/win)
    print(f'  RMS {lbl:<12} {rms_t[min(i, len(rms_t)-1)]:.3f}')
print(wav_path)
