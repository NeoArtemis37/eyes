#!/usr/bin/env bash
# Probe candidate public IP-camera HLS / MJPEG endpoints from this host.
# Goal: find REAL camera video streams reachable WITHOUT auth/key, to add
# them as a curated CCTV_LIVE source for the video wall (cams mode).

probe() { # url label
  local url="$1" label="$2"
  out=$(curl -s -m 9 -A "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" \
        -o /tmp/probe_body -D /tmp/probe_hdr "$url" 2>/dev/null)
  code=$(head -1 /tmp/probe_hdr 2>/dev/null | awk '{print $2}')
  ct=$(grep -i '^content-type' /tmp/probe_hdr 2>/dev/null | head -1 | cut -d' ' -f2- | tr -d '\r')
  size=$(wc -c < /tmp/probe_body 2>/dev/null)
  if [ "$code" = "200" ] && [ -n "$ct" ]; then
    echo "OK  $label | $code | $ct | ${size}B | ${url:0:100}"
  else
    echo "KO  $label | code=${code:-none} | ${url:0:100}"
  fi
}

# ── NYCTMC API (NYC traffic cams) ─────────────────────────────────────
echo "== NYCTMC =="
curl -s -m 10 -A "Mozilla/5.0" "https://webcams.nyctmc.org/api/cameras" -o /tmp/nyctmc.json -w "nyctmc-api HTTP:%{http_code}\n" || true
python3 - <<'EOF' 2>/dev/null || echo "nyctmc parse: none"
import json
try:
    d = json.load(open('/tmp/nyctmc.json'))
    cams = d.get('cameras', d.get('data', []))
    print('nyctmc cams:', len(cams))
    if cams:
        c = cams[0]
        print('sample keys:', list(c.keys())[:12])
        print('sample video-ish:', {k: v for k, v in c.items() if 'video' in str(k).lower() or 'hls' in str(k).lower() or 'stream' in str(k).lower()})
except Exception as e:
    print('parse fail:', e)
EOF

# ── HLS candidates ────────────────────────────────────────────────────
echo "== HLS =="
probe "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8" "mux-test-stream"
probe "https://stream.litomerice.cz/cam1/index.m3u8" "litomerice-redirect"
curl -s -m 9 -o /tmp/lito.m3u8 -w "litomerice-follow HTTP:%{http_code} ct:%{content_type}\n" -L -A "Mozilla/5.0" "https://stream.litomerice.cz/cam1/index.m3u8" || true
for h in "https://www.hko.gov.hk" "https://www.trafficland.com" "https://511on.ca" "https://www.dot.ca.gov" "https://www.windy.com" "https://www.skylinewebcams.com" "https://images.wsdot.wa.gov/19100474101.jpg" "https://www.insecam.com"; do
  code=$(curl -s -m 8 -o /dev/null -w "%{http_code}" -A "Mozilla/5.0" "$h" 2>/dev/null)
  echo "EGRESS $h -> $code"
done

# ── Skyline webcams (extract m3u8 from a live page) ───────────────────
echo "== SKYLINE =="
for pg in "https://www.skylinewebcams.com/webcam/italia/lazio/roma/piazza-navona.html" \
          "https://www.skylinewebcams.com/skyline/webcams/..." ; do
  curl -s -m 10 -A "Mozilla/5.0" "$pg" -o /tmp/skyline.html 2>/dev/null
  ids=$(rg -o "https?://[^\"' ]+\.m3u8" /tmp/skyline.html 2>/dev/null | head -3)
  if [ -n "$ids" ]; then echo "SKYLINE m3u8 found: $ids"; else echo "no m3u8 on $pg"; fi
done

# ── MJPEG candidates ──────────────────────────────────────────────────
echo "== MJPEG =="
probe "http://cam1.asta.rwth-aachen.de/axis-cgi/mjpg/video.cgi" "rwth-aachen"
probe "http://webcam.weds.de/mjpg/video.mjpg" "weds"
echo done
