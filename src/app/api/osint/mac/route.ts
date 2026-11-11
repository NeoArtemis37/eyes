
import { fetchText, isValidMac, errorResponse } from '@/lib/sb-fetch';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const macRaw = url.searchParams.get('mac')?.trim() || '';
  if (!macRaw) return errorResponse('Missing ?mac=', 400);
  if (!isValidMac(macRaw)) return errorResponse('Invalid MAC format (expected XX:XX:XX:XX:XX:XX or XX-XX-XX-XX-XX-XX)', 400);

  const clean = macRaw.toUpperCase();
  const text = await fetchText(`https://api.macvendors.com/${encodeURIComponent(clean)}`, { timeout: 8000 });

  if (text == null || text === 'Not Found' || text === '') {
    return Response.json({
      mac: clean,
      vendor: 'Unknown / Not Registered',
      source: 'macvendors.com',
      timestamp: Date.now(),
    });
  }

  return Response.json({
    mac: clean,
    vendor: text.trim(),
    source: 'macvendors.com (IEEE OUI registry)',
    timestamp: Date.now(),
  });
}
