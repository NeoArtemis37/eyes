'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Search, Globe, Shield, Server, Network, Activity, AlertTriangle,
  RefreshCw, Database, Lock, Fingerprint, Eye, Scan, ChevronRight, CheckCircle2, XCircle,
  Bug, Mail, MailCheck, ArrowLeftRight, MapPin,
} from 'lucide-react';

type ReconTab =
  | 'headers' | 'ssl' | 'dns' | 'whois' | 'ports' | 'shodan'
  | 'ip' | 'bgp' | 'sanctions' | 'cve' | 'mac' | 'github' | 'threats'
  | 'malware' | 'emailrep' | 'breach' | 'reversedns' | 'adresse';

type TabParam = 'url' | 'domain' | 'target' | 'ip' | 'query' | 'cve' | 'mac' | 'username' | 'email' | 'optional' | 'q';

const TABS: { id: ReconTab; label: string; icon: React.ReactNode; param: TabParam; placeholder: string; hint: string }[] = [
  { id: 'headers',    label: 'HTTP',     icon: <Globe className="w-3 h-3" />,        param: 'url',       placeholder: 'example.com',           hint: 'Security header audit' },
  { id: 'ssl',        label: 'SSL',      icon: <Lock className="w-3 h-3" />,         param: 'domain',    placeholder: 'example.com',           hint: 'Certificate + TLS handshake' },
  { id: 'dns',        label: 'DNS',      icon: <Network className="w-3 h-3" />,      param: 'domain',    placeholder: 'example.com',           hint: 'A / AAAA / MX / NS / TXT / SOA' },
  { id: 'whois',      label: 'WHOIS',    icon: <Fingerprint className="w-3 h-3" />,  param: 'domain',    placeholder: 'example.com',           hint: 'RDAP registration data' },
  { id: 'ports',      label: 'PORTS',    icon: <Server className="w-3 h-3" />,       param: 'target',    placeholder: 'example.com or 1.2.3.4', hint: 'Common TCP port sweep' },
  { id: 'shodan',     label: 'SHODAN',   icon: <Scan className="w-3 h-3" />,         param: 'ip',        placeholder: '8.8.8.8',               hint: 'InternetDB exposure lookup (IP only)' },
  { id: 'ip',         label: 'IP',       icon: <Globe className="w-3 h-3" />,        param: 'ip',        placeholder: '8.8.8.8',               hint: 'Geolocation + reputation + ISP/ASN' },
  { id: 'bgp',        label: 'BGP',      icon: <Network className="w-3 h-3" />,      param: 'query',     placeholder: '8.8.8.8 or AS15169',    hint: 'BGP/ASN routing + prefixes + peers' },
  { id: 'sanctions',  label: 'OFAC',     icon: <Shield className="w-3 h-3" />,       param: 'query',     placeholder: 'name or entity',        hint: 'OpenSanctions OFAC SDN search' },
  { id: 'cve',        label: 'CVE',      icon: <AlertTriangle className="w-3 h-3" />, param: 'cve',      placeholder: 'CVE-2024-12345',        hint: 'MITRE CVE details + CVSS' },
  { id: 'mac',        label: 'MAC',      icon: <Server className="w-3 h-3" />,       param: 'mac',       placeholder: '00:1A:2B:3C:4D:5E',     hint: 'MAC OUI vendor lookup' },
  { id: 'github',     label: 'GITHUB',   icon: <Eye className="w-3 h-3" />,          param: 'username',  placeholder: 'torvalds',              hint: 'GitHub user profile + repos' },
  { id: 'threats',    label: 'THREATS',  icon: <Activity className="w-3 h-3" />,     param: 'optional',  placeholder: '8.8.8.8 or domain (optional)', hint: 'OTX pulses + Tor exit + IP rep' },
  { id: 'malware',    label: 'MALWARE',  icon: <Bug className="w-3 h-3" />,          param: 'optional',  placeholder: '(leave empty for live feed)', hint: 'abuse.ch FeodoTracker + URLhaus C2 feed' },
  { id: 'emailrep',   label: 'EMAIL',    icon: <MailCheck className="w-3 h-3" />,    param: 'email',     placeholder: 'user@example.com',      hint: 'Email reputation + disposable/MX check (mailcheck.ai)' },
  { id: 'breach',     label: 'BREACH',   icon: <Mail className="w-3 h-3" />,         param: 'email',     placeholder: 'user@example.com',      hint: 'Data breach exposure check (XposedOrNot)' },
  { id: 'reversedns', label: 'RDNS',     icon: <ArrowLeftRight className="w-3 h-3" />, param: 'ip',      placeholder: '8.8.8.8',               hint: 'Reverse DNS PTR lookup via DoH' },
  { id: 'adresse',    label: 'ADRESSE',  icon: <MapPin className="w-3 h-3" />,      param: 'q',         placeholder: '10 Downing St, London',  hint: 'Géocoder un lieu / une adresse (OpenStreetMap)' },
];

const ENDPOINT: Record<ReconTab, string> = {
  headers:    '/api/osint/headers',
  ssl:        '/api/osint/ssl',
  dns:        '/api/osint/dns',
  whois:      '/api/osint/whois',
  ports:      '/api/osint/portscan',
  shodan:     '/api/osint/shodan',
  ip:         '/api/osint/ip',
  bgp:        '/api/osint/bgp',
  sanctions:  '/api/osint/sanctions',
  cve:        '/api/osint/cve',
  mac:        '/api/osint/mac',
  github:     '/api/osint/github',
  threats:    '/api/osint/threats',
  malware:    '/api/osint/malware',
  emailrep:   '/api/osint/email-rep',
  breach:     '/api/osint/breach',
  reversedns: '/api/osint/reverse-dns',
  adresse:    '/api/horus/geocode',
};

interface APIStatus {
  loading: boolean;
  error: string | null;
  source: string;
  timestamp: number | null;
  cached?: boolean;
}

