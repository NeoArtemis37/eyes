#!/usr/bin/env python3
"""Deep-check African TV YouTube channels: channelId, current live video, isLive."""
import re, subprocess, sys

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36"

CHANNELS = [
    # (label, live-page URL)
    ("ORTM Mali",            "https://www.youtube.com/channel/UCQhdHZkL2eOBu66gNMCawag/live"),
    ("ORTM en direct",       "https://www.youtube.com/channel/UCP4vfTp-qgwcXIOlLn9knmw/live"),
    ("ORTM TV nationale",    "https://www.youtube.com/channel/UCWHvgOMS0wV0igd-16cAz7g/live"),
    ("TFM Sénégal",          "https://www.youtube.com/@tfmsn/live"),
    ("RTS Sénégal",          "https://www.youtube.com/@rts-radiotelevisionsenegalaise/live"),
    ("RTS1 SN",              "https://www.youtube.com/@RTS1SN/live"),
    ("Walf TV Sénégal",      "https://www.youtube.com/@walftv/live"),
    ("RTI Côte d'Ivoire",    "https://www.youtube.com/@rtici/live"),
    ("RTB Burkina",          "https://www.youtube.com/@rtburkina/live"),
    ("RTB alt",              "https://www.youtube.com/@radiodiffusiontelevisiondu1883/live"),
    ("Afrique Média",        "https://www.youtube.com/user/afriquemediatv/live"),
    ("Channels TV Nigeria",  "https://www.youtube.com/channel/UCEXGDNclvmg6RW0vipJYsTQ/live"),
    ("Arise News Nigeria",   "https://www.youtube.com/channel/UCyEJX-kSj0kOOCS7Qlq2G7g/live"),
    ("AIT Nigeria",          "https://www.youtube.com/channel/UCBJvTeuSKEpZZV3E5EKEd4g/live"),
    ("JoyNews Ghana",        "https://www.youtube.com/channel/UChd1DEecCRlxaa0-hvPACCw/live"),
    ("ChannelOne Ghana",     "https://www.youtube.com/channel/UCUTeE-as508hixQrNVHO7vQ/live"),
    ("Africanews",           "https://www.youtube.com/channel/UC1_E8NeF5QHY2dtdLRBCCLA/live"),
    ("Africa Uncensored",    "https://www.youtube.com/channel/UCHJKZ0gSPiak8__ZD1pzfoQ/live"),
]

def fetch(url):
    try:
        r = subprocess.run(["curl", "-s", "-m", "25", "-L", "-A", UA, url],
                           capture_output=True, text=True, timeout=40)
        return r.stdout
    except Exception:
        return ""

print(f"{'CHAÎNE':24} {'channelId':25} {'videoId':12} live flags")
print("-" * 100)
for label, url in CHANNELS:
    html = fetch(url)
    if len(html) < 5000:
        print(f"{label:24} ERREUR/404 ({len(html)}B)")
        continue
    ext = re.search(r'"externalId":"(UC[A-Za-z0-9_-]{20,})"', html)
    cid = ext.group(1) if ext else "?"
    vid = re.search(r'"videoId":"([A-Za-z0-9_-]{8,12})"', html)
    vid = vid.group(1) if vid else "?"
    ilc = re.search(r'"isLiveContent":(true|false)', html)
    isl = re.search(r'"isLive":(true|false)', html)
    slate = "offlineSlate" if "liveStreamOfflineSlate" in html else ""
    title = re.search(r"<title>([^<]{0,80})", html)
    t = title.group(1).strip() if title else ""
    print(f"{label:24} {cid:25} {vid:12} ilc={ilc.group(1) if ilc else '-'} isl={isl.group(1) if isl else '-'} {slate} | {t}")
