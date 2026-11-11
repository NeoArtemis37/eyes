

import { NextRequest, NextResponse } from 'next/server';

type FeedDef = {
  url: string;
  method?: 'GET' | 'POST';
  body?: unknown;
  ttl: number; // seconds
};

const FEEDS: Record<string, FeedDef> = {
  feodo: {
    url: 'https://feodotracker.abuse.ch/downloads/ipblocklist.json',
    ttl: 600,
  },
  threatfox: {
    url: 'https://threatfox-api.abuse.ch/api/v1/',
    method: 'POST',
    body: {
      query: 'search_timeframe',
      days: 1,
    },
    ttl: 900,
  },
  urlhaus: {
    url: 'https://urlhaus.abuse.ch/downloads/text/',
    ttl: 900,
  },
  openphish: {
    url: 'https://raw.githubusercontent.com/openphish/public_feed/refs/heads/main/feed.txt',
    ttl: 1800,
  },
  ransomlive: {
    url: 'https://api.ransomware.live/v1/recentvictims',
    ttl: 900,
  },
  dshield: {
    url: 'https://feeds.dshield.org/feeds/top10.txt',
    ttl: 600,
  },
  isc: {
    url: 'https://isc.sans.edu/api/threatlist/24h?json',
    ttl: 600,
  },
  blocklistde: {
    url: 'https://lists.blocklist.de/lists/all.txt',
    ttl: 900,
  },
  spamhaus: {
    url: 'https://www.spamhaus.org/drop/drop.txt',
    ttl: 1800,
  },
  firehol: {
    url: 'https://raw.githubusercontent.com/firehol/blocklist-ipsets/master/firehol_level1.netset',
    ttl: 1800,
  },
  cinsarmy: {
    url: 'https://cinsscore.com/list/ci-badguys.txt',
    ttl: 1200,
  },
  greensnow: {
    url: 'https://blocklist.greensnow.co/greensnow.txt',
    ttl: 1200,
  },
  blackbook: {
    url: 'https://raw.githubusercontent.com/stamparm/blackbook/master/blackbook.txt',
    ttl: 3600,
  },
  kev: {
    // CISA Known Exploited Vulnerabilities — US Gov public domain, no key.
    url: 'https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json',
    ttl: 3600,
  },
  // 'circlmisp' is special-cased in fetchUpstream (multi-file MISP feed walk);
  // the stub entry lets it pass the unknown-feed gate and gives it a TTL.
  circlmisp: {
    url: '',
    ttl: 3600,
  },
};

const CIRCL_MISP_BASE = 'https://www.circl.lu/doc/misp/feed-osint/';
const CIRCL_MISP_EVENTS = 8;
const CIRCL_MANIFEST_TTL = 24 * 3600 * 1000; // hashes.csv is ~19 MB: cache it for a day

// Module-level manifest cache with rotating cursor: each refresh walks a new
// slice of the feed instead of re-downloading the manifest every time.
const circlState: { manifestTs: number; hashes: string[]; cursor: number } = {
  manifestTs: 0,
  hashes: [],
  cursor: 0,
};

/**
 * CIRCL MISP OSINT feed — keyless curated IOC events (MISP JSON standard).
 * Standard MISP feed layout: `.manifest` is a JSON object whose keys are the
 * sha256 of each event file (<sha256>.json). We walk a rotating slice of the
 * manifest each refresh and merge the sampled events into one JSON array so
 * the client adapter only needs a single request. The manifest is big
 * (tens of MB): it is cached for 24 h, so slow links only pay once.
 */
