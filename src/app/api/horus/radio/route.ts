
import { NextRequest, NextResponse } from "next/server";
import { fetchIpv4Json } from "@/lib/horus/ipv4-fetch";

export const dynamic = "force-dynamic";

type Station = {
  stationuuid: string;
  name: string;
  url: string;
  url_resolved: string;
  favicon: string;
  country: string;
  countrycode: string;
  state: string;
  tags: string;
  geo_lat: number;
  geo_long: number;
  codec: string;
  bitrate: number;
  clickcount: number;
};

export async function GET(req: NextRequest) {
  const country = req.nextUrl.searchParams.get("country") ?? "US";
  const limit = Math.min(
    parseInt(req.nextUrl.searchParams.get("limit") ?? "60", 10),
    200
  );
  try {
    const servers = [
      "https://de1.api.radio-browser.info",
      "https://all.api.radio-browser.info",
      "https://nl1.api.radio-browser.info",
      "https://fi1.api.radio-browser.info",
      "https://at1.api.radio-browser.info",
    ];

    let stations: Station[] | null = null;
    let lastErr: string | null = null;
    for (const srv of servers) {
      try {
        const url = `${srv}/json/stations/bycountrycodeexact/${encodeURIComponent(
          country
        )}?hidebroken=true&order=clickcount&reverse=true&limit=${limit}&offset=0`;
        const data = await fetchIpv4Json<Station[]>(url, {
          headers: { "User-Agent": "HORUS-OSINT/6.2" },
          timeoutMs: 8000,
        });
        if (Array.isArray(data)) {
          stations = data;
          break;
        }
      } catch (e) {
        lastErr = e instanceof Error ? e.message : "fetch failed";
        continue;
      }
    }
    if (stations === null) {
      return NextResponse.json(
        { error: lastErr ?? "all radio-browser servers failed" },
        { status: 502 }
      );
    }
    const out = stations
      .filter((s) => s.geo_lat && s.geo_long)
      .map((s) => ({
        id: s.stationuuid,
        name: s.name,
        streamUrl: s.url_resolved || s.url,
        favicon: s.favicon,
        country: s.country,
        state: s.state,
        tags: s.tags,
        lat: s.geo_lat,
        lng: s.geo_long,
        codec: s.codec,
        bitrate: s.bitrate,
        clicks: s.clickcount,
      }));
    return NextResponse.json({ count: out.length, stations: out });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "unknown" },
      { status: 500 }
    );
  }
}
