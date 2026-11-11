
import { isValidEmail, errorResponse } from '@/lib/sb-fetch';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const email = url.searchParams.get('email')?.trim().toLowerCase() || '';
  if (!email) return errorResponse('Missing ?email=', 400);
  if (!isValidEmail(email)) return errorResponse('Invalid email format', 400);

  const [local, domain] = email.split('@');

  try {
    const res = await fetch(`https://api.mailcheck.ai/domain/${encodeURIComponent(domain)}`, {
      headers: { 'Accept': 'application/json' },
      // @ts-ignore  signal exists on RequestInit in modern runtimes
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) {
      return Response.json({
        email,
        valid_syntax: true,
        domain,
        local_part: local,
        mx_present: null,
        disposable: false,
        alias: false,
        autocomplete: null,
        rep_score: null,
        note: 'No mailcheck.ai data for this domain',
        source: 'mailcheck.ai',
        timestamp: Date.now(),
      });
    }

    const data = await res.json() as {
      domain?: string;
      mx?: boolean;
      disposable?: boolean;
      alias?: boolean;
      autocomplete?: boolean;
      valid?: boolean;
    };

    return Response.json({
      email,
      valid_syntax: true,
      domain,
      local_part: local,
      mx_present: data.mx ?? null,
      disposable: data.disposable ?? false,
      alias: data.alias ?? false,
      autocomplete: data.autocomplete ?? null,
      rep_score: null,
      _raw: data,
      source: 'mailcheck.ai',
      timestamp: Date.now(),
    });
  } catch (e: any) {
    return Response.json({
      email,
      valid_syntax: true,
      domain,
      local_part: local,
      mx_present: null,
      disposable: null,
      alias: null,
      autocomplete: null,
      rep_score: null,
      error: `mailcheck.ai lookup failed: ${e.message}`,
      source: 'mailcheck.ai',
      timestamp: Date.now(),
    }, { status: 502 });
  }
}
