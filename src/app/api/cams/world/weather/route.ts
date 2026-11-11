
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const mem = new Map<string, { at: number; data: unknown }>();
const TTL = 10 * 60 * 1000; // 10 min

export async function GET(request: NextRequest) {
  const p = request.nextUrl.searchParams;
  const lat = parseFloat(p.get('lat') ?? '');
  const lon = parseFloat(p.get('lon') ?? '');
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
    return NextResponse.json({ error: 'coordonnées invalides' }, { status: 400 });
  }
  const key = `${lat.toFixed(1)},${lon.toFixed(1)}`;
  const hit = mem.get(key);
  if (hit && Date.now() - hit.at < TTL) {
    return NextResponse.json(hit.data);
  }
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 8000);
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(3)}&longitude=${lon.toFixed(3)}`
      + `&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m,is_day&timezone=auto`;
    const res = await fetch(url, { signal: ctrl.signal, cache: 'no-store' });
    clearTimeout(t);
    if (!res.ok) {
      const data = { ok: false, reason: 'upstream' };
      mem.set(key, { at: Date.now(), data });
      return NextResponse.json(data);
    }
    const j = (await res.json()) as {
      current?: Record<string, number>;
      timezone?: string;
    };
    const cur = j.current ?? {};
    const data = {
      ok: true,
      temp: cur.temperature_2m,
      humidity: cur.relative_humidity_2m,
      wind: cur.wind_speed_10m,
      code: cur.weather_code,
      isDay: cur.is_day === 1,
      timezone: j.timezone ?? null,
      localTime: cur.time ?? null,
    };
    mem.set(key, { at: Date.now(), data });
    return NextResponse.json(data);
  } catch {
    const data = { ok: false, reason: 'timeout' };
    return NextResponse.json(data);
  }
}
