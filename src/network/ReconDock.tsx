

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import ReconPanel from '@/components/command-center/ReconPanel';
import { KIND_COLOR, type ThreatEvent, type ThreatKind } from './types';

type Mode = 'ciblage' | 'darkweb' | 'phishing';
type PhishTab = 'url' | 'email';

interface DarkStats { groups: number; victims7d: number; onionsUp: number; onionsTotal: number }
interface DarkGroup {
  name: string; altname: string; description: string; added: string;
  victims30: number; onionsUp: number; onionsTotal: number;
}
interface GroupFiche {
  name: string; altname: string; description: string; added: string;
  onions: { host: string; type: string; title: string; available: boolean; enabled: boolean }[];
  tools: string[];
  ttps: { tactic: string; techniques: string[] }[];
}
interface Victim {
  title: string; country: string; sector: string; description: string;
  published: string; data_size: string; ransom: string;
}
interface UrlCheck {
  host: string; domain: string; ip: string | null;
  heuristics: { score: number; verdict: string; reasons: { label: string; level: string }[] };
  dns: { a: string[]; mx: string[] };
  urlscan: { ok: boolean; total: number; scans: { url: string; title: string; country: string; ip: string; when: string }[] };
  error?: string;
}
interface EmailCheck {
  headers: { from: string; replyTo: string; returnPath: string; subject: string };
  fromDomain: string;
  urls: string[]; hosts: string[]; ips: string[]; attachments: string[]; keywords: string[];
  mx: Record<string, string[]>;
  heuristics: { score: number; verdict: string; reasons: { label: string; level: string }[] };
  error?: string;
}

function correlate(
  events: ThreatEvent[],
  key: { host?: string; ip?: string }
): ThreatEvent[] {
  const host = key.host?.toLowerCase() ?? '';
  const ip = key.ip ?? '';
  if (!host && !ip) return [];
  return events
    .filter((e) => {
      if (ip && e.ip === ip) return true;
      const eh = e.host?.toLowerCase();
      if (host && eh) {
        if (eh === host || eh.endsWith(`.${host}`)) return true;
        if (host.length >= 7 && eh.includes(host)) return true;
      }
      return false;
    })
    .slice(0, 8);
}

const verdictColor = (v: string) =>
  v.includes('PROBABLE') || v === 'SUSPECT' ? '#ff6b6b' : v === 'PRUDENCE' ? '#ffb454' : '#4dffb0';

const LevelDot = ({ level }: { level: string }) => (
  <span
    className="rd-dot"
    style={{ background: level === 'high' ? '#ff6b6b' : level === 'medium' ? '#ffb454' : '#8899aa' }}
  />
);

function FeedHits({ events, host, ip }: { events: ThreatEvent[]; host?: string; ip?: string }) {
  const hits = correlate(events, { host, ip });
  if (!host && !ip) return null;
  return (
    <div className="rd-block">
      <div className="rd-block__title">CORRÉLATION FLUX LIVE · {hits.length} ÉVÉNEMENT(S)</div>
      {hits.length === 0 && (
        <div className="rd-empty">aucune correspondance dans les sources live (OpenPhish · URLhaus · Feodo · ThreatFox…)</div>
      )}
      {hits.map((e) => (
        <div key={e.id} className="rd-hit">
          <span
            className="rd-hit__kind"
            style={{ color: KIND_COLOR[e.kind as ThreatKind] ?? '#35e0ff' }}
          >
            {e.kind}
          </span>
          <span className="rd-hit__host">{e.host ?? e.ip}</span>
          <span className="rd-hit__src">{e.source.split(' ')[0]}</span>
          <span className="rd-hit__sev">sev {e.severity}</span>
        </div>
      ))}
    </div>
  );
}

