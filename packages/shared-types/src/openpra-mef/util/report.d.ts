// Top-level PRA Quantification Report
export interface Report {
  modelFeatures: ModelFeatures;
  results?: Results;
}

// Model Features
export interface ModelFeatures {
  name?: string;
  faultTrees?: number;
  gates?: number;
  basicEvents?: number;
  houseEvents?: number;
  undevelopedEvents?: number;
  ccfGroups?: number;
  initiatingEvents?: number;
  eventTrees?: number;
  functionalEvents?: number;
  sequences?: number;
}

// Results Layer
export interface Results {
  initiatingEvents?: InitiatingEventResult[];
  safetyIntegrityLevels?: SafetyIntegrityLevels[];
  curves?: Curve[];
  statisticalMeasures?: StatisticalMeasure[];
  importance?: ImportanceResult[];
  sumOfProducts?: SumOfProducts[];
}

// Initiating Event Results
export interface InitiatingEventResult {
  name: string;
  description?: string;
  sequences: SequenceResult[];
}

export interface SequenceResult {
  name: string;
  value: number;
}

// Safety Integrity Levels
export interface SafetyIntegrityLevels {
  // PFD: Probability of failure on demand
  // PFH: Probability of Failure per hour
  PFDavg: number;
  PFHavg: number;
  PFDhistogram: HistogramBin[];
  PFHhistogram: HistogramBin[];
}

// Histogram Bin
export interface HistogramBin {
  // number: bin index/label
  // value: bin's probability/frequency
  number: number;
  value: number;
  lowerBound: number;
  upperBound: number;
}

// Curve (e.g., for risk curves)
export interface Curve {
  xTitle: string;
  yTitle: string;
  zTitle?: string;
  xUnit?: Unit;
  yUnit?: Unit;
  zUnit?: Unit;
  points: CurvePoint[];
}

export interface CurvePoint {
  x: number;
  y: number;
  z?: number;
}

export type Unit = "seconds" | "hours" | "second-1" | "hour-1" | "years" | "year-1";

// Statistical Measure
export interface StatisticalMeasure {
  mean: number;
  standardDeviation: number;
  confidenceRange: {
    percentage: number;
    lowerBound: number;
    upperBound: number;
  };
  errorFactor: {
    percentage: number;
    value: number;
  };
  quantiles: Quantile[];
  histogram: HistogramBin[];
}

// Quantile
export interface Quantile {
  // number: This is the quantile index or label. In the XML schema, each <quantile> or <bin> has a number attribute,
  // which typically indicates its position/order in the quantile or bin list (e.g., 1st quantile, 2nd quantile, etc.).
  // value: This is the actual value of the quantile (e.g., the probability or the value at that quantile).
  number: number;
  value: number;
  lowerBound: number;
  upperBound: number;
}

// Importance Results
export interface ImportanceResult {
  basicEvents: number;
  events: ImportanceEvent[];
}

export type ImportanceEvent =
  | { type: "basic-event"; name: string; factors: ImportanceFactors }
  | {
      type: "ccf-event";
      ccfGroup: string;
      order: number;
      groupSize: number;
      factors: ImportanceFactors;
      basicEvents: string[];
    };

export interface ImportanceFactors {
  occurrence: number;
  probability: number;
  DIF: number;
  MIF: number;
  CIF: number;
  RRW: number;
  RAW: number;
}

// Sum of Products
export interface SumOfProducts {
  basicEvents: number;
  products: number;
  probability?: number;
  distribution?: number[];
  productList?: Product[];
}

// Product (for minimal cut sets, etc.)
export interface Product {
  order: number;
  probability?: number;
  contribution?: number;
  literals?: Literal[];
}

// Literal: basic event or CCF event, possibly negated
export type Literal =
  | { type: "basic-event"; name: string }
  | { type: "not-basic-event"; name: string }
  | { type: "ccf-event"; ccfGroup: string; order: number; groupSize: number; basicEvents: string[] }
  | { type: "not-ccf-event"; ccfGroup: string; order: number; groupSize: number; basicEvents: string[] };
