

import type { ThreatGeo } from './types';

const LS_KEY = 'horus-net-geo-v1';
const LS_MAX = 3000;

type CacheVal = ThreatGeo | null; // null = known miss (do not retry)

const mem = new Map<string, CacheVal>();

(function hydrate() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return;
    const obj = JSON.parse(raw) as Record<string, CacheVal>;
    for (const [k, v] of Object.entries(obj)) mem.set(k, v);
  } catch {
  }
})();

let flushTimer: ReturnType<typeof setTimeout> | null = null;
function persist() {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    try {
      const entries = [...mem.entries()].slice(-LS_MAX);
      localStorage.setItem(LS_KEY, JSON.stringify(Object.fromEntries(entries)));
    } catch {
    }
  }, 2_000);
}


type Job = { ip: string; resolve: (g: CacheVal) => void };
const queue: Job[] = [];
let active = 0;
const MAX_CONCURRENT = 5;
const INTER_DELAY_MS = 120;

function pump() {
  while (active < MAX_CONCURRENT && queue.length) {
    const job = queue.shift()!;
    active++;
    lookup(job.ip)
      .then(job.resolve)
      .catch(() => job.resolve(null))
      .finally(() => {
        active--;
        setTimeout(pump, INTER_DELAY_MS);
      });
  }
}

async function lookup(ip: string): Promise<CacheVal> {
  try {
    const res = await fetch(`/api/network/geo/${encodeURIComponent(ip)}`, {
      signal: AbortSignal.timeout(10_000),
      cache: 'no-store',
    });
    const j = (await res.json()) as {
      status: string;
      geo?: ThreatGeo;
      transient?: boolean;
    };
    if (j.status === 'ok' && j.geo) {
      const geo = j.geo;
      mem.set(ip, geo);
      persist();
      return geo;
    }
    if (j.transient) return null;
    mem.set(ip, null); // definitive miss
    persist();
    return null;
  } catch {
    return null; // transient · NOT cached, retried on next mount
  }
}

export function enrichGeo(ip: string): Promise<CacheVal> {
  const hit = mem.get(ip);
  if (hit !== undefined) return Promise.resolve(hit);
  return new Promise((resolve) => {
    queue.push({ ip, resolve });
    pump();
  });
}


export async function enrichGeoBatch(
  ips: string[]
): Promise<{
  results: Record<string, ThreatGeo | null>;
  transient: boolean;
}> {
  const list = [...new Set(ips.filter(isIPv4Like))].slice(0, 100);
  if (!list.length) return { results: {}, transient: false };
  try {
    const res = await fetch('/api/network/geo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ips: list }),
      signal: AbortSignal.timeout(15_000),
      cache: 'no-store',
    });
    if (!res.ok) return { results: {}, transient: true };
    const j = (await res.json()) as {
      status: string;
      results?: Record<string, ThreatGeo | null>;
      transient?: boolean;
    };
    const results = j.results ?? {};
    for (const [ip, g] of Object.entries(results)) {
      mem.set(ip, g); // definitive entries only (server filters transient)
    }
    persist();
    return { results, transient: j.transient === true };
  } catch {
    return { results: {}, transient: true };
  }
}

export function enrichBatch(ips: string[]): Promise<ThreatGeo[]> {
  const unique = [...new Set(ips.filter(isIPv4Like))];
  return Promise.all(unique.map((ip) => enrichGeo(ip))).then(
    (gs) => gs.filter((g): g is ThreatGeo => g !== null)
  );
}

function isIPv4Like(s: string) {
  return (
    /^(\d{1,3}\.){3}\d{1,3}$/.test(s) || /^[0-9a-fA-F:]{3,45}$/.test(s)
  );
}

export type IpIntel = {
  greynoise?: {
    noise?: boolean;
    riot?: boolean;
    classification?: string;
    last_seen?: string;
    message?: string;
  };
  shodan?: {
    ports?: number[];
    cpes?: string[];
    hostnames?: string[];
    vulns?: string[];
    tags?: string[];
    asn?: string;
    org?: string;
  };
};

export async function fetchIpIntel(ip: string): Promise<IpIntel> {
  const [gn, sh] = await Promise.allSettled([
    fetch(`/api/network/greynoise/${encodeURIComponent(ip)}`, {
      signal: AbortSignal.timeout(10_000),
      cache: 'no-store',
    }).then((r) => r.json() as Promise<Record<string, unknown>>),
    fetch(`/api/network/shodan/${encodeURIComponent(ip)}`, {
      signal: AbortSignal.timeout(10_000),
      cache: 'no-store',
    }).then((r) => r.json() as Promise<Record<string, unknown>>),
  ]);
  return {
    greynoise: gn.status === 'fulfilled' ? (gn.value as IpIntel['greynoise']) : undefined,
    shodan: sh.status === 'fulfilled' ? (sh.value as IpIntel['shodan']) : undefined,
  };
}


export async function fetchSelfGeo(): Promise<ThreatGeo | null> {
  try {
    const res = await fetch('/api/network/self', {
      signal: AbortSignal.timeout(8_000),
      cache: 'no-store',
    });
    const j = (await res.json()) as Record<string, unknown>;
    if (j.status === 'ok' && j.geo) return j.geo as ThreatGeo;
    if (j.success === true && typeof j.latitude === 'number') {
      return {
        lat: j.latitude as number,
        lon: j.longitude as number,
        city: (j.city as string) || undefined,
        country: (j.country as string) || undefined,
      };
    }
    return null;
  } catch {
    return null;
  }
}
