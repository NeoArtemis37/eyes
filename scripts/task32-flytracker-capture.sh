#!/bin/bash
# Task 32 — FLIGHT TRACKER live verification, SANS interception réseau :
# le vrai pipeline ADS-B (fallback opendata.adsb.fi) doit remplir le panneau
# VOLS et poser les points sur le globe. Capture plein écran + zoom panneau.
OUT=/home/z/my-project/download
agent-browser set viewport 1600 900 >/dev/null 2>&1
agent-browser network unroute >/dev/null 2>&1
agent-browser open http://localhost:3000 >/dev/null 2>&1
sleep 4
# Passer l'intro + login démo
agent-browser eval "(() => {
  const all = [...document.querySelectorAll('div,button,span')];
  const skip = all.find(e => e.childElementCount === 0 && /PASSER/.test(e.textContent || ''));
  if (skip) { (skip.closest('[class*=aes],[class*=intro]') || skip).click(); }
  document.body.click(); return 'intro';
})()" >/dev/null 2>&1
sleep 2
agent-browser eval "(() => { const b=[...document.querySelectorAll('button')].find(b=>/ACCÈS DÉMO/.test(b.textContent||'')); if(b)b.click(); return 1; })()" >/dev/null 2>&1
sleep 1
agent-browser eval "(() => { const b=[...document.querySelectorAll('button')].find(b=>/ENTRER DANS LA CONSOLE/.test(b.textContent||'')); if(b)b.click(); return 1; })()" >/dev/null 2>&1
sleep 3

# Attendre que le panneau FLIGHT TRACKER se remplisse (vrai flux, jusqu'à 40s)
FILLED=no
for i in $(seq 1 20); do
  N=$(agent-browser eval "(() => {
    const panels=[...document.querySelectorAll('div')].filter(d=>/FLIGHT TRACKER/.test(d.textContent||'')&&d.querySelectorAll('div').length<40);
    const p=panels[panels.length-1];
    if(!p) return '0';
    const root=p.parentElement.parentElement;
    const items=[...root.querySelectorAll('.custom-scrollbar > div')].filter(x=>x.textContent&&x.textContent.includes('ICAO'));
    return String(items.length);
  })()" 2>/dev/null | sed 's/"//g')
  echo "poll $i → entrées: $N"
  if [ "$N" != "0" ] && [ "$N" != "" ]; then FILLED=yes; break; fi
  sleep 2
done

# État du panneau + console errors + points globe
STATE=$(agent-browser eval "(() => {
  const errors=[];
  const panels=[...document.querySelectorAll('div')].filter(d=>/FLIGHT TRACKER/.test(d.textContent||'')&&d.querySelectorAll('div').length<40);
  const p=panels[panels.length-1];
  let src='?',cnt='?';
  if(p){ const root=p.parentElement.parentElement;
    const s=[...root.querySelectorAll('span')].find(x=>/SRC:/.test(x.textContent));
    if(s)src=s.textContent.trim();
    const c=[...root.querySelectorAll('span')].find(x=>/ACTIVE/.test(x.textContent));
    if(c)cnt=c.textContent.trim(); }
  return JSON.stringify({src,cnt});
})()" 2>/dev/null | sed 's/"//g')
echo "PANNEAU: $STATE | rempli: $FILLED"

agent-browser console --level error > /tmp/console-err.txt 2>&1 || true
echo "console errors: $(wc -l < /tmp/console-err.txt)"

agent-browser screenshot --full-page false "$OUT/task32-flytracker-live.png" >/dev/null 2>&1
echo "shot full: $OUT/task32-flytracker-live.png"

# Crop zoom sur le panneau FLIGHT TRACKER (colonne droite)
python3 - <<'EOF'
from PIL import Image
img = Image.open('/home/z/my-project/download/task32-flytracker-live.png')
w, h = img.size
img.crop((int(w*0.72), int(h*0.08), w, int(h*0.78))).save('/home/z/my-project/download/task32-flytracker-panel.png')
print("crop panel: task32-flytracker-panel.png", img.size)
EOF
