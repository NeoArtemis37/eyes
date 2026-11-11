
import { fetchJson, isValidIpv4, isValidAsn, errorResponse } from '@/lib/sb-fetch';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = url.searchParams.get('query')?.trim() || '';
  if (!q) return errorResponse('Missing ?query= (IP or ASN)', 400);

  if (isValidIpv4(q)) {
    const data = await fetchJson<any>(`https://api.bgpview.io/ip/${encodeURIComponent(q)}`, { timeout: 8000 });
    if (!data || data.status !== 'ok') return errorResponse('bgpview.io unreachable from this host (try again later)', 502);
    return Response.json({
      query: q,
      type: 'ip',
      ip: data.data,
      source: 'bgpview.io',
      timestamp: Date.now(),
    });
  }

  if (isValidAsn(q)) {
    const asnNum = q.replace(/^AS/i, '');
    const [asn, prefixes, peers] = await Promise.all([
      fetchJson<any>(`https://api.bgpview.io/asn/${asnNum}`, { timeout: 8000 }),
      fetchJson<any>(`https://api.bgpview.io/asn/${asnNum}/prefixes`, { timeout: 8000 }),
      fetchJson<any>(`https://api.bgpview.io/asn/${asnNum}/peers`, { timeout: 8000 }),
    ]);

    if (!asn) return errorResponse('bgpview.io unreachable from this host (try again later)', 502);

    const result: any = { query: q, type: 'asn', source: 'bgpview.io', timestamp: Date.now() };
    if (asn.status === 'ok') result.asn = asn.data;
    if (prefixes?.status === 'ok') {
      const pdata = prefixes.data || {};
      result.prefixes = {
        ipv4: (pdata.ipv4_prefixes || []).slice(0, 20),
        ipv6: (pdata.ipv6_prefixes || []).slice(0, 10),
        total_v4: (pdata.ipv4_prefixes || []).length,
        total_v6: (pdata.ipv6_prefixes || []).length,
      };
    }
    if (peers?.status === 'ok') {
      const pdata = peers.data || {};
      result.peers = {
        upstream: (pdata.ipv4_peers || []).slice(0, 10),
        total: (pdata.ipv4_peers || []).length,
      };
    }
    return Response.json(result);
  }

  return errorResponse('Unrecognized query · use IPv4 or AS1234 format', 400);
}
