
import { NextRequest, NextResponse } from 'next/server';
import ZAI from 'z-ai-web-dev-sdk';

interface Finding {
  severity: 'critical' | 'high' | 'medium' | 'low';
  category: string;
  title: string;
  description: string;
  location?: string;
  timestamp?: string;
}

interface Hotspot {
  lat: number;
  lng: number;
  radius: number;
  threatScore: number;
  description: string;
  categories: string[];
}

interface Anomaly {
  type: string;
  description: string;
  deviation: string;
  affectedArea?: string;
}

interface Prediction {
  event: string;
  probability: number;
  timeframe: string;
  impact: string;
}

interface AIThreatAnalysis {
  threatLevel: number;
  confidence: number;
  summary: string;
  keyFindings: Finding[];
  hotspots: Hotspot[];
  anomalies: Anomaly[];
  predictions: Prediction[];
  recommendations: string[];
  timestamp: number;
  dataCoverage: {
    flights: boolean;
    cameras: boolean;
    cables: boolean;
    cyber: boolean;
    earthquakes: boolean;
    outages: boolean;
    fires: boolean;
    satellites: boolean;
    gdelt: boolean;
  };
}

let cachedAnalysis: { time: number; data: AIThreatAnalysis } | null = null;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function generateHeuristicAnalysis(rawData: any): AIThreatAnalysis {
  const flights = rawData.flights || [];
  const cameras = rawData.cameras || [];
  const cables = rawData.cables || [];
  const cyberThreats = rawData.cyberThreats || { vulnerabilities: [], botnetC2: [], malwareDist: [], attackSurface: [] };
  const earthquakes = rawData.earthquakes || [];
  const outages = rawData.outages || [];
  const fires = rawData.fires || { fires: [], volcanoes: [] };
  const satellites = rawData.satellites || [];
  const gdelt = rawData.gdelt || [];

  const militaryFlights = flights.filter((f: any) => f.isMilitary || f.classification === 'military');
  const militaryFlightCount = militaryFlights.length;

  const criticalCyber = [
    ...(cyberThreats.vulnerabilities || []),
    ...(cyberThreats.botnetC2 || []),
    ...(cyberThreats.malwareDist || []),
    ...(cyberThreats.attackSurface || []),
  ].filter((t: any) => t.severity === 'critical').length;

  const majorQuakes = earthquakes.filter((eq: any) => eq.magnitude >= 5).length;

  const criticalOutages = outages.filter((o: any) => o.severity === 'critical' || o.severity === 'high').length;

  const conflictEvents = gdelt.filter((g: any) => g.severity === 'critical' || g.severity === 'high').length;

  let threatLevel = 3;
  if (militaryFlightCount > 10) threatLevel += 2;
  else if (militaryFlightCount > 3) threatLevel += 1;
  if (criticalCyber > 5) threatLevel += 2;
  else if (criticalCyber > 0) threatLevel += 1;
  if (majorQuakes > 2) threatLevel += 1;
  if (criticalOutages > 3) threatLevel += 2;
  else if (criticalOutages > 0) threatLevel += 1;
  if (conflictEvents > 5) threatLevel += 2;
  else if (conflictEvents > 0) threatLevel += 1;
  threatLevel = Math.min(threatLevel, 10);

  const keyFindings: Finding[] = [];

  if (militaryFlightCount > 0) {
    const regions = new Set<string>();
    militaryFlights.slice(0, 5).forEach((f: any) => {
      if (f.originCountry) regions.add(f.originCountry);
    });
    keyFindings.push({
      severity: militaryFlightCount > 10 ? 'critical' : 'high',
      category: 'aviation',
      title: `${militaryFlightCount} Military Aircraft Detected`,
      description: `${militaryFlightCount} military aircraft currently airborne from ${regions.size} origin countries. Elevated military aviation activity suggests potential operations or exercises.`,
      location: Array.from(regions).slice(0, 3).join(', '),
      timestamp: new Date().toISOString(),
    });
  }

  if (criticalCyber > 0) {
    keyFindings.push({
      severity: 'critical',
      category: 'cyber',
      title: `${criticalCyber} Critical Cyber Threats Active`,
      description: `Active exploitation of ${criticalCyber} critical vulnerabilities detected across monitored networks. Known ransomware campaigns utilizing these vulnerabilities.`,
      timestamp: new Date().toISOString(),
    });
  }

  if (criticalOutages > 0) {
    const affectedCountries = outages
      .filter((o: any) => o.severity === 'critical' || o.severity === 'high')
      .map((o: any) => o.countryName || o.country)
      .filter(Boolean);
    keyFindings.push({
      severity: 'high',
      category: 'infrastructure',
      title: `Internet Outages in ${affectedCountries.length} Countries`,
      description: `Significant internet disruptions detected in ${affectedCountries.slice(0, 5).join(', ')}. Possible infrastructure attack or cascading failure.`,
      location: affectedCountries.slice(0, 3).join(', '),
    });
  }

  if (majorQuakes > 0) {
    keyFindings.push({
      severity: 'high',
      category: 'seismic',
      title: `${majorQuakes} Major Earthquakes (M5+)`,
      description: `${majorQuakes} significant seismic events detected. Potential for infrastructure damage and tsunami risk in affected regions.`,
    });
  }

  if (conflictEvents > 0) {
    keyFindings.push({
      severity: conflictEvents > 5 ? 'critical' : 'high',
      category: 'conflict',
      title: `${conflictEvents} High-Severity GDELT Events`,
      description: `GDELT global event tracker reports ${conflictEvents} high-severity conflict/crisis events. Escalation patterns detected in multiple regions.`,
    });
  }

  if (keyFindings.length < 5) {
    if (cables.length > 0) {
      const outageCables = cables.filter((c: any) => c.status === 'outage');
      if (outageCables.length > 0) {
        keyFindings.push({
          severity: 'high',
          category: 'infrastructure',
          title: `${outageCables.length} Submarine Cable Outages`,
          description: `${outageCables.length} submarine cables showing outage status. Potential internet disruption in affected regions.`,
        });
      }
    }
    if (satellites.length > 0) {
      const milSats = satellites.filter((s: any) => s.classification === 'military');
      if (milSats.length > 0) {
        keyFindings.push({
          severity: 'medium',
          category: 'space',
          title: `${milSats.length} Military Satellites Tracked`,
          description: `${milSats.length} military-classified satellites in orbit. Surveillance and communications assets active.`,
        });
      }
    }
    if (fires.fires?.length > 0 || fires.volcanoes?.length > 0) {
      const fireCount = fires.fires?.length || 0;
      const volcCount = fires.volcanoes?.length || 0;
      keyFindings.push({
        severity: volcCount > 0 ? 'high' : 'medium',
        category: 'environmental',
        title: `${fireCount} Active Fires, ${volcCount} Volcanic Events`,
        description: `Environmental monitoring detects ${fireCount} active fire incidents and ${volcCount} volcanic events.`,
      });
    }
    if (keyFindings.length < 5) {
      keyFindings.push({
        severity: 'low',
        category: 'general',
        title: 'Monitoring Active Across All Feeds',
        description: `${flights.length} flights, ${cameras.length} cameras, ${satellites.length} satellites currently tracked across all OSINT feeds.`,
      });
    }
  }

  const hotspots: Hotspot[] = [];

  if (militaryFlights.length >= 3) {
    const latSum = militaryFlights.reduce((s: number, f: any) => s + (f.latitude || f.lat || 0), 0);
    const lngSum = militaryFlights.reduce((s: number, f: any) => s + (f.longitude || f.lng || 0), 0);
    hotspots.push({
      lat: latSum / militaryFlights.length,
      lng: lngSum / militaryFlights.length,
      radius: 500,
      threatScore: Math.min(militaryFlightCount / 5, 10),
      description: `Military aviation concentration · ${militaryFlightCount} aircraft`,
      categories: ['aviation', 'military'],
    });
  }

  if (criticalOutages > 0) {
    const criticalOuts = outages.filter((o: any) => o.severity === 'critical' || o.severity === 'high');
    if (criticalOuts.length > 0) {
      const latAvg = criticalOuts.reduce((s: number, o: any) => s + (o.lat || 0), 0) / criticalOuts.length;
      const lngAvg = criticalOuts.reduce((s: number, o: any) => s + (o.lng || 0), 0) / criticalOuts.length;
      hotspots.push({
        lat: latAvg,
        lng: lngAvg,
        radius: 800,
        threatScore: Math.min(criticalOutages * 2, 10),
        description: `Internet outage cluster · ${criticalOutages} critical outages`,
        categories: ['infrastructure', 'outage'],
      });
    }
  }

  if (conflictEvents > 0) {
    const highGdelt = gdelt.filter((g: any) => g.severity === 'critical' || g.severity === 'high');
    if (highGdelt.length > 0) {
      const latAvg = highGdelt.reduce((s: number, g: any) => s + (g.lat || 0), 0) / highGdelt.length;
      const lngAvg = highGdelt.reduce((s: number, g: any) => s + (g.lng || 0), 0) / highGdelt.length;
      hotspots.push({
        lat: latAvg,
        lng: lngAvg,
        radius: 600,
        threatScore: Math.min(conflictEvents * 1.5, 10),
        description: `Conflict zone · ${conflictEvents} high-severity events`,
        categories: ['conflict', 'geopolitical'],
      });
    }
  }

  const anomalies: Anomaly[] = [];

  if (militaryFlightCount > flights.length * 0.15 && flights.length > 10) {
    anomalies.push({
      type: 'aviation',
      description: 'Unusually high proportion of military aircraft',
      deviation: `${((militaryFlightCount / flights.length) * 100).toFixed(1)}% military vs ~5% baseline`,
      affectedArea: 'Global airspace',
    });
  }

  if (criticalOutages > 2) {
    anomalies.push({
      type: 'infrastructure',
      description: 'Cluster of internet outages suggests coordinated attack or cascading failure',
      deviation: `${criticalOutages} simultaneous critical outages vs ~0-1 baseline`,
    });
  }

  if (majorQuakes > 2) {
    anomalies.push({
      type: 'seismic',
      description: 'Elevated seismic activity detected',
      deviation: `${majorQuakes} M5+ quakes in current window vs ~1-2 baseline`,
    });
  }

  const predictions: Prediction[] = [];

  if (militaryFlightCount > 5) {
    predictions.push({
      event: 'Military operation or exercise likely underway',
      probability: Math.min(militaryFlightCount * 8, 95),
      timeframe: '0-48 hours',
      impact: 'Regional escalation possible; monitor airspace closures',
    });
  }

  if (criticalCyber > 3) {
    predictions.push({
      event: 'Widespread ransomware campaign expected',
      probability: 75,
      timeframe: '1-14 days',
      impact: 'Critical infrastructure at risk; patch immediately',
    });
  }

  if (criticalOutages > 2) {
    predictions.push({
      event: 'Further internet disruptions in affected regions',
      probability: 60,
      timeframe: '0-72 hours',
      impact: 'Economic and communication disruption',
    });
  }

  const recommendations: string[] = [
    'Continue monitoring all OSINT feeds for escalation indicators',
    'Cross-reference military flight patterns with GDELT conflict data',
  ];

  if (criticalCyber > 0) {
    recommendations.push('Prioritize patching of CISA Known Exploited Vulnerabilities');
  }
  if (criticalOutages > 0) {
    recommendations.push('Activate backup communications for outage-affected regions');
  }
  if (militaryFlightCount > 5) {
    recommendations.push('Increase SIGINT collection in identified military aviation corridors');
  }
  if (conflictEvents > 3) {
    recommendations.push('Issue travel advisory for GDELT-identified conflict zones');
  }
  recommendations.push('Run SENTINEL-AI deep analysis with force refresh for updated assessment');

  return {
    threatLevel,
    confidence: 65,
    summary: `Threat level assessed at ${threatLevel}/10 based on heuristic analysis of ${flights.length} flights, ${cyberThreats.vulnerabilities?.length || 0} vulnerabilities, ${outages.length} outages, and ${gdelt.length} GDELT events. ${militaryFlightCount > 0 ? `${militaryFlightCount} military aircraft detected. ` : ''}${criticalCyber > 0 ? `${criticalCyber} critical cyber threats active. ` : ''}LLM analysis unavailable · using statistical fallback.`,
    keyFindings: keyFindings.slice(0, 5),
    hotspots,
    anomalies,
    predictions,
    recommendations,
    timestamp: Date.now(),
    dataCoverage: {
      flights: flights.length > 0,
      cameras: cameras.length > 0,
      cables: cables.length > 0,
      cyber: (cyberThreats.vulnerabilities?.length || 0) + (cyberThreats.botnetC2?.length || 0) > 0,
      earthquakes: earthquakes.length > 0,
      outages: outages.length > 0,
      fires: (fires.fires?.length || 0) + (fires.volcanoes?.length || 0) > 0,
      satellites: satellites.length > 0,
      gdelt: gdelt.length > 0,
    },
  };
}

