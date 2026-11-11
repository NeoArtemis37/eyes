#!/bin/bash
# Task 30 — test drag-rotate : ouvre la fiche d'un appareil et le fait pivoter
# par glissement synthétique (2 passes de +170px), capture sous 2 angles.
OUT=/home/z/my-project/download
CLS="${1:-commercial}"

# 1. ouvrir la fiche (capture standard sans fermeture)
bash /home/z/my-project/scripts/task30-avion-capture.sh "$CLS" | tail -4

# la fiche a été refermée par le script — la rouvrir
# (rejouer uniquement clic ; la carte est déjà centrée)
agent-browser eval "(() => {
  const el = document.querySelector('.maplibregl-map');
  const fk = Object.keys(el).find(k => k.startsWith('__reactFiber\$'));
  let cur = el[fk], pts = null, hops = 0;
  while (cur && hops < 60) {
    const p = cur.memoizedProps;
    if (p && Array.isArray(p.points) && p.points.length > 0) { pts = p.points; break; }
    cur = cur.return; hops++;
  }
  const flights = pts.filter(pt => pt.type === 'flight' && pt.rawData && pt.rawData.classification === '$CLS');
  const pick = flights[0];
  window.__flightPick = {lat: pick.lat, lng: pick.lng};
  window.__osirisMapProject(pick.lat, pick.lng);
  return pick.rawData.callsign;
})()" 2>/dev/null | tr -d '\n'
echo
PICK=$(agent-browser eval "JSON.stringify(window.__flightPick)" 2>/dev/null | tr -d '\n' | sed 's/"//g')
LAT=$(echo "$PICK" | cut -d',' -f1 | sed 's/{lat://')
LNG=$(echo "$PICK" | cut -d',' -f2 | sed 's/lng://; s/}//')
echo "re-ciblage: $LAT,$LNG"

agent-browser eval "(() => {
  const p = window.__osirisMapProject($LAT, $LNG);
  const canvas = document.querySelector('.maplibregl-map canvas');
  const r = canvas.getBoundingClientRect();
  const common = {clientX: r.left + p.x, clientY: r.top + p.y, bubbles: true, cancelable: true, view: window, button: 0};
  canvas.dispatchEvent(new PointerEvent('pointerdown', {...common, pointerId: 7, isPrimary: true, pointerType: 'mouse'}));
  canvas.dispatchEvent(new MouseEvent('mousedown', common));
  canvas.dispatchEvent(new PointerEvent('pointerup', {...common, pointerId: 7, isPrimary: true, pointerType: 'mouse'}));
  canvas.dispatchEvent(new MouseEvent('mouseup', common));
  canvas.dispatchEvent(new MouseEvent('click', common));
  return 'ok';
})()" >/dev/null 2>&1
sleep 2.5

# 2. drag-rotate pass 1 (+170px) — teste le glisser ET fixe un angle différent
agent-browser eval "(() => {
  const ov = document.querySelector('.fixed.inset-0.z-50');
  if (!ov) return 'ERR-pas-de-fiche';
  const cv = ov.querySelector('canvas');
  const r = cv.getBoundingClientRect();
  const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  const mk = (x, y, type) => {
    const ev = type === 'up' ? new PointerEvent('pointerup', {clientX: x, clientY: y, bubbles: true, pointerId: 9, isPrimary: true, pointerType: 'mouse'}) : new PointerEvent(type, {clientX: x, clientY: y, bubbles: true, pointerId: 9, isPrimary: true, pointerType: 'mouse', button: 0});
    cv.dispatchEvent(ev);
  };
  mk(cx, cy, 'pointerdown');
  for (let i = 1; i <= 12; i++) mk(cx + i * 14, cy + i * 2, 'pointermove');
  mk(cx + 170, cy + 26, 'up');
  const cur = cv.style.cursor;
  return JSON.stringify({drag: 'ok', cursor: cur});
})()" 2>/dev/null | tr -d '\n'
echo
sleep 1.2
agent-browser screenshot "$OUT/task30-avion-$CLS-drag1.png" >/dev/null 2>&1

# 3. pass 2 (+170px encore)
agent-browser eval "(() => {
  const ov = document.querySelector('.fixed.inset-0.z-50');
  if (!ov) return 'ERR-pas-de-fiche';
  const cv = ov.querySelector('canvas');
  const r = cv.getBoundingClientRect();
  const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  cv.dispatchEvent(new PointerEvent('pointerdown', {clientX: cx, clientY: cy, bubbles: true, pointerId: 10, isPrimary: true, pointerType: 'mouse', button: 0}));
  for (let i = 1; i <= 12; i++) cv.dispatchEvent(new PointerEvent('pointermove', {clientX: cx + i * 14, clientY: cy + i * 2, bubbles: true, pointerId: 10, isPrimary: true, pointerType: 'mouse', button: 0}));
  cv.dispatchEvent(new PointerEvent('pointerup', {clientX: cx + 170, clientY: cy + 26, bubbles: true, pointerId: 10, isPrimary: true, pointerType: 'mouse'}));
  return 'ok';
})()" 2>/dev/null | tr -d '\n'
echo
sleep 1.2
agent-browser screenshot "$OUT/task30-avion-$CLS-drag2.png" >/dev/null 2>&1

# 4. la fiche est-elle toujours ouverte (drag n'a pas fermé) ?
agent-browser eval "(() => {
  const ov = document.querySelector('.fixed.inset-0.z-50');
  const cv = ov ? ov.querySelector('canvas') : null;
  return JSON.stringify({open: !!ov, cursor: cv ? cv.style.cursor : null});
})()" 2>/dev/null | tr -d '\n'
echo
echo "captures drag: $OUT/task30-avion-$CLS-drag1.png + drag2.png"
