

import { NextResponse } from 'next/server';

const GROUPS_URL = 'https://api.ransomware.live/v1/groups';
const VICTIMS_URL = 'https://api.ransomware.live/v1/recentvictims';

interface GroupLoc {
  available?: boolean;
  enabled?: boolean;
  fqdn?: string;
  title?: string;
  type?: string;
}
interface GroupTtp {
  tactic_id?: string;
  tactic_name?: string;
  techniques?: { technique_id?: string; technique_name?: string }[];
}
interface RawGroup {
  name: string;
  altname?: string | null;
  description?: string | null;
  added_date?: string | null;
  locations?: GroupLoc[];
  tools?: string[];
  ttps?: GroupTtp[];
}
interface RawVictim {
  activity?: string | null;
  country?: string | null;
  data_size?: string | null;
  description?: string | null;
  discovered?: string | null;
  group_name?: string | null;
  post_title?: string | null;
  post_url?: string | null;
  published?: string | null;
  ransom?: string | number | null;
  website?: string | null;
}

const g = globalThis as unknown as {
  __rwGroups?: { at: number; data: RawGroup[] };
  __rwVictims?: { at: number; data: RawVictim[] };
};
const GROUPS_TTL = 6 * 3600_000;
const VICTIMS_TTL = 10 * 60_000;

type JsonSlot<T> = { at: number; data: T };

async function fetchJson<T>(
  url: string,
  ttl: number,
  store: { v?: JsonSlot<T> }
): Promise<T | null> {
  const cached = store.v;
  if (cached && Date.now() - cached.at < ttl) return cached.data;
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 15_000);
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) Chrome/131.0' },
      signal: ac.signal,
      cache: 'no-store',
    });
    if (!res.ok) return cached ? cached.data : null;
    const data = (await res.json()) as T;
    store.v = { at: Date.now(), data };
    return data;
  } catch {
    return cached ? cached.data : null;
  } finally {
    clearTimeout(timer);
  }
}

const isRecent = (iso: string | null | undefined, days: number): boolean => {
  if (!iso) return false;
  const t = Date.parse(iso);
  return Number.isFinite(t) && Date.now() - t < days * 86_400_000;
};


const clean = (s: string | null | undefined): string =>
  String(s ?? '').replace(/[—–]/g, '·');

const onionHost = (fqdn?: string): string => {
  if (!fqdn) return '';
  const m = /([a-z0-9]{16,62}\.onion)/i.exec(fqdn);
  return m ? m[1].toLowerCase() : '';
};

const groupsStore = (g as any).__rwGroupsStore ?? ((g as any).__rwGroupsStore = {});
const victimsStore = (g as any).__rwVictimsStore ?? ((g as any).__rwVictimsStore = {});

