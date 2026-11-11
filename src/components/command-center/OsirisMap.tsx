'use client';

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { GlobePoint, GlobeArc, PointType } from '@/lib/osint-data';
import { Search, X, Navigation, Layers, MapPin, ChevronDown, Flag, Plus, Minus, LocateFixed } from 'lucide-react';

export interface POIItem {
  id: number;
  lat: number;
  lng: number;
  category: string;
  icon: string;
  color: string;
  name: string | null;
  isLandmark?: boolean;
  tags: Record<string, string | null>;
  address: Record<string, string | null>;
}

export interface CoverageTower {
  id: string;
  operator: string;
  lat: number;
  lng: number;
  type: string;
  power: number;
  range: number;
  frequency: string;
  status: 'active' | 'maintenance';
  distance: number;
  signalAtCenter: number;
  signalQuality: { quality: string; color: string; label: string };
}

interface MapBounds {
  north: number;
  south: number;
  east: number;
  west: number;
  centerLat: number;
  centerLng: number;
  zoom: number;
}

interface OsirisMapProps {
  points: GlobePoint[];
  arcs: GlobeArc[];
  onPointClick?: (point: GlobePoint) => void;
  onMouseCoords?: (coords: { lat: number; lng: number }) => void;
  onBoundsChanged?: (bounds: MapBounds) => void;
  activePanel?: string;
  trackedPoint?: GlobePoint | null;
  lockedPoint?: GlobePoint | null;
  pois?: POIItem[];
  onPoiClick?: (poi: POIItem) => void;
  coverageTowers?: CoverageTower[];
  showCoverage?: boolean;
  coverageOpacity?: number;
  onTowerClick?: (tower: CoverageTower) => void;
}

const CATEGORY_STYLES: Record<string, { color: string; size: number; icon: string }> = {
  camera: { color: '#00ff88', size: 8, icon: '\uf030' },
  flight: { color: '#00ccff', size: 7, icon: '\uf072' },
  cable: { color: '#cc66ff', size: 7, icon: '\uf796' },
  ship: { color: '#ff66ff', size: 7, icon: '\uf21a' },
  antenna: { color: '#ffaa00', size: 7, icon: '\uf519' },
  ip: { color: '#00eeff', size: 8, icon: '\uf3c5' },
  military: { color: '#ff3333', size: 9, icon: '\uf024' },
  earthquake: { color: '#ff6600', size: 8, icon: '\uf0e7' },
  cyber: { color: '#ff0066', size: 7, icon: '\uf3ed' },
  outage: { color: '#ff9900', size: 7, icon: '\uf071' },
  fire: { color: '#ff4400', size: 8, icon: '\uf06d' },
  satellite: { color: '#6699ff', size: 6, icon: '\uf7c0' },
  gdelt: { color: '#ff3366', size: 7, icon: '\uf0e7' },
  fofa: { color: '#ff00cc', size: 7, icon: '\uf2db' },
};

const MAP_STYLE = {
  version: 8 as const,
  name: 'OSINT Dark Command',
  sources: {
    'satellite': {
      type: 'raster' as const,
      tiles: [
        'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',
        'https://mt2.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',
        'https://mt3.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',
        'https://mt0.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',
      ],
      tileSize: 256,
      maxzoom: 20,
      attribution: 'Imagery © Google',
      volatile: false,
    },
  },
  layers: [
    {
      id: 'satellite-layer',
      type: 'raster' as const,
      source: 'satellite',
      paint: {
        'raster-brightness-max': 0.75,
        'raster-saturation': -0.25,
        'raster-contrast': 0.15,
        'raster-opacity': 0.95,
      },
    },
  ],
};

if (typeof window !== 'undefined') {
  const hosts = [
    'https://mt1.google.com',
    'https://basemaps.cartocdn.com',
  ];
  for (const host of hosts) {
    const link = document.createElement('link');
    link.rel = 'preconnect';
    link.href = host;
    link.crossOrigin = 'anonymous';
    document.head.appendChild(link);
  }
  for (const host of hosts) {
    const link = document.createElement('link');
    link.rel = 'dns-prefetch';
    link.href = host;
    document.head.appendChild(link);
  }
}

function warmUpTiles() {
  if (typeof window === 'undefined') return;
  if ((window as any).__horusTilesWarmed) return;
  (window as any).__horusTilesWarmed = true;

  const warmUrls = [
    'https://mt1.google.com/vt/lyrs=y&x=1&y=1&z=2',
    'https://mt2.google.com/vt/lyrs=y&x=2&y=1&z=2',
    'https://mt3.google.com/vt/lyrs=y&x=1&y=2&z=2',
    'https://mt0.google.com/vt/lyrs=y&x=2&y=2&z=2',
  ];
  for (const url of warmUrls) {
    fetch(url, { mode: 'cors', cache: 'force-cache' }).catch(() => {});
  }
}
if (typeof window !== 'undefined') {
  if (document.readyState === 'complete') {
    warmUpTiles();
  } else {
    window.addEventListener('load', warmUpTiles, { once: true });
  }
}

const COUNTRY_DB: Record<string, { name: string; capital: string; population: string; region: string; iso: string; threat: string }> = {
  'US': { name: 'United States', capital: 'Washington D.C.', population: '331M', region: 'North America', iso: 'US', threat: 'LOW' },
  'CN': { name: 'China', capital: 'Beijing', population: '1.4B', region: 'East Asia', iso: 'CN', threat: 'HIGH' },
  'RU': { name: 'Russia', capital: 'Moscow', population: '144M', region: 'Eurasia', iso: 'RU', threat: 'HIGH' },
  'GB': { name: 'United Kingdom', capital: 'London', population: '67M', region: 'Europe', iso: 'GB', threat: 'LOW' },
  'DE': { name: 'Germany', capital: 'Berlin', population: '83M', region: 'Europe', iso: 'DE', threat: 'LOW' },
  'FR': { name: 'France', capital: 'Paris', population: '67M', region: 'Europe', iso: 'FR', threat: 'LOW' },
  'JP': { name: 'Japan', capital: 'Tokyo', population: '125M', region: 'East Asia', iso: 'JP', threat: 'MEDIUM' },
  'KR': { name: 'South Korea', capital: 'Seoul', population: '52M', region: 'East Asia', iso: 'KR', threat: 'MEDIUM' },
  'IN': { name: 'India', capital: 'New Delhi', population: '1.4B', region: 'South Asia', iso: 'IN', threat: 'MEDIUM' },
  'IL': { name: 'Israel', capital: 'Jerusalem', population: '9M', region: 'Middle East', iso: 'IL', threat: 'HIGH' },
  'IR': { name: 'Iran', capital: 'Tehran', population: '87M', region: 'Middle East', iso: 'IR', threat: 'HIGH' },
  'UA': { name: 'Ukraine', capital: 'Kyiv', population: '44M', region: 'Eastern Europe', iso: 'UA', threat: 'CRITICAL' },
  'TW': { name: 'Taiwan', capital: 'Taipei', population: '24M', region: 'East Asia', iso: 'TW', threat: 'HIGH' },
  'SA': { name: 'Saudi Arabia', capital: 'Riyadh', population: '35M', region: 'Middle East', iso: 'SA', threat: 'MEDIUM' },
  'BR': { name: 'Brazil', capital: 'Brasilia', population: '214M', region: 'South America', iso: 'BR', threat: 'LOW' },
  'AU': { name: 'Australia', capital: 'Canberra', population: '26M', region: 'Oceania', iso: 'AU', threat: 'LOW' },
  'EG': { name: 'Egypt', capital: 'Cairo', population: '104M', region: 'North Africa', iso: 'EG', threat: 'MEDIUM' },
  'NG': { name: 'Nigeria', capital: 'Abuja', population: '218M', region: 'West Africa', iso: 'NG', threat: 'MEDIUM' },
  'PK': { name: 'Pakistan', capital: 'Islamabad', population: '230M', region: 'South Asia', iso: 'PK', threat: 'HIGH' },
  'KP': { name: 'North Korea', capital: 'Pyongyang', population: '26M', region: 'East Asia', iso: 'KP', threat: 'CRITICAL' },
};

function destPoint(lat: number, lng: number, bearingDeg: number, distM: number): [number, number] {
  const R = 6378137;
  const br = (bearingDeg * Math.PI) / 180;
  const lat1 = (lat * Math.PI) / 180;
  const lng1 = (lng * Math.PI) / 180;
  const dr = distM / R;
  const sinLat2 = Math.sin(lat1) * Math.cos(dr) + Math.cos(lat1) * Math.sin(dr) * Math.cos(br);
  const lat2 = Math.asin(Math.max(-1, Math.min(1, sinLat2)));
  const lng2 = lng1 + Math.atan2(Math.sin(br) * Math.sin(dr) * Math.cos(lat1), Math.cos(dr) - Math.sin(lat1) * Math.sin(lat2));
  return [((lng2 * 180) / Math.PI + 540) % 360 - 180, (lat2 * 180) / Math.PI];
}

function sectorPolygon(lat: number, lng: number, bearing: number, fov: number, range: number): [number, number][] {
  const pts: [number, number][] = [[lng, lat]];
  const steps = 14;
  const start = bearing - fov / 2;
  for (let i = 0; i <= steps; i++) {
    pts.push(destPoint(lat, lng, start + (fov * i) / steps, range));
  }
  pts.push([lng, lat]);
  return pts;
}

function hash32(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = (h * 0x01000193) >>> 0;
  }
  return h >>> 0;
}

const ROT_DEG_S = 1.2;      // ° de longitude par seconde (≈ 5 min / tour)
const ROT_MAX_ZOOM = 5.5;   // seuil où la planète n'est plus ronde
const ROT_RESUME_MS = 3200; // délai d'inactivité avant reprise

