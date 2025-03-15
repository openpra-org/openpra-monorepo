/**
 * @packageDocumentation
 * @module data_analysis
 * @category Examples
 */

import { DistributionType } from './data-analysis';

/**
 * Example of a detailed Uncertainty object for EDG failure rate
 * 
 * This example shows how to structure uncertainty information for data analysis parameters,
 * including distribution parameters, risk implications, and correlations.
 * 
 * @example
 * ```typescript
 * // Complete example of an uncertainty object for EDG failure rate
 * const edgUncertainty = {
 *   correlations: [
 *     {
 *       correlationFactor: 0.8,
 *       correlationType: "common_cause",
 *       description: "Common cause failure correlation between EDG A and B",
 *       parameterId: "DA-EDG-B-FR"
 *     }
 *   ],
 *   distribution: "lognormal",
 *   model_uncertainty_sources: [
 *     "Limited operational data",
 *     "Environmental factors not fully characterized"
 *   ],
 *   parameters: {
 *     errorFactor: 3,
 *     mean: 1.2e-3
 *   },
 *   riskImplications: {
 *     affectedMetrics: ["CDF", "LERF"],
 *     propagationNotes: "Major impact on SBO sequences",
 *     significanceLevel: "high"
 *   }
 * };
 * ```
 * @const
 * @group Examples
 */
export const EDGUncertaintyExample = {
  correlations: [
    {
      correlationFactor: 0.8,
      correlationType: "common_cause",
      description: "Common cause failure correlation between EDG A and B",
      parameterId: "DA-EDG-B-FR"
    }
  ],
  distribution: "lognormal",
  model_uncertainty_sources: [
    "Limited operational data",
    "Environmental factors not fully characterized"
  ],
  parameters: {
    errorFactor: 3,
    mean: 1.2e-3
  },
  riskImplications: {
    affectedMetrics: ["CDF", "LERF"],
    propagationNotes: "Major impact on SBO sequences",
    significanceLevel: "high"
  }
} as const;

/**
 * Example of a Data Analysis Parameter for EDG failure rate
 * 
 * This example demonstrates how to structure a data analysis parameter for EDG failure rate
 * with all required properties.
 * 
 * @example
 * ```typescript
 * // Example of a data analysis parameter for EDG failure rate
 * const edgParameter = {
 *   uuid: "a1b2c3d4-e89b-12d3-a456-567890abcdef",
 *   name: "Emergency Diesel Generator Failure Rate",
 *   description: "Failure rate analysis for EDG-A during power operation",
 *   parameterType: "FREQUENCY",
 *   value: 1.2e-5,
 *   basicEventId: "BE-EDG-FS-001",
 *   systemComponentId: "SYS-EDG-A",
 *   failure_mode: {
 *     type: "FAILURE_TO_START",
 *     description: "Failure to start on demand signal"
 *   },
 *   probability_model: DistributionType.LOGNORMAL,
 *   uncertainty: {
 *     distribution: DistributionType.LOGNORMAL,
 *     parameters: {
 *       median: 1.2e-5,
 *       errorFactor: 3.0
 *     }
 *   }
 * };
 * ```
 * @const
 * @group Examples
 */
export const EDGFailureRateExample = {
  uuid: "a1b2c3d4-e89b-12d3-a456-567890abcdef",
  name: "Emergency Diesel Generator Failure Rate",
  description: "Failure rate analysis for EDG-A during power operation",
  parameterType: "FREQUENCY",
  value: 1.2e-5,
  basicEventId: "BE-EDG-FS-001",
  systemComponentId: "SYS-EDG-A",
  failure_mode: {
    type: "FAILURE_TO_START",
    description: "Failure to start on demand signal"
  },
  probability_model: DistributionType.LOGNORMAL,
  uncertainty: {
    distribution: DistributionType.LOGNORMAL,
    parameters: {
      median: 1.2e-5,
      errorFactor: 3.0
    }
  }
} as const;

/**
 * Example of a complete Data Analysis for EDG reliability
 * 
 * This example demonstrates how to structure a complete data analysis
 * with parameters, metadata, and assumptions.
 * 
 * @example
 * ```typescript
 * // Example of a complete data analysis
 * const edgAnalysis = {
 *   uuid: "123e4567-e89b-12d3-a456-426614174000",
 *   name: "Emergency Diesel Generator Reliability Analysis",
 *   type: "data-analysis",
 *   version: "1.0.0",
 *   status: "APPROVED",
 *   description: "Comprehensive data analysis for EDG reliability parameters",
 *   data_parameters: [
 *     // Array of parameters would go here
 *   ],
 *   additionalMetadata: {
 *     limitations: [
 *       "Analysis limited to failure-to-start mode",
 *       "Common cause failures analyzed separately"
 *     ]
 *   }
 * };
 * ```
 * @const
 * @group Examples
 */
export const EDGReliabilityAnalysisExample = {
  uuid: "123e4567-e89b-12d3-a456-426614174000",
  name: "Emergency Diesel Generator Reliability Analysis",
  type: "data-analysis",
  version: "1.0.0",
  status: "APPROVED",
  description: "Comprehensive data analysis for EDG reliability parameters",
  data_parameters: [EDGFailureRateExample],
  additionalMetadata: {
    limitations: [
      "Analysis limited to failure-to-start mode",
      "Common cause failures analyzed separately"
    ]
  }
} as const;

/**
 * Collection of examples for Data Analysis
 * 
 * A convenient object containing all the examples for easy access.
 * 
 * @example
 * ```typescript
 * // Access all examples
 * import { examples } from 'data_analysis';
 * 
 * // Use a specific example
 * const edgFailureRate = examples.EDGFailureRateExample;
 * ```
 * @const
 * @group Examples
 */
export const examples = {
  EDGReliabilityAnalysisExample,
  EDGFailureRateExample,
  EDGUncertaintyExample
} as const;