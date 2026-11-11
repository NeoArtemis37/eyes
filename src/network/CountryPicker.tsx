

'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Globe2, Search, Check, X } from 'lucide-react';
import { ALL_COUNTRIES, type CountryEntry } from './countries';

const AFRICA_ISO = new Set([
  'DZ', 'AO', 'BJ', 'BW', 'BF', 'BI', 'CV', 'CM', 'CF', 'TD', 'KM', 'CG', 'CD',
  'CI', 'DJ', 'EG', 'GQ', 'ER', 'SZ', 'ET', 'GA', 'GM', 'GH', 'GN', 'GW', 'KE',
  'LS', 'LR', 'LY', 'MG', 'MW', 'ML', 'MR', 'MU', 'MA', 'MZ', 'NA', 'NE', 'NG',
  'RW', 'ST', 'SN', 'SC', 'SL', 'SO', 'ZA', 'SS', 'SD', 'TZ', 'TG', 'TN', 'UG',
  'ZM', 'ZW', 'EH', 'RE', 'SH', 'YT',
]);

type ObservedMap = Map<string, { n: number; name: string }>;

interface CountryPickerProps {
  value: string;
  onChange: (key: string) => void;
  observed: ObservedMap;
}

interface Row {
  key: string;
  name: string;
  iso2: string;
  n?: number;
  group: 'observed' | 'africa' | 'world';
}

export default function CountryPicker({ value, onChange, observed }: CountryPickerProps) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const selected: CountryEntry | undefined = value
    ? ALL_COUNTRIES.find((c) => c.key === value)
    : undefined;

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    window.addEventListener('mousedown', onDown);
    return () => window.removeEventListener('mousedown', onDown);
  }, [open]);

  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => searchRef.current?.focus());
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setOpen(false);
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [open]);

  const rows = useMemo<Row[]>(() => {
    const query = q.trim().toLowerCase();
    const match = (c: CountryEntry) =>
      !query ||
      c.name.toLowerCase().includes(query) ||
      c.key.includes(query) ||
      c.iso2.toLowerCase() === query;

    const observedRows: Row[] = [];
    const africaRows: Row[] = [];
    const worldRows: Row[] = [];

    const obsSorted = [...observed.entries()]
      .sort((a, b) => b[1].n - a[1].n || a[1].name.localeCompare(b[1].name));
    for (const [k, v] of obsSorted) {
      const entry = ALL_COUNTRIES.find((c) => c.key === k);
      if (entry && match(entry)) {
        observedRows.push({ key: k, name: v.name, iso2: entry.iso2, n: v.n, group: 'observed' });
      }
    }

    for (const c of ALL_COUNTRIES) {
      if (observed.has(c.key) || !match(c)) continue;
      (AFRICA_ISO.has(c.iso2) ? africaRows : worldRows).push({
        key: c.key, name: c.name, iso2: c.iso2, group: AFRICA_ISO.has(c.iso2) ? 'africa' : 'world',
      });
    }

    const out = [...observedRows, ...africaRows, ...worldRows];
    if (query) return out.slice(0, 60); // recherche : cap fluide
    return out;
  }, [q, observed]);

  const pick = (k: string) => {
    onChange(k);
    setOpen(false);
  };

  const observedTotal = useMemo(
    () => [...observed.values()].reduce((s, v) => s + v.n, 0),
    [observed]
  );

  return (
    <div className="cp-root" ref={rootRef}>
      <button
        type="button"
        className={`cp-trigger ${open ? 'is-open' : ''}`}
        onClick={() => {
          setQ(''); // réinitialise la recherche à chaque ouverture
          setOpen((v) => !v);
        }}
        title="Filtrer les événements par pays"
      >
        <Globe2 className="cp-globe" />
        {selected ? (
          <>
            <span className="cp-iso">{selected.iso2}</span>
            <span className="cp-name">{selected.name}</span>
          </>
        ) : (
          <span className="cp-name cp-all">
            Tous les pays
            <span className="cp-count-badge">
              {observed.size > 0 ? `${observedTotal} evt · ${observed.size} pays` : ''}
            </span>
          </span>
        )}
        <span className="cp-caret">{open ? '▴' : '▾'}</span>
      </button>

      {open && (
        <div className="cp-panel glass">
          <div className="cp-search-row">
            <Search className="cp-search-icon" />
            <input
              ref={searchRef}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Rechercher un pays…"
              className="cp-search"
              spellCheck={false}
            />
            {q && (
              <button type="button" className="cp-clear" onClick={() => setQ('')} title="Effacer">
                <X className="cp-x" />
              </button>
            )}
          </div>

          <div className="cp-actions">
            <button
              type="button"
              className={`cp-quick ${value === '' ? 'is-on' : ''}`}
              onClick={() => pick('')}
            >
              TOUS
            </button>
          </div>

          <div className="cp-list">
            {rows.length === 0 && (
              <div className="cp-empty">aucun pays ne correspond à « {q} »</div>
            )}
            {rows.map((r) => (
              <button
                type="button"
                key={r.group + r.key}
                className={`cp-row ${value === r.key ? 'is-sel' : ''} ${r.group === 'observed' ? 'is-obs' : ''}`}
                onClick={() => pick(r.key)}
              >
                {r.group === 'observed' && <span className="cp-diamond">◆</span>}
                <span className="cp-iso">{r.iso2}</span>
                <span className="cp-row-name">{r.name}</span>
                {r.n != null && <span className="cp-n">{r.n}</span>}
                {value === r.key && <Check className="cp-check" />}
              </button>
            ))}
          </div>

          <div className="cp-footer">
            {observed.size > 0 && (
              <span>◆ {observed.size} pays observés · {observedTotal} événements</span>
            )}
            {observed.size === 0 && <span>synchronisation des flux en cours…</span>}
          </div>
        </div>
      )}
    </div>
  );
}
