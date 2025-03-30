/**
 * Type representing probability values between 0 and 1
 * Used throughout the quantification report for probabilities, unavailabilities, and other metrics
 *
 * @memberof Quantification
 * @type {number}
 *
 * @example
 * ```typescript
 * const topEventProbability: ProbabilityData = 2.5e-5;
 * const componentUnavailability: ProbabilityData = 0.001;
 * ```
 */
type ProbabilityData = number; // Values between 0 and 1

/**
 * Units used for time-based metrics in quantification results
 * Includes both direct time units and frequency (inverse time) units
 *
 * @memberof Quantification
 * @type {string}
 *
 * @example
 * ```typescript
 * const missionTimeUnit: Unit = "hours";
 * const failureRateUnit: Unit = "years-1";
 * ```
 */
type Unit = "seconds" | "seconds-1" | "hours" | "hours-1" | "years" | "years-1";

/**
 * Interface representing a report containing the results of fault tree and event tree quantification.
 * This report includes detailed information about calculation performance, model features,
 * and various results like minimal cut sets, importance measures, and uncertainty analysis.
 *
 * @memberof Quantification
 *
 * @example
 * ```typescript
 * const report: QuantificationReport = {
 *   information: {
 *     time: "2025-03-29T14:30:00Z",
 *     modelFeatures: {
 *       name: "DEMO-SYSTEM",
 *       gates: 42,
 *       basicEvents: 97,
 *       houseEvents: 5,
 *       faultTrees: 2
 *     },
 *     calculatedQuantities: [
 *       {
 *         name: "System Unavailability",
 *         calculationMethod: {
 *           name: "Binary Decision Diagram"
 *         }
 *       }
 *     ]
 *   },
 *   results: {
 *     items: [
 *       {
 *         name: "TOP-GATE",
 *         basicEvents: 97,
 *         products: 532,
 *         probability: 2.4e-6
 *       }
 *     ]
 *   }
 * };
 * ```
 */
export interface QuantificationReport {
  /**
   * General information about the quantification calculation
   */
  information: Information;
  /**
   * Quantification results including cut sets, importance measures, etc.
   */
  results?: Results;
}

/**
 * Information about the calculation, model features, and performance
 */
interface Information {
  /**
   * Timestamp when the calculation was performed
   */
  time: string;
  /**
   * Performance metrics for different calculation phases
   */
  performance?: Performance;
  /**
   * Quantities calculated during analysis
   */
  calculatedQuantities?: CalculatedQuantity[];
  /**
   * Features and statistics about the model being analyzed
   */
  modelFeatures: ModelFeatures;
}

/**
 * Performance metrics for the calculation
 */
interface Performance {
  /**
   * Calculation time for different analysis phases
   */
  calculationTime: CalculationTime[];
}

/**
 * Time spent on a particular calculation phase
 */
interface CalculationTime {
  /**
   * Name of the analysis
   */
  name: string;
  /**
   * Optional description of the analysis
   */
  description?: string;
  /**
   * Initiating event being analyzed (for event trees)
   */
  initiatingEvent?: string;
  /**
   * Alignment being analyzed (for multi-phase models)
   */
  alignment?: string;
  /**
   * Phase being analyzed (for multi-phase models)
   */
  phase?: string;
  /**
   * Time spent generating products (cut sets)
   */
  products?: number;
  /**
   * Time spent on probability calculations
   */
  probability?: number;
  /**
   * Time spent on importance analysis
   */
  importance?: number;
  /**
   * Time spent on uncertainty analysis
   */
  uncertainty?: number;
}

/**
 * Represents a calculated quantity in the analysis
 */
interface CalculatedQuantity {
  /**
   * Name of the calculated quantity
   */
  name: string;
  /**
   * Definition or formula for the calculated quantity
   */
  definition?: string;
  /**
   * Approximation methods used
   */
  approximation?: string[];
  /**
   * Method used for calculating this quantity
   */
  calculationMethod?: CalculationMethod;
}

/**
 * Method used for calculation
 */
interface CalculationMethod {
  /**
   * Name of the calculation method
   */
  name: string;
  /**
   * Limits applied to the calculation
   */
  limits?: {
    /**
     * Maximum order of products included
     */
    productOrder?: number;
    /**
     * Mission time for the analysis
     */
    missionTime?: number;
    /**
     * Time step for time-dependent analysis
     */
    timeStep?: number;
    /**
     * Probability cutoff for truncation
     */
    cutOff?: ProbabilityData;
    /**
     * Number of sums in the calculation
     */
    numberOfSums?: number;
    /**
     * Number of trials for Monte Carlo simulation
     */
    numberOfTrials?: number;
    /**
     * Random number generator seed
     */
    seed?: number;
  };
}

