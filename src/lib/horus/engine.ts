/* ------------------------------------------------------------------ */
/* HORUS ENGINE — moteur de veille embarqué dans le process Next.js.   */
/*                                                                     */
/* Version du mini-service horus-stream (bun :3030) reprise en          */
/* singleton in-process : le serveur Next est le seul process qui       */
/* survit à la sandbox, donc le moteur vit là. Alimenté UNIQUEMENT par  */
/* des flux publics sans clé, plus l'orchestre d'agents déterministe.   */
/*                                                                     */
/* DEMO-FREE ZONE : aucun signal simulé. L'ancien générateur "RF ping"  */
/* et le sondage OpenSky anonyme (429) ont été supprimés.               */
/* ------------------------------------------------------------------ */
import { EventEmitter } from 'node:events';

/* ------------------------------ types ----------------------------- */
export type Quake = {
  id: string; mag: number; place: string; ts: number;
  lng: number; lat: number; depth: number;
};
export type MilFlight = {
  hex: string; callsign: string; type: string; reg: string;
  lon: number; lat: number; alt: number | null; gs: number | null;
  track: number | null; sq: string | null;
};
export type NetAlert = {
  id: string; ts: number; level: number; datasource: string;
  entityType: 'country' | 'asn'; code: string; name: string;
  lat: number | null; lng: number | null;
};
export type SpaceWeather = {
  kp: number | null; kpTs: string | null; storm: boolean;
  alerts: { id: string; ts: number; kind: string; summary: string }[];
  updatedAt: number;
};
export type AgentState = 'PATROL' | 'INVESTIGATE' | 'REPORT' | 'ESCALATE';
export type AgentRole = 'SECTOR' | 'ORBITAL' | 'NETWATCH' | 'HUNTER' | 'SENTRY';

export type Agent = {
  id: string; callsign: string; role: AgentRole; sector: string;
  state: AgentState; lat: number; lng: number; heading: number;
  task: string; target: { lat: number; lng: number; label: string } | null;
  since: number; dwellUntil: number; severity: number;
  confidence: string | null; actions: number;
};
export type AgentReport = {
  id: string; agent: string; role: AgentRole; ts: number;
  severity: number; ladder: 'P1' | 'P2' | 'P3' | 'P4';
  confidence: string; bluf: string; details: string[];
  sources: string[]; lat: number; lng: number; label: string;
};
export type AuditLine = {
  ts: number; agent: string; from: AgentState | '—';
  to: AgentState | '—'; trigger: string; detail: string;
};
export type RegEvent = {
  id: string; family: 'seismic' | 'net' | 'space'; source: string;
  ts: number; lat: number; lng: number; severity: number; label: string;
};
export type Echo = {
  id: string; ts: number; score: number; lat: number; lng: number;
  members: { family: string; source: string; label: string; ts: number }[];
};
export type Chain = {
  id: string; ts: number; from: RegEvent; to: RegEvent;
  confidence: 'highly likely' | 'likely' | 'possible'; kind: string;
};

const UA = 'HORUS-Intel/7.1 (world-watcher engine; keyless OSINT; fair-use)';

