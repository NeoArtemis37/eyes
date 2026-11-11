
import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';

const cache = new Map<string, { data: any; ts: number }>();
const CACHE_TTL = 15 * 60 * 1000;

interface LandmarkResult {
  name: string;
  description: string;
  extract: string;
  thumbnail: string | null;
  fullImage: string | null;
  wikipediaUrl: string | null;
  wikidataId: string | null;
  coordinates: { lat: number; lng: number } | null;
  categories: string[];
  aliases: string[];
  inception: string | null;
  architect: string | null;
  style: string | null;
  height: string | null;
  country: string | null;
  officialWebsite: string | null;
  heritageStatus: string | null;
  source: string;
}

const TIMEOUT = 12000;

const FETCH_HEADERS: Record<string, string> = {
  'User-Agent': 'HORUS-Intelligence/6.0 (OSINT Dashboard; https://github.com/horus-intel)',
  'Accept': 'application/json',
};

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const wikidataId = searchParams.get('wikidata');
  const name = searchParams.get('name');
  const lat = searchParams.get('lat');
  const lng = searchParams.get('lng');

  if (!wikidataId && !name) {
    return NextResponse.json({ error: 'Provide wikidata ID or name parameter' }, { status: 400 });
  }

  const cacheKey = wikidataId || `name:${name}:${lat}:${lng}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return NextResponse.json(cached.data);
  }

  try {
    let result: LandmarkResult;

    if (wikidataId && wikidataId.startsWith('Q')) {
      result = await fetchByWikidata(wikidataId);
    } else {
      result = await fetchByName(name!, lat || undefined, lng || undefined);
    }

    cache.set(cacheKey, { data: result, ts: Date.now() });
    if (cache.size > 100) {
      const oldest = [...cache.entries()].sort((a, b) => a[1].ts - b[1].ts)[0];
      cache.delete(oldest[0]);
    }

    return NextResponse.json(result);
  } catch (err: any) {
    console.error('[HORUS Landmark] Error:', err.message);
    return NextResponse.json({
      name: name || wikidataId || 'Unknown',
      description: '',
      extract: 'Landmark information currently unavailable.',
      thumbnail: null,
      fullImage: null,
      wikipediaUrl: null,
      wikidataId: wikidataId || null,
      coordinates: lat && lng ? { lat: parseFloat(lat), lng: parseFloat(lng) } : null,
      categories: [],
      aliases: [],
      inception: null,
      architect: null,
      style: null,
      height: null,
      country: null,
      officialWebsite: null,
      heritageStatus: null,
      source: 'Wikipedia (unavailable)',
      error: err.message,
    });
  }
}


async function fetchByWikidata(qid: string): Promise<LandmarkResult> {
  const wdUrl = `https://www.wikidata.org/wiki/Special:EntityData/${qid}.json`;
  const wdRes = await fetch(wdUrl, { headers: FETCH_HEADERS, signal: AbortSignal.timeout(TIMEOUT) });
  if (!wdRes.ok) throw new Error(`Wikidata ${wdRes.status}`);

  const wdData = await wdRes.json();
  const entity = wdData.entities?.[qid];
  if (!entity) throw new Error('Entity not found');

  const name = entity.labels?.en?.value || entity.labels?.fr?.value || qid;
  const description = entity.descriptions?.en?.value || '';
  const claims = entity.claims || {};

  const architect = resolveClaim(claims, 'P84');
  const inception = resolveClaim(claims, 'P571');
  const style = resolveClaim(claims, 'P149');
  const height = resolveClaim(claims, 'P2048');
  const country = resolveClaim(claims, 'P17');
  const heritageStatus = resolveClaim(claims, 'P1435');
  const officialWebsite = resolveClaim(claims, 'P856');
  const coordinates = getCoordinates(claims);
  const aliases = (entity.aliases?.en || []).map((a: any) => a.value).slice(0, 5);

  const siteLinks = entity.sitelinks || {};
  const enWikiTitle = siteLinks.enwiki?.title;
  let wikipediaUrl: string | null = null;
  let extract = '';
  let categories: string[] = [];
  let thumbnail: string | null = null;
  let fullImage: string | null = null;

  if (enWikiTitle) {
    wikipediaUrl = `https://en.wikipedia.org/wiki/${encodeURIComponent(enWikiTitle)}`;

    try {
      const wikiUrl = `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(enWikiTitle)}&prop=extracts|categories|pageimages&exintro=0&explaintext=1&exsentences=20&piprop=original&pithumbsize=600&cllimit=15&format=json`;
      const wikiRes = await fetch(wikiUrl, { headers: FETCH_HEADERS, signal: AbortSignal.timeout(TIMEOUT) });
      if (wikiRes.ok) {
        const wikiData = await wikiRes.json();
        const pages = wikiData.query?.pages;
        if (pages) {
          const pid = Object.keys(pages)[0];
          const page = pages[pid];
          extract = page?.extract || '';
          thumbnail = page?.thumbnail?.source || null;
          fullImage = page?.original?.source || null;
          categories = (page?.categories || []).map((c: any) =>
            c.title.replace('Category:', '')
          ).filter((c: string) =>
            !c.startsWith('All ') && !c.startsWith('Pages ') && !c.startsWith('Wikipedia ') &&
            !c.startsWith('Articles ') && !c.startsWith('Coordinates ') && !c.startsWith('Use ') &&
            !c.startsWith('Short ') && !c.startsWith('CS1 ') && !c.startsWith('Wikidata ') &&
            !c.startsWith('Commons ') && !c.startsWith('Webarchive ') && !c.startsWith('Good ') &&
            !c.startsWith('Featured ') && !c.startsWith('GA ') && !c.startsWith('Disambiguation ')
          );
        }
      }
    } catch {}
  }

  if (!thumbnail && claims.P18?.[0]?.mainsnak?.datavalue?.value) {
    const imgName = claims.P18[0].mainsnak.datavalue.value as string;
    thumbnail = getWikimediaThumb(imgName, 600);
    fullImage = fullImage || getWikimediaFull(imgName);
  }

  return {
    name,
    description,
    extract: extract || description || 'No detailed description available for this landmark.',
    thumbnail,
    fullImage,
    wikipediaUrl,
    wikidataId: qid,
    coordinates,
    categories: categories.slice(0, 10),
    aliases,
    inception,
    architect,
    style,
    height,
    country,
    officialWebsite,
    heritageStatus,
    source: 'Wikipedia + Wikidata',
  };
}


