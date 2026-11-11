

import { clamp, type BreachItem } from './types';


export const CENTROID: Record<string, [number, number]> = {
  DZ: [3.05, 36.75], AO: [13.23, -8.84], BJ: [2.62, 6.5], BW: [25.87, -24.65],
  BF: [-1.52, 12.37], BI: [29.36, -3.38], CM: [11.5, 3.87], CV: [-23.51, 14.92],
  CF: [18.56, 4.36], TD: [15.05, 12.13], KM: [43.26, -11.69], CD: [15.27, -4.44],
  CG: [15.24, -4.26], CI: [-5.28, 6.83], DJ: [43.15, 11.59], EG: [31.24, 30.05],
  GQ: [8.78, 3.75], ER: [15.33, 15.33], ET: [38.75, 9.02], GA: [9.45, 0.42],
  GM: [-16.57, 13.45], GH: [-0.2, 5.56], GN: [-13.68, 9.51], GW: [-15.6, 11.86],
  KE: [36.82, -1.29], LS: [27.48, -29.31], LR: [-10.8, 6.3], LY: [13.19, 32.88],
  MG: [47.52, -18.88], MW: [33.79, -13.97], ML: [-8.0, 12.64], MR: [-15.98, 18.08],
  MU: [57.5, -20.17], MA: [-6.84, 34.02], MZ: [32.57, -25.97], NA: [17.08, -22.57],
  NE: [2.11, 13.51], NG: [7.49, 9.06], RW: [30.06, -1.94], ST: [6.73, 0.34],
  SN: [-17.44, 14.69], SC: [55.45, -4.62], SL: [-13.23, 8.47], SO: [45.34, 2.05],
  ZA: [28.05, -26.2], SS: [31.58, 4.85], SD: [32.53, 15.6], TZ: [39.28, -6.16],
  TG: [1.13, 6.13], TN: [10.18, 36.8], UG: [32.58, 0.35], ZM: [28.28, -15.4],
  ZW: [31.05, -17.83], SH: [-5.7, -15.95], RE: [55.45, -21.1], YT: [45.23, -12.78],
  US: [-98.5, 37.5], GB: [-2.0, 52.5], FR: [2.4, 46.6], DE: [10.4, 51.1],
  RU: [60.0, 60.0], CN: [104.0, 35.0], JP: [138.5, 36.5], BR: [-51.9, -14.2],
  IN: [79.0, 22.0], CA: [-106.3, 56.1], AU: [134.0, -25.0], IT: [12.8, 42.8],
  ES: [-3.7, 40.4], NL: [5.3, 52.2], PL: [19.4, 52.1], UA: [31.0, 49.0],
  TR: [35.0, 39.0], MX: [-102.5, 23.6], AR: [-64.0, -35.0], KR: [127.9, 36.4],
  SE: [15.5, 62.0], CH: [8.2, 46.8], AT: [14.0, 47.5], BE: [4.6, 50.6],
  PT: [-8.1, 39.6], RO: [25.0, 45.9], GR: [22.0, 39.0], IL: [35.0, 31.5],
  AE: [54.0, 24.0], SA: [45.0, 24.0], MY: [102.5, 4.5], SG: [103.8, 1.35],
  ID: [113.9, -0.8], TH: [101.0, 15.0], VN: [105.8, 16.5], PH: [122.0, 12.0],
  PK: [69.3, 30.4], BD: [90.0, 23.8], NZ: [174.7, -41.2], CL: [-71.2, -35.7],
  CO: [-74.3, 4.6], PE: [-75.0, -10.0], VE: [-66.0, 7.0],
};

const AFRICA_ISO = new Set(Object.keys(CENTROID).filter(
  (c) => !['US', 'GB', 'FR', 'DE', 'RU', 'CN', 'JP', 'BR', 'IN', 'CA', 'AU',
    'IT', 'ES', 'NL', 'PL', 'UA', 'TR', 'MX', 'AR', 'KR', 'SE', 'CH', 'AT',
    'BE', 'PT', 'RO', 'GR', 'IL', 'AE', 'SA', 'MY', 'SG', 'ID', 'TH', 'VN',
    'PH', 'PK', 'BD', 'NZ', 'CL', 'CO', 'PE', 'VE'].includes(c)
));


