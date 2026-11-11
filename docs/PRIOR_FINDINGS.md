# PRIOR FINDINGS — HORUS research baseline

**Date:** 2026-11-11 · **Effort:** 6 parallel research probes, synthesized into 14 enumerated findings streams
**Scope:** defensive, open-source situational awareness aggregating PUBLIC data only.
**Method:** each probe verified sources by direct HTTP checks where the sandbox egress allowed; items verified only from official docs are flagged in the verification matrix (§7). Nothing in this report enables unauthorized access to systems or interception of communications.

---

## 1. Executive summary

1. The lawful ceiling for a civilian "world watcher" is high: unencrypted public broadcasts (ADS-B, AIS, weather satellites), government threat feeds (CISA KEV, USGS, SWPC, GDACS), curated IOC exchanges (MISP/CIRCL, abuse.ch, OpenPhish) and internet control-plane telemetry (RIPEstat, RIS, RouteViews, IODA) form a real-time, keyless or cheaply-keyed backbone that covers every domain requested — space, global events, cyber, networks, hunting.
2. The main engineering risk is not data scarcity but **politeness and rate-limit discipline**: GDELT (1 call / 5 s), CelesTrak (≤1 re-query / 2 h, HTTP 420), OpenSky (429 without OAuth2), abuse.ch (auth-key consolidation since 2025), ReliefWeb (v1 retired → v2 + approved appname), bgp.tools (descriptive User-Agent mandatory). HORUS already caches server-side; the new health pane makes violations visible.
3. Several "spy-grade" ambitions map 1:1 onto **receive-only radio** and **public control-plane data**: an aircraft/ship picture is literally ADS-B/AIS broadcast reception; a hijack tripwire is BGP stream analysis. Nothing requires touching third-party devices.
4. The two requested capabilities that are **not buildable lawfully** — auto-hacking cameras in a geolocated area, and tracking electromagnetic signals to surveil phone calls — are also technically degraded plays (mirai-style botnet behavior; modern cellular is encrypted A5/3 / 5G SUCI, TLS dominates transport). The lawful versions (own-estate attack-surface inventory, responsible disclosure, passive broadcast RF) are documented in §5.

## 2. Probe map — 14 findings streams across the 5 requested focus areas

| # | Findings stream | Focus area | Status |
|---|----------------|------------|--------|
| 1 | Satellite catalogs & TLE/GP access discipline | Spatial engineering | verified (docs + partial live) |
| 2 | Natural-event trackers (EONET, FIRMS) | Spatial engineering / global | EONET live-verified |
| 3 | Air & vessel broadcast picture (ADS-B/OpenSky, AIS) | Spatial engineering | OpenSky live (429 anonymous) |
| 4 | Space weather (SWPC alerts, Kp) | Spatial engineering | live-verified |
| 5 | Crisis imagery (Sentinel/Copernicus, Planet/Capella) | Spatial engineering | docs-verified |
| 6 | Media/event streams (GDELT, GDACS, ReliefWeb, USGS, ACLED) | Global world | GDELT/GDACS/USGS live; ReliefWeb v2 change caught |
| 7 | Exploited-vulnerability intel (CISA KEV) | Cyber espionage knowledge | schema verified; cisa.gov 403 from this datacenter IP |
| 8 | Malware/phishing IOC exchanges (abuse.ch, OpenPhish, MISP/CIRCL, STIX/TAXII) | Cyber / networks | OpenPhish + CIRCL live |
| 9 | Nation-state tradecraft for defense (ATT&CK STIX, CISA AA advisories, Sigma) | Cyber espionage knowledge | repo + licenses verified |
| 10 | Routing control plane (RIPEstat, RIS, RouteViews, ASrank, ITDK, RPKI) | Computational networks | live-verified keyless |
| 11 | Hijack & outage detection (ARTEMIS, IODA, Tor exits) | Computational networks | live-verified |
| 12 | Hunt stack (Sigma/pySigma, Velociraptor, osquery, Kestrel, OCSF, canarytokens, ART) | Threat hunting | licenses verified live |
| 13 | LLM-assisted triage research (failure modes, benchmarks) | Threat hunting | arXiv preprints verified |
| 14 | Legal boundaries & lawful alternatives (CFAA, CMA, Code pénal, ECPA, GDPR, CSS policy, webcam ToS, CVD) | Cross-cutting | statutes verified |

