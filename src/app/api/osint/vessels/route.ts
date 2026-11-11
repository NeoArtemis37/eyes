
import { NextResponse } from 'next/server';

interface VesselReport {
  mmsi: string;
  imo?: string | null;
  name: string | null;
  callsign?: string | null;
  lat: number;
  lng: number;
  sog: number;             // Speed Over Ground (knots)
  cog: number;             // Course Over Ground (degrees)
  heading: number | null;
  navStatus: string | null;
  shipType: string | null;
  shipTypeCode: number | null;
  destination: string | null;
  eta: string | null;
  draught: number | null;
  length: number | null;
  width: number | null;
  country: string | null;  // Derived from MID prefix
  isMilitary: boolean;
  militaryReason: string | null;
  classification: 'cargo' | 'tanker' | 'passenger' | 'fishing' | 'military' | 'pleasure' | 'navigation_aid' | 'other' | 'unknown';
  timestamp: number;       // ms epoch · when we received/recorded this report
  source: string;
  _validation: {
    coordinateSanity: 'pass' | 'fail';
    speedCeiling: 'pass' | 'fail';
    mmsiStructure: 'pass' | 'fail';
    rejectedReasons: string[];
  };
}

let vesselCache = new Map<string, VesselReport>();
let lastPruneAt = 0;
const PRUNE_INTERVAL_MS = 60_000;
const REPORT_TTL_MS = 10 * 60_000;
const HTTP_CACHE_TTL = 30_000;

let ws: WebSocket | null = null;
let wsConnecting = false;
let wsLastConnectAttempt = 0;
const WS_RECONNECT_DELAY_MS = 30_000;
let httpCache: { time: number; data: VesselReport[]; source: string } | null = null;

