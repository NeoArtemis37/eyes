
import { NextResponse } from 'next/server';
import { stealthFetchJSON } from '@/lib/stealthFetch';

let cachedData: { time: number; data: any[] } | null = null;
const CACHE_TTL = 600000; // 10 minutes

const COUNTRY_CENTROIDS: Record<string, { lat: number; lng: number; name: string }> = {
  'AF': { lat: 33.94, lng: 67.71, name: 'Afghanistan' },
  'AL': { lat: 41.15, lng: 20.17, name: 'Albania' },
  'DZ': { lat: 28.03, lng: 1.66, name: 'Algeria' },
  'AR': { lat: -38.42, lng: -63.62, name: 'Argentina' },
  'AU': { lat: -25.27, lng: 133.78, name: 'Australia' },
  'BD': { lat: 23.68, lng: 90.36, name: 'Bangladesh' },
  'BY': { lat: 53.71, lng: 27.95, name: 'Belarus' },
  'BO': { lat: -16.29, lng: -63.59, name: 'Bolivia' },
  'BR': { lat: -14.24, lng: -51.93, name: 'Brazil' },
  'KH': { lat: 12.57, lng: 104.99, name: 'Cambodia' },
  'CM': { lat: 7.37, lng: 12.35, name: 'Cameroon' },
  'CA': { lat: 56.13, lng: -106.35, name: 'Canada' },
  'CF': { lat: 6.61, lng: 20.94, name: 'Central African Republic' },
  'TD': { lat: 15.45, lng: 18.73, name: 'Chad' },
  'CL': { lat: -35.68, lng: -71.54, name: 'Chile' },
  'CN': { lat: 35.86, lng: 104.20, name: 'China' },
  'CO': { lat: 4.57, lng: -74.30, name: 'Colombia' },
  'CD': { lat: -4.04, lng: 21.76, name: 'DR Congo' },
  'CU': { lat: 21.52, lng: -77.78, name: 'Cuba' },
  'EG': { lat: 26.82, lng: 30.80, name: 'Egypt' },
  'ET': { lat: 9.15, lng: 40.49, name: 'Ethiopia' },
  'FR': { lat: 46.23, lng: 2.21, name: 'France' },
  'DE': { lat: 51.17, lng: 10.45, name: 'Germany' },
  'GH': { lat: 7.95, lng: -1.02, name: 'Ghana' },
  'GR': { lat: 39.07, lng: 21.82, name: 'Greece' },
  'IN': { lat: 20.59, lng: 78.96, name: 'India' },
  'ID': { lat: -0.79, lng: 113.92, name: 'Indonesia' },
  'IR': { lat: 32.43, lng: 53.69, name: 'Iran' },
  'IQ': { lat: 33.22, lng: 43.68, name: 'Iraq' },
  'IL': { lat: 31.05, lng: 34.85, name: 'Israel' },
  'IT': { lat: 41.87, lng: 12.57, name: 'Italy' },
  'JP': { lat: 36.20, lng: 138.25, name: 'Japan' },
  'JO': { lat: 30.59, lng: 36.24, name: 'Jordan' },
  'KZ': { lat: 48.02, lng: 66.92, name: 'Kazakhstan' },
  'KE': { lat: -0.02, lng: 37.91, name: 'Kenya' },
  'KW': { lat: 29.31, lng: 47.48, name: 'Kuwait' },
  'KG': { lat: 41.20, lng: 74.77, name: 'Kyrgyzstan' },
  'LB': { lat: 33.85, lng: 35.86, name: 'Lebanon' },
  'LY': { lat: 26.34, lng: 17.23, name: 'Libya' },
  'MY': { lat: 4.21, lng: 101.98, name: 'Malaysia' },
  'ML': { lat: 17.57, lng: -4.00, name: 'Mali' },
  'MX': { lat: 23.63, lng: -102.55, name: 'Mexico' },
  'MM': { lat: 21.91, lng: 95.96, name: 'Myanmar' },
  'NP': { lat: 28.39, lng: 84.12, name: 'Nepal' },
  'NG': { lat: 9.08, lng: 8.68, name: 'Nigeria' },
  'KP': { lat: 40.34, lng: 127.51, name: 'North Korea' },
  'PK': { lat: 30.38, lng: 69.35, name: 'Pakistan' },
  'PS': { lat: 31.95, lng: 35.23, name: 'Palestine' },
  'PE': { lat: -9.19, lng: -75.02, name: 'Peru' },
  'PH': { lat: 12.88, lng: 121.77, name: 'Philippines' },
  'PL': { lat: 51.92, lng: 19.15, name: 'Poland' },
  'RO': { lat: 45.94, lng: 24.97, name: 'Romania' },
  'RU': { lat: 61.52, lng: 105.32, name: 'Russia' },
  'SA': { lat: 23.89, lng: 45.08, name: 'Saudi Arabia' },
  'SN': { lat: 14.50, lng: -14.45, name: 'Senegal' },
  'SO': { lat: 5.15, lng: 46.20, name: 'Somalia' },
  'ZA': { lat: -30.56, lng: 22.94, name: 'South Africa' },
  'KR': { lat: 35.91, lng: 127.77, name: 'South Korea' },
  'ES': { lat: 40.46, lng: -3.75, name: 'Spain' },
  'SD': { lat: 12.86, lng: 30.22, name: 'Sudan' },
  'SY': { lat: 34.80, lng: 39.00, name: 'Syria' },
  'TZ': { lat: -6.37, lng: 34.89, name: 'Tanzania' },
  'TH': { lat: 15.87, lng: 100.99, name: 'Thailand' },
  'TN': { lat: 33.89, lng: 9.54, name: 'Tunisia' },
  'TR': { lat: 38.96, lng: 35.24, name: 'Turkey' },
  'TM': { lat: 38.97, lng: 59.56, name: 'Turkmenistan' },
  'UG': { lat: 1.37, lng: 32.29, name: 'Uganda' },
  'UA': { lat: 48.38, lng: 31.17, name: 'Ukraine' },
  'AE': { lat: 23.42, lng: 53.85, name: 'UAE' },
  'GB': { lat: 55.38, lng: -3.44, name: 'United Kingdom' },
  'US': { lat: 39.83, lng: -98.58, name: 'United States' },
  'UZ': { lat: 41.38, lng: 64.59, name: 'Uzbekistan' },
  'VE': { lat: 6.42, lng: -66.59, name: 'Venezuela' },
  'VN': { lat: 14.06, lng: 108.28, name: 'Vietnam' },
  'YE': { lat: 15.55, lng: 48.52, name: 'Yemen' },
  'ZM': { lat: -13.13, lng: 27.85, name: 'Zambia' },
  'ZW': { lat: -19.02, lng: 29.15, name: 'Zimbabwe' },
};

