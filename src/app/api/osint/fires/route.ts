
import { NextResponse } from 'next/server';
import { stealthFetch, stealthFetchJSON } from '@/lib/stealthFetch';

let cachedData: { time: number; data: any } | null = null;
const CACHE_TTL = 600000; // 10 minutes

async function fetchFIRMS(): Promise<any[]> {
  try {
    const viirsResponse = await stealthFetch(
      'https://firms.modaps.eosdis.nasa.gov/data/active_fire/suomi-npp-viirs-c2/csv/SUOMI_VIIRS_C2_Global_24h.csv',
      { timeout: 20000 }
    );
    if (!viirsResponse.ok) return [];

    const text = await viirsResponse.text();
    const lines = text.split('\n').filter(l => l.trim());
    if (lines.length < 2) return [];

    const headers = lines[0].split(',');
    const latIdx = headers.indexOf('latitude');
    const lngIdx = headers.indexOf('longitude');
    const brightIdx = headers.indexOf('bright_ti4');
    const confIdx = headers.indexOf('confidence');
    const dateIdx = headers.indexOf('acq_date');
    const timeIdx = headers.indexOf('acq_time');
    const typeIdx = headers.indexOf('daynight');

    if (latIdx === -1 || lngIdx === -1) return [];

    const step = Math.max(1, Math.floor((lines.length - 1) / 1500));
    const fires: any[] = [];

    for (let i = 1; i < lines.length; i += step) {
      const parts = lines[i].split(',');
      if (parts.length <= Math.max(latIdx, lngIdx)) continue;

      const lat = parseFloat(parts[latIdx]);
      const lng = parseFloat(parts[lngIdx]);
      if (isNaN(lat) || isNaN(lng)) continue;

      const confidence = confIdx >= 0 ? parts[confIdx] : 'unknown';
      const brightness = brightIdx >= 0 ? parseFloat(parts[brightIdx]) : 0;

      let severity: 'low' | 'medium' | 'high' | 'critical';
      if (confidence === 'high' || brightness > 350) severity = 'critical';
      else if (confidence === 'nominal' || brightness > 330) severity = 'high';
      else if (confidence === 'low') severity = 'low';
      else severity = 'medium';

      fires.push({
        id: `FIRE-V-${i}`,
        type: 'fire' as const,
        source: 'NASA FIRMS VIIRS',
        lat,
        lng,
        brightness,
        confidence,
        severity,
        date: dateIdx >= 0 ? parts[dateIdx] : '',
        time: timeIdx >= 0 ? parts[timeIdx] : '',
        dayNight: typeIdx >= 0 ? parts[typeIdx] : '',
      });
    }

    return fires;
  } catch (e: any) {
    console.error('[Fires] FIRMS fetch failed:', e.message);
    return [];
  }
}

async function fetchVolcanoes(): Promise<any[]> {
  try {
    const data = await stealthFetchJSON<{
      events: Array<{
        id: string;
        title: string;
        description: string;
        link: string;
        categories: Array<{ id: string; title: string }>;
        sources: Array<{ id: string; url: string }>;
        geometry: Array<{
          type: string;
          coordinates: number[] | number[][];
          date: string;
        }>;
      }>;
    }>('https://eonet.gsfc.nasa.gov/api/v3/events?status=open&category=volcanoes&limit=50', {
      timeout: 10000,
    });

    if (!data.events) return [];

    return data.events.map((event, i) => {
      const geo = event.geometry?.[0];
      if (!geo) return null;

      let lat = 0, lng = 0;
      if (geo.type === 'Point' && Array.isArray(geo.coordinates)) {
        lng = geo.coordinates[0] as number;
        lat = geo.coordinates[1] as number;
      }

      return {
        id: `VOLC-${event.id || i}`,
        type: 'volcano' as const,
        source: 'NASA EONET',
        name: event.title,
        lat,
        lng,
        severity: 'high' as const,
        lastUpdate: geo.date || '',
        link: event.link || '',
      };
    }).filter(Boolean);
  } catch (e: any) {
    console.error('[Fires] EONET volcanoes fetch failed:', e.message);
    return [];
  }
}

export async function GET() {
  try {
    if (cachedData && Date.now() - cachedData.time < CACHE_TTL) {
      return NextResponse.json({
        source: 'NASA FIRMS + EONET (cached)',
        timestamp: cachedData.time,
        fires: cachedData.data,
      });
    }

    const [fires, volcanoes] = await Promise.allSettled([
      fetchFIRMS(),
      fetchVolcanoes(),
    ]);

    const result = {
      fires: fires.status === 'fulfilled' ? fires.value : [],
      volcanoes: volcanoes.status === 'fulfilled' ? volcanoes.value : [],
    };

    const totalCount = result.fires.length + result.volcanoes.length;

    cachedData = { time: Date.now(), data: result };

    return NextResponse.json({
      source: 'NASA FIRMS + EONET',
      timestamp: Date.now(),
      count: totalCount,
      fires: result,
    });
  } catch (error: any) {
    console.error('[Fires] Error:', error.message);

    if (cachedData) {
      return NextResponse.json({
        source: 'NASA FIRMS + EONET (cached · APIs unavailable)',
        timestamp: cachedData.time,
        fires: cachedData.data,
        error: error.message,
      });
    }

    return NextResponse.json({
      source: 'NASA FIRMS + EONET',
      timestamp: Date.now(),
      count: 0,
      fires: { fires: [], volcanoes: [] },
      error: `Failed to fetch fire data: ${error.message}`,
    }, { status: 503 });
  }
}
