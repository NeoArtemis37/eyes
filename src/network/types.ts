

export type ThreatSourceId =
  | 'feodo'
  | 'threatfox'
  | 'urlhaus'
  | 'openphish'
  | 'ransomlive'
  | 'dshield'
  | 'isc'
  | 'blocklistde'
  | 'spamhaus'
  | 'firehol'
  | 'cinsarmy'
  | 'greensnow'
  | 'blackbook'
  | 'greynoise'
  | 'shodan'
  | 'crt'
  | 'pdns'
  | 'cloudflare'
  | 'circlmisp'
  | 'kev';

export type ThreatKind =
  | 'c2'
  | 'malware'
  | 'phish'
  | 'ransom'
  | 'scan'
  | 'attack'
  | 'bgp'
  | 'dns'
  | 'vuln';

export type ThreatGeo = {
  lat: number;
  lon: number;
  city?: string;
  country?: string;
  asn?: string;
};

export type ThreatEvent = {
  id: string;
  ts: number;
  source: ThreatSourceId;
  kind: ThreatKind;
  severity: number;
  ip?: string;
  host?: string;
  url?: string;
  port?: number;
  protocol?: string;
  geo?: ThreatGeo;
  tags: string[];
  meta: Record<string, unknown>;
};

export type SourceStatus = {
  id: ThreatSourceId;
  label: string;
  ok: boolean;
  count: number;
  lastFetch: number;
  lastError?: string;
  nextFetch: number;
  /** Round-trip duration of the last successful fetch (ms). */
  latencyMs?: number;
  /** true when the source was healthy but its data is older than 2 intervals. */
  stale?: boolean;
};

export type FeedStats = {
  total: number;
  byKind: Record<ThreatKind, number>;
  bySource: Partial<Record<ThreatSourceId, number>>;
  geolocated: number;
  topCountries: { key: string; count: number }[];
  topAsn: { key: string; count: number }[];
  topPorts: { key: number; count: number }[];
};

export const KINDS: ThreatKind[] = [
  'c2', 'malware', 'phish', 'ransom', 'scan', 'attack', 'vuln',
];


export const KIND_HUE: Record<ThreatKind, number> = {
  attack: 0,
  phish: 42,
  malware: 150,
  scan: 205,
  c2: 275,
  ransom: 320,
  bgp: 230,
  dns: 172,
  vuln: 65,
};

export const KIND_COLOR: Record<ThreatKind, string> = {
  attack: 'hsl(0 92% 64%)',
  phish: 'hsl(42 95% 62%)',
  malware: 'hsl(150 90% 60%)',
  scan: 'hsl(205 95% 66%)',
  c2: 'hsl(275 92% 68%)',
  ransom: 'hsl(320 95% 66%)',
  bgp: 'hsl(230 90% 68%)',
  dns: 'hsl(172 90% 58%)',
  vuln: 'hsl(65 85% 58%)',
};

export const KIND_GLOW: Record<ThreatKind, string> = {
  attack: 'hsla(0 92% 58% / 0.45)',
  phish: 'hsla(42 95% 56% / 0.45)',
  malware: 'hsla(150 90% 55% / 0.45)',
  scan: 'hsla(205 95% 62% / 0.45)',
  c2: 'hsla(275 92% 66% / 0.45)',
  ransom: 'hsla(320 95% 60% / 0.45)',
  bgp: 'hsla(230 90% 64% / 0.45)',
  dns: 'hsla(172 90% 52% / 0.45)',
  vuln: 'hsla(65 85% 55% / 0.45)',
};

export const KIND_TINT: Record<ThreatKind, string> = {
  attack: 'hsla(0 92% 58% / 0.12)',
  phish: 'hsla(42 95% 56% / 0.12)',
  malware: 'hsla(150 90% 55% / 0.12)',
  scan: 'hsla(205 95% 62% / 0.12)',
  c2: 'hsla(275 92% 66% / 0.12)',
  ransom: 'hsla(320 95% 60% / 0.12)',
  bgp: 'hsla(230 90% 64% / 0.12)',
  dns: 'hsla(172 90% 52% / 0.12)',
  vuln: 'hsla(65 85% 55% / 0.12)',
};

export const KIND_BASE_SEVERITY: Record<ThreatKind, number> = {
  c2: 82,
  malware: 72,
  phish: 58,
  ransom: 74,
  attack: 52,
  scan: 34,
  bgp: 30,
  dns: 28,
  vuln: 85,
};

export const SOURCE_LABEL: Record<ThreatSourceId, string> = {
  feodo: 'abuse.ch Feodo',
  threatfox: 'abuse.ch ThreatFox',
  urlhaus: 'abuse.ch URLhaus',
  openphish: 'OpenPhish',
  ransomlive: 'Ransomware.live',
  dshield: 'DShield',
  isc: 'SANS ISC',
  blocklistde: 'blocklist.de',
  spamhaus: 'Spamhaus DROP',
  firehol: 'FireHOL L1',
  cinsarmy: 'CINS Army',
  greensnow: 'GreenSnow',
  blackbook: 'Blackbook',
  greynoise: 'GreyNoise',
  shodan: 'Shodan IDB',
  crt: 'crt.sh',
  pdns: 'CIRCL pDNS',
  cloudflare: 'CF Radar',
  circlmisp: 'CIRCL MISP OSINT',
  kev: 'CISA KEV',
};


export type BreachItem = {
  id: string;
  name: string;
  title: string;
  domain?: string;
  breachDate: string;
  pwnCount: number;
  dataClasses: string[];
  description: string;
  verified: boolean;
  sensitive: boolean;
  malware: boolean;
  country?: string;
  countryEvidence?: 'tld' | 'text';
  geo?: { lon: number; lat: number };
  isAfrica: boolean;
  severity: number;
};

export const clamp = (v: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, v));
