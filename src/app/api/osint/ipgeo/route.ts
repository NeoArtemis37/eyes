
import { NextResponse } from 'next/server';

interface IPGeoResult {
  ip: string;
  city: string;
  country: string;
  countryCode: string;
  lat: number;
  lng: number;
  isp: string;
  org: string;
  timezone: string;
  asn: string;
  zip: string;
  region: string;
  regionName: string;
}

const ipCache = new Map<string, { data: IPGeoResult; time: number }>();
const CACHE_TTL = 300000; // 5 minutes

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const ip = searchParams.get('ip');

    if (!ip) {
      return NextResponse.json({ error: 'IP parameter required' }, { status: 400 });
    }

    const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
    if (!ipRegex.test(ip)) {
      return NextResponse.json({ error: 'Invalid IP address format' }, { status: 400 });
    }

    const cached = ipCache.get(ip);
    if (cached && Date.now() - cached.time < CACHE_TTL) {
      return NextResponse.json({
        source: 'ip-api.com (cached)',
        ...cached.data,
      });
    }

    const response = await fetch(`http://ip-api.com/json/${ip}?fields=status,message,country,countryCode,region,regionName,city,zip,lat,lon,timezone,isp,org,as,query`, {
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) {
      throw new Error(`ip-api returned ${response.status}`);
    }

    const data = await response.json();

    if (data.status === 'fail') {
      return NextResponse.json({
        source: 'ip-api.com',
        error: data.message || 'Geolocation failed',
        ip,
      }, { status: 400 });
    }

    const result: IPGeoResult = {
      ip: data.query || ip,
      city: data.city || 'Unknown',
      country: data.country || 'Unknown',
      countryCode: data.countryCode || '',
      lat: data.lat || 0,
      lng: data.lon || 0,
      isp: data.isp || 'Unknown',
      org: data.org || 'Unknown',
      timezone: data.timezone || 'Unknown',
      asn: data.as || 'Unknown',
      zip: data.zip || '',
      region: data.region || '',
      regionName: data.regionName || '',
    };

    ipCache.set(ip, { data: result, time: Date.now() });

    if (ipCache.size > 100) {
      const oldestKey = ipCache.keys().next().value;
      if (oldestKey) ipCache.delete(oldestKey);
    }

    return NextResponse.json({
      source: 'ip-api.com',
      ...result,
    });
  } catch (error: any) {
    console.error('ip-api error:', error.message);
    return NextResponse.json({
      source: 'ip-api.com',
      error: `Geolocation failed: ${error.message}`,
    }, { status: 503 });
  }
}
