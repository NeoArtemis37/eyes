'use client';

import { useEffect, useRef, useState } from 'react';


type Props = {
  src: string;
  poster?: string;
  className?: string;
  muted?: boolean;
  videoRefOut?: { current: HTMLVideoElement | null };
};

const MAX_NETWORK_RETRIES = 2;

export default function HlsCamPlayer({ src, poster, className, muted = true, videoRefOut }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<{ destroy: () => void; startLoad: () => void; recoverMediaError: () => void } | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let onPlaying: (() => void) | null = null;
    setFailed(false);
    hlsRef.current = null;

    const proxiedSrc = `/api/osint/hls-proxy?url=${encodeURIComponent(src)}`;

    const announce = (kind: 'live' | 'dead') => {
      if (cancelled) return;
      window.dispatchEvent(new CustomEvent(`horus:cam-${kind}`, { detail: { src } }));
    };

    const load = async () => {
      const video = videoRef.current;
      if (!video) return;
      onPlaying = () => announce('live');
      video.addEventListener('playing', onPlaying, { once: true });
      const Hls = (await import('hls.js')).default;
      if (cancelled || !videoRef.current) return;

      if (Hls.isSupported()) {
        const hls = new Hls({
          enableWorker: true,
          lowLatencyMode: true,
          liveDurationInfinity: true, // live cams: never "end", stay at edge
          manifestLoadingMaxRetry: 2,
          manifestLoadingRetryDelay: 800,
          levelLoadingMaxRetry: 3,
          fragLoadingMaxRetry: 4,
          fragLoadingRetryDelay: 700,
        });
        hlsRef.current = hls;
        let networkRetries = 0;
        let mediaRecovered = false;

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          videoRef.current?.play().catch(() => {});
        });
        hls.on(Hls.Events.ERROR, (_evt, data) => {
          if (cancelled || !data.fatal) return;
          if (data.type === Hls.ErrorTypes.NETWORK_ERROR && networkRetries < MAX_NETWORK_RETRIES) {
            networkRetries += 1;
            hls.startLoad(); // reconnect (cams flap constantly)
            return;
          }
          if (data.type === Hls.ErrorTypes.MEDIA_ERROR && !mediaRecovered) {
            mediaRecovered = true;
            hls.recoverMediaError();
            return;
          }
          hls.destroy();
          hlsRef.current = null;
          if (!cancelled) {
            setFailed(true);
            announce('dead');
          }
        });

        hls.loadSource(proxiedSrc);
        hls.attachMedia(video);
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = proxiedSrc;
        video.addEventListener(
          'loadedmetadata',
          () => {
            video.play().catch(() => {});
          },
          { once: true }
        );
        video.addEventListener(
          'error',
          () => {
            if (!cancelled) {
              setFailed(true);
              announce('dead');
            }
          },
          { once: true }
        );
      } else {
        setFailed(true);
        announce('dead');
      }
    };

    load();

    return () => {
      cancelled = true;
      if (onPlaying) videoRef.current?.removeEventListener('playing', onPlaying);
      hlsRef.current?.destroy();
      hlsRef.current = null;
    };
  }, [src]);

  if (failed && poster) {
    return (
      <img
        src={poster}
        alt="flux indisponible"
        className={className}
        style={{ opacity: 0.5 }}
        onError={e => { (e.target as HTMLImageElement).style.opacity = '0.12'; }}
      />
    );
  }

  return (
    <video
      ref={el => {
        videoRef.current = el;
        if (videoRefOut) videoRefOut.current = el;
      }}
      className={className}
      poster={poster}
      muted={muted}
      autoPlay
      playsInline
      preload="none"
      onContextMenu={e => e.preventDefault()}
    />
  );
}
