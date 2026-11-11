'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Bell, BellRing, X, MapPin, Shield, AlertTriangle,
  CheckCheck, ChevronRight, Clock
} from 'lucide-react';
import type { GeofenceAlert } from '@/hooks/useGeofenceAlerts';

interface AlertNotificationsProps {
  alerts: GeofenceAlert[];
  unacknowledgedCount: number;
  criticalCount: number;
  onAcknowledge: (alertId: string) => void;
  onAcknowledgeAll: () => void;
  onRefresh: () => void;
  isEvaluating: boolean;
}

const SEVERITY_STYLES: Record<string, {
  text: string;
  bg: string;
  border: string;
  glow: string;
  dot: string;
  icon: typeof Shield;
}> = {
  critical: {
    text: 'text-red-400',
    bg: 'bg-red-900/30',
    border: 'border-red-700/40',
    glow: 'shadow-red-500/20',
    dot: 'bg-red-500',
    icon: AlertTriangle,
  },
  high: {
    text: 'text-orange-400',
    bg: 'bg-orange-900/30',
    border: 'border-orange-700/40',
    glow: 'shadow-orange-500/20',
    dot: 'bg-orange-500',
    icon: Shield,
  },
  medium: {
    text: 'text-yellow-400',
    bg: 'bg-yellow-900/20',
    border: 'border-yellow-700/30',
    glow: 'shadow-yellow-500/10',
    dot: 'bg-yellow-500',
    icon: Bell,
  },
  low: {
    text: 'text-cyan-400',
    bg: 'bg-cyan-900/20',
    border: 'border-cyan-700/30',
    glow: 'shadow-cyan-500/10',
    dot: 'bg-cyan-500',
    icon: Bell,
  },
};

