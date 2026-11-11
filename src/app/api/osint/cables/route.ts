
import { NextResponse } from 'next/server';
import type { SubmarineCable, CableLandingPoint } from '@/lib/osint-data';

let cachedData: { time: number; data: SubmarineCable[] } | null = null;
const CACHE_TTL = 600000; // 10 minutes · cable data changes slowly


const SUBMARINE_CABLES: SubmarineCable[] = [
  {
    id: 'cable-smw3',
    name: 'SEA-ME-WE 3',
    status: 'active',
    length: 39000,
    rfsYear: 1999,
    owners: ['China Telecom', 'SingTel', 'France Telecom', 'Telecom Italia', 'Telia', 'PT Indosat', 'Telekom Malaysia', 'VSNL', 'Cyta', 'ETE'],
    capacity: '18 Tbps',
    landingPoints: [
      { name: 'Norderney CLS', city: 'Norderney', country: 'Germany', lat: 53.598, lng: 7.149, station: 'Norderney Cable Landing Station' },
      { name: 'Porthcurno CLS', city: 'Porthcurno', country: 'United Kingdom', lat: 50.043, lng: -5.651, station: 'Porthcurno Cable Station' },
      { name: 'Sesimbra CLS', city: 'Sesimbra', country: 'Portugal', lat: 38.444, lng: -9.102, station: 'Sesimbra Cable Landing Station' },
      { name: 'Palermo CLS', city: 'Palermo', country: 'Italy', lat: 38.132, lng: 13.336, station: 'Palermo Cable Station' },
      { name: 'Alexandria CLS', city: 'Alexandria', country: 'Egypt', lat: 31.200, lng: 29.919, station: 'Alexandria CLS' },
      { name: 'Suez CLS', city: 'Suez', country: 'Egypt', lat: 29.967, lng: 32.549, station: 'Suez Cable Landing Station' },
      { name: 'Jeddah CLS', city: 'Jeddah', country: 'Saudi Arabia', lat: 21.543, lng: 39.173, station: 'Jeddah CLS' },
      { name: 'Fujairah CLS', city: 'Fujairah', country: 'UAE', lat: 25.122, lng: 56.327, station: 'Fujairah Cable Landing Station' },
      { name: 'Karachi CLS', city: 'Karachi', country: 'Pakistan', lat: 24.861, lng: 67.011, station: 'Karachi CLS' },
      { name: 'Mumbai CLS', city: 'Mumbai', country: 'India', lat: 19.076, lng: 72.878, station: 'Mumbai CLS' },
      { name: 'Cochin CLS', city: 'Cochin', country: 'India', lat: 9.931, lng: 76.267, station: 'Cochin Cable Station' },
      { name: 'Mount Lavinia CLS', city: 'Mount Lavinia', country: 'Sri Lanka', lat: 6.830, lng: 79.861, station: 'Mount Lavinia CLS' },
      { name: 'Chennai CLS', city: 'Chennai', country: 'India', lat: 13.083, lng: 80.271, station: 'Chennai CLS' },
      { name: 'Satun CLS', city: 'Satun', country: 'Thailand', lat: 6.614, lng: 100.067, station: 'Satun Cable Landing Station' },
      { name: 'Penang CLS', city: 'Penang', country: 'Malaysia', lat: 5.416, lng: 100.333, station: 'Penang CLS' },
      { name: 'Tuas CLS', city: 'Singapore', country: 'Singapore', lat: 1.340, lng: 103.641, station: 'Tuas Cable Landing Station' },
      { name: 'Jakarta CLS', city: 'Jakarta', country: 'Indonesia', lat: -6.125, lng: 106.842, station: 'Jakarta CLS' },
      { name: 'Perth CLS', city: 'Perth', country: 'Australia', lat: -31.953, lng: 115.860, station: 'Perth Cable Landing Station' },
    ],
    route: [
      [53.598, 7.149], [51.5, 3.0], [50.043, -5.651], [48.0, -5.0], [46.0, -3.0],
      [44.0, -1.0], [42.0, 0.0], [40.0, 1.0], [38.444, -9.102], [37.0, -7.0],
      [36.0, -4.0], [38.132, 13.336], [36.5, 16.0], [35.0, 20.0], [33.0, 24.0],
      [31.200, 29.919], [30.0, 31.5], [29.967, 32.549], [28.0, 34.0], [26.0, 36.0],
      [24.0, 38.0], [21.543, 39.173], [23.0, 40.0], [25.122, 56.327], [24.0, 60.0],
      [24.861, 67.011], [22.0, 69.0], [19.076, 72.878], [16.0, 73.0], [13.0, 74.5],
      [9.931, 76.267], [8.0, 77.0], [6.830, 79.861], [8.0, 80.0], [10.0, 80.5],
      [13.083, 80.271], [11.0, 82.0], [9.0, 88.0], [8.0, 95.0], [6.614, 100.067],
      [5.416, 100.333], [3.0, 101.5], [1.340, 103.641], [0.0, 104.5], [-2.0, 106.0],
      [-6.125, 106.842], [-8.0, 108.0], [-10.0, 112.0], [-13.0, 114.0],
      [-20.0, 114.0], [-25.0, 114.0], [-31.953, 115.860],
    ],
  },

  {
    id: 'cable-smw5',
    name: 'SEA-ME-WE 5',
    status: 'active',
    length: 20000,
    rfsYear: 2016,
    owners: ['China Mobile', 'China Unicom', 'SingTel', 'Telecom Italia Sparkle', 'Orange', 'Etisalat', 'PT Indosat', 'Telekom Malaysia', 'Sri Lanka Telecom', 'Bangladesh Submarine Cable Company', 'Myanma Posts and Telecommunications'],
    capacity: '24 Tbps',
    landingPoints: [
      { name: 'Marseille CLS', city: 'Marseille', country: 'France', lat: 43.296, lng: 5.370, station: 'Marseille Cable Landing Station' },
      { name: 'Annaba CLS', city: 'Annaba', country: 'Algeria', lat: 36.919, lng: 7.766, station: 'Annaba CLS' },
      { name: 'Bizerte CLS', city: 'Bizerte', country: 'Tunisia', lat: 37.275, lng: 9.864, station: 'Bizerte Cable Landing Station' },
      { name: 'Abu Talat CLS', city: 'Abu Talat', country: 'Egypt', lat: 31.050, lng: 29.650, station: 'Abu Talat CLS' },
      { name: 'Zafarana CLS', city: 'Zafarana', country: 'Egypt', lat: 29.117, lng: 32.650, station: 'Zafarana CLS' },
      { name: 'Jeddah CLS', city: 'Jeddah', country: 'Saudi Arabia', lat: 21.543, lng: 39.173, station: 'Jeddah CLS' },
      { name: 'Fujairah CLS', city: 'Fujairah', country: 'UAE', lat: 25.122, lng: 56.327, station: 'Fujairah CLS' },
      { name: 'Karachi CLS', city: 'Karachi', country: 'Pakistan', lat: 24.861, lng: 67.011, station: 'Karachi CLS' },
      { name: 'Mumbai CLS', city: 'Mumbai', country: 'India', lat: 19.076, lng: 72.878, station: 'Mumbai CLS' },
      { name: 'Chennai CLS', city: 'Chennai', country: 'India', lat: 13.083, lng: 80.271, station: 'Chennai CLS' },
      { name: 'Hambantota CLS', city: 'Hambantota', country: 'Sri Lanka', lat: 6.124, lng: 81.118, station: 'Hambantota CLS' },
      { name: 'Yangon CLS', city: 'Yangon', country: 'Myanmar', lat: 16.866, lng: 96.195, station: 'Yangon CLS' },
      { name: 'Satun CLS', city: 'Satun', country: 'Thailand', lat: 6.614, lng: 100.067, station: 'Satun CLS' },
      { name: 'Kuantan CLS', city: 'Kuantan', country: 'Malaysia', lat: 3.820, lng: 103.310, station: 'Kuantan CLS' },
      { name: 'Tuas CLS', city: 'Singapore', country: 'Singapore', lat: 1.340, lng: 103.641, station: 'Tuas CLS' },
    ],
    route: [
      [43.296, 5.370], [41.0, 5.0], [39.0, 6.0], [37.0, 7.0], [36.919, 7.766],
      [37.0, 9.0], [37.275, 9.864], [35.0, 14.0], [33.0, 20.0], [31.050, 29.650],
      [30.0, 31.0], [29.117, 32.650], [27.0, 35.0], [24.0, 38.0], [21.543, 39.173],
      [23.0, 42.0], [25.0, 48.0], [25.122, 56.327], [25.0, 60.0], [24.861, 67.011],
      [22.0, 69.0], [19.076, 72.878], [16.0, 74.0], [13.083, 80.271], [10.0, 81.0],
      [6.124, 81.118], [7.0, 85.0], [10.0, 90.0], [13.0, 94.0], [16.866, 96.195],
      [12.0, 98.0], [8.0, 99.0], [6.614, 100.067], [5.0, 101.5], [3.820, 103.310],
      [2.0, 103.5], [1.340, 103.641],
    ],
  },

  {
    id: 'cable-smw6',
    name: 'SEA-ME-WE 6',
    status: 'under_construction',
    length: 21500,
    rfsYear: 2026,
    owners: ['China Mobile', 'SingTel', 'Orange', 'Etisalat', 'Telecom Italia Sparkle', 'Sri Lanka Telecom', 'Bangladesh Submarine Cable Company'],
    capacity: '100 Tbps',
    landingPoints: [
      { name: 'Marseille CLS', city: 'Marseille', country: 'France', lat: 43.296, lng: 5.370, station: 'Marseille CLS' },
      { name: 'Abu Talat CLS', city: 'Abu Talat', country: 'Egypt', lat: 31.050, lng: 29.650, station: 'Abu Talat CLS' },
      { name: 'Zafarana CLS', city: 'Zafarana', country: 'Egypt', lat: 29.117, lng: 32.650, station: 'Zafarana CLS' },
      { name: 'Dubai CLS', city: 'Dubai', country: 'UAE', lat: 25.205, lng: 55.271, station: 'Dubai CLS' },
      { name: 'Karachi CLS', city: 'Karachi', country: 'Pakistan', lat: 24.861, lng: 67.011, station: 'Karachi CLS' },
      { name: 'Mumbai CLS', city: 'Mumbai', country: 'India', lat: 19.076, lng: 72.878, station: 'Mumbai CLS' },
      { name: 'Chennai CLS', city: 'Chennai', country: 'India', lat: 13.083, lng: 80.271, station: 'Chennai CLS' },
      { name: 'Colombo CLS', city: 'Colombo', country: 'Sri Lanka', lat: 6.927, lng: 79.861, station: 'Colombo CLS' },
      { name: 'Tuas CLS', city: 'Singapore', country: 'Singapore', lat: 1.340, lng: 103.641, station: 'Tuas CLS' },
    ],
    route: [
      [43.296, 5.370], [39.0, 10.0], [35.0, 18.0], [33.0, 24.0], [31.050, 29.650],
      [30.0, 31.0], [29.117, 32.650], [27.0, 36.0], [25.0, 42.0], [25.205, 55.271],
      [25.0, 60.0], [24.861, 67.011], [22.0, 69.0], [19.076, 72.878], [16.0, 74.0],
      [13.083, 80.271], [10.0, 80.0], [6.927, 79.861], [5.0, 85.0], [2.0, 95.0],
      [1.340, 103.641],
    ],
  },

  {
    id: 'cable-eig',
    name: 'Europe India Gateway (EIG)',
    status: 'active',
    length: 15000,
    rfsYear: 2011,
    owners: ['BT', 'India VSNL/Tata Communications', 'Mobilink', 'Omantel', 'Telecom Egypt', 'Vodafone', 'Gibtelecom'],
    capacity: '3.84 Tbps',
    landingPoints: [
      { name: 'Sandy Cove CLS', city: 'London', country: 'United Kingdom', lat: 51.507, lng: -0.128, station: 'Sandy Cove CLS' },
      { name: 'Gibraltar CLS', city: 'Gibraltar', country: 'Gibraltar', lat: 36.133, lng: -5.354, station: 'Gibraltar Cable Station' },
      { name: 'Sesimbra CLS', city: 'Sesimbra', country: 'Portugal', lat: 38.444, lng: -9.102, station: 'Sesimbra CLS' },
      { name: 'Tripoli CLS', city: 'Tripoli', country: 'Libya', lat: 32.902, lng: 13.180, station: 'Tripoli CLS' },
      { name: 'Alexandria CLS', city: 'Alexandria', country: 'Egypt', lat: 31.200, lng: 29.919, station: 'Alexandria CLS' },
      { name: 'Suez CLS', city: 'Suez', country: 'Egypt', lat: 29.967, lng: 32.549, station: 'Suez CLS' },
      { name: 'Muscat CLS', city: 'Muscat', country: 'Oman', lat: 23.586, lng: 58.406, station: 'Muscat CLS' },
      { name: 'Fujairah CLS', city: 'Fujairah', country: 'UAE', lat: 25.122, lng: 56.327, station: 'Fujairah CLS' },
      { name: 'Mumbai CLS', city: 'Mumbai', country: 'India', lat: 19.076, lng: 72.878, station: 'Mumbai CLS' },
    ],
    route: [
      [51.507, -0.128], [49.0, -3.0], [46.0, -5.0], [43.0, -8.0], [38.444, -9.102],
      [37.0, -7.0], [36.133, -5.354], [35.0, -2.0], [34.0, 3.0], [33.0, 8.0],
      [32.902, 13.180], [32.0, 18.0], [31.200, 29.919], [30.0, 31.5], [29.967, 32.549],
      [28.0, 35.0], [26.0, 40.0], [25.122, 56.327], [24.0, 58.0], [23.586, 58.406],
      [22.0, 62.0], [20.0, 66.0], [19.076, 72.878],
    ],
  },

  {
    id: 'cable-ace',
    name: 'Africa Coast to Europe (ACE)',
    status: 'active',
    length: 17000,
    rfsYear: 2012,
    owners: ['Orange', 'Sonatel', 'Cotevoire Telecom', 'Ghana Telecom', 'Nigeria Telecom', 'Cameron Telecom', 'Gabon Telecom', 'Congo Telecom', 'Angola Telecom', 'South Africa Telecom'],
    capacity: '12.8 Tbps',
    landingPoints: [
      { name: 'Penmarch CLS', city: 'Penmarch', country: 'France', lat: 47.798, lng: -4.373, station: 'Penmarch Cable Landing Station' },
      { name: 'Sesimbra CLS', city: 'Sesimbra', country: 'Portugal', lat: 38.444, lng: -9.102, station: 'Sesimbra CLS' },
      { name: 'Mindelo CLS', city: 'Mindelo', country: 'Cape Verde', lat: 16.883, lng: -24.983, station: 'Mindelo CLS' },
      { name: 'Dakar CLS', city: 'Dakar', country: 'Senegal', lat: 14.694, lng: -17.444, station: 'Dakar CLS' },
      { name: 'Banjul CLS', city: 'Banjul', country: 'Gambia', lat: 13.455, lng: -16.578, station: 'Banjul CLS' },
      { name: 'Conakry CLS', city: 'Conakry', country: 'Guinea', lat: 9.510, lng: -13.712, station: 'Conakry CLS' },
      { name: 'Monrovia CLS', city: 'Monrovia', country: 'Liberia', lat: 6.313, lng: -10.801, station: 'Monrovia CLS' },
      { name: 'Accra CLS', city: 'Accra', country: 'Ghana', lat: 5.604, lng: -0.187, station: 'Accra CLS' },
      { name: 'Lagos CLS', city: 'Lagos', country: 'Nigeria', lat: 6.524, lng: 3.379, station: 'Lagos CLS' },
      { name: 'Libreville CLS', city: 'Libreville', country: 'Gabon', lat: 0.416, lng: 9.468, station: 'Libreville CLS' },
      { name: 'Pointe-Noire CLS', city: 'Pointe-Noire', country: 'Congo', lat: -4.776, lng: 11.864, station: 'Pointe-Noire CLS' },
      { name: 'Luanda CLS', city: 'Luanda', country: 'Angola', lat: -8.837, lng: 13.234, station: 'Luanda CLS' },
      { name: 'Cape Town CLS', city: 'Cape Town', country: 'South Africa', lat: -33.925, lng: 18.424, station: 'Cape Town CLS' },
    ],
    route: [
      [47.798, -4.373], [45.0, -6.0], [42.0, -8.0], [38.444, -9.102], [36.0, -12.0],
      [30.0, -18.0], [24.0, -20.0], [20.0, -22.0], [16.883, -24.983], [15.0, -22.0],
      [14.694, -17.444], [13.455, -16.578], [12.0, -16.0], [9.510, -13.712],
      [8.0, -13.0], [6.313, -10.801], [5.604, -0.187], [6.0, 2.0], [6.524, 3.379],
      [4.0, 6.0], [2.0, 8.0], [0.416, 9.468], [-2.0, 10.0], [-4.776, 11.864],
      [-6.0, 12.0], [-8.837, 13.234], [-12.0, 14.0], [-18.0, 14.0], [-24.0, 15.0],
      [-30.0, 17.0], [-33.925, 18.424],
    ],
  },

  {
    id: 'cable-wacs',
    name: 'West Africa Cable System (WACS)',
    status: 'active',
    length: 14530,
    rfsYear: 2012,
    owners: ['MTN Group', 'Vodacom', 'Telia', 'Portugal Telecom', 'Cable & Wireless', 'Togo Telecom', 'Benin Telecom', 'Ghana Vodafone'],
    capacity: '14.5 Tbps',
    landingPoints: [
      { name: 'Sesimbra CLS', city: 'Sesimbra', country: 'Portugal', lat: 38.444, lng: -9.102, station: 'Sesimbra CLS' },
      { name: 'Mindelo CLS', city: 'Mindelo', country: 'Cape Verde', lat: 16.883, lng: -24.983, station: 'Mindelo CLS' },
      { name: 'Accra CLS', city: 'Accra', country: 'Ghana', lat: 5.604, lng: -0.187, station: 'Accra CLS' },
      { name: 'Lagos CLS', city: 'Lagos', country: 'Nigeria', lat: 6.524, lng: 3.379, station: 'Lagos CLS' },
      { name: 'Cotonou CLS', city: 'Cotonou', country: 'Benin', lat: 6.369, lng: 2.392, station: 'Cotonou CLS' },
      { name: 'Lome CLS', city: 'Lome', country: 'Togo', lat: 6.131, lng: 1.223, station: 'Lome CLS' },
      { name: 'Swakopmund CLS', city: 'Swakopmund', country: 'Namibia', lat: -22.678, lng: 14.527, station: 'Swakopmund CLS' },
      { name: 'Cape Town CLS', city: 'Cape Town', country: 'South Africa', lat: -33.925, lng: 18.424, station: 'Cape Town CLS' },
      { name: 'Yzerfontein CLS', city: 'Yzerfontein', country: 'South Africa', lat: -33.350, lng: 18.167, station: 'Yzerfontein CLS' },
    ],
    route: [
      [38.444, -9.102], [35.0, -14.0], [30.0, -18.0], [25.0, -20.0],
      [20.0, -22.0], [16.883, -24.983], [12.0, -18.0], [8.0, -8.0],
      [5.604, -0.187], [6.131, 1.223], [6.369, 2.392], [6.524, 3.379],
      [4.0, 7.0], [0.0, 9.0], [-4.0, 10.0], [-8.0, 12.0], [-12.0, 14.0],
      [-18.0, 14.0], [-22.678, 14.527], [-28.0, 16.0], [-33.350, 18.167],
      [-33.925, 18.424],
    ],
  },

  {
    id: 'cable-sat3',
    name: 'SAT-3/WASC',
    status: 'active',
    length: 14350,
    rfsYear: 2001,
    owners: ['Telia', 'Portugal Telecom', 'Telecom South Africa', 'Nigeria Telecom', 'Cameron Telecom', 'Ghana Telecom'],
    capacity: '1.2 Tbps',
    landingPoints: [
      { name: 'Sesimbra CLS', city: 'Sesimbra', country: 'Portugal', lat: 38.444, lng: -9.102, station: 'Sesimbra CLS' },
      { name: 'Accra CLS', city: 'Accra', country: 'Ghana', lat: 5.604, lng: -0.187, station: 'Accra CLS' },
      { name: 'Lagos CLS', city: 'Lagos', country: 'Nigeria', lat: 6.524, lng: 3.379, station: 'Lagos CLS' },
      { name: 'Douala CLS', city: 'Douala', country: 'Cameroon', lat: 4.051, lng: 9.768, station: 'Douala CLS' },
      { name: 'Libreville CLS', city: 'Libreville', country: 'Gabon', lat: 0.416, lng: 9.468, station: 'Libreville CLS' },
      { name: 'Cape Town CLS', city: 'Cape Town', country: 'South Africa', lat: -33.925, lng: 18.424, station: 'Cape Town CLS' },
    ],
    route: [
      [38.444, -9.102], [34.0, -14.0], [28.0, -18.0], [22.0, -18.0],
      [16.0, -14.0], [10.0, -6.0], [5.604, -0.187], [6.524, 3.379],
      [4.051, 9.768], [0.416, 9.468], [-4.0, 10.0], [-10.0, 13.0],
      [-18.0, 14.0], [-26.0, 16.0], [-33.925, 18.424],
    ],
  },

  {
    id: 'cable-mainone',
    name: 'Main One',
    status: 'active',
    length: 7000,
    rfsYear: 2010,
    owners: ['MainOne Cable Company', 'Heritage Bank', 'FBN Capital', 'Dangote Group'],
    capacity: '10 Tbps',
    landingPoints: [
      { name: 'Seixal CLS', city: 'Seixal', country: 'Portugal', lat: 38.627, lng: -9.098, station: 'Seixal Cable Landing Station' },
      { name: 'Accra CLS', city: 'Accra', country: 'Ghana', lat: 5.604, lng: -0.187, station: 'Accra CLS' },
      { name: 'Lagos CLS', city: 'Lagos', country: 'Nigeria', lat: 6.524, lng: 3.379, station: 'Lagos CLS' },
      { name: 'Cotonou CLS', city: 'Cotonou', country: 'Benin', lat: 6.369, lng: 2.392, station: 'Cotonou CLS' },
      { name: 'Abidjan CLS', city: 'Abidjan', country: "Cote d'Ivoire", lat: 5.336, lng: -4.016, station: 'Abidjan CLS' },
      { name: 'Dakar CLS', city: 'Dakar', country: 'Senegal', lat: 14.694, lng: -17.444, station: 'Dakar CLS' },
    ],
    route: [
      [38.627, -9.098], [34.0, -14.0], [26.0, -18.0], [20.0, -18.0],
      [14.694, -17.444], [10.0, -10.0], [5.336, -4.016], [5.604, -0.187],
      [6.369, 2.392], [6.524, 3.379],
    ],
  },

  {
    id: 'cable-glo1',
    name: 'GLO-1',
    status: 'active',
    length: 9800,
    rfsYear: 2010,
    owners: ['Globacom Limited'],
    capacity: '2.5 Tbps',
    landingPoints: [
      { name: 'Bude CLS', city: 'Bude', country: 'United Kingdom', lat: 50.829, lng: -4.544, station: 'Bude Cable Landing Station' },
      { name: 'Lagos CLS', city: 'Lagos', country: 'Nigeria', lat: 6.524, lng: 3.379, station: 'Lagos CLS' },
      { name: 'Accra CLS', city: 'Accra', country: 'Ghana', lat: 5.604, lng: -0.187, station: 'Accra CLS' },
      { name: 'Casablanca CLS', city: 'Casablanca', country: 'Morocco', lat: 33.573, lng: -7.590, station: 'Casablanca CLS' },
      { name: 'Lisbon CLS', city: 'Lisbon', country: 'Portugal', lat: 38.722, lng: -9.139, station: 'Lisbon CLS' },
      { name: 'Vigo CLS', city: 'Vigo', country: 'Spain', lat: 42.236, lng: -8.714, station: 'Vigo CLS' },
    ],
    route: [
      [50.829, -4.544], [48.0, -6.0], [45.0, -7.0], [42.236, -8.714],
      [38.722, -9.139], [36.0, -10.0], [33.573, -7.590], [28.0, -15.0],
      [20.0, -18.0], [12.0, -14.0], [5.604, -0.187], [6.524, 3.379],
    ],
  },

  {
    id: 'cable-aag',
    name: 'Asia America Gateway (AAG)',
    status: 'active',
    length: 20000,
    rfsYear: 2009,
    owners: ['AT&T', 'PLDT', 'StarHub', 'CAT Telecom', 'VNPT', 'Telkom Indonesia', 'Telekom Malaysia'],
    capacity: '2.88 Tbps',
    landingPoints: [
      { name: 'Foster City CLS', city: 'Foster City', country: 'United States', lat: 37.559, lng: -122.271, station: 'Foster City CLS' },
      { name: 'Guam CLS', city: 'Guam', country: 'United States', lat: 13.444, lng: 144.794, station: 'Guam Cable Landing Station' },
      { name: 'Da Nang CLS', city: 'Da Nang', country: 'Vietnam', lat: 16.054, lng: 108.202, station: 'Da Nang CLS' },
      { name: 'Songkhla CLS', city: 'Songkhla', country: 'Thailand', lat: 7.189, lng: 100.594, station: 'Songkhla CLS' },
      { name: 'Kuantan CLS', city: 'Kuantan', country: 'Malaysia', lat: 3.820, lng: 103.310, station: 'Kuantan CLS' },
      { name: 'Tuas CLS', city: 'Singapore', country: 'Singapore', lat: 1.340, lng: 103.641, station: 'Tuas CLS' },
      { name: 'Bitung CLS', city: 'Bitung', country: 'Indonesia', lat: 1.447, lng: 125.217, station: 'Bitung CLS' },
    ],
    route: [
      [37.559, -122.271], [34.0, -130.0], [28.0, -140.0], [22.0, -150.0],
      [16.0, -160.0], [13.444, 144.794], [14.0, 140.0], [15.0, 130.0],
      [16.054, 108.202], [12.0, 106.0], [7.189, 100.594], [3.820, 103.310],
      [1.340, 103.641], [0.0, 110.0], [1.447, 125.217],
    ],
  },

  {
    id: 'cable-pc1',
    name: 'Pacific Cable Network (PC-1)',
    status: 'active',
    length: 23600,
    rfsYear: 2001,
    owners: ['NTT Communications', 'KDDI', 'Softbank Telecom', 'AT&T'],
    capacity: '1.28 Tbps',
    landingPoints: [
      { name: 'Manchester CLS', city: 'Manchester', country: 'United States', lat: 47.757, lng: -122.884, station: 'Manchester CLS' },
      { name: 'Shima CLS', city: 'Shima', country: 'Japan', lat: 34.340, lng: 136.820, station: 'Shima Cable Landing Station' },
      { name: 'Maruyama CLS', city: 'Maruyama', country: 'Japan', lat: 35.050, lng: 139.850, station: 'Maruyama CLS' },
      { name: 'Guam CLS', city: 'Guam', country: 'United States', lat: 13.444, lng: 144.794, station: 'Guam CLS' },
      { name: 'Hawaii CLS', city: 'Hawaii', country: 'United States', lat: 21.307, lng: -157.857, station: 'Hawaii CLS' },
    ],
    route: [
      [47.757, -122.884], [44.0, -132.0], [38.0, -145.0], [30.0, -155.0],
      [21.307, -157.857], [18.0, -160.0], [13.444, 144.794], [16.0, 142.0],
      [20.0, 140.0], [34.340, 136.820], [35.050, 139.850],
    ],
  },

  {
    id: 'cable-southerncross',
    name: 'Southern Cross Cable',
    status: 'active',
    length: 30500,
    rfsYear: 2000,
    owners: ['Spark New Zealand', 'Optus', 'Verizon', 'Fiji International Telecommunications'],
    capacity: '8 Tbps',
    landingPoints: [
      { name: 'Brookvale CLS', city: 'Sydney', country: 'Australia', lat: -33.768, lng: 151.265, station: 'Brookvale CLS' },
      { name: 'Suva CLS', city: 'Suva', country: 'Fiji', lat: -18.142, lng: 178.441, station: 'Suva CLS' },
      { name: 'Hillsboro CLS', city: 'Hillsboro', country: 'United States', lat: 45.523, lng: -122.975, station: 'Hillsboro CLS' },
      { name: 'Morro Bay CLS', city: 'Morro Bay', country: 'United States', lat: 35.366, lng: -120.859, station: 'Morro Bay CLS' },
      { name: 'Takapuna CLS', city: 'Auckland', country: 'New Zealand', lat: -36.788, lng: 174.760, station: 'Takapuna CLS' },
      { name: 'Avalon CLS', city: 'Wellington', country: 'New Zealand', lat: -41.209, lng: 174.881, station: 'Avalon CLS' },
    ],
    route: [
      [-33.768, 151.265], [-32.0, 160.0], [-28.0, 168.0], [-22.0, 175.0],
      [-18.142, 178.441], [-14.0, -178.0], [-8.0, -170.0], [0.0, -160.0],
      [10.0, -150.0], [20.0, -145.0], [30.0, -135.0], [35.366, -120.859],
      [45.523, -122.975],
    ],
  },

  {
    id: 'cable-hawaiki',
    name: 'Hawaiki',
    status: 'active',
    length: 14628,
    rfsYear: 2018,
    owners: ['Hawaiki Submarine Cable', 'REANNZ', 'Southern Cross Cable Network', 'Amazon'],
    capacity: '43 Tbps',
    landingPoints: [
      { name: 'Pacific City CLS', city: 'Pacific City', country: 'United States', lat: 45.205, lng: -123.957, station: 'Pacific City CLS' },
      { name: 'Takapuna CLS', city: 'Auckland', country: 'New Zealand', lat: -36.788, lng: 174.760, station: 'Takapuna CLS' },
      { name: 'Brookvale CLS', city: 'Sydney', country: 'Australia', lat: -33.768, lng: 151.265, station: 'Brookvale CLS' },
      { name: 'Tupua CLS', city: 'Samoa', country: 'Samoa', lat: -13.833, lng: -171.750, station: 'Tupua CLS' },
    ],
    route: [
      [45.205, -123.957], [38.0, -132.0], [28.0, -145.0], [18.0, -158.0],
      [8.0, -168.0], [-2.0, -176.0], [-13.833, -171.750], [-18.0, -178.0],
      [-26.0, 172.0], [-36.788, 174.760], [-35.0, 160.0], [-33.768, 151.265],
    ],
  },

  {
    id: 'cable-tgn-pacific',
    name: 'TGN-Pacific',
    status: 'active',
    length: 21700,
    rfsYear: 2002,
    owners: ['Tata Communications'],
    capacity: '4.8 Tbps',
    landingPoints: [
      { name: 'Manchester CLS', city: 'Manchester', country: 'United States', lat: 47.757, lng: -122.884, station: 'Manchester CLS' },
      { name: 'Shima CLS', city: 'Shima', country: 'Japan', lat: 34.340, lng: 136.820, station: 'Shima CLS' },
      { name: 'Chikura CLS', city: 'Chikura', country: 'Japan', lat: 34.770, lng: 139.920, station: 'Chikura CLS' },
      { name: 'Guam CLS', city: 'Guam', country: 'United States', lat: 13.444, lng: 144.794, station: 'Guam CLS' },
      { name: 'Oahu CLS', city: 'Hawaii', country: 'United States', lat: 21.307, lng: -157.857, station: 'Oahu CLS' },
    ],
    route: [
      [47.757, -122.884], [42.0, -135.0], [35.0, -148.0], [28.0, -155.0],
      [21.307, -157.857], [16.0, -160.0], [13.444, 144.794], [18.0, 142.0],
      [25.0, 140.0], [34.340, 136.820], [34.770, 139.920],
    ],
  },

  {
    id: 'cable-tgn-atlantic',
    name: 'TGN-Atlantic',
    status: 'active',
    length: 13000,
    rfsYear: 2001,
    owners: ['Tata Communications'],
    capacity: '3.2 Tbps',
    landingPoints: [
      { name: 'Manasquan CLS', city: 'Manasquan', country: 'United States', lat: 40.124, lng: -74.050, station: 'Manasquan CLS' },
      { name: 'Bude CLS', city: 'Bude', country: 'United Kingdom', lat: 50.829, lng: -4.544, station: 'Bude CLS' },
      { name: 'Sennen Cove CLS', city: 'Sennen Cove', country: 'United Kingdom', lat: 50.079, lng: -5.703, station: 'Sennen Cove CLS' },
      { name: 'Penmarch CLS', city: 'Penmarch', country: 'France', lat: 47.798, lng: -4.373, station: 'Penmarch CLS' },
    ],
    route: [
      [40.124, -74.050], [42.0, -55.0], [45.0, -40.0], [48.0, -25.0],
      [50.079, -5.703], [50.829, -4.544], [48.5, -5.0], [47.798, -4.373],
    ],
  },

  {
    id: 'cable-tat14',
    name: 'TAT-14',
    status: 'active',
    length: 15000,
    rfsYear: 2001,
    owners: ['BT', 'Deutsche Telekom', 'France Telecom', 'KPN', 'Telecom Italia', 'Telia', 'Verizon'],
    capacity: '640 Gbps',
    landingPoints: [
      { name: 'Manasquan CLS', city: 'Manasquan', country: 'United States', lat: 40.124, lng: -74.050, station: 'Manasquan CLS' },
      { name: 'Bude CLS', city: 'Bude', country: 'United Kingdom', lat: 50.829, lng: -4.544, station: 'Bude CLS' },
      { name: 'St. Valery CLS', city: 'St. Valery', country: 'France', lat: 50.073, lng: 1.314, station: 'St. Valery CLS' },
      { name: 'Norden CLS', city: 'Norden', country: 'Germany', lat: 53.598, lng: 7.149, station: 'Norden CLS' },
      { name: 'Kattegat CLS', city: 'Kattegat', country: 'Denmark', lat: 56.000, lng: 11.000, station: 'Kattegat CLS' },
    ],
    route: [
      [40.124, -74.050], [43.0, -55.0], [47.0, -38.0], [50.0, -20.0],
      [50.829, -4.544], [50.073, 1.314], [52.0, 4.0], [53.598, 7.149],
      [55.0, 9.0], [56.000, 11.000],
    ],
  },

  {
    id: 'cable-flag-atlantic1',
    name: 'FLAG Atlantic-1',
    status: 'outage',
    length: 13500,
    rfsYear: 2001,
    owners: ['Global Cloud Xchange (Reliance Communications)'],
    capacity: '4.8 Tbps',
    landingPoints: [
      { name: 'Shirley CLS', city: 'Shirley', country: 'United States', lat: 40.868, lng: -72.871, station: 'Shirley CLS' },
      { name: 'Penmarch CLS', city: 'Penmarch', country: 'France', lat: 47.798, lng: -4.373, station: 'Penmarch CLS' },
      { name: 'Sennen Cove CLS', city: 'Sennen Cove', country: 'United Kingdom', lat: 50.079, lng: -5.703, station: 'Sennen Cove CLS' },
      { name: 'Estepona CLS', city: 'Estepona', country: 'Spain', lat: 36.428, lng: -5.160, station: 'Estepona CLS' },
    ],
    route: [
      [40.868, -72.871], [43.0, -55.0], [46.0, -38.0], [50.079, -5.703],
      [47.798, -4.373], [45.0, -3.0], [42.0, -3.0], [38.0, -5.0],
      [36.428, -5.160],
    ],
  },

  {
    id: 'cable-fea',
    name: 'FLAG Europe-Asia (FEA)',
    status: 'active',
    length: 28000,
    rfsYear: 1997,
    owners: ['Global Cloud Xchange (Reliance Communications)'],
    capacity: '10 Gbps',
    landingPoints: [
      { name: 'Porthcurno CLS', city: 'Porthcurno', country: 'United Kingdom', lat: 50.043, lng: -5.651, station: 'Porthcurno Cable Station' },
      { name: 'Estepona CLS', city: 'Estepona', country: 'Spain', lat: 36.428, lng: -5.160, station: 'Estepona CLS' },
      { name: 'Palermo CLS', city: 'Palermo', country: 'Italy', lat: 38.132, lng: 13.336, station: 'Palermo CLS' },
      { name: 'Alexandria CLS', city: 'Alexandria', country: 'Egypt', lat: 31.200, lng: 29.919, station: 'Alexandria CLS' },
      { name: 'Suez CLS', city: 'Suez', country: 'Egypt', lat: 29.967, lng: 32.549, station: 'Suez CLS' },
      { name: 'Aqaba CLS', city: 'Aqaba', country: 'Jordan', lat: 29.527, lng: 35.008, station: 'Aqaba CLS' },
      { name: 'Jeddah CLS', city: 'Jeddah', country: 'Saudi Arabia', lat: 21.543, lng: 39.173, station: 'Jeddah CLS' },
      { name: 'Fujairah CLS', city: 'Fujairah', country: 'UAE', lat: 25.122, lng: 56.327, station: 'Fujairah CLS' },
      { name: 'Mumbai CLS', city: 'Mumbai', country: 'India', lat: 19.076, lng: 72.878, station: 'Mumbai CLS' },
      { name: 'Cochin CLS', city: 'Cochin', country: 'India', lat: 9.931, lng: 76.267, station: 'Cochin CLS' },
      { name: 'Songkhla CLS', city: 'Songkhla', country: 'Thailand', lat: 7.189, lng: 100.594, station: 'Songkhla CLS' },
      { name: 'Lantau CLS', city: 'Hong Kong', country: 'China', lat: 22.278, lng: 113.912, station: 'Lantau CLS' },
      { name: 'Shanghai CLS', city: 'Shanghai', country: 'China', lat: 31.230, lng: 121.474, station: 'Shanghai CLS' },
      { name: 'Korea CLS', city: 'Busan', country: 'South Korea', lat: 35.180, lng: 129.076, station: 'Busan CLS' },
    ],
    route: [
      [50.043, -5.651], [46.0, -5.0], [42.0, -4.0], [38.0, -5.0],
      [36.428, -5.160], [37.0, 2.0], [38.132, 13.336], [36.0, 18.0],
      [33.0, 24.0], [31.200, 29.919], [30.0, 31.0], [29.967, 32.549],
      [29.527, 35.008], [27.0, 37.0], [24.0, 38.0], [21.543, 39.173],
      [23.0, 44.0], [25.122, 56.327], [23.0, 60.0], [20.0, 66.0],
      [19.076, 72.878], [16.0, 74.0], [12.0, 75.0], [9.931, 76.267],
      [8.0, 80.0], [7.189, 100.594], [10.0, 104.0], [15.0, 108.0],
      [20.0, 110.0], [22.278, 113.912], [26.0, 117.0], [31.230, 121.474],
      [33.0, 125.0], [35.180, 129.076],
    ],
  },

  {
    id: 'cable-imewe',
    name: 'I-ME-WE',
    status: 'active',
    length: 13500,
    rfsYear: 2009,
    owners: ['Tata Communications', 'SingTel', 'Egypt Telecom', 'Orange', 'Telia', 'Cyta', 'Telecom Italia'],
    capacity: '3.84 Tbps',
    landingPoints: [
      { name: 'Marseille CLS', city: 'Marseille', country: 'France', lat: 43.296, lng: 5.370, station: 'Marseille CLS' },
      { name: 'Palermo CLS', city: 'Palermo', country: 'Italy', lat: 38.132, lng: 13.336, station: 'Palermo CLS' },
      { name: 'Alexandria CLS', city: 'Alexandria', country: 'Egypt', lat: 31.200, lng: 29.919, station: 'Alexandria CLS' },
      { name: 'Suez CLS', city: 'Suez', country: 'Egypt', lat: 29.967, lng: 32.549, station: 'Suez CLS' },
      { name: 'Fujairah CLS', city: 'Fujairah', country: 'UAE', lat: 25.122, lng: 56.327, station: 'Fujairah CLS' },
      { name: 'Mumbai CLS', city: 'Mumbai', country: 'India', lat: 19.076, lng: 72.878, station: 'Mumbai CLS' },
      { name: 'Chennai CLS', city: 'Chennai', country: 'India', lat: 13.083, lng: 80.271, station: 'Chennai CLS' },
    ],
    route: [
      [43.296, 5.370], [41.0, 8.0], [38.132, 13.336], [35.5, 18.0],
      [33.0, 24.0], [31.200, 29.919], [30.0, 31.0], [29.967, 32.549],
      [27.0, 36.0], [25.122, 56.327], [23.0, 62.0], [19.076, 72.878],
      [16.0, 74.0], [13.083, 80.271],
    ],
  },

  {
    id: 'cable-bbg',
    name: 'Bay of Bengal Gateway (BBG)',
    status: 'active',
    length: 8000,
    rfsYear: 2015,
    owners: ['Vodafone', 'Etisalat', 'Dialog Axiata', 'Omantel', 'Tata Communications', 'Telekom Malaysia'],
    capacity: '6.4 Tbps',
    landingPoints: [
      { name: 'Fujairah CLS', city: 'Fujairah', country: 'UAE', lat: 25.122, lng: 56.327, station: 'Fujairah CLS' },
      { name: 'Muscat CLS', city: 'Muscat', country: 'Oman', lat: 23.586, lng: 58.406, station: 'Muscat CLS' },
      { name: 'Mumbai CLS', city: 'Mumbai', country: 'India', lat: 19.076, lng: 72.878, station: 'Mumbai CLS' },
      { name: 'Chennai CLS', city: 'Chennai', country: 'India', lat: 13.083, lng: 80.271, station: 'Chennai CLS' },
      { name: 'Mount Lavinia CLS', city: 'Mount Lavinia', country: 'Sri Lanka', lat: 6.830, lng: 79.861, station: 'Mount Lavinia CLS' },
      { name: 'Kuantan CLS', city: 'Kuantan', country: 'Malaysia', lat: 3.820, lng: 103.310, station: 'Kuantan CLS' },
    ],
    route: [
      [25.122, 56.327], [24.0, 58.0], [23.586, 58.406], [22.0, 62.0],
      [20.0, 66.0], [19.076, 72.878], [16.0, 74.0], [13.083, 80.271],
      [10.0, 80.0], [6.830, 79.861], [5.0, 88.0], [3.820, 103.310],
    ],
  },

  {
    id: 'cable-ior',
    name: 'Indian Ocean Region (IOR)',
    status: 'active',
    length: 5500,
    rfsYear: 2018,
    owners: ['GLO1', 'MTN', 'Africa-1 Consortium'],
    capacity: '18 Tbps',
    landingPoints: [
      { name: 'Mumbai CLS', city: 'Mumbai', country: 'India', lat: 19.076, lng: 72.878, station: 'Mumbai CLS' },
      { name: 'Cochin CLS', city: 'Cochin', country: 'India', lat: 9.931, lng: 76.267, station: 'Cochin CLS' },
      { name: 'Male CLS', city: 'Male', country: 'Maldives', lat: 4.175, lng: 73.509, station: 'Male CLS' },
      { name: 'Diego Garcia CLS', city: 'Diego Garcia', country: 'British Indian Ocean Territory', lat: -7.310, lng: 72.417, station: 'Diego Garcia CLS' },
      { name: 'Mombasa CLS', city: 'Mombasa', country: 'Kenya', lat: -4.050, lng: 39.667, station: 'Mombasa CLS' },
    ],
    route: [
      [19.076, 72.878], [16.0, 74.0], [12.0, 75.0], [9.931, 76.267],
      [7.0, 75.0], [4.175, 73.509], [0.0, 73.0], [-4.050, 39.667],
    ],
  },

  {
    id: 'cable-slt',
    name: 'Sri Lanka Telecom Cable',
    status: 'active',
    length: 850,
    rfsYear: 2006,
    owners: ['Sri Lanka Telecom'],
    capacity: '320 Gbps',
    landingPoints: [
      { name: 'Mount Lavinia CLS', city: 'Mount Lavinia', country: 'Sri Lanka', lat: 6.830, lng: 79.861, station: 'Mount Lavinia CLS' },
      { name: 'Chennai CLS', city: 'Chennai', country: 'India', lat: 13.083, lng: 80.271, station: 'Chennai CLS' },
      { name: 'Tuticorin CLS', city: 'Tuticorin', country: 'India', lat: 8.764, lng: 78.134, station: 'Tuticorin CLS' },
    ],
    route: [
      [13.083, 80.271], [11.0, 80.0], [8.764, 78.134], [7.5, 78.5],
      [6.830, 79.861],
    ],
  },

  {
    id: 'cable-dare',
    name: 'Djibouti Africa Regional Express (DARE)',
    status: 'active',
    length: 5600,
    rfsYear: 2019,
    owners: ['Djibouti Telecom', 'Somali Telecom Group', 'Telkom Kenya', 'MTN'],
    capacity: '8 Tbps',
    landingPoints: [
      { name: 'Djibouti CLS', city: 'Djibouti', country: 'Djibouti', lat: 11.588, lng: 43.146, station: 'Djibouti CLS' },
      { name: 'Mogadishu CLS', city: 'Mogadishu', country: 'Somalia', lat: 2.047, lng: 45.344, station: 'Mogadishu CLS' },
      { name: 'Mombasa CLS', city: 'Mombasa', country: 'Kenya', lat: -4.050, lng: 39.667, station: 'Mombasa CLS' },
      { name: 'Dar es Salaam CLS', city: 'Dar es Salaam', country: 'Tanzania', lat: -6.792, lng: 39.280, station: 'Dar es Salaam CLS' },
      { name: 'Maputo CLS', city: 'Maputo', country: 'Mozambique', lat: -25.966, lng: 32.573, station: 'Maputo CLS' },
    ],
    route: [
      [11.588, 43.146], [8.0, 44.0], [4.0, 45.0], [2.047, 45.344],
      [-1.0, 42.0], [-4.050, 39.667], [-5.0, 39.0], [-6.792, 39.280],
      [-10.0, 39.0], [-15.0, 40.0], [-20.0, 36.0], [-25.966, 32.573],
    ],
  },

  {
    id: 'cable-eassy',
    name: 'Eastern Africa Submarine System (EASSy)',
    status: 'active',
    length: 10200,
    rfsYear: 2010,
    owners: ['WIOCC', 'Telkom South Africa', 'Djibouti Telecom', 'Sudatel', 'Zantel', 'MTN'],
    capacity: '4.72 Tbps',
    landingPoints: [
      { name: 'Suez CLS', city: 'Suez', country: 'Egypt', lat: 29.967, lng: 32.549, station: 'Suez CLS' },
      { name: 'Djibouti CLS', city: 'Djibouti', country: 'Djibouti', lat: 11.588, lng: 43.146, station: 'Djibouti CLS' },
      { name: 'Mogadishu CLS', city: 'Mogadishu', country: 'Somalia', lat: 2.047, lng: 45.344, station: 'Mogadishu CLS' },
      { name: 'Mombasa CLS', city: 'Mombasa', country: 'Kenya', lat: -4.050, lng: 39.667, station: 'Mombasa CLS' },
      { name: 'Dar es Salaam CLS', city: 'Dar es Salaam', country: 'Tanzania', lat: -6.792, lng: 39.280, station: 'Dar es Salaam CLS' },
      { name: 'Maputo CLS', city: 'Maputo', country: 'Mozambique', lat: -25.966, lng: 32.573, station: 'Maputo CLS' },
      { name: 'Mtunzini CLS', city: 'Mtunzini', country: 'South Africa', lat: -28.951, lng: 31.785, station: 'Mtunzini CLS' },
    ],
    route: [
      [29.967, 32.549], [24.0, 37.0], [18.0, 40.0], [11.588, 43.146],
      [7.0, 44.0], [2.047, 45.344], [-1.0, 42.0], [-4.050, 39.667],
      [-5.0, 39.0], [-6.792, 39.280], [-10.0, 38.0], [-16.0, 40.0],
      [-22.0, 36.0], [-25.966, 32.573], [-28.951, 31.785],
    ],
  },

  {
    id: 'cable-peace',
    name: 'Pakistan & East Africa Connecting Europe (PEACE)',
    status: 'active',
    length: 15000,
    rfsYear: 2022,
    owners: ['Hengtong Optic-Electric', 'PEACE Cable International', 'Pakistan Telecom', 'Djibouti Telecom', 'Telecom Egypt'],
    capacity: '16 Tbps',
    landingPoints: [
      { name: 'Marseille CLS', city: 'Marseille', country: 'France', lat: 43.296, lng: 5.370, station: 'Marseille CLS' },
      { name: 'Abu Talat CLS', city: 'Abu Talat', country: 'Egypt', lat: 31.050, lng: 29.650, station: 'Abu Talat CLS' },
      { name: 'Zafarana CLS', city: 'Zafarana', country: 'Egypt', lat: 29.117, lng: 32.650, station: 'Zafarana CLS' },
      { name: 'Djibouti CLS', city: 'Djibouti', country: 'Djibouti', lat: 11.588, lng: 43.146, station: 'Djibouti CLS' },
      { name: 'Karachi CLS', city: 'Karachi', country: 'Pakistan', lat: 24.861, lng: 67.011, station: 'Karachi CLS' },
      { name: 'Somalia CLS', city: 'Mogadishu', country: 'Somalia', lat: 2.047, lng: 45.344, station: 'Mogadishu CLS' },
      { name: 'Mombasa CLS', city: 'Mombasa', country: 'Kenya', lat: -4.050, lng: 39.667, station: 'Mombasa CLS' },
    ],
    route: [
      [43.296, 5.370], [39.0, 12.0], [35.0, 20.0], [31.050, 29.650],
      [30.0, 31.0], [29.117, 32.650], [24.0, 37.0], [18.0, 40.0],
      [11.588, 43.146], [7.0, 44.0], [2.047, 45.344], [-1.0, 42.0],
      [-4.050, 39.667],
      [18.0, 42.0], [22.0, 55.0], [24.861, 67.011],
    ],
  },

  {
    id: 'cable-2africa',
    name: '2Africa',
    status: 'under_construction',
    length: 45000,
    rfsYear: 2024,
    owners: ['Meta', 'China Mobile', 'MTN', 'Orange', 'Vodafone', 'WIOCC', 'Telecom Egypt', 'STC'],
    capacity: '180 Tbps',
    landingPoints: [
      { name: 'Genoa CLS', city: 'Genoa', country: 'Italy', lat: 44.407, lng: 8.934, station: 'Genoa CLS' },
      { name: 'Barcelona CLS', city: 'Barcelona', country: 'Spain', lat: 41.386, lng: 2.167, station: 'Barcelona CLS' },
      { name: 'Sesimbra CLS', city: 'Sesimbra', country: 'Portugal', lat: 38.444, lng: -9.102, station: 'Sesimbra CLS' },
      { name: 'Tangier CLS', city: 'Tangier', country: 'Morocco', lat: 35.780, lng: -5.810, station: 'Tangier CLS' },
      { name: 'Carthage CLS', city: 'Tunis', country: 'Tunisia', lat: 36.819, lng: 10.166, station: 'Carthage CLS' },
      { name: 'Abu Talat CLS', city: 'Abu Talat', country: 'Egypt', lat: 31.050, lng: 29.650, station: 'Abu Talat CLS' },
      { name: 'Zafarana CLS', city: 'Zafarana', country: 'Egypt', lat: 29.117, lng: 32.650, station: 'Zafarana CLS' },
      { name: 'Jeddah CLS', city: 'Jeddah', country: 'Saudi Arabia', lat: 21.543, lng: 39.173, station: 'Jeddah CLS' },
      { name: 'Djibouti CLS', city: 'Djibouti', country: 'Djibouti', lat: 11.588, lng: 43.146, station: 'Djibouti CLS' },
      { name: 'Mombasa CLS', city: 'Mombasa', country: 'Kenya', lat: -4.050, lng: 39.667, station: 'Mombasa CLS' },
      { name: 'Dar es Salaam CLS', city: 'Dar es Salaam', country: 'Tanzania', lat: -6.792, lng: 39.280, station: 'Dar es Salaam CLS' },
      { name: 'Cape Town CLS', city: 'Cape Town', country: 'South Africa', lat: -33.925, lng: 18.424, station: 'Cape Town CLS' },
      { name: 'Swakopmund CLS', city: 'Swakopmund', country: 'Namibia', lat: -22.678, lng: 14.527, station: 'Swakopmund CLS' },
      { name: 'Luanda CLS', city: 'Luanda', country: 'Angola', lat: -8.837, lng: 13.234, station: 'Luanda CLS' },
      { name: 'Lagos CLS', city: 'Lagos', country: 'Nigeria', lat: 6.524, lng: 3.379, station: 'Lagos CLS' },
      { name: 'Accra CLS', city: 'Accra', country: 'Ghana', lat: 5.604, lng: -0.187, station: 'Accra CLS' },
      { name: 'Dakar CLS', city: 'Dakar', country: 'Senegal', lat: 14.694, lng: -17.444, station: 'Dakar CLS' },
    ],
    route: [
      [44.407, 8.934], [43.0, 6.0], [41.386, 2.167], [39.0, -4.0],
      [38.444, -9.102], [36.0, -8.0], [35.780, -5.810], [35.0, -2.0],
      [36.0, 3.0], [36.819, 10.166], [34.0, 18.0], [31.050, 29.650],
      [30.0, 31.0], [29.117, 32.650], [27.0, 36.0], [24.0, 38.0],
      [21.543, 39.173], [18.0, 41.0], [14.0, 43.0], [11.588, 43.146],
      [7.0, 44.0], [2.0, 45.0], [-1.0, 42.0], [-4.050, 39.667],
      [-6.0, 39.0], [-6.792, 39.280], [-12.0, 40.0], [-18.0, 38.0],
      [-24.0, 34.0], [-28.951, 31.785], [-33.925, 18.424],
      [-30.0, 16.0], [-26.0, 15.0], [-22.678, 14.527], [-18.0, 14.0],
      [-12.0, 14.0], [-8.837, 13.234], [-4.0, 10.0], [0.0, 8.0],
      [4.0, 5.0], [6.524, 3.379], [5.604, -0.187], [8.0, -8.0],
      [12.0, -14.0], [14.694, -17.444],
    ],
  },

  {
    id: 'cable-havfrue',
    name: 'Havfrue',
    status: 'active',
    length: 7250,
    rfsYear: 2020,
    owners: ['Bulk Infrastructure', 'Google', 'Aqua Comms'],
    capacity: '108 Tbps',
    landingPoints: [
      { name: 'Blaabjerg CLS', city: 'Blaabjerg', country: 'Denmark', lat: 55.760, lng: 8.140, station: 'Blaabjerg CLS' },
      { name: 'Killala CLS', city: 'Killala', country: 'Ireland', lat: 54.190, lng: -9.140, station: 'Killala CLS' },
      { name: 'New Jersey CLS', city: 'Wall', country: 'United States', lat: 40.150, lng: -74.050, station: 'Wall CLS' },
      { name: 'Kristiansand CLS', city: 'Kristiansand', country: 'Norway', lat: 58.160, lng: 8.000, station: 'Kristiansand CLS' },
    ],
    route: [
      [58.160, 8.000], [56.0, 6.0], [55.760, 8.140], [54.0, 4.0],
      [54.190, -9.140], [52.0, -20.0], [48.0, -35.0], [44.0, -50.0],
      [42.0, -60.0], [40.150, -74.050],
    ],
  },

  {
    id: 'cable-dunant',
    name: 'Google Dunant',
    status: 'active',
    length: 6400,
    rfsYear: 2020,
    owners: ['Google', 'Orange'],
    capacity: '250 Tbps',
    landingPoints: [
      { name: 'Virginia Beach CLS', city: 'Virginia Beach', country: 'United States', lat: 36.734, lng: -75.978, station: 'Virginia Beach CLS' },
      { name: 'Saint-Hilaire-de-Riez CLS', city: 'Saint-Hilaire-de-Riez', country: 'France', lat: 46.700, lng: -1.943, station: 'Saint-Hilaire-de-Riez CLS' },
    ],
    route: [
      [36.734, -75.978], [40.0, -60.0], [44.0, -42.0], [47.0, -25.0],
      [46.700, -1.943],
    ],
  },

  {
    id: 'cable-grace-hopper',
    name: 'Google Grace Hopper',
    status: 'active',
    length: 7200,
    rfsYear: 2022,
    owners: ['Google'],
    capacity: '352 Tbps',
    landingPoints: [
      { name: 'New York CLS', city: 'New York', country: 'United States', lat: 40.713, lng: -74.006, station: 'New York CLS' },
      { name: 'Bude CLS', city: 'Bude', country: 'United Kingdom', lat: 50.829, lng: -4.544, station: 'Bude CLS' },
      { name: 'Bilbao CLS', city: 'Bilbao', country: 'Spain', lat: 43.263, lng: -2.935, station: 'Bilbao CLS' },
    ],
    route: [
      [40.713, -74.006], [43.0, -55.0], [47.0, -38.0], [50.829, -4.544],
      [48.0, -3.0], [45.0, -3.0], [43.263, -2.935],
    ],
  },

  {
    id: 'cable-amitie',
    name: 'Meta Amitié',
    status: 'active',
    length: 6800,
    rfsYear: 2021,
    owners: ['Meta', 'Microsoft', 'Orange', 'Vodafone'],
    capacity: '400 Tbps',
    landingPoints: [
      { name: 'Bordeaux CLS', city: 'Bordeaux', country: 'France', lat: 44.838, lng: -0.572, station: 'Bordeaux CLS' },
      { name: 'Virginia Beach CLS', city: 'Virginia Beach', country: 'United States', lat: 36.734, lng: -75.978, station: 'Virginia Beach CLS' },
      { name: 'Le Pouliguen CLS', city: 'Le Pouliguen', country: 'France', lat: 47.273, lng: -2.430, station: 'Le Pouliguen CLS' },
    ],
    route: [
      [36.734, -75.978], [40.0, -58.0], [44.0, -40.0], [47.0, -24.0],
      [47.273, -2.430], [45.5, -2.0], [44.838, -0.572],
    ],
  },

  {
    id: 'cable-brusa',
    name: 'Brusa',
    status: 'active',
    length: 11500,
    rfsYear: 2021,
    owners: ['Telefonica', 'Globo', 'Telebras', 'Angola Cables'],
    capacity: '134 Tbps',
    landingPoints: [
      { name: 'Virginia Beach CLS', city: 'Virginia Beach', country: 'United States', lat: 36.734, lng: -75.978, station: 'Virginia Beach CLS' },
      { name: 'Fortaleza CLS', city: 'Fortaleza', country: 'Brazil', lat: -3.717, lng: -38.543, station: 'Fortaleza CLS' },
      { name: 'Santos CLS', city: 'Santos', country: 'Brazil', lat: -23.961, lng: -46.327, station: 'Santos CLS' },
      { name: 'Rio de Janeiro CLS', city: 'Rio de Janeiro', country: 'Brazil', lat: -22.907, lng: -43.173, station: 'Rio de Janeiro CLS' },
    ],
    route: [
      [36.734, -75.978], [32.0, -62.0], [26.0, -55.0], [18.0, -50.0],
      [10.0, -46.0], [3.0, -43.0], [-3.717, -38.543], [-8.0, -38.0],
      [-14.0, -40.0], [-20.0, -42.0], [-23.961, -46.327], [-22.907, -43.173],
    ],
  },

  {
    id: 'cable-sail',
    name: 'SAIL',
    status: 'outage',
    length: 6200,
    rfsYear: 2018,
    owners: ['Angola Cables', 'Telebras'],
    capacity: '40 Tbps',
    landingPoints: [
      { name: 'Fortaleza CLS', city: 'Fortaleza', country: 'Brazil', lat: -3.717, lng: -38.543, station: 'Fortaleza CLS' },
      { name: 'Luanda CLS', city: 'Luanda', country: 'Angola', lat: -8.837, lng: 13.234, station: 'Luanda CLS' },
      { name: 'Sangano CLS', city: 'Sangano', country: 'Angola', lat: -9.160, lng: 13.200, station: 'Sangano CLS' },
    ],
    route: [
      [-3.717, -38.543], [-6.0, -34.0], [-8.0, -28.0], [-10.0, -20.0],
      [-10.0, -10.0], [-9.160, 13.200], [-8.837, 13.234],
    ],
  },

  {
    id: 'cable-malbec',
    name: 'Malbec',
    status: 'active',
    length: 3900,
    rfsYear: 2023,
    owners: ['Google', 'Telefonica', 'Girard'],
    capacity: '72 Tbps',
    landingPoints: [
      { name: 'Rio de Janeiro CLS', city: 'Rio de Janeiro', country: 'Brazil', lat: -22.907, lng: -43.173, station: 'Rio de Janeiro CLS' },
      { name: 'Santos CLS', city: 'Santos', country: 'Brazil', lat: -23.961, lng: -46.327, station: 'Santos CLS' },
      { name: 'Las Toninas CLS', city: 'Las Toninas', country: 'Argentina', lat: -36.490, lng: -56.685, station: 'Las Toninas CLS' },
      { name: 'Buenos Aires CLS', city: 'Buenos Aires', country: 'Argentina', lat: -34.604, lng: -58.382, station: 'Buenos Aires CLS' },
    ],
    route: [
      [-22.907, -43.173], [-23.961, -46.327], [-26.0, -48.0], [-30.0, -50.0],
      [-34.0, -53.0], [-36.490, -56.685], [-35.0, -58.0], [-34.604, -58.382],
    ],
  },
];


