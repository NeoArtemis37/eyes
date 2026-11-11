
import type { AnimeEngine, SearchResult, DetailResult, PlayResult, EngineCategory } from './types';
import { bilibiliEngine } from './engines/bilibili';
import { cctvEngine, LIVE_CHANNELS } from './engines/cctv';
import { yhdmEngine } from './engines/yhdm';

export const ENGINES: AnimeEngine[] = [
  bilibiliEngine,
  cctvEngine,
  yhdmEngine,
];

export interface CatalogEntry {
  id: string;
  name: string;
  category: EngineCategory;
  url: string;
  color: string;
  emoji: string;
  enabled: boolean;        // false = catalog-only, true = has implementation
}

export const CATALOG: CatalogEntry[] = [
  { id: 'bilibili', name: '哔哩哔哩', category: 'mainstream', url: 'https://www.bilibili.com', color: '#fb7299', emoji: '📺', enabled: true },
  { id: 'cctv',     name: 'CCTV / 卫视', category: 'live',      url: 'https://tv.cctv.com/live/', color: '#cf1322', emoji: '📡', enabled: true },
  { id: 'yhdm',     name: '樱花动漫', category: 'anime',      url: 'http://www.iyinghua.io',    color: '#ff85b3', emoji: '🌸', enabled: true },

  { id: 'iqiyi',    name: '爱奇艺',    category: 'mainstream', url: 'https://www.iqiyi.com',     color: '#00be06', emoji: '🎬', enabled: false },
  { id: 'tencent',  name: '腾讯视频',  category: 'mainstream', url: 'https://v.qq.com',         color: '#ff6022', emoji: '🐧', enabled: false },
  { id: 'youku',    name: '优酷',      category: 'mainstream', url: 'https://www.youku.com',    color: '#1989fa', emoji: '📺', enabled: false },
  { id: 'mgtv',     name: '芒果TV',    category: 'mainstream', url: 'https://www.mgtv.com',     color: '#ff5f00', emoji: '🥭', enabled: false },
  { id: 'agefans',  name: 'AgeFans',   category: 'anime',      url: 'https://www.agefans.net',  color: '#23ade5', emoji: '🎯', enabled: false },
  { id: 'bimibimi', name: 'bimibimi',  category: 'anime',      url: 'http://www.bimibimi.tv',   color: '#9b6dff', emoji: '🍓', enabled: false },
  { id: 'zzzfun',   name: 'ZzzFun',    category: 'anime',      url: 'http://www.zzzfun.com',    color: '#36cfc9', emoji: '💤', enabled: false },
  { id: 'k1080',    name: 'K1080',     category: 'anime',      url: 'http://www.k1080.net',     color: '#f5a623', emoji: '🎞️', enabled: false },
  { id: '4kya',     name: '4K鸭奈菲',  category: 'anime',      url: 'http://4kya.com',          color: '#7cb305', emoji: '🦆', enabled: false },
  { id: 'libvio',   name: 'Lib在线',   category: 'anime',      url: 'https://libvio.me',        color: '#5b8c00', emoji: '📚', enabled: false },
  { id: 'afang',    name: '阿房影视',  category: 'anime',      url: 'http://www.afang.tv',      color: '#d4380d', emoji: '🏯', enabled: false },
];

export async function searchAll(keyword: string, category?: string): Promise<{
  results: SearchResult[];
  enginesQueried: number;
  enginesResponded: number;
  errors: string[];
}> {
  const errors: string[] = [];
  let enginesQueried = 0;
  let enginesResponded = 0;

  const targetEngines = ENGINES.filter(e => {
    if (category && category !== 'all' && e.category !== category) return false;
    return true;
  });

  enginesQueried = targetEngines.length;

  const settled = await Promise.allSettled(targetEngines.map(e => e.search(keyword)));

  const results: SearchResult[] = [];
  settled.forEach((s, i) => {
    if (s.status === 'fulfilled') {
      enginesResponded++;
      results.push(...s.value);
    } else {
      errors.push(`${targetEngines[i].id}: ${s.reason?.message || 'search failed'}`);
    }
  });

  const orderRank = (r: SearchResult) => {
    if (r.engine === 'bilibili' && r.id.startsWith('ss')) return 0;
    if (r.engine === 'bilibili') return 1;
    if (r.engine === 'yhdm') return 2;
    if (r.engine === 'cctv') return 3;
    return 9;
  };
  results.sort((a, b) => orderRank(a) - orderRank(b));

  return { results, enginesQueried, enginesResponded, errors };
}

export function getEngine(id: string): AnimeEngine | null {
  return ENGINES.find(e => e.id === id) || null;
}

export async function detailFromEngine(engineId: string, id: string): Promise<DetailResult> {
  const e = getEngine(engineId);
  if (!e) {
    return { title: 'Unknown engine', cover: null, description: `No engine '${engineId}'`, episodes: [] };
  }
  return e.detail(id);
}

export async function playFromEngine(engineId: string, id: string, episode?: number): Promise<PlayResult> {
  const e = getEngine(engineId);
  if (!e) {
    return { url: null, type: null, danmaku: null };
  }
  return e.play(id, episode);
}

export const CATEGORIES = [
  { id: 'all',        label: 'ALL',     zh: '全部' },
  { id: 'anime',      label: 'ANIME',   zh: '番剧' },
  { id: 'mainstream', label: 'CN',      zh: '国漫/影视' },
  { id: 'live',       label: 'LIVE',    zh: 'CCTV/卫视' },
];

export { LIVE_CHANNELS };
