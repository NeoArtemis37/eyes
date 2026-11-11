
import { NextResponse } from 'next/server';
import { stealthFetch } from '@/lib/stealthFetch';

/**
 * FLIGHT TRACKER — ADS-B multi-provider pipeline
 * Providers (readsb v2 clones, identical schema, dist ≤ 250 nm hard limit):
 *  1. api.adsb.lol        (primary — currently 429-rate-limited on lab IP)
 *  2. opendata.adsb.fi    (fallback — verified live)
 * Coverage strategy: worldwide pool of ADS-B hotspot centers polled
 * round-robin (12/cycle), merged & deduped by ICAO hex, evicted after 200 s.
 * Bonus: /v2/mil global military feed merged each cycle.
 */

const PROVIDERS = [
  { name: 'adsb.lol', base: 'https://api.adsb.lol/v2' },
  { name: 'opendata.adsb.fi', base: 'https://opendata.adsb.fi/api/v2' },
];

// Canary probe point — Frankfurt EDDF airspace is never empty.
const CANARY: [number, number] = [50.03, 8.56];

// Worldwide hotspot grid (major hubs + airway corridors + Sahel/Africa).
const CENTERS: [number, number][] = [
  // Europe
  [51.47, -0.45], [50.03, 8.56], [48.86, 2.35], [52.31, 4.76],
  [40.47, -3.56], [41.8, 12.25], [55.97, 37.4], [40.98, 28.8],
  // North America
  [40.64, -73.78], [33.94, -118.4], [41.98, -87.9], [25.79, -80.29],
  [29.98, -95.4], [47.45, -122.3], [43.68, -79.63],
  // Middle East / South Asia
  [25.25, 55.36], [24.96, 46.7], [25.27, 51.6], [19.09, 72.87],
  [28.56, 77.1],
  // East Asia / Oceania
  [35.55, 139.78], [37.46, 126.44], [22.31, 113.91], [31.14, 121.8],
  [1.36, 103.99], [13.69, 100.75], [-33.94, 151.18], [-37.67, 144.84],
  // Africa / Sahel / Indian Ocean
  [12.6, -8.02], [5.6, -0.17], [6.58, 3.32], [30.11, 31.4],
  [-26.13, 28.24], [-1.32, 36.93],
  // South & Central America
  [-23.43, -46.47], [-34.82, -58.54], [4.7, -74.1], [19.44, -99.07],
];

const DIST = 250;              // nm — hard max for both providers
const CENTERS_PER_CYCLE = 12;   // hotspot queries per refresh
const CONCURRENCY = 4;          // parallel waves — polite to community API
const POOL_TTL = 200_000;       // evict aircraft last seen > 200 s
const CACHE_TTL = 30_000;       // snapshot served as-is ≤ 30 s
const STALE_MAX = 900_000;      // keep serving degraded snapshot ≤ 15 min
const MAX_FLIGHTS = 300;        // globe performance cap

const MILITARY_TYPES = new Set([
  'F16', 'F15', 'F18', 'F22', 'F35', 'F2', 'A10', 'A400M', 'A6', 'AV8B',
  'B1', 'B2', 'B52', 'B742', 'C130', 'C17', 'C5', 'C2', 'C160', 'CN235',
  'E3', 'E7', 'E2', 'E4', 'E6', 'E8', 'EA18G', 'EC130', 'ERJ135', 'ERJ145',
  'G550', 'GL5T', 'H60', 'H64', 'H47', 'H53', 'H1', 'KA3', 'KC130', 'KC135',
  'KC46', 'MC130', 'MQ9', 'MQ1', 'P3', 'P8', 'RQ4', 'RC135', 'S3', 'SU27',
  'SU30', 'SU34', 'SU35', 'SU57', 'TU95', 'TU160', 'TU22', 'TORNADO', 'V22',
  'YAK130', 'MI24', 'MI28', 'MI26', 'KA52', 'AN124', 'AN26', 'IL76', 'IL78',
  'SU25', 'JAS39', 'GRIPEN', 'RAFALE', 'M2000', 'EF18', 'TYPHOON', 'MIG29',
  'MIG31', 'MIG35', 'J10', 'J11', 'J15', 'J16', 'J20', 'H6', 'Y20', 'KJ500',
]);

