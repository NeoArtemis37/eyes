import { NextResponse } from 'next/server';
import { stealthFetchJSON } from '@/lib/stealthFetch';

const cache = new Map<string, { data: any; expiry: number }>();
const CACHE_TTL = 5 * 60 * 1000;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const domain = searchParams.get('domain');
  if (!domain) return NextResponse.json({ error: 'Missing domain parameter' }, { status: 400 });

  if (!/^[a-zA-Z0-9][a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(domain)) {
    return NextResponse.json({ error: 'Invalid domain format' }, { status: 400 });
  }

  const cacheKey = `dns:${domain}`;
  const cached = cache.get(cacheKey);
  if (cached && cached.expiry > Date.now()) {
    return NextResponse.json({ ...cached.data, cached: true });
  }

  try {
    const types = ['A', 'AAAA', 'MX', 'NS', 'TXT', 'CNAME', 'SOA'];
    const results: any = { domain, records: {}, timestamp: new Date().toISOString() };

    const lookups = await Promise.allSettled(
      types.map(async (type) => {
        try {
          const data = await stealthFetchJSON<any>(
            `https://dns.google/resolve?name=${encodeURIComponent(domain)}&type=${type}`,
            { timeout: 5000, stealth: true }
          );
          return { type, answers: data.Answer || [], status: data.Status };
        } catch {
          return { type, answers: [], status: -1 };
        }
      })
    );

    for (const result of lookups) {
      if (result.status === 'fulfilled') {
        const { type, answers } = result.value;
        if (answers.length > 0) {
          results.records[type] = answers.map((a: any) => ({
            name: a.name,
            type: a.type,
            ttl: a.TTL,
            data: a.data,
          }));
        }
      }
    }

    const aRecords = results.records.A || [];
    const mxRecords = results.records.MX || [];
    const nsRecords = results.records.NS || [];

    results.summary = {
      ip_addresses: aRecords.map((r: any) => r.data),
      mail_servers: mxRecords.map((r: any) => r.data),
      nameservers: nsRecords.map((r: any) => r.data),
      total_records: Object.values(results.records).flat().length,
    };

    cache.set(cacheKey, { data: results, expiry: Date.now() + CACHE_TTL });

    return NextResponse.json(results);
  } catch {
    return NextResponse.json({ error: 'DNS lookup failed' }, { status: 500 });
  }
}
