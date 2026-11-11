'use client';

import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import dynamic from 'next/dynamic';
import LoginGate from '@/components/command-center/LoginGate';
import {
  CameraPanel, FlightPanel, CablePanel,
} from '@/components/command-center/Panels';
import VesselsPanel from '@/components/command-center/VesselsPanel';
import NewsPanel from '@/components/command-center/NewsPanel';
import CameraBubble, { type BubbleCamera } from '@/components/command-center/CameraBubble';

import { type GlobePoint, type GlobeArc } from '@/lib/osint-data';
import PointDetailOverlay from '@/components/command-center/PointDetailOverlay';
import AlertNotifications from '@/components/command-center/AlertNotifications';
import CommandBar from '@/components/command-center/CommandBar';
import VisualModeToggle from '@/components/command-center/VisualModeToggle';
import OnboardingTour from '@/components/command-center/OnboardingTour';
import AutoTour from '@/components/command-center/AutoTour';
import { ensureAmbience, toggleMusic, musicPref, musicPlaying } from '@/lib/tourAudio';
import { useGeofenceAlerts } from '@/hooks/useGeofenceAlerts';

import {
  Camera, Plane, Cable, Eye, Maximize2,
  AlertTriangle, ShieldAlert, Activity, PlayCircle,
  HelpCircle, Volume2, VolumeX, Bot,
} from 'lucide-react';
import OpsOrchestra from '@/components/command-center/OpsOrchestra';
import { useHorusStream } from '@/hooks/useHorusStream';

import '@/network/net.css';

const NetworkLayout = dynamic(() => import('@/network/NetworkLayout'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-[#050a12]">
      <div className="w-6 h-6 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
    </div>
  ),
});

const OsirisMap = dynamic(() => import('@/components/command-center/OsirisMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-black/40">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
        <span className="text-cyan-400 font-mono text-[10px] tracking-[0.3em]">CARTE</span>
      </div>
    </div>
  ),
});

type Phase = 'surveillance' | 'intel';

type ModuleId = 'flights' | 'vessels' | 'cameras' | 'cables' | 'news' | 'ops';

const MODULES: { id: ModuleId; label: string; icon: React.ReactNode; pointType?: string; desc: string }[] = [
  { id: 'flights', label: 'VOLS', icon: <Plane className="w-3.5 h-3.5" />, pointType: 'flight', desc: 'ADS-B tracks' },
  { id: 'vessels', label: 'NAVIRES', icon: <Activity className="w-3.5 h-3.5" />, pointType: 'ship', desc: 'AIS maritime' },
  { id: 'cameras', label: 'CAMÉRAS', icon: <Camera className="w-3.5 h-3.5" />, pointType: 'camera', desc: 'Caméras IP' },
  { id: 'cables', label: 'CÂBLES', icon: <Cable className="w-3.5 h-3.5" />, pointType: 'cable', desc: 'Câbles sous-marins' },
  { id: 'news', label: 'NEWS', icon: <AlertTriangle className="w-3.5 h-3.5" />, desc: 'GDELT/HN' },
  { id: 'ops', label: 'AGENTS', icon: <Bot className="w-3.5 h-3.5" />, desc: 'Orchestration d\'agents live' },
];

