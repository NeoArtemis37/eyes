#!/usr/bin/env python3
"""Scan YouTube search results (live filter) for African TV channels.
Extracts videoId, channelId, channel name, live badge from ytInitialData."""
import json, re, subprocess, sys, urllib.parse

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36"

QUERIES = [
    "ORTM direct", "TFM direct", "RTS 1 Sénégal direct", "RTI 1 direct",
    "RTB Burkina direct", "2STV direct", "Walf TV direct", "Espace TV Guinée direct",
    "Afrique Média live", "TVC News live", "Arise News live", "Africanews live",
    "Télé Sahel Niger direct", "GTV Ghana live", "CRTV Cameroun live",
    "Canal 2 International Cameroun live", "NCI Côte d'Ivoire live",
    "Sèn TV direct", "Life TV Côte d'Ivoire live", "Maliweb TV live",
]

def fetch(url):
    try:
        r = subprocess.run(["curl", "-s", "-m", "25", "-L", "-A", UA, url],
                           capture_output=True, text=True, timeout=40)
        return r.stdout
    except Exception:
        return ""

def extract_yt_initial(html):
    m = re.search(r"var ytInitialData = (\{.*?\});</script>", html, re.S)
    if not m:
        m = re.search(r'window\["ytInitialData"\]\s*=\s*(\{.*?\});', html, re.S)
    if not m:
        return None
    try:
        return json.loads(m.group(1))
    except Exception:
        return None

def walk_video_renderers(obj, out):
    if isinstance(obj, dict):
        if "videoRenderer" in obj:
            vr = obj["videoRenderer"]
            vid = vr.get("videoId", "")
            title = ""
            tr = vr.get("title", {}).get("runs", [])
            if tr: title = tr[0].get("text", "")
            owner = vr.get("ownerText", {}).get("runs", [])
            ch_name, ch_id = "", ""
            if owner:
                ch_name = owner[0].get("text", "")
                nav = owner[0].get("navigationEndpoint", {}).get("browseEndpoint", {})
                ch_id = nav.get("browseId", "")
            badges = vr.get("badges", [])
            is_live = any(b.get("metadataBadgeRenderer", {}).get("label", "").upper().startswith("LIVE") or
                          b.get("metadataBadgeRenderer", {}).get("label", "").upper().startswith("EN DIRECT")
                          for b in badges)
            # style: LIVE = live now
            out.append((vid, ch_id, ch_name, title[:90], is_live))
        for v in obj.values():
            walk_video_renderers(v, out)
    elif isinstance(obj, list):
        for v in obj:
            walk_video_renderers(v, out)

results = {}
for q in QUERIES:
    url = "https://www.youtube.com/results?search_query=" + urllib.parse.quote(q) + "&sp=EgJAAQ%253D%253D"
    html = fetch(url)
    data = extract_yt_initial(html)
    rows = []
    if data:
        walk_video_renderers(data, rows)
        # dedupe by videoId, keep order, live first
        seen, uniq = set(), []
        for r in rows:
            if r[0] and r[0] not in seen:
                seen.add(r[0]); uniq.append(r)
        rows = uniq[:6]
    results[q] = rows
    line = f"\n== {q} =="
    print(line, file=sys.stderr)
    for vid, cid, cn, ti, live in rows:
        print(f"  {vid} | {cid} | {cn} | LIVE={live} | {ti}", file=sys.stderr)

with open("/home/z/my-project/scripts/yt-search-scan.json", "w") as f:
    json.dump({q: [list(r) for r in rows] for q, rows in results.items()}, f, indent=1, ensure_ascii=False)
print("saved yt-search-scan.json", file=sys.stderr)
