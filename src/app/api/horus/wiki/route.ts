
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const lat = req.nextUrl.searchParams.get("lat");
  const lng = req.nextUrl.searchParams.get("lng");
  const radius = parseInt(
    req.nextUrl.searchParams.get("radius") ?? "10000",
    10
  );
  if (!lat || !lng) {
    return NextResponse.json(
      { error: "lat and lng required" },
      { status: 400 }
    );
  }
  try {
    const url = new URL("https://en.wikipedia.org/w/api.php");
    url.searchParams.set("action", "query");
    url.searchParams.set("list", "geosearch");
    url.searchParams.set("gscoord", `${lat}|${lng}`);
    url.searchParams.set("gsradius", String(Math.min(radius, 10000)));
    url.searchParams.set("gslimit", "20");
    url.searchParams.set("format", "json");
    url.searchParams.set("origin", "*");

    const r = await fetch(url.toString(), {
      headers: {
        "User-Agent": "HORUS-OSINT/6.2 (intel platform; +https://horus.local)",
        Accept: "application/json",
      },
      next: { revalidate: 300 },
    });
    if (!r.ok) {
      return NextResponse.json(
        { error: `wikipedia ${r.status}` },
        { status: 502 }
      );
    }
    const data = await r.json();
    const geopages: Array<{
      pageid: number;
      title: string;
      lat: number;
      lng: number;
      dist: number;
      summary?: string;
      thumbnail?: string;
    }> = (data?.query?.geosearch ?? []).map(
      (g: { pageid: number; title: string; lat: number; lon: number; dist: number }) => ({
        pageid: g.pageid,
        title: g.title,
        lat: g.lat,
        lng: g.lon, // rename lon → lng for client consistency
        dist: g.dist,
      })
    );

    const hydrated: typeof geopages = [];
    for (const p of geopages) {
      const np = { ...p };
      if (geopages.indexOf(p) < 3) {
        try {
          const sUrl = new URL(
            `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(
              p.title
            )}`
          );
          const controller = new AbortController();
          const to = setTimeout(() => controller.abort(), 4000);
          const sR = await fetch(sUrl.toString(), {
            next: { revalidate: 3600 },
            signal: controller.signal,
            headers: { "User-Agent": "HORUS-OSINT/6.2" },
          });
          clearTimeout(to);
          if (sR.ok) {
            const s = await sR.json();
            np.summary = s.extract as string;
            np.thumbnail = (s.thumbnail as { source?: string })?.source;
          }
        } catch {
        }
      }
      hydrated.push(np);
    }

    return NextResponse.json({ results: hydrated });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "unknown" },
      { status: 500 }
    );
  }
}
