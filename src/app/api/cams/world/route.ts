
import { NextRequest, NextResponse } from 'next/server';
import {
  getCatalog, filterCams, nearestCams, geocodeStep, camUtcOffset, isDaylight,
  type WorldCam,
} from '@/lib/worldcams';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_LIMIT = 300;

export async function GET(request: NextRequest) {
  const p = request.nextUrl.searchParams;
  const nearRaw = p.get('near');
  const q = p.get('q')?.slice(0, 64) || undefined;
  const cc = p.get('cc')?.toUpperCase().slice(0, 2) || undefined;
  const cat = p.get('cat') || undefined;
  const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(p.get('limit') ?? '200', 10) || 200));

  let catalog;
  try {
    catalog = await getCatalog();
  } catch {
    return NextResponse.json({ error: 'catalogue indisponible' }, { status: 503 });
  }
  const all = catalog.cams;

  const perCountry = new Map<string, { cc: string; name: string; count: number }>();
  for (const c of all) {
    if (!c.cc || !c.country) continue;
    const e = perCountry.get(c.cc) ?? { cc: c.cc, name: c.country, count: 0 };
    e.count++;
    perCountry.set(c.cc, e);
  }
  const countries = [...perCountry.values()].sort((a, b) => b.count - a.count);

  if (nearRaw) {
    const [latS, lonS] = nearRaw.split(',');
    const lat = parseFloat(latS ?? '');
    const lon = parseFloat(lonS ?? '');
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
      return NextResponse.json({ error: 'coordonnées invalides' }, { status: 400 });
    }
    void geocodeStep(6, { lat, lon }).catch(() => {});
    let hits = nearestCams(all, lat, lon, Math.max(limit, 24), 1500);
    if (hits.length < 12) hits = nearestCams(all, lat, lon, Math.max(limit, 24), 5000);
    return NextResponse.json({
      mode: 'nearest',
      cams: hits.map(serialize),
      stats: catalog.stats,
      countries: countries.slice(0, 40),
    });
  }

  let cams: WorldCam[];
  if (q || cc || cat) {
    cams = filterCams(all, { q, cc, cat });
  } else {
    cams = [...all];
    for (let i = cams.length - 1; i > 0; i--) {
      const j = (Math.random() * (i + 1)) | 0;
      [cams[i], cams[j]] = [cams[j], cams[i]];
    }
  }
  if (q || cc) void geocodeStep(3).catch(() => {});

  return NextResponse.json({
    mode: q || cc || cat ? 'filtered' : 'random',
    cams: cams.slice(0, limit).map(serialize),
    total: cams.length,
    stats: catalog.stats,
    countries: countries.slice(0, 40),
  });
}

function serialize(c: WorldCam | (WorldCam & { distKm?: number })) {
  return {
    id: c.id,
    title: c.title,
    sub: c.sub,
    cc: c.cc,
    country: c.country,
    city: c.city,
    nkey: c.nkey,
    cats: c.cats,
    badge: c.badge,
    lat: c.lat,
    lon: c.lon,
    geo: c.geo,
    tz: c.lat != null && c.lon != null ? camUtcOffset(c) : null,
    day: c.lat != null && c.lon != null ? isDaylight(c.lat, c.lon) : null,
    ...(('distKm' in c) && c.distKm != null ? { distKm: Math.round(c.distKm) } : {}),
  };
}
