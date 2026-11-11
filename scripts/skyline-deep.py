#!/usr/bin/env python3
"""Deep-dive: understand how a SkylineWebcams page maps slugs -> nkey (numeric id)."""
import re, sys

path = sys.argv[1] if len(sys.argv) > 1 else '/tmp/skyline-paris.html'
html = open(path, encoding='utf-8', errors='ignore').read()
print(f"size: {len(html)}")

# All hrefs
links = sorted(set(re.findall(r'href="(/en/webcam/[^"]+)"', html)))
print(f"--- {len(links)} unique /en/webcam/ links ---")
for l in links[:25]:
    print(' ', l)

# all cdn images with context
print("--- cdn image contexts ---")
for m in re.findall(r'.{110}cdn\.skylinewebcams\.com/live(\d+)\.jpg.{20}', html)[:6]:
    print(repr(m[-180:]))

# Look for iframe / player / video ids
for pat in ['iframe', 'player', 'live_id', 'cam_id', 'idcam', 'nkey']:
    hits = re.findall(pat, html, re.I)
    print(f"{pat}: {len(hits)}")

# meta og
for m in re.findall(r'<meta[^>]*(?:og:|description)[^>]*>', html)[:5]:
    print('META:', m)
# h1
for m in re.findall(r'<h1[^>]*>(.*?)</h1>', html, re.S)[:2]:
    print('H1:', m.strip()[:120])