const TLD_TO_ISO: Record<string, string> = {
  za: 'ZA', ng: 'NG', ke: 'KE', eg: 'EG', ma: 'MA', tn: 'TN', dz: 'DZ',
  gh: 'GH', ci: 'CI', sn: 'SN', cm: 'CM', cd: 'CD', ao: 'AO', tz: 'TZ',
  ug: 'UG', zw: 'ZW', zm: 'ZM', bw: 'BW', na: 'NA', ly: 'LY', sd: 'SD',
  et: 'ET', mu: 'MU', sc: 'SC', rw: 'RW', mw: 'MW', mz: 'MZ', bj: 'BJ',
  bf: 'BF', ml: 'ML', ne: 'NE', td: 'TD', ga: 'GA', gq: 'GQ', cg: 'CG',
  gn: 'GN', gw: 'GW', lr: 'LR', sl: 'SL', tg: 'TG', cv: 'CV', gm: 'GM',
  km: 'KM', so: 'SO', ss: 'SS', dj: 'DJ', er: 'ER', bi: 'BI', ls: 'LS',
  sz: 'SZ', re: 'RE', yt: 'YT', mg: 'MG', sh: 'SH',
  us: 'US', uk: 'GB', fr: 'FR', de: 'DE', ru: 'RU', cn: 'CN', jp: 'JP',
  br: 'BR', in: 'IN', ca: 'CA', au: 'AU', it: 'IT', es: 'ES', nl: 'NL',
  pl: 'PL', ua: 'UA', tr: 'TR', mx: 'MX', ar: 'AR', kr: 'KR', se: 'SE',
  ch: 'CH', at: 'AT', be: 'BE', pt: 'PT', ro: 'RO', gr: 'GR', il: 'IL',
  ae: 'AE', sa: 'SA', my: 'MY', sg: 'SG', th: 'TH', vn: 'VN', ph: 'PH',
  pk: 'PK', bd: 'BD', nz: 'NZ', cl: 'CL', co: 'CO', pe: 'PE', ve: 'VE',
};

const TEXT_ISO: [string, string][] = [
  ['south africa', 'ZA'], ['nigeria', 'NG'], ['nigerian', 'NG'], ['kenya', 'KE'],
  ['kenyan', 'KE'], ['egypt', 'EG'], ['egyptian', 'EG'], ['morocco', 'MA'],
  ['moroccan', 'MA'], ['ghana', 'GH'], ['ghanaian', 'GH'], ['tunisia', 'TN'],
  ['tunisian', 'TN'], ['algeria', 'DZ'], ['algerian', 'DZ'], ['ethiopia', 'ET'],
  ['tanzania', 'TZ'], ['uganda', 'UG'], ['zimbabwe', 'ZW'], ['zambia', 'ZM'],
  ['senegal', 'SN'], ['senegalese', 'SN'], ['cameroon', 'CM'],
  ["côte d'ivoire", 'CI'], ['ivory coast', 'CI'], ['mozambique', 'MZ'],
  ['angola', 'AO'], ['congo', 'CD'], ['rwanda', 'RW'], ['botswana', 'BW'],
  ['namibia', 'NA'], ['libya', 'LY'], ['sudan', 'SD'], ['sudanese', 'SD'],
  ['somalia', 'SO'], ['malawi', 'MW'], ['mali', 'ML'], ['mauritius', 'MU'],
  ['gabon', 'GA'], ['benin', 'BJ'], ['togo', 'TG'], ['guinea', 'GN'],
  ['liberia', 'LR'], ['sierra leone', 'SL'], ['burkina faso', 'BF'],
  ['niger', 'NE'], ['chad', 'TD'], ['djibouti', 'DJ'], ['eritrea', 'ER'],
  ['lesotho', 'LS'], ['eswatini', 'SZ'], ['gambia', 'GM'],
  ['united states', 'US'], ['american', 'US'], ['usa', 'US'],
  ['united kingdom', 'GB'], ['british', 'GB'], [' uk ', 'GB'],
  ['france', 'FR'], ['french', 'FR'], ['germany', 'DE'], ['german', 'DE'],
  ['russia', 'RU'], ['russian', 'RU'], ['china', 'CN'], ['chinese', 'CN'],
  ['india', 'IN'], ['indian', 'IN'], ['brazil', 'BR'], ['brazilian', 'BR'],
  ['japan', 'JP'], ['japanese', 'JP'], ['canada', 'CA'], ['canadian', 'CA'],
  ['australia', 'AU'], ['australian', 'AU'], ['spain', 'ES'], ['spanish', 'ES'],
  ['italy', 'IT'], ['italian', 'IT'], ['netherlands', 'NL'], ['dutch', 'NL'],
  ['poland', 'PL'], ['ukraine', 'UA'], ['ukrainian', 'UA'], ['turkey', 'TR'],
  ['turkish', 'TR'], ['mexico', 'MX'], ['indonesia', 'ID'], ['pakistan', 'PK'],
  ['philippines', 'PH'], ['sweden', 'SE'], ['swiss', 'CH'], ['switzerland', 'CH'],
  ['austria', 'AT'], ['belgium', 'BE'], ['portugal', 'PT'], ['greece', 'GR'],
  ['israel', 'IL'], ['emirates', 'AE'], ['saudi', 'SA'], ['thailand', 'TH'],
  ['vietnam', 'VN'], ['new zealand', 'NZ'], ['chile', 'CL'],
  ['colombia', 'CO'], ['peru', 'PE'], ['venezuela', 'VE'],
];

