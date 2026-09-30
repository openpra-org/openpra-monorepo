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
export type RcWeatherTreatmentMode = "fixed_start" | "uniform_bin" | "weighted_bin" | "stratified" | "supplied_sequence" | "constant";
export type RcWeatherMixingHeightMode = "file" | "seasonal_day_only" | "seasonal_day_night";
export interface RcWeatherPosition { day?: number; period?: number }
export interface RcWeatherSampling {
  randomSeed?: number;
  samplesPerBin?: number;
  samplesPerDay?: number;
  rainRateBreakpointsMmPerHour?: number[];
  rainDistanceEndpointsKm?: number[];
  binSamples?: Record<string, number>;
}
export interface RcConstantWeather {
  windSpeedMetresPerSecond?: number;
  windDirection?: "uniform" | "fixed";
  windTowardDegrees?: number;
  stabilityClass?: RcWeatherRecord["stabilityClass"];
  rainMillimetresPerHour?: number;
  mixingHeightMetres?: number;
}
export interface RcBoundaryWeather {
  enabled: boolean;
  startBand?: number;
  windSpeedMetresPerSecond?: number;
  stabilityClass?: RcWeatherRecord["stabilityClass"];
  rainMillimetresPerHour?: number;
  mixingHeightMetres?: number;
}
export interface RcWeatherModel {
  mode: RcWeatherTreatmentMode;
  mixingHeight?: RcWeatherMixingHeightMode;
  fixedStart?: RcWeatherPosition;
  suppliedSequenceStart?: RcWeatherPosition;
  sampling?: RcWeatherSampling;
  constant?: RcConstantWeather;
  boundary?: RcBoundaryWeather;
}
export interface RcWeatherTrial {
  id: string;
  source: "file" | "constant";
  startRecordIndex?: number;
  day?: number;
  period?: number;
  selectionGroup: string;
  probability: number;
  windSpeedMetresPerSecond: number;
  windTowardDegrees: number;
  stabilityClass: RcWeatherRecord["stabilityClass"];
  rainMillimetresPerHour: number;
  mixingHeightMetres: number;
}
export interface RcWeatherTrialBin {
  id: string;
  label: string;
  population: number;
  selected: number;
  probability: number;
}
export interface RcWeatherWindRoseSector { sector: number; towardDegrees: number; probability: number }
export interface RcWeatherTrialSet {
  generatedAt: string;
  mode: RcWeatherTreatmentMode;
  trialCount: number;
  probabilityTotal: number;
  bins: RcWeatherTrialBin[];
  windRose: RcWeatherWindRoseSector[];
  boundary?: RcBoundaryWeather;
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
  model?: RcWeatherModel;
  trialSet?: RcWeatherTrialSet;
  data?: RcWeatherData;
  configuration?: RcWeatherConfiguration;
  weatherFile?: NonNullable<RcSourceTerm["originalFile"]>;
  configurationFile?: NonNullable<RcSourceTerm["originalFile"]>;
  review?: { latitude: number; longitude: number; reviewedAt: string; reviewedBy: string };
  collectionRequest?: RcWeatherCollectionRequest;
}
export interface RcWeatherPage { revision: number; total: number; offset: number; records: RcWeatherRecord[] }
export interface RcWeatherTrialPage { revision: number; total: number; offset: number; trials: RcWeatherTrial[] }
