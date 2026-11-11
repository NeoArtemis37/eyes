#!/bin/bash
# Task 30 — passe finale : SESSION FRAÎCHE par variante (la carte figée en file
# d'attente readyRef ne survit pas à un rechargement), login démo, capture.
OUT=/home/z/my-project/download
CAP=/home/z/my-project/scripts/task30-avion-capture.sh

login_and_ready() {
  agent-browser open http://localhost:3000 >/dev/null 2>&1
  sleep 3
  agent-browser eval "(() => {
    const all = [...document.querySelectorAll('div,button,span')];
    const skip = all.find(e => e.childElementCount === 0 && /PASSER/.test(e.textContent || ''));
    if (skip) { (skip.closest('[class*=aes],[class*=intro]') || skip).click(); }
    document.body.click(); return 'intro';
  })()" >/dev/null 2>&1
  sleep 2.2
  agent-browser eval "(() => { const b=[...document.querySelectorAll('button')].find(b=>/ACCÈS DÉMO/.test(b.textContent||'')); if(b)b.click(); return 1; })()" >/dev/null 2>&1
  sleep 0.5
  agent-browser eval "(() => { const b=[...document.querySelectorAll('button')].find(b=>/ENTRER DANS LA CONSOLE/.test(b.textContent||'')); if(b)b.click(); return 1; })()" >/dev/null 2>&1
  sleep 2.5
  agent-browser eval "(() => { const b=[...document.querySelectorAll('button')].find(b=>/PASSER/.test(b.textContent||'')); if(b)b.click(); return 1; })()" >/dev/null 2>&1
  # attendre que la carte soit prête (idle) et que les points de vol soient chargés
  for i in $(seq 1 12); do
    sleep 1
    R=$(agent-browser eval "(() => {
      const el = document.querySelector('.maplibregl-map');
      if (!el) return '0';
      const fk = Object.keys(el).find(k => k.startsWith('__reactFiber\$'));
      if (!fk) return '0';
      let cur = el[fk], hops = 0;
      while (cur && hops < 60) {
        const p = cur.memoizedProps;
        if (p && Array.isArray(p.points) && p.points.length > 0) return String(p.points.filter(x => x.type === 'flight').length);
        cur = cur.return; hops++;
      }
      return '0';
    })()" 2>/dev/null | tr -d '\n"')
    [ "$R" -gt 20 ] 2>/dev/null && break
  done
  echo "vols chargés: $R"
}

for CLS in "$@"; do
  echo "──────────────────────── $CLS ────────────────────────"
  login_and_ready
  bash "$CAP" "$CLS"
  echo
done
echo "PASSE FINALE TERMINÉE"
