
import { isValidIp, errorResponse } from '@/lib/sb-fetch';

interface DoHResponse {
  Status: number;
  Answer?: { name: string; type: number; TTL: number; data: string }[];
}

function reverseIpToPtr(ip: string): string | null {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;
  return `${parts[3]}.${parts[2]}.${parts[1]}.${parts[0]}.in-addr.arpa`;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const ip = url.searchParams.get('ip')?.trim() || '';
  if (!ip) return errorResponse('Missing ?ip=', 400);
  if (!isValidIp(ip)) return errorResponse('Invalid IP address', 400);

  const ptrName = reverseIpToPtr(ip);
  if (!ptrName) {
    return Response.json({
      ip,
      ptr_records: [],
      primary_hostname: null,
      note: 'IPv6 PTR lookup not yet implemented',
      source: 'Google DNS-over-HTTPS',
      timestamp: Date.now(),
    });
  }

  try {
    const data: DoHResponse | null = await fetch(
      `https://dns.google/resolve?name=${encodeURIComponent(ptrName)}&type=PTR`,
      { headers: { 'Accept': 'application/dns-json' }, signal: AbortSignal.timeout(8000) as any },
    ).then(r => r.ok ? r.json() : null).catch(() => null);

    if (!data) {
      return Response.json({
        ip,
        ptr_records: [],
        primary_hostname: null,
        note: 'DNS-over-HTTPS request failed',
        source: 'Google DNS-over-HTTPS',
        timestamp: Date.now(),
      }, { status: 502 });
    }

    const ptrRecords = (data.Answer || [])
      .filter(a => a.type === 12)
      .map(a => a.data.replace(/\.$/, '')); // strip trailing dot

    return Response.json({
      ip,
      ptr_records: ptrRecords,
      primary_hostname: ptrRecords[0] || null,
      source: 'Google DNS-over-HTTPS',
      timestamp: Date.now(),
    });
  } catch (e: any) {
    return Response.json({
      ip,
      ptr_records: [],
      primary_hostname: null,
      error: `DNS lookup failed: ${e.message}`,
      source: 'Google DNS-over-HTTPS',
      timestamp: Date.now(),
    }, { status: 502 });
  }
}