async function getJSON<T>(url: string, timeoutMs = 12000): Promise<T> {
  const r = await fetch(url, {
    headers: { 'User-Agent': UA, Accept: 'application/json' },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!r.ok) throw new Error(`upstream ${r.status}`);
  return (await r.json()) as T;
}

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

function haversineKm(la1: number, lo1: number, la2: number, lo2: number) {
  const R = 6371, d = Math.PI / 180;
  const dLa = (la2 - la1) * d, dLo = (lo2 - lo1) * d;
  const h = Math.sin(dLa / 2) ** 2 +
    Math.cos(la1 * d) * Math.cos(la2 * d) * Math.sin(dLo / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/* ------------------------------------------------------------------ */
/* ENGINE                                                              */
/* ------------------------------------------------------------------ */
class HorusEngine {
  emitter = new EventEmitter();
  startedAt = 0;
  private timers: NodeJS.Timeout[] = [];

  // caches
  quakeCache: Quake[] = [];
  private seenQuakes = new Set<string>();
  netAlerts: NetAlert[] = [];
  private seenNet = new Set<string>();
  spaceWeather: SpaceWeather = { kp: null, kpTs: null, storm: false, alerts: [], updatedAt: 0 };
  milCache: MilFlight[] = [];

  // orchestra
  agents: Agent[] = [];
  reports: AgentReport[] = [];
  audit: AuditLine[] = [];
  private reportSources: Record<string, string[]> = {};

  // echo engine
  registry: RegEvent[] = [];
  echoes: Echo[] = [];
  chains: Chain[] = [];

  /* --------------------------- lifecycle -------------------------- */
  start() {
    if (this.startedAt) return;
    this.startedAt = Date.now();
    this.spawnAgents();
    this.emitter.emit('hello', {
      ts: Date.now(), msg: 'HORUS engine v7.1 in-process · demo-free · real feeds',
      feeds: ['USGS', 'adsb.lol-mil', 'IODA', 'NOAA-SWPC'],
    });
    const every = (ms: number, fn: () => void) =>
      this.timers.push(setInterval(fn, ms));

    every(1000, () => this.agentTick());
    every(60_000, () => void this.guarded('mil', () => this.pollMil()));
    every(90_000, () => void this.guarded('quakes', () => this.pollQuakes()));
    every(5 * 60_000, () => void this.guarded('ioda', () => this.pollNetWeather()));
    every(10 * 60_000, () => void this.guarded('kp', () => this.pollKp()));
    every(15 * 60_000, () => void this.guarded('swpc', () => this.pollSwpcAlerts()));
    every(30_000, () => { this.rebuildChains(); this.emit('echo_scan', this.echoSnapshot()); });
    every(5000, () => this.emit('agents', this.agents.slice()));
    // initial fill (fire and forget)
    void this.guarded('boot', async () => {
      await this.pollQuakes();
      await this.pollMil();
      await this.pollNetWeather();
      await this.pollKp();
      await this.pollSwpcAlerts();
      this.rebuildChains();
      this.emit('echo_scan', this.echoSnapshot());
    });
  }

  private async guarded(name: string, fn: () => Promise<void>) {
    try { await fn(); } catch (e) {
      console.error(`[horus-engine] ${name}:`, e instanceof Error ? e.message : e);
    }
  }

  private emit(ev: string, payload: unknown) {
    this.emitter.emit(ev, payload);
  }

  /* --------------------------- real feeds ------------------------- */
  private async pollQuakes() {
    const data = await getJSON<{ features: any[] }>(
      'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_hour.geojson'
    ).catch(() => null);
    if (!data?.features?.length) return;
    this.quakeCache = data.features
      .filter((f) => f?.geometry?.coordinates)
      .map((f) => ({
        id: String(f.id),
        mag: Number(f.properties?.mag ?? 0),
        place: String(f.properties?.place ?? '—'),
        ts: Number(f.properties?.time ?? Date.now()),
        lng: f.geometry.coordinates[0],
        lat: f.geometry.coordinates[1],
        depth: f.geometry.coordinates[2] ?? 0,
      }));
    for (const q of this.quakeCache) {
      if (q.mag < 4.2 || this.seenQuakes.has(q.id)) continue;
      this.seenQuakes.add(q.id);
      const sev = Math.max(0, Math.min(100, q.mag * 11 - 22));
      const label = `Séisme M${q.mag.toFixed(1)} — ${q.place}`;
      this.emit('event', {
        id: uid(), ts: Date.now(), level: q.mag >= 5 ? 'alert' : 'warn',
        source: 'USGS-SEISMIC', message: label, lat: q.lat, lng: q.lng, mag: q.mag,
      });
      this.rememberSource(label, 'USGS');
      this.registerEvent({
        id: q.id, family: 'seismic', source: 'USGS', ts: q.ts,
        lat: q.lat, lng: q.lng, severity: sev, label,
      });
      this.dispatchEvent({
        family: 'seismic', lat: q.lat, lng: q.lng, severity: sev, label,
        detail: `USGS M${q.mag.toFixed(1)} · profondeur ${q.depth.toFixed(0)} km · ${q.place}`,
        source: 'USGS',
      });
    }
    if (this.seenQuakes.size > 400) {
      const keep = new Set(this.quakeCache.map((q) => q.id));
      for (const k of this.seenQuakes) if (!keep.has(k)) this.seenQuakes.delete(k);
    }
    this.emit('quakes', { count: this.quakeCache.length, quakes: this.quakeCache.slice(0, 120), ts: Date.now() });
  }

  private async pollMil() {
    const data = await getJSON<{ ac?: any[] }>('https://api.adsb.lol/v2/mil', 12000).catch(() => null);
    const ac = (data?.ac ?? [])
      .filter((a) => Number.isFinite(a.lat) && Number.isFinite(a.lon))
      .map((a) => ({
        hex: String(a.hex ?? '').trim(),
        callsign: String(a.flight ?? '').trim() || '—',
        type: String(a.t ?? '?'), reg: String(a.r ?? ''),
        lon: a.lon, lat: a.lat,
        alt: a.alt_baro === 'ground' ? 0 : (a.alt_baro ?? null),
        gs: a.gs ?? null, track: a.track ?? null, sq: a.squawk ?? null,
      }));
    if (ac.length > 0) {
      this.milCache = ac;
      this.emit('mil', { count: ac.length, aircraft: ac.slice(0, 300), ts: Date.now() });
    }
  }

  private static COUNTRY_CENTROIDS: Record<string, [number, number]> = {
    US: [39.8, -98.6], CA: [56.1, -106.3], MX: [23.6, -102.5], BR: [-14.2, -51.9],
    AR: [-38.4, -63.6], CL: [-35.7, -71.5], PE: [-9.2, -75.0], CO: [4.6, -74.3],
    GB: [54.0, -2.0], FR: [46.6, 2.4], DE: [51.1, 10.4], ES: [40.4, -3.7],
    PT: [39.4, -8.2], IT: [41.9, 12.6], NL: [52.1, 5.3], BE: [50.5, 4.5],
    CH: [46.8, 8.2], AT: [47.5, 14.6], PL: [51.9, 19.1], CZ: [49.8, 15.5],
    SE: [60.1, 18.6], NO: [60.5, 8.5], FI: [61.9, 25.7], DK: [56.3, 9.5],
    IE: [53.4, -8.2], GR: [39.1, 21.8], RO: [45.9, 25.0], UA: [48.4, 31.2],
    RU: [61.5, 105.3], TR: [39.0, 35.2], IL: [31.0, 34.9], SA: [23.9, 45.1],
    AE: [23.4, 53.8], IQ: [33.2, 43.7], IR: [32.4, 53.7], EG: [26.8, 30.8],
    MA: [31.8, -7.1], DZ: [28.0, 1.7], TN: [33.9, 9.5], LY: [26.3, 17.2],
    SN: [14.5, -14.5], ML: [17.6, -4.0], NE: [17.6, 8.1], TD: [15.5, 18.7],
    NG: [9.1, 8.7], GH: [7.9, -1.0], CI: [7.5, -5.5], CM: [7.4, 12.4],
    CD: [-4.0, 21.8], KE: [-0.02, 37.9], ET: [9.1, 40.5], TZ: [-6.4, 34.9],
    ZA: [-30.6, 22.9], ZW: [-19.0, 29.2], ZM: [-13.1, 27.8], AO: [-11.2, 17.9],
    MZ: [-18.7, 35.5], MG: [-18.8, 47.0], SO: [5.2, 46.2], SD: [12.9, 30.2],
    IN: [20.6, 79.0], PK: [30.4, 69.3], BD: [23.7, 90.4], LK: [7.9, 80.8],
    NP: [28.4, 84.1], AF: [33.9, 67.7], KZ: [48.0, 66.9], UZ: [41.4, 64.6],
    CN: [35.9, 104.2], MN: [46.9, 103.8], KP: [40.3, 127.5], KR: [35.9, 127.8],
    JP: [36.2, 138.3], TW: [23.7, 121.0], HK: [22.3, 114.2], PH: [12.9, 121.8],
    VN: [14.1, 108.3], TH: [15.9, 101.0], MM: [21.9, 95.9], KH: [12.6, 104.9],
    MY: [4.2, 101.98], SG: [1.35, 103.8], ID: [-0.8, 113.9], AU: [-25.3, 133.8],
    NZ: [-40.9, 174.9], PG: [-6.3, 143.9], FJ: [-17.7, 178.0],
  };

  private async pollNetWeather() {
    const until = Math.floor(Date.now() / 1000);
    const from = until - 3 * 3600;
    const data = await getJSON<{ data?: any[] }>(
      `https://api.ioda.inetintel.cc.gatech.edu/v2/outages/alerts?from=${from}&until=${until}&limit=100`,
      15000
    ).catch(() => null);
    if (!data?.data) return;
    const out: NetAlert[] = [];
    for (const a of data.data) {
      const ent = a.entity ?? {};
      const type = ent.type === 'asn' ? 'asn' : ent.type === 'country' ? 'country' : null;
      if (!type) continue;
      let lat: number | null = null;
      let lng: number | null = null;
      if (type === 'country') {
        const c = HorusEngine.COUNTRY_CENTROIDS[String(ent.code ?? '').toUpperCase()];
        if (c) [lat, lng] = c;
      }
      out.push({
        id: `ioda-${a.datasource}-${ent.code ?? uid()}-${a.time ?? until}`,
        ts: Number(a.time ?? until) * 1000,
        level: Number(a.level ?? 0),
        datasource: String(a.datasource ?? '?'),
        entityType: type,
        code: String(ent.code ?? '?'),
        name: String(ent.name ?? ent.code ?? '?'),
        lat, lng,
      });
    }
    this.netAlerts = out;
    for (const a of out) {
      if (a.level < 5 || this.seenNet.has(a.id)) continue;
      this.seenNet.add(a.id);
      if (this.seenNet.size > 400) this.seenNet.clear();
      const sev = Math.min(100, 35 + a.level * 6);
      const label = a.entityType === 'country'
        ? `Perturbation Internet — ${a.name} (IODA ${a.datasource})`
        : `Anomalie AS${a.code} — ${a.name} (IODA ${a.datasource})`;
      this.emit('event', {
        id: uid(), ts: Date.now(), level: a.level >= 7 ? 'alert' : 'warn',
        source: 'IODA-OUTAGE', message: label, lat: a.lat, lng: a.lng, level: a.level,
      });
      this.rememberSource(label, 'IODA');
      this.registerEvent({
        id: a.id, family: 'net', source: 'IODA', ts: a.ts,
        lat: a.lat ?? 0, lng: a.lng ?? 0, severity: sev, label,
      });
      if (a.entityType === 'country' || a.level >= 6) {
        this.dispatchEvent({
          family: 'net', lat: a.lat, lng: a.lng, severity: sev, label,
          detail: `IODA ${a.datasource} niveau ${a.level} · entité ${a.entityType} ${a.code}`,
          source: 'IODA',
        });
      }
    }
    this.emit('netweather', { count: out.length, alerts: out.slice(0, 60), ts: Date.now() });
  }

  private async pollKp() {
    const rows = await getJSON<any[]>(
      'https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json', 12000
    ).catch(() => null);
    if (!Array.isArray(rows) || rows.length < 2) return;
    const last = rows[rows.length - 1];
    const kp = Number(last[1]);
    const wasStorm = this.spaceWeather.storm;
    this.spaceWeather.kp = Number.isFinite(kp) ? kp : null;
    this.spaceWeather.kpTs = String(last[0] ?? '');
    this.spaceWeather.storm = this.spaceWeather.kp !== null && this.spaceWeather.kp >= 5;
    this.spaceWeather.updatedAt = Date.now();
    this.broadcastSpace(wasStorm);
  }

  private async pollSwpcAlerts() {
    const msgs = await getJSON<any[]>(
      'https://services.swpc.noaa.gov/products/alerts.json', 15000
    ).catch(() => null);
    if (!Array.isArray(msgs)) return;
    const out: SpaceWeather['alerts'] = [];
    for (const m of msgs) {
      const msg = String(m.message ?? '');
      const kind = /ALERT.*Geomagnetic/.test(msg) ? 'GEOMAGNETIC'
        : /ALERT.*Radio/.test(msg) ? 'RADIO BLACKOUT'
        : /WARNING.*Geomagnetic/.test(msg) ? 'GEOMAG WARNING'
        : /SUMMARY/.test(msg) ? 'SUMMARY' : 'WATCH';
      const scale = /\b([RG])([1-5])\b/.exec(msg);
      const descLine = (msg.split('\n').find((l: string) =>
        /Description|Geomagnetic|Radio|RADIATION|Expected/i.test(l)) ?? '')
        .replace(/^\s*(Description:?)?\s*/, '').trim();
      const summary = [scale ? scale[0] : null, descLine || msg.replace(/\s+/g, ' ').trim()]
        .filter(Boolean).join(' · ').slice(0, 140) || 'avis NOAA SWPC';
      out.push({
        id: `swpc-${m.issue_datetime ?? uid()}-${kind}`,
        ts: Date.parse(String(m.issue_datetime ?? '')) || Date.now(),
        kind, summary,
      });
    }
    this.spaceWeather.alerts = out.slice(0, 24);
    this.spaceWeather.updatedAt = Date.now();
    this.broadcastSpace(false);
  }

  private broadcastSpace(wasStorm: boolean) {
    this.emit('spaceweather', this.spaceWeather);
    if (this.spaceWeather.storm && this.spaceWeather.kp !== null) {
      const sev = Math.min(100, 55 + (this.spaceWeather.kp - 5) * 12);
      const label = `Orage géomagnétique G — Kp ${this.spaceWeather.kp.toFixed(2)}`;
      if (!wasStorm) {
        this.dispatchEvent({
          family: 'space', lat: 0, lng: -60, severity: sev, label,
          detail: `NOAA SWPC Kp=${this.spaceWeather.kp.toFixed(2)} (seuil G-storm ≥5) — risque HF/GPS`,
          source: 'NOAA-SWPC',
        });
        this.registerEvent({
          id: `swpc-kp-${this.spaceWeather.kpTs ?? Date.now()}`, family: 'space',
          source: 'NOAA-SWPC', ts: Date.now(), lat: 0, lng: -60, severity: sev, label,
        });
      }
    }
  }

  /* ------------------------- agent orchestra ---------------------- */
  private static SECTORS: Record<string, { c: [number, number]; r: number; label: string }> = {
    NA:    { c: [45, -95],  r: 13, label: 'AMÉRIQUE DU NORD' },
    LATAM: { c: [-15, -60], r: 15, label: 'AMÉRIQUE LATINE' },
    EU:    { c: [50, 15],   r: 12, label: 'EUROPE' },
    AF:    { c: [2, 20],    r: 17, label: 'AFRIQUE' },
    MENA:  { c: [27, 45],   r: 11, label: 'MOYEN-ORIENT' },
    APAC:  { c: [30, 110],  r: 17, label: 'ASIE-PACIFIQUE' },
    OCE:   { c: [-28, 140], r: 12, label: 'OCÉANIE' },
  };

  private spawnAgents() {
    const sectors = Object.entries(HorusEngine.SECTORS);
    sectors.forEach(([key, s], i) => {
      this.agents.push({
        id: `ag-${key.toLowerCase()}`, callsign: `HORUS-0${i + 1}`,
        role: 'SECTOR', sector: key, state: 'PATROL',
        lat: s.c[0] + s.r * 0.5, lng: s.c[1], heading: 90,
        task: `Patrouille orbitale · ${s.label}`, target: null,
        since: Date.now(), dwellUntil: 0, severity: 0, confidence: null, actions: 0,
      });
    });
    this.agents.push(
      { id: 'ag-orbital', callsign: 'HORUS-08', role: 'ORBITAL', sector: 'SPACE', state: 'PATROL', lat: 5, lng: -30, heading: 90, task: 'Veille météo spatiale · Kp / éruptions X', target: null, since: Date.now(), dwellUntil: 0, severity: 0, confidence: null, actions: 0 },
      { id: 'ag-netwatch1', callsign: 'HORUS-09', role: 'NETWATCH', sector: 'NET', state: 'PATROL', lat: 52, lng: 5, heading: 0, task: 'Veille BGP / pannes nationales (IODA)', target: null, since: Date.now(), dwellUntil: 0, severity: 0, confidence: null, actions: 0 },
      { id: 'ag-netwatch2', callsign: 'HORUS-10', role: 'NETWATCH', sector: 'NET', state: 'PATROL', lat: 40, lng: -95, heading: 0, task: 'Veille BGP / pannes nationales (IODA)', target: null, since: Date.now(), dwellUntil: 0, severity: 0, confidence: null, actions: 0 },
      { id: 'ag-hunter', callsign: 'HORUS-11', role: 'HUNTER', sector: 'NET', state: 'PATROL', lat: 35, lng: 110, heading: 0, task: 'Chasse aux anomalies ASN / infra (F3EAD)', target: null, since: Date.now(), dwellUntil: 0, severity: 0, confidence: null, actions: 0 },
      { id: 'ag-sentry', callsign: 'HORUS-12', role: 'SENTRY', sector: 'ROAM', state: 'PATROL', lat: 20, lng: 0, heading: 0, task: "Sentinelle d'appoint · cue opérateur", target: null, since: Date.now(), dwellUntil: 0, severity: 0, confidence: null, actions: 0 },
    );
  }

  private logLine(l: AuditLine) {
    this.audit.push(l);
    if (this.audit.length > 300) this.audit.splice(0, this.audit.length - 300);
    this.emit('agent_log', l);
  }

  private transition(a: Agent, to: AgentState, trigger: string, detail: string) {
    const from = a.state;
    a.state = to;
    a.since = Date.now();
    this.logLine({ ts: Date.now(), agent: a.callsign, from, to, trigger, detail });
  }

  private sectorOf(lat: number, lng: number): string {
    let best = 'APAC', bd = Infinity;
    for (const [k, s] of Object.entries(HorusEngine.SECTORS)) {
      const d = haversineKm(lat, lng, s.c[0], s.c[1]);
      if (d < bd) { bd = d; best = k; }
    }
    return best;
  }

  private dispatchEvent(ev: {
    family: 'seismic' | 'net' | 'space';
    lat: number | null; lng: number | null;
    severity: number; label: string; detail: string; source: string;
  }) {
    const now = Date.now();
    let agent: Agent | undefined;
    if (ev.family === 'seismic' && ev.lat != null && ev.lng != null) {
      agent = this.agents.find((a) => a.role === 'SECTOR' && a.sector === this.sectorOf(ev.lat!, ev.lng!));
    } else if (ev.family === 'net') {
      const pool = this.agents.filter((a) => a.role === 'NETWATCH' || a.role === 'HUNTER');
      agent = pool.find((a) => a.state === 'PATROL') ?? pool[0];
    } else if (ev.family === 'space') {
      agent = this.agents.find((a) => a.role === 'ORBITAL');
    }
    if (!agent) return;
    if (agent.state !== 'PATROL' && now < agent.dwellUntil) return;

    const lat = ev.lat ?? agent.lat;
    const lng = ev.lng ?? agent.lng;
    agent.target = { lat, lng, label: ev.label };
    agent.severity = ev.severity;
    agent.confidence = null;
    agent.task = `INVESTIGATE · ${ev.label}`;
    agent.actions++;
    this.transition(agent, 'INVESTIGATE', `${ev.family}:${ev.source}`, ev.detail);
    const dKm = haversineKm(agent.lat, agent.lng, lat, lng);
    const flyS = Math.min(20, 3 + dKm / 900);
    agent.dwellUntil = now + flyS * 1000 + 26_000 + Math.random() * 14_000;
    this.emit('agent_cue', {
      agent: agent.callsign, ts: now, kind: 'DISPATCH',
      label: ev.label, lat, lng, source: ev.source,
    });
  }

  operatorCue(lat: number, lng: number, operator: string, note: string) {
    const free = this.agents.find((a) => a.role === 'SENTRY' && a.state === 'PATROL')
      ?? this.agents.find((a) => a.state === 'PATROL');
    if (!free) return { ok: false, reason: 'no agent available' };
    free.target = { lat, lng, label: note || 'Cue opérateur' };
    free.severity = 70;
    free.confidence = null;
    free.task = `INVESTIGATE · ${note || 'Cue opérateur'}`;
    free.actions++;
    this.transition(free, 'INVESTIGATE', `operator:${operator || 'console'}`,
      `Cue manuel @ ${lat.toFixed(2)}, ${lng.toFixed(2)} — ${note || 'sans note'}`);
    this.emit('agent_cue', {
      agent: free.callsign, ts: Date.now(), kind: 'OPERATOR-CUE',
      label: note || 'Cue opérateur', lat, lng, source: operator || 'console',
    });
    return { ok: true, agent: free.callsign };
  }

  operatorOrder(callsign: string, order: string) {
    const a = this.agents.find((x) => x.callsign === callsign);
    if (!a) return { ok: false, reason: 'unknown agent' };
    a.task = order || 'Reprise de patrouille';
    a.actions++;
    if (a.state !== 'PATROL') this.returnToPatrol(a);
    this.logLine({
      ts: Date.now(), agent: a.callsign, from: a.state, to: 'PATROL',
      trigger: 'operator:order', detail: order || 'Reprise de patrouille',
    });
    return { ok: true };
  }

  private returnToPatrol(a: Agent) {
    a.target = null;
    a.confidence = null;
    const s = HorusEngine.SECTORS[a.sector];
    a.task = a.role === 'SECTOR' && s
      ? `Patrouille orbitale · ${s.label}`
      : a.role === 'ORBITAL' ? 'Veille météo spatiale · Kp / éruptions X'
      : a.role === 'NETWATCH' ? 'Veille BGP / pannes nationales (IODA)'
      : a.role === 'HUNTER' ? 'Chasse aux anomalies ASN / infra (F3EAD)'
      : "Sentinelle d'appoint · cue opérateur";
    this.transition(a, 'PATROL', 'cycle-complete', 'Retour en patrouille (cycle OODA terminé)');
  }

  private agentTick() {
    const now = Date.now();
    for (const a of this.agents) {
      if (a.state === 'PATROL') {
        const s = HorusEngine.SECTORS[a.sector];
        if (a.role === 'SECTOR' && s) {
          a.heading = (a.heading + 0.35 + Math.random() * 0.12) % 360;
          const rad = a.heading * (Math.PI / 180);
          a.lat = s.c[0] + s.r * 0.75 * Math.sin(rad);
          a.lng = s.c[1] + s.r * 0.75 * Math.cos(rad);
        } else {
          a.lat = Math.max(-60, Math.min(60, a.lat + (Math.random() - 0.5) * 2.2));
          a.lng = ((a.lng + 0.9 + 540) % 360) - 180;
        }
      } else if (a.state === 'INVESTIGATE' && a.target) {
        const dLat = a.target.lat - a.lat;
        let dLng = a.target.lng - a.lng;
        dLng = ((dLng + 540) % 360) - 180;
        const dist = Math.hypot(dLat, dLng);
        if (dist > 0.25) {
          const step = Math.min(4, dist);
          a.lat += (dLat / dist) * step;
          a.lng = ((a.lng + (dLng / dist) * step + 540) % 360) - 180;
        }
        if (now >= a.dwellUntil) this.produceReport(a);
      } else if (a.state === 'REPORT' && now - a.since > 8000) {
        if (a.severity >= 65) {
          a.task = `ESCALATION P1-P2 · ${a.target?.label ?? ''}`;
          a.actions++;
          this.transition(a, 'ESCALATE', 'severity>=65', 'Escalade watchfloor T2/T3 (SEV)');
          a.dwellUntil = now + 90_000;
        } else {
          this.returnToPatrol(a);
        }
      } else if (a.state === 'ESCALATE' && now >= a.dwellUntil) {
        this.returnToPatrol(a);
      }
    }
    this.emit('agent_tick', {
      ts: now,
      agents: this.agents.map((a) => ({
        id: a.id, callsign: a.callsign, lat: +a.lat.toFixed(3), lng: +a.lng.toFixed(3),
        state: a.state, task: a.task, heading: Math.round(a.heading),
      })),
    });
  }

  private rememberSource(label: string, source: string) {
    const arr = this.reportSources[label] ?? [];
    if (!arr.includes(source)) arr.unshift(source);
    if (arr.length > 4) arr.pop();
    this.reportSources[label] = arr;
  }

  private produceReport(a: Agent) {
    const label = a.target?.label ?? 'cible';
    const fams = this.echoFamiliesNear(a.target?.lat ?? a.lat, a.target?.lng ?? a.lng, 500, 45 * 60_000);
    const conf = fams.length >= 2 ? 'highly likely' : fams.length === 1 ? 'likely' : 'possible';
    a.confidence = conf;
    const ladder: AgentReport['ladder'] = a.severity >= 85 ? 'P1' : a.severity >= 65 ? 'P2' : a.severity >= 40 ? 'P3' : 'P4';
    const sources = this.reportSources[label] ?? ['USGS', 'IODA', 'SWPC'];
    const bluf =
      `BLUF : ${label} — évaluation ${a.role === 'SECTOR' ? 'sectorielle' : a.role === 'ORBITAL' ? 'météo spatiale' : 'réseau'} par ${a.callsign}. ` +
      `Impact jugé ${conf} ; recommandation : surveillance renforcée de la cellule.`;
    const details = [
      `Cible : ${label}`,
      `Position d'observation : ${(a.target?.lat ?? a.lat).toFixed(2)}, ${(a.target?.lng ?? a.lng).toFixed(2)}`,
      `Sévérité estimée : ${a.severity}/100 (${ladder})`,
      `Familles corroborées à ≤500 km / 45 min : ${fams.length ? fams.join(', ') : 'aucune (source unique)'}`,
      `Cadence OODA : ${a.actions} actions ce cycle · doctrine F3EAD/TaHiTI`,
    ];
    const report: AgentReport = {
      id: uid(), agent: a.callsign, role: a.role, ts: Date.now(),
      severity: a.severity, ladder, confidence: conf, bluf, details,
      sources: sources.slice(0, 3),
      lat: a.target?.lat ?? a.lat, lng: a.target?.lng ?? a.lng, label,
    };
    this.reports.unshift(report);
    if (this.reports.length > 60) this.reports.splice(60);
    a.task = `REPORT ${ladder} · ${label}`;
    this.transition(a, 'REPORT', 'investigation-complete', `Briefing BLUF émis (${ladder}, ${conf})`);
    this.emit('agent_report', report);
  }

  /* ------------------------- echo + chains ------------------------ */
  private echoFamiliesNear(lat: number, lng: number, km: number, windowMs: number): string[] {
    const now = Date.now();
    const fams = new Set<string>();
    for (const e of this.registry) {
      if (now - e.ts > windowMs) continue;
      if (haversineKm(lat, lng, e.lat, e.lng) <= km) fams.add(e.family);
    }
    return [...fams];
  }

  private registerEvent(ev: RegEvent) {
    this.registry.push(ev);
    const cutoff = Date.now() - 24 * 3600_000;
    while (this.registry.length && this.registry[0].ts < cutoff) this.registry.shift();
    if (this.registry.length > 800) this.registry.splice(0, this.registry.length - 800);

    const now = Date.now();
    const near = this.registry.filter(
      (o) => o.family !== ev.family && now - o.ts <= 45 * 60_000 &&
        haversineKm(ev.lat, ev.lng, o.lat, o.lng) <= 500
    );
    if (near.length > 0) {
      const members = [
        { family: ev.family, source: ev.source, label: ev.label, ts: ev.ts },
        ...near.slice(0, 4).map((o) => ({ family: o.family, source: o.source, label: o.label, ts: o.ts })),
      ];
      const families = new Set(members.map((m) => m.family)).size;
      const score = Math.min(100, 45 + 18 * families + 9 * members.length + (ev.severity > 70 ? 8 : 0));
      const echo: Echo = {
        id: uid(), ts: now,
        lat: (ev.lat + near[0].lat) / 2, lng: (ev.lng + near[0].lng) / 2,
        score, members,
      };
      this.echoes.unshift(echo);
      if (this.echoes.length > 30) this.echoes.splice(30);
      this.emit('echo', echo);
      this.logLine({
        ts: now, agent: 'ECHO-ENGINE', from: '—', to: '—', trigger: 'echo',
        detail: `Corroboration ${families} familles (score ${score}) — ${ev.label}`,
      });
    }
  }

  private rebuildChains() {
    this.chains = [];
    const now = Date.now();
    const recent = this.registry.filter((e) => now - e.ts <= 6 * 3600_000);
    for (const s of recent.filter((e) => e.family === 'seismic')) {
      const n = recent
        .filter((e) => e.family === 'net' && e.ts >= s.ts && e.ts - s.ts <= 6 * 3600_000 &&
          haversineKm(s.lat, s.lng, e.lat, e.lng) <= 800)
        .sort((a, b) => a.ts - b.ts)[0];
      if (n) {
        this.chains.push({
          id: uid(), ts: n.ts, from: s, to: n,
          confidence: haversineKm(s.lat, s.lng, n.lat, n.lng) <= 400 ? 'likely' : 'possible',
          kind: 'SEISMIC→NETWORK',
        });
      }
    }
    for (const sp of recent.filter((e) => e.family === 'space')) {
      const n = recent
        .filter((e) => e.family === 'net' && e.ts >= sp.ts && e.ts - sp.ts <= 6 * 3600_000)
        .sort((a, b) => a.ts - b.ts)[0];
      if (n) {
        this.chains.push({ id: uid(), ts: n.ts, from: sp, to: n, confidence: 'possible', kind: 'SPACE→NETWORK' });
      }
    }
    this.chains.sort((a, b) => b.ts - a.ts);
    if (this.chains.length > 12) this.chains.splice(12);
  }

  /* --------------------------- snapshots -------------------------- */
  echoSnapshot() { return { echoes: this.echoes.slice(0, 15), chains: this.chains.slice(0, 12) }; }

  snapshot(): Record<string, unknown> {
    return {
      agents: this.agents.slice(),
      agent_reports: this.reports.slice(0, 20),
      agent_log_tail: this.audit.slice(-50),
      echo_scan: this.echoSnapshot(),
      spaceweather: this.spaceWeather,
      netweather: { count: this.netAlerts.length, alerts: this.netAlerts.slice(0, 60), ts: Date.now() },
      quakes: { count: this.quakeCache.length, quakes: this.quakeCache.slice(0, 120), ts: Date.now() },
      mil: { count: this.milCache.length, aircraft: this.milCache.slice(0, 300), ts: Date.now() },
    };
  }
}

/* singleton survivant au HMR via globalThis */
const KEY = Symbol.for('horus.engine.global');
export function getHorusEngine(): HorusEngine {
  const g = globalThis as unknown as Record<symbol, unknown>;
  if (!g[KEY]) {
    const eng = new HorusEngine();
    g[KEY] = eng;
    eng.start();
  }
  return g[KEY] as HorusEngine;
}
