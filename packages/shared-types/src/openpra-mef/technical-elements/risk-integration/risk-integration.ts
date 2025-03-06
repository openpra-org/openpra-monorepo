/**
 * @module risk_integration
 * @description Types and interfaces for Risk Integration (RI) module. This module contains
 * the core types used for representing and analyzing risk metrics, contributors, and uncertainties
 * in probabilistic risk assessment.
 * 
 * @preferred
 * @category Technical Elements
 */


import * as typia from "typia";
import { TechnicalElement, TechnicalElementTypes } from "../technical-element";
import { Uncertainty, DataAnalysisParameter, DistributionType } from "../data-analysis/data-analysis";



/**
 * Interface representing a quantifiable risk metric used in risk assessment.
 * @memberof risk_integration
 * @interface RiskMetric
 * 
 * @example
 * ```typescript
 * const coreDamageFrequency: RiskMetric = {
 *   name: "Core Damage Frequency",
 *   value: 1.2e-5,
 *   unit: "per reactor year",
 *   sourceParameters: [
 *     {
 *       parameterId: "DA-EDG-FR-001",  // Reference to EDG failure rate parameter
 *       contributionType: "direct",
 *       contributionDescription: "EDG failure rate directly affects CDF through SBO sequences"
 *     },
 *     {
 *       parameterId: "DA-CCF-EDG-001", // Reference to CCF parameter
 *       contributionType: "derived",
 *       contributionDescription: "CCF of EDGs contributes to total SBO frequency"
 *     }
 *   ]
 * };
 * ```
 */
export interface RiskMetric {
    /** The identifier or name of the risk metric */
    name: string;
    /** The numerical value of the risk metric */
    value: number;
    /** Optional unit of measurement for the risk metric (e.g., "per reactor year", "rem") */
    unit?: string;
    /** 
     * References to source data parameters used in calculating this metric
     * Provides traceability from risk metrics back to underlying data
     */
    sourceParameters?: {
        parameterId: string;  // Reference to DataAnalysisParameter
        contributionType: "direct" | "derived";
        /** Description of how this parameter contributes to the metric */
        contributionDescription?: string;
    }[];
}

/**
 * Interface representing an element that contributes to overall risk.
 * Used to track and analyze different sources of risk in the system.
 * @memberof risk_integration
 * @interface RiskContributor
 * 
 * @example
 * ```typescript
 * const edgContributor: RiskContributor = {
 *   name: "Emergency Diesel Generator A",
 *   contribution: 0.15,  // 15% contribution to total risk
 *   type: "component",
 *   description: "Major contributor through station blackout sequences",
 *   dataParameters: [
 *     {
 *       parameterId: "DA-EDG-FR-001",
 *       role: "primary",
 *       notes: "Based on plant-specific failure data from 2020-2023"
 *     },
 *     {
 *       parameterId: "DA-EDG-MAINT-001",
 *       role: "supporting",
 *       notes: "Maintenance unavailability data used in sensitivity studies"
 *     }
 *   ]
 * };
 * ```
 */
export interface RiskContributor {
    /** The identifier or name of the risk contributor */
    name: string;
    /** The numerical contribution to overall risk (typically as a percentage or fraction) */
    contribution: number;
    /** 
     * The category or classification of the risk contributor
     * - eventSequence: A specific sequence of events leading to an outcome
     * - eventSequenceFamily: A group of related event sequences
     * - system: A plant system or subsystem
     * - structure: A physical structure or barrier
     * - component: An individual component or equipment
     * - basicEvent: A fundamental failure event
     * - humanFailureEvent: A human error or failure
     * - plantOperatingState: A specific operational mode or state
     * - hazardGroup: A category of hazards
     * - source: A source of risk
     */
    type: "eventSequence" | "eventSequenceFamily" | "system" | "structure" | "component" | "basicEvent" | "humanFailureEvent" | "plantOperatingState" | "hazardGroup" | "source"
    /** Optional detailed description of the risk contributor */
    description?: string;
    /**
     * References to data analysis parameters that support this risk contribution assessment
     */
    dataParameters?: {
        parameterId: string;  // Reference to DataAnalysisParameter
        role: "primary" | "supporting" | "validation";
        notes?: string;
    }[];
}

/**
 * Interface defining criteria for determining risk significance.
 * Used to establish thresholds and measures for evaluating risk importance.
 * @memberof risk_integration
 * @interface RiskSignificanceCriteria
 * 
 * @example
 * ```typescript
 * const riskCriteria: RiskSignificanceCriteria = {
 *   type: "relative",
 *   threshold: 0.05,  // 5% contribution threshold
 *   consequenceMeasures: ["core damage frequency", "large early release frequency"],
 *   description: "Components contributing more than 5% to CDF or LERF are risk-significant"
 * };
 * ```
 */
