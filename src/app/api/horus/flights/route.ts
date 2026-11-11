
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const r = await fetch(
      "https://opensky-network.org/api/states/all",
      { next: { revalidate: 15 } }
    );
    if (!r.ok) {
      return NextResponse.json(
        { error: `opensky ${r.status}` },
        { status: 502 }
      );
    }
    const data = await r.json();
    const states: unknown[] = data.states ?? [];
    const flights = states
      .slice(0, 800)
      .map((s) => s as (string | number | null)[])
      .filter((s) => s[5] != null && s[6] != null)
      .map((s) => ({
        icao24: s[0] as string,
        callsign: (s[1] as string | null)?.trim() ?? 'N/D',
        origin: s[2] as string,
        lon: s[5] as number,
        lat: s[6] as number,
        baroAlt: s[7] as number | null,
        geoAlt: s[13] as number | null,
        vel: s[9] as number | null,
        heading: s[10] as number | null,
        vertRate: s[11] as number | null,
        onGround: Boolean(s[8]),
      }));
    return NextResponse.json({
      count: flights.length,
      ts: data.time,
      flights,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "unknown" },
      { status: 500 }
    );
  }
}