async function fetchByName(name: string, lat?: string, lng?: string): Promise<LandmarkResult> {
  const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(name + ' landmark monument')}&srlimit=3&format=json`;
  const searchRes = await fetch(searchUrl, { headers: FETCH_HEADERS, signal: AbortSignal.timeout(TIMEOUT) });
  if (!searchRes.ok) throw new Error(`Wikipedia search ${searchRes.status}`);

  const searchData = await searchRes.json();
  const results = searchData.query?.search || [];

  if (results.length === 0) {
    const wdSearchUrl = `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(name)}&language=en&limit=3&format=json`;
    const wdSearchRes = await fetch(wdSearchUrl, { headers: FETCH_HEADERS, signal: AbortSignal.timeout(TIMEOUT) });
    if (wdSearchRes.ok) {
      const wdData = await wdSearchRes.json();
      const wdResults = wdData.search || [];
      if (wdResults.length > 0 && wdResults[0].id) {
        return fetchByWikidata(wdResults[0].id);
      }
    }

    return {
      name,
      description: '',
      extract: 'No Wikipedia article found for this landmark.',
      thumbnail: null, fullImage: null, wikipediaUrl: null, wikidataId: null,
      coordinates: lat && lng ? { lat: parseFloat(lat), lng: parseFloat(lng) } : null,
      categories: [], aliases: [], inception: null, architect: null, style: null,
      height: null, country: null, officialWebsite: null, heritageStatus: null,
      source: 'Wikipedia (not found)',
    };
  }

  const wikiTitle = results[0].title;

  const detailUrl = `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(wikiTitle)}&prop=extracts|pageimages|categories|info|pageprops&inprop=url&exintro=0&explaintext=1&exsentences=20&piprop=original&pithumbsize=600&cllimit=15&ppprop=wikibase_item&format=json`;
  const detailRes = await fetch(detailUrl, { headers: FETCH_HEADERS, signal: AbortSignal.timeout(TIMEOUT) });
  if (!detailRes.ok) throw new Error(`Wikipedia detail ${detailRes.status}`);

  const detailData = await detailRes.json();
  const pages = detailData.query?.pages;
  if (!pages) throw new Error('No page data');

  const pid = Object.keys(pages)[0];
  const page = pages[pid];
  const extract = page?.extract || '';
  let thumbnail = page?.thumbnail?.source || null;
  let fullImage = page?.original?.source || thumbnail;
  const wikipediaUrl = page?.fullurl || `https://en.wikipedia.org/wiki/${encodeURIComponent(wikiTitle)}`;
  const wikidataId = page?.pageprops?.wikibase_item || null;
  const categories = (page?.categories || []).map((c: any) =>
    c.title.replace('Category:', '')
  ).filter((c: string) =>
    !c.startsWith('All ') && !c.startsWith('Pages ') && !c.startsWith('Wikipedia ') &&
    !c.startsWith('Articles ') && !c.startsWith('Coordinates ') && !c.startsWith('Use ') &&
    !c.startsWith('Short ') && !c.startsWith('CS1 ') && !c.startsWith('Wikidata ') &&
    !c.startsWith('Commons ') && !c.startsWith('Webarchive ') && !c.startsWith('Good ') &&
    !c.startsWith('Featured ') && !c.startsWith('GA ') && !c.startsWith('Disambiguation ')
  );

  let architect: string | null = null;
  let inception: string | null = null;
  let style: string | null = null;
  let height: string | null = null;
  let country: string | null = null;
  let heritageStatus: string | null = null;
  let officialWebsite: string | null = null;
  let aliases: string[] = [];

  if (wikidataId) {
    try {
      const entityUrl = `https://www.wikidata.org/wiki/Special:EntityData/${wikidataId}.json`;
      const entityRes = await fetch(entityUrl, { headers: FETCH_HEADERS, signal: AbortSignal.timeout(TIMEOUT) });
      if (entityRes.ok) {
        const entityData = await entityRes.json();
        const entity = entityData.entities?.[wikidataId];
        if (entity) {
          const claims = entity.claims || {};
          architect = resolveClaim(claims, 'P84');
          inception = resolveClaim(claims, 'P571');
          style = resolveClaim(claims, 'P149');
          height = resolveClaim(claims, 'P2048');
          country = resolveClaim(claims, 'P17');
          heritageStatus = resolveClaim(claims, 'P1435');
          officialWebsite = resolveClaim(claims, 'P856');
          aliases = (entity.aliases?.en || []).map((a: any) => a.value).slice(0, 5);

          if (!thumbnail && claims.P18?.[0]?.mainsnak?.datavalue?.value) {
            const imgName = claims.P18[0].mainsnak.datavalue.value as string;
            thumbnail = getWikimediaThumb(imgName, 600);
          }
        }
      }
    } catch {}
  }

  return {
    name: wikiTitle,
    description: extract.split('\n')[0]?.slice(0, 200) || '',
    extract: extract || 'No detailed description available.',
    thumbnail,
    fullImage,
    wikipediaUrl,
    wikidataId,
    coordinates: lat && lng ? { lat: parseFloat(lat), lng: parseFloat(lng) } : null,
    categories: categories.slice(0, 10),
    aliases,
    inception,
    architect,
    style,
    height,
    country,
    officialWebsite,
    heritageStatus,
    source: 'Wikipedia + Wikidata',
  };
}


