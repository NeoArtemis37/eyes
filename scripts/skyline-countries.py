#!/usr/bin/env python3
"""Extract country slugs from SkylineWebcams pages (listing pages show country links)."""
import re, sys

seen = {}
for path in sys.argv[1:]:
    html = open(path, encoding='utf-8', errors='ignore').read()
    # country links look like: href=".../en/webcam/{slug}.html" with an anchor text label
    for m in re.finditer(r'<a[^>]+href="[^"]*/en/webcam/([a-z0-9-]+)\.html"[^>]*>(?:\s*<[^>]+>)*\s*([^<]{2,40})', html):
        slug, label = m.group(1), m.group(2).strip()
        if slug not in seen and label and not label.startswith('http'):
            seen[slug] = label

print(f"// {len(seen)} pays")
for slug, label in sorted(seen.items(), key=lambda x: x[1]):
    print(f"  '{slug}': {{ name: '{label}' }},")
