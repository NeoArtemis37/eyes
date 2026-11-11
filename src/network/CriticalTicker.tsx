

'use client';

import { useEffect, useMemo, useState } from 'react';
import { KIND_COLOR, type ThreatEvent } from './types';

const ROTATE_MS = 5_000;
const CRIT_SEV = 85;

export default function CriticalTicker({ events }: { events: ThreatEvent[] }) {
  const total = useMemo(
    () => events.filter((e) => e.severity >= CRIT_SEV || e.kind === 'ransom').length,
    [events]
  );
  const crit = useMemo(
    () =>
      events
        .filter((e) => e.severity >= CRIT_SEV || e.kind === 'ransom')
        .sort((a, b) => b.severity - a.severity || b.ts - a.ts)
        .slice(0, 24),
    [events]
  );

  const [i, setI] = useState(0);
  useEffect(() => {
    if (crit.length < 2) return;
    const iv = setInterval(() => setI((v) => (v + 1) % crit.length), ROTATE_MS);
    return () => clearInterval(iv);
  }, [crit.length]);

  if (crit.length === 0) return null;
  const e = crit[i % crit.length];

  const item =
    e.kind === 'ransom'
      ? `RANSOMWARE · ${e.tags[0] ?? 'groupe N/D'} → ${e.host ?? 'victime N/D'}${
          e.geo?.country ? ` · ${e.geo.country}` : ''
        }`
      : `${e.kind.toUpperCase()} · ${e.ip ?? e.host ?? 'N/D'}${
          e.geo?.country ? ` · ${e.geo.country}` : ''
        }${e.tags[0] ? ` · ${e.tags[0]}` : ''}`;

  return (
    <div className="net-crit glass" role="status" aria-live="polite">
      <span className="net-crit__dot" />
      <span className="net-crit__label">MENACES CRITIQUES</span>
      <span className="net-crit__n">{total}</span>
      <span className="net-crit__sep" />
      <span className="net-crit__item" style={{ color: KIND_COLOR[e.kind] }}>
        {item}
      </span>
    </div>
  );
}