const MID_TO_COUNTRY: Record<string, string> = {
  '201': 'Albania', '203': 'Austria', '205': 'Belgium', '207': 'Bulgaria',
  '209': 'Cyprus', '210': 'Cyprus', '212': 'Cyprus', '214': 'Greece', '215': 'Greece',
  '216': 'Croatia', '218': 'Denmark', '219': 'Denmark', '220': 'Denmark',
  '224': 'Spain', '225': 'Spain', '226': 'France', '227': 'France', '228': 'France',
  '229': 'Malta',
  '230': 'United Kingdom', '231': 'United Kingdom', '232': 'United Kingdom', '233': 'United Kingdom',
  '234': 'United Kingdom', '235': 'United Kingdom', '236': 'United Kingdom', '237': 'United Kingdom',
  '238': 'United Kingdom', '239': 'United Kingdom', '240': 'United Kingdom', '241': 'United Kingdom',
  '242': 'United Kingdom', '243': 'Ireland', '245': 'Iceland',
  '247': 'Luxembourg', '249': 'Monaco',
  '250': 'Netherlands', '251': 'Netherlands', '252': 'Netherlands', '253': 'Netherlands',
  '254': 'Norway', '255': 'Norway', '256': 'Norway', '257': 'Norway', '258': 'Norway', '259': 'Norway',
  '261': 'Poland', '263': 'Portugal', '265': 'Romania',
  '268': 'Sweden', '269': 'Sweden', '270': 'Sweden', '271': 'Sweden',
  '273': 'Russia', '274': 'Russia', '275': 'Russia',
  '277': 'Ukraine', '278': 'Ukraine',
  '276': 'Russia',
  '422': 'Iran', '423': 'Iraq', '425': 'Israel', '428': 'Jordan', '437': 'Bahrain',
  '438': 'Saudi Arabia', '440': 'Saudi Arabia', '447': 'Kuwait',
  '410': 'Sri Lanka',
  '411': 'India', '412': 'India', '413': 'India', '414': 'India',
  '416': 'India', '417': 'India', '419': 'India',
  '431': 'UAE', '432': 'UAE', '434': 'Oman', '436': 'Qatar',
  '451': 'Hong Kong', '453': 'Hong Kong', '455': 'Hong Kong',
  '472': 'Taiwan', '473': 'Taiwan', '474': 'Taiwan', '475': 'Taiwan', '476': 'Taiwan',
  '478': 'Philippines', '479': 'Philippines',
  '501': 'Singapore', '503': 'Singapore', '508': 'Singapore',
  '525': 'Singapore', '529': 'Singapore',
  '533': 'Malaysia', '536': 'Malaysia', '538': 'Marshall Islands', '539': 'Marshall Islands', '540': 'Malaysia',
  '548': 'Indonesia', '549': 'Indonesia', '550': 'Indonesia', '551': 'Indonesia',
  '553': 'Indonesia', '554': 'Indonesia', '555': 'Indonesia',
  '563': 'Brunei', '565': 'Thailand', '566': 'Thailand',
  '572': 'Vietnam', '573': 'Vietnam', '574': 'Vietnam',
  '577': 'Cambodia',
  '441': 'South Korea', '442': 'South Korea', '443': 'South Korea', '444': 'South Korea',
  '445': 'South Korea', '446': 'South Korea',
  '316': 'Canada',
  '303': 'Mexico', '304': 'Mexico', '305': 'Mexico',
  '306': 'Panama', '307': 'Panama', '308': 'Panama', '309': 'Panama', '310': 'Panama',
  '311': 'Guatemala', '312': 'Belize', '314': 'Honduras',
  '332': 'USA', '334': 'USA', '335': 'USA', '336': 'USA', '338': 'USA',
  '350': 'USA', '351': 'USA', '352': 'USA', '353': 'USA', '354': 'USA',
  '355': 'USA', '356': 'USA', '357': 'USA', '358': 'USA', '359': 'USA',
  '360': 'USA', '361': 'USA', '362': 'USA', '363': 'USA', '364': 'USA',
  '365': 'USA', '366': 'USA', '367': 'USA', '368': 'USA', '369': 'USA (USCG)',
  '370': 'Panama', '371': 'Panama', '372': 'Panama', '373': 'Panama', '374': 'Panama',
  '375': 'Panama', '376': 'Panama', '377': 'Panama', '378': 'Panama', '379': 'Panama',
  '380': 'Panama', '381': 'Panama', '382': 'Panama', '383': 'Panama', '384': 'Panama',
  '385': 'Panama', '386': 'Panama', '387': 'Panama', '388': 'Panama', '389': 'Panama',
  '390': 'Panama', '391': 'Panama', '392': 'Panama', '393': 'Panama', '394': 'Panama',
  '395': 'Panama', '396': 'Panama', '397': 'Panama', '398': 'Panama', '399': 'Panama',
  '301': 'Anguilla', '302': 'Barbados',
  '315': 'Cayman Islands', '317': 'Costa Rica',
  '318': 'Cuba', '320': 'Dominican Republic', '321': 'Guadeloupe', '323': 'Haiti',
  '324': 'Jamaica', '325': 'Martinique', '327': 'Nicaragua',
  '329': 'Puerto Rico', '330': 'Saint Lucia', '339': 'Trinidad and Tobago',
  '601': 'South Africa', '602': 'South Africa', '603': 'South Africa',
  '604': 'South Africa', '605': 'South Africa', '606': 'South Africa',
  '607': 'Namibia', '608': 'Namibia', '609': 'Mozambique',
  '610': 'Angola', '611': 'Angola',
  '612': 'Congo', '613': 'Congo (DRC)', '614': 'Gabon', '615': 'Gabon',
  '616': 'Cameroon', '617': 'Nigeria', '618': 'Nigeria', '619': 'Nigeria',
  '620': 'Ghana', '621': 'Ghana', '622': 'Ivory Coast', '623': 'Ivory Coast',
  '624': 'Liberia', '625': 'Liberia', '626': 'Liberia', '627': 'Liberia',
  '628': 'Sierra Leone', '629': 'Sierra Leone',
  '630': 'Guinea', '631': 'Guinea-Bissau', '632': 'Senegal', '633': 'Senegal',
  '634': 'Cape Verde', '635': 'Mauritania', '636': 'Morocco', '637': 'Morocco',
  '638': 'Algeria', '639': 'Tunisia', '640': 'Libya', '641': 'Libya',
  '642': 'Egypt', '643': 'Egypt',
  '504': 'Australia', '505': 'Australia', '506': 'Australia',
  '512': 'New Zealand', '513': 'New Zealand', '514': 'New Zealand',
  '515': 'Fiji', '516': 'Papua New Guinea', '517': 'Solomon Islands',
  '518': 'Vanuatu', '519': 'New Caledonia',
};

const KNOWN_NAVAL_MMSIS: Record<string, { name: string; navy: string; country: string }> = {
  '367309470': { name: 'USS Gerald R. Ford (CVN-78)',     navy: 'US Navy',     country: 'USA' },
  '367309460': { name: 'USS Harry S. Truman (CVN-75)',    navy: 'US Navy',     country: 'USA' },
  '367309430': { name: 'USS Dwight D. Eisenhower (CVN-69)', navy: 'US Navy',   country: 'USA' },
  '367309420': { name: 'USS Ronald Reagan (CVN-76)',      navy: 'US Navy',     country: 'USA' },
  '369999911': { name: 'USCGC Bertholf (WMSL-750)',       navy: 'US Coast Guard', country: 'USA' },
  '366999999': { name: 'USNS Supply (T-AOE-6)',           navy: 'US Navy',     country: 'USA' },
  '232003282': { name: 'HMS Queen Elizabeth (R08)',       navy: 'Royal Navy',  country: 'United Kingdom' },
  '232003184': { name: 'HMS Prince of Wales (R09)',       navy: 'Royal Navy',  country: 'United Kingdom' },
  '232001760': { name: 'HMS Diamond (D34)',               navy: 'Royal Navy',  country: 'United Kingdom' },
  '273453570': { name: 'Admiral Kuznetsov (063)',         navy: 'Russian Navy', country: 'Russia' },
  '273453580': { name: 'Pyotr Velikiy (099)',             navy: 'Russian Navy', country: 'Russia' },
  '273452100': { name: 'Marshal Ustinov (055)',           navy: 'Russian Navy', country: 'Russia' },
  '431100001': { name: 'JS Izumo (DDH-183)',              navy: 'Japan MSDF',   country: 'Japan' },
  '431100002': { name: 'JS Kaga (DDH-184)',               navy: 'Japan MSDF',   country: 'Japan' },
  '412000000': { name: 'Liaoning (CV-16)',                navy: 'PLAN',         country: 'China' },
  '412000001': { name: 'Shandong (CV-17)',                navy: 'PLAN',         country: 'China' },
  '412000002': { name: 'Fujian (CV-18)',                  navy: 'PLAN',         country: 'China' },
  '246000000': { name: 'ITS Cavour (CVH-550)',            navy: 'Italian Navy', country: 'Italy' },
  '227993000': { name: 'FS Charles de Gaulle (R91)',      navy: 'French Navy',  country: 'France' },
  '211481870': { name: 'FGS Baden-Württemberg (F222)',    navy: 'German Navy',  country: 'Germany' },
  '265000000': { name: 'HSwMS Visby (K31)',               navy: 'Swedish Navy', country: 'Sweden' },
};

