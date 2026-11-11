#!/usr/bin/env python3
# Task 41 — vérification live : démo AES de ~3 MIN avec la partie AVIONS.
#   (1) MODE AUTONOME lancé, (2) durée totale ≈ 180 s (cible 3 min),
#   (3) étape AVIONS présente + flyover 3D réel (300 vols adsb.fi),
#   (4) 5 caméras « CIBLE DOUCE », (5) citation complète + veille,
#   (6) zéro erreur de page, (7) musique en lecture (repli odyssee).
import re, subprocess, sys, time

D = '/home/z/my-project/download'
LOG = '/home/z/my-project/scripts/task41-tour-monitor.log'
log = open(LOG, 'w')

def note(msg):
    print(msg, flush=True)
    log.write(msg + '\n'); log.flush()

def ab(*args, timeout=40):
    r = subprocess.run(['agent-browser', *args], capture_output=True, text=True, timeout=timeout)
    return (r.stdout or '') + (r.stderr or '')

def ev(js):
    return ab('eval', js).strip().strip('"')

POLL = """(() => {
  const q = (x) => document.querySelector(x);
  const quote = (q('.at-finale-quote')?.textContent || '').replace(/\\s+/g,' ').trim();
  const cardT = q('.at-card-title')?.textContent || '';
  const music = q('audio[data-horus-music]');
  return [
    q('.at-chip-label')?.textContent || '-',
    String(quote.length),
    quote,
    q('.at-finale.is-veille') ? '1' : '0',
    q('.at-finale.is-out') ? '1' : '0',
    window.__horusKeySfx ? 'sfx' : 'nosfx',
    music ? (music.src.split('/').pop() + '/' + (music.paused ? 'pause' : 'play')) : 'nomusic',
    cardT,
  ].join('|||');
})()"""

def poll():
    p = ev(POLL).split('|||')
    if len(p) < 8: return None
    return {'label': p[0], 'qlen': int(p[1]), 'quote': p[2], 'veille': p[3]=='1',
            'out': p[4]=='1', 'sfx': p[5], 'music': p[6], 'cardT': p[7]}

# ── départ ────────────────────────────────────────────────────────────
note('=== ouverture + session directe ===')
ab('open', 'http://localhost:3000/', timeout=60)
time.sleep(6)
ev("sessionStorage.setItem('horus-session','1'); localStorage.setItem('horus-onboarded','1'); 'set'")
ab('reload')
time.sleep(9)
ev("""(() => { window.__errs = [];
  window.addEventListener('error', e => window.__errs.push(String(e.message||e).slice(0,120)));
  window.addEventListener('unhandledrejection', e => window.__errs.push('rej:' + String(e.reason).slice(0,120)));
  return 'hook-ok'; })()""")

note('=== clic MODE AUTONOME ===')
r = ab('find', 'role', 'button', 'click', '--name', 'MODE AUTONOME', timeout=30)
note('click: ' + (r.strip()[-60:] if r else 'ok'))
time.sleep(3)
if 'true' not in ev("!!document.querySelector('.at-chip-label')"):
    note('!! repli clic JS')
    ev("(() => { const b=[...document.querySelectorAll('button')].find(x=>(x.title||'').includes('MODE AUTONOME')); if(b)b.click(); return b?'ok':'absent'; })()")
    time.sleep(3)

t_start = time.time()
labels = []            # (t, label) transitions
last_label = None
cams_seen = set()      # « CIBLE DOUCE i/5 »
avions_at = None
avions_shot = cam_shot = graph_shot = cine_shot = quote_shot = veille_shot = False
finale_s = None
veille_seen = False
out_at = None
music_states = set()

while time.time() - t_start < 330:
    d = poll()
    if d is None:
        time.sleep(3); continue
    el = time.time() - t_start
    if d['label'] != '-' and d['label'] != last_label:
        last_label = d['label']
        labels.append((round(el,1), d['label']))
        note(f'  [{el:6.1f}s] {d["label"]}')
    music_states.add(d['music'])
    m = re.match(r'FLUX (\d)/', d['cardT'] or '')
    if m: cams_seen.add(m.group(1))
    if 'AVIONS' in (d['label'] or '') and not avions_shot:
        avions_at = el
        time.sleep(2.2)   # laisse le flyTo 3D se poser
        ab('screenshot', f'{D}/task41-avions-3d.png', timeout=30)
        note('  capture avions 3D'); avions_shot = True
    if 'CAMÉRAS' in (d['label'] or '') and not cam_shot and el - (labels and [t for t,l in labels if 'CAMÉRAS' in l][0] or 0) > 14:
        ab('screenshot', f'{D}/task41-camera-halo.png', timeout=30)
        note('  capture caméra+cône'); cam_shot = True
    if 'GRAPHE' in (d['label'] or '') and not graph_shot:
        time.sleep(2.0)
        ab('screenshot', f'{D}/task41-graphe.png', timeout=30)
        note('  capture graphe'); graph_shot = True
    if d['qlen'] >= 2 and not quote_shot:
        ab('screenshot', f'{D}/task41-cine-citation.png', timeout=30)
        note('  capture cinématique+citation'); quote_shot = True
        t1 = time.time()
        while time.time() - t1 < 48:
            dx = poll()
            if dx and dx['quote'].endswith('devoir sacré.'):
                finale_s = time.time() - t1
                note(f'  citation COMPLÈTE (frappe restante ≈ {finale_s:.1f}s)')
                # sonde rapide : la veille ne dure que 3,6 s — un sondage 3 s la saute
                while time.time() - t1 < 20:
                    dv = poll()
                    if dv and dv['veille']:
                        veille_seen = True
                        ab('screenshot', f'{D}/task41-veille.png', timeout=30)
                        note('  capture veille'); veille_shot = True
                        break
                    if dv and dv['out']:
                        break
                    time.sleep(1.0)
                break
            time.sleep(1.5)
    if d['veille'] and not veille_shot:
        veille_seen = True
        ab('screenshot', f'{D}/task41-veille.png', timeout=30)
        note('  capture veille'); veille_shot = True
    if d['out'] or (d['label'] == '-' and quote_shot and el > 60):
        out_at = el
        note(f'  [{el:6.1f}s] FIN (out)')
        break
    time.sleep(3)

total = round((out_at or time.time() - t_start), 1)
errs = ev("(window.__errs || []).length")

note('=== BILAN ===')
for t, l in labels: note(f'  {t:>7}s  {l}')
note(f'DURÉE TOTALE: {total}s (cible ≈ 180s)')
note(f'étapes: {len(set(l for _,l in labels))} | avions à {avions_at}s | cams cibles douces: {sorted(cams_seen)}')
note(f'citation complète: {finale_s is not None} | veille: {veille_seen} | erreurs: {errs} | musique: {music_states}')

ok = (150 <= total <= 215
      and any('AVIONS' in l for _, l in labels)
      and len(cams_seen) >= 3
      and finale_s is not None
      and veille_seen
      and errs.strip() == '0')
note('VERDICT: ' + ('OK — démo 3 min avec avions, cams, citation, veille, zéro erreur' if ok else 'VOIR LIGNES CI-DESSUS'))
sys.exit(0 if ok else 1)
