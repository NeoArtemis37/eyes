'use client';


import { useEffect, useState, useCallback, useRef } from 'react';
import { HelpCircle, X, ChevronRight, Eye, Search, Box, MapPin, Layers, Mic } from 'lucide-react';

interface TourStep {
  target?: string;
  growBottom?: number;
  icon: React.ReactNode;
  title: string;
  body: string;
}

const STEPS: TourStep[] = [
  {
    icon: <Eye className="w-4 h-4" />,
    title: 'Bienvenue sur AES CERT',
    body: "La console de cyberenseignement : des flux OSINT réels (vols, navires, caméras IP, câbles sous-marins, menaces réseau) sur une carte monde vivante. Visite éclair de 40 secondes ?",
  },
  {
    target: '.hp-switcher',
    icon: <Layers className="w-4 h-4" />,
    title: '3 vues, 1 clic',
    body: 'CARTE · le globe mondial OSINT · RÉSEAU · menaces réseau en temps réel (flux, dark web, recon) · ALERTS · le décompte des signaux.',
  },
  {
    target: '.hp-rail',
    icon: <Layers className="w-4 h-4" />,
    title: '5 modules',
    body: 'VOLS · NAVIRES · CAMÉRAS · CÂBLES · NEWS. Un clic ouvre le panneau du module, un re-clic le referme. La carte affiche les points du module actif.',
  },
  {
    target: '[data-tour="map-search"]',
    growBottom: 300,
    icon: <Search className="w-4 h-4" />,
    title: 'Chercher & explorer',
    body: 'Essayez maintenant : tapez une ville (« Bamako ») et cliquez un résultat — la carte y vole. Cette zone reste active pendant la visite. Clic droit sur un pays = fiche pays.',
  },
  {
    target: '[data-tour="map-3d"]',
    icon: <Box className="w-4 h-4" />,
    title: 'Bâtiments semi-3D',
    body: "Activez 3D : la vue s'incline et les bâtiments s'extrudent en relief (données OpenStreetMap). Zoomez au niveau rue pour l'effet complet.",
  },
  {
    target: '[data-tour="geoloc"]',
    icon: <MapPin className="w-4 h-4" />,
    title: 'Auto-localisation',
    body: "Le bouton GPS recentre la carte sur votre position réelle et pose un marqueur « VOUS ÊTES ICI ». Autorisez la géolocalisation dans le navigateur.",
  },
  {
    target: '[data-tour="voice"]',
    icon: <Mic className="w-4 h-4" />,
    title: 'Commandes vocales & clavier',
    body: "« va à Bamako », « zoom 12 », « montre les caméras »… Le micro (FR/EN) est en bas de l'écran ; tapez aussi vos ordres au clavier dans la barre de commande.",
  },
  {
    icon: <ChevronRight className="w-4 h-4" />,
    title: 'Prêt·e à surveiller',
    body: 'Cliquez n’importe quel point de la carte pour l’inspecter, puis TRACK (suivi) ou LOCK (verrouillage caméra). Le bouton AIDE (?) rejoue cette visite à tout moment.',
  },
];

