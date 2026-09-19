import type { RcSourceTerm } from "./source-term";

export type RcWindSectors = 16 | 32 | 48 | 64;
export interface RcWeatherRecord {
  day: number;
  period: number;
  windSector: number;
  windSpeedMetresPerSecond: number;
  stabilityClass: "A" | "B" | "C" | "D" | "E" | "F" | "G";
  rainCode: number;
  rainMillimetresPerHour: number | null;
  mixingHeightMetres?: number;
  original: string;
}
export interface RcWeatherData {
  recordCount: number;
  dayCount: number;
  first: { day: number; period: number };
  last: { day: number; period: number };
  intervalMinutes: 15 | 30 | 60;
  windSectors?: RcWindSectors;
  utcOffsetHours?: number;
  mixingHeightMode: "per_record" | "seasonal" | "missing";
  seasonalHeightsMetres?: number[];
  gaps: number;
  missingPeriods: number;
  maxWindSector: number;
  classGRecords: number;
  traceRainRecords: number;
}
export interface RcWeatherConfiguration {
  latitude: number;
  longitude: number;
  dateGroups: { start: string; end: string }[];
  dataset: string;
  intervalMinutes: 15 | 30 | 60;
  windSectors: RcWindSectors;
  stabilityMethod: "TEMPERATURE_GRADIENT" | "TURNER" | "SRDT";
  utcOffsetHours: number;
  perRecordMixingHeight: boolean;
  morningHeightsMetres: number[];
  afternoonHeightsMetres: number[];
}
export interface RcWeatherSettings {
  latitude?: number;
  longitude?: number;
  year?: number;
  windSectors?: RcWindSectors;
  nearbySite?: { latitude: number; longitude: number };
}
/** OpenPRA request record, not an OpenRC executable input or completed collection. */
export interface RcWeatherCollectionRequest {
  status: "prepared";
  latitude: number;
  longitude: number;
  start: string;
  end: string;
  preparedAt: string;
}
export interface RcWeatherInputs {
  revision: number;
  settings: RcWeatherSettings;
  data?: RcWeatherData;
  configuration?: RcWeatherConfiguration;
  weatherFile?: NonNullable<RcSourceTerm["originalFile"]>;
  configurationFile?: NonNullable<RcSourceTerm["originalFile"]>;
  review?: { latitude: number; longitude: number; reviewedAt: string; reviewedBy: string };
  collectionRequest?: RcWeatherCollectionRequest;
}
export interface RcWeatherPage { revision: number; total: number; offset: number; records: RcWeatherRecord[] }
