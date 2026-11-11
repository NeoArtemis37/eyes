'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { GlobePoint } from '@/lib/osint-data';

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

interface UseGeofenceAlertsReturn {
  alerts: GeofenceAlert[];
  unacknowledgedCount: number;
  criticalCount: number;
  acknowledgeAlert: (alertId: string) => void;
  acknowledgeAll: () => void;
  refreshAlerts: () => void;
  isEvaluating: boolean;
}

function pointHash(p: GlobePoint): string {
  const lat = p.lat.toFixed(4);
  const lng = p.lng.toFixed(4);
  const type = p.type || '';
  const label = p.label || '';
  return `${lat}:${lng}:${type}:${label}`;
}

async function fetchAlerts(): Promise<{
  alerts: GeofenceAlert[];
  unacknowledgedCount: number;
  criticalCount: number;
} | null> {
  try {
    const res = await fetch('/api/osint/geofence/evaluate?acknowledged=false&limit=50');
    if (res.ok) {
      const data = await res.json();
      return {
        alerts: data.alerts || [],
        unacknowledgedCount: data.unacknowledgedCount || 0,
        criticalCount: data.criticalCount || 0,
      };
    }
  } catch (err) {
    console.error('[useGeofenceAlerts] Refresh error:', err);
  }
  return null;
}

async function postEvaluate(events: Array<{ lat: number; lng: number; category: string; label: string }>): Promise<number | null> {
  try {
    const res = await fetch('/api/osint/geofence/evaluate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ events }),
    });
    if (res.ok) {
      const data = await res.json();
      return data.unacknowledgedCount || 0;
    }
  } catch (err) {
    console.error('[useGeofenceAlerts] Evaluate error:', err);
  }
  return null;
}

async function patchAcknowledge(alertId: string): Promise<boolean> {
  try {
    const res = await fetch('/api/osint/geofence/evaluate', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ alertId }),
    });
    return res.ok;
  } catch (err) {
    console.error('[useGeofenceAlerts] Acknowledge error:', err);
    return false;
  }
}

async function patchAcknowledgeAll(): Promise<boolean> {
  try {
    const res = await fetch('/api/osint/geofence/evaluate', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ acknowledgeAll: true }),
    });
    return res.ok;
  } catch (err) {
    console.error('[useGeofenceAlerts] AcknowledgeAll error:', err);
    return false;
  }
}

export function useGeofenceAlerts(globePoints: GlobePoint[]): UseGeofenceAlertsReturn {
  const [alerts, setAlerts] = useState<GeofenceAlert[]>([]);
  const [unacknowledgedCount, setUnacknowledgedCount] = useState(0);
  const [criticalCount, setCriticalCount] = useState(0);
  const [isEvaluating, setIsEvaluating] = useState(false);

  const evaluatedHashesRef = useRef<Set<string>>(new Set());
  const lastEvaluateTimeRef = useRef<number>(0);
  const globePointsRef = useRef<GlobePoint[]>(globePoints);

  useEffect(() => {
    globePointsRef.current = globePoints;
  }, [globePoints]);

  const refreshAlerts = useCallback(() => {
    fetchAlerts().then(data => {
      if (data) {
        setAlerts(data.alerts);
        setUnacknowledgedCount(data.unacknowledgedCount);
        setCriticalCount(data.criticalCount);
      }
    });
  }, []);

  const acknowledgeAlert = useCallback((alertId: string) => {
    patchAcknowledge(alertId).then(ok => {
      if (ok) refreshAlerts();
    });
  }, [refreshAlerts]);

  const acknowledgeAll = useCallback(() => {
    patchAcknowledgeAll().then(ok => {
      if (ok) refreshAlerts();
    });
  }, [refreshAlerts]);

  const evaluateNewPoints = useCallback(() => {
    const currentPoints = globePointsRef.current;
    const newPoints: GlobePoint[] = [];
    for (const p of currentPoints) {
      const hash = pointHash(p);
      if (!evaluatedHashesRef.current.has(hash)) {
        newPoints.push(p);
        evaluatedHashesRef.current.add(hash);
      }
    }

    if (newPoints.length === 0) return;

    setIsEvaluating(true);
    const events = newPoints.map(p => ({
      lat: p.lat,
      lng: p.lng,
      category: p.type,
      label: p.label || `${p.type}@${p.lat.toFixed(2)},${p.lng.toFixed(2)}`,
    }));

    postEvaluate(events).then(unackCount => {
      if (unackCount !== null) {
        setUnacknowledgedCount(unackCount);
        refreshAlerts();
      }
      setIsEvaluating(false);
    });
  }, [refreshAlerts]);

  useEffect(() => {
    const interval = setInterval(() => {
      evaluateNewPoints();
    }, 30000);

    return () => clearInterval(interval);
  }, [evaluateNewPoints]);

  useEffect(() => {
    const now = Date.now();
    if (now - lastEvaluateTimeRef.current > 10000) {
      lastEvaluateTimeRef.current = now;
      const timer = setTimeout(() => {
        evaluateNewPoints();
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [globePoints, evaluateNewPoints]);

  useEffect(() => {
    const timer = setTimeout(() => {
      refreshAlerts();
    }, 0);
    return () => clearTimeout(timer);
  }, [refreshAlerts]);

  return {
    alerts,
    unacknowledgedCount,
    criticalCount,
    acknowledgeAlert,
    acknowledgeAll,
    refreshAlerts,
    isEvaluating,
  };
}
