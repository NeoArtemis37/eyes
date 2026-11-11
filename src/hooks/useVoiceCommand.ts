'use client';


import { useCallback, useEffect, useRef, useState } from 'react';

import { normalizeCommand } from '@/lib/horus/cmd/normalize';

type SpeechRecognitionAlternativeLike = { transcript: string; confidence: number };
type SpeechResultLike = {
  isFinal: boolean;
  length: number;
  [index: number]: SpeechRecognitionAlternativeLike;
};
type SpeechEventLike = {
  resultIndex: number;
  results: { length: number; [index: number]: SpeechResultLike };
};
type RecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((e: SpeechEventLike) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
};
type RecognitionCtor = new () => RecognitionLike;

export interface VoiceFinalMeta {
  confidence: number;
  normalized: boolean;
}

interface VoiceCommandOptions {
  onFinal: (text: string, meta: VoiceFinalMeta) => void;
  onInterim?: (text: string) => void;
  lang?: string;
  continuous?: boolean;
  minConfidence?: number;
}

const REARM_DELAY_MS = 350;
const MAX_SILENT_REARMS = 12; // ~15 s de silence absolu avant reddition

export function useVoiceCommand({
  onFinal,
  onInterim,
  lang,
  continuous = true,
  minConfidence = 0.35,
}: VoiceCommandOptions) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recRef = useRef<RecognitionLike | null>(null);
  const finalRef = useRef(onFinal);
  const interimRef = useRef(onInterim);
  const langRef = useRef(lang);
  const continuousRef = useRef(continuous);
  const keepAliveRef = useRef(false);
  const silentRearmsRef = useRef(0);
  const rearmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    finalRef.current = onFinal;
    interimRef.current = onInterim;
    langRef.current = lang;
    continuousRef.current = continuous;
  }, [onFinal, onInterim, lang, continuous]);

  const langRefFirst = useRef(true);
  useEffect(() => {
    if (langRefFirst.current) {
      langRefFirst.current = false;
      return;
    }
    if (!keepAliveRef.current) return;
    try {
      recRef.current?.stop(); // déclenche onend → ré-armement avec la nouvelle langue
    } catch {
    }
  }, [lang]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const w = window as unknown as {
      SpeechRecognition?: RecognitionCtor;
      webkitSpeechRecognition?: RecognitionCtor;
    };
    setSupported(Boolean(w.SpeechRecognition || w.webkitSpeechRecognition));
  }, []);

  const spawnRecognizer = useCallback((): RecognitionLike | null => {
    if (typeof window === 'undefined') return null;
    const w = window as unknown as {
      SpeechRecognition?: RecognitionCtor;
      webkitSpeechRecognition?: RecognitionCtor;
    };
    const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!Ctor) return null;

    const rec = new Ctor();
    rec.lang = langRef.current || (typeof navigator !== 'undefined' && navigator.language) || 'fr-FR';
    rec.continuous = continuousRef.current;
    rec.interimResults = true;
    rec.maxAlternatives = 3;

    rec.onstart = () => {
      setListening(true);
      setError(null);
    };

    rec.onresult = (e) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (!r.isFinal) {
          interim += r[0]?.transcript ?? '';
          continue;
        }
        let best: SpeechRecognitionAlternativeLike | null = null;
        for (let k = 0; k < (r.length ?? 1); k++) {
          const alt = r[k];
          if (!alt) continue;
          if (!best || (alt.confidence ?? 0) > (best.confidence ?? 0)) best = alt;
        }
        const spoken = (best?.transcript ?? r[0]?.transcript ?? '').trim();
        silentRearmsRef.current = 0; // de la parole est arrivée
        if (interim && interimRef.current) interimRef.current(interim.trim());
        interim = '';
        if (!spoken || spoken.length < 2) continue;

        const before = spoken;
        const norm = normalizeCommand(spoken, true);
        const text = norm.text;
        if (!text) continue;
        finalRef.current(text, {
          confidence: best?.confidence && best.confidence > 0 ? best.confidence : 1,
          normalized: text !== before,
        });
      }
      if (interim && interimRef.current) interimRef.current(interim.trim());
    };

    rec.onerror = (e) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        setError('MIC_PERMISSION_DENIED');
        keepAliveRef.current = false; // inutile de re-armed sans permission
      } else if (e.error === 'no-speech') {
        setError('NO_SPEECH');
      } else if (e.error === 'network') {
        setError('NETWORK_RETRY');
      } else if (e.error !== 'aborted') {
        setError(e.error);
      }
    };

    rec.onend = () => {
      if (keepAliveRef.current) {
        if (rearmTimerRef.current) clearTimeout(rearmTimerRef.current);
        rearmTimerRef.current = setTimeout(() => {
          if (!keepAliveRef.current) {
            setListening(false);
            return;
          }
          silentRearmsRef.current += 1;
          if (silentRearmsRef.current > MAX_SILENT_REARMS) {
            keepAliveRef.current = false;
            setError('SILENCE_TIMEOUT');
            setListening(false);
            return;
          }
          try {
            recRef.current = spawnRecognizer();
            recRef.current?.start();
          } catch {
            setListening(false);
          }
        }, REARM_DELAY_MS);
      } else {
        setListening(false);
      }
    };

    return rec;
  }, []);

  const start = useCallback(() => {
    if (typeof window === 'undefined') return;
    keepAliveRef.current = continuousRef.current;
    silentRearmsRef.current = 0;
    setError(null);
    try {
      recRef.current?.abort();
    } catch { /* instance précédente déjà morte */ }
    const rec = spawnRecognizer();
    if (!rec) return;
    recRef.current = rec;
    try {
      rec.start();
    } catch {
      setListening(false);
    }
  }, [spawnRecognizer]);

  const stop = useCallback(() => {
    keepAliveRef.current = false;
    if (rearmTimerRef.current) {
      clearTimeout(rearmTimerRef.current);
      rearmTimerRef.current = null;
    }
    try {
      recRef.current?.stop();
    } catch { /* déjà arrêté */ }
    setListening(false);
  }, []);

  useEffect(
    () => () => {
      keepAliveRef.current = false;
      if (rearmTimerRef.current) clearTimeout(rearmTimerRef.current);
      try {
        recRef.current?.abort();
      } catch { /* noop */ }
    },
    []
  );

  return {
    supported,
    listening,
    error,
    start,
    stop,
    minConfidence,
  };
}


export const VOICE_LANGS = ['fr-FR', 'en-US'] as const;
export type VoiceLang = (typeof VOICE_LANGS)[number];

export function loadVoiceLang(): VoiceLang {
  if (typeof window === 'undefined') return 'fr-FR';
  try {
    const saved = window.localStorage.getItem('horus-voice-lang');
    if (saved === 'fr-FR' || saved === 'en-US') return saved;
  } catch {
  }
  return 'fr-FR';
}

export function saveVoiceLang(lang: VoiceLang) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem('horus-voice-lang', lang);
  } catch {
  }
}
