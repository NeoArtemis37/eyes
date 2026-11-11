import { NextResponse } from 'next/server';
import { stealthFetch } from '@/lib/stealthFetch';

const cache = new Map<string, { data: any; expiry: number }>();
const CACHE_TTL = 5 * 60 * 1000;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const url = searchParams.get('url');
  if (!url) return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 });

  let targetUrl = url;
  if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
    targetUrl = `https://${targetUrl}`;
  }

  try {
    new URL(targetUrl);
  } catch {
    return NextResponse.json({ error: 'Invalid URL format' }, { status: 400 });
  }

  const cacheKey = `headers:${targetUrl}`;
  const cached = cache.get(cacheKey);
  if (cached && cached.expiry > Date.now()) {
    return NextResponse.json({ ...cached.data, cached: true });
  }

  try {
    const results: any = { url: targetUrl, timestamp: new Date().toISOString() };

    const res = await stealthFetch(targetUrl, {
      method: 'HEAD',
      timeout: 8000,
      stealth: true,
    });

    const allHeaders: Record<string, string> = {};
    res.headers.forEach((value, key) => {
      allHeaders[key] = value;
    });
    results.headers = allHeaders;
    results.status = res.status;
    results.status_text = res.statusText;
    results.redirected = res.redirected;
    results.final_url = res.url;

    const securityAnalysis: Record<string, {
      present: boolean;
      value: string | null;
      status: 'good' | 'warning' | 'missing' | 'info';
      recommendation?: string;
    }> = {};

    const hsts = res.headers.get('strict-transport-security');
    securityAnalysis['strict-transport-security'] = {
      present: !!hsts,
      value: hsts,
      status: hsts ? 'good' : 'missing',
      recommendation: hsts ? undefined : 'Enable HSTS to force HTTPS connections',
    };

    const csp = res.headers.get('content-security-policy');
    securityAnalysis['content-security-policy'] = {
      present: !!csp,
      value: csp ? csp.slice(0, 100) + (csp.length > 100 ? '...' : '') : null,
      status: csp ? 'good' : 'missing',
      recommendation: csp ? undefined : 'Implement CSP to prevent XSS and injection attacks',
    };

    const xfo = res.headers.get('x-frame-options');
    securityAnalysis['x-frame-options'] = {
      present: !!xfo,
      value: xfo,
      status: xfo ? (xfo.toUpperCase() === 'DENY' || xfo.toUpperCase() === 'SAMEORIGIN' ? 'good' : 'warning') : 'missing',
      recommendation: xfo ? undefined : 'Set X-Frame-Options to DENY or SAMEORIGIN to prevent clickjacking',
    };

    const xcto = res.headers.get('x-content-type-options');
    securityAnalysis['x-content-type-options'] = {
      present: !!xcto,
      value: xcto,
      status: xcto ? (xcto.toLowerCase() === 'nosniff' ? 'good' : 'warning') : 'missing',
      recommendation: xcto ? undefined : 'Set X-Content-Type-Options to nosniff to prevent MIME sniffing',
    };

    const rp = res.headers.get('referrer-policy');
    securityAnalysis['referrer-policy'] = {
      present: !!rp,
      value: rp,
      status: rp ? 'good' : 'missing',
      recommendation: rp ? undefined : 'Set Referrer-Policy to control referrer information leakage',
    };

    const pp = res.headers.get('permissions-policy');
    securityAnalysis['permissions-policy'] = {
      present: !!pp,
      value: pp ? pp.slice(0, 100) + (pp.length > 100 ? '...' : '') : null,
      status: pp ? 'good' : 'missing',
      recommendation: pp ? undefined : 'Implement Permissions-Policy to control browser features',
    };

    const xxss = res.headers.get('x-xss-protection');
    securityAnalysis['x-xss-protection'] = {
      present: !!xxss,
      value: xxss,
      status: xxss ? (xxss === '0' ? 'warning' : 'info') : 'info',
      recommendation: 'This header is deprecated in favor of CSP, but "1; mode=block" provides legacy protection',
    };

    const server = res.headers.get('server');
    securityAnalysis['server'] = {
      present: !!server,
      value: server,
      status: server ? 'warning' : 'good',
      recommendation: server ? 'Consider hiding or obfuscating the Server header to reduce information disclosure' : undefined,
    };

    const xpb = res.headers.get('x-powered-by');
    securityAnalysis['x-powered-by'] = {
      present: !!xpb,
      value: xpb,
      status: xpb ? 'warning' : 'good',
      recommendation: xpb ? 'Remove X-Powered-By header to prevent technology fingerprinting' : undefined,
    };

    results.security_analysis = securityAnalysis;

    const critical = ['strict-transport-security', 'content-security-policy', 'x-frame-options', 'x-content-type-options'];
    const recommended = ['referrer-policy', 'permissions-policy'];
    const disclosure = ['server', 'x-powered-by'];

    let score = 0;
    const maxScore = 10;

    for (const h of critical) {
      if (securityAnalysis[h]?.present) score += 2;
    }

    for (const h of recommended) {
      if (securityAnalysis[h]?.present) score += 0.5;
    }

    for (const h of disclosure) {
      if (!securityAnalysis[h]?.present) score += 0.5;
    }

    results.security_score = {
      score: Math.round(score * 10) / 10,
      max: maxScore,
      grade: score >= 8 ? 'A' : score >= 6 ? 'B' : score >= 4 ? 'C' : score >= 2 ? 'D' : 'F',
      critical_missing: critical.filter(h => !securityAnalysis[h]?.present),
      recommended_missing: recommended.filter(h => !securityAnalysis[h]?.present),
      information_disclosure: disclosure.filter(h => securityAnalysis[h]?.present),
    };

    const techStack: string[] = [];
    if (server) techStack.push(`Server: ${server}`);
    if (xpb) techStack.push(`Runtime: ${xpb}`);
    if (res.headers.get('x-aspnet-version')) techStack.push('ASP.NET');
    if (res.headers.get('x-drupal-cache')) techStack.push('Drupal');
    if (res.headers.get('x-generator')) techStack.push(`CMS: ${res.headers.get('x-generator')}`);
    if (res.headers.get('vary')?.includes('Accept-Encoding')) techStack.push('Compression enabled');
    results.tech_stack = techStack;

    cache.set(cacheKey, { data: results, expiry: Date.now() + CACHE_TTL });

    return NextResponse.json(results);
  } catch (e: any) {
    return NextResponse.json({
      error: 'Header analysis failed',
      detail: e.message || 'Could not reach the target URL',
    }, { status: 500 });
  }
}
