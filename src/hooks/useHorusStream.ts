'use client';

import { useEffect, useState } from 'react';

/* ------------------------------------------------------------------ */
/* HORUS live stream client — one SSE connection for the whole app.    */
/*                                                                     */
/* Transport : EventSource('/api/horus/stream') — le pont Next.js       */
/* reçoit le socket horus-stream côté serveur et re-diffuse en SSE.     */
/* (le schéma XTransformPort n'est pas suivi par la passerelle externe, */
/* le SSE passe partout : même origine, auto-reconnect natif).          */
/* Les cues / ordres opérateur partent en POST sur /api/horus/ops.      */
/* ------------------------------------------------------------------ */

export type AgentState = 'PATROL' | 'INVESTIGATE' | 'REPORT' | 'ESCALATE';

export type StreamAgent = {
  id: string;
  callsign: string;
  role: 'SECTOR' | 'ORBITAL' | 'NETWATCH' | 'HUNTER' | 'SENTRY';
  sector: string;
  state: AgentState;
  lat: number;
  lng: number;
  heading: number;
  task: string;
  target: { lat: number; lng: number; label: string } | null;
  since: number;
  severity: number;
  confidence: string | null;
  actions: number;
};

export type AgentReport = {
  id: string; agent: string; role: string; ts: number;
  severity: number; ladder: 'P1' | 'P2' | 'P3' | 'P4';
  confidence: string; bluf: string; details: string[];
  sources: string[]; lat: number; lng: number; label: string;
};

export type AuditLine = {
  ts: number; agent: string; from: string; to: string;
  trigger: string; detail: string;
};

export type Echo = {
  id: string; ts: number; score: number; lat: number; lng: number;
  members: { family: string; source: string; label: string; ts: number }[];
};

export type Chain = {
  id: string; ts: number;
  from: { label: string; family: string; source: string; ts: number; lat: number; lng: number };
  to: { label: string; family: string; source: string; ts: number; lat: number; lng: number };
  confidence: string; kind: string;
};

export type SpaceWeather = {
  kp: number | null; kpTs: string | null; storm: boolean;
  alerts: { id: string; ts: number; kind: string; summary: string }[];
  updatedAt: number;
};

export type NetWeather = {
  count: number;
  alerts: {
    id: string; ts: number; level: number; datasource: string;
    entityType: 'country' | 'asn'; code: string; name: string;
    lat: number | null; lng: number | null;
  }[];
  ts: number;
};

type StreamState = {
  connected: boolean;
  agents: StreamAgent[];
  reports: AgentReport[];
  log: AuditLine[];
  echoes: Echo[];
  chains: Chain[];
  space: SpaceWeather | null;
  net: NetWeather | null;
};

const state: StreamState = {
  connected: false,
  agents: [],
  reports: [],
  log: [],
  echoes: [],
  chains: [],
  space: null,
  net: null,
};

const listeners = new Set<() => void>();
let es: EventSource | null = null;
let watchdog: ReturnType<typeof setTimeout> | null = null;
let healTimer: ReturnType<typeof setInterval> | null = null;
let lastEventAt = 0;

function patch(p: Partial<StreamState>) {
  Object.assign(state, p);
  for (const fn of listeners) fn();
}

function on<T>(ev: string, apply: (data: T) => void) {
  if (!es) return;
  es.addEventListener(ev, (e) => {
    try {
      apply(JSON.parse((e as MessageEvent).data) as T);
      // tout flux reçu = liaison vivante
      lastEventAt = Date.now();
      if (!state.connected) patch({ connected: true });
      armWatchdog();
    } catch { /* payload malformé ignoré */ }
  });
}

function armWatchdog() {
  if (watchdog) clearTimeout(watchdog);
  watchdog = setTimeout(() => patch({ connected: false }), 25_000);
}

