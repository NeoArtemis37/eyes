# LEGAL & ETHICS — operating boundaries of this console

This console (HORUS / AES CERT) aggregates **public data from official and community feeds**
for defensive situational awareness. This file states the boundaries that keep that lawful.

## What this software does

- Fetches public threat-intel feeds (blocklists, IOC exchanges, government advisories)
  through server-side, cached, rate-limited proxies with an identifying User-Agent.
- Renders the aggregated picture on a local dashboard (globe, graphs, panels).
- Observes **your own** browser session for the health pane (fetch latency, staleness).
- Geolocates only **with your consent** (the GPS button uses the browser
  Geolocation API; nothing is transmitted to third parties by this feature).
- Shows public webcam/video embeds through **official players only**, and
  broadcast-based air/maritime layers from public aggregators under their terms.

## What this software must never be used for

1. **Unauthorized access to any system, account, or device** — including cameras,
   IoT, or "open" devices that are merely misconfigured. In the US this is the
   Computer Fraud and Abuse Act (18 U.S.C. §1030, up to 20 yrs with damage/repeat);
   in the UK the Computer Misuse Act 1990 (s.1; s.3ZA: up to life for acts
   endangering life or national security); in France Code pénal art. 323-1 seq.
   (3 yrs + €45 000; organized: 5 yrs + €150 000).
2. **Interception of communications** — listening to calls, capturing private
   video, or operating cell-site simulators / IMSI catchers. US Wiretap Act
   (18 U.S.C. §2511, ≤5 yrs) + ECPA; UK IPA 2016 s.3; EU ePrivacy art. 5.
   Such equipment is reserved to warranted state authorities (DOJ 2015 CSS policy;
   France CNCTR supervision); civilian use is unlawful.
3. **Tracking or geolocating non-consenting individuals** — location data is
   personal data under GDPR (recital 35); processing requires a lawful basis.
4. **Active scanning or probing of third-party infrastructure** without written
   authorization. Passive consumption of published datasets/APIs under their
   terms is the compliant path.

## The lawful anchor for radio

Unencrypted broadcasts are explicitly exempted from the US Wiretap Act
(§2511(2)(g)(i)) and are not confidential communications under ePrivacy:
ADS-B (1090 MHz), AIS (161.975/162.025 MHz), NOAA APT (137 MHz) and radiosondes
(400-406 MHz) may be passively received in the US/EU. Decoding scrambled
signals or retransmitting protected streams is not permitted.

## If you find something exposed

An exposed camera or device is someone's incident, not your access. Use
coordinated vulnerability disclosure: ISO/IEC 30111 (process) / 29147
(advisories), a CERT (CERT-CC VINCE), or the vendor's program (HackerOne etc.).
Own-estate exposure monitoring is legitimately done with tools like Shodan
Monitor — over assets you own or are authorized to assess.

## Feed fairness

Each upstream feed has its own terms (see `docs/PRIOR_FINDINGS.md` §3). The
server-side cache and polling intervals in this repo are set to stay within
the documented courtesy limits (e.g., GDELT ≥5 s between calls, CelesTrak
≤1 re-query/2 h, OpenSky anonymous credit budget). Do not remove those
throttles. abuse.ch datasets now require a free Auth-Key
(`THREATFOX_API_KEY` env var); CISA KEV may block some datacenter IPs.

## Contact

Run this console only where you are allowed to run it, feed it only public
data, and act on what it shows only within your jurisdiction's law.
