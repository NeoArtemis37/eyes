#!/bin/bash
# Tour instrumenté: patch des bridges avec log, AUCUN eval pendant le tour, dump après
agent-browser console --clear >/dev/null 2>&1
agent-browser eval "
window.__log = [];
window.__errs2 = [];
window.addEventListener('error', e => window.__errs2.push(String(e.message)));
window.addEventListener('unhandledrejection', e => window.__errs2.push('REJ ' + String(e.reason && e.reason.message || e.reason)));
const wrap = (name) => {
  let orig = null;
  const probe = () => {
    const cur = window[name];
    if (cur && cur.__logged) return;
    if (cur && !cur.__logged) {
      orig = cur;
      const w = function(...a) { window.__log.push(name + ' called ' + JSON.stringify(a.map(x => (typeof x === 'object' ? '[obj]' : x)))); const r = orig.apply(this, a); window.__log.push(name + ' -> ' + (r === undefined ? 'void' : String(r))); return r; };
      w.__logged = true;
      window[name] = w;
    } else {
      window.__log.push(name + ' ABSENT at ' + Math.round(performance.now()));
    }
  };
  const iv = setInterval(probe, 500);
  window.__stopWrapLog = () => clearInterval(iv);
};
['__osirisMapFlyTo', '__osirisMapSet3D', '__osirisMapSlowOrbit', '__osirisMapResetView'].forEach(wrap);
'patch ok'
" 2>&1 | tail -1

agent-browser press Escape 2>/dev/null
sleep 2
agent-browser find role button click --name "MODE AUTONOME" 2>&1 | tail -1
date +%s.%N > /tmp/tour-t0.txt
echo "T0=$(cat /tmp/tour-t0.txt) — tour lancé, silence radio 95s"
sleep 95
echo "=== FIN DU TOUR — DUMP ==="
agent-browser eval "window.__stopWrapLog && window.__stopWrapLog(); JSON.stringify({log: window.__log.slice(0, 80), errs: window.__errs2}, null, 1)" 2>&1 | head -100