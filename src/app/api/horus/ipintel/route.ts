
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const target = req.nextUrl.searchParams.get("ip");
  if (!target) {
    return NextResponse.json(
      { error: "missing 'ip' param (ip, hostname, or domain)" },
      { status: 400 }
    );
  }
  try {
    const fields =
      "status,message,continent,country,countryCode,region,regionName,city,district,zip,lat,lon,timezone,offset,isp,org,as,asname,reverse,mobile,proxy,hosting,query";
    const url = `http://ip-api.com/json/${encodeURIComponent(
      target
    )}?fields=${fields}`;
    const r = await fetch(url, { next: { revalidate: 60 } });
    if (!r.ok) {
      return NextResponse.json(
        { error: `ip-api ${r.status}` },
        { status: 502 }
      );
    }
    const data = await r.json();
    if (data.status !== "success") {
      return NextResponse.json(
        { error: data.message ?? "lookup failed" },
        { status: 400 }
      );
    }
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "unknown" },
      { status: 500 }
    );
  }
}
