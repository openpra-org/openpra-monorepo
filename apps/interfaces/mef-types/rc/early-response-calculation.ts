/** Inputs supplied by a consequence calculation, not entered as Step 02 response settings. */
export interface RcResponseDoseRate {
  cellIndex: number;
  startSeconds: number;
  endSeconds: number;
  /** Unprotected dose rates for the named organ, in Sv/s. */
  organ: string;
  cloudshineSvPerSecond: number;
  inhalationSvPerSecond: number;
  groundshineSvPerSecond: number;
  skinSvPerSecond: number;
  /** Portion of inhalation due to radioiodine; included in inhalationSvPerSecond. */
  iodineInhalationSvPerSecond?: number;
}

export interface RcResponseCalculationInput {
  originCellIndex: number;
  /** Organ whose dose is being calculated; all rate intervals must use this organ. */
  targetOrgan?: string;
  /** First plume arrival at each cell, measured from accident initiation. */
  plumeArrivalSecondsByCell?: number[];
  /** Zero-based sector toward which the plume travels; required for keyhole evacuation. */
  plumeSector?: number;
  /** Precipitation state used for travel in each cell. */
  rainingByCell?: boolean[];
  /** Projected critical-organ dose for relocation, keyed by cohort ID. */
  projectedDoseSvByCohort?: Record<string, number>;
  /** Time-resolved, unprotected environmental dose rates. Omit for a timing-only result. */
  doseRates?: RcResponseDoseRate[];
  /** Breathing rate used to form the unprotected inhalation rate, in m³/s. */
  referenceBreathingRateCubicMetresPerSecond?: number;
  /** Step 05 integration time from accident initiation. */
  integrationSeconds?: number;
}

export interface RcResponseInterval {
  activity: "normal" | "sheltering" | "evacuation";
  cellIndex: number;
  startSeconds: number;
  endSeconds: number;
}

export interface RcResponseCohortResult {
  cohortId: string;
  cohortName: string;
  population: number | null;
  resultWeightFraction: number | null;
  shelterStartsSeconds: number | null;
  evacuationStartsSeconds: number | null;
  relocationSeconds: number | null;
  intervals: RcResponseInterval[];
  doseSv: { organ: string; cloudshine: number; inhalation: number; groundshine: number; skin: number; total: number } | null;
}

export interface RcResponseCalculationResult {
  modelRevision: number;
  siteRevision: number;
  originCellIndex: number;
  targetOrgan?: string;
  issues: string[];
  cohorts: RcResponseCohortResult[];
}
