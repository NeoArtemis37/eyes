

export interface FlightData {
  callsign: string;
  origin: string;
  destination: string;
  lat: number;
  lng: number;
  altitude: number;
  speed: number;
  heading: number;
  aircraft: string;
  verticalSpeed: number;
  classification?: 'commercial' | 'private' | 'military' | 'helicopter' | 'unknown';
  isMilitary?: boolean;
  icao24?: string;
  emergency?: string | null;
}

export interface MaritimeData {
  shipName: string;
  mmsi: string;
  lat: number;
  lng: number;
  speed: number;
  heading: number;
  shipType: string;
  flag: string;
  destination: string;
}

export interface CameraData {
  id: string;
  ip: string;
  lat: number;
  lng: number;
  location: string;
  type: string;
  status: 'online' | 'offline';
  port: number;
  lastSeen: string;
  name?: string;
  city?: string;
  country?: string;
  snapshotUrl?: string;
  streamUrl?: string;
  streamType?: string;
  source?: string;
}

export interface AntennaData {
  id: string;
  operator: string;
  lat: number;
  lng: number;
  type: string;
  power: number;
  range: number;
  frequency: string;
  status: 'active' | 'maintenance';
}

export interface IPGeoData {
  ip: string;
  city: string;
  country: string;
  lat: number;
  lng: number;
  isp: string;
  org: string;
  timezone: string;
  asn: string;
}

export interface MilitaryData {
  id: string;
  name: string;
  type: string;
  side: string;
  location: string;
  lat: number;
  lng: number;
  status: string;
  strength: string;
  equipment: string;
  lastUpdated: string;
  role: string;
}

export interface SubmarineCable {
  id: string;
  name: string;
  status: 'active' | 'under_construction' | 'planned' | 'outage' | 'maintenance';
  length: number;
  rfsYear: number;
  owners: string[];
  capacity: string;
  landingPoints: CableLandingPoint[];
  route: [number, number][];
}

export interface CableLandingPoint {
  name: string;
  city: string;
  country: string;
  lat: number;
  lng: number;
  station?: string;
}


export interface EarthquakeData {
  id: string;
  magnitude: number;
  place: string;
  time: number;
  lat: number;
  lng: number;
  depth: number;
  severity: 'minor' | 'moderate' | 'strong' | 'major' | 'great';
  significance: number;
  tsunami: boolean;
  alertLevel: string | null;
  felt: number | null;
  type: string;
}

export interface CyberThreatData {
  id: string;
  type: 'vulnerability' | 'botnet' | 'malware_dist' | 'attack_surface';
  source: string;
  lat?: number;
  lng?: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  name?: string;
  vendor?: string;
  country?: string;
  count?: number;
  threats?: string[];
  description?: string;
}

export interface InternetOutageData {
  id: string;
  country: string;
  countryName: string;
  lat: number;
  lng: number;
  start: number;
  duration: number;
  score: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  datasources: { source: string; score: number }[];
}

export interface FireData {
  id: string;
  type: 'fire' | 'volcano';
  source: string;
  lat: number;
  lng: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  name?: string;
  brightness?: number;
  confidence?: string;
  date?: string;
  lastUpdate?: string;
}


export interface SatelliteData {
  id: string;
  name: string;
  lat: number;
  lng: number;
  alt: number; // km
  classification: 'military' | 'navigation' | 'communications' | 'weather' | 'research' | 'debris';
  noradId: number;
  orbitType: 'LEO' | 'MEO' | 'GEO' | 'HEO';
  country?: string;
  launchYear?: number;
}

export interface GDELTEvent {
  id: string;
  name: string;
  lat: number;
  lng: number;
  category: 'unrest' | 'conflict' | 'crisis';
  severity: 'low' | 'medium' | 'high' | 'critical';
  url: string;
  date: string;
  source: string;
  count?: number;
}


export interface FOAFDevice {
  id: string;
  ip: string;
  port: number;
  protocol: string;
  lat: number;
  lng: number;
  city: string;
  country: string;
  org: string;
  deviceType: 'camera' | 'router' | 'industrial' | 'database' | 'dns' | 'server' | 'iot';
  banner: string;
  lastSeen: string;
  risk: 'critical' | 'high' | 'medium' | 'low';
  title?: string;
  server?: string;
}


export interface ASNode {
  asn: number;
  name: string;
  country: string;
  org: string;
  type: 'tier1' | 'cdn' | 'cloud' | 'isp' | 'enterprise';
  prefixes: number;
  peers: number;
  lat: number;
  lng: number;
}

export interface ASLink {
  source: number;
  target: number;
  bandwidth: 'tier1' | 'regional' | 'edge';
  relationship: 'peer' | 'customer' | 'provider';
}

export interface NetworkTopology {
  nodes: ASNode[];
  links: ASLink[];
  source: string;
  timestamp: number;
}

export type PointType = 'camera' | 'antenna' | 'flight' | 'ship' | 'ip' | 'military' | 'cable' | 'earthquake' | 'cyber' | 'outage' | 'fire' | 'satellite' | 'gdelt' | 'fofa' | 'agent' | 'echo';

