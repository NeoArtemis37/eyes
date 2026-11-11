

import { NextRequest, NextResponse } from 'next/server';
import { lookupGeo } from '@/network/geoServer';

const IP_RE =
  /^(\d{1,3}\.){3}\d{1,3}$|^[0-9a-fA-F]{0,4}(:[0-9a-fA-F]{0,4}){1,7}$/;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ ip: string }> }
) {
  const { ip } = await params;
  if (!ip || !IP_RE.test(ip)) {
    return NextResponse.json({ status: 'miss', reason: 'invalid ip' });
  }
  const res = await lookupGeo(ip);
  if (res.geo) return NextResponse.json({ status: 'ok', geo: res.geo });
  return NextResponse.json({
    status: 'miss',
    ...(res.definitive ? {} : { transient: true }),
  });
}
