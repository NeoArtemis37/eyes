
import { NextResponse } from 'next/server';
import { stealthFetch, stealthFetchJSON } from '@/lib/stealthFetch';
import type { CameraData } from '@/lib/osint-data';
import { HLS_IPCAMS } from '@/lib/hlsCams';

type StreamType = 'jpg' | 'hls' | 'iframe';

interface CameraDataEx extends CameraData {
  streamType?: StreamType;
}

const CACHE_TTL = 300_000; // 5 minutes
const MAX_CAMERAS = 300;   // globe performance limit

let cachedData: {
  time: number;
  data: CameraDataEx[];
  sources: string[];
} | null = null;

function detectStreamType(url: string): StreamType {
  if (!url) return 'jpg';
  const lower = url.toLowerCase();
  if (lower.includes('youtube.com') || lower.includes('youtu.be') || lower.includes('iframe'))
    return 'iframe';
  if (lower.includes('.m3u8') || lower.includes('.mpd') || lower.includes('hls') || lower.includes('mjpeg'))
    return 'hls';
  return 'jpg';
}

function classifyUrl(url: string): { snapshotUrl?: string; streamUrl?: string } {
  if (!url) return {};
  const lower = url.toLowerCase();
  if (lower.match(/\.(jpg|jpeg|png|gif|bmp|webp)(\?|$)/i)) return { snapshotUrl: url };
  if (lower.includes('mjpeg') || lower.includes('axis-cgi/mjpg') || lower.includes('video.mjpg')) return { streamUrl: url };
  if (lower.startsWith('rtsp://')) return { streamUrl: url };
  if (lower.includes('.m3u8') || lower.includes('.mpd')) return { streamUrl: url };
  if (lower.includes('/stream') || lower.includes('/live') || lower.includes('/video') || lower.includes('/mjpg')) return { streamUrl: url };
  if (lower.startsWith('http')) return { snapshotUrl: url };
  return {};
}

const SOURCE_TYPE_MAP: Record<string, string> = {
  'ASFINAG': 'Traffic Cam',
  'TfL': 'Traffic Cam',
  'Quebec511': 'Traffic Cam',
  'Ontario511': 'Traffic Cam',
  'Alberta511': 'Traffic Cam',
  'WSdot': 'Traffic Cam',
  'WSDOT': 'Traffic Cam',
  'Caltrans': 'Traffic Cam',
  '511NY': 'Traffic Cam',
  'FDOT': 'Traffic Cam',
  'NCDOT': 'Traffic Cam',
  'ODOT': 'Traffic Cam',
  'MDOT': 'Traffic Cam',
  'KDOT': 'Traffic Cam',
  'PennDOT': 'Traffic Cam',
  'VicRoads': 'Traffic Cam',
  'RMS': 'Traffic Cam',
  'LTA': 'Traffic Cam',
  'RWS': 'Traffic Cam',
  'NDW': 'Traffic Cam',
};

function mapSourceType(source: string): string {
  if (SOURCE_TYPE_MAP[source]) return SOURCE_TYPE_MAP[source];
  const lower = source.toLowerCase();
  if (lower.includes('traffic') || lower.includes('dot') || lower.includes('511') || lower.includes('road') || lower.includes('cam'))
    return 'Traffic Cam';
  if (lower.includes('harbor') || lower.includes('port') || lower.includes('ferry'))
    return 'Harbor Cam';
  if (lower.includes('beach') || lower.includes('coast'))
    return 'Beach Cam';
  if (lower.includes('weather') || lower.includes('met'))
    return 'Weather Station';
  if (lower.includes('airport') || lower.includes('aviation'))
    return 'Airport Cam';
  if (lower.includes('ski') || lower.includes('mountain') || lower.includes('alpine'))
    return 'Mountain Cam';
  if (lower.includes('city') || lower.includes('urban') || lower.includes('metro'))
    return 'City Cam';
  return 'CCTV Camera';
}

function mapStatus(status: string): 'online' | 'offline' {
  const lower = status.toLowerCase();
  if (lower === 'online' || lower === 'active' || lower === 'live' || lower === 'ok')
    return 'online';
  return 'offline';
}

function shuffleArray<T>(arr: T[]): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function deduplicateCameras(cameras: CameraDataEx[]): CameraDataEx[] {
  const seen = new Set<string>();
  return cameras.filter(c => {
    if (seen.has(c.id)) return false;
    seen.add(c.id);
    return true;
  });
}


interface OpenCctvCamera {
  id: string;
  camera_code?: number;
  name: string;
  city?: string;
  state?: string;
  country?: string;
  lat: number;
  lng: number;
  feed_url: string;
  feed_type: 'm3u8' | 'image' | 'mp4' | 'mjpeg' | 'iframe' | 'direct';
  update_rate?: number;
  source: string;
  direction?: string;
  active: number;
  category: string;
  timezone?: string;
  force_direct?: number;
  consecutive_failures?: number;
}

const OPENCCTV_CATEGORY_MAP: Record<string, string> = {
  'traffic': 'Traffic Cam',
  'water': 'Beach Cam',
  'beach': 'Beach Cam',
  'mountain': 'Mountain Cam',
  'ski': 'Mountain Cam',
  'airport': 'Airport Cam',
  'nature': 'Nature Cam',
  'weather': 'Weather Station',
  'satellite': 'Satellite Feed',
};

function mapOpenCctvFeedType(ft: string): StreamType {
  switch (ft) {
    case 'm3u8': case 'direct': return 'hls';
    case 'iframe': return 'iframe';
    case 'mp4': return 'hls';
    case 'mjpeg': return 'hls';
    case 'image': default: return 'jpg';
  }
}

