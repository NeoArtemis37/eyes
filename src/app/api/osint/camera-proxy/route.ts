
import { NextRequest, NextResponse } from 'next/server';

const CACHE = new Map<string, { data: Buffer; contentType: string; time: number }>();
const CACHE_TTL = 10000; // 10 seconds · refresh frequently for live feel

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get('url');

  if (!url) {
    return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 });
  }

  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return NextResponse.json({ error: 'Invalid protocol' }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: 'Invalid URL' }, { status: 400 });
  }

  const cached = CACHE.get(url);
  if (cached && Date.now() - cached.time < CACHE_TTL) {
    return new NextResponse(new Uint8Array(cached.data), {
      headers: {
        'Content-Type': cached.contentType,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'X-Proxy-Cache': 'HIT',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
        'Referer': new URL(url).origin + '/',
      },
    });

    clearTimeout(timeout);

    if (!response.ok) {
      return NextResponse.json(
        { error: `Upstream returned ${response.status}`, url },
        { status: 502 }
      );
    }

    const contentType = response.headers.get('content-type') || 'image/jpeg';
    const data = Buffer.from(await response.arrayBuffer());

    CACHE.set(url, { data, contentType, time: Date.now() });

    if (CACHE.size > 200) {
      const now = Date.now();
      for (const [key, val] of CACHE) {
        if (now - val.time > CACHE_TTL * 6) CACHE.delete(key);
      }
    }

    return new NextResponse(data, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'X-Proxy-Cache': 'MISS',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Fetch failed', url },
      { status: 504 }
    );
  }
}
