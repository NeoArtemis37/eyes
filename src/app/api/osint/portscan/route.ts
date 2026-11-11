import { NextResponse } from 'next/server';
import { stealthFetchJSON } from '@/lib/stealthFetch';

const cache = new Map<string, { data: any; expiry: number }>();
const CACHE_TTL = 5 * 60 * 1000;

const COMMON_PORTS: Record<number, { service: string; risk: 'low' | 'medium' | 'high' }> = {
  21: { service: 'FTP', risk: 'high' },
  22: { service: 'SSH', risk: 'low' },
  23: { service: 'Telnet', risk: 'high' },
  25: { service: 'SMTP', risk: 'medium' },
  53: { service: 'DNS', risk: 'low' },
  80: { service: 'HTTP', risk: 'low' },
  110: { service: 'POP3', risk: 'medium' },
  111: { service: 'RPCBind', risk: 'high' },
  135: { service: 'MSRPC', risk: 'high' },
  139: { service: 'NetBIOS', risk: 'high' },
  143: { service: 'IMAP', risk: 'medium' },
  443: { service: 'HTTPS', risk: 'low' },
  445: { service: 'SMB', risk: 'high' },
  993: { service: 'IMAPS', risk: 'low' },
  995: { service: 'POP3S', risk: 'low' },
  1433: { service: 'MSSQL', risk: 'high' },
  1521: { service: 'Oracle DB', risk: 'high' },
  3306: { service: 'MySQL', risk: 'high' },
  3389: { service: 'RDP', risk: 'high' },
  5432: { service: 'PostgreSQL', risk: 'high' },
  5900: { service: 'VNC', risk: 'high' },
  6379: { service: 'Redis', risk: 'high' },
  8080: { service: 'HTTP-Alt', risk: 'medium' },
  8443: { service: 'HTTPS-Alt', risk: 'medium' },
  9200: { service: 'Elasticsearch', risk: 'high' },
  27017: { service: 'MongoDB', risk: 'high' },
};

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const target = searchParams.get('target');
  if (!target) return NextResponse.json({ error: 'Missing target parameter' }, { status: 400 });

  const isIP = /^(\d{1,3}\.){3}\d{1,3}$/.test(target);
  if (!isIP && !/^[a-zA-Z0-9][a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(target)) {
    return NextResponse.json({ error: 'Invalid target format' }, { status: 400 });
  }

  const cacheKey = `portscan:${target}`;
  const cached = cache.get(cacheKey);
  if (cached && cached.expiry > Date.now()) {
    return NextResponse.json({ ...cached.data, cached: true });
  }

  try {
    const results: any = { target, timestamp: new Date().toISOString() };

    let ip = target;
    if (!isIP) {
      try {
        const dnsData = await stealthFetchJSON<any>(
          `https://dns.google/resolve?name=${encodeURIComponent(target)}&type=A`,
          { timeout: 5000, stealth: true }
        );
        if (dnsData.Answer && dnsData.Answer.length > 0) {
          ip = dnsData.Answer[0].data;
          results.resolved_ip = ip;
        }
      } catch { /* proceed with domain */ }
    }

    try {
      const shodanData = await stealthFetchJSON<any>(
        `https://internetdb.shodan.io/${encodeURIComponent(ip)}`,
        { timeout: 8000, stealth: false }
      );

      if (shodanData && !shodanData.detail) {
        const openPorts = (shodanData.ports || []).map((port: number) => {
          const known = COMMON_PORTS[port];
          return {
            port,
            state: 'open',
            service: known?.service || 'unknown',
            risk: known?.risk || 'low',
          };
        });

        results.open_ports = openPorts;
        results.hostnames = shodanData.hostnames || [];
        results.cpes = shodanData.cpes || [];
        results.vulns = shodanData.vulns || [];
        results.tags = shodanData.tags || [];
        results.total_open = openPorts.length;
        results.high_risk_ports = openPorts.filter((p: any) => p.risk === 'high').length;
        results.data_source = 'shodan-internetdb';
      } else {
        results.open_ports = [];
        results.total_open = 0;
        results.data_source = 'shodan-internetdb';
        results.note = 'No Shodan InternetDB records found for this target';
      }
    } catch {
      results.open_ports = [];
      results.total_open = 0;
      results.data_source = 'unavailable';
      results.note = 'Shodan InternetDB unavailable · real port scanning requires native tools';
    }

    const highRisk = results.high_risk_ports || 0;
    results.risk_level = highRisk >= 3 ? 'CRITICAL' : highRisk >= 1 ? 'HIGH' : results.total_open > 5 ? 'MEDIUM' : 'LOW';

    cache.set(cacheKey, { data: results, expiry: Date.now() + CACHE_TTL });

    return NextResponse.json(results);
  } catch {
    return NextResponse.json({ error: 'Port scan failed' }, { status: 500 });
  }
}
