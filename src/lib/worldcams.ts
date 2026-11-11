

import { promises as fs } from 'fs';
import { join } from 'path';


export type WorldCam = {
  id: string;
  slug: string;
  title: string;
  sub: string | null;
  cc: string | null;
  country: string | null;
  city: string | null;
  region: string | null;
  nkey: string;
  cats: string[];
  lat: number | null;
  lon: number | null;
  geo: 'city' | 'country' | null;
  badge: string | null;
};

export type CatalogStats = {
  cams: number;
  countries: number;
  cities: number;
  cats: Record<string, number>;
  discoveredAt: string;
  partial: boolean;
};

type Catalog = { cams: WorldCam[]; stats: CatalogStats };


const COUNTRY_MAP: Record<string, [string, string, number, number]> = {
  'france': ['FR', 'France', 46.23, 2.21],
  'deutschland': ['DE', 'Allemagne', 51.17, 10.45],
  'espana': ['ES', 'Espagne', 40.46, -3.75],
  'italia': ['IT', 'Italie', 41.87, 12.57],
  'united-kingdom': ['GB', 'Royaume-Uni', 54.0, -2.5],
  'netherlands': ['NL', 'Pays-Bas', 52.13, 5.29],
  'belgium': ['BE', 'Belgique', 50.5, 4.47],
  'schweiz': ['CH', 'Suisse', 46.82, 8.23],
  'austria': ['AT', 'Autriche', 47.52, 14.55],
  'portugal': ['PT', 'Portugal', 39.4, -8.22],
  'ireland': ['IE', 'Irlande', 53.41, -8.24],
  'ellada': ['GR', 'Grèce', 39.07, 21.82],
  'hrvatska': ['HR', 'Croatie', 45.1, 15.2],
  'slovenija': ['SI', 'Slovénie', 46.15, 14.99],
  'albania': ['AL', 'Albanie', 41.15, 20.17],
  'bosnia-and-herzegovina': ['BA', 'Bosnie-Herzégovine', 43.92, 17.68],
  'montenegro': ['ME', 'Monténégro', 42.71, 19.37],
  'north-macedonia': ['MK', 'Macédoine du Nord', 41.61, 21.75],
  'macedonia': ['MK', 'Macédoine du Nord', 41.61, 21.75],
  'serbia': ['RS', 'Serbie', 44.02, 21.01],
  'kosovo': ['XK', 'Kosovo', 42.6, 20.9],
  'bulgaria': ['BG', 'Bulgarie', 42.73, 25.49],
  'romania': ['RO', 'Roumanie', 45.94, 24.97],
  'hungary': ['HU', 'Hongrie', 47.16, 19.5],
  'czech-republic': ['CZ', 'Tchéquie', 49.82, 15.47],
  'czechia': ['CZ', 'Tchéquie', 49.82, 15.47],
  'slovakia': ['SK', 'Slovaquie', 48.67, 19.7],
  'poland': ['PL', 'Pologne', 51.92, 19.15],
  'lithuania': ['LT', 'Lituanie', 55.17, 23.88],
  'latvia': ['LV', 'Lettonie', 56.88, 24.6],
  'estonia': ['EE', 'Estonie', 58.6, 25.01],
  'finland': ['FI', 'Finlande', 61.92, 25.75],
  'sweden': ['SE', 'Suède', 60.13, 18.64],
  'norway': ['NO', 'Norvège', 60.47, 8.47],
  'norge': ['NO', 'Norvège', 60.47, 8.47],
  'denmark': ['DK', 'Danemark', 56.26, 9.5],
  'iceland': ['IS', 'Islande', 64.96, -19.02],
  'faroe-islands': ['FO', 'Féroé', 61.89, -6.91],
  'luxembourg': ['LU', 'Luxembourg', 49.82, 6.13],
  'malta': ['MT', 'Malte', 35.94, 14.38],
  'cyprus': ['CY', 'Chypre', 35.13, 33.43],
  'repubblica-di-san-marino': ['SM', 'Saint-Marin', 43.94, 12.46],
  'andorra': ['AD', 'Andorre', 42.51, 1.52],
  'monaco': ['MC', 'Monaco', 43.75, 7.41],
  'liechtenstein': ['LI', 'Liechtenstein', 47.17, 9.56],
  'gibraltar': ['GI', 'Gibraltar', 36.14, -5.35],
  'ukraine': ['UA', 'Ukraine', 48.38, 31.17],
  'belarus': ['BY', 'Bélarus', 53.71, 27.95],
  'moldova': ['MD', 'Moldavie', 47.41, 28.37],
  'turkey': ['TR', 'Turquie', 38.96, 35.24],
  'georgia': ['GE', 'Géorgie', 42.32, 43.36],
  'armenia': ['AM', 'Arménie', 40.07, 45.04],
  'azerbaijan': ['AZ', 'Azerbaïdjan', 40.14, 47.58],
  'isle-of-man': ['IM', 'Île de Man', 54.24, -4.55],
  'jersey': ['JE', 'Jersey', 49.21, -2.13],
  'guernsey': ['GG', 'Guernesey', 49.44, -2.58],
  'morocco': ['MA', 'Maroc', 31.79, -7.09],
  'algeria': ['DZ', 'Algérie', 28.03, 1.66],
  'tunisia': ['TN', 'Tunisie', 33.89, 9.54],
  'libya': ['LY', 'Libye', 26.34, 17.23],
  'egypt': ['EG', 'Égypte', 26.82, 30.8],
  'senegal': ['SN', 'Sénégal', 14.5, -14.45],
  'gambia': ['GM', 'Gambie', 13.44, -15.31],
  'mauritania': ['MR', 'Mauritanie', 20.26, -10.94],
  'mali': ['ML', 'Mali', 17.57, -4.0],
  'burkina-faso': ['BF', 'Burkina Faso', 12.24, -1.56],
  'niger': ['NE', 'Niger', 17.61, 8.08],
  'nigeria': ['NG', 'Nigéria', 9.08, 8.68],
  'ghana': ['GH', 'Ghana', 7.95, -1.02],
  'togo': ['TG', 'Togo', 8.62, 0.82],
  'benin': ['BJ', 'Bénin', 9.31, 2.32],
  'cote-d-ivoire': ['CI', "Côte d'Ivoire", 7.54, -5.55],
  'ivory-coast': ['CI', "Côte d'Ivoire", 7.54, -5.55],
  'liberia': ['LR', 'Liberia', 6.43, -9.43],
  'sierra-leone': ['SL', 'Sierra Leone', 8.46, -11.78],
  'guinea': ['GN', 'Guinée', 9.95, -9.7],
  'guinee': ['GN', 'Guinée', 9.95, -9.7],
  'guinea-bissau': ['GW', 'Guinée-Bissau', 11.8, -15.18],
  'cameroon': ['CM', 'Cameroun', 7.37, 12.35],
  'central-african-republic': ['CF', 'Centrafrique', 6.61, 20.94],
  'equatorial-guinea': ['GQ', 'Guinée équatoriale', 1.65, 10.27],
  'gabon': ['GA', 'Gabon', -0.8, 11.61],
  'congo': ['CD', 'RD Congo', -4.04, 21.76],
  'congo-kinshasa': ['CD', 'RD Congo', -4.04, 21.76],
  'republic-of-the-congo': ['CG', 'Congo', 0.23, 15.83],
  'chad': ['TD', 'Tchad', 15.45, 18.73],
  'sudan': ['SD', 'Soudan', 12.86, 30.22],
  'south-sudan': ['SS', 'Soudan du Sud', 6.88, 31.31],
  'ethiopia': ['ET', 'Éthiopie', 9.15, 40.49],
  'eritrea': ['ER', 'Érythrée', 15.18, 39.78],
  'djibouti': ['DJ', 'Djibouti', 11.83, 42.59],
  'somalia': ['SO', 'Somalie', 5.15, 46.2],
  'kenya': ['KE', 'Kenya', -0.02, 37.91],
  'uganda': ['UG', 'Ouganda', 1.37, 32.29],
  'rwanda': ['RW', 'Rwanda', -1.94, 29.87],
  'tanzania': ['TZ', 'Tanzanie', -6.37, 34.89],
  'zanzibar': ['TZ', 'Zanzibar', -6.16, 39.2],
  'burundi': ['BI', 'Burundi', -3.37, 29.92],
  'mozambique': ['MZ', 'Mozambique', -18.67, 35.53],
  'zambia': ['ZM', 'Zambie', -13.13, 27.85],
  'zimbabwe': ['ZW', 'Zimbabwe', -19.02, 29.15],
  'malawi': ['MW', 'Malawi', -13.25, 34.3],
  'botswana': ['BW', 'Botswana', -22.33, 24.68],
  'namibia': ['NA', 'Namibie', -22.96, 18.49],
  'angola': ['AO', 'Angola', -11.2, 17.87],
  'south-africa': ['ZA', 'Afrique du Sud', -30.56, 22.94],
  'madagascar': ['MG', 'Madagascar', -18.77, 46.87],
  'mauritius': ['MU', 'Maurice', -20.35, 57.55],
  'reunion': ['RE', 'Réunion', -21.12, 55.54],
  'mayotte': ['YT', 'Mayotte', -12.83, 45.17],
  'comoros': ['KM', 'Comores', -11.88, 43.87],
  'seychelles': ['SC', 'Seychelles', -4.68, 55.49],
  'sao-tome': ['ST', 'Sao Tomé', 0.19, 6.61],
  'sao-tome-and-principe': ['ST', 'Sao Tomé', 0.19, 6.61],
  'cabo-verde': ['CV', 'Cap-Vert', 16.0, -24.01],
  'western-sahara': ['EH', 'Sahara occidental', 24.21, -12.89],
  'japan': ['JP', 'Japon', 36.2, 138.25],
  'south-korea': ['KR', 'Corée du Sud', 35.91, 127.77],
  'korea': ['KR', 'Corée du Sud', 35.91, 127.77],
  'china': ['CN', 'Chine', 35.86, 104.2],
  'taiwan': ['TW', 'Taïwan', 23.7, 120.96],
  'hong-kong': ['HK', 'Hong Kong', 22.32, 114.17],
  'macau': ['MO', 'Macao', 22.2, 113.54],
  'macao': ['MO', 'Macao', 22.2, 113.54],
  'singapore': ['SG', 'Singapour', 1.35, 103.82],
  'malaysia': ['MY', 'Malaisie', 4.21, 101.98],
  'thailand': ['TH', 'Thaïlande', 15.87, 100.99],
  'vietnam': ['VN', 'Viêt Nam', 14.06, 108.28],
  'philippines': ['PH', 'Philippines', 12.88, 121.77],
  'indonesia': ['ID', 'Indonésie', -0.79, 113.92],
  'india': ['IN', 'Inde', 20.59, 78.96],
  'pakistan': ['PK', 'Pakistan', 30.38, 69.35],
  'bangladesh': ['BD', 'Bangladesh', 23.68, 90.36],
  'nepal': ['NP', 'Népal', 28.39, 84.12],
  'sri-lanka': ['LK', 'Sri Lanka', 7.87, 80.77],
  'maldives': ['MV', 'Maldives', 3.2, 73.22],
  'myanmar': ['MM', 'Birmanie', 21.92, 95.96],
  'cambodia': ['KH', 'Cambodge', 12.57, 104.99],
  'laos': ['LA', 'Laos', 19.86, 102.5],
  'brunei': ['BN', 'Brunei', 4.54, 114.73],
  'mongolia': ['MN', 'Mongolie', 46.86, 103.85],
  'kazakhstan': ['KZ', 'Kazakhstan', 48.02, 66.92],
  'uzbekistan': ['UZ', 'Ouzbékistan', 41.38, 64.59],
  'kyrgyzstan': ['KG', 'Kirghizistan', 41.2, 74.77],
  'tajikistan': ['TJ', 'Tadjikistan', 38.86, 71.28],
  'turkmenistan': ['TM', 'Turkménistan', 38.97, 59.56],
  'afghanistan': ['AF', 'Afghanistan', 33.94, 67.71],
  'iran': ['IR', 'Iran', 32.43, 53.69],
  'iraq': ['IQ', 'Irak', 33.22, 43.68],
  'syria': ['SY', 'Syrie', 34.8, 39.0],
  'lebanon': ['LB', 'Liban', 33.85, 35.86],
  'israel': ['IL', 'Israël', 31.05, 34.85],
  'jordan': ['JO', 'Jordanie', 30.59, 36.24],
  'saudi-arabia': ['SA', 'Arabie saoudite', 23.89, 45.08],
  'united-arab-emirates': ['AE', 'Émirats arabes unis', 23.42, 53.85],
  'emirates': ['AE', 'Émirats arabes unis', 23.42, 53.85],
  'qatar': ['QA', 'Qatar', 25.35, 51.18],
  'kuwait': ['KW', 'Koweït', 29.31, 47.48],
  'bahrain': ['BH', 'Bahreïn', 26.07, 50.56],
  'oman': ['OM', 'Oman', 21.47, 55.98],
  'yemen': ['YE', 'Yémen', 15.55, 48.52],
  'united-states': ['US', 'États-Unis', 39.5, -98.35],
  'usa': ['US', 'États-Unis', 39.5, -98.35],
  'canada': ['CA', 'Canada', 56.13, -106.35],
  'mexico': ['MX', 'Mexique', 23.63, -102.55],
  'guatemala': ['GT', 'Guatemala', 15.78, -90.23],
  'honduras': ['HN', 'Honduras', 15.2, -86.24],
  'el-salvador': ['SV', 'Salvador', 13.79, -88.9],
  'nicaragua': ['NI', 'Nicaragua', 12.87, -85.21],
  'costa-rica': ['CR', 'Costa Rica', 9.75, -83.75],
  'panama': ['PA', 'Panama', 8.54, -80.78],
  'cuba': ['CU', 'Cuba', 21.52, -77.78],
  'jamaica': ['JM', 'Jamaïque', 18.11, -77.3],
  'haiti': ['HT', 'Haïti', 18.97, -72.29],
  'dominican-republic': ['DO', 'République dominicaine', 18.74, -70.16],
  'puerto-rico': ['PR', 'Porto Rico', 18.22, -66.59],
  'barbados': ['BB', 'Barbade', 13.19, -59.54],
  'grenada': ['GD', 'Grenade', 12.12, -61.68],
  'trinidad-and-tobago': ['TT', 'Trinité-et-Tobago', 10.69, -61.22],
  'trinidad-tobago': ['TT', 'Trinité-et-Tobago', 10.69, -61.22],
  'aruba': ['AW', 'Aruba', 12.52, -70.03],
  'curacao': ['CW', 'Curaçao', 12.17, -68.99],
  'bahamas': ['BS', 'Bahamas', 25.03, -77.4],
  'belize': ['BZ', 'Belize', 17.19, -88.5],
  'bermuda': ['BM', 'Bermudes', 32.32, -64.76],
  'cayman': ['KY', 'Caïmans', 19.31, -81.25],
  'turks-and-caicos': ['TC', 'Turks-et-Caïcos', 21.69, -71.8],
  'antigua': ['AG', 'Antigua', 17.06, -61.8],
  'saint-lucia': ['LC', 'Sainte-Lucie', 13.91, -60.98],
  'dominica': ['DM', 'Dominique', 15.41, -61.37],
  'sint-maarten': ['SX', 'Saint-Martin', 18.04, -63.07],
  'us-virgin-islands': ['VI', 'Îles Vierges américaines', 18.34, -64.9],
  'caribbean-netherlands': ['BQ', 'Pays-Bas caribéens', 12.22, -68.28],
  'colombia': ['CO', 'Colombie', 4.57, -74.3],
  'venezuela': ['VE', 'Venezuela', 6.42, -66.59],
  'ecuador': ['EC', 'Équateur', -1.83, -78.18],
  'peru': ['PE', 'Pérou', -9.19, -75.02],
  'bolivia': ['BO', 'Bolivie', -16.29, -63.59],
  'chile': ['CL', 'Chili', -35.68, -71.54],
  'argentina': ['AR', 'Argentine', -38.42, -63.62],
  'uruguay': ['UY', 'Uruguay', -32.52, -55.77],
  'paraguay': ['PY', 'Paraguay', -23.44, -58.44],
  'brazil': ['BR', 'Brésil', -14.24, -51.93],
  'brasil': ['BR', 'Brésil', -14.24, -51.93],
  'guyana': ['GY', 'Guyana', 4.86, -58.93],
  'suriname': ['SR', 'Suriname', 3.92, -56.03],
  'greenland': ['GL', 'Groenland', 71.71, -42.6],
  'guadeloupe': ['GP', 'Guadeloupe', 16.27, -61.55],
  'martinique': ['MQ', 'Martinique', 14.64, -61.02],
  'australia': ['AU', 'Australie', -25.27, 133.78],
  'new-zealand': ['NZ', 'Nouvelle-Zélande', -40.9, 174.89],
  'papua-new-guinea': ['PG', 'Papouasie-Nouvelle-Guinée', -6.31, 143.96],
  'fiji': ['FJ', 'Fidji', -17.71, 178.07],
  'new-caledonia': ['NC', 'Nouvelle-Calédonie', -20.9, 165.62],
  'french-polynesia': ['PF', 'Polynésie française', -17.68, -149.41],
  'samoa': ['WS', 'Samoa', -13.76, -172.1],
  'tonga': ['TO', 'Tonga', -21.18, -175.2],
  'vanuatu': ['VU', 'Vanuatu', -15.38, 166.96],
  'solomon-islands': ['SB', 'Îles Salomon', -9.65, 160.16],
  'svezia': ['SE', 'Suède', 60.13, 18.64],
  'belgique': ['BE', 'Belgique', 50.5, 4.47],
  'russia': ['RU', 'Russie', 61.52, 105.32],
  'saint-barthelemy': ['BL', 'Saint-Barthélemy', 17.9, -62.85],
  'republic-of-singapore': ['SG', 'Singapour', 1.35, 103.82],
  'srbija': ['RS', 'Serbie', 44.02, 21.01],
  'citta-del-vaticano': ['VA', 'Vatican', 41.9, 12.45],
  'malasya': ['MY', 'Malaisie', 4.21, 101.98],
  'anguilla': ['AI', 'Anguilla', 18.22, -63.07],
  'british-virgin-islands': ['VG', 'Îles Vierges britanniques', 18.42, -64.64],
  'cayman-islands': ['KY', 'Caïmans', 19.31, -81.25],
};