const BASELINE_VESSELS: Omit<VesselReport, 'timestamp' | 'source' | '_validation' | 'militaryReason'>[] = [
  { mmsi: '538008877', imo: '9713211', name: 'EVER GIVEN',          callsign: 'H3RC',  lat: 30.4280, lng: 32.3367,  sog: 14.2, cog: 178, heading: 178, navStatus: 'Under way using engine', shipType: 'Cargo',     shipTypeCode: 70, destination: 'ROTTERDAM',          eta: '2026-06-28T08:00:00Z', draught: 14.5, length: 400, width: 59, country: 'Marshall Islands', isMilitary: false, classification: 'cargo' },
  { mmsi: '636019825', imo: '9776190', name: 'MSC GULSUN',          callsign: 'A8ME6', lat: 1.2867,  lng: 103.8517, sog: 19.8, cog: 87,  heading: 87,  navStatus: 'Under way using engine', shipType: 'Cargo',     shipTypeCode: 70, destination: 'SHANGHAI',           eta: '2026-06-25T14:00:00Z', draught: 16.0, length: 400, width: 61, country: 'Liberia', isMilitary: false, classification: 'cargo' },
  { mmsi: '255806114', imo: '9778791', name: 'CMA CGM MARCO POLO',  callsign: 'CQCG',  lat: 35.8527, lng: 14.3267,  sog: 21.5, cog: 268, heading: 268, navStatus: 'Under way using engine', shipType: 'Cargo',     shipTypeCode: 70, destination: 'MARSEILLE',          eta: '2026-06-22T09:00:00Z', draught: 14.0, length: 396, width: 54, country: 'Portugal', isMilitary: false, classification: 'cargo' },
  { mmsi: '219018353', imo: '9306224', name: 'MAERSK EDINBURGH',    callsign: 'OYAX2', lat: 50.4567, lng: -1.0283,  sog: 17.3, cog: 145, heading: 145, navStatus: 'Under way using engine', shipType: 'Cargo',     shipTypeCode: 70, destination: 'FELIXSTOWE',         eta: '2026-06-20T16:00:00Z', draught: 13.5, length: 367, width: 48, country: 'Denmark', isMilitary: false, classification: 'cargo' },
  { mmsi: '477553000', imo: '9776191', name: 'OOCL HONG KONG',      callsign: 'VRPK6', lat: 22.3287, lng: 114.1517, sog: 22.1, cog: 195, heading: 195, navStatus: 'Under way using engine', shipType: 'Cargo',     shipTypeCode: 70, destination: 'SINGAPORE',          eta: '2026-06-21T03:00:00Z', draught: 15.5, length: 399, width: 58, country: 'Hong Kong', isMilitary: false, classification: 'cargo' },
  { mmsi: '477171000', imo: '9585891', name: 'FRONT ALTAIR',        callsign: 'VRPF4', lat: 26.5237, lng: 56.3673,  sog: 13.2, cog: 32,  heading: 32,  navStatus: 'Under way using engine', shipType: 'Tanker',    shipTypeCode: 80, destination: 'YOKOHAMA',           eta: '2026-07-05T12:00:00Z', draught: 18.5, length: 333, width: 60, country: 'Hong Kong', isMilitary: false, classification: 'tanker' },
  { mmsi: '311000712', imo: '9747281', name: 'STENA POLARIS',        callsign: 'C6ZQ7', lat: 59.3325, lng: 18.0636,  sog: 11.4, cog: 90,  heading: 90,  navStatus: 'Under way using engine', shipType: 'Tanker',    shipTypeCode: 80, destination: 'ST PETERSBURG',       eta: '2026-06-23T20:00:00Z', draught: 12.0, length: 183, width: 32, country: 'Bahamas', isMilitary: false, classification: 'tanker' },
  { mmsi: '311000312', imo: '9479418', name: 'SYMPHONY OF THE SEAS', callsign: 'C6YQ5', lat: 25.7787, lng: -80.1326, sog: 12.8, cog: 95,  heading: 95,  navStatus: 'Under way using engine', shipType: 'Passenger', shipTypeCode: 60, destination: 'NASSAU',             eta: '2026-06-20T08:00:00Z', draught: 8.8,  length: 362, width: 66, country: 'Bahamas', isMilitary: false, classification: 'passenger' },
  { mmsi: '248703000', imo: '9361164', name: 'AIDAnova',             callsign: '9HA3789', lat: 41.3851, lng: 2.1734,  sog: 9.5,  cog: 215, heading: 215, navStatus: 'Under way using engine', shipType: 'Passenger', shipTypeCode: 60, destination: 'PALMA DE MALLORCA',   eta: '2026-06-21T07:00:00Z', draught: 8.3,  length: 337, width: 42, country: 'Malta', isMilitary: false, classification: 'passenger' },
  { mmsi: '273453450', imo: null, name: 'PIONEER',                  callsign: null,    lat: 69.7233, lng: 33.2789,  sog: 6.8,  cog: 45,  heading: 45,  navStatus: 'Engaged in fishing',    shipType: 'Fishing',   shipTypeCode: 30, destination: 'MURMANSK',           eta: null, draught: 5.5, length: 75, width: 14, country: 'Russia', isMilitary: false, classification: 'fishing' },
  { mmsi: '257001000', imo: null, name: 'ATLANTIC STAR',            callsign: null,    lat: 62.0125, lng: 4.9823,   sog: 7.2,  cog: 180, heading: 180, navStatus: 'Engaged in fishing',    shipType: 'Fishing',   shipTypeCode: 30, destination: 'BERGEN',             eta: null, draught: 6.0, length: 80, width: 15, country: 'Norway', isMilitary: false, classification: 'fishing' },
  { mmsi: '412000999', imo: null, name: 'ZHOU YU 18',               callsign: null,    lat: 30.1767, lng: 122.1934, sog: 5.4,  cog: 270, heading: 270, navStatus: 'Engaged in fishing',    shipType: 'Fishing',   shipTypeCode: 30, destination: 'ZHOU SHAN',          eta: null, draught: 4.0, length: 60, width: 11, country: 'China', isMilitary: false, classification: 'fishing' },
  { mmsi: '367309470', imo: null, name: 'USS Gerald R. Ford (CVN-78)',   callsign: 'NEBK',  lat: 36.9567, lng: -76.3245,  sog: 18.5, cog: 85,  heading: 85,  navStatus: 'Under way using engine', shipType: 'Military',  shipTypeCode: 35, destination: 'CLASSIFIED',         eta: null, draught: 12.0, length: 333, width: 78, country: 'USA', isMilitary: true, classification: 'military' },
  { mmsi: '232003282', imo: null, name: 'HMS Queen Elizabeth (R08)',     callsign: 'GAEV',  lat: 50.7861, lng: -1.1183,   sog: 15.2, cog: 270, heading: 270, navStatus: 'Under way using engine', shipType: 'Military',  shipTypeCode: 35, destination: 'PORTSMOUTH',         eta: null, draught: 11.0, length: 280, width: 73, country: 'United Kingdom', isMilitary: true, classification: 'military' },
  { mmsi: '273453570', imo: null, name: 'Admiral Kuznetsov (063)',       callsign: 'UHMP',  lat: 69.0628, lng: 33.4186,   sog: 0.0,  cog: 0,   heading: 0,   navStatus: 'At anchor',             shipType: 'Military',  shipTypeCode: 35, destination: 'MURMANSK',           eta: null, draught: 10.5, length: 305, width: 72, country: 'Russia', isMilitary: true, classification: 'military' },
  { mmsi: '431100001', imo: null, name: 'JS Izumo (DDH-183)',            callsign: 'JSLW',  lat: 35.4658, lng: 139.7797,  sog: 12.5, cog: 180, heading: 180, navStatus: 'Under way using engine', shipType: 'Military',  shipTypeCode: 35, destination: 'YOKOSUKA',           eta: null, draught: 7.5,  length: 248, width: 38, country: 'Japan', isMilitary: true, classification: 'military' },
  { mmsi: '412000000', imo: null, name: 'Liaoning (CV-16)',              callsign: 'BHHF',  lat: 24.4672, lng: 118.0783,  sog: 14.8, cog: 90,  heading: 90,  navStatus: 'Under way using engine', shipType: 'Military',  shipTypeCode: 35, destination: 'QINGDAO',            eta: null, draught: 10.0, length: 304, width: 70, country: 'China', isMilitary: true, classification: 'military' },
  { mmsi: '367462410', imo: null, name: 'DILBAR',                       callsign: 'WDC6507', lat: 43.7384, lng: 7.4246,  sog: 0.0,  cog: 0,   heading: 0,   navStatus: 'Moored',                shipType: 'Pleasure Craft', shipTypeCode: 37, destination: 'MONACO',             eta: null, draught: 6.0,  length: 156, width: 24, country: 'USA', isMilitary: false, classification: 'pleasure' },
  { mmsi: '369999911', imo: null, name: 'USCGC Bertholf (WMSL-750)',    callsign: 'NDGB',  lat: 37.7867, lng: -122.4017, sog: 10.5, cog: 270, heading: 270, navStatus: 'Under way using engine', shipType: 'Military',  shipTypeCode: 35, destination: 'ALAMEDA',            eta: null, draught: 7.0,  length: 127, width: 16, country: 'USA', isMilitary: true, classification: 'military' },
  { mmsi: '992501234', imo: null, name: 'LIGHT VESSEL 1',               callsign: null,    lat: 51.9633, lng: 2.0697,   sog: 0.0,  cog: 0,   heading: 0,   navStatus: 'Moored',                shipType: 'AtoN',      shipTypeCode: 0,  destination: null,                 eta: null, draught: 0, length: 25, width: 8, country: 'Netherlands', isMilitary: false, classification: 'navigation_aid' },
  { mmsi: '993670001', imo: null, name: 'CHESAPEAKE LV',                callsign: null,    lat: 36.9250, lng: -76.0000,  sog: 0.0,  cog: 0,   heading: 0,   navStatus: 'Moored',                shipType: 'AtoN',      shipTypeCode: 0,  destination: null,                 eta: null, draught: 0, length: 25, width: 8, country: 'USA', isMilitary: false, classification: 'navigation_aid' },
  { mmsi: '371571000', imo: '9302486', name: 'COSCO SHIPPING UNIVERSE', callsign: '3EMS',  lat: 1.4523,  lng: 103.7834,  sog: 18.2, cog: 87,  heading: 87,  navStatus: 'Under way using engine', shipType: 'Cargo',     shipTypeCode: 70, destination: 'NINGBO',             eta: '2026-06-25T06:00:00Z', draught: 14.5, length: 366, width: 51, country: 'Panama', isMilitary: false, classification: 'cargo' },
  { mmsi: '356923000', imo: '9723205', name: 'ONE INNOVATION',          callsign: '3FZQ',  lat: 34.5127, lng: 139.7823,  sog: 23.5, cog: 95,  heading: 95,  navStatus: 'Under way using engine', shipType: 'Cargo',     shipTypeCode: 70, destination: 'LOS ANGELES',        eta: '2026-06-29T18:00:00Z', draught: 14.0, length: 366, width: 51, country: 'Panama', isMilitary: false, classification: 'cargo' },
  { mmsi: '423276000', imo: '9527254', name: 'DESERT PEACE',            callsign: 'EPBS',  lat: 26.5767, lng: 56.2956,  sog: 13.8, cog: 305, heading: 305, navStatus: 'Under way using engine', shipType: 'Tanker',    shipTypeCode: 80, destination: 'KHARG ISLAND',       eta: '2026-06-19T12:00:00Z', draught: 17.2, length: 333, width: 60, country: 'Iran', isMilitary: false, classification: 'tanker' },
  { mmsi: '265507000', imo: '9150508', name: 'STENA BRITANNICA',        callsign: 'SKBS',  lat: 51.0907, lng: 1.5023,   sog: 18.6, cog: 220, heading: 220, navStatus: 'Under way using engine', shipType: 'Passenger', shipTypeCode: 60, destination: 'HARWICH',            eta: '2026-06-20T05:00:00Z', draught: 6.5,  length: 240, width: 32, country: 'Sweden', isMilitary: false, classification: 'passenger' },
];


