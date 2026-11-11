
import { NextResponse } from 'next/server';
import { stealthFetchJSON } from '@/lib/stealthFetch';

let cachedData: { time: number; data: any[] } | null = null;
const CACHE_TTL = 3600000; // 1 hour · TLE data changes slowly


type Classification = 'military' | 'navigation' | 'communications' | 'weather' | 'research' | 'debris';
type OrbitType = 'LEO' | 'MEO' | 'GEO' | 'HEO';

function classifySatellite(name: string): Classification {
  const n = name.toUpperCase();
  if (/USA-\d+|NROL|LACROSSE|KEYHOLE|KH-|TRUMPET|MERCURY|ONYX|MISTY|NOSS|SSU|FIA|RADOR|INTRUDER|MENTOR|ORION|ADVANCED|CRYSTAL|IMPROVED|SHUTTLE|X-37|OTV|GSSAP|SBIRS|AEHF|DSP|MIDAS/i.test(n)) return 'military';
  if (/GPS|NAVSTAR|GLONASS|BEIDOU|COMPASS|GALILEO|QZSS|IRNSS|NAVIC|SBAS|WAAS|EGNOS|MSAS|GAGAN/i.test(n)) return 'navigation';
  if (/STARLINK|ONEWEB|IRIDIUM|GLOBALSTAR|ORBCOMM|INMARSAT|INTELSAT|EUTELSAT|SES|HUGHNET|VIASAT|TELESAT|AMOS|YAMAL|EXPRESS|YAH|THURAYA|ACRUX|KOREASAT|JCSAT|BSAT|SUPERBIRD|NILESAT|ARABSAT|TURKSAT|HELLAS|TELEKOM|ASTRA|HOTBIRD/i.test(n)) return 'communications';
  if (/METEOSAT|GOES|HIMAWARI|FENGYUN|METOP|NOAA-|SUOMI|JPSS|DMSP|COSMIC|TERRA|AQUA|LANDSAT|SENTINEL|METEOR|MOSAIC/i.test(n)) return 'weather';
  if (/ISS|TIANHE|TIANGONG|CSS|CNSA|SALYUT|MIR|SKYLAB|HST|HUBBLE|CXO|CHANDRA|SPITZER|WEBB|JWST|KEPLER|TESS|CHEOPS|GAIA|HIPPARCOS|PROGRESS|SOYUZ|DRAGON|CYGNUS|HTV|ATV|BEIDOU-3|PRISMA|COSMO|SKYMED|RADARSAT|CARTOSAT|RISAT|KANOPUS|RESURS|DUBAISAT|KAZSTSAT|NEWSPACE/i.test(n)) return 'research';
  if (/DEBRIS|ROCKET|DEB |PLATFORM|PANEL|BOOSTER|SHROUD|FAIRING|TANK|ADAPTER|SEP|R\/B|DROGUE|NOSE|COLLISION/i.test(n)) return 'debris';
  return 'research'; // default for unknown satellites
}

function classifyOrbit(meanMotion: number): OrbitType {
  if (meanMotion < 1.01) return 'GEO';   // ~1 rev/day
  if (meanMotion < 2.0) return 'HEO';     // Highly elliptical
  if (meanMotion < 5.0) return 'MEO';     // Medium Earth orbit (GPS: ~2 rev/day)
  return 'LEO';                            // Low Earth orbit (>5 rev/day)
}


interface TLEElements {
  noradId: number;
  name: string;
  inclination: number;      // radians
  raan: number;             // right ascension of ascending node, radians
  eccentricity: number;     // dimensionless
  argumentOfPerigee: number; // radians
  meanAnomaly: number;      // radians at epoch
  meanMotion: number;       // revs/day
  epochYear: number;
  epochDay: number;
}

