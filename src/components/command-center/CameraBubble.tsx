'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import CameraViewer from './CameraViewer';


export type BubbleCamera = {
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

type Props = {
  camera: BubbleCamera;
  onClose: () => void;
};

type Pt = { x: number; y: number };

const W = 344;
const H = 235;

export default function CameraBubble({ camera, onClose }: Props) {
  const [anchor, setAnchor] = useState<Pt | null>(null);
  const [free, setFree] = useState<Pt | null>(null); // detached position
  const dragRef = useRef<{ dx: number; dy: number } | null>(null);
  const [dragging, setDragging] = useState(false);

  const project = useCallback((): Pt | null => {
    if (camera.lat == null || camera.lng == null) return null;
    const proj = (window as unknown as Record<string, undefined | ((lat: number, lng: number) => Pt | null)>)
      .__osirisMapProject;
    if (!proj) return null;
    return proj(camera.lat, camera.lng);
  }, [camera.lat, camera.lng]);

  useEffect(() => {
    setFree(null);
    setAnchor(project());
    const onMove = (window as unknown as Record<string, undefined | ((cb: () => void) => () => void)>)
      .__osirisMapOnMove;
    const unsub = onMove?.(() => {
      if (!dragRef.current) setAnchor(project());
    });
    return () => unsub?.();
  }, [project]);

  const onMouseDown = (e: React.MouseEvent) => {
    const base = free ?? anchor;
    if (!base) return;
    dragRef.current = { dx: e.clientX - base.x, dy: e.clientY - base.y };
    setDragging(true);
  };

  useEffect(() => {
    if (!dragging) return;
    const move = (e: MouseEvent) => {
      if (!dragRef.current) return;
      setFree({ x: e.clientX - dragRef.current.dx, y: e.clientY - dragRef.current.dy });
    };
    const up = () => {
      dragRef.current = null;
      setDragging(false);
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    return () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };
  }, [dragging]);

  if (!anchor && !free) {
    return (
      <div className="glass hp-cambubble" style={{ right: 16, bottom: 56, top: 'auto', left: 'auto' }}>
        <Head
          camera={camera}
          onClose={onClose}
          onDragStart={null}
          detached
          onSnap={null}
        />
        <div className="visual-mode-target" style={{ width: W - 12, height: 188, margin: 6, overflow: 'hidden', borderRadius: 8 }}>
          <CameraViewer camera={camera} onClose={onClose} />
        </div>
      </div>
    );
  }

  const raw = free ?? anchor!;
  const left = Math.max(8, Math.min(raw.x + 18, window.innerWidth - W - 8));
  const top = Math.max(52, Math.min(raw.y - 80, window.innerHeight - H - 60));
  const isDetached = free !== null;

  return (
    <>
      <div
        className="hp-cambubble__anchor"
        style={{ left: raw.x - 1, top: raw.y - 1, width: 2, height: 2 }}
      />
      <div
        className="glass hp-cambubble"
        style={{ left, top }}
      >
        <Head
          camera={camera}
          onClose={onClose}
          onDragStart={onMouseDown}
          detached={isDetached}
          onSnap={() => setFree(null)}
        />
        <div className="visual-mode-target" style={{ width: W - 12, height: 188, margin: 6, overflow: 'hidden', borderRadius: 8 }}>
          <CameraViewer camera={camera} onClose={onClose} />
        </div>
      </div>
    </>
  );
}

function Head({
  camera,
  onClose,
  onDragStart,
  detached,
  onSnap,
}: {
  camera: BubbleCamera;
  onClose: () => void;
  onDragStart: ((e: React.MouseEvent) => void) | null;
  detached: boolean;
  onSnap: (() => void) | null;
}) {
  return (
    <div
      className="panel__head"
      style={{ cursor: onDragStart ? 'grab' : 'default' }}
      onMouseDown={onDragStart ?? undefined}
      title={onDragStart ? 'Glisser pour détacher la bulle' : undefined}
    >
      <span className="panel__dot" />
      <h3 className="panel__title" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {camera.name || camera.id || 'CAMÉRA'}
      </h3>
      <span
        style={{ fontSize: 9, color: 'var(--txt-dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}
      >
        {camera.location}
      </span>
      {detached && onSnap && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onSnap();
          }}
          style={{
            marginLeft: 6, padding: '1px 6px', fontSize: 10, background: 'none',
            border: '1px solid rgba(140,220,255,0.25)', borderRadius: 4,
            color: 'var(--txt-dim)', cursor: 'pointer', fontFamily: 'inherit',
          }}
          title="Ré-ancrer sur la position de la caméra"
        >
          ⌖
        </button>
      )}
      <button
        className="panel__chev"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        style={{
          marginLeft: 6, background: 'none', border: 0,
          color: 'var(--txt-dim)', cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0,
        }}
        title="Fermer"
      >
        ✕
      </button>
    </div>
  );
}