function transformOpenCctv(cam: OpenCctvCamera): CameraDataEx {
  const feedUrl = cam.feed_url || '';
  const feedType = cam.feed_type || 'image';
  const streamType = mapOpenCctvFeedType(feedType);
  const { snapshotUrl, streamUrl } = classifyUrl(feedUrl);
  const isImageFeed = feedType === 'image';

  const finalSnapshot = isImageFeed ? feedUrl : (snapshotUrl || undefined);
  const finalStream = !isImageFeed ? feedUrl : (streamUrl || undefined);

  return {
    id: `CCTV-${cam.id}`,
    ip: `10.${(Math.abs(Math.round(cam.lat * 100)) % 256)}.${(Math.abs(Math.round(cam.lng * 100)) % 256)}.${(Math.abs(cam.camera_code || 0) % 254) + 1}`,
    lat: cam.lat,
    lng: cam.lng,
    location: [cam.name, cam.city, cam.state, cam.country].filter(Boolean).join(', ') || 'Unknown',
    type: OPENCCTV_CATEGORY_MAP[cam.category?.toLowerCase()] || 'CCTV Camera',
    status: cam.active === 1 && (cam.consecutive_failures || 0) < 5 ? 'online' as const : 'offline' as const,
    port: feedUrl.startsWith('https') ? 443 : 80,
    lastSeen: new Date().toISOString(),
    name: cam.name || undefined,
    city: cam.city || cam.state || undefined,
    country: cam.country || undefined,
    snapshotUrl: finalSnapshot,
    streamUrl: finalStream,
    source: `OpenCCTV/${cam.source || 'unknown'}`,
    streamType,
  };
}

async function fetchOpenCctv(): Promise<{ cameras: CameraDataEx[]; label: string }> {
  try {
    const searchQueries = [
      'traffic',   // Traffic cams worldwide
      'beach',     // Beach/coastal cams
      'airport',   // Airport cams
      'weather',   // Weather stations
      'highway',   // Highway cams
      'city',      // City cams
      'harbor',    // Port/harbor cams (maritime situational awareness)
      'mountain',  // Mountain/alpine cams
      'downtown',  // Urban core cams
      'port',      // Port cams (second spelling)
      'lagos', 'nairobi', 'dakar', 'casablanca', 'abidjan',
      'accra', 'johannesburg', 'cairo', 'bamako',
    ];

    const batchSize = 25; // per query
    const allCameras: OpenCctvCamera[] = [];
    const seenIds = new Set<string>();

    const results = await Promise.allSettled(
      searchQueries.map(q =>
        stealthFetchJSON<{ cameras: OpenCctvCamera[]; total: number }>(
          `https://opencctv.org/api/cameras/search?q=${encodeURIComponent(q)}&limit=${batchSize}`,
          { timeout: 15000, retries: 1 }
        )
      )
    );

    for (const result of results) {
      if (result.status === 'fulfilled' && result.value) {
        const data = result.value;
        const cameras = Array.isArray(data) ? data : (data.cameras || []);
        for (const cam of cameras) {
          if (!seenIds.has(cam.id)) {
            seenIds.add(cam.id);
            allCameras.push(cam);
          }
        }
      }
    }

    const pools: Array<{ bounds: string; limit: number }> = [
      { bounds: '-35,-20,38,55', limit: 70 },   // Africa (continental)
      { bounds: '35,-10,60,30', limit: 60 },    // Europe core
      { bounds: '-80,-180,80,180', limit: 80 }, // Global spread
    ];
    const poolResults = await Promise.allSettled(
      pools.map(p =>
        stealthFetchJSON<OpenCctvCamera[]>(
          `https://opencctv.org/api/cameras/feed-pool?bounds=${p.bounds}&limit=${p.limit}`,
          { timeout: 15000, retries: 1 }
        )
      )
    );
    for (const pr of poolResults) {
      if (pr.status === 'fulfilled' && pr.value) {
        const poolCams = Array.isArray(pr.value) ? pr.value : [];
        for (const cam of poolCams) {
          if (!seenIds.has(cam.id)) {
            seenIds.add(cam.id);
            allCameras.push(cam);
          }
        }
      }
    }

    const cameras = allCameras
      .map(transformOpenCctv)
      .filter(c =>
        typeof c.lat === 'number' && typeof c.lng === 'number' &&
        c.lat >= -90 && c.lat <= 90 && c.lng >= -180 && c.lng <= 180 &&
        c.lat !== 0 && c.lng !== 0
      );

    return { cameras, label: `OpenCCTV/${cameras.length}` };
  } catch (e: any) {
    console.error('[Cameras] OpenCCTV fetch failed:', e.message);
    return { cameras: [], label: 'OpenCCTV/0' };
  }
}


interface TflPlace {
  id: string;
  commonName: string;
  lat: number;
  lon: number;
  additionalProperties: Array<{ key: string; value: string }>;
}

function transformTflJamCams(places: TflPlace[]): CameraDataEx[] {
  return places.map((place, i) => {
    const props = Object.fromEntries(
      place.additionalProperties?.map(p => [p.key, p.value]) ?? []
    );
    const imageUrl = props['imageUrl'] || '';
    const videoUrl = props['videoUrl'] || '';
    const primaryUrl = imageUrl || videoUrl;
    const { snapshotUrl, streamUrl } = classifyUrl(primaryUrl);
    const streamType = detectStreamType(primaryUrl);

    return {
      id: `TFL-${place.id || i}`,
      ip: `10.${(Math.abs(Math.round(place.lat * 100)) % 256)}.${(Math.abs(Math.round(place.lon * 100)) % 256)}.${(i % 254) + 1}`,
      lat: place.lat,
      lng: place.lon,
      location: place.commonName || 'London, UK',
      type: 'Traffic Cam',
      status: primaryUrl ? 'online' as const : 'offline' as const,
      port: 443,
      lastSeen: new Date().toISOString(),
      name: place.commonName || undefined,
      city: 'London',
      country: 'United Kingdom',
      snapshotUrl: snapshotUrl || imageUrl || undefined,
      streamUrl: streamUrl || videoUrl || undefined,
      source: 'TfL/JamCam',
      streamType,
    };
  }).filter(c =>
    typeof c.lat === 'number' && typeof c.lng === 'number' &&
    c.lat >= -90 && c.lat <= 90 && c.lng >= -180 && c.lng <= 180
  );
}