export default function ReconPanel({ onLocate }: { onLocate?: (item: any) => void }) {
  const [activeTab, setActiveTab] = useState<ReconTab>('headers');
  const [target, setTarget] = useState('');
  const [result, setResult] = useState<any>(null);
  const [apiStatus, setApiStatus] = useState<APIStatus>({ loading: false, error: null, source: '', timestamp: null });

  const runScan = useCallback(async () => {
    const trimmed = target.trim();
    const isOptional = TABS.find(t => t.id === activeTab)?.param === 'optional';
    if (!trimmed && !isOptional) {
      setApiStatus(prev => ({ ...prev, error: 'Enter a target first' }));
      return;
    }
    if ((activeTab === 'shodan' || activeTab === 'ip' || activeTab === 'reversedns') && !/^(\d{1,3}\.){3}\d{1,3}$/.test(trimmed)) {
      setApiStatus({ loading: false, error: 'IPv4 required (x.x.x.x)', source: '', timestamp: null });
      setResult(null);
      return;
    }
    if (activeTab === 'cve' && !/^CVE-\d{4}-\d{4,}$/i.test(trimmed)) {
      setApiStatus({ loading: false, error: 'Format: CVE-YYYY-NNNN', source: '', timestamp: null });
      setResult(null);
      return;
    }
    if (activeTab === 'mac' && !/^[0-9A-Fa-f]{2}([:-][0-9A-Fa-f]{2}){5}$/.test(trimmed)) {
      setApiStatus({ loading: false, error: 'Format: XX:XX:XX:XX:XX:XX', source: '', timestamp: null });
      setResult(null);
      return;
    }
    if ((activeTab === 'emailrep' || activeTab === 'breach') && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setApiStatus({ loading: false, error: 'Valid email required (user@domain.tld)', source: '', timestamp: null });
      setResult(null);
      return;
    }
    setApiStatus({ loading: true, error: null, source: '', timestamp: null });
    setResult(null);
    const ctrl = new AbortController();
    const abortT = window.setTimeout(() => ctrl.abort(), 12000);
    try {
      const cfg = TABS.find(t => t.id === activeTab)!;
      const qs = trimmed ? `${cfg.param}=${encodeURIComponent(trimmed)}` : '';
      const url = `${ENDPOINT[activeTab]}${qs ? '?' + qs : ''}`;
      const res = await fetch(url, { signal: ctrl.signal });
      const data = await res.json();
      if (data.error) {
        setApiStatus({ loading: false, error: data.error, source: data.source || '', timestamp: data.timestamp ? new Date(data.timestamp).getTime() : Date.now(), cached: data.cached });
        setResult(null);
      } else {
        setResult(data);
        setApiStatus({
          loading: false,
          error: null,
          source: data.source || `Live (${activeTab.toUpperCase()})`,
          timestamp: data.timestamp ? new Date(data.timestamp).getTime() : Date.now(),
          cached: data.cached,
        });
      }
    } catch (err: any) {
      const msg = err?.name === 'AbortError'
        ? 'Délai dépassé — la source ne répond plus, réessayez'
        : (err?.message || 'échec de la requête');
      setApiStatus({ loading: false, error: msg, source: '', timestamp: Date.now() });
    } finally {
      window.clearTimeout(abortT);
    }
  }, [target, activeTab]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !apiStatus.loading) runScan();
  };

  return (
    <div className="h-full flex flex-col glass-panel rounded-lg hud-zone">
      <div className="flex items-center justify-between px-3 py-2 border-b border-cyan-900/40 data-stream-line">
        <div className="flex items-center gap-2">
          <Network className="w-3.5 h-3.5 text-cyan-400" />
          <span className="text-cyan-400 font-mono text-[11px] font-bold tracking-wider text-glow">HOST RECON</span>
          {apiStatus.loading && <div className="w-1.5 h-1.5 bg-cyan-400 rounded-full pulse-glow" />}
          {apiStatus.error && <AlertTriangle className="w-3 h-3 text-red-400" />}
        </div>
        <span className="text-cyan-700 font-mono text-[9px]">18-IN-1 · SB-PORT</span>
      </div>

      <div className="grid grid-cols-9 gap-0.5 px-2 pt-2">
        {TABS.map(tab => (
          <button
            key={tab.id}
            data-recon-tab={tab.id}
            onClick={() => { setActiveTab(tab.id); setResult(null); setApiStatus(prev => ({ ...prev, error: null })); }}
            className={`flex flex-col items-center gap-0.5 py-1.5 rounded text-[8px] font-mono tracking-wider transition-all ${
              activeTab === tab.id
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/50 shadow-[0_0_8px_rgba(34,211,238,0.2)]'
                : 'bg-black/30 text-cyan-800 hover:text-cyan-500 hover:bg-cyan-950/30 border border-transparent'
            }`}
            title={tab.hint}
          >
            {tab.icon}
            <span className="font-bold">{tab.label}</span>
          </button>
        ))}
      </div>

      <div className="px-2 py-2 border-b border-cyan-900/30">
        <div className="flex gap-1">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-cyan-600" />
            <input
              type="text"
              data-recon-input
              value={target}
              onChange={e => setTarget(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder={TABS.find(t => t.id === activeTab)?.placeholder}
              className="terminal-input w-full pl-7 pr-2 py-1.5 text-[10px] rounded text-cyan-200 placeholder:text-cyan-900 font-mono"
            />
          </div>
          <button
            onClick={runScan}
            data-recon-run
            disabled={apiStatus.loading || (!target.trim() && TABS.find(t => t.id === activeTab)?.param !== 'optional')}
            className="px-2.5 py-1.5 bg-cyan-500/15 border border-cyan-500/40 rounded text-[9px] font-mono font-bold text-cyan-300 hover:bg-cyan-500/25 hover:border-cyan-400/60 transition-all disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1 shadow-[0_0_8px_rgba(34,211,238,0.1)]"
          >
            {apiStatus.loading ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Scan className="w-3 h-3" />}
            RUN
          </button>
        </div>
        <div className="text-[7px] font-mono text-cyan-800 mt-1 px-1">
          {TABS.find(t => t.id === activeTab)?.hint}
        </div>
      </div>

      {apiStatus.source && (
        <div className="flex items-center gap-1 px-3 py-1 bg-black/30 border-b border-gray-800/30">
          <Database className="w-2.5 h-2.5 text-gray-600" />
          <span className="text-[8px] font-mono text-gray-600 truncate">SRC: {apiStatus.source}</span>
          {apiStatus.cached && <span className="text-[7px] font-mono text-amber-700">CACHED</span>}
          {apiStatus.timestamp && (
            <span className="text-[8px] font-mono text-gray-700 ml-auto">
              {new Date(apiStatus.timestamp).toLocaleTimeString()}
            </span>
          )}
        </div>
      )}

      {apiStatus.error && (
        <div className="mx-2 mt-2 px-2 py-1.5 bg-red-900/20 border border-red-800/40 rounded flex items-center gap-1.5">
          <XCircle className="w-3 h-3 text-red-400 flex-shrink-0" />
          <span className="text-[9px] font-mono text-red-400 truncate">{apiStatus.error}</span>
        </div>
      )}

      <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
        {result && <ReconResult tab={activeTab} data={result} onLocate={onLocate} />}
        {!result && !apiStatus.loading && !apiStatus.error && (
          <div className="flex flex-col items-center justify-center h-full text-gray-700 gap-2">
            <Scan className="w-6 h-6 opacity-50" />
            <span className="text-[10px] font-mono">Enter a target and hit RUN</span>
          </div>
        )}
      </div>
    </div>
  );
}

function ReconResult({ tab, data, onLocate }: { tab: ReconTab; data: any; onLocate?: (item: any) => void }) {
  switch (tab) {
    case 'headers':    return <HeadersResult data={data} />;
    case 'ssl':        return <SSLResult data={data} />;
    case 'dns':        return <DNSResult data={data} />;
    case 'whois':      return <WhoisResult data={data} />;
    case 'ports':      return <PortsResult data={data} onLocate={onLocate} />;
    case 'shodan':     return <ShodanResult data={data} onLocate={onLocate} />;
    case 'ip':         return <IpResult data={data} onLocate={onLocate} />;
    case 'bgp':        return <BgpResult data={data} />;
    case 'sanctions':  return <SanctionsResult data={data} />;
    case 'cve':        return <CveResult data={data} />;
    case 'mac':        return <MacResult data={data} />;
    case 'github':     return <GithubResult data={data} />;
    case 'threats':    return <ThreatsResult data={data} />;
    case 'malware':    return <MalwareResult data={data} onLocate={onLocate} />;
    case 'emailrep':   return <EmailRepResult data={data} />;
    case 'breach':     return <BreachResult data={data} />;
    case 'reversedns': return <ReverseDnsResult data={data} />;
    case 'adresse':    return <AdresseResult data={data} onLocate={onLocate} />;
  }
}

function HeadersResult({ data }: { data: any }) {
  const headers: { name: string; value: string; present: boolean; recommended?: string; risk?: 'low' | 'medium' | 'high' }[] = data.headers || [];
  const score = data.securityScore;
  const grade = score >= 90 ? 'A' : score >= 75 ? 'B' : score >= 50 ? 'C' : score >= 25 ? 'D' : 'F';
  const gradeColor = score >= 75 ? 'text-green-400' : score >= 50 ? 'text-yellow-400' : 'text-red-400';
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3 p-2 bg-black/40 border border-gray-800/50 rounded">
        <div className={`text-2xl font-mono font-bold ${gradeColor}`}>{grade}</div>
        <div>
          <div className="text-[9px] font-mono text-gray-500">SECURITY SCORE</div>
          <div className={`text-[11px] font-mono font-bold ${gradeColor}`}>{score ?? 'N/D'}/100</div>
        </div>
        <div className="ml-auto text-right">
          <div className="text-[9px] font-mono text-gray-500">{data.url || data.domain || ''}</div>
          {data.server && <div className="text-[8px] font-mono text-gray-600">Server: {data.server}</div>}
        </div>
      </div>
      <div className="space-y-0.5">
        <div className="text-[8px] font-mono text-gray-600 tracking-wider mb-1">SECURITY HEADERS</div>
        {headers.map((h, i) => (
          <div key={i} className="flex items-start gap-1.5 px-1.5 py-1 bg-black/30 rounded border border-gray-800/40">
            {h.present ? <CheckCircle2 className="w-3 h-3 text-green-500 flex-shrink-0 mt-0.5" /> : <XCircle className="w-3 h-3 text-red-500 flex-shrink-0 mt-0.5" />}
            <div className="flex-1 min-w-0">
              <div className="text-[9px] font-mono text-gray-300 truncate">{h.name}</div>
              {h.present && h.value && <div className="text-[8px] font-mono text-gray-500 truncate">{h.value}</div>}
              {!h.present && h.recommended && <div className="text-[7px] font-mono text-amber-700">Recommended: {h.recommended}</div>}
            </div>
            {h.risk && !h.present && (
              <span className={`text-[6px] font-mono px-1 py-0.5 rounded ${
                h.risk === 'high' ? 'bg-red-900/40 text-red-400' : h.risk === 'medium' ? 'bg-orange-900/40 text-orange-400' : 'bg-yellow-900/40 text-yellow-400'
              }`}>{h.risk.toUpperCase()}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function SSLResult({ data }: { data: any }) {
  const certs = data.certificates || [];
  return (
    <div className="space-y-2">
      <div className="p-2 bg-black/40 border border-gray-800/50 rounded">
        <div className="flex items-center gap-2 mb-1">
          <Lock className="w-3 h-3 text-green-400" />
          <span className="text-[10px] font-mono text-green-400 font-bold">{data.domain}</span>
        </div>
        <div className="grid grid-cols-2 gap-1 text-[8px] font-mono">
          {data.issuer && <><span className="text-gray-600">Issuer:</span><span className="text-gray-300 truncate">{data.issuer}</span></>}
          {data.validFrom && <><span className="text-gray-600">From:</span><span className="text-gray-300">{data.validFrom}</span></>}
          {data.validTo && <><span className="text-gray-600">Expires:</span><span className="text-gray-300">{data.validTo}</span></>}
          {data.daysRemaining != null && <><span className="text-gray-600">Days left:</span><span className={data.daysRemaining < 30 ? 'text-red-400' : 'text-green-400'}>{data.daysRemaining}</span></>}
          {data.tlsVersion && <><span className="text-gray-600">TLS:</span><span className="text-cyan-400">{data.tlsVersion}</span></>}
        </div>
      </div>
      <div>
        <div className="text-[8px] font-mono text-gray-600 tracking-wider mb-1">CERTIFICATE TRANSPARENCY LOG ({certs.length})</div>
        <div className="space-y-0.5 max-h-64 overflow-y-auto custom-scrollbar">
          {certs.slice(0, 30).map((c: any, i: number) => (
            <div key={i} className="px-1.5 py-1 bg-black/30 rounded border border-gray-800/40">
              <div className="flex items-center gap-1.5">
                <span className="text-[8px] font-mono text-cyan-400 truncate flex-1">{c.issuer_name || c.issuer || 'Unknown'}</span>
                <span className="text-[7px] font-mono text-gray-600">{c.not_before?.split('T')[0]} → {c.not_after?.split('T')[0]}</span>
              </div>
            </div>
          ))}
          {certs.length === 0 && <div className="text-[9px] font-mono text-gray-700 text-center py-2">No CT log entries</div>}
        </div>
      </div>
    </div>
  );
}

function DNSResult({ data }: { data: any }) {
  const records = data.records || {};
  const types = Object.keys(records);
  return (
    <div className="space-y-2">
      <div className="p-2 bg-black/40 border border-gray-800/50 rounded">
        <div className="text-[10px] font-mono text-cyan-400 font-bold">{data.domain}</div>
      </div>
      {types.map(type => {
        const recs = records[type];
        if (!recs || recs.length === 0) return null;
        return (
          <div key={type}>
            <div className="text-[8px] font-mono text-gray-600 tracking-wider mb-1">{type} ({recs.length})</div>
            <div className="space-y-0.5">
              {recs.map((r: any, i: number) => (
                <div key={i} className="px-1.5 py-1 bg-black/30 rounded border border-gray-800/40 flex items-center gap-1.5">
                  <span className="text-[7px] font-mono text-cyan-700 w-8 flex-shrink-0">{type}</span>
                  <span className="text-[9px] font-mono text-gray-300 truncate flex-1">
                    {typeof r === 'string' ? r : r.name || r.value || r.exchange || JSON.stringify(r)}
                  </span>
                  {r.TTL && <span className="text-[7px] font-mono text-gray-600">TTL {r.TTL}</span>}
                </div>
              ))}
            </div>
          </div>
        );
      })}
      {types.length === 0 && <div className="text-[9px] font-mono text-gray-700 text-center py-4">No DNS records</div>}
    </div>
  );
}

function WhoisResult({ data }: { data: any }) {
  const events = data.events || [];
  const nameservers = data.nameservers || [];
  return (
    <div className="space-y-2">
      <div className="p-2 bg-black/40 border border-gray-800/50 rounded">
        <div className="text-[10px] font-mono text-cyan-400 font-bold mb-1">{data.domain}</div>
        <div className="grid grid-cols-2 gap-1 text-[8px] font-mono">
          {data.registrar && <><span className="text-gray-600">Registrar:</span><span className="text-gray-300 truncate">{data.registrar}</span></>}
          {data.status && <><span className="text-gray-600">Status:</span><span className="text-gray-300 truncate">{Array.isArray(data.status) ? data.status.join(', ') : data.status}</span></>}
          {data.registered && <><span className="text-gray-600">Created:</span><span className="text-gray-300">{data.registered}</span></>}
          {data.updated && <><span className="text-gray-600">Updated:</span><span className="text-gray-300">{data.updated}</span></>}
          {data.expires && <><span className="text-gray-600">Expires:</span><span className="text-gray-300">{data.expires}</span></>}
          {data.registrant && <><span className="text-gray-600">Registrant:</span><span className="text-gray-300 truncate">{data.registrant}</span></>}
        </div>
      </div>
      {nameservers.length > 0 && (
        <div>
          <div className="text-[8px] font-mono text-gray-600 tracking-wider mb-1">NAMESERVERS</div>
          <div className="space-y-0.5">
            {nameservers.map((ns: string, i: number) => (
              <div key={i} className="px-1.5 py-1 bg-black/30 rounded border border-gray-800/40 text-[9px] font-mono text-gray-300">{ns}</div>
            ))}
          </div>
        </div>
      )}
      {events.length > 0 && (
        <div>
          <div className="text-[8px] font-mono text-gray-600 tracking-wider mb-1">REGISTRY EVENTS</div>
          <div className="space-y-0.5">
            {events.map((ev: any, i: number) => (
              <div key={i} className="px-1.5 py-1 bg-black/30 rounded border border-gray-800/40 flex items-center gap-1.5">
                <span className="text-[8px] font-mono text-cyan-700">{ev.eventAction}</span>
                <span className="text-[8px] font-mono text-gray-500 ml-auto">{ev.eventDate}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function PortsResult({ data, onLocate }: { data: any; onLocate?: (item: any) => void }) {
  const openPorts = data.openPorts || data.open_ports || data.results || [];
  const summary = data.summary || {};
  return (
    <div className="space-y-2">
      <div className="p-2 bg-black/40 border border-gray-800/50 rounded flex items-center gap-2">
        <Server className="w-3 h-3 text-amber-400" />
        <span className="text-[10px] font-mono text-amber-400 font-bold">{data.target || data.host}</span>
        <span className="ml-auto text-[9px] font-mono text-gray-500">
          {openPorts.length} OPEN / {data.scannedPorts || 22} scanned
        </span>
      </div>
      <div className="space-y-0.5">
        {openPorts.map((p: any, i: number) => {
          const port = p.port ?? p;
          const svc = p.service || '';
          const risk = p.risk || 'low';
          const riskColors: Record<string, string> = {
            high: 'bg-red-900/40 text-red-400 border-red-800/40',
            medium: 'bg-orange-900/40 text-orange-400 border-orange-800/40',
            low: 'bg-green-900/40 text-green-400 border-green-800/40',
          };
          return (
            <div
              key={i}
              onClick={() => onLocate?.({ ip: data.target, port, service: svc })}
              className="flex items-center gap-2 px-1.5 py-1.5 bg-black/30 rounded border border-gray-800/40 hover:border-amber-900/40 cursor-pointer"
            >
              <span className="text-[9px] font-mono text-amber-400 font-bold w-10">{port}</span>
              <span className="text-[8px] font-mono text-gray-300 flex-1 truncate">{svc}</span>
              {p.banner && <span className="text-[7px] font-mono text-gray-600 truncate max-w-[100px]">{p.banner}</span>}
              <span className={`text-[6px] font-mono px-1 py-0.5 rounded border ${riskColors[risk]}`}>{risk.toUpperCase()}</span>
            </div>
          );
        })}
        {openPorts.length === 0 && (
          <div className="text-[9px] font-mono text-gray-700 text-center py-4">No open ports found</div>
        )}
      </div>
    </div>
  );
}

function ShodanResult({ data, onLocate }: { data: any; onLocate?: (item: any) => void }) {
  const ports = data.ports || [];
  const vulns = data.vulns || [];
  const cpes = data.cpes || [];
  const hostnames = data.hostnames || [];
  return (
    <div className="space-y-2">
      <div
        onClick={() => data.lat && data.lng && onLocate?.({ lat: data.lat, lng: data.lng, name: data.ip })}
        className={`p-2 bg-black/40 border border-gray-800/50 rounded ${data.lat ? 'cursor-pointer hover:border-cyan-700/40' : ''}`}
      >
        <div className="flex items-center gap-2 mb-1">
          <Scan className="w-3 h-3 text-fuchsia-400" />
          <span className="text-[10px] font-mono text-fuchsia-400 font-bold">{data.ip}</span>
          {data.org && <span className="text-[8px] font-mono text-gray-500 truncate ml-auto">{data.org}</span>}
        </div>
        <div className="grid grid-cols-2 gap-1 text-[8px] font-mono">
          {data.country && <><span className="text-gray-600">Country:</span><span className="text-gray-300">{data.country}{data.countryCode ? ` (${data.countryCode})` : ''}</span></>}
          {data.city && <><span className="text-gray-600">City:</span><span className="text-gray-300">{data.city}</span></>}
          {data.isp && <><span className="text-gray-600">ISP:</span><span className="text-gray-300 truncate">{data.isp}</span></>}
          {data.asn && <><span className="text-gray-600">ASN:</span><span className="text-gray-300">{data.asn}</span></>}
          {data.os && <><span className="text-gray-600">OS:</span><span className="text-gray-300 truncate">{data.os}</span></>}
          {data.lastSeen && <><span className="text-gray-600">Last seen:</span><span className="text-gray-300">{data.lastSeen}</span></>}
        </div>
      </div>
      {hostnames.length > 0 && (
        <div>
          <div className="text-[8px] font-mono text-gray-600 tracking-wider mb-1">HOSTNAMES</div>
          <div className="space-y-0.5">
            {hostnames.map((h: string, i: number) => (
              <div key={i} className="px-1.5 py-1 bg-black/30 rounded border border-gray-800/40 text-[9px] font-mono text-gray-300 truncate">{h}</div>
            ))}
          </div>
        </div>
      )}
      {ports.length > 0 && (
        <div>
          <div className="text-[8px] font-mono text-gray-600 tracking-wider mb-1">OPEN PORTS ({ports.length})</div>
          <div className="flex flex-wrap gap-1">
            {ports.map((p: any, i: number) => (
              <span key={i} className="text-[8px] font-mono px-1.5 py-0.5 bg-fuchsia-900/30 border border-fuchsia-800/40 text-fuchsia-400 rounded">
                {typeof p === 'number' ? p : p.port}
              </span>
            ))}
          </div>
        </div>
      )}
      {vulns.length > 0 && (
        <div>
          <div className="text-[8px] font-mono text-red-500 tracking-wider mb-1 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" /> VULNERABILITIES ({vulns.length})
          </div>
          <div className="space-y-0.5 max-h-32 overflow-y-auto custom-scrollbar">
            {vulns.slice(0, 30).map((v: string, i: number) => (
              <div key={i} className="px-1.5 py-1 bg-red-900/20 border border-red-800/40 rounded text-[8px] font-mono text-red-300 truncate">{v}</div>
            ))}
          </div>
        </div>
      )}
      {cpes.length > 0 && (
        <div>
          <div className="text-[8px] font-mono text-gray-600 tracking-wider mb-1">SOFTWARE ({cpes.length})</div>
          <div className="space-y-0.5 max-h-32 overflow-y-auto custom-scrollbar">
            {cpes.slice(0, 20).map((c: string, i: number) => (
              <div key={i} className="px-1.5 py-1 bg-black/30 rounded border border-gray-800/40 text-[8px] font-mono text-gray-400 truncate">{c}</div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function IpResult({ data, onLocate }: { data: any; onLocate?: (item: any) => void }) {
  const geo = data.geo || {};
  const rep = data.reputation || {};
  const riskColors: Record<string, string> = {
    HIGH: 'bg-red-900/40 text-red-300 border-red-700/40 threat-border-high',
    MEDIUM: 'bg-amber-900/40 text-amber-300 border-amber-700/40',
    LOW: 'bg-emerald-900/40 text-emerald-300 border-emerald-700/40',
  };
  return (
    <div className="space-y-2">
      <div
        onClick={() => geo.lat && geo.lon && onLocate?.({ lat: geo.lat, lng: geo.lon, name: data.ip })}
        className={`p-2 glass-panel-strong rounded ${geo.lat ? 'cursor-pointer hover:border-cyan-500/60' : ''}`}
      >
        <div className="flex items-center gap-2 mb-2">
          <Globe className="w-3 h-3 text-cyan-400" />
          <span className="text-[10px] font-mono text-cyan-400 font-bold">{data.ip}</span>
          {rep.risk_level && (
            <span className={`ml-auto text-[8px] font-mono px-1.5 py-0.5 rounded border ${riskColors[rep.risk_level]}`}>{rep.risk_level}</span>
          )}
        </div>
        <div className="grid grid-cols-2 gap-1 text-[8px] font-mono">
          {geo.country && <><span className="text-cyan-700">Country:</span><span className="text-cyan-300">{geo.country} ({geo.country_code})</span></>}
          {geo.city && <><span className="text-cyan-700">City:</span><span className="text-cyan-300">{geo.city}, {geo.region}</span></>}
          {geo.lat != null && <><span className="text-cyan-700">Coord:</span><span className="text-cyan-300">{geo.lat.toFixed(3)}, {geo.lon?.toFixed(3)}</span></>}
          {geo.timezone && <><span className="text-cyan-700">TZ:</span><span className="text-cyan-300 truncate">{geo.timezone}</span></>}
          {geo.isp && <><span className="text-cyan-700">ISP:</span><span className="text-cyan-300 truncate">{geo.isp}</span></>}
          {geo.org && <><span className="text-cyan-700">Org:</span><span className="text-cyan-300 truncate">{geo.org}</span></>}
          {geo.as_number && <><span className="text-cyan-700">AS:</span><span className="text-cyan-300 truncate">{geo.as_number}</span></>}
          {geo.as_name && <><span className="text-cyan-700">AS Name:</span><span className="text-cyan-300 truncate">{geo.as_name}</span></>}
        </div>
      </div>
      <div className="grid grid-cols-3 gap-1 text-[8px] font-mono">
        <div className={`p-1.5 rounded border text-center ${rep.is_proxy ? 'bg-red-900/30 border-red-700/40 text-red-300' : 'bg-emerald-900/20 border-emerald-800/40 text-emerald-400'}`}>
          <div className="font-bold">PROXY</div><div>{rep.is_proxy ? 'YES' : 'NO'}</div>
        </div>
        <div className={`p-1.5 rounded border text-center ${rep.is_hosting ? 'bg-amber-900/30 border-amber-700/40 text-amber-300' : 'bg-emerald-900/20 border-emerald-800/40 text-emerald-400'}`}>
          <div className="font-bold">HOSTING</div><div>{rep.is_hosting ? 'YES' : 'NO'}</div>
        </div>
        <div className={`p-1.5 rounded border text-center ${rep.is_mobile ? 'bg-cyan-900/30 border-cyan-700/40 text-cyan-300' : 'bg-emerald-900/20 border-emerald-800/40 text-emerald-400'}`}>
          <div className="font-bold">MOBILE</div><div>{rep.is_mobile ? 'YES' : 'NO'}</div>
        </div>
      </div>
    </div>
  );
}

function BgpResult({ data }: { data: any }) {
  return (
    <div className="space-y-2">
      <div className="p-2 glass-panel-strong rounded">
        <div className="flex items-center gap-2 mb-1">
          <Network className="w-3 h-3 text-cyan-400" />
          <span className="text-[10px] font-mono text-cyan-400 font-bold">{data.query}</span>
          <span className="ml-auto text-[8px] font-mono px-1.5 py-0.5 bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 rounded">{data.type?.toUpperCase()}</span>
        </div>
      </div>
      {data.type === 'ip' && data.ip?.prefixes && (
        <div>
          <div className="text-[8px] font-mono text-cyan-700 tracking-wider mb-1">PREFIXES ({data.ip.prefixes.length})</div>
          <div className="space-y-0.5">
            {data.ip.prefixes.slice(0, 10).map((p: any, i: number) => (
              <div key={i} className="px-1.5 py-1 bg-black/30 rounded border border-cyan-900/40 text-[9px] font-mono text-cyan-300">
                <span className="text-cyan-400">{p.prefix}</span>
                <span className="text-cyan-700 ml-2">AS{p.asn?.asn} · {p.asn?.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {data.type === 'asn' && (
        <>
          {data.asn?.asn && (
            <div className="p-2 glass-panel-strong rounded">
              <div className="text-[10px] font-mono text-cyan-400 font-bold mb-1">AS{data.asn.asn.asn}</div>
              <div className="text-[9px] font-mono text-cyan-300">{data.asn.asn.name}</div>
              {data.asn.asn.country && <div className="text-[8px] font-mono text-cyan-700">Country: {data.asn.asn.country}</div>}
              {data.asn.asn.website && <div className="text-[8px] font-mono text-cyan-700 truncate">Website: {data.asn.asn.website}</div>}
            </div>
          )}
          {data.prefixes && (
            <div>
              <div className="text-[8px] font-mono text-cyan-700 tracking-wider mb-1">PREFIXES (v4: {data.prefixes.total_v4} · v6: {data.prefixes.total_v6})</div>
              <div className="space-y-0.5 max-h-32 overflow-y-auto custom-scrollbar">
                {data.prefixes.ipv4.map((p: any, i: number) => (
                  <div key={i} className="px-1.5 py-1 bg-black/30 rounded border border-cyan-900/40 text-[9px] font-mono text-cyan-300">{p.prefix}</div>
                ))}
              </div>
            </div>
          )}
          {data.peers && (
            <div>
              <div className="text-[8px] font-mono text-cyan-700 tracking-wider mb-1">PEERS ({data.peers.total})</div>
              <div className="space-y-0.5 max-h-32 overflow-y-auto custom-scrollbar">
                {data.peers.upstream.map((p: any, i: number) => (
                  <div key={i} className="px-1.5 py-1 bg-black/30 rounded border border-cyan-900/40 text-[9px] font-mono text-cyan-300">
                    AS{p.asn} · <span className="text-cyan-700 truncate">{p.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function SanctionsResult({ data }: { data: any }) {
  const matches = data.matches || [];
  return (
    <div className="space-y-2">
      <div className={`p-2 rounded border ${matches.length > 0 ? 'bg-red-950/30 border-red-700/50 threat-border-high' : 'glass-panel-strong'}`}>
        <div className="flex items-center gap-2">
          <Shield className={`w-3 h-3 ${matches.length > 0 ? 'text-red-400' : 'text-emerald-400'}`} />
          <span className={`text-[10px] font-mono font-bold ${matches.length > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
            {matches.length > 0 ? `${matches.length} MATCHES` : 'NO MATCHES'}
          </span>
          <span className="text-[8px] font-mono text-cyan-700 ml-auto truncate">{data.query}</span>
        </div>
      </div>
      <div className="space-y-1">
        {matches.map((m: any, i: number) => (
          <div key={i} className="p-1.5 bg-red-950/20 border border-red-700/30 rounded">
            <div className="text-[10px] font-mono text-red-300 font-bold">{m.caption}</div>
            <div className="flex items-center gap-1 mt-0.5">
              <span className="text-[7px] font-mono px-1 py-0.5 bg-red-900/40 border border-red-700/40 text-red-300 rounded">{m.schema}</span>
              {m.countries?.map((c: string, j: number) => (
                <span key={j} className="text-[7px] font-mono text-cyan-700">{c}</span>
              ))}
            </div>
            {m.datasets?.length > 0 && (
              <div className="text-[7px] font-mono text-cyan-800 mt-1 truncate">{m.datasets.join(' · ')}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function CveResult({ data }: { data: any }) {
  const cvss = data.cvss;
  const scoreColor = cvss?.baseScore >= 9 ? 'text-red-400' : cvss?.baseScore >= 7 ? 'text-orange-400' : cvss?.baseScore >= 4 ? 'text-amber-400' : 'text-emerald-400';
  return (
    <div className="space-y-2">
      <div className="p-2 glass-panel-strong rounded">
        <div className="flex items-center gap-2 mb-1">
          <AlertTriangle className="w-3 h-3 text-amber-400" />
          <span className="text-[10px] font-mono text-amber-400 font-bold">{data.id}</span>
          <span className="ml-auto text-[7px] font-mono px-1.5 py-0.5 bg-amber-900/30 border border-amber-700/40 text-amber-300 rounded">{data.state || 'PUBLISHED'}</span>
        </div>
        {cvss && (
          <div className="flex items-center gap-3 mt-1">
            <div className={`text-2xl font-mono font-bold ${scoreColor}`}>{cvss.baseScore}</div>
            <div className="text-[8px] font-mono">
              <div className={scoreColor}>{cvss.baseSeverity} · CVSS {cvss.version}</div>
              <div className="text-cyan-700 truncate max-w-[180px]">{cvss.vectorString}</div>
            </div>
          </div>
        )}
      </div>
      <div className="p-2 bg-black/30 border border-cyan-900/40 rounded">
        <div className="text-[8px] font-mono text-cyan-700 tracking-wider mb-1">DESCRIPTION</div>
        <div className="text-[9px] font-mono text-cyan-300 leading-relaxed">{data.description}</div>
      </div>
      {data.cwe?.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {data.cwe.map((c: string, i: number) => (
            <span key={i} className="text-[8px] font-mono px-1.5 py-0.5 bg-cyan-900/30 border border-cyan-700/40 text-cyan-300 rounded">{c}</span>
          ))}
        </div>
      )}
      {data.references?.length > 0 && (
        <div>
          <div className="text-[8px] font-mono text-cyan-700 tracking-wider mb-1">REFERENCES ({data.references.length})</div>
          <div className="space-y-0.5">
            {data.references.map((r: any, i: number) => (
              <a key={i} href={r.url} target="_blank" rel="noopener noreferrer" className="block px-1.5 py-1 bg-black/30 rounded border border-cyan-900/40 text-[8px] font-mono text-cyan-400 hover:text-cyan-200 hover:border-cyan-500/40 truncate">
                {r.url}
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function MacResult({ data }: { data: any }) {
  return (
    <div className="p-3 glass-panel-strong rounded text-center">
      <Server className="w-6 h-6 text-cyan-400 mx-auto mb-2" />
      <div className="text-[10px] font-mono text-cyan-700 tracking-wider mb-1">MAC ADDRESS</div>
      <div className="text-[12px] font-mono text-cyan-400 font-bold mb-3">{data.mac}</div>
      <div className="text-[10px] font-mono text-cyan-700 tracking-wider mb-1">VENDOR</div>
      <div className="text-[14px] font-mono text-cyan-200">{data.vendor}</div>
    </div>
  );
}

function GithubResult({ data }: { data: any }) {
  const p = data.profile || {};
  const repos = data.repos || [];
  return (
    <div className="space-y-2">
      <div className="p-2 glass-panel-strong rounded">
        <div className="flex items-center gap-2 mb-1">
          {p.avatar_url && (
            <img src={p.avatar_url} alt="" className="w-8 h-8 rounded-full border border-cyan-500/40" />
          )}
          <div className="flex-1 min-w-0">
            <div className="text-[11px] font-mono text-cyan-400 font-bold truncate">{p.name || data.username}</div>
            <a href={p.html_url} target="_blank" rel="noopener noreferrer" className="text-[8px] font-mono text-cyan-700 hover:text-cyan-400 truncate block">@{data.username}</a>
          </div>
        </div>
        {p.bio && <div className="text-[9px] font-mono text-cyan-300 mb-1">{p.bio}</div>}
        <div className="grid grid-cols-3 gap-1 text-[8px] font-mono text-center mt-2">
          <div className="p-1 bg-black/30 border border-cyan-900/40 rounded"><div className="text-cyan-400 font-bold">{p.public_repos ?? 0}</div><div className="text-cyan-700">REPOS</div></div>
          <div className="p-1 bg-black/30 border border-cyan-900/40 rounded"><div className="text-cyan-400 font-bold">{p.followers ?? 0}</div><div className="text-cyan-700">FOLLOWERS</div></div>
          <div className="p-1 bg-black/30 border border-cyan-900/40 rounded"><div className="text-cyan-400 font-bold">{p.following ?? 0}</div><div className="text-cyan-700">FOLLOWING</div></div>
        </div>
        <div className="grid grid-cols-2 gap-1 text-[8px] font-mono mt-2">
          {p.company && <><span className="text-cyan-700">Company:</span><span className="text-cyan-300 truncate">{p.company}</span></>}
          {p.location && <><span className="text-cyan-700">Location:</span><span className="text-cyan-300 truncate">{p.location}</span></>}
          {p.created_at && <><span className="text-cyan-700">Joined:</span><span className="text-cyan-300">{p.created_at?.split('T')[0]}</span></>}
        </div>
      </div>
      {repos.length > 0 && (
        <div>
          <div className="text-[8px] font-mono text-cyan-700 tracking-wider mb-1">RECENT REPOS ({repos.length})</div>
          <div className="space-y-0.5">
            {repos.map((r: any, i: number) => (
              <a key={i} href={r.html_url} target="_blank" rel="noopener noreferrer" className="block px-1.5 py-1 bg-black/30 rounded border border-cyan-900/40 hover:border-cyan-500/40 transition-colors">
                <div className="flex items-center gap-1.5">
                  <span className="text-[9px] font-mono text-cyan-300 truncate flex-1">{r.name}</span>
                  {r.language && <span className="text-[7px] font-mono px-1 py-0.5 bg-cyan-900/30 border border-cyan-700/30 text-cyan-400 rounded">{r.language}</span>}
                  <span className="text-[7px] font-mono text-amber-400">★{r.stars}</span>
                </div>
                {r.description && <div className="text-[7px] font-mono text-cyan-800 truncate">{r.description}</div>}
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ThreatsResult({ data }: { data: any }) {
  const pulses = data.pulses || [];
  const otx = data.otx || {};
  const riskColors: Record<string, string> = {
    HIGH: 'bg-red-900/40 text-red-300 border-red-700/40 threat-border-high',
    MEDIUM: 'bg-amber-900/40 text-amber-300 border-amber-700/40',
    LOW: 'bg-emerald-900/40 text-emerald-300 border-emerald-700/40',
  };
  return (
    <div className="space-y-2">
      <div className={`p-2 rounded border ${riskColors[data.threat_level]}`}>
        <div className="flex items-center gap-2">
          <Activity className="w-3 h-3" />
          <span className="text-[10px] font-mono font-bold">THREAT LEVEL: {data.threat_level}</span>
          {data.query && <span className="ml-auto text-[8px] font-mono opacity-70 truncate">{data.query}</span>}
        </div>
      </div>
      {data.tor_exit_node != null && (
        <div className={`p-1.5 rounded border text-[9px] font-mono ${data.tor_exit_node ? 'bg-red-950/30 border-red-700/40 text-red-300 threat-border-critical' : 'bg-emerald-950/20 border-emerald-700/40 text-emerald-300'}`}>
          <span className="font-bold">TOR EXIT NODE:</span> {data.tor_exit_node ? 'YES · this IP is a known Tor exit' : 'NO'}
        </div>
      )}
      {otx.pulse_count != null && (
        <div className="p-1.5 bg-black/30 border border-cyan-900/40 rounded text-[9px] font-mono">
          <div className="flex justify-between"><span className="text-cyan-700">OTX Pulses:</span><span className="text-cyan-300">{otx.pulse_count}</span></div>
          {otx.reputation != null && <div className="flex justify-between"><span className="text-cyan-700">Reputation:</span><span className="text-cyan-300">{otx.reputation ?? 'N/D'}</span></div>}
          {otx.country && <div className="flex justify-between"><span className="text-cyan-700">Country:</span><span className="text-cyan-300">{otx.country}</span></div>}
          {otx.asn && <div className="flex justify-between"><span className="text-cyan-700">ASN:</span><span className="text-cyan-300 truncate ml-2">{otx.asn}</span></div>}
        </div>
      )}
      {pulses.length > 0 && (
        <div>
          <div className="text-[8px] font-mono text-cyan-700 tracking-wider mb-1">RECENT OTX PULSES ({pulses.length})</div>
          <div className="space-y-1 max-h-64 overflow-y-auto custom-scrollbar">
            {pulses.map((p: any, i: number) => (
              <div key={i} className="p-1.5 bg-black/30 border border-cyan-900/40 rounded">
                <div className="text-[9px] font-mono text-cyan-300 font-bold">{p.name}</div>
                {p.description && <div className="text-[8px] font-mono text-cyan-700 mt-0.5 line-clamp-2">{p.description}</div>}
                <div className="flex items-center gap-1 mt-1 flex-wrap">
                  {p.adversary && <span className="text-[7px] font-mono px-1 py-0.5 bg-red-900/30 border border-red-700/30 text-red-300 rounded">{p.adversary}</span>}
                  {p.tags?.slice(0, 3).map((t: string, j: number) => (
                    <span key={j} className="text-[7px] font-mono px-1 py-0.5 bg-cyan-900/30 border border-cyan-700/30 text-cyan-400 rounded">{t}</span>
                  ))}
                  {p.indicators_count != null && <span className="text-[7px] font-mono text-cyan-800 ml-auto">{p.indicators_count} IOCs</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function MalwareResult({ data, onLocate }: { data: any; onLocate?: (item: any) => void }) {
  const threats: any[] = data.threats || [];
  const stats = data.stats || { total: 0, by_country: {}, by_malware: {} };
  const topCountries = Object.entries(stats.by_country || {})
    .sort((a: any, b: any) => b[1] - a[1])
    .slice(0, 5) as [string, number][];
  const topMalware = Object.entries(stats.by_malware || {})
    .sort((a: any, b: any) => b[1] - a[1])
    .slice(0, 5) as [string, number][];
  return (
    <div className="space-y-2">
      <div className="p-2 bg-red-950/30 border border-red-800/40 rounded">
        <div className="flex items-center gap-2">
          <Bug className="w-3 h-3 text-red-400" />
          <span className="text-[10px] font-mono text-red-300 font-bold">MALWARE C2 INTEL FEED</span>
          <span className="ml-auto text-[9px] font-mono text-red-500">{stats.total} LIVE IOCs</span>
        </div>
        <div className="text-[7px] font-mono text-red-700 mt-0.5">{data.source}</div>
      </div>
      {topCountries.length > 0 && (
        <div className="p-1.5 bg-black/30 border border-gray-800/40 rounded">
          <div className="text-[8px] font-mono text-gray-500 mb-1 tracking-wider">TOP COUNTRIES</div>
          <div className="space-y-0.5">
            {topCountries.map(([cc, count]) => (
              <div key={cc} className="flex justify-between text-[9px] font-mono">
                <span className="text-cyan-400">{cc}</span>
                <span className="text-gray-400">{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {topMalware.length > 0 && (
        <div className="p-1.5 bg-black/30 border border-gray-800/40 rounded">
          <div className="text-[8px] font-mono text-gray-500 mb-1 tracking-wider">TOP MALWARE FAMILIES</div>
          <div className="space-y-0.5">
            {topMalware.map(([name, count]) => (
              <div key={name} className="flex justify-between text-[9px] font-mono">
                <span className="text-red-300 truncate">{name}</span>
                <span className="text-gray-400 ml-2">{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      <div>
        <div className="text-[8px] font-mono text-cyan-700 tracking-wider mb-1">LIVE INDICATORS ({threats.length})</div>
        <div className="space-y-1 max-h-64 overflow-y-auto custom-scrollbar">
          {threats.map((t, i) => (
            <div
              key={t.id || i}
              className="p-1.5 bg-black/30 border border-red-900/30 rounded cursor-pointer hover:bg-red-950/30"
              onClick={() => onLocate?.(t)}
            >
              <div className="flex items-center gap-1.5">
                <span className={`text-[6px] font-mono px-1 py-0.5 rounded ${t.threat_type === 'botnet_c2' ? 'bg-red-900/40 text-red-300' : 'bg-amber-900/40 text-amber-300'}`}>
                  {t.threat_type === 'botnet_c2' ? 'C2' : 'URL'}
                </span>
                <span className="text-[9px] font-mono text-cyan-300 truncate flex-1">{t.ip || t.url || 'unknown'}</span>
                {t.country && <span className="text-[7px] font-mono text-gray-500">{t.country}</span>}
              </div>
              <div className="text-[7px] font-mono text-gray-600 mt-0.5 flex justify-between">
                <span className="truncate">{t.malware || t.threat}</span>
                {t.port > 0 && <span>:{t.port}</span>}
              </div>
              {t.last_online && <div className="text-[6px] font-mono text-gray-700">Last seen: {t.last_online}</div>}
            </div>
          ))}
          {threats.length === 0 && <div className="text-[9px] font-mono text-gray-700 text-center py-2">No live threats</div>}
        </div>
      </div>
    </div>
  );
}

function EmailRepResult({ data }: { data: any }) {
  const verdict = data.disposable
    ? { label: 'DISPOSABLE', color: 'text-red-400 bg-red-950/40 border-red-700/40' }
    : data.mx_present === false
      ? { label: 'NO MX', color: 'text-amber-400 bg-amber-950/30 border-amber-700/40' }
      : data.mx_present === true
        ? { label: 'VALID', color: 'text-emerald-400 bg-emerald-950/30 border-emerald-700/40' }
        : { label: 'UNKNOWN', color: 'text-gray-400 bg-gray-950/30 border-gray-700/40' };
  return (
    <div className="space-y-2">
      <div className={`p-2 rounded border ${verdict.color}`}>
        <div className="flex items-center gap-2">
          <MailCheck className="w-3 h-3" />
          <span className="text-[10px] font-mono font-bold">{verdict.label}</span>
          <span className="ml-auto text-[8px] font-mono opacity-70 truncate">{data.email}</span>
        </div>
      </div>
      <div className="p-1.5 bg-black/30 border border-cyan-900/40 rounded text-[9px] font-mono space-y-1">
        <div className="flex justify-between"><span className="text-gray-500">Domain:</span><span className="text-cyan-300">{data.domain}</span></div>
        <div className="flex justify-between"><span className="text-gray-500">Local part:</span><span className="text-cyan-300">{data.local_part}</span></div>
        <div className="flex justify-between">
          <span className="text-gray-500">MX present:</span>
          <span className={data.mx_present ? 'text-emerald-400' : data.mx_present === false ? 'text-red-400' : 'text-gray-500'}>
            {data.mx_present === null ? 'unknown' : data.mx_present ? 'yes' : 'no'}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Disposable:</span>
          <span className={data.disposable ? 'text-red-400' : 'text-emerald-400'}>{data.disposable ? 'YES' : 'no'}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Alias support:</span>
          <span className="text-cyan-300">{data.alias ? 'yes' : 'no'}</span>
        </div>
        <div className="flex justify-between"><span className="text-gray-500">Autocomplete:</span><span className="text-cyan-300">{data.autocomplete ? 'yes' : 'no'}</span></div>
      </div>
      {data.note && <div className="text-[7px] font-mono text-gray-600 italic">{data.note}</div>}
      <div className="text-[7px] font-mono text-gray-700">Source: {data.source}</div>
    </div>
  );
}

function BreachResult({ data }: { data: any }) {
  const breaches: any[] = data.breaches || [];
  const exposed = data.exposed === true;
  return (
    <div className="space-y-2">
      <div className={`p-2 rounded border ${exposed ? 'bg-red-950/40 border-red-700/40' : 'bg-emerald-950/30 border-emerald-700/40'}`}>
        <div className="flex items-center gap-2">
          <Mail className={`w-3 h-3 ${exposed ? 'text-red-400' : 'text-emerald-400'}`} />
          <span className={`text-[10px] font-mono font-bold ${exposed ? 'text-red-300' : 'text-emerald-300'}`}>
            {exposed ? `EXPOSED IN ${breaches.length} BREACH${breaches.length !== 1 ? 'ES' : ''}` : 'NO EXPOSURE FOUND'}
          </span>
          <span className="ml-auto text-[8px] font-mono opacity-70 truncate">{data.email}</span>
        </div>
      </div>
      {exposed && (
        <div>
          <div className="text-[8px] font-mono text-cyan-700 tracking-wider mb-1">BREACH NAMES ({breaches.length})</div>
          <div className="flex flex-wrap gap-1 max-h-64 overflow-y-auto custom-scrollbar">
            {breaches.map((b, i) => (
              <a
                key={i}
                href={`https://xposedornot.com/breach/${b.name}`}
                target="_blank"
                rel="noreferrer noopener"
                className="text-[8px] font-mono px-1.5 py-1 bg-red-900/20 border border-red-700/40 text-red-300 rounded hover:bg-red-900/40 hover:text-red-200 transition-colors"
                title={`Click to view ${b.name} breach details on XposedOrNot`}
              >
                {b.name}
              </a>
            ))}
          </div>
        </div>
      )}
      {data.note && <div className="text-[7px] font-mono text-gray-600 italic">{data.note}</div>}
      <div className="text-[7px] font-mono text-gray-700">Source: {data.source}</div>
    </div>
  );
}

function ReverseDnsResult({ data }: { data: any }) {
  const ptrs: string[] = data.ptr_records || [];
  return (
    <div className="space-y-2">
      <div className={`p-2 rounded border ${ptrs.length > 0 ? 'bg-emerald-950/30 border-emerald-700/40' : 'bg-gray-950/30 border-gray-700/40'}`}>
        <div className="flex items-center gap-2">
          <ArrowLeftRight className={`w-3 h-3 ${ptrs.length > 0 ? 'text-emerald-400' : 'text-gray-400'}`} />
          <span className={`text-[10px] font-mono font-bold ${ptrs.length > 0 ? 'text-emerald-300' : 'text-gray-400'}`}>
            {ptrs.length > 0 ? 'PTR RECORD FOUND' : 'NO PTR RECORD'}
          </span>
          <span className="ml-auto text-[8px] font-mono opacity-70 truncate">{data.ip}</span>
        </div>
      </div>
      {ptrs.length > 0 ? (
        <div>
          <div className="text-[8px] font-mono text-cyan-700 tracking-wider mb-1">PTR RECORDS</div>
          <div className="space-y-1">
            {ptrs.map((p, i) => (
              <div key={i} className="p-1.5 bg-black/30 border border-cyan-900/40 rounded">
                <div className="text-[10px] font-mono text-cyan-300 break-all">{p}</div>
                <div className="text-[7px] font-mono text-gray-600 mt-0.5">
                  <a href={`https://${p}`} target="_blank" rel="noreferrer noopener" className="hover:text-cyan-400">visit ↗</a>
                  {' · '}
                  <a href={`https://www.virustotal.com/gui/domain/${p}`} target="_blank" rel="noreferrer noopener" className="hover:text-cyan-400">VirusTotal ↗</a>
                </div>
              </div>
            ))}
          </div>
          {data.primary_hostname && (
            <div className="text-[8px] font-mono text-gray-500 mt-2">
              Primary: <span className="text-cyan-400">{data.primary_hostname}</span>
            </div>
          )}
        </div>
      ) : (
        <div className="p-1.5 bg-black/30 border border-gray-800/40 rounded text-[9px] font-mono text-gray-500">
          {data.note || 'No PTR record found · the IP may not have a reverse DNS configured.'}
        </div>
      )}
      <div className="text-[7px] font-mono text-gray-700">Source: {data.source}</div>
    </div>
  );
}

function AdresseResult({ data, onLocate }: { data: any; onLocate?: (item: any) => void }) {
  const results: any[] = Array.isArray(data?.results) ? data.results : [];
  if (results.length === 0) {
    return (
      <div className="p-2 bg-black/30 border border-gray-800/40 rounded text-[9px] font-mono text-gray-500">
        Aucun lieu trouvé pour cette requête.
      </div>
    );
  }
  return (
    <div className="space-y-1.5">
      <div className="text-[8px] font-mono text-gray-500 mb-1">
        {results.length} résultat(s) · OpenStreetMap / Nominatim
      </div>
      {results.slice(0, 8).map((r: any, i: number) => (
        <div key={r.id || i} className="p-1.5 bg-black/30 border border-cyan-900/40 rounded">
          <div className="flex items-center gap-1.5">
            <MapPin className="w-3 h-3 text-cyan-500 flex-shrink-0" />
            <span className="text-[10px] font-mono text-cyan-300 truncate">{r.name}</span>
          </div>
          <div className="text-[7.5px] font-mono text-gray-500 mt-0.5 break-all" title={r.fullName}>{r.fullName}</div>
          <div className="flex items-center justify-between mt-1">
            <span className="text-[8px] font-mono text-gray-600">
              {Number(r.lat).toFixed(5)}°, {Number(r.lng).toFixed(5)}° · {r.type || 'lieu'}
            </span>
            {onLocate && Number.isFinite(Number(r.lat)) && Number.isFinite(Number(r.lng)) && (
              <button
                onClick={() => onLocate({ lat: Number(r.lat), lng: Number(r.lng), name: r.name })}
                className="px-1.5 py-0.5 bg-cyan-500/15 border border-cyan-500/40 rounded text-[8px] font-mono font-bold text-cyan-300 hover:bg-cyan-500/25 transition-colors"
              >
                LOCALISER
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
