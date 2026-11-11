
import { fetchJson, isValidIpv4, isPrivateIp, errorResponse } from '@/lib/sb-fetch';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const ip = url.searchParams.get('ip')?.trim() || '';
  if (!ip) return errorResponse('Missing ?ip=', 400);
  if (!isValidIpv4(ip)) return errorResponse('Invalid IPv4 (only x.x.x.x supported)', 400);
  if (isPrivateIp(ip)) return errorResponse('Private/reserved IP blocked by SSRF guard', 400);

  const fields = 'status,message,continent,country,countryCode,region,regionName,city,zip,lat,lon,timezone,isp,org,as,asname,mobile,proxy,hosting,query';
  const geo = await fetchJson<any>(`http://ip-api.com/json/${encodeURIComponent(ip)}?fields=${fields}`, { timeout: 5000 });
  if (!geo || geo.status !== 'success') {
    return errorResponse(geo?.message || 'ip-api lookup failed', 502);
  }

  const riskLevel = geo.proxy ? 'HIGH' : (geo.hosting ? 'MEDIUM' : 'LOW');
  return Response.json({
    ip,
    geo: {
      country: geo.country,
      country_code: geo.countryCode,
      region: geo.regionName,
      city: geo.city,
      lat: geo.lat,
      lon: geo.lon,
      timezone: geo.timezone,
      isp: geo.isp,
      org: geo.org,
      as_number: geo.as,
      as_name: geo.asname,
      is_mobile: geo.mobile,
      is_proxy: geo.proxy,
      is_hosting: geo.hosting,
    },
    reputation: {
      is_proxy: !!geo.proxy,
      is_hosting: !!geo.hosting,
      is_mobile: !!geo.mobile,
      risk_level: riskLevel,
    },
    source: 'ip-api.com',
    timestamp: Date.now(),
  });
}
