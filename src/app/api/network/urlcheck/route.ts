

import { NextResponse } from 'next/server';
import { promises as dns } from 'node:dns';

const RISKY_TLDS = new Set([
  'zip', 'mov', 'top', 'xyz', 'gq', 'tk', 'ml', 'cf', 'cn', 'ru', 'su',
  'work', 'click', 'link', 'rest', 'fit', 'country', 'stream', 'download',
  'loan', 'icu', 'cam', 'quest', 'sbs', 'monster', 'buzz', 'bar', 'cf',
]);
const SHORTENERS = new Set([
  'bit.ly', 'tinyurl.com', 'goo.gl', 't.co', 'is.gd', 'buff.ly', 'ow.ly',
  'shorturl.at', 'cutt.ly', 'rb.gy', 'rebrand.ly', 'tiny.cc', 'lnkd.in',
  'bl.ink', 's.id', 'shorte.st', 'adbull.me', 'clckru.net',
]);
const BRANDS = [
  'paypal', 'apple', 'microsoft', 'office365', 'outlook', 'netflix',
  'amazon', 'facebook', 'instagram', 'whatsapp', 'google', 'dhl', 'fedex',
  'ups', 'santander', 'bnp', 'labanquepostale', 'credit-agricole', 'impots',
  'ameli', 'caf', 'linkedin', 'steam', 'roblox', 'binance', 'coinbase',
  'metamask', 'ledger', 'dhl-express', 'chase', 'wellsfargo', 'hsbc',
];
const DISPOSABLE = new Set([
  'mailinator.com', '10minutemail.com', 'guerrillamail.com', 'yopmail.com',
  'temp-mail.org', 'throwawaymail.com', 'sharklasers.com', 'getnada.com',
  'dispostable.com', 'tempmail.net', 'fakeinbox.com', 'maildrop.cc',
]);

interface Reason { label: string; level: 'high' | 'medium' | 'low' }

