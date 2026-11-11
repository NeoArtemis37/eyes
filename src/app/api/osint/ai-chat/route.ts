
import { NextRequest, NextResponse } from 'next/server';
import ZAI from 'z-ai-web-dev-sdk';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface ChatRequest {
  message: string;
  history: ChatMessage[];
  osintContext?: any;
}

const responseCache = new Map<string, { time: number; response: string }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function getCacheKey(message: string, osintContext?: any): string {
  const contextHash = osintContext
    ? JSON.stringify({
        flights: osintContext.flights?.length || 0,
        cameras: osintContext.cameras?.length || 0,
        cables: osintContext.cables?.length || 0,
        cyberVulns: osintContext.cyberThreats?.vulnerabilities?.length || 0,
        earthquakes: osintContext.earthquakes?.length || 0,
        outages: osintContext.outages?.length || 0,
        satellites: osintContext.satellites?.length || 0,
        gdelt: osintContext.gdelt?.length || 0,
        fofa: osintContext.fofa?.length || 0,
      })
    : 'no-context';
  return `${message.toLowerCase().trim()}::${contextHash}`;
}

function buildSystemPrompt(osintContext?: any): string {
  let prompt = `You are SENTINEL-AI, a tactical intelligence analyst embedded in the HORUS OSINT Command Center. You have real-time access to the following OSINT intelligence feeds:

- **Flights (ADS-B):** Real-time aircraft tracking including military flights, callsigns, altitudes, and flight paths
- **Cameras:** Global IP camera feeds with location and status data
- **Cables:** Submarine cable infrastructure with status (active/outage/repair)
- **Cyber Threats:** Vulnerability databases (CVE), botnet C2 servers, malware distribution sites, attack surface analysis
- **Earthquakes:** USGS seismic data with magnitude, depth, and location
- **Outages:** Global internet outage monitoring with affected countries and severity
- **Military:** Military aircraft, vessels, and installations tracking
- **Satellites:** Orbital tracking via SatNOGS including military and civilian satellites
- **GDELT Events:** Global conflict and crisis event monitoring from the GDELT Project
- **FOFA Devices:** IoT device search and network service enumeration
- **Network Topology:** BGP/AS topology and internet routing data

Your role is to:
1. Provide concise, actionable intelligence analysis
2. Identify patterns, correlations, and anomalies across data sources
3. Assess threat levels and geopolitical implications
4. Generate forecasts based on current data trends
5. Recommend specific actions and monitoring priorities

Communication style:
- Use military/intelligence briefing format when appropriate
- Include specific data points and coordinates when relevant
- Use threat severity terminology (CRITICAL, HIGH, MEDIUM, LOW)
- Reference specific OSINT feeds and data sources in your analysis
- Keep responses focused and actionable · avoid unnecessary verbosity
- Use structured formatting: headers (##), bullet points (-), and numbered lists when presenting analysis
- Timestamp references should use the current analysis window`;

  if (osintContext) {
    const summary = {
      flightCount: osintContext.flights?.length || 0,
      militaryFlights: osintContext.flights?.filter((f: any) => f.isMilitary || f.classification === 'military').length || 0,
      cameraCount: osintContext.cameras?.length || 0,
      cableCount: osintContext.cables?.length || 0,
      cableOutages: osintContext.cables?.filter((c: any) => c.status === 'outage').length || 0,
      cyberVulnCount: osintContext.cyberThreats?.vulnerabilities?.length || 0,
      cyberBotnetCount: osintContext.cyberThreats?.botnetC2?.length || 0,
      cyberMalwareCount: osintContext.cyberThreats?.malwareDist?.length || 0,
      earthquakeCount: osintContext.earthquakes?.length || 0,
      majorQuakes: osintContext.earthquakes?.filter((eq: any) => eq.magnitude >= 5).length || 0,
      outageCount: osintContext.outages?.length || 0,
      criticalOutages: osintContext.outages?.filter((o: any) => o.severity === 'critical' || o.severity === 'high').length || 0,
      fireCount: osintContext.fires?.fires?.length || 0,
      volcanoCount: osintContext.fires?.volcanoes?.length || 0,
      satelliteCount: osintContext.satellites?.length || 0,
      militarySatellites: osintContext.satellites?.filter((s: any) => s.classification === 'military').length || 0,
      gdeltEventCount: osintContext.gdelt?.length || 0,
      gdeltCritical: osintContext.gdelt?.filter((g: any) => g.severity === 'critical').length || 0,
      fofaDeviceCount: osintContext.fofa?.length || 0,
      militaryFlightSample: osintContext.flights?.filter((f: any) => f.isMilitary || f.classification === 'military').slice(0, 5).map((f: any) => ({
        callsign: f.callsign, type: f.aircraftType, lat: f.latitude, lng: f.longitude, alt: f.altitude, origin: f.originCountry,
      })),
      outageSample: osintContext.outages?.slice(0, 5).map((o: any) => ({
        country: o.countryName || o.country, severity: o.severity, lat: o.lat, lng: o.lng,
      })),
      earthquakeSample: osintContext.earthquakes?.slice(0, 5).map((eq: any) => ({
        location: eq.location, magnitude: eq.magnitude, depth: eq.depth, lat: eq.lat, lng: eq.lng,
      })),
      gdeltSample: osintContext.gdelt?.filter((g: any) => g.severity === 'high' || g.severity === 'critical').slice(0, 5).map((g: any) => ({
        name: g.name, category: g.category, severity: g.severity, lat: g.lat, lng: g.lng,
      })),
    };

    prompt += `\n\n## CURRENT INTELLIGENCE DATA\n\nYou are currently analyzing the following real-time OSINT data:\n\n${JSON.stringify(summary, null, 2)}\n\nReference this data when answering questions. If the user asks about specific events, cross-reference across available feeds.`;
  }

  return prompt;
}

