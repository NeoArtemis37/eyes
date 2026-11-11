
import { NextResponse } from 'next/server';

let cachedUnits: { time: number; data: any[] } | null = null;
const CACHE_TTL = 300000; // 5 minutes

const MILITARY_UNITS = [
  { id: 'MIL-UA-001', name: '3rd Assault Brigade', type: 'BRIGADE', side: 'Ukraine', location: 'Bakhmut Sector', lat: 48.5844, lng: 37.9984, status: 'active', strength: '~2000 personnel', equipment: 'IFV, APC, Artillery', lastUpdated: '2025-12', role: 'Assault Operations' },
  { id: 'MIL-UA-002', name: '47th Mechanized Brigade', type: 'BRIGADE', side: 'Ukraine', location: 'Zaporizhzhia Front', lat: 47.8388, lng: 35.1396, status: 'active', strength: '~3000 personnel', equipment: 'Leopard 2, Bradley IFV', lastUpdated: '2025-12', role: 'Mechanized Assault' },
  { id: 'MIL-UA-003', name: 'Air Defense Command', type: 'COMMAND', side: 'Ukraine', location: 'Kyiv Region', lat: 50.4501, lng: 30.5234, status: 'active', strength: '~5000 personnel', equipment: 'Patriot, S-300, IRIS-T', lastUpdated: '2025-12', role: 'Air Defense' },
  { id: 'MIL-UA-004', name: 'Naval Forces HQ', type: 'HQ', side: 'Ukraine', location: 'Odesa', lat: 46.4825, lng: 30.7233, status: 'active', strength: '~15000 personnel', equipment: 'Naval Vessels, Coastal Defense', lastUpdated: '2025-12', role: 'Maritime Operations' },
  { id: 'MIL-UA-005', name: '1st Tank Brigade', type: 'BRIGADE', side: 'Ukraine', location: 'Kharkiv Sector', lat: 49.9935, lng: 36.2304, status: 'active', strength: '~2500 personnel', equipment: 'T-64BV, T-72', lastUpdated: '2025-12', role: 'Armor Operations' },
  { id: 'MIL-UA-006', name: 'SBU Counter-Intel', type: 'UNIT', side: 'Ukraine', location: 'Multiple Regions', lat: 50.4501, lng: 30.5234, status: 'active', strength: 'Classified', equipment: 'SIGINT, HUMINT Assets', lastUpdated: '2025-12', role: 'Counter-Intelligence' },

  { id: 'MIL-NATO-001', name: 'V Corps HQ', type: 'HQ', side: 'NATO', location: 'Fort Knox, KY', lat: 37.8977, lng: -85.9619, status: 'active', strength: '~800 personnel', equipment: 'C2 Systems', lastUpdated: '2025-12', role: 'Theater Command' },
  { id: 'MIL-NATO-002', name: '2nd Cavalry Regiment', type: 'REGIMENT', side: 'NATO', location: 'Vilseck, Germany', lat: 49.6167, lng: 11.9333, status: 'active', strength: '~5000 personnel', equipment: 'Stryker, JLTV', lastUpdated: '2025-12', role: 'Reconnaissance' },
  { id: 'MIL-NATO-003', name: 'eFP Battlegroup Poland', type: 'BATTLEGROUP', side: 'NATO', location: 'Orzysz, Poland', lat: 53.9167, lng: 22.0833, status: 'active', strength: '~1500 personnel', equipment: 'Leopard 2, CV90', lastUpdated: '2025-12', role: 'Forward Presence' },
  { id: 'MIL-NATO-004', name: 'RAF Akrotiri', type: 'BASE', side: 'NATO', location: 'Cyprus', lat: 34.5933, lng: 32.9900, status: 'active', strength: '~3000 personnel', equipment: 'Typhoon, RC-135', lastUpdated: '2025-12', role: 'Air Operations' },
  { id: 'MIL-NATO-005', name: 'NAS Sigonella', type: 'BASE', side: 'NATO', location: 'Sicily, Italy', lat: 37.4017, lng: 14.9228, status: 'active', strength: '~4000 personnel', equipment: 'P-8A, MQ-4C, F-35', lastUpdated: '2025-12', role: 'Maritime Patrol / ISR' },
  { id: 'MIL-NATO-006', name: '3rd Fleet HQ', type: 'COMMAND', side: 'NATO', location: 'San Diego, CA', lat: 32.7157, lng: -117.1611, status: 'active', strength: '~30000 personnel', equipment: 'CVN, DDG, SSN', lastUpdated: '2025-12', role: 'Pacific Naval Operations' },

  { id: 'MIL-ME-001', name: '5th Fleet HQ', type: 'COMMAND', side: 'NATO', location: 'Bahrain', lat: 26.2285, lng: 50.5860, status: 'active', strength: '~15000 personnel', equipment: 'CVN, DDG, F-18', lastUpdated: '2025-12', role: 'Persian Gulf Operations' },
  { id: 'MIL-ME-002', name: 'CENTCOM Forward HQ', type: 'HQ', side: 'NATO', location: 'Qatar', lat: 25.2854, lng: 51.5310, status: 'active', strength: '~10000 personnel', equipment: 'C2, ISR Assets', lastUpdated: '2025-12', role: 'Regional Command' },
  { id: 'MIL-ME-003', name: 'Incirlik Air Base', type: 'BASE', side: 'NATO', location: 'Adana, Turkey', lat: 37.0014, lng: 35.4258, status: 'active', strength: '~5000 personnel', equipment: 'F-16, F-35, A-10', lastUpdated: '2025-12', role: 'Air Operations' },

  { id: 'MIL-AP-001', name: '7th Fleet HQ', type: 'COMMAND', side: 'NATO', location: 'Yokosuka, Japan', lat: 35.2833, lng: 139.6667, status: 'active', strength: '~20000 personnel', equipment: 'CVN, DDG, SSN', lastUpdated: '2025-12', role: 'Western Pacific Operations' },
  { id: 'MIL-AP-002', name: 'Camp Humphreys', type: 'BASE', side: 'NATO', location: 'Pyongtaek, Korea', lat: 36.9697, lng: 127.0314, status: 'active', strength: '~25000 personnel', equipment: 'Apache, M1A2, HIMARS', lastUpdated: '2025-12', role: 'Korean Peninsula Defense' },
  { id: 'MIL-AP-003', name: 'Andersen AFB', type: 'BASE', side: 'NATO', location: 'Guam', lat: 13.5833, lng: 144.9167, status: 'active', strength: '~3000 personnel', equipment: 'B-52, B-2, F-35', lastUpdated: '2025-12', role: 'Strategic Bomber Operations' },

  { id: 'MIL-AF-001', name: 'AFRICOM HQ', type: 'HQ', side: 'NATO', location: 'Stuttgart, Germany', lat: 48.7755, lng: 9.1829, status: 'active', strength: '~2000 personnel', equipment: 'C2, ISR', lastUpdated: '2025-12', role: 'African Theater Command' },
  { id: 'MIL-AF-002', name: 'Camp Lemonnier', type: 'BASE', side: 'NATO', location: 'Djibouti', lat: 11.5489, lng: 43.1456, status: 'active', strength: '~4000 personnel', equipment: 'MQ-9, SOF', lastUpdated: '2025-12', role: 'Horn of Africa Operations' },

  { id: 'MIL-EU-001', name: 'RAF Mildenhall', type: 'BASE', side: 'NATO', location: 'Suffolk, UK', lat: 52.3617, lng: 0.4833, status: 'active', strength: '~3000 personnel', equipment: 'KC-135, CV-22, MC-130', lastUpdated: '2025-12', role: 'Special Operations / Refueling' },
  { id: 'MIL-EU-002', name: 'Ramstein AB', type: 'BASE', side: 'NATO', location: 'Rheinland-Pfalz, Germany', lat: 49.4372, lng: 7.5936, status: 'active', strength: '~9000 personnel', equipment: 'C-130, F-16, C-17', lastUpdated: '2025-12', role: 'Air Operations Hub' },
];

export async function GET() {
  try {
    if (cachedUnits && Date.now() - cachedUnits.time < CACHE_TTL) {
      return NextResponse.json({
        source: 'Open-Source Military Intelligence (cached)',
        timestamp: cachedUnits.time,
        count: cachedUnits.data.length,
        units: cachedUnits.data,
      });
    }

    cachedUnits = { time: Date.now(), data: MILITARY_UNITS };

    return NextResponse.json({
      source: 'Open-Source Military Intelligence · OSINT/STRATFOR/Wikipedia',
      timestamp: Date.now(),
      count: MILITARY_UNITS.length,
      units: MILITARY_UNITS,
    });
  } catch (error: any) {
    console.error('Military API error:', error.message);
    return NextResponse.json({
      source: 'Military Intelligence (fallback)',
      timestamp: Date.now(),
      count: MILITARY_UNITS.length,
      units: MILITARY_UNITS,
      error: error.message,
    });
  }
}
