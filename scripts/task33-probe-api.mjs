// Confirme limites dist + endpoints spéciaux des deux fournisseurs
async function probe(name, url) {
  const t0 = Date.now();
  try {
    const controller = new AbortController();
    const to = setTimeout(() => controller.abort(), 12000);
    const res = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      },
      signal: controller.signal,
    });
    clearTimeout(to);
    const txt = await res.text();
    let info = '';
    try {
      const d = JSON.parse(txt);
      const ac = d.ac ?? d.aircraft ?? [];
      const withPos = ac.filter(a => a.lat != null && a.lon != null);
      info = `total=${ac.length} pos=${withPos.length}`;
      if (withPos[0]) info += ` ex=${(withPos[0].flight || '').trim()} alt=${withPos[0].alt_baro}`;
    } catch { info = `body="${txt.slice(0, 80)}"`; }
    console.log(`${name} → HTTP ${res.status} (${Date.now() - t0}ms) ${info}`);
  } catch (e) {
    console.log(`${name} → ERREUR ${e.name} (${Date.now() - t0}ms)`);
  }
}

(async () => {
  // Limites dist sur adsb.fi
  await probe('adsb.fi dist=250 ', 'https://opendata.adsb.fi/api/v2/lat/50/lon/10/dist/250');
  await probe('adsb.fi dist=251 ', 'https://opendata.adsb.fi/api/v2/lat/50/lon/10/dist/251');
  await probe('adsb.fi dist=3000', 'https://opendata.adsb.fi/api/v2/lat/50/lon/10/dist/3000');
  // Le bug originel côté adsb.lol
  await probe('adsb.lol dist=3000', 'https://api.adsb.lol/v2/lat/50/lon/10/dist/3000');
  await probe('adsb.lol dist=250 ', 'https://api.adsb.lol/v2/lat/50/lon/10/dist/250');
  // Endpoints globaux spéciaux
  await probe('adsb.lol /v2/mil    ', 'https://api.adsb.lol/v2/mil');
  await probe('adsb.fi  /v2/mil    ', 'https://opendata.adsb.fi/api/v2/mil');
  await probe('adsb.lol /v2/all    ', 'https://api.adsb.lol/v2/all');
  await probe('adsb.fi  /v2/all    ', 'https://opendata.adsb.fi/api/v2/all');
})();