export default function ReconDock({
  open,
  onClose,
  events,
  mode,
  setMode,
  focusGroup,
  setFocusGroup,
}: {
  open: boolean;
  onClose: () => void;
  events: ThreatEvent[];
  mode: Mode;
  setMode: (m: Mode) => void;
  focusGroup: string | null;
  setFocusGroup: (g: string | null) => void;
}) {
  const [phishTab, setPhishTab] = useState<PhishTab>('url');

  return (
    <aside className={`net-recon glass ${open ? 'is-open' : ''}`} data-tour="net-recon" aria-hidden={!open}>
      <header className="net-recon__head">
        <span className="panel__dot" />
        <h3 className="panel__title">RECON · TOOLKIT</h3>
        <span className="rd-count">{events.length} evt live</span>
        <button className="rd-x" onClick={onClose} title="Fermer (Échap)">✕</button>
      </header>

      <div className="rd-modes">
        {(['ciblage', 'darkweb', 'phishing'] as Mode[]).map((m) => (
          <button
            key={m}
            className={`rd-mode ${mode === m ? 'is-on' : ''}`}
            onClick={() => { setMode(m); setFocusGroup(null); }}
          >
            {m === 'ciblage' ? 'CIBLAGE' : m === 'darkweb' ? 'DARK WEB' : 'PHISHING'}
          </button>
        ))}
      </div>

      <div className="net-recon__body">
        {mode === 'ciblage' && <ReconPanel />}

        {mode === 'darkweb' && (
          <DarkWebPane
            events={events}
            focusGroup={focusGroup}
            setFocusGroup={setFocusGroup}
          />
        )}

        {mode === 'phishing' && (
          <div className="rd-pane">
            <div className="rd-subtabs">
              <button
                className={`rd-mode ${phishTab === 'url' ? 'is-on' : ''}`}
                onClick={() => setPhishTab('url')}
              >
                ANALYSE URL
              </button>
              <button
                className={`rd-mode ${phishTab === 'email' ? 'is-on' : ''}`}
                onClick={() => setPhishTab('email')}
              >
                ANALYSE EMAIL
              </button>
            </div>
            {phishTab === 'url' ? <UrlPane events={events} /> : <EmailPane events={events} />}
          </div>
        )}
      </div>
    </aside>
  );
}


