
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const TOKEN = process.env.CARTO_API_TOKEN ?? "";
const STYLES: Record<string, string> = {
  dark: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
  voyager: "https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json",
  positron: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
};

type AnyStyle = Record<string, unknown>;
type StyleSource = Record<string, unknown>;

const CACHE = new Map<string, { style: AnyStyle; ts: number }>();
const CACHE_TTL = 24 * 60 * 60 * 1000;

function withToken(url: string): string {
  if (!TOKEN) return url;
  return url + (url.includes("?") ? "&" : "?") + "access_token=" + encodeURIComponent(TOKEN);
}

function bareUrl(url: string): string {
  return url.split("?access_token=")[0];
}

async function resolveSources(style: AnyStyle): Promise<void> {
  const sources = (style.sources ?? {}) as Record<string, StyleSource>;
  await Promise.all(
    Object.values(sources).map(async (src) => {
      const url = typeof src.url === "string" ? src.url : null;
      if (!url) return;
      try {
        const r = await fetch(withToken(bareUrl(url)), {
          headers: { Accept: "application/json" },
        });
        if (!r.ok) return;
        const tj = (await r.json()) as { tiles?: string[] };
        if (Array.isArray(tj.tiles) && tj.tiles.length > 0) {
          delete src.url;
          src.tiles = tj.tiles.map((t) => withToken(bareUrl(t)));
        }
      } catch {
      }
    })
  );

  const glyphs = typeof style.glyphs === "string" ? style.glyphs : null;
  if (glyphs) style.glyphs = withToken(bareUrl(glyphs));
}

async function buildStyle(kind: string): Promise<AnyStyle> {
  const url = STYLES[kind] ?? STYLES.dark;
  const r = await fetch(withToken(url), {
    headers: { Accept: "application/json" },
    next: { revalidate: 86400 },
  });
  if (!r.ok) {
    throw new Error(`carto style ${kind} -> ${r.status}`);
  }
  const style = (await r.json()) as AnyStyle;
  await resolveSources(style);
  style.name = `HORUS / CARTO ${kind}`;
  return style;
}

export async function GET(req: NextRequest) {
  const kind = req.nextUrl.searchParams.get("style") ?? "dark";
  if (!STYLES[kind]) {
    return NextResponse.json({ error: `unknown style '${kind}'` }, { status: 400 });
  }
  if (!TOKEN) {
    return NextResponse.json(
      { error: "CARTO_API_TOKEN not configured on server" },
      { status: 500 }
    );
  }

  const cached = CACHE.get(kind);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return NextResponse.json(cached.style, {
      headers: { "Cache-Control": "public, max-age=3600" },
    });
  }

  try {
    const style = await buildStyle(kind);
    CACHE.set(kind, { style, ts: Date.now() });
    return NextResponse.json(style, {
      headers: { "Cache-Control": "public, max-age=3600" },
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "carto unavailable" },
      { status: 502 }
    );
  }
}
