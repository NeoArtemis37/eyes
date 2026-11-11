
import { NextRequest, NextResponse } from 'next/server';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const HEADER_TIMEOUT = 10_000; // upstream must respond with headers within 10 s
const SEGMENT_WATCHDOG = 120_000; // max lifetime of a piped segment transfer

function isPlaylistRequest(url: string, contentType: string, hint: string | null): boolean {
  if (hint === 'playlist') return true;
  if (/\.(m3u8|mpd)(\?|$)/i.test(url)) return true;
  const ct = contentType.toLowerCase();
  return ct.includes('mpegurl') || ct.includes('m3u8') || ct.includes('dash+xml');
}

function proxied(absolute: string): string {
  return `/api/osint/hls-proxy?url=${encodeURIComponent(absolute)}`;
}


function rewritePlaylist(text: string, playlistUrl: string): string {
  let out = text.replace(/URI="([^"]+)"/g, (m, uri: string) => {
    try {
      return `URI="${proxied(new URL(uri, playlistUrl).toString())}"`;
    } catch {
      return m; // unresolvable · leave untouched, hls.js will flag it
    }
  });
  out = out
    .split('\n')
    .map(line => {
      const l = line.trim();
      if (!l || l.startsWith('#')) return line;
      try {
        return proxied(new URL(l, playlistUrl).toString());
      } catch {
        return line;
      }
    })
    .join('\n');
  return out;
}

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

  const hint = request.nextUrl.searchParams.get('type');
  const controller = new AbortController();
  const headerTimer = setTimeout(() => controller.abort(), HEADER_TIMEOUT);

  try {
    const range = request.headers.get('range');
    const res = await fetch(upstream.toString(), {
      signal: controller.signal,
      headers: {
        'User-Agent': UA,
        Accept: '*/*',
        Referer: upstream.origin + '/',
        ...(range ? { Range: range } : {}),
      },
    });
    clearTimeout(headerTimer);

    if (!res.ok) {
      return NextResponse.json({ error: `Upstream returned ${res.status}`, url: raw }, { status: 502 });
    }

    const ct = (res.headers.get('content-type') || '').toLowerCase();

    if (isPlaylistRequest(raw, ct, hint)) {
      const text = await res.text();
      const rewritten = rewritePlaylist(text, upstream.toString());
      return new NextResponse(rewritten, {
        headers: {
          'Content-Type': ct.includes('mpegurl') || ct.includes('m3u8') || ct.includes('dash')
            ? ct
            : 'application/vnd.apple.mpegurl',
          'Cache-Control': 'no-cache, no-store, must-revalidate', // live edge freshness
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    const headers: Record<string, string> = {
      'Content-Type': ct || 'video/mp2t',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Access-Control-Allow-Origin': '*',
    };
    const len = res.headers.get('content-length');
    if (len) headers['Content-Length'] = len;
    const contentRange = res.headers.get('content-range');
    if (contentRange) {
      headers['Content-Range'] = contentRange;
      headers['Accept-Ranges'] = 'bytes';
    }

    const watchdog = setTimeout(() => controller.abort(), SEGMENT_WATCHDOG);
    let body: ReadableStream<Uint8Array> | null = res.body ?? null;
    if (body) {
      body = body.pipeThrough(
        new TransformStream<Uint8Array, Uint8Array>({
          flush() { clearTimeout(watchdog); },
        })
      );
    }

    return new Response(body, { status: res.status, headers });
  } catch (error: unknown) {
    clearTimeout(headerTimer);
    const message = error instanceof Error ? error.message : 'Fetch failed';
    const aborted = message.toLowerCase().includes('abort');
    return NextResponse.json({ error: aborted ? 'Upstream timeout' : message, url: raw }, {
      status: aborted ? 504 : 502,
    });
  }
}
