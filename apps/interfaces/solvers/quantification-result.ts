import { BooleanNodeId, BasicEventId } from "./boolean-logic";
import { SolverTarget, ConvergenceIntervalPolicy } from "./quantification-settings";

export interface RuntimeSummary {
  analysisSeconds?: number;
  totalSeconds?: number;
}

export interface CutSetLiteral {
  basicEventId: BasicEventId;
  negated: boolean;
}

export interface CutSet {
  order: number;
  literals: CutSetLiteral[];
  probability?: number;
  contribution?: number;
}

export interface CutSetResult {
  products: number;
  originalProducts?: number;
  primeImplicants?: boolean;
  distributionByOrder?: number[];
  truncationProbabilityError?: number;
  list?: CutSet[];
}

export type Approximation = "rare-event" | "mcub" | "exact" | "monte-carlo";

export interface ProbabilityResult {
  value: number;
  exactProbability?: number;
  approximateProbability?: number;
  relativeError?: number;
  approximation?: Approximation;
}

export interface Quantile {
  fraction: number;
  value: number;
}

export interface HistogramBin {
  lowerBound: number;
  upperBound: number;
  count: number;
}

export interface UncertaintyResult {
  mean: number;
  standardDeviation?: number;
  errorFactor?: number;
  quantiles?: Quantile[];
  percentiles?: Record<string, number>;
  histogramBins?: HistogramBin[];
}

export interface ConvergenceResult {
  converged: boolean;
  trials: number;
  confidence?: number;
  delta?: number;
  ciPolicy?: ConvergenceIntervalPolicy;
  achievedMarginOfError?: number;
}

export interface ImportanceMeasureResult {
  basicEventId: BasicEventId;
  fussellVesely?: number;
  riskAchievementWorth?: number;
  riskReductionWorth?: number;
  birnbaum?: number;
  criticality?: number;
}

export interface SensitivityResultEntry {
  studyId: number;
  variedItem: string;
  baselineValue?: number;
  perturbedValue?: number;
  resultDelta?: number;
}

export interface SafetyIntegrityLevelResult {
  faultTreeId: number;
  averageProbability?: number;
  silBand?: number;
}

export interface FaultTreeQuantification {
  faultTreeId: number;
  topNodeId: BooleanNodeId;
  topEventProbability?: ProbabilityResult;
  cutSets?: CutSetResult;
  importance?: ImportanceMeasureResult[];
  uncertainty?: UncertaintyResult;
}

export interface SequenceQuantification {
  sequenceId: number;
  initiatingEventId: BasicEventId;
  endStateId?: number;
  frequency?: number;
  probability?: ProbabilityResult;
  cutSets?: CutSetResult;
  uncertainty?: UncertaintyResult;
}

export interface EndStateQuantification {
  endStateId: number;
  name?: string;
  frequency?: number;
  probability?: ProbabilityResult;
  uncertainty?: UncertaintyResult;
  contributingSequenceIds?: number[];
}

export interface InitiatingEventQuantification {
  initiatingEventId: BasicEventId;
  name?: string;
  sequences: SequenceQuantification[];
}

export interface QuantificationResult {
  id: number;
  requestRef: number;
  booleanModelRef: number;
  modelVersionRef?: string;
  solverName: SolverTarget;
  solverVersion?: string;
  configurationControlRecordId?: string;
  timestamp?: string;
  modelFeatures?: Record<string, string | number | boolean>;
  runtimeSummary?: RuntimeSummary;

  faultTrees?: FaultTreeQuantification[];
  initiatingEvents?: InitiatingEventQuantification[];
  sumOfProducts?: SequenceQuantification[];
  endStates?: EndStateQuantification[];

  importance?: ImportanceMeasureResult[];
  uncertainty?: UncertaintyResult;
  convergence?: ConvergenceResult;
  sensitivity?: SensitivityResultEntry[];
  safetyIntegrityLevels?: SafetyIntegrityLevelResult[];
}
