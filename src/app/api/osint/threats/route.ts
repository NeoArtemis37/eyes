
import { fetchJson, fetchText, isValidIpv4, isValidDomain, errorResponse } from '@/lib/sb-fetch';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = url.searchParams.get('query')?.trim() || '';

  const result: any = { timestamp: Date.now(), source: 'AlienVault OTX + Tor Project' };

  const pulses = await fetchJson<any>(
    'https://otx.alienvault.com/api/v1/pulses/activity?limit=10',
    { timeout: 8000 },
  );
  if (pulses && Array.isArray(pulses.results)) {
    result.pulses = pulses.results.slice(0, 10).map((p: any) => ({
      name: p.name,
      description: (p.description || '').slice(0, 200),
      created: p.created,
      tags: (p.tags || []).slice(0, 5),
      adversary: p.adversary,
      indicators_count: p.indicator_count,
    }));
  }

  if (q) {
    if (isValidIpv4(q)) {
      const torList = await fetchText('https://check.torproject.org/torbulkexitlist', { timeout: 5000 });
      if (torList) {
        result.tor_exit_node = torList.split(/\s+/).includes(q);
      }

      const otx = await fetchJson<any>(
        `https://otx.alienvault.com/api/v1/indicators/IPv4/${encodeURIComponent(q)}/general`,
        { timeout: 5000 },
      );
      if (otx) {
        result.otx = {
          reputation: otx.reputation,
          pulse_count: (otx.pulse_info || {}).count || 0,
          country: otx.country_name,
          asn: otx.asn,
        };
      }
    } else if (isValidDomain(q)) {
      const otx = await fetchJson<any>(
        `https://otx.alienvault.com/api/v1/indicators/domain/${encodeURIComponent(q)}/general`,
        { timeout: 5000 },
      );
      if (otx) {
        result.otx = {
          pulse_count: (otx.pulse_info || {}).count || 0,
        };
      }
    } else {
      return errorResponse('Query must be IPv4 or domain', 400);
    }
  }

  const pulseCount = (result.otx || {}).pulse_count || 0;
  result.threat_level = pulseCount > 5 ? 'HIGH' : (pulseCount > 0 ? 'MEDIUM' : 'LOW');
  result.query = q || null;
  return Response.json(result);
}
