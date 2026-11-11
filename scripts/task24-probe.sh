#!/bin/bash
# Relance le tour et inspecte le DOM pendant la phase noire
D=/home/z/my-project/download
agent-browser press Escape 2>/dev/null
sleep 3
agent-browser click @e4
date +%s.%N > /tmp/tour-t0.txt
T0=$(cat /tmp/tour-t0.txt)
sleep_until () {
  local off="$1"
  local now=$(date +%s.%N)
  local d=$(awk -v t0="$T0" -v off="$off" -v now="$now" 'BEGIN{d=t0+off-now; if(d>0) printf "%.3f", d; else print "0"}')
  sleep "$d"
}

sleep_until 22
echo "=== PROBE cam2 ~+22s ==="
agent-browser eval "
(() => {
  const cx = Math.round(innerWidth/2), cy = Math.round(innerHeight/2);
  const stack = [];
  let el = document.elementFromPoint(cx, cy);
  for (let i=0; el && i<6; i++) { stack.push(el.tagName+'.'+(el.className&&el.className.toString?el.className.toString().slice(0,40):'')); el = (el.parentElement); }
  const map = document.querySelector('.maplibregl-canvas');
  const mr = map ? map.getBoundingClientRect() : null;
  const warps = document.querySelectorAll('.at-warp').length;
  const inter = document.querySelectorAll('.at-inter').length;
  const vis = document.body.className || '(no class)';
  const visOverlay = document.querySelectorAll('[style*=\"position: fixed\"]').length;
  return JSON.stringify({stack, mapRect: mr?{w:Math.round(mr.width),h:Math.round(mr.height)}:null, warps, inter, bodyClass: vis, fixedEls: visOverlay});
})()
" 2>&1
agent-browser screenshot "$D/task24-20-probe-noir.png"
sleep_until 30
echo "=== PROBE cam3 ~+30s ==="
agent-browser eval "
(() => {
  const cx = Math.round(innerWidth/2), cy = Math.round(innerHeight/2);
  const stack = [];
  let el = document.elementFromPoint(cx, cy);
  for (let i=0; el && i<6; i++) { stack.push(el.tagName+'.'+(el.className&&el.className.toString?el.className.toString().slice(0,40):'')); el = el.parentElement; }
  return JSON.stringify({stack});
})()
" 2>&1