export default function OsirisMap({ points, arcs, onPointClick, onMouseCoords, onBoundsChanged, activePanel, trackedPoint, lockedPoint, pois, onPoiClick, coverageTowers, showCoverage, coverageOpacity, onTowerClick }: OsirisMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [mapStyle, setMapStyle] = useState<'satellite' | 'dark' | 'streets'>('satellite');
  const [currentZoom, setCurrentZoom] = useState(1.8);
  const [currentCenter, setCurrentCenter] = useState<[number, number]>([0, 20]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [showSearch, setShowSearch] = useState(false);
  const [countryInfo, setCountryInfo] = useState<typeof COUNTRY_DB[string] | null>(null);
  const [countryInfoPos, setCountryInfoPos] = useState<{ x: number; y: number } | null>(null);

  const rotHoldRef = useRef(0);
  const rotActiveRef = useRef(false);
  const rotLastEmitRef = useRef(0);
  const holdCamera = useCallback((extraMs = 0) => {
    rotHoldRef.current = Math.max(rotHoldRef.current, performance.now() + ROT_RESUME_MS + extraMs);
  }, []);


  const [searchMarker, setSearchMarker] = useState<{ lat: number; lng: number; label: string } | null>(null);
  const searchMarkerRef = useRef<maplibregl.Marker | null>(null);

  const [tourMarker, setTourMarker] = useState<{ lat: number; lng: number; label: string } | null>(null);
  const tourMarkerRef = useRef<maplibregl.Marker | null>(null);

  const [geoPos, setGeoPos] = useState<{ lat: number; lng: number; acc: number } | null>(null);
  const [geoBusy, setGeoBusy] = useState(false);
  const [geoNote, setGeoNote] = useState<string | null>(null);
  const geoMarkerRef = useRef<maplibregl.Marker | null>(null);

  const [buildings3D, setBuildings3D] = useState(false);
  const buildings3DRef = useRef(false);
  buildings3DRef.current = buildings3D;
  const toggle3DRef = useRef<() => void>(() => {});
  const [mapEpoch, setMapEpoch] = useState(0);
  const deadCamRef = useRef<{ center: [number, number]; zoom: number } | null>(null);
  const pendingFlyRef = useRef<{ lat: number; lng: number; zoom: number; opts?: { pitch?: number; bearing?: number; dur?: number } } | null>(null);
  const readyRef = useRef(false);
  const mapReinitsRef = useRef(0);

  useEffect(() => {
    if (!geoNote) return;
    const t = setTimeout(() => setGeoNote(null), 7000);
    return () => clearTimeout(t);
  }, [geoNote]);

  // REPLI IP — dernier recours quand le navigateur refuse/ignore la
  // géolocalisation (aperçu intégré sans permission, GPS absent, callback
  // jamais résolu). Résolu côté serveur → jamais de blocage UI.
  const ipSelfLocate = useCallback(async (note: string) => {
    setGeoNote(note);
    try {
      const res = await fetch('/api/network/self', { signal: AbortSignal.timeout(9000) });
      const data = await res.json();
      const lat = Number(data?.geo?.lat);
      const lng = Number(data?.geo?.lon);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        setGeoNote('POSITION IP INDISPONIBLE · localisation impossible depuis ce réseau.');
        return;
      }
      setGeoPos({ lat, lng, acc: 0 });
      const place = [data?.geo?.city, data?.geo?.country].filter(Boolean).join(', ');
      setGeoNote(`POSITION IP · ${place || 'approximative'}`);
      holdCamera(2600);
      mapRef.current?.flyTo({ center: [lng, lat], zoom: 11, duration: 2000, essential: true });
    } catch {
      setGeoNote('POSITION IP INDISPONIBLE · localisation impossible depuis ce réseau.');
    }
  }, [holdCamera]);

  const handleGeolocate = useCallback(() => {
    if (geoBusy) return;
    if (typeof navigator === 'undefined' || !navigator.geolocation?.getCurrentPosition) {
      void ipSelfLocate("GÉOLOCALISATION INDISPONIBLE · repli sur position IP.");
      return;
    }
    setGeoBusy(true);
    // CHIEN DE GARDE — dans les aperçus intégrés, l'invite de permission ne
    // résout jamais et AUCUN callback n'est déclenché : geoBusy restait vrai
    // à vie et le bouton était mort (« map blocked when locating »).
    // Après 15 s on force le reset et on bascule sur la position IP serveur.
    const geoWatchdog = window.setTimeout(() => {
      setGeoBusy(false);
      void ipSelfLocate('GÉOLOCALISATION SANS RÉPONSE · repli sur position IP.');
    }, 15000);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        window.clearTimeout(geoWatchdog);
        setGeoBusy(false);
        const { latitude, longitude, accuracy } = pos.coords;
        if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
          setGeoNote("POSITION INVALIDE · le navigateur n'a pas renvoyé de coordonnées exploitables.");
          return;
        }
        setGeoPos({ lat: latitude, lng: longitude, acc: accuracy ?? 0 });
        holdCamera(2600); // vol de 2 s · rotation auto en pause pendant le vol
        mapRef.current?.flyTo({ center: [longitude, latitude], zoom: 13, duration: 2000, essential: true });
      },
      (err) => {
        window.clearTimeout(geoWatchdog);
        setGeoBusy(false);
        if (err?.code === err.PERMISSION_DENIED) {
          void ipSelfLocate('GÉOLOCALISATION REFUSÉE · repli sur position IP approximative.');
        } else if (err?.code === err.POSITION_UNAVAILABLE) {
          void ipSelfLocate('POSITION INDÉTERMINÉE · repli sur position IP approximative.');
        } else {
          void ipSelfLocate('GÉOLOCALISATION · délai dépassé, repli sur position IP.');
        }
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 },
    );
  }, [geoBusy, holdCamera, ipSelfLocate]);

  const toggle3D = useCallback(() => {
    const next = !buildings3D;
    setBuildings3D(next);
    if (next) {
      holdCamera(1400); // inclinaison 0,9 s + marge
      mapRef.current?.easeTo({ pitch: 55, duration: 900 });
      if ((mapRef.current?.getZoom() ?? 0) < 13.2) {
        setGeoNote('MODE 3D ACTIVÉ · bâtiments visibles au niveau rue : zoomez jusqu\'à z14+.');
      }
    } else {
      holdCamera(900);
      mapRef.current?.easeTo({ pitch: 0, duration: 700 });
    }
  }, [buildings3D, holdCamera]);
  toggle3DRef.current = toggle3D;

  const handleSearch = useCallback(async (query: string) => {
    if (!query || query.length < 2) {
      setSearchResults([]);
      return;
    }
    const ctrl = new AbortController();
    const abortT = window.setTimeout(() => ctrl.abort(), 9000);
    try {
      // Passé par la file serveur /api/horus/geocode (UA conforme, cache,
      // pas de CORS ni de rate-limit navigateur) au lieu d'un fetch direct
      // Nominatim depuis le navigateur.
      const res = await fetch(
        `/api/horus/geocode?q=${encodeURIComponent(query)}`,
        { signal: ctrl.signal }
      );
      const data = await res.json();
      const results = Array.isArray(data?.results) ? data.results : [];
      setSearchResults(results.map((r: any) => ({
        lat: String(r.lat),
        lon: String(r.lng),
        display_name: r.fullName || r.name || 'Lieu',
        name: r.name,
        type: r.type,
        category: r.category,
        boundingbox: r.bbox,
      })));
    } catch {
      setSearchResults([]);
    } finally {
      window.clearTimeout(abortT);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => handleSearch(searchQuery), 250);
    return () => clearTimeout(timer);
  }, [searchQuery, handleSearch]);

  const flyToResult = useCallback((result: any) => {
    if (!mapRef.current || !result) return;
    holdCamera(2200); // vol de 2 s · pas de rotation auto pendant le vol
    const lat = parseFloat(result.lat);
    let lng = parseFloat(result.lon);
    try {
      const c = mapRef.current.getCenter();
      lng = lng - 360 * Math.round((lng - c.lng) / 360);
    } catch {}
    const zoom = result.type === 'country' ? 5 : result.type === 'city' || result.type === 'administrative' ? 12 : 15;
    if (!readyRef.current) {
      pendingFlyRef.current = { lat, lng, zoom, opts: { dur: 2000 } };
    } else {
      mapRef.current.flyTo({ center: [lng, lat], zoom, duration: 2000, essential: true });
    }
    const shortName = (result.display_name || '').split(',')[0].trim() || 'Search Result';
    setSearchMarker({ lat, lng, label: shortName.toUpperCase() });
    setSearchQuery('');
    setSearchResults([]);
    setShowSearch(false);
    try { window.dispatchEvent(new CustomEvent('horus:nav-fly', { detail: { via: 'map-search', label: shortName } })); } catch {}
    const fetchPois = (window as any).__horusFetchPois;
    if (fetchPois && zoom >= 8) fetchPois(lat, lng, 3000);
  }, [holdCamera]);

  useEffect(() => {
    if (!mapRef.current || !isReady) return;
    const map = mapRef.current;

    if (searchMarkerRef.current) {
      searchMarkerRef.current.remove();
      searchMarkerRef.current = null;
    }

    if (!searchMarker) return;

    const STYLE_ID = 'horus-search-marker-style';
    if (!document.getElementById(STYLE_ID)) {
      const styleEl = document.createElement('style');
      styleEl.id = STYLE_ID;
      styleEl.textContent = `
        @keyframes horus-search-blink {
          0%, 100% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
          50%      { opacity: 0.35; transform: translate(-50%, -50%) scale(0.7); }
        }
        @keyframes horus-search-ring {
          0%   { transform: translate(-50%, -50%) scale(0.6); opacity: 0.9; }
          70%  { opacity: 0.25; }
          100% { transform: translate(-50%, -50%) scale(4.5); opacity: 0; }
        }
      `;
      document.head.appendChild(styleEl);
    }

    const el = document.createElement('div');
    el.style.cssText = 'position:relative;width:0;height:0;pointer-events:none;';
    el.innerHTML = `
      <div style="position:absolute;left:50%;top:50%;width:14px;height:14px;margin-left:-7px;margin-top:-7px;border-radius:50%;border:2px solid #ff1f1f;opacity:0;animation:horus-search-ring 1.6s ease-out infinite;"></div>
      <div style="position:absolute;left:50%;top:50%;width:14px;height:14px;margin-left:-7px;margin-top:-7px;border-radius:50%;border:2px solid #ff1f1f;opacity:0;animation:horus-search-ring 1.6s ease-out infinite;animation-delay:0.55s;"></div>
      <div style="position:absolute;left:50%;top:50%;width:14px;height:14px;margin-left:-7px;margin-top:-7px;border-radius:50%;border:2px solid #ff1f1f;opacity:0;animation:horus-search-ring 1.6s ease-out infinite;animation-delay:1.1s;"></div>
      <div style="position:absolute;left:50%;top:50%;width:14px;height:14px;margin-left:-7px;margin-top:-7px;border-radius:50%;background:#ff1f1f;box-shadow:0 0 6px rgba(255,31,31,0.95),0 0 14px rgba(255,31,31,0.65),0 0 24px rgba(255,31,31,0.35);animation:horus-search-blink 0.9s ease-in-out infinite;"></div>
      <div style="position:absolute;left:50%;top:50%;transform:translate(-50%,-280%);white-space:nowrap;font-family:ui-monospace,SFMono-Regular,monospace;font-size:10px;font-weight:700;letter-spacing:0.08em;color:#ff5050;background:rgba(20,0,0,0.85);border:1px solid rgba(255,31,31,0.5);border-radius:3px;padding:1px 6px;pointer-events:none;text-shadow:0 0 4px rgba(255,31,31,0.9);">${searchMarker.label}</div>
    `;

    const marker = new maplibregl.Marker({ element: el, anchor: 'center' })
      .setLngLat([searchMarker.lng, searchMarker.lat])
      .addTo(map);

    searchMarkerRef.current = marker;

    return () => {
      marker.remove();
      if (searchMarkerRef.current === marker) {
        searchMarkerRef.current = null;
      }
    };
  }, [searchMarker, isReady]);

  useEffect(() => {
    if (!mapRef.current || !isReady) return;
    const map = mapRef.current;

    if (tourMarkerRef.current) {
      tourMarkerRef.current.remove();
      tourMarkerRef.current = null;
    }
    if (!tourMarker) return;

    const STYLE_ID = 'horus-tour-marker-style';
    if (!document.getElementById(STYLE_ID)) {
      const styleEl = document.createElement('style');
      styleEl.id = STYLE_ID;
      styleEl.textContent = `
        @keyframes horus-tour-blink {
          0%, 100% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
          50%      { opacity: 0.4; transform: translate(-50%, -50%) scale(0.72); }
        }
        @keyframes horus-tour-ring {
          0%   { transform: translate(-50%, -50%) scale(0.55); opacity: 0.9; }
          70%  { opacity: 0.22; }
          100% { transform: translate(-50%, -50%) scale(4.2); opacity: 0; }
        }
        @keyframes horus-tour-bob {
          0%, 100% { transform: translate(-50%, -100%) translateY(0); }
          50%      { transform: translate(-50%, -100%) translateY(-7px); }
        }
      `;
      document.head.appendChild(styleEl);
    }

    const el = document.createElement('div');
    el.style.cssText = 'position:relative;width:0;height:0;pointer-events:none;';
    el.innerHTML = `
      <div style="position:absolute;left:50%;top:50%;width:16px;height:16px;margin-left:-8px;margin-top:-8px;border-radius:50%;border:2px solid #ff1f1f;opacity:0;animation:horus-tour-ring 1.5s ease-out infinite;"></div>
      <div style="position:absolute;left:50%;top:50%;width:16px;height:16px;margin-left:-8px;margin-top:-8px;border-radius:50%;border:2px solid #ff1f1f;opacity:0;animation:horus-tour-ring 1.5s ease-out infinite;animation-delay:0.5s;"></div>
      <div style="position:absolute;left:50%;top:50%;width:12px;height:12px;margin-left:-6px;margin-top:-6px;border-radius:50%;background:#ff1f1f;box-shadow:0 0 8px rgba(255,31,31,0.95),0 0 18px rgba(255,31,31,0.6);animation:horus-tour-blink 0.85s ease-in-out infinite;"></div>
      <div style="position:absolute;left:50%;top:50%;animation:horus-tour-bob 1.1s ease-in-out infinite;">
        <svg width="26" height="26" viewBox="0 0 24 24" style="display:block;transform:translate(-50%,0);filter:drop-shadow(0 0 6px rgba(53,224,255,0.9));"><path d="M12 3 L20 14 H15 V21 H9 V14 H4 Z" fill="#35e0ff" stroke="#bdf3ff" stroke-width="1.2"/></svg>
      </div>
      ${tourMarker.label ? `<div style="position:absolute;left:50%;top:50%;transform:translate(-50%,-385%);white-space:nowrap;font-family:ui-monospace,SFMono-Regular,monospace;font-size:10px;font-weight:700;letter-spacing:0.08em;color:#ffd2d2;background:rgba(26,0,0,0.86);border:1px solid rgba(255,31,31,0.55);border-radius:3px;padding:1px 6px;pointer-events:none;text-shadow:0 0 4px rgba(255,31,31,0.9);">${tourMarker.label}</div>` : ''}
    `;

    const marker = new maplibregl.Marker({ element: el, anchor: 'center' })
      .setLngLat([tourMarker.lng, tourMarker.lat])
      .addTo(map);

    tourMarkerRef.current = marker;

    return () => {
      marker.remove();
      if (tourMarkerRef.current === marker) {
        tourMarkerRef.current = null;
      }
    };
  }, [tourMarker, isReady]);

  useEffect(() => {
    if (!mapRef.current || !isReady) return;
    const map = mapRef.current;

    if (geoMarkerRef.current) {
      geoMarkerRef.current.remove();
      geoMarkerRef.current = null;
    }
    if (!geoPos) return;

    const STYLE_ID = 'horus-geoloc-marker-style';
    if (!document.getElementById(STYLE_ID)) {
      const styleEl = document.createElement('style');
      styleEl.id = STYLE_ID;
      styleEl.textContent = `
        @keyframes horus-geoloc-ping {
          0%   { transform: translate(-50%, -50%) scale(0.5); opacity: 0.9; }
          70%  { opacity: 0.2; }
          100% { transform: translate(-50%, -50%) scale(3.6); opacity: 0; }
        }
        @keyframes horus-geoloc-blink {
          0%, 100% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
          50%      { opacity: 0.55; transform: translate(-50%, -50%) scale(0.75); }
        }
      `;
      document.head.appendChild(styleEl);
    }

    const accTxt = geoPos.acc ? ` · ±${Math.round(geoPos.acc)} m` : '';
    const el = document.createElement('div');
    el.style.cssText = 'position:relative;width:0;height:0;pointer-events:none;';
    el.innerHTML = `
      <div style="position:absolute;left:50%;top:50%;width:18px;height:18px;margin-left:-9px;margin-top:-9px;border-radius:50%;border:2px solid #35e0ff;opacity:0;animation:horus-geoloc-ping 1.8s ease-out infinite;"></div>
      <div style="position:absolute;left:50%;top:50%;width:18px;height:18px;margin-left:-9px;margin-top:-9px;border-radius:50%;border:2px solid #35e0ff;opacity:0;animation:horus-geoloc-ping 1.8s ease-out infinite;animation-delay:0.6s;"></div>
      <div style="position:absolute;left:50%;top:50%;width:12px;height:12px;margin-left:-6px;margin-top:-6px;border-radius:50%;background:#35e0ff;box-shadow:0 0 8px rgba(53,224,255,0.95),0 0 18px rgba(53,224,255,0.55);animation:horus-geoloc-blink 1.1s ease-in-out infinite;"></div>
      <div style="position:absolute;left:50%;top:50%;transform:translate(-50%,-330%);white-space:nowrap;font-family:ui-monospace,SFMono-Regular,monospace;font-size:10px;font-weight:700;letter-spacing:0.08em;color:#9ceaff;background:rgba(0,20,32,0.88);border:1px solid rgba(53,224,255,0.55);border-radius:3px;padding:1px 6px;pointer-events:auto;">VOUS ÊTES ICI${accTxt} <span data-role="clear" style="color:#ff8888;margin-left:5px;cursor:pointer;">✕</span></div>
    `;
    const clearBtn = el.querySelector('[data-role="clear"]');
    if (clearBtn) {
      clearBtn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        setGeoPos(null);
      });
    }

    const marker = new maplibregl.Marker({ element: el, anchor: 'center' })
      .setLngLat([geoPos.lng, geoPos.lat])
      .addTo(map);

    geoMarkerRef.current = marker;

    return () => {
      marker.remove();
      if (geoMarkerRef.current === marker) {
        geoMarkerRef.current = null;
      }
    };
  }, [geoPos, isReady]);

  useEffect(() => {
    (window as any).__horusDropSearchMarker = (lat: number, lng: number, label?: string) => {
      setSearchMarker({ lat, lng, label: (label || 'SEARCH TARGET').toUpperCase().slice(0, 60) });
    };
    (window as any).__horusClearSearchMarker = () => {
      setSearchMarker(null);
    };
    (window as any).__horusDropTourMarker = (lat: number, lng: number, label?: string) => {
      setTourMarker({ lat, lng, label: String(label ?? '').toUpperCase().slice(0, 42) });
    };
    (window as any).__horusClearTourMarker = () => {
      setTourMarker(null);
    };
    return () => {
      delete (window as any).__horusDropSearchMarker;
      delete (window as any).__horusClearSearchMarker;
      delete (window as any).__horusDropTourMarker;
      delete (window as any).__horusClearTourMarker;
    };
  }, []);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const el = containerRef.current;
    if (el.clientWidth === 0 || el.clientHeight === 0) return;

    let rotRaf = 0;

    // Chien de garde anti-carte-zombie : un vol très long en projection globe
    // peut faire planter _calcMatrices (matrices nulles) au passage de la
    // transition globe→mercator ; l'état d'animation reste alors « running »
    // et CHAQUE frame suivante jette « Attempting to run(), but is already
    // running » — la carte devient inertre (plus aucune commande caméra ne
    // passe). On détecte cette signature et on reconstruit la carte au même
    // endroit : l'utilisateur ne voit qu'un très léger recalage.
    let zombieHits = 0;
    let zombieDone = false;
    const onZombieErr = (e: ErrorEvent) => {
      const s = String((e.error && e.error.stack) || e.message || '');
      if (!/maplibre-gl/.test(s)) return;
      if (!/Attempting to run\(\), but is already running/.test(s)) return;
      zombieHits += 1;
      if (zombieDone || zombieHits < 3) return;
      zombieDone = true;
      if (mapReinitsRef.current >= 4) return;
      mapReinitsRef.current += 1;
      try {
        const m = mapRef.current;
        if (m) deadCamRef.current = { center: [m.getCenter().lng, m.getCenter().lat], zoom: Math.min(5, m.getZoom()) };
      } catch {}
      console.warn('[OsirisMap] boucle de rendu morte — recalage de la carte');
      setMapEpoch((k) => k + 1);
    };
    window.addEventListener('error', onZombieErr);

    try {
      const map = new maplibregl.Map({
        container: el,
        style: MAP_STYLE as any,
        center: deadCamRef.current?.center ?? [0, 20],
        zoom: deadCamRef.current?.zoom ?? 1.8,
        minZoom: 1,
        maxZoom: 20,
        pitch: 0,
        bearing: 0,
        maxPitch: 85,
        attributionControl: false,
        fadeDuration: 0,           // Skip fade-in for instant tile appearance
        cooperativeGestures: false,
        crossSourceCollisions: false,
        validateStyle: false,
      });

      try {
        const cv = map.getCanvas();
        const gl = (cv.getContext('webgl2') || cv.getContext('webgl')) as WebGLRenderingContext | null;
        let renderer = gl ? String(gl.getParameter(gl.RENDERER) || '') : '';
        if (gl) {
          const dbg = gl.getExtension('WEBGL_debug_renderer_info') as { UNMASKED_RENDERER_WEBGL: number } | null;
          if (dbg) renderer += ' ' + String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL));
        }
        (window as any).__horusSoftGpu = /swiftshader|software|llvmpipe|softpipe|basic render/i.test(renderer);
      } catch {
        (window as any).__horusSoftGpu = false;
      }

      map.on('style.load', () => {
        try {
          (map as any).setProjection({ type: 'globe' });
        } catch (e) {
          console.log('Globe projection not available, using mercator');
        }
        setIsReady(true);
        // la caméra ne redevient pilotable que quand la carte est POSÉE
        // (idle) : voler pendant le chargement des tuiles tuait la boucle
        // de rendu des cartes fragiles. Échappatoire de sécurité à 8 s.
        const armCamera = () => {
          if (readyRef.current) return;
          readyRef.current = true;
          const pf = pendingFlyRef.current;
          if (!pf) return;
          pendingFlyRef.current = null;
          try {
            map.flyTo({
              center: [pf.lng - 360 * Math.round((pf.lng - map.getCenter().lng) / 360), pf.lat],
              zoom: pf.zoom,
              pitch: pf.opts?.pitch,
              bearing: pf.opts?.bearing,
              duration: pf.opts?.dur ?? 1500,
              essential: true,
            });
          } catch {}
        };
        try {
          map.once('idle', armCamera);
        } catch {
          armCamera();
        }
        window.setTimeout(armCamera, 8000);
      });

      map.addControl(new maplibregl.NavigationControl({ showCompass: true, showZoom: true }), 'top-right');
      map.addControl(new maplibregl.ScaleControl({ maxWidth: 150, unit: 'metric' }), 'bottom-right');

      const attrControl = document.querySelector('.maplibregl-ctrl-attrib');
      if (attrControl) attrControl.remove();

      map.on('mousemove', (e) => {
        onMouseCoords?.({ lat: e.lngLat.lat, lng: e.lngLat.lng });
      });

      const emitBounds = () => {
        if (rotActiveRef.current) {
          const nowRot = performance.now();
          if (nowRot - rotLastEmitRef.current < 1000) return;
          rotLastEmitRef.current = nowRot;
        }
        const zoom = map.getZoom();
        setCurrentZoom(zoom);
        const c = map.getCenter();
        setCurrentCenter([c.lng, c.lat]);
        if (onBoundsChanged) {
          try {
            const b = map.getBounds();
            onBoundsChanged({
              north: b.getNorth(),
              south: b.getSouth(),
              east: b.getEast(),
              west: b.getWest(),
              centerLat: c.lat,
              centerLng: c.lng,
              zoom,
            });
          } catch {}
        }
      };
      map.on('moveend', emitBounds);
      map.on('zoomend', emitBounds);


      map.on('contextmenu', async (e) => {
        e.preventDefault();
        try {
          // reverse geocode via la file serveur (jamais de fetch direct OSM)
          const res = await fetch(
            `/api/horus/geocode?lat=${e.lngLat.lat}&lon=${e.lngLat.lng}`
          );
          const data = await res.json();
          const countryCode = data?.address?.country_code?.toUpperCase();
          if (countryCode && COUNTRY_DB[countryCode]) {
            setCountryInfo(COUNTRY_DB[countryCode]);
            setCountryInfoPos({ x: e.point.x, y: e.point.y });
          } else if (data?.address?.country) {
            setCountryInfo({
              name: data.address.country,
              capital: data.address.state || 'N/D',
              population: 'N/D',
              region: data.address.region || 'N/D',
              iso: countryCode || 'N/D',
              threat: 'UNKNOWN',
            });
            setCountryInfoPos({ x: e.point.x, y: e.point.y });
          }
        } catch {}
      });

      map.on('click', (e) => {
        setCountryInfo(null);
        setCountryInfoPos(null);
      });

      const holdNow = () => {
        rotHoldRef.current = Math.max(rotHoldRef.current, performance.now() + ROT_RESUME_MS);
      };
      const rotGestures = ['dragstart', 'wheel', 'mousedown', 'touchstart', 'rotatestart', 'pitchstart', 'boxzoomstart', 'dblclick', 'click'];
      for (const ev of rotGestures) map.on(ev as any, holdNow);
      let rotLastT = performance.now();
      const spin = (t: number) => {
        rotRaf = requestAnimationFrame(spin);
        const m = mapRef.current;
        if (!m) return;
        const dt = Math.min(128, t - rotLastT);
        rotLastT = t;
        if (t < rotHoldRef.current) { rotActiveRef.current = false; return; }
        try {
          if (m.isMoving() || m.getZoom() >= ROT_MAX_ZOOM) {
            rotActiveRef.current = false;
            return;
          }
          rotActiveRef.current = true;
          const c = m.getCenter();
          const lng = ((c.lng + (ROT_DEG_S * dt) / 1000 + 540) % 360) - 180;
          m.jumpTo({ center: [lng, c.lat] });
        } catch {
          rotActiveRef.current = false;
        }
      };
      rotRaf = requestAnimationFrame(spin);

      mapRef.current = map;
    } catch (err) {
      console.error('Failed to initialize MapLibre:', err);
    }

    return () => {
      cancelAnimationFrame(rotRaf);
      rotActiveRef.current = false;
      readyRef.current = false;
      window.removeEventListener('error', onZombieErr);
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        setIsReady(false);
      }
    };
  }, [mapEpoch]);

  const pointsRef = useRef(points);
  pointsRef.current = points;
  const onPointClickRef = useRef(onPointClick);
  onPointClickRef.current = onPointClick;
  const layerHandlersRef = useRef<{
    click: (e: any) => void; enter: () => void; leave: () => void;
  } | null>(null);

  useEffect(() => {
    if (!mapRef.current || !isReady) return;
    const map = mapRef.current;

    const pointsData: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: points.map((p, i) => ({
        type: 'Feature' as const,
        properties: {
          id: i,
          type: p.type,
          label: p.label || '',
          color: p.color,
          size: CATEGORY_STYLES[p.type]?.size || 6,
          active: p.color !== '#ff4444',
        },
        geometry: {
          type: 'Point' as const,
          coordinates: [p.lng, p.lat],
        },
      })),
    };

    if (map.getSource('osint-points')) {
      (map.getSource('osint-points') as maplibregl.GeoJSONSource).setData(pointsData);
      return;
    }

    map.addSource('osint-points', {
      type: 'geojson',
      data: pointsData,
      cluster: true,
      clusterMaxZoom: 14,
      clusterRadius: 40,
    });

    map.addLayer({
      id: 'osint-points-glow',
      type: 'circle',
      source: 'osint-points',
      paint: {
        'circle-radius': [
          'case',
          ['has', 'point_count'],
          ['+', ['*', ['sqrt', ['get', 'point_count']], 4], 8],
          ['+', ['get', 'size'], 6],
        ],
        'circle-color': [
          'case',
          ['has', 'point_count'],
          'rgba(0,200,255,0.15)',
          ['to-color', ['get', 'color']],
        ],
        'circle-opacity': [
          'case',
          ['has', 'point_count'],
          0.3,
          0.2,
        ],
        'circle-blur': 0.8,
      },
    });

    map.addLayer({
      id: 'osint-points',
      type: 'circle',
      source: 'osint-points',
      paint: {
        'circle-radius': [
          'case',
          ['has', 'point_count'],
          ['+', ['*', ['sqrt', ['get', 'point_count']], 3], 5],
          ['get', 'size'],
        ],
        'circle-color': [
          'case',
          ['has', 'point_count'],
          '#00ccff',
          ['to-color', ['get', 'color']],
        ],
        'circle-opacity': [
          'case',
          ['has', 'point_count'],
          0.9,
          0.85,
        ],
        'circle-stroke-width': [
          'case',
          ['has', 'point_count'],
          2,
          1,
        ],
        'circle-stroke-color': [
          'case',
          ['has', 'point_count'],
          'rgba(0,200,255,0.6)',
          ['to-color', ['get', 'color']],
        ],
        'circle-stroke-opacity': 0.5,
      },
    });

    map.addLayer({
      id: 'osint-points-labels',
      type: 'symbol',
      source: 'osint-points',
      filter: ['!', ['has', 'point_count']],
      layout: {
        'text-field': ['get', 'label'],
        'text-size': 10,
        'text-offset': [0, 1.5],
        'text-anchor': 'top',
        'text-font': ['Open Sans Regular'],
        'text-max-width': 8,
        'text-optional': true,
        'text-allow-overlap': false,
      },
      paint: {
        'text-color': ['to-color', ['get', 'color']],
        'text-halo-color': 'rgba(0,0,0,0.9)',
        'text-halo-width': 1.5,
        'text-opacity': 0.9,
      },
    });

    const prevH = layerHandlersRef.current;
    if (prevH) {
      map.off('click', 'osint-points', prevH.click);
      map.off('mouseenter', 'osint-points', prevH.enter);
      map.off('mouseleave', 'osint-points', prevH.leave);
    }

    const onPointLayerClick = (e: any) => {
      const features = e.features;
      if (!features || features.length === 0) return;

      const feature = features[0];
      const props = feature.properties;

      if (props.point_count) {
        const clusterId = props.cluster_id;
        const source = map.getSource('osint-points') as maplibregl.GeoJSONSource;
        source.getClusterExpansionZoom(clusterId).then((zoom) => {
          holdCamera(600);
          map.easeTo({
            center: (feature.geometry as any).coordinates,
            zoom: zoom,
            duration: 400,
          });
        }).catch(() => {});
        return;
      }

      const idx = props.id;
      const pts = pointsRef.current;
      if (idx !== undefined && pts[idx]) {
        onPointClickRef.current?.(pts[idx]);
      }
    };
    const onPointLayerEnter = () => { map.getCanvas().style.cursor = 'pointer'; };
    const onPointLayerLeave = () => { map.getCanvas().style.cursor = ''; };
    map.on('click', 'osint-points', onPointLayerClick);
    map.on('mouseenter', 'osint-points', onPointLayerEnter);
    map.on('mouseleave', 'osint-points', onPointLayerLeave);
    layerHandlersRef.current = {
      click: onPointLayerClick, enter: onPointLayerEnter, leave: onPointLayerLeave,
    };
  }, [points, isReady, holdCamera]);

  const fovZoomBucket = Math.round(currentZoom * 2) / 2;
  useEffect(() => {
    if (!mapRef.current || !isReady) return;
    const map = mapRef.current;

    const cams = points.filter((p) => p.type === 'camera');

    const fovData: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: cams.map((p, i) => {
        const raw = (p.rawData || {}) as Record<string, unknown>;
        const idStr = String((raw as any).id ?? `${p.lat.toFixed(5)},${p.lng.toFixed(5)},${i}`);
        const h = hash32(idStr);
        const bearing = h % 360;
        const fov = 55 + ((h >>> 8) % 35); // 55-90° d'ouverture
        const mpp = (156543.03392 * Math.cos((p.lat * Math.PI) / 180)) / Math.pow(2, fovZoomBucket);
        const range = Math.min(2200, Math.max(140, 45 * mpp));
        return {
          type: 'Feature' as const,
          properties: {
            id: i,
            on: p.color === '#ff4444' ? 0 : 1, // hors-ligne → cône rouge discret
          },
          geometry: {
            type: 'Polygon' as const,
            coordinates: [sectorPolygon(p.lat, p.lng, bearing, fov, range)],
          },
        };
      }),
    };

    if (map.getSource('camera-fov')) {
      (map.getSource('camera-fov') as maplibregl.GeoJSONSource).setData(fovData);
      return;
    }
    if (cams.length === 0) return; // rien à créer encore

    map.addSource('camera-fov', { type: 'geojson', data: fovData });

    const before = map.getLayer('osint-points-glow') ? 'osint-points-glow' : undefined;

    map.addLayer({
      id: 'camera-fov-fill',
      type: 'fill',
      source: 'camera-fov',
      minzoom: 11.5,
      paint: {
        'fill-color': [
          'case', ['==', ['get', 'on'], 1],
          'rgba(0,255,136,0.14)',
          'rgba(255,90,90,0.12)',
        ],
        'fill-opacity': [
          'interpolate', ['linear'], ['zoom'],
          11.5, 0, 12.5, 1,
        ],
      },
    }, before as any);

    map.addLayer({
      id: 'camera-fov-line',
      type: 'line',
      source: 'camera-fov',
      minzoom: 11.5,
      paint: {
        'line-color': [
          'case', ['==', ['get', 'on'], 1],
          'rgba(0,255,136,0.55)',
          'rgba(255,90,90,0.5)',
        ],
        'line-width': ['interpolate', ['linear'], ['zoom'], 11.5, 0.6, 14, 1.6],
        'line-opacity': ['interpolate', ['linear'], ['zoom'], 11.5, 0, 12.3, 0.9],
      },
      layout: { 'line-join': 'round', 'line-cap': 'round' },
    }, before as any);
  }, [points, isReady, fovZoomBucket]);

  useEffect(() => {
    if (!mapRef.current || !isReady) return;
    const map = mapRef.current;

    if (!buildings3D) {
      try {
        if (map.getLayer('horus-3d-buildings')) map.removeLayer('horus-3d-buildings');
        if (map.getSource('horus-3d')) map.removeSource('horus-3d');
      } catch {}
      return;
    }
    if (map.getSource('horus-3d')) return; // déjà en place

    try {
      map.addSource('horus-3d', {
        type: 'vector',
        url: 'https://tiles.openfreemap.org/planet',
      });
      const before = map.getLayer('osint-points-glow') ? 'osint-points-glow' : undefined;
      map.addLayer({
        id: 'horus-3d-buildings',
        type: 'fill-extrusion',
        source: 'horus-3d',
        'source-layer': 'building',
        minzoom: 14,
        paint: {
          'fill-extrusion-color': [
            'interpolate', ['linear'], ['coalesce', ['get', 'render_height'], 0],
            0, '#0e1c2a',
            12, '#12293e',
            30, '#1a3a55',
            80, '#235078',
            200, '#2f6ea8',
          ],
          'fill-extrusion-height': ['coalesce', ['get', 'render_height'], 5],
          'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0],
          'fill-extrusion-opacity': 0.94,
          'fill-extrusion-vertical-gradient': true,
        },
      }, before as any);
    } catch (err) {
      console.warn('3D buildings unavailable:', err);
    }
  }, [isReady, buildings3D]);

  useEffect(() => {
    if (!mapRef.current || !isReady) return;
    const map = mapRef.current;

    const targetPoint = lockedPoint || trackedPoint;
    const isLock = !!lockedPoint;

    try {
      if (map.getLayer('track-lock-pulse')) map.removeLayer('track-lock-pulse');
      if (map.getLayer('track-lock-ring')) map.removeLayer('track-lock-ring');
      if (map.getLayer('track-lock-center')) map.removeLayer('track-lock-center');
      if (map.getSource('track-lock-point')) map.removeSource('track-lock-point');
    } catch {}

    if (!targetPoint) return;

    const trackLockData: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: [{
        type: 'Feature' as const,
        properties: { isLock },
        geometry: {
          type: 'Point' as const,
          coordinates: [targetPoint.lng, targetPoint.lat],
        },
      }],
    };

    map.addSource('track-lock-point', {
      type: 'geojson',
      data: trackLockData,
    });

    map.addLayer({
      id: 'track-lock-pulse',
      type: 'circle',
      source: 'track-lock-point',
      paint: {
        'circle-radius': isLock ? 30 : 22,
        'circle-color': isLock ? '#ff3333' : '#00ccff',
        'circle-opacity': 0.15,
        'circle-blur': 0.5,
      },
    });

    map.addLayer({
      id: 'track-lock-ring',
      type: 'circle',
      source: 'track-lock-point',
      paint: {
        'circle-radius': isLock ? 14 : 10,
        'circle-color': 'transparent',
        'circle-stroke-width': isLock ? 3 : 2,
        'circle-stroke-color': isLock ? '#ff3333' : '#00ccff',
        'circle-stroke-opacity': 0.8,
      },
    });

    map.addLayer({
      id: 'track-lock-center',
      type: 'circle',
      source: 'track-lock-point',
      paint: {
        'circle-radius': isLock ? 4 : 3,
        'circle-color': isLock ? '#ff3333' : '#00ccff',
        'circle-opacity': 1,
      },
    });

    let pulseFrame = 0;
    const pulseInterval = setInterval(() => {
      if (!mapRef.current) { clearInterval(pulseInterval); return; }
      try {
        pulseFrame = (pulseFrame + 1) % 60;
        const phase = pulseFrame / 60;
        const scale = 1 + Math.sin(phase * Math.PI * 2) * 0.3;
        const baseOuter = isLock ? 30 : 22;
        const baseRing = isLock ? 14 : 10;
        map.setPaintProperty('track-lock-pulse', 'circle-radius', baseOuter * scale);
        map.setPaintProperty('track-lock-pulse', 'circle-opacity', 0.1 + Math.sin(phase * Math.PI * 2) * 0.1);
        map.setPaintProperty('track-lock-ring', 'circle-radius', baseRing * (1 + Math.sin(phase * Math.PI * 2) * 0.1));
      } catch {
        clearInterval(pulseInterval);
      }
    }, 50);

    return () => {
      clearInterval(pulseInterval);
      try {
        if (map.getLayer('track-lock-pulse')) map.removeLayer('track-lock-pulse');
        if (map.getLayer('track-lock-ring')) map.removeLayer('track-lock-ring');
        if (map.getLayer('track-lock-center')) map.removeLayer('track-lock-center');
        if (map.getSource('track-lock-point')) map.removeSource('track-lock-point');
      } catch {}
    };
  }, [trackedPoint, lockedPoint, isReady]);

  useEffect(() => {
    if (!mapRef.current || !isReady) return;
    const map = mapRef.current;

    const arcsData: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: arcs.map((arc, i) => ({
        type: 'Feature' as const,
        properties: {
          id: i,
          type: arc.type || 'default',
          color: arc.color?.[0] || '#00ccff',
          stroke: arc.stroke || 0.5,
        },
        geometry: {
          type: 'LineString' as const,
          coordinates: [
            [arc.startLng, arc.startLat],
            [arc.endLng, arc.endLat],
          ],
        },
      })),
    };

    if (map.getSource('osint-arcs')) {
      (map.getSource('osint-arcs') as maplibregl.GeoJSONSource).setData(arcsData);
      return;
    }
    if (arcs.length === 0) return; // nothing to create yet

    map.addSource('osint-arcs', {
      type: 'geojson',
      data: arcsData,
    });

    map.addLayer({
      id: 'osint-arcs',
      type: 'line',
      source: 'osint-arcs',
      paint: {
        'line-color': ['to-color', ['get', 'color']],
        'line-width': ['*', ['get', 'stroke'], 2],
        'line-opacity': 0.5,
        'line-blur': 1,
      },
      layout: {
        'line-join': 'round',
        'line-cap': 'round',
      },
    });
  }, [arcs, isReady]);

  useEffect(() => {
    if (!mapRef.current || !isReady) return;
    const map = mapRef.current!;

    try {
      if (map.getLayer('poi-points-glow')) map.removeLayer('poi-points-glow');
      if (map.getLayer('poi-points')) map.removeLayer('poi-points');
      if (map.getLayer('poi-points-labels')) map.removeLayer('poi-points-labels');
      if (map.getSource('poi-points')) map.removeSource('poi-points');
    } catch {}

    if (!pois || pois.length === 0) return;

    const poisData: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: pois.map(poi => ({
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: [poi.lng, poi.lat] },
        properties: {
          id: poi.id,
          category: poi.category,
          icon: poi.icon,
          color: poi.color,
          name: poi.name || poi.category,
          isLandmark: poi.isLandmark ? 1 : 0,
        },
      })),
    };

    map.addSource('poi-points', {
      type: 'geojson',
      data: poisData,
    });

    map.addLayer({
      id: 'poi-points-glow',
      type: 'circle',
      source: 'poi-points',
      paint: {
        'circle-radius': ['case', ['==', ['get', 'isLandmark'], 1], 20, 14],
        'circle-color': ['to-color', ['get', 'color']],
        'circle-opacity': ['case', ['==', ['get', 'isLandmark'], 1], 0.2, 0.15],
        'circle-blur': 1,
      },
    });

    map.addLayer({
      id: 'poi-points',
      type: 'circle',
      source: 'poi-points',
      paint: {
        'circle-radius': ['case', ['==', ['get', 'isLandmark'], 1], 9, 7],
        'circle-color': ['to-color', ['get', 'color']],
        'circle-opacity': 0.9,
        'circle-stroke-width': ['case', ['==', ['get', 'isLandmark'], 1], 3, 2],
        'circle-stroke-color': ['case', ['==', ['get', 'isLandmark'], 1], '#D4AF37', '#ffffff'],
        'circle-stroke-opacity': 0.8,
      },
    });

    map.addLayer({
      id: 'poi-points-labels',
      type: 'symbol',
      source: 'poi-points',
      layout: {
        'text-field': ['case', ['==', ['get', 'isLandmark'], 1], ['concat', ['get', 'name'], ' ★'], ['get', 'name']],
        'text-size': ['case', ['==', ['get', 'isLandmark'], 1], 12, 10],
        'text-offset': ['case', ['==', ['get', 'isLandmark'], 1], ['literal', [0, 1.8]], ['literal', [0, 1.5]]],
        'text-anchor': 'top',
        'text-max-width': 12,
        'text-allow-overlap': false,
        'text-font': ['Open Sans Regular'],
      },
      paint: {
        'text-color': ['case', ['==', ['get', 'isLandmark'], 1], '#D4AF37', '#ffffff'],
        'text-halo-color': '#000000',
        'text-halo-width': ['case', ['==', ['get', 'isLandmark'], 1], 2, 1.5],
        'text-opacity': 0.9,
      },
    });

    map.on('click', 'poi-points', (e: any) => {
      if (e.features && e.features[0] && onPoiClick) {
        const props = e.features[0].properties;
        const matchingPoi = pois.find(p => p.id === props.id);
        if (matchingPoi) onPoiClick(matchingPoi);
      }
    });

    map.on('mouseenter', 'poi-points', () => { map.getCanvas().style.cursor = 'pointer'; });
    map.on('mouseleave', 'poi-points', () => { map.getCanvas().style.cursor = ''; });

  }, [pois, isReady, onPoiClick]);

  useEffect(() => {
    if (!mapRef.current || !isReady) return;
    const map = mapRef.current;

    ['coverage-circles-glow', 'coverage-circles', 'coverage-circles-labels'].forEach(id => {
      if (map.getLayer(id)) map.removeLayer(id);
    });
    if (map.getSource('coverage-towers')) map.removeSource('coverage-towers');

    if (!showCoverage || !coverageTowers || coverageTowers.length === 0) return;

    const opacity = (coverageOpacity ?? 50) / 100;

    const coverageData: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: coverageTowers.map(tower => ({
        type: 'Feature' as const,
        geometry: {
          type: 'Point' as const,
          coordinates: [tower.lng, tower.lat],
        },
        properties: {
          id: tower.id,
          operator: tower.operator,
          type: tower.type,
          range: tower.range,
          signal: tower.signalAtCenter,
          signalColor: tower.signalQuality.color,
          signalLabel: tower.signalQuality.label,
          frequency: tower.frequency,
          status: tower.status,
        },
      })),
    };

    map.addSource('coverage-towers', {
      type: 'geojson',
      data: coverageData,
    });

    map.addLayer({
      id: 'coverage-circles-glow',
      type: 'circle',
      source: 'coverage-towers',
      paint: {
        'circle-radius': [
          'interpolate', ['linear'], ['zoom'],
          5, ['*', ['get', 'range'], 0.3],
          10, ['*', ['get', 'range'], 2],
          15, ['*', ['get', 'range'], 8],
        ],
        'circle-color': ['to-color', ['get', 'signalColor']],
        'circle-opacity': opacity * 0.12,
        'circle-blur': 0.8,
      },
    });

    map.addLayer({
      id: 'coverage-circles',
      type: 'circle',
      source: 'coverage-towers',
      paint: {
        'circle-radius': [
          'interpolate', ['linear'], ['zoom'],
          5, 4,
          10, 7,
          15, 10,
        ],
        'circle-color': ['to-color', ['get', 'signalColor']],
        'circle-opacity': opacity * 0.9,
        'circle-stroke-width': 2,
        'circle-stroke-color': '#ffffff',
        'circle-stroke-opacity': opacity * 0.6,
      },
    });

    map.addLayer({
      id: 'coverage-circles-labels',
      type: 'symbol',
      source: 'coverage-towers',
      layout: {
        'text-field': ['concat', ['get', 'type'], ' · ', ['get', 'operator']],
        'text-size': 9,
        'text-offset': [0, 1.4],
        'text-anchor': 'top',
        'text-max-width': 10,
        'text-allow-overlap': false,
      },
      paint: {
        'text-color': ['to-color', ['get', 'signalColor']],
        'text-halo-color': '#000000',
        'text-halo-width': 1.5,
        'text-opacity': opacity,
      },
    });

    map.on('click', 'coverage-circles', (e: any) => {
      if (e.features && e.features[0] && onTowerClick) {
        const props = e.features[0].properties;
        const matchingTower = coverageTowers.find(t => t.id === props.id);
        if (matchingTower) onTowerClick(matchingTower);
      }
    });

    map.on('mouseenter', 'coverage-circles', () => { map.getCanvas().style.cursor = 'pointer'; });
    map.on('mouseleave', 'coverage-circles', () => { map.getCanvas().style.cursor = ''; });

    return () => {
      try {
        ['coverage-circles-glow', 'coverage-circles', 'coverage-circles-labels'].forEach(id => {
          if (map.getLayer(id)) map.removeLayer(id);
        });
        if (map.getSource('coverage-towers')) map.removeSource('coverage-towers');
      } catch {}
    };
  }, [coverageTowers, showCoverage, coverageOpacity, isReady, onTowerClick]);

  const switchStyle = useCallback(async (style: 'satellite' | 'dark' | 'streets') => {
    if (!mapRef.current) return;
    const map = mapRef.current;
    holdCamera(2500); // rechargement de style · rotation reprise après pose
    setMapStyle(style);

    try {
      const center = map.getCenter();
      const zoom = map.getZoom();
      const bearing = map.getBearing();
      const pitch = map.getPitch();

      setIsReady(false);

      const restoreView = () => {
        map.jumpTo({ center, zoom, bearing, pitch });
        try {
          (map as any).setProjection({ type: 'globe' });
        } catch {}
        setIsReady(true);
      };

      if (style === 'satellite') {
        map.setStyle(MAP_STYLE as any);
        map.once('style.load', restoreView);
      } else if (style === 'dark' || style === 'streets') {
        const kind = style === 'dark' ? 'dark' : 'voyager';
        let applied = false;
        const fallbackStyle = () => ({
          version: 8,
          sources: {
            'satellite': {
              type: 'raster',
              tiles: [
                'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',
                'https://mt2.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',
              ],
              tileSize: 256,
              maxzoom: 20,
              attribution: 'Imagery © Google',
            },
          },
          layers: [{ id: 'satellite-layer', type: 'raster', source: 'satellite' }],
        });
        const watchdog = setTimeout(() => {
          if (!applied) {
            applied = true;
            map.setStyle(fallbackStyle() as any);
            map.once('style.load', restoreView);
          }
        }, 4500);

        try {
          const res = await fetch(`/api/horus/basemap?style=${kind}`);
          if (!res.ok) throw new Error(`basemap ${res.status}`);
          const glStyle = await res.json();
          if (applied) return; // watchdog already fired
          applied = true;
          clearTimeout(watchdog);
          map.setStyle(glStyle);
          map.once('style.load', restoreView);
        } catch {
          if (applied) return;
          applied = true;
          clearTimeout(watchdog);
          map.setStyle(fallbackStyle() as any);
          map.once('style.load', restoreView);
        }
      } else {
        map.setStyle({
          version: 8,
          sources: {
            'osm': {
              type: 'raster',
              tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
              tileSize: 256,
              maxzoom: 19,
            },
          },
          layers: [{
            id: 'osm-layer',
            type: 'raster',
            source: 'osm',
          }],
        } as any);
        map.once('style.load', restoreView);
      }
    } catch (err) {
      console.error('Error switching style:', err);
      setIsReady(true);
    }
  }, [holdCamera]);

  const flyTo = useCallback((
    lat: number,
    lng: number,
    zoom: number = 14,
    opts?: { pitch?: number; bearing?: number; dur?: number }
  ) => {
    const dur = opts?.dur ?? 1500;
    holdCamera(dur + 400); // pas de rotation auto pendant le vol
    const m = mapRef.current;
    if (!m) return;
    // carte en cours de (re)chargement de style : le vol est mis en file et
    // rejoué au style.load — le voler maintenant tuerait la boucle de rendu
    if (!readyRef.current) {
      pendingFlyRef.current = { lat, lng, zoom, opts };
      return;
    }
    // chemin de longitude le plus COURT (écart de fuseau) : évite le cas
    // limite globe/_calcMatrices sur les vols qui traversent l'antiméridien
    let wlng = lng;
    try {
      const c = m.getCenter();
      wlng = lng - 360 * Math.round((lng - c.lng) / 360);
    } catch {}
    try {
      m.flyTo({
        center: [wlng, lat],
        zoom,
        pitch: opts?.pitch,
        bearing: opts?.bearing,
        duration: dur,
        essential: true,
      });
    } catch {
      // race maplibre (vol relancé pendant un vol en cours, matrices non prêtes) :
      // on interpropre proprement et on saute directement à la cible
      try {
        m.stop();
        m.jumpTo({ center: [wlng, lat], zoom });
      } catch {}
    }
  }, [holdCamera]);

  useEffect(() => {
    (window as any).__osirisMapFlyTo = flyTo;
    return () => { delete (window as any).__osirisMapFlyTo; };
  }, [flyTo]);

  useEffect(() => {
    (window as any).__osirisMapSetStyle = switchStyle;
    (window as any).__osirisMapResetView = () => flyTo(20, 0, 1.8, { pitch: 0, bearing: 0, dur: 2600 });
    (window as any).__osirisMapGetZoom = (): number | null => {
      try { return mapRef.current?.getZoom() ?? null; } catch { return null; }
    };
    (window as any).__osirisMapGetCenter = (): [number, number] | null => {
      try {
        const c = mapRef.current?.getCenter();
        return c ? [c.lng, c.lat] : null;
      } catch { return null; }
    };
    (window as any).__osirisMapRotating = (): boolean => rotActiveRef.current;
    (window as any).__osirisMapLayers = (): Record<string, boolean> | null => {
      const m = mapRef.current;
      if (!m) return null;
      try {
        return {
          points: !!m.getLayer('osint-points'),
          fovSource: !!m.getSource('camera-fov'),
          fovFill: !!m.getLayer('camera-fov-fill'),
          fovLine: !!m.getLayer('camera-fov-line'),
          buildings3D: !!m.getLayer('horus-3d-buildings'),
        };
      } catch {
        return null;
      }
    };
    (window as any).__osirisMapSet3D = (v: boolean) => {
      if (!!v !== buildings3DRef.current) toggle3DRef.current();
    };
    (window as any).__osirisMapSlowOrbit = (bearing: number, duration: number) => {
      const m = mapRef.current;
      if (!m || !Number.isFinite(bearing) || !Number.isFinite(duration) || duration <= 0) return;
      holdCamera(duration);
      try {
        m.easeTo({ bearing, duration, easing: (t: number) => t });
      } catch {
        try { m.stop(); } catch {}
      }
    };
    (window as any).__osirisMapSetZoom = (z: number, relative = false) => {
      const m = mapRef.current;
      if (!m || !Number.isFinite(z)) return;
      const current = m.getZoom();
      const target = relative
        ? Math.min(20, Math.max(1, current + z))
        : Math.min(20, Math.max(1, z));
      holdCamera(600);
      m.easeTo({ zoom: target, duration: 450 });
    };
    return () => {
      delete (window as any).__osirisMapSetStyle;
      delete (window as any).__osirisMapResetView;
      delete (window as any).__osirisMapGetZoom;
      delete (window as any).__osirisMapGetCenter;
      delete (window as any).__osirisMapRotating;
      delete (window as any).__osirisMapLayers;
      delete (window as any).__osirisMapSet3D;
      delete (window as any).__osirisMapSlowOrbit;
      delete (window as any).__osirisMapSetZoom;
    };
  }, [switchStyle, flyTo]);

  useEffect(() => {
    (window as any).__osirisMapProject = (lat: number, lng: number) => {
      const m = mapRef.current;
      if (!m) return null;
      try {
        const p = m.project([lng, lat]);
        return { x: p.x, y: p.y };
      } catch {
        return null;
      }
    };
    (window as any).__osirisMapOnMove = (cb: () => void) => {
      const m = mapRef.current;
      if (!m) return () => {};
      const handler = () => cb();
      m.on('move', handler);
      return () => m.off('move', handler);
    };
    return () => {
      delete (window as any).__osirisMapProject;
      delete (window as any).__osirisMapOnMove;
    };
  }, []);

  const getZoomDescription = (zoom: number) => {
    if (zoom < 3) return 'GLOBAL';
    if (zoom < 6) return 'CONTINENT';
    if (zoom < 10) return 'COUNTRY';
    if (zoom < 14) return 'CITY';
    if (zoom < 17) return 'DISTRICT';
    return 'STREET';
  };

  const threatColor = (threat: string) => {
    switch (threat) {
      case 'CRITICAL': return 'text-red-500';
      case 'HIGH': return 'text-red-400';
      case 'MEDIUM': return 'text-amber-400';
      case 'LOW': return 'text-green-400';
      default: return 'text-gray-400';
    }
  };

  return (
    <div className="relative w-full h-full">
      {!isReady && (
        <div className="absolute inset-0 flex items-center justify-center z-10 bg-black/80">
          <div className="flex flex-col items-center gap-3">
            <div className="w-12 h-12 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
            <span className="text-cyan-400 font-mono text-sm tracking-widest">INITIALIZING MAP...</span>
          </div>
        </div>
      )}

      <div ref={containerRef} className="w-full h-full" style={{ minHeight: '400px' }} />


      <div className="absolute top-3 left-3 z-40 w-72" data-tour="map-search">
        <div className="relative">
          <div className="flex items-center bg-black/90 border border-[rgba(212,175,55,0.3)] rounded-lg backdrop-blur-md shadow-lg">
            <Search className="w-4 h-4 text-[#D4AF37] ml-3 flex-shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setShowSearch(true)}
              placeholder="Search location..."
              className="flex-1 bg-transparent border-none outline-none text-gray-200 font-mono text-[11px] px-2 py-2 placeholder-gray-600"
            />
            {searchQuery && (
              <button onClick={() => { setSearchQuery(''); setSearchResults([]); }} className="p-1 mr-1 text-gray-500 hover:text-white">
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {showSearch && searchResults.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-black/95 border border-[rgba(212,175,55,0.2)] rounded-lg backdrop-blur-md shadow-xl overflow-hidden z-30">
              {searchResults.map((result, i) => (
                <button
                  key={i}
                  onClick={() => flyToResult(result)}
                  className="w-full flex items-start gap-2 px-3 py-2 hover:bg-white/5 transition-colors text-left"
                >
                  <MapPin className="w-3 h-3 text-[#D4AF37] mt-1 flex-shrink-0" />
                  <div className="min-w-0">
                    <div className="text-[11px] font-mono text-gray-200 truncate">{result.display_name?.split(',')[0]}</div>
                    <div className="text-[9px] font-mono text-gray-500 truncate">{result.display_name}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="absolute top-3 right-14 z-20 flex items-center gap-1">
        <div className="flex items-center gap-1 px-2 py-1 bg-black/80 border border-[rgba(212,175,55,0.3)] rounded backdrop-blur-sm">
          <Layers className="w-3 h-3 text-[#D4AF37] mr-1" />
          {[
            { id: 'satellite' as const, label: 'SAT' },
            { id: 'dark' as const, label: 'DARK' },
            { id: 'streets' as const, label: 'MAP' },
          ].map(s => (
            <button
              key={s.id}
              onClick={() => switchStyle(s.id)}
              className={`px-2 py-0.5 rounded text-[9px] font-mono tracking-wider transition-all ${
                mapStyle === s.id
                  ? 'bg-[rgba(212,175,55,0.2)] text-[#D4AF37] border border-[rgba(212,175,55,0.5)]'
                  : 'text-gray-500 hover:text-gray-300 border border-transparent hover:border-gray-700/50'
              }`}
            >
              {s.label}
            </button>
          ))}

          <span style={{ width: 1, height: 12, background: 'rgba(212,175,55,0.25)', margin: '0 2px' }} />
          <button
            data-tour="map-3d"
            onClick={toggle3D}
            title="Bâtiments semi-3D (données OpenStreetMap · OpenFreeMap) · incline la vue et extrude les toits au niveau rue"
            className={`px-2 py-0.5 rounded text-[9px] font-mono tracking-wider transition-all border ${
              buildings3D
                ? 'bg-[rgba(53,224,255,0.18)] text-[#7fe7ff] border-[rgba(53,224,255,0.6)]'
                : 'text-gray-500 hover:text-gray-300 border-transparent hover:border-gray-700/50'
            }`}
          >
            3D
          </button>
        </div>
      </div>

      {/* z-30 + bottom-16 : la pile de contrôle passait SOUS la barre de
          commande basse (hp-cmdbar) — le bouton de localisation devenait
          inclicable (« map blocked when locating »). */}
      <div className="absolute bottom-16 left-3 z-30 flex items-end gap-2">
        <div className="flex flex-col items-center gap-0.5">
          <button
            onClick={() => { holdCamera(500); mapRef.current?.zoomIn({ duration: 200 }); }}
            className="w-7 h-7 flex items-center justify-center bg-black/80 border border-[rgba(212,175,55,0.3)] rounded backdrop-blur-sm text-[#D4AF37] hover:bg-[rgba(212,175,55,0.15)] transition-colors"
            title="Zoom In"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
          <div className="relative w-7 h-24 bg-black/60 border border-[rgba(212,175,55,0.2)] rounded backdrop-blur-sm overflow-hidden">
            <div
              className="absolute bottom-0 left-0 right-0 bg-[rgba(212,175,55,0.12)]"
              style={{ height: `${Math.min(100, ((currentZoom - 1) / 19) * 100)}%` }}
            />
            <input
              type="range"
              min="1" max="20" step="0.1"
              value={currentZoom}
              onChange={(e) => {
                const z = parseFloat(e.target.value);
                holdCamera(500);
                mapRef.current?.easeTo({ zoom: z, duration: 300 });
              }}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              style={{ writingMode: 'vertical-lr', direction: 'rtl' } as React.CSSProperties}
              title="Zoom Level"
            />
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <span className="text-[8px] font-mono text-[#D4AF37] font-bold">{currentZoom.toFixed(0)}</span>
            </div>
          </div>
          <button
            onClick={() => { holdCamera(500); mapRef.current?.zoomOut({ duration: 200 }); }}
            className="w-7 h-7 flex items-center justify-center bg-black/80 border border-[rgba(212,175,55,0.3)] rounded backdrop-blur-sm text-[#D4AF37] hover:bg-[rgba(212,175,55,0.15)] transition-colors"
            title="Zoom Out"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>


          <button
            data-tour="geoloc"
            onClick={handleGeolocate}
            disabled={geoBusy}
            title="Auto-localisation · recentrer la carte sur votre position réelle"
            className="w-7 h-7 flex items-center justify-center bg-black/80 border rounded backdrop-blur-sm transition-colors disabled:opacity-60"
            style={{
              borderColor: geoPos ? 'rgba(53,224,255,0.75)' : 'rgba(212,175,55,0.3)',
              color: geoPos ? '#35e0ff' : '#D4AF37',
              boxShadow: geoPos ? '0 0 10px rgba(53,224,255,0.35)' : 'none',
            }}
          >
            {geoBusy ? (
              <span className="w-3.5 h-3.5 border-2 border-cyan-300 border-t-transparent rounded-full animate-spin" />
            ) : (
              <LocateFixed className="w-3.5 h-3.5" />
            )}
          </button>
        </div>

        <div className="px-2 py-1.5 bg-black/80 border border-[rgba(212,175,55,0.2)] rounded backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <span className="text-[9px] font-mono text-[#D4AF37]" style={{ letterSpacing: '0.1em' }}>
              {getZoomDescription(currentZoom)}
            </span>
            <span className="text-[8px] font-mono text-gray-600">|</span>
            <span className="text-[9px] font-mono text-gray-400">
              Z{currentZoom.toFixed(1)}
            </span>
            <span className="text-[8px] font-mono text-gray-600">|</span>
            <span className="text-[8px] font-mono text-gray-500">
              {currentCenter[1].toFixed(3)}, {currentCenter[0].toFixed(3)}
            </span>
            <span className="text-[8px] font-mono text-gray-600">|</span>
            <span className="text-[8px] font-mono text-gray-600">
              {currentZoom < 6 ? 'GLOBE' : 'FLAT'}
            </span>
          </div>
        </div>
      </div>

      {countryInfo && countryInfoPos && (
        <div
          className="absolute z-30 pointer-events-auto"
          style={{
            left: Math.min(countryInfoPos.x + 10, (containerRef.current?.clientWidth || 600) - 240),
            top: Math.min(countryInfoPos.y - 10, (containerRef.current?.clientHeight || 400) - 200),
          }}
        >
          <div className="w-56 bg-[#06060C]/95 border border-[rgba(212,175,55,0.3)] rounded-lg backdrop-blur-md shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 border-b border-[rgba(212,175,55,0.15)]" style={{ background: 'rgba(212,175,55,0.05)' }}>
              <div className="flex items-center gap-2">
                <Flag className="w-3.5 h-3.5 text-[#D4AF37]" />
                <span className="text-[11px] font-mono text-[#D4AF37] font-bold tracking-wider">{countryInfo.name}</span>
              </div>
              <button onClick={() => { setCountryInfo(null); setCountryInfoPos(null); }} className="text-gray-500 hover:text-white">
                <X className="w-3 h-3" />
              </button>
            </div>
            <div className="px-3 py-2 space-y-1.5">
              <div className="flex justify-between">
                <span className="text-[8px] font-mono text-gray-600" style={{ letterSpacing: '0.15em' }}>CAPITAL</span>
                <span className="text-[9px] font-mono text-gray-300">{countryInfo.capital}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[8px] font-mono text-gray-600" style={{ letterSpacing: '0.15em' }}>POPULATION</span>
                <span className="text-[9px] font-mono text-gray-300">{countryInfo.population}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[8px] font-mono text-gray-600" style={{ letterSpacing: '0.15em' }}>REGION</span>
                <span className="text-[9px] font-mono text-gray-300">{countryInfo.region}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[8px] font-mono text-gray-600" style={{ letterSpacing: '0.15em' }}>ISO</span>
                <span className="text-[9px] font-mono text-gray-300">{countryInfo.iso}</span>
              </div>
              <div className="flex justify-between items-center pt-1 border-t border-[rgba(212,175,55,0.1)]">
                <span className="text-[8px] font-mono text-gray-600" style={{ letterSpacing: '0.15em' }}>THREAT LEVEL</span>
                <span className={`text-[9px] font-mono font-bold ${threatColor(countryInfo.threat)}`}>
                  {countryInfo.threat}
                </span>
              </div>
            </div>
            <div className="px-3 py-1.5 border-t border-[rgba(212,175,55,0.1)] bg-black/40">
              <span className="text-[7px] font-mono text-gray-600" style={{ letterSpacing: '0.15em' }}>RIGHT-CLICK FOR REGION DOSSIER</span>
            </div>
          </div>
        </div>
      )}

      {geoNote && (
        <div className="absolute bottom-24 left-1/2 -translate-x-1/2 z-30 max-w-[440px] w-max" style={{ pointerEvents: 'auto' }}>
          <div
            className="flex items-center gap-2 px-3 py-2 rounded-lg backdrop-blur-md"
            style={{
              background: 'rgba(0,16,28,0.92)',
              border: '1px solid rgba(53,224,255,0.4)',
              boxShadow: '0 0 18px rgba(53,224,255,0.18)',
              fontSize: 10,
              fontFamily: 'ui-monospace, SFMono-Regular, monospace',
              letterSpacing: '0.05em',
              color: '#9ceaff',
            }}
          >
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#35e0ff', flexShrink: 0 }} />
            <span>{geoNote}</span>
            <button onClick={() => setGeoNote(null)} style={{ background: 'none', border: 0, color: '#ff8888', cursor: 'pointer', fontSize: 11 }}>✕</button>
          </div>
        </div>
      )}

      {showSearch && (
        <div className="absolute inset-0 z-10" onClick={() => setShowSearch(false)} />
      )}

      <div className="absolute inset-0 pointer-events-none scanlines opacity-20" />

      <style jsx global>{`
        .maplibregl-map {
          font-family: 'JetBrains Mono', 'Fira Code', monospace;
        }
        .maplibregl-ctrl-group {
          background: rgba(0, 0, 0, 0.8) !important;
          border: 1px solid rgba(212, 175, 55, 0.2) !important;
          border-radius: 4px !important;
        }
        .maplibregl-ctrl-group button {
          border-color: rgba(212, 175, 55, 0.1) !important;
        }
        .maplibregl-ctrl-group button span {
          filter: invert(1) brightness(2) sepia(1) hue-rotate(10deg);
        }
        .maplibregl-ctrl-group button:hover {
          background-color: rgba(212, 175, 55, 0.15) !important;
        }
        .maplibregl-ctrl-scale {
          background: rgba(0, 0, 0, 0.7) !important;
          border-color: rgba(212, 175, 55, 0.3) !important;
          color: #D4AF37 !important;
          font-family: 'JetBrains Mono', monospace !important;
          font-size: 9px !important;
        }
        .maplibregl-popup-content {
          background: rgba(6, 6, 12, 0.95) !important;
          border: 1px solid rgba(212, 175, 55, 0.3) !important;
          border-radius: 4px !important;
          color: #ccc !important;
          font-family: 'JetBrains Mono', monospace !important;
          font-size: 11px !important;
          padding: 8px 12px !important;
          backdrop-filter: blur(10px);
        }
        .maplibregl-popup-tip {
          border-top-color: rgba(6, 6, 12, 0.95) !important;
        }
        .maplibregl-popup-close-button {
          color: #ff4444 !important;
          font-size: 16px !important;
        }
      `}</style>
    </div>
  );
}
