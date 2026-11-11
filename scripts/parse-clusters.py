#!/usr/bin/env python3
"""Parse la sortie scan agent-browser (JSON double-échappé) → liste x,y x,y."""
import json, sys

raw = sys.stdin.read().strip()
# agent-browser wrap la string de retour : "{\"px\":..}" → dé-échappe
raw = raw.strip('"')
raw = raw.replace('\\"', '"').replace('\\\\', '\\')
try:
    d = json.loads(raw)
    best = [c for c in d.get('best', []) if 4 <= c['n'] <= 60][:8]
    print(','.join(f"{c['x']},{c['y']}" for c in best))
except Exception as e:
    print('', file=sys.stderr)
    print('')
