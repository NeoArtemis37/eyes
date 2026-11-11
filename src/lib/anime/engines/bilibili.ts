
import * as cheerio from 'cheerio';
import type {
  AnimeEngine, SearchResult, DetailResult, PlayResult, Danmaku,
} from '../types';
import { fetchJson } from '../types';

interface BiliSearchAllItem {
  type?: string;
  id?: number;
  aid?: number;
  bvid?: string;
  title?: string;
  arcurl?: string;
  pic?: string;
  description?: string;
  typename?: string;
  author?: string;
  play?: number;
  season_id?: number;
  media_id?: number;
  org_title?: string;
  season_type_name?: string;
  evaluate?: string;
  cover?: string;
  ep_size?: number;
}
interface BiliSearchAllResponse {
  code: number;
  message?: string;
  data?: {
    result?: Array<{
      result_type: string;
      data?: BiliSearchAllItem[];
    }>;
    numResults?: number;
  };
}

interface BiliViewResponse {
  code: number;
  data?: {
    bvid: string;
    title: string;
    pic: string;
    desc: string;
    cid: number;
    pages: Array<{ cid: number; part: string; page: number }>;
    owner?: { name: string };
    stat?: { view: number; danmaku: number };
  };
}

interface BiliSeasonResponse {
  code: number;
  result?: {
    title: string;
    cover: string;
    evaluate: string;
    areas?: Array<{ name: string }>;
    actors?: string;
    style?: string;
    episodes: Array<{
      ep_id: number;
      bvid: string;
      cid: number;
      title: string;
      long_title: string;
      show_title?: string;
      cover: string;
      pub_time: number;
      share_url: string;
      link: string;
      duration: number;
    }>;
    sections?: Array<{
      title: string;
      episodes: Array<any>;
    }>;
  };
}

function cleanTitle(s: string): string {
  return (s || '').replace(/<[^>]+>/g, '').trim();
}

function normalizeCover(u: string | undefined | null): string | null {
  if (!u) return null;
  if (u.startsWith('//')) return 'https:' + u;
  if (u.startsWith('http://') || u.startsWith('https://')) return u;
  return u;
}

