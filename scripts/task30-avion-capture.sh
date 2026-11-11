#!/bin/bash
# Task 30 — capture fiche vol, 3 evals, zéro course :
#   E1: lit l'état, choisit l'appareil, vole vers lui (z14.6, clusters dissous)
#   E2: relit l'état, re-vole sur la position ACTUELLE (drift résorbé)
#   E3: relit l'état, projète les coordonnées FRAÎCHES, spray-clic (même tâche JS)
# Usage: task30-avion-capture.sh <commercial|military|helicopter|private>
OUT=/home/z/my-project/download
CLS="$1"
FIBER_JS='
  const el = document.querySelector(".maplibregl-map");
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

echo "=== [$CLS] capture (3 phases) ==="

# E1 — sélection + vol initial
E1=$(agent-browser eval "(() => { $FIBER_JS
  const cls = '$CLS';
  const ok = (f) => {
    const c = f.rawData.classification;
    const heli = /^(H[0-9]{2}|AH|UH|CH|MH|VH|SH|HH)/i.test(f.rawData.aircraftType || '');
    if (cls === 'commercial') return c === 'commercial';
    if (cls === 'private') return c === 'private';
    if (cls === 'military') return c === 'military' && !heli;
    if (cls === 'helicopter') return c === 'helicopter';
    return false;
  };
  const cands = flights.filter(ok);
  if (cands.length === 0) return 'ERR-none-of-class';
  const f = cands[0];
  window.__osirisMapFlyTo(f.lat, f.lng, 14.6, {dur: 1500});
  window.__t30callsign = (f.rawData.callsign || '').trim();
  return window.__t30callsign + '|' + f.rawData.aircraftType;
})()" 2>/dev/null | tr -d '\n' | sed 's/^"//; s/"$//')
echo "E1: $E1"
sleep 2.4

# E2 — vérifie que la caméra est SUR LA CIBLE (zoom ET centre), sinon re-vol
E2=$(agent-browser eval "(() => { $FIBER_JS
  const cs = window.__t30callsign;
  const f = flights.find(x => (x.rawData.callsign || '').trim() === cs);
  if (!f) return 'ERR-callsign-disparu';
  const c = window.__osirisMapGetCenter();
  const z = window.__osirisMapGetZoom();
  const dLat = Math.abs((c ? c[0] : 999) - f.lat);
  const dLng = Math.abs(((c ? c[1] : 999) - f.lng + 540) % 360 - 180);
  if (!z || z < 14 || dLat > 0.25 || dLng > 0.25) {
    window.__osirisMapFlyTo(f.lat, f.lng, 14.6, {dur: 1500});
    return 'RE-VOL ' + f.lat.toFixed(5) + ',' + f.lng.toFixed(5);
  }
  return 'sync ' + f.lat.toFixed(5) + ',' + f.lng.toFixed(5);
})()" 2>/dev/null | tr -d '\n' | sed 's/^"//; s/"$//')
echo "E2: $E2"
case "$E2" in RE-VOL*) sleep 2.4;; *) sleep 0.6;; esac
# re-vérification après réparation
if [[ "$E2" == RE-VOL* ]]; then
  E2B=$(agent-browser eval "(() => { $FIBER_JS
    const cs = window.__t30callsign;
    const f = flights.find(x => (x.rawData.callsign || '').trim() === cs);
    if (!f) return 'ERR-callsign-disparu';
    const c = window.__osirisMapGetCenter();
    const z = window.__osirisMapGetZoom();
    const dLat = Math.abs((c ? c[0] : 999) - f.lat);
    const dLng = Math.abs(((c ? c[1] : 999) - f.lng + 540) % 360 - 180);
    if (!z || z < 14 || dLat > 0.25 || dLng > 0.25) {
      window.__osirisMapFlyTo(f.lat, f.lng, 14.6, {dur: 0});
      return 'RE-VOL2 ' + f.lat.toFixed(5) + ',' + f.lng.toFixed(5);
    }
    return 'ok2';
  })()" 2>/dev/null | tr -d '\n' | sed 's/^"//; s/"$//')
  echo "E2B: $E2B"
  sleep 1
fi

# E3 — relecture fraîche + projection + spray-cic (tâche JS unique = zéro course)
E3=$(agent-browser eval "(() => { $FIBER_JS
  const cls = '$CLS';
  const cs = window.__t30callsign;
  const ok = (f) => {
    const c = f.rawData.classification;
    const heli = /^(H[0-9]{2}|AH|UH|CH|MH|VH|SH|HH)/i.test(f.rawData.aircraftType || '');
    if (cls === 'commercial') return c === 'commercial';
    if (cls === 'private') return c === 'private';
    if (cls === 'military') return c === 'military' && !heli;
    if (cls === 'helicopter') return c === 'helicopter';
    return false;
  };
  let f = flights.find(x => (x.rawData.callsign || '').trim() === cs && ok(x));
  if (!f) { const cands = flights.filter(ok); if (cands.length === 0) return 'ERR-none'; f = cands[0]; }
  const p = window.__osirisMapProject(f.lat, f.lng);
  if (!p || !isFinite(p.x) || !isFinite(p.y)) return 'ERR-nan';
  const vw = window.innerWidth, vh = window.innerHeight;
  if (p.x < 20 || p.y < 20 || p.x > vw - 20 || p.y > vh - 20) return 'ERR-hors-vue ' + Math.round(p.x) + ',' + Math.round(p.y);
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
  return 'clic ' + (f.rawData.callsign || '').trim() + ' @' + Math.round(bx) + ',' + Math.round(by);
})()" 2>/dev/null | tr -d '\n' | sed 's/^"//; s/"$//')
echo "E3: $E3"
sleep 3

STATE=$(agent-browser eval "(() => {
  const ov = document.querySelector('.fixed.inset-0.z-50');
  const title = ov ? (ov.textContent || '').slice(0, 90) : null;
  const canvases = ov ? ov.querySelectorAll('canvas').length : 0;
  return JSON.stringify({open: !!ov, canvases, title});
})()" 2>/dev/null | tr -d '\n')
echo "fiche: $STATE"
agent-browser screenshot "$OUT/task30-avion-$CLS.png" >/dev/null 2>&1
echo "capturé: $OUT/task30-avion-$CLS.png"