/**
 * Features and statistics about the analyzed model
 */
interface ModelFeatures {
  /**
   * Name of the model
   */
  name?: string;
  /**
   * Number of gates in the model
   */
  gates?: number;
  /**
   * Number of basic events in the model
   */
  basicEvents?: number;
  /**
   * Number of house events in the model
   */
  houseEvents?: number;
  /**
   * Number of common cause failure groups
   */
  ccfGroups?: number;
  /**
   * Number of fault trees
   */
  faultTrees?: number;
  /**
   * Number of event trees
   */
  eventTrees?: number;
  /**
   * Number of functional events
   */
  functionalEvents?: number;
  /**
   * Number of sequences
   */
  sequences?: number;
  /**
   * Number of rules
   */
  rules?: number;
  /**
   * Number of initiating events
   */
  initiatingEvents?: number;
}

/**
 * Collection of all quantification results
 */
interface Results {
  /**
   * Array of result items of various types
   */
  items: (SumOfProducts | Importance | SafetyIntegrityLevels | StatisticalMeasure | Curve | InitiatingEvent)[];
}

/**
 * Common properties for analysis results
 */
interface AnalysisId {
  /**
   * Name of the analysis target (e.g., fault tree top event)
   */
  name: string;
  /**
   * Description of the analysis
   */
  description?: string;
  /**
   * Initiating event for the analysis (for event trees)
   */
  initiatingEvent?: string;
  /**
   * Alignment for the analysis (for multi-phase models)
   */
  alignment?: string;
  /**
   * Phase for the analysis (for multi-phase models)
   */
  phase?: string;
}

/**
 * Results containing minimal cut sets (sum of products)
 */
interface SumOfProducts extends AnalysisId {
  /**
   * Number of basic events in the analysis
   */
  basicEvents: number;
  /**
   * Number of products (minimal cut sets)
   */
  products: number;
  /**
   * Probability of the top event
   */
  probability?: ProbabilityData;
  /**
   * Distribution of products by order
   */
  distribution?: number[];
  /**
   * List of individual products (cut sets)
   */
  productList?: Product[];
}

/**
 * Individual product (minimal cut set)
 */
interface Product {
  /**
   * Order (number of events) in the product
   */
  order: number;
  /**
   * Probability of this product
   */
  probability?: ProbabilityData;
  /**
   * Contribution of this product to the top event probability
   */
  contribution?: ProbabilityData;
  /**
   * Events in this product
   */
  literals?: Literal[];
}

/**
 * Event or negated event in a product
 */
type Literal = LiteralEvent | { not: LiteralEvent };

/**
 * Event in a product (basic event or CCF event)
 */
type LiteralEvent = BasicEvent | CCFEvent;

/**
 * Basic event in a product
 */
interface BasicEvent {
  /**
   * Name of the basic event
   */
  name: string;
}

/**
 * Common cause failure event in a product
 */
interface CCFEvent {
  /**
   * Name of the CCF group
   */
  ccfGroup: string;
  /**
   * Order of the CCF event
   */
  order: number;
  /**
   * Size of the CCF group
   */
  groupSize: number;
  /**
   * Basic events in the CCF group
   */
  basicEvents: BasicEvent[];
}

/**
 * Importance measure results
 */
interface Importance extends AnalysisId {
  /**
   * Number of basic events with importance measures
   */
  basicEvents: number;
  /**
   * Importance results for individual events
   */
  items?: (BasicEventImportance | CCFEventImportance)[];
}

/**
 * Common importance factors for events
 */
interface ImportanceFactors {
  /**
   * Number of occurrences in minimal cut sets
   */
  occurrence: number;
  /**
   * Probability of the event
   */
  probability: number;
  /**
   * Differential Importance Factor
   */
  DIF: number;
  /**
   * Marginal Importance Factor
   */
  MIF: number;
  /**
   * Critical Importance Factor
   */
  CIF: number;
  /**
   * Risk Reduction Worth
   */
  RRW: number;
  /**
   * Risk Achievement Worth
   */
  RAW: number;
}

/**
 * Importance measures for a basic event
 */
