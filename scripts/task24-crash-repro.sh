#!/bin/bash
# Reproduire le crash maplibre pendant le tour avec stack complète
agent-browser console --clear >/dev/null 2>&1
agent-browser errors --clear >/dev/null 2>&1
agent-browser press Escape 2>/dev/null
sleep 3
agent-browser find role button click --name "MODE AUTONOME" 2>&1 | tail -1
date +%s.%N > /tmp/tour-t0.txt
T0=$(cat /tmp/tour-t0.txt)
echo "T0=$T0"

poll () {
  local off="$1"
  local now=$(date +%s.%N)
  local d=$(awk -v t0="$T0" -v off="$off" -v now="$now" 'BEGIN{d=t0+off-now; if(d>0) printf "%.3f", d; else print "0"}')
  sleep "$d"
  local res=$(agent-browser eval "
(() => {
  const chip = document.querySelector('.at-chip-label');
  const cam = document.querySelector('.hp-cambubble h3');
  const mono = document.querySelector('.at-card-title');
  return JSON.stringify({chip: chip?chip.textContent:null, bubble: cam?cam.textContent:null, card: mono?mono.textContent:null});
})()
" 2>&1)
  echo "+${off}s $res"
}

poll 4
poll 8
poll 12
poll 16
poll 20
poll 24
poll 28
poll 32
poll 36
poll 40
echo "=== ERREURS CONSOLE ==="
agent-browser console 2>&1 | rg -i "error|cannot|null" | head -10
agent-browser errors 2>&1 | head -6