## 3. Domain findings

### 3.1 Spatial engineering / GEOINT

- **CelesTrak GP API** (`celestrak.org/NORAD/elements/gp.php`, params `GROUP`/`CATNR`, formats TLE/JSON/CSV/XML): data refreshed ~2× daily; courtesy rule — re-query the same data at most once per 2 h, else HTTP 420. Cache weekly catalogs locally; underlying GP © Space-Track.
- **NASA EONET v3** (`eonet.gsfc.nasa.gov/api/v3/events`): curated natural events, 13 categories verified live (wildfires, volcanoes, severeStorms, floods, seaLakeIce, drought, dustHaze, snow, earthquakes, landslides, manmade, tempExtremes, waterColor); JSON + GeoJSON; no key.
- **OpenSky Network** (`opensky-network.org/api/states/all`): global ADS-B/MLAT state vectors ~10 s resolution; anonymous = 400 credits/day (live probe returned 429), OAuth2 client-credentials ≈ 4 000/day; bbox via `lamin/lomin/lamax/lomax`; non-commercial free.
- **NOAA SWPC** (`services.swpc.noaa.gov/products/alerts.json`, `noaa-planetary-k-index.json`): space-weather alerts as issued; Kp 3-hourly with `a_running`, `station_count`; public domain. Live-verified.
- **Copernicus Sentinel-2** (dataspace.copernicus.eu / Sentinel Hub): 10 m optical, ≤5-day global revisit, free & open with attribution — the backbone layer for any crisis map; Sentinel-1 SAR all-weather.
- **ADS-B 1090 MHz**: Mode S Extended Squitter per ICAO Annex 10 / DO-260B — a one-way **unencrypted broadcast designed for public reception**; receiving is lawful (FCC Part 15). Unfiltered aggregators exist (ADS-B Exchange, airplanes.live, adsb.lol) — respect each ToS.
- **Planet / Capella SAR**: PlanetScope daily scan; SkySat/Capella X-band tasking for crisis windows; commercial, quote-based; Education & Research program + 30-day trial.

### 3.2 Global world monitoring

- **GDELT 2.0 DOC API** (`api.gdeltproject.org/api/v2/doc/doc`): artlist JSON verified keyless (`maxrecords=250` OK); rolling 3-month window; **limit 1 call / 5 s** (429 otherwise); `sort=datedesc`; 15-min ingestion.
- **GDACS** (`gdacs.org/xml/rss.xml` + gdacsapi): Green/Orange/Red alert levels in RSS + `gdacs:` namespace; public domain (EC JRC/UN).
- **ReliefWeb**: **API v1 is decommissioned (HTTP 410 observed) — use v2**; requires a registered (free-approved) `appname`; unapproved → 403. Caught and corrected by the probe.
- **USGS** (`earthquake.usgs.gov/earthquakes/feed/v1.0/summary/*.geojson`): all summary feeds update **every minute** (60 s cache verified); magnitude/place/alert/tsunami fields; public domain.
- **NASA FIRMS** (`firms.modaps.eosdis.nasa.gov/api/area/`): MODIS/VIIRS active fires ~3 h latency (US/Canada hourly); free MAP_KEY via NASA Earthdata.
- **ACLED** (`api.acleddata.com/acled/read`): curated conflict events, weekly; registration + API key; free non-commercial, attribution, no redistribution.
- **Methods**: Kleinberg burst detection (KDD 2002) is the classic for event streams; Adams & MacKay Bayesian Online Changepoint Detection (arXiv:0710.3742) for per-region rate baselines; seasonal correction for news-cycle diurnality.

