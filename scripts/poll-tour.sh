#!/bin/bash
# Poller du MODE AUTO : télémétrie + capture à chaque changement d'étape.
OUT=/home/z/my-project/download
LAST=""
START=$(date +%s.%N)
for i in $(seq 1 24); do
  S=$(agent-browser eval "(() => {
    const q = (s) => document.querySelector(s);
    const label = q('.at-chip-label')?.textContent ?? null;
    const zoom = (window.__osirisMapGetZoom ? window.__osirisMapGetZoom() : null);
    const overlay = Array.from(document.querySelectorAll('div.fixed')).some(d => d.className.includes && d.textContent && d.textContent.includes('FLIGHT TRACK'));
    const canvInOverlay = Array.from(document.querySelectorAll('div.fixed')).filter(d => d.textContent && d.textContent.includes('FLIGHT TRACK')).flatMap(d => Array.from(d.querySelectorAll('canvas'))).length;
    const marker = !!q('[style*=horus-tour-blink]');
    const bubble = !!q('iframe, video');
    const monument = !!q('.at-monument');
    const finale = !!q('.at-finale');
    const music = q('audio[data-horus-music]');
    return {label, zoom: Math.round((zoom||0)*10)/10, overlay, canvInOverlay, marker, bubble, monument, finale, vol: music ? music.volume : null, paused: music ? music.paused : null};
  })()" 2>/dev/null | tr -d '\n')
  NOW=$(date +%s.%N)
  EL=$(python3 -c "print(f'{$NOW-$START:.1f}')")
  echo "[$EL s] $S"
  L=$(echo "$S" | python3 -c "import sys,json,re; t=sys.stdin.read(); m=re.search(r'\{.*\}', t, re.S); d=json.loads(m.group(0)) if m else {}; print(d.get('label') or '')" 2>/dev/null)
  if [ -n "$L" ] && [ "$L" != "$LAST" ]; then
    SLUG=$(echo "$L" | sed "s/MODE AUTO · //" | tr ' ·' '__' | tr -cd '[:alnum:]_-' | cut -c1-28)
    agent-browser screenshot "$OUT/task23-tour-${SLUG}.png" >/dev/null 2>&1
    echo "  >>> capture $SLUG"
    LAST="$L"
  fi
  if [ -z "$L" ] && [ "$LAST" != "GONE" ] && [ -n "$LAST" ]; then
    echo "  >>> tour terminé (chip disparue)"
    LAST="GONE"
  fi
  sleep 3
done
python3 -c "print(f'DURÉE CHRONOMÈTRE: {$(date +%s.%N)-$START:.1f} s de polling')"
