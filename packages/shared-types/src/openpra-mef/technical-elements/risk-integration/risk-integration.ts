/**
 * @module risk_integration
 * 
 * The objectives of Risk Integration ensure that HLR-RI-A to HLR-RI-D are met.
 *
 * This module incorporates requirements from RG 1.247 which considers Risk Integration a fundamental
 * element of an acceptable NLWR PRA.
 * 
 * @dependency_structure
 * This module follows a hierarchical dependency structure:
 * 1. Core events and shared patterns (core/events.ts, core/shared-patterns.ts) - Most upstream
 * 2. Technical elements like Event Sequence Quantification (ESQ) and Radiological Consequence Analysis (RCA) - Midstream
 * 3. Risk Integration (this file) - Downstream, depends primarily on ESQ and RCA
 * 
 * IMPORTANT: Risk Integration should primarily depend on:
 * - Event Sequence Quantification (ESQ): For sequence frequencies and importance metrics
 * - Radiological Consequence Analysis (RCA): For consequence metrics and uncertainty analysis
 * 
 * Any references to other technical elements should be proxied through ESQ and RCA to maintain
 * a clean dependency hierarchy. This is implemented using reference modules in both ESQ and RCA
 * that re-export necessary types, ensuring Risk Integration doesn't directly depend on upstream elements.
 * 
 * The primary input interfaces for risk integration are:
 * - RiskSignificantEventSequence: Provided by ESQ, contains sequence frequencies and risk significance
 * - RiskSignificantConsequence: Provided by RCA, contains consequence metrics and risk significance
 * 
 * Integration Best Practices:
 * 1. Always use re-exported types from ESQ and RCA rather than importing directly from upstream modules
 * 2. Maintain a clear separation of concerns between technical elements
 * 3. Use reference types (e.g., EventSequenceReference) when referring to entities defined in other modules
 * 4. Document feedback mechanisms that provide insights back to upstream modules
 * 5. When adding new dependencies, consider their impact on the overall architecture
 * 
 * @preferred
 * @category Technical Elements 
 */

// Core imports
import typia, { tags } from "typia";
import { Named, Unique } from "../core/meta";
import { 
  ImportanceLevel, 
  SensitivityStudy, 
  ScreeningStatus, 
  ScreeningCriteria,
  RiskMetricType,
  RiskSignificanceCriteriaType
} from "../core/shared-patterns";
import { Frequency, FrequencyUnit } from "../core/events";
import { Uncertainty, DataSource, Assumption, DistributionType } from "../data-analysis/data-analysis";

// Technical element imports
import { TechnicalElement, TechnicalElementTypes, TechnicalElementMetadata } from "../technical-element";

// Import proxied/re-exported types from Event Sequence Quantification
import { 
  EventSequenceReference, 
  EventSequenceFamilyReference,
  RiskSignificantEventSequence
} from "../event-sequence-quantification";

// Import proxied/re-exported types from Radiological Consequence Analysis
import { 
  ReleaseCategoryReference, 
  SourceTermDefinitionReference, 
  EventSequenceToReleaseCategoryMapping,
  ReleaseCategory,
  SourceTermDefinition,
  RiskSignificantConsequence
} from "../radiological-consequence-analysis";
import { VersionInfo, SCHEMA_VERSION, createVersionInfo } from "../core/version";

//==============================================================================
/**
 * @group Core Definitions & Enums
 * @description Basic types, enums, and utility interfaces used throughout the module
 */
//==============================================================================

    /**
 * Reference to a Risk Significance Criteria by its unique identifier.
 * @description Used to reference risk significance criteria without creating circular dependencies.
 * @example "RSC-CDF-01"
 * @group Core Definitions & Enums
 */
export type RiskSignificanceCriteriaReference = string & tags.Pattern<"^RSC-[A-Za-z0-9_-]+$">;

/**
 * Reference to an Integrated Risk Result by its unique identifier.
 * @group Core Definitions & Enums
 */
export type IntegratedRiskResultReference = string & tags.Pattern<"^IRR-[A-Za-z0-9_-]+$">;

/**
 * Reference to a significant risk contributor analysis by its unique identifier.
 * @group Core Definitions & Enums
 */
export type SignificantContributorReference = string & tags.Pattern<"^SRC-[A-Za-z0-9_-]+$">;

/**
 * Reference to a risk integration method by its unique identifier.
 * @group Core Definitions & Enums
 */
export type RiskIntegrationMethodReference = string & tags.Pattern<"^RIM-[A-Za-z0-9_-]+$">;

/**
 * Interface for a risk metric with value and uncertainty.
 * @group Core Definitions & Enums
 */
export interface RiskMetric extends Unique, Named {
    /** Type of risk metric */
    metricType: RiskMetricType | string;
    
    /** Description of the risk metric */
    description?: string;
    
    /** Point estimate value of the risk metric */
    value: number;
    
    /** Units for the metric (e.g., "per reactor year") */
    units: FrequencyUnit | string;
    
    /** Uncertainty associated with the risk metric value */
    uncertainty?: Uncertainty;
    
    /** Applicable acceptance criteria (if any) */
    acceptanceCriteria?: {
        limit: number;
        basis: string;
        complianceStatus: "COMPLIANT" | "NON_COMPLIANT" | "INDETERMINATE";
    };
}

/**
 * Risk contributor with importance metrics.
 * @group Core Definitions & Enums
 */
export interface RiskContributor extends Unique, Named {
    /** Type of contributor (e.g., "event-sequence", "component") */
    contributorType: string;
    
    /** Original technical element where this contributor is defined */
    sourceElement: TechnicalElementTypes;
    
    /** Reference ID to the original entity in its technical element */
    sourceId: string;
    
    /** Importance metrics for this contributor */
    importanceMetrics?: {
        /** Fussell-Vesely importance measure */
        fussellVesely?: number;
        
        /** Risk Achievement Worth */
        raw?: number;
        
        /** Risk Reduction Worth */
        rrw?: number;
        
        /** Birnbaum importance measure */
        birnbaum?: number;
        
        /** Other importance measures */
        [key: string]: number | undefined;
    };
    
    /** Estimated contribution to total risk */
    riskContribution?: number;
    