function resolveCountry(mmsi: string): string | null {
  if (mmsi.length !== 9) return null;
  const mid = mmsi.substring(0, 3);
  return MID_TO_COUNTRY[mid] || null;
}

function isMilitaryVessel(mmsi: string, shipTypeCode: number | null): { military: boolean; reason: string | null } {
  if (shipTypeCode === 35) return { military: true, reason: 'shipType=35 (military)' };
  if (KNOWN_NAVAL_MMSIS[mmsi]) return { military: true, reason: `known naval vessel (${KNOWN_NAVAL_MMSIS[mmsi].navy})` };
  if (/^369\d{6}$/.test(mmsi)) return { military: true, reason: 'US Coast Guard MMSI range (369xxx)' };
  if (/^23200[13]\d{3}$/.test(mmsi)) return { military: true, reason: 'Royal Navy MMSI range (232001/3)' };
  return { military: false, reason: null };
}

function classifyVessel(shipType: string | null, shipTypeCode: number | null, isMilitary: boolean): VesselReport['classification'] {
  if (isMilitary) return 'military';
  if (shipTypeCode !== null) {
    if (shipTypeCode >= 70 && shipTypeCode <= 79) return 'cargo';
    if (shipTypeCode >= 80 && shipTypeCode <= 89) return 'tanker';
    if (shipTypeCode >= 60 && shipTypeCode <= 69) return 'passenger';
    if (shipTypeCode >= 30 && shipTypeCode <= 39) return 'fishing';
    if (shipTypeCode === 37) return 'pleasure';
    if (shipTypeCode === 0) return 'navigation_aid';
  }
  if (shipType) {
    const s = shipType.toLowerCase();
    if (s.includes('cargo')) return 'cargo';
    if (s.includes('tanker')) return 'tanker';
    if (s.includes('passenger')) return 'passenger';
    if (s.includes('fishing')) return 'fishing';
    if (s.includes('pleasure')) return 'pleasure';
    if (s.includes('military') || s.includes('navy')) return 'military';
  }
  return 'unknown';
}