function DarkWebPane({
  events,
  focusGroup,
  setFocusGroup,
}: {
  events: ThreatEvent[];
  focusGroup: string | null;
  setFocusGroup: (g: string | null) => void;
}) {
  const seq = useRef(0);
  const nextSeq = () => ++seq.current;
  const [stats, setStats] = useState<DarkStats | null>(null);
  const [top, setTop] = useState<DarkGroup[]>([]);
  const [sectors, setSectors] = useState<{ key: string; count: number }[]>([]);
  const [countries, setCountries] = useState<{ key: string; count: number }[]>([]);
  const [q, setQ] = useState('');
  const [results, setResults] = useState<DarkGroup[] | null>(null);
  const [fiche, setFiche] = useState<{ group: GroupFiche; victims: Victim[] } | null>(null);
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    const s = nextSeq();
    fetch('/api/network/darkweb')
      .then((r) => r.json())
      .then((d) => {
        if (s !== seq.current) return;
        if (d.stats) setStats(d.stats);
        setTop(d.topGroups ?? []);
        setSectors(d.topSectors ?? []);
        setCountries(d.topCountries ?? []);
      })
      .catch(() => {})
      .finally(() => { if (s === seq.current) setBusy(false); });
  }, []);

  useEffect(() => {
    if (!focusGroup) return;
    const s = nextSeq();
    fetch(`/api/network/darkweb?mode=group&name=${encodeURIComponent(focusGroup)}`)
      .then((r) => r.json())
      .then((d) => {
        if (s !== seq.current) return;
        if (!d.error) setFiche({ group: d.group, victims: d.victims });
      })
      .catch(() => {})
      .finally(() => { if (s === seq.current) setBusy(false); });
  }, [focusGroup]);

  const search = useCallback(
    (query: string) => {
      const s = nextSeq();
      if (query.trim().length < 2) { setResults(null); return; }
      setBusy(true);
      fetch(`/api/network/darkweb?mode=search&q=${encodeURIComponent(query.trim())}`)
        .then((r) => r.json())
        .then((d) => { if (s === seq.current) setResults(d.groups ?? []); })
        .catch(() => {})
        .finally(() => { if (s === seq.current) setBusy(false); });
    },
     
    []
  );

  const openGroup = (name: string) => {
    setBusy(true);
    setFocusGroup(name);
    setResults(null);
  };

  if (fiche) {
    const g = fiche.group;
    return (
      <div className="rd-pane">
        <button className="rd-back" onClick={() => { setFiche(null); setFocusGroup(null); }}>
          ← retour groupes
        </button>
        <div className="rd-fiche__head">
          <span className="rd-fiche__name">{g.name}</span>
          {g.altname && <span className="rd-fiche__alt">{g.altname}</span>}
          <span className="rd-fiche__chip">{fiche.victims.length} victimes suivies</span>
        </div>
        {g.description && <p className="rd-desc">{g.description}</p>}

        <div className="rd-block">
          <div className="rd-block__title">SITES .ONION DE FUITE · {g.onions.filter((o) => o.available).length}/{g.onions.length} EN LIGNE</div>
          {g.onions.length === 0 && <div className="rd-empty">aucune adresse .onion connue</div>}
          {g.onions.map((o) => (
            <div key={o.host} className="rd-onion">
              <span className={`rd-onion__st ${o.available ? 'up' : 'down'}`}>{o.available ? 'UP' : 'DOWN'}</span>
              <span className="rd-onion__host" title={o.host}>{o.host}</span>
              {o.type && <span className="rd-onion__type">{o.type}</span>}
            </div>
          ))}
          <div className="rd-note">adresses exposées à titre documentaire · aucun .onion n&apos;est contacté</div>
        </div>

        {g.ttps.length > 0 && (
          <div className="rd-block">
            <div className="rd-block__title">TTPs MITRE ATT&amp;CK</div>
            {g.ttps.map((t) => (
              <div key={t.tactic} className="rd-ttp">
                <span className="rd-ttp__tactic">{t.tactic}</span>
                <span className="rd-ttp__techs">{t.techniques.join(' · ')}</span>
              </div>
            ))}
          </div>
        )}

        {g.tools.length > 0 && (
          <div className="rd-block">
            <div className="rd-block__title">OUTILS ASSOCIÉS</div>
            <div className="rd-chips">{g.tools.map((t) => <span key={t} className="rd-chip">{t}</span>)}</div>
          </div>
        )}

        {fiche.victims.length > 0 && (
          <div className="rd-block">
            <div className="rd-block__title">VICTIMES RÉCENTES</div>
            {fiche.victims.map((v, i) => (
              <div key={i} className="rd-victim">
                <span className="rd-victim__title">{v.title}</span>
                <span className="rd-victim__meta">{v.country}{v.sector ? ` · ${v.sector}` : ''}</span>
              </div>
            ))}
          </div>
        )}

        <FeedHits events={events} host={undefined} ip={undefined} />
      </div>
    );
  }

  return (
    <div className="rd-pane">
      {stats && (
        <div className="rd-stats">
          <div className="rd-stat"><b>{stats.groups}</b><span>groupes</span></div>
          <div className="rd-stat"><b>{stats.onionsUp}</b><span>onions up</span></div>
          <div className="rd-stat"><b>{stats.victims7d}</b><span>victimes 7j</span></div>
        </div>
      )}

      <div className="rd-searchrow">
        <input
          className="rd-input"
          placeholder="nom de groupe, alias ou .onion…"
          value={q}
          onChange={(e) => { setQ(e.target.value); search(e.target.value); }}
          onKeyDown={(e) => { if (e.key === 'Enter') search(q); }}
        />
        {busy && <span className="net-spin rd-spin" />}
      </div>

      {(results ?? top).length > 0 && (
        <div className="rd-block">
          <div className="rd-block__title">{results ? `${results.length} RÉSULTAT(S)` : 'GROUPES LES PLUS ACTIFS · 30 J'}</div>
          {(results ?? top).map((g) => (
            <button key={g.name} className="rd-group" onClick={() => openGroup(g.name)} title={g.description}>
              <span className="rd-group__name">{g.name}</span>
              {g.altname && <span className="rd-group__alt">{g.altname}</span>}
              <span className="rd-group__vic">{g.victims30} vict. 30j</span>
              <span className={`rd-group__on ${(g.onionsUp > 0) ? 'up' : ''}`}>
                {g.onionsUp}/{g.onionsTotal} onion
              </span>
            </button>
          ))}
        </div>
      )}

      {!results && sectors.length > 0 && (
        <div className="rd-block">
          <div className="rd-block__title">TENDANCES · SECTEURS VISÉS</div>
          {sectors.map((s) => (
            <div key={s.key} className="rd-bar">
              <span className="rd-bar__label">{s.key}</span>
              <span className="rd-bar__track"><span className="rd-bar__fill" style={{ width: `${Math.min(100, s.count * 8)}%` }} /></span>
              <span className="rd-bar__n">{s.count}</span>
            </div>
          ))}
        </div>
      )}
      {!results && countries.length > 0 && (
        <div className="rd-block">
          <div className="rd-block__title">TENDANCES · PAYS TOUCHÉS</div>
          {countries.map((s) => (
            <div key={s.key} className="rd-bar">
              <span className="rd-bar__label">{s.key}</span>
              <span className="rd-bar__track"><span className="rd-bar__fill rd-bar__fill--b" style={{ width: `${Math.min(100, s.count * 4)}%` }} /></span>
              <span className="rd-bar__n">{s.count}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


function UrlPane({ events }: { events: ThreatEvent[] }) {
  const [target, setTarget] = useState('');
  const [res, setRes] = useState<UrlCheck | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const run = () => {
    if (!target.trim() || busy) return;
    setBusy(true); setErr(null); setRes(null);
    fetch(`/api/network/urlcheck?url=${encodeURIComponent(target.trim())}`)
      .then((r) => r.json())
      .then((d) => { if (d.error) { setErr(d.error); } else { setRes(d); } })
      .catch((e) => setErr(String(e)))
      .finally(() => setBusy(false));
  };

  return (
    <div className="rd-pane">
      <div className="rd-searchrow">
        <input
          className="rd-input"
          placeholder="https://site-suspect.xyz/verification"
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') run(); }}
        />
        <button className="rd-run" onClick={run} disabled={busy || !target.trim()}>
          {busy ? '…' : 'ANALYSER'}
        </button>
      </div>
      {err && <div className="rd-err">{err}</div>}

      {res && (
        <>
          <div className="rd-verdict" style={{ borderColor: verdictColor(res.heuristics.verdict) }}>
            <span className="rd-verdict__score" style={{ color: verdictColor(res.heuristics.verdict) }}>
              {res.heuristics.score}
            </span>
            <div>
              <div className="rd-verdict__label" style={{ color: verdictColor(res.heuristics.verdict) }}>
                {res.heuristics.verdict}
              </div>
              <div className="rd-verdict__host">{res.host}{res.ip ? ` · ${res.ip}` : ''}</div>
            </div>
          </div>

          <div className="rd-block">
            <div className="rd-block__title">RAISONS · {res.heuristics.reasons.length}</div>
            {res.heuristics.reasons.length === 0 && <div className="rd-empty">aucun signal d&apos;alarme heuristique</div>}
            {res.heuristics.reasons.map((r, i) => (
              <div key={i} className="rd-reason"><LevelDot level={r.level} /><span>{r.label}</span></div>
            ))}
          </div>

          {res.dns.a.length > 0 && (
            <div className="rd-block">
              <div className="rd-block__title">DNS</div>
              <div className="rd-kv"><span>A</span><span>{res.dns.a.join(' · ')}</span></div>
              {res.dns.mx.length > 0 && <div className="rd-kv"><span>MX</span><span>{res.dns.mx.join(' · ')}</span></div>}
            </div>
          )}

          {res.urlscan.ok && (
            <div className="rd-block">
              <div className="rd-block__title">URLSCAN.IO · {res.urlscan.total} SCANS COMMUNAUTAIRES</div>
              {res.urlscan.scans.map((s, i) => (
                <div key={i} className="rd-hit">
                  <span className="rd-hit__kind" style={{ color: '#8899aa' }}>{s.country || '??'}</span>
                  <span className="rd-hit__host" title={s.url}>{s.title || s.url}</span>
                  <span className="rd-hit__src">{String(s.when).slice(0, 10)}</span>
                </div>
              ))}
            </div>
          )}

          <FeedHits events={events} host={res.host} ip={res.ip ?? undefined} />
        </>
      )}
      {!res && !busy && !err && (
        <div className="rd-empty rd-empty--pad">
          collez une URL suspecte : heuristiques locales, DNS, scans urlscan
          existants et corrélation avec le flux live
        </div>
      )}
    </div>
  );
}


function EmailPane({ events }: { events: ThreatEvent[] }) {
  const [raw, setRaw] = useState('');
  const [res, setRes] = useState<EmailCheck | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const run = () => {
    if (raw.trim().length < 8 || busy) return;
    setBusy(true); setErr(null); setRes(null);
    fetch('/api/network/emailcheck', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ raw }),
    })
      .then((r) => r.json())
      .then((d) => { if (d.error) { setErr(d.error); } else { setRes(d); } })
      .catch((e) => setErr(String(e)))
      .finally(() => setBusy(false));
  };

  return (
    <div className="rd-pane">
      <textarea
        className="rd-textarea"
        placeholder={'collez l\'email brut (en-têtes + corps) :\n\nFrom: service@banque-verification.xyz\nSubject: URGENT …\n\nhttp://…'}
        value={raw}
        onChange={(e) => setRaw(e.target.value)}
        rows={7}
      />
      <div className="rd-searchrow" style={{ marginTop: 6 }}>
        <button className="rd-run" onClick={run} disabled={busy || raw.trim().length < 8} style={{ width: '100%' }}>
          {busy ? 'ANALYSE…' : 'ANALYSER L\'EMAIL'}
        </button>
      </div>
      {err && <div className="rd-err">{err}</div>}

      {res && (
        <>
          <div className="rd-verdict" style={{ borderColor: verdictColor(res.heuristics.verdict) }}>
            <span className="rd-verdict__score" style={{ color: verdictColor(res.heuristics.verdict) }}>
              {res.heuristics.score}
            </span>
            <div>
              <div className="rd-verdict__label" style={{ color: verdictColor(res.heuristics.verdict) }}>
                {res.heuristics.verdict}
              </div>
              <div className="rd-verdict__host">{res.fromDomain || 'domaine non extrait'}</div>
            </div>
          </div>

          {(res.headers.from || res.headers.subject) && (
            <div className="rd-block">
              <div className="rd-block__title">EN-TÊTES EXTRAITS</div>
              {res.headers.from && <div className="rd-kv"><span>From</span><span>{res.headers.from}</span></div>}
              {res.headers.replyTo && <div className="rd-kv"><span>Reply-To</span><span>{res.headers.replyTo}</span></div>}
              {res.headers.subject && <div className="rd-kv"><span>Objet</span><span>{res.headers.subject.slice(0, 60)}</span></div>}
            </div>
          )}

          <div className="rd-block">
            <div className="rd-block__title">SIGNAUX · {res.heuristics.reasons.length}</div>
            {res.heuristics.reasons.length === 0 && <div className="rd-empty">aucun signal d&apos;alarme heuristique</div>}
            {res.heuristics.reasons.map((r, i) => (
              <div key={i} className="rd-reason"><LevelDot level={r.level} /><span>{r.label}</span></div>
            ))}
          </div>

          {res.urls.length > 0 && (
            <div className="rd-block">
              <div className="rd-block__title">URLS DU CORPS · {res.urls.length}</div>
              {res.urls.slice(0, 8).map((u) => (
                <div key={u} className="rd-hit"><span className="rd-hit__host" title={u}>{u}</span></div>
              ))}
            </div>
          )}

          {res.attachments.length > 0 && (
            <div className="rd-block">
              <div className="rd-block__title">PIÈCES DÉTECTÉES</div>
              <div className="rd-chips">{res.attachments.map((a) => <span key={a} className="rd-chip rd-chip--warn">{a}</span>)}</div>
            </div>
          )}

          {res.hosts.length > 0 && <FeedHits events={events} host={res.hosts[0]} />}
        </>
      )}
      {!res && !busy && !err && (
        <div className="rd-empty rd-empty--pad">
          extraction des en-têtes, URLs, pièces jointes et domaines · MX ·
          corrélés au flux live · l&apos;email reste sur le serveur (aucun
          service tiers)
        </div>
      )}
    </div>
  );
}