interface BasicEventImportance extends ImportanceFactors {
  /**
   * Name of the basic event
   */
  name: string;
}

/**
 * Importance measures for a CCF event
 */
interface CCFEventImportance extends ImportanceFactors {
  /**
   * Name of the CCF group
   */
  ccfGroup: string;
  /**
   * Order of the CCF event
   */
  order: number;
  /**
   * Size of the CCF group
   */
  groupSize: number;
  /**
   * Basic events in the CCF group
   */
  basicEvents: BasicEvent[];
}

/**
 * Statistical results from uncertainty analysis
 */
interface StatisticalMeasure extends AnalysisId {
  /**
   * Mean value from uncertainty analysis
   */
  mean: {
    value: ProbabilityData;
  };
  /**
   * Standard deviation from uncertainty analysis
   */
  standardDeviation: {
    value: ProbabilityData;
  };
  /**
   * Confidence range from uncertainty analysis
   */
  confidenceRange: {
    /**
     * Confidence level percentage
     */
    percentage: number;
    /**
     * Lower bound of confidence interval
     */
    lowerBound: ProbabilityData;
    /**
     * Upper bound of confidence interval
     */
    upperBound: ProbabilityData;
  };
  /**
   * Error factor from uncertainty analysis
   */
  errorFactor: {
    /**
     * Confidence level percentage for error factor
     */
    percentage: number;
    /**
     * Error factor value
     */
    value: number;
  };
  /**
   * Quantiles from uncertainty analysis
   */
  quantiles: {
    /**
     * Number of quantiles
     */
    number: number;
    /**
     * List of quantile data points
     */
    quantileList: BinData[];
  };
  /**
   * Histogram from uncertainty analysis
   */
  histogram: {
    /**
     * Number of histogram bins
     */
    number: number;
    /**
     * Histogram bin data
     */
    bins: BinData[];
  };
}

/**
 * Data for a histogram bin or quantile
 */
interface BinData {
  /**
   * Bin/quantile number
   */
  number: number;
  /**
   * Value at this bin/quantile
   */
  value: number;
  /**
   * Lower bound of this bin/quantile
   */
  lowerBound: number;
  /**
   * Upper bound of this bin/quantile
   */
  upperBound: number;
}

/**
 * Data for a curve result (e.g., time-dependent analysis)
 */
interface Curve extends AnalysisId {
  /**
   * Title for X axis
   */
  xTitle: string;
  /**
   * Title for Y axis
   */
  yTitle: string;
  /**
   * Title for Z axis (for 3D curves)
   */
  zTitle?: string;
  /**
   * Unit for X axis
   */
  xUnit?: Unit;
  /**
   * Unit for Y axis
   */
  yUnit?: Unit;
  /**
   * Unit for Z axis
   */
  zUnit?: Unit;
  /**
   * Data points for the curve
   */
  points?: {
    /**
     * X coordinate
     */
    x: number;
    /**
     * Y coordinate
     */
    y: number;
    /**
     * Z coordinate (for 3D curves)
     */
    z?: number;
  }[];
}

/**
 * Safety Integrity Level analysis results
 */
interface SafetyIntegrityLevels extends AnalysisId {
  /**
   * Average Probability of Failure on Demand
   */
  pfdAvg: ProbabilityData;
  /**
   * Average Probability of Failure per Hour
   */
  pfhAvg: ProbabilityData;
  /**
   * Histogram for PFD distribution
   */
  pfdHistogram: {
    /**
     * Number of histogram bins
     */
    number: number;
    /**
     * Histogram bin data
     */
    bins: BinData[];
  };
  /**
   * Histogram for PFH distribution
   */
  pfhHistogram: {
    /**
     * Number of histogram bins
     */
    number: number;
    /**
     * Histogram bin data
     */
    bins: BinData[];
  };
}

/**
 * Results for an initiating event in event tree analysis
 */
interface InitiatingEvent {
  /**
   * Name of the initiating event
   */
  name: string;
  /**
   * Description of the initiating event
   */
  description?: string;
  /**
   * Alignment for the analysis
   */
  alignment?: string;
  /**
   * Phase for the analysis
   */
  phase?: string;
  /**
   * Number of sequences in the event tree
   */
  sequences: number;
  /**
   * List of sequence results
   */
  sequenceList: {
    /**
     * Name of the sequence
     */
    name: string;
    /**
     * Probability of the sequence
     */
    value: ProbabilityData;
  }[];
}