export default function OnboardingTour({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    const compute = () => {
      const sel = STEPS[step]?.target;
      if (!sel) { setRect(null); return; }
      const el = document.querySelector(sel);
      if (!el) { setRect(null); return; }
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) { setRect(null); return; }
      setRect(r);
    };
    compute();
    const t1 = setTimeout(compute, 150);
    const t2 = setTimeout(compute, 600);
    const sel = STEPS[step]?.target;
    let retry: number | undefined;
    let stopRetry: number | undefined;
    if (sel) {
      // la cible peut apparaître tard (import dynamique de la carte, re-render) :
      // on réessaie jusqu'à ce qu'elle soit mesurable, sinon la visite retombe
      // sur un voile plein écran qui bloque tout.
      retry = window.setInterval(() => {
        const el = document.querySelector(sel);
        if (!el) return;
        const r = el.getBoundingClientRect();
        if (r.width >= 2 && r.height >= 2) {
          compute();
          if (retry) window.clearInterval(retry);
          retry = undefined;
        }
      }, 400);
      stopRetry = window.setTimeout(() => {
        if (retry) window.clearInterval(retry);
        retry = undefined;
      }, 10000);
    }
    window.addEventListener('resize', compute);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      if (retry) clearInterval(retry);
      if (stopRetry) clearTimeout(stopRetry);
      window.removeEventListener('resize', compute);
    };
  }, [step]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Étape « Chercher & explorer » : dès que l'utilisateur choisit VRAIMENT une
  // destination (recherche carte ou barre de commande → vol engagé), la visite
  // réagit et avance d'elle-même — plus aucune impression de prompteur figé
  // après la sélection.
  const stepRef = useRef(0);
  useEffect(() => { stepRef.current = step; }, [step]);
  useEffect(() => {
    const onFly = () => {
      if (stepRef.current !== 3) return;
      window.setTimeout(() => {
        if (stepRef.current === 3) setStep((s) => s + 1);
      }, 1400);
    };
    window.addEventListener('horus:nav-fly', onFly);
    return () => window.removeEventListener('horus:nav-fly', onFly);
  }, []);

  const next = useCallback(() => {
    if (step >= STEPS.length - 1) {
      onClose();
      return;
    }
    setStep((s) => s + 1);
  }, [step, onClose]);

  if (typeof window === 'undefined') return null;

  const s = STEPS[step];
  const isLast = step === STEPS.length - 1;

  const pad = 8;
  const hole = rect
    ? {
        left: rect.left - pad,
        top: rect.top - pad,
        width: rect.width + pad * 2,
        height: rect.height + pad * 2 + (s.growBottom ?? 0),
      }
    : null;

  const CARD_W = 320;
  const CARD_H_EST = 172;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  let cardStyle: React.CSSProperties;
  if (!rect || !hole) {
    cardStyle = {
      left: '50%', top: '50%',
      transform: 'translate(-50%, -50%)',
      width: 'min(360px, calc(100vw - 32px))',
    };
  } else {
    const belowTop = hole.top + hole.height + 14;
    let left = hole.left + hole.width / 2 - CARD_W / 2;
    left = Math.max(12, Math.min(left, vw - CARD_W - 12));
    let top = belowTop;
    const fitsBelow = belowTop + CARD_H_EST < vh - 12;
    if (!fitsBelow) {
      const rightLeft = hole.left + hole.width + 46;
      const fitsRight = rightLeft + CARD_W < vw - 12;
      if (fitsRight) {
        left = rightLeft;
        top = Math.max(12, Math.min(hole.top, vh - CARD_H_EST - 12));
      } else {
        top = Math.max(12, hole.top - CARD_H_EST - 14);
      }
    }
    if (top < hole.top + hole.height && top + CARD_H_EST > hole.top && left < hole.left + hole.width && left + CARD_W > hole.left) {
      top = Math.min(hole.top + hole.height + 14, Math.max(12, vh - CARD_H_EST - 12));
    }
    cardStyle = { left, top, width: `min(${CARD_W}px, calc(100vw - 24px))` };
  }

  return (
    <>
      {hole ? (
        <>
          <div className="tour-pane" onClick={onClose} style={{ left: 0, top: 0, width: vw, height: Math.max(0, hole.top) }} />
          <div className="tour-pane" onClick={onClose} style={{ left: 0, top: hole.top + hole.height, width: vw, height: Math.max(0, vh - hole.top - hole.height) }} />
          <div className="tour-pane" onClick={onClose} style={{ left: 0, top: hole.top, width: Math.max(0, hole.left), height: hole.height }} />
          <div className="tour-pane" onClick={onClose} style={{ left: hole.left + hole.width, top: hole.top, width: Math.max(0, vw - hole.left - hole.width), height: hole.height }} />
          <div
            className="tour-hole"
            style={{
              left: hole.left,
              top: hole.top,
              width: hole.width,
              height: hole.height,
              boxShadow: '0 0 0 200vmax rgba(3, 8, 16, 0.78)',
            }}
          />
        </>
      ) : (
        <>
          <div className="tour-catcher" onClick={onClose} />
          <div className="tour-hole-fullscreen" onClick={onClose} />
        </>
      )}

      <div className="tour-card" style={cardStyle}>
        <div className="tour-card-head">
          <span className="tour-step-badge">
            {s.icon}
            <span>ÉTAPE {step + 1}/{STEPS.length}</span>
          </span>
          <button className="tour-close" onClick={onClose} title="Passer la visite"><X className="w-3 h-3" /></button>
        </div>
        <h3 className="tour-title">{s.title}</h3>
        <p className="tour-body">{s.body}</p>
        <div className="tour-progress" aria-hidden>
          {STEPS.map((_, i) => (
            <span key={i} className={`tour-dot ${i === step ? 'is-on' : i < step ? 'is-done' : ''}`} />
          ))}
        </div>
        <div className="tour-actions">
          <button className="tour-btn is-ghost" onClick={onClose}>PASSER</button>
          <button className="tour-btn is-main" onClick={next}>
            {isLast ? 'TERMINER' : 'SUIVANT'} {isLast ? <HelpCircle className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          </button>
        </div>
      </div>
    </>
  );
}