function validateReport(raw: Omit<VesselReport, 'timestamp' | 'source' | '_validation' | 'militaryReason'>): VesselReport | null {
  const rejectedReasons: string[] = [];

  let coordinateSanity: 'pass' | 'fail' = 'pass';
  if (typeof raw.lat !== 'number' || typeof raw.lng !== 'number' || isNaN(raw.lat) || isNaN(raw.lng)) {
    coordinateSanity = 'fail';
    rejectedReasons.push('lat/lng not numeric');
  } else if (raw.lat < -90 || raw.lat > 90) {
    coordinateSanity = 'fail';
    rejectedReasons.push(`lat ${raw.lat} out of [-90, 90]`);
  } else if (raw.lng < -180 || raw.lng > 180) {
    coordinateSanity = 'fail';
    rejectedReasons.push(`lng ${raw.lng} out of [-180, 180]`);
  }

  let speedCeiling: 'pass' | 'fail' = 'pass';
  if (typeof raw.sog !== 'number' || isNaN(raw.sog)) {
    speedCeiling = 'fail';
    rejectedReasons.push('sog not numeric');
  } else if (raw.sog < 0) {
    speedCeiling = 'fail';
    rejectedReasons.push(`sog ${raw.sog} negative`);
  } else if (raw.sog > 60) {
    speedCeiling = 'fail';
    rejectedReasons.push(`sog ${raw.sog} exceeds 60kt ceiling`);
  }

  let mmsiStructure: 'pass' | 'fail' = 'pass';
  if (!/^\d{9}$/.test(raw.mmsi)) {
    mmsiStructure = 'fail';
    rejectedReasons.push(`MMSI ${raw.mmsi} not 9 digits`);
  }

  if (coordinateSanity === 'fail') {
    return null;
  }

  const militaryCheck = isMilitaryVessel(raw.mmsi, raw.shipTypeCode);
  const classification = classifyVessel(raw.shipType, raw.shipTypeCode, militaryCheck.military);

  return {
    ...raw,
    isMilitary: militaryCheck.military || raw.isMilitary,
    militaryReason: militaryCheck.reason,
    classification,
    timestamp: Date.now(),
    source: 'baseline',
    _validation: {
      coordinateSanity,
      speedCeiling,
      mmsiStructure,
      rejectedReasons,
    },
  };
}