    /** Importance level of this contributor */
    importanceLevel?: ImportanceLevel;
    
    /** Additional contextual information about this contributor */
    context?: string;
    
    /** Risk insights derived from this contributor */
    insights?: string[];
}

//==============================================================================
/**
 * @group Risk Significance Criteria
 * @description Interfaces for defining and applying risk significance criteria 
 */
//==============================================================================

/**
 * Interface defining the criteria used to establish risk significance.
 * @remarks **HLR-RI-A**
 * @example
 * ```
 * {
 *   uuid: "123e4567-e89b-12d3-a456-426614174000",
 *   name: "CDF Risk Significance Criteria",
 *   description: "Criteria for determining risk-significant contributors to Core Damage Frequency",
 *   criteriaType: RiskSignificanceCriteriaType.HYBRID,
 *   metricType: RiskMetricType.CDF,
 *   absoluteThresholds: {
 *     eventSequence: 1.0e-7,
 *     basic: 1.0e-8,
 *     component: 1.0e-7
 *   },
 *   relativeThresholds: {
 *     eventSequence: 0.01,
 *     basic: 0.005,
 *     component: 0.01
 *   },
 *   justification: "Based on regulatory guidance and industry practice"
 * }
 * ```
 * @group Risk Significance Criteria
 */
export interface RiskSignificanceCriteria extends Unique, Named {
    /** Detailed description of the risk significance criteria [151, RI-A1]. */
    description?: string;

    /**
     * The type of risk significance criteria used.
     * @default RiskSignificanceCriteriaType.ABSOLUTE
     */
    criteriaType: RiskSignificanceCriteriaType | string;
    
    /**
     * The risk metric this criteria applies to.
     */
    metricType: RiskMetricType | string;

    /**
     * Absolute thresholds for determining risk significance [151, RI-A2, RI-A3].
     * Different thresholds can be defined for different PRA elements.
     */
    absoluteThresholds?: {
        /** Threshold for event sequences */
        eventSequence?: number;
        
        /** Threshold for event sequence families */
        eventSequenceFamily?: number;
        
        /** Threshold for basic events */
        basic?: number;
        
        /** Threshold for human failure events */
        humanFailure?: number;
        
        /** Threshold for components */
        component?: number;
        
        /** Threshold for systems */
        system?: number;
        
        /** Other specific thresholds */
        [key: string]: number | undefined;
    };
    
    /**
     * Relative thresholds (as fraction of total) for determining risk significance [151, RI-A2, RI-A3].
     * Different thresholds can be defined for different PRA elements.
     */
    relativeThresholds?: {
        /** Threshold for event sequences (e.g. 0.01 for 1% of total) */
        eventSequence?: number;
        
        /** Threshold for event sequence families */
        eventSequenceFamily?: number;
        
        /** Threshold for basic events */
        basic?: number;
        
        /** Threshold for human failure events */
        humanFailure?: number;
        
        /** Threshold for components */
        component?: number;
        
        /** Threshold for systems */
        system?: number;
        
        /** Other specific thresholds */
        [key: string]: number | undefined;
    };

    /**
     * Justification for the selected risk significance criteria, ensuring consistency with the
     * intended PRA applications [151, RI-A4].
     */
    justification: string;

    /**
     * Minimum reporting consequence level, or justification for an alternative [152, RI-A5].
     * @example "10% of the consequences due to background radiation dose"
     */
    minimumReportingConsequence?: string;
    
    /**
     * References to any supporting documents, standards, or guidance.
     */
    references?: string[];
    
    /**
     * PRA applications this criteria is intended to support.
     */
    intendedApplications?: string[];
}

/**
 * Interface for risk significance evaluation of a specific PRA element.
 * @remarks **RI-A3**
 * @example
 * ```
 * {
 *   uuid: "123e4567-e89b-12d3-a456-426614174001",
 *   elementType: "event-sequence",
 *   elementId: "ES-LOCA-001",
 *   criteriaReference: "RSC-CDF-01",
 *   evaluationResults: {
 *     absoluteValue: 2.5e-7,
 *     relativeValue: 0.015,
 *     isSignificant: true,
 *     significanceBasis: "Exceeds both absolute threshold of 1.0e-7 and relative threshold of 1%"
 *   }
 * }
 * ```
 * @group Risk Significance Criteria
 */
export interface RiskSignificanceEvaluation extends Unique {
    /** Type of PRA element being evaluated (e.g., "event-sequence", "basic-event") */
    elementType: string;
    
    /** ID of the element being evaluated */
    elementId: string;
    
    /** Reference to the risk significance criteria being applied */
    criteriaReference: RiskSignificanceCriteriaReference;
    
    /** Results of the significance evaluation */
    evaluationResults: {
        /** Absolute risk value of the element */
        absoluteValue?: number;
        
        /** Relative contribution (as fraction of total) */
        relativeValue?: number;
        
        /** Whether the element is considered risk-significant */
        isSignificant: boolean;
        
        /** Basis for the significance determination */
        significanceBasis: string;
    };
    
    /** Additional insights from this evaluation */
    insights?: string[];
}

//==============================================================================
/**
 * @group Risk Calculation & Integration
 * @description Interfaces for calculating overall risk and identifying contributors
 */
//==============================================================================

/**
 * Interface representing the calculated overall risk using defined risk metrics.
 * @remarks **HLR-RI-B**
 * @example
 * ```
 * {
 *   uuid: "123e4567-e89b-12d3-a456-426614174002",
 *   name: "Integrated Plant Risk Results - 2023",
 *   description: "Overall plant risk metrics integrated across all hazards and plant operating states",
 *   metrics: [
 *     {
 *       uuid: "123e4567-e89b-12d3-a456-426614174003",
 *       name: "Total Core Damage Frequency",
 *       metricType: RiskMetricType.CDF,
 *       value: 2.5e-6,
 *       units: "PER_REACTOR_YEAR",
 *       uncertainty: {
 *         distribution: DistributionType.LOGNORMAL,
 *         parameters: {
 *           mean: 2.5e-6,
 *           errorFactor: 3
 *         }
 *       }
 *     }
 *   ],
 *   integrationChallenges: "Different levels of detail in external hazards analysis required normalization"
 * }
 * ```
 * @group Risk Calculation & Integration
 */
