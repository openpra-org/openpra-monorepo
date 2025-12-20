/**
 * @packageDocumentation
 * @module technical_elements.core
 * @description Core patterns, enums, and types shared across technical elements
 */

import { Unique } from './meta';
import typia, { tags } from 'typia';
// Import DistributionType from data-analysis
import { DistributionType } from '../data-analysis/data-analysis';

/**
 * Common ID patterns used throughout the technical elements
 * @memberof technical_elements.core
 * @group Shared Patterns
 */
export const IdPatterns = {
  /** Pattern for Plant Operating State IDs */
  STATE: '^POS-[A-Z0-9-]+$',
  /** Pattern for Sequence IDs */
  SEQUENCE: '^SEQ-[A-Z0-9-]{4,}',
  /** Pattern for Component IDs */
  COMPONENT: '^CMP-[A-Z0-9-]+$',
  /** Pattern for Failure Mode IDs */
  FAILURE_MODE: '^FM-[A-Z0-9-]+$',
  /** Pattern for Success Criteria IDs */
  SUCCESS_CRITERIA_ID: '^SC-[A-Z0-9-]+$',
  /** Pattern for System IDs */
  SYSTEM_ID: '^SYS-[A-Z0-9-]+$',
  /** Pattern for Human Action IDs */
  HUMAN_ACTION_ID: '^HRA-[0-9]+$',
  /** Pattern for Source Term IDs */
  SOURCE_TERM_ID: '^ST-[0-9]+$',
  /** Pattern for Release Category IDs */
  RELEASE_CATEGORY_ID: '^RC-[0-9]+$',
  /** Pattern for Event Sequence IDs */
  EVENT_SEQUENCE_ID: '^ES-[0-9]+$',
  /** Pattern for Event Sequence Family IDs */
  EVENT_SEQUENCE_FAMILY_ID: '^ESF-[0-9]+$',
} as const;

/**
 * Type for success criteria IDs.
 * Format: SC-[SYSTEM]-[NUMBER]
 * Example: SC-RCIC-001
 * @group Shared Patterns
 */
export type SuccessCriteriaId = string &
  tags.Pattern<typeof IdPatterns.SUCCESS_CRITERIA_ID>;

/**
 * Standardized levels for expressing importance, impact, or significance in probabilistic risk assessment
 * @description Provides consistent categorization of significance levels across the PRA technical elements
 * @example
 * const significance: ImportanceLevel = ImportanceLevel.HIGH;
 * @memberof technical_elements.core.enums
 * @group Shared Patterns
 */
export enum ImportanceLevel {
  /** High importance - used for significant risk contributors or major impacts */
  HIGH = 'HIGH',

  /** Medium importance - used for moderate risk contributors or notable impacts */
  MEDIUM = 'MEDIUM',

  /** Low importance - used for minor risk contributors or minimal impacts */
  LOW = 'LOW',
}

/**
 * Standardized interface for sensitivity studies across technical elements.
 *
 * This interface consolidates common patterns for sensitivity studies found in:
 * - Data Analysis
 * - Event Sequence Analysis
 * - Initiating Event Analysis
 *
 * It provides a consistent structure for documenting sensitivity studies
 * while allowing for technical element-specific extensions.
 * @group Shared Patterns
 */
export interface SensitivityStudy extends Unique {
  /** Name or title of the sensitivity study */
  name?: string;

  /** Description of the sensitivity study */
  description: string;

  /** Parameters being varied in the study */
  variedParameters: string[];

  /**
   * Range of variation for each parameter
   * Record where key is parameter name and value is [min, max] tuple
   */
  parameterRanges: Record<string, [number, number]>;

  /** Results of the sensitivity study */
  results?: string;

  /** Insights gained from the study */
  insights?: string;

  /** Impact on analysis outcomes */
  impact?: string;

  /** Reference to the model uncertainty being studied */
  modelUncertaintyId?: string;

  /**
   * Technical element specific properties
   * Allows for extension with properties specific to a technical element
   */
  elementSpecificProperties?: Record<string, unknown>;
}

/**
 * Base interface for uncertainty analysis across technical elements.
 *
 * This interface provides a consistent structure for documenting uncertainty
 * propagation methods and model uncertainties across different technical elements.
 *
 * @group Shared Patterns
 */
export interface BaseUncertaintyAnalysis extends Unique {
  /**
   * Uncertainty propagation method
   * Defines the method used to propagate uncertainty, which is a general concept
   * applicable across different types of uncertainty analysis within a PRA.
   */
  propagationMethod: 'MONTE_CARLO' | 'LATIN_HYPERCUBE' | 'ANALYTICAL' | 'OTHER';

  /**
   * Number of samples if using simulation
   * Specific to simulation-based propagation methods (like Monte Carlo and Latin Hypercube)
   * and is a general parameter for such methods.
   */
  numberOfSamples?: number;