export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get('status');

    if (cachedData && Date.now() - cachedData.time < CACHE_TTL) {
      const filtered = statusFilter
        ? cachedData.data.filter(c => c.status === statusFilter)
        : cachedData.data;

      return NextResponse.json({
        source: 'Submarine Cable Intelligence Database (cached)',
        timestamp: cachedData.time,
        count: filtered.length,
        totalCables: cachedData.data.length,
        cables: filtered,
      });
    }

    cachedData = { time: Date.now(), data: SUBMARINE_CABLES };

    const filtered = statusFilter
      ? cachedData.data.filter(c => c.status === statusFilter)
      : cachedData.data;

    const statusCounts = {
      active: SUBMARINE_CABLES.filter(c => c.status === 'active').length,
      under_construction: SUBMARINE_CABLES.filter(c => c.status === 'under_construction').length,
      planned: SUBMARINE_CABLES.filter(c => c.status === 'planned').length,
      outage: SUBMARINE_CABLES.filter(c => c.status === 'outage').length,
      maintenance: SUBMARINE_CABLES.filter(c => c.status === 'maintenance').length,
    };

    const totalKm = SUBMARINE_CABLES.reduce((sum, c) => sum + c.length, 0);
    const totalLandingPoints = SUBMARINE_CABLES.reduce((sum, c) => sum + c.landingPoints.length, 0);

    return NextResponse.json({
      source: 'Submarine Cable Intelligence Database',
      timestamp: Date.now(),
      count: filtered.length,
      totalCables: SUBMARINE_CABLES.length,
      summary: {
        totalLength: `${(totalKm / 1000).toFixed(1)}k km`,
        totalKm,
        totalLandingPoints,
        statusCounts,
      },
      cables: filtered,
    });
  } catch (error: any) {
    console.error('Submarine Cable API error:', error.message);
    return NextResponse.json(
      {
        source: 'Submarine Cable Intelligence Database (error)',
        timestamp: Date.now(),
        count: 0,
        totalCables: 0,
        cables: [],
        error: error.message,
      },
      { status: 500 }
    );
  }
}
