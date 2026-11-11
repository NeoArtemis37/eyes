
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  // Mode REVERSE : ?lat=..&lon=.. → géocodage inverse (utilisé par le
  // clic droit de la carte). Réponse calquée sur Nominatim reverse pour
  // rester compatible avec le consommateur historique.
  const lat = req.nextUrl.searchParams.get("lat");
  const lon = req.nextUrl.searchParams.get("lon");
  if (lat != null && lon != null) {
    try {
      const url = new URL("https://nominatim.openstreetmap.org/reverse");
      url.searchParams.set("lat", lat);
      url.searchParams.set("lon", lon);
      url.searchParams.set("format", "jsonv2");
      url.searchParams.set("zoom", "6");
      url.searchParams.set("addressdetails", "1");
      const r = await fetch(url.toString(), {
        headers: {
          "User-Agent": "HORUS-OSINT/6.2 (intel platform; +https://horus.local)",
          Accept: "application/json",
        },
        signal: AbortSignal.timeout(8000),
        next: { revalidate: 300 },
      });
      if (!r.ok) {
        return NextResponse.json({ error: `nominatim ${r.status}` }, { status: 502 });
      }
      const data = await r.json();
      return NextResponse.json({
        name: String(data.name ?? ""),
        fullName: String(data.display_name ?? ""),
        type: String(data.type ?? ""),
        address: data.address ?? {},
      });
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "unknown" },
        { status: 500 }
      );
    }
  }

  const q = req.nextUrl.searchParams.get("q");
  if (!q) {
    return NextResponse.json(
      { error: "missing query param 'q' (or lat/lon for reverse)" },
      { status: 400 }
    );
  }
  try {
    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("q", q);
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("addressdetails", "1");
    url.searchParams.set("limit", "8");
    url.searchParams.set("extratags", "1");
    const r = await fetch(url.toString(), {
      headers: {
        "User-Agent": "HORUS-OSINT/6.2 (intel platform; +https://horus.local)",
        Accept: "application/json",
      },
      next: { revalidate: 60 },
    });
    if (!r.ok) {
      return NextResponse.json(
        { error: `nominatim ${r.status}` },
        { status: 502 }
      );
    }
    const data = await r.json();
    const results = (Array.isArray(data) ? data : []).map(
      (d: Record<string, unknown>) => ({
        id: String(d.place_id ?? d.osm_id ?? ""),
        name: String(d.display_name ?? "").split(",")[0],
        fullName: String(d.display_name ?? ""),
        lat: parseFloat(String(d.lat)),
        lng: parseFloat(String(d.lon)),
        type: String(d.type ?? "place"),
        category: String(d.category ?? ""),
        bbox: d.boundingbox as string[] | undefined,
        country: (d.address as Record<string, string> | undefined)?.country,
        region:
          (d.address as Record<string, string> | undefined)?.state ??
          (d.address as Record<string, string> | undefined)?.region,
        extratags:
          (d.extratags as Record<string, string> | undefined) ?? {},
      })
    );
    return NextResponse.json({ results });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "unknown" },
      { status: 500 }
    );
  }
}