async function fetchTflJamCams(): Promise<{ cameras: CameraDataEx[]; label: string }> {
  try {
    const data = await stealthFetchJSON<TflPlace[]>('https://api.tfl.gov.uk/Place/Type/JamCam', {
      timeout: 12000,
      retries: 1,
    });
    const cameras = transformTflJamCams(Array.isArray(data) ? data : []);
    return { cameras, label: `TfL/${cameras.length}` };
  } catch (e: any) {
    console.error('[Cameras] TfL JamCams fetch failed:', e.message);
    return { cameras: [], label: 'TfL/0' };
  }
}

interface WsdotCamera {
  CameraID: number;
  CameraName: string;
  Latitude: number;
  Longitude: number;
  ImageURL: string;
  VideoURL?: string;
}

function transformWsdot(cameras: WsdotCamera[]): CameraDataEx[] {
  return cameras.map((cam, i) => {
    const imageUrl = cam.ImageURL || '';
    const videoUrl = cam.VideoURL || '';
    const primaryUrl = imageUrl || videoUrl;
    const { snapshotUrl, streamUrl } = classifyUrl(primaryUrl);

    return {
      id: `WSDOT-${cam.CameraID || i}`,
      ip: `10.${(Math.abs(Math.round(cam.Latitude * 100)) % 256)}.${(Math.abs(Math.round(cam.Longitude * 100)) % 256)}.${(i % 254) + 1}`,
      lat: cam.Latitude,
      lng: cam.Longitude,
      location: cam.CameraName || 'Washington, US',
      type: 'Traffic Cam',
      status: primaryUrl ? 'online' as const : 'offline' as const,
      port: 443,
      lastSeen: new Date().toISOString(),
      name: cam.CameraName || undefined,
      city: 'Washington',
      country: 'United States',
      snapshotUrl: snapshotUrl || imageUrl || undefined,
      streamUrl: streamUrl || videoUrl || undefined,
      source: 'WSDOT',
      streamType: detectStreamType(primaryUrl),
    };
  }).filter(c =>
    typeof c.lat === 'number' && typeof c.lng === 'number' &&
    c.lat >= -90 && c.lat <= 90 && c.lng >= -180 && c.lng <= 180
  );
}

async function fetchWsdot(): Promise<{ cameras: CameraDataEx[]; label: string }> {
  try {
    const data = await stealthFetchJSON<WsdotCamera[]>('https://data.wsdot.wa.gov/log/public/cameras.json', {
      timeout: 12000,
      retries: 1,
    });
    const cameras = transformWsdot(Array.isArray(data) ? data : []);
    return { cameras, label: `WSDOT/${cameras.length}` };
  } catch (e: any) {
    console.error('[Cameras] WSDOT fetch failed:', e.message);
    return { cameras: [], label: 'WSDOT/0' };
  }
}

interface CaltransCctvItem {
  cctv: {
    index: string;
    location: {
      latitude: string | number;
      longitude: string | number;
      nearbyPlace?: string;
      direction?: string;
    };
    imageData?: {
      streamPath?: string;
      imageUrl?: string;
      streamingVideoUrl?: string;
    };
    isInOperableCondition?: string;
  };
}

interface CaltransResponse {
  data: CaltransCctvItem[];
}

function transformCaltrans(items: CaltransCctvItem[], district: number): CameraDataEx[] {
  return items.map((item, i) => {
    const cctv = item.cctv || {};
    const lat = typeof cctv.location?.latitude === 'string' ? parseFloat(cctv.location.latitude) : (cctv.location?.latitude ?? 0);
    const lng = typeof cctv.location?.longitude === 'string' ? parseFloat(cctv.location.longitude) : (cctv.location?.longitude ?? 0);
    const imageUrl = cctv.imageData?.imageUrl || '';
    const streamUrl = cctv.imageData?.streamingVideoUrl || cctv.imageData?.streamPath || '';
    const primaryUrl = imageUrl || streamUrl;
    const { snapshotUrl, streamUrl: classifiedStream } = classifyUrl(primaryUrl);
    const nearby = cctv.location?.nearbyPlace || '';

    return {
      id: `CALTRANS-D${district}-${cctv.index || i}`,
      ip: `10.${(Math.abs(Math.round(lat * 100)) % 256)}.${(Math.abs(Math.round(lng * 100)) % 256)}.${(i % 254) + 1}`,
      lat,
      lng,
      location: nearby ? `${nearby}, CA District ${district}` : `California District ${district}`,
      type: 'Traffic Cam',
      status: cctv.isInOperableCondition === 'true' ? 'online' as const : (primaryUrl ? 'online' as const : 'offline' as const),
      port: 443,
      lastSeen: new Date().toISOString(),
      name: nearby || `Caltrans D${district} Cam ${i}`,
      city: nearby || undefined,
      country: 'United States',
      snapshotUrl: snapshotUrl || imageUrl || undefined,
      streamUrl: classifiedStream || streamUrl || undefined,
      source: `Caltrans/D${district}`,
      streamType: detectStreamType(primaryUrl),
    };
  }).filter(c =>
    typeof c.lat === 'number' && typeof c.lng === 'number' &&
    c.lat >= -90 && c.lat <= 90 && c.lng >= -180 && c.lng <= 180 &&
    c.lat !== 0 && c.lng !== 0
  );
}

