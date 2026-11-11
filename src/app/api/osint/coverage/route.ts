
import { NextRequest, NextResponse } from 'next/server';

interface CellTower {
  id: string;
  operator: string;
  lat: number;
  lng: number;
  type: string;
  power: number;
  range: number;
  frequency: string;
  status: 'active' | 'maintenance';
  height?: number;
  sector?: string;
  bandwidth?: string;
  mimo?: string;
}

const TOWER_DATABASE: CellTower[] = [
  { id: 'US-NY-001', operator: 'Verizon', lat: 40.7128, lng: -74.0060, type: '5G NR', power: 46, range: 1.5, frequency: '28 GHz', status: 'active', height: 30, sector: '3-sector', bandwidth: '100 MHz', mimo: '4x4' },
  { id: 'US-NY-002', operator: 'AT&T', lat: 40.7580, lng: -73.9855, type: '5G NR', power: 43, range: 2.0, frequency: '3.5 GHz', status: 'active', height: 25, sector: '3-sector', bandwidth: '80 MHz', mimo: '4x4' },
  { id: 'US-NY-003', operator: 'T-Mobile', lat: 40.7484, lng: -73.9857, type: '5G NR', power: 44, range: 1.8, frequency: '2.5 GHz', status: 'active', height: 28, sector: '3-sector', bandwidth: '100 MHz', mimo: '8x8' },
  { id: 'US-NY-004', operator: 'Verizon', lat: 40.7061, lng: -74.0087, type: '4G LTE', power: 46, range: 5.0, frequency: '700 MHz', status: 'active', height: 35, sector: '3-sector', bandwidth: '20 MHz', mimo: '2x2' },
  { id: 'US-NY-005', operator: 'AT&T', lat: 40.7831, lng: -73.9712, type: '4G LTE', power: 43, range: 4.5, frequency: '1.7 GHz', status: 'active', height: 30, sector: '3-sector', bandwidth: '15 MHz', mimo: '2x2' },
  { id: 'US-NY-006', operator: 'T-Mobile', lat: 40.7282, lng: -73.7949, type: '3G UMTS', power: 43, range: 8.0, frequency: '1.9 GHz', status: 'active', height: 40, sector: '3-sector', bandwidth: '5 MHz', mimo: '1x1' },
  { id: 'US-NY-007', operator: 'Verizon', lat: 40.6892, lng: -74.0445, type: '5G NR', power: 44, range: 1.2, frequency: '28 GHz', status: 'active', height: 22, sector: '3-sector', bandwidth: '100 MHz', mimo: '4x4' },
  { id: 'US-LA-001', operator: 'Verizon', lat: 34.0522, lng: -118.2437, type: '5G NR', power: 46, range: 1.5, frequency: '28 GHz', status: 'active', height: 30, sector: '3-sector', bandwidth: '100 MHz', mimo: '4x4' },
  { id: 'US-LA-002', operator: 'T-Mobile', lat: 34.0195, lng: -118.4912, type: '5G NR', power: 43, range: 2.5, frequency: '2.5 GHz', status: 'active', height: 28, sector: '3-sector', bandwidth: '100 MHz', mimo: '8x8' },
  { id: 'US-LA-003', operator: 'AT&T', lat: 34.0689, lng: -118.3451, type: '4G LTE', power: 46, range: 5.0, frequency: '700 MHz', status: 'active', height: 35, sector: '3-sector', bandwidth: '20 MHz', mimo: '2x2' },
  { id: 'US-CH-001', operator: 'AT&T', lat: 41.8781, lng: -87.6298, type: '5G NR', power: 43, range: 2.0, frequency: '3.5 GHz', status: 'active', height: 25, sector: '3-sector', bandwidth: '80 MHz', mimo: '4x4' },
  { id: 'US-CH-002', operator: 'Verizon', lat: 41.8827, lng: -87.6233, type: '5G NR', power: 46, range: 1.2, frequency: '28 GHz', status: 'active', height: 30, sector: '3-sector', bandwidth: '100 MHz', mimo: '4x4' },
  { id: 'US-HO-001', operator: 'T-Mobile', lat: 29.7604, lng: -95.3698, type: '4G LTE', power: 46, range: 5.0, frequency: '700 MHz', status: 'active', height: 35, sector: '3-sector', bandwidth: '20 MHz', mimo: '2x2' },
  { id: 'US-HO-002', operator: 'AT&T', lat: 29.7496, lng: -95.3956, type: '5G NR', power: 43, range: 2.0, frequency: '3.5 GHz', status: 'active', height: 25, sector: '3-sector', bandwidth: '80 MHz', mimo: '4x4' },

  { id: 'UK-LN-001', operator: 'EE/BT', lat: 51.5074, lng: -0.1278, type: '5G NR', power: 44, range: 1.5, frequency: '3.5 GHz', status: 'active', height: 25, sector: '3-sector', bandwidth: '80 MHz', mimo: '4x4' },
  { id: 'UK-LN-002', operator: 'Three UK', lat: 51.5014, lng: -0.1419, type: '5G NR', power: 43, range: 2.0, frequency: '3.5 GHz', status: 'active', height: 22, sector: '3-sector', bandwidth: '100 MHz', mimo: '4x4' },
  { id: 'UK-LN-003', operator: 'Vodafone UK', lat: 51.5155, lng: -0.1417, type: '4G LTE', power: 46, range: 5.0, frequency: '800 MHz', status: 'active', height: 30, sector: '3-sector', bandwidth: '15 MHz', mimo: '2x2' },
  { id: 'UK-LN-004', operator: 'O2/VM', lat: 51.4950, lng: -0.1450, type: '4G LTE', power: 43, range: 4.5, frequency: '1.8 GHz', status: 'active', height: 28, sector: '3-sector', bandwidth: '10 MHz', mimo: '2x2' },
  { id: 'UK-LN-005', operator: 'EE/BT', lat: 51.5225, lng: -0.1553, type: '5G NR', power: 44, range: 1.2, frequency: '3.5 GHz', status: 'active', height: 20, sector: '3-sector', bandwidth: '80 MHz', mimo: '4x4' },

  { id: 'FR-PR-001', operator: 'Orange', lat: 48.8566, lng: 2.3522, type: '5G NR', power: 44, range: 1.5, frequency: '3.5 GHz', status: 'active', height: 25, sector: '3-sector', bandwidth: '80 MHz', mimo: '4x4' },
  { id: 'FR-PR-002', operator: 'SFR', lat: 48.8738, lng: 2.2950, type: '5G NR', power: 43, range: 2.0, frequency: '3.5 GHz', status: 'active', height: 22, sector: '3-sector', bandwidth: '80 MHz', mimo: '4x4' },
  { id: 'FR-PR-003', operator: 'Bouygues', lat: 48.8867, lng: 2.3431, type: '4G LTE', power: 46, range: 5.0, frequency: '800 MHz', status: 'active', height: 30, sector: '3-sector', bandwidth: '15 MHz', mimo: '2x2' },
  { id: 'FR-PR-004', operator: 'Free Mobile', lat: 48.8462, lng: 2.3464, type: '4G LTE', power: 43, range: 4.0, frequency: '1.8 GHz', status: 'active', height: 28, sector: '3-sector', bandwidth: '10 MHz', mimo: '2x2' },
  { id: 'FR-PR-005', operator: 'Orange', lat: 48.8584, lng: 2.2945, type: '5G NR', power: 44, range: 1.2, frequency: '3.5 GHz', status: 'active', height: 20, sector: '3-sector', bandwidth: '80 MHz', mimo: '4x4' },

  { id: 'DE-BR-001', operator: 'Telekom', lat: 52.5200, lng: 13.4050, type: '5G NR', power: 44, range: 2.0, frequency: '3.5 GHz', status: 'active', height: 25, sector: '3-sector', bandwidth: '80 MHz', mimo: '4x4' },
  { id: 'DE-BR-002', operator: 'Vodafone DE', lat: 52.5076, lng: 13.3456, type: '5G NR', power: 43, range: 1.8, frequency: '3.5 GHz', status: 'active', height: 22, sector: '3-sector', bandwidth: '80 MHz', mimo: '4x4' },
  { id: 'DE-BR-003', operator: 'O2/Telefonica', lat: 52.5340, lng: 13.3880, type: '4G LTE', power: 46, range: 5.0, frequency: '800 MHz', status: 'active', height: 30, sector: '3-sector', bandwidth: '15 MHz', mimo: '2x2' },

  { id: 'JP-TK-001', operator: 'NTT Docomo', lat: 35.6762, lng: 139.6503, type: '5G NR', power: 44, range: 1.5, frequency: '3.5 GHz', status: 'active', height: 25, sector: '3-sector', bandwidth: '100 MHz', mimo: '8x8' },
  { id: 'JP-TK-002', operator: 'SoftBank', lat: 35.6586, lng: 139.7454, type: '5G NR', power: 43, range: 1.8, frequency: '3.5 GHz', status: 'active', height: 22, sector: '3-sector', bandwidth: '80 MHz', mimo: '4x4' },
  { id: 'JP-TK-003', operator: 'KDDI/au', lat: 35.6895, lng: 139.6917, type: '5G NR', power: 44, range: 1.2, frequency: '28 GHz', status: 'active', height: 30, sector: '3-sector', bandwidth: '100 MHz', mimo: '4x4' },
  { id: 'JP-TK-004', operator: 'Rakuten', lat: 35.6528, lng: 139.7177, type: '4G LTE', power: 43, range: 4.0, frequency: '1.7 GHz', status: 'active', height: 28, sector: '3-sector', bandwidth: '20 MHz', mimo: '4x4' },

  { id: 'KR-SE-001', operator: 'SK Telecom', lat: 37.5665, lng: 126.9780, type: '5G NR', power: 44, range: 1.5, frequency: '3.5 GHz', status: 'active', height: 25, sector: '3-sector', bandwidth: '100 MHz', mimo: '8x8' },
  { id: 'KR-SE-002', operator: 'KT', lat: 37.5663, lng: 126.9779, type: '5G NR', power: 44, range: 1.8, frequency: '3.5 GHz', status: 'active', height: 22, sector: '3-sector', bandwidth: '80 MHz', mimo: '4x4' },
  { id: 'KR-SE-003', operator: 'LG U+', lat: 37.5735, lng: 126.9688, type: '5G NR', power: 43, range: 2.0, frequency: '3.5 GHz', status: 'active', height: 28, sector: '3-sector', bandwidth: '80 MHz', mimo: '4x4' },

  { id: 'CN-BJ-001', operator: 'China Mobile', lat: 39.9042, lng: 116.4074, type: '5G NR', power: 44, range: 2.0, frequency: '2.6 GHz', status: 'active', height: 30, sector: '3-sector', bandwidth: '100 MHz', mimo: '64T64R' },
  { id: 'CN-BJ-002', operator: 'China Telecom', lat: 39.9142, lng: 116.3914, type: '5G NR', power: 44, range: 1.8, frequency: '3.5 GHz', status: 'active', height: 25, sector: '3-sector', bandwidth: '100 MHz', mimo: '64T64R' },
  { id: 'CN-SH-001', operator: 'China Mobile', lat: 31.2304, lng: 121.4737, type: '5G NR', power: 44, range: 2.0, frequency: '2.6 GHz', status: 'active', height: 28, sector: '3-sector', bandwidth: '100 MHz', mimo: '64T64R' },

  { id: 'AE-DB-001', operator: 'Etisalat', lat: 25.2048, lng: 55.2708, type: '5G NR', power: 44, range: 1.5, frequency: '3.5 GHz', status: 'active', height: 25, sector: '3-sector', bandwidth: '100 MHz', mimo: '4x4' },
  { id: 'AE-DB-002', operator: 'du', lat: 25.1972, lng: 55.2744, type: '5G NR', power: 43, range: 2.0, frequency: '3.5 GHz', status: 'active', height: 22, sector: '3-sector', bandwidth: '80 MHz', mimo: '4x4' },

  { id: 'SG-001', operator: 'Singtel', lat: 1.3521, lng: 103.8198, type: '5G NR', power: 44, range: 1.5, frequency: '3.5 GHz', status: 'active', height: 25, sector: '3-sector', bandwidth: '100 MHz', mimo: '4x4' },

  { id: 'AU-SY-001', operator: 'Telstra', lat: -33.8688, lng: 151.2093, type: '5G NR', power: 44, range: 2.0, frequency: '3.5 GHz', status: 'active', height: 25, sector: '3-sector', bandwidth: '80 MHz', mimo: '4x4' },

  { id: 'BR-SP-001', operator: 'Claro', lat: -23.5505, lng: -46.6333, type: '5G NR', power: 44, range: 2.0, frequency: '3.5 GHz', status: 'active', height: 25, sector: '3-sector', bandwidth: '80 MHz', mimo: '4x4' },
  { id: 'BR-SP-002', operator: 'Vivo', lat: -23.5631, lng: -46.6544, type: '4G LTE', power: 46, range: 5.0, frequency: '700 MHz', status: 'active', height: 30, sector: '3-sector', bandwidth: '15 MHz', mimo: '2x2' },

  { id: 'IN-DEL-001', operator: 'Jio', lat: 28.6139, lng: 77.2090, type: '5G NR', power: 44, range: 2.0, frequency: '3.5 GHz', status: 'active', height: 25, sector: '3-sector', bandwidth: '100 MHz', mimo: '4x4' },
  { id: 'IN-DEL-002', operator: 'Airtel', lat: 28.6280, lng: 77.2168, type: '5G NR', power: 43, range: 1.8, frequency: '3.5 GHz', status: 'active', height: 22, sector: '3-sector', bandwidth: '80 MHz', mimo: '4x4' },
  { id: 'IN-MUM-001', operator: 'Jio', lat: 19.0760, lng: 72.8777, type: '5G NR', power: 44, range: 2.0, frequency: '3.5 GHz', status: 'active', height: 25, sector: '3-sector', bandwidth: '100 MHz', mimo: '4x4' },

  { id: 'RU-MOW-001', operator: 'MTS', lat: 55.7558, lng: 37.6173, type: '4G LTE', power: 46, range: 5.0, frequency: '800 MHz', status: 'active', height: 30, sector: '3-sector', bandwidth: '15 MHz', mimo: '2x2' },
  { id: 'RU-MOW-002', operator: 'MegaFon', lat: 55.7746, lng: 37.6188, type: '4G LTE', power: 43, range: 4.5, frequency: '1.8 GHz', status: 'active', height: 28, sector: '3-sector', bandwidth: '10 MHz', mimo: '2x2' },
  { id: 'RU-MOW-003', operator: 'Beeline', lat: 55.7415, lng: 37.6156, type: '3G UMTS', power: 43, range: 7.0, frequency: '2.1 GHz', status: 'active', height: 32, sector: '3-sector', bandwidth: '5 MHz', mimo: '1x1' },
  { id: 'UA-KV-001', operator: 'Kyivstar', lat: 50.4501, lng: 30.5234, type: '4G LTE', power: 46, range: 5.0, frequency: '800 MHz', status: 'active', height: 30, sector: '3-sector', bandwidth: '15 MHz', mimo: '2x2' },
  { id: 'UA-KV-002', operator: 'Vodafone UA', lat: 50.4522, lng: 30.5144, type: '4G LTE', power: 43, range: 4.5, frequency: '1.8 GHz', status: 'active', height: 28, sector: '3-sector', bandwidth: '10 MHz', mimo: '2x2' },
  { id: 'UA-KV-003', operator: 'Lifecell', lat: 50.4652, lng: 30.5039, type: '3G UMTS', power: 43, range: 7.0, frequency: '2.1 GHz', status: 'active', height: 32, sector: '3-sector', bandwidth: '5 MHz', mimo: '1x1' },
  { id: 'UA-KV-004', operator: 'Kyivstar', lat: 50.4270, lng: 30.5326, type: '5G NR', power: 44, range: 1.5, frequency: '3.5 GHz', status: 'active', height: 25, sector: '3-sector', bandwidth: '80 MHz', mimo: '4x4' },

  { id: 'IT-RM-001', operator: 'TIM', lat: 41.9028, lng: 12.4964, type: '5G NR', power: 44, range: 1.5, frequency: '3.5 GHz', status: 'active', height: 25, sector: '3-sector', bandwidth: '80 MHz', mimo: '4x4' },
  { id: 'ES-MD-001', operator: 'Movistar', lat: 40.4168, lng: -3.7038, type: '5G NR', power: 44, range: 2.0, frequency: '3.5 GHz', status: 'active', height: 25, sector: '3-sector', bandwidth: '80 MHz', mimo: '4x4' },
  { id: 'PT-LI-001', operator: 'NOS', lat: 38.7223, lng: -9.1393, type: '5G NR', power: 44, range: 1.5, frequency: '3.5 GHz', status: 'active', height: 25, sector: '3-sector', bandwidth: '80 MHz', mimo: '4x4' },

  { id: 'SE-ST-001', operator: 'Telia', lat: 59.3293, lng: 18.0686, type: '5G NR', power: 44, range: 1.5, frequency: '3.5 GHz', status: 'active', height: 25, sector: '3-sector', bandwidth: '80 MHz', mimo: '4x4' },
  { id: 'FI-HE-001', operator: 'Elisa', lat: 60.1699, lng: 24.9384, type: '5G NR', power: 44, range: 1.5, frequency: '3.5 GHz', status: 'active', height: 25, sector: '3-sector', bandwidth: '80 MHz', mimo: '4x4' },
  { id: 'NO-OS-001', operator: 'Telenor', lat: 59.9139, lng: 10.7522, type: '5G NR', power: 44, range: 1.8, frequency: '3.5 GHz', status: 'active', height: 25, sector: '3-sector', bandwidth: '80 MHz', mimo: '4x4' },
  { id: 'DK-CP-001', operator: 'TDC', lat: 55.6761, lng: 12.5683, type: '5G NR', power: 44, range: 1.5, frequency: '3.5 GHz', status: 'active', height: 25, sector: '3-sector', bandwidth: '100 MHz', mimo: '4x4' },

  { id: 'PL-WW-001', operator: 'Orange PL', lat: 52.2297, lng: 21.0122, type: '5G NR', power: 44, range: 1.8, frequency: '3.5 GHz', status: 'active', height: 25, sector: '3-sector', bandwidth: '80 MHz', mimo: '4x4' },
  { id: 'CZ-PR-001', operator: 'O2 CZ', lat: 50.0755, lng: 14.4378, type: '5G NR', power: 44, range: 1.5, frequency: '3.5 GHz', status: 'active', height: 25, sector: '3-sector', bandwidth: '80 MHz', mimo: '4x4' },
  { id: 'RO-BU-001', operator: 'Orange RO', lat: 44.4268, lng: 26.1025, type: '5G NR', power: 44, range: 1.5, frequency: '3.5 GHz', status: 'active', height: 25, sector: '3-sector', bandwidth: '80 MHz', mimo: '4x4' },
  { id: 'BG-SO-001', operator: 'A1 BG', lat: 42.6977, lng: 23.3219, type: '5G NR', power: 44, range: 1.5, frequency: '3.5 GHz', status: 'active', height: 25, sector: '3-sector', bandwidth: '80 MHz', mimo: '4x4' },
  { id: 'HU-BU-001', operator: 'Magyar Telekom', lat: 47.4979, lng: 19.0402, type: '5G NR', power: 44, range: 1.5, frequency: '3.5 GHz', status: 'active', height: 25, sector: '3-sector', bandwidth: '80 MHz', mimo: '4x4' },
  { id: 'AT-VI-001', operator: 'A1 AT', lat: 48.2082, lng: 16.3738, type: '5G NR', power: 44, range: 1.5, frequency: '3.5 GHz', status: 'active', height: 25, sector: '3-sector', bandwidth: '80 MHz', mimo: '4x4' },
  { id: 'GR-AT-001', operator: 'Cosmote', lat: 37.9838, lng: 23.7275, type: '5G NR', power: 44, range: 1.5, frequency: '3.5 GHz', status: 'active', height: 25, sector: '3-sector', bandwidth: '80 MHz', mimo: '4x4' },

  { id: 'SA-RY-001', operator: 'STC', lat: 24.7136, lng: 46.6753, type: '5G NR', power: 44, range: 2.0, frequency: '3.5 GHz', status: 'active', height: 25, sector: '3-sector', bandwidth: '100 MHz', mimo: '4x4' },
  { id: 'TR-IST-001', operator: 'Turkcell', lat: 41.0082, lng: 28.9784, type: '5G NR', power: 44, range: 1.5, frequency: '3.5 GHz', status: 'active', height: 25, sector: '3-sector', bandwidth: '80 MHz', mimo: '4x4' },
  { id: 'IL-TL-001', operator: 'Pelephone', lat: 32.0853, lng: 34.7818, type: '5G NR', power: 44, range: 1.5, frequency: '3.5 GHz', status: 'active', height: 25, sector: '3-sector', bandwidth: '80 MHz', mimo: '4x4' },
  { id: 'QA-DO-001', operator: 'Ooredoo QA', lat: 25.2854, lng: 51.5310, type: '5G NR', power: 44, range: 1.5, frequency: '3.5 GHz', status: 'active', height: 25, sector: '3-sector', bandwidth: '100 MHz', mimo: '4x4' },

  { id: 'TH-BK-001', operator: 'AIS', lat: 13.7563, lng: 100.5018, type: '5G NR', power: 44, range: 1.8, frequency: '3.5 GHz', status: 'active', height: 25, sector: '3-sector', bandwidth: '80 MHz', mimo: '4x4' },
  { id: 'PH-MN-001', operator: 'Globe', lat: 14.5995, lng: 120.9842, type: '5G NR', power: 44, range: 1.5, frequency: '3.5 GHz', status: 'active', height: 25, sector: '3-sector', bandwidth: '80 MHz', mimo: '4x4' },
  { id: 'VN-HN-001', operator: 'Viettel', lat: 21.0285, lng: 105.8542, type: '4G LTE', power: 46, range: 5.0, frequency: '800 MHz', status: 'active', height: 30, sector: '3-sector', bandwidth: '15 MHz', mimo: '2x2' },
  { id: 'TW-TP-001', operator: 'Chunghwa', lat: 25.0330, lng: 121.5654, type: '5G NR', power: 44, range: 1.5, frequency: '3.5 GHz', status: 'active', height: 25, sector: '3-sector', bandwidth: '100 MHz', mimo: '4x4' },
  { id: 'HK-HK-001', operator: 'CSL', lat: 22.3193, lng: 114.1694, type: '5G NR', power: 44, range: 1.2, frequency: '3.5 GHz', status: 'active', height: 25, sector: '3-sector', bandwidth: '100 MHz', mimo: '4x4' },

  { id: 'ZA-JB-001', operator: 'Vodacom', lat: -26.2041, lng: 28.0473, type: '4G LTE', power: 46, range: 5.0, frequency: '800 MHz', status: 'active', height: 30, sector: '3-sector', bandwidth: '15 MHz', mimo: '2x2' },
  { id: 'EG-CA-001', operator: 'Vodafone EG', lat: 30.0444, lng: 31.2357, type: '4G LTE', power: 46, range: 5.0, frequency: '800 MHz', status: 'active', height: 30, sector: '3-sector', bandwidth: '15 MHz', mimo: '2x2' },
  { id: 'KE-NR-001', operator: 'Safaricom', lat: -1.2921, lng: 36.8219, type: '4G LTE', power: 46, range: 5.0, frequency: '800 MHz', status: 'active', height: 30, sector: '3-sector', bandwidth: '15 MHz', mimo: '2x2' },
  { id: 'NG-LA-001', operator: 'MTN Nigeria', lat: 6.5244, lng: 3.3792, type: '4G LTE', power: 46, range: 5.0, frequency: '800 MHz', status: 'active', height: 30, sector: '3-sector', bandwidth: '10 MHz', mimo: '2x2' },
  { id: 'MA-RA-001', operator: 'Maroc Telecom', lat: 33.9716, lng: -6.8498, type: '4G LTE', power: 46, range: 5.0, frequency: '800 MHz', status: 'active', height: 30, sector: '3-sector', bandwidth: '15 MHz', mimo: '2x2' },

  { id: 'MX-MX-001', operator: 'Telcel', lat: 19.4326, lng: -99.1332, type: '5G NR', power: 44, range: 1.8, frequency: '3.5 GHz', status: 'active', height: 25, sector: '3-sector', bandwidth: '80 MHz', mimo: '4x4' },
  { id: 'AR-BA-001', operator: 'Claro AR', lat: -34.6037, lng: -58.3816, type: '4G LTE', power: 46, range: 5.0, frequency: '700 MHz', status: 'active', height: 30, sector: '3-sector', bandwidth: '15 MHz', mimo: '2x2' },
  { id: 'CO-BG-001', operator: 'Claro CO', lat: 4.7110, lng: -74.0721, type: '4G LTE', power: 46, range: 5.0, frequency: '700 MHz', status: 'active', height: 30, sector: '3-sector', bandwidth: '15 MHz', mimo: '2x2' },
  { id: 'CL-ST-001', operator: 'Entel', lat: -33.4489, lng: -70.6693, type: '5G NR', power: 44, range: 1.5, frequency: '3.5 GHz', status: 'active', height: 25, sector: '3-sector', bandwidth: '80 MHz', mimo: '4x4' },

  { id: 'CA-TO-001', operator: 'Bell', lat: 43.6532, lng: -79.3832, type: '5G NR', power: 44, range: 1.5, frequency: '3.5 GHz', status: 'active', height: 25, sector: '3-sector', bandwidth: '80 MHz', mimo: '4x4' },
  { id: 'CA-TO-002', operator: 'Rogers', lat: 43.6629, lng: -79.3957, type: '5G NR', power: 43, range: 2.0, frequency: '2.5 GHz', status: 'active', height: 22, sector: '3-sector', bandwidth: '80 MHz', mimo: '4x4' },

  { id: 'NZ-CK-001', operator: 'Spark NZ', lat: -41.2865, lng: 174.7762, type: '5G NR', power: 44, range: 1.5, frequency: '3.5 GHz', status: 'active', height: 25, sector: '3-sector', bandwidth: '80 MHz', mimo: '4x4' },

  { id: 'US-2G-001', operator: 'AT&T', lat: 35.2271, lng: -80.8431, type: '2G GSM', power: 40, range: 15, frequency: '850 MHz', status: 'active', height: 45, sector: 'omni', bandwidth: '200 kHz', mimo: '1x1' },
  { id: 'UK-2G-001', operator: 'Vodafone UK', lat: 53.4808, lng: -2.2426, type: '2G GSM', power: 40, range: 15, frequency: '900 MHz', status: 'active', height: 40, sector: 'omni', bandwidth: '200 kHz', mimo: '1x1' },
  { id: 'IN-2G-001', operator: 'BSNL', lat: 26.9124, lng: 75.7873, type: '2G GSM', power: 40, range: 18, frequency: '900 MHz', status: 'active', height: 45, sector: 'omni', bandwidth: '200 kHz', mimo: '1x1' },
];

