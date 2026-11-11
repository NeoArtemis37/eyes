#!/bin/bash
# Passe propre Task 28 : MODE AUTONOME complet SANS onboarding superposé.
# Démarrage par clic CDP de confiance (activation utilisateur => musique doit partir).
OUT=/home/z/my-project/download
LAST=""
CAPTURED=""
MUSICLOG=/home/z/my-project/scripts/task29-music-timeline.log
: > "$MUSICLOG"
START=$(date +%s.%N)

# clic de confiance sur le bouton MODE AUTONOME
agent-browser click 'button[title*="MODE AUTONOME"]' 2>&1 | tail -1
sleep 1.5
agent-browser eval "JSON.stringify({musicPaused: document.querySelector('audio[data-horus-music]')?.paused, musicT: document.querySelector('audio[data-horus-music]')?.currentTime})" 2>/dev/null | tail -1

for i in $(seq 1 75); do
  S=$(agent-browser eval "(() => {
    const q = (s) => document.querySelector(s);
    const label = q('.at-chip-label')?.textContent ?? null;
    const finale = !!q('.at-finale');
    const veil = !!q('.at-veille-deep');
    const music = q('audio[data-horus-music]');
    return {label, finale, veil, vol: music ? Math.round(music.volume*1000)/1000 : null, paused: music ? music.paused : null, t: music ? Math.round(music.currentTime*10)/10 : null};
  })()" 2>/dev/null | tr -d '\n')
  NOW=$(date +%s.%N)
  EL=$(python3 -c "print(f'{$NOW-$START:.1f})" 2>/dev/null || python3 -c "print(f'{$NOW-$START:.1f}')")
  L=$(echo "$S" | python3 -c "import sys,json,re; t=sys.stdin.read(); m=re.search(r'\{.*\}', t, re.S); d=json.loads(m.group(0)) if m else {}; print(d.get('label') or '')" 2>/dev/null)
  # journal musique
  echo "[$EL] $S" >> "$MUSICLOG"

  if [ -n "$L" ] && [ "$L" != "$LAST" ]; then
    echo "[$EL s] ÉTAPE: $L"
    SLUG=$(echo "$L" | sed "s/MODE AUTO · //" | tr ' ·' '__' | tr -cd '[:alnum:]_-' | cut -c1-28)
    agent-browser screenshot "$OUT/task29-${SLUG}.png" >/dev/null 2>&1
    LAST="$L"
  fi

  FIN=$(echo "$S" | python3 -c "import sys,json,re; t=sys.stdin.read(); m=re.search(r'\{.*\}', t, re.S); d=json.loads(m.group(0)) if m else {}; print('1' if d.get('finale') else '')" 2>/dev/null)
  if [ -n "$FIN" ] && [ -z "$CAPTURED" ]; then
    sleep 2.2
    agent-browser screenshot "$OUT/task29-finale-logo-citation.png" >/dev/null 2>&1
    CIT=$(agent-browser eval "document.querySelector('.at-finale-quote')?.textContent?.length" 2>/dev/null | tail -1)
    echo "[$EL s] >>> finale capturée (citation: $CIT car)"
    CAPTURED="1"
  fi

  if [ -z "$L" ] && [ -n "$LAST" ]; then
    echo "[$EL s] >>> chip disparue — tour terminé"
    break
  fi
  sleep 2.5
done

python3 -c "print(f'DURÉE CHRONOMÈTRE: {$(date +%s.%N)-$START:.1f} s')"

sleep 2
agent-browser eval "JSON.stringify({
  chipGone: !document.querySelector('.at-chip-label'),
  catcherGone: !document.querySelector('.at-catcher'),
  onboardingGone: !document.querySelector('.tour-card'),
  music: !!document.querySelector('audio[data-horus-music]'),
  musicPlaying: document.querySelector('audio[data-horus-music]')?.paused === false,
  zoom: window.__osirisMapGetZoom ? Math.round(window.__osirisMapGetZoom()*10)/10 : null
})" 2>/dev/null | tail -3