async function fetchCaltransDistrict(district: number): Promise<{ cameras: CameraDataEx[]; label: string }> {
  try {
    const dStr = district.toString().padStart(2, '0');
    const url = `https://cwwp2.dot.ca.gov/data/d${dStr}/cctv/cctvStatus${district}.json`;
    const data = await stealthFetchJSON<CaltransResponse>(url, {
      timeout: 10000,
      retries: 1,
    });
    const items = Array.isArray(data?.data) ? data.data : [];
    const cameras = transformCaltrans(items, district);
    return { cameras, label: `Caltrans-D${district}/${cameras.length}` };
  } catch (e: any) {
    console.error(`[Cameras] Caltrans D${district} fetch failed:`, e.message);
    return { cameras: [], label: `Caltrans-D${district}/0` };
  }
}

async function fetchAllCaltrans(): Promise<{ cameras: CameraDataEx[]; label: string }> {
  const districts = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  const results = await Promise.allSettled(districts.map(d => fetchCaltransDistrict(d)));

  const allCameras: CameraDataEx[] = [];
  let totalSource = 0;

  for (const result of results) {
    if (result.status === 'fulfilled') {
      allCameras.push(...result.value.cameras);
      totalSource += result.value.cameras.length;
    }
  }

  return { cameras: allCameras, label: `Caltrans/${totalSource}` };
}

interface SgCamera {
  camera_id: string;
  location: {
    latitude: number;
    longitude: number;
  };
  image: string;
  image_metadata?: {
    height?: number;
    width?: number;
    md5?: string;
  };
}

interface SgResponse {
  items: Array<{
    cameras: SgCamera[];
    timestamp: string;
  }>;
}

function transformSingapore(data: SgResponse): CameraDataEx[] {
  const cameras = data?.items?.[0]?.cameras || [];
  return cameras.map((cam, i) => {
    const imageUrl = cam.image || '';
    const { snapshotUrl, streamUrl } = classifyUrl(imageUrl);

    return {
      id: `SG-LTA-${cam.camera_id || i}`,
      ip: `10.${(Math.abs(Math.round(cam.location.latitude * 100)) % 256)}.${(Math.abs(Math.round(cam.location.longitude * 100)) % 256)}.${(i % 254) + 1}`,
      lat: cam.location.latitude,
      lng: cam.location.longitude,
      location: `Traffic Cam ${cam.camera_id}, Singapore`,
      type: 'Traffic Cam',
      status: imageUrl ? 'online' as const : 'offline' as const,
      port: 443,
      lastSeen: new Date().toISOString(),
      name: `LTA Cam ${cam.camera_id}`,
      city: 'Singapore',
      country: 'Singapore',
      snapshotUrl: snapshotUrl || imageUrl || undefined,
      streamUrl: streamUrl || undefined,
      source: 'LTA/Singapore',
      streamType: detectStreamType(imageUrl),
    };
  }).filter(c =>
    typeof c.lat === 'number' && typeof c.lng === 'number' &&
    c.lat >= -90 && c.lat <= 90 && c.lng >= -180 && c.lng <= 180
  );
}

async function fetchSingapore(): Promise<{ cameras: CameraDataEx[]; label: string }> {
  try {
    const data = await stealthFetchJSON<SgResponse>('https://api.data.gov.sg/v1/transport/traffic-images', {
      timeout: 10000,
      retries: 1,
    });
    const cameras = transformSingapore(data);
    return { cameras, label: `LTA-SG/${cameras.length}` };
  } catch (e: any) {
    console.error('[Cameras] Singapore LTA fetch failed:', e.message);
    return { cameras: [], label: 'LTA-SG/0' };
  }
}

interface NdwCamera {
  id?: string;
  name?: string;
  location?: string;
  latitude?: number;
  longitude?: number;
  lat?: number;
  lng?: number;
  URL?: string;
  url?: string;
  imageUrl?: string;
  streamUrl?: string;
  type?: string;
  status?: string;
}

function transformNetherlands(cameras: NdwCamera[]): CameraDataEx[] {
  return cameras.map((cam, i) => {
    const lat = cam.latitude || cam.lat || 0;
    const lng = cam.longitude || cam.lng || 0;
    const imageUrl = cam.imageUrl || cam.URL || cam.url || '';
    const videoUrl = cam.streamUrl || '';
    const primaryUrl = imageUrl || videoUrl;
    const { snapshotUrl, streamUrl } = classifyUrl(primaryUrl);

    return {
      id: `NDW-${cam.id || i}`,
      ip: `10.${(Math.abs(Math.round(lat * 100)) % 256)}.${(Math.abs(Math.round(lng * 100)) % 256)}.${(i % 254) + 1}`,
      lat,
      lng,
      location: cam.name || cam.location || 'Netherlands',
      type: 'Traffic Cam',
      status: primaryUrl ? 'online' as const : 'offline' as const,
      port: 443,
      lastSeen: new Date().toISOString(),
      name: cam.name || undefined,
      city: undefined,
      country: 'Netherlands',
      snapshotUrl: snapshotUrl || imageUrl || undefined,
      streamUrl: streamUrl || videoUrl || undefined,
      source: 'RWS/NDW',
      streamType: detectStreamType(primaryUrl),
    };
  }).filter(c =>
    typeof c.lat === 'number' && typeof c.lng === 'number' &&
    c.lat >= -90 && c.lat <= 90 && c.lng >= -180 && c.lng <= 180 &&
    c.lat !== 0 && c.lng !== 0
  );
}

async function fetchNetherlands(): Promise<{ cameras: CameraDataEx[]; label: string }> {
  try {
    const data = await stealthFetchJSON<NdwCamera[]>('https://opendata.ndw.nu/cameras.json', {
      timeout: 12000,
      retries: 1,
    });
    const cameras = transformNetherlands(Array.isArray(data) ? data : []);
    return { cameras, label: `RWS/${cameras.length}` };
  } catch (e: any) {
    console.error('[Cameras] Netherlands RWS fetch failed:', e.message);
    return { cameras: [], label: 'RWS/0' };
  }
}