function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function calculateSignalStrength(tower: CellTower, distanceKm: number): number {
  if (distanceKm > tower.range * 1.5) return -200;
  if (distanceKm < 0.01) return tower.power - 10;
  const freqMHz = parseFloat(tower.frequency) || 2000;
  const hB = tower.height || 30;
  const hM = 1.5;
  const d = Math.max(distanceKm, 0.01);
  const a = (1.1 * Math.log10(freqMHz) - 0.7) * hM - (1.56 * Math.log10(freqMHz) - 0.8);
  const pathLoss = 46.3 + 33.9 * Math.log10(freqMHz) - 13.82 * Math.log10(hB) - a +
    (44.9 - 6.55 * Math.log10(hB)) * Math.log10(d);
  return Math.round(tower.power - pathLoss);
}

function classifySignal(dbm: number): { quality: string; color: string; label: string } {
  if (dbm >= -60) return { quality: 'excellent', color: '#00ff88', label: 'EXCELLENT' };
  if (dbm >= -75) return { quality: 'good', color: '#66ff66', label: 'GOOD' };
  if (dbm >= -85) return { quality: 'fair', color: '#ffcc00', label: 'FAIR' };
  if (dbm >= -100) return { quality: 'poor', color: '#ff8800', label: 'POOR' };
  if (dbm >= -110) return { quality: 'marginal', color: '#ff4400', label: 'MARGINAL' };
  return { quality: 'none', color: '#ff0000', label: 'NO SIGNAL' };
}

