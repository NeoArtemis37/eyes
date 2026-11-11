import { NextResponse } from 'next/server';
import { stealthFetchJSON } from '@/lib/stealthFetch';

const cache = new Map<string, { data: any; expiry: number }>();
const CACHE_TTL = 5 * 60 * 1000;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const ip = searchParams.get('ip');
  if (!ip) return NextResponse.json({ error: 'Missing ip parameter' }, { status: 400 });

  if (!/^(\d{1,3}\.){3}\d{1,3}$/.test(ip)) {
    return NextResponse.json({ error: 'Invalid IP format. Expected: x.x.x.x' }, { status: 400 });
  }

  const cacheKey = `shodan:${ip}`;
  const cached = cache.get(cacheKey);
  if (cached && cached.expiry > Date.now()) {
    return NextResponse.json({ ...cached.data, cached: true });
  }

  try {
    const apiKey = process.env.SHODAN_API_KEY;
    const results: any = { ip, timestamp: new Date().toISOString() };

    if (apiKey) {
      try {
        const data = await stealthFetchJSON<any>(
          `https://api.shodan.io/shodan/host/${encodeURIComponent(ip)}?key=${apiKey}`,
          { timeout: 10000, stealth: false }
        );

        results.ip_str = data.ip_str;
        results.hostnames = data.hostnames || [];
        results.ports = data.ports || [];
        results.os = data.os || null;
        results.org = data.org || null;
        results.isp = data.isp || null;
        results.country_name = data.country_name || null;
        results.country_code = data.country_code || null;
        results.city = data.city || null;
        results.latitude = data.latitude || null;
        results.longitude = data.longitude || null;
        results.vulns = data.vulns || [];
        results.tags = data.tags || [];
        results.data = (data.data || []).slice(0, 5).map((d: any) => ({
          port: d.port,
          protocol: d._shodan?.module || 'unknown',
          product: d.product || null,
          version: d.version || null,
          banner: d.data ? d.data.slice(0, 200) : null,
        }));
        results.data_source = 'shodan-api';
      } catch (e: any) {
        console.warn('[HORUS] Shodan API failed, falling back to InternetDB:', e.message);
        results.data_source = 'shodan-internetdb (api-fallback)';
      }
    }

    if (!results.data_source || results.data_source.includes('fallback')) {
      try {
        const data = await stealthFetchJSON<any>(
          `https://internetdb.shodan.io/${encodeURIComponent(ip)}`,
          { timeout: 8000, stealth: false }
        );

        if (data && !data.detail) {
          results.ports = data.ports || [];
          results.hostnames = data.hostnames || [];
          results.cpes = data.cpes || [];
          results.vulns = data.vulns || [];
          results.tags = data.tags || [];
          results.data_source = 'shodan-internetdb';
        } else {
          results.ports = [];
          results.hostnames = [];
          results.vulns = [];
          results.tags = [];
          results.data_source = 'shodan-internetdb';
          results.note = 'No Shodan InternetDB records found for this IP';
        }
      } catch {
        results.ports = [];
        results.hostnames = [];
        results.vulns = [];
        results.tags = [];
        results.data_source = 'unavailable';
        results.note = 'Shodan data unavailable';
      }
    }

    const vulnCount = results.vulns?.length || 0;
    const portCount = results.ports?.length || 0;
    results.risk_level = vulnCount >= 5 ? 'CRITICAL' : vulnCount >= 2 ? 'HIGH' : portCount >= 10 ? 'MEDIUM' : 'LOW';

    const deviceType = classifyDevice(results.ports || [], results.tags || []);
    results.device_type = deviceType;

    cache.set(cacheKey, { data: results, expiry: Date.now() + CACHE_TTL });

    return NextResponse.json(results);
  } catch {
    return NextResponse.json({ error: 'Shodan lookup failed' }, { status: 500 });
  }
}

function classifyDevice(ports: number[], tags: string[]): string {
  if (tags.includes('webcam') || tags.includes('camera')) return 'Camera';
  if (tags.includes('router') || ports.includes(53)) return 'Router/DNS';
  if (tags.includes('vpn') || ports.includes(1194) || ports.includes(500)) return 'VPN Gateway';
  if (ports.includes(3306) || ports.includes(5432) || ports.includes(27017)) return 'Database Server';
  if (ports.includes(25) || ports.includes(110) || ports.includes(143)) return 'Mail Server';
  if (ports.includes(80) || ports.includes(443)) return 'Web Server';
  if (ports.includes(22)) return 'SSH Server';
  if (ports.includes(3389)) return 'Remote Desktop';
  if (ports.includes(21)) return 'FTP Server';
  return 'Unknown Device';
}