interface Ontario511Camera {
  id: string | number;
  name?: string;
  latitude?: number;
  longitude?: number;
  imageUrl?: string;
  videoUrl?: string;
  url?: string;
  status?: string;
}

function transformOntario511(cameras: Ontario511Camera[]): CameraDataEx[] {
  return cameras.map((cam, i) => {
    const lat = cam.latitude || 0;
    const lng = cam.longitude || 0;
    const imageUrl = cam.imageUrl || cam.url || '';
    const videoUrl = cam.videoUrl || '';
    const primaryUrl = imageUrl || videoUrl;
    const { snapshotUrl, streamUrl } = classifyUrl(primaryUrl);

    return {
      id: `ON511-${cam.id || i}`,
      ip: `10.${(Math.abs(Math.round(lat * 100)) % 256)}.${(Math.abs(Math.round(lng * 100)) % 256)}.${(i % 254) + 1}`,
      lat,
      lng,
      location: cam.name || 'Ontario, Canada',
      type: 'Traffic Cam',
      status: cam.status === 'Disabled' ? 'offline' as const : (primaryUrl ? 'online' as const : 'offline' as const),
      port: 443,
      lastSeen: new Date().toISOString(),
      name: cam.name || undefined,
      city: 'Ontario',
      country: 'Canada',
      snapshotUrl: snapshotUrl || imageUrl || undefined,
      streamUrl: streamUrl || videoUrl || undefined,
      source: 'Ontario511',
      streamType: detectStreamType(primaryUrl),
    };
  }).filter(c =>
    typeof c.lat === 'number' && typeof c.lng === 'number' &&
    c.lat >= -90 && c.lat <= 90 && c.lng >= -180 && c.lng <= 180 &&
    c.lat !== 0 && c.lng !== 0
  );
}

async function fetchOntario511(): Promise<{ cameras: CameraDataEx[]; label: string }> {
  try {
    const data = await stealthFetchJSON<Ontario511Camera[]>('https://511on.ca/api/v2/get/cameras', {
      timeout: 12000,
      retries: 1,
    });
    const cameras = transformOntario511(Array.isArray(data) ? data : []);
    return { cameras, label: `ON511/${cameras.length}` };
  } catch (e: any) {
    console.error('[Cameras] Ontario 511 fetch failed:', e.message);
    return { cameras: [], label: 'ON511/0' };
  }
}

interface Alberta511Camera {
  id: string | number;
  name?: string;
  latitude?: number;
  longitude?: number;
  imageUrl?: string;
  videoUrl?: string;
  url?: string;
  status?: string;
}

function transformAlberta511(cameras: Alberta511Camera[]): CameraDataEx[] {
  return cameras.map((cam, i) => {
    const lat = cam.latitude || 0;
    const lng = cam.longitude || 0;
    const imageUrl = cam.imageUrl || cam.url || '';
    const videoUrl = cam.videoUrl || '';
    const primaryUrl = imageUrl || videoUrl;
    const { snapshotUrl, streamUrl } = classifyUrl(primaryUrl);

    return {
      id: `AB511-${cam.id || i}`,
      ip: `10.${(Math.abs(Math.round(lat * 100)) % 256)}.${(Math.abs(Math.round(lng * 100)) % 256)}.${(i % 254) + 1}`,
      lat,
      lng,
      location: cam.name || 'Alberta, Canada',
      type: 'Traffic Cam',
      status: cam.status === 'Disabled' ? 'offline' as const : (primaryUrl ? 'online' as const : 'offline' as const),
      port: 443,
      lastSeen: new Date().toISOString(),
      name: cam.name || undefined,
      city: 'Alberta',
      country: 'Canada',
      snapshotUrl: snapshotUrl || imageUrl || undefined,
      streamUrl: streamUrl || videoUrl || undefined,
      source: 'Alberta511',
      streamType: detectStreamType(primaryUrl),
    };
  }).filter(c =>
    typeof c.lat === 'number' && typeof c.lng === 'number' &&
    c.lat >= -90 && c.lat <= 90 && c.lng >= -180 && c.lng <= 180 &&
    c.lat !== 0 && c.lng !== 0
  );
}

async function fetchAlberta511(): Promise<{ cameras: CameraDataEx[]; label: string }> {
  try {
    const data = await stealthFetchJSON<Alberta511Camera[]>('https://511.alberta.ca/api/v2/get/cameras', {
      timeout: 12000,
      retries: 1,
    });
    const cameras = transformAlberta511(Array.isArray(data) ? data : []);
    return { cameras, label: `AB511/${cameras.length}` };
  } catch (e: any) {
    console.error('[Cameras] Alberta 511 fetch failed:', e.message);
    return { cameras: [], label: 'AB511/0' };
  }
}


interface OsirisCamera {
  id: string;
  name: string;
  lat: number;
  lng: number;
  city: string;
  country: string;
  region: string;
  source: string;
  url: string;
  type: string;
  status: string;
}

function transformOsirisCamera(cam: OsirisCamera, index: number): CameraDataEx {
  const { snapshotUrl, streamUrl } = classifyUrl(cam.url || '');
  const locationParts = [cam.name, cam.city, cam.country].filter(Boolean);
  const location = locationParts.length > 0 ? locationParts.join(', ') : 'Unknown Location';
  const primaryUrl = cam.url || '';

  return {
    id: `OSIRIS-${cam.source}-${cam.id || index}`,
    ip: `10.${(Math.abs(Math.round(cam.lat * 100)) % 256)}.${(Math.abs(Math.round(cam.lng * 100)) % 256)}.${(index % 254) + 1}`,
    lat: cam.lat,
    lng: cam.lng,
    location,
    type: mapSourceType(cam.source || cam.type || ''),
    status: mapStatus(cam.status || 'online'),
    port: 80,
    lastSeen: new Date().toISOString(),
    name: cam.name || undefined,
    city: cam.city || undefined,
    country: cam.country || undefined,
    snapshotUrl: snapshotUrl || undefined,
    streamUrl: streamUrl || undefined,
    source: `OSIRIS/${cam.source || 'Unknown'}`,
    streamType: detectStreamType(primaryUrl),
  };
}