const TZ_MAIN: Record<string, number> = {
  FR: 1, ES: 1, IT: 1, DE: 1, BE: 1, NL: 1, CH: 1, AT: 1, SE: 1, NO: 1,
  DK: 1, PL: 1, CZ: 1, SK: 1, HU: 1, SI: 1, HR: 1, RS: 1, BA: 1, ME: 1,
  AL: 1, MK: 1, XK: 1, MT: 1, SM: 1, LU: 1, GI: 1, IM: 1, JE: 1,
  GG: 1, FO: 1, AD: 1, MC: 1, LI: 1,
  GB: 0, PT: 0, IE: 0, IS: 0,
  GR: 2, FI: 2, RO: 2, BG: 2, EE: 2, LV: 2, LT: 2, UA: 2, CY: 2,
  TR: 3, KE: 3, TZ: 3, ET: 3, ER: 3, DJ: 3, UG: 3, RW: 3, BI: 3, SO: 3,
  SA: 3, QA: 3, KW: 3, BH: 3, JO: 3, LB: 3, IL: 3, SY: 3, YE: 3, IQ: 3,
  LY: 2, EG: 2, ZA: 2, ZW: 2, ZM: 2, MW: 2, MZ: 2, SZ: 2, LS: 2,
  SD: 2, SS: 2, CF: 1, CM: 1, CD: 1, CG: 1, GA: 1, GQ: 1, AO: 1, NA: 1,
  ST: 0, CV: -1,
  MA: 0, TN: 1, DZ: 1, MR: 0, SN: 0, GM: 0, GW: 0, SL: 0, LR: 0,
  ML: 0, NE: 1, BF: 0, NG: 1, GH: 0, TG: 0, BJ: 1, CI: 0, GN: 0,
  JP: 9, KR: 9, CN: 8, TW: 8, SG: 8, MY: 8, PH: 8, HK: 8, MO: 8,
  BN: 8, KH: 7, TH: 7, VN: 7, LA: 7, ID: 7,
  MN: 8, KZ: 5, UZ: 5, KG: 6, TJ: 5, TM: 5,
  IN: 5.5, LK: 5.5, NP: 5.75, MM: 6.5, IR: 3.5, AF: 4.5,
  PK: 5, BD: 6, MV: 5, SC: 4, MU: 4, RE: 4, KM: 3, MG: 3, IO: 6,
  CU: -5, JM: -5, HT: -5, DO: -4, PR: -4, TT: -4, BQ: -4, AW: -4,
  CW: -4, BB: -4, GD: -4, AG: -4, LC: -4, DM: -4, SX: -4, KY: -5,
  BS: -5, BZ: -6, CR: -6, SV: -6, GT: -6, HN: -6, NI: -6,
  PA: -5, TC: -5, VI: -4, MQ: -4, GP: -4,
  PE: -5, EC: -5, CO: -5, BO: -4, VE: -4, PY: -4, CL: -4,
  AR: -3, UY: -3, BR: -3, SR: -3, GY: -3,
  NZ: 12, FJ: 12, TO: 13, WS: 13, VU: 11, SB: 11,
  NC: 11, PF: -10, PG: 10, FM: 11, KI: 12, TV: 12, NRU: 12,
  MH: 12, PW: 9, CK: -10,
};
const MULTI_TZ = new Set(['US', 'CA', 'BR', 'RU', 'ID', 'MX', 'AU', 'GL', 'PT', 'ES', 'CL', 'EC']);