export async function GET(req: Request) {
  const raw = new URL(req.url).searchParams.get('url') ?? '';
  const trimmed = raw.trim();
  if (!trimmed) {
    return NextResponse.json({ error: 'paramètre url manquant' }, { status: 400 });
  }
  const withProto = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  let u: URL;
  try {
    u = new URL(withProto);
  } catch {
    return NextResponse.json({ error: 'URL invalide' }, { status: 400 });
  }
  const host = u.hostname.toLowerCase();
  const labels = host.split('.');
  const tld = labels.length >= 2 ? labels[labels.length - 1] : '';
  const domain = labels.length >= 2 ? labels.slice(-2).join('.') : host;

  const reasons: Reason[] = [];
  const add = (label: string, level: Reason['level']) => reasons.push({ label, level });

  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) add('hôte = IP littérale (aucun domaine)', 'high');
  if (host.startsWith('xn--') || labels.some((l) => l.startsWith('xn--'))) add('domaine punycode/IDN (homoglyphes possibles)', 'high');
  if (SHORTENERS.has(domain)) add('raccourcisseur d\'URL', 'high');
  if (RISKY_TLDS.has(tld)) add(`TLD à haut risque (.${tld})`, 'medium');
  if (labels.length >= 5) add(`${labels.length} niveaux de sous-domaines`, 'medium');
  if (/^\d+[a-z-]*[a-z]+-\d+\./.test(host) || (host.match(/-/g) ?? []).length >= 2) add('tirets multiples dans le domaine (imitation de marque)', 'low');
  if (u.port && u.port !== '80' && u.port !== '443') add(`port non standard :${u.port}`, 'medium');
  if (u.username || u.password) add('identifiants embarqués dans l\'URL', 'high');
  if (/[а-яА-ЯёЁ]/.test(host) || /[^\x00-\x7f]/.test(host)) add('caractères non-ASCII dans l\'hôte', 'high');
  const brand = BRANDS.find((b) => host.includes(b) && domain !== `${b}.com` && !domain.startsWith(`${b}.`));
  if (brand) add(`mot-clé de marque « ${brand} » hors domaine officiel`, 'high');
  if (host.length > 40) add('nom d\'hôte très long', 'low');
  if ((u.pathname + u.search).length > 80) add('chemin/paramètres très longs (obfuscation possible)', 'low');
  const encoded = (u.href.match(/%[0-9a-f]{2}/gi) ?? []).length;
  if (encoded >= 3) add(`${encoded} séquences encodées %XX`, 'medium');
  if (/\.(exe|scr|js|vbs|hta|ps1|bat|cmd|iso|img|jar|zip)(\?|$)/i.test(u.pathname)) add('extension exécutable en fin de chemin', 'high');
  if (u.protocol === 'http:') add('HTTP non chiffré (le contenu peut être modifié en transit)', 'low');
  if (/@/.test(u.pathname) || /@/.test(u.href.replace(`${u.protocol}//`, '').replace(new RegExp(`@${host}`), ''))) {
  }

  const score = Math.min(
    100,
    reasons.reduce((s, r) => s + (r.level === 'high' ? 32 : r.level === 'medium' ? 16 : 6), 0)
  );
  const verdict = score >= 60 ? 'SUSPECT' : score >= 30 ? 'PRUDENCE' : 'PROBABLEMENT SAIN';

  const dnsInfo: { a: string[]; mx: string[] } = { a: [], mx: [] };
  if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(host) && !host.endsWith('.onion')) {
    try {
      dnsInfo.a = (await dns.resolve4(host).catch(() => [])) as string[];
    } catch {}
    try {
      dnsInfo.mx = ((await dns.resolveMx(domain).catch(() => [])) ?? []).map((m) => m.exchange).slice(0, 4);
    } catch {}
  } else if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) {
    dnsInfo.a = [host];
  }
  if (dnsInfo.a.length === 0 && !host.endsWith('.onion')) add('aucun enregistrement DNS A résolu', 'medium');
  if (DISPOSABLE.has(domain)) add('domaine jetable connu', 'medium');

  let urlscan: {
    ok: boolean;
    total: number;
    last?: string;
    scans: { url: string; title: string; country: string; ip: string; when: string }[];
  } = { ok: false, total: 0, scans: [] };
  if (!host.endsWith('.onion')) {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), 8_000);
    try {
      const res = await fetch(
        `https://urlscan.io/api/v1/search/?q=domain:${encodeURIComponent(domain)}&size=5`,
        { headers: { 'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) Chrome/131.0' }, signal: ac.signal, cache: 'no-store' }
      );
      if (res.ok) {
        const j: any = await res.json();
        urlscan = {
          ok: true,
          total: j.total ?? 0,
          last: j.results?.[0]?.task?.time ?? undefined,
          scans: (j.results ?? []).slice(0, 5).map((r: any) => ({
            url: r.page?.url ?? '',
            title: r.page?.title ?? '',
            country: r.page?.country ?? '',
            ip: r.page?.ip ?? '',
            when: r.task?.time ?? '',
          })),
        };
      }
    } catch {
    } finally {
      clearTimeout(timer);
    }
  }

  const scoreFinal = Math.min(100, reasons.reduce((s, r) => s + (r.level === 'high' ? 32 : r.level === 'medium' ? 16 : 6), 0));
  const verdictFinal = scoreFinal >= 60 ? 'SUSPECT' : scoreFinal >= 30 ? 'PRUDENCE' : 'PROBABLEMENT SAIN';

  return NextResponse.json({
    input: trimmed,
    normalized: u.href,
    host,
    domain,
    ip: dnsInfo.a[0] ?? null,
    heuristics: { score: scoreFinal, verdict: verdictFinal, reasons },
    dns: dnsInfo,
    urlscan,
    ts: Date.now(),
    source: 'heuristiques locales · DNS · urlscan.io',
  });
}
