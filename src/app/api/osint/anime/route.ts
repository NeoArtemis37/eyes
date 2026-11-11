
import { NextResponse } from 'next/server';
import {
  CATALOG, CATEGORIES, searchAll, detailFromEngine, playFromEngine, LIVE_CHANNELS,
} from '@/lib/anime/registry';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = url.searchParams.get('q')?.trim();
  const cat = url.searchParams.get('cat') || 'all';
  const engine = url.searchParams.get('engine');
  const id = url.searchParams.get('id');
  const episodeRaw = url.searchParams.get('episode');
  const episode = episodeRaw ? parseInt(episodeRaw, 10) : undefined;
  const mode = url.searchParams.get('mode') || (q ? 'search' : engine && id ? 'detail' : 'catalog');

  if (mode === 'search' && q) {
    const t0 = Date.now();
    const { results, enginesQueried, enginesResponded, errors } = await searchAll(q, cat);
    return NextResponse.json({
      source: 'native engines (bilibili + cctv + yhdm)',
      query: q,
      category: cat,
      results,
      engines: CATALOG,
      categories: CATEGORIES,
      enginesQueried,
      enginesResponded,
      errors,
      elapsedMs: Date.now() - t0,
      live: true,
      timestamp: Date.now(),
    });
  }

  if (mode === 'detail' && engine && id) {
    const detail = await detailFromEngine(engine, id);
    return NextResponse.json({
      source: `native engine: ${engine}`,
      engine,
      id,
      title: detail.title,
      cover: detail.cover,
      description: detail.description,
      episodes: detail.episodes,
      live: true,
      timestamp: Date.now(),
    });
  }

  if (mode === 'play' && engine && id) {
    const play = await playFromEngine(engine, id, episode);
    return NextResponse.json({
      source: `native engine: ${engine}`,
      engine,
      id,
      episode,
      url: play.url,
      type: play.type,
      danmaku: play.danmaku,
      danmakuCount: Array.isArray(play.danmaku) ? play.danmaku.length : 0,
      live: true,
      timestamp: Date.now(),
    });
  }

  return NextResponse.json({
    source: 'native engines (3 active: bilibili, cctv, yhdm)',
    engines: CATALOG,
    categories: CATEGORIES,
    liveChannels: LIVE_CHANNELS,
    activeEngines: CATALOG.filter(e => e.enabled).map(e => e.id),
    catalogOnlyEngines: CATALOG.filter(e => !e.enabled).map(e => e.id),
    live: true,
    timestamp: Date.now(),
  }, {
    headers: { 'Cache-Control': 'public, max-age=60' },
  });
}
