

'use client';

import { useMemo, useState } from 'react';
import { scaleLinear } from 'd3-scale';
import { KIND_COLOR, type FeedStats, type ThreatEvent, type ThreatKind } from './types';

type Props = { stats: FeedStats; events: ThreatEvent[] };
type Tab = 'country' | 'asn' | 'port' | 'kind' | 'xref';

const TABS: { id: Tab; label: string }[] = [
  { id: 'country', label: 'COUNTRIES' },
  { id: 'asn', label: 'ASN' },
  { id: 'port', label: 'PORTS' },
  { id: 'kind', label: 'KINDS' },
  { id: 'xref', label: 'CORRÉLÉS' },
];

type XrefRow = {
  ip: string;
  sources: Set<string>;
  sev: number;
  kind: ThreatKind;
  country?: string;
};

export default function TopTalkersPanel({ stats, events }: Props) {
  const [tab, setTab] = useState<Tab>('country');

  const xref = useMemo(() => {
    const m = new Map<string, XrefRow>();
    for (const e of events) {
      if (!e.ip) continue;
      const cur = m.get(e.ip);
      if (cur) {
        cur.sources.add(e.source);
        if (e.severity > cur.sev) {
          cur.sev = e.severity;
          cur.kind = e.kind;
        }
        if (!cur.country && e.geo?.country) cur.country = e.geo.country;
      } else {
        m.set(e.ip, {
          ip: e.ip,
          sources: new Set([e.source]),
          sev: e.severity,
          kind: e.kind,
          country: e.geo?.country,
        });
      }
    }
    return [...m.values()]
      .filter((r) => r.sources.size >= 2)
      .sort((a, b) => b.sources.size - a.sources.size || b.sev - a.sev)
      .slice(0, 10);
  }, [events]);

  const rows =
    tab === 'country'
      ? stats.topCountries.map((r) => ({ label: r.key, count: r.count }))
      : tab === 'asn'
        ? stats.topAsn.map((r) => ({
            label: r.key.length > 26 ? `${r.key.slice(0, 24)}…` : r.key,
            count: r.count,
          }))
        : tab === 'port'
          ? stats.topPorts.map((r) => ({ label: String(r.key), count: r.count }))
          : tab === 'kind'
            ? Object.entries(stats.byKind)
                .filter(([, c]) => c > 0)
                .sort((a, b) => b[1] - a[1])
                .map(([k, c]) => ({ label: k, count: c }))
            : xref.map((r) => ({ label: r.ip, count: r.sources.size }));

  const max = Math.max(1, ...rows.map((r) => r.count));
  const x = scaleLinear<number>()
    .domain([0, max])
    .range([8, 100]); // percent · CSS animates the transition

  return (
    <>
      <div className="tt-tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={`feed-chip ${tab === t.id ? 'is-on' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
      {rows.length === 0 ? (
        <div className="net-empty">
          {tab === 'xref' ? (
            <>
              <span className="net-spin" /> aucune corrélation multi-sources
              pour l'instant…
            </>
          ) : (
            <>
              <span className="net-spin" /> aggregating live feed…
            </>
          )}
        </div>
      ) : tab === 'xref' ? (
        xref.map((r) => (
          <div key={`xref-${r.ip}`} className="tt-row">
            <span
              className="tt-label"
              style={{ color: KIND_COLOR[r.kind] }}
              title={[
                `IP ${r.ip}`,
                `sévérité ${r.sev}`,
                r.country ? `pays ${r.country}` : null,
                `sources : ${[...r.sources].join(', ')}`,
              ]
                .filter(Boolean)
                .join('\n')}
            >
              {r.ip}
            </span>
            <div>
              <div
                className="tt-bar"
                style={{ width: `${x(r.sources.size)}%`, background: KIND_COLOR[r.kind] }}
              />
            </div>
            <span className="tt-count" title="sources distinctes">
              x{r.sources.size}
            </span>
          </div>
        ))
      ) : (
        rows.slice(0, 8).map((r) => (
          <div key={`${tab}-${r.label}`} className="tt-row">
            <span className="tt-label" title={r.label}>
              {r.label}
            </span>
            <div>
              <div className="tt-bar" style={{ width: `${x(r.count)}%` }} />
            </div>
            <span className="tt-count">{r.count}</span>
          </div>
        ))
      )}
    </>
  );
}