export function camUtcOffset(cam: { cc: string | null; lon: number | null }): number {
  if (cam.cc && MULTI_TZ.has(cam.cc) && cam.lon != null) return Math.round(cam.lon / 15);
  if (cam.cc && cam.cc in TZ_MAIN) return TZ_MAIN[cam.cc];
  if (cam.lon != null) return Math.round(cam.lon / 15);
  return 0;
}


export function isDaylight(lat: number, lon: number, at: Date = new Date()): boolean {
  const dayOfYear = Math.floor((at.getTime() - Date.UTC(at.getUTCFullYear(), 0, 0)) / 86400000);
  const decl = 23.44 * Math.sin((2 * Math.PI * (dayOfYear - 81)) / 365);
  const solarHour = (at.getUTCHours() + at.getUTCMinutes() / 60 + lon / 15 + 24) % 24;
  const latR = (lat * Math.PI) / 180;
  const declR = (decl * Math.PI) / 180;
  const cosH = -Math.tan(latR) * Math.tan(declR);
  const halfDay = (Math.acos(Math.max(-1, Math.min(1, cosH))) * 12) / Math.PI;
  return Math.abs(solarHour - 12) < halfDay;
}


const CATEGORY_PAGES: { url: string; cat: string }[] = [
  { url: 'https://www.skylinewebcams.com/en/top-live-cams.html', cat: 'top' },
  { url: 'https://www.skylinewebcams.com/en/live-cams-category/live-web-cams.html', cat: 'live' },
  { url: 'https://www.skylinewebcams.com/en/live-cams-category/city-cams.html', cat: 'ville' },
  { url: 'https://www.skylinewebcams.com/en/live-cams-category/beach-cams.html', cat: 'plage' },
  { url: 'https://www.skylinewebcams.com/en/live-cams-category/nature-mountain-cams.html', cat: 'nature' },
  { url: 'https://www.skylinewebcams.com/en/live-cams-category/seaport-cams.html', cat: 'port' },
  { url: 'https://www.skylinewebcams.com/en/live-cams-category/unesco-cams.html', cat: 'unesco' },
  { url: 'https://www.skylinewebcams.com/en/live-cams-category/ski-cams.html', cat: 'ski' },
  { url: 'https://www.skylinewebcams.com/en/live-cams-category/animals-cams.html', cat: 'animaux' },
  { url: 'https://www.skylinewebcams.com/en/live-cams-category/volcanoes-cams.html', cat: 'volcan' },
  { url: 'https://www.skylinewebcams.com/en/live-cams-category/lake-cams.html', cat: 'lac' },
  { url: 'https://www.skylinewebcams.com/en/new-livecams.html', cat: 'nouveau' },
];

