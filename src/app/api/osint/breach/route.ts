
import { isValidEmail, errorResponse } from '@/lib/sb-fetch';

interface XONBreach {
  name?: string;
  title?: string;
  domain?: string;
  date?: string;
  year?: string | number;
  pwnCount?: number;
  pwn_count?: number;
  dataClasses?: string[];
  data_classes?: string[];
  description?: string;
  IsVerified?: boolean;
  is_verified?: boolean;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const email = url.searchParams.get('email')?.trim().toLowerCase() || '';
  if (!email) return errorResponse('Missing ?email=', 400);
  if (!isValidEmail(email)) return errorResponse('Invalid email format', 400);

  try {
    const res = await fetch(
      `https://api.xposedornot.com/v2/check-email/${encodeURIComponent(email)}`,
      { headers: { 'Accept': 'application/json' }, signal: AbortSignal.timeout(10000) as any },
    );

    if (res.status === 404) {
      return Response.json({
        email,
        exposed: false,
        breaches: [],
        stats: { total_breaches: 0, latest_year: null, exposed_data_types: [] },
        source: 'XposedOrNot',
        timestamp: Date.now(),
      });
    }
    if (!res.ok) {
      return Response.json({
        email,
        exposed: false,
        breaches: [],
        error: `XposedOrNow returned HTTP ${res.status}`,
        source: 'XposedOrNot',
        timestamp: Date.now(),
      }, { status: 502 });
    }

    const raw = await res.json() as { breaches?: XONBreach[] | string[] };
    const rawList = raw.breaches || [];
    const breachNames: string[] = rawList.map((b: any) =>
      typeof b === 'string' ? b : (b.name || b.title || '')
    );

    const exposed = breachNames.length > 0;
    return Response.json({
      email,
      exposed,
      breaches: breachNames.map(name => ({ name })),
      stats: { total_breaches: breachNames.length, latest_year: null, exposed_data_types: [] },
      note: 'Breach detail requires per-name lookup; use https://xposedornot.com for full data',
      source: 'XposedOrNot',
      timestamp: Date.now(),
    });
  } catch (e: any) {
    return Response.json({
      email,
      exposed: false,
      breaches: [],
      error: `XposedOrNow lookup failed: ${e.message}`,
      source: 'XposedOrNot',
      timestamp: Date.now(),
    }, { status: 502 });
  }
}
