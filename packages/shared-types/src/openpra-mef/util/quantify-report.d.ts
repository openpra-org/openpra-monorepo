/**
 * Schema for the quantification report
 */
export interface QuantifyReport {
  configuration?: CommandLineOptions;
  /**
   * String-encoded array of OpenPSA MEF XML quantification reports
   */
  results: string[];
}
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

  /**
   * List of input models
   */
  models: string[];
}