export interface IntegratedRiskResults extends Unique, Named {
    /** Description of the integrated risk results [152, RI-B2]. */
    description?: string;

    /**
     * The risk metrics used for calculating the overall risk [152, RI-B2].
     */
    metrics: RiskMetric[];
    
    /**
     * Calculation approach used for risk integration [152, RI-B2].
     * Specifies which approach(es) from RI-B2 were used.
     */
    calculationApproach: {
        /** 
         * Whether point estimate approach was used (sum of the product of point estimate 
         * frequencies and consequences) [152, RI-B2(a)].
         */
        pointEstimateApproach?: boolean;
        
        /** 
         * Whether mean value approach was used (sum of the product of mean frequencies 
         * and mean consequences) [152, RI-B2(a)].
         */
        meanValueApproach?: boolean;
        
        /** 
         * Whether frequency-consequence plots were used [152, RI-B2(b)].
         */
        frequencyConsequencePlots?: boolean;
        
        /** 
         * Whether exceedance frequency curves (CCDF) were used [152, RI-B2(c)].
         */
        exceedanceFrequencyCurves?: boolean;
        
        /** 
         * Description of alternative approaches, if used [152, RI-B2].
         */
        alternativeApproach?: string;
        
        /**
         * Justification for the selected approach(es) [152, RI-B2].
         */
        justification: string;
    };
    
    /**
     * Frequency-consequence plot data, if this approach was used [152, RI-B2(b)].
     */
    frequencyConsequencePlotData?: Array<{
        /** ID of the event sequence or event sequence family */
        eventSequenceId: string;
        
        /** Name of the event sequence or event sequence family */
        eventSequenceName?: string;
        
        /** Frequency value (mean or point estimate) */
        frequency: number;
        
        /** Consequence value (mean or point estimate) */
        consequence: number;
        
        /** Consequence metric (e.g., "person-rem", "Ci released") */
        consequenceMetric: string;
        
        /** Uncertainty in frequency (e.g., 5th and 95th percentiles) */
        frequencyUncertainty?: {
            lowerBound: number;
            upperBound: number;
            confidenceLevel: number;
        };
        
        /** Uncertainty in consequence (e.g., 5th and 95th percentiles) */
        consequenceUncertainty?: {
            lowerBound: number;
            upperBound: number;
            confidenceLevel: number;
        };
    }>;
    
    /**
     * Exceedance frequency curve data, if this approach was used [152, RI-B2(c)].
     * Represents complementary cumulative distribution function (CCDF) data.
     */
    exceedanceFrequencyCurveData?: Array<{
        /** Consequence metric (e.g., "person-rem", "Ci released") */
        consequenceMetric: string;
        
        /** Data points for the exceedance frequency curve */
        dataPoints: Array<{
            /** Consequence value */
            consequenceValue: number;
            
            /** Frequency of exceeding this consequence value */
            exceedanceFrequency: number;
        }>;
        
        /** Uncertainty in the exceedance frequency curve */
        uncertaintyBands?: Array<{
            /** Confidence level (e.g., 0.05 for 5th percentile, 0.95 for 95th percentile) */
            confidenceLevel: number;
            
            /** Data points for this confidence level */
            dataPoints: Array<{
                /** Consequence value */
                consequenceValue: number;
                
                /** Exceedance frequency at this confidence level */
                exceedanceFrequency: number;
            }>;
        }>;
    }>;

    /**
     * Breakdown of risk contributions by hazard group.
     * @example { "INTERNAL_EVENTS": 1.5E-6, "SEISMIC": 7.5E-7, "INTERNAL_FLOOD": 2.5E-7 }
     */
    hazardGroupContributions?: Record<string, number>;
    
    /**
     * Breakdown of risk contributions by plant operating state.
     * @example { "FULL_POWER": 2.0E-6, "LOW_POWER": 3.5E-7, "SHUTDOWN": 1.5E-7 }
     */
    plantOperatingStateContributions?: Record<string, number>;

    /**
     * Identification of any differences in the level of detail, conservatism, and realism when
     * integrating results from different sources, hazards, or POSs [152, RI-B4].
     */
    integrationChallenges?: string;
    
    /**
     * Specific approach used to account for differences in level of detail and conservatism
     * when aggregating results from different sources [152, RI-B3].
     */
    aggregationApproach?: {
        /** Description of the approach */
        description: string;
        
        /** Adjustments made to ensure consistent level of detail */
        detailLevelAdjustments?: string;
        
        /** Adjustments made to ensure consistent level of conservatism */
        conservatismAdjustments?: string;
        
        /** Justification for the approach */
        justification: string;
    };

    /**
     * Identification of all sources of radioactive material considered and their risk contributions [152, RI-B5].
     * @example { "Reactor Core 1": 2.0E-6, "Spent Fuel Pool": 5.0E-7 }
     */
    radioactiveSourceContributions?: Record<string, number>;
    
    /**
     * Documentation of key assumptions affecting the integrated results.
     */
    keyAssumptions?: string[];
    
    /**
     * Status of compliance with applicable risk acceptance criteria.
     */
    complianceStatus?: {
        criterion: string;
        limit: number;
        status: "COMPLIANT" | "NON_COMPLIANT" | "INDETERMINATE";
        margin?: number;
        basis?: string;
    }[];
    
    /**
     * Justification that the selection of event sequence variations within each family
     * is representative of the range of potential outcomes [152, RI-B5].
     */
    eventSequenceVariationJustification?: string;
}

