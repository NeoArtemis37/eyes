
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

export async function GET(request: NextRequest) {
  const p = request.nextUrl.searchParams;
  const nkey = p.get('nkey') ?? '';
  if (!/^\d{1,6}$/.test(nkey)) {
    return NextResponse.json({ error: 'nkey invalide' }, { status: 400 });
  }
  const hd = p.get('hd') === '1';
  const url = `https://cdn.skylinewebcams.com/${hd ? 'social' : 'live'}${nkey}.jpg`;

  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 12000);
    const res = await fetch(url, {
      headers: { 'User-Agent': UA },
      signal: ctrl.signal,
      cache: 'no-store',
    });
    clearTimeout(t);
    if (!res.ok) {
      return NextResponse.json({ error: 'cliché indisponible' }, { status: 502 });
    }
    const ct = res.headers.get('content-type') || '';
    if (!ct.startsWith('image/')) {
      return NextResponse.json({ error: 'réponse inattendue' }, { status: 502 });
    }
    const buf = await res.arrayBuffer();
    return new NextResponse(buf, {
      status: 200,
      headers: {
        'Content-Type': ct,
        'Cache-Control': 'public, max-age=10, stale-while-revalidate=30',
      },
    });
  } catch {
    return NextResponse.json({ error: 'CDN injoignable' }, { status: 504 });
  }
}