const MILITARY_CALLSIGNS = new Set([
  'RCH', 'KING', 'DUKE', 'REACH', 'CONVOY', 'EVAC', 'HAVOC', 'VIPER',
  'BONE', 'BAT', 'DUKE', 'HAWK', 'REAPER', 'PREDATOR', 'VIPER',
  'NODAK', 'HOMEL', 'SAFE', 'MULE', 'SLAY', 'TITAN', 'WAR',
  'FLANK', 'CUB', 'BEAR', 'BACKF', 'BLINDER', 'FENCER', 'FULLB',
  'FORGE', 'RAM', 'STORM', 'SAND', 'DARK', 'IRON', 'STEEL',
  'AF1', 'AF2', 'EXEC1', 'MAR1', 'Navy', 'ARMY', 'USAF',
]);

interface ADSBAircraft {
  hex: string;
  type: string;
  flight: string | null;
  r: string | null;
  t: string | null;
  desc: string | null;
  alt_baro: number | string | null;
  alt_geom: number | null;
  gs: number | null;
  track: number | null;
  baro_rate: number | null;
  geom_rate: number | null;
  squawk: string | null;
  emergency: string | null;
  category: string | null;
  nac_p: number | null;
  lat: number | null;
  lon: number | null;
  seen_pos: number | null;
  dbFlags: number | null;
}

interface PoolEntry { ac: ADSBAircraft; seen: number; }

// Module-level pipeline state (survives between requests, resets on dev HMR)
const pool = new Map<string, PoolEntry>();
let cursor = 0;
let lockedProvider: number | null = null;
let snapshot: { time: number; source: string; data: any[]; jammingZones: any[] } | null = null;

function isMilitary(ac: ADSBAircraft): boolean {
  if (ac.dbFlags && (ac.dbFlags & 1)) return true;
  if (ac.t && MILITARY_TYPES.has(ac.t.toUpperCase())) return true;
  if (ac.flight) {
    const prefix = ac.flight.trim().substring(0, 3).toUpperCase();
    if (MILITARY_CALLSIGNS.has(prefix)) return true;
  }
  return false;
}

function classifyAircraft(ac: ADSBAircraft): 'commercial' | 'private' | 'military' | 'helicopter' | 'unknown' {
  if (isMilitary(ac)) return 'military';
  const cat = ac.category || '';
  const desc = (ac.desc || '').toLowerCase();
  const type = (ac.t || '').toLowerCase();
  if (desc.includes('helicopter') || type.startsWith('h') || cat === 'A7' || cat === 'B7') return 'helicopter';
  if (desc.includes('landplane') || type.startsWith('b7') || type.startsWith('a2') || type.startsWith('a3') || cat === 'A3' || cat === 'A5') return 'commercial';
  if (cat === 'A1' || cat === 'A2') return 'private';
  return 'unknown';
}

async function fetchJson(providerIdx: number, path: string): Promise<ADSBAircraft[] | null> {
  try {
    const url = `${PROVIDERS[providerIdx].base}${path}`;
    const response = await stealthFetch(url, {
      timeout: 12000,
      stealth: true,
      headers: { 'Accept': 'application/json' },
    });
    if (!response.ok) return null;
    const data = await response.json();
    return data.ac || data.aircraft || [];
  } catch {
    return null;
  }
}

async function probeProvider(providerIdx: number): Promise<boolean> {
  const acs = await fetchJson(providerIdx, `/lat/${CANARY[0]}/lon/${CANARY[1]}/dist/${DIST}`);
  return Array.isArray(acs) && acs.length > 0;
}