type TechType = '5G' | '4G' | '3G' | '2G' | 'all';
function matchTech(tower: CellTower, tech: TechType): boolean {
  if (tech === 'all') return true;
  return tower.type.toUpperCase().includes(tech);
}

const cache = new Map<string, { data: any; ts: number }>();
const CACHE_TTL = 5 * 60 * 1000;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const lat = parseFloat(searchParams.get('lat') || '48.8566');
  const lng = parseFloat(searchParams.get('lng') || '2.3522');
  const radius = Math.min(parseFloat(searchParams.get('radius') || '50'), 200);
  const tech: TechType = (searchParams.get('tech') || 'all') as TechType;
  const includeCoverage = searchParams.get('coverage') === 'true';

  const cacheKey = `${lat.toFixed(2)},${lng.toFixed(2)},${radius},${tech},${includeCoverage}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return NextResponse.json(cached.data);
  }

  const towers = TOWER_DATABASE
    .filter(t => matchTech(t, tech))
    .filter(t => haversine(lat, lng, t.lat, t.lng) <= radius)
    .map(t => {
      const distKm = haversine(lat, lng, t.lat, t.lng);
      const signalAtCenter = calculateSignalStrength(t, distKm);
      const signalInfo = classifySignal(signalAtCenter);
      return { ...t, distance: Math.round(distKm * 100) / 100, signalAtCenter, signalQuality: signalInfo };
    })
    .sort((a, b) => a.distance - b.distance);

  const nearestTower = towers[0] || null;
  const bestSignal = towers.length > 0 ? Math.max(...towers.map(t => t.signalAtCenter)) : -200;
  const bestSignalInfo = classifySignal(bestSignal);

  const techBreakdown = {
    '5G': towers.filter(t => t.type.includes('5G')).length,
    '4G': towers.filter(t => t.type.includes('4G')).length,
    '3G': towers.filter(t => t.type.includes('3G')).length,
    '2G': towers.filter(t => t.type.includes('2G')).length,
  };

  const operatorBreakdown: Record<string, number> = {};
  towers.forEach(t => { operatorBreakdown[t.operator] = (operatorBreakdown[t.operator] || 0) + 1; });

  type CoveragePoint = { lat: number; lng: number; signal: number; quality: string; color: string };
  let coverageGrid: CoveragePoint[] | null = null;
  if (includeCoverage) {
    const gridSize = 0.02;
    const gridPoints: CoveragePoint[] = [];
    for (let dlat = -radius * 0.04; dlat <= radius * 0.04; dlat += gridSize) {
      for (let dlng = -radius * 0.04; dlng <= radius * 0.04; dlng += gridSize) {
        const gLat = lat + dlat;
        const gLng = lng + dlng;
        let bestSignalAtPoint = -200;
        for (const t of towers.slice(0, 15)) {
          const d = haversine(gLat, gLng, t.lat, t.lng);
          const sig = calculateSignalStrength(t, d);
          if (sig > bestSignalAtPoint) bestSignalAtPoint = sig;
        }
        if (bestSignalAtPoint > -110) {
          const info = classifySignal(bestSignalAtPoint);
          gridPoints.push({ lat: gLat, lng: gLng, signal: bestSignalAtPoint, quality: info.quality, color: info.color });
        }
      }
    }
    coverageGrid = gridPoints;
  }

  const result = {
    source: 'HORUS Coverage Intelligence Database',
    query: { lat, lng, radius, tech },
    stats: {
      totalTowers: towers.length,
      activeTowers: towers.filter(t => t.status === 'active').length,
      maintenanceTowers: towers.filter(t => t.status === 'maintenance').length,
      nearestTower,
      bestSignal,
      bestSignalQuality: bestSignalInfo,
      coverageArea: Math.round(towers.reduce((acc, t) => acc + Math.PI * t.range * t.range, 0) * 10) / 10,
      techBreakdown,
      operatorBreakdown,
    },
    towers,
    coverageGrid,
    timestamp: new Date().toISOString(),
  };

  cache.set(cacheKey, { data: result, ts: Date.now() });
  if (cache.size > 50) {
    const oldest = [...cache.entries()].sort((a, b) => a[1].ts - b[1].ts)[0];
    cache.delete(oldest[0]);
  }

  return NextResponse.json(result);
}