  /**
   * Seed value for random number generator if using simulation
   * Used in simulation-based uncertainty propagation to ensure reproducibility
   * or to control the random number generation process.
   */
  randomSeed?: number;

  /**
   * Model uncertainties considered
   * The concept of identifying, describing, and defining the treatment approach
   * for model uncertainties is relevant across various technical elements of a PRA.
   */
  modelUncertainties: {
    /** Uncertainty ID */
    uncertaintyId: string;

    /** Description of the uncertainty */
    description: string;

    /** Impact on the model */
    impact: string;

    /** Whether the uncertainty is quantified */
    isQuantified: boolean;

    /** How the uncertainty is addressed */
    treatmentApproach: string;
  }[];

  /**
   * Sensitivity studies for unquantified uncertainties
   * Sensitivity analysis is a general technique used to assess the impact
   * of parameter variations or uncertainties on the results of an analysis.
   */
  sensitivityStudies?: SensitivityStudy[];
}

/**
 * Standardized enum for screening status across technical elements.
 *
 * This enum provides consistent categorization of screening statuses
 * for various elements that may be screened in or out of detailed analysis.
 *
 * @example
 * const status: ScreeningStatus = ScreeningStatus.RETAINED;
 * @group Shared Patterns
 */
export enum ScreeningStatus {
  /** Element retained for detailed analysis */
  RETAINED = 'RETAINED',

  /** Element excluded from analysis based on screening criteria */
  SCREENED_OUT = 'SCREENED_OUT',

  /** Element merged into another group */
  MERGED = 'MERGED',

  /** Element requires full quantitative analysis */
  FULL_ANALYSIS = 'FULL_ANALYSIS',

  /** Element requires only qualitative analysis */
  QUALITATIVE_ANALYSIS = 'QUALITATIVE_ANALYSIS',
}

/**
 * Standardized interface for screening criteria across technical elements.
 *
 * This interface consolidates common patterns for screening criteria found in:
 * - Initiating Event Analysis
 * - Event Sequence Analysis
 * - Plant Operating States Analysis
 * - Hazard Analysis
 *
 * It provides a consistent structure for documenting screening criteria
 * while allowing for technical element-specific extensions.
 *
 * @example
 * ```typescript
 * const criteria: ScreeningCriteria = {
 *   frequency_criterion: 1.0e-7,
 *   basis: "Events with frequency below threshold have negligible risk impact",
 *   screened_out_elements: [
 *     {
 *       element_id: "IE-LOCA-SMALL",
 *       reason: "Low frequency",
 *       justification: "Frequency below screening threshold"
 *     }
 *   ]
 * };
 * ```
 * @group Shared Patterns
 */
export interface ScreeningCriteria {
  /** Frequency-based screening criterion (if applicable) */
  frequency_criterion?: number;

  /** Risk-based screening criterion (if applicable) */
  risk_criterion?: number;

  /** Damage frequency screening criterion (if applicable) */
  damage_frequency_criterion?: number;

  /** Basis for screening criteria */
  basis: string;

  /** List of screened-out elements */
  screened_out_elements: {
    /** ID of the screened-out element */
    element_id: string;

    /** Reason for screening out */
    reason: string;

    /** Detailed justification for screening decision */
    justification: string;
  }[];

  /**
   * Technical element specific properties
   * Allows for extension with properties specific to a technical element
   */
  elementSpecificProperties?: Record<string, unknown>;
}

/**
 * Risk metric types used across multiple technical elements
 * @group Common Risk Types
 * @description Common risk metrics used in radiological consequence analysis and risk integration
 */
export enum RiskMetricType {
  /** Individual early fatality risk */
  INDIVIDUAL_EARLY_FATALITY_RISK = 'INDIVIDUAL_EARLY_FATALITY_RISK',

  /** Individual latent cancer fatality risk */
  INDIVIDUAL_LATENT_CANCER_FATALITY_RISK = 'INDIVIDUAL_LATENT_CANCER_FATALITY_RISK',

  /** Population dose */
  POPULATION_DOSE = 'POPULATION_DOSE',

  /** Land contamination area */
  LAND_CONTAMINATION_AREA = 'LAND_CONTAMINATION_AREA',

  /** Economic cost */
  ECONOMIC_COST = 'ECONOMIC_COST',

  /** Custom metric defined by the user */
  CUSTOM = 'CUSTOM',
}

/**
 * Risk significance criteria types used across multiple technical elements
 * @group Common Risk Types
 * @description Common risk significance criteria used in radiological consequence analysis and risk integration
 */
export enum RiskSignificanceCriteriaType {
  /** Quantitative Health Objectives */
  QHO = 'QHO',

  /** Safety Goals */
  SAFETY_GOAL = 'SAFETY_GOAL',

  /** Design Objectives */
  DESIGN_OBJECTIVE = 'DESIGN_OBJECTIVE',

  /** Other criteria */
  OTHER = 'OTHER',
}
