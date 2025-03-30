/**
 * Interface representing the settings for quantification of fault trees and event trees.
 * Quantification settings control how minimal cut sets and probability calculations are performed.
 *
 * @memberof Quantification
 *
 * @example
 * ```typescript
 * const settings: QuantificationSettings = {
 *   models: {
 *     files: ["fault-tree-1.xml", "event-tree-2.xml"]
 *   },
 *   options: {
 *     algorithm: "bdd",
 *     primeImplicants: true,
 *     analysis: {
 *       probability: true,
 *       importance: true
 *     },
 *     limits: {
 *       productOrder: 3,
 *       missionTime: 8760,
 *       cutOff: 1e-12
 *     }
 *   }
 * };
 * ```
 */
export interface QuantificationSettings {
  /**
   * Model files to include in the quantification
   */
  models: {
    /**
     * Array of file paths to the model files (usually XML)
     */
    files: string[];
  };
  /**
   * Quantification options controlling algorithm behavior
   */
  options: {
    /**
     * Algorithm to use for cut set generation
     * - mocus: MOCUS algorithm for minimal cut sets
     * - bdd: Binary Decision Diagram algorithm
     * - zbdd: Zero-suppressed BDD algorithm
     */
    algorithm?: "mocus" | "bdd" | "zbdd";
    /**
     * Whether to generate prime implicants instead of minimal cut sets
     * To understand the difference between minimal cut sets and prime
     * implicants you can read the introduction section of this paper:
     * https://doi.org/10.1016/j.ress.2015.10.007
     */
    primeImplicants?: boolean;
    /**
     * Types of analysis to perform
     */
    analysis?: {
      /**
       * Calculate probability of the top event
       */
      probability?: boolean;
      /**
       * Calculate importance measures for basic events
       */
      importance?: boolean;
      /**
       * Perform uncertainty analysis
       */
      uncertainty?: boolean;
      /**
       * Include common cause failure analysis
       */
      ccf?: boolean;
      /**
       * Calculate Safety Integrity Levels
       */
      sil?: boolean;
    };
    /**
     * Approximation method for probability calculations
     * - rare-event: Rare event approximation
     * - mcub: Min-Cut Upper Bound approximation
     */
    approximation?: "rare-event" | "mcub";
    /**
     * Numerical limits for calculations
     */
    limits?: {
      /**
       * Maximum order of products to include in the results
       */
      productOrder?: number;
      /**
       * Mission time in hours
       */
      missionTime?: number;
      /**
       * Time step for time-dependent analysis
       */
      timeStep?: number;
      /**
       * Probability cutoff below which cut sets are truncated
       */
      cutOff?: number;
      /**
       * Number of Monte Carlo trials for uncertainty analysis
       */
      numberOfTrials?: number;
      /**
       * Number of quantiles in uncertainty results
       */
      numberOfQuantiles?: number;
      /**
       * Number of histogram bins in uncertainty results
       */
      numberOfBins?: number;
      /**
       * Random number generator seed
       */
      seed?: number;
    };
  };
}