async function fetchOsiris(): Promise<{ cameras: CameraDataEx[]; label: string }> {
  try {
    const data = await stealthFetchJSON<{ cameras: OsirisCamera[] }>(
      'https://osirisai.live/api/cctv?region=all&v=2',
      { timeout: 15000, retries: 1 }
    );

    if (data?.cameras && Array.isArray(data.cameras) && data.cameras.length > 0) {
      const cameras = data.cameras
        .map((cam: OsirisCamera, idx: number) => transformOsirisCamera(cam, idx))
        .filter((c: CameraDataEx) =>
          typeof c.lat === 'number' && typeof c.lng === 'number' &&
          c.lat >= -90 && c.lat <= 90 && c.lng >= -180 && c.lng <= 180
        );
      return { cameras, label: `OSIRIS/${cameras.length}` };
    }

    return { cameras: [], label: 'OSIRIS/0' };
  } catch (e: any) {
    console.error('[Cameras] OSIRIS fetch failed:', e.message);
    return { cameras: [], label: 'OSIRIS/0' };
  }
}


const YOUTUBE_LIVE_WEBCAMS: CameraDataEx[] = [
  {
    id: 'YT-NYC-001', ip: '10.0.10.1', lat: 40.758, lng: -73.9855,
    location: 'Times Square, New York, US', type: 'City Cam', status: 'online', port: 443,
    lastSeen: '', name: 'Times Square Live', city: 'New York', country: 'United States',
    streamUrl: 'https://www.youtube.com/embed/8SzLIWU4fbQ?autoplay=1&mute=1',
    source: 'YouTube/Live', streamType: 'iframe',
  },
  {
    id: 'YT-TKY-001', ip: '10.0.10.2', lat: 35.6595, lng: 139.7004,
    location: 'Shibuya Crossing, Tokyo, Japan', type: 'City Cam', status: 'online', port: 443,
    lastSeen: '', name: 'Shibuya Crossing Live', city: 'Tokyo', country: 'Japan',
    streamUrl: 'https://www.youtube.com/embed/nKE0w0B0qt4?autoplay=1&mute=1',
    source: 'YouTube/Live', streamType: 'iframe',
  },
  {
    id: 'YT-LON-001', ip: '10.0.10.3', lat: 51.5074, lng: -0.1278,
    location: 'River Thames, London, UK', type: 'City Cam', status: 'online', port: 443,
    lastSeen: '', name: 'London Thames Live', city: 'London', country: 'United Kingdom',
    streamUrl: 'https://www.youtube.com/embed/4xDzrJKXOOY?autoplay=1&mute=1',
    source: 'YouTube/Live', streamType: 'iframe',
  },
  {
    id: 'YT-PAR-001', ip: '10.0.10.4', lat: 48.8584, lng: 2.2945,
    location: 'Eiffel Tower, Paris, France', type: 'Landmark Cam', status: 'online', port: 443,
    lastSeen: '', name: 'Eiffel Tower Live', city: 'Paris', country: 'France',
    streamUrl: 'https://www.youtube.com/embed/JE3IdwGoBpA?autoplay=1&mute=1',
    source: 'YouTube/Live', streamType: 'iframe',
  },
  {
    id: 'YT-DXB-001', ip: '10.0.10.5', lat: 25.0805, lng: 55.1403,
    location: 'Dubai Marina, Dubai, UAE', type: 'Harbor Cam', status: 'online', port: 443,
    lastSeen: '', name: 'Dubai Marina Live', city: 'Dubai', country: 'UAE',
    streamUrl: 'https://www.youtube.com/embed/ZkXh3vYfzS4?autoplay=1&mute=1',
    source: 'YouTube/Live', streamType: 'iframe',
  },
  {
    id: 'YT-AMS-001', ip: '10.0.10.6', lat: 52.3731, lng: 4.8922,
    location: 'Dam Square, Amsterdam, Netherlands', type: 'City Cam', status: 'online', port: 443,
    lastSeen: '', name: 'Amsterdam Dam Square Live', city: 'Amsterdam', country: 'Netherlands',
    streamUrl: 'https://www.youtube.com/embed/3HnN3zmM1Sg?autoplay=1&mute=1',
    source: 'YouTube/Live', streamType: 'iframe',
  },
  {
    id: 'YT-BKK-001', ip: '10.0.10.7', lat: 13.7583, lng: 100.4975,
    location: 'Khaosan Road, Bangkok, Thailand', type: 'City Cam', status: 'online', port: 443,
    lastSeen: '', name: 'Bangkok Khaosan Road Live', city: 'Bangkok', country: 'Thailand',
    streamUrl: 'https://www.youtube.com/embed/NCXhrzNj4z0?autoplay=1&mute=1',
    source: 'YouTube/Live', streamType: 'iframe',
  },
  {
    id: 'YT-SEL-001', ip: '10.0.10.8', lat: 37.4979, lng: 127.0276,
    location: 'Gangnam District, Seoul, South Korea', type: 'City Cam', status: 'online', port: 443,
    lastSeen: '', name: 'Seoul Gangnam Live', city: 'Seoul', country: 'South Korea',
    streamUrl: 'https://www.youtube.com/embed/5F3n58YnDZY?autoplay=1&mute=1',
    source: 'YouTube/Live', streamType: 'iframe',
  },
  {
    id: 'YT-LVS-001', ip: '10.0.10.9', lat: 36.1162, lng: -115.1745,
    location: 'Las Vegas Strip, Las Vegas, US', type: 'City Cam', status: 'online', port: 443,
    lastSeen: '', name: 'Las Vegas Strip Live', city: 'Las Vegas', country: 'United States',
    streamUrl: 'https://www.youtube.com/embed/fMfipiV_17o?autoplay=1&mute=1',
    source: 'YouTube/Live', streamType: 'iframe',
  },
  {
    id: 'YT-SYD-001', ip: '10.0.10.10', lat: -33.8523, lng: 151.2108,
    location: 'Sydney Harbour, Sydney, Australia', type: 'Harbor Cam', status: 'online', port: 443,
    lastSeen: '', name: 'Sydney Harbour Live', city: 'Sydney', country: 'Australia',
    streamUrl: 'https://www.youtube.com/embed/3HwXzH5Rn0E?autoplay=1&mute=1',
    source: 'YouTube/Live', streamType: 'iframe',
  },
  {
    id: 'YT-MIA-001', ip: '10.0.10.11', lat: 25.7907, lng: -80.13,
    location: 'Miami Beach, Miami, US', type: 'Beach Cam', status: 'online', port: 443,
    lastSeen: '', name: 'Miami Beach Live', city: 'Miami', country: 'United States',
    streamUrl: 'https://www.youtube.com/embed/fzTl3FjMLYI?autoplay=1&mute=1',
    source: 'YouTube/Live', streamType: 'iframe',
  },
  {
    id: 'YT-HKG-001', ip: '10.0.10.12', lat: 22.2951, lng: 114.1721,
    location: 'Victoria Harbour, Hong Kong', type: 'Harbor Cam', status: 'online', port: 443,
    lastSeen: '', name: 'Victoria Harbour Live', city: 'Hong Kong', country: 'Hong Kong',
    streamUrl: 'https://www.youtube.com/embed/bF9DTmYOkWI?autoplay=1&mute=1',
    source: 'YouTube/Live', streamType: 'iframe',
  },
  {
    id: 'YT-RKV-001', ip: '10.0.10.13', lat: 64.1466, lng: -21.9426,
    location: 'Reykjavik, Iceland', type: 'City Cam', status: 'online', port: 443,
    lastSeen: '', name: 'Reykjavik Live', city: 'Reykjavik', country: 'Iceland',
    streamUrl: 'https://www.youtube.com/embed/GCgFnL0QDfM?autoplay=1&mute=1',
    source: 'YouTube/Live', streamType: 'iframe',
  },
  {
    id: 'YT-RIO-001', ip: '10.0.10.14', lat: -22.9711, lng: -43.1822,
    location: 'Copacabana Beach, Rio de Janeiro, Brazil', type: 'Beach Cam', status: 'online', port: 443,
    lastSeen: '', name: 'Copacabana Live', city: 'Rio de Janeiro', country: 'Brazil',
    streamUrl: 'https://www.youtube.com/embed/9WvmjOKFxfY?autoplay=1&mute=1',
    source: 'YouTube/Live', streamType: 'iframe',
  },
  {
    id: 'YT-PRG-001', ip: '10.0.10.15', lat: 50.0874, lng: 14.4212,
    location: 'Old Town Square, Prague, Czech Republic', type: 'City Cam', status: 'online', port: 443,
    lastSeen: '', name: 'Prague Old Town Live', city: 'Prague', country: 'Czech Republic',
    streamUrl: 'https://www.youtube.com/embed/bu0KXNOJjXY?autoplay=1&mute=1',
    source: 'YouTube/Live', streamType: 'iframe',
  },
].map(wc => ({
  ...wc,
  streamUrl: wc.streamUrl
    ? wc.streamUrl
        .replace('www.youtube.com/embed/', 'www.youtube-nocookie.com/embed/')
        .replace('youtube.com/embed/', 'www.youtube-nocookie.com/embed/')
    : wc.streamUrl,
  lastSeen: new Date(Date.now() - Math.random() * 3600000).toISOString(),
})) as CameraDataEx[];