async function selectProvider(): Promise<number | null> {
  // Try the locked provider first, then the rest in order.
  if (lockedProvider !== null && (await probeProvider(lockedProvider))) return lockedProvider;
  lockedProvider = null;
  for (let i = 0; i < PROVIDERS.length; i++) {
    if (await probeProvider(i)) {
      lockedProvider = i;
      return i;
    }
  }
  return null;
}

async function pollCenters(providerIdx: number): Promise<void> {
  const targets: [number, number][] = [];
  for (let i = 0; i < CENTERS_PER_CYCLE; i++) {
    targets.push(CENTERS[cursor % CENTERS.length]);
    cursor++;
  }
  // Chunked waves of CONCURRENCY — polite to the community aggregators.
  for (let i = 0; i < targets.length; i += CONCURRENCY) {
    const chunk = targets.slice(i, i + CONCURRENCY);
    const results = await Promise.allSettled(
      chunk.map(([lat, lon]) => fetchJson(providerIdx, `/lat/${lat}/lon/${lon}/dist/${DIST}`))
    );
    for (const result of results) {
      if (result.status === 'fulfilled' && Array.isArray(result.value)) {
        const now = Date.now();
        for (const ac of result.value) {
          // loose == null : rejects both null AND missing/undefined keys
          if (!ac.hex || ac.lat == null || ac.lon == null) continue;
          pool.set(ac.hex, { ac, seen: now });
        }
      }
    }
  }
}

async function pollMilitary(providerIdx: number): Promise<void> {
  const mils = await fetchJson(providerIdx, '/mil');
  if (!Array.isArray(mils)) return;
  const now = Date.now();
  for (const ac of mils) {
    if (!ac.hex || ac.lat == null || ac.lon == null) continue;
    pool.set(ac.hex, { ac, seen: now });
  }
}

function stableHash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

function buildSnapshot(providerIdx: number) {
  const now = Date.now();

  // Evict stale entries, then filter to airborne + fresh positions.
  const live: ADSBAircraft[] = [];
  for (const [hex, entry] of pool) {
    if (now - entry.seen > POOL_TTL) {
      pool.delete(hex);
      continue;
    }
    const ac = entry.ac;
    if (ac.lat == null || ac.lon == null) continue;
    if (ac.alt_baro === 'ground' || ac.alt_baro == null) continue;
    if (typeof ac.alt_baro !== 'number') continue;
    if (ac.seen_pos && ac.seen_pos > 60) continue;
    live.push(ac);
  }

  // Selection: ALL military first, then the rest in stable-hash order so the
  // 300 slots stay globally diverse as the round-robin pool widens coverage
  // (instead of forever showing the earliest-inserted European batch).
  const mil = live.filter(ac => isMilitary(ac));
  const rest = live
    .filter(ac => !isMilitary(ac))
    .sort((a, b) => stableHash(a.hex) - stableHash(b.hex));
  const selected = [...mil, ...rest].slice(0, MAX_FLIGHTS);

  const jammingAircraft = live.filter(ac => ac.nac_p != null && ac.nac_p <= 4);
  const jammingZones: { lat: number; lng: number; severity: number; count: number }[] = [];
  if (jammingAircraft.length >= 3) {
    const grid = new Map<string, { lat: number; lng: number; count: number }>();
    for (const ac of jammingAircraft) {
      const gridLat = Math.floor(ac.lat! / 2) * 2;
      const gridLng = Math.floor(ac.lon! / 2) * 2;
      const key = `${gridLat},${gridLng}`;
      const cell = grid.get(key) || { lat: gridLat, lng: gridLng, count: 0 };
      cell.count++;
      grid.set(key, cell);
    }
    for (const cell of grid.values()) {
      if (cell.count >= 3) {
        jammingZones.push({
          lat: cell.lat + 1,
          lng: cell.lng + 1,
          severity: Math.min(cell.count / 5, 1),
          count: cell.count,
        });
      }
    }
  }

  const flights = selected.map(ac => {
    const classification = classifyAircraft(ac);
    // NOTE: readsb v2 alt_baro is already in FEET — no unit conversion.
    const altitude = typeof ac.alt_baro === 'number' ? Math.round(ac.alt_baro) : 0;
    return {
      icao24: ac.hex,
      callsign: ac.flight?.trim() || 'N/A',
      originCountry: ac.r || 'Unknown',
      latitude: ac.lat,
      longitude: ac.lon,
      altitude,
      onGround: false,
      velocity: ac.gs ? Math.round(ac.gs) : null,
      heading: ac.track ? Math.round(ac.track) : null,
      verticalRate: ac.baro_rate ? Math.round(ac.baro_rate) : null,
      squawk: ac.squawk,
      aircraftType: ac.t || 'Unknown',
      classification,
      isMilitary: classification === 'military',
      emergency: ac.emergency || null,
      nac_p: ac.nac_p || null,
    };
  });

  snapshot = {
    time: now,
    source: PROVIDERS[providerIdx].name,
    data: flights,
    jammingZones,
  };
}

