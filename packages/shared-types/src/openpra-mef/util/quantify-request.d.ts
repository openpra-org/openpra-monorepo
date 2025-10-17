import { Model } from "./model";

/**
 * Schema for command-line options
 */
export interface CommandLineOptions {
  /**
   * Perform qualitative analysis with BDD
   */
  bdd?: boolean;
  /**
   * Perform qualitative analysis with ZBDD
   */
  zbdd?: boolean;
  /**
   * Perform qualitative analysis with MOCUS
   */
  mocus?: boolean;
  /**
   * Perform analysis with PDAG (direct) algorithm
   */
  pdag?: boolean;
  /**
   * Calculate prime implicants
   */
  "prime-implicants"?: boolean;
  /**
   * Perform probability analysis
   */
  probability?: boolean;
  /**
   * Perform importance analysis
   */
  importance?: boolean;
  /**
   * Perform uncertainty analysis
   */
  uncertainty?: boolean;
  /**
   * Perform common-cause failure analysis
   */
  ccf?: boolean;
  /**
   * Compute the Safety Integrity Level metrics
   */
  sil?: boolean;
  /**
   * Use the rare event approximation
   */
  "rare-event"?: boolean;
  /**
   * Use the MCUB approximation
   */
  mcub?: boolean;
  /**
   * Use Monte Carlo simulation
   */
  "monte-carlo"?: boolean;
  /**
   * Upper limit for the product order
   */
  "limit-order"?: number;
  /**
   * Cut-off probability for products
   */
  "cut-off"?: number;
  /**
   * System mission time in hours
   */
  "mission-time"?: number;
  /**
   * Time step in hours for probability analysis
   */
  "time-step"?: number;
  /**
   * Number of trials for Monte Carlo simulations
   */
  "num-trials"?: number;
  /**
   * Number of quantiles for distributions
   */
  "num-quantiles"?: number;
  /**
   * Number of bins for histograms
   */
  "num-bins"?: number;
  /**
   * Seed for the pseudo-random number generator
   */
  seed?: number;
  /**
   * Confidence level for Monte Carlo convergence (0-1)
   */
  confidence?: number;
  /**
   * Relative margin of error (delta) for convergence
   */
  delta?: number;
  /**
   * Burn-in trials before convergence checks
   */
  "burn-in"?: number;
  /**
   * Enable early stopping on convergence
   */
  "early-stop"?: boolean;
  /**
   * Convergence interval policy (bayes or wald)
   */
  "ci-policy"?: "bayes" | "wald";
  /**
   * Batch size for Monte Carlo simulations
   */
  "batch-size"?: number;
  /**
   * Sample size for Monte Carlo simulations
   */
  "sample-size"?: number;
  /**
   * Node allocation overhead ratio
   */
  "overhead-ratio"?: number;
  /**
   * Expand at-least gates (disable K/N optimization)
   */
  "no-kn"?: boolean;
  /**
   * Expand XOR gates (disable XOR optimization)
   */
  "no-xor"?: boolean;
  /**
   * Keep null gates
   */
  "keep-null-gates"?: boolean;
  /**
   * Compilation level (0-8)
   */
  "compilation-level"?: number;
  /**
   * Oracle probability for diagnostics
   */
  "oracle-p"?: number;
  /**
   * Display analysis status on TTY
   */
  "watch-mode"?: boolean;
  /**
   * Omit indentation whitespace in output XML
   */
  "no-indent"?: boolean;
  /**
   * Set log verbosity
   */
  verbosity?: number;
  /**
   * Don't generate analysis report
   */
  "no-report"?: boolean;
  /**
   * Path for the output/report file
   */
  output?: string;
}

/**
 * Schema for command-line options
 */
export interface ScramNodeOptions {
  // Algorithms
  mocus?: boolean;
  bdd?: boolean;
  zbdd?: boolean;
  pdag?: boolean;
  
  // Approximations
  rareEvent?: boolean;
  mcub?: boolean;
  monteCarlo?: boolean;
  
  // Analysis types
  primeImplicants?: boolean;
  probability?: boolean;
  importance?: boolean;
  uncertainty?: boolean;
  ccf?: boolean;
  sil?: boolean;
  
  // Basic parameters
  limitOrder?: number;
  cutOff?: number;
  missionTime?: number;
  timeStep?: number;
  numTrials?: number;
  numQuantiles?: number;
  numBins?: number;
  seed?: number;
  
  // Monte Carlo specific parameters
  confidence?: number;        // Confidence level for convergence (0-1)
  delta?: number;             // Relative margin of error for convergence (>0)
  burnIn?: number;            // Burn-in trials before convergence checks
  earlyStop?: boolean;        // Enable early stopping on convergence
  ciPolicy?: "bayes" | "wald"; // Convergence interval policy
  batchSize?: number;         // Batch size for Monte Carlo
  sampleSize?: number;        // Sample size for Monte Carlo
  overheadRatio?: number;     // Node allocation overhead ratio (>=0)
  
  // Graph compilation and preprocessing flags
  noKn?: boolean;             // Expand at-least gates (disable K/N optimization)
  noXor?: boolean;            // Expand XOR gates (disable XOR optimization)
  keepNullGates?: boolean;    // Keep null gates (don't remove gates with no effect)
  compilationLevel?: number;  // Compilation level (0-8, higher = more optimization)
  
  // Diagnostics
  oracleP?: number;           // Oracle probability for diagnostics (>=0)
  watchMode?: boolean;        // Display analysis status on TTY
}

export interface ModelOptions {
  _id?: string;
  models: string[];
}

export interface NodeQuantRequest {
  _id?: string;
  settings?: ScramNodeOptions;
  model?: Model;
}

export type QuantifyRequest = CommandLineOptions & ModelOptions;
