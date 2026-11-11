'use client';


import { useCallback, useEffect, useRef, useState } from 'react';
import { ShieldCheck, User, ArrowRight, Radio } from 'lucide-react';
import AesTitleIntro from './AesTitleIntro';

const BOOT_LINES = [
  'INITIALISATION DU NOYAU AES CERT … OK',
  'VÉRIFICATION INTÉGRITÉ DES MODULES … OK',
  'CONNEXION AUX SOURCES OSINT … 11 FLUX',
  'MICRO VOIX CONTINUE … ARMÉ',
  'MOTEUR CARTOGRAPHIQUE … EN LIGNE',
  'ACCÈS OPÉRATEUR ACCORDÉ · SYSTÈME PRÊT',
];

const BOOT_MS = 1700;
const INTRO_MS = 3600;
const LOGIN_BG = '#050a12';

export default function LoginGate({ onDone }: { onDone: () => void }) {
  const [mounted, setMounted] = useState(false);
  const [stage, setStage] = useState<'intro' | 'login' | 'boot'>('login');
  const [introFading, setIntroFading] = useState(false);

  const introLeftRef = useRef(false);


  const leaveIntro = useCallback(() => {
    if (introLeftRef.current) return;
    introLeftRef.current = true;
    setIntroFading(true);
    setTimeout(() => {
      setIntroFading(false);
      setStage('login');
    }, 330);
  }, []);

  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      setStage('intro'); // l'ident se joue TOUJOURS à l'entrée
      setMounted(true);
    });
    return () => cancelAnimationFrame(raf);
  }, []);
  const [operator, setOperator] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [signing, setSigning] = useState(false);
  const [shake, setShake] = useState(false);
  const [bootLine, setBootLine] = useState(0);
  const [fading, setFading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const onDoneRef = useRef(onDone);
  useEffect(() => {
    onDoneRef.current = onDone;
  }, [onDone]);

  useEffect(() => {
    if (stage !== 'boot') return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const step = (BOOT_MS - 400) / BOOT_LINES.length;
    BOOT_LINES.forEach((_, i) => {
      timers.push(setTimeout(() => setBootLine(i + 1), 200 + i * step));
    });
    timers.push(setTimeout(() => setFading(true), BOOT_MS - 200));
    timers.push(setTimeout(() => onDoneRef.current(), BOOT_MS));
    return () => timers.forEach(clearTimeout);
  }, [stage]);

  useEffect(() => {
    if (stage !== 'intro') return;
    const t = setTimeout(leaveIntro, INTRO_MS);
    return () => clearTimeout(t);
  }, [stage, leaveIntro]);

  useEffect(() => {
    if (stage === 'login') requestAnimationFrame(() => inputRef.current?.focus());
  }, [stage]);

  // PRISE DE POSTE RÉELLE — l'ancien bouton "ACCÈS DÉMO" est supprimé :
  // l'indicatif opérateur est enregistré en base (registre Operator +
  // journal WatchLog) et alimente la piste d'audit des agents.
  const authenticate = useCallback(async () => {
    const cs = operator.trim();
    if (cs.length < 3) {
      setError('INDICATIF REQUIS · 3 caractères minimum');
      setShake(true);
      setTimeout(() => setShake(false), 420);
      return;
    }
    setSigning(true);
    setError(null);
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 9000);
      const res = await fetch('/api/osint/operator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ callsign: cs }),
        signal: ctrl.signal,
      });
      clearTimeout(t);
      const data = await res.json().catch(() => null);
      if (!res.ok || data?.status !== 'ok') {
        throw new Error(String(data?.message ?? `serveur ${res.status}`));
      }
      try { sessionStorage.setItem('horus-operator', data.operator.callsign); } catch {}
      setStage('boot');
    } catch (e) {
      const aborted = e instanceof DOMException && e.name === 'AbortError';
      setError(aborted ? 'SERVEUR SANS RÉPONSE · réessayez' : `PRISE DE POSTE REFUSÉE · ${e instanceof Error ? e.message : 'erreur'}`);
      setShake(true);
      setTimeout(() => setShake(false), 420);
    } finally {
      setSigning(false);
    }
  }, [operator]);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    authenticate();
  };

  if (!mounted) {
    return (
      <div
        className="fixed inset-0 z-[9999]"
        style={{
          background: `radial-gradient(120% 120% at 50% 30%, #0a1522 0%, ${LOGIN_BG} 60%, #02060b 100%)`,
        }}
      />
    );
  }

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden"
      style={{
        background: `radial-gradient(120% 120% at 50% 30%, #0a1522 0%, ${LOGIN_BG} 60%, #02060b 100%)`,
        opacity: fading || introFading ? 0 : 1,
        transition: 'opacity 320ms ease-out',
        fontFamily: 'var(--font-geist-mono), ui-monospace, Menlo, monospace',
      }}
    >
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(46% 38% at 50% 42%, rgba(53,224,255,0.07), transparent 70%)',
        }}
      />

      {stage === 'intro' ? (
        <AesTitleIntro onSkip={leaveIntro} />
      ) : stage === 'login' ? (
        <div className="relative flex flex-col items-center">
          <form
            onSubmit={onSubmit}
            className="relative flex flex-col items-center gap-5 w-[340px] px-7 py-8"
            style={{
              background: 'linear-gradient(160deg, rgba(18,30,42,0.78), rgba(8,14,22,0.6))',
              backdropFilter: 'blur(18px) saturate(170%)',
              WebkitBackdropFilter: 'blur(18px) saturate(170%)',
              border: '1px solid rgba(140,220,255,0.16)',
              borderRadius: 16,
              boxShadow:
                '0 10px 40px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.1)',
              animation: shake
                ? 'aescert-shake 0.4s ease'
                : 'aescert-rise 0.45s cubic-bezier(0.4,0,0.2,1)',
            }}
          >
          <div className="flex flex-col items-center gap-2">
            <div
              className="flex items-center justify-center w-14 h-14 rounded-2xl"
              style={{
                background: 'rgba(53,224,255,0.1)',
                border: '1px solid rgba(53,224,255,0.35)',
                boxShadow: '0 0 24px rgba(53,224,255,0.18)',
              }}
            >
              <ShieldCheck className="w-7 h-7" style={{ color: '#35e0ff' }} />
            </div>
            <div className="text-center">
              <div
                className="text-[19px] font-semibold tracking-[0.28em]"
                style={{ color: '#d8f3ff', textShadow: '0 0 14px rgba(53,224,255,0.45)' }}
              >
                AES&nbsp;CERT
              </div>
              <div className="text-[9px] tracking-[0.22em] mt-1" style={{ color: '#7fa8bd' }}>
                SYSTÈME DE CYBERENSEIGNEMENT
              </div>
            </div>
          </div>

          <div className="w-full flex flex-col gap-3 mt-1">
            <label className="flex items-center gap-2.5 px-3 py-2 rounded-lg"
              style={{ background: 'rgba(8,14,22,0.7)', border: '1px solid rgba(140,220,255,0.22)' }}
            >
              <User className="w-3.5 h-3.5 flex-shrink-0" style={{ color: '#7fa8bd' }} />
              <input
                ref={inputRef}
                value={operator}
                onChange={(e) => setOperator(e.target.value)}
                placeholder="INDICATIF OPÉRATEUR · EX. WATCH-01"
                spellCheck={false}
                autoComplete="off"
                maxLength={24}
                className="flex-1 bg-transparent border-0 outline-none text-[11px] tracking-[0.12em]"
                style={{ color: '#d8f3ff' }}
              />
            </label>
            {error && (
              <div className="text-[9px] tracking-[0.14em] px-1" style={{ color: '#ff7b7b' }}>
                {error}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-2 w-full mt-1">
            <button
              type="submit"
              disabled={signing}
              className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg text-[11px] font-semibold tracking-[0.22em] transition-all"
              style={{
                background: 'rgba(53,224,255,0.14)',
                border: '1px solid rgba(53,224,255,0.5)',
                color: '#9ceaff',
                boxShadow: '0 0 18px rgba(53,224,255,0.12)',
                opacity: signing ? 0.6 : 1,
              }}
            >
              {signing ? 'ENREGISTREMENT…' : 'PRISE DE POSTE'}
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="text-[8px] tracking-[0.14em] mt-1" style={{ color: 'rgba(127,168,189,0.55)' }}>
            ACCÈS PÉDAGOGIQUE · AUCUNE DONNÉE SENSIBLE N'EST EXPOSÉE
          </div>
        </form>
        </div>
      ) : (
        <div className="relative flex flex-col items-center gap-5 w-[380px]">
          <div className="flex items-center gap-3">
            <div
              className="flex items-center justify-center w-11 h-11 rounded-xl"
              style={{
                background: 'rgba(53,224,255,0.1)',
                border: '1px solid rgba(53,224,255,0.4)',
                boxShadow: '0 0 26px rgba(53,224,255,0.22)',
                animation: 'aescert-breathe 1.4s ease-in-out infinite',
              }}
            >
              <ShieldCheck className="w-5.5 h-5.5" style={{ color: '#35e0ff', width: 22, height: 22 }} />
            </div>
            <div>
              <div
                className="text-[17px] font-semibold tracking-[0.3em]"
                style={{ color: '#d8f3ff', textShadow: '0 0 14px rgba(53,224,255,0.5)' }}
              >
                AES&nbsp;CERT
              </div>
              <div className="text-[8px] tracking-[0.2em]" style={{ color: '#7fa8bd' }}>
                INITIALISATION DE LA CONSOLE
              </div>
            </div>
          </div>

          <div
            className="w-full px-4 py-3 rounded-lg flex flex-col gap-1.5"
            style={{
              background: 'rgba(8,14,22,0.72)',
              border: '1px solid rgba(140,220,255,0.14)',
              minHeight: 132,
            }}
          >
            {BOOT_LINES.slice(0, bootLine).map((l, i) => (
              <div
                key={l}
                className="flex items-center gap-2 text-[10px] tracking-[0.08em]"
                style={{ color: i === BOOT_LINES.length - 1 ? '#4dffb0' : '#7fa8bd', animation: 'aescert-line 0.25s ease-out' }}
              >
                <Radio className="w-2.5 h-2.5 flex-shrink-0" style={{ color: i === BOOT_LINES.length - 1 ? '#4dffb0' : '#35e0ff' }} />
                {l}
              </div>
            ))}
          </div>

          <div className="w-full h-[2px]" style={{ background: 'rgba(140,220,255,0.12)', overflow: 'hidden', borderRadius: 1 }}>
            <div
              style={{
                height: '100%',
                width: `${Math.round((bootLine / BOOT_LINES.length) * 100)}%`,
                background: 'linear-gradient(90deg, #35e0ff, #4dffb0)',
                boxShadow: '0 0 8px rgba(53,224,255,0.5)',
                transition: 'width 0.25s ease-out',
              }}
            />
          </div>
        </div>
      )}

      <style
        dangerouslySetInnerHTML={{
          __html: `
        @keyframes aescert-rise {
          from { opacity: 0; transform: translateY(14px) scale(0.985); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes aescert-shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-7px); }
          75% { transform: translateX(7px); }
        }
        @keyframes aescert-breathe {
          0%, 100% { box-shadow: 0 0 26px rgba(53,224,255,0.22); }
          50% { box-shadow: 0 0 42px rgba(53,224,255,0.4); }
        }
        @keyframes aescert-line {
          from { opacity: 0; transform: translateX(-8px); }
          to { opacity: 1; transform: translateX(0); }
        }
      `,
        }}
      />
    </div>
  );
}
