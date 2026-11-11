#!/bin/bash
# RUN 5 : flux chargés AVANT le lancement · vérif vol 3D + fin propre
OUT=/home/z/my-project/download

agent-browser reload >/dev/null
agent-browser wait 3000 >/dev/null
agent-browser eval "
(() => {
  const all = [...document.querySelectorAll('div,button,span')];
  const skip = all.find(e => e.childElementCount === 0 && /PASSER/.test(e.textContent || ''));
  if (skip) { (skip.closest('[class*=aes],[class*=intro]') || skip).click(); }
  document.body.click(); return 'ok';
})()
" >/dev/null
agent-browser wait 3000 >/dev/null
agent-browser eval "
(() => { const d=[...document.querySelectorAll('button')].find(b=>/ACCÈS DÉMO/.test(b.textContent||'')); if(d)d.click(); return 'demo'; })()
" >/dev/null
agent-browser wait 400 >/dev/null
agent-browser eval "
(() => { const e=[...document.querySelectorAll('button')].find(b=>/ENTRER DANS LA CONSOLE/.test(b.textContent||'')); if(e)e.click(); return 'enter'; })()
" >/dev/null
agent-browser wait 2500 >/dev/null
agent-browser eval "
(() => { const s=[...document.querySelectorAll('button')].find(b=>/PASSER/.test(b.textContent||'')); if(s)s.click(); localStorage.setItem('horus-onboarded','1'); return 'ok'; })()
" >/dev/null

# ── attendre que les VOLS soient chargés (compteur > 0) ──
echo "attente des flux…"
for i in $(seq 1 60); do
  pts=$(agent-browser eval "document.querySelector('.hp-tb-pts')?.textContent || '0 PTS'" 2>/dev/null | tr -d '"')
  n=$(echo "$pts" | rg -o "[0-9]+" | head -1)
  if [ -n "$n" ] && [ "$n" -gt 0 ]; then echo "FLUX PRÊTS: $pts (après $((i*2))s)"; break; fi
  sleep 2
done

agent-browser eval "document.querySelector('.hp-tb-right button[title*=\"MODE AUTONOME\"]').click()" >/dev/null
echo "AUTO lancé (run 5)"

ok=0
for i in $(seq 1 80); do
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
  agent-browser screenshot $OUT/auto20-vol3d-run5.png >/dev/null
  echo "[vol 3D capturé run 5]"
else
  echo "!! VOLS non atteint"
fi