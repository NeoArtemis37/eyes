
import { NextRequest, NextResponse } from 'next/server';
import {
  type Geofence,
  getAllGeofences,
  getGeofence,
  getGeofenceCount,
  setGeofence,
  deleteGeofence,
  hasGeofence,
  findTriggeredFences,
} from '@/lib/geofence-store';

export async function GET(request: NextRequest) {
  const lat = request.nextUrl.searchParams.get('lat');
  const lng = request.nextUrl.searchParams.get('lng');
  const category = request.nextUrl.searchParams.get('category') || undefined;

  if (lat && lng) {
    const pointLat = parseFloat(lat);
    const pointLng = parseFloat(lng);
    if (!isNaN(pointLat) && !isNaN(pointLng)) {
      const triggered = findTriggeredFences(pointLat, pointLng, category);
      return NextResponse.json({
        geofences: getAllGeofences(),
        triggered,
        point: { lat: pointLat, lng: pointLng },
        timestamp: Date.now(),
      });
    }
  }

  return NextResponse.json({
    geofences: getAllGeofences(),
    count: getGeofenceCount(),
    timestamp: Date.now(),
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const id = `gf-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

    const fence: Geofence = {
      id,
      name: body.name || 'Unnamed Geofence',
      type: body.type || 'circle',
      coordinates: body.coordinates || [],
      radius: body.radius,
      color: body.color || '#00ccff',
      alertCategories: body.alertCategories || [],
      active: body.active !== undefined ? body.active : true,
      createdAt: Date.now(),
      triggerCount: 0,
    };

    if (fence.type === 'circle' && (!fence.radius || fence.coordinates.length === 0)) {
      return NextResponse.json({ error: 'Circle geofence requires coordinates (center) and radius' }, { status: 400 });
    }
    if (fence.type === 'polygon' && fence.coordinates.length < 3) {
      return NextResponse.json({ error: 'Polygon geofence requires at least 3 coordinate pairs' }, { status: 400 });
    }

    setGeofence(fence);

    return NextResponse.json({
      geofence: fence,
      message: `Geofence "${fence.name}" created successfully`,
      timestamp: Date.now(),
    }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: `Failed to create geofence: ${error.message}` }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest) {
  const id = request.nextUrl.searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'Geofence id is required' }, { status: 400 });
  }

  if (!hasGeofence(id)) {
    return NextResponse.json({ error: `Geofence "${id}" not found` }, { status: 404 });
  }

  const deleted = deleteGeofence(id);

  return NextResponse.json({
    deleted,
    message: `Geofence "${deleted?.name}" deleted`,
    remainingCount: getGeofenceCount(),
    timestamp: Date.now(),
  });
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const id = body.id;

    if (!id || !hasGeofence(id)) {
      return NextResponse.json({ error: `Geofence "${id}" not found` }, { status: 404 });
    }

    const fence = getGeofence(id)!;

    if (body.active !== undefined) fence.active = body.active;
    if (body.name) fence.name = body.name;
    if (body.color) fence.color = body.color;
    if (body.alertCategories) fence.alertCategories = body.alertCategories;
    if (body.coordinates) fence.coordinates = body.coordinates;
    if (body.radius !== undefined) fence.radius = body.radius;

    setGeofence(fence);

    return NextResponse.json({
      geofence: fence,
      message: `Geofence "${fence.name}" updated`,
      timestamp: Date.now(),
    });
  } catch (error: any) {
    return NextResponse.json({ error: `Failed to update geofence: ${error.message}` }, { status: 400 });
  }
}
