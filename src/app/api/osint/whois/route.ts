import { NextResponse } from 'next/server';
import { stealthFetch, stealthFetchJSON } from '@/lib/stealthFetch';

const cache = new Map<string, { data: any; expiry: number }>();
const CACHE_TTL = 5 * 60 * 1000;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const domain = searchParams.get('domain');
  if (!domain) return NextResponse.json({ error: 'Missing domain parameter' }, { status: 400 });

  if (!/^[a-zA-Z0-9][a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(domain)) {
    return NextResponse.json({ error: 'Invalid domain format' }, { status: 400 });
  }

  const cacheKey = `whois:${domain}`;
  const cached = cache.get(cacheKey);
  if (cached && cached.expiry > Date.now()) {
    return NextResponse.json({ ...cached.data, cached: true });
  }

  try {
    const results: any = { domain, timestamp: new Date().toISOString() };

    try {
      const data = await stealthFetchJSON<any>(
        `https://rdap.org/domain/${encodeURIComponent(domain)}`,
        { timeout: 8000, stealth: true }
      );

      results.rdap = {
        handle: data.handle,
        name: data.ldhName,
        status: data.status,
        events: (data.events || []).map((e: any) => ({
          action: e.eventAction,
          date: e.eventDate,
        })),
        nameservers: (data.nameservers || []).map((ns: any) => ns.ldhName),
        entities: (data.entities || []).map((e: any) => ({
          handle: e.handle,
          roles: e.roles,
          name: e.vcardArray?.[1]?.find((v: any) => v[0] === 'fn')?.[3],
          org: e.vcardArray?.[1]?.find((v: any) => v[0] === 'org')?.[3],
        })).filter((e: any) => e.name || e.org),
      };

      const events = results.rdap.events || [];
      results.registration = events.find((e: any) => e.action === 'registration')?.date;
      results.expiration = events.find((e: any) => e.action === 'expiration')?.date;
      results.last_changed = events.find((e: any) => e.action === 'last changed')?.date;
    } catch (e) {
      console.warn('[HORUS] RDAP lookup failed:', e instanceof Error ? e.message : e);
      results.rdap = null;
      results.registration = null;
      results.expiration = null;
    }

    try {
      const res = await stealthFetch(`https://${domain}`, {
        method: 'HEAD',
        timeout: 5000,
        stealth: true,
      });
      const headers: Record<string, string> = {};
      ['server', 'x-powered-by', 'x-frame-options', 'strict-transport-security',
        'content-security-policy', 'x-content-type-options', 'x-xss-protection',
        'referrer-policy', 'permissions-policy'].forEach(h => {
        const v = res.headers.get(h);
        if (v) headers[h] = v;
      });
      results.http = {
        status: res.status,
        headers,
        redirected: res.redirected,
        final_url: res.url,
      };

      let score = 0;
      if (headers['strict-transport-security']) score += 2;
      if (headers['content-security-policy']) score += 2;
      if (headers['x-frame-options']) score += 1;
      if (headers['x-content-type-options']) score += 1;
      if (headers['referrer-policy']) score += 1;
      results.security_score = {
        score,
        max: 7,
        grade: score >= 5 ? 'A' : score >= 3 ? 'B' : score >= 1 ? 'C' : 'F'
      };
    } catch (e) {
      console.warn('[HORUS] HTTP header check failed:', e instanceof Error ? e.message : e);
    }

    cache.set(cacheKey, { data: results, expiry: Date.now() + CACHE_TTL });

    return NextResponse.json(results);
  } catch {
    return NextResponse.json({ error: 'WHOIS lookup failed' }, { status: 500 });
  }
}