function resolveClaim(claims: any, property: string): string | null {
  const claim = claims[property];
  if (!claim || !claim[0]?.mainsnak?.datavalue?.value) return null;
  const val = claim[0].mainsnak.datavalue.value;

  if (typeof val === 'string') return val;
  if (val.time) return val.time.replace(/^\+/, '').replace(/T.*$/, '').replace(/-00$/, '');
  if (val.amount !== undefined) return String(val.amount).replace(/^\+/, '');
  if (val.id) return val.id;  // Wikidata entity ref (e.g. Q84 for London)
  if (typeof val === 'object') return JSON.stringify(val);
  return String(val);
}

function getCoordinates(claims: any): { lat: number; lng: number } | null {
  const coords = claims.P625;
  if (!coords?.[0]?.mainsnak?.datavalue?.value) return null;
  const v = coords[0].mainsnak.datavalue.value;
  if (v.latitude !== undefined && v.longitude !== undefined) {
    return { lat: v.latitude, lng: v.longitude };
  }
  return null;
}

function md5(str: string): string {
  return createHash('md5').update(str).digest('hex');
}

function getWikimediaThumb(filename: string, size: number): string {
  const encoded = filename.replace(/ /g, '_');
  const hash = md5(encoded);
  const ext = filename.split('.').pop()?.toLowerCase() || 'jpg';
  const thumbExt = ext === 'svg' ? 'png' : ext;
  const baseName = encoded.replace(/\.\w+$/, '.' + thumbExt);
  return `https://upload.wikimedia.org/wikipedia/commons/thumb/${hash.slice(0, 1)}/${hash.slice(0, 2)}/${encodeURIComponent(encoded)}/${size}px-${encodeURIComponent(baseName)}`;
}

function getWikimediaFull(filename: string): string {
  const encoded = filename.replace(/ /g, '_');
  const hash = md5(encoded);
  return `https://upload.wikimedia.org/wikipedia/commons/${hash.slice(0, 1)}/${hash.slice(0, 2)}/${encodeURIComponent(encoded)}`;
}
