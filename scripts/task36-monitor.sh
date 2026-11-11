#!/bin/bash
# Task 36 — vérification live finale : tour complet + cinématique de clôture
# (lettres AES-CERT, plus de logo œil) + onboarding rejouable via AIDE.
D=/home/z/my-project/download
LOG=/home/z/my-project/scripts/task36-tour.log
: > "$LOG"

EV='JSON.stringify({s:document.querySelector(".at-chip-label")?.textContent||"-",c:(document.querySelector(".at-card-body")?.textContent||"").slice(0,95),f:!!document.querySelector(".at-fc-word"),q:!!document.querySelector(".at-finale-quote"),e:!!document.querySelector(".at-fc-letter"),old:!!document.querySelector(".at-finale-logo"),fin:!!document.querySelector(".at-finale"),r:document.querySelector("input[data-recon-input]")?.value||""})'

# état initial propre
agent-browser open http://localhost:3000/ >/dev/null 2>&1
sleep 6
agent-browser eval "sessionStorage.setItem('horus-session','1'); localStorage.setItem('horus-onboarded','1'); 'ok'" >/dev/null 2>&1
agent-browser reload >/dev/null 2>&1
sleep 9

# lancement du tour
agent-browser eval "(() => { const b=[...document.querySelectorAll('button')].find(x=>(x.title||'').includes('MODE AUTONOME')); b&&b.click(); return 'go'; })()" >/dev/null 2>&1
sleep 3
agent-browser eval "(() => { window.__errs=[]; window.addEventListener('error',e=>window.__errs.push(String(e.message||e).slice(0,120))); window.addEventListener('unhandledrejection',e=>window.__errs.push('rej:'+String(e.reason).slice(0,120))); return 'hook'; })()" >/dev/null 2>&1

LAST=""; shot_cine=0; shot_quote=0; shot_cams=0; shot_gr=0; seen=0; START=$(date +%s)
for i in $(seq 1 80); do
  S=$(agent-browser eval "$EV" 2>/dev/null | tail -1)
  echo "$(date +%s) $S" >> "$LOG"
  L=$(echo "$S" | python3 -c "import sys,json; t=sys.stdin.read().strip(); d=json.loads(json.loads(t)) if t.startswith('\"') else json.loads(t); print(d.get('s',''))" 2>/dev/null)
  C=$(echo "$S" | python3 -c "import sys,json; t=sys.stdin.read().strip(); d=json.loads(json.loads(t)) if t.startswith('\"') else json.loads(t); print((d.get('c','') or '')[:88])" 2>/dev/null)
  F=$(echo "$S" | python3 -c "import sys,json; t=sys.stdin.read().strip(); d=json.loads(json.loads(t)) if t.startswith('\"') else json.loads(t); print('1' if d.get('f') else '')" 2>/dev/null)
  Q=$(echo "$S" | python3 -c "import sys,json; t=sys.stdin.read().strip(); d=json.loads(json.loads(t)) if t.startswith('\"') else json.loads(t); print('1' if d.get('q') else '')" 2>/dev/null)
  OLD=$(echo "$S" | python3 -c "import sys,json; t=sys.stdin.read().strip(); d=json.loads(json.loads(t)) if t.startswith('\"') else json.loads(t); print('1' if d.get('old') else '')" 2>/dev/null)
  if [ -n "$L" ] && [ "$L" != "-" ] && [ "$L" != "$LAST" ]; then EL=$(( $(date +%s) - START )); echo "[$EL s] ÉTAPE: $L"; LAST="$L"; seen=1; fi
  case "$C" in *"flux 2/5"*) [ $shot_cams -eq 0 ] && { agent-browser screenshot $D/task36-cams.png >/dev/null 2>&1; shot_cams=1; echo "[$(( $(date +%s) - START )) s] SHOT cams"; };; esac
  case "$L" in *GRAPHE*) [ $shot_gr -eq 0 ] && { agent-browser screenshot $D/task36-graphe.png >/dev/null 2>&1; shot_gr=1; echo "[$(( $(date +%s) - START )) s] SHOT graphe | $C"; };; esac
  # cinématique : lettres visibles, pas encore de citation → capture précoce
  if [ -n "$F" ] && [ -z "$Q" ] && [ $shot_cine -eq 0 ]; then sleep 1; agent-browser screenshot $D/task36-finale-cine.png >/dev/null 2>&1; shot_cine=1; echo "[$(( $(date +%s) - START )) s] SHOT cinématique (lettres, old-logo=$OLD)"; fi
  # citation tapée : capture après stabilisation
  if [ -n "$Q" ] && [ $shot_quote -eq 0 ]; then sleep 6; agent-browser screenshot $D/task36-finale-citation.png >/dev/null 2>&1; shot_quote=1; echo "[$(( $(date +%s) - START )) s] SHOT finale+citation (old-logo=$OLD)"; fi
  if [ "$L" = "-" ] && [ $seen -eq 1 ]; then echo "[$(( $(date +%s) - START )) s] TOUR TERMINÉ"; break; fi
  sleep 4
done

# erreurs accumulées
agent-browser eval "JSON.stringify((window.__errs||[]).slice(0,6))" 2>/dev/null | tail -1

# ── onboarding rejouable via AIDE ──
sleep 2
agent-browser eval "(() => { const b=[...document.querySelectorAll('button')].find(x=>(x.title||'').includes('AIDE')); if(!b) return 'aide-absent'; b.click(); return 'aide-clicked'; })()" 2>/dev/null | tail -1
sleep 2.5
agent-browser eval "JSON.stringify({onboardOpen: !!document.querySelector('[class*=onboard i], .obt-root, [class*=Onboard]'), onboardVisible: (() => { const el=[...document.querySelectorAll('div')].find(d=>(d.className&&typeof d.className==='string'&&d.className.includes('onboard'))); return el ? el.className.slice(0,50) : null; })()})" 2>/dev/null | tail -1
agent-browser screenshot $D/task36-onboarding-aide.png >/dev/null 2>&1
echo "=== MONITOR DONE ==="