
import { NextResponse } from 'next/server';
import { stealthFetch, stealthFetchJSON } from '@/lib/stealthFetch';

let cachedData: { time: number; data: any } | null = null;
const CACHE_TTL = 600000; // 10 minutes

interface CISAVuln {
  cveID: string;
  vendorProject: string;
  product: string;
  vulnerabilityName: string;
  dateAdded: string;
  shortDescription: string;
  requiredAction: string;
  dueDate: string;
  knownRansomwareCampaignUse: string;
}

async function fetchCISAKEV(): Promise<any[]> {
  try {
    const data = await stealthFetchJSON<{ vulnerabilities: CISAVuln[] }>(
      'https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json',
      { timeout: 15000 }
    );

    if (!data.vulnerabilities) return [];

    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    return data.vulnerabilities
      .filter((v: CISAVuln) => new Date(v.dateAdded).getTime() > thirtyDaysAgo)
      .slice(0, 15)
      .map((v: CISAVuln) => ({
        id: v.cveID,
        type: 'vulnerability' as const,
        source: 'CISA KEV',
        name: v.vulnerabilityName,
        vendor: v.vendorProject,
        product: v.product,
        dateAdded: v.dateAdded,
        description: v.shortDescription,
        action: v.requiredAction,
        ransomware: v.knownRansomwareCampaignUse === 'Known',
        severity: v.knownRansomwareCampaignUse === 'Known' ? 'critical' : 'high',
      }));
  } catch (e: any) {
    console.error('[Cyber] CISA KEV fetch failed:', e.message);
    return [];
  }
}

async function fetchFeodoTracker(): Promise<any[]> {
  try {
    const response = await stealthFetch(
      'https://feodotracker.abuse.ch/downloads/ipblocklist.json',
      { timeout: 10000 }
    );
    if (!response.ok) return [];
    const data = await response.json();
    if (!Array.isArray(data)) return [];

    const countryMap = new Map<string, { country: string; count: number; threats: string[] }>();
    for (const entry of data.slice(0, 100)) {
      const country = entry.country || 'Unknown';
      const existing = countryMap.get(country) || { country, count: 0, threats: [] as string[] };
      existing.count++;
      if (entry.malware) existing.threats.push(entry.malware);
      countryMap.set(country, existing);
    }

    const countryCentroids: Record<string, { lat: number; lng: number }> = {
      'US': { lat: 39.83, lng: -98.58 }, 'CN': { lat: 35.86, lng: 104.20 },
      'RU': { lat: 61.52, lng: 105.32 }, 'DE': { lat: 51.17, lng: 10.45 },
      'FR': { lat: 46.23, lng: 2.21 }, 'BR': { lat: -14.24, lng: -51.93 },
      'IN': { lat: 20.59, lng: 78.96 }, 'NL': { lat: 52.13, lng: 5.29 },
      'GB': { lat: 55.38, lng: -3.44 }, 'KR': { lat: 35.91, lng: 127.77 },
      'JP': { lat: 36.20, lng: 138.25 }, 'AU': { lat: -25.27, lng: 133.78 },
      'IT': { lat: 41.87, lng: 12.57 }, 'ES': { lat: 40.46, lng: -3.75 },
      'CA': { lat: 56.13, lng: -106.35 }, 'UA': { lat: 48.38, lng: 31.17 },
      'RO': { lat: 45.94, lng: 24.97 }, 'CZ': { lat: 49.82, lng: 15.47 },
      'PL': { lat: 51.92, lng: 19.15 }, 'TR': { lat: 38.96, lng: 35.24 },
      'IR': { lat: 32.43, lng: 53.69 }, 'ID': { lat: -0.79, lng: 113.92 },
      'TH': { lat: 15.87, lng: 100.99 }, 'VN': { lat: 14.06, lng: 108.28 },
      'PH': { lat: 12.88, lng: 121.77 }, 'MX': { lat: 23.63, lng: -102.55 },
      'ZA': { lat: -30.56, lng: 22.94 }, 'NG': { lat: 9.08, lng: 8.68 },
    };

    return Array.from(countryMap.values())
      .filter(c => c.count > 0)
      .slice(0, 30)
      .map(c => {
        const centroid = countryCentroids[c.country];
        return {
          id: `FEODO-${c.country}`,
          type: 'botnet' as const,
          source: 'abuse.ch Feodo Tracker',
          country: c.country,
          lat: centroid ? centroid.lat + (Math.random() - 0.5) * 3 : 0,
          lng: centroid ? centroid.lng + (Math.random() - 0.5) * 3 : 0,
          count: c.count,
          threats: [...new Set(c.threats)].slice(0, 5),
          severity: c.count > 10 ? 'critical' : c.count > 5 ? 'high' : 'medium',
        };
      });
  } catch (e: any) {
    console.error('[Cyber] Feodo Tracker fetch failed:', e.message);
    return [];
  }
}

