import type { RcSourceTerm } from "./source-term";
import type { RcSiteReceptors } from "./site-receptors";
import type { RcWeatherInputs } from "./weather";
import type { RcTransportInputs } from "./transport";
import type { RcDoseInputs } from "./dose-inputs";
import type { ProtectiveActionAnalysis } from "./radiological-consequence-analysis";

/** A workbook record of saved inputs, not an executable solver input deck. */
export interface RcCaseData {
  schemaVersion: 1;
  categoryId: string;
  source?: RcSourceTerm;
  site?: RcSiteReceptors;
  response?: Pick<ProtectiveActionAnalysis, "protectiveActionsIncluded" | "cohortModeling" | "responseTiming" | "earlyResponseModel">;
  weather?: RcWeatherInputs;
  transport?: RcTransportInputs;
  dose?: RcDoseInputs;
}
export type RcCaseStep = "source" | "site" | "weather" | "transport" | "dose";
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
}
export interface RcLinkedResultValues {
  snapshotId: string;
  receptorId: string;
  trialId: string;
  dose: number;
  unit: "Sv" | "mSv" | "µSv";
  version: string;
  reference: string;
  confirmed: true;
}
export interface RcLinkedResult extends RcLinkedResultValues {
  id: string;
  file: NonNullable<RcSourceTerm["originalFile"]>;
  integrationSeconds: number;
  recordedBy: string;
  valueSource: "transcribed";
}
export interface RcCaseRecords { revision: number; snapshots: RcCaseSnapshot[]; results: RcLinkedResult[] }
export type RcCaseDataset = "inventory" | "releases" | "fractions" | "receptors" | "response" | "weather" | "deposition" | "decay" | "dose";
export interface RcCaseTable { columns: string[]; rows: (string | number | null)[][]; units: string; offset: number; total: number }
export interface RcCaseTextPage { text: string; offset: number; total: number }
export interface RcCaseSelection { categoryId: string; versions: string; snapshotId?: string }
export interface RcCaseReview { files: RcCaseFile[]; checks: RcCaseCheck[] }