export interface GlobePoint {
  lat: number;
  lng: number;
  size: number;
  color: string;
  label?: string;
  type: PointType;
  rawData?: CameraData | AntennaData | FlightData | MaritimeData | IPGeoData | MilitaryData | SubmarineCable | EarthquakeData | CyberThreatData | InternetOutageData | FireData | SatelliteData | GDELTEvent | FOAFDevice | Record<string, any>;
}

export interface GlobeArc {
  startLat: number;
  startLng: number;
  endLat: number;
  endLng: number;
  color: string[];
  stroke?: number;
  type: 'flight' | 'maritime' | 'network' | 'cable';
}


export const CATEGORY_CONFIG: Record<PointType, { color: string; glow: string; label: string }> = {
  camera:    { color: '#00ff88', glow: 'rgba(0,255,136,0.5)',  label: 'CAMERA' },
  flight:    { color: '#00ccff', glow: 'rgba(0,204,255,0.5)',  label: 'FLIGHT' },
  cable:     { color: '#cc66ff', glow: 'rgba(204,102,255,0.5)', label: 'CABLE' },
  ship:      { color: '#ff66ff', glow: 'rgba(255,102,255,0.5)', label: 'VESSEL' },
  antenna:   { color: '#ffaa00', glow: 'rgba(255,170,0,0.5)',  label: 'ANTENNA' },
  ip:        { color: '#00eeff', glow: 'rgba(0,238,255,0.5)',  label: 'IP GEO' },
  military:  { color: '#ff3333', glow: 'rgba(255,51,51,0.5)',  label: 'MILITARY' },
  earthquake:{ color: '#ff6600', glow: 'rgba(255,102,0,0.5)',  label: 'SEISMIC' },
  cyber:     { color: '#ff0066', glow: 'rgba(255,0,102,0.5)',  label: 'CYBER' },
  outage:    { color: '#ff9900', glow: 'rgba(255,153,0,0.5)',  label: 'OUTAGE' },
  fire:      { color: '#ff4400', glow: 'rgba(255,68,0,0.5)',   label: 'FIRE' },
  satellite: { color: '#66ccff', glow: 'rgba(102,204,255,0.5)', label: 'SATELLITE' },
  gdelt:     { color: '#ffcc00', glow: 'rgba(255,204,0,0.5)',  label: 'GDELT' },
  fofa:      { color: '#ff00cc', glow: 'rgba(255,0,204,0.5)',  label: 'IOT SEARCH' },
  agent:     { color: '#ffb84d', glow: 'rgba(255,184,77,0.6)', label: 'AGENT' },
  echo:      { color: '#cc66ff', glow: 'rgba(204,102,255,0.6)', label: 'ECHO' },
};


const MAJOR_CITIES = [
  { name: 'New York', lat: 40.7128, lng: -74.006 },
  { name: 'London', lat: 51.5074, lng: -0.1278 },
  { name: 'Tokyo', lat: 35.6762, lng: 139.6503 },
  { name: 'Dubai', lat: 25.2048, lng: 55.2708 },
  { name: 'Singapore', lat: 1.3521, lng: 103.8198 },
  { name: 'Sydney', lat: -33.8688, lng: 151.2093 },
  { name: 'Sao Paulo', lat: -23.5505, lng: -46.6333 },
  { name: 'Cairo', lat: 30.0444, lng: 31.2357 },
  { name: 'Moscow', lat: 55.7558, lng: 37.6173 },
  { name: 'Mumbai', lat: 19.076, lng: 72.8777 },
  { name: 'Beijing', lat: 39.9042, lng: 116.4074 },
  { name: 'Los Angeles', lat: 34.0522, lng: -118.2437 },
  { name: 'Paris', lat: 48.8566, lng: 2.3522 },
  { name: 'Berlin', lat: 52.52, lng: 13.405 },
  { name: 'Seoul', lat: 37.5665, lng: 126.978 },
  { name: 'Hong Kong', lat: 22.3193, lng: 114.1694 },
  { name: 'Istanbul', lat: 41.0082, lng: 28.9784 },
  { name: 'Bangkok', lat: 13.7563, lng: 100.5018 },
  { name: 'Johannesburg', lat: -26.2041, lng: 28.0473 },
  { name: 'Mexico City', lat: 19.4326, lng: -99.1332 },
  { name: 'Buenos Aires', lat: -34.6037, lng: -58.3816 },
  { name: 'Lagos', lat: 6.5244, lng: 3.3792 },
  { name: 'Shanghai', lat: 31.2304, lng: 121.4737 },
  { name: 'Nairobi', lat: -1.2921, lng: 36.8219 },
  { name: 'Riyadh', lat: 24.7136, lng: 46.6753 },
  { name: 'Jakarta', lat: -6.2088, lng: 106.8456 },
  { name: 'Lima', lat: -12.0464, lng: -77.0428 },
  { name: 'Rome', lat: 41.9028, lng: 12.4964 },
  { name: 'Toronto', lat: 43.6532, lng: -79.3832 },
  { name: 'Chicago', lat: 41.8781, lng: -87.6298 },
];

