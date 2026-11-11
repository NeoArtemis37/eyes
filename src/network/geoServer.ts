

export type ServerGeo = {
  lat: number;
  lon: number;
  city?: string;
  country?: string;
  asn?: string;
};

export type LookupResult =
  | { geo: ServerGeo; definitive: true } // resolved
  | { geo: null; definitive: true } // provider says: unknown/reserved
  | { geo: null; definitive: false }; // rate-limited/timeout → retry later

const UA = 'HORUS-Intel/0.3 (+OSINT feed aggregator; fair-use)';

const HIT_TTL = 6 * 3600 * 1000; // resolved → 6 h
const MISS_TTL = 30 * 60 * 1000; // definitive miss → 30 min (retry later)

const cache = new Map<string, { ts: number; res: LookupResult }>();

const cacheHit = (ip: string): LookupResult | null => {
  const hit = cache.get(ip);
  if (!hit) return null;
  const ttl = hit.res.geo ? HIT_TTL : MISS_TTL;
  return Date.now() - hit.ts < ttl ? hit.res : null;
};


async function ipwhoIs(ip: string): Promise<LookupResult> {
  try {
    const res = await fetch(`https://ipwho.is/${encodeURIComponent(ip)}`, {
      headers: { Accept: 'application/json', 'User-Agent': UA },
      signal: AbortSignal.timeout(6000),
      cache: 'no-store',
    });
    const j = (await res.json()) as Record<string, unknown>;
    if (j.success === true && typeof j.latitude === 'number') {
      const conn = (j.connection ?? {}) as Record<string, unknown>;
      const geo: ServerGeo = {
        lat: j.latitude as number,
        lon: j.longitude as number,
        city: (j.city as string) || undefined,
        country: (j.country as string) || undefined,
        asn:
          conn.asn !== undefined
            ? `${conn.asn} ${conn.org ?? ''}`.trim()
            : undefined,
      };
      return { geo, definitive: true };
    }
    if (/rate\s*limit/i.test(String(j.message ?? ''))) {
      return { geo: null, definitive: false };
    }
    return { geo: null, definitive: true }; // explicit unknown IP
  } catch {
    return { geo: null, definitive: false };
  }
}

async function ipApiSingle(ip: string): Promise<LookupResult> {
  try {
    const res = await fetch(
      `http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,message,country,city,lat,lon,as`,
      {
        headers: { 'User-Agent': UA },
        signal: AbortSignal.timeout(6000),
        cache: 'no-store',
      }
    );
    if (res.status === 429) return { geo: null, definitive: false };
    const j = (await res.json()) as Record<string, unknown>;
    if (j.status === 'success' && typeof j.lat === 'number') {
      const geo: ServerGeo = {
        lat: j.lat as number,
        lon: j.lon as number,
        city: (j.city as string) || undefined,
        country: (j.country as string) || undefined,
        asn: (j.as as string) || undefined,
      };
      return { geo, definitive: true };
    }
    return { geo: null, definitive: true };
  } catch {
    return { geo: null, definitive: false };
  }
}

export async function lookupGeo(ip: string): Promise<LookupResult> {
  const hit = cacheHit(ip);
  if (hit) return hit;

  let res = await ipwhoIs(ip);
  if (!res.definitive) res = await ipApiSingle(ip); // provider down → chain

  if (res.definitive) cache.set(ip, { ts: Date.now(), res });
  return res;
}


export type BatchResult = {

  results: Record<string, ServerGeo | null>;
  transient: boolean;
};

const BATCH_URL =
  'http://ip-api.com/batch?fields=status,message,country,city,lat,lon,as';
const BATCH_MAX = 100;


export async function lookupGeoBatch(ips: string[]): Promise<BatchResult> {
  const results: Record<string, ServerGeo | null> = {};
  const need: string[] = [];

  for (const ip of ips) {
    const hit = cacheHit(ip);
    if (hit) {
      results[ip] = hit.geo;
      continue;
    }
    if (!need.includes(ip)) need.push(ip);
  }

  const slice = need.slice(0, BATCH_MAX);
  if (slice.length) {
    try {
      const res = await fetch(BATCH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'User-Agent': UA },
        body: JSON.stringify(slice),
        signal: AbortSignal.timeout(9000),
        cache: 'no-store',
      });
      if (res.status === 429) return { results, transient: true };
      const arr = (await res.json()) as Record<string, unknown>[];
      slice.forEach((ip, i) => {
        const j = Array.isArray(arr) ? arr[i] : undefined;
        if (j && j.status === 'success' && typeof j.lat === 'number') {
          const geo: ServerGeo = {
            lat: j.lat as number,
            lon: j.lon as number,
            city: (j.city as string) || undefined,
            country: (j.country as string) || undefined,
            asn: (j.as as string) || undefined,
          };
          results[ip] = geo;
          cache.set(ip, { ts: Date.now(), res: { geo, definitive: true } });
        } else if (j && j.status === 'fail') {
          results[ip] = null;
          cache.set(ip, { ts: Date.now(), res: { geo: null, definitive: true } });
        }
      });
    } catch {
      return { results, transient: true };
    }
  }
  return { results, transient: false };
}
