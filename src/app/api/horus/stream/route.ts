
import { NextRequest } from 'next/server';
import { getHorusEngine } from '@/lib/horus/engine';
import type { HorusEngine } from '@/lib/horus/engine';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/* ------------------------------------------------------------------ */
/* HORUS STREAM — SSE (server-sent events), in-process.                */
/*                                                                     */
/* Le moteur (src/lib/horus/engine.ts) vit dans le process Next via    */
/* instrumentation.ts : flux réels (USGS, adsb.lol mil, IODA, NOAA      */
/* SWPC) + orchestre d'agents + moteur d'écho. Chaque client SSE        */
/* reçoit les derniers snapshots puis le flux live. Auto-reconnect      */
/* natif côté navigateur.                                               */
/* ------------------------------------------------------------------ */

const enc = new TextEncoder();

function sse(controller: ReadableStreamDefaultController<Uint8Array>, ev: string, data: unknown) {
  try {
    controller.enqueue(enc.encode(`event: ${ev}\ndata: ${JSON.stringify(data)}\n\n`));
  } catch { /* client parti */ }
}

export async function GET(req: NextRequest) {
  const engine: HorusEngine = getHorusEngine();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      sse(controller, 'bridge', {
        ts: Date.now(), upstream: true,
        msg: 'HORUS in-process engine · v7.1 · demo-free · real feeds',
      });

      // replay des snapshots courants
      const snap = engine.snapshot();
      for (const [ev, data] of Object.entries(snap)) {
        sse(controller, ev, data);
      }

      // abonnement live — les événements denses (agent_tick) restent hors
      // SSE : le client reçoit déjà le snapshot agents toutes les 5 s
      const events = [
        'hello', 'heartbeat', 'event', 'agents', 'agent_report', 'agent_log',
        'agent_cue', 'echo', 'echo_scan', 'spaceweather', 'netweather',
        'quakes', 'mil', 'agent_reports', 'agent_log_tail',
      ];
      const handlers: Array<[string, (p: unknown) => void]> = events.map((ev) => [
        ev, (p: unknown) => sse(controller, ev, p),
      ]);
      for (const [ev, h] of handlers) engine.emitter.on(ev, h);

      const cleanup = () => {
        for (const [ev, h] of handlers) engine.emitter.off(ev, h);
      };
      req.signal.addEventListener('abort', cleanup);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
