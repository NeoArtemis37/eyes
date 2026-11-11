
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const OVERPASS_SERVERS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.openstreetmap.fr/api/interpreter",
];

const UA = "HORUS-OSINT/6.2 (intel platform; +https://horus.local)";

async function overpassFetch(body: string): Promise<{
  elements?: unknown[];
} | null> {
  for (const srv of OVERPASS_SERVERS) {
    try {
      const r = await fetch(srv, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": UA,
          Accept: "application/json",
        },
        body: `data=${encodeURIComponent(body)}`,
        next: { revalidate: 600 },
      });
      if (!r.ok) continue;
      return (await r.json()) as { elements?: unknown[] };
    } catch {
      continue;
    }
  }
  return null;
}

export async function GET(req: NextRequest) {
  const lat = req.nextUrl.searchParams.get("lat");
  const lng = req.nextUrl.searchParams.get("lng");
  if (!lat || !lng) {
    try {
      const body = `[out:json][timeout:25];
(
  node["seamark:type"="harbour"](40,-80,55,10);
  node["waterway"="boatyard"](40,-80,55,10);
);
out 80;`;
      const data = await overpassFetch(body);
      if (!data) {
        return NextResponse.json(
          { error: "overpass unavailable" },
          { status: 502 }
        );
      }
      const vessels = ((data.elements ?? []) as Record<string, unknown>[]).map(
        (el) => {
          const tags = (el.tags as Record<string, string>) ?? {};
          return {
            id: `port-${el.id}`,
            name: tags.name ?? "Unknown Port",
            lat: el.lat as number,
            lng: el.lon as number,
            type: "port",
            kind: tags["seamark:type"] ?? tags.waterway ?? "harbour",
          };
        }
      );
      return NextResponse.json({ count: vessels.length, vessels });
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "unknown" },
        { status: 500 }
      );
    }
  }
  const radius = req.nextUrl.searchParams.get("radius") ?? "200000";
  try {
    const body = `[out:json][timeout:25];
(
  node["seamark:type"="harbour"](around:${radius},${lat},${lng});
  node["waterway"="boatyard"](around:${radius},${lat},${lng});
  node["seamark:type"="anchorberth"](around:${radius},${lat},${lng});
);
out 80;`;
    const data = await overpassFetch(body);
    if (!data) {
      return NextResponse.json(
        { error: "overpass unavailable" },
        { status: 502 }
      );
    }
    const vessels = ((data.elements ?? []) as Record<string, unknown>[]).map(
      (el) => {
        const tags = (el.tags as Record<string, string>) ?? {};
        return {
          id: `port-${el.id}`,
          name: tags.name ?? "Vessel/Port",
          lat: el.lat as number,
          lng: el.lon as number,
          type: "vessel",
          kind: tags["seamark:type"] ?? tags.waterway ?? "harbour",
        };
      }
    );
    return NextResponse.json({ count: vessels.length, vessels });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "unknown" },
      { status: 500 }
    );
  }
}