export const bilibiliEngine: AnimeEngine = {
  id: 'bilibili',
  name: '哔哩哔哩',
  category: 'mainstream',
  color: '#fb7299',
  emoji: '📺',
  homepage: 'https://www.bilibili.com',
  enabled: true,

  async search(keyword: string): Promise<SearchResult[]> {
    const url = `https://api.bilibili.com/x/web-interface/wbi/search/all/v2?keyword=${encodeURIComponent(keyword)}&page=1&pagesize=20`;
    const data = await fetchJson<BiliSearchAllResponse>(url);
    if (!data || data.code !== 0 || !data.data?.result) {
      return [];
    }

    const results: SearchResult[] = [];
    for (const block of data.data.result) {
      const items = block.data || [];
      if (!Array.isArray(items)) continue;

      if (block.result_type === 'video') {
        for (const v of items) {
          if (!v.bvid) continue;
          results.push({
            engine: 'bilibili',
            id: v.bvid,
            title: cleanTitle(v.title ?? ''),
            url: v.arcurl || `https://www.bilibili.com/video/${v.bvid}`,
            cover: normalizeCover(v.pic),
            category: v.typename || 'video',
            episodes: null,
            description: cleanTitle(v.description ?? ''),
          });
        }
      } else if (block.result_type === 'media_bangumi') {
        for (const b of items) {
          if (!b.season_id) continue;
          results.push({
            engine: 'bilibili',
            id: `ss${b.season_id}`,
            title: cleanTitle(b.org_title || b.title || ''),
            url: `https://www.bilibili.com/bangumi/play/ss${b.season_id}`,
            cover: normalizeCover(b.cover),
            category: b.season_type_name || 'bangumi',
            episodes: b.ep_size || null,
            description: (b.evaluate || '').slice(0, 200),
          });
        }
      }
    }

    return results;
  },

  async detail(id: string): Promise<DetailResult> {
    if (id.startsWith('ss')) {
      const seasonId = id.slice(2);
      const apiUrl = `https://api.bilibili.com/pgc/view/web/season?season_id=${seasonId}`;
      const data = await fetchJson<BiliSeasonResponse>(apiUrl);
      if (!data || data.code !== 0 || !data.result) {
        return {
          title: `Bilibili Bangumi ${id}`,
          cover: null,
          description: 'Could not fetch bangumi info (region-locked or removed).',
          episodes: [{
            index: 0,
            name: 'Open on Bilibili',
            url: `https://www.bilibili.com/bangumi/play/${id}`,
          }],
        };
      }

      const s = data.result;
      const allEps: any[] = [...(s.episodes || [])];
      if (Array.isArray(s.sections)) {
        for (const sec of s.sections) {
          if (Array.isArray(sec.episodes)) allEps.push(...sec.episodes);
        }
      }

      const episodes = allEps.map((ep) => ({
        index: ep.ep_id,
        name: ep.long_title || ep.show_title || ep.title || `EP${ep.ep_id}`,
        url: ep.share_url || ep.link || null,
      }));

      const areaText = s.areas?.map(a => a.name).join(' / ') || '';
      const descParts = [
        s.evaluate?.trim(),
        areaText ? `地区: ${areaText}` : '',
        s.style?.trim() ? `标签: ${s.style}` : '',
      ].filter(Boolean);

      return {
        title: s.title,
        cover: normalizeCover(s.cover),
        description: descParts.join(' · '),
        episodes: episodes.length > 0 ? episodes : [{
          index: 0,
          name: 'Open on Bilibili',
          url: `https://www.bilibili.com/bangumi/play/${id}`,
        }],
      };
    }

    const url = `https://api.bilibili.com/x/web-interface/view?bvid=${encodeURIComponent(id)}`;
    const data = await fetchJson<BiliViewResponse>(url);

    if (!data?.data) {
      return {
        title: `Bilibili ${id}`,
        cover: null,
        description: 'Could not fetch video info (rate-limited or removed).',
        episodes: [{ index: 1, name: 'Open on Bilibili', url: `https://www.bilibili.com/video/${id}` }],
      };
    }

    const v = data.data;
    const episodes = (v.pages || []).map((p, i) => ({
      index: i + 1,
      name: p.part || `P${p.page}`,
      url: null,
    }));

    return {
      title: v.title,
      cover: normalizeCover(v.pic),
      description: v.desc || (v.owner ? `UP主: ${v.owner.name}` : ''),
      episodes: episodes.length > 0 ? episodes : [{ index: 1, name: 'EP1', url: null }],
    };
  },

  async play(id: string, episode?: number): Promise<PlayResult> {
    if (id.startsWith('ss')) {
      const seasonId = id.slice(2);
      const epId = episode || 0;
      const playerUrl = epId
        ? `https://player.bilibili.com/player.html?season_id=${seasonId}&ep_id=${epId}&autoplay=1&high_quality=1`
        : `https://player.bilibili.com/player.html?season_id=${seasonId}&autoplay=1&high_quality=1`;
      return {
        url: playerUrl,
        type: 'iframe',
        danmaku: null,
      };
    }

    const page = episode && episode > 1 ? episode : 1;
    const viewUrl = `https://api.bilibili.com/x/web-interface/view?bvid=${encodeURIComponent(id)}`;
    const viewData = await fetchJson<BiliViewResponse>(viewUrl);

    let danmaku: Danmaku[] | null = null;
    if (viewData?.data) {
      const pages = viewData.data.pages || [];
      const cid = pages[page - 1]?.cid || viewData.data.cid;
      if (cid) {
        danmaku = await fetchDanmaku(cid);
      }
    }

    return {
      url: `https://player.bilibili.com/player.html?bvid=${id}&page=${page}&high_quality=1&autoplay=1&danmaku=${danmaku ? 1 : 0}`,
      type: 'iframe',
      danmaku,
    };
  },
};

async function fetchDanmaku(cid: number): Promise<Danmaku[] | null> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 6000);
    const res = await fetch(`https://api.bilibili.com/x/v1/dm/list.so?cid=${cid}`, {
      signal: ctrl.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://www.bilibili.com/',
      },
    });
    clearTimeout(t);
    if (!res.ok) return null;
    const xml = await res.text();
    const $ = cheerio.load(xml, { xml: true });
    const out: Danmaku[] = [];
    $('d').each((_, el) => {
      const p = $(el).attr('p') || '';
      const parts = p.split(',');
      if (parts.length < 4) return;
      const time = parseFloat(parts[0]);
      const modeNum = parseInt(parts[1], 10);
      const color = parseInt(parts[3], 10);
      const text = $(el).text().trim();
      if (!text || !isFinite(time)) return;
      const mode: Danmaku['mode'] = modeNum === 4 ? 'bottom' : modeNum === 5 ? 'top' : 'scroll';
      out.push({
        time,
        text,
        color: color ? '#' + color.toString(16).padStart(6, '0') : undefined,
        mode,
      });
    });
    return out.length > 500 ? out.slice(0, 500) : out;
  } catch {
    return null;
  }
}
