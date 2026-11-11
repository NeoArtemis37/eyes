
import { NextRequest, NextResponse } from 'next/server';
import {
  type GeofenceAlert,
  findTriggeredFences,
  addAlert,
  getAlertHistory,
  acknowledgeAlert,
  acknowledgeAllAlerts,
  getUnacknowledgedCount,
  getCriticalUnacknowledgedCount,
} from '@/lib/geofence-store';

function determineSeverity(category: string, fenceColor: string): string {
  const criticalCategories = ['military', 'cyber'];
  const highCategories = ['gdelt', 'earthquake'];

  if (criticalCategories.includes(category)) return 'critical';
  if (highCategories.includes(category)) return 'high';
  if (fenceColor.includes('ff33') || fenceColor.includes('ff66') || fenceColor.includes('ff00')) return 'high';
  return 'medium';
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const events: Array<{
      lat: number;
      lng: number;
      category: string;
      label?: string;
      id?: string;
    }> = body.events || [];

    if (!Array.isArray(events) || events.length === 0) {
      return NextResponse.json({
        error: 'events array is required and must not be empty',
        triggeredAlerts: [],
        timestamp: Date.now(),
      }, { status: 400 });
    }

    const triggeredAlerts: GeofenceAlert[] = [];

    for (const event of events) {
      if (typeof event.lat !== 'number' || typeof event.lng !== 'number') continue;

      const triggered = findTriggeredFences(event.lat, event.lng, event.category);

      for (const fence of triggered) {
        const alert: GeofenceAlert = {
          id: `alert-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
          geofenceId: fence.id,
          geofenceName: fence.name,
          category: event.category || 'unknown',
          eventLat: event.lat,
          eventLng: event.lng,
          eventLabel: event.label || `${event.category}@${event.lat.toFixed(2)},${event.lng.toFixed(2)}`,
          severity: determineSeverity(event.category, fence.color),
          timestamp: Date.now(),
          acknowledged: false,
        };

        addAlert(alert);
        triggeredAlerts.push(alert);
      }
    }

    return NextResponse.json({
      triggeredAlerts,
      evaluatedCount: events.length,
      triggeredCount: triggeredAlerts.length,
      unacknowledgedCount: getUnacknowledgedCount(),
      timestamp: Date.now(),
    });
  } catch (error: any) {
    return NextResponse.json({
      error: `Evaluation failed: ${error.message}`,
      timestamp: Date.now(),
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const limitParam = request.nextUrl.searchParams.get('limit');
    const acknowledgedParam = request.nextUrl.searchParams.get('acknowledged');
    const geofenceIdParam = request.nextUrl.searchParams.get('geofenceId');

    const options: {
      limit?: number;
      acknowledged?: boolean;
      geofenceId?: string;
    } = {};

    if (limitParam) {
      const parsed = parseInt(limitParam, 10);
      if (!isNaN(parsed) && parsed > 0) {
        options.limit = Math.min(parsed, 200);
      }
    }

    if (acknowledgedParam !== null) {
      options.acknowledged = acknowledgedParam === 'true';
    }

    if (geofenceIdParam) {
      options.geofenceId = geofenceIdParam;
    }

    const alerts = getAlertHistory(options);

    return NextResponse.json({
      alerts,
      unacknowledgedCount: getUnacknowledgedCount(),
      criticalCount: getCriticalUnacknowledgedCount(),
      totalReturned: alerts.length,
      timestamp: Date.now(),
    });
  } catch (error: any) {
    return NextResponse.json({
      error: `Failed to fetch alerts: ${error.message}`,
      timestamp: Date.now(),
    }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();

    if (body.acknowledgeAll === true) {
      const count = acknowledgeAllAlerts();
      return NextResponse.json({
        message: `Acknowledged ${count} alerts`,
        acknowledgedCount: count,
        unacknowledgedCount: getUnacknowledgedCount(),
        timestamp: Date.now(),
      });
    }

    if (body.alertId) {
      const success = acknowledgeAlert(body.alertId);
      if (success) {
        return NextResponse.json({
          message: `Alert ${body.alertId} acknowledged`,
          alertId: body.alertId,
          unacknowledgedCount: getUnacknowledgedCount(),
          timestamp: Date.now(),
        });
      } else {
        return NextResponse.json({
          error: `Alert "${body.alertId}" not found`,
          timestamp: Date.now(),
        }, { status: 404 });
      }
    }

    return NextResponse.json({
      error: 'Provide either alertId or acknowledgeAll: true',
      timestamp: Date.now(),
    }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({
      error: `Failed to acknowledge: ${error.message}`,
      timestamp: Date.now(),
    }, { status: 500 });
  }
}
