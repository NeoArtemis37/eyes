

import {
  KIND_BASE_SEVERITY,
  SOURCE_LABEL,
  clamp,
  type ThreatEvent,
  type ThreatKind,
  type ThreatSourceId,
} from './types';
import { CENTROID } from './breaches';
import { countryEntry } from './countries';


const IPV4 =
  /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;

export const isIPv4 = (s: string) => IPV4.test(s.trim());

function parseUtc(s: string): number {
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/);
  if (m) {
    return Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]);
  }
  const t = Date.parse(s);
  return Number.isFinite(t) ? t : Date.now();
}

let seq = 0;
const uid = (src: ThreatSourceId) =>
  `${src}-${(seq++).toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

function csvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQ) {
      if (c === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else inQ = false;
      } else cur += c;
    } else if (c === '"') inQ = true;
    else if (c === ',') {
      out.push(cur);
      cur = '';
    } else cur += c;
  }
  out.push(cur);
  return out;
}

function hostFromUrl(raw: string): { ip?: string; host?: string } {
  try {
    const u = new URL(raw);
    const h = u.hostname;
    return isIPv4(h) ? { ip: h, host: h } : { host: h };
  } catch {
    return {};
  }
}

async function fetchFeed(id: ThreatSourceId, init?: RequestInit, timeoutMs = 15_000) {
  const res = await fetch(`/api/network/feeds/${id}`, {
    ...init,
    signal: AbortSignal.timeout(timeoutMs),
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}


async function resolveHosts(
  hosts: string[],
  max = 200
): Promise<Map<string, string>> {
  const m = new Map<string, string>();
  const uniq = [...new Set(hosts.map((h) => h.toLowerCase()))].slice(0, max);
  if (!uniq.length) return m;
  try {
    const r = await fetch('/api/network/dns', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hosts: uniq }),
      signal: AbortSignal.timeout(30_000),
      cache: 'no-store',
    });
    if (!r.ok) return m;
    const j = (await r.json()) as { results?: Record<string, string | null> };
    for (const [h, ip] of Object.entries(j.results ?? {}))
      if (ip) m.set(h, ip);
  } catch {
  }
  return m;
}


async function fetchFeodo(): Promise<ThreatEvent[]> {
  const txt = await fetchFeed('feodo');
  const rows = JSON.parse(txt) as Record<string, unknown>[];
  if (!Array.isArray(rows)) return [];
  return rows.map((r) => {
    const ip = String(r.ip_address ?? '');
    const port = Number(r.port ?? 0) || undefined;
    const malware = String(r.malware ?? '').trim();
    const online = String(r.status ?? '') === 'online';
    return {
      id: uid('feodo'),
      ts: parseUtc(String(r.first_seen ?? r.last_online ?? '')),
      source: 'feodo' as const,
      kind: 'c2' as const,
      severity: clamp(KIND_BASE_SEVERITY.c2 + (online ? 10 : 0), 0, 95),
      ip: isIPv4(ip) ? ip : undefined,
      host:
        isIPv4(ip) && r.hostname
          ? String(r.hostname)
          : isIPv4(ip)
            ? undefined
            : ip || undefined,
      port,
      tags: [malware, online ? 'online' : 'offline'].filter(Boolean),
      meta: {
        malware,
        status: r.status,
        first_seen: r.first_seen,
        last_online: r.last_online,
        asn: r.as_number
          ? `AS${r.as_number} ${r.as_name ?? ''}`.trim()
          : undefined,
        country: r.country,
      },
    } satisfies ThreatEvent;
  });
}


async function fetchThreatFox(): Promise<ThreatEvent[]> {
  const txt = await fetchFeed('threatfox', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: 'search_timeframe', days: 1 }),
  });
  const j = JSON.parse(txt) as {
    status?: string;
    data?: Record<string, unknown>[];
  };
  const rows = Array.isArray(j.data) ? j.data : [];
  const out: ThreatEvent[] = [];
  for (const r of rows.slice(0, 400)) {
    const ioc = String(r.ioc ?? '');
    const iocType = String(r.ioc_type ?? '');
    const threatType = String(r.threat_type ?? 'malware');
    const kind = threatType === 'botnet_cc' ? 'c2' : 'malware';
    const conf = Number(r.confidence_level ?? 0);
    let ip: string | undefined;
    let host: string | undefined;
    let port: number | undefined;
    if (iocType === 'ip:port') {
      const [maybeIp, maybePort] = ioc.split(':');
      if (isIPv4(maybeIp)) {
        ip = maybeIp;
        port = Number(maybePort) || undefined;
      }
    } else if (iocType === 'domain' || iocType === 'url') {
      const { ip: uIp, host: uHost } =
        iocType === 'url' ? hostFromUrl(ioc) : { host: ioc };
      ip = uIp;
      host = uHost;
    } else {
      continue; // hashes / other indicators: out of scope for the map
    }
    if (!ip && !host) continue;
    const malware = String(r.malware_printable ?? '').trim();
    out.push({
      id: uid('threatfox'),
      ts: parseUtc(String(r.first_seen_utc ?? '')),
      source: 'threatfox' as const,
      kind,
      severity: clamp(
        KIND_BASE_SEVERITY[kind] - 15 + Math.round((conf / 100) * 30),
        20,
        99
      ),
      ip,
      host,
      port,
      tags: malware ? [malware] : [],
      meta: {
        threat_type: threatType,
        malware,
        confidence: conf,
        reference: r.reference_link,
      },
    });
  }
  return out;
}


async function fetchUrlhaus(): Promise<ThreatEvent[]> {
  const txt = await fetchFeed('urlhaus');
  const out: ThreatEvent[] = [];
  for (const line of txt.split('\n')) {
    const l = line.trim();
    if (!l || l[0] === '#' || !/^https?:\/\//.test(l)) continue;
    const { ip, host } = hostFromUrl(l);
    if (!ip && !host) continue;
    let port: number | undefined;
    try {
      port = Number(new URL(l).port) || undefined;
    } catch {
      port = undefined;
    }
    out.push({
      id: uid('urlhaus'),
      ts: Date.now(),
      source: 'urlhaus' as const,
      kind: 'malware' as const,
      severity: KIND_BASE_SEVERITY.malware,
      ip,
      host,
      url: l,
      port,
      tags: ['payload-url'],
      meta: {},
    });
  }
  return out.slice(0, 600);
}

async function fetchDshield(): Promise<ThreatEvent[]> {
  const txt = await fetchFeed('dshield');
  const out: ThreatEvent[] = [];
  for (const line of txt.split('\n')) {
    const l = line.trim();
    if (!l || l[0] === '#' || l[0] !== '"') continue;
    const f = csvLine(l); // start, end, count, comment
    const ip = (f[0] ?? '').trim();
    if (!isIPv4(ip)) continue;
    const attacks = Number(f[2] ?? 0) || 0;
    out.push({
      id: uid('dshield'),
      ts: Date.now(),
      source: 'dshield' as const,
      kind: 'attack' as const,
      severity: clamp(
        KIND_BASE_SEVERITY.attack + Math.min(25, Math.round(attacks / 400)),
        35,
        90
      ),
      ip,
      tags: ['top-attacker'],
      meta: { attacks, block: `${f[0]} - ${f[1]}` },
    });
  }
  return out;
}

async function fetchIsc(): Promise<ThreatEvent[]> {
  const txt = await fetchFeed('isc');
  const j = JSON.parse(txt) as {
    results?: Record<string, unknown>[];
  };
  const rows = Array.isArray(j.results) ? j.results : [];
  const out: ThreatEvent[] = [];
  for (const r of rows.slice(0, 500)) {
    const ip = String(r.threatip ?? r.ip ?? '').trim();
    if (!isIPv4(ip)) continue;
    const count = Number(r.count ?? r.records ?? 0) || 0;
    const category = String(r.threatcategory ?? 'scanning');
    out.push({
      id: uid('isc'),
      ts: parseUtc(String(r.lastseen ?? r.firstseen ?? '')),
      source: 'isc' as const,
      kind: 'scan' as const,
      severity: clamp(
        KIND_BASE_SEVERITY.scan + Math.min(30, Math.round(count / 50)),
        25,
        80
      ),
      ip,
      tags: [category],
      meta: { records: count, category },
    });
  }
  return out;
}


async function fetchOpenPhish(): Promise<ThreatEvent[]> {
  const txt = await fetchFeed('openphish');
  const out: ThreatEvent[] = [];
  const pendingHosts: string[] = [];
  const seenHost = new Set<string>();
  for (const line of txt.split('\n')) {
    const l = line.trim();
    if (!l || !/^https?:\/\//.test(l)) continue;
    const { ip, host } = hostFromUrl(l);
    if (!ip && !host) continue;
    if (!ip && host) {
      if (seenHost.has(host)) continue; // one event per host
      seenHost.add(host);
      pendingHosts.push(host);
    }
    let port: number | undefined;
    try {
      port = Number(new URL(l).port) || undefined;
    } catch {
      port = undefined;
    }
    out.push({
      id: uid('openphish'),
      ts: Date.now(),
      source: 'openphish' as const,
      kind: 'phish' as const,
      severity: KIND_BASE_SEVERITY.phish,
      ip,
      host,
      url: l,
      port,
      tags: ['phishing'],
      meta: {},
    });
    if (out.length >= 300) break;
  }
  const ips = await resolveHosts(pendingHosts);
  if (ips.size)
    for (const e of out)
      if (!e.ip && e.host) {
        const ip = ips.get(e.host.toLowerCase());
        if (ip) e.ip = ip;
      }
  return out;
}


async function fetchRansomLive(): Promise<ThreatEvent[]> {
  const txt = await fetchFeed('ransomlive');
  let rows: Record<string, unknown>[] = [];
  try {
    rows = JSON.parse(txt) as Record<string, unknown>[];
  } catch {
    return [];
  }
  if (!Array.isArray(rows)) return [];
  const out: ThreatEvent[] = [];
  for (const r of rows.slice(0, 300)) {
    const noDash = (v: unknown) => String(v ?? '').replace(/[—–]/g, '·');
    const victim = noDash(r.post_title).trim();
    const group = noDash(r.group_name).trim();
    const iso = String(r.country ?? '').trim().toUpperCase();
    const ts = parseUtc(String(r.discovered ?? r.published ?? ''));
    if (!victim || !iso) continue;
    const c = countryEntry(iso);
    const centroid = CENTROID[iso];
    if (!c || !centroid) continue; // unknown country · no fabricated geo
    out.push({
      id: uid('ransomlive'),
      ts: ts > 0 ? ts : Date.now(),
      source: 'ransomlive' as const,
      kind: 'ransom' as const,
      severity: KIND_BASE_SEVERITY.ransom,
      host: victim,
      url: String(r.post_url ?? '') || undefined,
      tags: group ? [group] : [],
      meta: {
        group,
        description: noDash(r.description),
        published: r.published,
        data_size: r.data_size,
        ransom: r.ransom,
      },
      geo: { lon: centroid[0], lat: centroid[1], country: c.name },
    });
  }
  return out;
}

async function fetchBlocklistDe(): Promise<ThreatEvent[]> {
  const txt = await fetchFeed('blocklistde');
  const out: ThreatEvent[] = [];
  for (const line of txt.split('\n')) {
    const ip = line.trim();
    if (!isIPv4(ip)) continue;
    out.push({
      id: uid('blocklistde'),
      ts: Date.now(),
      source: 'blocklistde' as const,
      kind: 'attack' as const,
      severity: KIND_BASE_SEVERITY.attack,
      ip,
      tags: [],
      meta: {},
    });
    if (out.length >= 800) break;
  }
  return out;
}


async function fetchSpamhaus(): Promise<ThreatEvent[]> {
  const txt = await fetchFeed('spamhaus');
  const out: ThreatEvent[] = [];
  for (const line of txt.split('\n')) {
    const l = line.split(';')[0]?.trim() ?? '';
    if (!l || l.startsWith(';') || l.startsWith('#')) continue;
    const base = l.split('/')[0] ?? '';
    if (!isIPv4(base)) continue;
    out.push({
      id: uid('spamhaus'),
      ts: Date.now(),
      source: 'spamhaus' as const,
      kind: 'attack' as const,
      severity: clamp(KIND_BASE_SEVERITY.attack + 12, 0, 95),
      ip: base,
      tags: ['drop', 'hijacked-range'],
      meta: { cidr: l, sbl: line.split(';')[1]?.trim() },
    });
    if (out.length >= 300) break;
  }
  return out;
}


async function fetchFirehol(): Promise<ThreatEvent[]> {
  const txt = await fetchFeed('firehol');
  const out: ThreatEvent[] = [];
  for (const line of txt.split('\n')) {
    const l = line.trim();
    if (!l || l.startsWith('#')) continue;
    const base = l.split('/')[0] ?? '';
    if (!isIPv4(base)) continue;
    out.push({
      id: uid('firehol'),
      ts: Date.now(),
      source: 'firehol' as const,
      kind: 'attack' as const,
      severity: KIND_BASE_SEVERITY.attack,
      ip: base,
      tags: ['firehol-l1'],
      meta: { cidr: l.includes('/') ? l : undefined },
    });
    if (out.length >= 400) break;
  }
  return out;
}

async function fetchCinsArmy(): Promise<ThreatEvent[]> {
  const txt = await fetchFeed('cinsarmy');
  const out: ThreatEvent[] = [];
  for (const line of txt.split('\n')) {
    const ip = line.trim();
    if (!isIPv4(ip)) continue;
    out.push({
      id: uid('cinsarmy'),
      ts: Date.now(),
      source: 'cinsarmy' as const,
      kind: 'attack' as const,
      severity: KIND_BASE_SEVERITY.attack,
      ip,
      tags: ['cins'],
      meta: {},
    });
    if (out.length >= 600) break;
  }
  return out;
}

async function fetchGreensnow(): Promise<ThreatEvent[]> {
  const txt = await fetchFeed('greensnow');
  const out: ThreatEvent[] = [];
  for (const line of txt.split('\n')) {
    const ip = line.trim();
    if (!isIPv4(ip)) continue;
    out.push({
      id: uid('greensnow'),
      ts: Date.now(),
      source: 'greensnow' as const,
      kind: 'attack' as const,
      severity: KIND_BASE_SEVERITY.attack,
      ip,
      tags: [],
      meta: {},
    });
    if (out.length >= 600) break;
  }
  return out;
}


async function fetchBlackbook(): Promise<ThreatEvent[]> {
  const txt = await fetchFeed('blackbook');
  const out: ThreatEvent[] = [];
  const pendingHosts: string[] = [];
  for (const line of txt.split('\n')) {
    const h = line.trim().toLowerCase();
    if (!h || !/^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}$/.test(h)) continue;
    out.push({
      id: uid('blackbook'),
      ts: Date.now(),
      source: 'blackbook' as const,
      kind: 'malware' as const,
      severity: KIND_BASE_SEVERITY.malware,
      host: h,
      tags: ['malware-domain'],
      meta: {},
    });
    if (pendingHosts.length < 150) pendingHosts.push(h);
    if (out.length >= 500) break;
  }
  const ips = await resolveHosts(pendingHosts, 150);
  if (ips.size)
    for (const e of out)
      if (e.host) {
        const ip = ips.get(e.host.toLowerCase());
        if (ip) e.ip = ip;
      }
  return out;
}


/**
 * CIRCL MISP OSINT feed — curated keyless IOC events (MISP JSON standard),
 * served pre-merged by /api/network/feeds/circlmisp (multi-file walk).
 */
async function fetchCirclMisp(): Promise<ThreatEvent[]> {
  // first call may walk the ~19 MB CIRCL manifest server-side: long timeout
  const txt = await fetchFeed('circlmisp', undefined, 120_000);
  let events: Record<string, unknown>[] = [];
  try {
    events = JSON.parse(txt) as Record<string, unknown>[];
  } catch {
    return [];
  }
  if (!Array.isArray(events)) return [];
  const out: ThreatEvent[] = [];
  const mispTs = (v: unknown): number => {
    const s = String(v ?? '').trim();
    if (/^\d{10}$/.test(s)) return Number(s) * 1000;
    const t = parseUtc(s);
    return t > 0 ? t : Date.now();
  };
  for (const ev of events.slice(0, 12)) {
    const rawTags = Array.isArray(ev.Tag) ? ev.Tag : [];
    const tagStr = rawTags
      .map((t) => String((t as Record<string, unknown>).name ?? ''))
      .join(' ')
      .toLowerCase();
    const info = String(ev.info ?? 'MISP event').replace(/[—–]/g, '·').slice(0, 140);
    let kind: ThreatKind = 'malware';
    if (/phish/.test(tagStr)) kind = 'phish';
    else if (/ransom/.test(tagStr)) kind = 'ransom';
    else if (/botnet|c&c|c2/.test(tagStr)) kind = 'c2';
    const attrs = Array.isArray(ev.Attribute) ? ev.Attribute : [];
    for (const a of attrs.slice(0, 25)) {
      const row = a as Record<string, unknown>;
      const type = String(row.type ?? '');
      const val = String(row.value ?? '').trim();
      const toIds = row.to_ids === false ? [] : ['to-ids'];
      if (type === 'ip-dst' || type === 'ip-src') {
        if (!isIPv4(val)) continue;
        out.push({
          id: uid('circlmisp'),
          ts: mispTs(row.timestamp ?? ev.timestamp),
          source: 'circlmisp' as const,
          kind,
          severity: clamp(KIND_BASE_SEVERITY[kind] - 6 + toIds.length * 4, 25, 92),
          ip: val,
          tags: [...toIds, info],
          meta: { event: info, attrType: type, uuid: row.uuid },
        });
      } else if (type === 'domain' || type === 'hostname') {
        if (!/^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}$/i.test(val)) continue;
        out.push({
          id: uid('circlmisp'),
          ts: mispTs(row.timestamp ?? ev.timestamp),
          source: 'circlmisp' as const,
          kind,
          severity: clamp(KIND_BASE_SEVERITY[kind] - 10, 20, 90),
          host: val.toLowerCase(),
          tags: [...toIds, info],
          meta: { event: info, attrType: type, uuid: row.uuid },
        });
      }
      if (out.length >= 300) return out;
    }
  }
  return out;
}

/**
 * CISA Known Exploited Vulnerabilities — authoritative exploited-in-the-wild
 * CVE list (US Gov public domain). Strategic patching intel: no geo, so these
 * surface in the feed list and health pane, not on the globe.
 */
async function fetchKev(): Promise<ThreatEvent[]> {
  const txt = await fetchFeed('kev');
  const j = JSON.parse(txt) as { vulnerabilities?: Record<string, unknown>[] };
  const rows = Array.isArray(j.vulnerabilities) ? j.vulnerabilities : [];
  const out: ThreatEvent[] = [];
  for (const v of rows.slice(-40)) {
    const cve = String(v.cveID ?? '').trim();
    if (!cve) continue;
    const ransom =
      String(v.knownRansomwareCampaignUse ?? '').toLowerCase() === 'known';
    const vendor = String(v.vendorProject ?? '').trim();
    const product = String(v.product ?? '').trim();
    out.push({
      id: uid('kev'),
      ts: parseUtc(String(v.dateAdded ?? '')),
      source: 'kev' as const,
      kind: 'vuln' as const,
      severity: ransom ? 95 : KIND_BASE_SEVERITY.vuln,
      host: cve,
      tags: [ransom ? 'ransomware-linked' : 'exploited-in-wild', vendor, product]
        .filter(Boolean),
      meta: {
        vendor,
        product,
        shortDescription: String(v.shortDescription ?? '').slice(0, 300),
        requiredAction: String(v.requiredAction ?? '').slice(0, 300),
        dueDate: v.dueDate,
      },
    });
  }
  return out;
}


export type Adapter = {
  id: ThreatSourceId;
  label: string;
  intervalMs: number;
  offsetMs: number;
  fetch: () => Promise<ThreatEvent[]>;
};

export const ADAPTERS: Adapter[] = [
  {
    id: 'feodo',
    label: SOURCE_LABEL.feodo,
    intervalMs: 10 * 60_000,
    offsetMs: 0,
    fetch: fetchFeodo,
  },
  {
    id: 'isc',
    label: SOURCE_LABEL.isc,
    intervalMs: 10 * 60_000,
    offsetMs: 2_500,
    fetch: fetchIsc,
  },
  {
    id: 'urlhaus',
    label: SOURCE_LABEL.urlhaus,
    intervalMs: 15 * 60_000,
    offsetMs: 5_000,
    fetch: fetchUrlhaus,
  },
  {
    id: 'openphish',
    label: SOURCE_LABEL.openphish,
    intervalMs: 30 * 60_000,
    offsetMs: 6_500,
    fetch: fetchOpenPhish,
  },
  {
    id: 'ransomlive',
    label: SOURCE_LABEL.ransomlive,
    intervalMs: 15 * 60_000,
    offsetMs: 9_000,
    fetch: fetchRansomLive,
  },
  {
    id: 'threatfox',
    label: SOURCE_LABEL.threatfox,
    intervalMs: 15 * 60_000,
    offsetMs: 7_500,
    fetch: fetchThreatFox,
  },
  {
    id: 'dshield',
    label: SOURCE_LABEL.dshield,
    intervalMs: 10 * 60_000,
    offsetMs: 10_000,
    fetch: fetchDshield,
  },
  {
    id: 'blocklistde',
    label: SOURCE_LABEL.blocklistde,
    intervalMs: 15 * 60_000,
    offsetMs: 12_500,
    fetch: fetchBlocklistDe,
  },
  {
    id: 'spamhaus',
    label: SOURCE_LABEL.spamhaus,
    intervalMs: 24 * 60_000,
    offsetMs: 15_000,
    fetch: fetchSpamhaus,
  },
  {
    id: 'firehol',
    label: SOURCE_LABEL.firehol,
    intervalMs: 30 * 60_000,
    offsetMs: 17_000,
    fetch: fetchFirehol,
  },
  {
    id: 'cinsarmy',
    label: SOURCE_LABEL.cinsarmy,
    intervalMs: 20 * 60_000,
    offsetMs: 19_000,
    fetch: fetchCinsArmy,
  },
  {
    id: 'greensnow',
    label: SOURCE_LABEL.greensnow,
    intervalMs: 20 * 60_000,
    offsetMs: 21_000,
    fetch: fetchGreensnow,
  },
  {
    id: 'blackbook',
    label: SOURCE_LABEL.blackbook,
    intervalMs: 45 * 60_000,
    offsetMs: 23_000,
    fetch: fetchBlackbook,
  },
  {
    id: 'circlmisp',
    label: SOURCE_LABEL.circlmisp,
    intervalMs: 120 * 60_000,
    offsetMs: 26_000,
    fetch: fetchCirclMisp,
  },
  {
    id: 'kev',
    label: SOURCE_LABEL.kev,
    intervalMs: 120 * 60_000,
    offsetMs: 28_500,
    fetch: fetchKev,
  },
];
