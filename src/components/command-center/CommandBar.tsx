'use client';


import { useCallback, useEffect, useRef, useState } from 'react';
import { Mic, MicOff, CornerDownLeft, TerminalSquare, X, Radio, MapPin, Languages } from 'lucide-react';
import {
  useVoiceCommand,
  loadVoiceLang,
  saveVoiceLang,
  type VoiceFinalMeta,
  type VoiceLang,
} from '@/hooks/useVoiceCommand';
import { useServerVoice } from '@/hooks/useServerVoice';

export interface NavAction {
  action: string;
  [key: string]: unknown;
}

export interface TrackMeta {
  requested?: string;
  resolvedFromDomain?: boolean;
  rdns?: string;
  city?: string;
  region?: string;
  country?: string;
  isp?: string;
  asn?: string;
  ips?: string[];
}

interface CommandBarProps {
  onSetPanel: (panel: string) => void;
  onTrackIp: (ip: string, meta?: TrackMeta) => void;
  onResetView: () => void;
  onRefreshIntel: () => void;
  onSitrep: () => Promise<string>;
  onToast?: (msg: string, kind?: 'info' | 'success' | 'warn' | 'error') => void;
  onMapStyle?: (style: 'satellite' | 'dark' | 'streets') => void;
  onVisualMode?: (mode: 'flir' | 'nvg' | 'crt' | 'satellite' | 'default') => void;
  blocked?: boolean;
}

interface ChoiceOption {
  index: number;
  label: string;
  sublabel: string;
  lat: number;
  lng: number;
  zoom: number;
  type: string;
  category: string;
  importance: number;
}

interface LogLine {
  id: number;
  kind: 'cmd' | 'action' | 'reply' | 'voice' | 'error' | 'sitrep' | 'geo' | 'track' | 'notice';
  text: string;
  ts: number;
}

const HELP_TEXT = `CMD · RÉFÉRENCE (FR/EN, frappe ou voix)
────────────────────────────────────
NAVIGATION
  va à Tokyo · cap sur Paris · montre Londres · fly to Rome
  « 10 rue de Rivoli, Paris » · « 48.85, 2.35 » (coordonnées)
ZOOM
  zoom 14 · mets le zoom à 16 · rapproche · éloigne · beaucoup
STYLE DE CARTE (fond)
  mode satellite · mode dark · mode rues
MODES VISUELS (filtre optique)
  mode flir / thermique · vision nocturne / nvg · mode crt
  mode par défaut (reset)
TRACKING (IP ou domaine · le DNS est résolu)
  track 8.8.8.8 · trace google.com · où est wikipedia.org
  où suis-je (position du nœud serveur)
MODULES
  affiche les vols · montre les caméras · open recon
  (vols · navires · caméras · câbles · recon · news)
AUTRES
  rafraîchis les flux · reset / vue globale · sitrep / rapport
INSTANT
  help · clear · reset · sitrep
CLAVIER
  /  focus   ↑↓  historique   Échap  couper la voix / annuler le choix
VOIX
  micro = mode continu · parlez, chaque phrase s'exécute
  FR/EN : cliquez le drapeau langue à côté du micro pour basculer`;

let logId = 0;

