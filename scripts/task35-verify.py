#!/usr/bin/env python3
# Task 35 — vérification live de l'état livré (après reprise de session) :
#   (1) aucun segment VOLS dans le tour, (2) 5 caméras, (3) exemples RECON
#   (adresse + SHODAN), (4) graphe à pays aléatoire, (5) musique choisie
#   (atlasaudio), (6) globe entier visible, (7) panels réseaux un à un,
#   (8) finale pitch, (9) zéro erreur de page.
import json, re, subprocess, sys, time

D = '/home/z/my-project/download'
LOG = '/home/z/my-project/scripts/task35-tour-monitor.log'
log = open(LOG, 'w')

def note(msg):
    print(msg, flush=True)
    log.write(msg + '\n'); log.flush()

def ab(*args, timeout=40):
    r = subprocess.run(['agent-browser', *args], capture_output=True, text=True, timeout=timeout)
    return (r.stdout or '') + (r.stderr or '')

def ev(js):
    out = ab('eval', js)
    # agent-browser double-encode parfois : on extrait le JSON
    m = re.search(r'\{.*\}', out, re.S)
    return m.group(0) if m else out.strip()

POLL = """(() => {
  const q = (s) => document.querySelector(s);
  const chip = q('.at-chip-label')?.textContent || null;
  const count = q('.at-chip-count')?.textContent || null;
  const card = (q('.at-card-body')?.textContent || '').slice(0, 110);
  const music = q('audio[data-horus-music]');
  const reconInput = q('input[data-recon-input]');
  const reconBody = (q('.net-recon__body, .net-recon .is-open, [data-tour="net-recon"]')?.textContent || '')
    .replace(/\\s+/g, ' ').slice(0, 160);
  const sidePanels = [...document.querySelectorAll('.net-col')].filter(e => {
    const r = e.getBoundingClientRect();
    return r.width > 40 && r.height > 40 && e.offsetParent !== null;
  }).map(e => e.dataset.tour || '?');
  const canvas = q('.maplibregl-canvas');
  const finale = !!q('.at-finale');
  const monument = !!q('.at-monument');
  return JSON.stringify({chip, count, card, finale, monument,
    music: music ? {src: (music.src||'').split('/').pop(), paused: music.paused,
                   t: +music.currentTime.toFixed(1), vol: music.volume} : null,
    reconVal: reconInput ? reconInput.value : null, reconBody, sidePanels,
    canvas: canvas ? {w: canvas.clientWidth, h: canvas.clientHeight} : null});
})()"""

# ── départ : page fraîche ────────────────────────────────────────────
note('=== ouverture page + session directe (horus-session=1) ===')
ab('open', 'http://localhost:3000/', timeout=60)
time.sleep(6)
# session posée directement puis reload : page.tsx restaure la session
# au montage (« session restaurée : pas de LoginGate ») — pas de clic
# fragile sur les écrans d'intro/login.
ev("sessionStorage.setItem('horus-session','1'); localStorage.setItem('horus-onboarded','1'); 'set'")
ab('reload')
time.sleep(9)
sess = ev("sessionStorage.getItem('horus-session')")
gate = ev("!!document.querySelector('input[placeholder*=\"IDENTIFIANT\"]')")
note(f'session: {sess} | loginGate visible: {gate}')
if sess.strip('"') != '1' or 'true' in str(gate):
    # repli : login démo par clics JS directs (pas d'interception possible)
    note('!! repli login démo par clics JS')
    ev("""(() => {
      const demo = [...document.querySelectorAll('button')].find(b => (b.textContent||'').includes('ACCÈS DÉMO'));
      if (demo) demo.click();
      return demo ? 'filled' : 'no-demo-btn';
    })()""")
    time.sleep(0.8)
    ev("""(() => {
      const enter = [...document.querySelectorAll('button')].find(b => (b.textContent||'').includes('ENTRER DANS LA CONSOLE'));
      if (enter) enter.click();
      return enter ? 'entered' : 'no-enter-btn';
    })()""")
    time.sleep(8)
ev("localStorage.setItem('horus-onboarded','1')")
time.sleep(1)

# erreurs de page : sondage JS continu via un hook posé une fois
ev("""(() => { window.__errs = [];
  window.addEventListener('error', e => window.__errs.push(String(e.message||e).slice(0,120)));
  window.addEventListener('unhandledrejection', e => window.__errs.push('rej:' + String(e.reason).slice(0,120)));
  return 'hook-ok'; })()""")

# ── lancement du tour ────────────────────────────────────────────────
note('=== clic MODE AUTONOME ===')
r = ab('find', 'role', 'button', 'click', '--name', 'MODE AUTONOME', timeout=30)
note('click: ' + (r.strip()[-80:] if r else 'ok'))
time.sleep(3)
chk = ev("!!document.querySelector('.at-chip-label')")
if 'true' not in str(chk):
    note('!! repli : clic JS direct MODE AUTONOME')
    ev("""(() => {
      const b = [...document.querySelectorAll('button')].find(x => (x.title||'').includes('MODE AUTONOME'));
      if (b) b.click();
      return b ? 'js-clicked' : 'absent';
    })()""")
    time.sleep(3)