export async function GET() {
  try {
    const now = Date.now();

    // Fresh snapshot → serve as-is (panel polls every 15 s, upstream every 30 s).
    if (snapshot && now - snapshot.time < CACHE_TTL) {
      return NextResponse.json({
        source: snapshot.source,
        timestamp: snapshot.time,
        count: snapshot.data.length,
        jammingZones: snapshot.jammingZones,
        flights: snapshot.data,
      });
    }

    const providerIdx = await selectProvider();

    // All providers dead → degrade gracefully (stale snapshot ≤ 15 min).
    if (providerIdx === null) {
      if (snapshot && now - snapshot.time <= STALE_MAX && snapshot.data.length > 0) {
        return NextResponse.json({
          source: `${snapshot.source} (cached ${Math.round((now - snapshot.time) / 1000)}s)`,
          timestamp: snapshot.time,
          count: snapshot.data.length,
          jammingZones: snapshot.jammingZones,
          flights: snapshot.data,
          degraded: true,
          error: 'ADS-B upstream unavailable (rate limited) — serving last known picture',
        });
      }
      return NextResponse.json({
        source: 'unavailable',
        timestamp: now,
        count: 0,
        jammingZones: [],
        flights: [],
        error: 'All ADS-B providers unreachable (adsb.lol + opendata.adsb.fi rate limited)',
      });
    }

    await pollCenters(providerIdx);
    await pollMilitary(providerIdx);
    buildSnapshot(providerIdx);

    if (snapshot!.data.length === 0) {
      // Cold pool + empty first cycle — still 200 so the panel can display state.
      return NextResponse.json({
        source: snapshot!.source,
        timestamp: snapshot!.time,
        count: 0,
        jammingZones: [],
        flights: [],
        error: 'No aircraft received from ADS-B grid yet — pooling in progress',
      });
    }

    return NextResponse.json({
      source: snapshot!.source,
      timestamp: snapshot!.time,
      count: snapshot!.data.length,
      jammingZones: snapshot!.jammingZones,
      flights: snapshot!.data,
    });
  } catch (error: any) {
    console.error('[Flights] ADS-B pipeline error:', error.message);
    if (snapshot && snapshot.data.length > 0) {
      return NextResponse.json({
        source: `${snapshot.source} (cached · pipeline error)`,
        timestamp: snapshot.time,
        count: snapshot.data.length,
        jammingZones: snapshot.jammingZones,
        flights: snapshot.data,
        degraded: true,
        error: error.message,
      });
    }
    return NextResponse.json({
      source: 'unavailable',
      timestamp: Date.now(),
      count: 0,
      jammingZones: [],
      flights: [],
      error: `Failed to fetch flight data: ${error.message}`,
    });
  }
}
