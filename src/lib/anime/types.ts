
export type EngineCategory = 'mainstream' | 'anime' | 'live';

export interface SearchResult {
  engine: string;
  id: string;            // engine-specific ID (BV code, URL slug, channel id, etc.)
  title: string;
  url: string | null;    // source page URL (for fallback navigation)
  cover: string | null;
  category: string;      // e.g. "番剧", "电影", "CCTV-1"
  episodes: number | null;
  description: string;
}

export interface Episode {
  index: number;         // 1-indexed episode number
  name: string;          // display name (e.g. "第1集" or "EP1")
  url: string | null;    // optional pre-resolved URL
}

export interface DetailResult {
  title: string;
  cover: string | null;
  description: string;
  episodes: Episode[];
}

export type PlayType = 'mp4' | 'hls' | 'iframe' | null;

export interface Danmaku {
  time: number;          // seconds from start
  text: string;
  color?: string;
  mode?: 'scroll' | 'top' | 'bottom';
}

export interface PlayResult {
  url: string | null;
  type: PlayType;
  danmaku: Danmaku[] | null;
}

export interface AnimeEngine {
  id: string;
  name: string;
  category: EngineCategory;
  color: string;
  emoji: string;
  homepage: string;
  enabled: boolean;       // false = catalog-only (utao-style direct nav)
  search(keyword: string): Promise<SearchResult[]>;
  detail(id: string): Promise<DetailResult>;
  play(id: string, episode?: number): Promise<PlayResult>;
}

export async function fetchHtml(url: string, opts: RequestInit = {}): Promise<string | null> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 8000);
    const res = await fetch(url, {
      ...opts,
      signal: ctrl.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        ...(opts.headers || {}),
      },
    });
    clearTimeout(t);
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

export async function fetchJson<T = any>(url: string, opts: RequestInit = {}): Promise<T | null> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 8000);
    const res = await fetch(url, {
      ...opts,
      signal: ctrl.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        'Referer': 'https://www.bilibili.com/',
        ...(opts.headers || {}),
      },
    });
    clearTimeout(t);
    if (!res.ok) return null;
    return await res.json() as T;
  } catch {
    return null;
  }
}
