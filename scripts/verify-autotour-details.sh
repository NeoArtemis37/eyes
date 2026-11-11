#!/bin/bash
# Re-vérification ciblée du MODE AUTO : vol 3D, cams FOV, RECON résultat, finale
OUT=/home/z/my-project/download

poll_until () {
  # $1 = motif à attendre dans .at-chip-label, $2 = timeout (s)
  local motif="$1"; local tmo="$2"; local i=0
  while [ $i -lt $((tmo * 2)) ]; do
    local label=$(agent-browser eval "document.querySelector('.at-chip-label')?.textContent || 'FINI'" 2>/dev/null | tr -d '"')
    if echo "$label" | rg -q "$motif"; then return 0; fi
    if [ "$label" = "FINI" ]; then return 1; fi
    sleep 0.5; i=$((i+1))
  done
  return 1
}

# Lancer le mode auto
agent-browser eval "document.querySelector('.hp-tb-right button[title*=\"MODE AUTONOME\"]').click()" >/dev/null
echo "AUTO relancé"

# ── 1 · VOLS 3D ──
if poll_until "VOLS" 25; then
  sleep 3.2
  agent-browser eval "
  (() => { const cs=[...document.querySelectorAll('canvas')]; return JSON.stringify({
    nCanvases: cs.length,
    vue3d: [...document.querySelectorAll('span')].map(s=>s.textContent||'').find(t=>/^VUE 3D · /.test(t)) || null,
    glisser: document.body.innerText.includes('GLISSER POUR PIVOTER'),
    threeCanvas: cs.some(c => c.parentElement?.className?.includes && String(c.parentElement.className).includes('cursor-grab')),
  });})()
  "
  agent-browser screenshot $OUT/auto20-vol3d-check.png >/dev/null
  echo "[capturé vol 3D]"
else echo "!! segment VOLS manqué"; fi

# ── 2 · CAMÉRAS (FOV + bulle) ──
if poll_until "CAMÉRAS" 40; then
  sleep 6
  agent-browser eval "
  (() => JSON.stringify({
    fovLayers: (window).__osirisMapLayers ? __osirisMapLayers() : null,
    zoom: Math.round(__osirisMapGetZoom ? __osirisMapGetZoom() : -1),
    camCard: document.querySelector('.at-card-title')?.textContent || null,
  }))()
  "
  agent-browser screenshot $OUT/auto20-cams-fov-check.png >/dev/null
  echo "[capturé cams FOV]"
else echo "!! segment CAMÉRAS manqué"; fi

# ── 3 · RECON résultat géocodage ──
if poll_until "RECON" 90; then
  sleep 8
  agent-browser eval "
  (() => { const d=document.querySelector('[data-tour=\"net-recon\"]'); return JSON.stringify({
    dockOpen: !!d && d.className.includes('is-open'),
    downing: d ? (d.innerText||'').includes('Downing') : false,
    coords: d ? /51\.50/.test(d.innerText||'') : false,
    dockSnippet: d ? (d.innerText||'').slice(0, 400) : null,
  });})()
  "
  agent-browser screenshot $OUT/auto20-recon-result-check.png >/dev/null
  echo "[capturé RECON résultat]"
else echo "!! segment RECON manqué"; fi

# ── 4 · FINALE (après l'intertitre RETOUR) ──
if poll_until "PILOGUE" 40; then
  sleep 6.5
  agent-browser eval "
  (() => JSON.stringify({
    finaleVisible: !!document.querySelector('.at-finale'),
    kicker: document.querySelector('.at-finale-kicker')?.textContent || null,
    quote: document.querySelector('.at-finale-quote')?.textContent?.replace(/\s+/g,' ').slice(0,120) || null,
  }))()
  "
  agent-browser screenshot $OUT/auto20-finale-check.png >/dev/null
  echo "[capturé finale]"
else echo "!! segment ÉPILOGUE manqué"; fi

# attendre la fin naturelle
sleep 12
agent-browser eval "
(() => JSON.stringify({ over: !document.querySelector('.at-chip'), phase: !!document.querySelector('.hp-root') }))()
"