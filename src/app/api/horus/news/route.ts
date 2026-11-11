
import { NextRequest, NextResponse } from "next/server";
import { fetchIpv4Json } from "@/lib/horus/ipv4-fetch";

export const dynamic = "force-dynamic";

type HNItem = {
  id: number;
  title?: string;
  url?: string;
  by?: string;
  time?: number;
  score?: number;
  descendants?: number;
};

export async function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.get("q") ?? "intelligence";
  const maxrecords = Math.min(
    parseInt(req.nextUrl.searchParams.get("max") ?? "30", 10),
    250
  );

  try {
    const url = new URL("https://api.gdeltproject.org/api/v2/doc/doc");
    url.searchParams.set("query", query);
    url.searchParams.set("mode", "ArtList");
    url.searchParams.set("maxrecords", String(maxrecords));
    url.searchParams.set("format", "json");
    url.searchParams.set("sort", "DateDesc");
    url.searchParams.set("timespan", "3d");

    const data = await fetchIpv4Json<{ articles?: Array<{
      url: string;
      title: string;
      seendate: string;
      socialimage?: string;
      domain: string;
      language: string;
      sourcecountry: string;
    }> }>(url.toString(), {
      headers: { "User-Agent": "HORUS-OSINT/6.2" },
      timeoutMs: 8000,
    });

    if (data?.articles && Array.isArray(data.articles) && data.articles.length > 0) {
      const articles = data.articles.map((a) => ({
        title: a.title,
        url: a.url,
        domain: a.domain,
        seenDate: a.seendate,
        image: a.socialimage,
        language: a.language,
        sourceCountry: a.sourcecountry,
      }));
      return NextResponse.json({
        count: articles.length,
        articles,
        source: "gdelt",
      });
    }
  } catch {
  }

  try {
    const algoliaUrl = `https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(
      query
    )}&tags=story&hitsPerPage=${maxrecords}`;
    const data = await fetchIpv4Json<{
      hits: Array<{
        title: string;
        url: string | null;
        author: string;
        created_at_i: number;
        points: number;
        num_comments: number;
        objectID: string;
      }>;
    }>(algoliaUrl, {
      headers: { "User-Agent": "HORUS-OSINT/6.2" },
      timeoutMs: 8000,
    });

    const articles = (data?.hits ?? [])
      .filter((h) => h.title)
      .map((h) => ({
        title: h.title,
        url: h.url || `https://news.ycombinator.com/item?id=${h.objectID}`,
        domain: h.url ? new URL(h.url).hostname.replace(/^www\./, "") : "news.ycombinator.com",
        seenDate: new Date(h.created_at_i * 1000).toISOString().slice(0, 8),
        image: undefined,
        language: "en",
        sourceCountry: "US",
        score: h.points,
        comments: h.num_comments,
      }));
    return NextResponse.json({
      count: articles.length,
      articles,
      source: "hackernews",
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "news sources unavailable" },
      { status: 502 }
    );
  }
}