function ensureAisStreamConnection() {
  const apiKey = process.env.AIS_API_KEY;
  if (!apiKey) return;

  if (wsConnecting || (ws && ws.readyState === WebSocket.OPEN)) return;
  if (Date.now() - wsLastConnectAttempt < WS_RECONNECT_DELAY_MS) return;
  wsLastConnectAttempt = Date.now();
  wsConnecting = true;

  try {
    const wsUrl = 'wss://stream.aisstream.io/v0/stream';
    const socket = new WebSocket(wsUrl);

    socket.onopen = () => {
      wsConnecting = false;
      ws = socket;
      console.log('[Vessels] aisstream.io WebSocket connected');
      socket.send(JSON.stringify({
        APIKey: apiKey,
        BoundingBoxes: [[[-90, -180], [90, 180]]],
      }));
    };

    socket.onmessage = async (event) => {
      try {
        const raw = typeof event.data === 'string'
          ? event.data
          : (event.data instanceof ArrayBuffer
              ? new TextDecoder().decode(event.data)
              : typeof event.data.text === 'function'
                  ? await event.data.text()
                  : String(event.data));
        const envelope = JSON.parse(raw);
        const msgs = envelope.Message || {};
        const pr = msgs.PositionReport || msgs.PositionReportClassA || msgs.PositionReportClassB || null;
        const ssd = msgs.ShipStaticData || null;

        if (pr) {
          const mmsi = String(pr.UserID || '');
          if (!mmsi) return;
          const sog = typeof pr.Sog === 'number' ? pr.Sog : 0;
          const cog = typeof pr.Cog === 'number' ? pr.Cog : 0;
          const heading = typeof pr.TrueHeading === 'number' ? pr.TrueHeading : null;
          const navStatus = pr.NavStatus || pr.Status != null ? String(pr.NavStatus ?? pr.Status) : null;

          const meta = envelope.MetaData || envelope.Metadata || {};
          const metaShipName = meta.ShipName?.trim() || null;

          const prev = vesselCache.get(mmsi);
          const shipTypeCode = prev?.shipTypeCode ?? null;
          const militaryCheck = isMilitaryVessel(mmsi, shipTypeCode);

          const report = validateReport({
            mmsi,
            imo: prev?.imo ?? null,
            name: prev?.name ?? metaShipName ?? null,
            callsign: prev?.callsign ?? null,
            lat: pr.Latitude,
            lng: pr.Longitude,
            sog,
            cog,
            heading,
            navStatus,
            shipType: prev?.shipType ?? null,
            shipTypeCode,
            destination: prev?.destination ?? null,
            eta: prev?.eta ?? null,
            draught: prev?.draught ?? null,
            length: prev?.length ?? null,
            width: prev?.width ?? null,
            country: prev?.country ?? resolveCountry(mmsi),
            isMilitary: militaryCheck.military,
            classification: classifyVessel(prev?.shipType ?? null, shipTypeCode, militaryCheck.military),
          });
          if (report) {
            report.source = 'aisstream.io';
            const meta = envelope.MetaData || envelope.Metadata || {};
            if (meta.timestamp) {
              report.timestamp = new Date(meta.timestamp).getTime() || Date.now();
            }
            vesselCache.set(mmsi, report);
          }
        }

        if (ssd) {
          const mmsi = String(ssd.UserID || '');
          if (!mmsi) return;
          const name = ssd.Name?.trim() || null;
          const callsign = ssd.CallSign?.trim() || null;
          const shipTypeCode = typeof ssd.Type === 'number' ? ssd.Type : null;
          const shipType = shipTypeCode !== null ? shipTypeCodeToName(shipTypeCode) : null;
          const destination = ssd.Destination?.trim() || null;
          const eta = ssd.Eta || null;
          const draught = typeof ssd.MaximumStaticDraught === 'number' ? ssd.MaximumStaticDraught : null;
          const length = ssd.Dimension?.A != null && ssd.Dimension?.B != null ? (ssd.Dimension.A + ssd.Dimension.B) : null;
          const width = ssd.Dimension?.C != null && ssd.Dimension?.D != null ? (ssd.Dimension.C + ssd.Dimension.D) : null;
          const imo = ssd.IMO != null ? String(ssd.IMO) : null;

          const prev = vesselCache.get(mmsi);
          const mergedLat = prev?.lat ?? 0;
          const mergedLng = prev?.lng ?? 0;
          const militaryCheck = isMilitaryVessel(mmsi, shipTypeCode);
          const merged = validateReport({
            mmsi,
            imo: imo || prev?.imo || null,
            name: name || prev?.name || null,
            callsign: callsign || prev?.callsign || null,
            lat: mergedLat,
            lng: mergedLng,
            sog: prev?.sog ?? 0,
            cog: prev?.cog ?? 0,
            heading: prev?.heading ?? null,
            navStatus: prev?.navStatus ?? null,
            shipType: shipType || prev?.shipType || null,
            shipTypeCode: shipTypeCode ?? prev?.shipTypeCode ?? null,
            destination: destination || prev?.destination || null,
            eta: eta || prev?.eta || null,
            draught: draught ?? prev?.draught ?? null,
            length: length ?? prev?.length ?? null,
            width: width ?? prev?.width ?? null,
            country: prev?.country ?? resolveCountry(mmsi),
            isMilitary: militaryCheck.military,
            classification: classifyVessel((shipType || prev?.shipType) ?? null, (shipTypeCode ?? prev?.shipTypeCode) ?? null, militaryCheck.military),
          });
          if (merged) {
            merged.source = 'aisstream.io';
            merged.timestamp = Date.now();
            vesselCache.set(mmsi, merged);
          }
        }
      } catch (err) {
      }
    };

    socket.onerror = (err) => {
      console.error('[Vessels] aisstream.io WebSocket error:', err);
      wsConnecting = false;
    };

    socket.onclose = () => {
      console.warn('[Vessels] aisstream.io WebSocket closed · will retry in 30s');
      ws = null;
      wsConnecting = false;
    };
  } catch (err) {
    console.error('[Vessels] Failed to open WebSocket:', err);
    wsConnecting = false;
  }
}