// AUTO-RÉPARATION : si aucun événement depuis 20 s (HMR, proxy, flux
// interrompu sans onerror), on détruit l'EventSource et on repart à zéro.
function ensureHealer() {
  if (healTimer) return;
  healTimer = setInterval(() => {
    if (!es) return;
    if (Date.now() - lastEventAt > 20_000 || es.readyState === 2) {
      try { es.close(); } catch {}
      es = null;
      patch({ connected: false });
      ensureStream();
    }
  }, 5_000);
}

function ensureStream(): EventSource | null {
  if (typeof window === 'undefined') return null;
  if (es) return es;
  lastEventAt = Date.now();
  es = new EventSource('/api/horus/stream');
  ensureHealer();

  es.onopen = () => { /* la connexion passe à 'connected' au premier flux */ };
  es.onerror = () => {
    // EventSource retente tout seul ; on reflète juste l'état
    patch({ connected: false });
  };

  on<{ upstream: boolean; msg: string }>('bridge', (d) => {
    patch({ connected: d.upstream });
    armWatchdog();
  });

  on<StreamAgent[]>('agents', (agents) => patch({ agents }));
  on<{ agents: StreamAgent[] }>('agent_tick', (p) => {
    if (!Array.isArray(p?.agents)) return;
    const byId = new Map(p.agents.map((a) => [a.id, a]));
    patch({
      agents: state.agents.map((a) => {
        const t = byId.get(a.id);
        return t ? { ...a, ...t } : a;
      }),
    });
  });
  on<AgentReport>('agent_report', (r) => {
    patch({ reports: [r, ...state.reports.filter((x) => x.id !== r.id)].slice(0, 60) });
  });
  on<AgentReport[]>('agent_reports', (rs) => patch({ reports: rs }));
  on<AuditLine>('agent_log', (l) => {
    patch({ log: [l, ...state.log].slice(0, 80) });
  });
  on<AuditLine[]>('agent_log_tail', (ls) => patch({ log: ls }));
  on<Echo>('echo', (e) => {
    patch({ echoes: [e, ...state.echoes.filter((x) => x.id !== e.id)].slice(0, 30) });
  });
  on<{ echoes: Echo[]; chains: Chain[] }>('echo_scan', (p) => {
    patch({ echoes: p?.echoes ?? [], chains: p?.chains ?? [] });
  });
  on<SpaceWeather>('spaceweather', (s) => patch({ space: s }));
  on<NetWeather>('netweather', (n) => patch({ net: n }));
  return es;
}

export function useHorusStream(): StreamState & {
  cue: (lat: number, lng: number, operator?: string, note?: string) => Promise<unknown>;
  order: (callsign: string, order: string) => Promise<unknown>;
} {
  const [, bump] = useState(0);

  useEffect(() => {
    ensureStream();
    const fn = () => bump((n) => n + 1);
    listeners.add(fn);
    return () => { listeners.delete(fn); };
  }, []);

  // diagnostic manuel : window.__horusStreamDebug()
  useEffect(() => {
    (window as any).__horusStreamDebug = () => ({
      readyState: es?.readyState ?? -1,
      connected: state.connected,
      lastEventAt: lastEventAt ? Math.round((Date.now() - lastEventAt) / 1000) + 's' : 'never',
      agents: state.agents.length,
      reports: state.reports.length,
      echoes: state.echoes.length,
      chains: state.chains.length,
    });
  }, []);

  return {
    connected: state.connected,
    agents: state.agents,
    reports: state.reports,
    log: state.log,
    echoes: state.echoes,
    chains: state.chains,
    space: state.space,
    net: state.net,
    cue: async (lat, lng, operator, note) => {
      try {
        const r = await fetch('/api/horus/ops', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'cue', lat, lng, operator, note }),
          signal: AbortSignal.timeout(8000),
        });
        return await r.json();
      } catch (e) {
        return { ok: false, reason: e instanceof Error ? e.message : 'network' };
      }
    },
    order: async (callsign, order) => {
      try {
        const r = await fetch('/api/horus/ops', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'order', callsign, order }),
          signal: AbortSignal.timeout(8000),
        });
        return await r.json();
      } catch (e) {
        return { ok: false, reason: e instanceof Error ? e.message : 'network' };
      }
    },
  };
}