/**
 * Interface representing the significant risk contributors identified from the integrated risk results.
 * @remarks **RI-B6**
 * @example
 * ```typescript
 * const contributors: SignificantRiskContributors = {
 *   uuid: "123e4567-e89b-12d3-a456-426614174004",
 *   metricType: RiskMetricType.CDF,
 *   significantEventSequences: [
 *     {
 *       uuid: "123e4567-e89b-12d3-a456-426614174005",
 *       name: "Station Blackout (SBO)",
 *       contributorType: "event-sequence",
 *       sourceElement: TechnicalElementTypes.EVENT_SEQUENCE_ANALYSIS,
 *       sourceId: "ES-SBO-001",
 *       importanceMetrics: {
 *         fussellVesely: 0.15,
 *         raw: 12.5
 *       },
 *       riskContribution: 3.75e-7,
 *       importanceLevel: ImportanceLevel.HIGH
 *     }
 *   ],
 *   significantSystems: [
 *     // Systems would be listed here
 *   ],
 *   significantBasicEvents: [
 *     // Basic events would be listed here
 *   ],
 *   insights: ["Station blackout events represent 15% of the total core damage frequency"]
 * };
 * ```
 * @group Risk Calculation & Integration
 */
export interface SignificantRiskContributors extends Unique {
    /** The risk metric these contributors apply to */
    metricType: RiskMetricType | string;
    
    /** Description of the significant risk contributors [152, RI-B6]. */
    description?: string;

    /**
     * List of risk-significant event sequences or event sequence families [152, RI-B6].
     */
    significantEventSequences?: RiskContributor[];

    /**
     * List of risk-significant systems [152, RI-B6].
     */
    significantSystems?: RiskContributor[];
    
    /**
     * List of risk-significant components.
     */
    significantComponents?: RiskContributor[];

    /**
     * List of risk-significant basic events, including human failure events (HFEs) [152, 156, RI-B6].
     */
    significantBasicEvents?: RiskContributor[];
    
    /**
     * List of risk-significant plant operating states.
     */
    significantPlantOperatingStates?: RiskContributor[];
    
    /**
     * List of risk-significant hazard groups.
     */
    significantHazardGroups?: RiskContributor[];
    
    /**
     * List of risk-significant radioactive sources.
     */
    significantRadioactiveSources?: RiskContributor[];

    /**
     * Risk insights derived from the significant contributors [156, RI-D1(g)].
     */
    insights?: string[];
    
    /**
     * Any screening criteria used to identify significant contributors.
     */
    screeningCriteria?: {
        criteriaType: string;
        threshold: number;
        basis: string;
    };
}

/**
 * Interface for documenting the methods and codes used for Risk Integration.
 * @remarks **RI-B7**
 * @example
 * ```
 * {
 *   uuid: "123e4567-e89b-12d3-a456-426614174006",
 *   name: "MinMaxCut Importance Analysis",
 *   version: "2.3.1",
 *   description: "Method for calculating importance measures for minimal cut sets",
 *   applicability: "Suitable for Boolean logic models with well-defined minimal cut sets",
 *   limitations: [
 *     "Assumes independence between basic events",
 *     "May not be suitable for highly non-linear models"
 *   ],
 *   justification: "Industry standard approach with well-documented validation history"
 * }
 * ```
 * @group Risk Calculation & Integration
 */
export interface RiskIntegrationMethod extends Unique, Named {
    /** Description of the method or code [153, RI-B7]. */
    description?: string;

    /** Version of the method or code. */
    version?: string;
    
    /** Scope of applicability */
    applicability?: string;

    /** Limitations of the method or code [153, RI-B7]. */
    limitations?: string[];

    /** Justification for the application of the method or code, considering its limitations and the PRA scope [153, RI-B7]. */
    justification: string;
    
    /** Reference to software quality assurance documentation, if applicable */
    sqaReference?: string;
    
    /** Verification and validation status */
    verificationStatus?: {
        verified: boolean;
        verificationMethod?: string;
        verificationDate?: string;
        verifier?: string;
    };
}

//==============================================================================
/**
 * @group Uncertainty & Sensitivity Analysis
 * @description Interfaces for characterizing uncertainties and assumptions
 */
//==============================================================================

/**
 * Interface representing a key source of model uncertainty.
 * @remarks **RI-C1**
 * @example
 * ```
 * {
 *   uuid: "123e4567-e89b-12d3-a456-426614174007",
 *   name: "Human Reliability Under Extreme Conditions",
 *   description: "Uncertainty in operator response times during extreme environmental conditions",
 *   originatingElement: TechnicalElementTypes.HUMAN_RELIABILITY_ANALYSIS,
 *   impactScope: ["EVENT_SEQUENCE_QUANTIFICATION", "RISK_INTEGRATION"],
 *   affectedMetrics: [RiskMetricType.CDF, RiskMetricType.LERF],
 *   impactAssessment: "Could increase CDF by up to 20% in seismic scenarios",
 *   characterizationMethod: "Sensitivity studies with varying HEP values"
 * }
 * ```
 * @group Uncertainty & Sensitivity Analysis
 */
export interface ModelUncertaintySource extends Unique, Named {
    /** Description of the uncertainty source */
    description: string;
    
    /** Technical element where this uncertainty originates */
    originatingElement: TechnicalElementTypes;
    
    /** Technical elements affected by this uncertainty */
    impactScope: TechnicalElementTypes[];
    
    /** Risk metrics affected by this uncertainty */
    affectedMetrics: (RiskMetricType | string)[];
    
    /** Assessment of the potential impact on risk results */
    impactAssessment: string;
    
    /** Method used to characterize this uncertainty */
    characterizationMethod?: string;
    
    /** Related assumptions */
    relatedAssumptions?: string[];
    
    /** Alternative modeling approaches considered */
    alternatives?: {
        description: string;
        potentialImpact: string;
    }[];
    
    /** Recommendations for reducing this uncertainty */
    recommendations?: string[];
}

/**
 * Interface representing the characterization and quantification of uncertainties in the calculated risk metrics.
 * @remarks **HLR-RI-C**
 * @example
 * ```
 * {
 *   uuid: "123e4567-e89b-12d3-a456-426614174008",
 *   name: "Complete Plant CDF Uncertainty Analysis",
 *   description: "Comprehensive uncertainty analysis for the integrated CDF",
 *   metric: RiskMetricType.CDF,
 *   propagationMethod: "Monte Carlo sampling with 10,000 trials",
 *   parameterUncertainty: {
 *     distribution: DistributionType.LOGNORMAL,
 *     parameters: {
 *       mean: 2.5e-6,
 *       "5th_percentile": 8.3e-7,
 *       "50th_percentile": 2.1e-6,
 *       "95th_percentile": 7.2e-6
 *     }
 *   },
 *   keyUncertaintySources: [
 *     {
 *       uuid: "123e4567-e89b-12d3-a456-426614174007",
 *       name: "Human Reliability Under Extreme Conditions"
 *     }
 *   ]
 * }
 * ```
 * @group Uncertainty & Sensitivity Analysis
 */
