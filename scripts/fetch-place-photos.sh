#!/bin/bash
# Télécharge les photos des lieux visités par le MODE AUTO (Wikimedia, usage libre)
set -e
mkdir -p /home/z/my-project/public/place
cd /home/z/my-project/public/place

fetch () {
  local api="$1" out="$2"
  echo "== $out =="
  thumb=$(curl -s --max-time 25 -H "Api-User-Agent: EyeOfView/1.0 (educational demo)" "$api" | python3 -c "import sys,json;d=json.load(sys.stdin);print(d.get('thumbnail',{}).get('source','') or d.get('originalimage',{}).get('source',''))")
  if [ -z "$thumb" ]; then echo "  PAS DE THUMB"; return 1; fi
  curl -s --max-time 40 -o "$out" "$thumb"
  ls -la "$out"
}

fetch "https://fr.wikipedia.org/api/rest_v1/page/summary/Grande_Mosqu%C3%A9e_d%27Agadez" agadez.jpg || true
fetch "https://fr.wikipedia.org/api/rest_v1/page/summary/Grande_Mosqu%C3%A9e_de_Djenn%C3%A9" djenné.jpg || true
fetch "https://en.wikipedia.org/api/rest_v1/page/summary/Great_Mosque_of_Bobo-Dioulasso" bobo.jpg || true
fetch "https://fr.wikipedia.org/api/rest_v1/page/summary/10_Downing_Street" downing.jpg || true

echo "--- Vérification type MIME ---"
file *.jpg 2>/dev/null || true
