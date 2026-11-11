
import { fetchText, errorResponse } from '@/lib/sb-fetch';
import * as cheerio from 'cheerio';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = url.searchParams.get('query')?.trim() || '';
  if (!q || q.length < 2) return errorResponse('Missing ?query= (min 2 chars)', 400);

  const html = await fetchText(
    `https://www.opensanctions.org/search/?q=${encodeURIComponent(q)}`,
    { timeout: 10000, headers: { 'Accept': 'text/html,application/xhtml+xml' } },
  );

  if (!html) {
    return errorResponse('OpenSanctions search failed (HTML fetch failed)', 502);
  }

  const $ = cheerio.load(html);
  const matches: any[] = [];

  $('a[href^="/entities/"]').each((_, el) => {
    const href = $(el).attr('href') || '';
    const qid = href.replace(/^\/entities\//, '').replace(/\/$/, '');
    if (!qid || qid.includes('/')) return; // skip sub-paths

    const caption = $(el).text().trim();
    if (!caption) return;

    const $card = $(el).closest('div').parent();
    const detailsText = $card.find('p').first().text().trim();
    const parts = detailsText.split(/[·|,]/).map(s => s.trim()).filter(Boolean);
    const schema = parts[0] || 'Entity';
    const datasets = parts.slice(1);

    if (matches.find(m => m.id === qid)) return;

    matches.push({
      id: qid,
      caption,
      schema,
      datasets,
      url: `https://www.opensanctions.org/entities/${qid}/`,
    });
  });

  return Response.json({
    query: q,
    total: matches.length,
    matches: matches.slice(0, 25),
    source: 'OpenSanctions (US OFAC SDN + EU + UN + UK consolidated lists)',
    timestamp: Date.now(),
  });
}