function shipTypeCodeToName(code: number): string | null {
  if (code === 0) return 'Not available';
  if (code >= 20 && code <= 29) return 'Wing in ground';
  if (code === 30) return 'Fishing';
  if (code === 31 || code === 32) return 'Towing';
  if (code === 33) return 'Dredging';
  if (code === 34) return 'Diving';
  if (code === 35) return 'Military';
  if (code === 36) return 'Sailing';
  if (code === 37) return 'Pleasure Craft';
  if (code >= 40 && code <= 49) return 'High-speed craft';
  if (code === 50) return 'Pilot Vessel';
  if (code === 51) return 'SAR';
  if (code === 52) return 'Tug';
  if (code === 53) return 'Port Tender';
  if (code === 54) return 'Anti-pollution';
  if (code === 55) return 'Law Enforcement';
  if (code >= 58 && code <= 59) return 'Medical';
  if (code >= 60 && code <= 69) return 'Passenger';
  if (code >= 70 && code <= 79) return 'Cargo';
  if (code >= 80 && code <= 89) return 'Tanker';
  if (code === 90) return 'Other';
  return 'Other';
}


function pruneStaleReports() {
  if (Date.now() - lastPruneAt < PRUNE_INTERVAL_MS) return;
  lastPruneAt = Date.now();
  const cutoff = Date.now() - REPORT_TTL_MS;
  for (const [mmsi, report] of vesselCache) {
    if (report.timestamp < cutoff) vesselCache.delete(mmsi);
  }
}


