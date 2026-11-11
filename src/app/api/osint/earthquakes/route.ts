
import { NextResponse } from 'next/server';
import { stealthFetchJSON } from '@/lib/stealthFetch';

let cachedData: { time: number; data: any[] } | null = null;
const CACHE_TTL = 120000; // 2 minutes

const wikiGeoCache = new Map<string, { article: string; extract: string; thumbnail?: string; url: string; time: number }>();
const WIKI_CACHE_TTL = 3600000; // 1 hour

interface USGSFeature {
  type: string;
  properties: {
    mag: number | null;
    place: string;
    time: number;
    updated: number;
    url: string;
    detail: string;
    felt: number | null;
    cdi: number | null;
    mmi: number | null;
    alert: string | null;
    status: string;
    tsunami: number;
    sig: number;
    net: string;
    code: string;
    ids: string;
    sources: string;
    types: string;
    nst: number | null;
    dmin: number | null;
    rms: number | null;
    gap: number | null;
    magType: string;
    type: string;
    title: string;
  };
  geometry: {
    type: string;
    coordinates: [number, number, number]; // [lng, lat, depth]
  };
  id: string;
}

async function fetchWikiContext(lat: number, lng: number): Promise<{ article: string; extract: string; thumbnail?: string; url: string } | null> {
  const cacheKey = `${lat.toFixed(1)},${lng.toFixed(1)}`;
  const cached = wikiGeoCache.get(cacheKey);
  if (cached && Date.now() - cached.time < WIKI_CACHE_TTL) {
    return { article: cached.article, extract: cached.extract, thumbnail: cached.thumbnail, url: cached.url };
  }

  try {
    const geoData = await stealthFetchJSON<{
      query?: { geosearch?: Array<{ pageid: number; title: string; lat: number; lng: number; dist: number }> };
    }>(`https://en.wikipedia.org/w/api.php?action=query&list=geosearch&gscoord=${lat}|${lng}&gsradius=50000&gslimit=5&format=json&origin=*`, {
      timeout: 5000,
    });

    const geoResults = geoData?.query?.geosearch;
    if (!geoResults || geoResults.length === 0) return null;

    const geoKeywords = ['earthquake', 'seismic', 'fault', 'tectonic', 'geology', 'volcano', 'plate', 'rift', 'subduction', 'region', 'city', 'capital', 'province', 'prefecture'];
    const sortedResults = [...geoResults].sort((a, b) => {
      const aScore = geoKeywords.some(k => a.title.toLowerCase().includes(k)) ? -1 : 0;
      const bScore = geoKeywords.some(k => b.title.toLowerCase().includes(k)) ? -1 : 0;
      if (aScore !== bScore) return aScore - bScore;
      return a.dist - b.dist;
    });

    const bestArticle = sortedResults[0];

    const extractData = await stealthFetchJSON<{
      query?: { pages?: Record<string, { title: string; extract?: string; thumbnail?: { source: string }; fullurl?: string }> };
    }>(`https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(bestArticle.title)}&prop=extracts|pageimages|info&exintro=true&explaintext=true&exsentences=3&pithumbsize=200&inprop=url&format=json&origin=*`, {
      timeout: 5000,
    });

    const pages = extractData?.query?.pages;
    if (!pages) return null;

    const page = Object.values(pages)[0] as any;
    if (!page || page.missing !== undefined) return null;

    const result = {
      article: page.title || bestArticle.title,
      extract: page.extract?.substring(0, 300) || '',
      thumbnail: page.thumbnail?.source,
      url: page.fullurl || `https://en.wikipedia.org/wiki/${encodeURIComponent(bestArticle.title)}`,
    };

    wikiGeoCache.set(cacheKey, { ...result, time: Date.now() });
    return result;
  } catch (err) {
    return null;
  }
}

async function fetchWikiEarthquakeEvent(magnitude: number, place: string): Promise<{ article: string; extract: string; url: string } | null> {
  try {
    const searchTerm = `${place.split(',')[0].trim()} earthquake`;
    const searchData = await stealthFetchJSON<{
      query?: { search?: Array<{ title: string; snippet: string }> };
    }>(`https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(searchTerm)}&srlimit=3&format=json&origin=*`, {
      timeout: 5000,
    });

    const results = searchData?.query?.search;
    if (!results || results.length === 0) return null;

    const eqArticle = results.find(r =>
      r.title.toLowerCase().includes('earthquake') || r.snippet.toLowerCase().includes('earthquake')
    ) || results[0];

    return {
      article: eqArticle.title,
      extract: eqArticle.snippet.replace(/<[^>]+>/g, '').substring(0, 200),
      url: `https://en.wikipedia.org/wiki/${encodeURIComponent(eqArticle.title)}`,
    };
  } catch {
    return null;
  }
}

