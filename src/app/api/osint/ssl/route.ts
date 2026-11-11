import { NextResponse } from 'next/server';
import { stealthFetch, stealthFetchJSON } from '@/lib/stealthFetch';

const cache = new Map<string, { data: any; expiry: number }>();
const CACHE_TTL = 10 * 60 * 1000;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const domain = searchParams.get('domain');
  if (!domain) return NextResponse.json({ error: 'Missing domain parameter' }, { status: 400 });

  if (!/^[a-zA-Z0-9][a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(domain)) {
    return NextResponse.json({ error: 'Invalid domain format' }, { status: 400 });
  }

  const cacheKey = `ssl:${domain}`;
  const cached = cache.get(cacheKey);
  if (cached && cached.expiry > Date.now()) {
    return NextResponse.json({ ...cached.data, cached: true });
  }

  try {
    const results: any = { domain, timestamp: new Date().toISOString() };

    try {
      const certsData = await stealthFetchJSON<any[]>(
        `https://crt.sh/?q=%25.${encodeURIComponent(domain)}&output=json`,
        { timeout: 10000, stealth: true }
      );

      if (Array.isArray(certsData) && certsData.length > 0) {
        const latest = certsData[0];
        results.certificate = {
          issuer: latest.issuer_name,
          common_name: latest.common_name,
          name_value: latest.name_value,
          not_before: latest.not_before,
          not_after: latest.not_after,
          serial: latest.serial_number,
        };

        if (latest.not_after) {
          const expiryDate = new Date(latest.not_after);
          const now = new Date();
          const daysUntilExpiry = Math.floor((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          results.certificate.days_until_expiry = daysUntilExpiry;
          results.certificate.expiry_status = daysUntilExpiry < 0 ? 'EXPIRED' : daysUntilExpiry < 30 ? 'EXPIRING SOON' : 'VALID';
        }

        const subdomains = new Set<string>();
        for (const cert of certsData.slice(0, 100)) {
          const nameValue = cert.name_value || '';
          nameValue.split('\n').forEach((n: string) => {
            const clean = n.trim().replace(/^\*\./, '');
            if (clean.endsWith(domain)) subdomains.add(clean);
          });
        }
        results.subdomains_from_certs = Array.from(subdomains).sort().slice(0, 20);
        results.total_certificates = certsData.length;
      }
    } catch (e) {
      console.warn('[HORUS] crt.sh lookup failed:', e instanceof Error ? e.message : e);
    }

    try {
      const res = await stealthFetch(`https://${domain}`, {
        method: 'HEAD',
        timeout: 5000,
        stealth: true,
      });

      results.https = {
        available: true,
        status: res.status,
        redirected: res.redirected,
        final_url: res.url,
      };

      const securityHeaders: Record<string, boolean> = {
        'strict-transport-security': !!res.headers.get('strict-transport-security'),
        'content-security-policy': !!res.headers.get('content-security-policy'),
        'x-frame-options': !!res.headers.get('x-frame-options'),
        'x-content-type-options': !!res.headers.get('x-content-type-options'),
        'referrer-policy': !!res.headers.get('referrer-policy'),
        'permissions-policy': !!res.headers.get('permissions-policy'),
      };

      const presentCount = Object.values(securityHeaders).filter(Boolean).length;
      results.security_headers = securityHeaders;
      results.security_score = {
        score: presentCount,
        max: 6,
        grade: presentCount >= 5 ? 'A' : presentCount >= 4 ? 'B' : presentCount >= 2 ? 'C' : 'D',
      };
    } catch {
      results.https = { available: false };
    }

    if (!results.https?.available) {
      try {
        const httpRes = await stealthFetch(`http://${domain}`, {
          method: 'HEAD',
          timeout: 5000,
          stealth: true,
        });
        results.http_redirect_to_https = httpRes.redirected && httpRes.url.startsWith('https://');
      } catch { /* no http either */ }
    }

    const recommendations: string[] = [];
    if (!results.https?.available) recommendations.push('No HTTPS detected · enable TLS immediately');
    if (results.certificate?.expiry_status === 'EXPIRED') recommendations.push('Certificate has expired · renew immediately');
    if (results.certificate?.expiry_status === 'EXPIRING SOON') recommendations.push('Certificate expiring within 30 days · schedule renewal');
    if (!results.security_headers?.['strict-transport-security']) recommendations.push('Add Strict-Transport-Security header');
    if (!results.security_headers?.['content-security-policy']) recommendations.push('Add Content-Security-Policy header');
    if (!results.security_headers?.['x-frame-options']) recommendations.push('Add X-Frame-Options header to prevent clickjacking');
    if (results.security_score?.grade && ['D', 'C'].includes(results.security_score.grade)) {
      recommendations.push('Security header score is low · implement missing headers');
    }
    results.recommendations = recommendations;

    cache.set(cacheKey, { data: results, expiry: Date.now() + CACHE_TTL });

    return NextResponse.json(results);
  } catch {
    return NextResponse.json({ error: 'SSL/TLS audit failed' }, { status: 500 });
  }
}
