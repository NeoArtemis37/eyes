
import { NextRequest, NextResponse } from "next/server";
import { fetchIpv4Json } from "@/lib/horus/ipv4-fetch";

export const dynamic = "force-dynamic";

const FALLBACK_SATS = [
  { name: "ISS (ZARYA)", noradId: "25544", inclination: 51.64, period: 92.68, apogee: 422, perigee: 408, group: "stations" },
  { name: "HUBBLE SPACE TELESCOPE", noradId: "20580", inclination: 28.47, period: 95.42, apogee: 537, perigee: 526, group: "stations" },
  { name: "TIANGONG (CSS)", noradId: "48274", inclination: 41.47, period: 92.22, apogee: 389, perigee: 381, group: "stations" },
  { name: "NOAA 19", noradId: "33591", inclination: 99.19, period: 102.13, apogee: 870, perigee: 845, group: "weather" },
  { name: "METOP-A", noradId: "29499", inclination: 98.7, period: 101.36, apogee: 821, perigee: 806, group: "weather" },
  { name: "GOES-16", noradId: "41866", inclination: 0.06, period: 1436.04, apogee: 35784, perigee: 35781, group: "geo" },
  { name: "NAVSTAR 80 (USA 309)", noradId: "48842", inclination: 55.04, period: 717.97, apogee: 20419, perigee: 20411, group: "gps" },
  { name: "NAVSTAR 81 (USA 311)", noradId: "49809", inclination: 55.06, period: 717.96, apogee: 20417, perigee: 20412, group: "gps" },
  { name: "STARLINK-1007", noradId: "44713", inclination: 53.05, period: 95.59, apogee: 549, perigee: 546, group: "starlink" },
  { name: "STARLINK-1094", noradId: "44851", inclination: 53.05, period: 95.59, apogee: 548, perigee: 546, group: "starlink" },
  { name: "STARLINK-1126", noradId: "44907", inclination: 53.05, period: 95.59, apogee: 549, perigee: 547, group: "starlink" },
  { name: "SENTINEL-2A", noradId: "40697", inclination: 98.56, period: 100.6, apogee: 783, perigee: 777, group: "active" },
  { name: "SENTINEL-1A", noradId: "39634", inclination: 98.19, period: 98.6, apogee: 694, perigee: 686, group: "active" },
  { name: "TERRA", noradId: "25994", inclination: 98.2, period: 98.1, apogee: 705, perigee: 698, group: "active" },
  { name: "AQUA", noradId: "27424", inclination: 98.2, period: 98.4, apogee: 707, perigee: 701, group: "active" },
  { name: "LANDSAT 8", noradId: "39084", inclination: 98.22, period: 98.2, apogee: 737, perigee: 702, group: "active" },
  { name: "NOAA 15", noradId: "25338", inclination: 98.7, period: 101.3, apogee: 807, perigee: 800, group: "weather" },
  { name: "COSMOS 2546", noradId: "45215", inclination: 64.81, period: 92.95, apogee: 416, perigee: 409, group: "active" },
];

const groupMap: Record<string, string[]> = {
  active: ["active"],
  stations: ["stations"],
  starlink: ["starlink"],
  weather: ["weather"],
  noaa: ["noaa"],
  gps: ["gps-ops"],
  geo: ["geo"],
};

export async function GET(req: NextRequest) {
  const kind = req.nextUrl.searchParams.get("kind") ?? "active";
  try {
    const groupMapKind: Record<string, string> = {
      active: "active",
      stations: "stations",
      starlink: "starlink",
      weather: "weather",
      noaa: "noaa",
      gps: "gps-ops",
      geo: "geo",
    };
    const group = groupMapKind[kind] ?? "active";
    const url = `https://celestrak.org/NORAD/elements/gp.php?GROUP=${group}&FORMAT=json`;

    let sats: unknown[] = [];
    try {
      const data = await fetchIpv4Json<unknown[]>(url, {
        headers: { "User-Agent": "HORUS-OSINT/6.2" },
        timeoutMs: 8000,
      });
      if (Array.isArray(data)) {
        const arr = data.slice(0, 150) as Array<{
          OBJECT_NAME: string;
          OBJECT_ID: string;
          NORAD_CAT_ID: string;
          OBJECT_TYPE: string;
          EPOCH: string;
          MEAN_MOTION: number;
          ECCENTRICITY: number;
          INCLINATION: number;
          RA_OF_ASC_NODE: number;
          ARG_OF_PERICENTER: number;
          MEAN_ANOMALY: number;
          SEMIMAJOR_AXIS: number;
          PERIOD: number;
          APOAPSIS: number;
          PERIAPSIS: number;
        }>;
        sats = arr.map(
          (s) => ({
            name: s.OBJECT_NAME,
            noradId: s.NORAD_CAT_ID,
            objectId: s.OBJECT_ID,
            type: s.OBJECT_TYPE,
            epoch: s.EPOCH,
            inclination: s.INCLINATION,
            period: s.PERIOD,
            apogee: s.APOAPSIS,
            perigee: s.PERIAPSIS,
            meanMotion: s.MEAN_MOTION,
            eccentricity: s.ECCENTRICITY,
          })
        );
      }
    } catch {
      sats = [];
    }

    if (sats.length === 0) {
      const groups = groupMap[kind] ?? ["active"];
      const filtered = FALLBACK_SATS.filter(
        (s) => groups.includes(s.group) || kind === "active" || kind === "stations"
      );
      sats = filtered.map((s) => ({
        name: s.name,
        noradId: s.noradId,
        objectId: "",
        type: "FALLBACK",
        epoch: new Date().toISOString(),
        inclination: s.inclination,
        period: s.period,
        apogee: s.apogee,
        perigee: s.perigee,
        meanMotion: 1440 / s.period,
        eccentricity: 0.001,
      }));
    }

    return NextResponse.json({ count: sats.length, sats });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "unknown" },
      { status: 500 }
    );
  }
}
