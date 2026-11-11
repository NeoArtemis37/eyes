

'use client';

import { useMemo, useState } from 'react';
import { fetchIpIntel, type IpIntel } from './geo';
import {
  KIND_COLOR,
  KIND_GLOW,
  KIND_HUE,
  KIND_TINT,
  KINDS,
  SOURCE_LABEL,
  type FeedStats,
  type ThreatEvent,
  type ThreatKind,
  type ThreatSourceId,
} from './types';

type Props = {
  events: ThreatEvent[];
  stats: FeedStats;
  paused: boolean;
  onTogglePause: () => void;
  activeKinds: Set<ThreatKind>;
  onToggleKind: (k: ThreatKind) => void;
};

const MAX_ROWS = 200;

function ageOf(ts: number): string {
  const d = Date.now() - ts;
  if (d < 0) return 'now';
  const m = Math.floor(d / 60_000);
  if (m < 1) return 'now';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

export default function ThreatFeedPanel({
  events,
  stats,
  paused,
  onTogglePause,
  activeKinds,
  onToggleKind,
}: Props) {
  const [sort, setSort] = useState<'sev' | 'new'>('sev');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [intel, setIntel] = useState<{
    ip: string;
    data: IpIntel | null;
    loading: boolean;
  } | null>(null);

  const sorted = useMemo(() => {
    const list = [...events];
    if (sort === 'sev') list.sort((a, b) => b.severity - a.severity || b.ts - a.ts);
    else list.sort((a, b) => b.ts - a.ts || b.severity - a.severity);
    return list.slice(0, MAX_ROWS);
  }, [events, sort]);

  const selected = useMemo(
    () => events.find((e) => e.id === selectedId) ?? null,
    [events, selectedId]
  );

  const loadIntel = async (ip: string) => {
    setIntel({ ip, data: null, loading: true });
    const data = await fetchIpIntel(ip).catch(() => null);
    setIntel({ ip, data, loading: false });
  };

  return (
    <>
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
              onClick={() => onToggleKind(k)}
              title={`Filter ${k} (${stats.byKind[k] ?? 0})`}
            >
              {k} {stats.byKind[k] ?? 0}
            </button>
          ))}
        <button
          className="feed-chip"
          onClick={() => setSort((s) => (s === 'sev' ? 'new' : 'sev'))}
          title="Toggle sort"
        >
          {sort === 'sev' ? '▼ SEV' : '▼ NEW'}
        </button>
        <button
          className={`feed-chip ${paused ? 'is-on' : ''}`}
          onClick={onTogglePause}
          title="Pause / resume live stream"
        >
          {paused ? '▶ RESUME' : '❚❚ PAUSE'}
        </button>
      </div>

      {sorted.length === 0 && (
        <div className="net-empty">
          <span className="net-spin" /> connecting to live sources…
        </div>
      )}

      {sorted.map((e) => (
        <div
          key={e.id}
          className={`feed-row ${e.severity >= 75 ? 'crit' : ''} ${
            e.id === selectedId ? 'is-sel' : ''
          }`}
          style={{ ['--row-hue' as string]: KIND_HUE[e.kind] ?? 190 } as React.CSSProperties}
          onClick={() => {
            setSelectedId((id) => (id === e.id ? null : e.id));
            if (e.ip && e.id !== selectedId) void loadIntel(e.ip);
          }}
        >
          <span
            className="feed-sev"
            style={{
              color: KIND_COLOR[e.kind],
              fontWeight: 700,
              textShadow: `0 0 9px ${KIND_GLOW[e.kind]}`,
            }}
          >
            {e.severity}
          </span>
          <span className="feed-src">
            {SOURCE_LABEL[e.source as ThreatSourceId]?.split(' ').pop()}
          </span>
          <span className="feed-main">
            <span className="feed-ip">{e.ip ?? e.host ?? 'N/D'}</span>
            <span className="feed-sub">
              <span className="feed-kind" style={{ color: KIND_COLOR[e.kind] }}>
                {e.kind}
              </span>
              {e.port ? ` :${e.port}` : ''}
              {e.geo?.country ? ` · ${e.geo.country}` : ''}
              {e.tags[0] ? ` · ${e.tags[0]}` : ''}
            </span>
          </span>
          <span className="feed-time">{ageOf(e.ts)}</span>
        </div>
      ))}

      {selected && (
        <div className="feed-detail">
          <div className="kv">
            <b>source</b>
            <span>{SOURCE_LABEL[selected.source]}</span>
          </div>
          <div className="kv">
            <b>kind</b>
            <span style={{ color: KIND_COLOR[selected.kind] }}>
              {selected.kind} · severity {selected.severity}
            </span>
          </div>
          {selected.ip && (
            <div className="kv">
              <b>ip</b>
              <span>{selected.ip}</span>
            </div>
          )}
          {selected.host && (
            <div className="kv">
              <b>host</b>
              <span>{selected.host}</span>
            </div>
          )}
          {selected.url && (
            <div className="kv">
              <b>url</b>
              <span title={selected.url}>
                {selected.url.slice(0, 28)}
                {selected.url.length > 28 ? '…' : ''}
              </span>
            </div>
          )}
          {selected.port !== undefined && (
            <div className="kv">
              <b>port</b>
              <span>{selected.port}</span>
            </div>
          )}
          {selected.geo && (
            <div className="kv">
              <b>geo</b>
              <span>
                {selected.geo.city ?? 'N/D'}, {selected.geo.country ?? 'N/D'}
              </span>
            </div>
          )}
          {selected.geo?.asn && (
            <div className="kv">
              <b>asn</b>
              <span>{selected.geo.asn}</span>
            </div>
          )}
          {selected.tags.length > 0 && (
            <div className="kv">
              <b>tags</b>
              <span>{selected.tags.join(', ')}</span>
            </div>
          )}
          {typeof selected.meta.group === 'string' && selected.meta.group && (
            <div className="kv">
              <b>groupe</b>
              <span>{selected.meta.group}</span>
            </div>
          )}
          {typeof selected.meta.description === 'string' &&
            selected.meta.description && (
              <div className="kv">
                <b>détail</b>
                <span title={selected.meta.description}>
                  {selected.meta.description.slice(0, 60)}
                  {selected.meta.description.length > 60 ? '…' : ''}
                </span>
              </div>
            )}
          {selected.ts > 0 && (
            <div className="kv">
              <b>first seen</b>
              <span>{new Date(selected.ts).toISOString().slice(0, 16)}Z</span>
            </div>
          )}
          {selected.ip && intel?.ip === selected.ip && (
            <div style={{ marginTop: 6 }}>
              {intel.loading && (
                <div className="net-empty">
                  <span className="net-spin" /> querying GreyNoise + Shodan…
                </div>
              )}
              {intel.data?.greynoise && (
                <div className="kv">
                  <b>greynoise</b>
                  <span>
                    {intel.data.greynoise.noise === true ? 'noise' : 'quiet'}
                    {intel.data.greynoise.riot === true ? ' · riot' : ''}
                    {intel.data.greynoise.classification
                      ? ` · ${intel.data.greynoise.classification}`
                      : ''}
                  </span>
                </div>
              )}
              {intel.data?.shodan && (
                <>
                  {(intel.data.shodan.ports?.length ?? 0) > 0 && (
                    <div className="kv">
                      <b>open ports</b>
                      <span>{intel.data.shodan.ports!.join(', ')}</span>
                    </div>
                  )}
                  {(intel.data.shodan.vulns?.length ?? 0) > 0 && (
                    <div className="kv">
                      <b>cves</b>
                      <span style={{ color: 'hsl(0 92% 64%)' }}>
                        {intel.data.shodan.vulns!.slice(0, 3).join(', ')}
                        {intel.data.shodan.vulns!.length > 3 ? '…' : ''}
                      </span>
                    </div>
                  )}
                  {intel.data.shodan.org && (
                    <div className="kv">
                      <b>org</b>
                      <span>{intel.data.shodan.org}</span>
                    </div>
                  )}
                </>
              )}
              {!intel.loading &&
                !intel.data?.greynoise &&
                !intel.data?.shodan && (
                  <div className="net-empty">no intel for this IP</div>
                )}
            </div>
          )}
        </div>
      )}
    </>
  );
}