export const CATEGORY_LABELS: Record<string, string> = {
  top: 'POPULAIRES', live: 'LIVE', ville: 'VILLES', plage: 'PLAGES',
  nature: 'NATURE', port: 'PORTS', unesco: 'UNESCO', ski: 'SKI',
  animaux: 'ANIMAUX', volcan: 'VOLCANS', lac: 'LACS', nouveau: 'NOUVEAU',
};

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

async function scrapeCategory(url: string, cat: string, timeoutMs = 22000): Promise<WorldCam[]> {
  const out: WorldCam[] = [];
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    const res = await fetch(url, {
      headers: { 'User-Agent': UA, 'Accept-Language': 'en' },
      signal: ctrl.signal,
      cache: 'no-store',
    });
    clearTimeout(t);
    if (!res.ok) return out;
    const html = await res.text();
    const blockRe = /<a href="(?:https:\/\/www\.skylinewebcams\.com)?\/?en\/webcam\/([a-z0-9-]+(?:\/[a-z0-9-]+)+)\.html"[^>]*>\s*<div class="cam-light"[^>]*>([\s\S]*?)<\/a>/g;
    let m: RegExpExecArray | null;
    while ((m = blockRe.exec(html)) !== null) {
      const slug = m[1];
      const body = m[2];
      const nk = body.match(/cdn\.skylinewebcams\.com\/live(\d+)\.jpg/);
      if (!nk) continue; // lien de navigation, pas une cam
      const parts = slug.split('/');
      if (parts.length < 2) continue;
      const countrySlug = parts[0];
      const info = COUNTRY_MAP[countrySlug];
      const title = (body.match(/<p class="tcam">([^<]*)<\/p>/)?.[1]
        ?? body.match(/alt="([^"]*)"/)?.[1] ?? parts[parts.length - 1].replace(/-/g, ' ')).trim();
      const subRaw = body.match(/<p class="subt">([^<]*)<\/p>/)?.[1] ?? null;
      const sub = subRaw ? subRaw.trim() : null;
      const badge = body.match(/<span class="lcam">([^<]*)<\/span>/)?.[1]?.trim() ?? null;
      const city = parts.length >= 3
        ? parts[parts.length - 2].replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
        : null;
      const region = parts.length >= 4
        ? parts[parts.length - 3].replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
        : null;
      out.push({
        id: `skyline:${slug}`,
        slug,
        title,
        sub,
        cc: info?.[0] ?? null,
        country: info?.[1] ?? null,
        city,
        region,
        nkey: nk[1],
        cats: [cat],
        lat: info ? info[2] : null,
        lon: info ? info[3] : null,
        geo: info ? 'country' : null,
        badge,
      });
    }
  } catch {
  }
  return out;
}