export async function POST(request: NextRequest) {
  try {
    const force = request.nextUrl.searchParams.get('force') === 'true';

    if (!force && cachedAnalysis && Date.now() - cachedAnalysis.time < CACHE_TTL) {
      return NextResponse.json({
        source: 'SENTINEL-AI (cached)',
        ...cachedAnalysis.data,
      });
    }

    const rawData = await request.json();

    try {
      const zai = await ZAI.create();

      const dataSummary = {
        flightCount: rawData.flights?.length || 0,
        militaryFlights: rawData.flights?.filter((f: any) => f.isMilitary).length || 0,
        cameraCount: rawData.cameras?.length || 0,
        cableCount: rawData.cables?.length || 0,
        cyberVulnCount: rawData.cyberThreats?.vulnerabilities?.length || 0,
        cyberBotnetCount: rawData.cyberThreats?.botnetC2?.length || 0,
        cyberMalwareCount: rawData.cyberThreats?.malwareDist?.length || 0,
        earthquakeCount: rawData.earthquakes?.length || 0,
        majorQuakes: rawData.earthquakes?.filter((eq: any) => eq.magnitude >= 5).length || 0,
        outageCount: rawData.outages?.length || 0,
        criticalOutages: rawData.outages?.filter((o: any) => o.severity === 'critical' || o.severity === 'high').length || 0,
        fireCount: rawData.fires?.fires?.length || 0,
        volcanoCount: rawData.fires?.volcanoes?.length || 0,
        satelliteCount: rawData.satellites?.length || 0,
        militarySatellites: rawData.satellites?.filter((s: any) => s.classification === 'military').length || 0,
        gdeltEventCount: rawData.gdelt?.length || 0,
        gdeltCritical: rawData.gdelt?.filter((g: any) => g.severity === 'critical').length || 0,
        militaryFlightCoords: rawData.flights?.filter((f: any) => f.isMilitary).slice(0, 10).map((f: any) => ({ lat: f.latitude, lng: f.longitude, callsign: f.callsign, type: f.aircraftType })),
        outageCoords: rawData.outages?.slice(0, 10).map((o: any) => ({ lat: o.lat, lng: o.lng, country: o.countryName || o.country, severity: o.severity })),
        earthquakeCoords: rawData.earthquakes?.slice(0, 10).map((eq: any) => ({ lat: eq.lat, lng: eq.lng, mag: eq.magnitude, location: eq.location })),
        gdeltCoords: rawData.gdelt?.filter((g: any) => g.severity === 'high' || g.severity === 'critical').slice(0, 10).map((g: any) => ({ lat: g.lat, lng: g.lng, name: g.name, category: g.category, severity: g.severity })),
        cableOutages: rawData.cables?.filter((c: any) => c.status === 'outage').length || 0,
      };

      const completion = await zai.chat.completions.create({
        messages: [
          {
            role: 'system',
            content: `You are SENTINEL-AI, an advanced OSINT threat analysis system. Analyze the provided intelligence data and generate a structured threat assessment. Focus on: anomaly detection, pattern recognition, geographic correlations, temporal patterns, and predictive analysis. Output structured JSON.

Your response MUST be valid JSON matching this exact schema (no markdown, no code fences, just raw JSON):
{
  "threatLevel": <number 1-10>,
  "confidence": <number 0-100>,
  "summary": "<2-3 sentence executive summary>",
  "keyFindings": [
    {
      "severity": "critical|high|medium|low",
      "category": "<string>",
      "title": "<string>",
      "description": "<string>",
      "location": "<optional string>",
      "timestamp": "<optional ISO string>"
    }
  ],
  "hotspots": [
    {
      "lat": <number>,
      "lng": <number>,
      "radius": <number in km>,
      "threatScore": <number 1-10>,
      "description": "<string>",
      "categories": ["<string>"]
    }
  ],
  "anomalies": [
    {
      "type": "<string>",
      "description": "<string>",
      "deviation": "<string>",
      "affectedArea": "<optional string>"
    }
  ],
  "predictions": [
    {
      "event": "<string>",
      "probability": <number 0-100>,
      "timeframe": "<string>",
      "impact": "<string>"
    }
  ],
  "recommendations": ["<string>"]
}

Provide exactly 5 keyFindings, 3-5 hotspots, 2-4 anomalies, 2-3 predictions, and 4-6 recommendations.`,
          },
          {
            role: 'user',
            content: `Analyze the following OSINT intelligence data and provide a structured threat assessment:\n\n${JSON.stringify(dataSummary, null, 2)}`,
          },
        ],
        stream: false,
      });

      const content = completion?.choices?.[0]?.message?.content || '';
      const jsonStr = content.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '').trim();
      const llmResult = JSON.parse(jsonStr);

      const analysis: AIThreatAnalysis = {
        threatLevel: Math.min(Math.max(llmResult.threatLevel || 5, 1), 10),
        confidence: Math.min(Math.max(llmResult.confidence || 70, 0), 100),
        summary: llmResult.summary || 'Threat assessment completed by SENTINEL-AI.',
        keyFindings: (llmResult.keyFindings || []).slice(0, 5),
        hotspots: (llmResult.hotspots || []).slice(0, 5),
        anomalies: (llmResult.anomalies || []).slice(0, 5),
        predictions: (llmResult.predictions || []).slice(0, 5),
        recommendations: (llmResult.recommendations || []).slice(0, 8),
        timestamp: Date.now(),
        dataCoverage: {
          flights: (rawData.flights?.length || 0) > 0,
          cameras: (rawData.cameras?.length || 0) > 0,
          cables: (rawData.cables?.length || 0) > 0,
          cyber: (rawData.cyberThreats?.vulnerabilities?.length || 0) + (rawData.cyberThreats?.botnetC2?.length || 0) > 0,
          earthquakes: (rawData.earthquakes?.length || 0) > 0,
          outages: (rawData.outages?.length || 0) > 0,
          fires: (rawData.fires?.fires?.length || 0) + (rawData.fires?.volcanoes?.length || 0) > 0,
          satellites: (rawData.satellites?.length || 0) > 0,
          gdelt: (rawData.gdelt?.length || 0) > 0,
        },
      };

      cachedAnalysis = { time: Date.now(), data: analysis };

      return NextResponse.json({
        source: 'SENTINEL-AI (LLM)',
        ...analysis,
      });
    } catch (llmError: any) {
      console.error('[SENTINEL-AI] LLM analysis failed, falling back to heuristic:', llmError.message);

      const heuristicResult = generateHeuristicAnalysis(rawData);
      cachedAnalysis = { time: Date.now(), data: heuristicResult };

      return NextResponse.json({
        source: 'SENTINEL-AI (heuristic fallback · LLM unavailable)',
        ...heuristicResult,
      });
    }
  } catch (error: any) {
    console.error('[SENTINEL-AI] Analysis error:', error.message);

    return NextResponse.json({
      source: 'SENTINEL-AI',
      error: `Threat analysis failed: ${error.message}`,
      threatLevel: 0,
      confidence: 0,
      summary: 'Analysis failed · unable to process OSINT data.',
      keyFindings: [],
      hotspots: [],
      anomalies: [],
      predictions: [],
      recommendations: ['Retry analysis', 'Check data feed connectivity'],
      timestamp: Date.now(),
      dataCoverage: {
        flights: false,
        cameras: false,
        cables: false,
        cyber: false,
        earthquakes: false,
        outages: false,
        fires: false,
        satellites: false,
        gdelt: false,
      },
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const force = request.nextUrl.searchParams.get('force') === 'true';

  if (!force && cachedAnalysis && Date.now() - cachedAnalysis.time < CACHE_TTL) {
    return NextResponse.json({
      source: 'SENTINEL-AI (cached)',
      ...cachedAnalysis.data,
    });
  }

  return NextResponse.json({
    source: 'SENTINEL-AI',
    message: 'No cached analysis available. POST OSINT data to /api/osint/ai-analysis to generate a threat assessment.',
    timestamp: Date.now(),
  });
}
