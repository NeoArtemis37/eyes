#!/usr/bin/env python3
"""Analyse de la timeline musicale d'une passe du tour auto (task29-music-timeline.log)."""
import json
import re
import sys

LOG = '/home/z/my-project/scripts/task29-music-timeline.log'
lines = [l for l in open(LOG).read().strip().split('\n') if l.strip()]

total = len(lines)
playing = ducked = full = 0
positions = []

for l in lines:
    m = re.search(r'\{.*\}', l, re.S)
    if not m:
        continue
    try:
        d = json.loads(m.group(0))
    except Exception:
        continue
    if d.get('paused') is False:
        playing += 1
    vol = d.get('vol')
    if vol is not None:
        if vol <= 0.15:
            ducked += 1
        else:
            full += 1
    t = d.get('t')
    if t is not None:
        positions.append(t)

print(f"polls: {total}")
print(f"en lecture (paused=false): {playing}")
print(f"ducké <=0.15 (pendant frappes): {ducked}")
print(f"plein >0.15 (entre explications): {full}")
if positions:
    # la piste boucle (~162.7 s) : compter le temps réellement parcouru
    total_played = 0.0
    loops = 0
    prev = positions[0]
    for t in positions[1:]:
        if t < prev - 5:  # saut arrière net = rebouclage
            total_played += t  # reprise depuis le début de piste
            loops += 1
        else:
            total_played += t - prev
        prev = t
    print(f"position musique: {positions[0]:.1f}s -> {positions[-1]:.1f}s, "
          f"{loops} rebouclage(s), ~{total_played:.0f}s de piste parcourus en {len(positions)} polls")