async function buildCatalog(): Promise<{ cams: WorldCam[]; partial: boolean }> {
  const results = await Promise.all(
    CATEGORY_PAGES.map(async (p, i) => {
      await new Promise(r => setTimeout(r, i * 250));
      return scrapeCategory(p.url, p.cat);
    })
  );
  const partial = results.some(r => r.length === 0);
  const bySlug = new Map<string, WorldCam>();
  for (const list of results) {
    for (const cam of list) {
      const prev = bySlug.get(cam.slug);
      if (prev) {
        for (const c of cam.cats) if (!prev.cats.includes(c)) prev.cats.push(c);
        if (!prev.sub && cam.sub) prev.sub = cam.sub;
        if (!prev.badge && cam.badge) prev.badge = cam.badge;
      } else {
        bySlug.set(cam.slug, cam);
      }
    }
  }
  const geoCache = await loadGeoCache();
  for (const cam of bySlug.values()) applyCityGeo(cam, geoCache);
  return { cams: [...bySlug.values()], partial };
}


const DB_DIR = process.cwd() + '/db';
const CATALOG_FILE = join(DB_DIR, 'worldcams-catalog.json');
const GEO_FILE = join(DB_DIR, 'worldcams-geo.json');
const CATALOG_TTL_MS = 12 * 60 * 60 * 1000; // 12 h
let memCatalog: { at: number; catalog: Catalog; partial: boolean } | null = null;
let refreshing = false;