const AIRPORT_CODES: Record<string, string> = {
  'New York': 'JFK', 'London': 'LHR', 'Tokyo': 'NRT',
  'Dubai': 'DXB', 'Singapore': 'SIN', 'Sydney': 'SYD',
  'Sao Paulo': 'GRU', 'Cairo': 'CAI', 'Moscow': 'SVO',
  'Mumbai': 'BOM', 'Beijing': 'PEK', 'Los Angeles': 'LAX',
  'Paris': 'CDG', 'Berlin': 'BER', 'Seoul': 'ICN',
  'Hong Kong': 'HKG', 'Istanbul': 'IST', 'Bangkok': 'BKK',
  'Johannesburg': 'JNB', 'Mexico City': 'MEX',
};

const AIRCRAFT_TYPES = ['B738', 'A320', 'B77W', 'A388', 'B789', 'A359', 'B763', 'A333', 'E190', 'CRJ9'];
const AIRLINES = ['UAE', 'BAW', 'DLH', 'SIA', 'QFA', 'AAL', 'UAL', 'DAL', 'ANA', 'KAL', 'AFR', 'KLM', 'THY', 'CPA', 'SWA'];

const SHIP_TYPES = ['Cargo', 'Tanker', 'Container', 'Bulk Carrier', 'LNG Carrier', 'Ro-Ro', 'Fishing', 'Tug', 'Passenger', 'Yacht'];
const FLAGS = ['PA', 'LR', 'MH', 'HK', 'SG', 'GB', 'NO', 'GR', 'BS', 'MT', 'PA', 'CY'];
const SHIP_PREFIXES = ['MSC', 'CMA', 'EVER', 'MAER', 'COSO', 'HAP', 'ONE', 'YANG', 'ZIM', 'PAC'];

const CAMERA_TYPES = ['IP Camera', 'Webcam', 'PTZ Camera', 'Dome Camera', 'Bullet Camera', 'Thermal'];
const CAMERA_LOCATIONS = [
  'Harbor View', 'City Center', 'Airport Terminal', 'Highway', 'Train Station',
  'Parking Lot', 'Shopping Mall', 'Bridge', 'Park', 'Government Building',
  'Port Authority', 'Weather Station', 'Traffic Monitor', 'Skyscraper Roof',
  'University Campus', 'Hospital', 'Sports Complex', 'Power Plant', 'Border Crossing',
];

const ANTENNA_OPERATORS = ['Ericsson', 'Huawei', 'Nokia', 'ZTE', 'Samsung', 'Cisco', 'CommScope', 'American Tower', 'Crown Castle', 'SBA Communications'];
const ANTENNA_TYPES = ['5G NR', '4G LTE', '3G UMTS', 'Microwave', 'WiFi Mesh', 'Radar', 'Satellite Uplink', 'FM Radio', 'TV Broadcast'];
const FREQUENCIES = ['700 MHz', '850 MHz', '900 MHz', '1.8 GHz', '2.1 GHz', '2.4 GHz', '3.5 GHz', '5 GHz', '28 GHz', '39 GHz'];

const ISPS = ['Comcast', 'AT&T', 'Verizon', 'Deutsche Telekom', 'NTT', 'China Telecom', 'BT Group', 'Orange', 'Telefonica', 'Vodafone'];
const ORGS = ['Cloudflare Inc', 'Amazon AWS', 'Google Cloud', 'Microsoft Azure', 'DigitalOcean', 'OVH SAS', 'Hetzner Online', 'Linode LLC', 'Alibaba Cloud', 'Tencent Cloud'];

