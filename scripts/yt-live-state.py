#!/usr/bin/env python3
"""Check watch pages of sub-region TV latest streams + extra candidate channels."""
import re, subprocess

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36"

def fetch(url):
    try:
        r = subprocess.run(["curl", "-s", "-m", "25", "-L", "-A", UA, url],
                           capture_output=True, text=True, timeout=40)
        return r.stdout
    except Exception:
        return ""

print("== A. état live des derniers streams des chaînes d'État ==")
VIDEOS = [
    ("ORTM oo5LCpngDxs", "oo5LCpngDxs"), ("ORTM-direct 7DYS9vMMGt4", "7DYS9vMMGt4"),
    ("TFM GIXN68ZRt_0", "GIXN68ZRt_0"), ("RTS sx4G_IisMjU", "sx4G_IisMjU"),
    ("RTS1 MsTx_H3gZ50", "MsTx_H3gZ50"), ("WALF 7Kjkrz2IQq8", "7Kjkrz2IQq8"),
    ("RTI U1ktEAY12eo", "U1ktEAY12eo"), ("RTB JnVXgFunJx8", "JnVXgFunJx8"),
    ("AfriqueMédia KOARUkjnqgI", "KOARUkjnqgI"), ("Xzn0_nyRTS0 (AfM search)", "Xzn0_nyRTS0"),
]
for label, vid in VIDEOS:
    html = fetch(f"https://www.youtube.com/watch?v={vid}")
    isl = re.search(r'"isLive":(true|false)', html)
    ilc = re.search(r'"isLiveContent":(true|false)', html)
    t = re.search(r'<meta name="title" content="([^"]{0,90})', html)
    print(f"  {label:28} isl={isl.group(1) if isl else '-'} ilc={ilc.group(1) if ilc else '-'} | {t.group(1) if t else ''}")

print("\n== B. candidats supplémentaires (pages /live) ==")
EXTRA = [
    ("Canal2 Cameroun", "https://www.youtube.com/@Canal2International/live"),
    ("Canal2 alt", "https://www.youtube.com/@canal2international/live"),
    ("Espace TV GN", "https://www.youtube.com/@EspaceTVGuineeTV/live"),
    ("Espace TV alt", "https://www.youtube.com/user/EspaceTVguinee/live"),
    ("Djoma TV GN", "https://www.youtube.com/@DjomaTV/live"),
    ("Télé Sahel NE", "https://www.youtube.com/@Telesahel/live"),
    ("TNTV Niger", "https://www.youtube.com/@tntvniger/live"),
    ("GRT Ghana", "https://www.youtube.com/@GhanaTelevisionGTV1/live"),
    ("2STV SN", "https://www.youtube.com/@2stvsenegal/live"),
    ("Sèn TV alt", "https://www.youtube.com/@sentvsn/live"),
]
for label, url in EXTRA:
    html = fetch(url)
    if len(html) < 5000:
        print(f"  {label:16} 404/inaccessible ({len(html)}B)")
        continue
    ext = re.search(r'"externalId":"(UC[A-Za-z0-9_-]{20,})"', html)
    cid = ext.group(1) if ext else "?"
    isl = re.search(r'"isLive":(true|false)', html)
    t = re.search(r"<title>([^<]{0,70})", html)
    slate = "offlineSlate" if "liveStreamOfflineSlate" in html else ""
    print(f"  {label:16} {cid} isl={isl.group(1) if isl else '-'} {slate} | {t.group(1).strip() if t else ''}")
