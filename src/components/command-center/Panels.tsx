'use client';

import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import {
  Camera, Plane, Cable, Radio, Globe, Search, RefreshCw,
  ChevronRight, Signal, MapPin, ArrowUpDown, Wifi, AlertTriangle, Database, Flag, Shield, Activity, Zap, Flame,
  Cpu, Network, ExternalLink, Eye, Youtube
} from 'lucide-react';
import type { FlightData, SubmarineCable, CameraData, AntennaData, IPGeoData, MilitaryData, EarthquakeData, CyberThreatData, InternetOutageData, FireData, GDELTEvent, FOAFDevice } from '@/lib/osint-data';
import CameraViewer from '@/components/command-center/CameraViewer';

interface APIStatus {
  loading: boolean;
  error: string | null;
  source: string;
  timestamp: number | null;
}

const AFRICAN_COUNTRIES = new Set([
  'mali', 'senegal', 'ivory coast', 'côte d\u2019ivoire', "cote d'ivoire", 'nigeria', 'ghana',
  'cameroon', 'burkina faso', 'niger', 'guinea', 'gambia', 'mauritania', 'benin', 'togo',
  'liberia', 'sierra leone', 'morocco', 'algeria', 'tunisia', 'libya', 'egypt', 'sudan',
  'ethiopia', 'kenya', 'uganda', 'tanzania', 'rwanda', 'rwanda', 'somalia', 'djibouti',
  'angola', 'mozambique', 'zambia', 'zimbabwe', 'botswana', 'namibia', 'south africa',
  'lesotho', 'eswatini', 'madagascar', 'mauritius', 'seychelles', 'cape verde', 'gabon',
  'congo', 'democratic republic of the congo', 'chad', 'central african republic',
  'south sudan', 'equatorial guinea', 'sao tome and principe',
]);

export function CameraPanel({ onLocate, onView }: { onLocate?: (item: any) => void; onView?: (item: any) => void }) {
  const [cameras, setCameras] = useState<CameraData[]>([]);
  const [filter, setFilter] = useState<'all' | 'online' | 'offline' | 'youtube'>('all');
  const [countryFilter, setCountryFilter] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [scanning, setScanning] = useState(false);
  const [apiStatus, setApiStatus] = useState<APIStatus>({ loading: true, error: null, source: '', timestamp: null });

  const fetchCameras = useCallback(async () => {
    setScanning(true);
    try {
      const res = await fetch('/api/osint/cameras');
      const data = await res.json();
      if (data.cameras && data.cameras.length > 0) {
        setCameras(data.cameras);
      }
      setApiStatus({ loading: false, error: data.error || null, source: data.source || '', timestamp: data.timestamp });
    } catch (err: any) {
      setApiStatus(prev => ({ ...prev, loading: false, error: err.message }));
    }
    setScanning(false);
  }, []);

  useEffect(() => {
    fetchCameras();
    const interval = setInterval(fetchCameras, 300000); // 5 min refresh
    return () => clearInterval(interval);
  }, [fetchCameras]);

  const isYouTubeCam = (c: CameraData): boolean => {
    const url = c.streamUrl || '';
    return /youtube(-nocookie)?\.com|youtu\.be/.test(url);
  };

  const countryStats = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of cameras) {
      const country = (c.country || '').trim();
      if (!country) continue;
      m.set(country, (m.get(country) || 0) + 1);
    }
    const entries = [...m.entries()];
    const africa = entries
      .filter(([n]) => AFRICAN_COUNTRIES.has(n.toLowerCase()))
      .sort((a, b) => b[1] - a[1]);
    const rest = entries
      .filter(([n]) => !AFRICAN_COUNTRIES.has(n.toLowerCase()))
      .sort((a, b) => b[1] - a[1]);
    return [...africa.slice(0, 4), ...rest.slice(0, 6)].filter(([n]) => n);
  }, [cameras]);

  const filtered = cameras.filter(c => {
    if (filter === 'online' && c.status !== 'online') return false;
    if (filter === 'offline' && c.status !== 'offline') return false;
    if (filter === 'youtube' && !isYouTubeCam(c)) return false;
    if (countryFilter && (c.country || '') !== countryFilter) return false;
    if (searchTerm && !c.location.toLowerCase().includes(searchTerm.toLowerCase()) && !c.ip.includes(searchTerm)) return false;
    return true;
  });

  const onlineCount = cameras.filter(c => c.status === 'online').length;
  const youtubeCount = cameras.filter(isYouTubeCam).length;

  return (
    <PanelShell title="CAMERA NETWORK" icon={<Camera className="w-3.5 h-3.5" />} count={cameras.length > 0 ? `${onlineCount}/${cameras.length}` : 'N/D'} accent="emerald" apiStatus={apiStatus}>
      <div className="space-y-2 mb-2">
        <div className="flex gap-1.5">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-500" />
            <input
              type="text"
              placeholder="Search cameras..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full bg-black/50 border border-gray-700/50 rounded pl-7 pr-2 py-1 text-[10px] font-mono text-gray-300 placeholder:text-gray-600 focus:border-cyan-800 focus:outline-none"
            />
          </div>
          <button onClick={fetchCameras} className="px-2 py-1 bg-black/50 border border-gray-700/50 rounded hover:border-cyan-700 transition-colors">
            <RefreshCw className={`w-3 h-3 text-gray-400 ${scanning ? 'animate-spin' : ''}`} />
          </button>
        </div>
        <div className="flex gap-1 flex-wrap">
          {(['all', 'online', 'offline', 'youtube'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-2 py-0.5 text-[9px] font-mono rounded border transition-colors flex items-center gap-1 ${
                filter === f
                  ? f === 'youtube'
                    ? 'bg-red-900/50 border-red-700/50 text-red-400'
                    : 'bg-cyan-900/50 border-cyan-700/50 text-cyan-400'
                  : 'bg-black/30 border-gray-700/30 text-gray-500 hover:text-gray-300'
              }`}
            >
              {f === 'youtube' && <Youtube className="w-2.5 h-2.5" />}
              {f === 'youtube' ? `YT LIVE (${youtubeCount})` : f.toUpperCase()}
            </button>
          ))}
        </div>
        {countryStats.length > 0 && (
          <div className="flex gap-1 flex-wrap">
            {countryStats.map(([country, count]) => {
              const isAfrica = AFRICAN_COUNTRIES.has(country.toLowerCase());
              const active = countryFilter === country;
              return (
                <button
                  key={country}
                  onClick={() => setCountryFilter(active ? null : country)}
                  className={`px-1.5 py-px text-[8px] font-mono rounded border transition-colors flex items-center gap-0.5 ${
                    active
                      ? isAfrica
                        ? 'bg-amber-900/60 border-amber-700/60 text-amber-300'
                        : 'bg-cyan-900/60 border-cyan-700/60 text-cyan-300'
                      : isAfrica
                        ? 'bg-amber-950/40 border-amber-800/30 text-amber-500/80 hover:text-amber-400'
                        : 'bg-black/30 border-gray-700/30 text-gray-500 hover:text-gray-300'
                  }`}
                  title={`${country} · ${count} caméras${isAfrica ? ' (région AES)' : ''}`}
                >
                  {isAfrica && <Flag className="w-2 h-2" />}
                  {country.slice(0, 12).toUpperCase()}·{count}
                </button>
              );
            })}
            {countryFilter && (
              <button onClick={() => setCountryFilter(null)} className="px-1.5 py-px text-[8px] font-mono rounded border border-red-800/40 text-red-400/90 hover:text-red-300 transition-colors">
                ✕ PAYS
              </button>
            )}
          </div>
        )}
      </div>
      <div className="flex-1 overflow-y-auto custom-scrollbar space-y-1">
        {apiStatus.loading && cameras.length === 0 ? <LoadingMessage /> : null}
        {filtered.slice(0, 40).map(cam => {
          const isYt = isYouTubeCam(cam);
          const thumb = cam.snapshotUrl
            ? `/api/osint/camera-proxy?url=${encodeURIComponent(cam.snapshotUrl)}`
            : '';
          return (
            <div key={cam.id} onClick={() => onLocate?.(cam)} className="flex items-start gap-2 px-2 py-1.5 bg-black/30 rounded hover:bg-black/50 transition-colors group cursor-pointer">
              {thumb ? (
                <div className="w-13 h-9 flex-shrink-0 rounded overflow-hidden border border-gray-700/40 bg-black/60 relative" style={{ width: 52, height: 36 }}>
                  <img
                    src={thumb}
                    alt=""
                    loading="lazy"
                    className="w-full h-full object-cover"
                    onError={e => { (e.target as HTMLImageElement).src = ''; (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                </div>
              ) : (
                <div className="flex-shrink-0 rounded border border-gray-700/40 bg-black/60 flex items-center justify-center" style={{ width: 52, height: 36 }}>
                  <Camera className={`w-3 h-3 ${cam.status === 'online' ? 'text-emerald-700' : 'text-red-900'}`} />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono text-gray-300 truncate flex items-center gap-1">
                    {cam.id}
                    {isYt && (
                      <span className="inline-flex items-center gap-0.5 px-1 py-px text-[7px] font-mono font-bold bg-red-600/30 border border-red-500/40 text-red-400 rounded">
                        <Youtube className="w-2 h-2" />YT
                      </span>
                    )}
                  </span>
                  <span className="text-[9px] font-mono text-gray-600">{cam.port}</span>
                </div>
                <div className="text-[9px] font-mono text-gray-500 truncate">
                  {cam.name && cam.name !== cam.location ? `${cam.name} · ${cam.location}` : cam.location}
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${cam.status === 'online' ? 'bg-green-400 animate-pulse' : 'bg-red-500'}`} />
                  <span className="text-[9px] font-mono text-gray-600">{cam.ip}</span>
                  <span className="text-[9px] font-mono text-gray-600">•</span>
                  <span className="text-[9px] font-mono text-gray-600">{cam.type}</span>
                  {isYt && (
                    <>
                      <span className="text-[9px] font-mono text-gray-600">•</span>
                      <span className="text-[9px] font-mono text-red-500/80">PUBLIC STREAM</span>
                    </>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={(e) => { e.stopPropagation(); if (onView) { onView(cam); onLocate?.(cam); } }}
                  className={`px-1.5 py-0.5 text-[8px] font-mono rounded transition-colors ${
                    isYt
                      ? 'bg-red-900/40 border border-red-700/40 text-red-400 hover:bg-red-800/50 hover:border-red-600/50'
                      : 'bg-cyan-900/40 border border-cyan-700/40 text-cyan-400 hover:bg-cyan-800/50 hover:border-cyan-600/50'
                  }`}
                  title={isYt ? 'View public YouTube stream' : 'View camera stream'}
                >
                  <Eye className="w-3 h-3" />
                </button>
                <ChevronRight className="w-3 h-3 text-gray-600" />
              </div>
            </div>
          );
        })}
      </div>
    </PanelShell>
  );
}

