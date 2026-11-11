export const uid = () =>
  Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

export const fmtCoord = (lat: number, lng: number) => {
  const ns = lat >= 0 ? "N" : "S";
  const ew = lng >= 0 ? "E" : "W";
  return `${Math.abs(lat).toFixed(5)}°${ns} ${Math.abs(lng).toFixed(5)}°${ew}`;
};

export const fmtDist = (m: number) => {
  if (m < 1000) return `${m.toFixed(0)} m`;
  return `${(m / 1000).toFixed(1)} km`;
};

export const fmtClock = (ts: number) => {
  const d = new Date(ts);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(
    d.getUTCSeconds()
  )}Z`;
};

export const fmtDate = (ts: number) => {
  const d = new Date(ts);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(
    d.getUTCDate()
  )}`;
};

export const haversine = (
  a: [number, number],
  b: [number, number]
): number => {
  const R = 6371000;
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(b[0] - a[0]);
  const dLng = toRad(b[1] - a[1]);
  const lat1 = toRad(a[0]);
  const lat2 = toRad(b[0]);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};

export const randInBbox = (
  bbox: [number, number, number, number]
): [number, number] => {
  const [minLat, minLng, maxLat, maxLng] = bbox;
  return [
    minLat + Math.random() * (maxLat - minLat),
    minLng + Math.random() * (maxLng - minLng),
  ];
};
