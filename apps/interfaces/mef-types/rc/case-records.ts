import type { RcSourceTerm } from "./source-term";
import type { RcSiteReceptors } from "./site-receptors";
import type { RcWeatherInputs } from "./weather";
import type { RcTransportInputs } from "./transport";
import type { RcDoseInputs } from "./dose-inputs";
import type { ProtectiveActionAnalysis, HealthEffectsAnalysis, EconomicFactorsAnalysis } from "./radiological-consequence-analysis";
import type { RcConsequenceMetric, RcMetricQuantity, RcMetricStatistics } from "./metrics";

/** A workbook record of saved inputs, not an executable solver input deck. */
export interface RcCaseData {
  schemaVersion: 1 | 2 | 3;
  categoryId: string;
  metrics?: RcConsequenceMetric[];
  source?: RcSourceTerm;
  site?: RcSiteReceptors;
  response?: Pick<ProtectiveActionAnalysis, "protectiveActionsIncluded" | "cohortModeling" | "responseTiming" | "earlyResponseModel">;
  weather?: RcWeatherInputs;
  transport?: RcTransportInputs;
  dose?: RcDoseInputs;
  health?: HealthEffectsAnalysis;
  economy?: EconomicFactorsAnalysis;
  excludedSteps?: RcCaseStep[];
}
export type RcCaseStep = "source" | "site" | "weather" | "transport" | "dose" | "health" | "economy";
export interface RcCaseCheck { key: RcCaseStep | "links"; title: string; items: string[] }
export interface RcCaseFile {
  kind: RcCaseStep | "response";
  purpose: string;
  file: NonNullable<RcSourceTerm["originalFile"]>;
}
export interface RcCaseSnapshot {
  id: string;
  label: string;
  categoryId: string;
  file: NonNullable<RcSourceTerm["originalFile"]>;
  inputHash: string;
  createdBy: string;
  reviewItems: number;
  inventoryCount: number;
  receptorCount: number;
  trialCount: number;
  integrationSeconds?: number;
  metrics?: RcCaseSnapshotMetric[];
  versions?: string;
}
export interface RcCaseSnapshotMetric { id: string; name: string; quantity: RcMetricQuantity; windowSeconds?: number; unit?: string; statistics?: RcMetricStatistics }
export interface RcResultStatistics {
  mean?: number;
  percentiles: { percentile: number; value: number }[];
  exceedances: { threshold: number; probability: number }[];
}
export interface RcCategoryResultValues {
  snapshotId: string;
  metricId: string;
  statistics: RcResultStatistics;
  version: string;
  reference: string;
  confirmed: true;
}
export interface RcCategoryResult extends RcCategoryResultValues {
  id: string;
  categoryId: string;
  unit: string;
  file: NonNullable<RcSourceTerm["originalFile"]>;
  recordedBy: string;
  valueSource: "transcribed";
}
export interface RcCaseRecords { revision: number; snapshots: RcCaseSnapshot[]; results: RcCategoryResult[] }
export type RcCaseDataset = "inventory" | "releases" | "fractions" | "receptors" | "response" | "weather" | "deposition" | "decay" | "dose" | "health" | "healthModel" | "riskSources" | "regions" | "crops" | "costs" | "economySettings";
export interface RcCaseTable { columns: string[]; rows: (string | number | null)[][]; units: string; offset: number; total: number }
export interface RcCaseTextPage { text: string; offset: number; total: number }
export interface RcCaseSelection { categoryId: string; versions: string; snapshotId?: string }
export interface RcCaseReview { schemaVersion: 1 | 2 | 3; files: RcCaseFile[]; embedded: { id: "health-original" | "economy-original"; filename: string; purpose: string }[]; excludedSteps: RcCaseStep[]; checks: RcCaseCheck[] }