export interface RiskUncertaintyAnalysis extends Unique, Named {
    /** Description of the uncertainty analysis [153, RI-C1]. */
    description?: string;
    
    /** The risk metric being analyzed */
    metric: RiskMetricType | string;

    /**
     * Method used to propagate uncertainties
     * @example "Monte Carlo simulation with 10,000 trials"
     */
    propagationMethod: string;
    
    /**
     * Parameter uncertainty results (quantitative)
     */
    parameterUncertainty?: {
        /** Distribution type representing the uncertainty */
        distribution: DistributionType;
        
        /** Distribution parameters (e.g., percentiles, mean, variance) */
        parameters: Record<string, number>;
    };

    /**
     * Key sources of model uncertainty identified in each technical element [153, 154, RI-C1].
     */
    keyUncertaintySources?: ModelUncertaintySource[];

    /**
     * Assumptions related to the risk metric uncertainty analysis [153, RI-C1].
     */
    relatedAssumptions?: Assumption[];
    
    /**
     * Prioritization of key uncertainty sources based on their impact
     */
    prioritization?: {
        uncertaintySourceId: string;
        priorityLevel: ImportanceLevel;
        basis: string;
    }[];

    /**
     * Sensitivity studies performed to explore the impact of uncertainties [154, RI-C2].
     */
    sensitivityStudies?: SensitivityStudy[];

    /**
     * Discussion of the range of the uncertainty, consistent with parameter uncertainties [155, RI-C4].
     */
    uncertaintyRangeDiscussion?: string;
    
    /**
     * Comparison with deterministic safety analyses, if applicable [155, RI-C3].
     */
    deterministicComparison?: string;
    
    /**
     * Identification of key sources of uncertainty that contribute most to the uncertainty in risk results [155, RI-C5].
     * This explicitly addresses the RI-C5 requirement to identify the key sources of uncertainty.
     */
    keyUncertaintyContributors?: {
        /** ID of the uncertainty source */
        sourceId: string;
        
        /** Name of the uncertainty source */
        sourceName: string;
        
        /** Contribution to overall uncertainty (e.g., percentage or qualitative assessment) */
        contribution: string | number;
        
        /** Basis for determining this is a key contributor */
        basis: string;
        
        /** Potential risk impact range */
        potentialImpactRange?: {
            lowerBound: number;
            upperBound: number;
            unit?: string;
        };
        
        /** Recommended actions to reduce this uncertainty */
        recommendedActions?: string[];
        
        /** Priority for addressing this uncertainty */
        priority?: ImportanceLevel;
    }[];
    
    /**
     * Method used to identify key uncertainty contributors [155, RI-C5].
     * Documents the approach used to determine which sources of uncertainty contribute most to the results.
     */
    keyContributorIdentificationMethod?: {
        /** Description of the method */
        description: string;
        
        /** Criteria used to determine significance */
        significanceCriteria: string;
        
        /** Justification for the method */
        justification: string;
    };
}

/**
 * Interface representing a key assumption in the risk integration.
 * @remarks **RI-D2**
 * @example
 * ```
 * {
 *   uuid: "123e4567-e89b-12d3-a456-426614174009",
 *   description: "Independence between seismic hazard-induced initiating events and component fragilities",
 *   originatingElement: TechnicalElementTypes.SEISMIC_PRA,
 *   basis: "Standard practice in seismic PRA; supported by plant-specific fragility analyses",
 *   impact: "May underestimate risk in scenarios with widespread damage",
 *   alternatives: [
 *     "Model correlations between seismic-induced initiators and component failures"
 *   ]
 * }
 * ```
 * @group Documentation & Traceability
 */
export interface RiskIntegrationAssumption extends Unique {
    /** Description of the assumption */
    description: string;
    
    /** Technical element where this assumption originates */
    originatingElement: TechnicalElementTypes;
    
    /** Basis for the assumption */
    basis: string;
    
    /** Impact of the assumption on risk results */
    impact: string;
    
    /** Alternative assumptions that could have been made */
    alternatives?: string[];
    
    /** Status of the assumption validation */
    validationStatus?: "VALIDATED" | "PENDING" | "INVALIDATED";
    
    /** For pre-operational PRAs, plan for validation once the plant is operational */
    validationPlan?: string;
}

/**
 * Interface for documenting the Risk Integration analysis.
 * @remarks **HLR-RI-D**
 * @example
 * ```
 * {
 *   uuid: "123e4567-e89b-12d3-a456-426614174011",
 *   processDescription: "Comprehensive process for integrating risk results across all hazards and plant operating states",
 *   riskSignificanceCriteriaDescription: "Criteria based on regulatory guidance with both absolute and relative thresholds",
 *   calculationMethodsDescription: "Monte Carlo simulation with 10,000 trials for uncertainty propagation",
 *   uncertaintyAnalysisDescription: "Parameter and model uncertainties were characterized and propagated through the analysis",
 *   keyAssumptionsDescription: "Key assumptions include independence between certain hazard groups",
 *   limitationsDescription: "Analysis is limited by the level of detail in external hazards modeling"
 * }
 * ```
 * @group Documentation & Traceability
 */
export interface RiskIntegrationDocumentation extends Unique {
    /** 
     * Description of the process used in the Risk Integration analysis [156, RI-D1(a)].
     * Includes what is used as input, the applied methods, and the results.
     */
    processDescription: string;
    
    /** 
     * Description of the risk significance criteria used [156, RI-D1(b)].
     * Includes both absolute and relative criteria.
     */
    riskSignificanceCriteriaDescription: string;
    
    /** 
     * Description of the methods used to calculate the overall risk [156, RI-D1(c)].
     * Includes approaches for calculating integrated risk metrics.
     */
    calculationMethodsDescription: string;
    
