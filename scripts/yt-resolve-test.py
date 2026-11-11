#!/usr/bin/env python3
"""Test extraction patterns for the /channel/UC.../live resolver (live + not-live cases)."""
import re, subprocess

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36"

CHANS = [
    ("Channels TV", "UCEXGDNclvmg6RW0vipJYsTQ"),      # live 24/7
    ("Afrique Média", "UCRbl6jKfG5441ZojKXx5nkw"),    # live 24/7
    ("Africanews", "UC1_E8NeF5QHY2dtdLRBCCLA"),       # live 24/7
    ("ORTM (Mali)", "UCQhdHZkL2eOBu66gNMCawag"),      # local, live partiel
    ("RTS 1 (SN)", "UC3Pwur55-OPFYDN_xg6JR_w"),       # local, live partiel
    ("Djoma TV (GN)", "UCJXdAn2Ik88AQn1vZ1AYPbg"),    # local
    ("JoyNews (GH)", "UChd1DEecCRlxaa0-hvPACCw"),     # live 24/7
]

def fetch(url):
    try:
        r = subprocess.run(["curl", "-s", "-m", "25", "-L", "-A", UA, url],
                           capture_output=True, text=True, timeout=40)
        return r.stdout
    except Exception:
        return ""

for name, cid in CHANS:
    html = fetch(f"https://www.youtube.com/channel/{cid}/live")
    if len(html) < 5000:
        print(f"{name:16} -> FETCH FAIL ({len(html)}B)")
        continue
    # player response scoped extraction
    i = html.find("ytInitialPlayerResponse")
    seg = html[i:i+3000] if i >= 0 else ""
    vid = re.search(r'"videoId":"([A-Za-z0-9_-]{11})"', seg)
    vid_any = re.search(r'"videoId":"([A-Za-z0-9_-]{11})"', html)
    isl = '"isLive":true' in html
    ilc = re.search(r'"isLiveContent":(true|false)', seg)
    slate = "liveStreamOfflineSlate" in html
    title = re.search(r'<meta name="title" content="([^"]{0,80})', html)
    print(f"{name:16} playerVid={vid.group(1) if vid else (vid_any.group(1) if vid_any else 'NONE'):12} "
          f"isLive={isl} ilc={ilc.group(1) if ilc else '-'} slate={slate} | {title.group(1) if title else ''}")
