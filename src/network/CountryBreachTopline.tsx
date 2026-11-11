

'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ALL_COUNTRIES } from './countries';
import { COUNTRY_NAME, fmtRecords } from './africaLeaks';
import type { BreachItem } from './types';

type Props = {
  countryIso: string;
  breaches: BreachItem[];
  onClose: () => void;
};

const flagOf = (iso: string) =>
  String.fromCodePoint(
    ...[...iso.toUpperCase()].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65)
  );

const sevColor = (s: number) =>
  s >= 80 ? '#ff5c7a' : s >= 60 ? '#ffb84d' : '#35e0ff';

function prettyDate(d: string): string {
  if (!d) return 'date inconnue';
  const m = d.match(/^(\d{4})-(\d{2})(?:-(\d{2}))?$/);
  if (!m) return d;
  const months = [
    'janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin',
    'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.',
  ];
  const [, y, mo, day] = m;
  const label = `${months[Math.min(11, Math.max(0, Number(mo) - 1))]} ${y}`;
  return day ? `${Number(day)} ${label}` : label;
}

export default function CountryBreachTopline({
  countryIso,
  breaches,
  onClose,
}: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const histRef = useRef<HTMLDivElement>(null);

  const isAfrica = useMemo(
    () => breaches.some((b) => b.country === countryIso && b.isAfrica),
    [breaches, countryIso]
  );
  const countryName =
    COUNTRY_NAME[countryIso] ??
    ALL_COUNTRIES.find((c) => c.iso2 === countryIso)?.name ??
    countryIso;

  const list = useMemo(() => {
    const own = breaches.filter((b) => b.country === countryIso);
    own.sort((a, b) => (b.breachDate || '').localeCompare(a.breachDate || ''));
    return own;
  }, [breaches, countryIso]);

  useEffect(() => {
    setSelectedId(null);
    histRef.current?.scrollTo({ left: 0 });
  }, [countryIso]);

  const hero =
    list.find((b) => b.id === selectedId) ?? list[0] ?? null;

  const totalAccounts = list.reduce((n, b) => n + (b.pwnCount || 0), 0);
  const history = hero ? list.filter((b) => b.id !== hero.id) : list;
  const accent = isAfrica ? '#ffb84d' : '#35e0ff';

  if (!hero) return null; // aucun contenu → rien (ne devrait pas arriver)

  return (
    <div
      className="glass"
      style={{
        position: 'absolute',
        top: 12,
        left: '50%',
        transform: 'translateX(-50%)',
        width: 'min(780px, calc(100vw - 32px))',
        zIndex: 45,
        borderRadius: 12,
        overflow: 'hidden',
        borderColor: `rgba(${isAfrica ? '255,184,77' : '53,224,255'},0.35)`,
        boxShadow: `0 14px 44px rgba(0,0,0,0.55), 0 0 26px rgba(${isAfrica ? '255,184,77' : '53,224,255'},0.12)`,
        animation: 'cbl-drop 0.32s cubic-bezier(0.2,0.9,0.3,1.2)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '8px 12px',
          borderBottom: `1px solid rgba(${isAfrica ? '255,184,77' : '140,220,255'},0.18)`,
          background: `rgba(${isAfrica ? '255,184,77' : '53,224,255'},0.05)`,
        }}
      >
        <span style={{ fontSize: 21, lineHeight: 1 }}>{flagOf(countryIso)}</span>
        <span
          style={{
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: '0.14em',
            color: '#d8f3ff',
            textTransform: 'uppercase',
          }}
        >
          {countryName}
        </span>
        <span
          style={{
            fontSize: 8,
            fontFamily: 'var(--font-geist-mono), monospace',
            color: accent,
            border: `1px solid rgba(${isAfrica ? '255,184,77' : '53,224,255'},0.4)`,
            borderRadius: 3,
            padding: '1px 4px',
          }}
        >
          {countryIso}
        </span>
        {isAfrica && (
          <span
            style={{
              fontSize: 8,
              letterSpacing: '0.12em',
              color: '#ffb84d',
              border: '1px solid rgba(255,184,77,0.45)',
              borderRadius: 3,
              padding: '1px 4px',
            }}
            title="Pays du dossier cyberrenseignement Afrique"
          >
            AFRIQUE
          </span>
        )}
        <span
          style={{
            fontSize: 9,
            color: 'var(--txt-dim)',
            marginLeft: 4,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {list.length} fuite{list.length > 1 ? 's' : ''} documentée
          {list.length > 1 ? 's' : ''}
          {totalAccounts > 0
            ? ` · ${fmtRecords(totalAccounts)} comptes exposés au total`
            : ''}
        </span>
        <button
          onClick={onClose}
          title="Fermer le dossier pays"
          style={{
            marginLeft: 'auto',
            background: 'transparent',
            border: '1px solid rgba(140,220,255,0.25)',
            borderRadius: 5,
            color: 'var(--txt-dim)',
            fontSize: 10,
            lineHeight: 1,
            padding: '3px 7px',
            cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          ✕
        </button>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: history.length > 0 ? '1.25fr 1fr' : '1fr',
          gap: 0,
        }}
      >
        <div style={{ padding: '10px 12px', minWidth: 0 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 8.5,
              letterSpacing: '0.2em',
              color: accent,
              marginBottom: 6,
            }}
          >
            <span
              style={{
                width: 5,
                height: 5,
                borderRadius: '50%',
                background: accent,
                boxShadow: `0 0 6px ${accent}`,
              }}
            />
            {selectedId ? 'FUITE SÉLECTIONNÉE' : 'PLUS RÉCENTE'}
            <span
              style={{
                marginLeft: 'auto',
                fontFamily: 'var(--font-geist-mono), monospace',
                fontSize: 9,
                color: '#d8f3ff',
                border: `1px solid ${sevColor(hero.severity)}`,
                borderRadius: 3,
                padding: '0 5px',
              }}
              title={`Sévérité ${hero.severity}/95`}
            >
              SEV {hero.severity}
            </span>
          </div>

          <div
            style={{
              fontSize: 12.5,
              fontWeight: 700,
              color: '#eaf7ff',
              lineHeight: 1.3,
              marginBottom: 3,
              wordBreak: 'break-word',
            }}
          >
            {hero.title}
          </div>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '2px 10px',
              fontSize: 9.5,
              color: 'var(--txt-dim)',
              marginBottom: 6,
            }}
          >
            <span style={{ color: accent }}>{prettyDate(hero.breachDate)}</span>
            {hero.domain && <span>{hero.domain}</span>}
            <span>
              {hero.pwnCount > 0
                ? `${hero.pwnCount.toLocaleString('fr-FR')} comptes`
                : 'volume non chiffré'}
            </span>
            {hero.verified && <span title="Vérifié">✓ vérifiée</span>}
            {hero.countryEvidence === 'tld' && (
              <span title="Pays déduit de l'extension du domaine">· via TLD</span>
            )}
          </div>

          {hero.dataClasses.length > 0 && (
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 4,
                marginBottom: 6,
              }}
            >
              {hero.dataClasses.slice(0, 6).map((d) => (
                <span
                  key={d}
                  style={{
                    fontSize: 8,
                    color: '#cfe8ff',
                    background: 'rgba(140,220,255,0.08)',
                    border: '1px solid rgba(140,220,255,0.2)',
                    borderRadius: 3,
                    padding: '1px 5px',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {d}
                </span>
              ))}
            </div>
          )}

          <p
            style={{
              fontSize: 9,
              lineHeight: 1.55,
              color: 'var(--txt-dim)',
              margin: 0,
              display: '-webkit-box',
              WebkitLineClamp: 3,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
            title={hero.description}
          >
            {hero.description || 'pas de description'}
          </p>
        </div>

        {history.length > 0 && (
          <div
            style={{
              borderLeft: '1px solid rgba(140,220,255,0.12)',
              padding: '10px 12px',
              minWidth: 0,
            }}
          >
            <div
              style={{
                fontSize: 8.5,
                letterSpacing: '0.2em',
                color: 'var(--txt-dim)',
                marginBottom: 6,
              }}
            >
              HISTORIQUE · {history.length}
            </div>
            <div
              ref={histRef}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 3,
                maxHeight: 128,
                overflowY: 'auto',
                paddingRight: 2,
              }}
            >
              {history.map((b) => (
                <button
                  key={b.id}
                  onClick={() => setSelectedId(b.id)}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '52px 1fr auto',
                    gap: 6,
                    alignItems: 'center',
                    textAlign: 'left',
                    width: '100%',
                    padding: '3px 6px',
                    background:
                      b.id === selectedId
                        ? 'rgba(140,220,255,0.1)'
                        : 'transparent',
                    border: '1px solid transparent',
                    borderRadius: 5,
                    cursor: 'pointer',
                    color: 'inherit',
                  }}
                  onMouseEnter={(e) => {
                    if (b.id !== selectedId)
                      e.currentTarget.style.background =
                        'rgba(140,220,255,0.06)';
                  }}
                  onMouseLeave={(e) => {
                    if (b.id !== selectedId)
                      e.currentTarget.style.background = 'transparent';
                  }}
                >
                  <span
                    style={{
                      fontSize: 8.5,
                      fontFamily: 'var(--font-geist-mono), monospace',
                      color: b.isAfrica ? '#ffb84d' : 'var(--txt-dim)',
                    }}
                  >
                    {b.breachDate || '····'}
                  </span>
                  <span
                    style={{
                      fontSize: 9.5,
                      color: b.id === selectedId ? '#eaf7ff' : '#b9d6e8',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                    title={b.title}
                  >
                    {b.title}
                  </span>
                  <span
                    style={{
                      fontSize: 8.5,
                      fontFamily: 'var(--font-geist-mono), monospace',
                      color: sevColor(b.severity),
                    }}
                  >
                    {b.pwnCount > 0 ? fmtRecords(b.pwnCount) : 'N/D'}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <style
        dangerouslySetInnerHTML={{
          __html: `
        @keyframes cbl-drop {
          from { opacity: 0; transform: translateX(-50%) translateY(-14px); }
          to { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
      `,
        }}
      />
    </div>
  );
}