export function FlightPanel({ onLocate }: { onLocate?: (item: any) => void }) {
  const [flights, setFlights] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [apiStatus, setApiStatus] = useState<APIStatus>({ loading: true, error: null, source: '', timestamp: null });

  const fetchFlights = useCallback(async () => {
    try {
      const res = await fetch('/api/osint/flights');
      const data = await res.json();
      if (data.flights) {
        setFlights(data.flights);
      }
      setApiStatus({ loading: false, error: data.error || null, source: data.source || '', timestamp: data.timestamp });
    } catch (err: any) {
      setApiStatus(prev => ({ ...prev, loading: false, error: err.message }));
    }
  }, []);

  useEffect(() => {
    fetchFlights();
    const interval = setInterval(fetchFlights, 15000); // 15s refresh for live flights
    return () => clearInterval(interval);
  }, [fetchFlights]);

  const filtered = flights.filter(f =>
    !searchTerm || f.callsign?.toLowerCase().includes(searchTerm.toLowerCase()) || f.originCountry?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <PanelShell title="FLIGHT TRACKER" icon={<Plane className="w-3.5 h-3.5" />} count={`${flights.length} ACTIVE`} accent="blue" apiStatus={apiStatus}>
      <div className="mb-2">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-500" />
          <input
            type="text"
            placeholder="Search callsign, country..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full bg-black/50 border border-gray-700/50 rounded pl-7 pr-2 py-1 text-[10px] font-mono text-gray-300 placeholder:text-gray-600 focus:border-blue-800 focus:outline-none"
          />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto custom-scrollbar space-y-1">
        {apiStatus.loading && flights.length === 0 ? <LoadingMessage /> : null}
        {!apiStatus.loading && flights.length === 0 && (
          <div className="px-3 py-2 space-y-1">
            {apiStatus.error ? (
              <>
                <div className="flex items-center gap-1.5 text-red-400">
                  <AlertTriangle className="w-3 h-3 flex-shrink-0" />
                  <span className="text-[9px] font-mono font-bold tracking-wider">ADS-B SOURCE UNAVAILABLE</span>
                </div>
                <div className="text-[9px] font-mono text-gray-600 leading-relaxed">{apiStatus.error}</div>
                <div className="flex items-center gap-1.5 text-gray-600">
                  <RefreshCw className="w-2.5 h-2.5 animate-spin" />
                  <span className="text-[8px] font-mono">Auto-retry every 15s — fallback providers engaged</span>
                </div>
              </>
            ) : (
              <div className="flex items-center gap-1.5 text-gray-500">
                <RefreshCw className="w-2.5 h-2.5 animate-spin" />
                <span className="text-[9px] font-mono">SCANNING ADS-B HOTSPOT GRID — pooling traffic...</span>
              </div>
            )}
          </div>
        )}
        {filtered.length > 0 && filtered.slice(0, 25).map((f, i) => (
          <div key={`${f.icao24}-${i}`} onClick={() => onLocate?.(f)} className="px-2 py-1.5 bg-black/30 rounded hover:bg-black/50 transition-colors cursor-pointer">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono text-blue-400 font-bold">{f.callsign || f.icao24}</span>
              <span className="text-[9px] font-mono text-gray-500">{f.originCountry}</span>
            </div>
            <div className="flex items-center gap-3 mt-0.5">
              <span className="text-[9px] font-mono text-gray-600">FL{Math.round((f.altitude || 0) / 100)}</span>
              <span className="text-[9px] font-mono text-gray-600">{f.velocity ? `${f.velocity}kts` : 'N/D'}</span>
              <span className="text-[9px] font-mono text-gray-600">{f.heading ? `HDG ${f.heading}°` : 'N/D'}</span>
              <span className={`text-[9px] font-mono ${f.verticalRate > 0 ? 'text-green-500' : f.verticalRate < 0 ? 'text-red-500' : 'text-gray-600'}`}>
                {f.verticalRate ? `${f.verticalRate > 0 ? '↑' : '↓'} ${Math.abs(f.verticalRate)}fpm` : ''}
              </span>
            </div>
            <div className="text-[8px] font-mono text-gray-700 mt-0.5">ICAO: {f.icao24} {f.squawk ? `• SQK: ${f.squawk}` : ''}</div>
          </div>
        ))}
      </div>
    </PanelShell>
  );
}