function timeAgo(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function AlertNotifications({
  alerts,
  unacknowledgedCount,
  criticalCount,
  onAcknowledge,
  onAcknowledgeAll,
  onRefresh,
  isEvaluating,
}: AlertNotificationsProps) {
  const [panelOpen, setPanelOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const autoDismissTimersRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  useEffect(() => {
    const timers = autoDismissTimersRef.current;

    for (const alert of alerts) {
      if (!alert.acknowledged && !timers.has(alert.id)) {
        const elapsed = Date.now() - alert.timestamp;
        const remaining = Math.max(0, 30000 - elapsed);
        const timer = setTimeout(() => {
          onAcknowledge(alert.id);
        }, remaining);
        timers.set(alert.id, timer);
      }
    }

    for (const [alertId, timer] of timers) {
      const alertExists = alerts.find(a => a.id === alertId && !a.acknowledged);
      if (!alertExists) {
        clearTimeout(timer);
        timers.delete(alertId);
      }
    }

    return () => {
      for (const timer of timers.values()) {
        clearTimeout(timer);
      }
    };
  }, [alerts, onAcknowledge]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setPanelOpen(false);
      }
    }
    if (panelOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [panelOpen]);

  const handleFlyTo = useCallback((lat: number, lng: number) => {
    const flyTo = (window as any).__osirisMapFlyTo;
    if (flyTo) {
      flyTo(lat, lng, 10);
    }
  }, []);

  const hasCritical = criticalCount > 0;

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => {
          setPanelOpen(!panelOpen);
          if (!panelOpen) onRefresh();
        }}
        className={`relative flex items-center gap-1.5 px-2 py-1 rounded border transition-all ${
          panelOpen
            ? 'bg-cyan-900/40 border-cyan-700/40'
            : hasCritical
              ? 'bg-red-900/30 border-red-700/40 hover:bg-red-900/40'
              : unacknowledgedCount > 0
                ? 'bg-yellow-900/20 border-yellow-700/30 hover:bg-yellow-900/30'
                : 'bg-black/40 border-gray-700/30 hover:border-gray-600/40'
        }`}
        title={`${unacknowledgedCount} unacknowledged alert${unacknowledgedCount !== 1 ? 's' : ''}`}
      >
        {hasCritical ? (
          <BellRing className={`w-3.5 h-3.5 text-red-400 ${hasCritical ? 'animate-pulse' : ''}`} />
        ) : (
          <Bell className={`w-3.5 h-3.5 ${unacknowledgedCount > 0 ? 'text-yellow-400' : 'text-gray-500'}`} />
        )}

        <span className="text-[9px] font-mono text-gray-400 tracking-wider">
          ALERTS
        </span>

        {unacknowledgedCount > 0 && (
          <span className={`ml-0.5 min-w-[16px] h-4 flex items-center justify-center text-[8px] font-mono font-bold rounded-full px-1 ${
            hasCritical
              ? 'bg-red-600 text-white animate-pulse'
              : 'bg-yellow-600/80 text-white'
          }`}>
            {unacknowledgedCount > 99 ? '99+' : unacknowledgedCount}
          </span>
        )}

        {isEvaluating && (
          <div className="w-2 h-2 border border-cyan-400 border-t-transparent rounded-full animate-spin" />
        )}
      </button>

      <div
        className={`absolute top-full right-0 mt-2 w-96 max-h-[70vh] bg-black/95 border border-cyan-900/40 rounded-lg shadow-2xl shadow-black/50 backdrop-blur-md z-50 transition-all duration-300 origin-top-right ${
          panelOpen
            ? 'opacity-100 scale-100 pointer-events-auto'
            : 'opacity-0 scale-95 pointer-events-none'
        }`}
      >
        <div className="flex items-center justify-between px-3 py-2 border-b border-cyan-900/30 bg-black/60 rounded-t-lg">
          <div className="flex items-center gap-2">
            <BellRing className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-cyan-400 text-[10px] font-bold tracking-[0.2em]">GEOFENCE ALERTS</span>
            <span className="text-gray-600 text-[8px] font-mono">
              {unacknowledgedCount} UNACK
            </span>
          </div>
          <div className="flex items-center gap-1">
            {unacknowledgedCount > 0 && (
              <button
                onClick={() => onAcknowledgeAll()}
                className="flex items-center gap-1 px-1.5 py-0.5 text-[8px] font-mono text-cyan-400 border border-cyan-800/40 rounded hover:bg-cyan-900/30 transition-colors"
                title="Acknowledge all alerts"
              >
                <CheckCheck className="w-3 h-3" />
                ACK ALL
              </button>
            )}
            <button
              onClick={() => setPanelOpen(false)}
              className="p-1 text-gray-500 hover:text-gray-300 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div className="overflow-y-auto max-h-[60vh] custom-scrollbar">
          {alerts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 gap-2">
              <Bell className="w-6 h-6 text-gray-700" />
              <span className="text-gray-600 text-[10px] font-mono tracking-wider">NO ACTIVE ALERTS</span>
              <span className="text-gray-700 text-[8px] font-mono">All geofence zones clear</span>
            </div>
          ) : (
            <div className="p-2 space-y-1.5">
              {alerts.map(alert => {
                const style = SEVERITY_STYLES[alert.severity] || SEVERITY_STYLES.medium;
                const SeverityIcon = style.icon;

                return (
                  <div
                    key={alert.id}
                    className={`group p-2.5 border rounded-lg transition-all cursor-pointer ${style.bg} ${style.border} hover:brightness-125`}
                    onClick={() => handleFlyTo(alert.eventLat, alert.eventLng)}
                  >
                    <div className="flex items-start gap-2">
                      <div className={`w-2 h-2 rounded-full mt-1 flex-shrink-0 ${style.dot} ${
                        !alert.acknowledged && alert.severity === 'critical' ? 'animate-pulse' : ''
                      }`} style={{ boxShadow: `0 0 6px ${style.dot.includes('red') ? '#ef4444' : style.dot.includes('orange') ? '#f97316' : '#eab308'}40` }} />

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className={`text-[10px] font-bold truncate ${style.text}`}>
                            {alert.geofenceName}
                          </span>
                          <span className={`text-[7px] px-1 py-0.5 rounded font-bold tracking-wider ${style.bg} ${style.border} border`}>
                            {alert.severity.toUpperCase()}
                          </span>
                        </div>

                        <div className="text-[9px] text-gray-400 font-mono truncate mb-1">
                          <span className="text-gray-500">EVENT:</span>{' '}
                          <span className="text-gray-300">{alert.eventLabel}</span>
                        </div>

                        <div className="flex items-center gap-2 text-[8px] font-mono text-gray-500 mb-1">
                          <span className="px-1 py-0.5 bg-cyan-900/20 text-cyan-500 rounded border border-cyan-900/20">
                            {alert.category.toUpperCase()}
                          </span>
                          <span className="flex items-center gap-0.5">
                            <MapPin className="w-2.5 h-2.5" />
                            {alert.eventLat.toFixed(2)}°, {alert.eventLng.toFixed(2)}°
                          </span>
                        </div>

                        <div className="flex items-center gap-1 text-[8px] text-gray-600 font-mono">
                          <Clock className="w-2.5 h-2.5" />
                          {timeAgo(alert.timestamp)}
                        </div>
                      </div>

                      <div className="flex flex-col gap-1 items-center flex-shrink-0">
                        {!alert.acknowledged && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onAcknowledge(alert.id);
                            }}
                            className="px-1.5 py-0.5 text-[7px] font-mono font-bold text-cyan-400 border border-cyan-800/40 rounded hover:bg-cyan-900/30 transition-colors tracking-wider"
                          >
                            ACK
                          </button>
                        )}
                        <ChevronRight className="w-3 h-3 text-gray-600 group-hover:text-cyan-400 transition-colors" />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between px-3 py-1.5 border-t border-cyan-900/30 bg-black/60 rounded-b-lg">
          <div className="flex items-center gap-1.5">
            <div className={`w-1.5 h-1.5 rounded-full ${unacknowledgedCount > 0 ? (hasCritical ? 'bg-red-500 animate-pulse' : 'bg-yellow-500') : 'bg-green-500'}`} />
            <span className="text-[8px] text-gray-500 font-mono tracking-wider">
              {hasCritical ? 'CRITICAL ACTIVE' : unacknowledgedCount > 0 ? 'ALERTS PENDING' : 'ALL CLEAR'}
            </span>
          </div>
          <button
            onClick={() => onRefresh()}
            className="text-[8px] text-gray-600 font-mono hover:text-cyan-400 transition-colors tracking-wider"
          >
            ↻ REFRESH
          </button>
        </div>
      </div>
    </div>
  );
}
