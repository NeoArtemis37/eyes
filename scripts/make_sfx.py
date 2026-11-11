"""Synthèse des 8 SFX clavier pour la narration machine à écrire du MODE AUTO.

6 touches ordinaires (key-1..key-6) + barre espace + retour chariot.
Son : clavier mécanique « thock » = burst de bruit bande-étroite + micro-transitoire
sinusoïdal grave, attaque instantanée, décroissance exponentielle rapide.
Sortie : public/sfx/*.wav (44,1 kHz mono 16 bits, ~35-60 ms).
"""
import numpy as np
import wave
from pathlib import Path

SR = 44100
OUT = Path('/home/z/my-project/public/sfx')
OUT.mkdir(parents=True, exist_ok=True)
rng = np.random.default_rng(42)


def env_exp(n: int, tau: float) -> np.ndarray:
    return np.exp(-np.arange(n) / (tau * SR))


def _bandpass_noise(n: int, lo: float, hi: float) -> np.ndarray:
    x = rng.normal(0, 1, n)
    spec = np.fft.rfft(x)
    freqs = np.fft.rfftfreq(n, 1 / SR)
    mask = (freqs >= lo) & (freqs <= hi)
    spec[~mask] = 0
    y = np.fft.irfft(spec, n)
    return y / max(np.max(np.abs(y)), 1e-9)


def key_click(freq: float, dur_ms: float, tau_ms: float, noise_lo: float, gain: float) -> np.ndarray:
    n = int(SR * dur_ms / 1000)
    t = np.arange(n) / SR
    burst = _bandpass_noise(n, noise_lo, noise_lo * 2.6)
    burst *= env_exp(n, tau_ms / 1000)
    body = np.sin(2 * np.pi * freq * t) * env_exp(n, tau_ms / 1000 * 1.8) * 0.9
    click = np.zeros(n)
    k = min(int(0.003 * SR), n)
    click[:k] = rng.normal(0, 1, k) * env_exp(k, 0.0009)
    x = gain * (0.55 * burst + 0.35 * body + 0.25 * click)
    peak = np.max(np.abs(x))
    return x / max(peak, 1e-9) * 0.72


def save(name: str, x: np.ndarray):
    fade = min(int(0.004 * SR), len(x) // 4)
    if fade > 0:
        x[:fade] *= np.linspace(0, 1, fade)
        x[-fade:] *= np.linspace(1, 0, fade)
    data = (np.clip(x, -1, 1) * 32767).astype('<i2').tobytes()
    with wave.open(str(OUT / f'{name}.wav'), 'wb') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(data)
    print(f'{name}.wav  {len(x)/SR*1000:.0f} ms')


GAINS = [1.0, 0.92, 1.05, 0.88, 0.97, 0.9]
FREQS = [1250, 1480, 1120, 1660, 1340, 1540]
for i in range(6):
    save(f'key-{i+1}', key_click(FREQS[i], 34 + (i % 3) * 4, 8.5 + (i % 2) * 1.5, 2200 + i * 170, GAINS[i]))

save('space', key_click(430, 52, 13, 1250, 1.1))
save('return', key_click(560, 58, 15, 1500, 1.15))
print('OK ->', OUT)