export default function CommandCenter() {
  const [bootComplete, setBootComplete] = useState(false);

  useEffect(() => {
    try {
      if (window.sessionStorage.getItem('horus-session') === '1') {
        setBootComplete(true);
        // session restaurée : pas de LoginGate, donc pas de onDone —
        // l'ambiance musicale doit partir quand même (repli geste si bloqué).
        ensureAmbience();
      }
    } catch {}
  }, []);
  const [phase, setPhase] = useState<Phase>('surveillance');
  const [activeModule, setActiveModule] = useState<ModuleId>('flights');

  const [moduleOpen, setModuleOpen] = useState(false);

  const [globePoints, setGlobePoints] = useState<GlobePoint[]>([]);
  const [globeArcs, setGlobeArcs] = useState<GlobeArc[]>([]);
  const [selectedPoint, setSelectedPoint] = useState<GlobePoint | null>(null);
  const [showDetailOverlay, setShowDetailOverlay] = useState(false);

  const [dataSource, setDataSource] = useState<string>('connexion…');
  const [loading, setLoading] = useState(true);

  const [bubbleCam, setBubbleCam] = useState<BubbleCamera | null>(null);

  const [tourOpen, setTourOpen] = useState(false);
  const closeTour = useCallback(() => {
    try { localStorage.setItem('horus-onboarded', '1'); } catch {}
    setTourOpen(false);
  }, []);
  const openTour = useCallback(() => {
    setPhase('surveillance');
    setTourOpen(true);
  }, []);
  const [autoTour, setAutoTour] = useState(false);
  // Lancement du MODE AUTONOME : il englobe la visite rapide — on referme
  // l'onboarding (sinon son voile z 2147483400 s'affiche AU-DESSUS du tour z 2147483300),
  // et l'auto-ouverture de la visite ne se déclenche pas pendant le tour.
  const toggleAutoTour = useCallback(() => {
    if (autoTour) { setAutoTour(false); return; }
    try { localStorage.setItem('horus-onboarded', '1'); } catch {}
    setTourOpen(false);
    setAutoTour(true);
  }, [autoTour]);
  useEffect(() => {
    if (!bootComplete || autoTour) return;
    let seen = false;
    try { seen = !!localStorage.getItem('horus-onboarded'); } catch {}
    if (seen) return;
    const t = setTimeout(() => setTourOpen(true), 900);
    return () => clearTimeout(t);
  }, [bootComplete, autoTour]);

  const [musicOn, setMusicOn] = useState(false);
  useEffect(() => {
    setMusicOn(musicPref() && musicPlaying());
  }, []);
  const handleMusicToggle = useCallback(() => {
    setMusicOn(toggleMusic());
  }, []);

  const [clock, setClock] = useState('');

  const {
    alerts: geofenceAlerts,
    unacknowledgedCount: geofenceUnackCount,
    criticalCount: geofenceCriticalCount,
    acknowledgeAlert: geofenceAckAlert,
    acknowledgeAll: geofenceAckAll,
    refreshAlerts: geofenceRefresh,
    isEvaluating: geofenceEvaluating,
  } = useGeofenceAlerts(globePoints);

  // ORCHESTRE — agents de veille live (socket horus-stream :3030)
  const {
    agents: watchAgents,
    connected: streamConnected,
  } = useHorusStream();
  const agentPoints = useMemo(() => {
    return watchAgents.map((a) => ({
      lat: a.lat,
      lng: a.lng,
      size: a.state === 'ESCALATE' ? 0.6 : a.state === 'INVESTIGATE' ? 0.5 : 0.35,
      color: a.state === 'ESCALATE' ? '#ff4d5e'
        : a.state === 'INVESTIGATE' ? '#ffb84d'
        : a.state === 'REPORT' ? '#4dffb0' : '#ffb84d',
      label: `${a.callsign} · ${a.state}`,
      type: 'agent' as const,
      rawData: a as unknown as Record<string, any>,
    }));
  }, [watchAgents]);

  const [toast, setToast] = useState<{ message: string; type: 'info' | 'warn' | 'success' | 'error' } | null>(null);
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [trackedPoint, setTrackedPoint] = useState<GlobePoint | null>(null);
  const [lockedPoint, setLockedPoint] = useState<GlobePoint | null>(null);
  const trackIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const phaseRef = useRef<Phase>(phase);
  phaseRef.current = phase;
  const lastLoadRef = useRef(0);

  const showToast = useCallback((message: string, type: 'info' | 'warn' | 'success' | 'error' = 'info') => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToast({ message, type });
    toastTimeoutRef.current = setTimeout(() => setToast(null), 3500);
  }, []);

  const flyToLocation = useCallback((lat: number, lng: number, zoom: number = 12, opts?: { pitch?: number; bearing?: number; dur?: number }) => {
    const flyTo = (window as any).__osirisMapFlyTo;
    if (flyTo) {
      try {
        flyTo(lat, lng, zoom, opts);
      } catch {
        // vol interrompu (race maplibre) : on ne casse pas l'appelant, la carte reste où elle est
      }
    } else {
      showToast('Carte pas encore prête', 'warn');
    }
  }, [showToast]);

  const handleLocateItem = useCallback((item: { lat?: number; lng?: number; lon?: number; latitude?: number; longitude?: number; name?: string; id?: string; callsign?: string; ip?: string }, type: string) => {
    const lat = item.lat ?? item.latitude;
    const lng = item.lng ?? item.lon ?? item.longitude;
    if (lat != null && lng != null) {
      flyToLocation(lat, lng, 12);
      const matchingPoint = globePoints.find(p => {
        if (p.type !== type) return false;
        return Math.abs(p.lat - lat) < 0.5 && Math.abs(p.lng - lng) < 0.5;
      });
      if (matchingPoint) setSelectedPoint(matchingPoint);
    } else {
      showToast('Pas de coordonnées pour cet élément', 'warn');
    }
  }, [flyToLocation, globePoints]);

  const handleCameraView = useCallback((cam: any, zoom?: number, opts?: { pitch?: number; bearing?: number; dur?: number }) => {
    if (cam.lat != null && cam.lng != null) flyToLocation(cam.lat, cam.lng, zoom ?? 13, opts);
    setBubbleCam({
      id: cam.id, ip: cam.ip, lat: cam.lat, lng: cam.lng,
      location: cam.location || cam.name || 'N/D',
      type: cam.type || 'cam', status: cam.status || 'unknown',
      snapshotUrl: cam.snapshotUrl, streamUrl: cam.streamUrl,
      source: cam.source, name: cam.name, city: cam.city, country: cam.country,
    });
  }, [flyToLocation]);

  useEffect(() => {
    const tick = () => setClock(new Date().toISOString().slice(11, 19) + ' UTC');
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, []);

  const handleSitrep = useCallback(async (): Promise<string> => {
    const events = globePoints.slice(0, 40).map(p => ({
      source: String(p.type || 'osint'),
      title: String(p.label || p.type || 'signal'),
      summary: '',
      level: 'info',
      ts: Date.now(),
    }));
    const ctrl = new AbortController();
    const abortT = window.setTimeout(() => ctrl.abort(), 15000);
    try {
      const res = await fetch('/api/horus/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ events }),
        signal: ctrl.signal,
      });
      const data = await res.json();
      return String(data.brief || 'No brief generated.');
    } catch (e) {
      const aborted = e instanceof DOMException && e.name === 'AbortError';
      return `SITREP failed: ${aborted ? 'délai dépassé (15 s)' : e instanceof Error ? e.message : 'unknown'}`;
    } finally {
      window.clearTimeout(abortT);
    }
  }, [globePoints]);

  const feedPointsRef = useRef<Record<string, GlobePoint[]>>({});
  const feedArcsRef = useRef<Record<string, GlobeArc[]>>({});

  const mergeFeed = useCallback((feed: string, points: GlobePoint[], arcs: GlobeArc[]) => {
    feedPointsRef.current[feed] = points;
    feedArcsRef.current[feed] = arcs;
    const allPoints = Object.values(feedPointsRef.current).flat();
    const allArcs = Object.values(feedArcsRef.current).flat();
    setGlobePoints(allPoints);
    setGlobeArcs(allArcs);
  }, []);

  const fetchFlights = useCallback(async (): Promise<{ p: GlobePoint[]; a: GlobeArc[] }> => {
    try {
      const res = await fetch('/api/osint/flights');
      const data = await res.json();
      const points: GlobePoint[] = [];
      (data.flights || []).forEach((f: any) => {
        const lat = f.latitude ?? f.lat;
        const lng = f.longitude ?? f.lon ?? f.lng;
        if (lat != null && lng != null) {
          points.push({
            lat, lng,
            size: 0.25,
            color: '#00ccff',
            label: f.callsign || f.flight || f.icao24 || 'N/D',
            type: 'flight',
            rawData: f,
          });
        }
      });
      const arcs: GlobeArc[] = [];
      const byCountry: Record<string, any[]> = {};
      (data.flights || []).forEach((f: any) => {
        const origin = f.originCountry || f.origin || 'XX';
        if (!byCountry[origin]) byCountry[origin] = [];
        byCountry[origin].push(f);
      });
      Object.entries(byCountry).forEach(([, flights]) => {
        if (flights.length >= 2) {
          for (let i = 0; i < Math.min(flights.length - 1, 5); i++) {
            const lat1 = flights[i].latitude ?? flights[i].lat;
            const lng1 = flights[i].longitude ?? flights[i].lon ?? flights[i].lng;
            const lat2 = flights[i + 1].latitude ?? flights[i + 1].lat;
            const lng2 = flights[i + 1].longitude ?? flights[i + 1].lon ?? flights[i + 1].lng;
            if (lat1 != null && lng1 != null && lat2 != null && lng2 != null) {
              arcs.push({
                startLat: lat1, startLng: lng1, endLat: lat2, endLng: lng2,
                color: ['#00ccff', '#0044ff'],
                stroke: 0.5,
                type: 'flight',
              });
            }
          }
        }
      });
      return { p: points, a: arcs };
    } catch {
      return { p: [], a: [] };
    }
  }, []);

  const fetchCameras = useCallback(async (): Promise<{ p: GlobePoint[]; a: GlobeArc[] }> => {
    try {
      const res = await fetch('/api/osint/cameras');
      const data = await res.json();
      const points: GlobePoint[] = [];
      (data.cameras || []).forEach((c: any) => {
        if (c.lat == null || c.lng == null) return;
        points.push({
          lat: c.lat, lng: c.lng,
          size: c.status === 'online' ? 0.35 : 0.15,
          color: c.status === 'online' ? '#00ff88' : '#ff4444',
          label: c.name || c.id,
          type: 'camera',
          rawData: c,
        });
      });
      return { p: points, a: [] };
    } catch {
      return { p: [], a: [] };
    }
  }, []);

  const fetchCables = useCallback(async (): Promise<{ p: GlobePoint[]; a: GlobeArc[] }> => {
    try {
      const res = await fetch('/api/osint/cables');
      const data = await res.json();
      const points: GlobePoint[] = [];
      const arcs: GlobeArc[] = [];
      (data.cables || []).forEach((cable: any) => {
        if (cable.landingPoints) {
          cable.landingPoints.forEach((lp: any) => {
            if (lp.lat == null || lp.lng == null) return;
            points.push({
              lat: lp.lat, lng: lp.lng,
              size: cable.status === 'outage' ? 0.4 : 0.25,
              color: cable.status === 'outage' ? '#ff4444' : cable.status === 'under_construction' ? '#ffaa00' : '#cc66ff',
              label: lp.name || lp.city,
              type: 'cable',
              rawData: { ...cable, landingPointName: lp.name, landingPointCity: lp.city },
            });
          });
        }
        if (cable.route && cable.route.length >= 2) {
          const arcColor = cable.status === 'outage' ? ['#ff4444', '#880000']
            : cable.status === 'under_construction' ? ['#ffaa00', '#885500']
            : ['#cc66ff', '#6600cc'];
          for (let i = 0; i < cable.route.length - 1; i++) {
            arcs.push({
              startLat: cable.route[i][0], startLng: cable.route[i][1],
              endLat: cable.route[i + 1][0], endLng: cable.route[i + 1][1],
              color: arcColor,
              stroke: cable.status === 'outage' ? 0.8 : 0.4,
              type: 'cable',
            });
          }
        }
      });
      return { p: points, a: arcs };
    } catch {
      return { p: [], a: [] };
    }
  }, []);

  const fetchVessels = useCallback(async (): Promise<{ p: GlobePoint[]; a: GlobeArc[] }> => {
    try {
      const res = await fetch('/api/osint/vessels');
      const data = await res.json();
      const points: GlobePoint[] = [];
      (data.vessels || []).forEach((v: any) => {
        const lat = v.lat ?? v.latitude;
        const lng = v.lng ?? v.lon ?? v.longitude;
        if (lat != null && lng != null) {
          points.push({
            lat, lng,
            size: v.isMilitary ? 0.4 : v.classification === 'cargo' || v.classification === 'tanker' ? 0.3 : 0.2,
            color: v.isMilitary ? '#ff3355' : v.classification === 'cargo' ? '#00aaff' : '#66aacc',
            label: v.name || v.mmsi || v.id,
            type: 'ship',
            rawData: v,
          });
        }
      });
      return { p: points, a: [] };
    } catch {
      return { p: [], a: [] };
    }
  }, []);

  const refreshGlobeData = useCallback(async () => {
    setLoading(true);
    void fetchFlights().then(({ p, a }) => mergeFeed('flights', p, a));
    void fetchVessels().then(({ p, a }) => mergeFeed('vessels', p, a));
    void fetchCables().then(({ p, a }) => mergeFeed('cables', p, a));
    try {
      const { p, a } = await fetchCameras();
      mergeFeed('cameras', p, a);
      setDataSource('flux live');
    } catch {
      setDataSource('connexion impossible');
    }
    lastLoadRef.current = Date.now();
    setLoading(false);
  }, [fetchFlights, fetchVessels, fetchCables, fetchCameras, mergeFeed]);

  useEffect(() => {
    const run = () => {
      if (phaseRef.current !== 'surveillance') return;
      void refreshGlobeData();
    };
    const initialTimeout = setTimeout(run, 100);
    const interval = setInterval(run, 30000);
    return () => {
      clearTimeout(initialTimeout);
      clearInterval(interval);
    };
  }, [refreshGlobeData]);

  const switchPhase = useCallback((p: Phase) => {
    setPhase(p);
    if (p === 'surveillance' && Date.now() - lastLoadRef.current > 30000) {
      void refreshGlobeData();
    }
    if (p === 'intel') {
      if (trackIntervalRef.current) {
        clearInterval(trackIntervalRef.current);
        trackIntervalRef.current = null;
      }
    }
  }, [refreshGlobeData]);

  const activeMod = MODULES.find(m => m.id === activeModule)!;
  // les agents restent VISIBLES quel que soit le module actif ; les modules
  // sans type de point (news, ops) montrent la couche complète
  const filteredPoints = activeModule === 'news' || activeModule === 'ops'
    ? [...agentPoints, ...globePoints]
    : [...agentPoints, ...globePoints.filter(p => p.type === activeMod.pointType)];
  const filteredArcs = activeModule === 'flights' ? globeArcs.filter(a => a.type === 'flight')
    : activeModule === 'cables' ? globeArcs.filter(a => a.type === 'cable')
    : globeArcs;

  const moduleCount = (id: ModuleId): number => {
    if (id === 'ops') return watchAgents.length;
    const m = MODULES.find(x => x.id === id)!;
    return m.pointType ? globePoints.filter(p => p.type === m.pointType).length : 0;
  };

  const handleTrack = useCallback((point: GlobePoint | null) => {
    if (trackIntervalRef.current) {
      clearInterval(trackIntervalRef.current);
      trackIntervalRef.current = null;
    }
    if (trackedPoint && trackedPoint.lat === point?.lat && trackedPoint.lng === point?.lng && trackedPoint.type === point?.type) {
      setTrackedPoint(null);
      showToast('TRACK désactivé', 'info');
      return;
    }
    setTrackedPoint(point);
    setLockedPoint(null);
    if (point) {
      flyToLocation(point.lat, point.lng, 14);
      showToast(`TRACK actif : ${point.label || 'cible'}`, 'success');
      trackIntervalRef.current = setInterval(() => {
        const flyTo = (window as any).__osirisMapFlyTo;
        if (flyTo) flyTo(point.lat, point.lng, 14);
      }, 8000);
    }
  }, [trackedPoint, flyToLocation, showToast]);

  const handleLock = useCallback((point: GlobePoint | null) => {
    if (trackIntervalRef.current) {
      clearInterval(trackIntervalRef.current);
      trackIntervalRef.current = null;
    }
    if (lockedPoint && lockedPoint.lat === point?.lat && lockedPoint.lng === point?.lng && lockedPoint.type === point?.type) {
      setLockedPoint(null);
      showToast('LOCK relâché', 'info');
      return;
    }
    setLockedPoint(point);
    setTrackedPoint(null);
    if (point) {
      flyToLocation(point.lat, point.lng, 16);
      showToast(`LOCK engagé : ${point.label || 'cible'}`, 'success');
      trackIntervalRef.current = setInterval(() => {
        const flyTo = (window as any).__osirisMapFlyTo;
        if (flyTo) flyTo(point.lat, point.lng, 16);
      }, 4000);
    }
  }, [lockedPoint, flyToLocation, showToast]);

  useEffect(() => {
    return () => {
      if (trackIntervalRef.current) clearInterval(trackIntervalRef.current);
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (lockedPoint) handleLock(null);
        else if (trackedPoint) handleTrack(null);
        else if (bubbleCam) setBubbleCam(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [lockedPoint, trackedPoint, bubbleCam, handleLock, handleTrack]);

  const handlePointClick = useCallback((point: GlobePoint) => {
    setSelectedPoint(point);
    setShowDetailOverlay(true);
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  }, []);

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden" style={{ background: '#050a12' }}>
      {!bootComplete && <LoginGate onDone={() => { try { window.sessionStorage.setItem('horus-session', '1'); } catch {}; setBootComplete(true); ensureAmbience(); setMusicOn(musicPref() && musicPlaying()); }} />}

      <div className="hp-topbar">
        <div className="hp-tb-left">
          <span
            title="AES CERT · Système de Cyberenseignement"
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              color: '#d8f3ff', letterSpacing: '0.22em', fontSize: 11,
              textShadow: '0 0 12px rgba(53,224,255,0.45)', flexShrink: 0,
            }}
          >
            AES&nbsp;CERT
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{
              width: 7, height: 7, borderRadius: '50%',
              background: loading ? '#ffb84d' : '#4dffb0',
              boxShadow: '0 0 8px rgba(77,255,176,0.6)',
            }} />
            {loading ? 'SYNC' : 'LIVE'}
          </span>
          <span className="hp-tb-pts">{filteredPoints.length} PTS · {filteredArcs.length} LIENS</span>
          <span
            className="hp-tb-pts"
            title="Orchestre d'agents · socket horus-stream :3030"
            style={{ color: streamConnected ? '#4dffb0' : '#ff7b7b' }}
          >
            ORCHESTRE {streamConnected ? 'ON' : 'OFF'}
          </span>
          <span className="hp-tb-src" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{dataSource}</span>
        </div>

        <div className="hp-switcher">
          <button
            className={phase === 'surveillance' ? 'is-on' : ''}
            onClick={() => switchPhase('surveillance')}
            title="Carte mondiale + modules"
          >
            <Eye className="w-3.5 h-3.5" /> <span className="hp-sw-label">CARTE</span>
          </button>
          <span className="hp-sw-sep" />
          <button
            className={phase === 'intel' ? 'is-on' : ''}
            onClick={() => switchPhase('intel')}
            title="Threat intelligence · flux réseau live"
          >
            <ShieldAlert className="w-3.5 h-3.5" /> <span className="hp-sw-label">RÉSEAU</span>
          </button>
        </div>

        <div className="hp-tb-right">
          <VisualModeToggle />
          <AlertNotifications
            alerts={geofenceAlerts}
            unacknowledgedCount={geofenceUnackCount}
            criticalCount={geofenceCriticalCount}
            onAcknowledge={geofenceAckAlert}
            onAcknowledgeAll={geofenceAckAll}
            onRefresh={geofenceRefresh}
            isEvaluating={geofenceEvaluating}
          />
          <span className="hp-chip" style={{ cursor: 'default' }}>{clock}</span>
          <button
            className="hp-chip"
            onClick={handleMusicToggle}
            title={musicOn ? 'Musique · Odyssée du Sahel : couper' : 'Musique · Odyssée du Sahel : activer'}
            style={musicOn ? { color: '#7dd3fc', borderColor: 'rgba(125,211,252,0.45)' } : undefined}
          >
            {musicOn ? <Volume2 className="w-3 h-3" /> : <VolumeX className="w-3 h-3" />}
          </button>
          <button
            className="hp-chip"
            onClick={toggleAutoTour}
            title="MODE AUTONOME · room tour guidé : inspection 3D des vols, réseau de caméras live, monuments du Sahel, filaments réseau, fuites, RECON, épilogue"
            style={autoTour ? { color: '#4dffb0', borderColor: 'rgba(77,255,176,0.55)', boxShadow: '0 0 10px rgba(77,255,176,0.35)' } : undefined}
          >
            <PlayCircle className="w-3 h-3" style={autoTour ? { filter: 'drop-shadow(0 0 4px rgba(77,255,176,0.8))' } : undefined} />
          </button>
          <button className="hp-chip" onClick={openTour} title="AIDE · (re)jouer la visite guidée de la console">
            <HelpCircle className="w-3 h-3" />
          </button>
          <button className="hp-chip" onClick={toggleFullscreen} title="Plein écran">
            <Maximize2 className="w-3 h-3" />
          </button>
        </div>
      </div>

      <div className="flex-1 relative min-h-0">
        {phase === 'surveillance' ? (
          <div className="hp-root">

            <div className="hp-map visual-mode-target">
              <OsirisMap
                points={filteredPoints}
                arcs={filteredArcs}
                onPointClick={handlePointClick}
                activePanel={activeModule}
                trackedPoint={trackedPoint}
                lockedPoint={lockedPoint}
              />
            </div>


            <div className="hp-col-left">
              <div className="hp-rail glass">
                {MODULES.map(m => (
                  <button
                    key={m.id}
                    className={`hp-rail-btn ${activeModule === m.id && moduleOpen ? 'is-on' : ''}`}
                    onClick={() => {
                      if (activeModule === m.id) setModuleOpen(o => !o);
                      else { setActiveModule(m.id); setModuleOpen(true); }
                    }}
                    title={`${m.label} · ${m.desc}`}
                  >
                    {m.icon}
                    {(m.pointType || m.id === 'ops') && moduleCount(m.id) > 0 && (
                      <span className="hp-rail-count">{moduleCount(m.id)}</span>
                    )}
                  </button>
                ))}
              </div>

              <div className="hp-col-left-main">
                <div className={`glass hp-panel hp-panel--module ${moduleOpen ? 'is-open' : ''}`}>
                  <div
                    className="panel__head"
                    onClick={() => setModuleOpen(o => !o)}
                    style={{ cursor: 'pointer', userSelect: 'none' }}
                  >
                    <span className="panel__dot" />
                    <h3 className="panel__title">{activeMod.label}</h3>
                    <span style={{ fontSize: 9, color: 'var(--txt-dim)' }}>{activeMod.desc}</span>
                    <span className="panel__chev">{moduleOpen ? '–' : '+'}</span>
                  </div>
                  {moduleOpen && (
                    <div className="hp-panel__body" style={{ maxHeight: 'min(64vh, 640px)' }}>
                      <div style={{ height: '100%' }}>
                        {activeModule === 'cameras' && <CameraPanel onLocate={(item) => handleLocateItem(item, 'camera')} onView={handleCameraView} />}
                        {activeModule === 'flights' && <FlightPanel onLocate={(item) => handleLocateItem(item, 'flight')} />}
                        {activeModule === 'cables' && <CablePanel onLocate={(item) => handleLocateItem(item, 'cable')} />}
                        {activeModule === 'vessels' && <VesselsPanel onLocate={(item) => handleLocateItem(item, 'ship')} />}
                        {activeModule === 'news' && <NewsPanel />}
                        {activeModule === 'ops' && <OpsOrchestra />}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {bubbleCam && (
              <CameraBubble camera={bubbleCam} onClose={() => setBubbleCam(null)} />
            )}

            {lockedPoint && (
              <div className="absolute inset-0 z-30 flex items-center justify-center pointer-events-none">
                <div className="relative w-48 h-48">
                  <div className="absolute inset-4 rounded-full border border-red-400/60" />
                  <div className="absolute top-0 bottom-0 left-1/2 w-px bg-red-500/50 -translate-x-1/2" />
                  <div className="absolute left-0 right-0 top-1/2 h-px bg-red-500/50 -translate-y-1/2" />
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 bg-red-500 rounded-full" style={{ boxShadow: '0 0 8px 2px rgba(255,50,50,0.6)' }} />
                </div>
                <div className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-2 pointer-events-auto">
                  <div className="glass flex items-center gap-2 px-3 py-1.5">
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#ff4444' }} />
                    <span style={{ fontSize: 10, letterSpacing: '0.18em', color: '#ff8888' }}>TARGET LOCKED</span>
                    <span style={{ fontSize: 9, color: 'var(--txt-dim)' }}>{lockedPoint.label || ''}</span>
                    <button onClick={() => handleLock(null)} className="hp-chip" style={{ padding: '1px 8px' }}>STOP</button>
                  </div>
                </div>
              </div>
            )}

            {trackedPoint && !lockedPoint && (
              <div className="hp-statuschip">
                <div className="glass flex items-center gap-2 px-3 py-1.5">
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#35e0ff' }} />
                  <span style={{ fontSize: 10, letterSpacing: '0.18em', color: '#9ceaff' }}>TRACKING</span>
                  <span style={{ fontSize: 9, color: 'var(--txt-dim)' }}>{trackedPoint.label || 'cible'}</span>
                  <button onClick={() => handleTrack(null)} className="hp-chip" style={{ padding: '1px 8px' }}>STOP</button>
                </div>
              </div>
            )}

            <div className="hp-cmdbar">
              <CommandBar
                blocked={autoTour}
                onSetPanel={(p) => {
                  const mod = MODULES.find(m => m.id === p);
                  if (mod) { setActiveModule(mod.id); setModuleOpen(true); }
                }}
                onTrackIp={(ip, meta) => handleIpTrack(ip, meta)}
                onResetView={() => { const r = (window as any).__osirisMapResetView; if (r) r(); }}
                onRefreshIntel={refreshGlobeData}
                onSitrep={handleSitrep}
                onToast={showToast}
                onMapStyle={(s) => { const f = (window as any).__osirisMapSetStyle; if (f) f(s); }}
                onVisualMode={(m) => {
                  window.dispatchEvent(new CustomEvent('horus:set-visual-mode', { detail: m }));
                }}
              />
            </div>
          </div>
        ) : (
          <NetworkLayout />
        )}
      </div>

      {toast && (
        <div className={`fixed top-14 left-1/2 -translate-x-1/2 z-[9999] px-4 py-2 rounded-lg border backdrop-blur-md shadow-2xl transition-all duration-300 font-mono text-[11px] tracking-wide ${
          toast.type === 'success' ? 'bg-emerald-900/80 border-emerald-700/50 text-emerald-300' :
          toast.type === 'warn' ? 'bg-amber-900/80 border-amber-700/50 text-amber-300' :
          toast.type === 'error' ? 'bg-red-900/80 border-red-700/50 text-red-300' :
          'bg-cyan-900/80 border-cyan-700/50 text-cyan-300'
        }`}>
          <div className="flex items-center gap-2">
            {toast.type === 'warn' && <AlertTriangle className="w-3.5 h-3.5" />}
            {toast.type === 'error' && <AlertTriangle className="w-3.5 h-3.5" />}
            {toast.type === 'info' && <Eye className="w-3.5 h-3.5" />}
            {toast.type === 'success' && <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#4dffb0' }} />}
            {toast.message}
          </div>
        </div>
      )}

      {phase === 'surveillance' && selectedPoint && showDetailOverlay && (
        <PointDetailOverlay
          point={selectedPoint}
          onClose={() => { setShowDetailOverlay(false); setSelectedPoint(null); }}
          onToast={showToast}
          isTracked={!!trackedPoint && trackedPoint.lat === selectedPoint.lat && trackedPoint.lng === selectedPoint.lng && trackedPoint.type === selectedPoint.type}
          isLocked={!!lockedPoint && lockedPoint.lat === selectedPoint.lat && lockedPoint.lng === selectedPoint.lng && lockedPoint.type === selectedPoint.type}
          onTrack={() => handleTrack(selectedPoint)}
          onLock={() => handleLock(selectedPoint)}
        />
      )}


      {tourOpen && <OnboardingTour onClose={closeTour} />}


      {autoTour && (
        <AutoTour
          points={globePoints}
          onPhase={switchPhase}
          onModule={(id) => { setActiveModule(id); setModuleOpen(true); }}
          onModuleClose={() => setModuleOpen(false)}
          onSelectPoint={(p) => { setSelectedPoint(p); setShowDetailOverlay(true); }}
          onCloseDetail={() => { setShowDetailOverlay(false); setSelectedPoint(null); }}
          onCameraView={handleCameraView}
          onCloseBubble={() => setBubbleCam(null)}
          onEnd={() => setAutoTour(false)}
        />
      )}
    </div>
  );

  function handleIpTrack(directIp?: string, meta?: {
    requested?: string;
    resolvedFromDomain?: boolean;
    rdns?: string;
    city?: string;
    region?: string;
    country?: string;
    isp?: string;
    asn?: string;
    ips?: string[];
  }) {
    const target = (directIp ?? '').trim();
    if (!target) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/osint/ipgeo?ip=${encodeURIComponent(target)}`);
        const data = await res.json();
        if (cancelled) return;
        if (data.error) {
          showToast(`Lookup IP échoué : ${data.error}`, 'warn');
          return;
        }
        const lat = data.lat ?? data.latitude;
        const lng = data.lng ?? data.lon ?? data.longitude;
        if (lat && lng) {
          flyToLocation(lat, lng, 10);
          const via = meta?.resolvedFromDomain && meta.requested ? `${meta.requested} → ${target} · ` : '';
          const place = [data.city ?? meta?.city, data.region ?? meta?.region, data.country ?? meta?.country]
            .filter(Boolean).join(', ');
          const net = [meta?.rdns, meta?.isp].filter(Boolean).join(' · ');
          const label = `${via}${target} · ${place}${net ? ` (${net})` : ''}`;
          setGlobePoints(prev => {
            const filtered = prev.filter(p => p.type !== 'ip');
            return [...filtered, {
              lat, lng, size: 0.7, color: '#ff3333',
              label: `[TRACKED] ${label}`, type: 'ip',
              rawData: { ...data, trackMeta: meta },
            } as GlobePoint];
          });
          showToast(`Cible localisée : ${label}`, 'success');
        } else {
          showToast('Position indéterminée pour cette cible', 'warn');
        }
      } catch (err: any) {
        if (!cancelled) showToast(`Erreur lookup : ${err.message}`, 'warn');
      }
    })();
  }
}
