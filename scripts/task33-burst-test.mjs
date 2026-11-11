// Test : adsb.fi single vs burst 15 parallèles (comme la route)
const GRID = [
  [40.6, -74.5], [40, -95], [34, -118.2], [51.5, -0.5], [48.5, 11.5],
  [35.6, 139.7], [31.2, 121.5], [1.35, 103.8], [25.25, 55.3], [-23.5, -46.6],
  [-33.85, 151.2], [14.7, -17.4], [6.5, 3.4], [30, 31.2],
];
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

async function hit(url) {
  try {
    const c = new AbortController();
    const to = setTimeout(() => c.abort(), 12000);
    const r = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': UA }, signal: c.signal });
    clearTimeout(to);
    return r.status;
  } catch (e) { return `ERR:${e.name}`; }
}

(async () => {
  console.log('adsb.fi single maintenant :', await hit('https://opendata.adsb.fi/api/v2/lat/50/lon/10/dist/250'));
  console.log('adsb.lol single maintenant :', await hit('https://api.adsb.lol/v2/lat/50/lon/10/dist/250'));
  console.log('--- burst 15 parallèles adsb.fi ---');
  const t0 = Date.now();
  const codes = await Promise.all([
    ...GRID.map(([la, lo]) => hit(`https://opendata.adsb.fi/api/v2/lat/${la}/lon/${lo}/dist/250`)),
    hit('https://opendata.adsb.fi/api/v2/mil'),
  ]);
  const counts = {};
  codes.forEach(c => counts[c] = (counts[c] || 0) + 1);
  console.log(`en ${Date.now() - t0}ms:`, JSON.stringify(counts));
})();
