#!/bin/bash
# Task 31 — capture des 4 appareils avec le nouveau nez, SANS dépendre des
# API ADS-B (quota labo épuisé) : interception navigateur de
# /api/osint/flights avec des appareils synthétiques figés, flux réel de
# l'app (marqueur → clic → fiche 3D) inchangé.
OUT=/home/z/my-project/download
MOCK=/home/z/my-project/scripts/task31-flights-mock.json

FIBER_JS='
  const el = document.querySelector(".maplibregl-map");
  if (!el) return "ERR-nomap";
  const fk = Object.keys(el).find(k => k.startsWith("__reactFiber$"));
  if (!fk) return "ERR-nofiber";
  let cur = el[fk], pts = null, hops = 0;
  while (cur && hops < 60) {
    const p = cur.memoizedProps;
    if (p && Array.isArray(p.points) && p.points.length > 0) { pts = p.points; break; }
    cur = cur.return; hops++;
  }
  if (!pts) return "ERR-notfound";
  const flights = pts.filter(pt => pt.type === "flight" && pt.rawData);
'

# ── 0 · interception + session ──────────────────────────────────────────────
agent-browser set viewport 1366 768 >/dev/null 2>&1
agent-browser network unroute >/dev/null 2>&1
agent-browser network route "http://localhost:3000/api/osint/flights" --body "$(< $MOCK)" >/dev/null 2>&1
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

# attendre que les vols synthétiques soient dans l'état React
for i in $(seq 1 15); do
  sleep 1
  R=$(agent-browser eval "(() => { $FIBER_JS return String(flights.length); })()" 2>/dev/null | tr -d '\n"')
  [ "$R" -ge 4 ] 2>/dev/null && break
done
echo "vols synthétiques chargés: $R"

# ── 1 · capture par classe ──────────────────────────────────────────────────
for CLS in commercial private military helicopter; do
  agent-browser eval "(() => { $FIBER_JS
    const f = flights.find(x => x.rawData.classification === '$CLS');
    if (!f) return 'ERR-none';
    window.__osirisMapFlyTo(f.lat, f.lng, 14.6, {dur: 1600});
    return f.rawData.callsign + ' ' + f.rawData.aircraftType;
  })()" 2>/dev/null | tr -d '\n"'
  sleep 2.8
  CLICKED=0
  for TRY in 1 2 3 4 5 6; do
    R=$(agent-browser eval "(() => { $FIBER_JS
      const f = flights.find(x => x.rawData.classification === '$CLS');
      if (!f) return 'ERR-none';
      const c = window.__osirisMapGetCenter(); // [lng, lat] !
      const z = window.__osirisMapGetZoom();
      if (!c || !z || z < 14 || Math.abs(c[1] - f.lat) > 0.25 || Math.abs(((c[0] - f.lng + 540) % 360) - 180) > 0.25) {
        window.__osirisMapFlyTo(f.lat, f.lng, 14.6, {dur: 0});
        return 'revol';
      }
      const p = window.__osirisMapProject(f.lat, f.lng);
      if (!p || !isFinite(p.x)) return 'ERR-nan';
      const canvas = document.querySelector('.maplibregl-map canvas');
      const r = canvas.getBoundingClientRect();
      const bx = r.left + p.x, by = r.top + p.y;
      const offs = [[0,0],[26,0],[-26,0],[0,26],[0,-26]];
      for (const [dx, dy] of offs) {
        const cx = bx + dx, cy = by + dy;
        const common = {clientX: cx, clientY: cy, bubbles: true, cancelable: true, view: window, button: 0};
        canvas.dispatchEvent(new PointerEvent('pointerdown', {...common, pointerId: 7, isPrimary: true, pointerType: 'mouse'}));
        canvas.dispatchEvent(new MouseEvent('mousedown', common));
        canvas.dispatchEvent(new PointerEvent('pointerup', {...common, pointerId: 7, isPrimary: true, pointerType: 'mouse'}));
        canvas.dispatchEvent(new MouseEvent('mouseup', common));
        canvas.dispatchEvent(new MouseEvent('click', common));
      }
      return 'clic ' + f.rawData.callsign;
    })()" 2>/dev/null | tr -d '\n"')
    echo "  [$CLS essai $TRY] $R"
    case "$R" in clic*) CLICKED=1; break;; esac
    sleep 2.0
  done
  sleep 3.0
  # fiche ouverte ? sinon un dernier clic ciblé
  STATE=$(agent-browser eval "(() => {
    const ov = document.querySelector('.fixed.inset-0.z-50');
    return JSON.stringify({open: !!ov, canvases: ov ? ov.querySelectorAll('canvas').length : 0});
  })()" 2>/dev/null | tr -d '\n')
  echo "  fiche: $STATE"
  if ! echo "$STATE" | grep -q '"open":true'; then
    agent-browser eval "(() => { $FIBER_JS
      const f = flights.find(x => x.rawData.classification === '$CLS');
      if (!f) return 'none';
      const p = window.__osirisMapProject(f.lat, f.lng);
      if (!p) return 'nan';
      const canvas = document.querySelector('.maplibregl-map canvas');
      const r = canvas.getBoundingClientRect();
      const cx = r.left + p.x, cy = r.top + p.y;
      const common = {clientX: cx, clientY: cy, bubbles: true, cancelable: true, view: window, button: 0};
      canvas.dispatchEvent(new PointerEvent('pointerdown', {...common, pointerId: 7, isPrimary: true, pointerType: 'mouse'}));
      canvas.dispatchEvent(new MouseEvent('mousedown', common));
      canvas.dispatchEvent(new PointerEvent('pointerup', {...common, pointerId: 7, isPrimary: true, pointerType: 'mouse'}));
      canvas.dispatchEvent(new MouseEvent('mouseup', common));
      canvas.dispatchEvent(new MouseEvent('click', common));
      return 'reclic';
    })()" 2>/dev/null | tr -d '\n"'
    sleep 3.0
  fi
  agent-browser screenshot "$OUT/task31-avion-$CLS.png" >/dev/null 2>&1
  echo "capturé: $OUT/task31-avion-$CLS.png"
  # fermer la fiche pour la classe suivante
  agent-browser press Escape >/dev/null 2>&1
  sleep 1.2
done
echo "CAPTURES TERMINÉES"
