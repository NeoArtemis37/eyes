
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const FEATURE_MAP: Record<string, string[]> = {
  monument: [
    '["historic"="monument"]',
    '["historic"="memorial"]',
    '["tourism"="artwork"]',
  ],
  antenna: ['["man_made"="antenna"]', '["man_made"="communications_tower"]'],
  camera: ['["man_made"="surveillance"]', '["highway"="speed_camera"]'],
  military: ['["military"]', '["landuse"="military"]'],
  building: ['["building"]'],
  tower: ['["man_made"="tower"]', '["man_made"="cooling_tower"]'],
  airport: ['["aeroway"="aerodrome"]', '["aeroway"="helipad"]'],
  port: ['["seamark"="harbour"]', '["waterway"="boatyard"]'],
  power: ['["power"="plant"]', '["power"="substation"]'],
  station: ['["railway"="station"]', '["public_transport"="station"]'],
};

export async function GET(req: NextRequest) {
  const lat = parseFloat(req.nextUrl.searchParams.get("lat") ?? "");
  const lng = parseFloat(req.nextUrl.searchParams.get("lng") ?? "");
  const kind = req.nextUrl.searchParams.get("kind") ?? "monument";
  const radius = parseInt(
    req.nextUrl.searchParams.get("radius") ?? "5000",
    10
  );

  if (Number.isNaN(lat) || Number.isNaN(lng)) {
    return NextResponse.json(
      { error: "lat and lng required" },
      { status: 400 }
    );
  }

  const selectors = FEATURE_MAP[kind] ?? FEATURE_MAP.monument;
  const around = `(around:${radius},${lat},${lng})`;

  const unionBody = selectors.map((s) => `  nwr${s}${around};`).join("\n");
  const body = `[out:json][timeout:25];\n(\n${unionBody}\n);\nout center 40;`;

  const headers: Record<string, string> = {
    "Content-Type": "application/x-www-form-urlencoded",
    "User-Agent": "HORUS-OSINT/6.2 (intel platform; +https://horus.local)",
    Accept: "application/json",
  };

  const servers = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass.openstreetmap.fr/api/interpreter",
  ];

  try {
    let data: { elements?: unknown[] } | null = null;
    let lastErr: string | null = null;
    for (const srv of servers) {
      try {
        const r = await fetch(srv, {
          method: "POST",
          headers,
          body: `data=${encodeURIComponent(body)}`,
          next: { revalidate: 60 },
        });
        if (!r.ok) {
          lastErr = `overpass ${r.status}`;
          continue;
        }
        data = (await r.json()) as { elements?: unknown[] };
        break;
      } catch {
        lastErr = "fetch failed";
        continue;
      }
    }
    if (data === null) {
      return NextResponse.json(
        { error: lastErr ?? "all overpass servers failed" },
        { status: 502 }
      );
    }
    const elements = ((data.elements ?? []) as Record<string, unknown>[]).map(
      (el) => {
        const tags = (el.tags as Record<string, string>) ?? {};
        const eLat =
          typeof el.lat === "number"
            ? el.lat
            : (el.center as { lat: number } | undefined)?.lat;
        const eLng =
          typeof el.lon === "number"
            ? el.lon
            : (el.center as { lon: number } | undefined)?.lon;
        return {
          id: `${el.type}-${el.id}`,
          lat: eLat,
          lng: eLng,
          name: tags.name ?? tags["name:en"] ?? null,
          kind,
          tags,
        };
      }
    );
    return NextResponse.json({ results: elements });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "unknown" },
      { status: 500 }
    );
  }
}
