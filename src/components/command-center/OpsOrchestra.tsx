'use client';

import { useCallback, useMemo, useState } from 'react';
import { Bot, Crosshair, Radio, ShieldAlert, Sparkles, Timer } from 'lucide-react';
import {
  useHorusStream,
  type AgentReport,
  type StreamAgent,
} from '@/hooks/useHorusStream';

/* ------------------------------------------------------------------ */
/* OPS ORCHESTRA — orchestration des agents sur la carte (live).       */
/* Roster temps réel + briefings BLUF + corrélation multi-domaines     */
/* (echo/domino) + cue opérateur au centre carte.                      */
/* ------------------------------------------------------------------ */

const STATE_COLOR: Record<StreamAgent['state'], string> = {
  PATROL: '#35e0ff',
  INVESTIGATE: '#ffb84d',
  REPORT: '#4dffb0',
  ESCALATE: '#ff4d5e',
};

const LADDER_COLOR: Record<AgentReport['ladder'], string> = {
  P1: '#ff4d5e', P2: '#ffb84d', P3: '#35e0ff', P4: '#7fa8bd',
};

function ago(ts: number): string {
  const s = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}min`;
  return `${Math.floor(m / 60)}h`;
}

export default function OpsOrchestra() {
  const { connected, agents, reports, log, echoes, chains, space, net, cue, order } =
    useHorusStream();
  const [cueBusy, setCueBusy] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const counts = useMemo(() => {
    const c = { PATROL: 0, INVESTIGATE: 0, REPORT: 0, ESCALATE: 0 } as Record<StreamAgent['state'], number>;
    for (const a of agents) c[a.state]++;
    return c;
  }, [agents]);

  const cueCenter = useCallback(() => {
    const getCenter = (window as any).__osirisMapGetCenter;
    const c = typeof getCenter === 'function' ? getCenter() : null;
    const lat = Array.isArray(c) ? Number(c[1]) : 0;
    const lng = Array.isArray(c) ? Number(c[0]) : 0;
    let operator = 'console';
    try { operator = sessionStorage.getItem('horus-operator') || 'console'; } catch {}
    setCueBusy(true);
    cue(lat, lng, operator, `Cue carte @ ${lat.toFixed(1)}, ${lng.toFixed(1)}`);
    setTimeout(() => setCueBusy(false), 1200);
  }, [cue]);

  return (
    <div className="flex flex-col gap-3 text-[10px]" style={{ fontFamily: 'var(--font-geist-mono), ui-monospace, monospace' }}>
      {/* ---- header ---- */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Radio
            className="w-3 h-3"
            style={{ color: connected ? '#4dffb0' : '#ff7b7b' }}
          />
          <span style={{ color: connected ? '#4dffb0' : '#ff7b7b', letterSpacing: '0.18em' }}>
            {connected ? 'FLUX LIVE' : 'HORS LIGNE'}
          </span>
          <span style={{ color: 'var(--txt-dim, #7fa8bd)' }}>
            {agents.length} AGENTS
          </span>
        </div>
        <button
          onClick={cueCenter}
          disabled={cueBusy || !connected}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-all"
          style={{
            background: 'rgba(53,224,255,0.12)',
            border: '1px solid rgba(53,224,255,0.45)',
            color: '#9ceaff',
            opacity: cueBusy || !connected ? 0.5 : 1,
          }}
          title="Déployer l'agent sentinelle sur le centre actuel de la carte"
        >
          <Crosshair className="w-3 h-3" />
          CUE CENTRE CARTE
        </button>
      </div>

      {/* ---- state histogram ---- */}
      <div className="grid grid-cols-4 gap-1.5">
        {(Object.keys(STATE_COLOR) as StreamAgent['state'][]).map((s) => (
          <div
            key={s}
            className="rounded-md px-2 py-1.5 text-center"
            style={{ background: 'rgba(8,14,22,0.6)', border: `1px solid ${STATE_COLOR[s]}33` }}
          >
            <div style={{ color: STATE_COLOR[s], fontSize: 13, fontWeight: 700 }}>{counts[s]}</div>
            <div style={{ color: 'var(--txt-dim, #7fa8bd)', fontSize: 8, letterSpacing: '0.12em' }}>{s}</div>
          </div>
        ))}
      </div>

      {/* ---- roster ---- */}
      <div className="flex flex-col gap-1 max-h-[220px] overflow-y-auto pr-1">
        {agents.map((a) => (
          <div
            key={a.id}
            className="rounded-md px-2 py-1.5 flex items-center gap-2"
            style={{
              background:
                a.state === 'ESCALATE'
                  ? 'rgba(255,77,94,0.10)'
                  : a.state === 'INVESTIGATE'
                  ? 'rgba(255,184,77,0.08)'
                  : 'rgba(8,14,22,0.5)',
              border: `1px solid ${STATE_COLOR[a.state]}2e`,
            }}
            title={`${a.task} · cellule ${a.sector} · ${a.actions} actions`}
          >
            <span
              className="flex-shrink-0 rounded-full"
              style={{
                width: 7, height: 7, background: STATE_COLOR[a.state],
                boxShadow: `0 0 6px ${STATE_COLOR[a.state]}`,
                animation: a.state === 'INVESTIGATE' || a.state === 'ESCALATE'
                  ? 'aescert-breathe 1.2s ease-in-out infinite' : undefined,
              }}
            />
            <span style={{ color: '#d8f3ff', minWidth: 62, fontWeight: 700 }}>{a.callsign}</span>
            <span
              style={{
                color: STATE_COLOR[a.state], fontSize: 8.5, letterSpacing: '0.1em',
                minWidth: 74, flexShrink: 0,
              }}
            >
              {a.state}
            </span>
            <span
              style={{ color: 'var(--txt-dim, #7fa8bd)', fontSize: 8.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
            >
              {a.task}
            </span>
            <span style={{ marginLeft: 'auto', color: 'var(--txt-dim, #7fa8bd)', fontSize: 8, flexShrink: 0 }}>
              {a.role === 'SECTOR' ? a.sector : a.role}
            </span>
          </div>
        ))}
        {agents.length === 0 && (
          <div style={{ color: 'var(--txt-dim, #7fa8bd)' }} className="py-3 text-center">
            connexion à l&apos;orchestre…
          </div>
        )}
      </div>

      {/* ---- space / net weather strip ---- */}
      <div className="grid grid-cols-2 gap-1.5">
        <div
          className="rounded-md px-2 py-1.5 flex items-center gap-2"
          style={{
            background: 'rgba(8,14,22,0.5)',
            border: `1px solid ${space?.storm ? '#ff4d5e55' : 'rgba(140,220,255,0.14)'}`,
          }}
        >
          <Sparkles
            className="w-3 h-3 flex-shrink-0"
            style={{ color: space?.storm ? '#ff4d5e' : '#35e0ff' }}
          />
          <div className="overflow-hidden">
            <div style={{ color: '#d8f3ff' }}>
              Kp {space?.kp != null ? space.kp.toFixed(1) : '—'}
              {space?.storm ? ' · ORAGE G' : ''}
            </div>
            <div style={{ color: 'var(--txt-dim, #7fa8bd)', fontSize: 8 }}>
              NOAA SWPC · {space?.alerts?.length ?? 0} alertes
            </div>
          </div>
        </div>
        <div
          className="rounded-md px-2 py-1.5 flex items-center gap-2"
          style={{ background: 'rgba(8,14,22,0.5)', border: '1px solid rgba(140,220,255,0.14)' }}
        >
          <ShieldAlert className="w-3 h-3 flex-shrink-0" style={{ color: '#35e0ff' }} />
          <div className="overflow-hidden">
            <div style={{ color: '#d8f3ff' }}>{net?.count ?? 0} alertes IODA</div>
            <div style={{ color: 'var(--txt-dim, #7fa8bd)', fontSize: 8 }}>
              pannes / anomalies BGP · 3 h
            </div>
          </div>
        </div>
      </div>

      {/* ---- echo / domino correlation ---- */}
      <div>
        <div className="flex items-center gap-1.5 mb-1">
          <Bot className="w-3 h-3" style={{ color: '#cc66ff' }} />
          <span style={{ color: '#cc66ff', letterSpacing: '0.18em' }}>
            CORRÉLATION MULTI-DOMAINES
          </span>
          <span style={{ color: 'var(--txt-dim, #7fa8bd)' }}>
            {echoes.length} échos · {chains.length} chaînes
          </span>
        </div>
        <div className="flex flex-col gap-1 max-h-[150px] overflow-y-auto pr-1">
          {chains.map((c) => (
            <div
              key={c.id}
              className="rounded-md px-2 py-1.5"
              style={{ background: 'rgba(204,102,255,0.06)', border: '1px solid rgba(204,102,255,0.25)' }}
            >
              <div className="flex items-center gap-1.5">
                <span style={{ color: '#cc66ff', fontSize: 8.5, letterSpacing: '0.1em' }}>
                  {c.kind}
                </span>
                <span style={{ color: 'var(--txt-dim, #7fa8bd)', fontSize: 8 }}>
                  {c.confidence} · {ago(c.ts)}
                </span>
              </div>
              <div style={{ color: '#d8f3ff', fontSize: 9.5, marginTop: 2 }}>
                {c.from.label} <span style={{ color: '#cc66ff' }}>⟶</span> {c.to.label}
              </div>
            </div>
          ))}
          {echoes.slice(0, 6).map((e) => (
            <div
              key={e.id}
              className="rounded-md px-2 py-1.5"
              style={{ background: 'rgba(53,224,255,0.05)', border: '1px solid rgba(53,224,255,0.2)' }}
            >
              <div className="flex items-center gap-1.5">
                <span style={{ color: '#35e0ff', fontSize: 8.5, letterSpacing: '0.1em' }}>
                  ECHO · score {e.score}
                </span>
                <span style={{ color: 'var(--txt-dim, #7fa8bd)', fontSize: 8 }}>{ago(e.ts)}</span>
              </div>
              <div style={{ color: '#d8f3ff', fontSize: 9.5, marginTop: 2 }}>
                {e.members.map((m) => m.label).slice(0, 2).join(' ↔ ')}
              </div>
            </div>
          ))}
          {echoes.length === 0 && chains.length === 0 && (
            <div style={{ color: 'var(--txt-dim, #7fa8bd)' }} className="py-2 text-center">
              aucune corroboration inter-flux sur la fenêtre courante
            </div>
          )}
        </div>
      </div>

      {/* ---- BLUF reports ---- */}
      <div>
        <div className="flex items-center gap-1.5 mb-1">
          <Timer className="w-3 h-3" style={{ color: '#4dffb0' }} />
          <span style={{ color: '#4dffb0', letterSpacing: '0.18em' }}>BRIEFINGS BLUF</span>
          <span style={{ color: 'var(--txt-dim, #7fa8bd)' }}>{reports.length}</span>
        </div>
        <div className="flex flex-col gap-1 max-h-[240px] overflow-y-auto pr-1">
          {reports.map((r) => (
            <div
              key={r.id}
              className="rounded-md px-2 py-1.5 cursor-pointer"
              onClick={() => setExpanded(expanded === r.id ? null : r.id)}
              style={{
                background: r.ladder === 'P1' ? 'rgba(255,77,94,0.08)' : 'rgba(8,14,22,0.5)',
                border: `1px solid ${LADDER_COLOR[r.ladder]}30`,
              }}
            >
              <div className="flex items-center gap-1.5">
                <span
                  className="rounded px-1"
                  style={{ background: `${LADDER_COLOR[r.ladder]}22`, color: LADDER_COLOR[r.ladder], fontSize: 8 }}
                >
                  {r.ladder}
                </span>
                <span style={{ color: '#d8f3ff', fontWeight: 700 }}>{r.agent}</span>
                <span style={{ color: 'var(--txt-dim, #7fa8bd)', fontSize: 8 }}>
                  {r.confidence} · {ago(r.ts)}
                </span>
              </div>
              <div style={{ color: '#bcd9e8', fontSize: 9, marginTop: 2, lineHeight: 1.45 }}>
                {expanded === r.id ? (
                  <>
                    <div>{r.bluf}</div>
                    <ul className="mt-1 pl-3">
                      {r.details.map((d, i) => (
                        <li key={i} style={{ color: 'var(--txt-dim, #7fa8bd)' }}>{d}</li>
                      ))}
                    </ul>
                    <div className="mt-1" style={{ color: 'var(--txt-dim, #7fa8bd)', fontSize: 8 }}>
                      sources : {r.sources.join(' · ')}
                    </div>
                  </>
                ) : (
                  r.bluf
                )}
              </div>
              <div className="flex gap-1.5 mt-1">
                <button
                  className="rounded px-1.5 py-0.5"
                  style={{ background: 'rgba(53,224,255,0.1)', color: '#9ceaff', fontSize: 8, border: '1px solid rgba(53,224,255,0.3)' }}
                  onClick={(ev) => {
                    ev.stopPropagation();
                    const fly = (window as any).__osirisMapFlyTo;
                    if (fly) fly(r.lat, r.lng, 6);
                  }}
                >
                  VOIR SUR CARTE
                </button>
                <button
                  className="rounded px-1.5 py-0.5"
                  style={{ background: 'rgba(140,220,255,0.06)', color: '#7fa8bd', fontSize: 8, border: '1px solid rgba(140,220,255,0.2)' }}
                  onClick={(ev) => {
                    ev.stopPropagation();
                    order(r.agent, 'Reprise de patrouille · ordre opérateur');
                  }}
                >
                  RAPPEL À LA PATROUILLE
                </button>
              </div>
            </div>
          ))}
          {reports.length === 0 && (
            <div style={{ color: 'var(--txt-dim, #7fa8bd)' }} className="py-2 text-center">
              aucun briefing — les agents patrouillent (les déclencheurs arrivent des flux réels)
            </div>
          )}
        </div>
      </div>

      {/* ---- audit tail ---- */}
      <div className="rounded-md px-2 py-1.5" style={{ background: 'rgba(8,14,22,0.5)', border: '1px solid rgba(140,220,255,0.12)' }}>
        <div style={{ color: 'var(--txt-dim, #7fa8bd)', letterSpacing: '0.16em', marginBottom: 3 }}>
          PISTE D&apos;AUDIT (append-only)
        </div>
        <div className="flex flex-col gap-0.5 max-h-[110px] overflow-y-auto">
          {log.slice(0, 12).map((l, i) => (
            <div key={`${l.ts}-${i}`} style={{ color: 'var(--txt-dim, #7fa8bd)', fontSize: 8.2 }}>
              <span style={{ color: '#35e0ff' }}>{new Date(l.ts).toLocaleTimeString()}</span>{' '}
              {l.agent} {l.from !== l.to ? `${l.from}→${l.to}` : l.to}{' '}
              <span style={{ color: 'rgba(216,243,255,0.75)' }}>{l.detail}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
