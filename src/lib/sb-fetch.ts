
const USER_AGENT = 'Shadowbroker-OSINT/1.0 (Horus; +https://github.com)';
const DEFAULT_TIMEOUT = 8000;

export interface FetchResult<T = any> {
  ok: boolean;
  status: number;
  data: T | null;
  error?: string;
}

export async function fetchJson<T = any>(
  url: string,
  opts: { timeout?: number; headers?: Record<string, string> } = {},
): Promise<T | null> {
  const { timeout = DEFAULT_TIMEOUT, headers = {} } = opts;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeout);
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.9',
        ...headers,
      },
    });
    clearTimeout(t);
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export async function fetchText(
  url: string,
  opts: { timeout?: number; headers?: Record<string, string> } = {},
): Promise<string | null> {
  const { timeout = DEFAULT_TIMEOUT, headers = {} } = opts;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeout);
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { 'User-Agent': USER_AGENT, ...headers },
    });
    clearTimeout(t);
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

const IPV4_RE = /^(\d{1,3}\.){3}\d{1,3}$/;
const IPV6_RE = /^[0-9a-fA-F:]+$/;
const CVE_RE = /^CVE-\d{4}-\d{4,}$/i;
const ASN_RE = /^(AS)?\d+$/i;
const DOMAIN_RE = /^(?=.{1,253}$)(([a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,})$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidIp(s: string): boolean {
  return IPV4_RE.test(s) || IPV6_RE.test(s);
}
export function isValidIpv4(s: string): boolean {
  return IPV4_RE.test(s);
}
export function isValidDomain(s: string): boolean {
  return DOMAIN_RE.test(s);
}
export function isValidCve(s: string): boolean {
  return CVE_RE.test(s);
}
export function isValidAsn(s: string): boolean {
  return ASN_RE.test(s);
}
export function isValidEmail(s: string): boolean {
  return EMAIL_RE.test(s);
}
export function isValidMac(s: string): boolean {
  return /^[0-9A-Fa-f]{2}([:-][0-9A-Fa-f]{2}){5}$/.test(s.trim());
}

const PRIVATE_CIDRS = [
  /^10\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^127\./,
  /^169\.254\./,
  /^0\./,
  /^224\./,
  /^240\./,
  /^::1$/,
  /^fe80:/i,
  /^fc00:/i,
  /^fd00:/i,
];

export function isPrivateIp(ip: string): boolean {
  return PRIVATE_CIDRS.some(re => re.test(ip));
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function errorResponse(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

export function successResponse(data: any, source: string, cached = false) {
  return Response.json({
    ...data,
    source,
    timestamp: Date.now(),
    cached,
  });
}
