

'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ADAPTERS } from './adapters';
import { enrichGeoBatch } from './geo';
import { SOURCE_LABEL, clamp, type FeedStats, type SourceStatus, type ThreatEvent, type ThreatKind } from './types';

const MAX_EVENTS = 4000;
const PUBLISH_MS = 1_000; // state publish cadence (smooth, not spammy)

const GEO_FLUSH_MS = 4_200;
const GEO_BATCH_MAX = 100;

type FeedState = {
  events: ThreatEvent[];
  stats: FeedStats;
  sources: SourceStatus[];
  lastUpdate: number | null;
  paused: boolean;
  pause: () => void;
  resume: () => void;
  refresh: () => void;
};

const dedupKey = (e: ThreatEvent) =>
  `${e.source}:${e.ip ?? e.host ?? '?'}:${e.port ?? 0}`;

function computeStats(events: ThreatEvent[]): FeedStats {
  const byKind = {
    c2: 0, malware: 0, phish: 0, ransom: 0, scan: 0, attack: 0, bgp: 0, dns: 0, vuln: 0,
  } as Record<ThreatKind, number>;
  const bySource: FeedStats['bySource'] = {};
  const countries = new Map<string, number>();
  const asn = new Map<string, number>();
  const ports = new Map<number, number>();
  let geolocated = 0;
  for (const e of events) {
    byKind[e.kind]++;
    bySource[e.source] = (bySource[e.source] ?? 0) + 1;
    if (e.geo) {
      geolocated++;
      const c = e.geo.country ?? 'N/D';
      if (c !== 'N/D') countries.set(c, (countries.get(c) ?? 0) + 1);
      if (e.geo.asn) asn.set(e.geo.asn, (asn.get(e.geo.asn) ?? 0) + 1);
    }
    if (e.port) ports.set(e.port, (ports.get(e.port) ?? 0) + 1);
  }
  const top = <K>(m: Map<K, number>, n: number) =>
    [...m.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, n)
      .map(([key, count]) => ({ key, count }));
  return {
    total: events.length,
    byKind,
    bySource,
    geolocated,
    topCountries: top(countries, 10),
    topAsn: top(asn, 10),
    topPorts: top(ports, 10),
  };
}

