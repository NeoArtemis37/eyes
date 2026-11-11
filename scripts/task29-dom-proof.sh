#!/bin/bash
# Preuve DOM des nouveaux textes du pitch : lecture de la carte à mi-étape.
OUT=/home/z/my-project/download
agent-browser click 'button[title*="MODE AUTONOME"]' 2>&1 | tail -1
START=$(date +%s.%N)

wait_label() { # attend un label, puis retourne
  for i in $(seq 1 90); do
    L=$(agent-browser eval "document.querySelector('.at-chip-label')?.textContent ?? ''" 2>/dev/null | tr -d '\n' | tr -d '"')
    if [ "$L" = "$1" ]; then return 0; fi
    sleep 1
  done
  return 1
}

echo ">>> attente CAMÉRAS…"
if wait_label "MODE AUTO · CAMÉRAS"; then
  sleep 6
  TXT=$(agent-browser eval "document.querySelector('[class*=at-card] [class*=mono], .at-card, [class*=at-card]')?.textContent ?? 'RIEN'" 2>/dev/null | tr -d '\n')
  echo "CARTE CAMÉRAS: $TXT"
  agent-browser screenshot "$OUT/task29-carte-cnn-apres-frappe.png" >/dev/null 2>&1
fi

echo ">>> attente RÉSEAU…"
if wait_label "MODE AUTO · RÉSEAU"; then
  sleep 5
  TXT=$(agent-browser eval "document.querySelector('[class*=at-card] [class*=mono], .at-card, [class*=at-card]')?.textContent ?? 'RIEN'" 2>/dev/null | tr -d '\n')
  echo "CARTE RÉSEAU: $TXT"
  agent-browser screenshot "$OUT/task29-carte-correlation-apres-frappe.png" >/dev/null 2>&1
fi

echo ">>> attente FIN…"
if wait_label "MODE AUTO · FIN"; then
  sleep 5
  Q=$(agent-browser eval "document.querySelector('.at-finale-quote')?.textContent ?? 'VIDE'" 2>/dev/null | tr -d '\n')
  echo "CITATION DOM: $Q"
  agent-browser screenshot "$OUT/task29-citation-complete-dom.png" >/dev/null 2>&1
  sleep 8   # veille
  agent-browser screenshot "$OUT/task29-veille-post-citation.png" >/dev/null 2>&1
fi

# sortie propre
agent-browser eval "window.dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape', code: 'Escape', bubbles: true})); 'esc'" >/dev/null 2>&1
sleep 2
agent-browser eval "JSON.stringify({chipGone: !document.querySelector('.at-chip-label'), musicOn: document.querySelector('audio[data-horus-music]')?.paused === false})" 2>/dev/null | tail -1
