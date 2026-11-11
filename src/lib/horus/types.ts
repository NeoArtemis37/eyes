

export type LatLng = { lat: number; lng: number };

export type Target = {
  id: string;
  name: string;
  type:
    | "monument"
    | "place"
    | "building"
    | "ip"
    | "domain"
    | "flight"
    | "vessel"
    | "satellite"
    | "antenna"
    | "camera"
    | "custom";
  lat: number;
  lng: number;
  accuracyM: number; // surface accuracy in meters
  country?: string;
  region?: string;
  source?: string;
  meta?: Record<string, string | number | boolean>;
  createdAt: number;
};

export type TelemetryEvent = {
  id: string;
  ts: number;
  level: "info" | "warn" | "alert" | "crit";
  source: string;
  message: string;
  lat?: number;
  lng?: number;
};

export type FeedItem = {
  id: string;
  ts: number;
  source: string;
  title: string;
  summary: string;
  lat?: number;
  lng?: number;
  level: "info" | "warn" | "alert" | "crit";
  url?: string;
};

export type ModuleId =
  | "overview"
  | "targeting"
  | "ipintel"
  | "flights"
  | "maritime"
  | "sats"
  | "weather"
  | "quakes"
  | "rf"
  | "news"
  | "wiki"
  | "ai";

export type MapMode = "3d" | "2d";
