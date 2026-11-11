

'use client';

import { useEffect, useRef, useState } from 'react';
import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCollide,
  forceCenter,
  type ForceLink,
  type Simulation,
  type SimulationNodeDatum,
} from 'd3-force';
import { KIND_COLOR, type ThreatEvent, type ThreatKind } from './types';

type GNode = SimulationNodeDatum & {
  id: string;
  type: 'ip' | 'asn' | 'country';
  label: string;
  count: number;
  hue?: number;
  color?: string;
  sev?: number;
  r: number;
  born?: number;    // naissance du nœud → animation d'apparition
  lastSeen?: number; // fraîcheur → alpha décroissant (decay 90 s)
  fx?: number | null;
  fy?: number | null;
};

type GLink = { source: GNode; target: GNode; dist: number };

type Props = { events: ThreatEvent[] };

const MAX_IP_NODES = 60;

export default function ForceGraph({ events }: Props) {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const sim = useRef<Simulation<GNode, undefined> | null>(null);
  const linkForce = useRef<ForceLink<GNode, GLink> | null>(null);
  const nodes = useRef<GNode[]>([]);
  const links = useRef<GLink[]>([]);
  const [hover, setHover] = useState<{ x: number; y: number; n: GNode } | null>(
    null
  );

  useEffect(() => {
    const ipAgg = new Map<
      string,
      { count: number; sev: number; kinds: Partial<Record<ThreatKind, number>>; asn?: string; country?: string }
    >();
    const asnAgg = new Map<string, number>();
    const ctyAgg = new Map<string, number>();
    for (const e of events) {
      if (!e.ip) continue;
      const a =
        ipAgg.get(e.ip) ??
        { count: 0, sev: 0, kinds: {} as Partial<Record<ThreatKind, number>> };
      a.count++;
      a.sev = Math.max(a.sev, e.severity);
      a.kinds[e.kind] = (a.kinds[e.kind] ?? 0) + 1;
      if (e.geo?.asn) {
        a.asn = e.geo.asn;
        asnAgg.set(e.geo.asn, (asnAgg.get(e.geo.asn) ?? 0) + 1);
      }
      if (e.geo?.country) {
        a.country = e.geo.country;
        ctyAgg.set(e.geo.country, (ctyAgg.get(e.geo.country) ?? 0) + 1);
      }
      ipAgg.set(e.ip, a);
    }
    const topIps = [...ipAgg.entries()]
      .sort((x, y) => y[1].count - x[1].count)
      .slice(0, MAX_IP_NODES);

    const prev = new Map(nodes.current.map((n) => [n.id, n]));
    const next: GNode[] = [];
    const mk = (
      id: string,
      type: GNode['type'],
      label: string,
      count: number,
      extra: Partial<GNode>
    ): GNode => {
      const old = prev.get(id);
      const now = performance.now();
      return {
        id,
        type,
        label,
        count,
        r: 0,
        born: old?.born ?? now,
        lastSeen: now,
        ...extra,
        ...(old
          ? { x: old.x, y: old.y, vx: old.vx, vy: old.vy }
          : {}),
      };
    };

    for (const [ip, a] of topIps) {
      const kind = (Object.entries(a.kinds).sort((x, y) => y[1] - x[1])[0]?.[0] ??
        'scan') as ThreatKind;
      next.push(
        mk(`ip:${ip}`, 'ip', ip, a.count, {
          hue: undefined,
          color: KIND_COLOR[kind],
          sev: a.sev,
        })
      );
    }
    for (const [asn, c] of asnAgg) {
      if (c < 2) continue; // de-noise: ASN shown when it groups attackers
      next.push(mk(`asn:${asn}`, 'asn', asn.split(' ')[0], c, { color: 'hsl(160 80% 60%)' }));
    }
    for (const [c, n] of ctyAgg) {
      if (n < 2) continue;
      next.push(mk(`cty:${c}`, 'country', c, n, { color: 'hsl(190 80% 62%)' }));
    }

    const maxC = Math.max(1, ...next.map((n) => n.count));
    for (const n of next) n.r = 3 + Math.sqrt(n.count / maxC) * 14;

    const byId = new Map(next.map((n) => [n.id, n]));
    const nextLinks: GLink[] = [];
    for (const [ip, a] of topIps) {
      const src = byId.get(`ip:${ip}`);
      if (!src) continue;
      if (a.asn) {
        const t = byId.get(`asn:${a.asn}`);
        if (t) nextLinks.push({ source: src, target: t, dist: 55 });
      }
      if (a.country) {
        const t = byId.get(`cty:${a.country}`);
        if (t) nextLinks.push({ source: src, target: t, dist: 110 });
      }
    }

    nodes.current = next;
    links.current = nextLinks;

    const simulation = sim.current;
    const lf = linkForce.current;
    if (simulation && lf) {
      simulation.nodes(nodes.current);
      lf.links(links.current);
      simulation.alpha(0.6).restart();
    }
  }, [events]);

  useEffect(() => {
    const cv = canvas.current;
    const el = wrap.current;
    if (!cv || !el) return;
    const ctx = cv.getContext('2d');
    if (!ctx) return;

    let w = el.clientWidth;
    let h = el.clientHeight;
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = el.clientWidth;
      h = el.clientHeight;
      cv.width = w * dpr;
      cv.height = h * dpr;
      cv.style.width = `${w}px`;
      cv.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(el);

    const linkF = forceLink<GNode, GLink>(links.current)
      .distance((d) => d.dist)
      .strength(0.25);
    const simulation = forceSimulation<GNode>(nodes.current)
      .force('link', linkF)
      .force('charge', forceManyBody<GNode>().strength(-140))
      .force('collide', forceCollide<GNode>((d) => d.r + 4))
      .force('center', forceCenter<GNode>(w / 2, h / 2))
      .alphaDecay(0.02);
    linkForce.current = linkF;
    sim.current = simulation;

    const render = (now: number = performance.now()) => {
      ctx.clearRect(0, 0, w, h);
      const easeOut = (t: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);
      // arêtes — les liens à haute sévérité pulsent (dash animé)
      ctx.lineWidth = 0.7;
      for (const l of links.current) {
        const s = l.source as GNode;
        const t = l.target as GNode;
        if (!s || !t || s.x == null || t.x == null) continue;
        const hot = (s.sev ?? 0) > 70 || (t.sev ?? 0) > 70;
        ctx.beginPath();
        ctx.moveTo(s.x, s.y!);
        ctx.lineTo(t.x, t.y!);
        if (hot) {
          ctx.setLineDash([3, 5]);
          ctx.lineDashOffset = -((now / 42) % 8);
          ctx.strokeStyle = 'rgba(255,80,110,0.38)';
        } else {
          ctx.setLineDash([]);
          ctx.strokeStyle =
            t.type === 'country'
              ? 'rgba(120,220,255,0.10)'
              : 'rgba(120,220,255,0.16)';
        }
        ctx.stroke();
      }
      ctx.setLineDash([]);
      for (const n of nodes.current) {
        if (n.x == null || n.y == null) continue;
        const isIp = n.type === 'ip';
        // fraîcheur : alpha décroit sur 90 s depuis la dernière activité
        const age = Math.min(1, (now - (n.lastSeen ?? now)) / 90_000);
        const fresh = 1 - 0.62 * age;
        // apparition : pop élastique à la naissance du nœud
        const pop = 0.45 + 0.55 * easeOut((now - (n.born ?? now)) / 450);
        const rr = n.r * pop;
        ctx.beginPath();
        ctx.arc(n.x, n.y, rr, 0, 7);
        ctx.fillStyle = n.color ?? 'hsl(190 80% 62%)';
        ctx.globalAlpha = (isIp ? 0.9 : 0.55) * fresh;
        ctx.fill();
        ctx.globalAlpha = 1;
        if (isIp && (n.sev ?? 0) > 70) {
          const pulse = 1 + 0.12 * Math.sin(now / 260);
          ctx.beginPath();
          ctx.arc(n.x, n.y, rr + 6 * pulse, 0, 7);
          ctx.strokeStyle = `hsla(350 95% 65% / ${0.28 + 0.18 * fresh})`;
          ctx.lineWidth = 1.4;
          ctx.stroke();
          ctx.lineWidth = 0.7;
        }
        if (n.r > 8 || !isIp) {
          ctx.font = '9px var(--font-geist-mono), monospace';
          ctx.fillStyle = `rgba(216,243,255,${0.75 * fresh})`;
          ctx.textAlign = 'center';
          const label =
            n.label.length > 22 ? `${n.label.slice(0, 20)}…` : n.label;
          ctx.fillText(label, n.x, n.y + n.r + 10);
        }
      }
    };
    simulation.on('tick', () => render());
    // boucle rAF dédiée : le decay de fraîcheur et les pulses restent
    // animés même quand la simulation physique est en sommeil
    let raf = 0;
    const loop = (t: number) => {
      raf = requestAnimationFrame(loop);
      if (document.hidden) return;
      render(t);
    };
    raf = requestAnimationFrame(loop);
    render();

    const findNode = (mx: number, my: number): GNode | null => {
      for (const n of nodes.current) {
        if (n.x == null || n.y == null) continue;
        if (Math.hypot(mx - n.x, my - n.y) < n.r + 5) return n;
      }
      return null;
    };
    let dragN: GNode | null = null;
    const pos = (e: PointerEvent) => {
      const rect = cv.getBoundingClientRect();
      return { mx: e.clientX - rect.left, my: e.clientY - rect.top };
    };
    const down = (e: PointerEvent) => {
      const { mx, my } = pos(e);
      const n = findNode(mx, my);
      if (n) {
        dragN = n;
        n.fx = n.x;
        n.fy = n.y;
        cv.setPointerCapture(e.pointerId);
        simulation.alphaTarget(0.25).restart();
      }
    };
    const move = (e: PointerEvent) => {
      const { mx, my } = pos(e);
      if (dragN) {
        dragN.fx = mx;
        dragN.fy = my;
        dragN.x = mx;
        dragN.y = my;
      } else {
        const n = findNode(mx, my);
        setHover(n ? { x: mx, y: my, n } : null);
      }
    };
    const up = () => {
      if (dragN) {
        dragN.fx = null;
        dragN.fy = null;
        dragN = null;
        simulation.alphaTarget(0);
      }
    };
    cv.addEventListener('pointerdown', down);
    cv.addEventListener('pointermove', move);
    cv.addEventListener('pointerup', up);
    cv.addEventListener('pointercancel', up);

    return () => {
      cancelAnimationFrame(raf);
      simulation.stop();
      simulation.on('tick', null);
      sim.current = null;
      linkForce.current = null;
      ro.disconnect();
      cv.removeEventListener('pointerdown', down);
      cv.removeEventListener('pointermove', move);
      cv.removeEventListener('pointerup', up);
      cv.removeEventListener('pointercancel', up);
    };
  }, []);

  return (
    <div ref={wrap} className="net-map visual-mode-target">
      <canvas ref={canvas} />
      {/* légende fraîcheur / sévérité */}
      <div
        className="net-legend"
        style={{
          position: 'absolute', left: 12, bottom: 12, display: 'flex',
          flexDirection: 'column', gap: 4, fontSize: 8.5, letterSpacing: '0.1em',
          color: 'rgba(216,243,255,0.7)', background: 'rgba(5,10,18,0.55)',
          border: '1px solid rgba(140,220,255,0.14)', borderRadius: 6, padding: '6px 9px',
          pointerEvents: 'none', backdropFilter: 'blur(6px)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'rgba(255,80,110,0.9)', boxShadow: '0 0 6px rgba(255,80,110,0.8)' }} />
          C2 / HAUTE SÉVÉRITÉ · lien pulsé
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'rgba(120,220,255,0.85)' }} />
          ASN · PAYS
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 26, height: 3, background: 'linear-gradient(90deg, rgba(216,243,255,0.9), rgba(216,243,255,0.2))' }} />
          FRAÎCHEUR (décroissance 90 s)
        </div>
      </div>
      {hover && (
        <div
          className="net-tip"
          style={{ left: hover.x + 12, top: hover.y - 34 }}
        >
          <b>{hover.n.label}</b>
          <span>
            {hover.n.type.toUpperCase()} · {hover.n.count} events
            {hover.n.sev !== undefined ? ` · sev ${hover.n.sev}` : ''}
          </span>
        </div>
      )}
    </div>
  );
}