function parseTLE(name: string, line1: string, line2: string): TLEElements | null {
  try {
    if (line1[0] !== '1' || line2[0] !== '2') return null;

    const noradId = parseInt(line1.substring(2, 7).trim());

    const epochYear = parseInt(line1.substring(18, 20).trim());
    const epochDay = parseFloat(line1.substring(20, 32).trim());

    const inclination = parseFloat(line2.substring(8, 16).trim()) * Math.PI / 180;
    const raan = parseFloat(line2.substring(17, 25).trim()) * Math.PI / 180;
    const eccentricity = parseFloat('0.' + line2.substring(26, 33).trim());
    const argumentOfPerigee = parseFloat(line2.substring(34, 42).trim()) * Math.PI / 180;
    const meanAnomaly = parseFloat(line2.substring(43, 51).trim()) * Math.PI / 180;
    const meanMotion = parseFloat(line2.substring(52, 63).trim());

    if (isNaN(inclination) || isNaN(raan) || isNaN(eccentricity) ||
        isNaN(argumentOfPerigee) || isNaN(meanAnomaly) || isNaN(meanMotion)) {
      return null;
    }

    return {
      noradId,
      name: name.trim(),
      inclination,
      raan,
      eccentricity,
      argumentOfPerigee,
      meanAnomaly,
      meanMotion,
      epochYear: epochYear < 57 ? 2000 + epochYear : 1900 + epochYear,
      epochDay,
    };
  } catch {
    return null;
  }
}


const EARTH_RADIUS_KM = 6371;
const EARTH_ROTATION_RATE = 7.2921159e-5; // rad/s
const MU = 398600.4418; // km^3/s^2 Earth gravitational parameter