const TEXT_AFRICA = /\bafrica\b|\bafrican\b/i;


const VANITY_TLD_NAMES = new Set([
  'breachforums', 'breachforumsversion5', 'breachforumsversion6',
  'bolt', 'stalkeronline', 'thefappening', 'hunter',
]);


const escRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const TEXT_ISO_RE: [RegExp, string][] = TEXT_ISO.map(([phrase, iso]) => {
  const p = phrase.trim().replace(/\u2019/g, "'");
  return [new RegExp(`\\b${escRe(p)}\\b`, 'i'), iso];
});

function detectCountry(
  title: string,
  description: string,
  domain: string
): { country?: string; evidence?: 'tld' | 'text'; africaByText: boolean } {
  const hay = `${title} ${description}`
    .toLowerCase()
    .replace(/\u2019/g, "'");
  let africaByText = false;
  for (const [re, iso] of TEXT_ISO_RE) {
    if (re.test(hay)) {
      return { country: iso, evidence: 'text', africaByText: AFRICA_ISO.has(iso) };
    }
  }
  if (TEXT_AFRICA.test(hay)) africaByText = true;
  const tld = domain.split('.').pop() ?? '';
  const iso = TLD_TO_ISO[tld];
  if (iso) return { country: iso, evidence: 'tld', africaByText };
  return { africaByText };
}

const stripHtml = (s: string) =>
  s.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#0?39;/g, "'")
    .trim();

function severityOf(pwn: number, sensitive: boolean, malware: boolean): number {
  const mag = Math.log10(Math.max(10, pwn)); // 1..8+
  return clamp(Math.round(mag * 11 + (sensitive ? 12 : 0) + (malware ? 10 : 0)), 20, 95);
}


type HIBPBreach = {
  Name?: string; Title?: string; Domain?: string; BreachDate?: string;
  PwnCount?: number; Description?: string; DataClasses?: string[];
  IsVerified?: boolean; IsSensitive?: boolean; IsMalware?: boolean;
};

export async function fetchBreaches(): Promise<BreachItem[]> {
  const res = await fetch('/api/network/breaches', {
    signal: AbortSignal.timeout(15_000),
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const raw = (await res.json()) as HIBPBreach[];
  if (!Array.isArray(raw)) return [];
  const out: BreachItem[] = [];
  for (const b of raw) {
    const name = String(b.Name ?? '').trim();
    const title = String(b.Title ?? name).trim();
    if (!name) continue;
    const domain = String(b.Domain ?? '').toLowerCase();
    const pwn = Number(b.PwnCount ?? 0) || 0;
    const desc = stripHtml(String(b.Description ?? ''));
    const det = detectCountry(title, desc, domain);
    let country = det.country;
    if (det.evidence === 'tld' && VANITY_TLD_NAMES.has(name.toLowerCase())) {
      country = undefined;
    }
    const isAfrica =
      (country !== undefined && AFRICA_ISO.has(country)) || det.africaByText;
    const centroid = country ? CENTROID[country] : undefined;
    out.push({
      id: `hibp-${name}`,
      name,
      title,
      domain: domain || undefined,
      breachDate: String(b.BreachDate ?? ''),
      pwnCount: pwn,
      dataClasses: Array.isArray(b.DataClasses) ? b.DataClasses.slice(0, 10) : [],
      description: desc,
      verified: b.IsVerified === true,
      sensitive: b.IsSensitive === true,
      malware: b.IsMalware === true,
      country,
      countryEvidence: country ? det.evidence : undefined,
      geo: centroid ? { lon: centroid[0], lat: centroid[1] } : undefined,
      isAfrica,
      severity: severityOf(pwn, b.IsSensitive === true, b.IsMalware === true),
    });
  }
  out.sort(
    (a, b) =>
      Number(b.isAfrica) - Number(a.isAfrica) || b.severity - a.severity
  );
  return out;
}