type GeoEntry = { lat: number; lon: number; miss?: boolean };
type GeoCache = Record<string, GeoEntry>;

async function readJson<T>(path: string): Promise<T | null> {
  try { return JSON.parse(await fs.readFile(path, 'utf8')) as T; } catch { return null; }
}
async function writeJson(path: string, data: unknown): Promise<void> {
  try { await fs.mkdir(DB_DIR, { recursive: true }); await fs.writeFile(path, JSON.stringify(data)); } catch { /* disque non bloquant */ }
}

function computeStats(cams: WorldCam[], partial: boolean): CatalogStats {
  const cats: Record<string, number> = {};
  const countries = new Set<string>();
  const cities = new Set<string>();
  for (const c of cams) {
    for (const k of c.cats) cats[k] = (cats[k] ?? 0) + 1;
    if (c.cc) countries.add(c.cc);
    if (c.city) cities.add(`${c.city}|${c.cc ?? ''}`);
  }
  return {
    cams: cams.length,
    countries: countries.size,
    cities: cities.size,
    cats,
    discoveredAt: new Date().toISOString(),
    partial,
  };
}

export async function getCatalog(force = false): Promise<Catalog> {
  if (!force && memCatalog && Date.now() - memCatalog.at < 60 * 60 * 1000) {
    return memCatalog.catalog;
  }
  if (!force) {
    const disk = await readJson<{ at: number; cams: WorldCam[]; partial: boolean }>(CATALOG_FILE);
    if (disk?.cams?.length && Date.now() - disk.at < CATALOG_TTL_MS) {
      const catalog: Catalog = { cams: disk.cams, stats: computeStats(disk.cams, !!disk.partial) };
      memCatalog = { at: disk.at, catalog, partial: !!disk.partial };
      return catalog;
    }
    if (disk?.cams?.length && !refreshing) {
      void backgroundRefresh();
      const catalog: Catalog = { cams: disk.cams, stats: computeStats(disk.cams, !!disk.partial) };
      memCatalog = { at: disk.at, catalog, partial: !!disk.partial };
      return catalog;
    }
  }
  const { cams, partial } = await buildCatalog();
  const catalog: Catalog = { cams, stats: computeStats(cams, partial) };
  memCatalog = { at: Date.now(), catalog, partial };
  void writeJson(CATALOG_FILE, { at: Date.now(), cams, partial });
  return catalog;
}

