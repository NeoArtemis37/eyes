/**
 * Pré-construit le catalogue worldcams (cache disque initial) et affiche les stats.
 * Usage : bun run scripts/worldcams-build.ts
 */
import { getCatalog, nearestCams } from '../src/lib/worldcams';

async function main() {
  console.time('découverte');
  const { cams, stats } = await getCatalog(true);
  console.timeEnd('découverte');

  console.log(`\n=== CATALOGUE WORLDCAMS ===`);
  console.log(`${stats.cams} cams · ${stats.countries} pays · ${stats.cities} villes`);
  console.log('catégories:', stats.cats);

  console.log('\nTop pays:');
  const per = new Map<string, number>();
  for (const c of cams) per.set(c.country ?? '??', (per.get(c.country ?? '??') ?? 0) + 1);
  console.log([...per.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12));

  console.log('\nÉchantillon cams AFRIQUE:');
  for (const c of cams.filter(x => ['SN', 'MU', 'ZA', 'KE', 'MA', 'CV', 'SC', 'TZ', 'ZM'].includes(x.cc ?? '')).slice(0, 10)) {
    console.log(` · ${c.title} — ${c.city ?? '?'} ${c.country} (nkey ${c.nkey}) [${c.cats.join(',')}]} geo=${c.geo}`);
  }

  console.log('\nNearest de Dakar (14.5, -14.45):');
  for (const h of nearestCams(cams, 14.5, -14.45, 6, 1200)) {
    console.log(` · ${h.distKm.toFixed(0)} km — ${h.title} (${h.city ?? '?'}, ${h.country})`);
  }

  console.log('\nNearest de Tokyo (35.68, 139.69):');
  for (const h of nearestCams(cams, 35.68, 139.69, 5, 800)) {
    console.log(` · ${h.distKm.toFixed(0)} km — ${h.title} (${h.city ?? '?'}, ${h.country})`);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