export interface RiskSignificanceCriteria {
    /** 
     * The type of criteria:
     * - absolute: Fixed threshold values
     * - relative: Comparative or percentage-based thresholds
     */
    type: "absolute" | "relative";
    /** Numerical threshold for relative criteria (e.g., percentage change) */
    threshold?: number;
    /** Array of specific consequence measures being evaluated */
    consequenceMeasures?: string[];
    /** Detailed description of the significance criteria */
    description?: string;
}

/**
 * Interface representing a parameter used in uncertainty analysis.
 * Defines the statistical properties and impacts of uncertain variables.
 * @memberof risk_integration
 * @interface UncertaintyParameter
 */
export interface UncertaintyParameter {
    /** The identifier or name of the uncertainty parameter */
    name: string;
    /** The type of probability distribution (e.g., normal, lognormal, uniform) */
    distribution: string;
    /** Key-value pairs of distribution parameters (e.g., mean, standard deviation) */
    parameters: Record<string, number>;
    /** Description of how this parameter affects event sequence frequencies */
    impactOnEventSequenceFrequency?: string;
    /** Description of how this parameter affects consequence calculations */
    impactOnConsequences?: string;
}

/**
 * Main interface representing a complete Risk Integration analysis.
 * Combines all aspects of risk assessment including metrics, contributors,
 * uncertainties, and insights.
 * @memberof risk_integration
 * @interface RiskIntegrationAnalysis
 * 
 * @example
 * ```typescript
 * const analysis: RiskIntegrationAnalysis = {
 *   "technical-element-type": TechnicalElementTypes.RISK_INTEGRATION,
 *   "technical-element-code": "RI",
 *   
 *   // Risk Significance Criteria
 *   riskSignificanceCriteria: {
 *     type: "relative",
 *     threshold: 0.05,
 *     consequenceMeasures: ["CDF", "LERF"]
 *   },
 *   
 *   // Risk Metrics
 *   riskMetrics: [
 *     {
 *       name: "Core Damage Frequency",
 *       value: 1.2e-5,
 *       unit: "per reactor year",
 *       sourceParameters: [
 *         {
 *           parameterId: "DA-EDG-FR-001",
 *           contributionType: "direct"
 *         }
 *       ]
 *     }
 *   ],
 *   
 *   // Risk Contributors
 *   riskContributors: [
 *     {
 *       name: "Station Blackout",
 *       contribution: 0.25,
 *       type: "eventSequenceFamily",
 *       dataParameters: [
 *         {
 *           parameterId: "DA-EDG-FR-001",
 *           role: "primary"
 *         }
 *       ]
 *     }
 *   ],
 *   
 *   // Uncertainty Parameters
 *   uncertaintyParameters: [
 *     {
 *       uuid: "DA-EDG-FR-001",
 *       name: "EDG Failure Rate",
 *       parameterType: "FREQUENCY",
 *       value: 1.2e-3,
 *       uncertainty: {
 *         distribution: DistributionType.LOGNORMAL,
 *         parameters: {
 *           mean: 1.2e-3,
 *           errorFactor: 3
 *         }
 *       }
 *     }
 *   ],
 *   
 *   // Additional Information
 *   limitations: "Analysis excludes external hazards",
 *   riskInsights: "Station blackout sequences dominate the risk profile",
 *   notes: "Based on latest plant-specific data through 2023"
 * };
 * ```
 */
export interface RiskIntegrationAnalysis extends TechnicalElement<TechnicalElementTypes.RISK_INTEGRATION> {
    /** Defined criteria used to determine risk significance */
    riskSignificanceCriteria: RiskSignificanceCriteria;
    /** Array of calculated risk metrics for the analysis */
    riskMetrics: RiskMetric[];
    /** Array of identified risk contributors and their characteristics */
    riskContributors: RiskContributor[];
    /** Array of uncertainty parameters affecting the analysis */
    uncertaintyParameters: DataAnalysisParameter[];  // Now using DataAnalysis uncertainty
    /** Documentation of known limitations or scope restrictions in the analysis */
    limitations?: string;
    /** Key findings and insights about reactor design features and their risk implications */
    riskInsights?: string;
    /** Additional notes or comments about the analysis */
    notes?: string;
}

/**
 * JSON schema for validating {@link RiskIntegrationAnalysis} entities.
 * 
 * @memberof risk_integration
 * @example
 * ```typescript
 * const analysis = {
 *   // ... analysis data ...
 * };
 * 
 * const isValid = RiskIntegrationAnalysisSchema.validate(analysis);
 * if (isValid) {
 *   console.log("Analysis is valid");
 * } else {
 *   console.error("Analysis validation failed");
 * }
 * ```
 */
export const RiskIntegrationAnalysisSchema = typia.json.application<[RiskIntegrationAnalysis], "3.0">();
