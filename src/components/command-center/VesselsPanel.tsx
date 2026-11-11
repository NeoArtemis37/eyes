'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Ship, Anchor, RefreshCw, Search, AlertTriangle, Database, Flag,
  Navigation, Gauge, MapPin, Eye, Activity,
} from 'lucide-react';

type Classification = 'cargo' | 'tanker' | 'passenger' | 'fishing' | 'military' | 'pleasure' | 'navigation_aid' | 'other' | 'unknown';

interface VesselReport {
  mmsi: string;
  imo?: string | null;
  name: string | null;
  callsign?: string | null;
  lat: number;
  lng: number;
  sog: number;
  cog: number;
  heading: number | null;
  navStatus: string | null;
  shipType: string | null;
  shipTypeCode: number | null;
  destination: string | null;
  eta: string | null;
  draught?: number | null;
  length?: number | null;
  width?: number | null;
  country: string | null;
  isMilitary: boolean;
  militaryReason: string | null;
  classification: Classification;
  timestamp: number;
  source: string;
  _validation: {
    coordinateSanity: 'pass' | 'fail';
    speedCeiling: 'pass' | 'fail';
    mmsiStructure: 'pass' | 'fail';
    rejectedReasons: string[];
  };
}

const CLASS_FILTERS: { id: Classification | 'all' | 'military'; label: string; color: string }[] = [
  { id: 'all',          label: 'ALL',     color: 'text-gray-400' },
  { id: 'military',     label: 'MIL',     color: 'text-red-400' },
  { id: 'cargo',        label: 'CARGO',   color: 'text-blue-400' },
  { id: 'tanker',       label: 'TANKER',  color: 'text-orange-400' },
  { id: 'passenger',    label: 'PASS',    color: 'text-purple-400' },
  { id: 'fishing',      label: 'FISH',    color: 'text-green-400' },
  { id: 'pleasure',     label: 'YACHT',   color: 'text-pink-400' },
  { id: 'navigation_aid', label: 'ATON',  color: 'text-amber-400' },
];

const STATUS_COLORS: Record<string, string> = {
  'Under way using engine': 'text-green-400',
  'At anchor':              'text-yellow-400',
  'Moored':                 'text-gray-500',
  'Engaged in fishing':     'text-emerald-400',
  'Under way sailing':      'text-cyan-400',
  'Aground':                'text-red-500',
  'Restricted maneuverability': 'text-orange-400',
  'Not under command':      'text-red-400',
};

interface VesselsPanelProps {
  onLocate?: (item: any) => void;
}

