#!/usr/bin/env python3
"""Wide probe: build a diverse curated HLS IP-cam list (verified 200 mpegurl)."""
import json, subprocess, random
from collections import Counter

d = json.load(open('/tmp/streams.geojson'))
feats = d.get('features', [])
UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

def entry(f):
    p = f.get('properties', {})
    geo = f.get('geometry', {}).get('coordinates') or [None, None]
    return {
        'name': (p.get('name') or p.get('title') or '?').strip(),
        'url': p.get('stream_url') or p.get('url') or '',
        'country': p.get('country') or p.get('country_code') or '',
        'lon': geo[0], 'lat': geo[1],
    }

hls = [entry(f) for f in feats if '.m3u8' in (f.get('properties', {}).get('stream_url') or f.get('properties', {}).get('url') or '')]

# African country codes OR within Africa bounds
af_codes = {'MA','SN','CI','GH','NG','CM','KE','TZ','ZA','EG','DZ','TN','ML','BF','GN','BJ','TG','GA','CD','ET','UG','RW','MU','MZ','AO','NA','ZW','ZM','MW','SD','LY','GM','GW','SL','LR','CV','SC','DJ','SO','SS','ER','CF','GQ','TD','NE','BI','KM'}
in_africa_bounds = lambda e: e['lat'] is not None and -37 < e['lat'] < 38 and -20 < e['lon'] < 52
af = [h for h in hls if h['country'] in af_codes or (h['country'] in ('', '??') and in_africa_bounds(h))]
print('Africa candidates:', len(af))

def probe(h, timeout=8):
    try:
        r = subprocess.run(['curl', '-s', '-m', str(timeout), '-A', UA, '-o', '/dev/null',
                            '-w', '%{http_code}|%{content_type}|%{size_download}', h['url']],
                           capture_output=True, text=True, timeout=timeout + 6)
        code, ct, size = (r.stdout.split('|') + ['', '', ''])[:3]
        ok = code == '200' and size not in ('', '0') and ('mpeg' in ct or 'm3u8' in ct or ct.strip() == '')
        return ok, f"{code}/{ct.strip()}/{size}B"
    except Exception as e:
        return False, str(e)[:40]

print('=== AFRICA probes ===')
for h in af:
    ok, info = probe(h)
    print(' ', 'OK ' if ok else 'KO ', h['country'], info, h['url'][:70])

# wide world sample: exclude known-blocked families (eseoul.go.kr, nakhoncity, ipcamlive s101)
random.seed(42)
blocked_hint = ('eseoul.go.kr', 'nakhoncity', 'margaharjaya', 'ipcamlive.com')
cand = [h for h in hls if not any(b in h['url'] for b in blocked_hint) and 'token=' not in h['url']]
sample = random.sample(cand, 55)
print('\n=== WORLD sample 55 ===')
good = []
for h in sample:
    ok, info = probe(h)
    if ok:
        good.append(h)
        print('OK  ', h['country'], '|', h['name'][:40], '|', info, '|', h['url'][:80])
json.dump(good, open('/tmp/good_hls_world.json', 'w'), indent=1)
print('\nWORLD GOOD:', len(good), '→ /tmp/good_hls_world.json')
print(Counter(g['country'] for g in good).most_common())
