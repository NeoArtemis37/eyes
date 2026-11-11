'use client';

const KEY_POOL = [
  '/sfx/key-1.wav', '/sfx/key-2.wav', '/sfx/key-3.wav',
  '/sfx/key-4.wav', '/sfx/key-5.wav', '/sfx/key-6.wav',
];
const SFX_SPACE = '/sfx/space.wav';
const SFX_RETURN = '/sfx/return.wav';
const MUSIC_URL = '/ambience/odyssee-du-sahel.ogg';
const MUSIC_VOLUME = 0.2;
const DUCK_FACTOR = 0.5;
const KEY_GAIN = 0.16;
const SPACE_GAIN_FACTOR = 0.6;
const RETURN_GAIN_FACTOR = 0.8;

type Ctx = {
  ac: AudioContext;
  buffers: (AudioBuffer | null)[];
};

let ctx: Ctx | null = null;
let loading: Promise<void> | null = null;
let music: HTMLAudioElement | null = null;
let ducked = false;

export function keySfxReady(): boolean {
  return !!ctx;
}

export function initKeySfx(): Promise<void> {
  if (loading) return loading;
  loading = (async () => {
    const AC = window.AudioContext || (window as any).webkitAudioContext;
    if (!AC) return;
    const ac: AudioContext = new AC();
    if (ac.state === 'suspended') {
      try { await ac.resume(); } catch {}
    }
    const urls = [...KEY_POOL, SFX_SPACE, SFX_RETURN];
    const buffers = await Promise.all(
      urls.map(async (u) => {
        try {
          const res = await fetch(u);
          const raw = await res.arrayBuffer();
          return await ac.decodeAudioData(raw);
        } catch {
          return null;
        }
      })
    );
    ctx = { ac, buffers };
  })();
  return loading;
}

export function playKey(kind: 'key' | 'space' | 'return' = 'key'): void {
  if (!ctx) return;
  const { ac, buffers } = ctx;
  let buf: AudioBuffer | null = null;
  let gainFactor = 1;
  if (kind === 'space') {
    buf = buffers[6] ?? null;
    gainFactor = SPACE_GAIN_FACTOR;
  } else if (kind === 'return') {
    buf = buffers[7] ?? null;
    gainFactor = RETURN_GAIN_FACTOR;
  }
  if (!buf) {
    const pool = buffers.slice(0, 6).filter((b): b is AudioBuffer => !!b);
    if (pool.length === 0) return;
    buf = pool[Math.floor(Math.random() * pool.length)];
  }
  if (!buf) return;
  try {
    const src = ac.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = 0.96 + Math.random() * 0.08;
    const g = ac.createGain();
    g.gain.value = KEY_GAIN * gainFactor * (0.9 + Math.random() * 0.2);
    src.connect(g).connect(ac.destination);
    src.start();
  } catch {}
}

export function musicPref(): boolean {
  try {
    return localStorage.getItem('horus-music') !== '0';
  } catch {
    return true;
  }
}

function baseVolume(): number {
  return ducked ? MUSIC_VOLUME * DUCK_FACTOR : MUSIC_VOLUME;
}

export function ensureAmbience(): void {
  if (typeof window === 'undefined') return;
  if (!music) {
    const a = new Audio(MUSIC_URL);
    a.loop = true;
    a.preload = 'auto';
    a.setAttribute('data-horus-music', '1');
    a.style.display = 'none';
    a.volume = baseVolume();
    document.body.appendChild(a);
    music = a;
  }
  if (musicPref() && music.paused) {
    music.play().catch(() => {
      const retry = () => {
        window.removeEventListener('pointerdown', retry);
        if (musicPref() && music && music.paused) music.play().catch(() => {});
      };
      window.addEventListener('pointerdown', retry, { once: true });
    });
  }
}

export function duckMusic(on: boolean): void {
  ducked = on;
  if (music) music.volume = baseVolume();
}

export function toggleMusic(): boolean {
  const next = !musicPref();
  try { localStorage.setItem('horus-music', next ? '1' : '0'); } catch {}
  if (!music) {
    if (next) ensureAmbience();
    return next;
  }
  if (next) {
    music.volume = baseVolume();
    music.play().catch(() => {});
  } else {
    music.pause();
  }
  return next;
}

export function musicPlaying(): boolean {
  return !!music && !music.paused;
}
