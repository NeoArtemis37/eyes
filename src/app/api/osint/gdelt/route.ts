
import { NextResponse } from 'next/server';
import { stealthFetchJSON } from '@/lib/stealthFetch';

let cachedData: { time: number; data: any[] } | null = null;
const CACHE_TTL = 900000; // 15 minutes


type Category = 'unrest' | 'conflict' | 'crisis';
type Severity = 'low' | 'medium' | 'high' | 'critical';

interface GDELTEvent {
  id: string;
  name: string;
  lat: number;
  lng: number;
  category: Category;
  severity: Severity;
  url: string;
  date: string;
  source: string;
}

interface GDELTGeoJSON {
  type: string;
  features: Array<{
    type: string;
    geometry: {
      type: string;
      coordinates: [number, number]; // [lng, lat]
    };
    properties: {
      url: string;
      name: string;
      date: string;
      source: string;
      value?: number;
      count?: number;
    };
  }>;
}


function classifySeverity(name: string, category: Category): Severity {
  const n = name.toLowerCase();

  if (/massacre|genocide|nuclear|chemical weapon|biological weapon|war crime|ethnic cleansing/i.test(n)) return 'critical';
  if (category === 'crisis' && /coup d.état|overthrow|revolution|martial law|state of emergency|collapse/i.test(n)) return 'critical';
  if (category === 'conflict' && /airstrike|bombing|invasion|offensive|shelling|missile/i.test(n)) return 'critical';
  if (category === 'unrest' && /massacre|mass killing|terrorist attack/i.test(n)) return 'critical';

  if (category === 'conflict' && /attack|strike|combat|clash|firefight|assault|killed|casualties/i.test(n)) return 'high';
  if (category === 'unrest' && /riot|violent|arson|looting|clash with police|dead/i.test(n)) return 'high';
  if (category === 'crisis' && /crackdown|purge|suspension|coup|resignation|assassination/i.test(n)) return 'high';

  if (category === 'conflict' && /military|troop|soldier|deploy|escalat|tension|border|skirmish/i.test(n)) return 'medium';
  if (category === 'unrest' && /protest|march|demonstration|strike|walkout|unrest|dispute/i.test(n)) return 'medium';
  if (category === 'crisis' && /crisis|emergency|sanction|expel|political|impeach|detain/i.test(n)) return 'medium';

  return 'low';
}


function deduplicateEvents(events: GDELTEvent[]): GDELTEvent[] {
  const seen = new Map<string, GDELTEvent>();

  for (const event of events) {
    const gridKey = `${Math.round(event.lat * 2) / 2}_${Math.round(event.lng * 2) / 2}`;
    const nameKey = event.name.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 40);
    const dedupeKey = `${gridKey}_${nameKey}`;

    if (!seen.has(dedupeKey)) {
      seen.set(dedupeKey, event);
    } else {
      const existing = seen.get(dedupeKey)!;
      const severityRank: Record<Severity, number> = { critical: 4, high: 3, medium: 2, low: 1 };
      if (severityRank[event.severity] > severityRank[existing.severity]) {
        seen.set(dedupeKey, event);
      }
    }
  }

  return Array.from(seen.values());
}


export async function GET() {
  try {
    if (cachedData && Date.now() - cachedData.time < CACHE_TTL) {
      return NextResponse.json({
        source: 'GDELT 2.0 (cached)',
        timestamp: cachedData.time,
        count: cachedData.data.length,
        events: cachedData.data,
      });
    }

    const queries: { query: string; category: Category }[] = [
      { query: 'protest OR riot OR unrest', category: 'unrest' },
      { query: 'conflict OR military OR attack OR strike', category: 'conflict' },
      { query: 'coup OR revolution OR emergency', category: 'crisis' },
    ];

    const results = await Promise.allSettled(
      queries.map(async ({ query, category }) => {
        const url = `https://api.gdeltproject.org/api/v2/geo/geo?query=${encodeURIComponent(query)}&format=GeoJSON&timespan=24h&maxpoints=100`;
        const data = await stealthFetchJSON<GDELTGeoJSON>(url, { timeout: 15000, retries: 1 });
        return { data, category };
      })
    );

    const allEvents: GDELTEvent[] = [];
    let eventCounter = 0;

    for (const result of results) {
      if (result.status !== 'fulfilled') {
        console.warn(`[GDELT] Query failed: ${result.reason?.message || 'unknown'}`);
        continue;
      }

      const { data, category } = result.value;

      if (!data?.features || !Array.isArray(data.features)) continue;

      for (const feature of data.features) {
        const coords = feature.geometry?.coordinates;
        const props = feature.properties;

        if (!coords || coords.length < 2) continue;

        const lat = coords[1];
        const lng = coords[0];

        if (isNaN(lat) || isNaN(lng) || (lat === 0 && lng === 0)) continue;
        if (lat < -90 || lat > 90 || lng < -180 || lng > 180) continue;

        const name = props.name || 'Unknown Event';
        const severity = classifySeverity(name, category);
        eventCounter++;

        allEvents.push({
          id: `GDELT-${category.toUpperCase().substring(0, 3)}-${String(eventCounter).padStart(4, '0')}`,
          name,
          lat: Math.round(lat * 1000) / 1000,
          lng: Math.round(lng * 1000) / 1000,
          category,
          severity,
          url: props.url || '',
          date: props.date || new Date().toISOString(),
          source: props.source || 'GDELT',
        });
      }
    }

    const deduped = deduplicateEvents(allEvents);

    const severityOrder: Record<Severity, number> = { critical: 0, high: 1, medium: 2, low: 3 };
    deduped.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

    cachedData = { time: Date.now(), data: deduped };

    return NextResponse.json({
      source: 'GDELT 2.0',
      timestamp: Date.now(),
      count: deduped.length,
      events: deduped,
    });
  } catch (error: any) {
    console.error('[GDELT] Error:', error.message);

    if (cachedData && cachedData.data.length > 0) {
      return NextResponse.json({
        source: 'GDELT 2.0 (cached · API unavailable)',
        timestamp: cachedData.time,
        count: cachedData.data.length,
        events: cachedData.data,
        error: error.message,
      });
    }

    return NextResponse.json({
      source: 'GDELT 2.0',
      timestamp: Date.now(),
      count: 0,
      events: [],
      error: `Failed to fetch GDELT data: ${error.message}`,
    }, { status: 503 });
  }
}
