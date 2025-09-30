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
  mocus: boolean;
  bdd: boolean;
  zbdd: boolean;
  rareEvent: boolean;
  mcub: boolean;
  limitOrder?: number;
  cutOff?: number;
  missionTime?: number;
  timeStep?: number;
  numTrials?: number;
  numQuantiles?: number;
  numBins?: number;
  seed?: number;
  primeImplicants?: boolean;
  probability?: boolean;
  importance?: boolean;
  uncertainty?: boolean;
  ccf?: boolean;
  sil?: boolean;
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