async function fetchURLhaus(): Promise<any[]> {
  try {
    const response = await stealthFetch(
      'https://urlhaus.abuse.ch/downloads/csv_online/',
      { timeout: 10000 }
    );
    if (!response.ok) return [];

    const text = await response.text();
    const lines = text.split('\n').filter(l => l && !l.startsWith('#'));

    const ips: { ip: string; threat: string }[] = [];
    for (const line of lines.slice(0, 200)) {
      const parts = line.split('","').map(p => p.replace(/"/g, '').trim());
      if (parts.length >= 5) {
        const url = parts[2] || '';
        const threat = parts[4] || 'Unknown';
        const ipMatch = url.match(/https?:\/\/(\d+\.\d+\.\d+\.\d+)/);
        if (ipMatch) ips.push({ ip: ipMatch[1], threat });
      }
    }

    if (ips.length === 0) return [];

    const batch = ips.slice(0, 100).map(ip => ip.ip);
    try {
      const geoResponse = await stealthFetch('http://ip-api.com/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(batch.map(ip => ({
          query: ip,
          fields: 'status,country,city,lat,lon,isp,as'
        }))),
        timeout: 8000,
      });
      if (!geoResponse.ok) return [];
      const geoData: any[] = await geoResponse.json();

      return geoData
        .filter((g: any) => g.status === 'success')
        .map((g: any, i: number) => ({
          id: `URLHAUS-${i}`,
          type: 'malware_dist' as const,
          source: 'abuse.ch URLhaus',
          ip: batch[i],
          lat: g.lat,
          lng: g.lon,
          city: g.city,
          country: g.country,
          isp: g.isp,
          threat: ips[i]?.threat || 'Unknown',
          severity: 'high' as const,
        }));
    } catch {
      return [];
    }
  } catch (e: any) {
    console.error('[Cyber] URLhaus fetch failed:', e.message);
    return [];
  }
}

async function fetchShadowserver(): Promise<any[]> {
  try {
    const data = await stealthFetchJSON<any[]>(
      'https://dashboard.shadowserver.org/statistics/combined/map/',
      { timeout: 10000 }
    );
    if (!Array.isArray(data)) return [];

    return data.slice(0, 50).map((entry: any, i: number) => ({
      id: `SHADOW-${i}`,
      type: 'attack_surface' as const,
      source: 'Shadowserver',
      country: entry.country || 'Unknown',
      lat: entry.lat || 0,
      lng: entry.lng || 0,
      count: entry.count || 0,
      severity: (entry.count || 0) > 500 ? 'critical' : 'high',
    }));
  } catch {
    return [];
  }
}

export async function GET() {
  try {
    if (cachedData && Date.now() - cachedData.time < CACHE_TTL) {
      return NextResponse.json({
        source: 'Cyber Threat Intelligence (cached)',
        timestamp: cachedData.time,
        threats: cachedData.data,
      });
    }

    const [cisa, feodo, urlhaus, shadowserver] = await Promise.allSettled([
      fetchCISAKEV(),
      fetchFeodoTracker(),
      fetchURLhaus(),
      fetchShadowserver(),
    ]);

    const threats = {
      vulnerabilities: cisa.status === 'fulfilled' ? cisa.value : [],
      botnetC2: feodo.status === 'fulfilled' ? feodo.value : [],
      malwareDist: urlhaus.status === 'fulfilled' ? urlhaus.value : [],
      attackSurface: shadowserver.status === 'fulfilled' ? shadowserver.value : [],
    };

    const totalCount = threats.vulnerabilities.length + threats.botnetC2.length +
      threats.malwareDist.length + threats.attackSurface.length;

    cachedData = { time: Date.now(), data: threats };

    return NextResponse.json({
      source: 'Cyber Threat Intelligence (CISA + abuse.ch + Shadowserver)',
      timestamp: Date.now(),
      count: totalCount,
      threats,
    });
  } catch (error: any) {
    console.error('[Cyber] Threat intelligence error:', error.message);

    if (cachedData) {
      return NextResponse.json({
        source: 'Cyber Threat Intelligence (cached · APIs unavailable)',
        timestamp: cachedData.time,
        threats: cachedData.data,
        error: error.message,
      });
    }

    return NextResponse.json({
      source: 'Cyber Threat Intelligence',
      timestamp: Date.now(),
      count: 0,
      threats: { vulnerabilities: [], botnetC2: [], malwareDist: [], attackSurface: [] },
      error: `Failed to fetch cyber threat data: ${error.message}`,
    }, { status: 503 });
  }
}