### 3.3 Cyber espionage knowledge — defensive lens

- **CISA KEV** (`cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json`): daily, versioned (`catalogVersion`/`dateReleased`); schema: `vulnerabilities[]{cveID, vendorProject, product, vulnerabilityName, dateAdded, shortDescription, requiredAction, dueDate, knownRansomwareCampaignUse, notes, cwes}`. cisa.gov 403s some datacenter egress IPs (Akamai) — browsers work; HORUS sends a browser UA and treats a 403 as an honest degraded state.
- **abuse.ch consolidation (2025)**: URLhaus legacy bulk downloads return **410 Gone**; all abuse.ch datasets (URLhaus, ThreatFox, Feodo) now behind one free Auth-Key from auth.abuse.ch; ThreatFox IOC exports expire after 6 months.
- **OpenPhish community**: now literally a GitHub-hosted plain-text feed (`raw.githubusercontent.com/openphish/public_feed/main/feed.txt`); free with attribution/non-commercial terms.
- **MISP default OSINT feeds**: 88 curated feeds in `MISP/MISP` `files/feed-metadata/defaults.json`, incl. CIRCL OSINT (`circl.lu/doc/misp/feed-osint/`); standard MISP feed layout = `.manifest` JSON whose keys are the sha256 of each `<sha256>.json` event file. STIX 2.1 / TAXII 2.1 are OASIS open standards.
- **MITRE ATT&CK STIX**: successor repo `github.com/mitre-attack/attack-stix-data` (STIX 2.1, `index.json`, per-domain folders; releases ≈2×/yr). Intrusion sets = APT28, APT29, Lazarus, etc.
- **Advisory pattern**: `cisa.gov/news-events/cybersecurity-advisories/AA20-352A` (SolarWinds/APT29), `AA22-320A` (VMware) — each carries YARA/Snort/Sigma detection guidance produced *for defenders* from publicly documented espionage campaigns.
- **Boundary**: analyzing public reporting to build detections is lawful; replicating the collection against non-consenting targets is not.

### 3.4 Computational networks / internet measurement

- **RIPEstat Data API** (`stat.ripe.net/data/<endpoint>/data.json`): `bgp-update-activity`, `network-info`, `ris-peers`, `routing-history`, RPKI history/validation, visibility — all keyless; limits ≤8 concurrent/IP; >1 000 req/day → register `sourceapp`. Live-verified.
- **Raw BGP**: RIPE RIS MRT dumps (`data.ris.ripe.net/rrc00/`, 15-min updates, 2-h RIBs) and RouteViews archives — both HTTP 200, no auth, MRT format.
- **CAIDA ASrank** (`api.asrank.caida.org/v2/restful/asns`): ~123k ASNs with customer cones (rank 1 = AS3356 LEVEL3, cone 52 579); ITDK for router/AS topology; attribution required.
- **bgp.tools**: rejects default user-agents — a descriptive UA with contact e-mail is mandatory; no scraping.
- **ARTEMIS** (`github.com/FORTH-ICS-INSPIRE/artemis`): MIT-licensed real-time BGP hijack detector consuming RIS/RouteViews streams with config-driven detection + attribution.
- **RPKI**: rpkiviews.org is the live archive (NIST RPKI monitor endpoint 404 — retired).
- **IODA** (`ioda.inetintel.cc.gatech.edu`, JSON API `/api/v2/`): outage timelines fusing BGP/telescope/active-probe signals.
- **Tor bulk exit list** (`check.torproject.org/torbulkexitlist`): plain text, ~1 253 exits at probe time.
- **Boundary**: control-plane/public-dataset analysis is lawful; active scanning of systems you do not own is not.

### 3.5 Threat hunting state of the art

