

import { NextRequest, NextResponse } from 'next/server';

const HIBP_URL = 'https://haveibeenpwned.com/api/v3/breaches';
const TTL_MS = 60 * 60 * 1000; // 1 hour

let cache: { ts: number; body: string } | null = null;

export async function GET(_req: NextRequest) {
  if (cache && Date.now() - cache.ts < TTL_MS) {
    return new NextResponse(cache.body, {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    });
  }
  try {
    const res = await fetch(HIBP_URL, {
      headers: {
        'User-Agent': 'OSINT-Intel-Grid/1.0 (breach catalogue aggregator)',
      },
      signal: AbortSignal.timeout(12_000),
      cache: 'no-store',
    });
    if (!res.ok) throw new Error(`upstream ${res.status}`);
    const body = await res.text();
    cache = { ts: Date.now(), body };
    return new NextResponse(body, {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'upstream failed' },
      { status: 502 }
    );
  }
}