function getFallbackCameras(): CameraDataEx[] {
  const cities = [
    { name: 'Tokyo', lat: 35.6762, lng: 139.6503, country: 'Japan' },
    { name: 'London', lat: 51.5074, lng: -0.1278, country: 'UK' },
    { name: 'New York', lat: 40.7128, lng: -74.006, country: 'US' },
    { name: 'Paris', lat: 48.8566, lng: 2.3522, country: 'France' },
    { name: 'Sydney', lat: -33.8688, lng: 151.2093, country: 'Australia' },
    { name: 'Dubai', lat: 25.2048, lng: 55.2708, country: 'UAE' },
    { name: 'Singapore', lat: 1.3521, lng: 103.8198, country: 'Singapore' },
    { name: 'Seoul', lat: 37.5665, lng: 126.978, country: 'South Korea' },
    { name: 'Berlin', lat: 52.52, lng: 13.405, country: 'Germany' },
    { name: 'Mumbai', lat: 19.076, lng: 72.8777, country: 'India' },
    { name: 'Istanbul', lat: 41.0082, lng: 28.9784, country: 'Turkey' },
    { name: 'Cairo', lat: 30.0444, lng: 31.2357, country: 'Egypt' },
    { name: 'Bangkok', lat: 13.7563, lng: 100.5018, country: 'Thailand' },
    { name: 'Beijing', lat: 39.9042, lng: 116.4074, country: 'China' },
    { name: 'Los Angeles', lat: 34.0522, lng: -118.2437, country: 'US' },
    { name: 'Amsterdam', lat: 52.3676, lng: 4.9041, country: 'Netherlands' },
    { name: 'Hong Kong', lat: 22.3193, lng: 114.1694, country: 'Hong Kong' },
    { name: 'Chicago', lat: 41.8781, lng: -87.6298, country: 'US' },
    { name: 'Toronto', lat: 43.6532, lng: -79.3832, country: 'Canada' },
    { name: 'São Paulo', lat: -23.5505, lng: -46.6333, country: 'Brazil' },
  ];
  const types = ['IP Camera', 'Webcam', 'PTZ Camera', 'Dome Camera', 'Bullet Camera'];
  const locations = ['Harbor View', 'City Center', 'Airport Terminal', 'Highway', 'Train Station', 'Parking Lot', 'Bridge', 'Park', 'Weather Station', 'Traffic Monitor'];

  return cities.map((city, i) => ({
    id: `CAM-${String(i + 1).padStart(4, '0')}`,
    ip: `${Math.floor(Math.random() * 223) + 1}.${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}`,
    lat: city.lat + (Math.random() - 0.5) * 0.5,
    lng: city.lng + (Math.random() - 0.5) * 0.5,
    location: `${locations[i % locations.length]}, ${city.name}`,
    type: types[i % types.length],
    status: Math.random() > 0.15 ? 'online' as const : 'offline' as const,
    port: [80, 443, 554, 8080, 8554][i % 5],
    lastSeen: new Date(Date.now() - Math.random() * 3600000).toISOString(),
    source: 'Fallback',
    streamType: 'jpg' as StreamType,
  }));
}


