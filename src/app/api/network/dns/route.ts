

import { NextRequest, NextResponse } from 'next/server';
import { lookup } from 'node:dns/promises';

const HOST_RE = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/;
const MAX_HOSTS = 200;
const TTL_MS = 30 * 60_000;
const CHUNK = 8;

type CacheVal = { ip: string | null; ts: number };
const memCache = new Map<string, CacheVal>();

async function resolveOne(host: string): Promise<string | null> {
  const hit = memCache.get(host);
  if (hit && Date.now() - hit.ts < TTL_MS) return hit.ip;
  let ip: string | null = null;
  try {
    const r = await Promise.race([
      lookup(host, { family: 4 }),
      new Promise<never>((_, rej) =>
        setTimeout(() => rej(new Error('dns-timeout')), 4_000)
      ),
    ]);
    ip = r.address ?? null;
  } catch {
    ip = null; // NXDOMAIN / timeout / resolver down · definitive miss
  }
  memCache.set(host, { ip, ts: Date.now() });
  return ip;
}

export async function POST(req: NextRequest) {
  let body: { hosts?: unknown };
  try {
    body = (await req.json()) as { hosts?: unknown };
  } catch {
    return NextResponse.json(
      { status: 'error', message: 'invalid JSON body' },
      { status: 400 }
    );
  }
  const raw = Array.isArray(body.hosts) ? body.hosts : [];
  const hosts = [
    ...new Set(
      raw
        .filter((h): h is string => typeof h === 'string')
        .map((h) => h.trim().toLowerCase())
        .filter((h) => h.length <= 253 && HOST_RE.test(h))
    ),
  ].slice(0, MAX_HOSTS);

  const results: Record<string, string | null> = {};
  for (let i = 0; i < hosts.length; i += CHUNK) {
    const chunk = hosts.slice(i, i + CHUNK);
    await Promise.all(
      chunk.map(async (h) => {
        results[h] = await resolveOne(h);
      })
    );
  }
  return NextResponse.json(
    { status: 'ok', resolved: Object.values(results).filter(Boolean).length, results },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
