// Mesure la limite soutenue d'adsb.fi : 15 requêtes étalées 350ms (pire cas)
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const GRID = [
  [40.6, -74.5], [40, -95], [34, -118.2], [51.5, -0.5], [48.5, 11.5],
  [35.6, 139.7], [31.2, 121.5], [1.35, 103.8], [25.25, 55.3], [-23.5, -46.6],
  [-33.85, 151.2], [14.7, -17.4], [6.5, 3.4], [30, 31.2],
];

async function hit(url) {
  try {
    const c = new AbortController();
    const to = setTimeout(() => c.abort(), 12000);
    const r = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': UA }, signal: c.signal });
    clearTimeout(to);
    const t = await r.text();
    let n = '?';
    try { const d = JSON.parse(t); n = (d.ac ?? d.aircraft ?? []).length; } catch {}
    return `${r.status}/${n}`;
  } catch (e) { return `ERR:${e.name}`; }
}

(async () => {
  console.log('--- test A: 15 requêtes étalées, vagues de 3 tous les 400ms ---');
  const t0 = Date.now();
  const codes = [];
  for (let i = 0; i < 15; i += 3) {
    const batch = await Promise.all(
      [0, 1, 2].filter(j => i + j < 15).map(j => {
        const idx = i + j;
        const url = idx === 14
          ? 'https://opendata.adsb.fi/api/v2/mil'
          : `https://opendata.adsb.fi/api/v2/lat/${GRID[idx][0]}/lon/${GRID[idx][1]}/dist/250`;
        return hit(url);
      })
    );
    codes.push(...batch);
    if (i + 3 < 15) await new Promise(r => setTimeout(r, 400));
  }
  console.log(`en ${((Date.now() - t0) / 1000).toFixed(1)}s:`, codes.join(' '));
  const ok = codes.filter(c => c.startsWith('200')).length;
  console.log(`Succès: ${ok}/15`);
})();
