#!/bin/bash
# Suit le MODE AUTO et capture chaque changement de segment
OUT=/home/z/my-project/download
last=""
for i in $(seq 1 200); do
  label=$(agent-browser eval "document.querySelector('.at-chip-label')?.textContent || 'FINI'" 2>/dev/null | tr -d '"')
  if [ "$label" != "$last" ]; then
    # nom de fichier sûr
    safe=$(echo "$label" | tr ' ·' '__' | tr -cd '[:alnum:]_-' | cut -c1-40)
    n=$(ls $OUT | rg -c "auto20-seg" || echo 0)
    agent-browser screenshot "$OUT/auto20-seg-$(printf '%02d' $((10#$n)))-$safe.png" >/dev/null 2>&1
    echo "[$i] SEGMENT: $label"
    last="$label"
  fi
  if [ "$label" = "FINI" ]; then
    echo "TOUR TERMINÉ (ou composant démonté)"
    break
  fi
  sleep 1.2
done
