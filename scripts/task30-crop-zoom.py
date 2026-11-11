#!/usr/bin/env python3
"""Task 30 — recadre + agrandit la vue 3D des captures pour jugement VLM."""
import sys
from PIL import Image

def crop_zoom(src, dst, box=None, scale=3):
    im = Image.open(src)
    print(f"{src}: {im.size}")
    if box is None:
        w, h = im.size
        # fenêtre 3D : fiche centrée ~ (w/2, h/2), largeur ~ 46% de l'écran
        bw, bh = int(w * 0.50), int(h * 0.52)
        x0, y0 = (w - bw) // 2, (h - bh) // 2
        box = (x0, y0, x0 + bw, y0 + bh)
    im2 = im.crop(box)
    im2 = im2.resize((im2.width * scale, im2.height * scale), Image.LANCZOS)
    im2.save(dst)
    print(f"→ {dst}: {im2.size}")

if __name__ == '__main__':
    for cls in ['commercial', 'military', 'helicopter', 'private']:
        crop_zoom(
            f'/home/z/my-project/download/task30-avion-{cls}.png',
            f'/home/z/my-project/download/task30-avion-{cls}-zoom.png',
            scale=3,
        )
