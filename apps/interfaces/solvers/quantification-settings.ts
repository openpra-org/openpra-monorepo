export type SolverTarget = "SCRAM" | "PRAXIS";

export type ConvergenceIntervalPolicy = "bayes" | "wald";

export interface QuantificationSettings {
  solver?: SolverTarget;

  mocus?: boolean;
  bdd?: boolean;
  zbdd?: boolean;
  pdag?: boolean;
  adaptive?: boolean;

  rareEvent?: boolean;
  mcub?: boolean;
  monteCarlo?: boolean;

  primeImplicants?: boolean;
  probability?: boolean;
  importance?: boolean;
  uncertainty?: boolean;
  ccf?: boolean;
  sil?: boolean;

  limitOrder?: number;
  cutOff?: number;
  missionTime?: number;
  timeStep?: number;
  numTrials?: number;
  numQuantiles?: number;
  numBins?: number;
  seed?: number;

  confidence?: number;
  delta?: number;
  burnIn?: number;
  earlyStop?: boolean;
  ciPolicy?: ConvergenceIntervalPolicy;
  batchSize?: number;
  sampleSize?: number;
  overheadRatio?: number;

  noKn?: boolean;
  noXor?: boolean;
  keepNullGates?: boolean;
  compilationLevel?: number;

  oracleP?: number;
  watchMode?: boolean;
}

export interface QuantificationRequest {
  id: number;
  name?: string;
  booleanModelRef: number;
  bindingTableRef: number;
  ccfGroupTableRef?: number;
  settings: QuantificationSettings;
  modelVersionRef?: string;
  configurationControlRecordId?: string;
}
