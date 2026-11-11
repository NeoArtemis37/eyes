'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import {
  X, Play, Pause, RefreshCw, Maximize2, Minimize2,
  Camera, Circle, Wifi, WifiOff, Clock, Download,
  Youtube, ExternalLink
} from 'lucide-react';
import HlsCamPlayer from './HlsCamPlayer';

interface CameraViewerProps {
  camera: {
    id: string;
    ip?: string;
    lat?: number;
    lng?: number;
    location: string;
    type: string;
    status: string;
    snapshotUrl?: string;
    streamUrl?: string;
    source?: string;
    name?: string;
    city?: string;
    country?: string;
  };
  onClose: () => void;
}

type ViewerMode = 'jpg' | 'hls' | 'iframe' | 'fallback';

function getViewerMode(camera: CameraViewerProps['camera']): ViewerMode {
  if (camera.streamUrl?.endsWith('.m3u8')) return 'hls';
  if (camera.streamUrl && !camera.streamUrl.endsWith('.m3u8')) return 'iframe';
  if (camera.snapshotUrl) return 'jpg';
  return 'fallback';
}

function normalizeYouTubeEmbed(url: string): { url: string; isYouTube: boolean } {
  if (!url) return { url: '', isYouTube: false };

  let videoId = '';
  let existingParams = '';

  const embedMatch = url.match(/youtube(?:-nocookie)?\.com\/embed\/([A-Za-z0-9_-]{6,})(\?[^#]*)?/);
  if (embedMatch) {
    videoId = embedMatch[1];
    existingParams = embedMatch[2] || '';
  }

  if (!videoId) {
    const shortMatch = url.match(/youtu\.be\/([A-Za-z0-9_-]{6,})(\?[^#]*)?/);
    if (shortMatch) {
      videoId = shortMatch[1];
      existingParams = shortMatch[2] || '';
    }
  }

  if (!videoId) {
    const watchMatch = url.match(/[?&]v=([A-Za-z0-9_-]{6,})/);
    if (watchMatch) {
      videoId = watchMatch[1];
      existingParams = url.includes('?') ? '?' + url.split('?')[1] : '';
    }
  }

  if (!videoId) {
    const liveMatch = url.match(/youtube\.com\/live\/([A-Za-z0-9_-]{6,})/);
    if (liveMatch) {
      videoId = liveMatch[1];
    }
  }

  if (!videoId) return { url, isYouTube: false };

  const params = new URLSearchParams(existingParams || '');
  params.set('autoplay', '1');
  params.set('mute', '1');
  params.set('controls', '1');
  params.set('modestbranding', '1');
  params.set('rel', '0');
  params.set('playsinline', '1');
  params.set('iv_load_policy', '3');

  return {
    url: `https://www.youtube-nocookie.com/embed/${videoId}?${params.toString()}`,
    isYouTube: true,
  };
}

function formatUTCTime(): string {
  const now = new Date();
  const y = now.getUTCFullYear();
  const mo = String(now.getUTCMonth() + 1).padStart(2, '0');
  const d = String(now.getUTCDate()).padStart(2, '0');
  const h = String(now.getUTCHours()).padStart(2, '0');
  const mi = String(now.getUTCMinutes()).padStart(2, '0');
  const s = String(now.getUTCSeconds()).padStart(2, '0');
  return `${y}${mo}${d} ${h}:${mi}:${s} UTC`;
}

export default function CameraViewer({ camera, onClose }: CameraViewerProps) {
  const mode = getViewerMode(camera);

  const [isPlaying, setIsPlaying] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [utcClock, setUtcClock] = useState(formatUTCTime());
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [hlsLive, setHlsLive] = useState(false);
  const [hlsDead, setHlsDead] = useState(false);
  const [recStartTime] = useState(Date.now());
  const [recElapsed, setRecElapsed] = useState('00:00:00');

  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const refreshIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const clockIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (mode === 'jpg' && isPlaying && camera.snapshotUrl) {
      refreshIntervalRef.current = setInterval(() => {
        setRefreshKey(k => k + 1);
      }, 5000);
    }
    return () => {
      if (refreshIntervalRef.current) clearInterval(refreshIntervalRef.current);
    };
  }, [mode, isPlaying, camera.snapshotUrl]);

  useEffect(() => {
    clockIntervalRef.current = setInterval(() => {
      setUtcClock(formatUTCTime());
    }, 1000);
    return () => {
      if (clockIntervalRef.current) clearInterval(clockIntervalRef.current);
    };
  }, []);

  useEffect(() => {
    if (isPlaying) {
      recIntervalRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - recStartTime) / 1000);
        const h = String(Math.floor(elapsed / 3600)).padStart(2, '0');
        const m = String(Math.floor((elapsed % 3600) / 60)).padStart(2, '0');
        const s = String(elapsed % 60).padStart(2, '0');
        setRecElapsed(`${h}:${m}:${s}`);
      }, 1000);
    }
    return () => {
      if (recIntervalRef.current) clearInterval(recIntervalRef.current);
    };
  }, [isPlaying, recStartTime]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  useEffect(() => {
    if (mode !== 'hls' || !camera.streamUrl) {
      setHlsLive(false);
      setHlsDead(false);
      return;
    }
    setHlsLive(false);
    setHlsDead(false);
    const isMine = (e: Event) => {
      const d = (e as CustomEvent).detail as { src?: string } | undefined;
      return !d?.src || d.src === camera.streamUrl;
    };
    const onLive = (e: Event) => {
      if (isMine(e)) setHlsLive(true);
    };
    const onDead = (e: Event) => {
      if (isMine(e)) {
        setHlsDead(true);
        setHlsLive(false);
      }
    };
    window.addEventListener('horus:cam-live', onLive);
    window.addEventListener('horus:cam-dead', onDead);
    return () => {
      window.removeEventListener('horus:cam-live', onLive);
      window.removeEventListener('horus:cam-dead', onDead);
    };
  }, [mode, camera.id, camera.streamUrl]);

  useEffect(() => {
    setImgError(false);
    setImgLoaded(false);
    setRefreshKey(k => k + 1);
    setIsPlaying(true);
  }, [camera.id]);

  const handleRefresh = useCallback(() => {
    setImgError(false);
    setImgLoaded(false);
    setRefreshKey(k => k + 1);
  }, []);

  const handlePlayPause = useCallback(() => {
    setIsPlaying(prev => {
      const next = !prev;
      if (videoRef.current) {
        if (next) videoRef.current.play().catch(() => {});
        else videoRef.current.pause();
      }
      return next;
    });
  }, []);

  const handleFullscreen = useCallback(() => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }, []);

  const handleScreenshot = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let source: HTMLImageElement | HTMLVideoElement | null = null;
    if (mode === 'jpg') source = imgRef.current;
    else if (mode === 'hls') source = videoRef.current;

    if (!source) return;

    const w = (source as HTMLImageElement).naturalWidth || (source as HTMLVideoElement).videoWidth || 640;
    const h = (source as HTMLImageElement).naturalHeight || (source as HTMLVideoElement).videoHeight || 480;
    canvas.width = w;
    canvas.height = h;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(source, 0, 0, w, h);

    const link = document.createElement('a');
    link.download = `HORUS_CAM_${camera.id}_${new Date().toISOString().replace(/[:.]/g, '-')}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  }, [mode, camera.id]);

  const proxiedSnapshotUrl = camera.snapshotUrl
    ? `/api/osint/camera-proxy?url=${encodeURIComponent(camera.snapshotUrl)}&_=${refreshKey}`
    : '';

  const ytResult = camera.streamUrl ? normalizeYouTubeEmbed(camera.streamUrl) : { url: '', isYouTube: false };
  const effectiveStreamUrl = ytResult.isYouTube ? ytResult.url : camera.streamUrl;
  const isYouTubeStream = ytResult.isYouTube;

  const displayName = camera.name || camera.location || camera.id;

  return (
    <div
      ref={containerRef}
      className="h-full w-full flex flex-col bg-black relative select-none"
      style={{ fontFamily: 'monospace' }}
    >
      <div
        className="pointer-events-none absolute inset-0 z-30 opacity-[0.04]"
        style={{
          backgroundImage:
            'repeating-linear-gradient(0deg, transparent, transparent 1px, rgba(0,0,0,0.5) 1px, rgba(0,0,0,0.5) 2px)',
          backgroundSize: '100% 2px',
        }}
      />

      <div className="absolute top-0 left-0 right-0 z-20 p-2 flex items-start justify-between pointer-events-none">
        <div className="space-y-1">
          <div className="flex items-center gap-1.5">
            <Camera className="w-3 h-3 text-cyan-400 flex-shrink-0" />
            <span className="text-[10px] text-cyan-400 font-mono font-bold truncate max-w-[200px]">
              {displayName}
            </span>
          </div>
          <div className="text-[9px] text-cyan-300/70 font-mono pl-[18px] truncate max-w-[220px]">
            {camera.city && camera.country ? `${camera.city}, ${camera.country}` : camera.location}
          </div>
          <div className="flex items-center gap-1.5 pl-[18px]">
            <span className="px-1 py-px text-[8px] font-mono bg-cyan-900/40 border border-cyan-700/30 text-cyan-400 rounded">
              {camera.type.toUpperCase()}
            </span>
            <span className="flex items-center gap-0.5">
              {camera.status === 'online' ? (
                <Wifi className="w-2.5 h-2.5 text-green-400" />
              ) : (
                <WifiOff className="w-2.5 h-2.5 text-red-400" />
              )}
              <span className={`text-[8px] font-mono ${camera.status === 'online' ? 'text-green-400' : 'text-red-400'}`}>
                {camera.status.toUpperCase()}
              </span>
            </span>
          </div>
          {camera.ip && (
            <div className="text-[8px] text-gray-500 font-mono pl-[18px]">
              {camera.ip}
            </div>
          )}
        </div>

        <button
          onClick={onClose}
          className="pointer-events-auto p-1 rounded hover:bg-red-900/50 transition-colors group"
          title="Close viewer"
        >
          <X className="w-4 h-4 text-gray-400 group-hover:text-red-400 transition-colors" />
        </button>
      </div>

      {isPlaying && (
        <div className="absolute top-[68px] right-2 z-20 flex items-center gap-1">
          <Circle className="w-2.5 h-2.5 text-red-500 fill-red-500 animate-pulse" />
          <span className="text-[9px] font-mono text-red-400 font-bold">REC</span>
          <span className="text-[9px] font-mono text-red-400/70 ml-1">{recElapsed}</span>
        </div>
      )}

      {isYouTubeStream && (
        <a
          href={camera.streamUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="absolute bottom-14 left-2 z-20 pointer-events-auto flex items-center gap-1 px-1.5 py-0.5 bg-red-600/80 hover:bg-red-600 border border-red-400/40 rounded text-white transition-colors"
          title="Open on YouTube in new tab"
        >
          <Youtube className="w-2.5 h-2.5" />
          <span className="text-[8px] font-mono font-bold tracking-wider">YT LIVE</span>
          <ExternalLink className="w-2 h-2 opacity-70" />
        </a>
      )}

      <div className="flex-1 flex items-center justify-center overflow-hidden relative">
        {mode === 'jpg' && (
          <>
            {!imgError ? (
              <img
                ref={imgRef}
                key={refreshKey}
                src={proxiedSnapshotUrl}
                alt={`Camera ${camera.id}`}
                onLoad={() => setImgLoaded(true)}
                onError={() => { setImgError(true); setImgLoaded(false); }}
                className="max-w-full max-h-full object-contain"
                crossOrigin="anonymous"
              />
            ) : (
              <div className="flex flex-col items-center gap-2 text-gray-500">
                <WifiOff className="w-8 h-8 text-gray-600" />
                <span className="text-[10px] font-mono">STREAM UNREACHABLE</span>
                <button
                  onClick={handleRefresh}
                  className="px-2 py-0.5 text-[9px] font-mono bg-gray-800 border border-gray-700 rounded hover:border-cyan-700 hover:text-cyan-400 transition-colors"
                >
                  RETRY
                </button>
              </div>
            )}
            {!imgLoaded && !imgError && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                <RefreshCw className="w-6 h-6 text-cyan-400 animate-spin" />
              </div>
            )}
          </>
        )}


        {mode === 'hls' && camera.streamUrl && (
          <div className="relative w-full h-full flex items-center justify-center">
            <HlsCamPlayer
              src={camera.streamUrl}
              poster={camera.snapshotUrl ? `/api/osint/camera-proxy?url=${encodeURIComponent(camera.snapshotUrl)}` : undefined}
              className="max-w-full max-h-full object-contain"
              videoRefOut={videoRef}
            />
            {!hlsLive && !hlsDead && (
              <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 bg-black/65 pointer-events-none">
                <RefreshCw className="w-5 h-5 text-cyan-400 animate-spin" />
                <span className="text-[9px] font-mono text-cyan-300/80 tracking-[0.22em]">
                  FLUX EN COURS DE CHARGEMENT…
                </span>
              </div>
            )}
            {hlsLive && (
              <div className="absolute top-1 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5 px-1.5 py-0.5 bg-green-900/40 border border-green-500/40 rounded pointer-events-none">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                <span className="text-[8px] font-mono text-green-300 tracking-[0.18em]">FLUX LIVE</span>
              </div>
            )}
          </div>
        )}

        {mode === 'iframe' && effectiveStreamUrl && (
          <iframe
            key={effectiveStreamUrl}
            src={effectiveStreamUrl}
            className={isYouTubeStream ? "w-full h-full border-0" : "w-full h-full border-0"}
            {...(isYouTubeStream
              ? {
                  allow: 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen',
                  allowFullScreen: true,
                }
              : {
                  sandbox: 'allow-scripts allow-same-origin allow-popups allow-forms allow-presentation',
                  allow: 'fullscreen',
                })}
            title={`Camera ${camera.id} stream`}
            referrerPolicy="no-referrer-when-downgrade"
          />
        )}

        {mode === 'fallback' && (
          <div className="flex flex-col items-center gap-3 text-gray-500 px-4">
            <Camera className="w-10 h-10 text-gray-700" />
            <div className="text-[11px] font-mono text-gray-500">NO STREAM AVAILABLE</div>
            <div className="space-y-1 text-center">
              <div className="text-[9px] font-mono text-gray-600">CAMERA METADATA</div>
              <div className="text-[9px] font-mono text-gray-500">ID: {camera.id}</div>
              {camera.ip && <div className="text-[9px] font-mono text-gray-500">IP: {camera.ip}</div>}
              <div className="text-[9px] font-mono text-gray-500">LOC: {camera.location}</div>
              <div className="text-[9px] font-mono text-gray-500">TYPE: {camera.type}</div>
              {camera.source && <div className="text-[9px] font-mono text-gray-500">SRC: {camera.source}</div>}
            </div>
          </div>
        )}
      </div>

      <div className="relative z-20 flex items-center justify-between px-3 py-1.5 bg-black/70 border-t border-cyan-900/30 backdrop-blur-sm">
        <div className="flex items-center gap-1.5">
          <button
            onClick={handlePlayPause}
            className="p-1 rounded hover:bg-cyan-900/30 transition-colors group"
            title={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? (
              <Pause className="w-3.5 h-3.5 text-cyan-400 group-hover:text-cyan-300" />
            ) : (
              <Play className="w-3.5 h-3.5 text-cyan-400 group-hover:text-cyan-300" />
            )}
          </button>

          <button
            onClick={handleRefresh}
            className="p-1 rounded hover:bg-cyan-900/30 transition-colors group"
            title="Refresh snapshot"
          >
            <RefreshCw className="w-3.5 h-3.5 text-cyan-400 group-hover:text-cyan-300" />
          </button>

          <button
            onClick={handleScreenshot}
            className="p-1 rounded hover:bg-cyan-900/30 transition-colors group"
            title="Capture screenshot"
          >
            <Download className="w-3.5 h-3.5 text-cyan-400 group-hover:text-cyan-300" />
          </button>

          <button
            onClick={handleFullscreen}
            className="p-1 rounded hover:bg-cyan-900/30 transition-colors group"
            title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
          >
            {isFullscreen ? (
              <Minimize2 className="w-3.5 h-3.5 text-cyan-400 group-hover:text-cyan-300" />
            ) : (
              <Maximize2 className="w-3.5 h-3.5 text-cyan-400 group-hover:text-cyan-300" />
            )}
          </button>

          <span className="text-[8px] font-mono text-gray-600 ml-2">
            [{isYouTubeStream ? 'YOUTUBE' : mode.toUpperCase()}]
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <Clock className="w-2.5 h-2.5 text-gray-500" />
          <span className="text-[9px] font-mono text-gray-400">{utcClock}</span>
        </div>
      </div>

      <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-cyan-700/40 pointer-events-none z-10" />
      <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-cyan-700/40 pointer-events-none z-10" />
      <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-cyan-700/40 pointer-events-none z-10" />
      <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-cyan-700/40 pointer-events-none z-10" />

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
