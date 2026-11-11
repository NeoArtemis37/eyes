#!/usr/bin/env python3
"""Test end-to-end de /api/voice/transcribe : génère un WAV 16 kHz mono
(sinusoïde), l'encode en base64, POSTe vers l'API et affiche la réponse.
Valide la plomberie (JSON, taille, SDK ASR) — pas la qualité vocale."""
import base64
import io
import json
import math
import struct
import urllib.request
import wave

SR = 16000
DUR = 1.2
FREQ = 440.0

buf = io.BytesIO()
with wave.open(buf, "wb") as w:
    w.setnchannels(1)
    w.setsampwidth(2)
    w.setframerate(SR)
    frames = bytearray()
    for i in range(int(SR * DUR)):
        v = int(12000 * math.sin(2 * math.pi * FREQ * i / SR))
        frames += struct.pack("<h", v)
    w.writeframes(bytes(frames))

b64 = base64.b64encode(buf.getvalue()).decode()
print(f"WAV généré : {len(buf.getvalue())} octets, base64 {len(b64)} chars")

req = urllib.request.Request(
    "http://localhost:3000/api/voice/transcribe",
    data=json.dumps({"audio": b64}).encode(),
    headers={"Content-Type": "application/json"},
    method="POST",
)
try:
    with urllib.request.urlopen(req, timeout=60) as r:
        print("HTTP", r.status)
        print(r.read().decode()[:300])
except urllib.error.HTTPError as e:
    print("HTTP", e.code)
    print(e.read().decode()[:300])
