/**
 * @module radiological_consequence_analysis_references
 *
 * This file provides re-exports of types from upstream technical elements
 * that are needed by downstream elements, particularly Risk Integration.
 *
 * By centralizing these re-exports, we maintain a cleaner dependency structure
 * where Risk Integration depends primarily on Radiological Consequence Analysis
 * rather than directly on upstream elements like Mechanistic Source Term Analysis.
 */

// Re-export types from mechanistic-source-term
export {
  ReleaseCategoryReference,
  SourceTermDefinitionReference,
  EventSequenceToReleaseCategoryMapping,
  ReleaseCategory,
  SourceTermDefinition,
} from '../mechanistic-source-term/mechanistic-source-term';

/**
 * Risk-significant consequence results with integrated risk metrics.
 * This interface consolidates radiological consequence results with risk significance
 * information to simplify access by Risk Integration.
 * @group Consequence Quantification
 */
export interface RiskSignificantConsequence {
  /** Release category identifier */
  releaseCategoryId: string;

  /** Source term definition identifier */
  sourceTermDefinitionId?: string;

  /** Consequence metrics and their values */
  consequenceMetrics: Record<string, number>;

  /** Risk significance level */
  riskSignificance: 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE';

  /** Risk insights derived from this consequence */
  riskInsights?: string[];

  /** Uncertainty description */
  uncertaintyDescription?: string;

  /** Mapped risk metrics used in risk integration */
  mappedRiskMetrics?: {
    /** Risk metric name */
    metricName: string;

    /** Description of how the consequence maps to this risk metric */
    mappingDescription: string;
  }[];
}
