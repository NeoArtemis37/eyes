
import { NextRequest, NextResponse } from 'next/server';

const POI_CATEGORIES: Record<string, { tags: string[]; icon: string; color: string }> = {
  monument: {
    tags: [
      'historic=monument', 'historic=castle', 'historic=memorial',
      'historic=ruins', 'historic=archaeological_site',
      'historic=heritage', 'historic=building',
      'tourism=artwork', 'tourism=attraction',
    ],
    icon: '🏛️', color: '#f59e0b',
  },
  tower: {
    tags: [
      'man_made=tower', 'man_made=lighthouse', 'man_made=observatory',
      'man_made=communications_tower', 'man_made=water_tower',
      'tower=communication', 'tower=observation',
    ],
    icon: '🗼', color: '#eab308',
  },
  museum: {
    tags: [
      'tourism=museum', 'tourism=gallery', 'tourism=information',
      'museum=yes',
    ],
    icon: '🖼️', color: '#a855f7',
  },
  viewpoint: {
    tags: [
      'tourism=viewpoint', 'tourism=picnic_site', 'tourism=camp_site',
      'natural=peak', 'natural=cliff', 'natural=volcano',
    ],
    icon: '🏔️', color: '#22c55e',
  },
  public_building: {
    tags: [
      'amenity=townhall', 'amenity=community_centre', 'amenity=library',
      'building=public', 'amenity=concert_hall', 'amenity=theatre',
      'amenity=cinema', 'amenity=conference_centre',
    ],
    icon: '🏢', color: '#06b6d4',
  },
  court: {
    tags: [
      'amenity=courthouse', 'office=government', 'office=administrate',
    ],
    icon: '⚖️', color: '#8b5cf6',
  },
  embassy: {
    tags: [
      'amenity=embassy', 'diplomatic=embassy',
    ],
    icon: '🏳️', color: '#10b981',
  },
  police_military: {
    tags: [
      'amenity=police', 'military=yes', 'landuse=military',
      'military=barracks', 'military=airfield', 'military=naval_base',
    ],
    icon: '🛡️', color: '#ef4444',
  },
  prison: {
    tags: ['amenity=prison'],
    icon: '🔒', color: '#dc2626',
  },
  construction: {
    tags: [
      'landuse=construction', 'highway=construction', 'building=construction',
      'highway=proposed', 'building=proposed',
    ],
    icon: '🏗️', color: '#f97316',
  },
  hospital: {
    tags: [
      'amenity=hospital', 'amenity=clinic', 'healthcare=hospital',
      'healthcare=clinic',
    ],
    icon: '🏥', color: '#ec4899',
  },
  education: {
    tags: [
      'amenity=university', 'amenity=college', 'amenity=school',
      'amenity=research_institute',
    ],
    icon: '🎓', color: '#6366f1',
  },
  transport: {
    tags: [
      'amenity=bus_station', 'railway=station', 'aeroway=aerodrome',
      'amenity=ferry_terminal', 'public_transport=station',
    ],
    icon: '🚉', color: '#14b8a6',
  },
  place_of_worship: {
    tags: [
      'amenity=place_of_worship', 'building=cathedral',
      'building=chapel', 'building=mosque', 'building=temple',
      'building=synagogue', 'building=shrine',
    ],
    icon: '⛪', color: '#a855f7',
  },
  world_heritage: {
    tags: [
      'heritage=1', 'heritage=2', 'heritage=3',
      'heritage:unesco=yes', 'protection_title=World Heritage Site',
    ],
    icon: '🌍', color: '#fbbf24',
  },
  bridge: {
    tags: [
      'bridge=yes', 'bridge=suspension', 'bridge=arch',
      'bridge=cantilever', 'bridge=cable-stayed',
      'man_made=bridge', 'man_made=dam', 'man_made=aqueduct',
    ],
    icon: '🌉', color: '#0ea5e9',
  },
  sports: {
    tags: [
      'leisure=stadium', 'leisure=sports_centre', 'leisure=swimming_pool',
      'leisure=track', 'building=stadium', 'building=sports_centre',
    ],
    icon: '🏟️', color: '#f43f5e',
  },
  park: {
    tags: [
      'leisure=park', 'leisure=garden', 'tourism=garden',
      'boundary=national_park', 'leisure=nature_reserve',
    ],
    icon: '🌳', color: '#22c55e',
  },
};

