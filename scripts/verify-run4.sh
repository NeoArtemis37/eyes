#!/bin/bash
# RUN 4 PROPRE : rechargement complet, aucun edit HMR pendant le run
OUT=/home/z/my-project/download

agent-browser reload >/dev/null
agent-browser wait 3000 >/dev/null
# passer l'intro
agent-browser eval "
(() => {
  const all = [...document.querySelectorAll('div,button,span')];
  const skip = all.find(e => e.childElementCount === 0 && /PASSER/.test(e.textContent || ''));
  if (skip) { (skip.closest('[class*=aes],[class*=intro]') || skip).click(); }
  document.body.click();
  return 'ok';
})()
" >/dev/null
agent-browser wait 3000 >/dev/null
# login démo
agent-browser eval "
(() => {
  const btns = [...document.querySelectorAll('button')];
  const demo = btns.find(b => /ACCÈS DÉMO/.test(b.textContent || ''));
  if (demo) demo.click();
  return 'demo';
})()
" >/dev/null
agent-browser wait 400 >/dev/null
agent-browser eval "
(() => {
  const enter = [...document.querySelectorAll('button')].find(b => /ENTRER DANS LA CONSOLE/.test(b.textContent||''));
  if (enter) enter.click();
  return 'enter';
})()
" >/dev/null
agent-browser wait 2500 >/dev/null
# onboarding auto → le fermer + flag
agent-browser eval "
(() => {
  const skip = [...document.querySelectorAll('button')].find(b => /PASSER/.test(b.textContent||''));
  if (skip) skip.click();
  localStorage.setItem('horus-onboarded', '1');
  return 'ok';
})()
" >/dev/null
echo "console prête · attente des flux (12 s)…"
agent-browser wait 12000 >/dev/null
agent-browser eval "
(() => JSON.stringify({
  pts: document.querySelector('.hp-tb-pts')?.textContent || null,
  flights: 'prêts',
}))()
"

# lancer AUTO
agent-browser eval "document.querySelector('.hp-tb-right button[title*=\"MODE AUTONOME\"]').click()" >/dev/null
echo "AUTO lancé (run 4)"

# ── VOLS 3D : poll précis + check à +6.5 s du label VOLS ──
ok=0
for i in $(seq 1 60); do
  label=$(agent-browser eval "document.querySelector('.at-chip-label')?.textContent || 'FINI'" 2>/dev/null | tr -d '"')
  if echo "$label" | rg -q "VOLS"; then ok=1; break; fi
  if [ "$label" = "FINI" ]; then break; fi
  sleep 0.4
done
if [ $ok -eq 1 ]; then
  sleep 6.5
  agent-browser eval "
  (() => { const cs=[...document.querySelectorAll('canvas')]; return JSON.stringify({
    nCanvases: cs.length,
    vue3d: [...document.querySelectorAll('span')].map(s=>s.textContent||'').find(t=>/^VUE 3D · /.test(t)) || null,
    glisser: document.body.innerText.includes('GLISSER POUR PIVOTER'),
    overlay: !!document.querySelector('.bg-\\\\[\\\\#06060C\\\\]\\\\/95'),
    card: document.querySelector('.at-card-title')?.textContent || null,
  });})()
  "
  agent-browser screenshot $OUT/auto20-vol3d-run4.png >/dev/null
  echo "[vol 3D capturé run 4]"
else
  echo "!! VOLS non atteint"
fi