export default function VesselsPanel({ onLocate }: VesselsPanelProps) {
  const [vessels, setVessels] = useState<VesselReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Classification | 'all' | 'military'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [apiSource, setApiSource] = useState('');
  const [liveConnected, setLiveConnected] = useState(false);
  const [cacheSize, setCacheSize] = useState(0);
  const [validation, setValidation] = useState({ coordinateSanityPass: 0, speedCeilingPass: 0, mmsiStructurePass: 0, rejectedCount: 0 });
  const [selectedVessel, setSelectedVessel] = useState<VesselReport | null>(null);
  const [showMilitaryOnly, setShowMilitaryOnly] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/osint/vessels');
      const data = await res.json();
      setVessels(data.vessels || []);
      setApiSource(data.source || '');
      setLiveConnected(!!data.liveFeedConnected);
      setCacheSize(data.cacheSize || 0);
      if (data.validation) setValidation(data.validation);
    } catch (err) {
      setVessels([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const filtered = vessels.filter(v => {
    if (filter === 'military') {
      if (!v.isMilitary) return false;
    } else if (filter !== 'all' && v.classification !== filter) {
      return false;
    }
    if (searchTerm) {
      const t = searchTerm.toLowerCase();
      return (
        v.name?.toLowerCase().includes(t) ||
        v.mmsi.includes(t) ||
        v.callsign?.toLowerCase().includes(t) ||
        v.destination?.toLowerCase().includes(t) ||
        v.country?.toLowerCase().includes(t)
      );
    }
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    if (a.isMilitary !== b.isMilitary) return a.isMilitary ? -1 : 1;
    return b.sog - a.sog;
  });

  const classCounts: Record<string, number> = { all: vessels.length, military: 0 };
  vessels.forEach(v => {
    if (v.isMilitary) classCounts.military = (classCounts.military || 0) + 1;
    classCounts[v.classification] = (classCounts[v.classification] || 0) + 1;
  });

  return (
    <div className="h-full flex flex-col bg-black/60 border border-teal-900/40 rounded-lg backdrop-blur-sm">
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-800/50">
        <div className="flex items-center gap-2">
          <Ship className="w-3.5 h-3.5 text-teal-400" />
          <span className="text-teal-400 font-mono text-[11px] font-bold tracking-wider">VESSELS</span>
          {loading && <div className="w-1.5 h-1.5 bg-yellow-400 rounded-full animate-pulse" />}
          {liveConnected && (
            <span className="flex items-center gap-0.5 text-[7px] font-mono text-green-400 px-1 py-0.5 rounded bg-green-900/30 border border-green-700/30">
              <span className="w-1 h-1 rounded-full bg-green-400 animate-pulse" />LIVE
            </span>
          )}
        </div>
        <span className="text-gray-500 font-mono text-[9px]">{sorted.length} VESSEL{sorted.length !== 1 ? 'S' : ''}</span>
      </div>

      {apiSource && (
        <div className="flex items-center gap-1 px-3 py-1 bg-black/30 border-b border-gray-800/30">
          <Database className="w-2.5 h-2.5 text-gray-600" />
          <span className="text-[8px] font-mono text-gray-600 truncate">SRC: {apiSource}</span>
          {cacheSize > 0 && <span className="text-[7px] font-mono text-teal-700">CACHE: {cacheSize}</span>}
          <button onClick={fetchData} className="ml-auto p-0.5 hover:bg-white/5 rounded">
            <RefreshCw className={`w-2.5 h-2.5 text-gray-500 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      )}

      <div className="px-2 py-1.5 border-b border-gray-800/30">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-600" />
          <input
            type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
            placeholder="Filter by name, MMSI, destination, country..."
            className="w-full pl-7 pr-2 py-1 text-[10px] bg-black/40 border border-gray-700/40 rounded text-gray-300 placeholder:text-gray-700 focus:border-teal-700/40 focus:outline-none font-mono"
          />
        </div>
      </div>

      <div className="flex gap-0.5 px-2 py-1.5 border-b border-gray-800/30 flex-wrap">
        {CLASS_FILTERS.map(c => {
          const count = classCounts[c.id] || 0;
          if (c.id !== 'all' && c.id !== 'military' && count === 0) return null;
          return (
            <button
              key={c.id}
              onClick={() => setFilter(c.id)}
              className={`px-1.5 py-0.5 text-[7px] font-mono tracking-wider rounded border transition-all ${
                filter === c.id ? `border-teal-600/50 ${c.color} bg-teal-900/30` : 'border-gray-700/30 text-gray-600 hover:border-gray-600/50'
              }`}
            >
              {c.label} <span className="text-[7px] opacity-70">{count}</span>
            </button>
          );
        })}
      </div>

      {vessels.length > 0 && (
        <div className="px-3 py-1 bg-black/40 border-b border-gray-800/30 flex items-center gap-2 text-[7px] font-mono">
          <span className="text-gray-600">VALIDATION:</span>
          <span className="text-green-500" title="Coordinate sanity pass">COORD {validation.coordinateSanityPass}/{vessels.length}</span>
          <span className="text-green-500" title="Speed ceiling pass">SOG {validation.speedCeilingPass}/{vessels.length}</span>
          <span className="text-green-500" title="MMSI structure pass">MMSI {validation.mmsiStructurePass}/{vessels.length}</span>
          {validation.rejectedCount > 0 && <span className="text-amber-500" title="Total rejected reasons">REJ {validation.rejectedCount}</span>}
        </div>
      )}

      <div className="flex-1 overflow-y-auto custom-scrollbar p-1.5 space-y-1">
        {sorted.map(v => (
          <div
            key={v.mmsi}
            onClick={() => setSelectedVessel(v)}
            className={`flex items-start gap-2 px-2 py-1.5 rounded bg-black/30 border transition-colors cursor-pointer ${
              v.isMilitary ? 'border-red-900/40 hover:border-red-700/50' : 'border-gray-800/40 hover:border-teal-900/40'
            }`}
          >
            <div className={`w-6 h-6 flex items-center justify-center rounded border flex-shrink-0 mt-0.5 ${
              v.isMilitary ? 'bg-red-900/40 border-red-800/50' : 'bg-teal-900/30 border-teal-800/40'
            }`}>
              {v.isMilitary ? <Flag className="w-3 h-3 text-red-400" /> : <Ship className="w-3 h-3 text-teal-400" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className={`text-[9px] font-mono font-bold truncate ${v.isMilitary ? 'text-red-400' : 'text-teal-300'}`}>
                  {v.name || 'UNNAMED'}
                </span>
                {v.isMilitary && (
                  <span className="text-[6px] font-mono px-1 py-0.5 rounded bg-red-900/50 text-red-300 border border-red-700/40 flex-shrink-0">MIL</span>
                )}
                {v.sog > 0.5 && v.sog < 1.5 && (
                  <span className="text-[6px] font-mono px-1 py-0.5 rounded bg-yellow-900/30 text-yellow-400 border border-yellow-700/30 flex-shrink-0">SLOW</span>
                )}
                {v.sog === 0 && (
                  <span className="text-[6px] font-mono px-1 py-0.5 rounded bg-gray-900/40 text-gray-500 border border-gray-700/30 flex-shrink-0">STOP</span>
                )}
              </div>
              <div className="text-[8px] font-mono text-gray-500 flex items-center gap-1.5">
                <span>MMSI {v.mmsi}</span>
                <span className="text-gray-700">|</span>
                <span className="uppercase">{v.classification}</span>
                {v.callsign && <><span className="text-gray-700">|</span><span>{v.callsign}</span></>}
              </div>
              <div className="text-[8px] font-mono text-gray-600 flex items-center gap-2">
                <span className="flex items-center gap-0.5">
                  <Gauge className="w-2 h-2" />
                  <span className={v.sog > 25 ? 'text-amber-400' : 'text-gray-400'}>{v.sog.toFixed(1)}kt</span>
                </span>
                <span className="flex items-center gap-0.5">
                  <Navigation className="w-2 h-2" style={{ transform: `rotate(${v.cog}deg)` }} />
                  <span>{Math.round(v.cog)}°</span>
                </span>
                {v.navStatus && <span className={`truncate ${STATUS_COLORS[v.navStatus] || 'text-gray-500'}`}>{v.navStatus}</span>}
              </div>
              <div className="text-[7px] font-mono text-gray-700">
                {v.country || 'Unknown country'} {v.destination && `→ ${v.destination}`}
              </div>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); onLocate?.({ lat: v.lat, lng: v.lng, name: v.name || v.mmsi }); }}
              className="text-[7px] font-mono px-1.5 py-0.5 rounded border border-teal-600/30 text-teal-400 hover:bg-teal-900/30 transition-colors flex-shrink-0 flex items-center gap-0.5"
              title="Locate on globe"
            >
              <MapPin className="w-2.5 h-2.5" />GO
            </button>
          </div>
        ))}

        {sorted.length === 0 && !loading && (
          <div className="text-center py-4 text-[10px] font-mono text-gray-600">
            {searchTerm || filter !== 'all' ? 'No vessels match filter' : 'No vessel data available'}
          </div>
        )}
      </div>

      {selectedVessel && (
        <div className="border-t border-teal-900/30 bg-black/60 p-2 max-h-48 overflow-y-auto custom-scrollbar">
          <div className="flex items-center justify-between mb-1">
            <div className={`text-[10px] font-mono font-bold ${selectedVessel.isMilitary ? 'text-red-400' : 'text-teal-400'} truncate flex-1`}>
              {selectedVessel.name || 'UNNAMED VESSEL'}
            </div>
            <button onClick={() => setSelectedVessel(null)} className="text-gray-600 hover:text-gray-400 text-xs ml-2 flex-shrink-0">✕</button>
          </div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[8px] font-mono">
            <Row label="MMSI" value={selectedVessel.mmsi} />
            <Row label="IMO" value={selectedVessel.imo || 'N/D'} />
            <Row label="Callsign" value={selectedVessel.callsign || 'N/D'} />
            <Row label="Country" value={selectedVessel.country || 'Unknown'} />
            <Row label="Type" value={selectedVessel.shipType || selectedVessel.classification} />
            <Row label="Type code" value={selectedVessel.shipTypeCode != null ? String(selectedVessel.shipTypeCode) : 'N/D'} />
            <Row label="SOG" value={`${selectedVessel.sog.toFixed(1)} kt`} />
            <Row label="COG" value={`${Math.round(selectedVessel.cog)}°`} />
            <Row label="Heading" value={selectedVessel.heading != null ? `${selectedVessel.heading}°` : 'N/D'} />
            <Row label="Status" value={selectedVessel.navStatus || 'N/D'} />
            <Row label="Destination" value={selectedVessel.destination || 'N/D'} />
            <Row label="ETA" value={selectedVessel.eta ? new Date(selectedVessel.eta).toLocaleDateString() : 'N/D'} />
            <Row label="Draught" value={selectedVessel.draught != null ? `${selectedVessel.draught}m` : 'N/D'} />
            <Row label="Length × Width" value={selectedVessel.length && selectedVessel.width ? `${selectedVessel.length}m × ${selectedVessel.width}m` : 'N/D'} />
            <Row label="Lat / Lng" value={`${selectedVessel.lat.toFixed(4)}, ${selectedVessel.lng.toFixed(4)}`} />
            <Row label="Source" value={selectedVessel.source} />
          </div>
          {selectedVessel.isMilitary && selectedVessel.militaryReason && (
            <div className="mt-1 px-1.5 py-1 bg-red-900/30 border border-red-700/40 rounded flex items-center gap-1">
              <Flag className="w-2.5 h-2.5 text-red-400 flex-shrink-0" />
              <span className="text-[8px] font-mono text-red-300">MILITARY: {selectedVessel.militaryReason}</span>
            </div>
          )}
          <div className="mt-1 px-1.5 py-1 bg-black/40 border border-gray-800/40 rounded">
            <div className="text-[7px] font-mono text-gray-600 tracking-wider mb-0.5">_VALIDATION AUDIT</div>
            <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-[7px] font-mono">
              <span className={selectedVessel._validation.coordinateSanity === 'pass' ? 'text-green-500' : 'text-red-500'}>COORD: {selectedVessel._validation.coordinateSanity.toUpperCase()}</span>
              <span className={selectedVessel._validation.speedCeiling === 'pass' ? 'text-green-500' : 'text-red-500'}>SOG: {selectedVessel._validation.speedCeiling.toUpperCase()}</span>
              <span className={selectedVessel._validation.mmsiStructure === 'pass' ? 'text-green-500' : 'text-red-500'}>MMSI: {selectedVessel._validation.mmsiStructure.toUpperCase()}</span>
            </div>
            {selectedVessel._validation.rejectedReasons.length > 0 && (
              <div className="mt-0.5 text-[7px] font-mono text-amber-500">
                Rejected: {selectedVessel._validation.rejectedReasons.join('; ')}
              </div>
            )}
          </div>
          <button
            onClick={() => onLocate?.({ lat: selectedVessel.lat, lng: selectedVessel.lng, name: selectedVessel.name || selectedVessel.mmsi })}
            className="mt-1.5 w-full px-2 py-1 bg-teal-900/40 border border-teal-700/40 rounded text-[9px] font-mono font-bold text-teal-300 hover:bg-teal-800/50 transition-colors flex items-center justify-center gap-1"
          >
            <MapPin className="w-3 h-3" />LOCATE ON GLOBE
          </button>
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <>
      <span className="text-gray-600">{label}</span>
      <span className="text-gray-300 truncate">{value}</span>
    </>
  );
}