const cache = new Map<string, { data: any; ts: number }>();
const CACHE_TTL = 5 * 60 * 1000;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const lat = parseFloat(searchParams.get('lat') || '0');
  const lng = parseFloat(searchParams.get('lng') || '0');
  const radius = Math.min(parseFloat(searchParams.get('radius') || '3000'), 10000);
  const categories = searchParams.get('categories') || 'all';

  if (!lat || !lng || (Math.abs(lat) > 90) || (Math.abs(lng) > 180)) {
    return NextResponse.json({ error: 'Invalid coordinates. Provide lat and lng.' }, { status: 400 });
  }

  const cacheKey = `${lat.toFixed(3)},${lng.toFixed(3)},${radius},${categories}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return NextResponse.json(cached.data);
  }

  try {
    const catsToQuery = categories === 'all'
      ? ['monument', 'tower', 'museum', 'world_heritage', 'bridge', 'viewpoint',
         'public_building', 'court', 'embassy', 'police_military', 'hospital',
         'education', 'transport', 'place_of_worship', 'park']
      : categories.split(',').filter(c => POI_CATEGORIES[c]);

    const LANDMARK_CATS = ['monument', 'tower', 'museum', 'world_heritage', 'bridge', 'viewpoint'];
    const landmarkCats = catsToQuery.filter(c => LANDMARK_CATS.includes(c));
    const otherCats = catsToQuery.filter(c => !LANDMARK_CATS.includes(c));

    const buildClauses = (cats: string[]) => cats.flatMap(cat =>
      POI_CATEGORIES[cat].tags.map(tag => {
        const idx = tag.indexOf('=');
        const k = tag.substring(0, idx);
        const v = tag.substring(idx + 1);
        return [
          `node["${k}"="${v}"](around:${radius},${lat},${lng});`,
          `way["${k}"="${v}"](around:${radius},${lat},${lng});`,
        ];
      }).flat()
    );

    const fetchHeaders = {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'HORUS-Intelligence/6.0 (OSINT Dashboard; https://github.com/horus-intel)',
    };

    let allPois: any[] = [];

    if (landmarkCats.length > 0) {
      const clauses = buildClauses(landmarkCats);
      const query = `[out:json][timeout:25];(${clauses.join('\n')});out center body qt 150;`;
      try {
        const res = await fetch('https://overpass-api.de/api/interpreter', {
          method: 'POST',
          headers: fetchHeaders,
          body: `data=${encodeURIComponent(query)}`,
          signal: AbortSignal.timeout(30000),
        });
        if (res.ok) {
          const data = await res.json();
          allPois.push(...(data.elements || []));
        }
      } catch {}
    }

    if (otherCats.length > 0) {
      const clauses = buildClauses(otherCats);
      const query = `[out:json][timeout:25];(${clauses.join('\n')});out center body qt 100;`;
      try {
        const res = await fetch('https://overpass-api.de/api/interpreter', {
          method: 'POST',
          headers: fetchHeaders,
          body: `data=${encodeURIComponent(query)}`,
          signal: AbortSignal.timeout(30000),
        });
        if (res.ok) {
          const data = await res.json();
          allPois.push(...(data.elements || []));
        }
      } catch {}
    }

    const seen = new Set<number>();
    const pois = allPois.map((el: any) => {
      const elLat = el.lat || el.center?.lat;
      const elLng = el.lon || el.center?.lon;
      const tags = el.tags || {};

      if (seen.has(el.id) || !elLat || !elLng) return null;
      seen.add(el.id);

      let category = 'public_building';
      let catConfig = POI_CATEGORIES.public_building;
      for (const [cat, cfg] of Object.entries(POI_CATEGORIES)) {
        if (catsToQuery.includes(cat)) {
          const matches = cfg.tags.some(tag => {
            const idx = tag.indexOf('=');
            const k = tag.substring(0, idx);
            const v = tag.substring(idx + 1);
            return tags[k] === v;
          });
          if (matches) {
            category = cat;
            catConfig = cfg;
            break;
          }
        }
      }

      const name = tags['name:en'] || tags.name || tags['name:fr'] || tags['name:es'] || tags['name:de'] || tags['name:ar'] || tags['name:zh'] || tags['name:ja'] || tags['name:ru'] || null;

      const isLandmark = !!(
        tags.historic || tags['heritage:unesco'] || tags.heritage ||
        tags.tourism === 'attraction' || tags.tourism === 'museum' || tags.tourism === 'artwork' ||
        tags.man_made === 'tower' || tags.man_made === 'lighthouse' || tags.man_made === 'observatory' ||
        tags.building === 'cathedral' || tags.building === 'castle' || tags.building === 'stadium' ||
        tags.wikipedia || tags.wikidata ||
        tags['tower:type'] || tags.height
      );

      return {
        id: el.id,
        lat: elLat,
        lng: elLng,
        type: el.type,
        category,
        icon: catConfig.icon,
        color: catConfig.color,
        name,
        isLandmark,
        tags: {
          historic: tags.historic || null,
          amenity: tags.amenity || null,
          building: tags.building || null,
          landuse: tags.landuse || null,
          office: tags.office || null,
          military: tags.military || null,
          diplomatic: tags.diplomatic || null,
          healthcare: tags.healthcare || null,
          railway: tags.railway || null,
          aeroway: tags.aeroway || null,
          religion: tags.religion || null,
          operator: tags.operator || null,
          wheelchair: tags.wheelchair || null,
          opening_hours: tags.opening_hours || null,
          phone: tags.phone || null,
          website: tags.website || null,
          wikidata: tags.wikidata || null,
          wikipedia: tags.wikipedia || null,
          tourism: tags.tourism || null,
          man_made: tags.man_made || null,
          heritage: tags.heritage || null,
          'heritage:unesco': tags['heritage:unesco'] || null,
          height: tags.height || null,
          'tower:type': tags['tower:type'] || null,
          bridge: tags.bridge || null,
          leisure: tags.leisure || null,
          natural: tags.natural || null,
          description: tags.description || tags['description:en'] || null,
        },
        address: {
          street: tags['addr:street'] || null,
          city: tags['addr:city'] || null,
          postcode: tags['addr:postcode'] || null,
          country: tags['addr:country'] || null,
          housenumber: tags['addr:housenumber'] || null,
        },
      };
    }).filter((p: any) => p !== null);

    pois.sort((a: any, b: any) => {
      if (a.isLandmark && !b.isLandmark) return -1;
      if (!a.isLandmark && b.isLandmark) return 1;
      return 0;
    });

    const result = {
      source: 'OpenStreetMap Overpass API',
      query: { lat, lng, radius, categories: catsToQuery },
      total: pois.length,
      pois,
    };

    cache.set(cacheKey, { data: result, ts: Date.now() });
    if (cache.size > 80) {
      const oldest = [...cache.entries()].sort((a, b) => a[1].ts - b[1].ts)[0];
      cache.delete(oldest[0]);
    }

    return NextResponse.json(result);

  } catch (err: any) {
    console.error('[HORUS POI] Overpass error:', err.message);
    return NextResponse.json({
      source: 'OpenStreetMap Overpass API (unavailable)',
      query: { lat, lng, radius, categories },
      total: 0,
      pois: [],
      error: err.message,
    });
  }
}
