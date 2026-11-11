#!/bin/bash
# Smoke test Task 28 : passe complète du MODE AUTONOME (~2:30) avec télémétrie.
OUT=/home/z/my-project/download
LAST=""
START=$(date +%s.%N)
CAPTURED=""

# Démarre le MODE AUTONOME via son bouton title
agent-browser eval "(() => { const btns = Array.from(document.querySelectorAll('button')); const auto = btns.find(b => (b.title||'').includes('MODE AUTONOME')); if (auto) { auto.click(); return 'tour-started'; } return 'no-btn'; })()" 2>/dev/null | tail -1
echo ">>> tour démarré"

for i in $(seq 1 75); do
  S=$(agent-browser eval "(() => {
    const q = (s) => document.querySelector(s);
    const label = q('.at-chip-label')?.textContent ?? null;
    const finale = !!q('.at-finale');
    const logo = !!q('.at-finale-logo');
    const veil = !!q('.at-veille-deep');
    const music = q('audio[data-horus-music]');
    const citation = q('.at-finale-cite, .at-finale .at-mono, .at-finale [class*=cite]')?.textContent?.length ?? null;
    return {label, finale, logo, veil, vol: music ? Math.round(music.volume*1000)/1000 : null, paused: music ? music.paused : null, citation};
  })()" 2>/dev/null | tr -d '\n')
  NOW=$(date +%s.%N)
  EL=$(python3 -c "print(f'{$NOW-$START:.1f}')")
  L=$(echo "$S" | python3 -c "import sys,json,re; t=sys.stdin.read(); m=re.search(r'\{.*\}', t, re.S); d=json.loads(m.group(0)) if m else {}; print(d.get('label') or '')" 2>/dev/null)

  if [ -n "$L" ] && [ "$L" != "$LAST" ]; then
    echo "[$EL s] ÉTAPE: $L"
    SLUG=$(echo "$L" | sed "s/MODE AUTO · //" | tr ' ·' '__' | tr -cd '[:alnum:]_-' | cut -c1-28)
    agent-browser screenshot "$OUT/task28-tour-${SLUG}.png" >/dev/null 2>&1
    LAST="$L"
  fi

  # capture dédiée quand la finale apparaît (logo + citation)
  FIN=$(echo "$S" | python3 -c "import sys,json,re; t=sys.stdin.read(); m=re.search(r'\{.*\}', t, re.S); d=json.loads(m.group(0)) if m else {}; print('1' if d.get('finale') else '')" 2>/dev/null)
  if [ -n "$FIN" ] && [ -z "$CAPTURED" ]; then
    sleep 2
    agent-browser screenshot "$OUT/task28-finale-logo-citation.png" >/dev/null 2>&1
    echo "[$EL s] >>> finale capturée (logo=$(... )"
    CAPTURED="1"
  fi

  # fin : chip disparue = tour terminé
  if [ -z "$L" ] && [ -n "$LAST" ]; then
    echo "[$EL s] >>> chip disparue — tour terminé"
    break
  fi
  sleep 2.5
done

python3 -c "print(f'DURÉE CHRONOMÈTRE: {$(date +%s.%N)-$START:.1f} s')"

# état post-tour : console normale, barre réactive, musique toujours là
sleep 2
agent-browser eval "JSON.stringify({
  chipGone: !document.querySelector('.at-chip-label'),
  autoBtn: !!Array.from(document.querySelectorAll('button')).find(b => (b.title||'').includes('MODE AUTONOME')),
  music: !!document.querySelector('audio[data-horus-music]'),
  musicOn: document.querySelector('audio[data-horus-music]')?.paused === false,
  zoom: window.__osirisMapGetZoom ? Math.round(window.__osirisMapGetZoom()*10)/10 : null,
  cmdBar: !!document.querySelector('input[placeholder*="commande" i], input[placeholder*="command" i]')
})" 2>/dev/null | tail -3
