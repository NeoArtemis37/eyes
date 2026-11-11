/**
 * Next.js instrumentation — démarre le moteur HORUS (flux réels + orchestre
 * + écho) dans le process serveur au boot. Singleton via globalThis :
 * les rechargements HMR ne dupliquent pas les pollers.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { getHorusEngine } = await import('@/lib/horus/engine');
    const engine = getHorusEngine();
    console.log('[horus-instrumentation] engine started, feeds:', 'USGS/adsb.lol-mil/IODA/SWPC', 'uptime0:', engine.startedAt);
  }
}
