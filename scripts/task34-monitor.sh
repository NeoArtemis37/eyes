#!/bin/bash
# Moniteur tout-en-un : démarre le MODE AUTONOME puis le suit jusqu'au bout
# dans la MÊME invocation (la latence entre appels d'outils dépasse la durée
# du tour — impossible de le suivre en appel séparés).
LOG=/home/z/my-project/scripts/task34-tour-monitor.log
: > "$LOG"
D=/home/z/my-project/download

EV='JSON.stringify({s:document.querySelector(".at-chip-label")?.textContent||"-",n:document.querySelector(".at-chip-count")?.textContent||"-",c:(document.querySelector(".at-card-body")?.textContent||"").slice(0,95),f:!!document.querySelector(".at-finale"),r:document.querySelector("input[data-recon-input]")?.value||"",rb:(document.querySelector(".net-recon__body")?.textContent||"").replace(/\s+/g," ").slice(0,220)})'

# ── démarrage du tour ──
agent-browser find role button click --name "MODE AUTONOME" >/dev/null 2>&1 \
  || agent-browser eval "var b=[...document.querySelectorAll('button')].find(x=>(x.title||'').includes('MODE AUTONOME')); b? (b.click(),'clicked') : 'absent'" >/dev/null 2>&1
sleep 3

shot_cams=0; shot_r1=0; shot_r2=0; shot_gr=0; shot_fin=0
seen_start=0
for i in $(seq 1 95); do
  STATE=$(agent-browser eval "$EV" 2>/dev/null | tail -1)
  echo "$(date +%s) | $STATE" >> "$LOG"
  case "$STATE" in
    *'"s":"MODE AUTO'*) seen_start=1;;
  esac
  case "$STATE" in
    *"flux 2/5"*) [ $shot_cams -eq 0 ] && { agent-browser screenshot $D/task34-cams.png >/dev/null 2>&1; shot_cams=1; echo "$(date +%s) | SHOT cams" >> "$LOG"; };;
    *"RECON · CIBLAGE"*) [ $shot_r1 -eq 0 ] && { sleep 5; agent-browser screenshot $D/task34-recon-adresse.png >/dev/null 2>&1; shot_r1=1; echo "$(date +%s) | SHOT recon1(+5s)" >> "$LOG"; };;
    *"RECON · SHODAN"*) [ $shot_r2 -eq 0 ] && { sleep 5; agent-browser screenshot $D/task34-recon-shodan.png >/dev/null 2>&1; shot_r2=1; echo "$(date +%s) | SHOT recon2(+5s)" >> "$LOG"; };;
    *"GRAPHE"*) [ $shot_gr -eq 0 ] && { agent-browser screenshot $D/task34-graphe.png >/dev/null 2>&1; shot_gr=1; echo "$(date +%s) | SHOT graphe" >> "$LOG"; };;
    *'"f":true'*) [ $shot_fin -eq 0 ] && { agent-browser screenshot $D/task34-fin.png >/dev/null 2>&1; shot_fin=1; echo "$(date +%s) | SHOT finale" >> "$LOG"; };;
  esac
  # fin : puce disparue APRÈS un début constaté (2 échantillons de suite)
  if [ $seen_start -eq 1 ] && echo "$STATE" | grep -q '"s":"-"'; then
    echo "$(date +%s) | TOUR-FINI" >> "$LOG"; break
  fi
  sleep 4
done
echo "MONITOR-DONE" >> "$LOG"
grep -cE "^[0-9]" "$LOG"; grep -E "SHOT|TOUR-FINI|MONITOR" "$LOG" | tail -8
