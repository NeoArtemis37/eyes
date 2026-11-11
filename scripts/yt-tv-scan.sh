#!/bin/bash
# Scan YouTube /live pages of African TV channels → channelId, current live videoId, isLive
UA="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36"
OUT=/home/z/my-project/scripts/yt-tv-results.txt
: > "$OUT"

declare -a URLS=(
  "https://www.youtube.com/channel/UCQhdHZkL2eOBu66gNMCawag/live"     # ORTM Mali
  "https://www.youtube.com/channel/UCP4vfTp-qgwcXIOlLn9knmw/live"     # ORTM en direct
  "https://www.youtube.com/channel/UCWHvgOMS0wV0igd-16cAz7g/live"     # ORTM TV nationale
  "https://www.youtube.com/@tfmsn/live"                                # TFM Sénégal
  "https://www.youtube.com/@rts-radiotelevisionsenegalaise/live"       # RTS Sénégal
  "https://www.youtube.com/@RTS1SN/live"                               # RTS1
  "https://www.youtube.com/@rtici/live"                                # RTI Côte d'Ivoire
  "https://www.youtube.com/@rtburkina/live"                            # RTB Burkina
  "https://www.youtube.com/@afriquemediatv/live"                       # Afrique Média
  "https://www.youtube.com/@walftv/live"                               # Walf TV Sénégal
  "https://www.youtube.com/@2stv/live"                                 # 2STV Sénégal
  "https://www.youtube.com/@espacetvguinee/live"                       # Espace TV Guinée
  "https://www.youtube.com/@TVCConnect/live"                           # TVC News Nigeria
  "https://www.youtube.com/@AriseTV/live"                              # Arise News
  "https://www.youtube.com/@africanews/live"                           # Africanews
  "https://www.youtube.com/@CRTV/live"                                 # CRTV Cameroun
  "https://www.youtube.com/@JoyNewsOnTV/live"                          # Joy News Ghana
  "https://www.youtube.com/@Radiot%C3%A9l%C3%A9visionburkinabeRTB/live" # RTB alt
)

for u in "${URLS[@]}"; do
  f=$(mktemp)
  curl -s -m 25 -L -A "$UA" "$u" -o "$f"
  size=$(wc -c < "$f")
  cid=$(rg -o -m1 '"channelId":"UC[A-Za-z0-9_-]{20,}"' "$f" 2>/dev/null | head -1 | rg -o 'UC[A-Za-z0-9_-]{20,}' )
  vid=$(rg -o -m1 '"videoId":"[A-Za-z0-9_-]{8,12}"' "$f" 2>/dev/null | head -1 | rg -o '[A-Za-z0-9_-]{8,12}')
  live=$(rg -o -m1 '"isLive":(true|false)' "$f" 2>/dev/null | head -1)
  title=$(rg -o -m1 '<title>[^<]{0,120}' "$f" 2>/dev/null | head -1 | sed 's/<title>//')
  echo "URL: $u" >> "$OUT"
  echo "  size=$size channelId=$cid videoId=$vid $live" >> "$OUT"
  echo "  title=$title" >> "$OUT"
  rm -f "$f"
done
cat "$OUT"
