

import { stealthFetchJSON } from '@/lib/stealthFetch';


export interface GeoCandidate {
  id: string;
  label: string;
  sublabel: string;
  fullName: string;
  lat: number;
  lng: number;
  zoom: number;
  type: string;
  category: string;
  importance: number;
  bbox?: [number, number, number, number]; // south, north, west, east
  country?: string;
  region?: string;
  source: 'nominatim' | 'photon';
}

export interface GeocodeResult {
  candidates: GeoCandidate[];
  ambiguous: boolean;
  source: 'nominatim' | 'photon' | 'none';
}


const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 h · Nominatim autorise le caching
const cache = new Map<string, { value: GeocodeResult; expiry: number }>();
const MAX_CACHE = 300;

let nominatimQueue: Promise<unknown> = Promise.resolve();
const NOMINATIM_GAP_MS = 1100;

function scheduleNominatim<T>(task: () => Promise<T>): Promise<T> {
  const run = nominatimQueue.then(task, task);
  nominatimQueue = run.then(
    () => new Promise((r) => setTimeout(r, NOMINATIM_GAP_MS)),
    () => new Promise((r) => setTimeout(r, NOMINATIM_GAP_MS))
  );
  return run;
}


export function zoomFromBBox(bbox: [number, number, number, number]): number | null {
  const [s, n, w, e] = bbox;
  if (![s, n, w, e].every((v) => Number.isFinite(v))) return null;
  const dLat = Math.abs(n - s);
  const dLng = Math.abs(e - w);
  const midLat = ((n + s) / 2) * (Math.PI / 180);
  const span = Math.max(dLat, dLng * Math.cos(midLat));
  if (!Number.isFinite(span) || span <= 0) return null;
  const z = Math.log2(360 / (span * 1.3));
  return Math.min(18, Math.max(2, Math.round(z * 10) / 10));
}

const ZOOM_TABLE: Array<[string, string | null, number]> = [
  ['place', 'country', 4.5],
  ['place', 'state', 6],
  ['place', 'region', 6],
  ['place', 'county', 8.5],
  ['place', 'city', 10.7],
  ['place', 'municipality', 11],
  ['place', 'town', 12.3],
  ['place', 'borough', 12],
  ['place', 'city_district', 12.5],
  ['place', 'suburb', 13.2],
  ['place', 'village', 13.2],
  ['place', 'quarter', 13.5],
  ['place', 'hamlet', 13.5],
  ['place', 'neighbourhood', 14],
  ['place', 'isolated_dwelling', 14.5],
  ['place', 'postcode', 13],
  ['boundary', 'postal_code', 13],
  ['boundary', 'administrative', 8],
  ['highway', null, 15.7],
  ['building', 'house', 16.8],
  ['building', 'apartments', 16.8],
  ['building', null, 17],
  ['shop', null, 16.5],
  ['amenity', null, 15.5],
  ['tourism', null, 15],
  ['leisure', null, 15],
  ['office', null, 16],
  ['landuse', null, 14.5],
  ['place', 'square', 15.5],
  ['place', 'locality', 14],
];

function zoomFromType(category: string, type: string): number {
  for (const [cat, typ, z] of ZOOM_TABLE) {
    if (cat === category && (typ === null || typ === type)) return z;
  }
  return 12.5;
}

function zoomFor(c: { bbox?: [number, number, number, number]; category: string; type: string }): number {
  return (c.bbox ? zoomFromBBox(c.bbox) : null) ?? zoomFromType(c.category, c.type);
}


interface NominatimHit {
  place_id?: number;
  osm_type?: string;
  osm_id?: number;
  lat?: string;
  lon?: string;
  display_name?: string;
  category?: string;
  type?: string;
  importance?: number;
  boundingbox?: string[];
  address?: Record<string, string>;
  name?: string;
}

function fromNominatim(hit: NominatimHit, i: number): GeoCandidate | null {
  const lat = parseFloat(String(hit.lat ?? ''));
  const lng = parseFloat(String(hit.lon ?? ''));
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const fullName = String(hit.display_name ?? '');
  const parts = fullName.split(',').map((p) => p.trim()).filter(Boolean);
  const addr = hit.address ?? {};
  const bbox = Array.isArray(hit.boundingbox) && hit.boundingbox.length === 4
    ? (hit.boundingbox.map(Number) as [number, number, number, number])
    : undefined;
  return {
    id: `osm-${hit.osm_type ?? ''}-${hit.place_id ?? hit.osm_id ?? i}`,
    label: hit.name?.trim() || parts[0] || fullName.slice(0, 40),
    sublabel: parts.slice(1, 4).join(', '),
    fullName,
    lat,
    lng,
    zoom: zoomFor({ bbox, category: hit.category ?? 'place', type: hit.type ?? '' }),
    type: hit.type ?? '',
    category: hit.category ?? 'place',
    importance: Number(hit.importance ?? 0.25 + (10 - i) * 0.02),
    bbox,
    country: addr.country,
    region: addr.state ?? addr.region ?? addr.county,
    source: 'nominatim',
  };
}

