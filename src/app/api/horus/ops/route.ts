
import { NextRequest, NextResponse } from 'next/server';
import { getHorusEngine } from '@/lib/horus/engine';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/* ------------------------------------------------------------------ */
/* OPS API — cue / ordres opérateur vers l'orchestre (moteur in-process). */
/* POST { action: 'cue', lat, lng, operator?, note? }                   */
/* POST { action: 'order', callsign, order }                            */
/* GET  → état du moteur                                                */
/* ------------------------------------------------------------------ */

export async function GET() {
  const engine = getHorusEngine();
  return NextResponse.json({
    status: 'ok',
    upstream: true,
    uptimeMs: engine.startedAt ? Date.now() - engine.startedAt : 0,
    agents: engine.agents.length,
    quakes: engine.quakeCache.length,
    ioda: engine.netAlerts.length,
    military: engine.milCache.length,
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const action = String(body?.action ?? '');
  const engine = getHorusEngine();

  if (action === 'cue') {
    const lat = Number(body?.lat);
    const lng = Number(body?.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return NextResponse.json({ ok: false, reason: 'coordonnées invalides' }, { status: 400 });
    }
    return NextResponse.json(engine.operatorCue(
      lat, lng,
      String(body?.operator ?? 'console'),
      String(body?.note ?? ''),
    ));
  }
  if (action === 'order') {
    return NextResponse.json(engine.operatorOrder(
      String(body?.callsign ?? ''),
      String(body?.order ?? 'Reprise de patrouille'),
    ));
  }
  return NextResponse.json({ ok: false, reason: 'action inconnue' }, { status: 400 });
}