    /** 
     * Description of the uncertainty analysis performed [156, RI-D1(d)].
     * Includes characterization and quantification of uncertainties.
     */
    uncertaintyAnalysisDescription: string;
    
    /** 
     * Description of the key assumptions made in the Risk Integration [156, RI-D1(e)].
     * Includes sources of model uncertainty and related assumptions.
     */
    keyAssumptionsDescription: string;
    
    /** 
     * Description of the limitations of the Risk Integration analysis [156, RI-D1(f)].
     * Includes limitations due to the lack of as-built, as-operated details.
     */
    limitationsDescription: string;
    
    /** 
     * Risk insights derived from the Risk Integration analysis [156, RI-D1(g)].
     * Includes insights about significant contributors to risk.
     */
    riskInsights?: string[];
    
    /** 
     * For pre-operational PRAs, documentation of assumptions and limitations [156, RI-D3].
     * Includes plans for validation once the plant is operational.
     */
    preOperationalAssumptions?: {
        assumption: string;
        impact: string;
        validationPlan: string;
    }[];
    
    /** 
     * References to supporting analyses and documentation.
     */
    references?: string[];
    
    /**
     * Peer review findings and resolutions.
     */
    peerReviewFindings?: {
        findingId: string;
        description: string;
        significance: ImportanceLevel;
        resolution: string;
        status: "OPEN" | "CLOSED" | "IN_PROGRESS";
    }[];
    
    /**
     * Documentation of the integration with event sequence analysis.
     * Describes how event sequence analysis results were used in risk integration.
     */
    eventSequenceIntegrationDescription?: {
        /** Description of the integration process */
        integrationProcessDescription: string;
        
        /** How event sequence families were mapped to release categories */
        mappingApproach: string;
        
        /** How frequencies were derived or adjusted */
        frequencyDerivationApproach: string;
        
        /** Challenges encountered during integration */
        integrationChallenges?: string[];
        
        /** How inconsistencies were resolved */
        inconsistencyResolution?: string;
        
        /** Feedback provided to event sequence analysis */
        feedbackProvided?: string;
    };
    
    /**
     * Documentation of the integration with mechanistic source term analysis.
     * Describes how mechanistic source term analysis results were used in risk integration.
     */
    mechanisticSourceTermIntegrationDescription?: {
        /** Description of the integration process */
        integrationProcessDescription: string;
        
        /** How release categories were incorporated into risk metrics */
        releaseCategoryIntegrationApproach: string;
        
        /** How source term definitions were used in risk calculations */
        sourceTermUtilizationApproach: string;
        
        /** How uncertainties in source terms were propagated to risk results */
        uncertaintyPropagationApproach?: string;
        
        /** Challenges encountered during integration */
        integrationChallenges?: string[];
        
        /** How inconsistencies were resolved */
        inconsistencyResolution?: string;
        
        /** Feedback provided to mechanistic source term analysis */
        feedbackProvided?: string;
        
        /** Key insights about source terms derived from risk integration */
        sourceTermInsights?: string[];
    };
}

//==============================================================================
/**
 * @group Risk Calculation & Integration
 * @description Interfaces for integrating results from other technical elements
 */
//==============================================================================

/**
 * Interface representing the mapping between event sequences and release categories.
 * @remarks **RI-B1**
 * @example
 * ```
 * {
 *   uuid: "123e4567-e89b-12d3-a456-426614174010",
 *   eventSequenceId: "ES-LOCA-RECIRC-001",
 *   releaseCategoryId: "RC-LATE-SMALL",
 *   mappingBasis: "Deterministic analysis of containment response to LOCA without recirculation",
 *   frequency: 1.2e-7,
 *   frequencyUnit: FrequencyUnit.PER_REACTOR_YEAR,
 *   uncertaintyFactors: ["Thermal-hydraulic model limitations", "Containment leak path analysis"],
 *   supportingAnalyses: ["TH-LOCA-001", "CONT-RESP-002"]
 * }
 * ```
 * @group Risk Calculation & Integration
 * @see ReleaseCategoryMapping in event-sequence-analysis.ts - The event sequence analysis module defines a similar interface for mapping event sequences to release categories.
 * @see EventSequenceToReleaseCategoryMapping in mechanistic-source-term.ts - The mechanistic source term module defines a similar interface for mapping event sequences to release categories.
 * 
 * @remarks Integration with Mechanistic Source Term Analysis
 * This interface is designed to work with the EventSequenceToReleaseCategoryMapping interface from the Mechanistic Source Term Analysis module.
 * When implementing risk integration:
 * 
 * 1. Start with the EventSequenceToReleaseCategoryMapping objects from Mechanistic Source Term Analysis
 * 2. For each mapping, create an EventSequenceToReleaseCategory object:
 *    - Preserve the eventSequenceReference and releaseCategoryReference
 *    - Add frequency information from Event Sequence Quantification
 *    - Reference the original mapping using a field like originalMappingId
 * 3. Use these mappings for risk integration calculations
 * 4. When updating Mechanistic Source Term Analysis with risk integration results:
 *    - Find the original EventSequenceToReleaseCategoryMapping
 *    - Update it with insights from risk integration
 */
export interface EventSequenceToReleaseCategory extends Unique {
    /** ID of the event sequence or event sequence family */
    eventSequenceId: EventSequenceReference | EventSequenceFamilyReference;
    
    /** ID of the release category */
    releaseCategoryId: ReleaseCategoryReference;
    
    /** Basis for the mapping between event sequence and release category */
    mappingBasis: string;
    
    /** Frequency of this specific mapping */
    frequency: number;
    
    /** Frequency unit */
    frequencyUnit?: FrequencyUnit;
    
    /** Factors contributing to uncertainty in this mapping */
    uncertaintyFactors?: string[];
    
    /** References to supporting analyses */
    supportingAnalyses?: string[];
    
    /** 
     * Reference to the original mapping in the event sequence analysis, if available.
     * This provides traceability between the risk integration and event sequence analysis.
     */
    originalMappingId?: string;
    
    /**
     * Indicates whether this mapping was derived from or is consistent with
     * the event sequence analysis mappings.
     */
    consistentWithEventSequenceAnalysis?: boolean;
    
