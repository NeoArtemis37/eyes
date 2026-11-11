'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  X, Plane, Camera as CamIcon, Network, Database,
  Bot, Radar, Newspaper, Globe, Sparkles,
} from 'lucide-react';
import type { GlobePoint } from '@/lib/osint-data';
import { initKeySfx, playKey, duckMusic } from '@/lib/tourAudio';

type ModuleId = 'flights' | 'vessels' | 'cameras' | 'cables' | 'news';
type Phase = 'surveillance' | 'intel';

type Props = {
  points: GlobePoint[];
  onPhase: (p: Phase) => void;
  onModule: (id: ModuleId) => void;
  onModuleClose: () => void;
  onSelectPoint: (p: GlobePoint) => void;
  onCloseDetail: () => void;
  onCameraView: (cam: any, zoom?: number, opts?: { pitch?: number; bearing?: number; dur?: number }) => void;
  onCloseBubble: () => void;
  onEnd: () => void;
};

const Z_STREET = 19;
const Z_CAM = 17;
const WARP_MS = 700;
const WARP_QUICK_MS = 520;

// ─────────────────────────────────────────────────────────────────────────────
// SCRIPT DE PRÉSENTATION · texte livré par le Commandement (fidélité mot à mot)
// ─────────────────────────────────────────────────────────────────────────────
const T_AESBOT =
  'Je suis AesBot, unité de démonstration du dispositif AES-CERT. Accrochez-vous et suivez-moi pour cette aventure.';

const T_OUVERTURE =
  'Messieurs les Membres du Commandement, Chers Camarades — aujourd’hui, la guerre a changé de visage : elle n’est plus seulement physique, elle est devenue intégralement numérique. Pour garantir la sécurité nationale, notre doctrine doit basculer d’une posture réactive à une sécurité proactive et anticipative. Voici la feuille de route opérationnelle de notre dispositif de cyberrenseignement de masse.';

const AXE1_TITRE = 'AXE 1 — DOMINATION INFORMATIONNELLE ET SÉCURITÉ OPÉRATIONNELLE';
const AXE2_TITRE = 'AXE 2 — LA GUERRE AU VISAGE NUMÉRIQUE ET THREAT INTELLIGENCE';

const T_MEDIA =
  'Les médias constituent désormais le principal canal de communication de l’État et de ses adversaires. Notre premier pilier consiste à scruter et neutraliser la désinformation, les fausses rumeurs et la propagande visant à déstabiliser nos institutions ou notre image.';

const T_CNN =
  'Grâce aux algorithmes de vision par ordinateur reposant sur des réseaux de neurones convolutionnels (CNN), nous déployons la reconnaissance faciale automatisée sur nos points chauds : aéroports, frontières, infrastructures critiques et lieux de grand rassemblement. Ce dispositif permet d’identifier immédiatement les individus en cavale, de placer sous observation les suspects et de cartographier les réseaux de trafic.';

const T_SIGINT =
  'Au lieu de disperser nos capacités d’écoute, nous filtrons automatiquement les liaisons téléphoniques et émissions hertziennes suspectes émanant de zones dites inhabitées ou à risque élevé (anciennes bases terroristes, forêts, zones désertes). Cela réduit le périmètre de recherche et permet de désamorcer les menaces naissantes avant leur passage à l’acte.';

const T_OPS =
  'En centralisant l’imagerie et le flux de données, nous offrons une vue situationnelle globale. Cela garantit une meilleure prise de décision, optimise le déploiement des forces d’intervention et réduit les risques lors des rassemblements majeurs ou des événements de crise.';

const T_AIR =
  'En recoupant les signaux des vols commerciaux certifiés, nos radars identifient instantanément toute anomalie : violations de l’espace aérien, appareils non identifiés et itinéraires de vol suspects liés à l’espionnage ou au transport de substances illicites.';

const T_CYBER =
  'Le cyberespace héberge désormais des marchés noirs spécialisés dans la vente de données volées et de malwares ciblant nos infrastructures critiques (banques, administrations centrales). Nous infiltrons et surveillons ces groupes pour bloquer l’acquisition et l’usage d’outils offensifs.';

const T_LEAKS =
  'En historisant et en cartographiant les fuites de données confirmées – y compris en analysant les détails techniques des compromissions subies par nos voisins et partenaires – nous pouvons anticiper les vecteurs d’attaque et appliquer les correctifs de sécurité avant que nos propres systèmes ne soient pris pour cible.';

