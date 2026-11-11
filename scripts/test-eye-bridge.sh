#!/usr/bin/env bash
# Test bridge ŒIL SUR ZONE : scan spots statiques → clic réel → popup → bouton ŒIL.
set -u
cd /home/z/my-project

echo "== PAUSE du moteur (fige arcs + rotation) =="
agent-browser eval "
(() => { const b = [...document.querySelectorAll('.net-dock button')].find(x => x.textContent.includes('PAUSE')); if (b) { b.click(); return 'paused'; } return 'no pause btn'; })()" 2>&1 | tail -1
sleep 2

echo "== Scan v2 : points statiques compacts =="
CANDIDATES=$(agent-browser eval "$(cat scripts/scan-kind-spots.js)" 2>&1 | tail -1)
echo "scan brut: $CANDIDATES"
# extrait les clusters n entre 4 et 34, dans l'ordre
LIST=$(echo "$CANDIDATES" | python3 /home/z/my-project/scripts/parse-clusters.py 2>/dev/null)
echo "candidats: [$LIST]"

# offset canvas → page
OFFSET=$(agent-browser eval "
(() => { const r = document.querySelector('.net-map canvas').getBoundingClientRect(); return Math.round(r.left) + ' ' + Math.round(r.top); })()" 2>&1 | tail -1 | tr -d '"')
OFFX="${OFFSET%% *}"; OFFY="${OFFSET#* }"
echo "offset canvas: $OFFX,$OFFY"

OLDIFS="$IFS"
IFS=','
set -- $LIST
while [ $# -ge 2 ]; do
  X="$1"; Y="$2"; shift 2
  [ -z "$X" ] && continue
  PX=$((X + OFFX)); PY=$((Y + OFFY))
  echo "-- essai clic @ page $PX,$PY (canvas $X,$Y)"
  agent-browser mouse move "$PX" "$PY" >/dev/null 2>&1
  agent-browser mouse down >/dev/null 2>&1
  agent-browser mouse up >/dev/null 2>&1
  sleep 1.2
  POP=$(agent-browser eval "document.querySelector('.net-popup') ? 'OPEN' : 'no'" 2>&1 | tail -1)
  echo "   popup: $POP"
  if [ "$POP" = '"OPEN"' ] || [ "$POP" = "OPEN" ]; then
    agent-browser eval "JSON.stringify({title: document.querySelector('.net-popup .panel__title')?.textContent, eye: document.querySelector('.net-eye')?.textContent, detail: document.querySelector('.net-popup .feed-detail')?.textContent?.slice(0,140)})" 2>&1 | tail -1
    IFS="$OLDIFS"
    exit 0
  fi
done
IFS="$OLDIFS"
echo "ECHEC: aucun spot cliquable trouvé"
exit 1