interface PhotonHit {
  geometry?: { coordinates?: [number, number] };
  properties?: {
    osm_id?: number;
    osm_key?: string;
    osm_value?: string;
    name?: string;
    city?: string;
    state?: string;
    country?: string;
    street?: string;
    housenumber?: string;
    postcode?: string;
    countrycode?: string;
  };
}

function fromPhoton(hit: PhotonHit, i: number): GeoCandidate | null {
  const coords = hit.geometry?.coordinates;
  if (!coords || coords.length < 2) return null;
  const [lng, lat] = coords;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const p = hit.properties ?? {};
  const cityline = [p.street && p.housenumber ? `${p.housenumber} ${p.street}` : p.street, p.city, p.state, p.country]
    .filter(Boolean)
    .join(', ');
  const category = p.osm_key ?? 'place';
  const type = p.osm_value ?? '';
  return {
    id: `photon-${p.osm_id ?? i}`,
    label: p.name || p.city || p.street || 'Lieu',
    sublabel: cityline,
    fullName: [p.name, cityline].filter(Boolean).join(' · '),
    lat,
    lng,
    zoom: zoomFor({ category, type }),
    type,
    category,
    importance: 0.3 + (10 - i) * 0.03,
    country: p.country,
    region: p.state,
    source: 'photon',
  };
}


function isAmbiguous(candidates: GeoCandidate[]): boolean {
  if (candidates.length <= 1) return false;
  const [a, b] = candidates;
  const gap = a.importance - b.importance;
  return !(a.importance >= 0.5 && gap >= 0.2);
}


const NOMINATIM_UA = 'HORUS-OSINT/7.0 (command-center geocoder; contact: ops@horus.local)';

async function geocodeNominatim(query: string, limit: number): Promise<GeoCandidate[]> {
  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.searchParams.set('q', query);
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('addressdetails', '1');
  url.searchParams.set('extratags', '0');
  url.searchParams.set('namedetails', '0');
  url.searchParams.set('limit', String(Math.max(1, Math.min(6, limit))));
  url.searchParams.set('accept-language', 'fr,en');

  const data = await scheduleNominatim(() =>
    stealthFetchJSON<NominatimHit[]>(url.toString(), {
      timeout: 8000,
      retries: 1,
      stealth: false,
      headers: {
        'User-Agent': NOMINATIM_UA,
        Accept: 'application/json',
      },
    })
  );
  if (!Array.isArray(data)) return [];
  return data
    .map(fromNominatim)
    .filter((c): c is GeoCandidate => c !== null)
    .sort((a, b) => b.importance - a.importance);
}

async function geocodePhoton(query: string, limit: number): Promise<GeoCandidate[]> {
  const url = new URL('https://photon.komoot.io/api/');
  url.searchParams.set('q', query);
  url.searchParams.set('limit', String(Math.max(1, Math.min(6, limit))));
  url.searchParams.set('lang', 'fr');
  const data = await stealthFetchJSON<{ features?: PhotonHit[] }>(url.toString(), {
    timeout: 7000,
    retries: 1,
    stealth: false,
    headers: { Accept: 'application/json' },
  });
  return (data.features ?? [])
    .map(fromPhoton)
    .filter((c): c is GeoCandidate => c !== null);
}


export async function geocodePlace(query: string, limit = 4): Promise<GeocodeResult> {
  const q = query.trim();
  if (!q) return { candidates: [], ambiguous: false, source: 'none' };

  const key = `geo:${q.toLowerCase()}:${limit}`;
  const hit = cache.get(key);
  if (hit && hit.expiry > Date.now()) return hit.value;

  let candidates: GeoCandidate[] = [];
  let source: GeocodeResult['source'] = 'none';
  try {
    candidates = await geocodeNominatim(q, limit);
    if (candidates.length > 0) source = 'nominatim';
  } catch {
    candidates = [];
  }

  if (candidates.length === 0) {
    try {
      candidates = await geocodePhoton(q, limit);
      if (candidates.length > 0) source = 'photon';
    } catch {
      candidates = [];
    }
  }

  const value: GeocodeResult = {
    candidates: candidates.slice(0, limit),
    ambiguous: isAmbiguous(candidates),
    source,
  };

  if (cache.size > MAX_CACHE) {
    const oldest = cache.keys().next().value;
    if (oldest) cache.delete(oldest);
  }
  cache.set(key, { value, expiry: Date.now() + CACHE_TTL });
  return value;
}

export function describeCandidate(c: GeoCandidate): string {
  return `${c.label}${c.sublabel ? ` (${c.sublabel})` : ''} · ${c.category}/${c.type} → z${c.zoom}`;
}