export default function CommandBar({
  onSetPanel,
  onTrackIp,
  onResetView,
  onRefreshIntel,
  onSitrep,
  onToast,
  onMapStyle,
  onVisualMode,
  blocked = false,
}: CommandBarProps) {
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [showLog, setShowLog] = useState(false);
  const [log, setLog] = useState<LogLine[]>([]);
  const [chips, setChips] = useState<{ id: number; label: string }[]>([]);
  const [choices, setChoices] = useState<{ query: string; options: ChoiceOption[] } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const logBoxRef = useRef<HTMLDivElement>(null);
  const historyRef = useRef<string[]>([]);
  const histIdxRef = useRef<number>(-1);
  const voiceActiveRef = useRef(false);

  const pushLog = useCallback((kind: LogLine['kind'], text: string) => {
    setLog((l) => [{ id: ++logId, kind, text, ts: Date.now() }, ...l].slice(0, 160));
  }, []);

  const pushChip = useCallback((label: string) => {
    const id = ++logId;
    setChips((c) => [...c.slice(-5), { id, label }]);
    setTimeout(() => setChips((c) => c.filter((x) => x.id !== id)), 8000);
  }, []);

  const selectChoice = useCallback(
    (opt: ChoiceOption) => {
      setChoices(null);
      pushLog('action', `▸ fly_to ${opt.lat.toFixed(3)},${opt.lng.toFixed(3)} z${opt.zoom} (choix ${opt.index} : ${opt.label})`);
      pushChip('FLY_TO');
      const fly = (window as any).__osirisMapFlyTo;
      if (fly) fly(opt.lat, opt.lng, opt.zoom);
      else pushLog('error', 'Carte non initialisée');
      try { window.dispatchEvent(new CustomEvent('horus:nav-fly', { detail: { via: 'command', label: opt.label } })); } catch {}
    },
    [pushLog, pushChip]
  );

  useEffect(() => {
    if (blocked) {
      setChoices(null);
      setValue('');
    }
  }, [blocked]);

  const executeActions = useCallback(
    (actions: NavAction[]) => {
      for (const a of actions) {
        const detail =
          a.lat != null ? ` @${Number(a.lat).toFixed(3)},${Number(a.lng).toFixed(3)}${a.zoom != null ? ` z${a.zoom}` : ''}`
          : a.panel ? ` → ${a.panel}`
          : a.style ? ` → ${a.style}`
          : a.ip ? ` → ${a.ip}`
          : a.zoom != null ? ` → ${a.zoom}`
          : a.delta != null ? ` → ${Number(a.delta) > 0 ? '+' : ''}${a.delta}`
          : '';
        pushLog('action', `▸ ${a.action}${detail}`);
        pushChip(String(a.action).toUpperCase());
        switch (a.action) {
          case 'fly_to': {
            const lat = Number(a.lat);
            const lng = Number(a.lng);
            const zoom = Number(a.zoom) || 12;
            if (Number.isFinite(lat) && Number.isFinite(lng)) {
              const fly = (window as any).__osirisMapFlyTo;
              if (fly) fly(lat, lng, zoom);
              else pushLog('error', 'Carte non initialisée');
            }
            break;
          }
          case 'set_panel':
            if (typeof a.panel === 'string') onSetPanel(a.panel);
            break;
          case 'set_map_style':
            if (typeof a.style === 'string') onMapStyle?.(a.style as 'satellite' | 'dark' | 'streets');
            break;
          case 'set_visual_mode':
            if (typeof a.visual === 'string') {
              onVisualMode?.(a.visual as 'flir' | 'nvg' | 'crt' | 'satellite' | 'default');
            }
            break;
          case 'track_ip':
            if (typeof a.ip === 'string') onTrackIp(a.ip, (a.meta as TrackMeta) ?? undefined);
            break;
          case 'reset_view':
            onResetView();
            break;
          case 'refresh_intel':
            onRefreshIntel();
            break;
          case 'sitrep':
            onSitrep()
              .then((brief) => {
                pushLog('sitrep', brief);
                setShowLog(true);
              })
              .catch((e) => pushLog('error', `SITREP failed: ${e}`));
            break;
          case 'set_zoom': {
            const z = Number(a.zoom);
            if (Number.isFinite(z)) {
              const setZoom = (window as any).__osirisMapSetZoom;
              if (setZoom) setZoom(z);
              else pushLog('error', 'Zoom non disponible (carte non initialisée)');
            }
            break;
          }
          case 'zoom_relative': {
            const d = Number(a.delta);
            if (Number.isFinite(d)) {
              const setZoom = (window as any).__osirisMapSetZoom;
              if (setZoom) setZoom(d, true);
              else pushLog('error', 'Zoom non disponible (carte non initialisée)');
            }
            break;
          }
          default:
            break;
        }
      }
    },
    [onSetPanel, onTrackIp, onResetView, onRefreshIntel, onSitrep, onMapStyle, onVisualMode, pushLog, pushChip]
  );

  const runOrder = useCallback(
    async (raw: string, voice = false) => {
      const text = raw.trim();
      if (!text) return;

      if (choices && /^\d+$/.test(text)) {
        const idx = parseInt(text, 10);
        const opt = choices.options.find((o) => o.index === idx);
        if (opt) {
          pushLog('cmd', `❯ ${text}`);
          setValue('');
          selectChoice(opt);
          return;
        }
      }
      setChoices(null);

      pushLog('cmd', `❯ ${text}`);
      if (historyRef.current[0] !== text) {
        historyRef.current.unshift(text);
        historyRef.current = historyRef.current.slice(0, 60);
      }
      histIdxRef.current = -1;
      setValue('');

      const lower = text.toLowerCase();
      if (lower === 'help' || lower === 'aide' || lower === '?' || lower === 'commandes') {
        pushLog('reply', HELP_TEXT);
        setShowLog(true);
        return;
      }
      if (lower === 'clear' || lower === 'cls' || lower === 'vide') {
        setLog([]);
        setChips([]);
        setChoices(null);
        setShowLog(false);
        return;
      }
      if (lower === 'reset' || lower === 'vue globale') {
        onResetView();
        pushChip('RESET');
        return;
      }
      if (lower === 'sitrep' || lower === 'rapport' || lower === 'briefing') {
        setBusy(true);
        try {
          const brief = await onSitrep();
          pushLog('sitrep', brief);
          setShowLog(true);
        } catch {
          pushLog('error', 'Échec de la génération SITREP');
        } finally {
          setBusy(false);
        }
        return;
      }

      setBusy(true);
      const ctrl = new AbortController();
      const abortT = window.setTimeout(() => ctrl.abort(), 12000);
      try {
        const res = await fetch('/api/horus/ai-nav', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text, voice }),
          signal: ctrl.signal,
        });
        const data = await res.json();
        if (data.error) {
          pushLog('error', `ai-nav : ${data.error}`);
        } else {
          if (data.normalized && String(data.normalized).trim().toLowerCase() !== text.toLowerCase()) {
            pushLog('notice', `interprété : « ${data.normalized} »`);
          }
          if (data.reply === 'help') {
            pushLog('reply', HELP_TEXT);
            setShowLog(true);
          } else if (data.reply === 'clear') {
            setLog([]);
            setChips([]);
          } else if (data.reply) {
            pushLog('reply', String(data.reply));
          }
          if (data.track) {
            const t = data.track;
            const chain = [
              t.requested,
              t.resolvedFromDomain ? t.ip : null,
              [t.city, t.region, t.country].filter(Boolean).join(', ') || null,
              [t.rdns, t.isp].filter(Boolean).join(' · ') || null,
            ].filter(Boolean).join(' → ');
            pushLog('track', `⌖ ${chain}${t.ips && t.ips.length > 1 ? ` (+${t.ips.length - 1} autres IP)` : ''}`);
          }
          if (data.geo) {
            const g = data.geo;
            pushLog(
              'geo',
              `📍 ${g.label}${g.sublabel ? ` (${g.sublabel})` : ''} · ${g.category}/${g.type} · importance ${g.importance} · ${g.source}${g.alternatives > 0 ? ` · ${g.alternatives} homonyme(s)` : ''}`
            );
          }
          if (data.disambiguation && Array.isArray(data.disambiguation.options) && data.disambiguation.options.length > 0) {
            setChoices({ query: data.disambiguation.query, options: data.disambiguation.options });
          }
          const actions: NavAction[] = Array.isArray(data.actions) ? data.actions : [];
          executeActions(actions);
          if (data.source) setShowLog((v) => v || actions.length > 0);
        }
      } catch (e) {
        if (e instanceof DOMException && e.name === 'AbortError') {
          pushLog('error', 'délai dépassé · la navigation met trop de temps à répondre, réessayez');
        } else {
          pushLog('error', e instanceof Error ? e.message : 'ordre échoué');
        }
      } finally {
        window.clearTimeout(abortT);
        setBusy(false);
      }
    },
    [choices, executeActions, onResetView, onSitrep, pushLog, pushChip, selectChoice]
  );

  const handleVoiceFinal = useCallback(
    (text: string, meta: VoiceFinalMeta) => {
      if (blocked) return;
      pushLog('voice', `🎙 ${text}${meta.confidence < 0.35 ? ` (confiance ${Math.round(meta.confidence * 100)} % · vérifiez)` : ''}`);
      setValue('');
      void runOrder(text, true);
    },
    [runOrder, pushLog, blocked]
  );

  const [voiceLang, setVoiceLang] = useState<VoiceLang>('fr-FR');
  useEffect(() => {
    setVoiceLang(loadVoiceLang());
  }, []);
  const cycleVoiceLang = useCallback(() => {
    setVoiceLang((l) => {
      const next: VoiceLang = l === 'fr-FR' ? 'en-US' : 'fr-FR';
      saveVoiceLang(next);
      return next;
    });
  }, []);

  const voice = useVoiceCommand({
    onFinal: handleVoiceFinal,
    onInterim: (t) => setValue(t),
    continuous: true,
    lang: voiceLang,
  });

  voiceActiveRef.current = voice.listening;

  const handleServerFinal = useCallback(
    (text: string) => {
      if (blocked) return;
      pushLog('voice', `🎙 ${text}`);
      setValue('');
      void runOrder(text, true);
    },
    [runOrder, pushLog, blocked]
  );
  const serverVoice = useServerVoice({ onFinal: handleServerFinal });

  const voiceMode: 'natif' | 'serveur' | 'aucun' = voice.supported
    ? 'natif'
    : serverVoice.supported
      ? 'serveur'
      : 'aucun';

  const [inIframe, setInIframe] = useState(false);
  useEffect(() => {
    try {
      setInIframe(window.self !== window.top);
    } catch {
      setInIframe(true); // accès cross-origin refusé → probable iframe
    }
  }, []);

  useEffect(() => {
    if (!serverVoice.error) return;
    if (serverVoice.error === 'MIC_PERMISSION_DENIED') {
      pushLog(
        'error',
        `MICRO REFUSÉ · autorisez le micro${inIframe ? ' (aperçu intégré : ouvrez la console dans un nouvel onglet)' : ''}`
      );
      onToast?.(
        inIframe
          ? 'Micro bloqué en aperçu · ouvrez la console dans un nouvel onglet'
          : 'Micro refusé · autorisez le micro dans le navigateur',
        'warn'
      );
    } else {
      pushLog('error', `VOIX SERVEUR : ${serverVoice.error}`);
      onToast?.(`Voix serveur : ${serverVoice.error}`, 'error');
    }
  }, [serverVoice.error, pushLog, onToast, inIframe]);

  useEffect(() => {
    if (voice.error === 'MIC_PERMISSION_DENIED') {
      pushLog('error', 'MICRO REFUSÉ · autorisez le micro dans le navigateur');
      onToast?.('Micro refusé · autorisez le micro dans le navigateur', 'warn');
    } else if (voice.error === 'NO_SPEECH') {
    } else if (voice.error === 'NETWORK_RETRY') {
      pushLog('notice', 'moteur vocal réseau · reprise automatique…');
    } else if (voice.error === 'SILENCE_TIMEOUT') {
      pushLog('notice', 'voix coupée après un long silence · re-cliquez le micro');
    } else if (voice.error) {
      pushLog('error', `VOIX : ${voice.error}`);
    }
  }, [voice.error, pushLog, onToast]);

  const toggleMic = useCallback(() => {
    if (voiceMode === 'serveur') {
      if (serverVoice.state === 'recording') {
        serverVoice.stop();
      } else if (serverVoice.state === 'idle') {
        setMicNeverUsed(false);
        try {
          window.localStorage.setItem('horus-mic-used', '1');
        } catch {
        }
        setValue('');
        void serverVoice.start();
      }
      return;
    }
    if (voiceMode === 'aucun') {
      pushLog('notice', 'voix indisponible sur ce navigateur · Chrome / Edge recommandés');
      onToast?.('Voix indisponible ici · ouvrez la console dans Chrome ou Edge (les ordres clavier restent fonctionnels)', 'warn');
      return;
    }
    if (voice.listening) {
      voice.stop();
      setValue('');
    } else {
      setMicNeverUsed(false);
      try {
        window.localStorage.setItem('horus-mic-used', '1');
      } catch {
      }
      setValue('');
      voice.start();
    }
  }, [voiceMode, serverVoice, voice, pushLog, onToast]);

  const [micNeverUsed, setMicNeverUsed] = useState(false);
  useEffect(() => {
    try {
      if (!window.localStorage.getItem('horus-mic-used')) setMicNeverUsed(true);
    } catch {
    }
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing =
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
      if (e.key === '/' && !typing) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      void runOrder(value);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (historyRef.current.length === 0) return;
      histIdxRef.current = Math.min(histIdxRef.current + 1, historyRef.current.length - 1);
      setValue(historyRef.current[histIdxRef.current] ?? '');
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      histIdxRef.current = Math.max(histIdxRef.current - 1, -1);
      setValue(histIdxRef.current === -1 ? '' : historyRef.current[histIdxRef.current] ?? '');
    } else if (e.key === 'Escape') {
      if (choices) {
        setChoices(null);
        pushLog('notice', 'choix annulé');
      } else if (voice.listening) {
        voice.stop();
      } else if (serverVoice.state === 'recording') {
        serverVoice.cancel();
        pushLog('notice', 'enregistrement vocal annulé');
      } else {
        inputRef.current?.blur();
      }
    }
  };

  useEffect(() => {
    if (logBoxRef.current) logBoxRef.current.scrollTop = 0;
  }, [log]);

  const kindColor: Record<LogLine['kind'], string> = {
    cmd: 'text-cyan-300',
    action: 'text-emerald-400',
    reply: 'text-gray-300',
    voice: 'text-cyan-400',
    error: 'text-red-400',
    sitrep: 'text-amber-300',
    geo: 'text-sky-400',
    track: 'text-orange-400',
    notice: 'text-gray-500',
  };

  return (
    <div className="relative border-t border-cyan-900/40 bg-black/85 backdrop-blur-md flex-shrink-0">
      {showLog && (
        <div
          ref={logBoxRef}
          className="absolute bottom-full left-0 right-0 h-56 overflow-y-auto bg-black/95 border-b border-cyan-900/40 px-3 py-2 space-y-1 z-40"
        >
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-1.5">
              <TerminalSquare className="w-3 h-3 text-cyan-400" />
              <span className="text-[9px] font-mono tracking-[0.25em] text-cyan-400">JOURNAL</span>
              <span className="text-[8px] font-mono text-gray-600">{log.length} ENTRÉES</span>
            </div>
            <button
              onClick={() => setShowLog(false)}
              className="text-gray-500 hover:text-gray-300 transition-colors"
              title="Fermer le journal"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
          {log.length === 0 && (
            <div className="text-[10px] font-mono text-gray-600">journal vide · tapez un ordre ou pressez le micro</div>
          )}
          {log.map((l) => (
            <div key={l.id} className="text-[10px] font-mono whitespace-pre-wrap leading-relaxed">
              <span className="text-gray-700 mr-1.5">
                {new Date(l.ts).toLocaleTimeString('en-GB', { hour12: false })}
              </span>
              <span className={kindColor[l.kind]}>{l.text}</span>
            </div>
          ))}
        </div>
      )}

      {choices && (
        <div className="absolute bottom-full left-0 right-0 z-40 border-b border-cyan-900/40 bg-[#04121c]/97 backdrop-blur-md px-2 py-1.5">
          <div className="flex items-center gap-1.5 mb-1">
            <MapPin className="w-3 h-3 text-amber-400" />
            <span className="text-[9px] font-mono tracking-[0.15em] text-amber-400/90">
              LIEUX TROUVÉS POUR « {choices.query.toUpperCase()} » · TAPEZ 1-{choices.options.length} OU CLIQUEZ (Échap annule)
            </span>
          </div>
          <div className="flex gap-1.5 overflow-x-auto pb-0.5">
            {choices.options.map((o) => (
              <button
                key={o.index}
                onClick={() => selectChoice(o)}
                className="flex-shrink-0 flex items-baseline gap-1.5 px-2 py-1 rounded border border-cyan-800/60 bg-cyan-950/40 hover:bg-cyan-900/50 hover:border-cyan-600 transition-colors text-left"
              >
                <span className="text-[10px] font-mono text-amber-400">{o.index}.</span>
                <span className="text-[10px] font-mono text-gray-200">{o.label}</span>
                {o.sublabel && (
                  <span className="text-[9px] font-mono text-gray-500">
                    {o.sublabel.length > 42 ? `${o.sublabel.slice(0, 42)}…` : o.sublabel}
                  </span>
                )}
                <span className="text-[8px] font-mono text-cyan-700">{o.type || o.category}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center gap-2 px-3 py-1.5">
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <Radio className={`w-3 h-3 ${busy ? 'text-cyan-400 animate-pulse' : 'text-cyan-500/70'}`} />
          <span className="text-[9px] font-mono tracking-[0.2em] text-cyan-400 hidden sm:inline">CMD</span>
        </div>

        <div
          className={`flex-1 flex items-center gap-1.5 bg-black/70 border rounded px-2 py-1 transition-all ${
            voice.listening || serverVoice.state === 'recording'
              ? 'border-red-500/70 shadow-[0_0_12px_rgba(239,68,68,0.35)]'
              : serverVoice.state === 'transcribing'
                ? 'border-amber-500/70 shadow-[0_0_12px_rgba(245,158,11,0.3)]'
                : 'border-cyan-900/40 focus-within:border-cyan-600/60'
          }`}
        >
          <span className={`text-[11px] font-mono flex-shrink-0 ${voice.listening || serverVoice.state === 'recording' ? 'text-red-400 animate-pulse' : serverVoice.state === 'transcribing' ? 'text-amber-400 animate-pulse' : 'text-cyan-500'}`}>
            {voice.listening || serverVoice.state === 'recording' ? '●' : '❯'}
          </span>
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={onKeyDown}
            disabled={busy || blocked}
            placeholder={
              blocked
                ? 'MODE AUTO EN COURS · Échap pour reprendre la main'
                : voice.listening
                ? 'VOIX CONTINUE · parlez… (Échap pour couper)'
                : serverVoice.state === 'recording'
                  ? `ENREGISTREMENT ${serverVoice.elapsed}s · re-cliquez VOIX pour transcrire`
                  : serverVoice.state === 'transcribing'
                    ? 'TRANSCRIPTION EN COURS…'
                    : 'va à Tokyo · zoom 16 · track google.com · rapproche · mode dark · sitrep'
            }
            className="flex-1 bg-transparent border-none outline-none text-gray-200 font-mono text-[11px] placeholder-gray-600 disabled:opacity-50"
            aria-label="Command input"
          />


          <button
            onClick={toggleMic}
            data-tour="voice"
            disabled={blocked}
            title={
              voiceMode === 'natif'
                ? voice.listening
                  ? 'Couper la voix continue (Échap)'
                  : 'Voix continue · cliquez puis parlez : « va à Bamako », « track google.com »…'
                : voiceMode === 'serveur'
                  ? serverVoice.state === 'recording'
                    ? `Enregistrement (${serverVoice.elapsed}s) · re-cliquez pour transcrire (Échap pour annuler)`
                    : 'Voix serveur · cliquez, parlez, re-cliquez : « va à Bamako », « track google.com »…'
                  : 'Voix indisponible sur ce navigateur · ouvrez la console dans Chrome ou Edge (les ordres clavier restent fonctionnels)'
            }
            className={`relative flex-shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-md font-mono tracking-[0.18em] transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
              voiceMode === 'aucun'
                ? 'bg-black/40 border border-dashed border-gray-600/60 text-gray-500 cursor-help'
                : voice.listening || serverVoice.state === 'recording'
                  ? 'bg-red-500/25 border border-red-400/80 text-red-300 animate-pulse shadow-[0_0_14px_rgba(239,68,68,0.45)]'
                  : serverVoice.state === 'transcribing'
                    ? 'bg-amber-500/20 border border-amber-400/70 text-amber-200 shadow-[0_0_10px_rgba(245,158,11,0.25)]'
                    : 'bg-cyan-500/15 border border-cyan-400/70 text-cyan-200 hover:bg-cyan-400/25 hover:border-cyan-300 shadow-[0_0_10px_rgba(53,224,255,0.22)]'
            }`}
          >
            {voice.listening || serverVoice.state === 'recording' ? (
              <MicOff className="w-4 h-4" />
            ) : (
              <Mic className="w-4 h-4" />
            )}
            <span className="text-[10px] font-bold">
              {serverVoice.state === 'recording'
                ? `REC ${serverVoice.elapsed}s`
                : serverVoice.state === 'transcribing'
                  ? '…TXT'
                  : voice.listening
                    ? 'REC'
                    : voiceMode === 'aucun'
                      ? 'VOIX ✕'
                      : 'VOIX'}
            </span>
            {voiceMode !== 'aucun' && !voice.listening && serverVoice.state === 'idle' && micNeverUsed && (
              <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-cyan-300 animate-ping" />
            )}
          </button>
          <button
            onClick={cycleVoiceLang}
            title={`Langue vocale : ${voiceLang === 'fr-FR' ? 'français' : 'anglais'} · cliquer pour basculer`}
            className={`flex-shrink-0 flex items-center gap-0.5 px-1.5 py-1 rounded border transition-colors ${
              voice.listening || serverVoice.state === 'recording'
                ? 'border-red-500/40 text-red-300/90'
                : 'border-cyan-900/50 text-cyan-400/80 hover:border-cyan-600 hover:text-cyan-300'
            }`}
          >
            <Languages className="w-3 h-3" />
            <span className="text-[9px] font-mono tracking-wider">
              {voiceLang === 'fr-FR' ? 'FR' : 'EN'}
            </span>
          </button>

          <button
            onClick={() => void runOrder(value)}
            disabled={busy || !value.trim() || blocked}
            className="flex-shrink-0 flex items-center gap-1 px-2 py-0.5 rounded bg-cyan-900/40 border border-cyan-700/50 text-[9px] font-mono tracking-wider text-cyan-300 hover:bg-cyan-800/50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <CornerDownLeft className="w-2.5 h-2.5" />
            EXEC
          </button>

          <button
            onClick={() => setShowLog((v) => !v)}
            title="Basculer le journal"
            className={`flex-shrink-0 p-1 rounded transition-colors border ${
              showLog
                ? 'bg-cyan-900/40 border border-cyan-700/50 text-cyan-300'
                : 'text-gray-500 hover:text-gray-300 border-transparent hover:border-gray-700'
            }`}
          >
            <TerminalSquare className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="hidden md:flex items-center gap-1 flex-shrink-0">
          {chips.map((c) => (
            <span
              key={c.id}
              className="px-1.5 py-0.5 rounded bg-emerald-900/30 border border-emerald-700/40 text-[8px] font-mono text-emerald-400"
            >
              {c.label}
            </span>
          ))}
        </div>
      </div>

      <div className="px-3 pb-1 -mt-0.5 flex items-center gap-3 text-[8px] font-mono text-gray-600">
        <span><span className="text-gray-500">/</span> focus</span>
        <span><span className="text-gray-500">↑↓</span> historique</span>
        {voiceMode !== 'aucun' && (
          <span>
            <span className="text-gray-500">🎙</span>{' '}
            {voiceMode === 'natif' ? 'voix continue' : 'voix push-to-talk'}{' '}
            <span className="text-gray-700">{voiceLang}</span>
          </span>
        )}
        {inIframe && (
          <span className="text-amber-600/90" title="Les navigateurs bloquent souvent le micro dans les aperçus intégrés">
            ⚠ micro limité en aperçu · ouvrir dans un nouvel onglet
          </span>
        )}
        {choices && <span className="text-amber-500/80">1-{choices.options.length} pour choisir le lieu</span>}
        {blocked && <span className="text-cyan-500/90">MODE AUTO pilote la console · Échap pour reprendre la main</span>}
        <span className="hidden lg:inline"><span className="text-gray-500">help</span> référence</span>
        <span className="ml-auto hidden lg:inline">NAV · FR/EN · REGEX+LLM</span>
      </div>
    </div>
  );
}