export function useThreatFeed(): FeedState {
  const eventsMap = useRef<Map<string, ThreatEvent>>(new Map());
  const sourcesSeen = useRef<Map<string, Set<string>>>(new Map()); // ip → sources
  const inFlight = useRef<Set<string>>(new Set());
  const nextDue = useRef<Map<string, number>>(new Map());
  const pausedRef = useRef(false);
  const dirtyRef = useRef(false);
  const geoPending = useRef<Set<string>>(new Set());

  const [events, setEvents] = useState<ThreatEvent[]>([]);
  const [sources, setSources] = useState<SourceStatus[]>(() =>
    ADAPTERS.map((a) => ({
      id: a.id,
      label: SOURCE_LABEL[a.id],
      ok: false,
      count: 0,
      lastFetch: 0,
      nextFetch: Date.now() + a.offsetMs,
    }))
  );
  const [lastUpdate, setLastUpdate] = useState<number | null>(null);
  const [paused, setPausedState] = useState(false);

  const mergeSource = useCallback(
    (source: string, incoming: ThreatEvent[]) => {
      let added = 0;
      for (const e of incoming) {
        const key = dedupKey(e);
        if (eventsMap.current.has(key)) continue; // already seen this snapshot
        eventsMap.current.set(key, e);
        added++;
        if (e.ip) {
          const set = sourcesSeen.current.get(e.ip) ?? new Set<string>();
          set.add(source);
          sourcesSeen.current.set(e.ip, set);
          if (!e.geo) geoPending.current.add(e.ip);
        }
      }
      if (eventsMap.current.size > MAX_EVENTS) {
        const drop = eventsMap.current.size - MAX_EVENTS;
        let i = 0;
        for (const k of eventsMap.current.keys()) {
          if (i++ >= drop) break;
          eventsMap.current.delete(k);
        }
      }
      return added;
    },
    []
  );

  const rescore = useCallback(() => {
    for (const e of eventsMap.current.values()) {
      if (!e.ip) continue;
      const n = sourcesSeen.current.get(e.ip)?.size ?? 1;
      const base =
        typeof e.meta._base === 'number' ? e.meta._base : (e.meta._base = e.severity);
      e.tags = e.tags.filter((t) => !/^x\d+-src$/.test(t));
      if (n > 1) {
        e.severity = clamp(base + Math.min(24, (n - 1) * 8), 0, 100);
        e.tags = [...e.tags, `x${n}-src`];
      }
    }
  }, []);

  const publish = useCallback(() => {
    const list = [...eventsMap.current.values()].sort(
      (a, b) => b.severity - a.severity || b.ts - a.ts
    );
    setEvents(list);
    dirtyRef.current = false;
  }, []);

  const runSource = useCallback(
    async (id: string) => {
      const adapter = ADAPTERS.find((a) => a.id === id);
      if (!adapter || inFlight.current.has(id)) return;
      inFlight.current.add(id);
      try {
        const t0 = performance.now();
        const incoming = await adapter.fetch();
        const latencyMs = Math.round(performance.now() - t0);
        const added = mergeSource(id, incoming);
        if (added > 0) {
          rescore();
          dirtyRef.current = true;
          setLastUpdate(Date.now());
        }
        setSources((prev) =>
          prev.map((s) =>
            s.id === id
              ? {
                  ...s,
                  ok: true,
                  count: s.count + added,
                  lastFetch: Date.now(),
                  lastError: undefined,
                  nextFetch: Date.now() + adapter.intervalMs,
                  latencyMs,
                  stale: false,
                }
              : s
          )
        );
      } catch (err) {
        setSources((prev) =>
          prev.map((s) =>
            s.id === id
              ? {
                  ...s,
                  ok: false,
                  lastFetch: Date.now(),
                  lastError: err instanceof Error ? err.message : 'failed',
                  nextFetch: Date.now() + adapter.intervalMs,
                }
              : s
          )
        );
      } finally {
        inFlight.current.delete(id);
      }
    },
    [mergeSource, rescore]
  );

  useEffect(() => {
    const tick = () => {
      if (pausedRef.current) return;
      const now = Date.now();
      for (const a of ADAPTERS) {
        const due = nextDue.current.get(a.id) ?? 0;
        if (now >= due && !inFlight.current.has(a.id)) {
          nextDue.current.set(a.id, now + a.intervalMs);
          void runSource(a.id);
        }
      }
      // staleness sweep: healthy sources whose data is older than 2 intervals
      setSources((prev) => {
        let changed = false;
        const next = prev.map((s) => {
          const a = ADAPTERS.find((x) => x.id === s.id);
          if (!a || !s.ok || !s.lastFetch) return s;
          const stale = now - s.lastFetch > a.intervalMs * 2;
          if (stale !== s.stale) {
            changed = true;
            return { ...s, stale };
          }
          return s;
        });
        return changed ? next : prev;
      });
    };
    tick(); // immediate first pass (sources are offset-staggered)
    const iv = setInterval(tick, 1_000);
    return () => clearInterval(iv);
  }, [runSource]);

  useEffect(() => {
    const iv = setInterval(() => {
      if (dirtyRef.current) publish();
    }, PUBLISH_MS);
    return () => clearInterval(iv);
  }, [publish]);

  useEffect(() => {
    let alive = true;
    let failStreak = 0;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      if (!alive) return;
      let transient = false;
      let mutated = false;
      if (geoPending.current.size > 0) {
        const batch = [...geoPending.current].slice(0, GEO_BATCH_MAX);
        let results: Record<string, ThreatEvent['geo'] | null> = {};
        try {
          const r = await enrichGeoBatch(batch);
          results = r.results;
          transient = r.transient;
        } catch {
          transient = true;
        }
        for (const ip of batch) {
          if (!(ip in results)) continue; // unresolved → stays pending
          geoPending.current.delete(ip);
          const geo = results[ip];
          if (!geo) continue; // definitive miss
          for (const e of eventsMap.current.values()) {
            if (e.ip === ip && !e.geo) {
              e.geo = geo as ThreatEvent['geo'];
              mutated = true;
            }
          }
        }
      }
      if (mutated) dirtyRef.current = true;
      failStreak = transient ? Math.min(failStreak + 1, 6) : 0;
      const delay = GEO_FLUSH_MS * (1 + failStreak * 0.9);
      timer = setTimeout(tick, delay);
    };
    timer = setTimeout(tick, 1_200);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, []);

  const pause = useCallback(() => {
    pausedRef.current = true;
    setPausedState(true);
  }, []);
  const resume = useCallback(() => {
    pausedRef.current = false;
    setPausedState(false);
  }, []);
  const refresh = useCallback(() => {
    for (const a of ADAPTERS) nextDue.current.set(a.id, 0);
  }, []);

  const stats = useMemo(() => computeStats(events), [events]);

  return { events, stats, sources, lastUpdate, paused, pause, resume, refresh };
}
