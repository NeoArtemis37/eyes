'use client';


import { useCallback, useEffect, useRef, useState } from 'react';

const MAX_MS = 20_000; // coupure auto d'un enregistrement oublié

export type ServerVoiceState = 'idle' | 'recording' | 'transcribing';

interface ServerVoiceOptions {
  onFinal: (text: string) => void;
}

export function useServerVoice({ onFinal }: ServerVoiceOptions) {
  const [supported, setSupported] = useState(false);
  const [state, setState] = useState<ServerVoiceState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);

  const recRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const finalRef = useRef(onFinal);
  useEffect(() => {
    finalRef.current = onFinal;
  }, [onFinal]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setSupported(
      Boolean(
        navigator.mediaDevices &&
          'getUserMedia' in navigator.mediaDevices &&
          'MediaRecorder' in window
      )
    );
  }, []);

  const teardown = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    recRef.current = null;
    chunksRef.current = [];
  }, []);

  const toWavBase64 = async (blob: Blob): Promise<string> => {
    const buf = await blob.arrayBuffer();
    const AC: typeof AudioContext =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    const ac = new AC();
    try {
      const decoded = await ac.decodeAudioData(buf.slice(0));
      const targetRate = 16000;
      const frames = Math.ceil(decoded.duration * targetRate);
      const off = new OfflineAudioContext(1, frames, targetRate);
      const src = off.createBufferSource();
      src.buffer = decoded;
      src.connect(off.destination);
      src.start();
      const rendered = await off.startRendering();
      const data = rendered.getChannelData(0);

      const bytes = new DataView(new ArrayBuffer(44 + data.length * 2));
      const ascii = (off_: number, s: string) => {
        for (let i = 0; i < s.length; i++) bytes.setUint8(off_ + i, s.charCodeAt(i));
      };
      ascii(0, 'RIFF');
      bytes.setUint32(4, 36 + data.length * 2, true);
      ascii(8, 'WAVEfmt ');
      bytes.setUint32(16, 16, true);
      bytes.setUint16(20, 1, true); // PCM
      bytes.setUint16(22, 1, true); // mono
      bytes.setUint32(24, targetRate, true);
      bytes.setUint32(28, targetRate * 2, true);
      bytes.setUint16(32, 2, true);
      bytes.setUint16(34, 16, true);
      ascii(36, 'data');
      bytes.setUint32(40, data.length * 2, true);
      let o = 44;
      for (let i = 0; i < data.length; i++, o += 2) {
        const s = Math.max(-1, Math.min(1, data[i]));
        bytes.setInt16(o, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      }
      const u8 = new Uint8Array(bytes.buffer);
      let bin = '';
      for (let i = 0; i < u8.length; i += 0x8000) {
        bin += String.fromCharCode(...u8.subarray(i, i + 0x8000));
      }
      return btoa(bin);
    } finally {
      void ac.close();
    }
  };

  const transcribe = useCallback(
    async (blob: Blob) => {
      const dur = Date.now() - startedAtRef.current;
      if (dur < 300) {
        setState('idle');
        return; // clic accidentel · rien à transcrire
      }
      setState('transcribing');
      setError(null);
      try {
        let audio: string;
        try {
          audio = await toWavBase64(blob);
        } catch {
          const u8 = new Uint8Array(await blob.arrayBuffer());
          let bin = '';
          for (let i = 0; i < u8.length; i += 0x8000) {
            bin += String.fromCharCode(...u8.subarray(i, i + 0x8000));
          }
          audio = btoa(bin);
        }
        const res = await fetch('/api/voice/transcribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ audio }),
        });
        const data = (await res.json()) as { text?: string; error?: string };
        if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
        const text = (data.text ?? '').trim();
        if (text) finalRef.current(text);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'ASR_FAILED');
      } finally {
        setState('idle');
        setElapsed(0);
      }
    },
    []
  );

  const start = useCallback(async () => {
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('NO_GETUSERMEDIA');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mime = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus']
        .find((m) => MediaRecorder.isTypeSupported?.(m));
      const rec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      recRef.current = rec;
      chunksRef.current = [];
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.onstop = () => {
        const blob = new Blob(chunksRef.current, {
          type: rec.mimeType || 'audio/webm',
        });
        teardown();
        void transcribe(blob);
      };
      rec.start(250);
      startedAtRef.current = Date.now();
      setState('recording');
      setElapsed(0);
      timerRef.current = setInterval(() => {
        const ms = Date.now() - startedAtRef.current;
        setElapsed(Math.floor(ms / 1000));
        if (ms >= MAX_MS) {
          try {
            recRef.current?.stop();
          } catch {
          }
        }
      }, 250);
    } catch {
      teardown();
      setError('MIC_PERMISSION_DENIED');
      setState('idle');
    }
  }, [teardown, transcribe]);

  const stop = useCallback(() => {
    try {
      recRef.current?.stop(); // déclenche onstop → transcription
    } catch {
      teardown();
      setState('idle');
    }
  }, [teardown]);

  const cancel = useCallback(() => {
    try {
      recRef.current?.stop();
    } catch {
    }
    teardown();
    setState('idle');
    setElapsed(0);
  }, [teardown]);

  useEffect(() => () => teardown(), [teardown]);

  return { supported, state, error, elapsed, start, stop, cancel };
}
