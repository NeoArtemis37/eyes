#!/usr/bin/env python3
"""Final check: all curated HLS cams relay through our /api/osint/hls-proxy."""
import json, urllib.parse, subprocess

curated = json.load(open('/tmp/curated_hls.json'))
PROXY = 'http://localhost:3000/api/osint/hls-proxy?url='
ok, ko = 0, 0
for c in curated:
    u = PROXY + urllib.parse.quote(c['url'], safe='')
    try:
        r = subprocess.run(['curl', '-s', '-m', '10', '-o', '/tmp/pp.m3u8', '-w', '%{http_code}|%{content_type}|%{size_download}', u],
                           capture_output=True, text=True, timeout=16)
        code, ct, size = (r.stdout.split('|') + ['', '', ''])[:3]
        body = open('/tmp/pp.m3u8').read(200)
        is_m3u8 = body.startswith('#EXTM3U')
        child = next((l for l in body.splitlines() if l and not l.startswith('#')), '')
        segs = 0
        if is_m3u8 and child:
            r2 = subprocess.run(['curl', '-s', '-m', '10', 'http://localhost:3000' + child if child.startswith('/') else child],
                                capture_output=True, text=True, timeout=16)
            segs = r2.stdout.count('.ts') + r2.stdout.count('.m4s')
        if code == '200' and is_m3u8:
            ok += 1
            print(f"OK  {c['cc']} {c['name'][:32]:34} {code}/{ct.strip()}/{size}B segs~{segs}")
        else:
            ko += 1
            print(f"KO  {c['cc']} {c['name'][:32]:34} {code}/{ct.strip()}/{size}B m3u8={is_m3u8}")
    except Exception as e:
        ko += 1
        print(f"ERR {c['cc']} {c['name'][:32]:34} {str(e)[:50]}")
print(f"\nRESULT: {ok} OK / {ko} KO on {len(curated)}")
