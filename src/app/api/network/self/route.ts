

import { NextRequest, NextResponse } from 'next/server';
import { lookupGeo } from '@/network/geoServer';

export async function GET(req: NextRequest) {
  try {
    const fwd = req.headers.get('x-forwarded-for') ?? '';
    const real = req.headers.get('x-real-ip');
    const candidate = real?.trim() || fwd.split(',')[0].trim() || '';
    const ip = candidate || '8.8.8.8';
    const res = await lookupGeo(ip);
    if (res.geo) {
      return NextResponse.json({
        status: 'ok',
        ip,
        geo: {
          lat: res.geo.lat,
          lon: res.geo.lon,
          city: res.geo.city,
          country: res.geo.country,
        },
      });
    }
    return NextResponse.json({ status: 'miss', ip });
  } catch {
    return NextResponse.json({ status: 'miss' });
  }
}
