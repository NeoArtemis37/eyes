'use client';

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import * as THREE from 'three';
import type { GlobePoint, CameraData, FlightData, MaritimeData, AntennaData, IPGeoData, MilitaryData, SubmarineCable, FOAFDevice } from '@/lib/osint-data';
import {
  Camera, Plane, Cable, Radio, MapPin, X, Play, Pause, Circle,
  Maximize2, Volume2, VolumeX, Download, Signal,
  Wifi, Clock, Globe, Activity, Crosshair, Eye,
  RotateCcw, ExternalLink, Shield, Zap, RadioTower, Flag, Cpu,
  Flame, AlertTriangle, Users, Target, Radar, Siren
} from 'lucide-react';

interface PointDetailOverlayProps {
  point: GlobePoint;
  onClose: () => void;
  onToast?: (message: string, type: 'info' | 'warn' | 'success') => void;
  isTracked?: boolean;
  isLocked?: boolean;
  onTrack?: () => void;
  onLock?: () => void;
}

function CameraFeedCanvas({ cameraData }: { cameraData: CameraData | Record<string, any> }) {
  const [isPaused, setIsPaused] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [isRecording, setIsRecording] = useState(true);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [showFullscreen, setShowFullscreen] = useState(false);
  const [utcClock, setUtcClock] = useState('');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<any>(null);

  const data = cameraData as CameraData;
  const hasSnapshot = !!data.snapshotUrl;
  const hasStream = !!data.streamUrl;

  const streamType = useMemo(() => {
    const raw = data as any;
    if (raw.streamType) return raw.streamType;
    if (raw.stream_type) return raw.stream_type;
    const url = data.streamUrl || data.snapshotUrl || raw.feed_url || '';
    if (!url) return 'jpg';
    const lower = url.toLowerCase();
    if (lower.includes('youtube.com') || lower.includes('youtu.be')) return 'iframe';
    if (lower.includes('.m3u8') || lower.includes('hls') || lower.includes('mjpeg')) return 'hls';
    if (lower.includes('.mp4')) return 'mp4';
    return 'jpg';
  }, [data]);

  const iframeUrl = useMemo(() => {
    const raw = data as any;
    const url = raw.streamUrl || raw.stream_url || raw.feed_url || '';
    if (url.includes('youtube.com') || url.includes('youtu.be')) {
      let videoId = '';
      const ytMatch = url.match(/(?:v=|\/embed\/|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
      if (ytMatch) videoId = ytMatch[1];
      if (videoId) return `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1&controls=0`;
    }
    return url;
  }, [data]);

  const proxySnapshotUrl = useMemo(() => {
    const raw = data as any;
    const url = data.snapshotUrl || raw.feed_url || '';
    if (!url) return '';
    const lower = url.toLowerCase();
    if (lower.match(/\.(jpg|jpeg|png|gif|webp)(\?|$)/i) || lower.includes('image') || lower.includes('camera') || lower.includes('cctv') || lower.includes('axis-cgi')) {
      return `/api/osint/camera-proxy?url=${encodeURIComponent(url)}`;
    }
    return '';
  }, [data.snapshotUrl, (data as any).feed_url, refreshKey]);

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setUtcClock(`${now.getUTCHours().toString().padStart(2, '0')}:${now.getUTCMinutes().toString().padStart(2, '0')}:${now.getUTCSeconds().toString().padStart(2, '0')}Z`);
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (streamType !== 'hls' || !data.streamUrl) return;
    if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }

    const loadHls = async () => {
      const Hls = (await import('hls.js')).default;
      if (videoRef.current && Hls.isSupported()) {
        const hls = new Hls({ enableWorker: true, lowLatencyMode: true });
        hlsRef.current = hls;
        hls.loadSource(data.streamUrl!);
        hls.attachMedia(videoRef.current);
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          setImgLoaded(true);
          videoRef.current?.play().catch(() => {});
        });
        hls.on(Hls.Events.ERROR, (_, err) => { if (err.fatal) setImgError(true); });
      } else if (videoRef.current?.canPlayType('application/vnd.apple.mpegurl')) {
        videoRef.current.src = data.streamUrl!;
        videoRef.current.addEventListener('loadedmetadata', () => {
          setImgLoaded(true);
          videoRef.current?.play().catch(() => {});
        });
      }
    };
    loadHls();
    return () => { if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; } };
  }, [streamType, data.streamUrl]);

  useEffect(() => {
    if (streamType !== 'jpg' || !proxySnapshotUrl || isPaused) return;
    const interval = setInterval(() => { setRefreshKey(k => k + 1); }, 5000);
    return () => clearInterval(interval);
  }, [streamType, proxySnapshotUrl, isPaused]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;
    let frame = 0;

    const render = () => {
      frame++;
      ctx.clearRect(0, 0, W, H);

      if ((!hasSnapshot && streamType === 'jpg') || (streamType === 'jpg' && imgError)) {
        ctx.fillStyle = '#020202';
        ctx.fillRect(0, 0, W, H);
        for (let i = 0; i < 300; i++) {
          const x = Math.random() * W;
          const y = Math.random() * H;
          const v = Math.random() * 40 + 10;
          ctx.fillStyle = `rgba(${v}, ${v + 10}, ${v - 5}, 0.5)`;
          ctx.fillRect(x, y, 2, 2);
        }
        ctx.fillStyle = 'rgba(212, 175, 55, 0.7)';
        ctx.font = 'bold 16px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('NO SIGNAL', W / 2, H / 2 - 10);
        ctx.font = '9px monospace';
        ctx.fillStyle = 'rgba(212, 175, 55, 0.4)';
        ctx.fillText('AWAITING UPLINK...', W / 2, H / 2 + 10);
        ctx.textAlign = 'left';
      }

      ctx.fillStyle = 'rgba(255, 255, 255, 0.015)';
      for (let y = 0; y < H; y += 4) {
        ctx.fillRect(0, y, W, 1);
      }

      const grad = ctx.createRadialGradient(W / 2, H / 2, W * 0.25, W / 2, H / 2, W * 0.6);
      grad.addColorStop(0, 'rgba(0,0,0,0)');
      grad.addColorStop(1, 'rgba(0,0,0,0.4)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(W * 0.1, H / 2); ctx.lineTo(W * 0.9, H / 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(W / 2, H * 0.1); ctx.lineTo(W / 2, H * 0.9); ctx.stroke();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.beginPath(); ctx.arc(W / 2, H / 2, 32, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = 'rgba(212, 175, 55, 0.5)';
      ctx.beginPath(); ctx.arc(W / 2, H / 2, 2, 0, Math.PI * 2); ctx.fill();

      const cs = 12;
      const co = 4;
      ctx.strokeStyle = 'rgba(212, 175, 55, 0.2)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(co, co + cs); ctx.lineTo(co, co); ctx.lineTo(co + cs, co); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(W - co - cs, co); ctx.lineTo(W - co, co); ctx.lineTo(W - co, co + cs); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(co, H - co - cs); ctx.lineTo(co, H - co); ctx.lineTo(co + cs, H - co); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(W - co - cs, H - co); ctx.lineTo(W - co, H - co); ctx.lineTo(W - co, H - co - cs); ctx.stroke();

      animFrameRef.current = requestAnimationFrame(render);
    };

    animFrameRef.current = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [hasSnapshot, imgError, streamType]);

  const camIdDisplay = useMemo(() => {
    const raw = data as any;
    const id = data.id || raw.camera_code || 'CAM';
    const short = String(id).replace(/[^a-zA-Z0-9]/g, '').substring(0, 8).toUpperCase();
    if (short.length >= 4) return `CAM-${short.substring(0, 4)}-${short.substring(4)}`;
    return `CAM-${short}`;
  }, [data.id, (data as any).camera_code]);

  return (
    <div className="relative flex-1 bg-[#020202] rounded overflow-hidden" style={{ aspectRatio: '16/9' }}>
      {streamType === 'hls' && (
        <video
          ref={videoRef}
          className="absolute inset-0 w-full h-full object-cover"
          style={{ zIndex: 1 }}
          autoPlay
          muted
          playsInline
        />
      )}

      {streamType === 'mp4' && data.streamUrl && (
        <video
          src={data.streamUrl}
          className="absolute inset-0 w-full h-full object-cover"
          style={{ zIndex: 1 }}
          autoPlay
          muted
          playsInline
          loop
        />
      )}

      {streamType === 'iframe' && iframeUrl && (
        <iframe
          src={iframeUrl}
          className="absolute inset-0 w-full h-full"
          style={{ zIndex: 1, border: 0 }}
          allow="autoplay; fullscreen"
          allowFullScreen
        />
      )}

      {streamType === 'jpg' && proxySnapshotUrl && !imgError && (
        <img
          key={refreshKey}
          src={proxySnapshotUrl}
          alt={`${data.name || 'Camera'} live feed`}
          className="absolute inset-0 w-full h-full object-cover"
          style={{ filter: 'brightness(0.85) contrast(1.1) saturate(0.8)', zIndex: 1 }}
          onLoad={() => { setImgLoaded(true); setImgError(false); }}
          onError={() => { setImgError(true); setImgLoaded(false); }}
        />
      )}

      {(imgLoaded || streamType !== 'jpg') && (
        <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 2, background: 'rgba(212,175,55,0.03)' }} />
      )}

      <canvas
        ref={canvasRef}
        width={640}
        height={360}
        className="absolute inset-0 w-full h-full pointer-events-none"
        style={{ zIndex: 3 }}
      />

      <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 4 }}>
        <div className="absolute top-2 left-2 flex items-center gap-2">
          <span className="text-[9px] font-mono text-[#D4AF37] bg-black/80 px-1.5 py-0.5 rounded border border-[rgba(212,175,55,0.3)]" style={{ letterSpacing: '0.15em' }}>
            {camIdDisplay}
          </span>
          {(imgLoaded || streamType !== 'jpg') && (
            <div className="flex items-center gap-1 bg-black/80 px-1.5 py-0.5 rounded border border-[rgba(212,175,55,0.5)]">
              <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" style={{ boxShadow: '0 0 4px #ef4444' }} />
              <span className="text-[8px] font-mono text-white" style={{ letterSpacing: '0.2em' }}>
                {streamType === 'iframe' ? 'LIVE SAT-LINK' : 'LIVE'}
              </span>
            </div>
          )}
          {isRecording && (
            <div className="flex items-center gap-1 bg-black/80 px-1.5 py-0.5 rounded border border-red-900/50">
              <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
              <span className="text-[8px] font-mono text-red-400" style={{ letterSpacing: '0.1em' }}>REC</span>
            </div>
          )}
        </div>

        <div className="absolute top-2 right-2 flex items-center gap-2">
          <span className="text-[8px] font-mono text-[#8B7325] bg-black/80 px-1.5 py-0.5 rounded border border-[rgba(212,175,55,0.15)]" style={{ letterSpacing: '0.1em' }}>
            {streamType.toUpperCase()}
          </span>
          <span className="text-[8px] font-mono text-gray-400 bg-black/80 px-1.5 py-0.5 rounded border border-[rgba(212,175,55,0.15)]">
            <Clock className="w-2 h-2 inline mr-1" />
            {utcClock}
          </span>
        </div>

        <div className="absolute bottom-2 left-2">
          <span className="text-[8px] font-mono text-[#D4AF37] bg-black/80 px-1.5 py-0.5 rounded border border-[rgba(212,175,55,0.3)]" style={{ letterSpacing: '0.1em' }}>
            <Crosshair className="w-2 h-2 inline mr-1" />
            {(data.lat || 0).toFixed(4)}, {(data.lng || 0).toFixed(4)}
          </span>
        </div>

        <div className="absolute bottom-2 right-2">
          <span className="text-[7px] font-mono text-gray-500 bg-black/80 px-1.5 py-0.5 rounded border border-[rgba(212,175,55,0.08)]" style={{ letterSpacing: '0.1em' }}>
            {(imgLoaded || streamType !== 'jpg') ? 'ACTIVE' : 'CONNECTING...'} • {(data as any).source || 'LIVE'} • {streamType === 'hls' ? 'HLS' : streamType === 'iframe' ? 'EMBED' : 'SNAP'}
          </span>
        </div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 pointer-events-auto" style={{ zIndex: 5 }}>
        <div className="bg-gradient-to-t from-black/90 to-transparent pt-5 pb-1.5 px-3">
          <div className="w-full h-0.5 rounded mb-1.5" style={{ background: 'rgba(212,175,55,0.15)' }}>
            <div className="h-full rounded" style={{
              width: '33%',
              background: '#D4AF37',
              boxShadow: '0 0 6px rgba(212,175,55,0.5)',
              animation: 'progress-glow-slide 3s ease-in-out infinite',
            }} />
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <button onClick={() => setIsPaused(!isPaused)} className="text-gray-300 hover:text-white transition-colors">
                {isPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
              </button>
              <button onClick={() => setIsRecording(!isRecording)} className={`transition-colors ${isRecording ? 'text-red-400' : 'text-gray-500 hover:text-red-400'}`}>
                <Circle className="w-3 h-3" />
              </button>
              <button onClick={() => setIsMuted(!isMuted)} className="text-gray-400 hover:text-white transition-colors">
                {isMuted ? <VolumeX className="w-3 h-3" /> : <Volume2 className="w-3 h-3" />}
              </button>
              <button onClick={() => setRefreshKey(k => k + 1)} className="text-gray-400 hover:text-white transition-colors" title="Refresh feed">
                <RotateCcw className="w-3 h-3" />
              </button>
            </div>
            <div className="flex items-center gap-1.5">
              {hasStream && (
                <a href={data.streamUrl} target="_blank" rel="noopener noreferrer" className="text-[#D4AF37] hover:text-[#D4AF37]/80 transition-colors" title="Open raw feed">
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
              <button onClick={() => setShowFullscreen(!showFullscreen)} className="text-gray-400 hover:text-white transition-colors" title="Fullscreen">
                <Maximize2 className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {showFullscreen && hasStream && (
        <div className="fixed inset-0 z-[100] bg-black flex flex-col" style={{ zIndex: 100 }}>
          <div className="flex items-center justify-between px-4 py-2 bg-black/80 border-b" style={{ borderColor: 'rgba(212,175,55,0.15)' }}>
            <span className="text-[#D4AF37] font-mono text-xs" style={{ letterSpacing: '0.15em' }}>{data.name} · LIVE STREAM</span>
            <button onClick={() => setShowFullscreen(false)} className="text-gray-400 hover:text-white">
              <X className="w-5 h-5" />
            </button>
          </div>
          <iframe
            src={data.streamUrl}
            className="flex-1 w-full border-0"
            allow="autoplay; encrypted-media"
            title={`${data.name} live stream`}
          />
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MODÉLISATION 3D DES APPAREILS — géométries profilées, une par classification
// ─────────────────────────────────────────────────────────────────────────────

type FlightClass = 'commercial' | 'private' | 'military' | 'helicopter';

const FLIGHT_CLS_BADGES: Record<FlightClass, { label: string; className: string }> = {
  commercial: { label: 'AVION COMMERCIAL', className: 'text-sky-300 border-sky-400/30 bg-sky-500/10' },
  private: { label: 'AVIATION PRIVÉE', className: 'text-violet-300 border-violet-400/30 bg-violet-500/10' },
  military: { label: 'APPAREIL MILITAIRE', className: 'text-red-300 border-red-400/30 bg-red-500/10' },
  helicopter: { label: 'HÉLICOPTÈRE', className: 'text-amber-300 border-amber-400/30 bg-amber-500/10' },
};

const HELI_TYPE_RE = /^(H\d\d|AH\d|UH\d|CH\d|MH\d|VH\d|SH\d|HH\d|B2\d|B4\d|EC\d\d|EC1\d\d|AS3\d|A1\d\d|R22|R44|R66|MI\d\d|KA2\d|KA5\d|AN2|GLF)/i;

interface FlightModel {
  group: THREE.Group;
  cameraDist: number;
  lightPos: { port: THREE.Vector3; starboard: THREE.Vector3; tail: THREE.Vector3; beacon: THREE.Vector3 };
  tick?: (t: number, dt: number) => void;
}

// ── Fuselage paramétrique (espace corps : nez +X, dessus +Y, tribord +Z) ──
// Loft à sections paramétrables : nez ovoïde plein à la jonction cylindre et
// refermé en pointe, avec bascule « dauphin » (pointe abaissée), section
// mi-nez aplatie verticalement / élargie latéralement — plus de révolution
// symétrique en forme de ballon.
interface NoseOpts { droop?: number; flatten?: number; widen?: number }

function fuselageSurface(len: number, radius: number, noseFrac: number, tailFrac: number, nosePower: number, nose: NoseOpts = {}) {
  const noseStart = 1 - noseFrac;
  const dMax = (nose.droop ?? 0) * radius;
  const kH = nose.flatten ?? 0;
  const kW = nose.widen ?? 0;
  const tailR = 0.15;
  // (t : 0 = queue → 1 = nez ; phi : 0 = dessus, ±π/2 = flancs, π = ventre)
  return (t: number, phi: number): [number, number, number] => {
    if (t >= noseStart) {
      const u = Math.min(1, (t - noseStart) / (1 - noseStart)); // 0 jonction → 1 pointe
      const r = radius * Math.pow(Math.max(1 - u * u, 0.002), nosePower);
      const bulge = Math.sin(Math.PI * u); // 0 aux jonctions, 1 à mi-nez
      const hS = 1 - kH * bulge;
      const wS = 1 + kW * bulge;
      const dr = dMax * Math.pow(u, 1.6);
      return [t * len, r * Math.cos(phi) * hS - dr, r * Math.sin(phi) * wS];
    }
    const u = Math.max(0, t) / tailFrac;
    const r = t <= tailFrac
      ? radius * (tailR + (1 - tailR) * Math.pow(u, 0.8))
      : radius;
    return [t * len, r * Math.cos(phi), r * Math.sin(phi)];
  };
}

function fuselageLoft(surf: ReturnType<typeof fuselageSurface>): THREE.BufferGeometry {
  const NS = 96, NA = 48;
  const pos: number[] = [], uv: number[] = [], idx: number[] = [];
  for (let i = 0; i <= NS; i++) {
    const t = 0.5 - 0.5 * Math.cos(Math.PI * (i / NS)); // densité aux extrémités
    for (let j = 0; j <= NA; j++) {
      const [x, y, z] = surf(t, (j / NA) * Math.PI * 2); // couture de texture au-dessus
      pos.push(x, y, z);
      uv.push(j / NA, t);
    }
  }
  for (let i = 0; i < NS; i++) {
    for (let j = 0; j < NA; j++) {
      const a = i * (NA + 1) + j, b = a + NA + 1;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  // lisser la couture supérieure (colonnes 0 et NA partagent la même position)
  const nrm = geo.getAttribute('normal') as THREE.BufferAttribute;
  for (let i = 0; i <= NS; i++) {
    const a = i * (NA + 1), b = a + NA;
    const nx = (nrm.getX(a) + nrm.getX(b)) / 2;
    const ny = (nrm.getY(a) + nrm.getY(b)) / 2;
    const nz = (nrm.getZ(a) + nrm.getZ(b)) / 2;
    nrm.setXYZ(a, nx, ny, nz);
    nrm.setXYZ(b, nx, ny, nz);
  }
  return geo;
}

function fuselageGeometry(len: number, radius: number, noseFrac: number, tailFrac: number, nosePower: number, nose: NoseOpts = {}): THREE.BufferGeometry {
  return fuselageLoft(fuselageSurface(len, radius, noseFrac, tailFrac, nosePower, nose));
}

// Visière de cockpit : bande de vitres collée à la surface du nez,
// légèrement décollée (lift), s'affinant vers l'avant — rake naturel
function windshieldPatch(surf: ReturnType<typeof fuselageSurface>, t0: number, t1: number, phiSpan: number, lift: number): THREE.BufferGeometry {
  const ROWS = 12, COLS = 30;
  const pos: number[] = [], idx: number[] = [];
  for (let i = 0; i <= ROWS; i++) {
    const k = i / ROWS;
    const t = t0 + (t1 - t0) * k;
    const span = phiSpan * (1 - 0.18 * k); // affinement vers l'avant
    const cy = (surf(t, 0)[1] + surf(t, Math.PI)[1]) / 2; // centre de section (bascule du nez)
    for (let j = 0; j <= COLS; j++) {
      const phi = -span + 2 * span * (j / COLS);
      const [x, y, z] = surf(t, phi);
      const dy = y - cy, dz = z;
      const L2 = Math.hypot(dy, dz) || 1;
      pos.push(x, y + (dy / L2) * lift, z + (dz / L2) * lift);
    }
  }
  for (let i = 0; i < ROWS; i++) {
    for (let j = 0; j < COLS; j++) {
      const a = i * (COLS + 1) + j, b = a + COLS + 1;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

// Voilure : plan extrudé symétrique (corde → X, envergure → Z, épaisseur → Y)
function planformGeometry(rootLE: number, rootChord: number, tipLE: number, tipChord: number, halfSpan: number, thickness: number): THREE.ExtrudeGeometry {
  const s = new THREE.Shape();
  s.moveTo(rootLE, 0);
  s.lineTo(tipLE, halfSpan);
  s.lineTo(tipLE - tipChord, halfSpan);
  s.lineTo(rootLE - rootChord, 0);
  s.lineTo(tipLE - tipChord, -halfSpan);
  s.lineTo(tipLE, -halfSpan);
  s.closePath();
  const geo = new THREE.ExtrudeGeometry(s, {
    depth: thickness,
    bevelEnabled: true,
    bevelThickness: thickness * 0.35,
    bevelSize: Math.min(thickness * 0.42, 0.05),
    bevelSegments: 2,
    curveSegments: 3,
  });
  geo.rotateX(-Math.PI / 2);
  return geo;
}

// Dérive : plan vertical (corde → X, hauteur → Y, épaisseur → Z)
function finGeometry(rootLE: number, rootChord: number, tipLE: number, tipChord: number, height: number, thickness: number): THREE.ExtrudeGeometry {
  const s = new THREE.Shape();
  s.moveTo(rootLE, 0);
  s.lineTo(tipLE, height);
  s.lineTo(tipLE - tipChord, height);
  s.lineTo(rootLE - rootChord, 0);
  s.closePath();
  const geo = new THREE.ExtrudeGeometry(s, {
    depth: thickness,
    bevelEnabled: true,
    bevelThickness: thickness * 0.22,
    bevelSize: thickness * 0.22,
    bevelSegments: 1,
  });
  geo.translate(0, 0, -thickness / 2);
  return geo;
}

// Livrée peinte sur canvas : ventre assombri, hublots, portes, cockpit, cheatline, cocarde
// (u = canvas X : 0 = dessus, 0,25/0,75 = flancs, 0,5 = ventre ; v = canvas Y : haut = nez)
function makeLiveryTexture(cfg: {
  base: string; belly: string; accent: string;
  windows: number; winSpan: [number, number];
  cheatline: boolean; roundel: boolean; doors: boolean; panelLines: boolean;
  visor?: boolean;
}): THREE.CanvasTexture {
  const W = 1024, H = 512;
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const g = cv.getContext('2d')!;
  const rrect = (x: number, y: number, w: number, h: number, r: number) => {
    if (typeof (g as any).roundRect === 'function') (g as any).roundRect(x, y, w, h, r);
    else g.rect(x, y, w, h);
  };

  g.fillStyle = cfg.base;
  g.fillRect(0, 0, W, H);
  // ventre assombri (u = 0,5 → centre X)
  const bellyGrad = g.createLinearGradient(400, 0, 624, 0);
  bellyGrad.addColorStop(0, cfg.base);
  bellyGrad.addColorStop(0.5, cfg.belly);
  bellyGrad.addColorStop(1, cfg.base);
  g.fillStyle = bellyGrad;
  g.fillRect(400, 0, 224, H);
  // légère occlusion vers la queue
  const tailGrad = g.createLinearGradient(0, 0, 0, H);
  tailGrad.addColorStop(0.55, 'rgba(0,0,0,0)');
  tailGrad.addColorStop(1, 'rgba(0,0,0,0.10)');
  g.fillStyle = tailGrad;
  g.fillRect(0, 0, W, H);
  // radome (nez = haut du canvas)
  g.fillStyle = 'rgba(58,66,78,0.6)';
  g.fillRect(0, 0, W, 22);
  // lignes de section
  if (cfg.panelLines) {
    g.strokeStyle = 'rgba(10,14,20,0.14)';
    g.lineWidth = 2;
    for (const y of [0.24, 0.47, 0.72]) {
      g.beginPath();
      g.moveTo(0, y * H); g.lineTo(W, y * H); g.stroke();
    }
  }
  // hublots (2 flancs : X 256 et 768)
  if (cfg.windows > 1) {
    const y0 = cfg.winSpan[0] * H, y1 = cfg.winSpan[1] * H;
    const step = (y1 - y0) / (cfg.windows - 1);
    for (const cx of [256, 768]) {
      for (let i = 0; i < cfg.windows; i++) {
        const y = y0 + i * step;
        g.fillStyle = '#0c1219';
        g.beginPath(); rrect(cx - 5, y - 6, 10, 12, 4); g.fill();
        g.fillStyle = 'rgba(160,200,230,0.30)';
        g.fillRect(cx - 3, y - 4, 6, 3);
      }
    }
  }
  // portes
  if (cfg.doors) {
    g.strokeStyle = 'rgba(15,20,28,0.75)';
    g.lineWidth = 3;
    for (const cx of [256, 768]) {
      g.beginPath(); rrect(cx - 8, H * 0.135, 16, 30, 5); g.stroke();
      g.beginPath(); rrect(cx - 8, H * 0.735, 16, 30, 5); g.stroke();
    }
  }
  // vitres cockpit — assise sombre sur le DESSUS du nez (sous la visière 3D,
  // u=0/1 = couture dessus) + hublots latéraux façon « eyebrow »
  if (cfg.visor) {
    const xw = 158, y0 = 25, y1 = 57;
    for (const x of [0, W - xw]) {
      g.fillStyle = '#0a0f16';
      g.fillRect(x, y0, xw, y1 - y0);
      // cadre arrière (liseré clair côté cabine)
      g.fillStyle = 'rgba(185,200,214,0.38)';
      g.fillRect(x, y1 - 2, xw, 2);
    }
  }
  g.fillStyle = '#0d141d';
  for (const cx of [256, 768]) {
    if (cfg.visor) {
      g.beginPath(); rrect(cx - 30, 34, 26, 20, 6); g.fill();
      g.beginPath(); rrect(cx + 6, 38, 17, 14, 5); g.fill();
    } else {
      g.beginPath(); rrect(cx - 26, 30, 30, 22, 6); g.fill();
      g.beginPath(); rrect(cx + 2, 34, 20, 16, 5); g.fill();
    }
  }
  // cheatline (vers le ventre : X 272 / 737) — bleu sombre + cœur cyan lumineux
  // (un cyan clair seul disparaît sur le fuselage gris clair sous éclairage fort)
  if (cfg.cheatline) {
    g.fillStyle = cfg.accent === '#37e6ff' ? '#0d5f8f' : cfg.accent;
    g.fillRect(271, 24, 17, H - 48);
    g.fillRect(736, 24, 17, H - 48);
    if (cfg.accent === '#37e6ff') {
      g.fillStyle = '#37e6ff';
      g.fillRect(277, 24, 5, H - 48);
      g.fillRect(742, 24, 5, H - 48);
    }
  }
  // cocarde de queue
  if (cfg.roundel) {
    for (const cx of [256, 768]) {
      g.strokeStyle = cfg.accent;
      g.lineWidth = 6;
      g.beginPath(); g.arc(cx, H - 58, 26, 0, Math.PI * 2); g.stroke();
      g.fillStyle = cfg.accent;
      g.beginPath(); g.arc(cx, H - 58, 9, 0, Math.PI * 2); g.fill();
    }
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

let __flightGlowTex: THREE.CanvasTexture | null = null;
function getGlowTexture(): THREE.CanvasTexture {
  if (__flightGlowTex) return __flightGlowTex;
  const cv = document.createElement('canvas');
  cv.width = 64; cv.height = 64;
  const g = cv.getContext('2d')!;
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.25, 'rgba(255,255,255,0.85)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  __flightGlowTex = new THREE.CanvasTexture(cv);
  return __flightGlowTex;
}

function makePadTexture(): THREE.CanvasTexture {
  const cv = document.createElement('canvas');
  cv.width = 256; cv.height = 256;
  const g = cv.getContext('2d')!;
  const grad = g.createRadialGradient(128, 128, 8, 128, 128, 128);
  grad.addColorStop(0, 'rgba(53,224,255,0.30)');
  grad.addColorStop(0.55, 'rgba(53,224,255,0.10)');
  grad.addColorStop(1, 'rgba(53,224,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 256);
  g.strokeStyle = 'rgba(53,224,255,0.35)';
  g.lineWidth = 3;
  g.beginPath(); g.arc(128, 128, 118, 0, Math.PI * 2); g.stroke();
  g.lineWidth = 1.5;
  g.beginPath(); g.arc(128, 128, 74, 0, Math.PI * 2); g.stroke();
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeModelKit() {
  const bin: (THREE.BufferGeometry | THREE.Material | THREE.Texture)[] = [];
  return {
    track: <T extends THREE.BufferGeometry | THREE.Material | THREE.Texture>(x: T): T => { bin.push(x); return x; },
    dispose: () => { for (const x of bin) x.dispose(); bin.length = 0; },
  };
}

type ModelKit = ReturnType<typeof makeModelKit>;

function buildAirliner(kit: ModelKit): FlightModel {
  const L = 6.0, R = 0.34;
  const group = new THREE.Group();
  const body = new THREE.Group();
  body.position.x = -L / 2;
  group.add(body);

  const livery = kit.track(makeLiveryTexture({ base: '#d3dae2', belly: '#8b95a1', accent: '#37e6ff', windows: 14, winSpan: [0.185, 0.72], cheatline: true, roundel: true, doors: true, panelLines: true, visor: true }));
  const bodyMat = kit.track(new THREE.MeshPhysicalMaterial({ map: livery, metalness: 0.42, roughness: 0.45, clearcoat: 0.6, clearcoatRoughness: 0.3 }));
  const metalMat = kit.track(new THREE.MeshStandardMaterial({ color: 0x9aa6b2, metalness: 0.85, roughness: 0.34 }));
  const darkMat = kit.track(new THREE.MeshStandardMaterial({ color: 0x0d1218, metalness: 0.55, roughness: 0.4 }));
  const edgeMat = kit.track(new THREE.LineBasicMaterial({ color: 0x35e0ff, transparent: true, opacity: 0.16 }));

  const addPart = (geo: THREE.BufferGeometry, mat: THREE.Material, px = 0, py = 0, pz = 0, rx = 0, ry = 0, rz = 0, edges = false) => {
    const mesh = new THREE.Mesh(kit.track(geo), mat);
    mesh.position.set(px, py, pz);
    mesh.rotation.set(rx, ry, rz);
    body.add(mesh);
    if (edges) {
      const wire = new THREE.LineSegments(kit.track(new THREE.EdgesGeometry(geo, 18)), edgeMat);
      wire.position.copy(mesh.position);
      wire.rotation.copy(mesh.rotation);
      body.add(wire);
    }
    return mesh;
  };

  // nez « dauphin » : pointe abaissée, front aplati + visière de cockpit vitrée
  const surf = fuselageSurface(L, R, 0.13, 0.22, 0.42, { droop: 0.42, flatten: 0.22, widen: 0.12 });
  addPart(fuselageLoft(surf), bodyMat, 0, 0, 0, 0, 0, 0, true);
  const glassMat = kit.track(new THREE.MeshPhysicalMaterial({ color: 0x060c14, metalness: 0.1, roughness: 0.05, clearcoat: 1, clearcoatRoughness: 0.05, side: THREE.DoubleSide }));
  addPart(windshieldPatch(surf, 0.895, 0.945, 1.02, R * 0.05), glassMat);
  addPart(new THREE.CylinderGeometry(0.045, 0.12, 0.8, 14), bodyMat, -0.32, 0.075, 0, 0, 0, 1.42); // cône arrière retroussé
  addPart(planformGeometry(0.85, 1.35, -0.45, 0.42, 2.55, 0.10), bodyMat, L * 0.52, -0.15, 0, 0, 0, 0, true); // voilure
  addPart(finGeometry(0.16, 0.34, -0.05, 0.16, 0.34, 0.05), bodyMat, L * 0.52 - 0.72, -0.11, 2.52, 0.45, 0, 0); // winglet tribord
  addPart(finGeometry(0.16, 0.34, -0.05, 0.16, 0.34, 0.05), bodyMat, L * 0.52 - 0.72, -0.11, -2.52, -0.45, 0, 0); // winglet bâbord
  addPart(planformGeometry(0.34, 0.55, -0.16, 0.20, 0.98, 0.06), bodyMat, L * 0.14, 0.20, 0, 0, 0, 0, true); // empennage horizontal
  addPart(finGeometry(0.55, 0.95, -0.20, 0.40, 0.92, 0.055), bodyMat, L * 0.145, 0.14, 0, 0, 0, 0, true); // dérive
  for (const s of [1, -1]) {
    const px = L * 0.52 + 0.18, py = -0.33, pz = s * 1.05;
    addPart(new THREE.CylinderGeometry(0.235, 0.205, 0.8, 22), metalMat, px, py, pz, 0, 0, -Math.PI / 2, true);
    addPart(new THREE.TorusGeometry(0.225, 0.028, 10, 26), metalMat, px + 0.40, py, pz, 0, Math.PI / 2, 0);
    addPart(new THREE.CircleGeometry(0.20, 22), darkMat, px + 0.36, py, pz, 0, Math.PI / 2, 0);
    addPart(new THREE.ConeGeometry(0.05, 0.10, 10), darkMat, px + 0.40, py, pz, 0, 0, -Math.PI / 2);
    addPart(new THREE.CylinderGeometry(0.10, 0.16, 0.24, 14), darkMat, px - 0.48, py, pz, 0, 0, -Math.PI / 2);
    addPart(new THREE.BoxGeometry(0.46, 0.26, 0.06), metalMat, px - 0.02, py + 0.24, pz);
  }
  return {
    group,
    cameraDist: 6.5,
    lightPos: {
      port: new THREE.Vector3(-0.60, -0.08, -2.58),
      starboard: new THREE.Vector3(-0.60, -0.08, 2.58),
      tail: new THREE.Vector3(-3.55, 0, 0),
      beacon: new THREE.Vector3(-0.48, 0.38, 0),
    },
  };
}

function buildBizjet(kit: ModelKit): FlightModel {
  const L = 4.8, R = 0.30;
  const group = new THREE.Group();
  const body = new THREE.Group();
  body.position.x = -L / 2;
  group.add(body);

  const livery = kit.track(makeLiveryTexture({ base: '#e9e6dc', belly: '#a8adb5', accent: '#d4af37', windows: 5, winSpan: [0.20, 0.50], cheatline: true, roundel: true, doors: true, panelLines: true, visor: true }));
  const bodyMat = kit.track(new THREE.MeshPhysicalMaterial({ map: livery, metalness: 0.40, roughness: 0.42, clearcoat: 0.7, clearcoatRoughness: 0.22 }));
  const metalMat = kit.track(new THREE.MeshStandardMaterial({ color: 0xb7c0c8, metalness: 0.85, roughness: 0.3 }));
  const darkMat = kit.track(new THREE.MeshStandardMaterial({ color: 0x0d1218, metalness: 0.55, roughness: 0.4 }));
  const edgeMat = kit.track(new THREE.LineBasicMaterial({ color: 0xd4af37, transparent: true, opacity: 0.14 }));

  const addPart = (geo: THREE.BufferGeometry, mat: THREE.Material, px = 0, py = 0, pz = 0, rx = 0, ry = 0, rz = 0, edges = false) => {
    const mesh = new THREE.Mesh(kit.track(geo), mat);
    mesh.position.set(px, py, pz);
    mesh.rotation.set(rx, ry, rz);
    body.add(mesh);
    if (edges) {
      const wire = new THREE.LineSegments(kit.track(new THREE.EdgesGeometry(geo, 18)), edgeMat);
      wire.position.copy(mesh.position);
      wire.rotation.copy(mesh.rotation);
      body.add(wire);
    }
    return mesh;
  };

  // nez « dauphin » compact + visière de cockpit vitrée
  const surf = fuselageSurface(L, R, 0.14, 0.22, 0.5, { droop: 0.36, flatten: 0.20, widen: 0.10 });
  addPart(fuselageLoft(surf), bodyMat, 0, 0, 0, 0, 0, 0, true);
  const glassMat = kit.track(new THREE.MeshPhysicalMaterial({ color: 0x060c14, metalness: 0.1, roughness: 0.05, clearcoat: 1, clearcoatRoughness: 0.05, side: THREE.DoubleSide }));
  addPart(windshieldPatch(surf, 0.887, 0.938, 0.92, R * 0.055), glassMat);
  addPart(new THREE.CylinderGeometry(0.04, 0.11, 0.7, 14), bodyMat, -0.25, 0.07, 0, 0, 0, 1.42);
  addPart(planformGeometry(0.62, 1.05, -0.28, 0.36, 1.65, 0.09), bodyMat, L * 0.40, -0.06, 0, 0, 0, 0, true);
  addPart(finGeometry(0.48, 0.80, -0.22, 0.34, 1.02, 0.05), bodyMat, L * 0.115, 0.10, 0, 0, 0, 0, true);
  addPart(planformGeometry(0.34, 0.50, -0.14, 0.18, 0.80, 0.05), bodyMat, L * 0.08, 1.06, 0, 0, 0, 0, true); // empennage en T
  for (const s of [1, -1]) {
    const px = L * 0.26, py = 0.12, pz = s * 0.42;
    addPart(new THREE.CylinderGeometry(0.17, 0.15, 0.55, 18), metalMat, px, py, pz, 0, 0, -Math.PI / 2, true);
    addPart(new THREE.TorusGeometry(0.16, 0.022, 8, 22), metalMat, px + 0.27, py, pz, 0, Math.PI / 2, 0);
    addPart(new THREE.CircleGeometry(0.145, 18), darkMat, px + 0.24, py, pz, 0, Math.PI / 2, 0);
    addPart(new THREE.CylinderGeometry(0.06, 0.10, 0.16, 12), darkMat, px - 0.32, py, pz, 0, 0, -Math.PI / 2);
    addPart(new THREE.BoxGeometry(0.55, 0.10, 0.14), metalMat, px - 0.02, 0.02, s * 0.24);
  }
  return {
    group,
    cameraDist: 5.5,
    lightPos: {
      port: new THREE.Vector3(-0.94, -0.02, -1.67),
      starboard: new THREE.Vector3(-0.94, -0.02, 1.67),
      tail: new THREE.Vector3(-2.55, 0, 0),
      beacon: new THREE.Vector3(-0.40, 0.34, 0),
    },
  };
}

function buildFighter(kit: ModelKit): FlightModel {
  const L = 5.2, R = 0.28;
  const group = new THREE.Group();
  const body = new THREE.Group();
  body.position.x = -L / 2;
  group.add(body);

  const livery = kit.track(makeLiveryTexture({ base: '#6d7683', belly: '#565e69', accent: '#4a5568', windows: 0, winSpan: [0, 1], cheatline: false, roundel: false, doors: false, panelLines: true }));
  const bodyMat = kit.track(new THREE.MeshPhysicalMaterial({ map: livery, metalness: 0.55, roughness: 0.5, clearcoat: 0.35 }));
  const metalMat = kit.track(new THREE.MeshStandardMaterial({ color: 0x7d8794, metalness: 0.85, roughness: 0.38 }));
  const darkMat = kit.track(new THREE.MeshStandardMaterial({ color: 0x0c1016, metalness: 0.55, roughness: 0.4 }));
  const glassMat = kit.track(new THREE.MeshPhysicalMaterial({ color: 0x0a1420, metalness: 0.1, roughness: 0.06, clearcoat: 1, clearcoatRoughness: 0.06 }));
  const edgeMat = kit.track(new THREE.LineBasicMaterial({ color: 0x35e0ff, transparent: true, opacity: 0.15 }));

  const addPart = (geo: THREE.BufferGeometry, mat: THREE.Material, px = 0, py = 0, pz = 0, rx = 0, ry = 0, rz = 0, edges = false, scale?: [number, number, number]) => {
    const mesh = new THREE.Mesh(kit.track(geo), mat);
    mesh.position.set(px, py, pz);
    mesh.rotation.set(rx, ry, rz);
    if (scale) mesh.scale.set(scale[0], scale[1], scale[2]);
    body.add(mesh);
    if (edges) {
      const wire = new THREE.LineSegments(kit.track(new THREE.EdgesGeometry(geo, 18)), edgeMat);
      wire.position.copy(mesh.position);
      wire.rotation.copy(mesh.rotation);
      body.add(wire);
    }
    return mesh;
  };

  addPart(fuselageGeometry(L, R, 0.20, 0.16, 1.55, { droop: 0.06 }), bodyMat, 0, 0, 0, 0, 0, 0, true); // fuselage effilé + radôme pointu
  addPart(new THREE.SphereGeometry(0.24, 18, 12), glassMat, L * 0.66, 0.24, 0, 0, 0, 0, false, [2.3, 0.75, 1.0]); // verrière
  addPart(planformGeometry(0.95, 2.1, -0.60, 0.35, 1.60, 0.08), bodyMat, L * 0.47, 0.0, 0, 0, 0, 0, true); // voilure delta
  addPart(planformGeometry(0.42, 0.55, -0.20, 0.16, 0.85, 0.05), bodyMat, L * 0.115, 0.05, 0, 0, 0, 0, true); // stabilos
  for (const s of [1, -1]) {
    addPart(finGeometry(0.50, 0.62, -0.18, 0.26, 0.78, 0.045), bodyMat, L * 0.135, 0.16, s * 0.40, s * 0.30, 0, 0, true);
    addPart(new THREE.BoxGeometry(0.85, 0.32, 0.18), darkMat, L * 0.56, -0.06, s * 0.31); // entrées d'air
  }
  addPart(new THREE.CylinderGeometry(0.16, 0.24, 0.42, 18), metalMat, 0.0, 0, 0, 0, 0, -Math.PI / 2, true); // tuyère
  const glowMat = kit.track(new THREE.MeshBasicMaterial({ color: 0xff9a3d, transparent: true, opacity: 0.75, blending: THREE.AdditiveBlending, depthWrite: false }));
  addPart(new THREE.CircleGeometry(0.15, 20), glowMat, -0.24, 0, 0, 0, -Math.PI / 2, 0); // lueur de tuyère

  return {
    group,
    cameraDist: 5.9,
    lightPos: {
      port: new THREE.Vector3(-0.93, 0.02, -1.62),
      starboard: new THREE.Vector3(-0.93, 0.02, 1.62),
      tail: new THREE.Vector3(-2.75, 0, 0),
      beacon: new THREE.Vector3(-0.30, 0.30, 0),
    },
    tick: (t) => { glowMat.opacity = 0.5 + 0.3 * Math.sin(t * 33); },
  };
}

function buildHelicopter(kit: ModelKit): FlightModel {
  const group = new THREE.Group();
  const hullMat = kit.track(new THREE.MeshPhysicalMaterial({ color: 0x2a323d, metalness: 0.5, roughness: 0.42, clearcoat: 0.5, clearcoatRoughness: 0.3 }));
  const glassMat = kit.track(new THREE.MeshPhysicalMaterial({ color: 0x0d1826, metalness: 0.15, roughness: 0.08, clearcoat: 1, clearcoatRoughness: 0.08 }));
  const darkMat = kit.track(new THREE.MeshStandardMaterial({ color: 0x11161d, metalness: 0.5, roughness: 0.45 }));
  const metalMat = kit.track(new THREE.MeshStandardMaterial({ color: 0x9aa6b2, metalness: 0.85, roughness: 0.32 }));

  const addPart = (geo: THREE.BufferGeometry, mat: THREE.Material, px = 0, py = 0, pz = 0, rx = 0, ry = 0, rz = 0, scale?: [number, number, number]) => {
    const mesh = new THREE.Mesh(kit.track(geo), mat);
    mesh.position.set(px, py, pz);
    mesh.rotation.set(rx, ry, rz);
    if (scale) mesh.scale.set(scale[0], scale[1], scale[2]);
    group.add(mesh);
    return mesh;
  };

  addPart(new THREE.CapsuleGeometry(0.46, 1.0, 6, 18), hullMat, 0.35, 0, 0, 0, 0, -Math.PI / 2); // cabine
  addPart(new THREE.SphereGeometry(0.40, 18, 14), glassMat, 1.25, 0.10, 0, 0, 0, 0, [1.5, 0.9, 1.0]); // bulle vitrée
  addPart(new THREE.CylinderGeometry(0.06, 0.30, 1.6, 12), hullMat, -1.35, 0.15, 0, 0, 0, Math.PI / 2); // poutail
  addPart(finGeometry(0.30, 0.42, 0.04, 0.16, 0.52, 0.04), hullMat, -2.05, 0.18, 0);
  addPart(planformGeometry(0.22, 0.34, -0.04, 0.12, 0.52, 0.04), hullMat, -1.72, 0.20, 0);
  for (const s of [1, -1]) {
    addPart(new THREE.CylinderGeometry(0.045, 0.045, 2.2, 10), metalMat, 0.30, -0.66, s * 0.50, 0, 0, -Math.PI / 2);
    addPart(new THREE.BoxGeometry(0.06, 0.42, 0.06), metalMat, 1.05, -0.45, s * 0.48, 0, 0, s * 0.25);
    addPart(new THREE.BoxGeometry(0.06, 0.42, 0.06), metalMat, -0.45, -0.45, s * 0.48, 0, 0, s * 0.25);
  }
  addPart(new THREE.CylinderGeometry(0.05, 0.07, 0.24, 10), darkMat, 0.42, 0.60, 0); // mât rotor

  const rotor = new THREE.Group();
  rotor.position.set(0.42, 0.72, 0);
  const hub = new THREE.Mesh(kit.track(new THREE.CylinderGeometry(0.13, 0.15, 0.10, 12)), darkMat);
  rotor.add(hub);
  const bladeGeo = kit.track(new THREE.BoxGeometry(4.7, 0.035, 0.30));
  rotor.add(new THREE.Mesh(bladeGeo, darkMat));
  const blade2 = new THREE.Mesh(bladeGeo, darkMat);
  blade2.rotation.y = Math.PI / 2;
  rotor.add(blade2);
  group.add(rotor);
  const discMat = kit.track(new THREE.MeshBasicMaterial({ color: 0x35e0ff, transparent: true, opacity: 0.10, side: THREE.DoubleSide, depthWrite: false }));
  addPart(new THREE.CircleGeometry(2.35, 40), discMat, 0.42, 0.75, 0, -Math.PI / 2, 0, 0); // disque rotor

  const tailRotor = new THREE.Group();
  tailRotor.position.set(-2.08, 0.42, 0.15);
  const trGeo = kit.track(new THREE.BoxGeometry(0.14, 1.30, 0.05));
  tailRotor.add(new THREE.Mesh(trGeo, darkMat));
  const tr2 = new THREE.Mesh(trGeo, darkMat);
  tr2.rotation.z = Math.PI / 2;
  tailRotor.add(tr2);
  group.add(tailRotor);

  return {
    group,
    cameraDist: 5.2,
    lightPos: {
      port: new THREE.Vector3(-1.72, 0.20, -0.57),
      starboard: new THREE.Vector3(-1.72, 0.20, 0.57),
      tail: new THREE.Vector3(-2.40, 0.30, 0),
      beacon: new THREE.Vector3(0.42, 0.88, 0),
    },
    tick: (_t, dt) => { rotor.rotation.y += dt * 14; tailRotor.rotation.z += dt * 24; },
  };
}

function buildFlightModel(cls: FlightClass, kit: ModelKit): FlightModel {
  if (cls === 'helicopter') return buildHelicopter(kit);
  if (cls === 'military') return buildFighter(kit);
  if (cls === 'private') return buildBizjet(kit);
  return buildAirliner(kit);
}

function FlightTrackDisplay({ flightData }: { flightData: Record<string, any> }) {
  const callsign = flightData.callsign || flightData.icao24 || 'UNKNOWN';
  const altitude = flightData.altitude || flightData.baro_altitude || 35000;
  const velocity = flightData.velocity || 450;
  const heading = flightData.heading || 0;
  const verticalRate = typeof flightData.verticalRate === 'number' ? flightData.verticalRate : null;
  const aircraftType: string = typeof flightData.aircraftType === 'string' ? flightData.aircraftType : '';
  const rawClass: string = typeof flightData.classification === 'string' ? flightData.classification : '';
  const isHeliType = HELI_TYPE_RE.test(aircraftType);
  const cls: FlightClass =
    rawClass === 'helicopter' || (rawClass === 'military' && isHeliType)
      ? 'helicopter'
      : rawClass === 'military'
        ? 'military'
        : rawClass === 'private'
          ? 'private'
          : 'commercial';

  const hostRef = useRef<HTMLDivElement>(null);
  const [noWebgl] = useState(() => {
    if (typeof window === 'undefined') return false;
    try {
      const c = document.createElement('canvas');
      return !(c.getContext('webgl') || c.getContext('experimental-webgl'));
    } catch {
      return true;
    }
  });
  const headingRef = useRef(heading);
  useEffect(() => { headingRef.current = heading; }, [heading]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || noWebgl) return;
    const soft = !!(window as any).__horusSoftGpu;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: !soft, alpha: true });
    } catch {
      return;
    }
    renderer.setPixelRatio(soft ? 1 : Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(host.clientWidth || 320, host.clientHeight || 220);
    const dom = renderer.domElement;
    dom.style.touchAction = 'none';
    dom.style.cursor = 'grab';
    host.appendChild(dom);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(36, (host.clientWidth || 320) / (host.clientHeight || 220), 0.1, 100);

    scene.add(new THREE.AmbientLight(0x223148, 1.05));
    const key = new THREE.DirectionalLight(0xffffff, 1.55);
    key.position.set(3, 5, 4);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0x8aa2c4, 0.55);
    fill.position.set(-3, -2, -4);
    scene.add(fill);
    const rimCyan = new THREE.PointLight(0x35e0ff, 26, 26);
    rimCyan.position.set(-4, 1.6, 2.4);
    scene.add(rimCyan);
    const rimWarm = new THREE.PointLight(0xffb347, 12, 22);
    rimWarm.position.set(4.4, -0.8, -3.2);
    scene.add(rimWarm);

    const kit = makeModelKit();
    const model = buildFlightModel(cls, kit);

    const rig = new THREE.Group();
    const inner = new THREE.Group();
    inner.add(model.group);
    rig.add(inner);
    inner.rotation.y = THREE.MathUtils.degToRad(headingRef.current ?? 0);
    scene.add(rig);

    camera.position.set(0.60, 0.34, 1.0).normalize().multiplyScalar(model.cameraDist);
    camera.lookAt(0, 0, 0);

    // socle holographique + grille polaire + anneau de scan
    const padTex = kit.track(makePadTexture());
    const padMat = kit.track(new THREE.MeshBasicMaterial({ map: padTex, transparent: true, opacity: 0.55, depthWrite: false }));
    const pad = new THREE.Mesh(kit.track(new THREE.CircleGeometry(3.2, 40)), padMat);
    pad.rotation.x = -Math.PI / 2;
    pad.position.y = -1.15;
    scene.add(pad);
    const ringMat = kit.track(new THREE.MeshBasicMaterial({ color: 0x35e0ff, transparent: true, opacity: 0.4, side: THREE.DoubleSide, depthWrite: false }));
    const ring = new THREE.Mesh(kit.track(new THREE.RingGeometry(0.96, 1.0, 56)), ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = -1.14;
    scene.add(ring);
    const grid = new THREE.PolarGridHelper(3.0, 16, 6, 64, 0x0e5f74, 0x0b3c4d);
    grid.position.y = -1.15;
    (grid.material as THREE.Material).transparent = true;
    (grid.material as THREE.Material).opacity = 0.4;
    scene.add(grid);

    // feux de navigation (bâbord rouge, tribord vert, strobe queue, phare rouge)
    const navs: { mat: THREE.SpriteMaterial; pattern: (t: number) => number }[] = [];
    const addNav = (pos: THREE.Vector3, color: number, scale: number, pattern: (t: number) => number) => {
      const mat = kit.track(new THREE.SpriteMaterial({ map: getGlowTexture(), color, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
      const s = new THREE.Sprite(mat);
      s.position.copy(pos);
      s.scale.setScalar(scale);
      model.group.add(s);
      navs.push({ mat, pattern });
    };
    addNav(model.lightPos.port, 0xff4455, 0.34, t => 0.5 + 0.5 * Math.sin(t * 5));
    addNav(model.lightPos.starboard, 0x33ff88, 0.34, t => 0.5 + 0.5 * Math.sin(t * 5 + 1.7));
    addNav(model.lightPos.tail, 0xffffff, 0.42, t => { const p = t % 1.7; return p < 0.07 || (p > 0.16 && p < 0.23) ? 1 : 0.04; });
    addNav(model.lightPos.beacon, 0xff2222, 0.36, t => (t % 1.15) < 0.11 ? 1 : 0.05);

    // rotation manuelle (glisser) + pivot automatique
    let dragging = false;
    let px = 0, py = 0;
    const onDown = (e: PointerEvent) => {
      dragging = true;
      px = e.clientX; py = e.clientY;
      dom.setPointerCapture?.(e.pointerId);
      dom.style.cursor = 'grabbing';
    };
    const onMove = (e: PointerEvent) => {
      if (!dragging) return;
      rig.rotation.y += (e.clientX - px) * 0.0062;
      rig.rotation.x = THREE.MathUtils.clamp(rig.rotation.x + (e.clientY - py) * 0.0038, -0.55, 0.6);
      px = e.clientX; py = e.clientY;
    };
    const onUp = () => {
      dragging = false;
      dom.style.cursor = 'grab';
    };
    dom.addEventListener('pointerdown', onDown);
    dom.addEventListener('pointermove', onMove);
    dom.addEventListener('pointerup', onUp);
    dom.addEventListener('pointercancel', onUp);

    let raf = 0;
    const clock = new THREE.Clock();
    const spin = () => {
      const dt = Math.min(clock.getDelta(), 0.05);
      const t = clock.elapsedTime;
      if (!dragging) rig.rotation.y += dt * 0.24;
      inner.position.y = Math.sin(t * 0.9) * 0.055;
      inner.rotation.z = Math.sin(t * 0.6) * 0.05;
      model.tick?.(t, dt);
      for (const n of navs) n.mat.opacity = n.pattern(t);
      const ph = (t % 2.8) / 2.8;
      ring.scale.setScalar(0.55 + ph * 2.3);
      ringMat.opacity = 0.42 * (1 - ph);
      renderer.render(scene, camera);
      raf = requestAnimationFrame(spin);
    };
    spin();

    const ro = new ResizeObserver(() => {
      const w = host.clientWidth || 320;
      const h = host.clientHeight || 220;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    });
    ro.observe(host);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      dom.removeEventListener('pointerdown', onDown);
      dom.removeEventListener('pointermove', onMove);
      dom.removeEventListener('pointerup', onUp);
      dom.removeEventListener('pointercancel', onUp);
      kit.dispose();
      (grid.material as THREE.Material).dispose();
      grid.geometry.dispose();
      renderer.dispose();
      if (dom.parentNode === host) host.removeChild(dom);
    };
  }, [noWebgl, cls]);

  const hud = (
    <>
      <div className="absolute top-2 left-2 flex flex-col items-start gap-1 pointer-events-none">
        <span className="text-[10px] font-mono text-blue-400 bg-black/60 px-1.5 py-0.5 rounded">
          VOL EN DIRECT · {callsign}{aircraftType ? ` · ${aircraftType}` : ''}
        </span>
        <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded border ${FLIGHT_CLS_BADGES[cls].className}`}>
          {FLIGHT_CLS_BADGES[cls].label}
        </span>
      </div>
      <div className="absolute top-2 right-2 flex flex-col items-end gap-1 pointer-events-none">
        <span className="text-[9px] font-mono text-cyan-300 bg-black/60 px-1.5 py-0.5 rounded tracking-[0.14em]">
          INSPECTION 3D
        </span>
        {!noWebgl && (
          <span className="text-[8px] font-mono text-gray-400 bg-black/60 px-1.5 py-0.5 rounded">
            GLISSER POUR PIVOTER
          </span>
        )}
      </div>
      <div className="absolute bottom-2 left-2 right-2 pointer-events-none flex items-center justify-between text-[9px] font-mono">
        <span className="text-blue-400 bg-black/60 px-1.5 py-0.5 rounded">FL{Math.round(altitude / 100)}</span>
        {verticalRate !== null && verticalRate !== 0 && (
          <span className={`${verticalRate > 0 ? 'text-emerald-400' : 'text-orange-400'} bg-black/60 px-1.5 py-0.5 rounded`}>
            VS {verticalRate > 0 ? '+' : ''}{Math.round(verticalRate)} ft/min
          </span>
        )}
        <span className="text-cyan-400 bg-black/60 px-1.5 py-0.5 rounded">{Math.round(velocity)} kts</span>
        <span className="text-emerald-400 bg-black/60 px-1.5 py-0.5 rounded">HDG {Math.round(heading)}°</span>
      </div>
    </>
  );

  if (noWebgl) {
    return (
      <div className="relative flex-1 bg-black rounded overflow-hidden select-none" style={{ minHeight: '220px' }}>
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <svg
            width="170"
            height="170"
            viewBox="0 0 64 64"
            style={{ transform: `rotate(${Math.round(heading)}deg)`, filter: 'drop-shadow(0 0 10px rgba(0,204,255,0.7))' }}
          >
            <g fill="#7dd3fc">
              <path d="M32 2.6 C33.3 4.4 34 7.2 34 10.5 L34 21 L57.5 32.8 L57.5 36.2 L34.4 31.2 L34 43 L39.6 48.4 L39.6 50.6 L33.2 49 L32 52.6 L30.8 49 L24.4 50.6 L24.4 48.4 L30 43 L29.6 31.2 L6.5 36.2 L6.5 32.8 L30 21 L30 10.5 C30 7.2 30.7 4.4 32 2.6 Z" />
            </g>
          </svg>
        </div>
        {hud}
      </div>
    );
  }

  return (
    <div className="relative flex-1 bg-black rounded overflow-hidden select-none" style={{ minHeight: '220px' }}>
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage:
            'linear-gradient(rgba(0,204,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(0,204,255,0.06) 1px, transparent 1px)',
          backgroundSize: '30px 30px',
          maskImage: 'radial-gradient(ellipse at center, black 40%, transparent 80%)',
          WebkitMaskImage: 'radial-gradient(ellipse at center, black 40%, transparent 80%)',
        }}
      />
      <div ref={hostRef} className="absolute inset-0" />
      {hud}
    </div>
  );
}

function CableRouteDisplay({ cableData }: { cableData: Record<string, any> }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width = canvas.offsetWidth * 2;
    const h = canvas.height = canvas.offsetHeight * 2;
    ctx.scale(2, 2);
    const cw = w / 2;
    const ch = h / 2;

    let frame = 0;
    let animId: number;

    const draw = () => {
      ctx.fillStyle = '#050810';
      ctx.fillRect(0, 0, cw, ch);

      ctx.strokeStyle = 'rgba(100, 50, 200, 0.08)';
      ctx.lineWidth = 0.5;
      for (let x = 0; x < cw; x += 30) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, ch); ctx.stroke();
      }
      for (let y = 0; y < ch; y += 30) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(cw, y); ctx.stroke();
      }

      const route = cableData.route || [];
      const landingPoints = cableData.landingPoints || [];
      const isOutage = cableData.status === 'outage';
      const isBuild = cableData.status === 'under_construction';

      if (route.length >= 2) {
        let minLat = 90, maxLat = -90, minLng = 180, maxLng = -180;
        route.forEach(([lat, lng]: [number, number]) => {
          minLat = Math.min(minLat, lat); maxLat = Math.max(maxLat, lat);
          minLng = Math.min(minLng, lng); maxLng = Math.max(maxLng, lng);
        });
        const padLat = (maxLat - minLat) * 0.15 || 5;
        const padLng = (maxLng - minLng) * 0.15 || 5;
        minLat -= padLat; maxLat += padLat; minLng -= padLng; maxLng += padLng;

        const toX = (lng: number) => ((lng - minLng) / (maxLng - minLng)) * (cw - 40) + 20;
        const toY = (lat: number) => ch - ((lat - minLat) / (maxLat - minLat)) * (ch - 40) - 20;

        const cableColor = isOutage ? 'rgba(255, 68, 68,' : isBuild ? 'rgba(255, 170, 0,' : 'rgba(180, 100, 255,';

        ctx.strokeStyle = cableColor + '0.15)';
        ctx.lineWidth = 6;
        ctx.beginPath();
        route.forEach(([lat, lng]: [number, number], i: number) => {
          if (i === 0) ctx.moveTo(toX(lng), toY(lat));
          else ctx.lineTo(toX(lng), toY(lat));
        });
        ctx.stroke();

        ctx.strokeStyle = cableColor + '0.8)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        route.forEach(([lat, lng]: [number, number], i: number) => {
          if (i === 0) ctx.moveTo(toX(lng), toY(lat));
          else ctx.lineTo(toX(lng), toY(lat));
        });
        ctx.stroke();

        if (!isOutage) {
          const totalSegments = route.length - 1;
          const flowPos = (frame % 120) / 120;
          for (let dot = 0; dot < 5; dot++) {
            const t = (flowPos + dot * 0.2) % 1;
            const segIdx = Math.floor(t * totalSegments);
            const segT = (t * totalSegments) - segIdx;
            if (segIdx < totalSegments) {
              const x1 = toX(route[segIdx][1]);
              const y1 = toY(route[segIdx][0]);
              const x2 = toX(route[segIdx + 1][1]);
              const y2 = toY(route[segIdx + 1][0]);
              const dx = x1 + (x2 - x1) * segT;
              const dy = y1 + (y2 - y1) * segT;

              ctx.beginPath();
              ctx.arc(dx, dy, 2.5, 0, Math.PI * 2);
              ctx.fillStyle = isBuild ? 'rgba(255, 200, 0, 0.9)' : 'rgba(200, 130, 255, 0.9)';
              ctx.fill();

              ctx.beginPath();
              ctx.arc(dx, dy, 6, 0, Math.PI * 2);
              ctx.fillStyle = isBuild ? 'rgba(255, 200, 0, 0.15)' : 'rgba(200, 130, 255, 0.15)';
              ctx.fill();
            }
          }
        } else {
          const blink = Math.sin(frame * 0.1) > 0;
          if (blink) {
            const midIdx = Math.floor(route.length / 2);
            const mx = toX(route[midIdx][1]);
            const my = toY(route[midIdx][0]);
            ctx.strokeStyle = 'rgba(255, 68, 68, 0.9)';
            ctx.lineWidth = 3;
            ctx.beginPath(); ctx.moveTo(mx - 8, my - 8); ctx.lineTo(mx + 8, my + 8); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(mx + 8, my - 8); ctx.lineTo(mx - 8, my + 8); ctx.stroke();
          }
        }

        landingPoints.forEach((lp: any, i: number) => {
          const x = toX(lp.lng);
          const y = toY(lp.lat);

          ctx.beginPath();
          ctx.arc(x, y, 4 + Math.sin(frame * 0.05 + i) * 1.5, 0, Math.PI * 2);
          ctx.strokeStyle = cableColor + '0.3)';
          ctx.lineWidth = 1;
          ctx.stroke();

          ctx.beginPath();
          ctx.arc(x, y, 2.5, 0, Math.PI * 2);
          ctx.fillStyle = isOutage ? 'rgba(255, 100, 100, 0.9)' : isBuild ? 'rgba(255, 200, 0, 0.9)' : 'rgba(200, 130, 255, 0.9)';
          ctx.fill();

          if (i % 2 === 0 || landingPoints.length <= 8) {
            ctx.font = '7px monospace';
            ctx.fillStyle = 'rgba(200, 200, 200, 0.7)';
            ctx.fillText(lp.city || lp.name || '', x + 5, y + 3);
          }
        });
      } else {
        ctx.font = '12px monospace';
        ctx.fillStyle = 'rgba(180, 100, 255, 0.6)';
        ctx.textAlign = 'center';
        ctx.fillText(cableData.name || 'UNKNOWN CABLE', cw / 2, ch / 2 - 15);

        ctx.font = '10px monospace';
        ctx.fillStyle = 'rgba(180, 100, 255, 0.4)';
        ctx.fillText(`${cableData.length?.toLocaleString() || 'N/D'} km | ${cableData.capacity || 'N/D'}`, cw / 2, ch / 2 + 5);
        ctx.fillText(`${landingPoints.length} landing points`, cw / 2, ch / 2 + 20);
        ctx.textAlign = 'left';
      }

      ctx.fillStyle = 'rgba(0, 0, 0, 0.03)';
      for (let y = 0; y < ch; y += 2) {
        ctx.fillRect(0, y, cw, 1);
      }

      ctx.strokeStyle = 'rgba(180, 100, 255, 0.3)';
      ctx.lineWidth = 1;
      const cs = 15;
      ctx.beginPath(); ctx.moveTo(5, 5 + cs); ctx.lineTo(5, 5); ctx.lineTo(5 + cs, 5); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cw - 5 - cs, 5); ctx.lineTo(cw - 5, 5); ctx.lineTo(cw - 5, 5 + cs); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(5, ch - 5 - cs); ctx.lineTo(5, ch - 5); ctx.lineTo(5 + cs, ch - 5); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cw - 5 - cs, ch - 5); ctx.lineTo(cw - 5, ch - 5); ctx.lineTo(cw - 5, ch - 5 - cs); ctx.stroke();

      ctx.font = '8px monospace';
      ctx.fillStyle = 'rgba(180, 100, 255, 0.5)';
      ctx.fillText(`CABLE: ${cableData.name || 'N/D'}`, 10, 18);
      ctx.fillText(`STATUS: ${(cableData.status || 'N/D').toUpperCase().replace('_', ' ')}`, 10, 28);
      ctx.fillText(`CAP: ${cableData.capacity || 'N/D'}`, cw - 100, 18);
      ctx.fillText(`RFS: ${cableData.rfsYear || 'N/D'}`, cw - 100, 28);

      frame++;
      animId = requestAnimationFrame(draw);
    };

    draw();
    return () => cancelAnimationFrame(animId);
  }, [cableData]);

  return <canvas ref={canvasRef} className="w-full h-full" style={{ imageRendering: 'pixelated' }} />;
}

function ShipRadarDisplay({ shipData }: { shipData: Record<string, any> }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;
    const cx = W / 2;
    const cy = H / 2;
    const maxR = Math.min(cx, cy) - 10;
    let frame = 0;

    const render = () => {
      frame++;
      ctx.fillStyle = 'rgba(0, 5, 10, 0.95)';
      ctx.fillRect(0, 0, W, H);

      for (let r = maxR; r > 0; r -= maxR / 4) {
        ctx.strokeStyle = 'rgba(255, 102, 255, 0.15)';
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.strokeStyle = 'rgba(255, 102, 255, 0.1)';
      ctx.beginPath(); ctx.moveTo(cx, 0); ctx.lineTo(cx, H); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, cy); ctx.lineTo(W, cy); ctx.stroke();

      const angle = (frame * 0.02) % (Math.PI * 2);
      ctx.strokeStyle = 'rgba(255, 102, 255, 0.5)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(angle) * maxR, cy + Math.sin(angle) * maxR);
      ctx.stroke();

      for (let a = 0; a < 0.5; a += 0.02) {
        const trailAngle = angle - a;
        ctx.strokeStyle = `rgba(255, 102, 255, ${0.2 - a * 0.4})`;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(trailAngle) * maxR, cy + Math.sin(trailAngle) * maxR);
        ctx.stroke();
      }

      const seed = (shipData.lat || 0) * 100;
      for (let i = 0; i < 6; i++) {
        const bx = cx + Math.cos(seed + i * 1.2) * (maxR * 0.3 + i * maxR * 0.12);
        const by = cy + Math.sin(seed + i * 1.5) * (maxR * 0.3 + i * maxR * 0.1);
        ctx.fillStyle = i === 0 ? '#ff66ff' : 'rgba(255, 102, 255, 0.5)';
        ctx.beginPath();
        ctx.arc(bx, by, i === 0 ? 4 : 2, 0, Math.PI * 2);
        ctx.fill();
      }

      requestAnimationFrame(render);
    };

    const raf = requestAnimationFrame(render);
    return () => cancelAnimationFrame(raf);
  }, [shipData]);

  return (
    <div className="relative flex-1 bg-black rounded overflow-hidden">
      <canvas ref={canvasRef} width={384} height={216} className="w-full h-full" />
      <div className="absolute top-2 left-2 pointer-events-none">
        <span className="text-[10px] font-mono text-purple-400 bg-black/60 px-1.5 py-0.5 rounded">
          AIS RADAR · {shipData.shipName || 'VESSEL'}
        </span>
      </div>
    </div>
  );
}

function AntennaSignalDisplay({ antennaData }: { antennaData: Record<string, any> }) {
  const [rotY, setRotY] = useState(0);
  const [tilt, setTilt] = useState(-8);
  const rafRef = useRef<number | null>(null);
  const dragRef = useRef<{ startX: number; startY: number; baseY: number; baseT: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const [pulse, setPulse] = useState(0);

  useEffect(() => {
    let last = performance.now();
    const tick = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      if (!dragRef.current) {
        setRotY(y => y + dt * 18); // 18 deg/sec
        setTilt(t => -8 + Math.sin(now * 0.0006) * 5);
      }
      setPulse((now % 1500) / 1500);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, []);

  const onPointerDown = (e: React.PointerEvent) => {
    dragRef.current = { startX: e.clientX, startY: e.clientY, baseY: rotY, baseT: tilt };
    setDragging(true);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    setRotY(dragRef.current.baseY + dx * 0.5);
    setTilt(Math.max(-60, Math.min(30, dragRef.current.baseT - dy * 0.3)));
  };
  const onPointerUp = (e: React.PointerEvent) => {
    dragRef.current = null;
    setDragging(false);
    try { (e.target as HTMLElement).releasePointerCapture(e.pointerId); } catch {}
  };

  const range = antennaData.range || 15;
  const power = antennaData.power || 30;
  const frequency = antennaData.frequency || '1.8 GHz';

  return (
    <div
      className="relative flex-1 bg-black rounded overflow-hidden select-none cursor-grab active:cursor-grabbing"
      style={{ perspective: '900px', minHeight: '220px', touchAction: 'none' }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,170,0,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,170,0,0.05) 1px, transparent 1px)',
          backgroundSize: '25px 25px',
          maskImage: 'radial-gradient(ellipse at center, black 35%, transparent 80%)',
          WebkitMaskImage: 'radial-gradient(ellipse at center, black 35%, transparent 80%)',
        }}
      />

      <div
        className="absolute left-1/2 top-1/2"
        style={{
          transform: 'translate(-50%, -50%) rotateX(85deg)',
          transformStyle: 'preserve-3d',
        }}
      >
        {[3, 2, 1].map((mult, i) => (
          <div
            key={i}
            className="absolute rounded-full"
            style={{
              width: `${range * mult * 6}px`,
              height: `${range * mult * 6}px`,
              left: '50%',
              top: '50%',
              transform: 'translate(-50%, -50%)',
              border: `1px solid rgba(255,170,0,${0.4 - i * 0.1})`,
              background: i === 2 ? 'rgba(0,255,136,0.06)' : `rgba(255,170,0,${0.08 - i * 0.02})`,
              boxShadow: `0 0 ${10 - i * 2}px rgba(255,170,0,${0.3 - i * 0.08})`,
            }}
          />
        ))}
      </div>

      <div
        className="absolute left-1/2 top-1/2"
        style={{
          transform: `translate(-50%, -50%) rotateX(${tilt}deg) rotateY(${rotY}deg)`,
          transformStyle: 'preserve-3d',
          transition: dragging ? 'none' : 'transform 0.05s linear',
        }}
      >
        <AntennaTowerModel3D pulse={pulse} />
      </div>

      <div className="absolute top-2 left-2 pointer-events-none">
        <span className="text-[10px] font-mono text-amber-400 bg-black/60 px-1.5 py-0.5 rounded">
          <RadioTower className="w-2.5 h-2.5 inline mr-1" />
          3D MODEL · {antennaData.id || 'ANT'}
        </span>
      </div>
      <div className="absolute top-2 right-2 pointer-events-none">
        <span className="text-[10px] font-mono text-gray-400 bg-black/60 px-1.5 py-0.5 rounded">
          <Activity className="w-2.5 h-2.5 inline mr-1" />
          DRAG TO ROTATE
        </span>
      </div>
      <div className="absolute bottom-2 left-2 right-2 pointer-events-none flex justify-between text-[9px] font-mono">
        <span className="text-amber-400 bg-black/60 px-1.5 py-0.5 rounded">RANGE ~{range}km</span>
        <span className="text-amber-400 bg-black/60 px-1.5 py-0.5 rounded">{frequency}</span>
        <span className="text-green-400 bg-black/60 px-1.5 py-0.5 rounded">PWR {power}dBm</span>
      </div>
    </div>
  );
}

function AntennaTowerModel3D({ pulse }: { pulse: number }) {
  return (
    <div style={{ width: '160px', height: '200px', position: 'relative', transformStyle: 'preserve-3d' }}>
      <svg
        viewBox="0 0 200 250"
        style={{
          width: '100%', height: '100%',
          filter: 'drop-shadow(0 0 6px rgba(255,170,0,0.6))',
        }}
      >
        <defs>
          <linearGradient id="towerMast" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#ffaa00" />
            <stop offset="50%" stopColor="#cc7700" />
            <stop offset="100%" stopColor="#664400" />
          </linearGradient>
          <linearGradient id="sectorAnt" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#0a1830" />
            <stop offset="50%" stopColor="#1a4a6c" />
            <stop offset="100%" stopColor="#0a1830" />
          </linearGradient>
          <radialGradient id="signalPulse" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ffaa00" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#ffaa00" stopOpacity="0" />
          </radialGradient>
        </defs>

        <ellipse cx="100" cy="240" rx="35" ry="5" fill="rgba(0,0,0,0.5)" />

        <rect x="75" y="225" width="50" height="15" fill="#333" stroke="#666" strokeWidth="0.5" />

        <line x1="80" y1="225" x2="92" y2="30" stroke="url(#towerMast)" strokeWidth="2" />
        <line x1="120" y1="225" x2="108" y2="30" stroke="url(#towerMast)" strokeWidth="2" />
        {Array.from({ length: 10 }).map((_, i) => {
          const y1 = 225 - i * 20;
          const y2 = 225 - (i + 1) * 20;
          const x1L = 80 + (i * 1.2);
          const x1R = 120 - (i * 1.2);
          const x2L = 80 + ((i + 1) * 1.2);
          const x2R = 120 - ((i + 1) * 1.2);
          return (
            <g key={i} stroke="#cc7700" strokeWidth="0.6" opacity="0.7">
              <line x1={x1L} y1={y1} x2={x2R} y2={y2} />
              <line x1={x1R} y1={y1} x2={x2L} y2={y2} />
              <line x1={x1L} y1={y1} x2={x1R} y2={y1} />
            </g>
          );
        })}

        <rect x="88" y="25" width="24" height="5" fill="#ffaa00" stroke="#ffcc44" strokeWidth="0.5" />

        <rect x="85" y="10" width="6" height="18" fill="url(#sectorAnt)" stroke="#00ccff" strokeWidth="0.3" transform="rotate(-25 88 19)" />
        <rect x="97" y="10" width="6" height="18" fill="url(#sectorAnt)" stroke="#00ccff" strokeWidth="0.3" />
        <rect x="109" y="10" width="6" height="18" fill="url(#sectorAnt)" stroke="#00ccff" strokeWidth="0.3" transform="rotate(25 112 19)" />

        <ellipse cx="100" cy="8" rx="8" ry="4" fill="#1a3a5c" stroke="#00ccff" strokeWidth="0.5" />
        <line x1="100" y1="10" x2="100" y2="25" stroke="#ffaa00" strokeWidth="0.8" />

        <rect x="83" y="60" width="5" height="14" fill="url(#sectorAnt)" stroke="#00ccff" strokeWidth="0.3" transform="rotate(-25 85 67)" />
        <rect x="97" y="60" width="5" height="14" fill="url(#sectorAnt)" stroke="#00ccff" strokeWidth="0.3" />
        <rect x="111" y="60" width="5" height="14" fill="url(#sectorAnt)" stroke="#00ccff" strokeWidth="0.3" transform="rotate(25 113 67)" />

        <circle cx="100" cy="3" r="2.5" fill="#ff0033" opacity={0.5 + pulse * 0.5}>
          <animate attributeName="opacity" values="0.4;1;0.4" dur="1.5s" repeatCount="indefinite" />
        </circle>
        <circle cx="100" cy="3" r="6" fill="url(#signalPulse)" opacity={pulse} />

        <circle cx="80" cy="100" r="1.5" fill="#ff0033">
          <animate attributeName="opacity" values="0.3;1;0.3" dur="1.5s" begin="0.5s" repeatCount="indefinite" />
        </circle>
        <circle cx="120" cy="100" r="1.5" fill="#ff0033">
          <animate attributeName="opacity" values="0.3;1;0.3" dur="1.5s" begin="0.7s" repeatCount="indefinite" />
        </circle>

        {[0, 1, 2].map(i => (
          <circle
            key={i}
            cx="100"
            cy="15"
            r={20 + i * 15 + pulse * 20}
            fill="none"
            stroke="#ffaa00"
            strokeWidth="1"
            opacity={Math.max(0, 0.5 - i * 0.15 - pulse * 0.5)}
          />
        ))}

        <line x1="100" y1="0" x2="100" y2="250" stroke="#ffaa00" strokeWidth="0.2" opacity="0.2" strokeDasharray="2,3" />
      </svg>
    </div>
  );
}

function MilitaryTacticalDisplay({ milData }: { milData: Record<string, any> }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;
    let frame = 0;

    const render = () => {
      frame++;
      ctx.fillStyle = 'rgba(5, 0, 0, 0.95)';
      ctx.fillRect(0, 0, W, H);

      ctx.strokeStyle = 'rgba(255, 51, 51, 0.06)';
      ctx.lineWidth = 0.5;
      for (let x = 0; x < W; x += 25) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
      }
      for (let y = 0; y < H; y += 25) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
      }

      const cx = W * 0.5;
      const cy = H * 0.5;

      const pulse = Math.sin(frame * 0.02) * 3;
      ctx.strokeStyle = 'rgba(255, 51, 51, 0.2)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(cx, cy, 80 + pulse, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = 'rgba(255, 51, 51, 0.04)';
      ctx.beginPath();
      ctx.arc(cx, cy, 50, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 51, 51, 0.3)';
      ctx.stroke();

      ctx.fillStyle = '#ff3333';
      ctx.beginPath();
      ctx.arc(cx, cy, 5, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#ff3333';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(cx, cy - 5);
      ctx.lineTo(cx, cy - 25);
      ctx.stroke();

      ctx.fillStyle = 'rgba(255, 51, 51, 0.7)';
      ctx.beginPath();
      ctx.moveTo(cx, cy - 25);
      ctx.lineTo(cx + 15, cy - 20);
      ctx.lineTo(cx, cy - 15);
      ctx.fill();

      const seed = (milData.lat || 0) * 100;
      for (let i = 0; i < 5; i++) {
        const angle = seed + i * (Math.PI * 2 / 5);
        const dist = 55 + i * 8;
        const ux = cx + Math.cos(angle) * dist;
        const uy = cy + Math.sin(angle) * dist;
        ctx.fillStyle = i < 3 ? 'rgba(0, 255, 136, 0.6)' : 'rgba(255, 170, 0, 0.5)';
        ctx.beginPath();
        ctx.arc(ux, uy, 2.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 51, 51, 0.15)';
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(ux, uy);
        ctx.stroke();
      }

      const sweepAngle = (frame * 0.015) % (Math.PI * 2);
      ctx.strokeStyle = 'rgba(255, 51, 51, 0.3)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(sweepAngle) * 90, cy + Math.sin(sweepAngle) * 90);
      ctx.stroke();

      for (let a = 0; a < 0.3; a += 0.02) {
        ctx.strokeStyle = `rgba(255, 51, 51, ${0.15 - a * 0.5})`;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(sweepAngle - a) * 90, cy + Math.sin(sweepAngle - a) * 90);
        ctx.stroke();
      }

      ctx.fillStyle = 'rgba(255, 51, 51, 0.6)';
      ctx.font = '8px monospace';
      ctx.fillText(`STATUS: ${milData.status?.toUpperCase() || 'ACTIVE'}`, 8, 15);
      ctx.fillText(`SECTOR: ${milData.location || 'UNKNOWN'}`, 8, 27);
      ctx.fillStyle = 'rgba(0, 255, 136, 0.4)';
      ctx.fillText(`FORCE: ${milData.strength || 'N/A'}`, 8, H - 10);

      requestAnimationFrame(render);
    };

    const raf = requestAnimationFrame(render);
    return () => cancelAnimationFrame(raf);
  }, [milData]);

  return (
    <div className="relative flex-1 bg-black rounded overflow-hidden">
      <canvas ref={canvasRef} width={384} height={216} className="w-full h-full" />
      <div className="absolute top-2 left-2 pointer-events-none">
        <span className="text-[10px] font-mono text-red-400 bg-black/60 px-1.5 py-0.5 rounded flex items-center gap-1">
          <Flag className="w-2.5 h-2.5" />
          TACTICAL MAP · {milData.name || 'UNIT'}
        </span>
      </div>
      <div className="absolute top-2 right-2 pointer-events-none">
        <span className="text-[10px] font-mono text-red-400 bg-black/60 px-1.5 py-0.5 rounded flex items-center gap-1">
          <Shield className="w-2.5 h-2.5" />
          {milData.side?.toUpperCase() || 'UNKNOWN'}
        </span>
      </div>
    </div>
  );
}

function IPGeoTraceDisplay({ ipData }: { ipData: Record<string, any> }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;
    let frame = 0;

    const render = () => {
      frame++;
      ctx.fillStyle = 'rgba(0, 5, 15, 0.95)';
      ctx.fillRect(0, 0, W, H);

      const nodes = [
        { x: 40, y: H / 2, label: 'SRC', color: '#00eeff' },
        { x: W * 0.3, y: H * 0.3, label: 'HOP1', color: '#0088aa' },
        { x: W * 0.5, y: H * 0.6, label: 'HOP2', color: '#0088aa' },
        { x: W * 0.7, y: H * 0.35, label: 'HOP3', color: '#0088aa' },
        { x: W - 40, y: H / 2, label: 'DST', color: '#ff3333' },
      ];

      for (let i = 0; i < nodes.length - 1; i++) {
        ctx.strokeStyle = i === nodes.length - 2 ? 'rgba(255, 51, 51, 0.4)' : 'rgba(0, 238, 255, 0.3)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(nodes[i].x, nodes[i].y);
        ctx.lineTo(nodes[i + 1].x, nodes[i + 1].y);
        ctx.stroke();

        const progress = ((frame * 0.01 + i * 0.25) % 1);
        const px = nodes[i].x + (nodes[i + 1].x - nodes[i].x) * progress;
        const py = nodes[i].y + (nodes[i + 1].y - nodes[i].y) * progress;
        const pktColor = i === nodes.length - 2 ? `rgba(255, 51, 51, ${0.9 - progress * 0.5})` : `rgba(0, 238, 255, ${0.8 - progress * 0.5})`;
        ctx.fillStyle = pktColor;
        ctx.beginPath();
        ctx.arc(px, py, 2, 0, Math.PI * 2);
        ctx.fill();
      }

      nodes.forEach((n, i) => {
        ctx.fillStyle = n.color;
        ctx.beginPath();
        ctx.arc(n.x, n.y, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = i === nodes.length - 1 ? 'rgba(255, 51, 51, 0.8)' : 'rgba(0, 238, 255, 0.6)';
        ctx.font = '8px monospace';
        ctx.fillText(n.label, n.x - 12, n.y - 10);
      });

      const dstNode = nodes[nodes.length - 1];
      const blink = Math.sin(frame * 0.12) > 0;

      ctx.strokeStyle = 'rgba(255, 51, 51, 0.25)';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.arc(dstNode.x, dstNode.y, 25, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.strokeStyle = 'rgba(255, 51, 51, 0.15)';
      ctx.beginPath();
      ctx.arc(dstNode.x, dstNode.y, 15, 0, Math.PI * 2);
      ctx.stroke();

      if (blink) {
        ctx.strokeStyle = 'rgba(255, 51, 51, 0.9)';
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(dstNode.x - 12, dstNode.y); ctx.lineTo(dstNode.x + 12, dstNode.y); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(dstNode.x, dstNode.y - 12); ctx.lineTo(dstNode.x, dstNode.y + 12); ctx.stroke();
      }

      ctx.fillStyle = blink ? '#ff3333' : '#ff333380';
      ctx.beginPath();
      ctx.arc(dstNode.x, dstNode.y, 4, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = blink ? 'rgba(255, 51, 51, 0.2)' : 'rgba(255, 51, 51, 0.1)';
      ctx.beginPath();
      ctx.arc(dstNode.x, dstNode.y, 10, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = 'rgba(255, 51, 51, 0.7)';
      ctx.font = '7px monospace';
      ctx.fillText('APPROX LOC', dstNode.x + 18, dstNode.y - 5);
      ctx.fillStyle = 'rgba(255, 51, 51, 0.5)';
      ctx.fillText(`~${ipData.accuracy || Math.floor(Math.random() * 50 + 10)}km radius`, dstNode.x + 18, dstNode.y + 5);

      ctx.strokeStyle = 'rgba(0, 238, 255, 0.05)';
      for (let x = 0; x < W; x += 25) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
      }

      requestAnimationFrame(render);
    };

    const raf = requestAnimationFrame(render);
    return () => cancelAnimationFrame(raf);
  }, [ipData]);

  return (
    <div className="relative flex-1 bg-black rounded overflow-hidden">
      <canvas ref={canvasRef} width={384} height={216} className="w-full h-full" />
      <div className="absolute top-2 left-2 pointer-events-none">
        <span className="text-[10px] font-mono text-cyan-400 bg-black/60 px-1.5 py-0.5 rounded">
          NETWORK TRACE · {ipData.ip || ipData.query || 'IP'}
        </span>
      </div>
      <div className="absolute top-2 right-2 pointer-events-none">
        <span className="text-[10px] font-mono text-red-400 bg-black/60 px-1.5 py-0.5 rounded flex items-center gap-1">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
          TARGET ACQUIRED
        </span>
      </div>
    </div>
  );
}

function FOFADeviceDisplay({ deviceData }: { deviceData: Record<string, any> }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>(0);
  const [scanAngle, setScanAngle] = useState(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width = canvas.offsetWidth * 2;
    const h = canvas.height = canvas.offsetHeight * 2;
    ctx.scale(2, 2);
    const cw = w / 2;
    const ch = h / 2;

    let angle = 0;
    const draw = () => {
      ctx.clearRect(0, 0, cw, ch);
      angle += 0.02;
      setScanAngle(angle);

      ctx.strokeStyle = 'rgba(255, 0, 204, 0.06)';
      ctx.lineWidth = 0.5;
      for (let x = 0; x < cw; x += 20) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, ch); ctx.stroke();
      }
      for (let y = 0; y < ch; y += 20) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(cw, y); ctx.stroke();
      }

      const cx = cw / 2;
      const cy = ch / 2;
      const r = Math.min(cx, cy) - 10;

      for (let i = 1; i <= 4; i++) {
        ctx.beginPath();
        ctx.arc(cx, cy, (r / 4) * i, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(255, 0, 204, ${0.1 + i * 0.03})`;
        ctx.lineWidth = 0.5;
        ctx.stroke();
      }

      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, r, angle, angle + 0.5);
      ctx.closePath();
      const sweepGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      sweepGrad.addColorStop(0, 'rgba(255, 0, 204, 0.3)');
      sweepGrad.addColorStop(1, 'rgba(255, 0, 204, 0)');
      ctx.fillStyle = sweepGrad;
      ctx.fill();

      ctx.beginPath();
      ctx.arc(cx, cy, 3, 0, Math.PI * 2);
      ctx.fillStyle = '#ff00cc';
      ctx.fill();

      const risk = deviceData.risk || 'medium';
      const riskColors: Record<string, string> = { critical: '#ff0033', high: '#ff0066', medium: '#ff00cc', low: '#cc0099' };
      const riskSize = risk === 'critical' ? 12 : risk === 'high' ? 8 : 6;

      const pulseR = riskSize + Math.sin(angle * 3) * 4;
      ctx.beginPath();
      ctx.arc(cx, cy, pulseR, 0, Math.PI * 2);
      ctx.strokeStyle = riskColors[risk] || '#ff00cc';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.font = '9px monospace';
      ctx.fillStyle = '#ff00cc';
      ctx.textAlign = 'center';
      ctx.fillText(deviceData.deviceType?.toUpperCase() || 'IOT', cx, 15);

      ctx.font = '8px monospace';
      ctx.fillStyle = 'rgba(255, 0, 204, 0.7)';
      ctx.fillText(`${deviceData.ip || '?.?.?.?'}:${deviceData.port || '?'}`, cx, ch - 8);

      animFrameRef.current = requestAnimationFrame(draw);
    };

    draw();
    return () => { if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current); };
  }, [deviceData]);

  return (
    <div className="w-full aspect-video relative bg-black">
      <canvas ref={canvasRef} className="w-full h-full" />
      <div className="absolute top-1.5 left-2 flex items-center gap-1.5">
        <span className="text-[7px] font-mono text-fuchsia-400 font-bold" style={{ letterSpacing: '0.2em' }}>
          FOFA RECON
        </span>
        <span className={`text-[6px] font-mono px-1 py-0.5 rounded border ${
          deviceData.risk === 'critical' ? 'text-red-400 bg-red-900/30 border-red-700/30' :
          deviceData.risk === 'high' ? 'text-orange-400 bg-orange-900/30 border-orange-700/30' :
          deviceData.risk === 'medium' ? 'text-yellow-400 bg-yellow-900/30 border-yellow-700/30' :
          'text-green-400 bg-green-900/30 border-green-700/30'
        }`}>
          {deviceData.risk?.toUpperCase() || 'UNKNOWN'} RISK
        </span>
      </div>
      <div className="absolute top-1.5 right-2 text-[6px] font-mono text-fuchsia-500/50" style={{ letterSpacing: '0.15em' }}>
        IOT SCANNER
      </div>
      <div className="absolute top-1 left-1 w-2 h-2 border-t border-l border-fuchsia-500/50" />
      <div className="absolute top-1 right-1 w-2 h-2 border-t border-r border-fuchsia-500/50" />
      <div className="absolute bottom-1 left-1 w-2 h-2 border-b border-l border-fuchsia-500/50" />
      <div className="absolute bottom-1 right-1 w-2 h-2 border-b border-r border-fuchsia-500/50" />
    </div>
  );
}

export default function PointDetailOverlay({ point, onClose, onToast, isTracked, isLocked, onTrack, onLock }: PointDetailOverlayProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [countryIntel, setCountryIntel] = useState<any>(null);
  const [countryIntelLoading, setCountryIntelLoading] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 50);
    return () => clearTimeout(timer);
  }, []);

  const handleClose = useCallback(() => {
    setIsVisible(false);
    setTimeout(onClose, 300);
  }, [onClose]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [handleClose]);

  useEffect(() => {
    setCountryIntel(null);
    setCountryIntelLoading(true);
    const lat = point.lat;
    const lng = point.lng;
    fetch(`/api/osint/region-dossier?lat=${lat}&lng=${lng}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        setCountryIntel(data);
        setCountryIntelLoading(false);
      })
      .catch(() => setCountryIntelLoading(false));
  }, [point.lat, point.lng]);

  const raw: Record<string, any> = (point.rawData as Record<string, any>) || {};
  const isCamera = point.type === 'camera';
  const isFlight = point.type === 'flight';
  const isCable = point.type === 'cable';
  const isShip = point.type === 'ship';
  const isAntenna = point.type === 'antenna';
  const isIP = point.type === 'ip';
  const isMilitary = point.type === 'military';
  const isFOFA = point.type === 'fofa';
  const isEarthquake = point.type === 'earthquake';
  const isCyber = point.type === 'cyber';
  const isOutage = point.type === 'outage';
  const isFire = point.type === 'fire';
  const isSatellite = point.type === 'satellite';
  const isGdelt = point.type === 'gdelt';

  const isFOFACamera = isFOFA && raw.deviceType === 'camera';
  const fofaCameraData = useMemo(() => {
    if (!isFOFACamera) return null;
    const protocol = raw.protocol || 'http';
    const ip = raw.ip || '';
    const port = raw.port || 80;
    let snapshotUrl = '';
    let streamUrl = '';
    if (protocol === 'rtsp') {
      streamUrl = `rtsp://${ip}:${port}/stream1`;
      snapshotUrl = `http://${ip}:${port}/cgi-bin/snapshot.cgi`;
    } else if (protocol === 'http' || protocol === 'https') {
      const proto = protocol === 'https' ? 'https' : 'http';
      const server = (raw.server || raw.banner || '').toLowerCase();
      if (server.includes('hikvision')) {
        snapshotUrl = `${proto}://${ip}:${port}/ISAPI/Streaming/Channels/101/picture`;
        streamUrl = `rtsp://${ip}:554/Streaming/Channels/101`;
      } else if (server.includes('dahua') || server.includes('dnvrs')) {
        snapshotUrl = `${proto}://${ip}:${port}/cgi-bin/snapshot.cgi`;
        streamUrl = `rtsp://${ip}:554/cam/realmonitor?channel=1&subtype=0`;
      } else if (server.includes('axis')) {
        snapshotUrl = `${proto}://${ip}:${port}/axis-cgi/jpg/image.cgi`;
        streamUrl = `rtsp://${ip}:554/axis-media/media.amp`;
      } else if (server.includes('vstarcam')) {
        snapshotUrl = `${proto}://${ip}:${port}/cgi-bin/snapshot.cgi?loginuse=admin&loginpas=`;
        streamUrl = `rtsp://${ip}:554/live/ch00_0`;
      } else if (server.includes('amcrest') || server.includes('ipcam')) {
        snapshotUrl = `${proto}://${ip}:${port}/cgi-bin/snapshot.cgi?channel=1`;
        streamUrl = `rtsp://${ip}:554/cam/realmonitor?channel=1&subtype=0`;
      } else if (server.includes('reolink')) {
        snapshotUrl = `${proto}://${ip}:${port}/cgi-bin/api.cgi?cmd=Snap&channel=0`;
        streamUrl = `rtsp://${ip}:554/h264Preview_01_main`;
      } else {
        snapshotUrl = `${proto}://${ip}:${port}/snapshot.jpg`;
        streamUrl = `rtsp://${ip}:554/stream1`;
      }
    }
    return {
      ...raw,
      id: raw.id || `FOFA-CAM-${ip}`,
      name: raw.title || raw.id || `FOFA Camera ${ip}`,
      ip: ip,
      port: port,
      lat: raw.lat,
      lng: raw.lng,
      city: raw.city,
      country: raw.country,
      status: 'online',
      type: 'ipcam',
      source: 'FOFA',
      snapshotUrl,
      streamUrl,
      streamType: protocol === 'rtsp' ? 'hls' : 'jpg',
    } as unknown as CameraData;
  }, [isFOFACamera, raw]);

  const isConflictZone = isGdelt || isMilitary || (countryIntel?.country && ['UA', 'SY', 'IQ', 'AF', 'SO', 'YE', 'LY', 'ML', 'CF', 'CD', 'SS', 'MM', 'ET'].includes(countryIntel.country.countryCode));

  const stableNetworkInfo = useMemo(() => ({
    encryption: Math.random() > 0.5 ? 'AES-256' : 'None',
    latency: `${Math.floor(Math.random() * 50 + 10)}ms`,
  }), [point.label]);

  const flightEstDestination = useMemo(() => {
    if (!isFlight) return null;
    const heading = raw.heading || 0;
    const speed = raw.velocity || 450;
    const directions: Record<string, string> = {
      N: 'North', NNE: 'North-Northeast', NE: 'Northeast', ENE: 'East-Northeast',
      E: 'East', ESE: 'East-Southeast', SE: 'Southeast', SSE: 'South-Southeast',
      S: 'South', SSW: 'South-Southwest', SW: 'Southwest', WSW: 'West-Southwest',
      W: 'West', WNW: 'West-Northwest', NW: 'Northwest', NNW: 'North-Northwest',
    };
    const dirs = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
    const idx = Math.round(heading / 22.5) % 16;
    const dirName = directions[dirs[idx]] || 'Unknown';
    const estHours = speed > 0 ? Math.floor(Math.random() * 8 + 1) : null;
    return { heading, dirName, speed, estHours };
  }, [isFlight, raw.heading, raw.velocity]);

  const catConfig: Record<string, { icon: React.ReactNode; color: string; label: string; border: string; bg: string }> = {
    camera: { icon: <Camera className="w-4 h-4" />, color: 'text-[#D4AF37]', label: 'VIDEO SURVEILLANCE', border: 'border-[rgba(212,175,55,0.3)]', bg: 'from-[rgba(212,175,55,0.08)]' },
    flight: { icon: <Plane className="w-4 h-4" />, color: 'text-blue-400', label: 'FLIGHT TRACK', border: 'border-blue-900/60', bg: 'from-blue-950/20' },
    cable: { icon: <Cable className="w-4 h-4" />, color: 'text-purple-400', label: 'SUBMARINE CABLE', border: 'border-purple-900/60', bg: 'from-purple-950/20' },
    ship: { icon: <Cable className="w-4 h-4" />, color: 'text-purple-400', label: 'VESSEL TRACK', border: 'border-purple-900/60', bg: 'from-purple-950/20' },
    antenna: { icon: <Radio className="w-4 h-4" />, color: 'text-amber-400', label: '5G COVERAGE INTEL', border: 'border-amber-900/60', bg: 'from-amber-950/20' },
    ip: { icon: <MapPin className="w-4 h-4" />, color: 'text-red-400', label: 'IP TARGET TRACE', border: 'border-red-900/60', bg: 'from-red-950/20' },
    military: { icon: <Flag className="w-4 h-4" />, color: 'text-red-400', label: 'TACTICAL INTELLIGENCE', border: 'border-red-900/60', bg: 'from-red-950/20' },
    fofa: { icon: <Cpu className="w-4 h-4" />, color: 'text-fuchsia-400', label: 'IOT DEVICE INTEL', border: 'border-fuchsia-900/60', bg: 'from-fuchsia-950/20' },
    earthquake: { icon: <Activity className="w-4 h-4" />, color: 'text-orange-400', label: 'SEISMIC EVENT', border: 'border-orange-900/60', bg: 'from-orange-950/20' },
    cyber: { icon: <Shield className="w-4 h-4" />, color: 'text-pink-400', label: 'CYBER THREAT', border: 'border-pink-900/60', bg: 'from-pink-950/20' },
    outage: { icon: <AlertTriangle className="w-4 h-4" />, color: 'text-yellow-400', label: 'INTERNET OUTAGE', border: 'border-yellow-900/60', bg: 'from-yellow-950/20' },
    fire: { icon: <Flame className="w-4 h-4" />, color: 'text-red-400', label: 'FIRE / VOLCANO', border: 'border-red-900/60', bg: 'from-red-950/20' },
    satellite: { icon: <Globe className="w-4 h-4" />, color: 'text-indigo-400', label: 'SATELLITE TRACK', border: 'border-indigo-900/60', bg: 'from-indigo-950/20' },
    gdelt: { icon: <Zap className="w-4 h-4" />, color: 'text-rose-400', label: 'CONFLICT EVENT', border: 'border-rose-900/60', bg: 'from-rose-950/20' },
  };
  const cfg = isFOFACamera
    ? { icon: <Camera className="w-4 h-4" />, color: 'text-emerald-400', label: 'FOFA CAMERA FEED', border: 'border-emerald-900/60', bg: 'from-emerald-950/20' }
    : (catConfig[point.type] || catConfig.ip);

  return (
    <div
      ref={overlayRef}
      className={`fixed inset-0 z-50 flex items-center justify-center transition-all duration-300 ${isVisible ? 'bg-black/60 backdrop-blur-sm' : 'bg-transparent'}`}
      onClick={(e) => { if (e.target === overlayRef.current) handleClose(); }}
    >
      <div className={`relative w-[740px] max-w-[95vw] transition-all duration-300 ${isVisible ? 'scale-100 opacity-100' : 'scale-90 opacity-0'}`}>
        <div className={`bg-[#06060C]/95 border ${cfg.border} rounded-xl overflow-hidden shadow-2xl backdrop-blur-md`} style={{ boxShadow: `0 0 40px rgba(0,0,0,0.5), 0 0 20px ${isCamera ? 'rgba(212,175,55,0.1)' : point.type === 'flight' ? 'rgba(0,204,255,0.1)' : point.type === 'cable' || point.type === 'ship' ? 'rgba(204,102,255,0.1)' : point.type === 'antenna' ? 'rgba(255,170,0,0.1)' : 'rgba(0,238,255,0.1)'}` }}>

          {isCamera && (
            <div className="flex items-center justify-between px-3 py-1 border-b border-white/5" style={{ background: 'rgba(212,175,55,0.05)' }}>
              <div className="flex items-center gap-3">
                <span className="text-[7px] font-mono text-[#D4AF37] font-bold" style={{ letterSpacing: '0.2em' }}>
                  {(() => {
                    const id = raw.id || 'CAM';
                    const short = String(id).replace(/[^a-zA-Z0-9]/g, '').substring(0, 8).toUpperCase();
                    return short.length >= 4 ? `CAM-${short.substring(0, 4)}-${short.substring(4)}` : `CAM-${short}`;
                  })()}
                </span>
                <span className="text-[7px] font-mono text-gray-600">{(raw.lat || point.lat).toFixed(4)}, {(raw.lng || point.lng).toFixed(4)}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[7px] font-mono text-gray-500">{new Date().toISOString().substring(11, 19)}Z</span>
                <span className="text-[7px] font-mono text-[#D4AF37]" style={{ letterSpacing: '0.15em' }}>SECURE UPLINK</span>
              </div>
            </div>
          )}

          <div className={`flex items-center justify-between px-4 py-2.5 border-b ${cfg.border} bg-gradient-to-r ${cfg.bg} to-transparent`}>
            <div className="flex items-center gap-2">
              {isCamera ? (
                <div className="relative w-7 h-7 flex items-center justify-center">
                  <Camera className="w-4 h-4 text-[#D4AF37]" style={{ filter: 'drop-shadow(0 0 4px rgba(212,175,55,0.5))' }} />
                  <div className="absolute top-0 left-0 w-1.5 h-1.5 border-t border-l border-[#D4AF37]/50" />
                  <div className="absolute bottom-0 right-0 w-1.5 h-1.5 border-b border-r border-[#D4AF37]/50" />
                </div>
              ) : (
                <span className={cfg.color}>{cfg.icon}</span>
              )}
              <div>
                <span className={`${cfg.color} font-mono text-[11px] font-bold tracking-wider uppercase`} style={isCamera ? { textShadow: '0 0 10px rgba(255,255,255,0.3)' } : undefined}>
                  {point.label}
                </span>
                {isCamera && (
                  <div className="text-[7px] font-mono text-[#D4AF37]" style={{ letterSpacing: '0.1em' }}>
                    {raw.city && raw.country ? `${raw.city}, ${raw.country}` : raw.city || raw.country || ''} {raw.source ? `• SOURCE: ${String(raw.source).toUpperCase().split('/')[0]}` : ''}
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              {isCamera && (
                <>
                  <button onClick={() => setRefreshKey(k => k + 1)} className="p-1 text-gray-400 hover:text-[#D4AF37] bg-white/5 border border-white/10 rounded transition-colors" title="Refresh">
                    <RotateCcw className="w-3 h-3" />
                  </button>
                  <button className="p-1 text-gray-400 hover:text-[#D4AF37] bg-white/5 border border-white/10 rounded transition-colors" title="Locate on map">
                    <MapPin className="w-3 h-3" />
                  </button>
                  <button className="p-1 text-gray-400 hover:text-[#D4AF37] bg-white/5 border border-white/10 rounded transition-colors" title="Fullscreen">
                    <Maximize2 className="w-3 h-3" />
                  </button>
                </>
              )}
              <div className="flex items-center gap-1">
                <div className={`w-1.5 h-1.5 rounded-full ${point.color === '#ff4444' ? 'bg-red-500' : 'bg-green-400 animate-pulse'}`} />
                <span className={`text-[9px] font-mono ${point.color === '#ff4444' ? 'text-red-400' : 'text-green-400'}`}>
                  {point.color === '#ff4444' ? 'OFFLINE' : 'LIVE'}
                </span>
              </div>
              <span className="text-[9px] font-mono text-gray-600">|</span>
              <span className="text-[9px] font-mono text-gray-500">HORUS v6.0</span>
              <button onClick={handleClose} className={`p-1 rounded transition-colors ${isCamera ? 'text-red-400 hover:text-red-300 bg-red-900/30 border border-red-500/30 hover:bg-red-800/30' : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800/50'}`}>
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="flex gap-0">
            <div className="flex-1 p-3 flex flex-col" style={{ minWidth: 0 }}>
              <div className="relative bg-[#020202] rounded overflow-hidden">
                {isCamera && <CameraFeedCanvas cameraData={raw} />}
                {isFOFACamera && fofaCameraData && <CameraFeedCanvas cameraData={fofaCameraData} />}
                {isFlight && <FlightTrackDisplay flightData={raw} />}
                {isCable && <CableRouteDisplay cableData={raw} />}
                {isShip && <ShipRadarDisplay shipData={raw} />}
                {isAntenna && <AntennaSignalDisplay antennaData={raw} />}
                {isIP && <IPGeoTraceDisplay ipData={raw} />}
                {isMilitary && <MilitaryTacticalDisplay milData={raw} />}
                {isFOFA && !isFOFACamera && <FOFADeviceDisplay deviceData={raw} />}
              </div>
            </div>

            <div className="w-64 border-l border-gray-800/50 bg-black/30 flex flex-col overflow-y-auto custom-scrollbar">
              {countryIntel?.country && (
                <div className="p-3 border-b border-gray-800/40" style={{ background: isConflictZone ? 'rgba(255,51,51,0.03)' : 'rgba(100,100,255,0.02)' }}>
                  <div className="flex items-center gap-1.5 mb-2">
                    <Flag className={`w-3 h-3 ${isConflictZone ? 'text-red-400' : 'text-blue-400'}`} />
                    <span className="text-[9px] font-mono text-gray-500 tracking-wider">COUNTRY INTEL</span>
                    {isConflictZone && (
                      <span className="text-[7px] font-mono text-red-400 bg-red-900/30 border border-red-700/30 px-1 py-0.5 rounded ml-auto animate-pulse">
                        ⚠ CONFLICT
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mb-2">
                    {countryIntel.country.flagUrl && (
                      <img
                        src={countryIntel.country.flagUrl}
                        alt={countryIntel.country.name}
                        className="w-8 h-5 object-cover rounded-sm border border-gray-700/50"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-[10px] font-mono text-gray-200 font-bold truncate">
                        {countryIntel.country.emoji} {countryIntel.country.name}
                      </div>
                      {countryIntel.country.officialName && countryIntel.country.officialName !== countryIntel.country.name && (
                        <div className="text-[7px] font-mono text-gray-500 truncate">{countryIntel.country.officialName}</div>
                      )}
                    </div>
                  </div>
                  <div className="space-y-0.5">
                    {countryIntel.country.capital && <DetailRow label="Capital" value={countryIntel.country.capital} />}
                    {countryIntel.country.population && <DetailRow label="Population" value={countryIntel.country.population.toLocaleString()} />}
                    {countryIntel.country.area && <DetailRow label="Area" value={`${countryIntel.country.area.toLocaleString()} km²`} />}
                    {countryIntel.country.density && <DetailRow label="Density" value={`${countryIntel.country.density}/km²`} />}
                    {countryIntel.country.region && <DetailRow label="Region" value={countryIntel.country.region} />}
                    {countryIntel.country.borders?.length > 0 && <DetailRow label="Borders" value={countryIntel.country.borders.slice(0, 3).join(', ')} />}
                    <div className="flex items-center justify-between gap-2 mt-1 pt-1 border-t border-gray-800/30">
                      <span className="text-[8px] font-mono text-gray-600">CONFLICT ZONE</span>
                      <span className={`text-[8px] font-mono ${isConflictZone ? 'text-red-400' : 'text-green-400'}`}>
                        {isConflictZone ? '⚠ ACTIVE' : '✓ STABLE'}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {countryIntelLoading && !countryIntel && (
                <div className="p-3 border-b border-gray-800/40">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 border border-blue-400 border-t-transparent rounded-full animate-spin" />
                    <span className="text-[8px] font-mono text-blue-400">Loading country intel...</span>
                  </div>
                </div>
              )}

              <div className="p-3 border-b border-gray-800/40">
                <div className="flex items-center gap-1.5 mb-2">
                  <MapPin className={`w-3 h-3 ${cfg.color}`} />
                  <span className="text-[9px] font-mono text-gray-500 tracking-wider">LOCATION</span>
                  {isIP && (
                    <span className="text-[7px] font-mono text-red-400 bg-red-900/30 px-1 py-0.5 rounded ml-auto flex items-center gap-1">
                      <span className="inline-block w-1 h-1 rounded-full bg-red-500 animate-pulse" />
                      TRACKED
                    </span>
                  )}
                </div>
                {isCamera && (
                  <div className="space-y-1">
                    <DetailRow label="Place" value={(raw as CameraData).name || (raw as CameraData).location || 'Unknown'} />
                    {(raw as CameraData).city && <DetailRow label="City" value={(raw as CameraData).city || 'Unknown'} />}
                    {(raw as CameraData).country && <DetailRow label="Country" value={(raw as CameraData).country || 'N/D'} />}
                    <DetailRow label="Lat" value={`${(raw as CameraData).lat?.toFixed(4) || point.lat.toFixed(4)}°`} />
                    <DetailRow label="Lng" value={`${(raw as CameraData).lng?.toFixed(4) || point.lng.toFixed(4)}°`} />
                    {(raw as CameraData).source && <DetailRow label="Source" value={(raw as CameraData).source || 'N/D'} />}
                  </div>
                )}
                {isFlight && (
                  <div className="space-y-1">
                    <DetailRow label="Country" value={raw.originCountry || 'Unknown'} />
                    <DetailRow label="Lat" value={`${point.lat.toFixed(4)}°`} />
                    <DetailRow label="Lng" value={`${point.lng.toFixed(4)}°`} />
                    <DetailRow label="ICAO" value={raw.icao24 || 'N/D'} />
                    {raw.aircraftType && raw.aircraftType !== 'Unknown' && <DetailRow label="Aircraft" value={raw.aircraftType} />}
                    {raw.classification && (
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[9px] font-mono text-gray-600">Class</span>
                        <span className={`text-[8px] font-mono px-1.5 py-0.5 rounded ${
                          raw.classification === 'military' ? 'text-red-400 bg-red-900/30 border border-red-700/30' :
                          raw.classification === 'commercial' ? 'text-blue-400 bg-blue-900/30 border border-blue-700/30' :
                          raw.classification === 'helicopter' ? 'text-amber-400 bg-amber-900/30 border border-amber-700/30' :
                          'text-gray-400 bg-gray-800/50 border border-gray-700/30'
                        }`}>
                          {raw.classification.toUpperCase()}
                        </span>
                      </div>
                    )}
                    {flightEstDestination && (
                      <div className="flex items-center justify-between gap-2 mt-1 pt-1 border-t border-gray-800/30">
                        <span className="text-[8px] font-mono text-gray-600">EST. DEST</span>
                        <span className="text-[8px] font-mono text-blue-300">{flightEstDestination.dirName}</span>
                      </div>
                    )}
                  </div>
                )}
                {isCable && (
                  <div className="space-y-1">
                    <DetailRow label="Station" value={raw.landingPointName || raw.landingPointCity || 'Unknown'} />
                    <DetailRow label="City" value={raw.landingPointCity || 'N/D'} />
                    <DetailRow label="Country" value={(raw as SubmarineCable).landingPoints?.[0]?.country || 'N/D'} />
                    <DetailRow label="Lat" value={`${point.lat.toFixed(4)}°`} />
                    <DetailRow label="Lng" value={`${point.lng.toFixed(4)}°`} />
                  </div>
                )}
                {isShip && (
                  <div className="space-y-1">
                    <DetailRow label="Destination" value={(raw as MaritimeData).destination || 'Unknown'} />
                    <DetailRow label="Flag" value={(raw as MaritimeData).flag || 'N/D'} />
                    <DetailRow label="Lat" value={`${point.lat.toFixed(4)}°`} />
                    <DetailRow label="Lng" value={`${point.lng.toFixed(4)}°`} />
                  </div>
                )}
                {isAntenna && (
                  <div className="space-y-1">
                    <DetailRow label="Operator" value={(raw as AntennaData).operator || 'Unknown'} />
                    <DetailRow label="Lat" value={`${point.lat.toFixed(4)}°`} />
                    <DetailRow label="Lng" value={`${point.lng.toFixed(4)}°`} />
                    <div className="flex items-center justify-between gap-2 mt-1 pt-1 border-t border-gray-800/30">
                      <span className="text-[8px] font-mono text-gray-600">TRACKING</span>
                      <span className="text-[8px] font-mono text-amber-400 flex items-center gap-1">
                        <Target className="w-2.5 h-2.5" />
                        CELL TRIANGULATION
                      </span>
                    </div>
                  </div>
                )}
                {isIP && (
                  <div className="space-y-1">
                    <DetailRow label="City" value={raw.city || 'Unknown'} />
                    <DetailRow label="Country" value={raw.country || 'N/D'} />
                    <DetailRow label="Region" value={raw.regionName || 'N/D'} />
                    <DetailRow label="Lat" value={`${(raw.lat || point.lat).toFixed(4)}°`} />
                    <DetailRow label="Lng" value={`${(raw.lng || raw.lon || point.lng).toFixed(4)}°`} />
                    <div className="flex items-center justify-between gap-2 mt-1 pt-1 border-t border-gray-800/30">
                      <span className="text-[8px] font-mono text-gray-600">ACCURACY</span>
                      <span className="text-[8px] font-mono text-red-400 flex items-center gap-1">
                        <span className="inline-block w-1 h-1 rounded-full bg-red-500 animate-pulse" />
                        ~{raw.accuracy || Math.floor(Math.random() * 50 + 5)}km radius
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[8px] font-mono text-gray-600">ZIP</span>
                      <span className="text-[8px] font-mono text-gray-300">{raw.zip || 'N/D'}</span>
                    </div>
                  </div>
                )}
                {isMilitary && (
                  <div className="space-y-1">
                    <DetailRow label="Sector" value={(raw as MilitaryData).location || 'Unknown'} />
                    <DetailRow label="Side" value={(raw as MilitaryData).side || 'N/D'} />
                    <DetailRow label="Lat" value={`${point.lat.toFixed(4)}°`} />
                    <DetailRow label="Lng" value={`${point.lng.toFixed(4)}°`} />
                    <DetailRow label="Updated" value={(raw as MilitaryData).lastUpdated || 'N/D'} />
                    {isConflictZone && (
                      <div className="flex items-center gap-1 mt-1 pt-1 border-t border-red-900/30">
                        <Siren className="w-2.5 h-2.5 text-red-400" />
                        <span className="text-[8px] font-mono text-red-400 animate-pulse">ACTIVE CONFLICT ZONE</span>
                      </div>
                    )}
                  </div>
                )}
                {isFOFA && (
                  <div className="space-y-1">
                    <DetailRow label="IP" value={raw.ip || 'Unknown'} />
                    <DetailRow label="Port" value={`${raw.port || 'N/D'}`} />
                    <DetailRow label="Protocol" value={raw.protocol || 'N/D'} />
                    <DetailRow label="City" value={raw.city || 'N/D'} />
                    <DetailRow label="Country" value={raw.country || 'N/D'} />
                    <DetailRow label="Lat" value={`${point.lat.toFixed(4)}°`} />
                    <DetailRow label="Lng" value={`${point.lng.toFixed(4)}°`} />
                    {isFOFACamera && fofaCameraData && (
                      <>
                        <div className="flex items-center gap-1 mt-1 pt-1 border-t border-fuchsia-900/30">
                          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          <span className="text-[7px] font-mono text-emerald-400" style={{ letterSpacing: '0.15em' }}>CAMERA FEED AVAILABLE</span>
                        </div>
                        <DetailRow label="Model" value={raw.title || 'N/D'} />
                        <DetailRow label="Feed" value={fofaCameraData.snapshotUrl ? 'SNAPSHOT' : 'N/D'} highlight={!!fofaCameraData.snapshotUrl} />
                        <DetailRow label="Stream" value={fofaCameraData.streamUrl ? 'RTSP' : 'N/D'} highlight={!!fofaCameraData.streamUrl} />
                      </>
                    )}
                  </div>
                )}
                {(isEarthquake || isCyber || isOutage || isFire || isSatellite || isGdelt) && (
                  <div className="space-y-1">
                    <DetailRow label="Lat" value={`${point.lat.toFixed(4)}°`} />
                    <DetailRow label="Lng" value={`${point.lng.toFixed(4)}°`} />
                    {isEarthquake && raw.magnitude && <DetailRow label="Magnitude" value={`M${raw.magnitude}`} highlight={raw.magnitude >= 6} />}
                    {isEarthquake && raw.depth && <DetailRow label="Depth" value={`${raw.depth} km`} />}
                    {isCyber && raw.severity && <DetailRow label="Severity" value={raw.severity.toUpperCase()} highlight={raw.severity === 'critical' || raw.severity === 'high'} />}
                    {isOutage && raw.severity && <DetailRow label="Severity" value={raw.severity.toUpperCase()} highlight={raw.severity === 'critical'} />}
                    {isFire && raw.type && <DetailRow label="Type" value={raw.type.toUpperCase()} />}
                    {isSatellite && raw.orbitType && <DetailRow label="Orbit" value={raw.orbitType} />}
                    {isSatellite && raw.noradId && <DetailRow label="NORAD" value={`#${raw.noradId}`} />}
                    {isGdelt && raw.category && <DetailRow label="Category" value={raw.category.toUpperCase()} />}
                  </div>
                )}
              </div>

              <div className="p-3 border-b border-gray-800/40">
                <div className="flex items-center gap-1.5 mb-2">
                  <Signal className={`w-3 h-3 ${cfg.color}`} />
                  <span className="text-[9px] font-mono text-gray-500 tracking-wider">TECHNICAL</span>
                </div>
                {isCamera && (
                  <div className="space-y-1">
                    <DetailRow label="IP" value={(raw as CameraData).ip || 'N/D'} />
                    <DetailRow label="Port" value={String((raw as CameraData).port || 'N/D')} />
                    <DetailRow label="Type" value={(raw as CameraData).type || 'N/D'} />
                    <DetailRow label="Status" value={(raw as CameraData).status || 'N/D'} highlight={(raw as CameraData).status === 'online'} />
                    <DetailRow label="Stream" value={(raw as CameraData).snapshotUrl ? 'LIVE' : 'OFFLINE'} highlight={!!(raw as CameraData).snapshotUrl} />
                    <DetailRow label="Last Seen" value={(raw as CameraData).lastSeen ? new Date((raw as CameraData).lastSeen).toLocaleTimeString() : 'N/D'} />
                  </div>
                )}
                {isFlight && (
                  <div className="space-y-1">
                    <DetailRow label="Altitude" value={`FL${Math.round((raw.altitude || raw.baro_altitude || 0) / 100)}`} />
                    <DetailRow label="Speed" value={raw.velocity ? `${Math.round(raw.velocity)} kts` : 'N/D'} />
                    <DetailRow label="Heading" value={raw.heading ? `${Math.round(raw.heading)}°` : 'N/D'} />
                    <DetailRow label="V/S" value={raw.verticalRate ? `${raw.verticalRate > 0 ? '↑' : '↓'} ${Math.abs(Math.round(raw.verticalRate))} fpm` : 'N/D'} />
                    <DetailRow label="Squawk" value={raw.squawk || 'N/D'} />
                    {flightEstDestination?.estHours && (
                      <div className="flex items-center justify-between gap-2 mt-1 pt-1 border-t border-gray-800/30">
                        <span className="text-[8px] font-mono text-gray-600">EST. ETA</span>
                        <span className="text-[8px] font-mono text-green-400">~{flightEstDestination.estHours}h {flightEstDestination.dirName}</span>
                      </div>
                    )}
                    {raw.emergency && (
                      <div className="flex items-center gap-1 mt-1 px-1.5 py-0.5 bg-red-900/30 border border-red-700/30 rounded">
                        <AlertTriangle className="w-2.5 h-2.5 text-red-400" />
                        <span className="text-[8px] font-mono text-red-400">EMERGENCY: {raw.emergency}</span>
                      </div>
                    )}
                  </div>
                )}
                {isCable && (
                  <div className="space-y-1">
                    <DetailRow label="Cable" value={raw.name || 'N/D'} />
                    <DetailRow label="Status" value={(raw as SubmarineCable).status?.replace('_', ' ') || 'N/D'} highlight={(raw as SubmarineCable).status === 'active'} />
                    <DetailRow label="Length" value={`${((raw as SubmarineCable).length || 0).toLocaleString()} km`} />
                    <DetailRow label="Capacity" value={(raw as SubmarineCable).capacity || 'N/D'} />
                    <DetailRow label="RFS Year" value={String((raw as SubmarineCable).rfsYear || 'N/D')} />
                    <DetailRow label="Landing Pts" value={`${(raw as SubmarineCable).landingPoints?.length || 0} stations`} />
                    {(raw as SubmarineCable).owners?.length > 0 && <DetailRow label="Owners" value={`${(raw as SubmarineCable).owners[0]}${(raw as SubmarineCable).owners.length > 1 ? ` +${(raw as SubmarineCable).owners.length - 1}` : ''}`} />}
                  </div>
                )}
                {isShip && (
                  <div className="space-y-1">
                    <DetailRow label="MMSI" value={(raw as MaritimeData).mmsi || 'N/D'} />
                    <DetailRow label="Type" value={(raw as MaritimeData).shipType || 'N/D'} />
                    <DetailRow label="Speed" value={`${(raw as MaritimeData).speed || 0} kn`} />
                    <DetailRow label="Heading" value={`${(raw as MaritimeData).heading || 0}°`} />
                  </div>
                )}
                {isAntenna && (
                  <div className="space-y-1">
                    <DetailRow label="Type" value={(raw as AntennaData).type || 'N/D'} />
                    <DetailRow label="Power" value={`${(raw as AntennaData).power || 0} dBm`} />
                    <DetailRow label="Range" value={`~${(raw as AntennaData).range || 0} km`} />
                    <DetailRow label="Frequency" value={(raw as AntennaData).frequency || 'N/D'} />
                    <DetailRow label="Network" value="5G NR" />
                    <DetailRow label="Status" value={(raw as AntennaData).status || 'N/D'} highlight={(raw as AntennaData).status === 'active'} />
                    <div className="mt-1.5 pt-1.5 border-t border-gray-800/30">
                      <div className="flex items-center gap-1 mb-1">
                        <Target className="w-2.5 h-2.5 text-amber-400" />
                        <span className="text-[8px] font-mono text-amber-400">LOCATION TRACKING</span>
                      </div>
                      <div className="space-y-0.5">
                        <DetailRow label="Method" value="Cell Triangulation" />
                        <DetailRow label="Accuracy" value={`~${Math.floor(Math.random() * 200 + 50)}m urban`} />
                        <DetailRow label="Coverage" value={`${(raw as AntennaData).range || 15}km radius`} />
                        <DetailRow label="Handoff" value="Inter-cell supported" />
                      </div>
                    </div>
                  </div>
                )}
                {isIP && (
                  <div className="space-y-1">
                    <DetailRow label="IP" value={raw.ip || raw.query || 'N/D'} />
                    <DetailRow label="ISP" value={raw.isp || 'N/D'} />
                    <DetailRow label="Org" value={raw.org || 'N/D'} />
                    <DetailRow label="ASN" value={raw.asn || 'N/D'} />
                    <DetailRow label="Timezone" value={raw.timezone || 'N/D'} />
                    <div className="mt-1.5 pt-1.5 border-t border-gray-800/30">
                      <div className="flex items-center gap-1 mb-1">
                        <Target className="w-2.5 h-2.5 text-red-400" />
                        <span className="text-[8px] font-mono text-red-400">TRACE DETAILS</span>
                      </div>
                      <div className="space-y-0.5">
                        <DetailRow label="Method" value="GeoIP Database" />
                        <DetailRow label="Accuracy" value={`~${raw.accuracy || Math.floor(Math.random() * 50 + 5)}km radius`} />
                        <DetailRow label="Loc Type" value="Approximate" />
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[8px] font-mono text-gray-600">STATUS</span>
                          <span className="text-[8px] font-mono text-red-400 flex items-center gap-1">
                            <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                            TARGET LOCKED
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                {isMilitary && (
                  <div className="space-y-1">
                    <DetailRow label="Type" value={(raw as MilitaryData).type || 'N/D'} />
                    <DetailRow label="Force" value={(raw as MilitaryData).strength || 'N/D'} />
                    <DetailRow label="Equipment" value={(raw as MilitaryData).equipment || 'N/D'} />
                    <DetailRow label="Role" value={(raw as MilitaryData).role || 'N/D'} />
                    <DetailRow label="Status" value={(raw as MilitaryData).status || 'N/D'} highlight={(raw as MilitaryData).status === 'active'} />
                  </div>
                )}
                {isFOFA && (
                  <div className="space-y-1">
                    <DetailRow label="Device" value={raw.deviceType?.toUpperCase() || 'N/D'} />
                    <DetailRow label="Org" value={raw.org || 'N/D'} />
                    <DetailRow label="Risk" value={raw.risk?.toUpperCase() || 'N/D'} highlight={raw.risk === 'critical' || raw.risk === 'high'} />
                    <DetailRow label="Banner" value={raw.banner?.substring(0, 40) || 'N/D'} />
                    <DetailRow label="Server" value={raw.server?.substring(0, 30) || 'N/D'} />
                    <DetailRow label="Last Seen" value={raw.lastSeen || 'N/D'} />
                  </div>
                )}
                {(isEarthquake || isCyber || isOutage || isFire || isSatellite || isGdelt) && (
                  <div className="space-y-1">
                    {isEarthquake && (
                      <>
                        <DetailRow label="Severity" value={raw.severity?.toUpperCase() || 'N/D'} highlight={raw.severity === 'major' || raw.severity === 'great'} />
                        <DetailRow label="Significance" value={String(raw.significance || 'N/D')} />
                        <DetailRow label="Tsunami" value={raw.tsunami ? '⚠ YES' : 'No'} highlight={raw.tsunami} />
                        <DetailRow label="Felt Reports" value={String(raw.felt || 'N/D')} />
                      </>
                    )}
                    {isCyber && (
                      <>
                        <DetailRow label="Source" value={raw.source || 'N/D'} />
                        <DetailRow label="CVE" value={raw.name || 'N/D'} />
                        <DetailRow label="Country" value={raw.country || 'N/D'} />
                      </>
                    )}
                    {isOutage && (
                      <>
                        <DetailRow label="Country" value={raw.countryName || 'N/D'} />
                        <DetailRow label="Score" value={String(raw.score || 'N/D')} />
                        <DetailRow label="Duration" value={raw.duration ? `${Math.round(raw.duration / 60)}min` : 'N/D'} />
                      </>
                    )}
                    {isFire && (
                      <>
                        <DetailRow label="Source" value={raw.source || 'N/D'} />
                        <DetailRow label="Brightness" value={raw.brightness ? `${raw.brightness}K` : 'N/D'} />
                        <DetailRow label="Confidence" value={raw.confidence || 'N/D'} />
                        <DetailRow label="Date" value={raw.date || 'N/D'} />
                      </>
                    )}
                    {isSatellite && (
                      <>
                        <DetailRow label="Name" value={raw.name || 'N/D'} />
                        <DetailRow label="Class" value={raw.classification?.toUpperCase() || 'N/D'} />
                        <DetailRow label="Altitude" value={raw.alt ? `${raw.alt} km` : 'N/D'} />
                        <DetailRow label="Launched" value={String(raw.launchYear || 'N/D')} />
                      </>
                    )}
                    {isGdelt && (
                      <>
                        <DetailRow label="Severity" value={raw.severity?.toUpperCase() || 'N/D'} highlight={raw.severity === 'critical'} />
                        <DetailRow label="Source" value={raw.source || 'N/D'} />
                        <DetailRow label="Date" value={raw.date || 'N/D'} />
                        <DetailRow label="Count" value={String(raw.count || 'N/D')} />
                      </>
                    )}
                  </div>
                )}
              </div>

              <div className="p-3">
                <div className="flex items-center gap-1.5 mb-2">
                  <Globe className={`w-3 h-3 ${cfg.color}`} />
                  <span className="text-[9px] font-mono text-gray-500 tracking-wider">NETWORK</span>
                </div>
                <div className="space-y-1">
                  <DetailRow label="Timestamp" value={new Date().toISOString().substring(0, 19)} />
                  <DetailRow label="Protocol" value={isCamera ? 'RTSP/H.264' : isFlight ? 'ADS-B 1090ES' : isCable ? 'DWDM/OTN' : isShip ? 'AIS Class A' : isAntenna ? '5G NR/LTE' : isMilitary ? 'MIL-STD-188' : isIP ? 'TCP/IP' : isEarthquake ? 'USGS GeoJSON' : isCyber ? 'CISA/abuse.ch' : isOutage ? 'IODA API' : isFire ? 'NASA FIRMS' : isSatellite ? 'SatNOGS TLE' : isGdelt ? 'GDELT 2.0' : 'TCP/IP'} />
                  <DetailRow label="Encryption" value={stableNetworkInfo.encryption} />
                  <DetailRow label="Latency" value={stableNetworkInfo.latency} />
                </div>
              </div>
            </div>
          </div>

          {isCamera || isFOFACamera ? (
            <div className="flex items-center justify-between px-3 py-1.5 border-t border-[rgba(212,175,55,0.15)] bg-black/80">
              <div className="flex items-center gap-4">
                <div className="flex flex-col">
                  <span className="text-[6px] font-mono text-gray-600" style={{ letterSpacing: '0.2em' }}>FEED TYPE</span>
                  <span className="text-[8px] font-mono text-white">
                    {isFOFACamera ? 'FOFA / ' : ''}
                    {(isFOFACamera ? fofaCameraData?.streamType : (raw as any).streamType)?.toUpperCase() || (raw as any).feed_type?.toUpperCase() || 'JPG'}
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[6px] font-mono text-gray-600" style={{ letterSpacing: '0.2em' }}>STATUS</span>
                  <span className={`text-[8px] font-mono ${raw.status === 'online' || isFOFACamera ? 'text-[#00E676]' : 'text-red-400'}`}>{raw.status === 'online' || isFOFACamera ? 'ACTIVE / RECORDING' : 'OFFLINE'}</span>
                </div>
                {isFOFACamera && (
                  <div className="flex flex-col">
                    <span className="text-[6px] font-mono text-gray-600" style={{ letterSpacing: '0.2em' }}>SOURCE</span>
                    <span className="text-[8px] font-mono text-fuchsia-400">FOFA DISCOVERED</span>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                {((isFOFACamera ? fofaCameraData?.snapshotUrl || fofaCameraData?.streamUrl : (raw as CameraData).snapshotUrl || (raw as CameraData).streamUrl)) ? (
                  <a href={isFOFACamera ? (fofaCameraData?.streamUrl || fofaCameraData?.snapshotUrl) : ((raw as CameraData).streamUrl || (raw as CameraData).snapshotUrl)} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1 px-2 py-0.5 text-[8px] font-mono text-[#D4AF37] bg-white/5 border border-white/10 rounded hover:bg-white/10 transition-colors">
                    <ExternalLink className="w-2.5 h-2.5" /> RAW FEED
                  </a>
                ) : null}
                <button onClick={() => {
                  const raw = point.rawData as any;
                  const lat = raw?.lat ?? point.lat;
                  const lng = raw?.lng ?? point.lng;
                  const flyTo = (window as any).__osirisMapFlyTo;
                  if (flyTo) { flyTo(lat, lng, 14); onToast?.(`Flying to camera: ${lat.toFixed(4)}°, ${lng.toFixed(4)}°`, 'success'); }
                  else onToast?.('Map not ready', 'warn');
                }} className="flex items-center gap-1 px-2 py-0.5 text-[8px] font-mono text-[#00E5FF] bg-white/5 border border-white/10 rounded hover:bg-white/10 transition-colors">
                  <MapPin className="w-2.5 h-2.5" /> MAP TARGET
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between px-4 py-2 border-t border-gray-800/40 bg-black/30">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => onTrack?.()}
                  className={`flex items-center gap-1 px-2.5 py-1 text-[9px] font-mono rounded transition-all ${
                    isTracked
                      ? 'text-cyan-300 bg-cyan-900/50 border border-cyan-500/60 shadow-[0_0_8px_rgba(0,200,255,0.3)]'
                      : 'text-gray-400 bg-gray-800/50 border border-gray-700/40 hover:text-white hover:border-cyan-700'
                  }`}
                >
                  <Eye className={`w-3 h-3 ${isTracked ? 'animate-pulse' : ''}`} />
                  {isTracked ? 'UNTRACK' : 'TRACK'}
                  {isTracked && <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse ml-0.5" />}
                </button>
                <button
                  onClick={() => onLock?.()}
                  className={`flex items-center gap-1 px-2.5 py-1 text-[9px] font-mono rounded transition-all ${
                    isLocked
                      ? 'text-red-300 bg-red-900/50 border border-red-500/60 shadow-[0_0_8px_rgba(255,50,50,0.3)]'
                      : 'text-gray-400 bg-gray-800/50 border border-gray-700/40 hover:text-white hover:border-red-700'
                  }`}
                >
                  <Crosshair className={`w-3 h-3 ${isLocked ? 'animate-spin' : ''}`} style={isLocked ? { animationDuration: '3s' } : undefined} />
                  {isLocked ? 'UNLOCK' : 'LOCK'}
                  {isLocked && <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse ml-0.5" />}
                </button>
                <button className="flex items-center gap-1 px-2.5 py-1 text-[9px] font-mono text-gray-400 bg-gray-800/50 border border-gray-700/40 rounded hover:text-white hover:border-cyan-700 transition-colors">
                  <Download className="w-3 h-3" /> EXPORT
                </button>
              </div>
              <div className="flex items-center gap-1.5">
                {isTracked && (
                  <div className="flex items-center gap-1 mr-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                    <span className="text-[8px] font-mono text-cyan-400">TRACKING</span>
                  </div>
                )}
                {isLocked && (
                  <div className="flex items-center gap-1 mr-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                    <span className="text-[8px] font-mono text-red-400">LOCKED</span>
                  </div>
                )}
                <Wifi className="w-3 h-3 text-green-400" />
                <span className="text-[9px] font-mono text-green-400">CONNECTED</span>
                <span className="text-[9px] font-mono text-gray-600 ml-2">HORUS v6.0</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function DetailRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-[9px] font-mono text-gray-600 flex-shrink-0">{label}</span>
      <span className={`text-[9px] font-mono truncate text-right ${highlight === true ? 'text-green-400' : highlight === false ? 'text-red-400' : 'text-gray-300'}`}>
        {value}
      </span>
    </div>
  );
}
