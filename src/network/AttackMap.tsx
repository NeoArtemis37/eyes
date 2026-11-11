

'use client';

import { useEffect, useRef } from 'react';
import {
  geoOrthographic,
  geoPath,
  geoGraticule10,
  geoInterpolate,
  geoDistance,
} from 'd3-geo';
import type { GeoPermissibleObjects } from 'd3-geo';
import { feature } from 'topojson-client';
import { ArcEngine, type ArcSource, type Spot } from './arcEngine';
import type { BreachItem, ThreatEvent } from './types';

type Props = {
  events: ThreatEvent[];
  selfGeo: [number, number];
  breaches?: BreachItem[];
  autoRotate?: boolean;
  paused?: boolean;
  onEndpointClick?: (spot: Spot, at: { x: number; y: number }) => void;
  onBreachClick?: (breach: BreachItem, at: { x: number; y: number }) => void;

  focus?: { lon: number; lat: number; key: number } | null;
};

const LAND = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json';


const ROT_SPEED = 1.2;
const ROT_RESUME_MS = 2500;
const HIT_PX = 14;

export default function AttackMap({
  events,
  selfGeo,
  breaches,
  autoRotate = true,
  paused = false,
  onEndpointClick,
  onBreachClick,
  focus,
}: Props) {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const engine = useRef(new ArcEngine());
  const seen = useRef(new Set<string>());
  const rot = useRef<[number, number]>([-selfGeo[0], -selfGeo[1]]);
  const lastDragTs = useRef(0);
  const autoRotRef = useRef(autoRotate);
  const focusTarget = useRef<{ rot: [number, number] } | null>(null);
  useEffect(() => {
    if (!focus) {
      focusTarget.current = null;
      return;
    }
    focusTarget.current = { rot: [-focus.lon, -focus.lat] };
  }, [focus?.lon, focus?.lat, focus?.key]);
  const breachesRef = useRef(breaches);
  const endpointCbRef = useRef(onEndpointClick);
  const breachCbRef = useRef(onBreachClick);
  const pausedRef = useRef(paused);
  useEffect(() => {
    autoRotRef.current = autoRotate;
    breachesRef.current = breaches;
    endpointCbRef.current = onEndpointClick;
    breachCbRef.current = onBreachClick;
    pausedRef.current = paused;
  }, [autoRotate, breaches, onEndpointClick, onBreachClick, paused]);

  useEffect(() => {
    const add: ArcSource[] = [];
    for (const e of events) {
      if (seen.current.has(e.id)) continue;
      if (!e.geo) continue; // not resolved yet · stays pending
      seen.current.add(e.id); // consumed only when ingestible
      add.push({
        id: e.id,
        geo: [e.geo.lon, e.geo.lat],
        target: (e.meta as { targetGeo?: [number, number] }).targetGeo,
        kind: e.kind,
        severity: e.severity,
        ts: e.ts,
        ip: e.ip,
        host: e.host,
        source: e.source,
        city: e.geo.city,
        country: e.geo.country,
        asn: e.geo.asn,
      });
    }
    if (add.length) engine.current.push(add);
    if (seen.current.size > 9000) seen.current = new Set();
  }, [events]);

  useEffect(() => {
    const cv = canvas.current;
    const el = wrap.current;
    if (!cv || !el) return;
    const ctx = cv.getContext('2d');
    if (!ctx) return;

    let raf = 0;
    let lastFrameT = performance.now();
    let radius = 0;
    let cx = 0;
    let cy = 0;
    let dpr = 1;
    let land: GeoPermissibleObjects | null = null;
    // couches statiques du globe (halo + disque shaded, voile terminateur) —
    // indépendantes de la rotation, mises en cache par rayon
    let baseCv: HTMLCanvasElement | null = null;
    let shadeCv: HTMLCanvasElement | null = null;
    const buildLayers = () => {
      const R = radius;
      const pad = Math.ceil(R * 0.28) + 2;
      const S = Math.ceil((R + pad) * 2);
      // ─ base : halo atmosphérique + sphère solide éclairée haut-gauche
      const b0 = document.createElement('canvas');
      b0.width = b0.height = S;
      const b = b0.getContext('2d')!;
      const c0 = S / 2;
      let g = b.createRadialGradient(c0, c0, R * 0.96, c0, c0, R * 1.16);
      g.addColorStop(0, 'rgba(53,224,255,0.16)');
      g.addColorStop(0.55, 'rgba(53,224,255,0.07)');
      g.addColorStop(1, 'rgba(53,224,255,0)');
      b.fillStyle = g;
      b.fillRect(0, 0, S, S);
      g = b.createRadialGradient(c0 - R * 0.34, c0 - R * 0.40, R * 0.08, c0, c0, R * 1.02);
      g.addColorStop(0, '#1b4a68');
      g.addColorStop(0.42, '#113048');
      g.addColorStop(0.78, '#0a1e30');
      g.addColorStop(1, '#050f1a');
      b.fillStyle = g;
      b.beginPath(); b.arc(c0, c0, R, 0, Math.PI * 2); b.fill();
      b.strokeStyle = 'rgba(126,226,255,0.55)';
      b.lineWidth = 1.4;
      b.beginPath(); b.arc(c0, c0, R - 0.5, 0, Math.PI * 2); b.stroke();
      baseCv = b0;
      // ─ terminateur : voile sombre au limbe, passé AU-DESSUS des continents
      const s0 = document.createElement('canvas');
      s0.width = s0.height = S;
      const s = s0.getContext('2d')!;
      const g2 = s.createRadialGradient(c0 - R * 0.26, c0 - R * 0.30, R * 0.42, c0, c0, R * 1.0);
      g2.addColorStop(0, 'rgba(2,8,14,0)');
      g2.addColorStop(0.6, 'rgba(2,8,14,0.06)');
      g2.addColorStop(0.84, 'rgba(2,8,14,0.38)');
      g2.addColorStop(1, 'rgba(2,8,14,0.66)');
      s.fillStyle = g2;
      s.beginPath(); s.arc(c0, c0, R, 0, Math.PI * 2); s.fill();
      shadeCv = s0;
    };
    const projection = geoOrthographic().clipAngle(90);
    const path = geoPath(projection, ctx);

    let spotScreen: { spot: Spot; x: number; y: number }[] = [];
    let breachScreen: { breach: BreachItem; x: number; y: number }[] = [];
    // sprites de halo par teinte (points lumineux — pas de shadowBlur coûteux)
    const glowSprites = new Map<string, HTMLCanvasElement>();
    const glowSprite = (hue: number) => {
      const key = String(Math.round(hue));
      let cv2 = glowSprites.get(key);
      if (cv2) return cv2;
      cv2 = document.createElement('canvas');
      cv2.width = cv2.height = 32;
      const g = cv2.getContext('2d')!;
      const grad = g.createRadialGradient(16, 16, 1, 16, 16, 16);
      grad.addColorStop(0, `hsla(${hue} 95% 68% / 0.85)`);
      grad.addColorStop(0.4, `hsla(${hue} 95% 60% / 0.28)`);
      grad.addColorStop(1, `hsla(${hue} 95% 60% / 0)`);
      g.fillStyle = grad;
      g.fillRect(0, 0, 32, 32);
      glowSprites.set(key, cv2);
      return cv2;
    };

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = el.clientWidth;
      const h = el.clientHeight;
      cv.width = w * dpr;
      cv.height = h * dpr;
      cv.style.width = `${w}px`;
      cv.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cx = w / 2;
      cy = h / 2;
      radius = Math.min(w, h) * 0.40;
      projection.translate([cx, cy]).scale(radius);
      buildLayers();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(el);

    fetch(LAND)
      .then((r) => r.json())
      .then((t) => {
        const topo = t as unknown as {
          objects: { countries: unknown };
        };
        land = feature(
          topo as Parameters<typeof feature>[0] & never,
          topo.objects.countries as Parameters<
            typeof feature
          >[1] & never
        ) as unknown as GeoPermissibleObjects;
      })
      .catch(() => {
      });

    const center = (): [number, number] => [-rot.current[0], -rot.current[1]];
    const visible = (p: [number, number]) =>
      geoDistance(p, center()) < Math.PI / 2 - 0.01;

    const globe = () => {
      ctx.clearRect(0, 0, cv.width, cv.height);
      if (baseCv) ctx.drawImage(baseCv, cx - baseCv.width / 2, cy - baseCv.height / 2);
      ctx.beginPath();
      path(geoGraticule10());
      ctx.strokeStyle = 'rgba(110,190,235,0.15)';
      ctx.lineWidth = 1;
      ctx.stroke();
      if (land) {
        ctx.beginPath();
        path(land);
        ctx.fillStyle = 'rgba(48,124,168,0.72)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(150,235,255,0.42)';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
      if (shadeCv) ctx.drawImage(shadeCv, cx - shadeCv.width / 2, cy - shadeCv.height / 2);
    };

    const seg = (
      from: [number, number],
      to: [number, number],
      upto: number,
      alpha: number,
      width: number,
      color: string,
      liftMax: number
    ) => {
      const interp = geoInterpolate(from, to);
      const N = 56;
      let started = false;
      ctx.beginPath();
      for (let i = 0; i <= N; i++) {
        const s = (i / N) * upto;
        const p = interp(s) as [number, number];
        if (!visible(p)) {
          started = false;
          continue;
        }
        const xy = projection(p);
        if (!xy) {
          started = false;
          continue;
        }
        const dx = xy[0] - cx;
        const dy = xy[1] - cy;
        const r = Math.hypot(dx, dy) || 1;
        const lift = Math.sin(Math.PI * s) * liftMax;
        const x = xy[0] + (dx / r) * lift;
        const y = xy[1] + (dy / r) * lift;
        if (started) ctx.lineTo(x, y);
        else {
          ctx.moveTo(x, y);
          started = true;
        }
      }
      ctx.globalAlpha = alpha;
      ctx.lineWidth = width;
      ctx.strokeStyle = color;
      ctx.stroke();
      ctx.globalAlpha = 1;
    };

    const frame = (now: number) => {
      engine.current.update(now, pausedRef.current);

      if (
        autoRotRef.current &&
        !dragging &&
        !focusTarget.current &&
        now - lastDragTs.current > ROT_RESUME_MS
      ) {
        rot.current[0] += (ROT_SPEED * Math.min(128, now - lastFrameT)) / 1000;
        if (rot.current[0] > 180) rot.current[0] -= 360;
      }
      lastFrameT = now;

      const ft = focusTarget.current;
      if (ft) {
        const dl = ((ft.rot[0] - rot.current[0] + 540) % 360) - 180;
        const dp = ft.rot[1] - rot.current[1];
        rot.current[0] += dl * 0.07;
        rot.current[1] += dp * 0.07;
        if (Math.abs(dl) < 0.3 && Math.abs(dp) < 0.3) {
          rot.current[0] = ft.rot[0];
          rot.current[1] = ft.rot[1];
          focusTarget.current = null; // hold here · auto-rotate stays off
          lastDragTs.current = performance.now();
        }
      }

      projection.rotate([rot.current[0], rot.current[1]]);
      globe();

      spotScreen = [];
      for (const s of engine.current.spots.values()) {
        if (!visible(s.geo)) continue;
        const xy = projection(s.geo);
        if (!xy) continue;
        const rr = 1.6 + Math.sqrt(s.count) * 0.55;
        const sp = glowSprite(s.hue);
        const gs = rr * 4.6;
        ctx.drawImage(sp, xy[0] - gs / 2, xy[1] - gs / 2, gs, gs);
        ctx.beginPath();
        ctx.arc(xy[0], xy[1], rr, 0, 7);
        ctx.fillStyle = `hsla(${s.hue} 90% 62% / 0.95)`;
        ctx.fill();
        if (s.maxSev > 70) {
          ctx.beginPath();
          ctx.arc(xy[0], xy[1], rr + 4, 0, 7);
          ctx.strokeStyle = `hsla(${s.hue} 95% 65% / 0.3)`;
          ctx.lineWidth = 1;
          ctx.stroke();
        }
        spotScreen.push({ spot: s, x: xy[0], y: xy[1] });
      }

      breachScreen = [];
      const bList = breachesRef.current;
      if (bList) {
        for (const b of bList) {
          if (!b.geo) continue;
          const p: [number, number] = [b.geo.lon, b.geo.lat];
          if (!visible(p)) continue;
          const xy = projection(p);
          if (!xy) continue;
          const size = 4 + Math.min(7, Math.log10(Math.max(10, b.pwnCount)) * 0.9);
          ctx.beginPath();
          ctx.moveTo(xy[0], xy[1] - size);
          ctx.lineTo(xy[0] + size, xy[1]);
          ctx.lineTo(xy[0], xy[1] + size);
          ctx.lineTo(xy[0] - size, xy[1]);
          ctx.closePath();
          ctx.fillStyle = b.isAfrica ? 'rgba(255,184,77,0.95)' : 'rgba(140,160,190,0.65)';
          ctx.fill();
          ctx.strokeStyle = 'rgba(255,220,160,0.5)';
          ctx.lineWidth = 1;
          ctx.stroke();
          breachScreen.push({ breach: b, x: xy[0], y: xy[1] });
        }
      }

      for (const a of engine.current.arcs) {
        const t = Math.min(1, (now - a.start) / a.dur);
        const color = `hsl(${a.hue} 95% 66%)`;
        // élévation contenue : les arcs frôlent la surface au lieu de
        // s'envoler hors du disque
        const lift = radius * 0.052 * (0.55 + a.severity / 260);
        seg(a.from, a.to, 1, 0.13, 1, color, lift); // trace fantôme
        seg(a.from, a.to, t, 0.30, 5, color, lift); // halo néon
        seg(a.from, a.to, t, 0.95, 1.9, color, lift); // tête vive
        const p = geoInterpolate(a.from, a.to)(t) as [number, number];
        if (visible(p)) {
          const xy = projection(p);
          if (xy) {
            ctx.beginPath();
            ctx.arc(xy[0], xy[1], 2.4, 0, 7);
            ctx.fillStyle = '#fff';
            ctx.shadowColor = color;
            ctx.shadowBlur = 12;
            ctx.fill();
            ctx.shadowBlur = 0;
          }
        }
      }

      for (const p of engine.current.pulses) {
        if (!visible(p.at)) continue;
        const xy = projection(p.at);
        if (!xy) continue;
        const k = (now - p.start) / p.dur;
        ctx.beginPath();
        ctx.arc(xy[0], xy[1], 4 + k * 22, 0, 7);
        ctx.strokeStyle = `hsla(${p.hue} 95% 70% / ${1 - k})`;
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    let dragging = false;
    let px = 0;
    let py = 0;
    let moved = 0;
    const down = (e: PointerEvent) => {
      dragging = true;
      moved = 0;
      px = e.clientX;
      py = e.clientY;
      lastDragTs.current = performance.now();
      cv.setPointerCapture(e.pointerId);
    };
    const move = (e: PointerEvent) => {
      if (!dragging) return;
      const dx = e.clientX - px;
      const dy = e.clientY - py;
      moved += Math.abs(dx) + Math.abs(dy);
      rot.current[0] += dx * 0.3;
      rot.current[1] = Math.max(
        -90,
        Math.min(90, rot.current[1] - dy * 0.3)
      );
      px = e.clientX;
      py = e.clientY;
      lastDragTs.current = performance.now();
    };
    const up = (e: PointerEvent) => {
      dragging = false;
      lastDragTs.current = performance.now();
      if (moved < 6) {
        const rect = cv.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        let best: { d: number; spot?: Spot; breach?: BreachItem } | null = null;
        for (const s of spotScreen) {
          const d = Math.hypot(s.x - x, s.y - y);
          if (d <= HIT_PX && (!best || d < best.d)) best = { d, spot: s.spot };
        }
        for (const b of breachScreen) {
          const d = Math.hypot(b.x - x, b.y - y);
          if (d <= HIT_PX && (!best || d < best.d)) best = { d, breach: b.breach };
        }
        if (best?.spot) {
          const cb = endpointCbRef.current;
          if (cb) cb(best.spot, { x, y });
        } else if (best?.breach) {
          const cb = breachCbRef.current;
          if (cb) cb(best.breach, { x, y });
        }
      }
    };
    cv.addEventListener('pointerdown', down);
    cv.addEventListener('pointermove', move);
    cv.addEventListener('pointerup', up);
    cv.addEventListener('pointercancel', up);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      cv.removeEventListener('pointerdown', down);
      cv.removeEventListener('pointermove', move);
      cv.removeEventListener('pointerup', up);
      cv.removeEventListener('pointercancel', up);
    };
  }, [selfGeo]);

  return (
    <div ref={wrap} className="net-map visual-mode-target">
      <canvas ref={canvas} />
    </div>
  );
}
