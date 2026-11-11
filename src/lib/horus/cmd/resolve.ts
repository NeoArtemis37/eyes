

import { stealthFetchJSON } from '@/lib/stealthFetch';


export interface DnsResolution {
  domain: string;
  ips: string[];
  ips6: string[];
  cnames: string[];
  ms: number;
}

export interface IpIntel {
  ip: string;
  lat: number;
  lng: number;
  city: string;
  region: string;
  country: string;
  countryCode: string;
  isp: string;
  org: string;
  asn: string;
  timezone: string;
  zip: string;
  source: string;
}

export interface TrackResolution {
  requested: string;
  resolvedFromDomain: boolean;
  ip: string;
  rdns?: string;
  intel: IpIntel | null;
  dns?: DnsResolution;
  errors: string[];
}


const TTL = 10 * 60 * 1000; // 10 min
const cache = new Map<string, { value: unknown; expiry: number }>();

async function cached<T>(key: string, producer: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && hit.expiry > Date.now()) return hit.value as T;
  const value = await producer();
  cache.set(key, { value, expiry: Date.now() + TTL });
  return value;
}


interface DoHAnswer {
  name: string;
  type: number; // 1 = A, 5 = CNAME, 28 = AAAA, 12 = PTR
  TTL?: number;
  data: string;
}

async function doh(name: string, type: string): Promise<DoHAnswer[]> {
  const url = `https://dns.google/resolve?name=${encodeURIComponent(name)}&type=${type}`;
  const data = await stealthFetchJSON<{ Answer?: DoHAnswer[] }>(url, {
    timeout: 5000,
    retries: 1,
    stealth: false,
    headers: { Accept: 'application/json' },
  });
  return data.Answer ?? [];
}

export async function resolveDomain(domain: string): Promise<DnsResolution | null> {
  const host = domain.trim().replace(/^\w+:\/\//, '').replace(/\/.*$/, '').replace(/\.$/, '');
  if (!host) return null;
  return cached(`dns:${host.toLowerCase()}`, async () => {
    const t0 = Date.now();
    const [a, aaaa, cname] = await Promise.allSettled([
      doh(host, 'A'),
      doh(host, 'AAAA'),
      doh(host, 'CNAME'),
    ]);
    const ips = a.status === 'fulfilled'
      ? a.value.filter((r) => r.type === 1 && /^\d+\.\d+\.\d+\.\d+$/.test(r.data)).map((r) => r.data)
      : [];
    const ips6 = aaaa.status === 'fulfilled'
      ? aaaa.value.filter((r) => r.type === 28 && r.data.includes(':')).map((r) => r.data)
      : [];
    const cnames = cname.status === 'fulfilled'
      ? cname.value.filter((r) => r.type === 5).map((r) => r.data)
      : [];
    return { domain: host, ips, ips6, cnames, ms: Date.now() - t0 } satisfies DnsResolution;
  });
}

export async function reverseDns(ip: string): Promise<string | null> {
  const arpa = `${ip.split('.').reverse().join('.')}.in-addr.arpa`;
  return cached(`ptr:${ip}`, async () => {
    try {
      const answers = await doh(arpa, 'PTR');
      const ptr = answers.find((r) => r.type === 12);
      return ptr ? ptr.data.replace(/\.$/, '') : null;
    } catch {
      return null;
    }
  });
}


export async function geolocateIp(ip: string): Promise<IpIntel | null> {
  return cached(`ipgeo:${ip}`, async () => {
    try {
      const fields = 'status,message,country,countryCode,region,regionName,city,zip,lat,lon,timezone,isp,org,as,query';
      const data = await stealthFetchJSON<Record<string, unknown>>(
        `http://ip-api.com/json/${encodeURIComponent(ip)}?fields=${fields}`,
        { timeout: 7000, retries: 1, stealth: false }
      );
      if (data.status === 'fail') return null;
      const lat = Number(data.lat);
      const lng = Number(data.lon);
      if (!Number.isFinite(lat) || !Number.isFinite(lng) || (lat === 0 && lng === 0)) return null;
      return {
        ip: String(data.query ?? ip),
        lat,
        lng,
        city: String(data.city ?? ''),
        region: String(data.regionName ?? ''),
        country: String(data.country ?? ''),
        countryCode: String(data.countryCode ?? ''),
        isp: String(data.isp ?? ''),
        org: String(data.org ?? ''),
        asn: String(data.as ?? ''),
        timezone: String(data.timezone ?? ''),
        zip: String(data.zip ?? ''),
        source: 'ip-api.com',
      } satisfies IpIntel;
    } catch {
      return null;
    }
  });
}

export async function selfLocate(): Promise<IpIntel | null> {
  try {
    const fields = 'status,message,country,countryCode,region,regionName,city,zip,lat,lon,timezone,isp,org,as,query';
    const data = await stealthFetchJSON<Record<string, unknown>>(
      `http://ip-api.com/json/?fields=${fields}`,
      { timeout: 7000, retries: 1, stealth: false }
    );
    if (data.status === 'fail') return null;
    return {
      ip: String(data.query ?? ''),
      lat: Number(data.lat),
      lng: Number(data.lon),
      city: String(data.city ?? ''),
      region: String(data.regionName ?? ''),
      country: String(data.country ?? ''),
      countryCode: String(data.countryCode ?? ''),
      isp: String(data.isp ?? ''),
      org: String(data.org ?? ''),
      asn: String(data.as ?? ''),
      timezone: String(data.timezone ?? ''),
      zip: String(data.zip ?? ''),
      source: 'ip-api.com (self)',
    };
  } catch {
    return null;
  }
}


export async function resolveTrack(target: string): Promise<TrackResolution> {
  const errors: string[] = [];
  let requested = target.trim();
  let resolvedFromDomain = false;
  let dns: DnsResolution | undefined;
  let ip = requested;

  const domainLike = !/^\d+\.\d+\.\d+\.\d+$/.test(ip);
  if (domainLike) {
    const res = await resolveDomain(requested);
    if (!res || res.ips.length === 0) {
      errors.push(`DNS : aucune adresse IPv4 pour ${requested}${res && res.ips6.length ? ' (IPv6 uniquement)' : ''}`);
      return { requested, resolvedFromDomain, ip: requested, intel: null, dns: res ?? undefined, errors };
    }
    resolvedFromDomain = true;
    dns = res;
    ip = res.ips[0];
    if (res.ips.length > 1) errors.push(`${res.ips.length} IPv4 · cible : ${ip}`);
  }

  const [intel, rdns] = await Promise.all([geolocateIp(ip), reverseDns(ip)]);
  if (!intel) errors.push(`Géolocalisation indisponible pour ${ip}`);

  return { requested, resolvedFromDomain, ip, rdns: rdns ?? undefined, intel, dns, errors };
}

export function describeTrack(t: TrackResolution): string {
  if (!t.intel) {
    return `${t.requested}${t.resolvedFromDomain ? ` → ${t.ip}` : ''} · position inconnue`;
  }
  const place = [t.intel.city, t.intel.region, t.intel.country].filter(Boolean).join(', ');
  const net = [t.rdns ? `${t.rdns}` : null, t.intel.isp, t.intel.asn.split(' ')[0]]
    .filter(Boolean)
    .join(' · ');
  return `${t.requested}${t.resolvedFromDomain ? ` → ${t.ip}` : ''} · ${place || 'position approximative'}${net ? ` (${net})` : ''}`;
}