function solveKepler(M: number, e: number, maxIter: number = 20): number {
  let E = M;
  for (let i = 0; i < maxIter; i++) {
    const dE = (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
    E -= dE;
    if (Math.abs(dE) < 1e-10) break;
  }
  return E;
}

function propagateTLE(elements: TLEElements, nowMs: number): { lat: number; lng: number; alt: number } | null {
  try {
    const epochMs = Date.UTC(elements.epochYear, 0, 1) + (elements.epochDay - 1) * 86400000;
    const dtMs = nowMs - epochMs;
    const dtSec = dtMs / 1000;

    if (Math.abs(dtSec) > 30 * 86400) {
    }

    const n = elements.meanMotion * 2 * Math.PI / 86400;

    const M0 = elements.meanAnomaly;
    const M = (M0 + n * dtSec) % (2 * Math.PI);

    const E = solveKepler(M, elements.eccentricity);

    const cosV = (Math.cos(E) - elements.eccentricity) / (1 - elements.eccentricity * Math.cos(E));
    const sinV = (Math.sqrt(1 - elements.eccentricity * elements.eccentricity) * Math.sin(E)) / (1 - elements.eccentricity * Math.cos(E));
    const v = Math.atan2(sinV, cosV);

    const a = Math.cbrt(MU / (n * n)); // semi-major axis in km
    const r = a * (1 - elements.eccentricity * Math.cos(E));

    const xOrb = r * Math.cos(v);
    const yOrb = r * Math.sin(v);

    const cosO = Math.cos(elements.raan);
    const sinO = Math.sin(elements.raan);
    const cosI = Math.cos(elements.inclination);
    const sinI = Math.sin(elements.inclination);
    const cosW = Math.cos(elements.argumentOfPerigee);
    const sinW = Math.sin(elements.argumentOfPerigee);

    const xEci = (cosO * cosW - sinO * sinW * cosI) * xOrb + (-cosO * sinW - sinO * cosW * cosI) * yOrb;
    const yEci = (sinO * cosW + cosO * sinW * cosI) * xOrb + (-sinO * sinW + cosO * cosW * cosI) * yOrb;
    const zEci = (sinW * sinI) * xOrb + (cosW * sinI) * yOrb;

    const gmst = (EARTH_ROTATION_RATE * dtSec) % (2 * Math.PI);
    const cosG = Math.cos(gmst);
    const sinG = Math.sin(gmst);

    const xEcef = cosG * xEci + sinG * yEci;
    const yEcef = -sinG * xEci + cosG * yEci;
    const zEcef = zEci;

    const alt = Math.sqrt(xEcef * xEcef + yEcef * yEcef + zEcef * zEcef) - EARTH_RADIUS_KM;
    const lat = Math.asin(zEcef / (alt + EARTH_RADIUS_KM)) * 180 / Math.PI;
    const lng = ((Math.atan2(yEcef, xEcef) * 180 / Math.PI) % 360 + 540) % 360 - 180;

    return { lat: Math.round(lat * 1000) / 1000, lng: Math.round(lng * 1000) / 1000, alt: Math.round(alt) };
  } catch {
    return null;
  }
}


interface SatNOGSTLE {
  norad_cat_id: number;
  name: string;
  tle_line1: string;
  tle_line2: string;
  tle_source: string;
  updated: string;
}

interface SatelliteOutput {
  id: string;
  name: string;
  lat: number;
  lng: number;
  alt: number;
  classification: Classification;
  noradId: number;
  orbitType: OrbitType;
}

export async function GET() {
  try {
    if (cachedData && Date.now() - cachedData.time < CACHE_TTL) {
      return NextResponse.json({
        source: 'SatNOGS (cached)',
        timestamp: cachedData.time,
        count: cachedData.data.length,
        satellites: cachedData.data,
      });
    }

    const tleData = await stealthFetchJSON<SatNOGSTLE[]>(
      'https://db.satnogs.org/api/tle/?format=json',
      { timeout: 30000, retries: 2 }
    );

    if (!Array.isArray(tleData) || tleData.length === 0) {
      throw new Error('No TLE data returned from SatNOGS');
    }

    const now = Date.now();

    const satellites: SatelliteOutput[] = [];
    const seenNoradIds = new Set<number>();

    const priorityOrder: Record<Classification, number> = {
      navigation: 0,
      military: 1,
      communications: 2,
      weather: 3,
      research: 4,
      debris: 5,
    };

    const parsed: { tle: TLEElements; classification: Classification; orbitType: OrbitType }[] = [];
    for (const entry of tleData) {
      if (!entry.tle_line1 || !entry.tle_line2 || !entry.name) continue;

      const elements = parseTLE(entry.name, entry.tle_line1, entry.tle_line2);
      if (!elements) continue;

      if (seenNoradIds.has(elements.noradId)) continue;
      seenNoradIds.add(elements.noradId);

      const classification = classifySatellite(elements.name);
      const orbitType = classifyOrbit(elements.meanMotion);

      parsed.push({ tle: elements, classification, orbitType });
    }

    parsed.sort((a, b) => {
      const pa = priorityOrder[a.classification];
      const pb = priorityOrder[b.classification];
      if (pa !== pb) return pa - pb;
      const orbitOrder: Record<OrbitType, number> = { MEO: 0, GEO: 1, HEO: 2, LEO: 3 };
      return orbitOrder[a.orbitType] - orbitOrder[b.orbitType];
    });

    const selected = parsed.slice(0, 200);

    for (const { tle, classification, orbitType } of selected) {
      const pos = propagateTLE(tle, now);

      satellites.push({
        id: `SAT-${tle.noradId}`,
        name: tle.name,
        lat: pos?.lat ?? 0,
        lng: pos?.lng ?? 0,
        alt: pos?.alt ?? 0,
        classification,
        noradId: tle.noradId,
        orbitType,
      });
    }

    cachedData = { time: Date.now(), data: satellites };

    return NextResponse.json({
      source: 'SatNOGS',
      timestamp: Date.now(),
      count: satellites.length,
      satellites,
    });
  } catch (error: any) {
    console.error('[Satellites] SatNOGS error:', error.message);

    if (cachedData && cachedData.data.length > 0) {
      return NextResponse.json({
        source: 'SatNOGS (cached · API unavailable)',
        timestamp: cachedData.time,
        count: cachedData.data.length,
        satellites: cachedData.data,
        error: error.message,
      });
    }

    return NextResponse.json({
      source: 'SatNOGS',
      timestamp: Date.now(),
      count: 0,
      satellites: [],
      error: `Failed to fetch satellite data: ${error.message}`,
    }, { status: 503 });
  }
}
