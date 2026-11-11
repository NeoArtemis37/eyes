#!/bin/bash
# Captures synchronisées du tour auto — t0 écrit APRÈS le clic (≈ départ exact)
D=/home/z/my-project/download
rm -f "$D"/task24-0[3-9]*.png "$D"/task24-1*.png
agent-browser press Escape
sleep 3
agent-browser click @e4
date +%s.%N > /tmp/tour-t0.txt
T0=$(cat /tmp/tour-t0.txt)
echo "T0=$T0"
shoot_at () {
  local off="$1" name="$2"
  local now=$(date +%s.%N)
  local d=$(awk -v t0="$T0" -v off="$off" -v now="$now" 'BEGIN{d=t0+off-now; if(d>0) printf "%.3f", d; else print "0"}')
  sleep "$d"
  agent-browser screenshot "$D/task24-$name.png" >/dev/null 2>&1
  echo "shot $name @ +${off}s"
}

shoot_at 9.9  03-warp-cams
shoot_at 15   04-cam1-stream
shoot_at 21.5 05-cam2-stream
shoot_at 28   06-cam3-stream
shoot_at 34.5 07-agadez-orbite
shoot_at 41   08-djenne-brief
shoot_at 47   09-bobo-brief
shoot_at 51.2 10-inter-transition
shoot_at 55.5 11-reseau
shoot_at 61   13-fuites
shoot_at 67   14-recon-photo
shoot_at 71.5 15-graphe
shoot_at 77   16-finale
