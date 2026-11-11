

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import AttackMap from './AttackMap';
import ForceGraph from './ForceGraph';
import ThreatFeedPanel from './ThreatFeedPanel';
import TopTalkersPanel from './TopTalkersPanel';
import CriticalTicker from './CriticalTicker';
import CountryPicker from './CountryPicker';
import CountryBreachTopline from './CountryBreachTopline';
import { africaDossierToBreaches } from './africaLeaks';
import { CENTROID, fetchBreaches } from './breaches';
import ThreatPopup, { type PopupTarget } from './ThreatPopup';
import GlassPanel from '../ui/GlassPanel';
import ReconDock from './ReconDock';
import DarkWebPanel from './DarkWebPanel';
import CorrPane from './CorrPane';
import NetHealth from './NetHealth';
import { useThreatFeed } from './useThreatFeed';
import { fetchSelfGeo } from './geo';
import {
  entryFor,
  iso2For,
  normCountry,
} from './countries';
import {
  KINDS,
  KIND_COLOR,
  KIND_GLOW,
  KIND_TINT,
  type BreachItem,
  type ThreatEvent,
  type ThreatKind,
} from './types';
import type { Spot } from './arcEngine';
import './net.css';

type Props = { onExit?: () => void };


const FALLBACK_SELF: [number, number] = [2.3522, 48.8566];


function useBreaches() {
  const [items, setItems] = useState<BreachItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchInto = () => {
    void fetchBreaches()
      .then(setItems)
      .catch((e) => setError(e instanceof Error ? e.message : 'failed'))
      .finally(() => setLoading(false));
  };

  const load = () => {
    setLoading(true);
    setError(null);
    fetchInto();
  };

  useEffect(() => {
    fetchInto();
  }, []);

  return { items, loading, error, refresh: load };
}

