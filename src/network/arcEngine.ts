

export type GeoPoint = [number, number]; // [lon, lat]

export type Arc = {
  id: string;
  from: GeoPoint;
  to: GeoPoint;
  start: number;
  dur: number;
  hue: number;
  severity: number;
  kind: string;
};

export type Pulse = {
  id: string;
  at: GeoPoint;
  start: number;
  dur: number;
  hue: number;
};


export type Spot = {
  geo: GeoPoint;
  count: number;
  maxSev: number;
  hue: number;
  lastTs: number;
  ip?: string;
  host?: string;
  source?: string;
  kind?: string;
  city?: string;
  country?: string;
  asn?: string;
};

export type ArcSource = {
  id: string;
  geo: GeoPoint;
  target?: GeoPoint;
  kind: string;
  severity: number;
  ts?: number;
  ip?: string;
  host?: string;
  source?: string;
  city?: string;
  country?: string;
  asn?: string;
};

const HUE: Record<string, number> = {
  attack: 0,
  phish: 42,
  malware: 150,
  scan: 205,
  c2: 275,
  ransom: 320,
  bgp: 230,
  dns: 172,
};

const ATTACKER_KINDS = new Set(['attack', 'scan', 'bgp']);

const INFRA_KINDS = new Set(['c2', 'malware', 'phish', 'dns', 'ransom']);

const rand = (a: number, b: number) => a + Math.random() * (b - a);

export class ArcEngine {
  buffer: ArcSource[] = [];
  arcs: Arc[] = [];
  pulses: Pulse[] = [];
  spots = new Map<string, Spot>();
  maxArcs = 120;
  maxSpots = 900;

  private attackerPts: GeoPoint[] = [];
  private infraPts: GeoPoint[] = [];
  private maxPool = 400;
  private lastEmit = 0;
  private nextHum = 0;
  private seq = 0;

  push(items: ArcSource[]) {
    for (const it of items) {
      this.buffer.push(it);
      if (it.ts === undefined || it.ts > 0) {
        const pool = ATTACKER_KINDS.has(it.kind)
          ? this.attackerPts
          : INFRA_KINDS.has(it.kind)
            ? this.infraPts
            : null;
        if (pool) {
          if (pool.length < this.maxPool) pool.push(it.geo);
          else pool[(Math.random() * pool.length) | 0] = it.geo; // ring-ish
        }
        const key = `${it.geo[0].toFixed(2)},${it.geo[1].toFixed(2)}`;
        const s = this.spots.get(key);
        if (s) {
          s.count++;
          s.maxSev = Math.max(s.maxSev, it.severity);
          s.lastTs = it.ts ?? Date.now();
          if (!s.ip && it.ip) {
            s.ip = it.ip;
            s.host = it.host;
            s.source = it.source;
            s.kind = it.kind;
            s.city = it.city;
            s.country = it.country;
            s.asn = it.asn;
          }
        } else if (this.spots.size < this.maxSpots) {
          this.spots.set(key, {
            geo: it.geo,
            count: 1,
            maxSev: it.severity,
            hue: HUE[it.kind] ?? 190,
            lastTs: it.ts ?? Date.now(),
            ip: it.ip,
            host: it.host,
            source: it.source,
            kind: it.kind,
            city: it.city,
            country: it.country,
            asn: it.asn,
          });
        }
      }
    }
    if (this.buffer.length > 4000)
      this.buffer.splice(0, this.buffer.length - 4000);
  }

  clear() {
    this.buffer.length = 0;
    this.arcs.length = 0;
    this.pulses.length = 0;
    this.spots.clear();
    this.attackerPts.length = 0;
    this.infraPts.length = 0;
  }


  private pick(pool: GeoPoint[], avoid?: GeoPoint): GeoPoint | null {
    if (!pool.length) return null;
    if (!avoid) return pool[(Math.random() * pool.length) | 0];
    let best: GeoPoint | null = null;
    let bestD = -1;
    for (let i = 0; i < 6; i++) {
      const p = pool[(Math.random() * pool.length) | 0];
      const d = (p[0] - avoid[0]) ** 2 + (p[1] - avoid[1]) ** 2;
      if (d > bestD) {
        bestD = d;
        best = p;
      }
    }
    return best;
  }

  private emit(now: number) {
    const it = this.buffer.shift()!;
    let from: GeoPoint = it.geo;
    let to: GeoPoint | undefined = it.target; // explicit feed target wins

    if (!to) {
      if (ATTACKER_KINDS.has(it.kind)) {
        to = this.pick(this.infraPts, from) ?? undefined;
      } else if (INFRA_KINDS.has(it.kind)) {
        const src = this.pick(this.attackerPts, it.geo);
        if (src) {
          from = src;
          to = it.geo;
        }
      }
    }
    if (!to || (to[0] === from[0] && to[1] === from[1])) return;

    this.arcs.push({
      id: `a${this.seq++}`,
      from,
      to,
      start: now,
      dur: rand(1100, 1900),
      hue: HUE[it.kind] ?? 190,
      severity: it.severity,
      kind: it.kind,
    });
    if (this.arcs.length > this.maxArcs)
      this.arcs.splice(0, this.arcs.length - this.maxArcs);
  }


  private hum(now: number) {
    const from = this.pick(this.attackerPts);
    const to = from ? this.pick(this.infraPts, from) : null;
    if (!from || !to) return;
    const hues = [HUE.attack, HUE.scan, HUE.scan, HUE.c2, HUE.malware];
    this.arcs.push({
      id: `h${this.seq++}`,
      from,
      to,
      start: now,
      dur: rand(1300, 2100),
      hue: hues[(Math.random() * hues.length) | 0],
      severity: rand(35, 80),
      kind: 'attack',
    });
  }

  update(now: number, paused = false) {
    if (paused) return; // PAUSE = full freeze (arcs hold mid-flight)

    const rate = Math.min(24, 6 + this.buffer.length / 40); // arcs/s
    const interval = 1000 / rate;
    if (this.buffer.length) {
      if (!this.lastEmit) this.lastEmit = now;
      let guard = 0;
      while (
        this.buffer.length &&
        now - this.lastEmit >= interval &&
        guard++ < 40
      ) {
        this.emit(now);
        this.lastEmit += interval;
      }
    } else this.lastEmit = now;

    if (
      !this.buffer.length &&
      this.attackerPts.length > 0 &&
      this.infraPts.length > 0
    ) {
      if (this.nextHum === 0 || now - this.nextHum > 5000)
        this.nextHum = now + 700; // (re)align after long stalls
      while (now >= this.nextHum && this.arcs.length < this.maxArcs) {
        this.hum(now);
        this.nextHum += rand(500, 950);
      }
    } else {
      this.nextHum = 0;
    }

    for (let i = this.arcs.length - 1; i >= 0; i--) {
      const a = this.arcs[i];
      if (now - a.start >= a.dur) {
        this.pulses.push({
          id: `p${this.seq++}`,
          at: a.to,
          start: now,
          dur: 650,
          hue: a.hue,
        });
        this.arcs.splice(i, 1);
      }
    }
    for (let i = this.pulses.length - 1; i >= 0; i--)
      if (now - this.pulses[i].start >= this.pulses[i].dur)
        this.pulses.splice(i, 1);
  }
}
