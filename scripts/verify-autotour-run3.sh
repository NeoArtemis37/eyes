#!/bin/bash
# Vérification vol 3D (timing corrigé) + RECON géocodage (param q corrigé)
OUT=/home/z/my-project/download

poll_until () {
  local motif="$1"; local tmo="$2"; local i=0
  while [ $i -lt $((tmo * 2)) ]; do
    local label=$(agent-browser eval "document.querySelector('.at-chip-label')?.textContent || 'FINI'" 2>/dev/null | tr -d '"')
    if echo "$label" | rg -q "$motif"; then return 0; fi
    if [ "$label" = "FINI" ]; then return 1; fi
    sleep 0.5; i=$((i+1))
  done
  return 1
}

agent-browser eval "document.querySelector('.hp-tb-right button[title*=\"MODE AUTONOME\"]').click()" >/dev/null
echo "AUTO relancé (run 3)"

# ── 1 · VOLS 3D · overlay s'ouvre à +3.9s → check à +6.5s ──
if poll_until "VOLS" 25; then
  sleep 6.5
  agent-browser eval "
  (() => { const cs=[...document.querySelectorAll('canvas')]; return JSON.stringify({
    nCanvases: cs.length,
    vue3d: [...document.querySelectorAll('span')].map(s=>s.textContent||'').find(t=>/^VUE 3D · /.test(t)) || null,
    glisser: document.body.innerText.includes('GLISSER POUR PIVOTER'),
    overlay: !!document.querySelector('.bg-\\\\[\\\\#06060C\\\\]\\\\/95'),
  });})()
  "
  agent-browser screenshot $OUT/auto20-vol3d-check2.png >/dev/null
  echo "[vol 3D capturé]"
fi

# ── 2 · RECON résultat (param corrigé) ──
if poll_until "RECON" 120; then
  sleep 8
  agent-browser eval "
  (() => { const d=document.querySelector('[data-tour=\"net-recon\"]'); const t=d?(d.innerText||''):''; return JSON.stringify({
    dockOpen: !!d && d.className.includes('is-open'),
    downing: t.includes('Downing'),
    coords: /51\\.50/.test(t),
    snippet: t.slice(t.indexOf('RUN'), t.indexOf('RUN')+320),
  });})()
  "
  agent-browser screenshot $OUT/auto20-recon-result2.png >/dev/null
  echo "[RECON capturé]"
fi

sleep 8
# quitter proprement si encore en course (finale déjà vue au run 2)
agent-browser eval "document.querySelector('.at-quit')?.click() || 'déjà fini'"
sleep 1.5
agent-browser eval "JSON.stringify({ over: !document.querySelector('.at-chip'), carte: !!document.querySelector('.hp-root'), rotating: __osirisMapRotating ? __osirisMapRotating() : 'n/a' })"