t0 = time.time()
seen_steps = []
cam_flux_max = 0
recon_shots = {'adresse': 0, 'shodan': 0}
graph_country = None
panels_by_phase = {}
finale_shot = 0
cams_shot = 0
music_reads = []
labels_seen = set()
graph_shot = 0

while time.time() - t0 < 400:
    try:
        s = ev(POLL)
        d = json.loads(s)
        if isinstance(d, str):
            d = json.loads(d)
    except Exception:
        time.sleep(3)
        continue

    chip = d.get('chip') or ''
    label = chip.replace('MODE AUTO · ', '') if chip else None
    if label and label not in labels_seen:
        labels_seen.add(label)
        note(f'[{time.time()-t0:6.1f}s] ÉTAPE: {label} ({d.get("count")})')

    if d.get('music'):
        music_reads.append(d['music'])

    # détection caméras X/5
    m = re.search(r'flux (\d+)/(\d+)', d.get('card') or '')
    if m:
        cam_flux_max = max(cam_flux_max, int(m.group(2)))
        if cams_shot < int(m.group(1)) and int(m.group(1)) >= 2:
            ab('screenshot', f'{D}/task35-cams.png', timeout=30)
            cams_shot = int(m.group(1))
            note(f'[{time.time()-t0:6.1f}s] capture cams flux {m.group(1)}/{m.group(2)}')

    # recon : valeur du champ + capture
    rv = d.get('reconVal')
    if rv:
        if 'Downing' in rv and not recon_shots['adresse']:
            time.sleep(4)
            ab('screenshot', f'{D}/task35-recon-adresse.png', timeout=30)
            recon_shots['adresse'] = 1
            note(f'[{time.time()-t0:6.1f}s] RECON champ = "{rv}" + capture')
        if '8.8.8.8' in rv and not recon_shots['shodan']:
            time.sleep(4)
            ab('screenshot', f'{D}/task35-recon-shodan.png', timeout=30)
            recon_shots['shodan'] = 1
            note(f'[{time.time()-t0:6.1f}s] RECON champ = "{rv}" + capture')

    # graphe : pays tiré au hasard (carte titre « Graphe du/de … »)
    if not graph_country:
        mg = re.search(r'^(Graphe)\b', d.get('card') or '')
        mt = re.search(r'graphe (d[uêe]?\s*|de la\s*|des\s*|de l’\s*)?([A-ZÉÀÂÎÔÛ][\wéèêàâîôûç’\- ]{2,30})', (d.get('card') or ''), re.I)
        if label == 'GRAPHE':
            graph_country = d.get('card')[:80]
            time.sleep(6)
            ab('screenshot', f'{D}/task35-graphe.png', timeout=30)
            note(f'[{time.time()-t0:6.1f}s] GRAPHE carte: {graph_country} + capture')

    # panels latéraux par étape réseaux
    if label and d.get('sidePanels'):
        key = label.split('·')[0].strip()
        panels_by_phase[key] = d['sidePanels']

    # finale
    if d.get('finale') and not finale_shot:
        ab('screenshot', f'{D}/task35-finale.png', timeout=30)
        finale_shot = 1
        note(f'[{time.time()-t0:6.1f}s] FINALE visible + capture')

    # fin : chip disparue
    if not chip and labels_seen:
        note(f'[{time.time()-t0:6.1f}s] chip disparue — tour terminé')
        break
    time.sleep(3)

dur = time.time() - t0
errs = ev("JSON.stringify((window.__errs||[]).slice(0,6))")

note('')
note('══════ RAPPORT ══════')
note(f'durée tour           : {dur:.0f}s')
note(f'étapes vues          : {sorted(labels_seen)}')
note(f'segment VOLS         : {"ABSENT ✔" if not any("VOLS" in l or "FLIGHT" in l.upper() for l in labels_seen) else "PRÉSENT ✘"}')
note(f'nb caméras (X/N)     : {cam_flux_max} {"✔ (5 attendu)" if cam_flux_max == 5 else "✘"}')
note(f'recon adresse        : {"✔ saisie" if recon_shots["adresse"] else "✘ absent"}')
note(f'recon shodan         : {"✔ saisie" if recon_shots["shodan"] else "✘ absent"}')
note(f'graphe pays          : {graph_country or "✘ non vu"}')
note(f'panels par étape     : {json.dumps(panels_by_phase, ensure_ascii=False)}')
note(f'finale               : {"✔ vue" if finale_shot else "✘ non vue"}')
if music_reads:
    srcs = {m['src'] for m in music_reads}
    playing = sum(1 for m in music_reads if not m['paused'])
    note(f'musique              : src={srcs} — échantillons joués {playing}/{len(music_reads)} '
         f'{"✔" if playing > 0 else "✘"} (attendu atlasaudio-inspiration-epic.mp3)')
else:
    note('musique              : ✘ aucun échantillon')
note(f'erreurs de page      : {errs[:300]}')
note('captures             : task35-cams/recon-adresse/recon-shodan/graphe/finale.png')
log.close()
