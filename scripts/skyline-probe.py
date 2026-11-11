#!/usr/bin/env python3
"""Probe SkylineWebcams listing HTML structure: extract slug/title/country/nkey."""
import re, sys, json

path = sys.argv[1] if len(sys.argv) > 1 else '/tmp/skyline-top.html'
html = open(path, encoding='utf-8', errors='ignore').read()
print(f"size: {len(html)}")

for pat in ['nkey', '/en/webcam/', 'data-', 'latitude', 'category']:
    print(f"{pat}: {len(re.findall(pat, html, re.I))} hits")

print('---samples webcam links---')
for m in re.findall(r'href="(/en/webcam/[^"]+)"', html)[:8]:
    print(m)

print('---nkey context---')
for m in re.findall(r'.{70}[nN]key.{90}', html)[:4]:
    print(repr(m))

print('---image urls---')
for m in re.findall(r'(cdn\.skylinewebcams\.com[^"\'\s)]+)', html)[:6]:
    print(m)

print('---title attrs---')
for m in re.findall(r'title="([^"]{10,60})"', html)[:6]:
    print(m)

# look for JSON island
print('---script json islands---')
for m in re.findall(r'<script[^>]*>(.*?)</script>', html, re.S):
    if any(k in m for k in ['nkey', 'webcam', 'latitude']):
        print('FOUND island with relevant keys, len', len(m))
        print(m[:600])
        break
