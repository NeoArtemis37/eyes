(() => {
  const cv = document.querySelector('.net-map canvas');
  if (!cv) return 'NO CANVAS';
  const W = cv.width, H = cv.height;
  const ctx = cv.getContext('2d');
  const img = ctx.getImageData(0, 0, W, H).data;
  const pts = [];
  for (let y = 0; y < H; y += 2) {
    for (let x = 0; x < W; x += 2) {
      const i = (y * W + x) * 4;
      const r = img[i], g = img[i + 1], b = img[i + 2];
      if (r > 185 && g > 110 && g < 220 && b < 115 && (r - b) > 90 && (g - b) > 30) pts.push([x, y]);
    }
  }
  if (pts.length === 0) return 'NO AMBER PX';
  const cssW = cv.clientWidth, cssH = cv.clientHeight;
  const sx = W / cssW, sy = H / cssH;
  const clusters = [];
  for (const p of pts) {
    const x = p[0], y = p[1];
    let c = null;
    for (const cl of clusters) {
      if (Math.hypot(cl.x - x, cl.y - y) < 30) { c = cl; break; }
    }
    if (c) { c.x = (c.x * c.n + x) / (c.n + 1); c.y = (c.y * c.n + y) / (c.n + 1); c.n++; }
    else clusters.push({ x: x, y: y, n: 1 });
  }
  clusters.sort((a, b) => b.n - a.n);
  const best = clusters.slice(0, 6).map((c) => ({ x: Math.round(c.x / sx), y: Math.round(c.y / sy), n: c.n }));
  return JSON.stringify({ amberPx: pts.length, best: best });
})()
