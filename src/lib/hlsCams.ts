
export interface HlsIpCam {
  id: string;
  name: string;
  url: string;
  lat: number;
  lng: number;
  city: string;
  country: string;
  countryCode: string;
  operator: string;
  type: string;
}

export const HLS_IPCAMS: HlsIpCam[] = [
  { id: 'HLS-DE-001', name: 'DE 72 @ American Blvd', url: 'https://video.deldot.gov:443/live/NCAM182.stream/playlist.m3u8', lat: 39.5837, lng: -75.6778, city: 'Dover', country: 'United States', countryCode: 'US', operator: 'DelDOT', type: 'Traffic Cam' },
  { id: 'HLS-DE-002', name: 'US 13 @ DE 300', url: 'https://video.deldot.gov:443/live/KCAM091.stream/playlist.m3u8', lat: 39.3065, lng: -75.6073, city: 'Smyrna', country: 'United States', countryCode: 'US', operator: 'DelDOT', type: 'Traffic Cam' },
  { id: 'HLS-DE-003', name: 'DE 1 @ Indian River Inlet', url: 'https://video.deldot.gov:443/live/SCAM098.stream/playlist.m3u8', lat: 38.6154, lng: -75.0658, city: 'Bethany Beach', country: 'United States', countryCode: 'US', operator: 'DelDOT', type: 'Traffic Cam' },
  { id: 'HLS-VA-001', name: 'I-95 MM 67.1 SB · Richmond', url: 'https://media-sfs5.vdotcameras.com:443/rtplive/RichmondCS095SB0671/playlist.m3u8', lat: 37.4318, lng: -77.4317, city: 'Richmond', country: 'United States', countryCode: 'US', operator: 'VDOT', type: 'Traffic Cam' },
  { id: 'HLS-VA-002', name: 'US-460 / SR-726 Mt Athos', url: 'https://media-sfs1.vdotcameras.com:443/rtplive/SalemUS460MtAthos/playlist.m3u8', lat: 37.3857, lng: -79.0630, city: 'Salem', country: 'United States', countryCode: 'US', operator: 'VDOT', type: 'Traffic Cam' },
  { id: 'HLS-VA-003', name: 'US-17 SB James River Bridge', url: 'https://media-sfs4.vdotcameras.com:443/rtplive/TLJamesRiverBridge040South/playlist.m3u8', lat: 36.9787, lng: -76.4984, city: 'Newport News', country: 'United States', countryCode: 'US', operator: 'VDOT', type: 'Traffic Cam' },
  { id: 'HLS-VA-004', name: 'I-81 MM 217.0 NB · Staunton', url: 'https://media-sfs1.vdotcameras.com:443/rtplive/StauntonI81MM217N/playlist.m3u8', lat: 38.0760, lng: -79.0869, city: 'Staunton', country: 'United States', countryCode: 'US', operator: 'VDOT', type: 'Traffic Cam' },
  { id: 'HLS-VA-005', name: 'Princess Anne Rd & S Independence', url: 'https://media-sfs6.vdotcameras.com:443/rtplive/vabeachcam002/playlist.m3u8', lat: 36.7891, lng: -76.1125, city: 'Virginia Beach', country: 'United States', countryCode: 'US', operator: 'VDOT', type: 'Traffic Cam' },
  { id: 'HLS-VA-006', name: 'I-495 MM 42.5 NB · Beltway', url: 'https://media-sfs8.vdotcameras.com:443/rtplive/NO0500/playlist.m3u8', lat: 38.9645, lng: -77.1812, city: 'McLean', country: 'United States', countryCode: 'US', operator: 'VDOT', type: 'Traffic Cam' },
  { id: 'HLS-MD-001', name: 'MD 713036 · Bowie', url: 'https://strmr5.sha.maryland.gov/rtplive/080162f0000200fa0064d336c4235c0a/playlist.m3u8', lat: 39.1845, lng: -76.7987, city: 'Bowie', country: 'United States', countryCode: 'US', operator: 'MDSHA', type: 'Traffic Cam' },
  { id: 'HLS-MD-002', name: 'RWIS US 340 @ MD 180', url: 'https://strmr3.sha.maryland.gov/rtplive/3200a76b008000d30050fa36c4235c0a/playlist.m3u8', lat: 39.3562, lng: -77.5820, city: 'Frederick', country: 'United States', countryCode: 'US', operator: 'MDSHA', type: 'Traffic Cam' },
  { id: 'HLS-LA-001', name: 'I-10 Baton Rouge Cam 001', url: 'https://ITSStreamingBR2.dotd.la.gov/public/shr-cam-001.streams/playlist.m3u8', lat: 30.4565, lng: -91.1841, city: 'Baton Rouge', country: 'United States', countryCode: 'US', operator: 'LaDOTD', type: 'Traffic Cam' },
  { id: 'HLS-LA-002', name: 'I-10 Baton Rouge Cam 024', url: 'https://ITSStreamingBR2.dotd.la.gov/public/shr-cam-024.streams/playlist.m3u8', lat: 30.3600, lng: -91.2400, city: 'Baton Rouge', country: 'United States', countryCode: 'US', operator: 'LaDOTD', type: 'Traffic Cam' },
  { id: 'HLS-ID-001', name: 'ATCS Simpang Atmosukarto', url: 'https://cctvjss.jogjakota.go.id/atcs/ATCS_Simpang_Atmosukarto.stream/playlist.m3u8', lat: -7.7883, lng: 110.3783, city: 'Yogyakarta', country: 'Indonesia', countryCode: 'ID', operator: 'ATCS YK', type: 'Traffic Cam' },
  { id: 'HLS-ID-002', name: 'ATCS Simpang Sutisna Senja', url: 'https://atcs.tasikmalayakota.go.id/camera/sutisnasenjaya.m3u8', lat: -7.3241, lng: 108.2186, city: 'Tasikmalaya', country: 'Indonesia', countryCode: 'ID', operator: 'ATCS TSK', type: 'Traffic Cam' },
  { id: 'HLS-ID-003', name: 'Serbaraja Toll 12+750', url: 'https://info.serbaraja-tollroad.co.id:20443/LiveApp/streams/10019.m3u8', lat: -6.3200, lng: 106.4800, city: 'Tangerang', country: 'Indonesia', countryCode: 'ID', operator: 'Serbaraja', type: 'Traffic Cam' },
  { id: 'HLS-IT-001', name: 'Florence · Via della Scala', url: 'https://5e0add8153fcd.streamlock.net:1936/vedetta/via-della-scala.stream/playlist.m3u8', lat: 43.7734, lng: 11.2485, city: 'Florence', country: 'Italy', countryCode: 'IT', operator: 'VEDETTA', type: 'City Cam' },
  { id: 'HLS-GR-001', name: 'Livadeia CCTV 1', url: 'https://livecameras.gr:30443/live/leva1/playlist.m3u8', lat: 38.4382, lng: 22.8790, city: 'Livadeia', country: 'Greece', countryCode: 'GR', operator: 'LiveCamerasGR', type: 'City Cam' },
  { id: 'HLS-GR-002', name: 'Dikastro CCTV 1', url: 'https://livecameras.gr:30443/live/dika1/playlist.m3u8', lat: 38.9923, lng: 21.9421, city: 'Dikastro', country: 'Greece', countryCode: 'GR', operator: 'LiveCamerasGR', type: 'City Cam' },
  { id: 'HLS-PL-001', name: 'Opole · Rynek (place du marché)', url: 'https://hoktastream4.webcamera.pl/opole_cam_8b53d4/opole_cam_8b53d4.stream/playlist.m3u8', lat: 50.6712, lng: 17.9260, city: 'Opole', country: 'Poland', countryCode: 'PL', operator: 'WebcameraPL', type: 'City Cam' },
];