async function backgroundRefresh(): Promise<void> {
  if (refreshing) return;
  refreshing = true;
  try {
    const { cams, partial } = await buildCatalog();
    const catalog: Catalog = { cams, stats: computeStats(cams, partial) };
    memCatalog = { at: Date.now(), catalog, partial };
    await writeJson(CATALOG_FILE, { at: Date.now(), cams, partial });
  } finally {
    refreshing = false;
  }
}


let geoCache: GeoCache | null = null;
let geocoding = false;

async function loadGeoCache(): Promise<GeoCache> {
  if (geoCache) return geoCache;
  geoCache = (await readJson<GeoCache>(GEO_FILE)) ?? {};
  return geoCache;
}

function cityKey(city: string, cc: string | null): string {
  return `${city.toLowerCase()}|${cc ?? ''}`;
}

function applyCityGeo(cam: WorldCam, cache: GeoCache): void {
  if (!cam.city) return;
  const e = cache[cityKey(cam.city, cam.cc)];
  if (e && !e.miss) {
    cam.lat = e.lat;
    cam.lon = e.lon;
    cam.geo = 'city';
  }
}

async function geocodeCity(city: string, cc: string | null): Promise<GeoEntry | null> {
  const countryName = cc ? Object.values(COUNTRY_MAP).find(v => v[0] === cc)?.[1] : undefined;
  const q = countryName ? `${city}, ${countryName}` : city;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 10000);
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1${cc ? `&countrycodes=${cc.toLowerCase()}` : ''}`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'HORUS-OSINT/1.0 (surveillance dashboard · educational)' },
      signal: ctrl.signal,
      cache: 'no-store',
    });
    clearTimeout(t);
    if (!res.ok) return null;
    const arr = (await res.json()) as { lat: string; lon: string }[];
    if (!arr.length) return { lat: NaN, lon: NaN, miss: true };
    return { lat: parseFloat(arr[0].lat), lon: parseFloat(arr[0].lon) };
  } catch {
    return null; // transient → pas caché, réessayé plus tard
  }
}


export async function geocodeStep(max = 6, near?: { lat: number; lon: number }): Promise<number> {
  if (geocoding) return 0;
  geocoding = true;
  let done = 0;
  try {
    const cache = await loadGeoCache();
    const { cams } = await getCatalog();
    const perCity = new Map<string, { city: string; cc: string | null; count: number; lat: number | null; lon: number | null }>();
    for (const c of cams) {
      if (!c.city) continue;
      const k = cityKey(c.city, c.cc);
      if (k in cache) continue;
      const e = perCity.get(k) ?? { city: c.city, cc: c.cc, count: 0, lat: c.lat, lon: c.lon };
      e.count++;
      perCity.set(k, e);
    }
    let pending = [...perCity.values()];
    if (near) {
      pending.sort((a, b) => {
        const da = a.lat == null || a.lon == null ? 1e9 : hav(near.lat, near.lon, a.lat, a.lon);
        const db = b.lat == null || b.lon == null ? 1e9 : hav(near.lat, near.lon, b.lat, b.lon);
        return da - db;
      });
    } else {
      pending.sort((a, b) => b.count - a.count);
    }
    for (const v of pending.slice(0, max)) {
      const e = await geocodeCity(v.city, v.cc);
      if (e) {
        cache[cityKey(v.city, v.cc)] = e;
        done++;
        if (!e.miss) {
          for (const c of cams) {
            if (c.city && cityKey(c.city, c.cc) === cityKey(v.city, v.cc) && c.geo === 'country') {
              c.lat = e.lat;
              c.lon = e.lon;
              c.geo = 'city';
            }
          }
        }
        await writeJson(GEO_FILE, cache);
        await new Promise(r => setTimeout(r, 1100)); // politesse 1 req/s
      }
    }
  } finally {
    geocoding = false;
  }
  return done;
}


export function filterCams(cams: WorldCam[], opts: {
  q?: string; cc?: string; cat?: string; limit?: number;
}): WorldCam[] {
  let list = cams;
  if (opts.cc) list = list.filter(c => c.cc === opts.cc);
  if (opts.cat) list = list.filter(c => c.cats.includes(opts.cat!));
  if (opts.q) {
    const q = opts.q.toLowerCase();
    list = list.filter(c =>
      c.title.toLowerCase().includes(q)
      || (c.city ?? '').toLowerCase().includes(q)
      || (c.country ?? '').toLowerCase().includes(q)
      || (c.sub ?? '').toLowerCase().includes(q)
    );
  }
  return opts.limit ? list.slice(0, opts.limit) : list;
}

function hav(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export type NearestHit = WorldCam & { distKm: number };

export function nearestCams(cams: WorldCam[], lat: number, lon: number, limit = 12, maxKm = 800): NearestHit[] {
  const hits: NearestHit[] = [];
  for (const c of cams) {
    if (c.lat == null || c.lon == null) continue;
    hits.push({ ...c, distKm: hav(lat, lon, c.lat, c.lon) });
  }
  hits.sort((a, b) => a.distKm - b.distKm);
  return hits.filter(h => h.distKm <= maxKm).slice(0, limit);
}


export function stillUrl(nkey: string, hd = false): string {
  return `/api/cams/world/still?nkey=${encodeURIComponent(nkey)}${hd ? '&hd=1' : ''}`;
}

export function camPageUrl(slug: string): string {
  return `https://www.skylinewebcams.com/en/webcam/${slug}.html`;
}