    /**
     * Reference to the original mapping in the mechanistic source term analysis, if available.
     * This provides traceability between the risk integration and mechanistic source term analysis.
     */
    originalMstMappingId?: string;
    
    /**
     * Indicates whether this mapping was derived from or is consistent with
     * the mechanistic source term analysis mappings.
     */
    consistentWithMstAnalysis?: boolean;
    
    /**
     * Reference to the source term definition associated with this release category.
     * This links to the detailed source term information in the mechanistic source term module.
     */
    sourceTermDefinitionReference?: SourceTermDefinitionReference;
}

/**
 * Comprehensive interface for the Risk Integration technical element.
 *
 * @remarks **HLR-RI**
 * @group API
 */
export interface RiskIntegration extends TechnicalElement<TechnicalElementTypes.RISK_INTEGRATION> {
    /**
     * Additional metadata specific to Risk Integration.
     */
    additionalMetadata?: {
        /** Risk integration specific limitations */
        limitations?: string[];
        
        /** Risk integration specific assumptions */
        assumptions?: string[];
        
        /** Traceability information */
        traceability?: string;
        
        /** 
         * References to event sequence analysis results used as input.
         * This provides traceability between technical elements.
         */
        eventSequenceAnalysisReferences?: {
            /** ID of the event sequence analysis */
            analysisId: string;
            
            /** Version or revision of the analysis */
            version?: string;
            
            /** Date the analysis was performed */
            date?: string;
            
            /** Description of how the analysis was used */
            usageDescription: string;
        }[];
        
        /** 
         * References to mechanistic source term analysis results used as input.
         * This provides traceability between technical elements.
         */
        mechanisticSourceTermReferences?: {
            /** ID of the mechanistic source term analysis */
            analysisId: string;
            
            /** Version or revision of the analysis */
            version?: string;
            
            /** Date the analysis was performed */
            date?: string;
            
            /** Description of how the analysis was used */
            usageDescription: string;
        }[];
    };
    
    /**
     * Definition of the scope of the risk integration analysis
     * @remarks **RI-A1**
     */
    scopeDefinition?: {
        /** Consequence measures included in the analysis */
        consequenceMeasures: string[];
        
        /** Plant operating states included in the analysis */
        plantOperatingStateIds: string[];
        
        /** Hazard groups included in the analysis */
        hazardGroups: string[];
        
        /** Sources of radioactive material within scope */
        radioactiveMaterialSources: string[];
        
        /**
         * Event sequence families included in the analysis.
         * This provides a direct link to the event sequence analysis.
         */
        eventSequenceFamilyIds?: EventSequenceFamilyReference[];
        
        /**
         * Release categories included in the analysis.
         * This provides a direct link to the mechanistic source term analysis.
         */
        releaseCategoryIds?: ReleaseCategoryReference[];
        
        /**
         * Source term definitions included in the analysis.
         * This provides a direct link to the mechanistic source term analysis.
         */
        sourceTermDefinitionIds?: SourceTermDefinitionReference[];
    };
    
    /**
     * Risk significance criteria defined for the PRA.
     * @remarks **HLR-RI-A**
     * @remarks **RI-A2**
     * @remarks **RI-A3**
     */
    riskSignificanceCriteria: RiskSignificanceCriteria[];
    
    /**
     * Risk significance evaluations for specific PRA elements.
     * @remarks **RI-A3**
     */
    riskSignificanceEvaluations?: RiskSignificanceEvaluation[];
    
    /**
     * Mappings between event sequences and release categories.
     * @remarks **RI-B1**
     * @remarks This field should be populated based on the ReleaseCategoryMapping objects from the Event Sequence Analysis module.
     */
    eventSequenceToReleaseCategoryMappings: EventSequenceToReleaseCategory[];
    
    /**
     * Integrated risk results.
     * @remarks **HLR-RI-B**
     * @remarks **RI-B2**
     * @remarks **RI-B3**
     * @remarks **RI-B4**
     */
    integratedRiskResults: IntegratedRiskResults;
    
    /**
     * Significant risk contributors identified from the integrated risk results.
     * @remarks **RI-B6**
     */
    significantContributors: SignificantRiskContributors;
    
    /**
     * Methods and codes used for risk integration.
     * @remarks **RI-B7**
     */
    integrationMethods: RiskIntegrationMethod[];
    
    /**
     * Uncertainty analyses for the calculated risk metrics.
     * @remarks **HLR-RI-C**
     * @remarks **RI-C1**
     * @remarks **RI-C2**
     * @remarks **RI-C3**
     * @remarks **RI-C4**
     * @remarks **RI-C5**
     */
    uncertaintyAnalyses: RiskUncertaintyAnalysis[];
    
    /**
     * Key assumptions in the risk integration.
     * @remarks **RI-D2**
     */
    keyAssumptions?: RiskIntegrationAssumption[];
    
    /**
     * Documentation of the risk integration.
     * @remarks **HLR-RI-D**
     * @remarks **RI-D1**
     */
    documentation: RiskIntegrationDocumentation;
    
    /**
     * For pre-operational PRAs, assumptions and limitations due to the lack of as-built, as-operated details.
     * @remarks **RI-D3**
     */
    preOperationalAssumptions?: {
        assumption: string;
        impact: string;
        validationPlan: string;
    }[];
    
    /**
     * Sensitivity studies for uncertainty assessment
     * @remarks **RI-C2**
     */
    sensitivityStudies?: SensitivityStudy[];
    
    /**
     * Validation rules for the risk integration analysis
     */
    validationRules?: RiskIntegrationValidationRules;
    
