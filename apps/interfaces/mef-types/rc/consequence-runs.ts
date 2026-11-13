import type { RcResultStatistics } from "./case-records";
import type { RcMetricStatistics } from "./metrics";

export type RcConsequenceRunStatus = "QUEUED" | "RUNNING" | "SUCCEEDED" | "FAILED" | "CANCELLED";
export type RcConsequenceRunReceptorKind = "EAB_MAXIMUM" | "DISTANCE_PROFILE";
export type RcConsequenceRunFileKind = "input" | "output";
export type RcConsequenceRunTrialOrder = "trial" | "dose";

export interface RcConsequenceRunRequest {
  snapshotId: string;
  metricId: string;
  distancesMetres: number[];
  heightMetres: number;
}

export interface RcConsequenceRunFailure {
  kind: string;
  code: string;
  message: string;
}

export interface RcConsequenceRunProgress {
  completed: number;
  total: number;
  queuedJobs: number | null;
  workers: number | null;
}

export interface RcConsequenceRunNote {
  code: string;
  message: string;
}

export interface RcConsequenceRun {
  id: string;
  label: string;
  categoryId: string;
  snapshotId: string;
  snapshotLabel: string;
  metricId: string;
  metricName: string;
  unit: string;
  receptorKind: RcConsequenceRunReceptorKind;
  windowSeconds: number;
  statistics: RcMetricStatistics;
  distancesMetres: number[];
  heightMetres: number;
  trialCount: number;
  jobCount: number;
  notes: RcConsequenceRunNote[];
  status: RcConsequenceRunStatus;
  requestedBy: string;
  requestedAt: string;
  startedAt: string | null;
  completedAt: string | null;
  engineVersion: string | null;
  failure: RcConsequenceRunFailure | null;
  progress: RcConsequenceRunProgress | null;
}

export interface RcConsequenceRunNuclideDose {
  nuclide: string;
  doseSv: number;
}

export interface RcConsequenceRunDistance {
  distanceMetres: number;
  statistics: RcResultStatistics;
  minimumSv: number;
  maximumSv: number;
  groundDepositionBqPerSquareMetre?: number;
  nuclideDoses?: RcConsequenceRunNuclideDose[];
}

export interface RcConsequenceRunResult {
  distances: RcConsequenceRunDistance[];
  missingDoseCoefficients?: string[];
}

export interface RcConsequenceRunDetails {
  run: RcConsequenceRun;
  result: RcConsequenceRunResult | null;
}

export interface RcConsequenceRunTrialRow {
  trialId: string;
  start: string;
  selectionGroup: string;
  stabilityClass: string;
  windSpeedMetresPerSecond: number;
  windTowardDegrees: number;
  mixingHeightMetres: number;
  doseSv: number;
  dispersionSecondsPerCubicMetre: number | null;
}

export interface RcConsequenceRunTrialPage {
  distanceMetres: number;
  total: number;
  offset: number;
  size: number;
  rows: RcConsequenceRunTrialRow[];
}

export interface RcConsequenceRunTextPage {
  text: string;
  offset: number;
  total: number;
  size: number;
}

export interface RcConsequenceRunSetupMetric {
  id: string;
  name: string;
  receptorKind: RcConsequenceRunReceptorKind | null;
  runnable: boolean;
  reason: string;
}

export interface RcConsequenceRunSetup {
  snapshotId: string;
  trialCount: number;
  heightMetres: number | null;
  distancesMetres: number[];
  metrics: RcConsequenceRunSetupMetric[];
}

export interface RcConsequenceRunRecordRequest {
  baseRevision: number;
  distanceIndex: number;
}
