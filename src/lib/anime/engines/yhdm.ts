
import * as cheerio from 'cheerio';
import type {
  AnimeEngine, SearchResult, DetailResult, PlayResult,
} from '../types';
import { fetchHtml } from '../types';

const MIRRORS = [
  'http://www.iyinghua.io',
  'https://www.yhdmp.cc',
  'http://www.yhdm.io',
];

async function tryFetch(path: string): Promise<{ html: string; base: string } | null> {
  for (const base of MIRRORS) {
    const html = await fetchHtml(base + path);
    if (html && html.length > 500) {
      return { html, base };
    }
  }
  return null;
}

export const yhdmEngine: AnimeEngine = {
  id: 'yhdm',
  name: '樱花动漫',
  category: 'anime',
  color: '#ff85b3',
  emoji: '🌸',
  homepage: 'http://www.iyinghua.io',
  enabled: true,

  async search(keyword: string): Promise<SearchResult[]> {
    const result = await tryFetch(`/search/${encodeURIComponent(keyword)}/`);
    if (!result) return [];

    const $ = cheerio.load(result.html);
    const out: SearchResult[] = [];

    $('.lpic ul li, .search-list li, .movie-list li').slice(0, 15).each((_, el) => {
      const $el = $(el);
      const $link = $el.find('a').first();
      const href = $link.attr('href') || '';
      const title = $el.find('h2 a, .title a, h2').text().trim() || $link.attr('title') || '';
      const cover = $el.find('img').attr('src') || $el.find('img').attr('data-original') || null;

      const idMatch = href.match(/\/(?:show|v|anime)\/(\w+)\.html/);
      const id = idMatch ? idMatch[1] : href;

      if (title && id) {
        out.push({
          engine: 'yhdm',
          id,
          title,
          url: href.startsWith('http') ? href : result.base + href,
          cover: cover ? (cover.startsWith('http') ? cover : result.base + cover) : null,
          category: '番剧',
          episodes: null,
          description: $el.find('.summary, .jianjie, p').text().trim().slice(0, 200),
        });
      }
    });

    return out;
  },

  async detail(id: string): Promise<DetailResult> {
    const result = await tryFetch(`/show/${id}.html`);
    if (!result) {
      return {
        title: `yhdm ${id}`,
        cover: null,
        description: 'Could not reach yhdm mirror. Try again later.',
        episodes: [],
      };
    }

    const $ = cheerio.load(result.html);
    const title = $('.data h4, .pic h1, h1.title, .anime-title').text().trim() || `yhdm ${id}`;
    const cover = $('.data img, .thumb img, .pic img').attr('src') || null;
    const description = $('.data .content, .summary, .info').text().trim().slice(0, 500);

    const episodes: { index: number; name: string; url: string | null }[] = [];
    $('.urls a, .movurls a, .playlist a, .tabs a').each((i, el) => {
      const $a = $(el);
      const href = $a.attr('href') || '';
      const name = $a.text().trim() || `EP${i + 1}`;
      const epMatch = href.match(/\/v\/([\w-]+)\.html/);
      if (epMatch) {
        episodes.push({ index: i + 1, name, url: null });
      }
    });

    if (episodes.length === 0) {
      episodes.push({ index: 1, name: 'Open on yhdm', url: `${result.base}/show/${id}.html` });
    }

    return {
      title,
      cover: cover ? (cover.startsWith('http') ? cover : result.base + cover) : null,
      description,
      episodes,
    };
  },

  async play(id: string, episode?: number): Promise<PlayResult> {
    const detail = await this.detail(id);
    const ep = detail.episodes[episode ? episode - 1 : 0];
    if (!ep) {
      return { url: null, type: null, danmaku: null };
    }

    const epResult = await tryFetch(`/v/${id}-${episode || 1}.html`);
    if (!epResult) {
      return {
        url: `${MIRRORS[0]}/show/${id}.html`,
        type: 'iframe',
        danmaku: null,
      };
    }

    const $ = cheerio.load(epResult.html);
    const playerIframe = $('iframe').attr('src') || $('#playbox iframe').attr('src') || $('.player iframe').attr('src');

    if (playerIframe) {
      const url = playerIframe.startsWith('http') ? playerIframe : MIRRORS[0] + playerIframe;
      return { url, type: 'iframe', danmaku: null };
    }

    return {
      url: `${MIRRORS[0]}/show/${id}.html`,
      type: 'iframe',
      danmaku: null,
    };
  },
};