function randomBetween(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

function randomChoice<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomIP(): string {
  return `${Math.floor(Math.random() * 223) + 1}.${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}`;
}

function randomMMSI(): string {
  return `${Math.floor(Math.random() * 900000000) + 100000000}`;
}

function interpolateFlightPath(startLat: number, startLng: number, endLat: number, endLng: number, progress: number) {
  const lat = startLat + (endLat - startLat) * progress;
  const lng = startLng + (endLng - startLng) * progress;
  return { lat, lng };
}

export function generateFlights(count: number = 40): FlightData[] {
  const flights: FlightData[] = [];
  for (let i = 0; i < count; i++) {
    const origin = randomChoice(MAJOR_CITIES);
    let destination: typeof origin;
    do {
      destination = randomChoice(MAJOR_CITIES);
    } while (destination.name === origin.name);

    const progress = Math.random();
    const pos = interpolateFlightPath(origin.lat, origin.lng, destination.lat, destination.lng, progress);
    const alt = randomBetween(30000, 42000);
    const heading = Math.atan2(destination.lng - origin.lng, destination.lat - origin.lat) * (180 / Math.PI);

    flights.push({
      callsign: `${randomChoice(AIRLINES)}${Math.floor(Math.random() * 9000) + 1000}`,
      origin: AIRPORT_CODES[origin.name] || origin.name.substring(0, 3).toUpperCase(),
      destination: AIRPORT_CODES[destination.name] || destination.name.substring(0, 3).toUpperCase(),
      lat: pos.lat + randomBetween(-2, 2),
      lng: pos.lng + randomBetween(-2, 2),
      altitude: Math.round(alt),
      speed: Math.round(randomBetween(400, 560)),
      heading: Math.round(heading),
      aircraft: randomChoice(AIRCRAFT_TYPES),
      verticalSpeed: Math.round(randomBetween(-1500, 1500)),
    });
  }
  return flights;
}

export function generateMaritime(count: number = 25): MaritimeData[] {
  const ships: MaritimeData[] = [];
  const shippingAreas = [
    { lat: 1.35, lng: 103.82, name: 'Strait of Malacca' },
    { lat: 30.0, lng: 32.0, name: 'Suez Canal' },
    { lat: 9.0, lng: -79.0, name: 'Panama Canal' },
    { lat: 51.0, lng: 2.0, name: 'English Channel' },
    { lat: 34.0, lng: 135.0, name: 'Inland Sea Japan' },
    { lat: 25.0, lng: 55.0, name: 'Persian Gulf' },
    { lat: 55.0, lng: 10.0, name: 'Baltic Sea' },
    { lat: -33.0, lng: 18.0, name: 'Cape of Good Hope' },
    { lat: 22.0, lng: 114.0, name: 'South China Sea' },
    { lat: 37.0, lng: -122.0, name: 'Pacific Coast' },
  ];

  for (let i = 0; i < count; i++) {
    const area = randomChoice(shippingAreas);
    ships.push({
      shipName: `${randomChoice(SHIP_PREFIXES)} ${randomChoice(['Atlas', 'Brave', 'Coral', 'Delta', 'Echo', 'Fortune', 'Giant', 'Horizon', 'Infinity', 'Jade', 'Knight', 'Legend', 'Mystic', 'Noble', 'Ocean', 'Pioneer', 'Quest', 'Royal', 'Storm', 'Titan'])}`,
      mmsi: randomMMSI(),
      lat: area.lat + randomBetween(-5, 5),
      lng: area.lng + randomBetween(-5, 5),
      speed: Math.round(randomBetween(5, 22) * 10) / 10,
      heading: Math.round(randomBetween(0, 360)),
      shipType: randomChoice(SHIP_TYPES),
      flag: randomChoice(FLAGS),
      destination: randomChoice(MAJOR_CITIES).name,
    });
  }
  return ships;
}

export function generateCameras(count: number = 60): CameraData[] {
  const cameras: CameraData[] = [];
  for (let i = 0; i < count; i++) {
    const city = randomChoice(MAJOR_CITIES);
    cameras.push({
      id: `CAM-${String(i + 1).padStart(4, '0')}`,
      ip: randomIP(),
      lat: city.lat + randomBetween(-0.5, 0.5),
      lng: city.lng + randomBetween(-0.5, 0.5),
      location: `${randomChoice(CAMERA_LOCATIONS)}, ${city.name}`,
      type: randomChoice(CAMERA_TYPES),
      status: Math.random() > 0.15 ? 'online' : 'offline',
      port: randomChoice([80, 443, 554, 8080, 8443, 8554]),
      lastSeen: new Date(Date.now() - Math.random() * 3600000).toISOString(),
    });
  }
  return cameras;
}

export function generateAntennas(count: number = 80): AntennaData[] {
  const antennas: AntennaData[] = [];
  for (let i = 0; i < count; i++) {
    const city = randomChoice(MAJOR_CITIES);
    antennas.push({
      id: `ANT-${String(i + 1).padStart(4, '0')}`,
      operator: randomChoice(ANTENNA_OPERATORS),
      lat: city.lat + randomBetween(-1, 1),
      lng: city.lng + randomBetween(-1, 1),
      type: randomChoice(ANTENNA_TYPES),
      power: Math.round(randomBetween(10, 60)),
      range: Math.round(randomBetween(1, 35)),
      frequency: randomChoice(FREQUENCIES),
      status: Math.random() > 0.1 ? 'active' : 'maintenance',
    });
  }
  return antennas;
}

export function generateIPGeo(ip?: string): IPGeoData {
  const city = randomChoice(MAJOR_CITIES);
  return {
    ip: ip || randomIP(),
    city: city.name,
    country: getCountryForCity(city.name),
    lat: city.lat + randomBetween(-0.1, 0.1),
    lng: city.lng + randomBetween(-0.1, 0.1),
    isp: randomChoice(ISPS),
    org: randomChoice(ORGS),
    timezone: getTimezoneForCity(city.name),
    asn: `AS${Math.floor(Math.random() * 90000) + 10000}`,
  };
}

function getCountryForCity(city: string): string {
  const map: Record<string, string> = {
    'New York': 'United States', 'London': 'United Kingdom', 'Tokyo': 'Japan',
    'Dubai': 'UAE', 'Singapore': 'Singapore', 'Sydney': 'Australia',
    'Sao Paulo': 'Brazil', 'Cairo': 'Egypt', 'Moscow': 'Russia',
    'Mumbai': 'India', 'Beijing': 'China', 'Los Angeles': 'United States',
    'Paris': 'France', 'Berlin': 'Germany', 'Seoul': 'South Korea',
    'Hong Kong': 'Hong Kong', 'Istanbul': 'Turkey', 'Bangkok': 'Thailand',
    'Johannesburg': 'South Africa', 'Mexico City': 'Mexico',
  };
  return map[city] || 'Unknown';
}

function getTimezoneForCity(city: string): string {
  const map: Record<string, string> = {
    'New York': 'America/New_York', 'London': 'Europe/London', 'Tokyo': 'Asia/Tokyo',
    'Dubai': 'Asia/Dubai', 'Singapore': 'Asia/Singapore', 'Sydney': 'Australia/Sydney',
    'Sao Paulo': 'America/Sao_Paulo', 'Cairo': 'Africa/Cairo', 'Moscow': 'Europe/Moscow',
    'Mumbai': 'Asia/Kolkata', 'Beijing': 'Asia/Shanghai', 'Los Angeles': 'America/Los_Angeles',
    'Paris': 'Europe/Paris', 'Berlin': 'Europe/Berlin', 'Seoul': 'Asia/Seoul',
    'Hong Kong': 'Asia/Hong_Kong', 'Istanbul': 'Europe/Istanbul', 'Bangkok': 'Asia/Bangkok',
    'Johannesburg': 'Africa/Johannesburg', 'Mexico City': 'America/Mexico_City',
  };
  return map[city] || 'UTC';
}


const FOFA_CAMERA_BRANDS = ['Hikvision DS-2CD2142', 'Dahua DH-IPC-HDW5442T', 'Axis P3245-V', 'Foscam FI9961EP', 'Reolink RLC-810A', 'VStarcam C7837WIP', 'TP-Link VIGI C340', 'Amcrest IP8M-2493EW', 'Uniview IPC3614SB'];
const FOFA_ROUTER_BRANDS = ['MikroTik RB750Gr3', 'Cisco ISR 4321', 'TP-Link Archer C7', 'Keenetic Viva', 'ZTE F660', 'ASUS RT-AX88U', 'MikroTik RB4011', 'Bell Home Hub 3000'];
const FOFA_IOT_BRANDS = ['Samsung SmartThings Hub', 'HP LaserJet Pro M404n', 'Synology DS920+', 'Philips Hue Bridge', 'Brother MFC-L8900CDW', 'QNAP TS-464', 'Home Assistant OS', 'Tuya Smart Life Gateway', 'WD My Cloud EX2 Ultra'];

export function generateFOFA(count: number = 80): FOAFDevice[] {
  const devices: FOAFDevice[] = [];
  const now = Date.now();
  const hoursAgo = (h: number) => new Date(now - h * 3600000).toISOString();

  const deviceDistribution: { type: FOAFDevice['deviceType']; weight: number }[] = [
    { type: 'camera', weight: 30 },
    { type: 'router', weight: 18 },
    { type: 'industrial', weight: 12 },
    { type: 'database', weight: 12 },
    { type: 'dns', weight: 10 },
    { type: 'iot', weight: 18 },
  ];

  const totalWeight = deviceDistribution.reduce((s, d) => s + d.weight, 0);

  for (let i = 0; i < count; i++) {
    let r = Math.random() * totalWeight;
    let deviceType: FOAFDevice['deviceType'] = 'iot';
    for (const dist of deviceDistribution) {
      r -= dist.weight;
      if (r <= 0) { deviceType = dist.type; break; }
    }

    const city = randomChoice(MAJOR_CITIES);
    const lat = city.lat + randomBetween(-2, 2);
    const lng = city.lng + randomBetween(-2, 2);

    let port: number;
    let protocol: string;
    let banner: string;
    let title: string;
    let risk: FOAFDevice['risk'];
    let server: string | undefined;

    switch (deviceType) {
      case 'camera':
        port = randomChoice([80, 443, 554, 8080, 8443, 8554]);
        protocol = port === 554 || port === 8554 ? 'rtsp' : 'http';
        title = randomChoice(FOFA_CAMERA_BRANDS);
        banner = protocol === 'rtsp'
          ? `RTSP/1.0 200 OK\r\nServer: ${title.split(' ')[0]}\r\n`
          : `HTTP/1.1 200 OK\r\nServer: ${title.split(' ')[0]}-Webs\r\n`;
        risk = randomChoice(['critical', 'critical', 'high', 'high']);
        server = title.split(' ')[0] + '-Webs';
        break;
      case 'router':
        port = randomChoice([80, 443, 8291, 22, 23, 8080]);
        protocol = port === 8291 ? 'winbox' : port === 22 ? 'ssh' : port === 23 ? 'telnet' : 'http';
        title = randomChoice(FOFA_ROUTER_BRANDS);
        banner = port === 8291
          ? `Winbox protocol detected\r\n`
          : port === 22
            ? `SSH-2.0-Cisco-1.25\r\n`
            : `HTTP/1.1 200 OK\r\nServer: ${title.split(' ')[0]}\r\n`;
        risk = port === 8291 || port === 23 ? 'critical' : 'high';
        server = title.split(' ')[0];
        break;
      case 'industrial':
        port = randomChoice([502, 102, 44818, 4840, 20000]);
        protocol = port === 502 ? 'modbus' : port === 102 ? 's7comm' : port === 44818 ? 'ethernet-ip' : port === 4840 ? 'opc-ua' : 'dnp3';
        title = randomChoice(['Schneider Modicon M340', 'Siemens S7-1200', 'Siemens S7-1500', 'Rockwell ControlLogix', 'ABB ACS880', 'Yokogawa CENTUM VP']);
        banner = `Protocol: ${protocol.toUpperCase()}\r\nDevice: ${title}\r\n`;
        risk = 'critical';
        break;
      case 'database':
        port = randomChoice([3306, 5432, 27017, 6379]);
        protocol = port === 3306 ? 'mysql' : port === 5432 ? 'postgresql' : port === 27017 ? 'mongodb' : 'redis';
        title = port === 3306 ? `MySQL ${randomChoice(['5.7', '8.0'])}` : port === 5432 ? `PostgreSQL ${randomChoice(['13', '14', '15'])}` : port === 27017 ? `MongoDB ${randomChoice(['5.0', '6.0', '7.0'])}` : `Redis ${randomChoice(['6.2', '7.0'])}`;
        banner = `${title} · ${port === 27017 ? 'No Auth' : 'Authentication Required'}\r\n`;
        risk = port === 27017 ? 'critical' : 'high';
        break;
      case 'dns':
        port = 53;
        protocol = 'dns';
        title = randomChoice(['BIND 9.x', 'PowerDNS', 'Unbound', 'NSD', 'Knot DNS']);
        banner = `DNS Server · ${title}\r\nRecursion: enabled\r\n`;
        risk = 'low';
        break;
      case 'iot':
        port = randomChoice([80, 443, 5000, 631, 8080, 8888]);
        protocol = port === 631 ? 'ipp' : 'http';
        title = randomChoice(FOFA_IOT_BRANDS);
        banner = `HTTP/1.1 200 OK\r\nServer: ${title.split(' ')[0]}\r\n`;
        risk = randomChoice(['high', 'high', 'medium', 'critical']);
        server = title.split(' ')[0];
        break;
      default:
        port = 80;
        protocol = 'http';
        title = 'Unknown Device';
        banner = 'HTTP/1.1 200 OK\r\n';
        risk = 'medium';
    }

    devices.push({
      id: `FOFA-${deviceType.toUpperCase().slice(0, 3)}-${String(i + 1).padStart(4, '0')}`,
      ip: randomIP(),
      port,
      protocol,
      lat,
      lng,
      city: city.name,
      country: getCountryForCity(city.name),
      org: randomChoice(ISPS),
      deviceType,
      banner,
      lastSeen: hoursAgo(Math.random() * 24),
      risk,
      title,
      server,
    });
  }

  return devices;
}


export function generateGlobePoints(
  cameras: CameraData[],
  antennas: AntennaData[],
  flights: FlightData[],
  ships: MaritimeData[],
  earthquakes: EarthquakeData[] = [],
  cyberThreats: CyberThreatData[] = [],
  outages: InternetOutageData[] = [],
  fires: FireData[] = [],
  fofaDevices: FOAFDevice[] = [],
): GlobePoint[] {
  const points: GlobePoint[] = [];

  cameras.forEach(c => {
    points.push({
      lat: c.lat,
      lng: c.lng,
      size: c.status === 'online' ? 0.3 : 0.15,
      color: c.status === 'online' ? '#00ff88' : '#ff4444',
      label: c.id,
      type: 'camera',
      rawData: c,
    });
  });

  antennas.forEach(a => {
    points.push({
      lat: a.lat,
      lng: a.lng,
      size: 0.2,
      color: a.status === 'active' ? '#ffaa00' : '#ff4444',
      label: a.id,
      type: 'antenna',
      rawData: a,
    });
  });

  flights.forEach(f => {
    const color = f.isMilitary ? '#ff3333' : (f.classification === 'helicopter' ? '#ffaa00' : '#00ccff');
    points.push({
      lat: f.lat,
      lng: f.lng,
      size: f.isMilitary ? 0.35 : 0.25,
      color,
      label: f.callsign,
      type: 'flight',
      rawData: f,
    });
  });

  ships.forEach(s => {
    points.push({
      lat: s.lat,
      lng: s.lng,
      size: 0.2,
      color: '#ff66ff',
      label: s.shipName,
      type: 'ship',
      rawData: s,
    });
  });

  earthquakes.forEach(eq => {
    const sizeMultiplier = eq.magnitude / 5;
    const colors: Record<string, string> = {
      minor: '#ffcc00', moderate: '#ff9900', strong: '#ff6600', major: '#ff3300', great: '#ff0000',
    };
    points.push({
      lat: eq.lat,
      lng: eq.lng,
      size: Math.min(sizeMultiplier, 1.2),
      color: colors[eq.severity] || '#ff6600',
      label: `M${eq.magnitude}`,
      type: 'earthquake',
      rawData: eq,
    });
  });

  cyberThreats.forEach(ct => {
    if (ct.lat !== undefined && ct.lng !== undefined) {
      const colors: Record<string, string> = {
        low: '#ff99cc', medium: '#ff3399', high: '#ff0066', critical: '#ff0033',
      };
      points.push({
        lat: ct.lat,
        lng: ct.lng,
        size: ct.severity === 'critical' ? 0.4 : ct.severity === 'high' ? 0.3 : 0.2,
        color: colors[ct.severity] || '#ff0066',
        label: ct.id,
        type: 'cyber',
        rawData: ct,
      });
    }
  });

  outages.forEach(out => {
    const colors: Record<string, string> = {
      low: '#ffcc66', medium: '#ff9933', high: '#ff6600', critical: '#ff3300',
    };
    points.push({
      lat: out.lat,
      lng: out.lng,
      size: out.severity === 'critical' ? 0.5 : out.severity === 'high' ? 0.35 : 0.25,
      color: colors[out.severity] || '#ff9900',
      label: out.countryName,
      type: 'outage',
      rawData: out,
    });
  });

  fires.forEach(f => {
    const colors: Record<string, string> = {
      low: '#ff8800', medium: '#ff5500', high: '#ff3300', critical: '#ff0000',
    };
    const baseSize = f.type === 'volcano' ? 0.45 : 0.2;
    points.push({
      lat: f.lat,
      lng: f.lng,
      size: f.severity === 'critical' ? baseSize * 1.5 : baseSize,
      color: colors[f.severity] || '#ff4400',
      label: f.type === 'volcano' ? (f.name || 'Volcano') : 'Fire',
      type: 'fire',
      rawData: f,
    });
  });

  fofaDevices.forEach(d => {
    const riskColors: Record<string, string> = {
      critical: '#ff00cc', high: '#ff0099', medium: '#cc0099', low: '#990066',
    };
    points.push({
      lat: d.lat,
      lng: d.lng,
      size: d.risk === 'critical' ? 0.4 : d.risk === 'high' ? 0.3 : 0.2,
      color: riskColors[d.risk] || '#ff00cc',
      label: d.id,
      type: 'fofa',
      rawData: d,
    });
  });

  return points;
}

export function generateGlobeArcs(
  flights: FlightData[],
  ships: MaritimeData[],
  cables: SubmarineCable[] = [],
): GlobeArc[] {
  const arcs: GlobeArc[] = [];

  const flightSample = flights.slice(0, 15);
  flightSample.forEach(f => {
    const destCity = MAJOR_CITIES.find(c => (AIRPORT_CODES[c.name] || c.name.substring(0, 3).toUpperCase()) === f.destination);
    if (destCity) {
      arcs.push({
        startLat: f.lat,
        startLng: f.lng,
        endLat: destCity.lat,
        endLng: destCity.lng,
        color: f.isMilitary ? ['#ff3333', '#990000'] : ['#00ccff', '#0044ff'],
        stroke: f.isMilitary ? 0.7 : 0.5,
        type: 'flight',
      });
    }
  });

  const shipSample = ships.slice(0, 8);
  shipSample.forEach(s => {
    const destCity = MAJOR_CITIES.find(c => c.name === s.destination);
    if (destCity) {
      arcs.push({
        startLat: s.lat,
        startLng: s.lng,
        endLat: destCity.lat,
        endLng: destCity.lng,
        color: ['#ff66ff', '#6600cc'],
        stroke: 0.4,
        type: 'maritime',
      });
    }
  });

  cables.forEach(cable => {
    if (cable.route && cable.route.length >= 2) {
      const statusColors: Record<string, string[]> = {
        active: ['#cc66ff', '#9933ff'],
        outage: ['#ff0000', '#990000'],
        under_construction: ['#ffaa00', '#cc8800'],
        planned: ['#666666', '#444444'],
        maintenance: ['#ffcc00', '#cc9900'],
      };
      for (let i = 0; i < cable.landingPoints.length - 1; i++) {
        arcs.push({
          startLat: cable.landingPoints[i].lat,
          startLng: cable.landingPoints[i].lng,
          endLat: cable.landingPoints[i + 1].lat,
          endLng: cable.landingPoints[i + 1].lng,
          color: statusColors[cable.status] || ['#cc66ff', '#9933ff'],
          stroke: cable.status === 'outage' ? 0.8 : 0.3,
          type: 'cable',
        });
      }
    }
  });

  return arcs;
}

const LOG_MESSAGES = [
  'SYS> Satellite uplink established... signal strength: 98.2%',
  'NET> Scanning port range 1-65535 on target subnet...',
  'GEO> GPS coordinates locked: {lat}, {lng} ±0.003',
  'CAM> Camera {id} stream acquired · resolution: 1920x1080',
  'FLY> Flight {callsign} detected at FL{alt} · speed: {spd}kts',
  'SEA> Vessel {ship} MMSI:{mmsi} · flag: {flag}',
  'ANT> Cell tower {ant} operational · power: {pwr}dBm · range: {rng}km',
  'SIG> Intercepted encrypted transmission on freq {freq}',
  'NET> New node discovered at {ip} · ASN: {asn}',
  'SYS> Database sync complete · {n} records indexed',
  'SEC> Firewall breach attempt blocked from {ip}',
  'OSI> Open-source intelligence query returned {n} results',
  'SAT> Imaging satellite pass in T-{t} minutes',
  'DAT> Processing SIGINT payload · {n} intercepts decoded',
  'NET> VPN tunnel established via {country} exit node',
  'GEO> Geofence alert: target entered zone ALPHA-7',
  'SYS> CPU load: {cpu}% | Memory: {mem}% | Network I/O: {net} Mbps',
  'CAM> PTZ camera {id} auto-tracking enabled',
  'FLY> ADS-B transponder {callsign} · squawk: {sqk}',
  'SEA> AIS signal acquired: {ship} · ETA: {eta}h',
  'EQK> Seismic event M{mag} detected near {place}',
  'CYB> CISA KEV alert: {cve} · {vendor} {product}',
  'OUT> Internet outage detected: {country} · score: {score}',
  'FIR> Active fire detected: {brightness}K brightness · confidence: {conf}',
  'CBL> Submarine cable {cable} · status: {cablestatus}',
];

export function generateLogMessage(): string {
  const template = randomChoice(LOG_MESSAGES);
  return template
    .replace('{lat}', (randomBetween(-60, 60)).toFixed(4))
    .replace('{lng}', (randomBetween(-180, 180)).toFixed(4))
    .replace('{id}', `CAM-${Math.floor(Math.random() * 9000) + 1000}`)
    .replace('{callsign}', `${randomChoice(AIRLINES)}${Math.floor(Math.random() * 9000) + 1000}`)
    .replace('{alt}', String(Math.floor(randomBetween(300, 420))))
    .replace('{spd}', String(Math.floor(randomBetween(400, 560))))
    .replace('{ship}', `${randomChoice(SHIP_PREFIXES)} ${randomChoice(['Atlas', 'Brave', 'Coral', 'Delta'])}`)
    .replace('{mmsi}', randomMMSI().substring(0, 6))
    .replace('{flag}', randomChoice(FLAGS))
    .replace('{ant}', `ANT-${Math.floor(Math.random() * 9000) + 1000}`)
    .replace('{pwr}', String(Math.floor(randomBetween(20, 55))))
    .replace('{rng}', String(Math.floor(randomBetween(3, 30))))
    .replace('{freq}', randomChoice(FREQUENCIES))
    .replace('{ip}', randomIP())
    .replace('{asn}', `AS${Math.floor(Math.random() * 90000) + 10000}`)
    .replace('{n}', String(Math.floor(randomBetween(100, 9999))))
    .replace('{t}', String(Math.floor(randomBetween(2, 45))))
    .replace('{country}', randomChoice(MAJOR_CITIES).name)
    .replace('{cpu}', String(Math.floor(randomBetween(30, 85))))
    .replace('{mem}', String(Math.floor(randomBetween(40, 78))))
    .replace('{net}', String(Math.floor(randomBetween(100, 950))))
    .replace('{sqk}', String(Math.floor(Math.random() * 7777)))
    .replace('{eta}', String(Math.floor(randomBetween(2, 48))))
    .replace('{mag}', (randomBetween(2.5, 7.5)).toFixed(1))
    .replace('{place}', randomChoice(MAJOR_CITIES).name)
    .replace('{cve}', `CVE-2025-${Math.floor(Math.random() * 99999)}`)
    .replace('{vendor}', randomChoice(['Microsoft', 'Apple', 'Google', 'Cisco', 'Adobe']))
    .replace('{product}', randomChoice(['Windows', 'iOS', 'Chrome', 'IOS', 'Reader']))
    .replace('{score}', String(Math.floor(randomBetween(20, 95))))
    .replace('{brightness}', String(Math.floor(randomBetween(300, 380))))
    .replace('{conf}', randomChoice(['high', 'nominal', 'low']))
    .replace('{cable}', randomChoice(['MAREA', '2Africa', 'SEA-ME-WE 5', 'TPE', 'EIG']))
    .replace('{cablestatus}', randomChoice(['active', 'outage', 'maintenance']));
}

export function generateSystemStats() {
  return {
    cpu: Math.floor(randomBetween(35, 78)),
    memory: Math.floor(randomBetween(42, 72)),
    network: Math.floor(randomBetween(120, 890)),
    uptime: `${Math.floor(randomBetween(0, 72))}h ${Math.floor(randomBetween(0, 59))}m`,
    satellites: Math.floor(randomBetween(8, 24)),
    activeFeeds: Math.floor(randomBetween(45, 180)),
    threatsBlocked: Math.floor(randomBetween(12, 89)),
    dataProcessed: `${(randomBetween(1.2, 8.7)).toFixed(1)} TB`,
  };
}
