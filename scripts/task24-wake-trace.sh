#!/bin/bash
# Traque chaque tour-wake avec stack + chaque résolution de wait
agent-browser open http://localhost:3000/ >/dev/null 2>&1
agent-browser wait --load networkidle >/dev/null 2>&1
sleep 2
agent-browser eval "localStorage.setItem('t24b', '[]'); 'reset'" >/dev/null 2>&1
agent-browser eval "
window.__L = (ev, extra) => {
  try {
    const arr = JSON.parse(localStorage.getItem('t24b') || '[]');
    arr.push({t: Math.round(performance.now()), ev, extra: extra || null});
    localStorage.setItem('t24b', JSON.stringify(arr));
  } catch(e) {}
};
window.addEventListener('tour-wake', (e) => {
  window.__L('WAKE', (new Error('stacktrace')).stack.split('\n').slice(1, 4).join(' | ').slice(0, 220));
});
window.addEventListener('keydown', (e) => { if (e.key === 'Escape') window.__L('ESC-KEY'); }, true);
window.addEventListener('error', (e) => window.__L('PAGE-ERR', String(e.message).slice(0, 120)));
window.addEventListener('unhandledrejection', (e) => window.__L('REJECT', String(e.reason).slice(0, 120)));
'tracker ok'
" 2>&1 | tail -1

agent-browser find role button click --name "PASSER" 2>/dev/null | tail -1
agent-browser find role button click --name "ACCÈS DÉMO · CLIQUER POUR PRÉ-REMPLIR" 2>/dev/null | tail -1
agent-browser find role button click --name "ENTRER DANS LA CONSOLE" 2>/dev/null | tail -1
sleep 1
agent-browser find role button click --name "PASSER" 2>/dev/null | tail -1
sleep 1
agent-browser find role button click --name "MODE AUTONOME" 2>&1 | tail -1
echo "--- tour lancé, attente 60s (VOLS+CAMS critiques) ---"
sleep 60
echo "=== LOG WAKE/ERR ==="
agent-browser eval "localStorage.getItem('t24b')" 2>&1 | python3 -c "
import sys, json
raw = sys.stdin.read().strip()
raw = raw.strip('\"')
raw = raw.encode().decode('unicode_escape', errors='replace')
try:
    arr = json.loads(raw)
except Exception as e:
    print('parse err', e, raw[:200]); sys.exit()
for e in arr:
    print('%5.1fs %s %s' % (e['t']/1000, e['ev'], (e.get('extra') or '')[:200]))
"
agent-browser eval "
(() => {
  const chip = document.querySelector('.at-chip-label');
  const card = document.querySelector('.at-card-title');
  return JSON.stringify({chip: chip?chip.textContent:null, card: card?card.textContent.slice(0,36):null});
})()
" 2>&1