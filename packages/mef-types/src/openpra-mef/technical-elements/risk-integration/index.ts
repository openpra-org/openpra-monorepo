/**
 * @module risk_integration
 * 
 * Risk Integration is the technical element that synthesizes results from other PRA elements to:
 * - Define risk significance criteria
 * - Calculate overall risk and identify significant contributors
 * - Characterize and quantify uncertainties
 * - Document the entire process for traceability
 * 
 * This index file provides a clean dependency structure for importing Risk Integration types.
 * 
 * @preferred
 * @category Technical Elements
 */

// Re-export all types from the main module
export * from './risk-integration';

// Define commonly used type groupings for easier imports
export {
  // Key interfaces for risk significance
  RiskSignificanceCriteria,
  RiskSignificanceEvaluation,
  
  // Key interfaces for risk calculation
  IntegratedRiskResults,
  SignificantRiskContributors,
  RiskContributor,
  RiskMetric,
  
  // Key interfaces for integration with other modules
  EventSequenceToReleaseCategory,
  
  // Key interfaces for uncertainty analysis
  RiskUncertaintyAnalysis,
  ModelUncertaintySource,
  RiskIntegrationAssumption,
  
  // Documentation interfaces
  RiskIntegrationDocumentation,
  
  // Primary interface
  RiskIntegration
} from './risk-integration';

/**
 * Standard import pattern for Risk Integration:
 * 
 * ```typescript
 * // For accessing the complete module
 * import * as RiskIntegration from '../technical-elements/risk-integration';
 * 
 * // For accessing specific types
 * import { IntegratedRiskResults, RiskSignificanceCriteria } from '../technical-elements/risk-integration';
 * 
 * // For accessing the main interface only
 * import { RiskIntegration } from '../technical-elements/risk-integration';
 * ```
 */ 