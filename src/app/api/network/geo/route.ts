

import { NextRequest, NextResponse } from 'next/server';
import { lookupGeoBatch } from '@/network/geoServer';

const IPV4 = /^(\d{1,3}\.){3}\d{1,3}$/;
const MAX = 100;

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { status: 'error', message: 'invalid json body' },
      { status: 400 }
    );
  }
  const raw = (body as { ips?: unknown }).ips;
  if (!Array.isArray(raw)) {
    return NextResponse.json(
      { status: 'error', message: 'body.ips must be an array' },
      { status: 400 }
    );
  }
  const ips = raw
    .filter((ip): ip is string => typeof ip === 'string')
    .filter((ip) => IPV4.test(ip))
    .slice(0, MAX);

  const { results, transient } = await lookupGeoBatch(ips);
  return NextResponse.json({
    status: 'ok',
    results,
    ...(transient ? { transient: true } : {}),
  });
}