const FINALE_TEXT =
  'Le renseignement est l’arme la plus puissante d’un État souverain. En couplant le renseignement d’origine image (CNN), l’interception de signaux stratégiques (SIGINT) et la Threat Intelligence cyber, nous maîtrisons le territoire physique comme le cyberespace.';

type BreachStop = {
  iso: string;
  flag: string;
  name: string;
  title: string;
  text: string;
};

const BREACH_STOPS: BreachStop[] = [
  {
    iso: 'BF',
    flag: '🇧🇫',
    name: 'Burkina Faso',
    title: 'West African Resources × Deadlock · 2026',
    text: 'Burkina Faso, la plus récente : juillet 2026 — le rançongiciel Deadlock publie comptabilité, salaires et contrats bancaires de West African Resources. Une menace germinante devenue crise nationale.',
  },
  {
    iso: 'ML',
    flag: '🇲🇱',
    name: 'Mali',
    title: 'BOA Mali · rançon 10 M$ · 2023',
    text: 'Mali, la plus récente : février 2023 — la BOA Mali subit une extorsion, dix millions de dollars exigés ; ministères, ambassades et ONG parmi les comptes visés.',
  },
  {
    iso: 'NE',
    flag: '🇳🇪',
    name: 'Niger',
    title: 'Pertes +70 % à +400 % · 2022-2024',
    text: 'Niger, la plus récente : de 2022 à 2024, les pertes liées aux cyberattaques bondissent de 70 % à 400 % — l’État répond en créant son CNAC.',
  },
];

const TOTAL_STEPS = 12;

// Verrou global d'époque : seul le dernier montage du composant peut piloter le tour.
let tourEpoch = 0;

type CardState = {
  icon: React.ReactNode;
  kicker: string;
  title: string;
  body: string;
  anchor?: 'center' | 'left';
} | null;
type ArrowDef = { sel: string; side: 'top' | 'left' | 'right'; title: string; body: string };

function pickFlight(points: GlobePoint[]): GlobePoint | null {
  const flights = points.filter((p) => p.type === 'flight');
  if (flights.length === 0) return null;
  return (
    flights.find((p) => {
      const d = p.rawData as any;
      return d && (d.callsign || d.icao24) && Number.isFinite(d.altitude ?? d.baro_altitude);
    }) ?? flights[0]
  );
}

function pickCameras(points: GlobePoint[], want: number): GlobePoint[] {
  const online = points.filter((p) => {
    if (p.type !== 'camera') return false;
    const d = (p.rawData ?? {}) as any;
    return d?.status === 'online' && String(d?.streamUrl ?? '').includes('.m3u8');
  });
  if (online.length === 0) return [];
  if (online.length <= want) return online;
  const byCountry = new Map<string, GlobePoint[]>();
  for (const p of online) {
    const key = String((p.rawData as any)?.country ?? (p.rawData as any)?.location ?? 'zz');
    if (!byCountry.has(key)) byCountry.set(key, []);
    byCountry.get(key)!.push(p);
  }
  const out: GlobePoint[] = [];
  let added = true;
  while (out.length < want && added) {
    added = false;
    for (const list of byCountry.values()) {
      if (list.length > 0 && out.length < want) {
        out.push(list.shift()!);
        added = true;
      }
    }
  }
  return out;
}

function MonoType({ text }: { text: string }) {
  const [n, setN] = useState(0);

  useEffect(() => {
    let alive = true;
    let i = 0;
    const timers: number[] = [];
    duckMusic(true);
    // Frappe ancrée sur l'horloge : si la machine rame, chaque tick rattrape son
    // retard d'un coup — la frappe ne peut JAMAIS dépasser son tempo nominal.
    const t0 = Date.now();
    const PERIOD = 23; // ms/caractère nominal
    const tick = () => {
      if (!alive) return;
      const target = Math.min(text.length, 1 + Math.floor((Date.now() - t0 - 120) / PERIOD));
      if (target > i) {
        const ch = text[i];
        i = target;
        setN(i);
        if (ch === ' ') {
          if (Math.random() < 0.35) playKey('space');
        } else if (Math.random() < 0.45) {
          playKey('key');
        }
      }
      if (i < text.length) {
        timers.push(window.setTimeout(tick, 10));
      } else {
        playKey('return');
        duckMusic(false);
        window.dispatchEvent(new CustomEvent('horus:mono-done', { detail: { text } }));
      }
    };
    timers.push(window.setTimeout(tick, 120));
    return () => {
      alive = false;
      timers.forEach((t) => window.clearTimeout(t));
      duckMusic(false);
    };
  }, [text]);

  return (
    <>
      {text.slice(0, n)}
      <span className="at-cursor" />
    </>
  );
}