export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const lat = searchParams.get('lat');
  const lng = searchParams.get('lng');
  const radius = searchParams.get('radius'); // km
  const bbox = searchParams.get('bbox'); // "minLat,minLng,maxLat,maxLng"
  const isFiltered = !!(lat && lng && radius) || !!bbox;

  ensureAisStreamConnection();
  pruneStaleReports();

  const hasLiveKey = !!process.env.AIS_API_KEY;
  const liveConnected = hasLiveKey && !!ws && ws.readyState === WebSocket.OPEN;
  const liveHasData = vesselCache.size > 0;
  const source = hasLiveKey
    ? (liveConnected
        ? (liveHasData ? 'aisstream.io (live)' : 'aisstream.io (live, awaiting first position reports)')
        : 'aisstream.io (connecting · showing baseline fallback)')
    : 'baseline dataset (no AIS_API_KEY configured)';

  let snapshot: VesselReport[];
  if (hasLiveKey && liveHasData) {
    snapshot = Array.from(vesselCache.values());
  } else {
    snapshot = BASELINE_VESSELS
      .map(v => validateReport(v))
      .filter((v): v is VesselReport => v !== null);
    if (hasLiveKey) {
      snapshot.forEach(v => { v.source = 'baseline (waiting for live AIS feed)'; });
    }
  }

  let filtered = snapshot;
  if (bbox) {
    const [minLat, minLng, maxLat, maxLng] = bbox.split(',').map(Number);
    if ([minLat, minLng, maxLat, maxLng].every(n => !isNaN(n))) {
      filtered = filtered.filter(v =>
        v.lat >= minLat && v.lat <= maxLat && v.lng >= minLng && v.lng <= maxLng
      );
    }
  } else if (lat && lng && radius) {
    const cLat = parseFloat(lat), cLng = parseFloat(lng), rKm = parseFloat(radius);
    if (!isNaN(cLat) && !isNaN(cLng) && !isNaN(rKm)) {
      const latRad = cLat * Math.PI / 180;
      const degLatPerKm = 1 / 111.0;
      const degLngPerKm = 1 / (111.0 * Math.cos(latRad));
      filtered = filtered.filter(v =>
        Math.abs(v.lat - cLat) <= rKm * degLatPerKm &&
        Math.abs(v.lng - cLng) <= rKm * degLngPerKm
      );
    }
  }

  filtered.sort((a, b) => {
    if (a.isMilitary !== b.isMilitary) return a.isMilitary ? -1 : 1;
    if (b.sog !== a.sog) return b.sog - a.sog;
    return (a.name || '').localeCompare(b.name || '');
  });

  const capped = filtered.slice(0, 300);

  if (!isFiltered && httpCache && Date.now() - httpCache.time < HTTP_CACHE_TTL) {
    return NextResponse.json({
      source: httpCache.source,
      timestamp: httpCache.time,
      count: httpCache.data.length,
      vessels: httpCache.data,
      liveFeedConnected: liveConnected,
      cacheSize: vesselCache.size,
      validation: {
        coordinateSanityPass: httpCache.data.filter(v => v._validation.coordinateSanity === 'pass').length,
        speedCeilingPass: httpCache.data.filter(v => v._validation.speedCeiling === 'pass').length,
        mmsiStructurePass: httpCache.data.filter(v => v._validation.mmsiStructure === 'pass').length,
        rejectedCount: httpCache.data.reduce((acc, v) => acc + v._validation.rejectedReasons.length, 0),
      },
    });
  }

  if (!isFiltered) {
    httpCache = { time: Date.now(), data: capped, source };
  }

  return NextResponse.json({
    source,
    timestamp: Date.now(),
    count: capped.length,
    vessels: capped,
    liveFeedConnected: liveConnected,
    cacheSize: vesselCache.size,
    validation: {
      coordinateSanityPass: capped.filter(v => v._validation.coordinateSanity === 'pass').length,
      speedCeilingPass: capped.filter(v => v._validation.speedCeiling === 'pass').length,
      mmsiStructurePass: capped.filter(v => v._validation.mmsiStructure === 'pass').length,
      rejectedCount: capped.reduce((acc, v) => acc + v._validation.rejectedReasons.length, 0),
    },
  });
}
