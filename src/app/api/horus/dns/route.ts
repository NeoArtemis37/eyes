
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const TYPES = ["A", "AAAA", "MX", "NS", "TXT", "CNAME", "SOA"] as const;

export async function GET(req: NextRequest) {
  const domain = req.nextUrl.searchParams.get("domain");
  if (!domain) {
    return NextResponse.json(
      { error: "missing 'domain' param" },
      { status: 400 }
    );
  }
  const cleanDomain = domain.replace(/^https?:\/\//, "").split("/")[0];

  try {
    const results: Record<string, { name: string; type: number; TTL: number; data: string }[]> = {};
    await Promise.all(
      TYPES.map(async (t) => {
        const url = `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(
          cleanDomain
        )}&type=${t}`;
        const r = await fetch(url, {
          headers: { Accept: "application/dns-json" },
          next: { revalidate: 60 },
        });
        if (r.ok) {
          const j = await r.json();
          const answers =
            (j.Answer as Array<{
              name: string;
              type: number;
              TTL: number;
              data: string;
            }>) ?? [];
          results[t] = answers;
        } else {
          results[t] = [];
        }
      })
    );

    return NextResponse.json({
      domain: cleanDomain,
      records: results,
      resolver: "cloudflare-doh",
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "unknown" },
      { status: 500 }
    );
  }
}
