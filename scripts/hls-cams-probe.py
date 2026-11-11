#!/usr/bin/env python3
"""Probe HLS cameras from the Live-Environment-Streams geojson.
Goal: find streams reachable from THIS host (sandbox egress) → curated list."""
import json, subprocess, random, sys
from collections import Counter

d = json.load(open('/tmp/streams.geojson'))
feats = d.get('features', [])

def entry(f):
    p = f.get('properties', {})
    u = p.get('stream_url') or p.get('url') or ''
    geo = f.get('geometry', {}).get('coordinates') or [None, None]
    return {
        'name': (p.get('name') or p.get('title') or '?').strip(),
        'url': u,
        'country': p.get('country') or p.get('country_code') or '',
        'lon': geo[0], 'lat': geo[1],
    }

hls = [entry(f) for f in feats if '.m3u8' in (entry(f)['url'])]
print('total hls:', len(hls))
print('countries:', Counter(h['country'] for h in hls).most_common(15))
af = [h for h in hls if h['country'] in ('MA','SN','CI','GH','NG','CM','KE','TZ','ZA','EG','DZ','TN','ML','BF','GN','BJ','TG','GA','CD','ET','UG','RW','MU','MZ','AO','NA','ZW','ZM','MW','SD','LY','GM','GW','SL','LR','CV','SC','KM','DJ','SO','SS','ER','CF','GQ','TD','NE','BI','RW')]
print('AFRICA hls:', len(af))
for h in af: print('  AF |', h['country'], '|', h['name'][:50], '|', h['url'][:80])

UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

def probe(h):
    try:
        r = subprocess.run(['curl', '-s', '-m', '8', '-A', UA, '-o', '/dev/null',
                            '-w', '%{http_code}|%{content_type}|%{size_download}',
                            h['url']], capture_output=True, text=True, timeout=15)
        code, ct, size = (r.stdout.split('|') + ['', '', ''])[:3]
        ok = code == '200' and ('mpegurl' in ct or 'm3u8' in ct or ct == '' or 'audio' in ct)
        # some servers send application/octet-stream or audio/mpeg
        ok = code == '200' and size != '0'
        return ok, f"{code}/{ct.strip()}/{size}B"
    except Exception as e:
        return False, str(e)[:40]

# candidates: all Africa + random sample of 25 rest
random.seed(11)
rest = [h for h in hls if h not in af]
sample = af + random.sample(rest, min(25, len(rest)))
# prefer token-free urls first
sample = [h for h in sample if 'token=' not in h['url']] or sample
print('\n=== PROBE', len(sample), 'candidates ===')
good = []
for h in sample:
    ok, info = probe(h)
    if ok:
        good.append(h)
        print('OK  ', h['country'], '|', h['name'][:44], '|', info, '|', h['url'][:85])
    else:
        print('KO  ', h['country'], '|', info, '|', h['url'][:70])
json.dump(good, open('/tmp/good_hls.json', 'w'), indent=1)
print('\nGOOD:', len(good), '→ /tmp/good_hls.json')