- **Detection-as-code**: SigmaHQ/sigma (3 700+ ATT&CK-tagged YAML rules, Detection Rule License 1.1) + pySigma (rule→dialect conversion: Splunk/Elastic/KQL, LGPL-2.1); YARA-X (Rust rewrite); KQL for Sentinel/Defender/ADX.
- **Endpoint hunting**: Velociraptor (VQL, AGPL-3.0, free Community Edition) + osquery (SQL fleet queries, Apache-2.0/GPLv2).
- **Kestrel** (Open Cyber Security Alliance, Apache-2.0): entity-centric composable hunt language, portable across backends.
- **Deception**: canarytokens.org — free, unauthenticated, low-noise tripwires; strictly on **owned** infrastructure.
- **OCSF** (`schema.ocsf.io`, Apache-2.0): leading telemetry-normalization schema; AWS Security Lake stores OCSF Parquet.
- **Purple teaming**: Atomic Red Team (ATT&CK-mapped atomic tests, MIT) + DeTT&CT link emulation to detection coverage; ATT&CK Navigator layers (JSON) support hypothesis-driven coverage mapping.
- **LLM triage research 2024-2026** (arXiv 2610.10608, 2603.06422, HIDBench 2605.21773): documented failure modes — evidence-chain contamination, investigation dead-ends — and emerging benchmarks; human-in-the-loop remains standard; vendor copilots publish measured triage gains.

### 3.6 Passive RF, cameras, and the legal map

- **Unauthorized access**: US CFAA 18 U.S.C. §1030 — 1 yr (misdemeanor) scaling to 5/10/20 yrs with damage/repeat; UK CMA 1990 s.1 & s.3ZA — ≤2 yrs basic, **life** for acts endangering life/national security; France Code pénal art. 323-1 seq. — 3 yrs + €45 000, organized gang 5 yrs + €150 000. "Casual scanning" of devices you don't own is already an offence.
- **Interception**: US Wiretap Act §2511 — felony ≤5 yrs absent consent/exemption; ECPA §2701 for stored comms; UK IPA 2016 s.3 unlawful-interception offence ≤2 yrs; ePrivacy Directive 2002/58/EC art. 5 confidentiality. A phone-call surveillance capability ("track EM signals to survey calls") is exactly the interception offence — and civilian cell-site simulators/IMSI catchers are unlawful (DOJ 2015 policy reserves them to warranted law-enforcement; FCC equipment rules; France CNCTR-supervised).
- **The lawful RF anchor**: ECPA §2511(2)(g)(i) **explicitly exempts unencrypted radio transmissions** — ADS-B 1090, AIS 161.975/162.025, NOAA APT 137 MHz, radiosondes 400-406 MHz are all unencrypted public broadcasts; reception is legal in US/EU; decrypting scrambled signals or retransmission is not.
- **GDPR**: location data = personal data (recital 35); tracking individuals needs a lawful basis (consent or documented LIA) + DPIA. Passive broadcast reception is categorically different from active RF location-finding.
- **Cameras**: aggregating **official embed players** (SkylineWebcams / Windy webcam widgets, YouTube live, DOT open-data feeds) with a per-source license register is the compliant model; re-streaming violates their ToS. Shodan/ZoomEye ToS confine use to lawful, authorized assessment (Shodan Monitor gates verified assets).
- **Third-party device findings**: route via coordinated vulnerability disclosure — ISO/IEC 30111 (process) + 29147 (advisories), HackerOne / CERT-CC VINCE. Never probe without written authorization.

## 4. Theories — "unseen but lawful" capabilities, ranked