export function CablePanel({ onLocate }: { onLocate?: (item: any) => void }) {
  const [cables, setCables] = useState<SubmarineCable[]>([]);
  const [filter, setFilter] = useState<string>('all');
  const [apiStatus, setApiStatus] = useState<APIStatus>({ loading: true, error: null, source: '', timestamp: null });

  const fetchCables = useCallback(async () => {
    try {
      const res = await fetch('/api/osint/cables');
      const data = await res.json();
      if (data.cables) {
        setCables(data.cables);
      }
      setApiStatus({ loading: false, error: data.error || null, source: data.source || '', timestamp: data.timestamp });
    } catch (err: any) {
      setApiStatus(prev => ({ ...prev, loading: false, error: err.message }));
    }
  }, []);

  useEffect(() => {
    fetchCables();
    const interval = setInterval(fetchCables, 600000); // 10 min · cable data changes slowly
    return () => clearInterval(interval);
  }, [fetchCables]);

  const statuses = ['all', ...new Set(cables.map(c => c.status))];
  const filtered = filter === 'all' ? cables : cables.filter(c => c.status === filter);
  const activeCount = cables.filter(c => c.status === 'active').length;
  const outageCount = cables.filter(c => c.status === 'outage').length;

  const statusColor = (status: string) => {
    switch (status) {
      case 'active': return 'text-green-400';
      case 'outage': return 'text-red-400 animate-pulse';
      case 'under_construction': return 'text-amber-400';
      case 'maintenance': return 'text-yellow-400';
      case 'planned': return 'text-blue-400';
      default: return 'text-gray-400';
    }
  };

  const statusIcon = (status: string) => {
    switch (status) {
      case 'active': return '●';
      case 'outage': return '⬤';
      case 'under_construction': return '◐';
      case 'maintenance': return '◆';
      case 'planned': return '○';
      default: return '·';
    }
  };

  return (
    <PanelShell title="SUBMARINE CABLES" icon={<Cable className="w-3.5 h-3.5" />} count={`${activeCount} ACTIVE${outageCount > 0 ? ` / ${outageCount} OUTAGE` : ''}`} accent="purple" apiStatus={apiStatus}>
      <div className="mb-2 space-y-1.5">
        <div className="flex flex-wrap gap-1">
          {statuses.map(s => (
            <button key={s} onClick={() => setFilter(s)} className={`px-1.5 py-0.5 text-[8px] font-mono rounded border transition-colors ${filter === s ? 'bg-purple-900/50 border-purple-700/50 text-purple-400' : 'bg-black/30 border-gray-700/30 text-gray-500 hover:text-gray-300'}`}>
              {s === 'all' ? 'ALL' : s.replace('_', ' ').toUpperCase()}
            </button>
          ))}
        </div>
        {cables.length > 0 && (
          <div className="grid grid-cols-3 gap-1 text-center">
            <div className="bg-black/40 border border-green-900/30 rounded px-1 py-1">
              <div className="text-green-400 font-mono text-[11px] font-bold">{activeCount}</div>
              <div className="text-[7px] font-mono text-gray-600">ACTIVE</div>
            </div>
            <div className="bg-black/40 border border-amber-900/30 rounded px-1 py-1">
              <div className="text-amber-400 font-mono text-[11px] font-bold">{cables.filter(c => c.status === 'under_construction').length}</div>
              <div className="text-[7px] font-mono text-gray-600">BUILD</div>
            </div>
            <div className="bg-black/40 border border-red-900/30 rounded px-1 py-1">
              <div className="text-red-400 font-mono text-[11px] font-bold">{outageCount}</div>
              <div className="text-[7px] font-mono text-gray-600">OUTAGE</div>
            </div>
          </div>
        )}
      </div>
      <div className="flex-1 overflow-y-auto custom-scrollbar space-y-1">
        {apiStatus.loading && cables.length === 0 ? <LoadingMessage /> : null}
        {filtered.map((cable) => (
          <div key={cable.id} onClick={() => onLocate?.(cable.landingPoints?.[0] ?? cable)} className="px-2 py-1.5 bg-black/30 rounded hover:bg-black/50 transition-colors cursor-pointer">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono text-purple-400 font-bold truncate">{cable.name}</span>
              <span className={`${statusColor(cable.status)} text-[9px] font-mono flex-shrink-0`}>{statusIcon(cable.status)} {cable.status.replace('_', ' ').toUpperCase()}</span>
            </div>
            <div className="flex items-center gap-3 mt-0.5">
              <span className="text-[9px] font-mono text-gray-500">{cable.length.toLocaleString()} km</span>
              <span className="text-[9px] font-mono text-gray-600">{cable.capacity}</span>
              <span className="text-[9px] font-mono text-gray-600">RFS {cable.rfsYear}</span>
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[9px] font-mono text-gray-600">{cable.landingPoints.length} landing points</span>
              {cable.owners.length > 0 && (
                <span className="text-[9px] font-mono text-gray-700 truncate">{cable.owners[0]}{cable.owners.length > 1 ? ` +${cable.owners.length - 1}` : ''}</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </PanelShell>
  );
}

export function AntennaPanel({ onLocate }: { onLocate?: (item: any) => void }) {
  const [antennas, setAntennas] = useState<any[]>([]);
  const [selectedType, setSelectedType] = useState<string>('all');
  const [apiStatus, setApiStatus] = useState<APIStatus>({ loading: true, error: null, source: '', timestamp: null });

  const fetchAntennas = useCallback(async () => {
    try {
      const res = await fetch('/api/osint/antennas');
      const data = await res.json();
      if (data.antennas) {
        setAntennas(data.antennas);
      }
      setApiStatus({ loading: false, error: data.error || null, source: data.source || '', timestamp: data.timestamp });
    } catch (err: any) {
      setApiStatus(prev => ({ ...prev, loading: false, error: err.message }));
    }
  }, []);

  useEffect(() => {
    fetchAntennas();
    const interval = setInterval(fetchAntennas, 300000);
    return () => clearInterval(interval);
  }, [fetchAntennas]);

  const types = ['all', ...new Set(antennas.map(a => a.type))];
  const filtered = selectedType === 'all' ? antennas : antennas.filter(a => a.type === selectedType);
  const activeCount = antennas.filter(a => a.status === 'active').length;

  return (
    <PanelShell title="NETWORK ANTENNAS" icon={<Radio className="w-3.5 h-3.5" />} count={`${activeCount}/${antennas.length}`} accent="amber" apiStatus={apiStatus}>
      <div className="mb-2">
        <div className="flex flex-wrap gap-1">
          {types.slice(0, 7).map(t => (
            <button key={t} onClick={() => setSelectedType(t)} className={`px-1.5 py-0.5 text-[8px] font-mono rounded border transition-colors ${selectedType === t ? 'bg-amber-900/50 border-amber-700/50 text-amber-400' : 'bg-black/30 border-gray-700/30 text-gray-500 hover:text-gray-300'}`}>
              {t}
            </button>
          ))}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto custom-scrollbar space-y-1">
        {apiStatus.loading && antennas.length === 0 ? <LoadingMessage /> : null}
        {filtered.slice(0, 18).map(ant => (
          <div key={ant.id} onClick={() => onLocate?.(ant)} className="flex items-start gap-2 px-2 py-1.5 bg-black/30 rounded hover:bg-black/50 transition-colors cursor-pointer">
            <Signal className={`w-3 h-3 mt-0.5 flex-shrink-0 ${ant.status === 'active' ? 'text-amber-400' : 'text-red-500'}`} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono text-gray-300">{ant.id}</span>
                <span className="text-[9px] font-mono text-gray-600">{ant.operator}</span>
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[9px] font-mono px-1 py-0.5 bg-amber-900/30 rounded text-amber-400">{ant.type}</span>
                <span className="text-[9px] font-mono text-gray-600">{ant.frequency}</span>
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[9px] font-mono text-gray-600">{ant.power}dBm</span>
                <span className="text-[9px] font-mono text-gray-600">~{ant.range}km</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </PanelShell>
  );
}

export function IPGeoPanel({ onLocate }: { onLocate?: (item: any) => void }) {
  const [ipInput, setIpInput] = useState('');
  const [result, setResult] = useState<any>(null);
  const [searching, setSearching] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = useCallback(async () => {
    if (!ipInput.trim()) return;
    setSearching(true);
    setError(null);
    try {
      const res = await fetch(`/api/osint/ipgeo?ip=${encodeURIComponent(ipInput.trim())}`);
      const data = await res.json();
      if (data.error) {
        setError(data.error);
      } else {
        setResult(data);
        setHistory(prev => [data, ...prev.slice(0, 9)]);
      }
    } catch (err: any) {
      setError(err.message);
    }
    setSearching(false);
  }, [ipInput]);

  return (
    <PanelShell title="IP GEOLOCATION" icon={<Globe className="w-3.5 h-3.5" />} count={`${history.length} QUERIED`} accent="cyan" apiStatus={{ loading: false, error: null, source: 'ip-api.com', timestamp: null }}>
      <div className="mb-2 space-y-1.5">
        <div className="flex gap-1.5">
          <input
            type="text"
            placeholder="Enter IP address (e.g. 8.8.8.8)"
            value={ipInput}
            onChange={e => setIpInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
            className="flex-1 bg-black/50 border border-gray-700/50 rounded px-2 py-1 text-[10px] font-mono text-gray-300 placeholder:text-gray-600 focus:border-cyan-700 focus:outline-none"
          />
          <button onClick={handleSearch} disabled={searching} className="px-3 py-1 bg-cyan-900/50 border border-cyan-700/50 rounded text-[10px] font-mono text-cyan-400 hover:bg-cyan-800/50 transition-colors disabled:opacity-50">
            {searching ? '...' : 'TRACE'}
          </button>
        </div>
        {error && <div className="text-[9px] font-mono text-red-400 bg-red-900/20 px-2 py-1 rounded">{error}</div>}
        {result && (
          <div onClick={() => onLocate?.(result)} className="bg-black/50 border border-cyan-900/30 rounded p-2 space-y-1 cursor-pointer">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono text-cyan-400 font-bold">{result.ip}</span>
              <div className="flex items-center gap-1">
                <Wifi className="w-3 h-3 text-green-400" />
                <span className="text-[8px] font-mono text-green-400">LIVE</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
              <InfoRow label="City" value={result.city} />
              <InfoRow label="Country" value={result.country} />
              <InfoRow label="Region" value={result.regionName} />
              <InfoRow label="ISP" value={result.isp} />
              <InfoRow label="Org" value={result.org} />
              <InfoRow label="ASN" value={result.asn} />
              <InfoRow label="TZ" value={result.timezone} />
              <InfoRow label="ZIP" value={result.zip} />
              <InfoRow label="Lat" value={typeof result.lat === 'number' ? result.lat.toFixed(4) : 'N/D'} />
              <InfoRow label="Lng" value={typeof result.lng === 'number' ? result.lng.toFixed(4) : 'N/D'} />
            </div>
          </div>
        )}
      </div>
      {history.length > 0 && (
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          <div className="text-[9px] font-mono text-gray-600 mb-1">RECENT QUERIES</div>
          <div className="space-y-1">
            {history.map((h, i) => (
              <div key={`${h.ip}-${i}`} onClick={() => onLocate?.(h)} className="flex items-center gap-2 px-2 py-1 bg-black/30 rounded hover:bg-black/50 transition-colors cursor-pointer group">
                <MapPin className="w-2.5 h-2.5 text-gray-500" />
                <span className="text-[10px] font-mono text-gray-400">{h.ip}</span>
                <span className="text-[9px] font-mono text-gray-600 flex-1 truncate">{h.city}, {h.country}</span>
                <ChevronRight className="w-2.5 h-2.5 text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            ))}
          </div>
        </div>
      )}
    </PanelShell>
  );
}


function PanelShell({
  title, icon, count, accent, apiStatus, children
}: {
  title: string;
  icon: React.ReactNode;
  count: string;
  accent: string;
  apiStatus?: APIStatus;
  children: React.ReactNode;
}) {
  const accentColors: Record<string, string> = {
    emerald: 'border-emerald-900/40',
    blue: 'border-blue-900/40',
    purple: 'border-purple-900/40',
    amber: 'border-amber-900/40',
    cyan: 'border-cyan-900/40',
    orange: 'border-orange-900/40',
    pink: 'border-pink-900/40',
    yellow: 'border-yellow-900/40',
    red: 'border-red-900/40',
  };
  const textColors: Record<string, string> = {
    emerald: 'text-emerald-400',
    blue: 'text-blue-400',
    purple: 'text-purple-400',
    amber: 'text-amber-400',
    cyan: 'text-cyan-400',
    orange: 'text-orange-400',
    pink: 'text-pink-400',
    yellow: 'text-yellow-400',
    red: 'text-red-400',
  };

  return (
    <div className={`h-full flex flex-col bg-black/60 border ${accentColors[accent] || 'border-gray-800'} rounded-lg backdrop-blur-sm`}>
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-800/50">
        <div className="flex items-center gap-2">
          <span className={textColors[accent] || 'text-gray-400'}>{icon}</span>
          <span className={`${textColors[accent] || 'text-gray-400'} font-mono text-[11px] font-bold tracking-wider`}>{title}</span>
          {apiStatus?.loading && <div className="w-1.5 h-1.5 bg-yellow-400 rounded-full animate-pulse" />}
          {apiStatus?.error && <AlertTriangle className="w-3 h-3 text-red-400" />}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-gray-500 font-mono text-[9px]">{count}</span>
        </div>
      </div>
      {apiStatus?.source && (
        <div className="flex items-center gap-1 px-3 py-1 bg-black/30 border-b border-gray-800/30">
          <Database className="w-2.5 h-2.5 text-gray-600" />
          <span className="text-[8px] font-mono text-gray-600 truncate">SRC: {apiStatus.source}</span>
          {apiStatus.timestamp && (
            <span className="text-[8px] font-mono text-gray-700 ml-auto">
              {new Date(apiStatus.timestamp).toLocaleTimeString()}
            </span>
          )}
        </div>
      )}
      <div className="flex-1 flex flex-col p-2 overflow-hidden">
        {children}
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-1">
      <span className="text-[9px] font-mono text-gray-600 flex-shrink-0">{label}:</span>
      <span className="text-[9px] font-mono text-gray-400 truncate">{value}</span>
    </div>
  );
}

function LoadingMessage() {
  return (
    <div className="flex items-center gap-2 px-3 py-2">
      <RefreshCw className="w-3 h-3 text-gray-500 animate-spin" />
      <span className="text-[10px] font-mono text-gray-500">Fetching live data...</span>
    </div>
  );
}

export function MilitaryPanel({ onLocate }: { onLocate?: (item: any) => void }) {
  const [units, setUnits] = useState<MilitaryData[]>([]);
  const [apiStatus, setApiStatus] = useState<APIStatus>({ loading: true, error: null, source: '', timestamp: null });
  const [searchQuery, setSearchQuery] = useState('');
  const [filterSide, setFilterSide] = useState<string>('all');

  const fetchData = useCallback(async () => {
    setApiStatus(prev => ({ ...prev, loading: true, error: null }));
    try {
      const res = await fetch('/api/osint/military');
      const data = await res.json();
      setUnits(data.units || []);
      setApiStatus({ loading: false, error: null, source: data.source || 'OSINT', timestamp: data.timestamp });
    } catch (err: any) {
      setApiStatus({ loading: false, error: err.message, source: 'Error', timestamp: null });
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => {
    const interval = setInterval(fetchData, 300000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const filtered = units.filter(u => {
    if (searchQuery && !u.name.toLowerCase().includes(searchQuery.toLowerCase()) && !u.location.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    if (filterSide !== 'all' && u.side !== filterSide) return false;
    return true;
  });

  return (
    <div className="flex flex-col h-full">
      <PanelShell title="MILITARY INTEL" icon={<Flag className="w-3.5 h-3.5" />} count={String(units.length)} accent="text-red-400" apiStatus={apiStatus}>
        <div className="flex items-center gap-1.5 mb-2">
          <div className="flex-1 relative">
            <Search className="w-3 h-3 absolute left-2 top-1/2 -translate-y-1/2 text-gray-600" />
            <input
              type="text" placeholder="Search units..." value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-black/40 border border-gray-700/50 rounded pl-7 pr-2 py-1 text-[10px] font-mono text-gray-300 placeholder-gray-600 focus:outline-none focus:border-red-700/50"
            />
          </div>
        </div>
        <div className="flex gap-1 mb-2">
          {['all', 'Ukraine', 'NATO'].map(side => (
            <button key={side} onClick={() => setFilterSide(side)}
              className={`px-1.5 py-0.5 text-[8px] font-mono rounded border transition-colors ${
                filterSide === side ? 'bg-red-900/40 border-red-700/50 text-red-400' : 'border-gray-700/30 text-gray-600 hover:text-gray-400'
              }`}>{side === 'all' ? 'ALL' : side.toUpperCase()}</button>
          ))}
        </div>
        <div className="flex-1 overflow-y-auto custom-scrollbar space-y-1">
          {filtered.map(u => (
            <div key={u.id} onClick={() => onLocate?.(u)} className="flex items-start gap-2 px-2 py-1.5 rounded bg-black/30 border border-gray-800/40 hover:border-red-900/40 transition-colors cursor-pointer">
              <div className="w-6 h-6 flex items-center justify-center rounded bg-red-900/40 border border-red-800/50 flex-shrink-0 mt-0.5">
                <Flag className="w-3 h-3 text-red-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-mono text-gray-300 font-bold truncate">{u.name}</span>
                  <span className={`text-[7px] font-mono px-1 py-0.5 rounded ${u.side === 'Ukraine' ? 'bg-blue-900/40 text-blue-400 border border-blue-800/50' : u.side === 'NATO' ? 'bg-emerald-900/40 text-emerald-400 border border-emerald-800/50' : 'bg-gray-800/40 text-gray-400'}`}>{u.side}</span>
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[8px] font-mono text-red-400">{u.type}</span>
                  <span className="text-[8px] font-mono text-gray-600">{u.location}</span>
                </div>
                <InfoRow label="Force" value={u.strength} />
                <InfoRow label="Role" value={u.role} />
                <div className="flex items-center gap-1 mt-0.5">
                  <div className={`w-1.5 h-1.5 rounded-full ${u.status === 'active' ? 'bg-green-400' : 'bg-yellow-400'}`} />
                  <span className="text-[8px] font-mono text-gray-500">{u.status?.toUpperCase()}</span>
                  <span className="text-[8px] font-mono text-gray-700 ml-auto">{u.lastUpdated}</span>
                </div>
              </div>
            </div>
          ))}
          {filtered.length === 0 && <div className="text-center py-4 text-[10px] font-mono text-gray-600">No units found</div>}
        </div>
      </PanelShell>
    </div>
  );
}

export function EarthquakePanel({ onLocate }: { onLocate?: (item: any) => void }) {
  const [earthquakes, setEarthquakes] = useState<EarthquakeData[]>([]);
  const [apiStatus, setApiStatus] = useState<APIStatus>({ loading: true, error: null, source: '', timestamp: null });

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/osint/earthquakes');
      const data = await res.json();
      if (data.earthquakes) setEarthquakes(data.earthquakes);
      setApiStatus({ loading: false, error: data.error || null, source: data.source || '', timestamp: data.timestamp });
    } catch (err: any) {
      setApiStatus(prev => ({ ...prev, loading: false, error: err.message }));
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 120000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const severityBadge = (severity: string) => {
    const colors: Record<string, string> = {
      minor: 'bg-yellow-900/40 text-yellow-400 border-yellow-800/50',
      moderate: 'bg-orange-900/40 text-orange-400 border-orange-800/50',
      strong: 'bg-red-900/40 text-red-400 border-red-800/50',
      major: 'bg-red-800/40 text-red-300 border-red-700/50',
      great: 'bg-red-700/40 text-red-200 border-red-600/50',
    };
    return colors[severity] || 'bg-gray-900/40 text-gray-400';
  };

  return (
    <PanelShell title="SEISMIC INTEL" icon={<Activity className="w-3.5 h-3.5" />} count={earthquakes.length > 0 ? String(earthquakes.length) : 'N/D'} accent="orange" apiStatus={apiStatus}>
      <div className="flex items-center gap-2 mb-2 px-1">
        <span className="text-[8px] font-mono text-gray-600">USGS + Wikipedia</span>
        <span className="text-[8px] font-mono text-orange-400 ml-auto">{earthquakes.filter(e => e.severity === 'strong' || e.severity === 'major' || e.severity === 'great').length} SIGNIFICANT</span>
      </div>
      <div className="flex-1 overflow-y-auto custom-scrollbar space-y-1">
        {earthquakes.slice(0, 50).map(eq => (
          <div key={eq.id} onClick={() => onLocate?.(eq)} className="flex items-start gap-2 px-2 py-1.5 rounded bg-black/30 border border-gray-800/40 hover:border-orange-900/40 transition-colors cursor-pointer">
            <div className="w-6 h-6 flex items-center justify-center rounded bg-orange-900/40 border border-orange-800/50 flex-shrink-0 mt-0.5">
              <Activity className="w-3 h-3 text-orange-400" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-mono text-orange-400 font-bold">M{eq.magnitude}</span>
                <span className={`text-[7px] font-mono px-1 py-0.5 rounded border ${severityBadge(eq.severity)}`}>{eq.severity.toUpperCase()}</span>
                {eq.tsunami && <span className="text-[7px] font-mono px-1 py-0.5 rounded bg-blue-900/40 text-blue-400 border border-blue-800/50">TSUNAMI</span>}
                {(eq as any).wikipedia && <span className="text-[7px] font-mono px-1 py-0.5 rounded bg-blue-900/30 text-blue-300 border border-blue-700/40">WIKI</span>}
              </div>
              <div className="text-[8px] font-mono text-gray-400 truncate mt-0.5">{eq.place}</div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[8px] font-mono text-gray-600">Depth: {eq.depth}km</span>
                <span className="text-[8px] font-mono text-gray-700 ml-auto">{new Date(eq.time).toLocaleTimeString()}</span>
              </div>
              {(eq as any).wikipedia && (
                <div className="mt-1 pt-1 border-t border-gray-800/30">
                  {(eq as any).wikipedia.earthquakeArticle && (
                    <div className="text-[7px] font-mono text-blue-400 truncate">
                      <a href={(eq as any).wikipedia.earthquakeArticle.url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="hover:underline">
                        {(eq as any).wikipedia.earthquakeArticle.title}
                      </a>
                    </div>
                  )}
                  {(eq as any).wikipedia.locationArticle && (
                    <div className="text-[7px] font-mono text-gray-500 truncate" title={(eq as any).wikipedia.locationArticle.extract}>
                      {(eq as any).wikipedia.locationArticle.extract ? `${(eq as any).wikipedia.locationArticle.extract.substring(0, 80)}...` : (eq as any).wikipedia.locationArticle.title}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
        {earthquakes.length === 0 && <div className="text-center py-4 text-[10px] font-mono text-gray-600">No seismic data</div>}
      </div>
    </PanelShell>
  );
}

export function CyberPanel({ onLocate }: { onLocate?: (item: any) => void }) {
  const [threats, setThreats] = useState<{ vulnerabilities: any[]; botnetC2: any[]; malwareDist: any[]; attackSurface: any[] }>({ vulnerabilities: [], botnetC2: [], malwareDist: [], attackSurface: [] });
  const [apiStatus, setApiStatus] = useState<APIStatus>({ loading: true, error: null, source: '', timestamp: null });
  const [activeTab, setActiveTab] = useState<'vulns' | 'botnet' | 'malware' | 'attack'>('vulns');

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/osint/cyber-threats');
      const data = await res.json();
      if (data.threats) setThreats(data.threats);
      setApiStatus({ loading: false, error: data.error || null, source: data.source || '', timestamp: data.timestamp });
    } catch (err: any) {
      setApiStatus(prev => ({ ...prev, loading: false, error: err.message }));
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 600000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const totalThreats = threats.vulnerabilities.length + threats.botnetC2.length + threats.malwareDist.length + threats.attackSurface.length;

  return (
    <PanelShell title="CYBER THREAT INTEL" icon={<Shield className="w-3.5 h-3.5" />} count={totalThreats > 0 ? String(totalThreats) : 'N/D'} accent="pink" apiStatus={apiStatus}>
      <div className="flex gap-1 mb-2">
        {[
          { id: 'vulns' as const, label: 'CVEs', count: threats.vulnerabilities.length },
          { id: 'botnet' as const, label: 'C2', count: threats.botnetC2.length },
          { id: 'malware' as const, label: 'Malware', count: threats.malwareDist.length },
          { id: 'attack' as const, label: 'Attack', count: threats.attackSurface.length },
        ].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex-1 flex flex-col items-center py-1 rounded text-[8px] font-mono transition-colors ${activeTab === tab.id ? 'bg-pink-900/40 text-pink-400' : 'bg-black/30 text-gray-600 hover:text-gray-400'}`}>
            <span className="font-bold">{tab.label}</span>
            <span className="text-[7px]">{tab.count}</span>
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto custom-scrollbar space-y-1">
        {activeTab === 'vulns' && threats.vulnerabilities.map((v: any, i: number) => (
          <div key={v.id || i} onClick={() => onLocate?.(v)} className="flex items-start gap-2 px-2 py-1.5 rounded bg-black/30 border border-gray-800/40 hover:border-pink-900/40 transition-colors cursor-pointer">
            <div className="w-6 h-6 flex items-center justify-center rounded bg-pink-900/40 border border-pink-800/50 flex-shrink-0 mt-0.5">
              <Shield className="w-3 h-3 text-pink-400" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-[9px] font-mono text-pink-400 font-bold">{v.id}</span>
                {v.ransomware && <span className="text-[7px] font-mono px-1 py-0.5 rounded bg-red-900/40 text-red-400 border border-red-800/50">RANSOMWARE</span>}
              </div>
              <div className="text-[8px] font-mono text-gray-400 truncate">{v.name}</div>
              <div className="flex items-center gap-1 mt-0.5">
                <span className="text-[8px] font-mono text-gray-600">{v.vendor}</span>
                <span className="text-[8px] font-mono text-gray-700 ml-auto">{v.dateAdded}</span>
              </div>
            </div>
          </div>
        ))}
        {activeTab === 'botnet' && threats.botnetC2.map((b: any, i: number) => (
          <div key={b.id || i} onClick={() => onLocate?.(b)} className="flex items-start gap-2 px-2 py-1.5 rounded bg-black/30 border border-gray-800/40 hover:border-pink-900/40 transition-colors cursor-pointer">
            <div className="w-6 h-6 flex items-center justify-center rounded bg-pink-900/40 border border-pink-800/50 flex-shrink-0 mt-0.5">
              <Zap className="w-3 h-3 text-pink-400" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-[9px] font-mono text-pink-400 font-bold">{b.country || 'Unknown'}</span>
                <span className="text-[7px] font-mono px-1 py-0.5 rounded bg-red-900/40 text-red-400">{b.count} C2s</span>
              </div>
              <div className="text-[8px] font-mono text-gray-500 truncate">{(b.threats || []).join(', ')}</div>
            </div>
          </div>
        ))}
        {activeTab === 'malware' && threats.malwareDist.map((m: any, i: number) => (
          <div key={m.id || i} onClick={() => onLocate?.(m)} className="flex items-start gap-2 px-2 py-1.5 rounded bg-black/30 border border-gray-800/40 hover:border-pink-900/40 transition-colors cursor-pointer">
            <div className="w-6 h-6 flex items-center justify-center rounded bg-red-900/40 border border-red-800/50 flex-shrink-0 mt-0.5">
              <AlertTriangle className="w-3 h-3 text-red-400" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[9px] font-mono text-red-400 font-bold">{m.ip}</div>
              <div className="text-[8px] font-mono text-gray-400">{m.city}, {m.country}</div>
              <div className="text-[8px] font-mono text-gray-600">{m.threat} | {m.isp}</div>
            </div>
          </div>
        ))}
        {activeTab === 'attack' && threats.attackSurface.map((a: any, i: number) => (
          <div key={a.id || i} onClick={() => onLocate?.(a)} className="flex items-start gap-2 px-2 py-1.5 rounded bg-black/30 border border-gray-800/40 hover:border-pink-900/40 transition-colors cursor-pointer">
            <div className="w-6 h-6 flex items-center justify-center rounded bg-pink-900/40 border border-pink-800/50 flex-shrink-0 mt-0.5">
              <Database className="w-3 h-3 text-pink-400" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[9px] font-mono text-pink-400 font-bold">{a.country}</div>
              <div className="text-[8px] font-mono text-gray-400">{a.count} indicators</div>
            </div>
          </div>
        ))}
        {totalThreats === 0 && <div className="text-center py-4 text-[10px] font-mono text-gray-600">No threat data</div>}
      </div>
    </PanelShell>
  );
}

export function OutagePanel({ onLocate }: { onLocate?: (item: any) => void }) {
  const [outages, setOutages] = useState<InternetOutageData[]>([]);
  const [apiStatus, setApiStatus] = useState<APIStatus>({ loading: true, error: null, source: '', timestamp: null });

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/osint/outages');
      const data = await res.json();
      if (data.outages) setOutages(data.outages);
      setApiStatus({ loading: false, error: data.error || null, source: data.source || '', timestamp: data.timestamp });
    } catch (err: any) {
      setApiStatus(prev => ({ ...prev, loading: false, error: err.message }));
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 600000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const severityBadge = (severity: string) => {
    const colors: Record<string, string> = {
      low: 'bg-yellow-900/40 text-yellow-400 border-yellow-800/50',
      medium: 'bg-orange-900/40 text-orange-400 border-orange-800/50',
      high: 'bg-red-900/40 text-red-400 border-red-800/50',
      critical: 'bg-red-800/40 text-red-200 border-red-700/50',
    };
    return colors[severity] || 'bg-gray-900/40 text-gray-400';
  };

  return (
    <PanelShell title="INTERNET OUTAGE RADAR" icon={<AlertTriangle className="w-3.5 h-3.5" />} count={outages.length > 0 ? String(outages.length) : 'N/D'} accent="yellow" apiStatus={apiStatus}>
      <div className="flex items-center gap-2 mb-2 px-1">
        <span className="text-[8px] font-mono text-gray-600">Georgia Tech IODA · 24h</span>
        <span className="text-[8px] font-mono text-yellow-400 ml-auto">{outages.filter(o => o.severity === 'critical' || o.severity === 'high').length} CRITICAL</span>
      </div>
      <div className="flex-1 overflow-y-auto custom-scrollbar space-y-1">
        {outages.map(out => (
          <div key={out.id} onClick={() => onLocate?.(out)} className="flex items-start gap-2 px-2 py-1.5 rounded bg-black/30 border border-gray-800/40 hover:border-yellow-900/40 transition-colors cursor-pointer">
            <div className="w-6 h-6 flex items-center justify-center rounded bg-yellow-900/40 border border-yellow-800/50 flex-shrink-0 mt-0.5">
              <Wifi className="w-3 h-3 text-yellow-400" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-mono text-yellow-400 font-bold truncate">{out.countryName}</span>
                <span className={`text-[7px] font-mono px-1 py-0.5 rounded border ${severityBadge(out.severity)}`}>{out.severity.toUpperCase()}</span>
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[8px] font-mono text-gray-600">Score: {out.score}</span>
                <span className="text-[8px] font-mono text-gray-600">Duration: {out.duration ? `${Math.round(out.duration / 60)}min` : 'Ongoing'}</span>
              </div>
              <div className="flex items-center gap-1 mt-0.5">
                {(out.datasources || []).map((ds: any, i: number) => (
                  <span key={i} className="text-[7px] font-mono text-gray-700">{ds.source}: {ds.score}</span>
                ))}
              </div>
            </div>
          </div>
        ))}
        {outages.length === 0 && <div className="text-center py-4 text-[10px] font-mono text-gray-600">No outages detected</div>}
      </div>
    </PanelShell>
  );
}

export function FirePanel({ onLocate }: { onLocate?: (item: any) => void }) {
  const [fires, setFires] = useState<FireData[]>([]);
  const [apiStatus, setApiStatus] = useState<APIStatus>({ loading: true, error: null, source: '', timestamp: null });
  const [activeTab, setActiveTab] = useState<'fires' | 'volcanoes'>('fires');

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/osint/fires');
      const data = await res.json();
      const fireList = data.fires?.fires || [];
      const volcanoList = data.fires?.volcanoes || [];
      setFires([...volcanoList.map((v: any) => ({ ...v, type: 'volcano' as const })), ...fireList.map((f: any) => ({ ...f, type: 'fire' as const }))]);
      setApiStatus({ loading: false, error: data.error || null, source: data.source || '', timestamp: data.timestamp });
    } catch (err: any) {
      setApiStatus(prev => ({ ...prev, loading: false, error: err.message }));
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 600000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const fireOnly = fires.filter(f => f.type === 'fire');
  const volcanoOnly = fires.filter(f => f.type === 'volcano');
  const displayList = activeTab === 'fires' ? fireOnly : volcanoOnly;

  return (
    <PanelShell title="FIRE & VOLCANO INTEL" icon={<Flame className="w-3.5 h-3.5" />} count={fires.length > 0 ? String(fires.length) : 'N/D'} accent="red" apiStatus={apiStatus}>
      <div className="flex gap-1 mb-2">
        <button onClick={() => setActiveTab('fires')} className={`flex-1 flex items-center justify-center gap-1 py-1 rounded text-[8px] font-mono transition-colors ${activeTab === 'fires' ? 'bg-red-900/40 text-red-400' : 'bg-black/30 text-gray-600'}`}>
          <Flame className="w-2.5 h-2.5" /> FIRES <span className="text-[7px]">{fireOnly.length}</span>
        </button>
        <button onClick={() => setActiveTab('volcanoes')} className={`flex-1 flex items-center justify-center gap-1 py-1 rounded text-[8px] font-mono transition-colors ${activeTab === 'volcanoes' ? 'bg-orange-900/40 text-orange-400' : 'bg-black/30 text-gray-600'}`}>
          <Activity className="w-2.5 h-2.5" /> VOLCANOES <span className="text-[7px]">{volcanoOnly.length}</span>
        </button>
      </div>
      <div className="flex-1 overflow-y-auto custom-scrollbar space-y-1">
        {displayList.slice(0, 50).map((f: any, i: number) => (
          <div key={f.id || i} onClick={() => onLocate?.(f)} className="flex items-start gap-2 px-2 py-1.5 rounded bg-black/30 border border-gray-800/40 hover:border-red-900/40 transition-colors cursor-pointer">
            <div className={`w-6 h-6 flex items-center justify-center rounded border flex-shrink-0 mt-0.5 ${f.type === 'volcano' ? 'bg-orange-900/40 border-orange-800/50' : 'bg-red-900/40 border-red-800/50'}`}>
              {f.type === 'volcano' ? <Activity className="w-3 h-3 text-orange-400" /> : <Flame className="w-3 h-3 text-red-400" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-[9px] font-mono text-red-400 font-bold truncate">{f.name || f.id}</span>
                <span className={`text-[7px] font-mono px-1 py-0.5 rounded ${f.severity === 'critical' ? 'bg-red-900/40 text-red-300' : f.severity === 'high' ? 'bg-orange-900/40 text-orange-400' : 'bg-gray-900/40 text-gray-400'}`}>{f.severity?.toUpperCase()}</span>
              </div>
              {f.brightness && <div className="text-[8px] font-mono text-gray-500">Brightness: {f.brightness}K | Conf: {f.confidence}</div>}
              {f.lastUpdate && <div className="text-[8px] font-mono text-gray-600">{f.lastUpdate}</div>}
              {f.date && <div className="text-[8px] font-mono text-gray-700">{f.date}</div>}
            </div>
          </div>
        ))}
        {displayList.length === 0 && <div className="text-center py-4 text-[10px] font-mono text-gray-600">No data</div>}
      </div>
    </PanelShell>
  );
}

export function GDELTPanel({ onLocate }: { onLocate?: (item: any) => void }) {
  const [events, setEvents] = useState<GDELTEvent[]>([]);
  const [apiStatus, setApiStatus] = useState<APIStatus>({ loading: true, error: null, source: '', timestamp: null });
  const [catFilter, setCatFilter] = useState<'all' | 'unrest' | 'conflict' | 'crisis'>('all');

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/osint/gdelt');
      const data = await res.json();
      setEvents(data.events || []);
      setApiStatus({ loading: false, error: data.error || null, source: data.source || '', timestamp: data.timestamp });
    } catch (err: any) {
      setApiStatus(prev => ({ ...prev, loading: false, error: err.message }));
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 900000); // 15 min
    return () => clearInterval(interval);
  }, [fetchData]);

  const catColors: Record<string, string> = { unrest: '#ff9933', conflict: '#ff0033', crisis: '#ff3377' };
  const catBgs: Record<string, string> = { unrest: 'bg-orange-900/40 border-orange-800/50', conflict: 'bg-red-900/40 border-red-800/50', crisis: 'bg-pink-900/40 border-pink-800/50' };
  const sevBgs: Record<string, string> = { low: 'bg-gray-900/40 text-gray-400', medium: 'bg-orange-900/40 text-orange-400', high: 'bg-red-900/40 text-red-400', critical: 'bg-red-900/60 text-red-300' };

  const filtered = catFilter === 'all' ? events : events.filter(e => e.category === catFilter);
  const catCounts: Record<string, number> = {};
  events.forEach(e => { catCounts[e.category] = (catCounts[e.category] || 0) + 1; });

  return (
    <PanelShell title="GDELT CONFLICT INTEL" icon={<Zap className="w-3.5 h-3.5" />} count={events.length > 0 ? String(events.length) : 'N/D'} accent="rose" apiStatus={apiStatus}>
      <div className="flex gap-1 mb-2">
        {(['all', 'unrest', 'conflict', 'crisis'] as const).map(cat => (
          <button key={cat} onClick={() => setCatFilter(cat)} className={`flex-1 flex items-center justify-center gap-1 py-1 rounded text-[8px] font-mono transition-colors ${catFilter === cat ? 'bg-rose-900/40 text-rose-400' : 'bg-black/30 text-gray-600'}`}>
            {cat.toUpperCase()} <span className="text-[7px]">{cat === 'all' ? events.length : (catCounts[cat] || 0)}</span>
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto custom-scrollbar space-y-1">
        {filtered.slice(0, 50).map((evt, i) => (
          <div key={evt.id || i} onClick={() => onLocate?.(evt)} className="flex items-start gap-2 px-2 py-1.5 rounded bg-black/30 border border-gray-800/40 hover:border-rose-900/40 transition-colors cursor-pointer">
            <div className={`w-6 h-6 flex items-center justify-center rounded border flex-shrink-0 mt-0.5 ${catBgs[evt.category] || 'bg-gray-900/40 border-gray-800/50'}`}>
              <Zap className="w-3 h-3 text-rose-400" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-[9px] font-mono text-rose-400 font-bold truncate">{evt.name}</span>
                <span className={`text-[7px] font-mono px-1 py-0.5 rounded ${sevBgs[evt.severity] || sevBgs.medium}`}>{evt.severity?.toUpperCase()}</span>
              </div>
              <div className="text-[8px] font-mono text-gray-500">
                {evt.category.toUpperCase()} | {evt.source}
              </div>
              <div className="text-[8px] font-mono text-gray-600">
                {evt.date ? new Date(evt.date).toLocaleString() : ''}
              </div>
            </div>
          </div>
        ))}
        {filtered.length === 0 && <div className="text-center py-4 text-[10px] font-mono text-gray-600">No events detected</div>}
      </div>
    </PanelShell>
  );
}

export function FOFAPanel({ onLocate }: { onLocate?: (item: any) => void }) {
  const [devices, setDevices] = useState<FOAFDevice[]>([]);
  const [filter, setFilter] = useState<'all' | 'camera' | 'router' | 'industrial' | 'database' | 'dns' | 'iot'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [scanning, setScanning] = useState(false);
  const [apiStatus, setApiStatus] = useState<APIStatus>({ loading: true, error: null, source: '', timestamp: null });
  const [selectedCamera, setSelectedCamera] = useState<FOAFDevice | null>(null);

  const fetchDevices = useCallback(async () => {
    setScanning(true);
    try {
      const res = await fetch(`/api/osint/fofa?type=${filter}`);
      const data = await res.json();
      if (data.devices && data.devices.length > 0) {
        setDevices(data.devices);
      }
      setApiStatus({ loading: false, error: data.error || null, source: data.source || '', timestamp: data.timestamp });
    } catch (err: any) {
      setApiStatus(prev => ({ ...prev, loading: false, error: err.message }));
    }
    setScanning(false);
  }, [filter]);

  useEffect(() => { fetchDevices(); }, [fetchDevices]);

  const filtered = devices.filter(d => {
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      return d.ip.includes(term) || d.city?.toLowerCase().includes(term) || d.country?.toLowerCase().includes(term)
        || d.org?.toLowerCase().includes(term) || d.banner?.toLowerCase().includes(term) || d.deviceType.includes(term);
    }
    return true;
  });

  const riskColors: Record<string, string> = {
    critical: 'text-red-400 bg-red-900/30 border-red-700/30',
    high: 'text-orange-400 bg-orange-900/30 border-orange-700/30',
    medium: 'text-yellow-400 bg-yellow-900/30 border-yellow-700/30',
    low: 'text-green-400 bg-green-900/30 border-green-700/30',
  };

  const typeIcons: Record<string, React.ReactNode> = {
    camera: <Camera className="w-3 h-3" />,
    router: <Network className="w-3 h-3" />,
    industrial: <Cpu className="w-3 h-3" />,
    database: <Database className="w-3 h-3" />,
    dns: <Globe className="w-3 h-3" />,
    iot: <Wifi className="w-3 h-3" />,
  };

  if (selectedCamera) {
    return (
      <PanelShell title="FOFA CAMERA VIEWER" icon={<Camera className="w-3.5 h-3.5" />} count={selectedCamera.id} accent="emerald">
        <CameraViewer
          camera={{
            id: selectedCamera.id,
            ip: selectedCamera.ip,
            lat: selectedCamera.lat,
            lng: selectedCamera.lng,
            location: `${selectedCamera.city || ''}, ${selectedCamera.country || ''}`,
            type: selectedCamera.deviceType,
            status: 'online',
            snapshotUrl: selectedCamera.port === 80 ? `http://${selectedCamera.ip}:${selectedCamera.port}/snapshot.jpg` : undefined,
            streamUrl: selectedCamera.port === 554 ? `rtsp://${selectedCamera.ip}:${selectedCamera.port}/stream1` : selectedCamera.port === 80 ? `http://${selectedCamera.ip}:${selectedCamera.port}/` : undefined,
            source: 'FOFA',
            name: selectedCamera.title,
            city: selectedCamera.city,
            country: selectedCamera.country,
          }}
          onClose={() => setSelectedCamera(null)}
        />
      </PanelShell>
    );
  }

  return (
    <PanelShell title="FOFA IOT SEARCH" icon={<Cpu className="w-4 h-4" />} count={`${filtered.length} devices`} accent="pink" apiStatus={apiStatus}>
      <div className="space-y-2">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-600" />
          <input
            type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
            placeholder="Search IP, city, org, banner..."
            className="w-full pl-7 pr-2 py-1.5 text-[10px] bg-black/40 border border-gray-700/40 rounded text-gray-300 placeholder:text-gray-700 focus:border-fuchsia-700/50 focus:outline-none font-mono"
          />
        </div>
        <div className="flex gap-1 flex-wrap">
          {(['all', 'camera', 'router', 'industrial', 'database', 'dns', 'iot'] as const).map(t => (
            <button key={t} onClick={() => setFilter(t)}
              className={`px-1.5 py-0.5 text-[7px] font-mono tracking-wider rounded border transition-all ${
                filter === t ? 'border-fuchsia-600/50 text-fuchsia-400 bg-fuchsia-900/30' : 'border-gray-700/30 text-gray-600 hover:border-gray-600/50'
              }`}>
              {t.toUpperCase()}
            </button>
          ))}
        </div>
        <div className="space-y-1.5 max-h-[calc(100vh-320px)] overflow-y-auto custom-scrollbar">
          {filtered.slice(0, 60).map((dev, i) => (
            <div key={dev.id || i} onClick={() => onLocate?.(dev)} className="flex items-start gap-2 px-2 py-1.5 rounded bg-black/30 border border-gray-800/40 hover:border-fuchsia-900/40 transition-colors cursor-pointer group">
              <div className={`w-6 h-6 flex items-center justify-center rounded border flex-shrink-0 mt-0.5 ${dev.deviceType === 'camera' ? 'bg-emerald-900/30 border-emerald-800/50 text-emerald-400' : 'bg-fuchsia-900/30 border-fuchsia-800/50 text-fuchsia-400'}`}>
                {typeIcons[dev.deviceType] || <Cpu className="w-3 h-3" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className={`text-[9px] font-mono font-bold truncate ${dev.deviceType === 'camera' ? 'text-emerald-400' : 'text-fuchsia-400'}`}>{dev.ip}:{dev.port}</span>
                  <span className={`text-[6px] font-mono px-1 py-0.5 rounded border ${riskColors[dev.risk] || riskColors.medium}`}>{dev.risk.toUpperCase()}</span>
                  {dev.deviceType === 'camera' && (
                    <button
                      onClick={(e) => { e.stopPropagation(); setSelectedCamera(dev); }}
                      className="text-[6px] font-mono px-1.5 py-0.5 rounded border border-emerald-600/50 bg-emerald-900/40 text-emerald-300 hover:bg-emerald-800/50 transition-colors flex items-center gap-0.5"
                      title="View camera stream"
                    >
                      <Eye className="w-2.5 h-2.5" />VIEW
                    </button>
                  )}
                </div>
                <div className="text-[8px] font-mono text-gray-500">
                  {dev.deviceType.toUpperCase()} | {dev.city || dev.country || 'Unknown'} | {dev.org?.substring(0, 25) || ''}
                  {dev.deviceType === 'camera' && dev.title ? ` | ${dev.title}` : ''}
                </div>
                <div className="text-[7px] font-mono text-gray-600 truncate" title={dev.banner}>
                  {dev.banner?.substring(0, 60) || dev.protocol}
                </div>
              </div>
            </div>
          ))}
          {filtered.length === 0 && <div className="text-center py-4 text-[10px] font-mono text-gray-600">No devices found</div>}
        </div>
      </div>
    </PanelShell>
  );
}
