
import { NextRequest, NextResponse } from 'next/server';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const HEADER_TIMEOUT = 8_000;
const STREAM_WATCHDOG = 600_000; // 10 min max per connection

export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get('url');
  if (!raw) {
    return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 });
  }

  let upstream: URL;
  try {
    upstream = new URL(raw);
    if (!['http:', 'https:'].includes(upstream.protocol)) {
      return NextResponse.json({ error: 'Invalid protocol' }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: 'Invalid URL' }, { status: 400 });
  }

  const controller = new AbortController();
  const headerTimer = setTimeout(() => controller.abort(), HEADER_TIMEOUT);

  try {
    const res = await fetch(upstream.toString(), {
      signal: controller.signal,
      headers: {
        'User-Agent': UA,
        Accept: 'image/jpeg, image/png, multipart/x-mixed-replace, image/*;q=0.8, */*;q=0.5',
        Referer: upstream.origin + '/',
      },
    });
    clearTimeout(headerTimer);

    if (!res.ok) {
      return NextResponse.json({ error: `Upstream returned ${res.status}`, url: raw }, { status: 502 });
    }

    const ct = res.headers.get('content-type') || '';
    const ctLower = ct.toLowerCase();
    const streamable = ctLower.startsWith('multipart/') || ctLower.startsWith('image/');

    if (!streamable || !res.body) {
      return NextResponse.json(
        { error: 'Unsupported content type', contentType: ct || 'unknown', url: raw },
        { status: 415 }
      );
    }

    const watchdog = setTimeout(() => controller.abort(), STREAM_WATCHDOG);
    const body = res.body.pipeThrough(
      new TransformStream<Uint8Array, Uint8Array>({
        flush() { clearTimeout(watchdog); },
      })
    );

    return new Response(body, {
      headers: {
        'Content-Type': ct,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'X-Accel-Buffering': 'no', // hint reverse proxies not to buffer
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error: unknown) {
    clearTimeout(headerTimer);
    const message = error instanceof Error ? error.message : 'Fetch failed';
    const aborted = message.toLowerCase().includes('abort');
    return NextResponse.json({ error: aborted ? 'Upstream timeout' : message, url: raw }, {
      status: aborted ? 504 : 502,
    });
  }
}
