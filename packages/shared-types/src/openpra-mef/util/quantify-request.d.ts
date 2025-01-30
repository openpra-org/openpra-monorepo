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

export interface QuantifyRequest2 {
  /**
   * Name of the model followed by the number of requests sent
   * For example: "baobab3-500" means we are quantifying 500 requests containing baobab3 model
   */
  model_name?: string;
  /**
   * BSON type ID of the MongoDB document
   */
  _id?: string;
  /**
   * String-encoded array of OpenPSA MEF XMLs
   */
  models: string[];
}

export type QuantifyRequest = QuantifyRequest1 & QuantifyRequest2;
export type QuantifyRequest1 = CommandLineOptions;