export async function GET(req: Request) {
  const url = new URL(req.url);
  const mode = url.searchParams.get('mode') ?? 'top';
  const q = (url.searchParams.get('q') ?? '').trim().toLowerCase();
  const name = (url.searchParams.get('name') ?? '').trim();

  const [groups, victims] = await Promise.all([
    fetchJson<RawGroup[]>(GROUPS_URL, GROUPS_TTL, groupsStore),
    fetchJson<RawVictim[]>(VICTIMS_URL, VICTIMS_TTL, victimsStore),
  ]);

  if (!groups) {
    return NextResponse.json(
      { error: 'source rançongiciel indisponible (api.ransomware.live)', source: 'ransomware.live' },
      { status: 502 }
    );
  }

  const victims30 = new Map<string, number>();
  const victims7 = new Map<string, number>();
  for (const v of victims ?? []) {
    if (!v.group_name) continue;
    if (isRecent(v.published ?? v.discovered, 30)) victims30.set(v.group_name, (victims30.get(v.group_name) ?? 0) + 1);
    if (isRecent(v.published ?? v.discovered, 7)) victims7.set(v.group_name, (victims7.get(v.group_name) ?? 0) + 1);
  }

  const onionsOf = (grp: RawGroup) =>
    (grp.locations ?? [])
      .map((l) => ({ host: onionHost(l.fqdn) || l.fqdn || '', type: l.type ?? '', title: l.title ?? '', available: !!l.available, enabled: !!l.enabled }))
      .filter((o) => o.host);

  if (mode === 'search') {
    if (q.length < 2) return NextResponse.json({ total: 0, groups: [], ts: Date.now() });
    const hits = groups
      .filter(
        (grp) =>
          grp.name?.toLowerCase().includes(q) ||
          (grp.altname ?? '').toString().toLowerCase().includes(q) ||
          onionsOf(grp).some((o) => o.host.includes(q))
      )
      .slice(0, 20)
      .map((grp) => ({
        name: grp.name,
        altname: grp.altname ?? '',
        description: clean((grp.description ?? '').slice(0, 160)),
        added: grp.added_date ?? '',
        victims30: victims30.get(grp.name) ?? 0,
        onionsUp: onionsOf(grp).filter((o) => o.available).length,
        onionsTotal: onionsOf(grp).length,
      }));
    return NextResponse.json({ total: hits.length, groups: hits, ts: Date.now(), source: 'ransomware.live' });
  }

  if (mode === 'group') {
    const grp = groups.find((x) => x.name.toLowerCase() === name.toLowerCase());
    if (!grp) return NextResponse.json({ error: `groupe « ${name} » inconnu`, source: 'ransomware.live' }, { status: 404 });
    const vic = (victims ?? [])
      .filter((v) => v.group_name?.toLowerCase() === grp.name.toLowerCase())
      .slice(0, 12)
      .map((v) => ({
        title: clean(v.post_title),
        country: v.country ?? '',
        sector: clean(v.activity),
        description: clean(v.description),
        published: v.published ?? v.discovered ?? '',
        postUrl: v.post_url ?? '',
        data_size: v.data_size ?? '',
        ransom: v.ransom ?? '',
      }));
    return NextResponse.json({
      group: {
        name: grp.name,
        altname: clean(grp.altname),
        description: clean(grp.description),
        added: grp.added_date ?? '',
        onions: onionsOf(grp),
        tools: (grp.tools ?? []).map(clean),
        ttps: (grp.ttps ?? []).map((t) => ({
          tactic: clean(t.tactic_name ?? t.tactic_id ?? ''),
          techniques: (t.techniques ?? []).map((x) => clean(x.technique_name ?? x.technique_id ?? '')),
        })),
      },
      victims: vic,
      victims30: victims30.get(grp.name) ?? 0,
      ts: Date.now(),
      source: 'ransomware.live',
    });
  }

  const sectors = new Map<string, number>();
  const countries = new Map<string, number>();
  let vic7 = 0;
  for (const v of victims ?? []) {
    if (v.activity) sectors.set(clean(v.activity), (sectors.get(clean(v.activity)) ?? 0) + 1);
    if (v.country) countries.set(v.country, (countries.get(v.country) ?? 0) + 1);
    if (isRecent(v.published ?? v.discovered, 7)) vic7++;
  }
  const rank = (m: Map<string, number>, n: number) =>
    [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, c]) => ({ key: k, count: c }));

  const top = [...groups]
    .map((grp) => ({
      name: grp.name,
      altname: clean(grp.altname),
      description: clean((grp.description ?? '').slice(0, 140)),
      added: grp.added_date ?? '',
      victims30: victims30.get(grp.name) ?? 0,
      onionsUp: onionsOf(grp).filter((o) => o.available).length,
      onionsTotal: onionsOf(grp).length,
    }))
    .sort((a, b) => b.victims30 - a.victims30 || a.name.localeCompare(b.name))
    .slice(0, 12);

  let onionsUp = 0;
  let onionsTotal = 0;
  for (const grp of groups) {
    for (const o of onionsOf(grp)) {
      onionsTotal++;
      if (o.available) onionsUp++;
    }
  }

  return NextResponse.json({
    stats: {
      groups: groups.length,
      victimsTracked: victims?.length ?? 0,
      victims7d: vic7,
      onionsUp,
      onionsTotal,
    },
    topGroups: top,
    topSectors: rank(sectors, 8),
    topCountries: rank(countries, 8),
    ts: Date.now(),
    source: 'ransomware.live',
  });
}
