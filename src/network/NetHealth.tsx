

'use client';

import { useEffect, useMemo, useRef } from 'react';
import type { SourceStatus, ThreatEvent } from './types';

type Props = {
  sources: SourceStatus[];
  events: ThreatEvent[];
};

const BUCKETS = 60; // last 60 minutes, 1 bucket per minute

/**
 * SANTÉ RÉSEAU — feed health panel for the network panes.
 * Throughput sparkline (events/min over the last hour) plus per-source
 * latency bars with honest degraded states (ok / stale / error).
 * All signals are local observations of our own polling — no probing
 * of third-party systems.
 */
export default function NetHealth({ sources, events }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const buckets = useMemo(() => {
    const out = new Array<number>(BUCKETS).fill(0);
    const now = Date.now();
    for (const e of events) {
      const ageMin = Math.floor((now - e.ts) / 60_000);
      if (ageMin >= 0 && ageMin < BUCKETS) out[BUCKETS - 1 - ageMin]++;
    }
    return out;
  }, [events]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, rect.width, rect.height);
    const max = Math.max(...buckets, 1);
    // baseline grid
    ctx.strokeStyle = 'rgba(53, 224, 255, 0.12)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, rect.height - 0.5);
    ctx.lineTo(rect.width, rect.height - 0.5);
    ctx.stroke();
    // area + line
    const px = (i: number) => (i / (BUCKETS - 1)) * (rect.width - 2) + 1;
    const py = (v: number) => rect.height - 2 - (v / max) * (rect.height - 6);
    ctx.beginPath();
    ctx.moveTo(px(0), rect.height - 2);
    buckets.forEach((v, i) => ctx.lineTo(px(i), py(v)));
    ctx.lineTo(px(BUCKETS - 1), rect.height - 2);
    ctx.closePath();
    const grad = ctx.createLinearGradient(0, 0, 0, rect.height);
    grad.addColorStop(0, 'rgba(53, 224, 255, 0.35)');
    grad.addColorStop(1, 'rgba(53, 224, 255, 0.02)');
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.beginPath();
    buckets.forEach((v, i) => {
      if (i === 0) ctx.moveTo(px(i), py(v));
      else ctx.lineTo(px(i), py(v));
    });
    ctx.strokeStyle = '#35e0ff';
    ctx.lineWidth = 1.4;
    ctx.stroke();
    ctx.fillStyle = 'rgba(139, 152, 169, 0.9)';
    ctx.font = '9px ui-monospace, monospace';
    ctx.fillText(`crête ${max}/min`, 4, 10);
  }, [buckets]);

  const okCount = sources.filter((s) => s.ok && !s.stale).length;
  const staleCount = sources.filter((s) => s.stale).length;
  const maxLat = Math.max(400, ...sources.map((s) => s.latencyMs ?? 0));

  return (
    <div className="net-health">
      <div className="nh-topline">
        <span>
          {okCount}/{sources.length} flux OK
        </span>
        {staleCount > 0 && <span className="nh-stale">{staleCount} stale</span>}
        <span style={{ marginLeft: 'auto' }}>{events.length} événements</span>
      </div>
      <canvas ref={canvasRef} className="nh-spark" />
      <div className="nh-rows">
        {sources.map((s) => (
          <div
            key={s.id}
            className={`nh-row ${
              s.ok ? (s.stale ? 'nh-stale' : 'nh-ok') : 'nh-err'
            }`}
            title={
              s.lastError
                ? `${s.label} · erreur: ${s.lastError}`
                : `${s.label} · ${s.latencyMs != null ? `${s.latencyMs} ms` : 'latence n/d'}`
            }
          >
            <span className="nh-dot" />
            <span className="nh-name">{s.label}</span>
            <span className="nh-bar">
              <i
                style={{
                  width: `${Math.min(100, ((s.latencyMs ?? 0) / maxLat) * 100)}%`,
                }}
              />
            </span>
            <span className="nh-ms">
              {s.latencyMs != null ? `${s.latencyMs}ms` : '—'}
            </span>
            <span className="nh-count">{s.count > 0 ? `+${s.count}` : '0'}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
