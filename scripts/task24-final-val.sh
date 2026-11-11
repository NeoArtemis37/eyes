#!/bin/bash
# Validation finale : page fraîche → onboarding passé → tour → captures synchronisées
D=/home/z/my-project/download
rm -f "$D"/task24-v-*.png

agent-browser open http://localhost:3000/
agent-browser wait --load networkidle >/dev/null 2>&1
sleep 2
# Onboarding (nouvelle session) → PASSER si présent
agent-browser find role button click --name "PASSER" 2>/dev/null | tail -1
sleep 1
agent-browser find role button click --name "ENTRER DANS LA CONSOLE" 2>/dev/null | tail -1
sleep 2
agent-browser find role button click --name "ACCÈS DÉMO · CLIQUER POUR PRÉ-REMPLIR" 2>/dev/null | tail -1
agent-browser find role button click --name "ENTRER DANS LA CONSOLE" 2>/dev/null | tail -1
sleep 2
agent-browser find role button click --name "PASSER" 2>/dev/null | tail -1
sleep 1

# Tour
agent-browser find role button click --name "MODE AUTONOME" 2>&1 | tail -1
date +%s.%N > /tmp/tour-t0.txt
T0=$(cat /tmp/tour-t0.txt)
echo "T0=$T0"

shoot_at () {
  local off="$1" name="$2"
  local now=$(date +%s.%N)
  local d=$(awk -v t0="$T0" -v off="$off" -v now="$now" 'BEGIN{d=t0+off-now; if(d>0) printf "%.3f", d; else print "0"}')
  sleep "$d"
  agent-browser screenshot "$D/task24-v-$name.png" >/dev/null 2>&1
  echo "shot $name @ +${off}s"
}

shoot_at 8    01-vols-fiche
shoot_at 17   02-cam1-stream
shoot_at 21.5 03-cam2-stream
shoot_at 28   04-cam3-stream
shoot_at 38.5 05-agadez-orbite
shoot_at 44.5 06-djenne-brief
shoot_at 50.5 07-bobo-brief
shoot_at 56.5 08-inter-reseau
shoot_at 61.5 09-reseau-feed
shoot_at 66.5 10-fuites
shoot_at 72.5 11-recon-photo
shoot_at 77   12-graphe
shoot_at 84   13-finale
sleep 4
agent-browser screenshot "$D/task24-v-14-post-tour.png" >/dev/null 2>&1
echo "done"
