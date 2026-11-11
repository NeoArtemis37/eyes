

import { NextRequest, NextResponse } from 'next/server';

const cache = new Map<string, { ts: number; data: unknown }>();
const TTL = 30 * 60 * 1000;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ ip: string }> }
) {
  const { ip } = await params;
  const hit = cache.get(ip);
  if (hit && Date.now() - hit.ts < TTL) {
    return NextResponse.json(hit.data);
  }
  try {
    const res = await fetch(
      `https://api.greynoise.io/v3/community/${encodeURIComponent(ip)}`,
      {
        headers: { Accept: 'application/json', 'User-Agent': 'HORUS-Intel/0.3' },
        signal: AbortSignal.timeout(8_000),
        cache: 'no-store',
      }
    );
    const j = await res.json();
    cache.set(ip, { ts: Date.now(), data: j });
    return NextResponse.json(j);
  } catch {
    return NextResponse.json({ status: 'miss', reason: 'upstream failed' });
  }
}
