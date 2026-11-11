#!/bin/bash
# Diagnostic noir carte pendant tour : refs sémantiques fraîches + log des statuts de tuiles
D=/home/z/my-project/download

# 1) Journal fetch pour les tuiles
agent-browser eval "
window.__tileLog = [];
window.__origFetch = window.fetch;
window.fetch = function(...a) {
  const u = String(a[0]);
  const p = window.__origFetch.apply(this, a);
  if (u.includes('tile.openstreetmap') || u.includes('basemaps')) {
    p.then(r => window.__tileLog.push(r.status + ' ' + u.split('/').slice(-3).join('/'))).catch(() => window.__tileLog.push('ERR ' + u.slice(-40)));
  }
  return p;
};
'logger installed'
" 2>&1 | tail -1

# 2) Quitter un éventuel tour résiduel + repartir proprement
agent-browser press Escape 2>/dev/null
sleep 2
agent-browser eval "window.__tileLog = []; 'log reset'" >/dev/null 2>&1

# 3) Démarrer le tour via sélecteur sémantique (pas de ref périmée)
agent-browser find role button click --name "MODE AUTONOME" 2>&1 | tail -1
date +%s.%N > /tmp/tour-t0.txt
T0=$(cat /tmp/tour-t0.txt)
echo "T0=$T0"

sleep_until () {
  local off="$1"
  local now=$(date +%s.%N)
  local d=$(awk -v t0="$T0" -v off="$off" -v now="$now" 'BEGIN{d=t0+off-now; if(d>0) printf "%.3f", d; else print "0"}')
  sleep "$d"
}

probe () {
  local off="$1" tag="$2"
  sleep_until "$off"
  local res=$(agent-browser eval "
(() => {
  const cx = Math.round(innerWidth/2), cy = Math.round(innerHeight/2);
  const el = document.elementFromPoint(cx, cy);
  const top = el ? (el.tagName + '.' + (el.className && el.className.toString ? el.className.toString().slice(0,30) : '')) : 'none';
  const chip = document.querySelector('.at-chip-label');
  const log = window.__tileLog.slice(-6);
  const bad = window.__tileLog.filter(s => !s.startsWith('200')).length;
  return JSON.stringify({top, chip: chip ? chip.textContent : null, tiles: log, non200: bad, total: window.__tileLog.length});
})()
" 2>&1)
  echo "PROBE +${off}s [$tag] $res"
  agent-browser screenshot "$D/task24-p-$tag.png" >/dev/null 2>&1
}

probe 12  "vols"
probe 24  "cam2"
probe 33  "cam3"
probe 44  "agadez"
probe 52  "djenne"
probe 60  "bobo"
probe 70  "reseau"
