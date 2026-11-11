#!/usr/bin/env python3
# Task 32 — vérification live du MODE AUTONOME complet :
# globe 3D + rotation, 3 caméras (et non 5), musique PHONK en lecture,
# orchestration réseaux (1 box à la fois), zéro erreur de page.
import subprocess, json, time, os

SHOT = '/home/z/my-project/scripts/task32-live'
os.makedirs(SHOT, exist_ok=True)

def ab(*args, timeout=30):
    r = subprocess.run(['agent-browser', *args], capture_output=True, text=True, timeout=timeout)
    return ((r.stdout or '') + (r.stderr or '')).strip()

def ev(js, timeout=30):
    return ab('eval', js, timeout=timeout)

def shot(name):
    ab('screenshot', f'{SHOT}/{name}.png', timeout=30)

def errors():
    out = ab('errors', timeout=20)
    return [l for l in out.splitlines() if l.strip() and not l.startswith(('✓', '✗'))]

# JS de sondage (une seule chaîne, pas de regex exotique)
POLL_JS = (
  "(() => {"
  " const chip = document.querySelector('.at-chip-label');"
  " const audio = [...document.querySelectorAll('audio')].find(a => a.hasAttribute('data-horus-music'));"
  " const openPanels = [...document.querySelectorAll('.net-overlay .panel.is-open .panel__title')].map(e => e.textContent.trim());"
  " const phase = document.querySelector('.net-root') ? 'intel' : 'surveillance';"
  " const camCard = [...document.querySelectorAll('.at-card')].map(e => e.textContent).find(t => t.indexOf('Cam') >= 0 && t.indexOf('/') >= 0) || '';"
  " const recon = !!document.querySelector('.net-recon.is-open');"
  " return JSON.stringify({"
  "  label: chip ? chip.textContent.replace('MODE AUTO \u00b7 ', '') : null,"
  "  music: audio ? {src: (audio.src||'').split('/').pop(), paused: audio.paused, t: +audio.currentTime.toFixed(1), vol: audio.volume} : null,"
  "  openPanels, phase, recon, camCard: camCard.slice(0, 44)"
  " }); })()"
)

# ── départ : page fraîche ────────────────────────────────────────────
print('=== reload + login state ===')
ab('reload')
time.sleep(7)
sess = ev("sessionStorage.getItem('horus-session')")
print('session:', sess)
if '"1"' not in sess and sess != '1':
    print('!! pas de session — re-login démo')
    ab('find', 'text', 'ACCÈS DÉMO · CLIQUER POUR PRÉ-REMPLIR', 'click', timeout=30)
    time.sleep(0.6)
    ab('find', 'role', 'button', 'click', '--name', 'ENTRER DANS LA CONSOLE', timeout=30)
    time.sleep(6)
ev("localStorage.setItem('horus-onboarded','1')")

before = ev(POLL_JS)
print('état avant tour:', before)

# ── lancement MODE AUTONOME par clic réel ────────────────────────────
print('=== clic MODE AUTONOME ===')
r = ab('find', 'role', 'button', 'click', '--name', 'MODE AUTONOME', timeout=30)
print('click:', r[-60:] if r else 'ok')
time.sleep(3)

t0 = time.time()
last_label = None
steps_seen = []
cam_titles = set()
music_polls = 0
music_ok = 0
music_name = None
net_checks = []

while time.time() - t0 < 400:
    raw = ev(POLL_JS)
    try:
        s = json.loads(raw)
        if isinstance(s, str):
            s = json.loads(s)  # agent-browser double-encode parfois
    except Exception:
        s = {}
    label = s.get('label')
    m = s.get('music')
    if m:
        music_polls += 1
        music_name = m.get('src')
        if not m['paused'] and 'phonk' in str(m.get('src', '')):
            music_ok += 1
    cc = s.get('camCard') or ''
    if cc and '/' in cc:
        cam_titles.add(cc[:16])
    if label and label != last_label:
        last_label = label
        steps_seen.append(label)
        print(f"[{time.time()-t0:6.1f}s] ÉTAPE · {label} · phase={s.get('phase')} · panels={s.get('openPanels')}")
        shot(f'step-{len(steps_seen):02d}-{label.replace(" ", "_").replace("/", "-")}')
        if s.get('phase') == 'intel':
            net_checks.append((label, s.get('openPanels'), s.get('recon')))
    if not label and steps_seen:
        print(f'[{time.time()-t0:.1f}s] tour terminé (chip parti)')
        break
    time.sleep(5)

dur = time.time() - t0
print(f'=== durée: {dur:.1f}s · étapes ({len(steps_seen)}):', ' → '.join(steps_seen))
print(f'=== musique: {music_ok}/{music_polls} polls en lecture · piste={music_name}')
print('=== titres caméra vus:', sorted(cam_titles))
print('=== checks réseau (étape, panels ouverts, recon):')
for c in net_checks:
    print('   ', c)
errs = errors()
print('=== erreurs de page:', errs if errs else 'AUCUNE')
shot('after-tour-end')
