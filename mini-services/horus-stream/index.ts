/**
 * HORUS LIVE STREAM v7 — Socket.IO mini-service (bun, :3030).
 *
 * DEMO-FREE ZONE: every emission below is derived from a real, keyless
 * public feed or from the deterministic agent orchestra. The old fake
 * "RF/SIGINT ping" simulator and the dead anonymous OpenSky poll were
 * removed.
 *
 * REAL FEEDS (probed live, no API keys):
 *  - USGS earthquake GeoJSON (all_hour)                    ~90 s
 *  - adsb.lol /v2/mil global military air picture          ~60 s
 *  - IODA (Georgia Tech) internet outage alerts             ~5 min
 *  - NOAA SWPC planetary Kp + official alerts         10 / 15 min
 *
 * AGENT ORCHESTRA ("operation orchestration"):
 *  12 autonomous watch agents with a PATROL → INVESTIGATE → REPORT →
 *  ESCALATE state machine, sector custody, OODA tick at 1 Hz, BLUF
 *  briefings with ICD-203 confidence wording and an append-only audit
 *  trail. Operators can cue any agent from the console (socket 'cue').
 *
 * ECHO ENGINE (corroboration) + DOMINO CHAINS (causality):
 *  Events from different feed families co-occurring within space/time
 *  windows get an echo score; seismic→network and space→network
 *  successions are chained with confidence.
 */
import { createServer } from "http";
import { Server } from "socket.io";

const PORT = 3030;
const UA =
  "HORUS-Intel/7.0 (world-watcher stream; keyless OSINT; fair-use)";

type Quake = {
  id: string; mag: number; place: string; ts: number;
  lng: number; lat: number; depth: number;
};
type MilFlight = {
  hex: string; callsign: string; type: string; reg: string;
  lon: number; lat: number; alt: number | null; gs: number | null;
  track: number | null; sq: string | null;
};
type NetAlert = {
  id: string; ts: number; level: number; datasource: string;
  entityType: "country" | "asn"; code: string; name: string;
  lat: number | null; lng: number | null;
};
type SpaceWeather = {
  kp: number | null; kpTs: string | null; storm: boolean;
  alerts: { id: string; ts: number; kind: string; summary: string }[];
  updatedAt: number;
};

/* ------------------------------------------------------------------ */
/* socket.io server                                                    */
/* ------------------------------------------------------------------ */
const httpServer = createServer();
const io = new Server(httpServer, {
  // DO NOT change the path, it is used by Caddy to forward the request
  path: "/",
  cors: { origin: "*", methods: ["GET", "POST"] },
  pingTimeout: 60000,
  pingInterval: 25000,
  connectionStateRecovery: { maxDisconnectionDuration: 120000 },
});

const uid = () =>
  Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

async function getJSON<T>(url: string, timeoutMs = 12000): Promise<T> {
  const r = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "application/json" },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!r.ok) throw new Error(`upstream ${r.status}`);
  return (await r.json()) as T;
}

/* ------------------------------------------------------------------ */
/* real feed 1 — USGS earthquakes                                      */
/* ------------------------------------------------------------------ */
async function fetchQuakes(): Promise<Quake[]> {
  try {
    const data = await getJSON<{ features: any[] }>(
      "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_hour.geojson"
    );
    return (data.features ?? [])
      .filter((f) => f?.geometry?.coordinates)
      .map((f) => ({
        id: String(f.id),
        mag: Number(f.properties?.mag ?? 0),
        place: String(f.properties?.place ?? "—"),
        ts: Number(f.properties?.time ?? Date.now()),
        lng: f.geometry.coordinates[0],
        lat: f.geometry.coordinates[1],
        depth: f.geometry.coordinates[2] ?? 0,
      }));
  } catch {
    return [];
  }
}

/* ------------------------------------------------------------------ */
/* real feed 2 — adsb.lol global military air picture                  */
/* ------------------------------------------------------------------ */
const MIL_HUBS: [number, number][] = [
  [50.03, 8.56], [48.86, 2.35], [51.47, -0.45], [40.64, -73.78],
  [33.94, -118.4], [25.25, 55.36], [35.55, 139.78], [12.6, -8.02],
  [-26.13, 28.24], [37.46, 126.44], [28.56, 77.1], [-23.43, -46.47],
];
let hubCursor = 0;

async function fetchMil(): Promise<MilFlight[]> {
  try {
    const data = await getJSON<{ ac?: any[] }>(
      "https://api.adsb.lol/v2/mil",
      12000
    );
    return (data.ac ?? [])
      .filter((a) => Number.isFinite(a.lat) && Number.isFinite(a.lon))
      .map((a) => ({
        hex: String(a.hex ?? "").trim(),
        callsign: String(a.flight ?? "").trim() || "—",
        type: String(a.t ?? "?"),
        reg: String(a.r ?? ""),
        lon: a.lon, lat: a.lat,
        alt: a.alt_baro === "ground" ? 0 : (a.alt_baro ?? null),
        gs: a.gs ?? null, track: a.track ?? null, sq: a.squawk ?? null,
      }));
  } catch {
    return [];
  }
}