export async function GET() {
  try {
    if (cachedData && Date.now() - cachedData.time < CACHE_TTL) {
      return NextResponse.json({
        source: 'USGS + Wikipedia (cached)',
        timestamp: cachedData.time,
        count: cachedData.data.length,
        earthquakes: cachedData.data,
      });
    }

    const data = await stealthFetchJSON<{
      type: string;
      metadata: { generated: number; url: string; title: string; count: number };
      features: USGSFeature[];
    }>('https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson', {
      timeout: 10000,
    });

    if (!data.features || data.features.length === 0) {
      throw new Error('No earthquake data returned');
    }

    const earthquakes = data.features.map((feature) => {
      const props = feature.properties;
      const coords = feature.geometry.coordinates;
      const magnitude = props.mag || 0;

      let severity: 'minor' | 'moderate' | 'strong' | 'major' | 'great';
      if (magnitude < 4.0) severity = 'minor';
      else if (magnitude < 5.0) severity = 'moderate';
      else if (magnitude < 6.0) severity = 'strong';
      else if (magnitude < 7.0) severity = 'major';
      else severity = 'great';

      return {
        id: feature.id,
        magnitude: Math.round(magnitude * 10) / 10,
        place: props.place || 'Unknown location',
        time: props.time,
        lat: coords[1],
        lng: coords[0],
        depth: Math.round(coords[2] * 10) / 10,
        severity,
        significance: props.sig,
        tsunami: props.tsunami === 1,
        alertLevel: props.alert || null,
        felt: props.felt || null,
        type: props.type || 'earthquake',
        url: props.url,
        wikipedia: null as any,
      };
    });

    const significantQuakes = earthquakes.filter(eq => eq.magnitude >= 4.5);
    const batchSize = 3;
    for (let i = 0; i < significantQuakes.length; i += batchSize) {
      const batch = significantQuakes.slice(i, i + batchSize);
      const wikiResults = await Promise.allSettled(
        batch.map(async (eq) => {
          const [geoWiki, eventWiki] = await Promise.allSettled([
            fetchWikiContext(eq.lat, eq.lng),
            eq.magnitude >= 5.0 ? fetchWikiEarthquakeEvent(eq.magnitude, eq.place) : Promise.resolve(null),
          ]);

          const geo = geoWiki.status === 'fulfilled' ? geoWiki.value : null;
          const event = eventWiki.status === 'fulfilled' ? eventWiki.value : null;

          return { geo, event };
        })
      );

      for (let j = 0; j < batch.length; j++) {
        const result = wikiResults[j];
        if (result.status === 'fulfilled' && (result.value.geo || result.value.event)) {
          batch[j].wikipedia = {
            locationArticle: result.value.geo ? {
              title: result.value.geo.article,
              extract: result.value.geo.extract,
              thumbnail: result.value.geo.thumbnail,
              url: result.value.geo.url,
            } : null,
            earthquakeArticle: result.value.event ? {
              title: result.value.event.article,
              extract: result.value.event.extract,
              url: result.value.event.url,
            } : null,
          };
        }
      }
    }

    cachedData = { time: Date.now(), data: earthquakes };

    const enrichedCount = earthquakes.filter(eq => eq.wikipedia).length;
    return NextResponse.json({
      source: `USGS + Wikipedia (${enrichedCount}/${earthquakes.length} enriched)`,
      timestamp: Date.now(),
      count: earthquakes.length,
      earthquakes,
    });
  } catch (error: any) {
    console.error('[Earthquakes] USGS error:', error.message);

    if (cachedData) {
      return NextResponse.json({
        source: 'USGS + Wikipedia (cached · API unavailable)',
        timestamp: cachedData.time,
        count: cachedData.data.length,
        earthquakes: cachedData.data,
        error: error.message,
      });
    }

    return NextResponse.json({
      source: 'USGS Earthquake Hazards Program',
      timestamp: Date.now(),
      count: 0,
      earthquakes: [],
      error: `Failed to fetch earthquake data: ${error.message}`,
    }, { status: 503 });
  }
}