| # | Theory | Why it is ahead of common practice | First implementation step |
|---|--------|-------------------------------------|---------------------------|
| T1 | **KEV × ATT&CK crosswalk** — join KEV entries to techniques used by documented intrusion sets (attack-stix-data) | Prioritizes patching by espionage tradecraft exposure, not CVSS alone | Cron: KEV JSON + STIX bundle diff → weekly crosswalk table |
| T2 | **Multi-source corroboration scoring** — severity boost when ≥2 independent feeds flag the same IP | Already live in HORUS (`x{n}-src` rescore, +8/severity per extra source, cap +24) | Extend to host-level (domain↔IP pivots) |
| T3 | **Burst layer** — EWMA baselines + Kleinberg/BOCPD changepoints on per-region × per-kind event rates | Turns the feed from a list into an anomaly detector with seasonal correction | Client-side bucketing exists (NetHealth sparkline) → move to server job |
| T4 | **Outage-vs-hijack attribution** — fuse IODA timelines + RIPEstat visibility + RPKI validity | Most monitors show *that*; attribution of outage vs hijack vs RPKI-blackhole is rare | RIPEstat `routing-history` + rpkiviews snapshot diff |
| T5 | **Overflight scheduling over crises** — CelesTrak TLE propagation × EONET active events → imaging windows | Proactive "when will the next image pass" is uncommon outside GIBS power users | SGP4 propagation of S2 orbits over EONET bboxes |
| T6 | **Spectrum SA via receive-only broadcast RF** — ADS-B/AIS/APT/radiosonde layers (RTL-SDR or aggregators) | The lawful version of "EM tracking": full air/maritime/weather picture without touching anyone | HORUS already has flights/vessels routes → add AIS/APT aggregator adapters |
| T7 | **Hunt-as-code CI** — pySigma pipelines + benign/malicious fixtures per rule + auto-generated Navigator layers | Detection regressions caught in CI, not in production | Sigma repo + GitHub Actions matrix |
| T8 | **OCSF normalization hub** — map every public feed to OCSF for cross-source correlation | Single schema across KEV/MISP/blocklists unlocks graph correlation | OCSF schema binding for `ThreatEvent` |
| T9 | **Grounded triage copilot** — RAG over ATT&CK/OCSF docs with mandatory citations, evaluated on replayed public alert sets | Addresses the documented LLM failure modes (evidence-chain contamination) | Replay corpus + citation-forced prompting |
| T10 | **Routing digital twin** — ASrank graph + RPKI coverage + Tor exit context per monitored AS | Ecosystem health context around any alert, not just the alert | Nightly ASrank + rpkiviews ingest |

## 5. What we will not build — and the lawful versions

**Not buildable by us (and why):**
1. *Crawlers that auto-hack cameras in a geolocated area* — unauthorized access to devices you don't own (CFAA / CMA / Code pénal 323-1, §2 above); at scale it is literally the Mirai botnet model, whose authors served sentences and paid fines. It also endangers critical infrastructure (cameras guard hospitals, schools).
2. *EM tracking to survey phone calls / private video* — the interception offence itself (Wiretap Act §2511, IPA 2016 s.3, ePrivacy art. 5). Technically also degraded: cellular links are encrypted (A5/3, 5G SUCI), transport is TLS-dominant, and the gear that does this (IMSI catchers) is warrant-gated state equipment — civilian possession/use is unlawful.

**Lawful versions that satisfy the same ambition:**
- **Own-estate exposure management**: Shodan Monitor / ZoomEye over domains you own or have written authorization to test → exposure inventory + alerting.
- **Responsible disclosure**: found an exposed camera? CVD per ISO 30111/29147 → CERT-CC VINCE / vendor program. That is the "hacker" move with a future.
- **Spectrum SA without interception**: receive-only layers for ADS-B/AIS/APT/radiosondes (T6) — everything broadcast is everyone's to hear.
- **Public-camera aggregation with a license register** (official embeds only).

## 6. The most unexpected legitimate use

Point the console at your **own city** and watch a ransomware campaign *assemble in public view*: Ransomware.live posts a victim → ThreatFox/Feodo show that group's current C2 pool → DShield/ISC show your country's scanning pressure rising → KEV flags the exploited CVE in the victim's sector → OpenPhish lights up the lure domains. Each feed alone is a list; fused (T2 + T3), it is a live campaign timeline that normally only closed circles see assembled — built entirely from public data. The same fusion inverted is a disaster-response triage map (GDACS + Sentinel-2 overflight windows + ReliefWeb) for humanitarian use.

## 7. Sandbox verification matrix

