

import ZAI from 'z-ai-web-dev-sdk';

export const runtime = 'nodejs';

const MAX_BYTES = 8 * 1024 * 1024; // 8 Mo · ~4 min de WAV 16k mono

export async function POST(req: Request) {
  let body: { audio?: string; lang?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'corps JSON invalide' }, { status: 400 });
  }

  const b64 = (body.audio ?? '').trim();
  if (!b64) {
    return Response.json({ error: 'audio manquant' }, { status: 400 });
  }
  if (b64.length > MAX_BYTES * 1.4) {
    return Response.json({ error: 'enregistrement trop long (max ~4 min)' }, { status: 413 });
  }

  try {
    const zai = await ZAI.create();
    const res = await zai.audio.asr.create({ file_base64: b64 });
    const text = String(res?.text ?? '').trim();
    if (!text) {
      return Response.json({ text: '', warning: 'aucune parole détectée' });
    }
    return Response.json({ text });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'échec ASR';
    console.error('[voice/transcribe]', msg);
    return Response.json({ error: `transcription impossible : ${msg}` }, { status: 500 });
  }
}