    /**
     * Feedback to event sequence analysis.
     * This field contains information that should be fed back to the event sequence analysis
     * based on the results of risk integration.
     */
    eventSequenceAnalysisFeedback?: {
        /** ID of the event sequence analysis to update */
        analysisId: string;
        
        /** Feedback on release category mappings */
        releaseCategoryMappingFeedback?: {
            /** ID of the original mapping in event sequence analysis */
            originalMappingId: string;
            
            /** Updated frequency information */
            updatedFrequency?: number;
            
            /** Updated frequency unit */
            updatedFrequencyUnit?: FrequencyUnit;
            
            /** Additional insights from risk integration */
            insights?: string[];
            
            /** Recommendations for improving the mapping */
            recommendations?: string[];
        }[];
        
        /** Feedback on event sequence families */
        eventSequenceFamilyFeedback?: {
            /** ID of the event sequence family */
            familyId: EventSequenceFamilyReference;
            
            /** Risk significance level */
            riskSignificance?: ImportanceLevel;
            
            /** Insights from risk integration */
            insights?: string[];
            
            /** Recommendations for improving the family definition */
            recommendations?: string[];
        }[];
        
        /** General feedback on the event sequence analysis */
        generalFeedback?: string;
    };
    
    /**
     * Feedback to mechanistic source term analysis.
     * This field contains information that should be fed back to the mechanistic source term analysis
     * based on the results of risk integration.
     */
    mechanisticSourceTermFeedback?: {
        /** ID of the mechanistic source term analysis to update */
        analysisId: string;
        
        /** Feedback on release categories */
        releaseCategoryFeedback?: {
            /** ID of the release category */
            releaseCategoryId: ReleaseCategoryReference;
            
            /** Risk significance level */
            riskSignificance?: ImportanceLevel;
            
            /** Insights from risk integration */
            insights?: string[];
            
            /** Recommendations for improving the release category definition */
            recommendations?: string[];
        }[];
        
        /** Feedback on source term definitions */
        sourceTermDefinitionFeedback?: {
            /** ID of the source term definition */
            sourceTermDefinitionId: SourceTermDefinitionReference;
            
            /** Risk significance level */
            riskSignificance?: ImportanceLevel;
            
            /** Insights from risk integration */
            insights?: string[];
            
            /** Recommendations for improving the source term definition */
            recommendations?: string[];
            
            /** Key uncertainties identified during risk integration */
            keyUncertainties?: string[];
        }[];
        
        /** Feedback on event sequence to release category mappings */
        mappingFeedback?: {
            /** ID of the original mapping in mechanistic source term analysis */
            originalMappingId: string;
            
            /** Risk significance level */
            riskSignificance?: ImportanceLevel;
            
            /** Insights from risk integration */
            insights?: string[];
            
            /** Recommendations for improving the mapping */
            recommendations?: string[];
        }[];
        
        /** General feedback on the mechanistic source term analysis */
        generalFeedback?: string;
    };

    /**
     * Primary inputs from Event Sequence Quantification.
     * This field provides a structured way to capture inputs from ESQ that are
     * used in risk integration, maintaining a clean dependency structure.
     */
    eventSequenceQuantificationInputs: {
        /**
         * References to event sequence quantification analyses used as input.
         * This provides traceability between technical elements.
         */
        analysisReferences: {
            /** ID of the event sequence quantification analysis */
            analysisId: string;
            
            /** Version or revision of the analysis */
            version?: string;
            
            /** Date the analysis was performed */
            date?: string;
            
            /** Description of how the analysis was used */
            usageDescription: string;
        }[];
        
        /**
         * Risk-significant event sequences identified in the ESQ analysis.
         * This provides the primary input from ESQ for risk integration.
         */
        riskSignificantSequences: RiskSignificantEventSequence[];
        
        /**
         * Method used to determine risk significance of event sequences.
         */
        significanceDeterminationMethod?: string;
    };
    
    /**
     * Primary inputs from Radiological Consequence Analysis.
     * This field provides a structured way to capture inputs from RCA that are
     * used in risk integration, maintaining a clean dependency structure.
     */
    radiologicalConsequenceInputs: {
        /**
         * References to radiological consequence analyses used as input.
         * This provides traceability between technical elements.
         */
        analysisReferences: {
            /** ID of the radiological consequence analysis */
            analysisId: string;
            
            /** Version or revision of the analysis */
            version?: string;
            
            /** Date the analysis was performed */
            date?: string;
            
            /** Description of how the analysis was used */
            usageDescription: string;
        }[];
        
        /**
         * Risk-significant consequences identified in the RCA analysis.
         * This provides the primary input from RCA for risk integration.
         */
        riskSignificantConsequences: RiskSignificantConsequence[];
        
        /**
         * Method used to determine risk significance of consequences.
         */
        significanceDeterminationMethod?: string;
    };
}

/**
 * Interface representing risk integration validation rules.
 * Used to validate the risk integration analysis for completeness and consistency.
 * @group API
 */
export interface RiskIntegrationValidationRules {
    /**
     * Rules for risk significance criteria validation
     */
    riskSignificanceCriteriaRules: {
        /** Validation description */
        description: string;
        
        /** Validation method */
        validationMethod: string;
        
        /** Required criteria elements */
        requiredElements: string[];
    };
    
    /**
     * Rules for integrated risk results validation
     */
    integratedRiskResultsRules: {
        /** Validation description */
        description: string;
        
        /** Validation method */
        validationMethod: string;
        
        /** Required analysis elements */
        requiredElements: string[];
    };
    
    /**
     * Rules for uncertainty analysis validation
     */
    uncertaintyAnalysisRules: {
        /** Validation description */
        description: string;
        
        /** Required uncertainty elements */
        requiredElements: string[];
        
        /** Uncertainty characterization criteria */
        characterizationCriteria: string[];
    };
    
    /**
     * Rules for significant contributor identification validation
     */
    significantContributorRules: {
        /** Validation description */
        description: string;
        
        /** Contributor types that must be addressed */
        requiredContributorTypes: string[];
        
        /** Documentation requirements */
        documentationRequirements: string[];
    };
    
    /**
     * Rules for documentation validation
     */
    documentationRules: {
        /** Validation description */
        description: string;
        
        /** Documentation criteria */
        documentationCriteria: string[];
        
        /** Required documentation elements */
        requiredDocumentation: string[];
    };
}

/**
 * JSON schema for validating {@link RiskIntegration} entities.
 * Provides validation and ensures type safety throughout the application.
 *
 * @group API
 * @example
 * ```
 * const isValid = RiskIntegrationSchema.validate(someData);
 * ```
 */
export const RiskIntegrationSchema = typia.json.application<[RiskIntegration], "3.0">();