export async function GET(request: Request) {
  try {
    const forceFresh = new URL(request.url).searchParams.get('fresh') === '1';
    if (!forceFresh && cachedData && Date.now() - cachedData.time < CACHE_TTL) {
      return NextResponse.json({
        source: `Merged OSINT Feed (cached) · ${cachedData.sources.join(' + ')}`,
        timestamp: cachedData.time,
        count: cachedData.data.length,
        cameras: cachedData.data,
      });
    }

    const sources: string[] = [];
    const allCameras: CameraDataEx[] = [];

    try {
      const openCctvResult = await fetchOpenCctv();
      if (openCctvResult.cameras.length > 0) {
        const sampled = openCctvResult.cameras.length > 220
          ? shuffleArray(openCctvResult.cameras).slice(0, 220)
          : openCctvResult.cameras;
        allCameras.push(...sampled);
        sources.push(openCctvResult.label);
      }
    } catch (e: any) {
      console.error('[Cameras] OpenCCTV phase failed:', e.message);
    }

    const primaryResults = await Promise.allSettled([
      fetchTflJamCams(),
      fetchWsdot(),
      fetchAllCaltrans(),
      fetchSingapore(),
      fetchNetherlands(),
      fetchOntario511(),
      fetchAlberta511(),
    ]);

    for (const result of primaryResults) {
      if (result.status === 'fulfilled' && result.value.cameras.length > 0) {
        allCameras.push(...result.value.cameras);
        sources.push(result.value.label);
      } else if (result.status === 'rejected') {
        console.error('[Cameras] Primary source rejected:', result.reason?.message || result.reason);
      }
    }

    try {
      const osirisResult = await fetchOsiris();
      if (osirisResult.cameras.length > 0) {
        const sampled = osirisResult.cameras.length > 60
          ? shuffleArray(osirisResult.cameras).slice(0, 60)
          : osirisResult.cameras;
        allCameras.push(...sampled);
        sources.push(osirisResult.label);
      }
    } catch (e: any) {
      console.error('[Cameras] OSIRIS phase failed:', e.message);
    }

    allCameras.push(...YOUTUBE_LIVE_WEBCAMS);
    if (YOUTUBE_LIVE_WEBCAMS.length > 0) {
      sources.push(`YouTube-Live/${YOUTUBE_LIVE_WEBCAMS.length}`);
    }

    const HLS_LIVE_CAMS: CameraDataEx[] = HLS_IPCAMS.map((c, i) => ({
      id: c.id,
      ip: `10.0.30.${i + 1}`,
      lat: c.lat,
      lng: c.lng,
      location: `${c.city}, ${c.country}`,
      type: c.type,
      status: 'online' as const,
      port: 443,
      lastSeen: '',
      name: c.name,
      city: c.city,
      country: c.country,
      streamUrl: c.url,
      source: `IP-CAM-HLS/${c.operator}`,
      streamType: 'hls',
    }));
    allCameras.push(...HLS_LIVE_CAMS);
    if (HLS_LIVE_CAMS.length > 0) {
      sources.push(`IP-CAM-HLS/${HLS_LIVE_CAMS.length}`);
    }

    const deduped = deduplicateCameras(allCameras);

    const finalCameras = deduped.length > MAX_CAMERAS
      ? shuffleArray(deduped).slice(0, MAX_CAMERAS)
      : deduped;

    if (finalCameras.length > 0) {
      cachedData = { time: Date.now(), data: finalCameras, sources };

      return NextResponse.json({
        source: `Merged OSINT Feed · ${sources.join(' + ')}`,
        timestamp: cachedData.time,
        count: finalCameras.length,
        cameras: finalCameras,
      });
    }

    const fallback = getFallbackCameras();
    cachedData = { time: Date.now(), data: fallback, sources: ['Fallback'] };

    return NextResponse.json({
      source: 'OSINT Device Intelligence (pattern-based fallback)',
      timestamp: Date.now(),
      count: fallback.length,
      cameras: fallback,
    });
  } catch (error: any) {
    console.error('[Cameras] Route error:', error.message);

    const fallback = getFallbackCameras();
    return NextResponse.json({
      source: 'OSINT Device Intelligence (error fallback)',
      timestamp: Date.now(),
      count: fallback.length,
      cameras: fallback,
      error: error.message,
    });
  }
}
