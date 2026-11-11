
import type {
  AnimeEngine, SearchResult, DetailResult, PlayResult,
} from '../types';

interface LiveChannel {
  id: string;
  name: string;
  category: string;
  url: string;       // iframe-embeddable live player URL
  homepage: string;
}

const CHANNELS: LiveChannel[] = [
  { id: 'cctv1',  name: 'CCTV-1 综合',   category: 'CCTV', url: 'https://tv.cctv.com/live/cctv1/',  homepage: 'https://tv.cctv.com/live/cctv1/' },
  { id: 'cctv2',  name: 'CCTV-2 财经',   category: 'CCTV', url: 'https://tv.cctv.com/live/cctv2/',  homepage: 'https://tv.cctv.com/live/cctv2/' },
  { id: 'cctv3',  name: 'CCTV-3 综艺',   category: 'CCTV', url: 'https://tv.cctv.com/live/cctv3/',  homepage: 'https://tv.cctv.com/live/cctv3/' },
  { id: 'cctv4',  name: 'CCTV-4 中文国际', category: 'CCTV', url: 'https://tv.cctv.com/live/cctv4/',  homepage: 'https://tv.cctv.com/live/cctv4/' },
  { id: 'cctv5',  name: 'CCTV-5 体育',   category: 'CCTV', url: 'https://tv.cctv.com/live/cctv5/',  homepage: 'https://tv.cctv.com/live/cctv5/' },
  { id: 'cctv6',  name: 'CCTV-6 电影',   category: 'CCTV', url: 'https://tv.cctv.com/live/cctv6/',  homepage: 'https://tv.cctv.com/live/cctv6/' },
  { id: 'cctv7',  name: 'CCTV-7 国防军事', category: 'CCTV', url: 'https://tv.cctv.com/live/cctv7/',  homepage: 'https://tv.cctv.com/live/cctv7/' },
  { id: 'cctv8',  name: 'CCTV-8 电视剧', category: 'CCTV', url: 'https://tv.cctv.com/live/cctv8/',  homepage: 'https://tv.cctv.com/live/cctv8/' },
  { id: 'cctv9',  name: 'CCTV-9 纪录',   category: 'CCTV', url: 'https://tv.cctv.com/live/cctv9/',  homepage: 'https://tv.cctv.com/live/cctv9/' },
  { id: 'cctv10', name: 'CCTV-10 科教',  category: 'CCTV', url: 'https://tv.cctv.com/live/cctv10/', homepage: 'https://tv.cctv.com/live/cctv10/' },
  { id: 'cctv11', name: 'CCTV-11 戏曲',  category: 'CCTV', url: 'https://tv.cctv.com/live/cctv11/', homepage: 'https://tv.cctv.com/live/cctv11/' },
  { id: 'cctv12', name: 'CCTV-12 社会与法', category: 'CCTV', url: 'https://tv.cctv.com/live/cctv12/', homepage: 'https://tv.cctv.com/live/cctv12/' },
  { id: 'cctv13', name: 'CCTV-13 新闻',  category: 'CCTV', url: 'https://tv.cctv.com/live/cctv13/', homepage: 'https://tv.cctv.com/live/cctv13/' },
  { id: 'cctv17', name: 'CCTV-17 农业农村', category: 'CCTV', url: 'https://tv.cctv.com/live/cctv17/', homepage: 'https://tv.cctv.com/live/cctv17/' },

  { id: 'hunan',    name: '湖南卫视',   category: '卫视', url: 'https://www.mgtv.com/live/',          homepage: 'https://www.mgtv.com/' },
  { id: 'jiangsu',  name: '江苏卫视',   category: '卫视', url: 'https://live.jstv.com/',              homepage: 'https://www.jstv.com/' },
  { id: 'zhejiang', name: '浙江卫视',   category: '卫视', url: 'https://www.cztv.com/live/',          homepage: 'https://www.cztv.com/' },
  { id: 'dongfang', name: '东方卫视',   category: '卫视', url: 'https://www.smg.cn/',                 homepage: 'https://www.smg.cn/' },
  { id: 'beijing',  name: '北京卫视',   category: '卫视', url: 'https://www.brtn.cn/live/',           homepage: 'https://www.brtn.cn/' },
];

export const cctvEngine: AnimeEngine = {
  id: 'cctv',
  name: 'CCTV / 卫视',
  category: 'live',
  color: '#cf1322',
  emoji: '📡',
  homepage: 'https://tv.cctv.com/live/',
  enabled: true,

  async search(keyword: string): Promise<SearchResult[]> {
    const k = keyword.toLowerCase().trim();
    const matches = k
      ? CHANNELS.filter(c =>
          c.name.toLowerCase().includes(k) ||
          c.id.toLowerCase().includes(k) ||
          c.category.toLowerCase().includes(k))
      : CHANNELS;

    return matches.map(c => ({
      engine: 'cctv',
      id: c.id,
      title: c.name,
      url: c.homepage,
      cover: null,
      category: c.category,
      episodes: null,
      description: `${c.category} live stream`,
    }));
  },

  async detail(id: string): Promise<DetailResult> {
    const ch = CHANNELS.find(c => c.id === id);
    if (!ch) {
      return {
        title: 'Unknown channel',
        cover: null,
        description: '',
        episodes: [],
      };
    }
    return {
      title: ch.name,
      cover: null,
      description: `${ch.category} · live broadcast`,
      episodes: [{ index: 1, name: 'LIVE', url: ch.url }],
    };
  },

  async play(id: string, _episode?: number): Promise<PlayResult> {
    const ch = CHANNELS.find(c => c.id === id);
    if (!ch) {
      return { url: null, type: null, danmaku: null };
    }
    return {
      url: ch.url,
      type: 'iframe',
      danmaku: null,
    };
  },
};

export const LIVE_CHANNELS = CHANNELS;