function generateHeuristicResponse(message: string, osintContext?: any): string {
  const lower = message.toLowerCase();
  const data = osintContext || {};

  const flights = data.flights || [];
  const militaryFlights = flights.filter((f: any) => f.isMilitary || f.classification === 'military');
  const earthquakes = data.earthquakes || [];
  const majorQuakes = earthquakes.filter((eq: any) => eq.magnitude >= 5);
  const outages = data.outages || [];
  const criticalOutages = outages.filter((o: any) => o.severity === 'critical' || o.severity === 'high');
  const cyberThreats = data.cyberThreats || { vulnerabilities: [], botnetC2: [], malwareDist: [] };
  const gdelt = data.gdelt || [];
  const satellites = data.satellites || [];

  if (lower.includes('briefing') || lower.includes('situation') || lower.includes('sitrep') || lower.includes('overview')) {
    return `## SITUATION BRIEFING · ${new Date().toISOString().slice(0, 16)}Z

**OSINT Feed Status:** ${flights.length} flights tracked, ${militaryFlights.length} military aircraft, ${earthquakes.length} seismic events, ${outages.length} outage reports, ${gdelt.length} GDELT events

### Key Observations:
${militaryFlights.length > 0 ? `- **AVIATION:** ${militaryFlights.length} military aircraft detected · elevated military aviation activity\n` : ''}${majorQuakes.length > 0 ? `- **SEISMIC:** ${majorQuakes.length} major earthquakes (M5+) detected · potential infrastructure risk\n` : ''}${criticalOutages.length > 0 ? `- **INFRASTRUCTURE:** ${criticalOutages.length} critical internet outages · possible coordinated disruption\n` : ''}${(cyberThreats.vulnerabilities?.length || 0) > 0 ? `- **CYBER:** ${cyberThreats.vulnerabilities.length} active vulnerabilities tracked\n` : ''}${gdelt.length > 0 ? `- **GEOPOLITICAL:** ${gdelt.length} GDELT events monitored\n` : '- No significant anomalies detected across current feeds'}

### Threat Assessment:
Current threat level is assessed based on available OSINT feeds. ${militaryFlights.length > 5 || criticalOutages.length > 3 ? 'ELEVATED threat conditions detected.' : 'Standard monitoring posture recommended.'}

### Recommendations:
- Continue monitoring all active feeds
- Cross-reference military activity with GDELT conflict data
- Monitor outage patterns for escalation indicators

*Note: This briefing was generated using heuristic analysis. LLM analysis is currently unavailable.*`;
  }

  if (lower.includes('threat') || lower.includes('danger') || lower.includes('risk') || lower.includes('security')) {
    const threatAreas: string[] = [];
    if (militaryFlights.length > 3) threatAreas.push(`Military aviation: ${militaryFlights.length} aircraft detected`);
    if (criticalOutages.length > 0) threatAreas.push(`Infrastructure outages: ${criticalOutages.length} critical`);
    if (majorQuakes.length > 0) threatAreas.push(`Seismic activity: ${majorQuakes.length} M5+ earthquakes`);
    if ((cyberThreats.vulnerabilities?.length || 0) > 0) threatAreas.push(`Cyber vulnerabilities: ${cyberThreats.vulnerabilities.length} active`);

    return `## THREAT ASSESSMENT

**Threat Level:** ${threatAreas.length >= 3 ? 'HIGH' : threatAreas.length >= 1 ? 'ELEVATED' : 'LOW'}

### Active Threat Vectors:
${threatAreas.length > 0 ? threatAreas.map(t => `- ${t}`).join('\n') : '- No immediate threats identified from current OSINT feeds'}

### Analysis:
${threatAreas.length >= 3 ? 'Multiple threat vectors detected. Recommend heightened monitoring posture and proactive intelligence collection.' : 'Current threat landscape within normal parameters. Continue standard monitoring protocols.'}

*Heuristic assessment · LLM analysis unavailable*`;
  }

  if (lower.includes('anomal') || lower.includes('unusual') || lower.includes('abnormal') || lower.includes('pattern')) {
    const anomalies: string[] = [];
    if (militaryFlights.length > flights.length * 0.15 && flights.length > 10) {
      anomalies.push(`Unusually high military flight ratio: ${((militaryFlights.length / flights.length) * 100).toFixed(1)}% vs ~5% baseline`);
    }
    if (criticalOutages.length > 2) {
      anomalies.push(`Cluster of ${criticalOutages.length} critical outages · possible coordinated attack pattern`);
    }
    if (majorQuakes.length > 2) {
      anomalies.push(`Elevated seismic activity: ${majorQuakes.length} M5+ quakes in current window`);
    }

    return `## ANOMALY ANALYSIS

${anomalies.length > 0
      ? `### Detected Anomalies:\n${anomalies.map(a => `- **${a}**`).join('\n')}\n\n### Assessment:\nAnomalous patterns identified across OSINT feeds. Recommend focused analysis on identified deviations.`
      : '### No significant anomalies detected\n\nCurrent OSINT data patterns are within expected parameters. All feeds showing normal distribution and activity levels.'}

*Heuristic analysis · LLM unavailable*`;
  }

  if (lower.includes('forecast') || lower.includes('predict') || lower.includes('future') || lower.includes('geopolitic')) {
    return `## GEOPOLITICAL FORECAST

### Short-term (0-48h):
${militaryFlights.length > 5 ? '- HIGH probability of ongoing military operations or exercises\n' : ''}${criticalOutages.length > 2 ? '- MEDIUM probability of further internet disruptions\n' : '- Standard monitoring · no elevated indicators'}

### Medium-term (3-14 days):
${(cyberThreats.vulnerabilities?.length || 0) > 3 ? '- Active exploitation campaigns likely to continue\n' : ''}${gdelt.length > 5 ? '- Geopolitical tensions in GDELT-monitored regions may escalate\n' : '- Stable conditions expected'}

### Key Indicators to Watch:
- Military flight pattern changes
- Outage cluster expansion
- GDELT event frequency and severity shifts
- Cyber threat landscape evolution

*Heuristic forecast · LLM unavailable*`;
  }

  return `## SENTINEL-AI RESPONSE

I've analyzed your query against available OSINT feeds. Current data overview:

- **Flights:** ${flights.length} tracked (${militaryFlights.length} military)
- **Seismic:** ${earthquakes.length} events (${majorQuakes.length} M5+)
- **Outages:** ${outages.length} reports (${criticalOutages.length} critical)
- **Cyber:** ${cyberThreats.vulnerabilities?.length || 0} vulnerabilities
- **GDELT:** ${gdelt.length} events
- **Satellites:** ${satellites.length} tracked

For more detailed analysis, try asking about:
- Situation briefing
- Threat assessment
- Anomaly analysis
- Geopolitical forecast

*Heuristic response · LLM analysis unavailable*`;
}

export async function POST(request: NextRequest) {
  try {
    const body: ChatRequest = await request.json();
    const { message, history, osintContext } = body;

    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      );
    }

    const cacheKey = getCacheKey(message, osintContext);
    const cached = responseCache.get(cacheKey);
    if (cached && Date.now() - cached.time < CACHE_TTL) {
      return NextResponse.json({
        response: cached.response,
        timestamp: cached.time,
        cached: true,
      });
    }

    try {
      const zai = await ZAI.create();
      const systemPrompt = buildSystemPrompt(osintContext);

      const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
        { role: 'system', content: systemPrompt },
      ];

      const recentHistory = (history || []).slice(-20);
      for (const msg of recentHistory) {
        messages.push({
          role: msg.role,
          content: msg.content,
        });
      }

      messages.push({ role: 'user', content: message });

      const completion = await zai.chat.completions.create({
        messages,
        stream: false,
      });

      const response = completion?.choices?.[0]?.message?.content || 'Unable to generate analysis. Please retry.';

      responseCache.set(cacheKey, { time: Date.now(), response });

      if (responseCache.size > 100) {
        const oldestKey = responseCache.keys().next().value;
        if (oldestKey) responseCache.delete(oldestKey);
      }

      return NextResponse.json({
        response,
        timestamp: Date.now(),
      });
    } catch (llmError: any) {
      console.error('[SENTINEL-AI CHAT] LLM failed, using heuristic fallback:', llmError.message);

      const heuristicResponse = generateHeuristicResponse(message, osintContext);

      return NextResponse.json({
        response: heuristicResponse,
        timestamp: Date.now(),
        fallback: true,
      });
    }
  } catch (error: any) {
    console.error('[SENTINEL-AI CHAT] Error:', error.message);

    return NextResponse.json(
      {
        error: `Chat analysis failed: ${error.message}`,
        response: 'SENTINEL-AI is currently offline. Unable to process your query.',
        timestamp: Date.now(),
      },
      { status: 500 }
    );
  }
}
