
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36';

type Resolved = { videoId: string; isLive: boolean; time: number };
const CACHE = new Map<string, Resolved>();
const CACHE_TTL = 240_000; // 4 min
const FETCH_TIMEOUT = 12_000;
const MAX_BATCH = 20;
const CONCURRENCY = 4;

async function resolveChannel(channelId: string): Promise<{ videoId: string; isLive: boolean } | null> {
  const url = `https://www.youtube.com/channel/${channelId}/live`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'User-Agent': UA,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9,fr;q=0.8',
      },
    });
    if (!res.ok) return null;
    const html = await res.text();
    const vid = html.match(/"videoId":"([A-Za-z0-9_-]{11})"/);
    if (!vid) return null; // no stream page → channel offline (HORS ANTENNE)
    const isLive = /"isLive":true/.test(html);
    return { videoId: vid[1], isLive };
  } catch {
    return null; // transient (network / bot-check) · not cached, retried
  } finally {
    clearTimeout(timer);
  }
}

async function runPool<T, R>(items: T[], limit: number, job: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const i = cursor++;
      results[i] = await job(items[i]);
    }
  });
  await Promise.all(workers);
  return results;
}

export async function GET(request: NextRequest) {
  const single = request.nextUrl.searchParams.get('channel');
  const batch = request.nextUrl.searchParams.get('channels');

  const ids: string[] = [];
  if (single && /^UC[A-Za-z0-9_-]{20,}$/.test(single)) ids.push(single);
  if (batch) {
    for (const id of batch.split(',').map(s => s.trim())) {
      if (/^UC[A-Za-z0-9_-]{20,}$/.test(id) && !ids.includes(id)) ids.push(id);
      if (ids.length >= MAX_BATCH) break;
    }
  }
  if (ids.length === 0) {
    return NextResponse.json({ error: 'Missing or invalid channel id(s)' }, { status: 400 });
  }

  const now = Date.now();
  const stale = ids.filter(id => {
    const c = CACHE.get(id);
    return !c || now - c.time > CACHE_TTL;
  });

  await runPool(stale, CONCURRENCY, async id => {
    const r = await resolveChannel(id);
    if (r) CACHE.set(id, { ...r, time: Date.now() });
    return id;
  });

  if (CACHE.size > 64) {
    for (const [k, v] of CACHE) {
      if (Date.now() - v.time > CACHE_TTL * 10) CACHE.delete(k);
    }
  }

  const results: Record<string, { videoId: string; isLive: boolean } | null> = {};
  for (const id of ids) {
    const c = CACHE.get(id);
    results[id] = c ? { videoId: c.videoId, isLive: c.isLive } : null;
  }
  return NextResponse.json(
    { results, ts: now },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
