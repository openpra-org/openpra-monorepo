/**
 * Schema for the quantification request
 */
export type QuantifyRequest = QuantifyRequest1 & QuantifyRequest2;
export type QuantifyRequest1 = CommandLineOptions;

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
  primeImplicants?: boolean;
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
  rareEvent?: boolean;
  /**
   * Use the MCUB approximation
   */
  mcub?: boolean;
  /**
   * Upper limit for the product order
   */
  limitOrder?: number;
  /**
   * Cut-off probability for products
   */
  cutOff?: number;
  /**
   * System mission time in hours
   */
  missionTime?: number;
  /**
   * Time step in hours for probability analysis
   */
  timeStep?: number;
  /**
   * Number of trials for Monte Carlo simulations
   */
  numTrials?: number;
  /**
   * Number of quantiles for distributions
   */
  numQuantiles?: number;
  /**
   * Number of bins for histograms
   */
  numBins?: number;
  /**
   * Seed for the pseudo-random number generator
   */
  seed?: number;
  /**
   * Omit indentation whitespace in output XML
   */
  noIndent?: boolean;
  /**
   * Set log verbosity
   */
  verbosity?: number;
  /**
   * Don't generate analysis report
   */
  noReport?: boolean;
  /**
   * Path for the output/report file
   */
  output?: string;
}

export interface QuantifyRequest2 {
  /**
   * String-encoded array of OpenPSA MEF XMLs
   */
  models: string[];
}
