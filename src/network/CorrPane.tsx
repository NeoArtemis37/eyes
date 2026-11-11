'use client';

import { useMemo } from 'react';
import { Bot, Radio, ShieldAlert, Sparkles } from 'lucide-react';
import { useHorusStream } from '@/hooks/useHorusStream';

/* ------------------------------------------------------------------ */
/* CORR PANE — vue "CORRÉLATION" de la grille réseau :                 */
/*   · échos multi-flux (corroboration spatio-temporelle)              */
/*   · chaînes dominos (séisme→réseau, espace→réseau)                  */
/*   · météo spatiale (NOAA SWPC) + météo Internet (IODA)              */
/*   · roster compact de l'orchestre d'agents                          */
/* ------------------------------------------------------------------ */

const STATE_COLOR: Record<string, string> = {
  PATROL: '#35e0ff', INVESTIGATE: '#ffb84d', REPORT: '#4dffb0', ESCALATE: '#ff4d5e',
};

function ago(ts: number): string {
  const s = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}min`;
  return `${Math.floor(m / 60)}h`;
}

export default function CorrPane() {
  const { connected, agents, reports, echoes, chains, space, net } = useHorusStream();

  const investigating = useMemo(
    () => agents.filter((a) => a.state !== 'PATROL'),
    [agents]
  );

  return (
    <div className="net-map corr-pane">
      <div className="corr-grid">
        {/* -- colonne gauche : corrélation -- */}
        <div className="corr-col">
          <div className="corr-head">
            <Radio className="w-3 h-3" style={{ color: connected ? '#4dffb0' : '#ff7b7b' }} />
            <span>CORRÉLATION MULTI-DOMAINES · {connected ? 'LIVE' : 'HORS LIGNE'}</span>
          </div>

          <div className="corr-sec">
            <div className="corr-title" style={{ color: '#cc66ff' }}>
              CHAÎNES DOMINO · causalité suspectée
            </div>
            {chains.map((c) => (
              <div key={c.id} className="corr-card" style={{ borderColor: 'rgba(204,102,255,0.3)' }}>
                <div className="corr-card-top">
                  <span style={{ color: '#cc66ff' }}>{c.kind}</span>
                  <span style={{ color: 'var(--txt-dim)' }}>{c.confidence} · {ago(c.ts)}</span>
                </div>
                <div className="corr-card-body">
                  {c.from.label} <span style={{ color: '#cc66ff' }}>⟶</span> {c.to.label}
                </div>
                <div className="corr-card-dim">
                  {c.from.source} · {c.to.source} · Δt {ago(c.from.ts)}
                </div>
              </div>
            ))}
            {chains.length === 0 && (
              <div className="corr-empty">aucune chaîne sur la fenêtre 6 h — le moteur scrute les flux</div>
            )}
          </div>

          <div className="corr-sec">
            <div className="corr-title" style={{ color: '#35e0ff' }}>
              ÉCHOS · corroboration inter-flux (≤500 km / 45 min)
            </div>
            {echoes.slice(0, 8).map((e) => (
              <div key={e.id} className="corr-card" style={{ borderColor: 'rgba(53,224,255,0.25)' }}>
                <div className="corr-card-top">
                  <span style={{ color: '#35e0ff' }}>ECHO score {e.score}</span>
                  <span style={{ color: 'var(--txt-dim)' }}>{ago(e.ts)}</span>
                </div>
                <div className="corr-card-body">{e.members.map((m) => m.label).slice(0, 2).join('  ↔  ')}</div>
                <div className="corr-card-dim">
                  {[...new Set(e.members.map((m) => m.family))].join(' + ')} ·{' '}
                  {e.members.map((m) => m.source).join(' · ')}
                </div>
              </div>
            ))}
            {echoes.length === 0 && (
              <div className="corr-empty">aucun écho — les flux ne se recoupent pas pour l'instant</div>
            )}
          </div>
        </div>

        {/* -- colonne droite : orchestre + météos -- */}
        <div className="corr-col">
          <div className="corr-head">
            <Bot className="w-3 h-3" style={{ color: '#ffb84d' }} />
            <span>ORCHESTRE · {agents.length} AGENTS · {investigating.length} EN MISSION</span>
          </div>
          <div className="corr-sec">
            {agents.map((a) => (
              <div key={a.id} className="corr-agent">
                <span
                  className="corr-agent-dot"
                  style={{ background: STATE_COLOR[a.state], boxShadow: `0 0 6px ${STATE_COLOR[a.state]}` }}
                />
                <span className="corr-agent-cs">{a.callsign}</span>
                <span style={{ color: STATE_COLOR[a.state], fontSize: 8.5 }}>{a.state}</span>
                <span className="corr-agent-task">{a.task}</span>
              </div>
            ))}
          </div>

          <div className="corr-sec">
            <div className="corr-title" style={{ color: '#4dffb0' }}>
              BRIEFINGS BLUF · {reports.length}
            </div>
            {reports.slice(0, 5).map((r) => (
              <div key={r.id} className="corr-card" style={{ borderColor: r.ladder === 'P1' ? 'rgba(255,77,94,0.4)' : 'rgba(140,220,255,0.18)' }}>
                <div className="corr-card-top">
                  <span style={{ color: r.ladder === 'P1' ? '#ff4d5e' : '#9ceaff' }}>
                    {r.ladder} · {r.agent}
                  </span>
                  <span style={{ color: 'var(--txt-dim)' }}>{r.confidence} · {ago(r.ts)}</span>
                </div>
                <div className="corr-card-body">{r.bluf}</div>
              </div>
            ))}
            {reports.length === 0 && (
              <div className="corr-empty">les agents patrouillent — briefings au premier déclencheur réel</div>
            )}
          </div>

          <div className="corr-sec corr-meteo">
            <div className="corr-mini" style={{ borderColor: space?.storm ? 'rgba(255,77,94,0.4)' : 'rgba(140,220,255,0.18)' }}>
              <Sparkles className="w-3 h-3" style={{ color: space?.storm ? '#ff4d5e' : '#35e0ff' }} />
              <div>
                <div>MÉTÉO SPATIALE · Kp {space?.kp != null ? space.kp.toFixed(1) : '—'}</div>
                <div className="corr-card-dim">
                  NOAA SWPC · {space?.alerts?.length ?? 0} alertes{space?.storm ? ' · ORAGE G EN COURS' : ''}
                </div>
              </div>
            </div>
            <div className="corr-mini">
              <ShieldAlert className="w-3 h-3" style={{ color: '#35e0ff' }} />
              <div>
                <div>MÉTÉO INTERNET · {net?.count ?? 0} alertes IODA</div>
                <div className="corr-card-dim">pannes nationales / anomalies BGP · fenêtre 3 h</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        .corr-pane { padding: 18px 96px 64px 18px; overflow: auto; }
        .corr-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; max-width: 1500px; }
        .corr-col { display: flex; flex-direction: column; gap: 10px; min-width: 0; }
        .corr-head {
          display: flex; align-items: center; gap: 8px;
          font-size: 10px; letter-spacing: 0.2em; color: #d8f3ff;
          padding: 8px 10px; border: 1px solid rgba(140,220,255,0.16);
          background: rgba(8,14,22,0.6); border-radius: 8px;
        }
        .corr-sec {
          display: flex; flex-direction: column; gap: 6px;
          border: 1px solid rgba(140,220,255,0.1);
          background: rgba(5,10,18,0.5); border-radius: 8px;
          padding: 8px; max-height: 320px; overflow-y: auto;
        }
        .corr-title { font-size: 9px; letter-spacing: 0.18em; margin-bottom: 2px; }
        .corr-card {
          border: 1px solid rgba(140,220,255,0.15); border-radius: 6px;
          padding: 6px 8px; background: rgba(8,14,22,0.55);
          font-family: var(--font-geist-mono), ui-monospace, monospace;
        }
        .corr-card-top { display: flex; justify-content: space-between; gap: 8px; font-size: 8.5px; letter-spacing: 0.1em; }
        .corr-card-body { color: #d8f3ff; font-size: 9.5px; margin-top: 3px; line-height: 1.45; }
        .corr-card-dim { color: var(--txt-dim); font-size: 8px; margin-top: 2px; }
        .corr-empty { color: var(--txt-dim); font-size: 9px; padding: 8px 4px; text-align: center; }
        .corr-agent { display: flex; align-items: center; gap: 7px; font-size: 9px; color: #d8f3ff; }
        .corr-agent-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
        .corr-agent-cs { font-weight: 700; min-width: 60px; }
        .corr-agent-task { color: var(--txt-dim); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .corr-meteo { flex-direction: row; gap: 8px; max-height: none; }
        .corr-mini {
          flex: 1; display: flex; gap: 8px; align-items: center;
          border: 1px solid rgba(140,220,255,0.18); border-radius: 6px;
          padding: 8px; background: rgba(8,14,22,0.55);
          font-size: 9px; color: #d8f3ff; letter-spacing: 0.08em;
        }
        @media (max-width: 1100px) { .corr-grid { grid-template-columns: 1fr; } .corr-pane { padding-right: 18px; } }
      `}</style>
    </div>
  );
}