function hhmm(ts: number | null): string {
  if (!ts) return 'N/D';
  return new Date(ts).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export default function NetworkLayout({ onExit }: Props) {
  const { events, stats, sources, lastUpdate, paused, pause, resume, refresh } =
    useThreatFeed();
  const { items: hibpBreaches } = useBreaches();

  const breaches = useMemo(
    () => [...africaDossierToBreaches(), ...hibpBreaches],
    [hibpBreaches]
  );

  const [selfGeo, setSelfGeo] = useState<[number, number]>(FALLBACK_SELF);
  const [view, setView] = useState<'map' | 'graph' | 'corr'>('map');

  const [reconOpen, setReconOpen] = useState(false);
  const [reconMode, setReconMode] = useState<'ciblage' | 'darkweb' | 'phishing'>('darkweb');
  const [reconGroup, setReconGroup] = useState<string | null>(null);
  const [activeKinds, setActiveKinds] = useState<Set<ThreatKind>>(
    () => new Set(KINDS)
  );
  const [minSev, setMinSev] = useState(0);
  const [country, setCountry] = useState<string>('');
  const [popup, setPopup] = useState<PopupTarget | null>(null);
  const [breachCountry, setBreachCountry] = useState<string | null>(null);
  const [focus, setFocus] = useState<{ lon: number; lat: number; key: number } | null>(null);

  useEffect(() => {
    let dead = false;
    void fetchSelfGeo().then((g) => {
      if (dead || !g) return;
      setSelfGeo([g.lon, g.lat]);
    });
    return () => {
      dead = true;
    };
  }, []);

  const liveCount = sources.filter((s) => s.ok).length;
  const status: 'boot' | 'live' | 'degraded' =
    lastUpdate === null ? 'boot' : liveCount > 0 ? 'live' : 'degraded';

  const filtered = useMemo(() => {
    const kindOk = activeKinds.size === KINDS.length; // all on → skip filter
    return events.filter(
      (e: ThreatEvent) =>
        (kindOk || activeKinds.has(e.kind)) &&
        e.severity >= minSev &&
        (!country || normCountry(e.geo?.country) === country)
    );
  }, [events, activeKinds, minSev, country]);

  const observed = useMemo(() => {
    const m = new Map<string, { n: number; name: string }>();
    for (const e of events) {
      const raw = e.geo?.country;
      if (!raw) continue;
      const k = normCountry(raw);
      if (!k) continue;
      const cur = m.get(k);
      if (cur) cur.n++;
      else m.set(k, { n: 1, name: entryFor(k).name });
    }
    return m;
  }, [events]);

  const countryIso = country ? iso2For(country) : '';

  const toggleKind = (k: ThreatKind) => {
    setActiveKinds((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  };


  const exportIocs = () => {
    const head = [
      'ip', 'host', 'kind', 'severity', 'source', 'country', 'asn',
      'port', 'first_seen', 'url',
    ];
    const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const lines = [head.map(esc).join(',')];
    for (const e of filtered) {
      lines.push(
        [
          e.ip ?? '',
          e.host ?? '',
          e.kind,
          String(e.severity),
          e.source,
          e.geo?.country ?? '',
          e.geo?.asn ?? '',
          e.port?.toString() ?? '',
          e.ts > 0 ? new Date(e.ts).toISOString() : '',
          e.url ?? '',
        ]
          .map(esc)
          .join(',')
      );
    }
    const blob = new Blob([`\ufeff${lines.join('\n')}`], {
      type: 'text/csv;charset=utf-8',
    });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `horus-iocs-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const handleEndpointClick = useCallback(
    (spot: Spot, at: { x: number; y: number }) => {
      setPopup({ type: 'endpoint', spot, at });
    },
    []
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && reconOpen) setReconOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [reconOpen]);

  const openReconGroup = useCallback((name: string) => {
    setReconMode('darkweb');
    setReconGroup(name);
    setReconOpen(true);
  }, []);
  const handleBreachClick = useCallback(
    (breach: BreachItem, at: { x: number; y: number }) => {
      if (breach.country) {
        setPopup(null);
        setBreachCountry(breach.country);
        if (breach.geo) {
          setFocus({ lon: breach.geo.lon, lat: breach.geo.lat, key: Date.now() });
        }
      } else {
        setPopup({ type: 'breach', breach, at });
      }
    },
    []
  );

  useEffect(() => {
    const onCmd = (e: Event) => {
      const d = (e as CustomEvent).detail as Record<string, any>;
      if (!d?.cmd) return;
      switch (d.cmd) {
        case 'reset':
          setActiveKinds(new Set(KINDS));
          setMinSev(0);
          setCountry('');
          setBreachCountry(null);
          setPopup(null);
          setReconOpen(false);
          setView('map');
          break;
        case 'kinds': {
          const kinds = (Array.isArray(d.kinds) ? d.kinds : KINDS) as ThreatKind[];
          setActiveKinds(new Set(kinds));
          break;
        }
        case 'example': {
          const cand = [...events]
            .filter((ev) => ev.geo && Number.isFinite(ev.geo.lon) && Number.isFinite(ev.geo.lat))
            .sort((a, b) => b.severity - a.severity)[0];
          if (!cand?.geo) break;
          setPopup({
            type: 'endpoint',
            spot: {
              geo: [cand.geo.lon, cand.geo.lat],
              count: 1,
              maxSev: cand.severity,
              hue: 0,
              lastTs: cand.ts,
              ip: cand.ip,
              host: cand.host,
              source: cand.source,
              kind: cand.kind,
              city: cand.geo.city,
              country: cand.geo.country,
              asn: cand.geo.asn,
            } as Spot,
            at: {
              x: Math.round(window.innerWidth / 2) + 80,
              y: Math.round(window.innerHeight / 2) - 60,
            },
          });
          break;
        }
        case 'closePopup':
          setPopup(null);
          break;
        case 'breach': {
          const iso = String(d.iso ?? '');
          setBreachCountry(iso || null);
          const centroid = CENTROID[iso];
          if (centroid) setFocus({ lon: centroid[0], lat: centroid[1], key: Date.now() });
          break;
        }
        case 'recon':
          setReconMode(
            d.mode === 'ciblage' || d.mode === 'darkweb' || d.mode === 'phishing'
              ? d.mode
              : 'ciblage'
          );
          setReconGroup(null);
          setReconOpen(!!d.open);
          break;
        case 'view':
          setView(d.v === 'graph' ? 'graph' : 'map');
          break;
        case 'country':
          setCountry(String(d.c ?? ''));
          break;
      }
    };
    window.addEventListener('horus:tour-cmd', onCmd);
    return () => window.removeEventListener('horus:tour-cmd', onCmd);
  }, [events]);

  const mappedBreaches = useMemo(
    () => (countryIso ? breaches.filter((b) => b.country === countryIso) : breaches),
    [breaches, countryIso]
  );

  return (
    <div className={`net-root ${reconOpen ? 'recon-open' : ''}`}>
      {view === 'map' ? (
        <AttackMap
          events={filtered}
          selfGeo={selfGeo}
          breaches={mappedBreaches}
          autoRotate={!popup && !breachCountry}
          paused={paused}
          onEndpointClick={handleEndpointClick}
          onBreachClick={handleBreachClick}
          focus={focus}
        />
      ) : view === 'graph' ? (
        <ForceGraph events={filtered} />
      ) : (
        <CorrPane />
      )}

      <div className="net-overlay">

        <div className="net-cols">
          <div className="net-col" data-tour="net-filtres">
            <GlassPanel title="FILTRES" side="stack">
          <div className="feed-tools">
            {KINDS.map((k) => (
              <button
                key={k}
                className={`feed-chip ${activeKinds.has(k) ? 'is-on' : ''}`}
                style={
                  activeKinds.has(k)
                    ? {
                        borderColor: KIND_COLOR[k],
                        color: KIND_COLOR[k],
                        background: KIND_TINT[k],
                        textShadow: `0 0 8px ${KIND_GLOW[k]}`,
                      }
                    : undefined
                }
                onClick={() => toggleKind(k)}
              >
                {k}
              </button>
            ))}
          </div>
          <div className="tt-row">
            <span className="tt-label">sev min</span>
            <div>
              <input
                type="range"
                min={0}
                max={95}
                step={5}
                value={minSev}
                onChange={(e) => setMinSev(Number(e.target.value))}
                style={{ width: '100%', accentColor: '#35e0ff' }}
              />
            </div>
            <span className="tt-count">{minSev}</span>
          </div>
          <div className="tt-row" style={{ gridTemplateColumns: '38px 1fr' }}>
            <span className="tt-label">pays</span>
            <div>
              <CountryPicker value={country} onChange={setCountry} observed={observed} />
            </div>
          </div>
          <div style={{ color: 'var(--txt-dim)', fontSize: 10, margin: '6px 0 2px' }}>
            arcs : attaquants → infra menaces (flux live)
          </div>
          <div className="legend-sep" />
          {sources.map((s) => (
            <div key={s.id} className="legend-row" title={s.lastError ?? ''}>
              <span
                className="legend-swatch legend-dot"
                style={{
                  background: s.ok ? (s.stale ? '#ffb454' : '#4dffb0') : '#ff6b6b',
                }}
              />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {s.label}
              </span>
              <span style={{ marginLeft: 'auto', color: 'var(--txt-dim)', whiteSpace: 'nowrap' }}>
                {s.latencyMs != null ? `${Math.round(s.latencyMs)}ms · ` : ''}
                {s.count > 0 ? `+${s.count}` : ''}
              </span>
            </div>
          ))}
        </GlassPanel>


            <GlassPanel
              title="SANTÉ RÉSEAU"
              side="stack"
              defaultOpen={false}
              badge={
                <span style={{ color: 'var(--txt-dim)', fontSize: 10, marginLeft: 6 }}>
                  {sources.filter((s) => s.ok).length}/{sources.length}
                </span>
              }
            >
              <NetHealth sources={sources} events={events} />
            </GlassPanel>

            <GlassPanel title="DARK WEB" side="stack" defaultOpen={false}>
              <DarkWebPanel onOpenGroup={openReconGroup} />
            </GlassPanel>
          </div>

          <div className="net-col" data-tour="net-feed">
            <GlassPanel
              title="THREAT FEED"
              side="stack"
              defaultOpen
              badge={
                <span style={{ color: 'var(--txt-dim)', fontSize: 10, marginLeft: 6 }}>
                  {stats.total}
                </span>
              }
            >
              <ThreatFeedPanel
                events={filtered}
                stats={stats}
                paused={paused}
                onTogglePause={() => (paused ? resume() : pause())}
                activeKinds={activeKinds}
                onToggleKind={toggleKind}
              />
            </GlassPanel>

            <GlassPanel title="TOP TALKERS" side="stack">
              <TopTalkersPanel stats={stats} events={filtered} />
            </GlassPanel>
          </div>
        </div>

        <CriticalTicker events={filtered} />

        <div className="net-dock glass" data-tour="net-dock">
          <span
            className={`net-status ${status === 'live' ? 'live' : status === 'degraded' ? 'degraded' : 'live'}`}
          >
            {status === 'boot' ? (
              <>
                <span className="net-spin" /> SYNC
              </>
            ) : (
              <>
                <span className="dot">●</span>{' '}
                {status === 'live' ? 'LIVE' : 'DEGRADED'} · {liveCount}/
                {sources.length} src · MAJ {hhmm(lastUpdate)}
              </>
            )}
          </span>
          <button onClick={() => (paused ? resume() : pause())} className={paused ? 'is-on' : ''}>
            {paused ? '▶ REPRENDRE' : '❚❚ PAUSE'}
          </button>
          <button
            onClick={refresh}>⟳ RAFRAÎCHIR</button>
          <button
            className={reconOpen ? 'is-on' : ''}
            onClick={() => setReconOpen((o) => !o)}
            title="Recon toolkit : ciblage hôte · dark web · phishing"
          >
            ⌕ RECON
          </button>
          <button
            onClick={exportIocs}
            title="Exporter les IOC filtrés (CSV)"
          >
            ⇩ IOCS
          </button>
          <button
            onClick={() =>
              setView((v) => (v === 'map' ? 'graph' : v === 'graph' ? 'corr' : 'map'))
            }
            title="Basculer vue carte / graphe / corrélation multi-domaines"
          >
            {view === 'map' ? '\u25cf CARTE' : view === 'graph' ? '\u2b27 GRAPHE' : '\u2929 CORR\u00c9LATION'}
          </button>
          {onExit && <button onClick={onExit}>✕ GRILLE</button>}
        </div>


        {breachCountry && (
          <CountryBreachTopline
            countryIso={breachCountry}
            breaches={breaches}
            onClose={() => setBreachCountry(null)}
          />
        )}

        {popup && view === 'map' && (
          <ThreatPopup target={popup} onClose={() => setPopup(null)} />
        )}

        <ReconDock
          open={reconOpen}
          onClose={() => setReconOpen(false)}
          events={events}
          mode={reconMode}
          setMode={setReconMode}
          focusGroup={reconGroup}
          setFocusGroup={setReconGroup}
        />
      </div>
    </div>
  );
}