export async function GET() {
  try {
    if (cachedData && Date.now() - cachedData.time < CACHE_TTL) {
      return NextResponse.json({
        source: 'Georgia Tech IODA (cached)',
        timestamp: cachedData.time,
        count: cachedData.data.length,
        outages: cachedData.data,
      });
    }

    const now = Math.floor(Date.now() / 1000);
    const from = now - 86400;

    const data = await stealthFetchJSON<{
      data: Array<{
        entity: { name: string; type: string; code: string };
        start: number;
        duration: number;
        score: number;
        datasource_scores: Array<{ datasource: string; score: number }>;
      }>;
    }>(`https://api.ioda.inetintel.cc.gatech.edu/v2/outages/events?from=${from}&until=${now}&entityType=country&limit=200`, {
      timeout: 12000,
    });

    if (!data.data || data.data.length === 0) {
      throw new Error('No outage data returned');
    }

    const outages = data.data
      .map((event: any) => {
        const countryCode = event.entity?.code?.replace('country/', '') || '';
        const centroid = COUNTRY_CENTROIDS[countryCode];
        if (!centroid) return null;

        const jitterLat = (Math.random() - 0.5) * 2;
        const jitterLng = (Math.random() - 0.5) * 2;

        const score = event.score || 0;
        let severity: 'low' | 'medium' | 'high' | 'critical';
        if (score > 80) severity = 'critical';
        else if (score > 50) severity = 'high';
        else if (score > 20) severity = 'medium';
        else severity = 'low';

        return {
          id: `OUTAGE-${countryCode}-${event.start}`,
          country: countryCode,
          countryName: centroid.name,
          lat: centroid.lat + jitterLat,
          lng: centroid.lng + jitterLng,
          start: event.start,
          duration: event.duration,
          score,
          severity,
          datasources: (event.datasource_scores || []).map((ds: any) => ({
            source: ds.datasource,
            score: ds.score,
          })),
        };
      })
      .filter(Boolean);

    cachedData = { time: Date.now(), data: outages };

    return NextResponse.json({
      source: 'Georgia Tech IODA',
      timestamp: Date.now(),
      count: outages.length,
      outages,
    });
  } catch (error: any) {
    console.error('[Outages] IODA error:', error.message);

    if (cachedData) {
      return NextResponse.json({
        source: 'Georgia Tech IODA (cached · API unavailable)',
        timestamp: cachedData.time,
        count: cachedData.data.length,
        outages: cachedData.data,
        error: error.message,
      });
    }

    return NextResponse.json({
      source: 'Georgia Tech IODA',
      timestamp: Date.now(),
      count: 0,
      outages: [],
      error: `Failed to fetch outage data: ${error.message}`,
    }, { status: 503 });
  }
}
