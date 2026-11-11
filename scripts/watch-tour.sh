#!/bin/bash
# Watcher réactif : capture RÉSEAU (popup) et RECON (résultat) dès leur apparition.
OUT=/home/z/my-project/download
GOT_NET=0
GOT_RECON=0
GOT_CAMS=0
for i in $(seq 1 70); do
  L=$(agent-browser eval "document.querySelector('.at-chip-label')?.textContent ?? 'FINI'" 2>/dev/null | tr -d '\n"')
  case "$L" in
    *RÉSEAU*) if [ $GOT_NET -eq 0 ]; then sleep 4; agent-browser screenshot "$OUT/task23-reseau-popup.png" >/dev/null; GOT_NET=1; echo "capturé RÉSEAU+popup"; fi;;
    *RECON*) if [ $GOT_RECON -eq 0 ]; then sleep 3.5; agent-browser screenshot "$OUT/task23-recon-adresse.png" >/dev/null; GOT_RECON=1; echo "capturé RECON+resultat"; fi;;
    *CAMÉRAS*) if [ $GOT_CAMS -eq 0 ]; then sleep 9; agent-browser screenshot "$OUT/task23-cams-bulle-hls.png" >/dev/null; GOT_CAMS=1; echo "capturé CAMÉRAS+bulle"; fi;;
    *FINI*|*"FIN"*) if [ $GOT_NET -eq 1 ] && [ $GOT_RECON -eq 1 ] && [ $GOT_CAMS -eq 1 ]; then echo "tout capturé"; break; fi;;
  esac
  if [ -z "$L" ]; then echo "tour fini (chip absente)"; break; fi
  sleep 1
done
echo "état final: $(agent-browser eval "({chip: !!document.querySelector('.at-chip'), zoom: Math.round(window.__osirisMapGetZoom?.() ?? 0), marker: !!document.querySelector('[style*=horus-tour-blink]'), module: document.querySelector('.hp-rail-btn.is-on')?.textContent ?? 'aucun'})" 2>/dev/null | tr -d '\n')"