async function fetchCirclMisp(): Promise<CacheEntry> {
  const headers = { 'User-Agent': UA, Accept: 'application/json, text/plain, */*' };
  const now = Date.now();
  if (!circlState.hashes.length || now - circlState.manifestTs > CIRCL_MANIFEST_TTL) {
    // single bounded attempt: must stay well under the client's 120 s budget
    const m = await fetch(`${CIRCL_MISP_BASE}.manifest`, {
      headers,
      signal: AbortSignal.timeout(80_000),
      cache: 'no-store',
    });
    if (!m.ok) throw new Error(`manifest ${m.status}`);
    const manifest = JSON.parse(await m.text()) as Record<string, unknown>;
    const hashes = Object.keys(manifest).filter((k) => /^[a-f0-9]{64}$/.test(k));
    if (!hashes.length) throw new Error('empty manifest');
    circlState.hashes = hashes;
    circlState.manifestTs = now;
    circlState.cursor = 0;
  }
  const total = circlState.hashes.length;
  const picked: string[] = [];
  for (let i = 0; i < Math.min(CIRCL_MISP_EVENTS, total); i++) {
    picked.push(circlState.hashes[(circlState.cursor + i) % total]);
  }
  circlState.cursor = (circlState.cursor + picked.length) % total;
  const events: unknown[] = [];
  await Promise.all(
    picked.map(async (hash) => {
      try {
        const r = await fetch(`${CIRCL_MISP_BASE}${hash}.json`, {
          headers,
          signal: AbortSignal.timeout(12_000),
          cache: 'no-store',
        });
        if (r.ok) events.push(await r.json());
      } catch {
        // individual event failure is non-fatal
      }
    })
  );
  if (!events.length) throw new Error('no events fetched');
  return {
    ts: Date.now(),
    body: JSON.stringify(events),
    type: 'application/json',
    status: 200,
  };
}

type CacheEntry = { ts: number; body: string; type: string; status: number };
const memCache = new Map<string, CacheEntry>();

const UA =
  'HORUS-Intel/0.3 (+https://github.com; feed aggregator; fair-use OSINT)';

async function fetchUpstream(source: string, def: FeedDef): Promise<CacheEntry> {
  const init: RequestInit = {
    method: def.method ?? 'GET',
    headers: {
      'User-Agent': UA,
      Accept: 'application/json, text/csv, text/plain, */*',
    },
    signal: AbortSignal.timeout(12_000),
    cache: 'no-store',
  };
  if (def.body) {
    init.headers = { ...init.headers, 'Content-Type': 'application/json' };
    init.body = JSON.stringify(def.body);
  }
  if (source === 'threatfox' && process.env.THREATFOX_API_KEY) {
    init.headers = {
      ...(init.headers as Record<string, string>),
      'Auth-Key': process.env.THREATFOX_API_KEY,
    };
  }
  if (source === 'kev') {
    // CISA's CDN rejects non-browser user agents; this is a public-domain
    // government JSON feed intended for wide distribution.
    init.headers = {
      ...(init.headers as Record<string, string>),
      'User-Agent':
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
      Accept: 'application/json, */*',
    };
  }
  const res = await fetch(def.url, init);
  const body = await res.text();
  return {
    ts: Date.now(),
    body,
    type: res.headers.get('content-type') ?? 'text/plain',
    status: res.status,
  };
}

async function handle(req: NextRequest, source: string) {
  const def = FEEDS[source];
  if (!def) {
    return NextResponse.json(
      { status: 'error', message: `unknown feed: ${source}` },
      { status: 404 }
    );
  }
  const hit = memCache.get(source);
  if (hit && Date.now() - hit.ts < def.ttl * 1000) {
    return new NextResponse(hit.body, {
      status: 200,
      headers: {
        'Content-Type': hit.type,
        'X-Horus-Cache': 'hit',
        'Cache-Control': 'no-store',
      },
    });
  }
  try {
    const entry = source === 'circlmisp'
      ? await fetchCirclMisp()
      : await fetchUpstream(source, def);
    if (entry.status >= 400) throw new Error(`upstream ${entry.status}`);
    memCache.set(source, entry);
    return new NextResponse(entry.body, {
      status: 200,
      headers: {
        'Content-Type': entry.type,
        'X-Horus-Cache': 'miss',
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    return NextResponse.json(
      {
        status: 'error',
        message: err instanceof Error ? err.message : 'upstream failed',
      },
      { status: 502 }
    );
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ source: string }> }
) {
  const { source } = await params;
  return handle(req, source);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ source: string }> }
) {
  const { source } = await params;
  return handle(req, source);
}
