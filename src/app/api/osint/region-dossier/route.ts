
import { NextRequest, NextResponse } from 'next/server';

const CACHE = new Map<string, { data: any; time: number }>();
const CACHE_TTL = 3600_000; // 1 hour cache

export async function GET(request: NextRequest) {
  const lat = parseFloat(request.nextUrl.searchParams.get('lat') || '0');
  const lng = parseFloat(request.nextUrl.searchParams.get('lng') || '0');

  if (!lat && !lng) {
    return NextResponse.json({ error: 'Missing lat/lng parameters' }, { status: 400 });
  }

  const cacheKey = `${lat.toFixed(2)},${lng.toFixed(2)}`;
  const cached = CACHE.get(cacheKey);
  if (cached && Date.now() - cached.time < CACHE_TTL) {
    return NextResponse.json(cached.data);
  }

  try {
    const nominatimRes = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&zoom=10&addressdetails=1&extratags=1&namedetails=1`,
      {
        headers: {
          'User-Agent': 'OSINT-CommandCenter/2.0 (Intelligence Platform)',
          'Accept-Language': 'en',
        },
        signal: AbortSignal.timeout(10000),
      }
    );

    const nominatimData = nominatimRes.ok ? await nominatimRes.json() : null;
    const countryCode = nominatimData?.address?.country_code?.toUpperCase();

    let countryInfo: any = null;
    if (countryCode) {
      try {
        const nagerRes = await fetch(
          `https://date.nager.at/api/v3/CountryInfo/${countryCode}`,
          { signal: AbortSignal.timeout(8000) }
        );
        if (nagerRes.ok) {
          countryInfo = await nagerRes.json();
        }
      } catch {}
    }

    let wikiData: any = null;
    const wikidataId = nominatimData?.extratags?.wikidata;
    if (wikidataId) {
      try {
        const sparql = encodeURIComponent(`
          SELECT ?population ?area ?capitalLabel ?flag ?coatOfArms ?officialName WHERE {
            OPTIONAL { wd:${wikidataId} wdt:P1082 ?population. }
            OPTIONAL { wd:${wikidataId} wdt:P2046 ?area. }
            OPTIONAL { wd:${wikidataId} wdt:P36 ?capital. SERVICE wikibase:label { bd:serviceParam wikibase:language "en". ?capital rdfs:label ?capitalLabel. } }
            OPTIONAL { wd:${wikidataId} wdt:P41 ?flag. }
            OPTIONAL { wd:${wikidataId} wdt:P94 ?coatOfArms. }
            OPTIONAL { wd:${wikidataId} wdt:P1448 ?officialName. FILTER(LANG(?officialName) = "en") }
          }
          LIMIT 1
        `);
        const wdRes = await fetch(
          `https://query.wikidata.org/sparql?query=${sparql}&format=json`,
          {
            headers: { 'User-Agent': 'OSINT-CommandCenter/2.0' },
            signal: AbortSignal.timeout(10000),
          }
        );
        if (wdRes.ok) {
          const wdJson = await wdRes.json();
          const bindings = wdJson?.results?.bindings?.[0];
          if (bindings) {
            wikiData = {
              population: bindings.population?.value ? parseInt(bindings.population.value) : null,
              area: bindings.area?.value ? parseFloat(bindings.area.value) : null,
              capital: bindings.capitalLabel?.value || '',
              flagUrl: bindings.flag?.value || '',
              coatOfArmsUrl: bindings.coatOfArms?.value || '',
              officialName: bindings.officialName?.value || '',
            };
          }
        }
      } catch {}
    }

    const address = nominatimData?.address || {};
    const displayName = nominatimData?.display_name || 'Unknown Location';
    const countryName = countryInfo?.commonName || address.country || '';

    const dossier = {
      location: {
        lat,
        lng,
        displayName,
        city: address.city || address.town || address.village || address.municipality || address.county || '',
        state: address.state || address.province || '',
        country: countryName,
        countryCode: countryCode || '',
        region: countryInfo?.region || '',
      },

      country: countryCode ? {
        name: countryName,
        officialName: countryInfo?.officialName || wikiData?.officialName || '',
        nativeName: countryInfo?.nativeName || '',
        capital: wikiData?.capital || countryInfo?.commonName === 'France' ? 'Paris' : '',
        region: countryInfo?.region || '',
        population: wikiData?.population || null,
        area: wikiData?.area || null,
        density: wikiData?.population && wikiData?.area
          ? Math.round(wikiData.population / wikiData.area)
          : null,
        flagUrl: wikiData?.flagUrl || `https://flagcdn.com/w80/${countryCode.toLowerCase()}.png`,
        coatOfArmsUrl: wikiData?.coatOfArmsUrl || '',
        borders: (countryInfo?.borders || []).map((b: any) => b.commonName || b.countryCode),
        countryCode,
        emoji: countryCode
          ? String.fromCodePoint(...[...countryCode].map(c => 0x1F1E6 + c.charCodeAt(0) - 65))
          : '',
        mapsUrl: `https://www.google.com/maps/@${lat},${lng},12z`,
        osmUrl: `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=14/${lat}/${lng}`,
        wikiUrl: `https://en.wikipedia.org/wiki/${encodeURIComponent(countryName)}`,
        streetViewUrl: `https://www.google.com/maps/@${lat},${lng},3a,75y,0h,90t/data=!3m6!1e1!3m4!1s`,
      } : null,

      addressDetails: {
        road: address.road || address.street || '',
        suburb: address.suburb || address.neighbourhood || '',
        postcode: address.postcode || '',
        county: address.county || '',
        stateDistrict: address.state_district || '',
        iso3166: address.ISO3166_2_lvl4 || address.ISO3166_2_lvl6 || '',
      },

      extraTags: nominatimData?.extratags || {},
      localPopulation: nominatimData?.extratags?.population || null,

      osm: nominatimData ? {
        osmId: nominatimData.osm_id || '',
        osmType: nominatimData.osm_type || '',
        placeRank: nominatimData.place_rank || 0,
        category: nominatimData.category || '',
        type: nominatimData.type || '',
        importance: nominatimData.importance || 0,
      } : null,

      timestamp: new Date().toISOString(),
    };

    CACHE.set(cacheKey, { data: dossier, time: Date.now() });
    if (CACHE.size > 500) {
      const now = Date.now();
      for (const [k, v] of CACHE) {
        if (now - v.time > CACHE_TTL) CACHE.delete(k);
      }
    }

    return NextResponse.json(dossier, {
      headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200' },
    });
  } catch (error: any) {
    console.error('Region dossier error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate dossier', lat, lng },
      { status: 502 }
    );
  }
}
