#!/bin/bash
# Échantillonneur localStorage + tour + dump timeline après coup
agent-browser open http://localhost:3000/ >/dev/null 2>&1
agent-browser wait --load networkidle >/dev/null 2>&1
sleep 2
agent-browser eval "localStorage.setItem('t24', '[]'); 'reset'" >/dev/null 2>&1
agent-browser eval "
localStorage.setItem('t24', JSON.stringify([{t: 0, ev: 'sampler-install ' + performance.now().toFixed(0) + ' nav=' + performance.getEntriesByType('navigation')[0].type}]));
let n = 0;
window.__sampler = setInterval(() => {
  n++;
  try {
    const chip = document.querySelector('.at-chip-label');
    const card = document.querySelector('.at-card-title');
    const bub = document.querySelector('.hp-cambubble h3');
    const z = window.__osirisMapGetZoom ? window.__osirisMapGetZoom() : null;
    const arr = JSON.parse(localStorage.getItem('t24') || '[]');
    if (n % 2 === 0) arr.push({t: Math.round(performance.now()), chip: chip ? chip.textContent : null, card: card ? card.textContent.slice(0, 30) : null, bub: bub ? bub.textContent.slice(0, 28) : null, z});
    else if (chip || card) arr.push({t: Math.round(performance.now()), chip: chip ? chip.textContent : null, card: card ? card.textContent.slice(0, 30) : null, bub: bub ? bub.textContent.slice(0, 28) : null, z});
    if (arr.length > 400) arr.splice(0, 100);
    localStorage.setItem('t24', JSON.stringify(arr));
  } catch (e) {}
}, 600);
'sampler ok'
" 2>&1 | tail -1

# Onboarding/login éventuels
agent-browser find role button click --name "PASSER" 2>/dev/null | tail -1
agent-browser find role button click --name "ACCÈS DÉMO · CLIQUER POUR PRÉ-REMPLIR" 2>/dev/null | tail -1
agent-browser find role button click --name "ENTRER DANS LA CONSOLE" 2>/dev/null | tail -1
sleep 1
agent-browser find role button click --name "PASSER" 2>/dev/null | tail -1
sleep 1

# Tour — AUCUNE sonde externe, seulement le sampler in-page
agent-browser find role button click --name "MODE AUTONOME" 2>&1 | tail -1
echo "--- tour lancé, attente 100s ---"
sleep 100

echo "=== TIMELINE ÉCHANTILLONNÉE ==="
agent-browser eval "localStorage.getItem('t24')" 2>&1 | python3 -c "
import sys, json
raw = sys.stdin.read().strip().strip('\"')
raw = raw.encode().decode('unicode_escape', errors='replace')
try:
    arr = json.loads(raw)
except Exception as e:
    print('parse err', e); sys.exit()
prev_t = None
for e in arr:
    gap = (' GAP+%.1fs' % ((e['t'] - prev_t)/1000)) if prev_t and e['t'] - prev_t > 3000 else ''
    print('%5.1fs%s chip=%s card=%s bub=%s z=%s' % (e['t']/1000, gap, e.get('chip'), e.get('card'), e.get('bub'), e.get('z')))
    prev_t = e['t']
"