async function fetchHub(hub: [number, number]): Promise<MilFlight[]> {
  const [lat, lon] = hub;
  try {
    const data = await getJSON<{ ac?: any[] }>(
      `https://api.adsb.lol/v2/lat/${lat}/lon/${lon}/dist/250`,
      12000
    );
    return (data.ac ?? [])
      .filter((a) => Number.isFinite(a.lat) && Number.isFinite(a.lon))
      .map((a) => ({
        hex: String(a.hex ?? "").trim(),
        callsign: String(a.flight ?? "").trim() || "—",
        type: String(a.t ?? "?"),
        reg: String(a.r ?? ""),
        lon: a.lon, lat: a.lat,
        alt: a.alt_baro === "ground" ? 0 : (a.alt_baro ?? null),
        gs: a.gs ?? null, track: a.track ?? null, sq: a.squawk ?? null,
      }));
  } catch {
    return [];
  }
}

/* ------------------------------------------------------------------ */
/* real feed 3 — IODA internet outage alerts                           */
/* ------------------------------------------------------------------ */
const COUNTRY_CENTROIDS: Record<string, [number, number]> = {
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

async function fetchNetWeather(): Promise<NetAlert[]> {
  const until = Math.floor(Date.now() / 1000);
  const from = until - 3 * 3600;
  try {
    const data = await getJSON<{ data?: any[] }>(
      `https://api.ioda.inetintel.cc.gatech.edu/v2/outages/alerts?from=${from}&until=${until}&limit=100`,
      15000
    );
    const out: NetAlert[] = [];
    for (const a of data.data ?? []) {
      const ent = a.entity ?? {};
      const type = ent.type === "asn" ? "asn" : ent.type === "country" ? "country" : null;
      if (!type) continue;
      let lat: number | null = null;
      let lng: number | null = null;
      if (type === "country") {
        const c = COUNTRY_CENTROIDS[String(ent.code ?? "").toUpperCase()];
        if (c) [lat, lng] = c;
      }
      out.push({
        id: `ioda-${a.datasource}-${ent.code ?? uid()}-${a.time ?? until}`,
        ts: Number(a.time ?? until) * 1000,
        level: Number(a.level ?? 0),
        datasource: String(a.datasource ?? "?"),
        entityType: type,
        code: String(ent.code ?? "?"),
        name: String(ent.name ?? ent.code ?? "?"),
        lat, lng,
      });
    }
    return out;
  } catch {
    return [];
  }
}

/* ------------------------------------------------------------------ */
/* real feed 4 — NOAA SWPC space weather                               */
/* ------------------------------------------------------------------ */
let spaceWeather: SpaceWeather = {
  kp: null, kpTs: null, storm: false, alerts: [], updatedAt: 0,
};

async function fetchKp() {
  try {
    const rows = await getJSON<any[]>(
      "https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json",
      12000
    );
    if (Array.isArray(rows) && rows.length > 1) {
      const last = rows[rows.length - 1];
      const kp = Number(last[1]);
      spaceWeather.kp = Number.isFinite(kp) ? kp : null;
      spaceWeather.kpTs = String(last[0] ?? "");
      spaceWeather.storm = spaceWeather.kp !== null && spaceWeather.kp >= 5;
      spaceWeather.updatedAt = Date.now();
      broadcastSpaceWeather();
    }
  } catch { /* keep last good value */ }
}

async function fetchSwpcAlerts() {
  try {
    const msgs = await getJSON<any[]>(
      "https://services.swpc.noaa.gov/products/alerts.json",
      15000
    );
    const out: SpaceWeather["alerts"] = [];
    for (const m of msgs ?? []) {
      const msg = String(m.message ?? "");
      const kind = /ALERT.*Geomagnetic/.test(msg) ? "GEOMAGNETIC"
        : /ALERT.*Radio/.test(msg) ? "RADIO BLACKOUT"
        : /WARNING.*Geomagnetic/.test(msg) ? "GEOMAG WARNING"
        : /SUMMARY/.test(msg) ? "SUMMARY" : "WATCH";
      // derive R/G scale from the message text
      const scale = /\b([RG])([1-5])\b/.exec(msg);
      const descLine = (msg.split("\n").find((l: string) =>
        /Description|Geomagnetic|Radio|RADIATION|Expected/i.test(l)) ?? "")
        .replace(/^\s*(Description:?)?\s*/, "")
        .trim();
      const summary = [scale ? scale[0] : null, descLine || msg.replace(/\s+/g, " ").trim()]
        .filter(Boolean)
        .join(" · ")
        .slice(0, 140) || "avis NOAA SWPC";
      out.push({
        id: `swpc-${m.issue_datetime ?? uid()}-${kind}`,
        ts: Date.parse(String(m.issue_datetime ?? "")) || Date.now(),
        kind,
        summary,
      });
    }
    spaceWeather.alerts = out.slice(0, 24);
    spaceWeather.updatedAt = Date.now();
    broadcastSpaceWeather();
  } catch { /* keep last good value */ }
}

/* ------------------------------------------------------------------ */
/* AGENT ORCHESTRA — operation orchestration engine                    */
/* ------------------------------------------------------------------ */
type AgentState = "PATROL" | "INVESTIGATE" | "REPORT" | "ESCALATE";
type AgentRole =
  | "SECTOR" | "ORBITAL" | "NETWATCH" | "HUNTER" | "SENTRY";

type Agent = {
  id: string;
  callsign: string;
  role: AgentRole;
  sector: string;
  state: AgentState;
  lat: number;
  lng: number;
  heading: number;
  task: string;
  target: { lat: number; lng: number; label: string } | null;
  since: number;
  dwellUntil: number;
  severity: number;
  confidence: string | null;
  actions: number;
};

type AgentReport = {
  id: string; agent: string; role: AgentRole; ts: number;
  severity: number; ladder: "P1" | "P2" | "P3" | "P4";
  confidence: string; bluf: string; details: string[];
  sources: string[]; lat: number; lng: number; label: string;
};
type AuditLine = {
  ts: number; agent: string; from: AgentState | "—";
  to: AgentState | "—"; trigger: string; detail: string;
};

const SECTORS: Record<string, { c: [number, number]; r: number; label: string }> = {
  NA:    { c: [45, -95],  r: 13, label: "AMÉRIQUE DU NORD" },
  LATAM: { c: [-15, -60], r: 15, label: "AMÉRIQUE LATINE" },
  EU:    { c: [50, 15],   r: 12, label: "EUROPE" },
  AF:    { c: [2, 20],    r: 17, label: "AFRIQUE" },
  MENA:  { c: [27, 45],   r: 11, label: "MOYEN-ORIENT" },
  APAC:  { c: [30, 110],  r: 17, label: "ASIE-PACIFIQUE" },
  OCE:   { c: [-28, 140], r: 12, label: "OCÉANIE" },
};

const agents: Agent[] = [];
function spawnAgents() {
  const sectors = Object.entries(SECTORS);
  sectors.forEach(([key, s], i) => {
    agents.push({
      id: `ag-${key.toLowerCase()}`,
      callsign: `HORUS-0${i + 1}`,
      role: "SECTOR", sector: key,
      state: "PATROL",
      lat: s.c[0] + s.r * 0.5, lng: s.c[1],
      heading: 90, task: `Patrouille orbitale · ${s.label}`,
      target: null, since: Date.now(), dwellUntil: 0,
      severity: 0, confidence: null, actions: 0,
    });
  });
  agents.push({
    id: "ag-orbital", callsign: "HORUS-08", role: "ORBITAL", sector: "SPACE",
    state: "PATROL", lat: 5, lng: -30, heading: 90,
    task: "Veille météo spatiale · Kp / éruptions X", target: null,
    since: Date.now(), dwellUntil: 0, severity: 0, confidence: null, actions: 0,
  });
  agents.push({
    id: "ag-netwatch1", callsign: "HORUS-09", role: "NETWATCH", sector: "NET",
    state: "PATROL", lat: 52, lng: 5, heading: 0,
    task: "Veille BGP / pannes nationales (IODA)", target: null,
    since: Date.now(), dwellUntil: 0, severity: 0, confidence: null, actions: 0,
  });
  agents.push({
    id: "ag-netwatch2", callsign: "HORUS-10", role: "NETWATCH", sector: "NET",
    state: "PATROL", lat: 40, lng: -95, heading: 0,
    task: "Veille BGP / pannes nationales (IODA)", target: null,
    since: Date.now(), dwellUntil: 0, severity: 0, confidence: null, actions: 0,
  });
  agents.push({
    id: "ag-hunter", callsign: "HORUS-11", role: "HUNTER", sector: "NET",
    state: "PATROL", lat: 35, lng: 110, heading: 0,
    task: "Chasse aux anomalies ASN / infra (F3EAD)", target: null,
    since: Date.now(), dwellUntil: 0, severity: 0, confidence: null, actions: 0,
  });
  agents.push({
    id: "ag-sentry", callsign: "HORUS-12", role: "SENTRY", sector: "ROAM",
    state: "PATROL", lat: 20, lng: 0, heading: 0,
    task: "Sentinelle d'appoint · cue opérateur", target: null,
    since: Date.now(), dwellUntil: 0, severity: 0, confidence: null, actions: 0,
  });
}
spawnAgents();

const audit: AuditLine[] = [];
function logLine(l: AuditLine) {
  audit.push(l);
  if (audit.length > 300) audit.splice(0, audit.length - 300);
  io.emit("agent_log", l);
}

function transition(a: Agent, to: AgentState, trigger: string, detail: string) {
  const from = a.state;
  a.state = to;
  a.since = Date.now();
  logLine({ ts: Date.now(), agent: a.callsign, from, to, trigger, detail });
}

function setTask(a: Agent, task: string) { a.task = task; a.actions++; }

function haversineKm(la1: number, lo1: number, la2: number, lo2: number) {
  const R = 6371, d = Math.PI / 180;
  const dLa = (la2 - la1) * d, dLo = (lo2 - lo1) * d;
  const h = Math.sin(dLa / 2) ** 2 +
    Math.cos(la1 * d) * Math.cos(la2 * d) * Math.sin(dLo / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function sectorOf(lat: number, lng: number): string {
  let best = "APAC", bd = Infinity;
  for (const [k, s] of Object.entries(SECTORS)) {
    const d = haversineKm(lat, lng, s.c[0], s.c[1]);
    if (d < bd) { bd = d; best = k; }
  }
  return best;
}

function ladderOf(sev: number): AgentReport["ladder"] {
  return sev >= 85 ? "P1" : sev >= 65 ? "P2" : sev >= 40 ? "P3" : "P4";
}

function confidenceWord(families: number, sources: number): string {
  // ICD-203 bands, deterministic: corroboration raises confidence
  if (families >= 2 && sources >= 2) return "highly likely";
  if (families >= 2) return "likely";
  return "possible";
}

// dispatch a real event to the right agent (OODA trigger)
function dispatchEvent(ev: {
  family: "seismic" | "net" | "space";
  lat: number | null; lng: number | null;
  severity: number; label: string; detail: string; source: string;
}) {
  const now = Date.now();
  let agent: Agent | undefined;
  if (ev.family === "seismic" && ev.lat != null && ev.lng != null) {
    agent = agents.find((a) => a.role === "SECTOR" && a.sector === sectorOf(ev.lat!, ev.lng!));
  } else if (ev.family === "net") {
    // alternate between the two NETWATCH agents and the HUNTER
    const pool = agents.filter((a) => a.role === "NETWATCH" || a.role === "HUNTER");
    agent = pool.find((a) => a.state === "PATROL") ?? pool[0];
  } else if (ev.family === "space") {
    agent = agents.find((a) => a.role === "ORBITAL");
  }
  if (!agent) return;
  if (agent.state !== "PATROL" && now < agent.dwellUntil) return; // busy

  const lat = ev.lat ?? agent.lat;
  const lng = ev.lng ?? agent.lng;
  agent.target = { lat, lng, label: ev.label };
  agent.severity = ev.severity;
  agent.confidence = null;
  setTask(agent, `INVESTIGATE · ${ev.label}`);
  transition(agent, "INVESTIGATE", `${ev.family}:${ev.source}`, ev.detail);
  // flight time to target, then dwell 26–40 s before REPORT
  const dKm = haversineKm(agent.lat, agent.lng, lat, lng);
  const flyS = Math.min(20, 3 + dKm / 900);
  agent.dwellUntil = now + flyS * 1000 + 26_000 + Math.random() * 14_000;
  io.emit("agent_cue", {
    agent: agent.callsign, ts: now, kind: "DISPATCH",
    label: ev.label, lat, lng, source: ev.source,
  });
}

function operatorCue(lat: number, lng: number, operator: string, note: string) {
  const free = agents.find((a) => a.role === "SENTRY" && a.state === "PATROL")
    ?? agents.find((a) => a.state === "PATROL");
  if (!free) return { ok: false, reason: "no agent available" };
  free.target = { lat, lng, label: note || "Cue opérateur" };
  free.severity = 70;
  free.confidence = null;
  setTask(free, `INVESTIGATE · ${note || "Cue opérateur"}`);
  transition(free, "INVESTIGATE", `operator:${operator || "console"}`,
    `Cue manuel @ ${lat.toFixed(2)}, ${lng.toFixed(2)} — ${note || "sans note"}`);
  io.emit("agent_cue", {
    agent: free.callsign, ts: Date.now(), kind: "OPERATOR-CUE",
    label: note || "Cue opérateur", lat, lng, source: operator || "console",
  });
  return { ok: true, agent: free.callsign };
}

// 1 Hz OODA tick
function agentTick() {
  const now = Date.now();
  for (const a of agents) {
    if (a.state === "PATROL") {
      const s = SECTORS[a.sector];
      if (a.role === "SECTOR" && s) {
        a.heading = (a.heading + 0.35 + Math.random() * 0.12) % 360;
        const rad = a.heading * (Math.PI / 180);
        a.lat = s.c[0] + s.r * 0.75 * Math.sin(rad);
        a.lng = s.c[1] + s.r * 0.75 * Math.cos(rad);
      } else {
        // global roles: slow drift around their roam box
        a.lat = Math.max(-60, Math.min(60, a.lat + (Math.random() - 0.5) * 2.2));
        a.lng = ((a.lng + 0.9 + 540) % 360) - 180;
      }
    } else if (a.state === "INVESTIGATE" && a.target) {
      // close on target ~4°/s, then hold position until dwell expires
      const dLat = a.target.lat - a.lat;
      let dLng = a.target.lng - a.lng;
      dLng = ((dLng + 540) % 360) - 180;
      const dist = Math.hypot(dLat, dLng);
      if (dist > 0.25) {
        const step = Math.min(4, dist);
        a.lat += (dLat / dist) * step;
        a.lng = ((a.lng + (dLng / dist) * step + 540) % 360) - 180;
      }
      if (now >= a.dwellUntil) {
        produceReport(a);
      }
    } else if (a.state === "REPORT" && now - a.since > 8000) {
      const wasHot = a.severity >= 65;
      if (wasHot) {
        setTask(a, `ESCALATION P1-P2 · ${a.target?.label ?? ""}`);
        transition(a, "ESCALATE", "severity>=65", "Escalade watchfloor T2/T3 (SEV)");
        a.dwellUntil = now + 90_000;
      } else {
        returnToPatrol(a);
      }
    } else if (a.state === "ESCALATE" && now >= a.dwellUntil) {
      returnToPatrol(a);
    }
  }
}

function returnToPatrol(a: Agent) {
  a.target = null;
  a.confidence = null;
  const s = SECTORS[a.sector];
  a.task = a.role === "SECTOR" && s
    ? `Patrouille orbitale · ${s.label}`
    : a.role === "ORBITAL" ? "Veille météo spatiale · Kp / éruptions X"
    : a.role === "NETWATCH" ? "Veille BGP / pannes nationales (IODA)"
    : a.role === "HUNTER" ? "Chasse aux anomalies ASN / infra (F3EAD)"
    : "Sentinelle d'appoint · cue opérateur";
  transition(a, "PATROL", "cycle-complete", "Retour en patrouille (cycle OODA terminé)");
}

function produceReport(a: Agent) {
  const label = a.target?.label ?? "cible";
  const fams = echoFamiliesNear(a.target?.lat ?? a.lat, a.target?.lng ?? a.lng, 500, 45 * 60_000);
  const conf = confidenceWord(fams.length, fams.length ? fams.length : 1);
  a.confidence = conf;
  const ladder = ladderOf(a.severity);
  const sources = reportSources[label] ?? ["USGS", "IODA", "SWPC"];
  const bluf =
    `BLUF : ${label} — évaluation ${a.role === "SECTOR" ? "sectorielle" : a.role === "ORBITAL" ? "météo spatiale" : "réseau"} par ${a.callsign}. ` +
    `Impact jugé ${conf} ; recommandation : surveillance renforcée de la cellule.`;
  const details = [
    `Cible : ${label}`,
    `Position d'observation : ${(a.target?.lat ?? a.lat).toFixed(2)}, ${(a.target?.lng ?? a.lng).toFixed(2)}`,
    `Sévérité estimée : ${a.severity}/100 (${ladder})`,
    `Familles corroborées à ≤500 km / 45 min : ${fams.length ? fams.join(", ") : "aucune (source unique)"}`,
    `Cadence OODA : ${a.actions} actions ce cycle · doctrine F3EAD/TaHiTI`,
  ];
  const report: AgentReport = {
    id: uid(), agent: a.callsign, role: a.role, ts: Date.now(),
    severity: a.severity, ladder, confidence: conf,
    bluf, details,
    sources: sources.slice(0, 3),
    lat: a.target?.lat ?? a.lat, lng: a.target?.lng ?? a.lng, label,
  };
  reports.unshift(report);
  if (reports.length > 60) reports.splice(60);
  setTask(a, `REPORT ${ladder} · ${label}`);
  transition(a, "REPORT", "investigation-complete",
    `Briefing BLUF émis (${ladder}, ${conf})`);
  io.emit("agent_report", report);
}

const reportSources: Record<string, string[]> = {};
function rememberSource(label: string, source: string) {
  const arr = reportSources[label] ?? [];
  if (!arr.includes(source)) arr.unshift(source);
  if (arr.length > 4) arr.pop();
  reportSources[label] = arr;
}

/* ------------------------------------------------------------------ */
/* ECHO ENGINE + DOMINO CHAINS                                         */
/* ------------------------------------------------------------------ */
type Family = "seismic" | "net" | "space";
type RegEvent = {
  id: string; family: Family; source: string; ts: number;
  lat: number; lng: number; severity: number; label: string;
};
type Echo = {
  id: string; ts: number; score: number; lat: number; lng: number;
  members: { family: Family; source: string; label: string; ts: number }[];
};
type Chain = {
  id: string; ts: number; from: RegEvent; to: RegEvent;
  confidence: "highly likely" | "likely" | "possible"; kind: string;
};

const registry: RegEvent[] = [];
const echoes: Echo[] = [];
const chains: Chain[] = [];

function echoFamiliesNear(lat: number, lng: number, km: number, windowMs: number): string[] {
  const now = Date.now();
  const fams = new Set<string>();
  for (const e of registry) {
    if (now - e.ts > windowMs) continue;
    if (haversineKm(lat, lng, e.lat, e.lng) <= km) fams.add(e.family);
  }
  return [...fams];
}

function registerEvent(ev: RegEvent) {
  registry.push(ev);
  const cutoff = Date.now() - 24 * 3600_000;
  while (registry.length && registry[0].ts < cutoff) registry.shift();
  if (registry.length > 800) registry.splice(0, registry.length - 800);

  // ECHO: same place+time, different families → corroboration score
  const now = Date.now();
  const near = registry.filter(
    (o) => o.family !== ev.family &&
      now - o.ts <= 45 * 60_000 &&
      haversineKm(ev.lat, ev.lng, o.lat, o.lng) <= 500
  );
  if (near.length > 0) {
    const members = [
      { family: ev.family, source: ev.source, label: ev.label, ts: ev.ts },
      ...near.slice(0, 4).map((o) => ({
        family: o.family, source: o.source, label: o.label, ts: o.ts,
      })),
    ];
    const families = new Set(members.map((m) => m.family)).size;
    const score = Math.min(100,
      45 + 18 * families + 9 * members.length + (ev.severity > 70 ? 8 : 0));
    const echo: Echo = {
      id: uid(), ts: now,
      lat: (ev.lat + near[0].lat) / 2, lng: (ev.lng + near[0].lng) / 2,
      score, members,
    };
    echoes.unshift(echo);
    if (echoes.length > 30) echoes.splice(30);
    io.emit("echo", echo);
    logLine({
      ts: now, agent: "ECHO-ENGINE", from: "—", to: "—",
      trigger: "echo", detail: `Corroboration ${families} familles (score ${score}) — ${ev.label}`,
    });
  }
}

function rebuildChains() {
  chains.length = 0;
  const now = Date.now();
  const recent = registry.filter((e) => now - e.ts <= 6 * 3600_000);
  // DOMINO rule 1 — seismic → network (quake succeeded by outage alert)
  for (const s of recent.filter((e) => e.family === "seismic")) {
    const n = recent
      .filter((e) => e.family === "net" && e.ts >= s.ts &&
        e.ts - s.ts <= 6 * 3600_000 &&
        haversineKm(s.lat, s.lng, e.lat, e.lng) <= 800)
      .sort((a, b) => a.ts - b.ts)[0];
    if (n) {
      chains.push({
        id: uid(), ts: n.ts, from: s, to: n,
        confidence: haversineKm(s.lat, s.lng, n.lat, n.lng) <= 400 ? "likely" : "possible",
        kind: "SEISMIC→NETWORK",
      });
    }
  }
  // DOMINO rule 2 — space → network (solar storm succeeded by outage alert)
  for (const sp of recent.filter((e) => e.family === "space")) {
    const n = recent
      .filter((e) => e.family === "net" && e.ts >= sp.ts &&
        e.ts - sp.ts <= 6 * 3600_000)
      .sort((a, b) => a.ts - b.ts)[0];
    if (n) {
      chains.push({
        id: uid(), ts: n.ts, from: sp, to: n,
        confidence: "possible", kind: "SPACE→NETWORK",
      });
    }
  }
  chains.sort((a, b) => b.ts - a.ts);
  if (chains.length > 12) chains.splice(12);
}

/* ------------------------------------------------------------------ */
/* poll loops                                                          */
/* ------------------------------------------------------------------ */
let quakeCache: Quake[] = [];
const seenQuakes = new Set<string>();
let netAlerts: NetAlert[] = [];
const seenNet = new Set<string>();

function broadcastSpaceWeather() {
  io.emit("spaceweather", spaceWeather);
  if (spaceWeather.kp !== null && spaceWeather.kp >= 5) {
    dispatchEvent({
      family: "space", lat: 0, lng: -60,
      severity: Math.min(100, 55 + (spaceWeather.kp - 5) * 12),
      label: `Orage géomagnétique G — Kp ${spaceWeather.kp.toFixed(2)}`,
      detail: `NOAA SWPC Kp=${spaceWeather.kp.toFixed(2)} (seuil G-storm ≥5) — risque HF/GPS`,
      source: "NOAA-SWPC",
    });
    registerEvent({
      id: `swpc-kp-${spaceWeather.kpTs ?? Date.now()}`, family: "space",
      source: "NOAA-SWPC", ts: Date.now(), lat: 0, lng: -60,
      severity: Math.min(100, 55 + (spaceWeather.kp - 5) * 12),
      label: `Orage géomagnétique G — Kp ${spaceWeather.kp.toFixed(2)}`,
    });
  }
}

let milCache: MilFlight[] = [];

async function pollQuakes() {
  const fresh = await fetchQuakes();
  if (fresh.length === 0) return;
  quakeCache = fresh;
  for (const q of fresh) {
    if (q.mag >= 4.2 && !seenQuakes.has(q.id)) {
      seenQuakes.add(q.id);
      const sev = Math.max(0, Math.min(100, q.mag * 11 - 22));
      const label = `Séisme M${q.mag.toFixed(1)} — ${q.place}`;
      io.emit("event", {
        id: uid(), ts: Date.now(), level: q.mag >= 5 ? "alert" : "warn",
        source: "USGS-SEISMIC", message: label, lat: q.lat, lng: q.lng, mag: q.mag,
      });
      rememberSource(label, "USGS");
      registerEvent({
        id: q.id, family: "seismic", source: "USGS", ts: q.ts,
        lat: q.lat, lng: q.lng, severity: sev, label,
      });
      dispatchEvent({
        family: "seismic", lat: q.lat, lng: q.lng, severity: sev,
        label, detail: `USGS M${q.mag.toFixed(1)} · profondeur ${q.depth.toFixed(0)} km · ${q.place}`,
        source: "USGS",
      });
    }
  }
  if (seenQuakes.size > 400) {
    const keep = new Set(quakeCache.map((q) => q.id));
    for (const k of seenQuakes) if (!keep.has(k)) seenQuakes.delete(k);
  }
  io.emit("quakes", { count: quakeCache.length, quakes: quakeCache.slice(0, 120), ts: Date.now() });
}

async function pollMil() {
  const fresh = await fetchMil();
  if (fresh.length > 0) {
    milCache = fresh;
    io.volatile.emit("mil", { count: milCache.length, aircraft: milCache.slice(0, 300), ts: Date.now() });
  }
}

async function pollHub() {
  const hub = MIL_HUBS[hubCursor % MIL_HUBS.length];
  hubCursor++;
  // civilian hub polls are consumed by the REST flight route; here the
  // stream only carries the global military layer to stay polite.
  void hub;
}

async function pollNetWeather() {
  const fresh = await fetchNetWeather();
  if (fresh.length === 0) return;
  netAlerts = fresh;
  for (const a of fresh) {
    if (a.level >= 5 && !seenNet.has(a.id)) {
      seenNet.add(a.id);
      if (seenNet.size > 400) { seenNet.clear(); }
      const sev = Math.min(100, 35 + a.level * 6);
      const label =
        a.entityType === "country"
          ? `Perturbation Internet — ${a.name} (IODA ${a.datasource})`
          : `Anomalie AS${a.code} — ${a.name} (IODA ${a.datasource})`;
      io.emit("event", {
        id: uid(), ts: Date.now(), level: a.level >= 7 ? "alert" : "warn",
        source: "IODA-OUTAGE", message: label,
        lat: a.lat, lng: a.lng, level: a.level,
      });
      rememberSource(label, "IODA");
      registerEvent({
        id: a.id, family: "net", source: "IODA", ts: a.ts,
        lat: a.lat ?? 0, lng: a.lng ?? 0, severity: sev, label,
      });
      if (a.entityType === "country" || a.level >= 6) {
        dispatchEvent({
          family: "net", lat: a.lat, lng: a.lng, severity: sev, label,
          detail: `IODA ${a.datasource} niveau ${a.level} · entité ${a.entityType} ${a.code}`,
          source: "IODA",
        });
      }
    }
  }
  io.emit("netweather", { count: netAlerts.length, alerts: netAlerts.slice(0, 60), ts: Date.now() });
}

async function pollKp() { await fetchKp(); }
async function pollSwpcAlerts() { await fetchSwpcAlerts(); }

/* ------------------------------------------------------------------ */
/* connections                                                         */
/* ------------------------------------------------------------------ */
io.on("connection", (socket) => {
  console.log(`[horus-stream] client connected: ${socket.id}`);
  socket.emit("hello", {
    ts: Date.now(), msg: "HORUS-LIVE v7 connected · demo-free · real feeds",
    feeds: ["USGS", "adsb.lol-mil", "IODA", "NOAA-SWPC"],
  });
  socket.emit("heartbeat", {
    ts: Date.now(), uptime: process.uptime(), clients: io.engine.clientsCount,
  });
  socket.emit("agents", agents.map(serializeAgent));
  socket.emit("agent_reports", reports.slice(0, 20));
  socket.emit("agent_log_tail", audit.slice(-50));
  socket.emit("echo_scan", { echoes: echoes.slice(0, 15), chains: chains.slice(0, 12) });
  socket.emit("spaceweather", spaceWeather);
  socket.emit("netweather", { count: netAlerts.length, alerts: netAlerts.slice(0, 60), ts: Date.now() });
  socket.emit("mil", { count: milCache.length, aircraft: milCache.slice(0, 300), ts: Date.now() });
  socket.emit("quakes", { count: quakeCache.length, quakes: quakeCache.slice(0, 120), ts: Date.now() });

  socket.on("ping", () => socket.emit("pong", { ts: Date.now() }));
  socket.on("cue", (payload: { lat?: number; lng?: number; operator?: string; note?: string }, ack?: (r: unknown) => void) => {
    const lat = Number(payload?.lat);
    const lng = Number(payload?.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      ack?.({ ok: false, reason: "bad coordinates" });
      return;
    }
    const r = operatorCue(lat, lng, String(payload?.operator ?? "console"), String(payload?.note ?? ""));
    ack?.(r);
  });
  socket.on("agent_order", (payload: { callsign?: string; order?: string }, ack?: (r: unknown) => void) => {
    const a = agents.find((x) => x.callsign === payload?.callsign);
    if (!a) { ack?.({ ok: false, reason: "unknown agent" }); return; }
    setTask(a, String(payload?.order ?? "Reprise de patrouille"));
    if (a.state === "INVESTIGATE" || a.state === "REPORT" || a.state === "ESCALATE") {
      returnToPatrol(a);
    }
    logLine({
      ts: Date.now(), agent: a.callsign, from: a.state, to: "PATROL",
      trigger: "operator:order", detail: String(payload?.order ?? "Reprise de patrouille"),
    });
    ack?.({ ok: true });
  });
  socket.on("disconnect", () => {
    console.log(`[horus-stream] client disconnected: ${socket.id}`);
  });
});

function serializeAgent(a: Agent) {
  return { ...a, since: Date.now() - a.since < 60000 ? a.since : a.since };
}

const reports: AgentReport[] = [];

/* ------------------------------------------------------------------ */
/* timers                                                              */
/* ------------------------------------------------------------------ */
setInterval(() => {
  io.emit("heartbeat", {
    ts: Date.now(), uptime: process.uptime(), clients: io.engine.clientsCount,
  });
}, 5000);

setInterval(() => {
  agentTick();
  const moving = agents.filter((a) => a.state !== "PATROL" || a.role !== "SECTOR");
  io.volatile.emit("agent_tick", {
    ts: Date.now(),
    agents: agents.map((a) => ({
      id: a.id, callsign: a.callsign, lat: +a.lat.toFixed(3), lng: +a.lng.toFixed(3),
      state: a.state, task: a.task, heading: Math.round(a.heading),
    })),
  });
}, 1000);

setInterval(() => {
  io.emit("agents", agents.map(serializeAgent));
}, 5000);

setInterval(() => { void pollQuakes(); }, 90_000);
setInterval(() => { void pollMil(); }, 60_000);
setInterval(() => { void pollHub(); }, 25_000);
setInterval(() => { void pollNetWeather(); }, 5 * 60_000);
setInterval(() => { void pollKp(); }, 10 * 60_000);
setInterval(() => { void pollSwpcAlerts(); }, 15 * 60_000);
setInterval(() => {
  rebuildChains();
  io.emit("echo_scan", { echoes: echoes.slice(0, 15), chains: chains.slice(0, 12) });
}, 30_000);

/* initial fill */
void (async () => {
  await pollQuakes();
  await pollMil();
  await pollNetWeather();
  await pollKp();
  await pollSwpcAlerts();
  rebuildChains();
})();

httpServer.listen(PORT, () => {
  console.log(`[horus-stream] v7 listening on :${PORT} — demo-free, real feeds only`);
});

// garde-fous : ne jamais laisser un rejet ou une erreur tuer la veille
process.on("uncaughtException", (err) => {
  console.error("[horus-stream] uncaughtException (service maintenu):", err?.message ?? err);
});
process.on("unhandledRejection", (err) => {
  console.error("[horus-stream] unhandledRejection (service maintenu):", err instanceof Error ? err.message : err);
});

process.on("SIGTERM", () => { httpServer.close(() => process.exit(0)); });
process.on("SIGINT", () => { httpServer.close(() => process.exit(0)); });
