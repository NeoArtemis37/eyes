

'use client';

import { useEffect, useState } from 'react';
import type { Spot } from './arcEngine';
import { fetchIpIntel, type IpIntel } from './geo';
import { KIND_COLOR, SOURCE_LABEL, type BreachItem, type ThreatSourceId } from './types';

export type PopupTarget =
  | { type: 'endpoint'; spot: Spot; at: { x: number; y: number } }
  | { type: 'breach'; breach: BreachItem; at: { x: number; y: number } };

type Props = {
  target: PopupTarget;
  onClose: () => void;
};

const PW = 250; // popup width
const PH = 230; // approx height for clamping

export default function ThreatPopup({ target, onClose }: Props) {
  const [intel, setIntel] = useState<IpIntel | null>(null);
  const [loadingIntel, setLoadingIntel] = useState(false);

  const spot = target.type === 'endpoint' ? target.spot : null;
  const ip = spot?.ip ?? null;

  useEffect(() => {
    setIntel(null);
    if (!ip) return;
    let dead = false;
    setLoadingIntel(true);
    void fetchIpIntel(ip)
      .then((d) => {
        if (!dead) setIntel(d);
      })
      .catch(() => {})
      .finally(() => {
        if (!dead) setLoadingIntel(false);
      });
    return () => {
      dead = true;
    };
  }, [ip]);

  const x = Math.max(10, Math.min(target.at.x - PW / 2, window.innerWidth - PW - 10));
  const y = Math.max(54, Math.min(target.at.y + 14, window.innerHeight - PH - 10));

  const kindColor = spot?.kind
    ? (KIND_COLOR[spot.kind as keyof typeof KIND_COLOR] ?? '#35e0ff')
    : '#ffb84d';

  return (
    <div className="glass net-popup" style={{ left: x, top: y, width: PW }}>
      <header className="panel__head" onClick={onClose} title="Fermer">
        <span className="panel__dot" style={{ background: kindColor, boxShadow: `0 0 10px ${kindColor}` }} />
        <h3 className="panel__title">
          {target.type === 'breach' ? 'DATA BREACH' : 'THREAT ENDPOINT'}
        </h3>
        <span className="panel__chev">✕</span>
      </header>
      <div className="panel__body net-popup__body">
        {target.type === 'breach' ? (
          <BreachBody breach={target.breach} />
        ) : (
          <EndpointBody
            spot={target.spot}
            intel={intel}
            loadingIntel={loadingIntel}
          />
        )}
      </div>
    </div>
  );
}

function kv(k: string, v: string) {
  return (
    <div className="kv" key={k}>
      <b>{k}</b>
      <span title={v}>{v}</span>
    </div>
  );
}

function EndpointBody({
  spot,
  intel,
  loadingIntel,
}: {
  spot: Spot;
  intel: IpIntel | null;
  loadingIntel: boolean;
}) {
  return (
    <div className="feed-detail">
      {kv('adresse', spot.ip ?? spot.host ?? 'N/D')}
      {kv('type', spot.kind ?? 'N/D')}
      {kv('sévérité', `${spot.maxSev} · ${spot.count}× vu`)}
      {spot.source &&
        kv('source', SOURCE_LABEL[spot.source as ThreatSourceId] ?? spot.source)}
      {spot.city || spot.country
        ? kv('localité', [spot.city, spot.country].filter(Boolean).join(', '))
        : null}
      {spot.asn ? kv('asn', spot.asn) : null}
      {kv(
        'coords',
        `${spot.geo[1].toFixed(2)}°, ${spot.geo[0].toFixed(2)}°`
      )}
      {spot.ip && loadingIntel && (
        <div className="net-empty">
          <span className="net-spin" /> GreyNoise + Shodan…
        </div>
      )}
      {spot.ip && !loadingIntel && intel && (
        <>
          {intel.greynoise &&
            kv(
              'greynoise',
              `${intel.greynoise.noise ? 'noise' : 'quiet'}${
                intel.greynoise.riot ? ' · riot' : ''
              }${
                intel.greynoise.classification
                  ? ` · ${intel.greynoise.classification}`
                  : ''
              }`
            )}
          {intel.shodan?.ports?.length
            ? kv('ports ouverts', intel.shodan.ports.join(', '))
            : null}
          {intel.shodan?.vulns?.length
            ? kv('cve', intel.shodan.vulns.slice(0, 3).join(', '))
            : null}
          {intel.shodan?.org ? kv('org', intel.shodan.org) : null}
        </>
      )}
      {spot.ip && !loadingIntel && !intel?.greynoise && !intel?.shodan && (
        <div className="net-empty">aucune intel pour cette IP</div>
      )}
    </div>
  );
}

function BreachBody({ breach }: { breach: BreachItem }) {
  return (
    <div className="feed-detail">
      <div style={{ color: '#ffb84d', fontWeight: 600, marginBottom: 2 }}>
        {breach.title}
      </div>
      {breach.domain ? kv('domaine', breach.domain) : null}
      {kv('date', breach.breachDate)}
      {kv('comptes exposés', breach.pwnCount.toLocaleString('fr-FR'))}
      {breach.country
        ? kv(
            'pays',
            `${breach.country} (${'tld' === breach.countryEvidence ? 'via TLD' : 'via texte'})`
          )
        : null}
      {breach.verified ? kv('statut', 'vérifié') : null}
      {breach.dataClasses.length > 0 &&
        kv('données', breach.dataClasses.slice(0, 5).join(', '))}
      {breach.description && (
        <p className="net-popup__desc" title={breach.description}>
          {breach.description}
        </p>
      )}
    </div>
  );
}
