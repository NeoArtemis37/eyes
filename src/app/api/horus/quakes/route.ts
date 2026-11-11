
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const r = await fetch(
      "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson",
      { next: { revalidate: 120 } }
    );
    if (!r.ok) {
      return NextResponse.json(
        { error: `usgs ${r.status}` },
        { status: 502 }
      );
    }
    const data = await r.json();
    const quakes = (data.features ?? [])
      .slice(0, 200)
      .map(
        (f: {
          id: string;
          properties: Record<string, unknown>;
          geometry: { coordinates: [number, number, number] };
        }) => ({
          id: f.id,
          mag: f.properties.mag as number,
          place: f.properties.place as string,
          ts: f.properties.time as number,
          lng: f.geometry.coordinates[0],
          lat: f.geometry.coordinates[1],
          depth: f.geometry.coordinates[2],
          url: f.properties.url as string,
          alert: (f.properties.alert as string) ?? null,
          tsunami: f.properties.tsunami as number,
        })
      )
      .sort((a: { mag: number }, b: { mag: number }) => b.mag - a.mag);
    return NextResponse.json({ count: quakes.length, quakes });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "unknown" },
      { status: 500 }
    );
  }
}