export default function AutoTour(props: Props) {
  const {
    points, onPhase, onModule, onModuleClose, onSelectPoint, onCloseDetail,
    onCameraView, onCloseBubble, onEnd,
  } = props;

  const [step, setStep] = useState({ idx: 1, label: 'AESBOT' });
  const [card, setCard] = useState<CardState>(null);
  const [arrows, setArrows] = useState<ArrowDef[]>([]);
  const [inter, setInter] = useState<{ title: string; sub: string; long?: boolean } | null>(null);
  const [finale, setFinale] = useState<'type' | 'veille' | 'out' | null>(null);
  const [warp, setWarp] = useState<{ on: boolean; k: number; quick: boolean } | null>(null);

  const cancelledRef = useRef(false);
  const warpKRef = useRef(0);
  const pointsRef = useRef(points);
  const cbsRef = useRef({ onPhase, onModule, onModuleClose, onSelectPoint, onCloseDetail, onCameraView, onCloseBubble, onEnd });

  useEffect(() => {
    pointsRef.current = points;
    cbsRef.current = {
      onPhase, onModule, onModuleClose, onSelectPoint, onCloseDetail,
      onCameraView, onCloseBubble, onEnd,
    };
  });

  const quit = useCallback(() => {
    cancelledRef.current = true;
    window.dispatchEvent(new Event('tour-wake'));
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') quit();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [quit]);

  useEffect(() => {
    cancelledRef.current = false;
    let alive = true;
    const myEpoch = ++tourEpoch;

    const STOP = Symbol('tour-stop');
    const chk = () => {
      if (!alive || cancelledRef.current || myEpoch !== tourEpoch) throw STOP;
    };
    const wait = (ms: number) =>
      new Promise<void>((resolve) => {
        if (!alive || cancelledRef.current || myEpoch !== tourEpoch) {
          resolve();
          return;
        }
        let done = false;
        const finish = () => {
          if (done) return;
          done = true;
          window.clearTimeout(t);
          window.removeEventListener('tour-wake', finish);
          resolve();
        };
        const t = window.setTimeout(finish, ms);
        window.addEventListener('tour-wake', finish);
      });

    const net = (detail: Record<string, any>) =>
      window.dispatchEvent(new CustomEvent('horus:tour-cmd', { detail }));
    const flyTo = (
      lat: number,
      lng: number,
      z: number,
      opts?: { pitch?: number; bearing?: number; dur?: number }
    ) => {
      (window as any).__osirisMapFlyTo?.(lat, lng, z, opts);
    };
    const dropTarget = (lat: number, lng: number, label: string) => {
      (window as any).__horusDropTourMarker?.(lat, lng, label);
    };
    const clearTarget = () => {
      (window as any).__horusClearTourMarker?.();
    };

    const cleanupAll = () => {
      try {
        net({ cmd: 'reset' });
        net({ cmd: 'country', c: '' });
        cbsRef.current.onCloseBubble();
        cbsRef.current.onCloseDetail();
        (window as any).__horusClearSearchMarker?.();
        clearTarget();
        (window as any).__osirisMapSet3D?.(false);
        (window as any).__osirisMapResetView?.();
        cbsRef.current.onModuleClose();
      } catch {}
    };

    initKeySfx();

    (async () => {
      try {
        const C = () => cbsRef.current;

        // Qualité adaptative : sur GPU logiciel on allège le vol.
        const soft = !!(window as any).__horusSoftGpu;
        const ZS = soft ? 17 : Z_STREET;
        const ZC = soft ? 15.5 : Z_CAM;
        const pitchFlight = soft ? 24 : 38;

        // Coupe cinématique : voile sombre + balayage, on switche sous le voile
        const warpCut = async (fn?: () => void, ms = WARP_MS) => {
          const quick = ms < WARP_MS;
          warpKRef.current += 1;
          setWarp({ on: true, k: warpKRef.current, quick });
          await wait(Math.round(ms * 0.4));
          chk();
          fn?.();
          await wait(ms - Math.round(ms * 0.4));
          setWarp(null);
        };

        // Tempo d'explication : on attend que la machine à écrire FINISSE,
        // puis on laisse lire le texte de présentation confortablement.
        const holdFor = async (text: string, extraMs = 0) => {
          const typingMs = 150 + Math.round(text.length * 23);
          await wait(Math.max(2400, typingMs + 1800 + extraMs));
          chk();
        };
        const holdForAtLeast = async (text: string, minMs: number) => {
          const typingMs = 150 + Math.round(text.length * 23);
          await wait(Math.max(minMs, typingMs + 1800));
          chk();
        };

        // Attend que le flux HLS s'affiche VRAIMENT avant de compter le regard.
        const waitCamLive = (wantSrc: string | undefined, maxMs: number) =>
          new Promise<'live' | 'dead' | 'timeout'>((resolve) => {
            let done = false;
            let tmo = 0;
            const isMine = (e: Event) => {
              const d = (e as CustomEvent).detail as { src?: string } | undefined;
              return !wantSrc || !d?.src || d.src === wantSrc;
            };
            const cleanup = () => {
              window.clearTimeout(tmo);
              window.removeEventListener('horus:cam-live', onLive);
              window.removeEventListener('horus:cam-dead', onDead);
            };
            const onLive = (e: Event) => {
              if (!done && isMine(e)) {
                done = true;
                cleanup();
                resolve('live');
              }
            };
            const onDead = (e: Event) => {
              if (!done && isMine(e)) {
                done = true;
                cleanup();
                resolve('dead');
              }
            };
            window.addEventListener('horus:cam-live', onLive);
            window.addEventListener('horus:cam-dead', onDead);
            tmo = window.setTimeout(() => {
              if (!done) {
                done = true;
                cleanup();
                resolve('timeout');
              }
            }, maxMs);
          });

        // Attend que la machine à écrire ait TOUT tapé le texte voulu.
        const waitMonoDone = (wantText: string, capMs: number) =>
          new Promise<boolean>((resolve) => {
            let done = false;
            const on = (e: Event) => {
              const d = (e as CustomEvent).detail as { text?: string } | undefined;
              if (!done && d?.text === wantText) {
                done = true;
                window.removeEventListener('horus:mono-done', on);
                resolve(true);
              }
            };
            window.addEventListener('horus:mono-done', on);
            window.setTimeout(() => {
              if (!done) {
                done = true;
                window.removeEventListener('horus:mono-done', on);
                resolve(false);
              }
            }, capMs);
          });

        const waitFor = async <T,>(fn: () => T | null, tries: number, gapMs: number): Promise<T | null> => {
          for (let i = 0; i < tries; i++) {
            const v = fn();
            if (v) return v;
            await wait(gapMs);
            chk();
          }
          return null;
        };

        // ── 1 · AESBOT ─────────────────────────────────────────────
        setStep({ idx: 1, label: 'AESBOT' });
        setCard({
          icon: <Bot className="w-4 h-4" />,
          kicker: 'AESBOT · INITIALISATION',
          title: 'Bonjour, je suis AesBot',
          body: T_AESBOT,
        });
        C().onModuleClose();
        C().onCloseBubble();
        C().onCloseDetail();
        (window as any).__horusClearSearchMarker?.();
        clearTarget();
        (window as any).__osirisMapSet3D?.(false);
        C().onPhase('surveillance');
        (window as any).__osirisMapResetView?.();
        await holdFor(T_AESBOT, 600);

        // ── 2 · OUVERTURE · salutation du Commandement ─────────────
        setStep({ idx: 2, label: 'OUVERTURE' });
        setCard({
          icon: <Sparkles className="w-4 h-4" />,
          kicker: 'BRIEFING DU COMMANDEMENT',
          title: 'Messieurs les Membres du Commandement, Chers Camarades',
          body: T_OUVERTURE,
        });
        await holdForAtLeast(T_OUVERTURE, 9000);

        // ── 3 · SLIDE TRANSITIONNELLE · AXE 1 ──────────────────────
        setStep({ idx: 3, label: 'AXE 1' });
        setCard(null);
        setInter({
          title: AXE1_TITRE,
          sub: 'FEUILLE DE ROUTE · CYBERRENSEIGNEMENT DE MASSE',
          long: true,
        });
        C().onModuleClose();
        await wait(3200);
        chk();
        setInter(null);

        // ── 4 · AXE 1 · PILIER 1/5 · GUERRE DES MÉDIAS ─────────────
        await warpCut(() => {
          setStep({ idx: 4, label: 'MÉDIAS' });
          C().onModule('news');
          flyTo(12.639, -8.002, 5.4, { pitch: 32, bearing: 8, dur: 3000 });
        });
        setCard({
          icon: <Newspaper className="w-4 h-4" />,
          kicker: 'AXE 1 · PILIER 1/5',
          title: 'Guerre des Médias et Lutte contre la Propagande',
          body: T_MEDIA,
        });
        await holdForAtLeast(T_MEDIA, 8000);
        chk();

        // ── 5 · AXE 1 · PILIER 2/5 · CNN · points chauds ────────────
        await warpCut(() => {
          setStep({ idx: 5, label: 'CNN' });
          C().onModule('cameras');
        });
        const cams = (await waitFor(
          () => { const c = pickCameras(pointsRef.current, 3); return c.length > 0 ? c : null; },
          10, 400
        )) ?? [];
        // La carte du pilier reste affichée (texte du Commandement) ;
        // les flux HLS tournent derrière, ancrés à droite.
        setCard({
          icon: <CamIcon className="w-4 h-4" />,
          kicker: 'AXE 1 · PILIER 2/5',
          title: 'Vision par Ordinateur (CNN) et Traçabilité Tactique',
          body: T_CNN,
          anchor: 'left',
        });
        const cnnHold = holdForAtLeast(T_CNN, 9000);
        for (let i = 0; i < cams.length; i++) {
          const c = cams[i];
          const rd = (c.rawData ?? {}) as any;
          const camWait = waitCamLive(typeof rd.streamUrl === 'string' ? rd.streamUrl : undefined, 13500);
          await warpCut(() => {
            C().onCloseBubble();
            C().onCameraView(rd, ZC, { pitch: soft ? 8 : 12, bearing: 0, dur: 2400 });
          }, WARP_QUICK_MS);
          const got = await camWait;
          chk();
          if (got === 'live') await wait(6000);
          else if (got === 'dead') await wait(1800);
          else await wait(2400);
          chk();
        }
        C().onCloseBubble();
        await cnnHold;
        clearTarget();

        // ── 6 · AXE 1 · PILIER 3/5 · SIGINT · zones rouges ─────────
        await warpCut(() => {
          setStep({ idx: 6, label: 'SIGINT' });
          C().onModuleClose();
          dropTarget(14.9, 0.6, 'ZONE ROUGE · LIPTAKO-GOURMA');
          flyTo(14.9, 0.6, 9.6, { pitch: 48, bearing: -18, dur: 3200 });
        });
        setCard({
          icon: <Radar className="w-4 h-4" />,
          kicker: 'AXE 1 · PILIER 3/5',
          title: 'SIGINT et Détection de Signaux en Zones Rouges',
          body: T_SIGINT,
        });
        await holdForAtLeast(T_SIGINT, 9000);
        chk();
        clearTarget();

        // ── 7 · AXE 1 · PILIER 4/5 · CONDUITE DES OPÉRATIONS ───────
        await warpCut(() => {
          setStep({ idx: 7, label: 'OPÉRATIONS' });
          (window as any).__osirisMapResetView?.();
        });
        setCard({
          icon: <Globe className="w-4 h-4" />,
          kicker: 'AXE 1 · PILIER 4/5',
          title: 'Conduite des Opérations et Gestion de Crise',
          body: T_OPS,
        });
        await holdForAtLeast(T_OPS, 9000);
        chk();

        // ── 8 · AXE 1 · PILIER 5/5 · SURVEILLANCE AÉRIENNE ─────────
        await warpCut(() => {
          setStep({ idx: 8, label: 'AÉRIEN' });
          C().onModule('flights');
        });
        setCard({
          icon: <Plane className="w-4 h-4" />,
          kicker: 'AXE 1 · PILIER 5/5',
          title: 'Surveillance Aérienne et Contrôle de la Souveraineté',
          body: T_AIR,
        });
        const flight = await waitFor(() => pickFlight(pointsRef.current), 10, 400);
        if (flight) {
          flyTo(flight.lat, flight.lng, ZS, { pitch: pitchFlight, bearing: 24, dur: 3000 });
          dropTarget(flight.lat, flight.lng, '');
          C().onSelectPoint(flight);
        }
        await holdForAtLeast(T_AIR, 10000);
        clearTarget();
        C().onCloseDetail();

        // ── 9 · SLIDE TRANSITIONNELLE · AXE 2 ──────────────────────
        setStep({ idx: 9, label: 'AXE 2' });
        setCard(null);
        setInter({
          title: AXE2_TITRE,
          sub: 'THREAT INTELLIGENCE · MAÎTRISE DE L’ESPACE NUMÉRIQUE',
          long: true,
        });
        C().onModuleClose();
        C().onPhase('intel');
        net({ cmd: 'reset' });
        await wait(3200);
        chk();
        setInter(null);

        // ── 10 · AXE 2 · PILIER 1/2 · CYBERMENACES ─────────────────
        setStep({ idx: 10, label: 'CYBER' });
        setArrows([
          {
            sel: '[data-tour="net-filtres"]',
            side: 'left',
            title: 'FILTRES',
            body: 'Six familles de menaces + sévérité + pays.',
          },
          {
            sel: '[data-tour="net-feed"]',
            side: 'right',
            title: 'THREAT FEED',
            body: 'Chaque ligne = un événement réel.',
          },
        ]);
        setCard({
          icon: <Network className="w-4 h-4" />,
          kicker: 'AXE 2 · PILIER 1/2',
          title: 'Analyse des Cybermenaces et Cybergroupes Criminels',
          body: T_CYBER,
        });
        net({ cmd: 'example' });
        await holdForAtLeast(T_CYBER, 9000);
        chk();
        setArrows([]);
        net({ cmd: 'closePopup' });

        // ── 11 · AXE 2 · PILIER 2/2 · LEAKS · cartographie ────────
        await warpCut(() => {
          setStep({ idx: 11, label: 'FUITES' });
        });
        setCard({
          icon: <Database className="w-4 h-4" />,
          kicker: 'AXE 2 · PILIER 2/2',
          title: 'Historisation et Cartographie Préventive des Leaks',
          body: T_LEAKS,
        });
        await holdForAtLeast(T_LEAKS, 9000);
        for (let b = 0; b < BREACH_STOPS.length; b++) {
          const B = BREACH_STOPS[b];
          net({ cmd: 'breach', iso: B.iso });
          await holdForAtLeast(B.text, 5000);
          chk();
        }
        net({ cmd: 'reset' });

        // ── 12 · CONCLUSION ────────────────────────────────────────
        setStep({ idx: 12, label: 'CONCLUSION' });
        net({ cmd: 'reset' });
        net({ cmd: 'country', c: '' });
        setCard(null);
        C().onPhase('surveillance');
        (window as any).__osirisMapResetView?.();
        await wait(1900);
        chk();
        setFinale('type');
        const fullyTyped = await waitMonoDone(FINALE_TEXT, 12000);
        if (!fullyTyped) console.warn('[AutoTour] conclusion incomplète à l’entrée en veille (cap 12 s atteint)');
        await wait(1600);
        chk();
        setFinale('veille');
        await wait(5000);
        chk();
        setFinale('out');
        await wait(900);
        chk();
      } catch (e) {
        if ((e as unknown) !== STOP) console.error('[AutoTour] arrêt inattendu du monologue :', e);
      } finally {
        if (alive) {
          alive = false;
          cleanupAll();
          cbsRef.current.onEnd();
        }
      }
    })();

    return () => {
      alive = false;
      cancelledRef.current = true;
      window.dispatchEvent(new Event('tour-wake'));
      cleanupAll();
    };
  }, []);

  return (
    <>
      <div className="at-catcher" />

      {warp?.on && (
        <div key={warp.k} className={`at-warp${warp.quick ? ' is-quick' : ''}`} />
      )}

      <div className="at-chip">
        <span className="at-chip-dot" />
        <span className="at-chip-label">MODE AUTO · {step.label}</span>
        <span className="at-chip-count">
          {Math.max(1, Math.min(step.idx, TOTAL_STEPS))}/{TOTAL_STEPS}
        </span>
        <button className="at-quit" onClick={quit} title="Quitter le mode autonome (Échap)">
          <X className="w-3 h-3" /> QUITTER
        </button>
      </div>

      {arrows.map((a) => (
        <TourArrow key={a.sel + a.title} a={a} />
      ))}

      {card && (
        <div
          className={`at-pcard${card.anchor === 'left' ? ' is-left' : ''}`}
          key={card.title}
        >
          <div className="at-pcard-kicker">
            {card.icon}
            <span>{card.kicker}</span>
          </div>
          <div className="at-pcard-title">{card.title}</div>
          <p className="at-pcard-body">
            <MonoType text={card.body} />
          </p>
        </div>
      )}

      {inter && (
        <div className="at-inter" key={inter.title}>
          <div className={inter.long ? 'at-inter-title is-long' : 'at-inter-title'}>{inter.title}</div>
          {inter.sub ? <div className="at-inter-sub">{inter.sub}</div> : null}
        </div>
      )}

      {finale && (
        <div className={`at-finale ${finale === 'out' ? 'is-out' : finale === 'veille' ? 'is-veille' : ''}`}>
          <div className="at-finale-inner">
            <div className="at-finale-logo">
              <img src="/aes-cert-logo.svg" alt="AES CERT" />
            </div>
            <div className="at-finale-kicker">CONCLUSION</div>
            <div className="at-finale-quote">
              <MonoType text={FINALE_TEXT} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function TourArrow({ a }: { a: ArrowDef }) {
  const [rect, setRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    const compute = () => {
      const el = document.querySelector(a.sel);
      const r = el ? el.getBoundingClientRect() : null;
      setRect(r && r.width > 2 && r.height > 2 ? r : null);
    };
    compute();
    const t1 = window.setTimeout(compute, 250);
    const t2 = window.setTimeout(compute, 800);
    const iv = window.setInterval(compute, 1500);
    window.addEventListener('resize', compute);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearInterval(iv);
      window.removeEventListener('resize', compute);
    };
  }, [a.sel]);

  if (typeof window === 'undefined' || !rect) return null;

  const CARD_W = 288;
  const CARD_H = 84;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(v, hi));

  let ax = 0;
  let ay = 0;
  let lx = 0;
  let ly = 0;
  let line: { x1: number; y1: number; x2: number; y2: number } | null = null;
  let head = '';

  if (a.side === 'top') {
    ax = rect.left + rect.width / 2;
    ay = rect.top - 3;
    lx = clamp(ax - CARD_W / 2, 10, vw - CARD_W - 10);
    ly = clamp(rect.top - CARD_H - 48, 54, vh - CARD_H - 10);
    line = { x1: lx + CARD_W / 2, y1: ly + CARD_H, x2: ax, y2: ay - 8 };
    head = `${ax},${ay - 2} ${ax - 6},${ay - 12} ${ax + 6},${ay - 12}`;
  } else if (a.side === 'left') {
    ax = rect.left - 3;
    ay = rect.top + Math.min(rect.height, 260) * 0.5;
    lx = clamp(ax - CARD_W - 46, 10, vw - CARD_W - 10);
    ly = clamp(ay - CARD_H / 2, 60, vh - CARD_H - 90);
    line = { x1: lx + CARD_W, y1: ly + CARD_H / 2, x2: ax - 10, y2: ay };
    head = `${ax},${ay} ${ax - 12},${ay - 6} ${ax - 12},${ay + 6}`;
  } else {
    ax = rect.left + rect.width + 3;
    ay = rect.top + Math.min(rect.height, 260) * 0.5;
    lx = clamp(ax + 46, 10, vw - CARD_W - 10);
    ly = clamp(ay - CARD_H / 2, 60, vh - CARD_H - 90);
    line = { x1: lx, y1: ly + CARD_H / 2, x2: ax + 10, y2: ay };
    head = `${ax},${ay} ${ax + 12},${ay - 6} ${ax + 12},${ay + 6}`;
  }

  return (
    <div className="at-arrow">
      <div className="at-dot" style={{ left: ax - 5, top: ay - 5 }} />
      <svg className="at-svg">
        {line && (
          <line x1={line.x1} y1={line.y1} x2={line.x2} y2={line.y2} className="at-line" />
        )}
        <polygon points={head} className="at-head" />
      </svg>
      <div className="at-tag" style={{ left: lx, top: ly, width: CARD_W }}>
        <b>{a.title}</b>
        <span>{a.body}</span>
      </div>
    </div>
  );
}
