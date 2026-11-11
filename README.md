# HORUS — AES CERT console

Real-time, **defensive** open-source situational awareness: a local Next.js console
fusing public threat-intel feeds onto a 3D globe with a network-intel layer,
operation orchestration, voice command, and an honest feed-health pane.

Version 0.4.0 · see `worklog.md` for the full build history and `docs/` for the research baseline.

## Quickstart

```bash
bun install          # or: npm install
bun run db:generate  # prisma client
bun run dev          # http://localhost:3000  (API gateway: :3030 via mini-services/horus-stream)
```

Production: `bun run build && bun run start` (standalone server on :3000).

## What is inside

| Layer | Where | What it does |
|---|---|---|
| 3D globe (map view) | `components/command-center/OsirisMap.tsx` | maplibre globe, auto-rotation with camera guards (never fights user gestures), GPS locate with timeout + error banners, FOV cones for cams |
| Network panes | `src/network/` | attack globe, force graph, correlation view, threat feed, top talkers, dark-web panel, recon dock, IOC CSV export — and the new **SANTÉ RÉSEAU** health pane |
| Feed engine | `src/network/useThreatFeed.ts` + `adapters.ts` | 15 client adapters polling through cached server proxies; cross-source corroboration rescore (`x{n}-src`); per-source latency + staleness telemetry |
| Feed proxies | `src/app/api/network/feeds/[source]/route.ts` | allowlisted upstreams, TTL cache, polite UAs, abuse.ch auth-key hook, CIRCL MISP multi-file walk |
| OSINT routes | `src/app/api/osint/*`, `src/app/api/horus/*` | quakes, flights, vessels, cables, satellites, GDELT news, geofence, region dossier, AI chat… |
| Orchestration | `components/command-center/OpsOrchestra.tsx` | agent-style operation panels on the console |
| Voice | `src/hooks/useVoiceCommand.ts` | FR/EN command bar ("va à Bamako", "track 8.8.8.8"…) |
| Docs | `docs/` | **PRIOR_FINDINGS.md** (14 findings streams + 10 ranked theories), **LEGAL_AND_ETHICS.md** (boundaries) |

## Feed roster (network panes)

abuse.ch Feodo · ThreatFox · URLhaus · OpenPhish · Ransomware.live · DShield ·
SANS ISC · blocklist.de · Spamhaus DROP · FireHOL L1 · CINS Army · GreenSnow ·
Blackbook · **CIRCL MISP OSINT (new)** · **CISA KEV (new, kind `vuln`)**.

Health states per source: `ok` (green) / `stale` (amber, data older than 2
intervals) / `error` (red) with round-trip latency — visible both in the
FILTRES legend and the SANTÉ RÉSEAU panel (sparkline = events/min, last hour).

## Known constraints (by design, not bugs)

- **CISA KEV**: cisa.gov's CDN 403s some datacenter/hosting IPs. From a normal
  connection it works; here the source shows `error` honestly instead of faking data.
- **CIRCL MISP**: the feed manifest is tens of MB. First fetch can take up to
  ~80 s on slow links, then it is cached 24 h and a rotating cursor samples new
  events each refresh. Interval 2 h.
- **abuse.ch ThreatFox/URLhaus**: bulk endpoints need a free Auth-Key
  (`THREATFOX_API_KEY`); without it the legacy routes still serve the current
  API responses used here, but plan the migration.
- All polling respects upstream courtesy limits — see `docs/LEGAL_AND_ETHICS.md`.

## Boundaries

This console aggregates public data for defense. It does not scan, probe, or
access third-party systems, and must never be used to. Read `docs/LEGAL_AND_ETHICS.md`
before modifying the feed stack.
