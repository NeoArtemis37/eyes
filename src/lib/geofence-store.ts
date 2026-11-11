
export interface Geofence {
  id: string;
  name: string;
  type: 'circle' | 'polygon';
  coordinates: number[][];  // [lat, lng] pairs · for circle: [center], for polygon: vertices
  radius?: number;          // km for circle type
  color: string;
  alertCategories: string[];
  active: boolean;
  createdAt: number;
  lastTriggered?: number;
  triggerCount: number;
}

export interface GeofenceAlert {
  id: string;
  geofenceId: string;
  geofenceName: string;
  category: string;
  eventLat: number;
  eventLng: number;
  eventLabel: string;
  severity: string;
  timestamp: number;
  acknowledged: boolean;
}

const geofences = new Map<string, Geofence>();

const alertHistory: GeofenceAlert[] = [];
const MAX_ALERT_HISTORY = 200;

const SAMPLE_GEOFENCES: Geofence[] = [
  {
    id: 'gf-middle-east',
    name: 'Middle East Hot Zone',
    type: 'circle',
    coordinates: [[33.0, 44.0]],
    radius: 800,
    color: '#ff3333',
    alertCategories: ['military', 'flight', 'gdelt'],
    active: true,
    createdAt: Date.now() - 86400000,
    lastTriggered: Date.now() - 3600000,
    triggerCount: 47,
  },
  {
    id: 'gf-south-china-sea',
    name: 'South China Sea',
    type: 'circle',
    coordinates: [[12.0, 114.0]],
    radius: 600,
    color: '#ff9900',
    alertCategories: ['military', 'flight', 'satellite'],
    active: true,
    createdAt: Date.now() - 86400000,
    lastTriggered: Date.now() - 7200000,
    triggerCount: 23,
  },
  {
    id: 'gf-eastern-europe',
    name: 'Eastern Europe Conflict Zone',
    type: 'circle',
    coordinates: [[49.0, 32.0]],
    radius: 500,
    color: '#ff6600',
    alertCategories: ['military', 'flight', 'gdelt', 'outage'],
    active: true,
    createdAt: Date.now() - 86400000,
    lastTriggered: Date.now() - 1800000,
    triggerCount: 89,
  },
  {
    id: 'gf-gulf-guinea',
    name: 'Gulf of Guinea Piracy',
    type: 'circle',
    coordinates: [[4.0, 3.0]],
    radius: 400,
    color: '#ffcc00',
    alertCategories: ['military', 'gdelt'],
    active: true,
    createdAt: Date.now() - 86400000,
    lastTriggered: Date.now() - 86400000,
    triggerCount: 12,
  },
];

let _initialized = false;
function ensureInitialized() {
  if (!_initialized) {
    for (const gf of SAMPLE_GEOFENCES) {
      geofences.set(gf.id, gf);
    }
    _initialized = true;
  }
}

export function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function isPointInCircle(lat: number, lng: number, fence: Geofence): boolean {
  if (fence.type !== 'circle' || !fence.radius || fence.coordinates.length === 0) return false;
  const center = fence.coordinates[0];
  const dist = haversineDistance(lat, lng, center[0], center[1]);
  return dist <= fence.radius;
}

export function isPointInPolygon(lat: number, lng: number, polygon: number[][]): boolean {
  let inside = false;
  const n = polygon.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = polygon[i][0], yi = polygon[i][1];
    const xj = polygon[j][0], yj = polygon[j][1];
    if (((yi > lng) !== (yj > lng)) && (lat < (xj - xi) * (lng - yi) / (yj - yi) + xi)) {
      inside = !inside;
    }
  }
  return inside;
}

export function isPointInFence(lat: number, lng: number, fence: Geofence): boolean {
  if (!fence.active) return false;
  if (fence.type === 'circle') {
    return isPointInCircle(lat, lng, fence);
  } else if (fence.type === 'polygon' && fence.coordinates.length >= 3) {
    return isPointInPolygon(lat, lng, fence.coordinates);
  }
  return false;
}

export function findTriggeredFences(lat: number, lng: number, category?: string): Geofence[] {
  ensureInitialized();
  const triggered: Geofence[] = [];
  for (const fence of geofences.values()) {
    if (!fence.active) continue;
    if (category && fence.alertCategories.length > 0 && !fence.alertCategories.includes(category)) continue;
    if (isPointInFence(lat, lng, fence)) {
      fence.lastTriggered = Date.now();
      fence.triggerCount++;
      triggered.push(fence);
    }
  }
  return triggered;
}

export function getAllGeofences(): Geofence[] {
  ensureInitialized();
  return Array.from(geofences.values());
}

export function getGeofence(id: string): Geofence | undefined {
  ensureInitialized();
  return geofences.get(id);
}

export function getGeofenceCount(): number {
  ensureInitialized();
  return geofences.size;
}

export function setGeofence(fence: Geofence): void {
  ensureInitialized();
  geofences.set(fence.id, fence);
}

export function deleteGeofence(id: string): Geofence | undefined {
  ensureInitialized();
  const deleted = geofences.get(id);
  geofences.delete(id);
  return deleted;
}

export function hasGeofence(id: string): boolean {
  ensureInitialized();
  return geofences.has(id);
}

export function addAlert(alert: GeofenceAlert): void {
  alertHistory.push(alert);
  while (alertHistory.length > MAX_ALERT_HISTORY) {
    alertHistory.shift();
  }
}

export function getAlertHistory(options?: {
  limit?: number;
  acknowledged?: boolean;
  geofenceId?: string;
}): GeofenceAlert[] {
  let alerts = [...alertHistory];

  if (options?.acknowledged !== undefined) {
    alerts = alerts.filter(a => a.acknowledged === options.acknowledged);
  }
  if (options?.geofenceId) {
    alerts = alerts.filter(a => a.geofenceId === options.geofenceId);
  }

  alerts.reverse();

  const limit = options?.limit || 50;
  return alerts.slice(0, limit);
}

export function acknowledgeAlert(alertId: string): boolean {
  const alert = alertHistory.find(a => a.id === alertId);
  if (alert) {
    alert.acknowledged = true;
    return true;
  }
  return false;
}

export function acknowledgeAllAlerts(): number {
  let count = 0;
  for (const alert of alertHistory) {
    if (!alert.acknowledged) {
      alert.acknowledged = true;
      count++;
    }
  }
  return count;
}

export function getUnacknowledgedCount(): number {
  return alertHistory.filter(a => !a.acknowledged).length;
}

export function getCriticalUnacknowledgedCount(): number {
  return alertHistory.filter(a => !a.acknowledged && a.severity === 'critical').length;
}
