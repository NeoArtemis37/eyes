#!/bin/bash
# Task 31 — capture du globe réseau (vue RÉSEAU) avant/après refonte du rendu
OUT=/home/z/my-project/download
TAG="$1"   # ex: avant / apres

agent-browser set viewport 1366 768 >/dev/null 2>&1
agent-browser open http://localhost:3000 >/dev/null 2>&1
sleep 3
agent-browser eval "(() => {
  const all = [...document.querySelectorAll('div,button,span')];
  const skip = all.find(e => e.childElementCount === 0 && /PASSER/.test(e.textContent || ''));
  if (skip) { (skip.closest('[class*=aes],[class*=intro]') || skip).click(); }
  document.body.click(); return 'intro';
})()" >/dev/null 2>&1
sleep 2
agent-browser eval "(() => { const b=[...document.querySelectorAll('button')].find(b=>/ACCÈS DÉMO/.test(b.textContent||'')); if(b)b.click(); return 1; })()" >/dev/null 2>&1
sleep 0.5
agent-browser eval "(() => { const b=[...document.querySelectorAll('button')].find(b=>/ENTRER DANS LA CONSOLE/.test(b.textContent||'')); if(b)b.click(); return 1; })()" >/dev/null 2>&1
sleep 2.5
agent-browser eval "(() => { const b=[...document.querySelectorAll('button')].find(b=>/PASSER/.test(b.textContent||'')); if(b)b.click(); return 1; })()" >/dev/null 2>&1
sleep 2

# basculer vers la vue RÉSEAU
agent-browser eval "(() => { const b=[...document.querySelectorAll('button')].find(b=>/RÉSEAU/.test((b.textContent||''))); if(b){b.click(); return 'clicked';} return 'notfound'; })()" 2>/dev/null | tr -d '\n"'
echo ""
# laisser le flux s'accumuler (arcs + paysages)
sleep "${2:-8}"
agent-browser screenshot "$OUT/task31-globe-reseau-$TAG.png" >/dev/null 2>&1
echo "capture: $OUT/task31-globe-reseau-$TAG.png"
