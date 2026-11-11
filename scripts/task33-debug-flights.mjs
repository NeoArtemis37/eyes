// Debug : réplique fetchRegion de la route pour comprendre le 0 vol
const ISP_IP_RANGES = [
  [24, 0, 0, 0], [50, 0, 0, 0], [68, 0, 0, 0], [71, 0, 0, 0], [73, 0, 0, 0], [75, 0, 0, 0],
  [98, 0, 0, 0], [99, 0, 0, 0], [81, 128, 0, 0], [86, 0, 0, 0], [80, 0, 0, 0], [81, 0, 0, 0],
];
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
];
function randomISPIP() {
  const r = ISP_IP_RANGES[Math.floor(Math.random() * ISP_IP_RANGES.length)];
  return `${r[0] + Math.floor(Math.random() * 16)}.${r[1] + Math.floor(Math.random() * 256)}.${r[2] + Math.floor(Math.random() * 256)}.${r[3] + Math.floor(Math.random() * 254) + 1}`;
}

async function tryProvider(name, url, stealth) {
  const headers = { 'Accept': 'application/json' };
  if (stealth) {
    headers['User-Agent'] = USER_AGENTS[0];
    headers['X-Forwarded-For'] = randomISPIP();
    headers['Accept-Language'] = 'en-US,en;q=0.9';
  }
  const t0 = Date.now();
  try {
    const controller = new AbortController();
    const to = setTimeout(() => controller.abort(), 12000);
    const res = await fetch(url, { headers, signal: controller.signal });
    clearTimeout(to);
    console.log(`${name} [stealth=${stealth}] → HTTP ${res.status} en ${Date.now() - t0}ms`);
    if (!res.ok) { const body = await res.text().catch(() => ''); console.log(`  body: ${body.slice(0, 150)}`); return; }
    const data = await res.json();
    const ac = data.ac ?? data.aircraft ?? [];
    const withPos = ac.filter(a => a.lat != null && a.lon != null);
    const airborne = ac.filter(a => typeof a.alt_baro === 'number' && a.lat != null && a.lon != null);
    console.log(`  total=${ac.length} avecPos=${withPos.length} airborne=${airborne.length}`);
    if (airborne[0]) console.log(`  ex: ${airborne[0].flight} alt_baro=${airborne[0].alt_baro} lat=${airborne[0].lat}`);
  } catch (e) {
    console.log(`${name} [stealth=${stealth}] → ERREUR ${e.name}: ${e.message} (${Date.now() - t0}ms)`);
  }
}

(async () => {
  const urlLol = 'https://api.adsb.lol/v2/lat/50/lon/10/dist/2500';
  const urlFi = 'https://opendata.adsb.fi/api/v2/lat/50/lon/10/dist/2500';
  await tryProvider('adsb.lol', urlLol, true);
  await tryProvider('adsb.fi', urlFi, true);
  await tryProvider('adsb.fi', urlFi, false);
})();
