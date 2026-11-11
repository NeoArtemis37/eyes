

export type CountryEntry = { name: string; iso2: string; key: string };

function norm(raw: string): string {
  return raw
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\u2019\u02bc`]/g, "'")
    .replace(/[^a-z0-9' ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^the /, '');
}

/** [canonical display name, ISO-2, ...aliases] */
const RAW: [string, string, ...string[]][] = [
  ['Afghanistan', 'AF'],
  ['Albania', 'AL'],
  ['Algeria', 'DZ'],
  ['Andorra', 'AD'],
  ['Angola', 'AO'],
  ['Antigua and Barbuda', 'AG'],
  ['Argentina', 'AR'],
  ['Armenia', 'AM'],
  ['Australia', 'AU'],
  ['Austria', 'AT'],
  ['Azerbaijan', 'AZ'],
  ['Bahamas', 'BS'],
  ['Bahrain', 'BH'],
  ['Bangladesh', 'BD'],
  ['Barbados', 'BB'],
  ['Belarus', 'BY'],
  ['Belgium', 'BE'],
  ['Belize', 'BZ'],
  ['Benin', 'BJ'],
  ['Bhutan', 'BT'],
  ['Bolivia', 'BO', 'plurinational state of bolivia'],
  ['Bosnia and Herzegovina', 'BA', 'bosnia', 'bosnia herzegovina'],
  ['Botswana', 'BW'],
  ['Brazil', 'BR'],
  ['Brunei', 'BN', 'brunei darussalam'],
  ['Bulgaria', 'BG'],
  ['Burkina Faso', 'BF'],
  ['Burundi', 'BI'],
  ['Cabo Verde', 'CV', 'cape verde'],
  ['Cambodia', 'KH'],
  ['Cameroon', 'CM'],
  ['Canada', 'CA'],
  ['Central African Republic', 'CF'],
  ['Chad', 'TD'],
  ['Chile', 'CL'],
  ['China', 'CN', "people's republic of china", "people s republic of china"],
  ['Colombia', 'CO'],
  ['Comoros', 'KM'],
  ["Côte d'Ivoire", 'CI', 'ivory coast', 'ivorian republic'],
  ['Congo (Republic)', 'CG', 'republic of the congo', 'congo republic of the', 'congo brazzaville'],
  ['DR Congo', 'CD', 'democratic republic of the congo', 'congo democratic republic of the', 'congo kinshasa', 'zaire', 'drc'],
  ['Costa Rica', 'CR'],
  ['Croatia', 'HR'],
  ['Cuba', 'CU'],
  ['Cyprus', 'CY'],
  ['Czechia', 'CZ', 'czech republic'],
  ['Denmark', 'DK'],
  ['Djibouti', 'DJ'],
  ['Dominica', 'DM'],
  ['Dominican Republic', 'DO'],
  ['Ecuador', 'EC'],
  ['Egypt', 'EG'],
  ['El Salvador', 'SV'],
  ['Equatorial Guinea', 'GQ'],
  ['Eritrea', 'ER'],
  ['Estonia', 'EE'],
  ['Eswatini', 'SZ', 'swaziland'],
  ['Ethiopia', 'ET'],
  ['Fiji', 'FJ'],
  ['Finland', 'FI'],
  ['France', 'FR', 'french republic'],
  ['Gabon', 'GA'],
  ['Gambia', 'GM'],
  ['Georgia', 'GE'],
  ['Germany', 'DE'],
  ['Ghana', 'GH'],
  ['Greece', 'GR'],
  ['Grenada', 'GD'],
  ['Guatemala', 'GT'],
  ['Guinea', 'GN', 'guinea conakry'],
  ['Guinea-Bissau', 'GW'],
  ['Guyana', 'GY'],
  ['Haiti', 'HT'],
  ['Honduras', 'HN'],
  ['Hungary', 'HU'],
  ['Iceland', 'IS'],
  ['India', 'IN', 'republic of india'],
  ['Indonesia', 'ID'],
  ['Iran', 'IR', 'iran islamic republic of', 'islamic republic of iran'],
  ['Iraq', 'IQ'],
  ['Ireland', 'IE'],
  ['Israel', 'IL'],
  ['Italy', 'IT', 'italian republic'],
  ['Jamaica', 'JM'],
  ['Japan', 'JP'],
  ['Jordan', 'JO'],
  ['Kazakhstan', 'KZ'],
  ['Kenya', 'KE'],
  ['Kiribati', 'KI'],
  ['Kosovo', 'XK'],
  ['Kuwait', 'KW'],
  ['Kyrgyzstan', 'KG'],
  ['Laos', 'LA', "lao people s democratic republic", 'lao pdr'],
  ['Latvia', 'LV'],
  ['Lebanon', 'LB'],
  ['Lesotho', 'LS'],
  ['Liberia', 'LR'],
  ['Libya', 'LY'],
  ['Liechtenstein', 'LI'],
  ['Lithuania', 'LT'],
  ['Luxembourg', 'LU'],
  ['Madagascar', 'MG'],
  ['Malawi', 'MW'],
  ['Malaysia', 'MY'],
  ['Maldives', 'MV'],
  ['Mali', 'ML', 'republic of mali'],
  ['Malta', 'MT'],
  ['Marshall Islands', 'MH'],
  ['Mauritania', 'MR'],
  ['Mauritius', 'MU'],
  ['Mexico', 'MX', 'united mexican states'],
  ['Micronesia', 'FM', 'federated states of micronesia'],
  ['Moldova', 'MD', 'moldova republic of', 'republic of moldova'],
  ['Monaco', 'MC'],
  ['Mongolia', 'MN'],
  ['Montenegro', 'ME'],
  ['Morocco', 'MA', 'kingdom of morocco'],
  ['Mozambique', 'MZ'],
  ['Myanmar', 'MM', 'burma', 'myanmar burma'],
  ['Namibia', 'NA'],
  ['Nauru', 'NR'],
  ['Nepal', 'NP'],
  ['Netherlands', 'NL', 'holland', 'kingdom of the netherlands'],
  ['New Zealand', 'NZ', 'aotearoa'],
  ['Nicaragua', 'NI'],
  ['Niger', 'NE', 'republic of the niger'],
  ['Nigeria', 'NG', 'federal republic of nigeria'],
  ['North Korea', 'KP', "democratic people s republic of korea", 'korea north', 'dprk'],
  ['North Macedonia', 'MK', 'macedonia', 'tfyr of macedonia', 'the former yugoslav republic of macedonia'],
  ['Norway', 'NO'],
  ['Oman', 'OM'],
  ['Pakistan', 'PK'],
  ['Palau', 'PW'],
  ['Palestine', 'PS', 'palestinian territory', 'palestinian territories', 'state of palestine', 'west bank', 'gaza strip'],
  ['Panama', 'PA'],
  ['Papua New Guinea', 'PG'],
  ['Paraguay', 'PY'],
  ['Peru', 'PE'],
  ['Philippines', 'PH'],
  ['Poland', 'PL'],
  ['Portugal', 'PT'],
  ['Qatar', 'QA'],
  ['Romania', 'RO'],
  ['Russia', 'RU', 'russian federation', 'russia federation'],
  ['Rwanda', 'RW'],
  ['Saint Kitts and Nevis', 'KN', 'st kitts and nevis'],
  ['Saint Lucia', 'LC', 'st lucia'],
  ['Saint Vincent and the Grenadines', 'VC', 'st vincent and the grenadines'],
  ['Samoa', 'WS'],
  ['San Marino', 'SM'],
  ['Sao Tome and Principe', 'ST', 'são tomé and principe', 'sao tome'],
  ['Saudi Arabia', 'SA', 'kingdom of saudi arabia'],
  ['Senegal', 'SN', 'republic of senegal'],
  ['Serbia', 'RS', 'republic of serbia'],
  ['Seychelles', 'SC'],
  ['Sierra Leone', 'SL'],
  ['Singapore', 'SG', 'republic of singapore'],
  ['Slovakia', 'SK', 'slovak republic'],
  ['Slovenia', 'SI'],
  ['Solomon Islands', 'SB'],
  ['Somalia', 'SO'],
  ['South Africa', 'ZA', 'republic of south africa'],
  ['South Korea', 'KR', 'republic of korea', 'korea south', 'korea republic of', 'korea'],
  ['South Sudan', 'SS'],
  ['Spain', 'ES', 'kingdom of spain'],
  ['Sri Lanka', 'LK', 'ceylon'],
  ['Sudan', 'SD', 'north sudan'],
  ['Suriname', 'SR'],
  ['Sweden', 'SE', 'kingdom of sweden'],
  ['Switzerland', 'CH', 'swiss confederation'],
  ['Syria', 'SY', 'syrian arab republic'],
  ['Taiwan', 'TW', 'republic of china taiwan', 'chinese taipei', 'taiwan china', 'taipei china'],
  ['Tajikistan', 'TJ'],
  ['Tanzania', 'TZ', 'tanzania united republic of', 'united republic of tanzania'],
  ['Thailand', 'TH', 'kingdom of thailand'],
  ['Timor-Leste', 'TL', 'east timor'],
  ['Togo', 'TG', 'togolese republic'],
  ['Tonga', 'TO'],
  ['Trinidad and Tobago', 'TT'],
  ['Tunisia', 'TN', 'tunisian republic'],
  ['Turkey', 'TR', 'turkiye', 'turkey republic'],
  ['Turkmenistan', 'TM'],
  ['Tuvalu', 'TV'],
  ['Uganda', 'UG', 'republic of uganda'],
  ['Ukraine', 'UA'],
  ['United Arab Emirates', 'AE', 'uae', 'emirates'],
  ['United Kingdom', 'GB', 'uk', 'great britain', 'england', 'scotland', 'wales', 'northern ireland', 'united kingdom of great britain and northern ireland'],
  ['United States', 'US', 'usa', 'us', 'united states of america', 'america', 'u s a'],
  ['Uruguay', 'UY', 'oriental republic of uruguay'],
  ['Uzbekistan', 'UZ'],
  ['Vanuatu', 'VU'],
  ['Vatican City', 'VA', 'holy see', 'vatican city state', 'vatican'],
  ['Venezuela', 'VE', 'venezuela bolivarian republic of', 'bolivarian republic of venezuela'],
  ['Vietnam', 'VN', 'viet nam', 'socialist republic of viet nam'],
  ['Yemen', 'YE'],
  ['Zambia', 'ZM', 'republic of zambia'],
  ['Zimbabwe', 'ZW'],
  // · Common territories / special entries seen in GeoIP feeds —
  ['Hong Kong', 'HK', 'hong kong sar china', 'hong kong sar'],
  ['Macao', 'MO', 'macau', 'macau sar china', 'macao sar china'],
  ['Greenland', 'GL'],
  ['Puerto Rico', 'PR'],
  ['Bermuda', 'BM'],
  ['Cayman Islands', 'KY'],
  ['Aruba', 'AW'],
  ['Curacao', 'CW'],
  ['Gibraltar', 'GI'],
  ['Faroe Islands', 'FO'],
  ['Isle of Man', 'IM'],
  ['Jersey', 'JE'],
  ['Guernsey', 'GG'],
  ['New Caledonia', 'NC'],
  ['French Polynesia', 'PF'],
  ['Reunion', 'RE'],
  ['Mayotte', 'YT'],
  ['Guam', 'GU'],
  ['American Samoa', 'AS'],
  ['Northern Mariana Islands', 'MP'],
  ['U.S. Virgin Islands', 'VI', 'us virgin islands', 'united states virgin islands'],
  ['Turks and Caicos Islands', 'TC'],
  ['British Virgin Islands', 'VG'],
  ['Anguilla', 'AI'],
  ['Antarctica', 'AQ'],
  ['Falkland Islands', 'FK', 'malvinas'],
  ['Saint Helena', 'SH'],
  ['Saint Pierre and Miquelon', 'PM'],
  ['Wallis and Futuna', 'WF'],
];

/** key → entry (canonical + alias keys). */
const KEY_TO_ENTRY = new Map<string, CountryEntry>();
for (const [name, iso2, ...aliases] of RAW) {
  const entry: CountryEntry = { name, iso2, key: norm(name) };
  KEY_TO_ENTRY.set(entry.key, entry);
  for (const a of aliases) {
    const k = norm(a);
    if (!KEY_TO_ENTRY.has(k)) KEY_TO_ENTRY.set(k, entry);
  }
}
// ISO-2 codes (lowercase) also resolve to their entry · some GeoIP
// providers return codes instead of names.
for (const [name, iso2] of RAW) {
  const entry = KEY_TO_ENTRY.get(norm(name));
  const low = iso2.toLowerCase();
  if (entry && !KEY_TO_ENTRY.has(low)) KEY_TO_ENTRY.set(low, entry);
}

/** All canonical entries, alphabetical by display name. */
export const ALL_COUNTRIES: CountryEntry[] = RAW.map(
  ([name, iso2]) => ({ name, iso2, key: norm(name) })
).sort((a, b) => a.name.localeCompare(b.name));

/** Normalize ANY country string (GeoIP name, ISO-2, alias…) to its
 *  CANONICAL key · alias-resolved, so "Russian Federation" and "Russia"
 *  collapse to the same key. Unknown names normalize to a synthetic key. */
export function normCountry(raw: string | undefined | null): string {
  if (!raw) return '';
  const k = norm(raw);
  if (!k) return '';
  return KEY_TO_ENTRY.get(k)?.key ?? k;
}

/** Entry for a canonical key · synthetic (no ISO-2) when unknown.
 *  Defensive: also accepts a raw string (normalized first). */
export function entryFor(key: string): CountryEntry {
  const k = norm(key);
  return KEY_TO_ENTRY.get(k) ?? { name: key, iso2: '', key: k };
}

/** Full lookup from ANY raw country string → entry (alias-resolved). */
export function countryEntry(raw: string | undefined | null): CountryEntry | null {
  if (!raw) return null;
  const k = norm(raw);
  if (!k) return null;
  return KEY_TO_ENTRY.get(k) ?? { name: raw, iso2: '', key: k };
}

/** ISO-2 for a canonical key ('' when unknown). */
export function iso2For(key: string): string {
  return KEY_TO_ENTRY.get(key)?.iso2 ?? '';
}
