

import { NextResponse } from 'next/server';
import { promises as dns } from 'node:dns';

const DISPOSABLE = new Set([
  'mailinator.com', '10minutemail.com', 'guerrillamail.com', 'yopmail.com',
  'temp-mail.org', 'throwawaymail.com', 'sharklasers.com', 'getnada.com',
  'tempmail.net', 'fakeinbox.com', 'maildrop.cc',
]);
const SHORTENERS = new Set([
  'bit.ly', 'tinyurl.com', 'goo.gl', 't.co', 'is.gd', 'buff.ly', 'ow.ly',
  'cutt.ly', 'rb.gy', 'rebrand.ly', 'tiny.cc', 's.id',
]);
const SCAM_KEYWORDS = [
  'urgent', 'account suspended', 'compte suspendu', 'vérification',
  'verify your account', 'suspend', 'limited', 'immediately', 'urgent',
  'final warning', 'last warning', 'bitcoin', 'btc', 'wallet', 'crypto',
  'prize', 'lottery', 'gagné', 'gagner', 'héritage', 'inheritance',
  'click here', 'cliquez ici', 'reset your password', 'unusual activity',
  'facture impayée', 'impayé', 'ransom', 'payement immédiat',
];
const EXECUTABLE_EXT = /\.(exe|scr|js|vbs|hta|ps1|bat|cmd|iso|img|jar|apk)$/i;

const domainOf = (addr: string): string => {
  const m = /@([a-z0-9.-]+)/i.exec(addr);
  return m ? m[1].toLowerCase() : '';
};

const firstHeader = (raw: string, key: string): string => {
  const m = new RegExp(`^${key}:\\s*(.+)$`, 'im').exec(raw);
  return m ? m[1].trim() : '';
};

const allHeader = (raw: string, key: string): string[] => {
  const out: string[] = [];
  const re = new RegExp(`^${key}:\\s*(.+)$`, 'gim');
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw)) !== null) out.push(m[1].trim());
  return out;
};

export async function POST(req: Request) {
  let raw = '';
  try {
    const body = await req.json();
    raw = String(body?.raw ?? '');
  } catch {
    return NextResponse.json({ error: 'corps JSON invalide' }, { status: 400 });
  }
  if (raw.trim().length < 8) {
    return NextResponse.json({ error: 'contenu trop court (collez un email complet)' }, { status: 400 });
  }
  if (raw.length > 60_000) raw = raw.slice(0, 60_000);

  const reasons: { label: string; level: 'high' | 'medium' | 'low' }[] = [];
  const add = (label: string, level: 'high' | 'medium' | 'low') =>
    reasons.push({ label, level });

  const from = firstHeader(raw, 'From');
  const replyTo = firstHeader(raw, 'Reply-To');
  const returnPath = firstHeader(raw, 'Return-Path');
  const subject = firstHeader(raw, 'Subject');
  const fromDomain = domainOf(from);
  const replyDomain = domainOf(replyTo);
  const returnDomain = domainOf(returnPath);

  if (from && replyTo && fromDomain && replyDomain && fromDomain !== replyDomain) {
    add(`Reply-To (${replyDomain}) ≠ From (${fromDomain})`, 'high');
  }
  if (from && returnDomain && fromDomain && fromDomain !== returnDomain) {
    add(`Return-Path (${returnDomain}) ≠ From (${fromDomain})`, 'medium');
  }
  if (!/spf=/i.test(raw) && !/dkim-signature/i.test(raw)) {
    add('aucun en-tête SPF/DKIM visible (transfert non authentifié)', 'medium');
  }
  if (DISPOSABLE.has(fromDomain) || DISPOSABLE.has(replyDomain)) {
    add('domaine expéditeur jetable connu', 'high');
  }

  const urls = [...new Set(
    (raw.match(/https?:\/\/[^\s)<>\"']+/gi) ?? [])
      .map((s) => s.replace(/[.,;]+$/, ''))
  )].slice(0, 24);
  const hosts = [...new Set(
    urls
      .map((s) => { try { return new URL(s).hostname.toLowerCase(); } catch { return ''; } })
      .filter(Boolean)
  )];
  const shortenerHits = hosts.filter((h) => SHORTENERS.has(h.split('.').slice(-2).join('.')));
  if (shortenerHits.length) add(`${shortenerHits.length} raccourcisseur(s) d'URL (${shortenerHits[0]})`, 'medium');
  if (hosts.some((h) => /^\d{1,3}(\.\d{1,3}){3}$/.test(h))) add('URL pointant vers une IP littérale', 'high');
  if (hosts.some((h) => h.startsWith('xn--'))) add('URL punycode/IDN', 'high');

  const attachments = [...new Set(raw.match(/[A-Za-z0-9_.-]+\.(exe|scr|js|vbs|hta|ps1|bat|cmd|iso|img|jar|apk|zip)/gi) ?? [])]
    .filter((f) => EXECUTABLE_EXT.test(f))
    .slice(0, 8);
  const riskyAttachments = attachments.filter((f) => !f.endsWith('.zip'));
  if (riskyAttachments.length) add(`pièce(s) jointe(s) exécutable(s) : ${riskyAttachments.slice(0, 3).join(', ')}`, 'high');

  const low = raw.toLowerCase();
  const kwHits = SCAM_KEYWORDS.filter((k) => low.includes(k.toLowerCase()));
  if (kwHits.length >= 3) add(`mots-clés d'arnaque ×${kwHits.length} (${kwHits.slice(0, 3).join(', ')})`, 'medium');
  else if (kwHits.length >= 1) add(`mot(s)-clé(s) d'arnaque : ${kwHits.slice(0, 3).join(', ')}`, 'low');

  const ips = [...new Set(raw.match(/\b\d{1,3}(\.\d{1,3}){3}\b/g) ?? [])].slice(0, 10);

  const mxDomains = [...new Set([fromDomain, replyDomain].filter(Boolean))].slice(0, 3);
  const mxInfo: Record<string, string[]> = {};
  await Promise.all(
    mxDomains.map(async (d) => {
      try {
        const mx = await Promise.race([
          dns.resolveMx(d).catch(() => [] as { exchange: string }[]),
          new Promise<{ exchange: string }[]>((r) => setTimeout(() => r([]), 4000)),
        ]);
        mxInfo[d] = mx.map((m) => m.exchange).slice(0, 3);
      } catch {
        mxInfo[d] = [];
      }
    })
  );
  for (const d of mxDomains) {
    if (Object.keys(mxInfo).includes(d) && mxInfo[d].length === 0) {
      add(`aucun MX pour ${d} (domaine non réceptif → envoi uni-directionnel typique du phishing)`, 'medium');
    }
  }

  const score = Math.min(100, reasons.reduce((s, r) => s + (r.level === 'high' ? 30 : r.level === 'medium' ? 14 : 5), 0));
  const verdict = score >= 60 ? 'PHISHING PROBABLE' : score >= 30 ? 'SUSPECT' : 'RIEN DE PROUVÉ';

  return NextResponse.json({
    headers: { from, replyTo, returnPath, subject },
    fromDomain,
    urls,
    hosts,
    ips,
    attachments,
    keywords: kwHits,
    mx: mxInfo,
    heuristics: { score, verdict, reasons },
    ts: Date.now(),
    source: 'heuristiques locales · DNS',
  });
}
