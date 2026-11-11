

'use client';

import { useEffect, useRef, useState } from 'react';

interface Stats { groups: number; victims7d: number; onionsUp: number; onionsTotal: number }
interface TopGroup {
  name: string; altname: string; victims30: number;
  onionsUp: number; onionsTotal: number; description: string;
}

export default function DarkWebPanel({ onOpenGroup }: { onOpenGroup: (name: string) => void }) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [top, setTop] = useState<TopGroup[]>([]);
  const [sectors, setSectors] = useState<{ key: string; count: number }[]>([]);
  const seq = useRef(0);

  useEffect(() => {
    const s = ++seq.current;
    fetch('/api/network/darkweb')
      .then((r) => r.json())
      .then((d) => {
        if (s !== seq.current) return;
        if (d.stats) setStats(d.stats);
        setTop(d.topGroups ?? []);
        setSectors(d.topSectors ?? []);
      })
      .catch(() => {});
    return () => { seq.current++; };
  }, []);

  return (
    <div className="net-darkweb">
      {stats ? (
        <div className="dweb-stats">
          <span className="dweb-stat"><b>{stats.groups}</b> groupes</span>
          <span className="dweb-stat dweb-stat--on"><b>{stats.onionsUp}</b>/{stats.onionsTotal} onions up</span>
          <span className="dweb-stat dweb-stat--hot"><b>{stats.victims7d}</b> vict. 7j</span>
        </div>
      ) : (
        <div className="dweb-loading"><span className="net-spin" /> sync ransomware.live…</div>
      )}

      <div className="dweb-sec">GROUPES ACTIFS · 30 J</div>
      {top.slice(0, 6).map((g) => (
        <button
          key={g.name}
          className="dweb-row"
          title={g.description || g.name}
          onClick={() => onOpenGroup(g.name)}
        >
          <span className="dweb-row__name">{g.name}</span>
          <span className={`dweb-row__on ${g.onionsUp > 0 ? 'up' : ''}`}>{g.onionsUp}/{g.onionsTotal} onion</span>
          <span className="dweb-row__vic">{g.victims30}</span>
        </button>
      ))}

      {sectors.length > 0 && (
        <>
          <div className="dweb-sec">SECTEURS VISÉS</div>
          <div className="dweb-chips">
            {sectors.slice(0, 5).map((s) => (
              <span key={s.key} className="dweb-chip">{s.key} · {s.count}</span>
            ))}
          </div>
        </>
      )}

      <div className="dweb-foot">RECON TOOLKIT : groupes · onions · TTPs · URL · phishing</div>
    </div>
  );
}
