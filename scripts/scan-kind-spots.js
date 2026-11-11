// Scan des losanges de menace sur la carte (kinds cyan/magenta/vert/rouge).
// Retourne les 8 plus gros clusters avec leurs positions CSS pour clic réel.
(() => {
  const cv = document.querySelector('.net-map canvas');
  if (!cv) return 'NO CANVAS';
  const W = cv.width, H = cv.height;
  const ctx = cv.getContext('2d');
  const img = ctx.getImageData(0, 0, W, H).data;
  const isKind = (r, g, b) => {
    // cyan c2 (53,224,255) · magenta ransom (216,54,216) · vert malware · orange attack
    const sat = Math.max(r, g, b) - Math.min(r, g, b);
    if (sat < 90) return false; // pas de gris/terre/mer
    const cyan = b > 200 && g > 170 && r < 120;
    const magenta = r > 170 && b > 170 && g < 120;
    const green = g > 180 && r < 130 && b < 130;
    const hot = r > 200 && g > 90 && g < 180 && b < 90;
    return cyan || magenta || green || hot;
  };
  const pts = [];
  for (let y = 0; y < H; y += 2) {
    for (let x = 0; x < W; x += 2) {
      const i = (y * W + x) * 4;
      if (isKind(img[i], img[i + 1], img[i + 2])) pts.push([x, y]);
    }
  }
  if (pts.length === 0) return 'NO KIND PX';
  const cssW = cv.clientWidth, cssH = cv.clientHeight;
  const sx = W / cssW, sy = H / cssH;
  const clusters = [];
  for (const p of pts) {
    let c = null;
    for (const cl of clusters) {
      if (Math.hypot(cl.x - p[0], cl.y - p[1]) < 22) { c = cl; break; }
    }
    if (c) { c.x = (c.x * c.n + p[0]) / (c.n + 1); c.y = (c.y * c.n + p[1]) / (c.n + 1); c.n++; }
    else clusters.push({ x: p[0], y: p[1], n: 1 });
  }
  clusters.sort((a, b) => b.n - a.n);
  // écarte les clusters du bord (UI) : garde zone carte
  const best = clusters.slice(0, 8).map(c => ({
    x: Math.round(c.x / sx), y: Math.round(c.y / sy), n: c.n,
  })).filter(c => c.x > 40 && c.y > 40 && c.x < cssW - 40 && c.y < cssH - 40);
  return JSON.stringify({ px: pts.length, best });
})()
