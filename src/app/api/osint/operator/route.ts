
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * REGISTRE OPÉRATEURS — remplace l'ancien accès "DEMO".
 * POST { callsign }  → prise de poste réelle : upsert opérateur + journal.
 * GET                → 15 dernières entrées du journal de veille.
 * DELETE { callsign }→ fin de poste (check-out).
 */
export async function GET() {
  try {
    const logs = await db.watchLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 15,
    });
    const operators = await db.operator.findMany({
      orderBy: { lastSeen: 'desc' },
      take: 10,
    });
    return NextResponse.json({ status: 'ok', logs, operators });
  } catch (e) {
    return NextResponse.json(
      { status: 'error', message: e instanceof Error ? e.message : 'unknown' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const callsign = String(body?.callsign ?? '')
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9_\- ]/g, '')
      .slice(0, 24);
    if (callsign.length < 3) {
      return NextResponse.json(
        { status: 'error', message: 'indicatif requis (3-24 caractères)' },
        { status: 400 }
      );
    }
    const operator = await db.operator.upsert({
      where: { callsign },
      update: { lastSeen: new Date() },
      create: { callsign },
    });
    await db.watchLog.create({
      data: {
        operatorId: operator.id,
        callsign,
        action: 'CHECK-IN',
        detail: `Prise de poste ${new Date().toISOString()}`,
      },
    });
    return NextResponse.json({
      status: 'ok',
      operator: { id: operator.id, callsign: operator.callsign, lastSeen: operator.lastSeen },
    });
  } catch (e) {
    return NextResponse.json(
      { status: 'error', message: e instanceof Error ? e.message : 'unknown' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const callsign = String(body?.callsign ?? '').trim().toUpperCase();
    if (!callsign) {
      return NextResponse.json({ status: 'error', message: 'callsign requis' }, { status: 400 });
    }
    const operator = await db.operator.findUnique({ where: { callsign } });
    await db.watchLog.create({
      data: {
        operatorId: operator?.id ?? null,
        callsign,
        action: 'CHECK-OUT',
        detail: `Fin de poste ${new Date().toISOString()}`,
      },
    });
    return NextResponse.json({ status: 'ok' });
  } catch (e) {
    return NextResponse.json(
      { status: 'error', message: e instanceof Error ? e.message : 'unknown' },
      { status: 500 }
    );
  }
}