| Live-verified from sandbox | Docs-verified only (egress blocked / rate-limited) |
|---|---|
| EONET v3, SWPC alerts+Kp, USGS feeds, GDELT artlist (+429), GDACS RSS, OpenSky (429 anon), RIPEstat, RIS/RouteViews dirs, CAIDA ASrank, rpkiviews, IODA, Tor bulk list, OpenPhish GitHub feed, CIRCL feed dir (+404 naming test), MITRE repos, Sigma/pySigma/YARA-X/Velociraptor/osquery/Kestrel/OCSF/ART licenses, arXiv preprints, law.cornell.edu, legislation.gov.uk | cisa.gov KEV (Akamai 403 on datacenter IP — works from browsers), FIRMS, ACLED, CelesTrak (HTTP 000), Copernicus, Planet/Capella pricing, bgp.tools UI, webcam ToS pages (JS-rendered), Legifrance art. 323-1 (standard current text) |

## 8. Source index

CelesTrak `celestrak.org/NORAD/elements/gp.php` · EONET `eonet.gsfc.nasa.gov/api/v3/events` · OpenSky `opensky-network.org/api/states/all` · SWPC `services.swpc.noaa.gov/products/alerts.json` · Copernicus `dataspace.copernicus.eu` · GDELT `api.gdeltproject.org/api/v2/doc/doc` · GDACS `gdacs.org/xml/rss.xml` · ReliefWeb `api.reliefweb.int/v2/disasters` · USGS `earthquake.usgs.gov/earthquakes/feed/v1.0/summary/` · FIRMS `firms.modaps.eosdis.nasa.gov/api/area/` · ACLED `acleddata.com` · CISA KEV `cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json` · abuse.ch `urlhaus.abuse.ch/api/` · ThreatFox `threatfox.abuse.ch/export/` · OpenPhish `openphish.com/feed.txt` · MISP defaults `github.com/MISP/MISP` `files/feed-metadata/defaults.json` · CIRCL OSINT `circl.lu/doc/misp/feed-osint/` · STIX 2.1 `docs.oasis-open.org/cti/stix/v2.1/os/` · TAXII 2.1 `docs.oasis-open.org/cti/taxii/v2.1/os/` · ATT&CK STIX `github.com/mitre-attack/attack-stix-data` · Sigma `github.com/SigmaHQ/sigma` · pySigma `github.com/SigmaHQ/pySigma` · YARA-X `github.com/VirusTotal/yara-x` · Velociraptor `docs.velociraptor.app` · osquery `github.com/osquery/osquery` · Kestrel `kestrel.readthedocs.io` · Canarytokens `canarytokens.org` · OCSF `schema.ocsf.io` · Atomic Red Team `github.com/redcanaryco/atomic-red-team` · RIPEstat `stat.ripe.net/docs/02.data-api` · RIS `data.ris.ripe.net/rrc00/` · RouteViews `archive.routeviews.org` · ASrank `api.asrank.caida.org/v2/restful/asns` · ITDK `caida.org/catalog/internet-implementations/itdk/` · bgp.tools `bgp.tools` · ARTEMIS `github.com/FORTH-ICS-INSPIRE/artemis` · rpkiviews `rpkiviews.org` · IODA `ioda.inetintel.cc.gatech.edu` · Tor exits `check.torproject.org/torbulkexitlist` · CFAA `law.cornell.edu/uscode/text/18/1030` · CMA `legislation.gov.uk/ukpga/1990/18` · Wiretap Act `law.cornell.edu/uscode/text/18/2511` · IPA 2016 s.3 `legislation.gov.uk/ukpga/2016/25/section/3` · DOJ CSS policy `justice.gov/opa/file/838446` · Shodan ToS `shodan.io/tos` · CVD `iso.org` 30111/29147 · Kleinberg KDD 2002 · Adams & MacKay arXiv:0710.3742 · LLM triage arXiv 2610.10608 / 2603.06422 / 2605.21773
