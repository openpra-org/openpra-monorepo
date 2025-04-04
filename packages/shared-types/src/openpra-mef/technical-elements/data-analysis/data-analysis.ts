/**
 * @module data_analysis
 * @description The objectives of Data Analysis ensure that HLR-DA-A to HLR-DA-E are implemented.
 * 
 * @preferred
 * @category Technical Elements
 */

/**
 * @summary Requirements Implementation and Improvement Areas
 * 
 * This schema implements the supporting requirements for Data Analysis as follows:
 * 
 * - HLR-DA-A: Parameter definition is implemented through DataAnalysisParameter with clear boundaries,
 *   failure modes, success criteria, and appropriate probability models (DA-A1 through DA-A6).
 * 
 * - HLR-DA-B: Component grouping is implemented through ComponentGrouping with explicit outlier
 *   handling via OutlierComponent to satisfy DA-B2 requirements for excluding outliers from groups.
 * 
 * - HLR-DA-C: Generic and plant-specific data collection is implemented through DataSource and
 *   ExternalDataSource interfaces with consistency checks (DA-C1 through DA-C14).
 * 
 * - Documentation requirements are comprehensively addressed through DataAnalysisDocumentation,
 *   ModelUncertaintyDocumentation, and PreOperationalAssumptionsDocumentation.
 * 
 * Areas for potential improvement:
 * - Enhanced support for test and maintenance unavailability tracking (DA-C16 to DA-C21)
 * - More explicit traceability between requirements and implementation
 * - Expanded support for failure event data extraction criteria (DA-C5 to DA-C7)
 */

import typia, { tags } from "typia";
import { TechnicalElement, TechnicalElementTypes, TechnicalElementMetadata } from "../technical-element";
import { Named, Unique } from "../core/meta";
import { BasicEvent, FrequencyUnit } from "../core/events";
import { SystemDefinition, SystemBasicEvent } from "../systems-analysis/systems-analysis";
import { SuccessCriteriaId } from "../core/shared-patterns";
import { SensitivityStudy } from "../core/shared-patterns";
import { 
    BaseAssumption, 
    PreOperationalAssumption, 
    BasePreOperationalAssumptionsDocumentation 
} from "../core/documentation";
import { ComponentReference } from "../core/component";
import { VersionInfo, SCHEMA_VERSION, createVersionInfo } from "../core/version";

/**
 * Type representing a reference to a plant operating state
 * @group Core Definition and Enums
 */
export type PlantOperatingStateReference = string & tags.Pattern<"^POS-[A-Z0-9_-]+$">;

//==============================================================================
/**
 * @group Core Definition and Enums
 * @description Basic types, enums, and fundamental interfaces for data analysis
 */
//==============================================================================

/**
 * Interface representing the types of parameters used in data analysis.
 * The parameter type determines the type of data analysis that can be performed.
 * 
 * @implements DA-A4
 * @group Core Definition and Enums
 */
export type ParameterType =
    | "FREQUENCY"
    | "PROBABILITY"
    | "UNAVAILABILITY"
    | "CCF_PARAMETER"
    | "HUMAN_ERROR_PROBABILITY"
    | "OTHER";

/**
 * Type representing the level of detectability for a failure mode
 * @group Core Definition and Enums
 */
export type DetectabilityLevel = 'High' | 'Medium' | 'Low' | 'None';

/**
 * Enum representing the types of probability models used in data analysis.
 * 
 * @implements DA-A3
 * @group Core Definition and Enums
 */
export enum DistributionType {
    EXPONENTIAL = "exponential",
    BINOMIAL = "binomial",
    NORMAL = "normal",
    LOGNORMAL = "lognormal",
    WEIBULL = "weibull",
    POISSON = "poisson",
    UNIFORM = "uniform",
    BETA = "beta",
    GAMMA = "gamma",
    POINT_ESTIMATE = "point_estimate"
}

/**
 * Interface representing a probability model with its parameters and estimation details
 * @group Quantification & Uncertainty
 */
export interface ProbabilityModel {
    /** Type of probability distribution */
    distribution: DistributionType;
    
    /** Parameters of the probability distribution */
    parameters: Record<string, number>;
    
    /** Source of the probability model */
    source?: 'estimated' | 'manual' | 'default';
    
    /** Details about how the probability model was estimated */
    estimationDetails?: {
        /** References to data points used in estimation */
        dataPointReferences: string[];
        /** Method used for estimation */
        estimationMethod: string;
        /** Date when estimation was performed */
        estimationDate: string;
        /** Confidence level in the estimation (0-1) */
        confidence: number;
    };
}

/**
 * Interface representing a component-specific basic event
 * @group Parameter Definition & Boundaries
 * @extends {BasicEvent}
 * @description Extends the core BasicEvent type with component-specific properties
 * and SAPHIRE integration capabilities.
 */
export interface ComponentBasicEvent extends BasicEvent {
    /** Reference to ComponentType from core */
    componentTypeReference: string;
    
    /** Reference to FailureModeType */
    failureMode: string;
    
    /** Probability model for this event */
    probabilityModel: ProbabilityModel;
    
    /** Indicates this is a template that can be referenced */
    isTemplate: boolean;
    
    /** SAPHIRE-specific attributes */
    saphireAttributes?: {
        /** Template use flags for controlling what attributes are applied */
        templateUseFlags: {
            componentId: boolean;
            system: boolean;
            train: boolean;
            type: boolean;
            failureMode: boolean;
            location: boolean;
            eventType: boolean;
            description: boolean;
            models: boolean;
            phases: boolean;
            notes: boolean;
            references: boolean;
            categories: boolean[];
        };
        
        /** Alternate descriptions (BEDA format) */
        alternateDescriptions?: {
            short?: string;
            long?: string;
            technical?: string;
            graphical?: string;
        };
        
        /** Component identifiers */
        componentId?: string;
        train?: string;
        
        /** System and location */
        systemId?: string;
        location?: string;
        
        /** Additional categorization */
        eventType?: string;
        categories?: string[];
        
        /** Documentation */
        notes?: string;
        references?: string[];
        
        /** Phase applicability */
        phaseApplicability?: Record<string, boolean>;
    };
}

/**
 * Interface representing an instance of a component basic event template
 * @group Parameter Definition & Boundaries
 * @description Used to create specific instances of component basic events from templates,
 * allowing for instance-specific customization while maintaining the template structure.
 */
export interface ComponentBasicEventInstance {
    /** Unique identifier for this instance */
    instanceId: string;
    
    /** Reference to the Component instance this event is associated with */
    componentReference: string;
    
    /** Reference to the ComponentBasicEvent template this instance is based on */
    templateReference: string;
    
    /** Adjustments to probability parameters for this specific instance */
    probabilityAdjustments?: Record<string, number>;
    
    /** Instance-specific SAPHIRE attributes */
    saphireInstanceAttributes?: {
        /** Component identifier specific to this instance */
        componentId?: string;
        
        /** Train identifier specific to this instance */
        train?: string;
        
        /** System identifier specific to this instance */
        systemId?: string;
        
        /** Location specific to this instance */
        location?: string;
    };
}

/**
 * Interface representing an operational data point collected from a specific component
 * @group Data Collection, Consistency, Grouping
 * @description Represents a single instance of operational data collected from a component,
 * such as a failure event, repair, inspection, or maintenance activity.
 * @implements DA-C3
 */
export interface OperationalDataPoint {
    /** Unique identifier for this data point */
    id: string;
    
    /** Reference to the component instance this data point is associated with */
    componentReference: string;
    
    /** Reference to the component type of the component */
    componentTypeReference: string;
    
    /** Timestamp when the data was recorded (ISO format) */
    timestamp: string;
    
    /** Type of event recorded */
    eventType: 'failure' | 'repair' | 'inspection' | 'maintenance';
    
    /** Number of hours the component was in operation at the time of the event */
    operatingHours: number;
    
    /** Number of cycles the component had completed at the time of the event */
    operatingCycles: number;
    
    /** Optional reference to the failure mode if this is a failure event */
    failureModeReference?: string;
    
    /** Additional measurements recorded during the event */
    measurements?: Record<string, number>;
    
    /** Textual description of the event */
    description?: string;
    
    /** Domain-specific extension data */
    metadata?: Record<string, any>;
}

/**
 * Interface representing a registry of operational data points
 * @group Data Collection, Consistency, Grouping
 * @description Central repository for operational data points with indexing capabilities
 * to facilitate efficient data retrieval for analysis.
 * @implements DA-C4
 */
export interface OperationalDataRegistry {
    /** Unique identifier for this registry */
    id: string;
    
    /** Name of the registry */
    name: string;
    
    /** Array of all data points in the registry */
    dataPoints: OperationalDataPoint[];
    
    /** Indexing of data points by component type for efficient lookup */
    dataByComponentType?: Record<string, string[]>;
    
    /** Indexing of data points by failure mode for efficient lookup */
    dataByFailureMode?: Record<string, string[]>;
}

/**
 * Interface representing the result of a failure rate estimation
 * @group Quantification & Uncertainty
 * @implements DA-D1
 * @implements DA-D2
 * @implements DA-D3
 */
export interface FailureRateEstimationResult {
    /** Reference to the failure mode being analyzed */
    failureModeReference: string;
    
    /** Reference to the component type being analyzed */
    componentTypeReference: string;
    
    /** The estimated probability distribution type */
    estimatedDistribution: DistributionType;
    
    /** Parameters of the estimated distribution */
    parameters: Record<string, number>;
    
    /** Confidence intervals for the parameters */
    confidenceIntervals?: {
        /** Lower bounds of confidence intervals */
        lower: Record<string, number>;
        /** Upper bounds of confidence intervals */
        upper: Record<string, number>;
    };
    
    /** Number of data points used in the estimation */
    sampleSize: number;
    
    /** Results of goodness of fit testing */
    goodnessOfFit?: {
        /** Method used for goodness of fit testing */
        method: string;
        /** Test statistic value */
        value: number;
    };
}

/**
 * Class for estimating failure rates from operational data
 * @group Quantification & Uncertainty
 * @implements DA-D1
 * @implements DA-D2
 * @implements DA-D3
 * @implements DA-D4
 */
export class FailureRateEstimator {
    /**
     * Main estimation method for failure rates
     * @param failureModeRef - Reference to the failure mode being analyzed
     * @param componentTypeRef - Reference to the component type being analyzed
     * @param dataRegistry - Registry containing operational data points
     * @param method - Estimation method to use ('maxLikelihood' or 'bayesian')
     * @returns FailureRateEstimationResult containing the estimation results
     * @throws Error if insufficient data is available for estimation
     */
    estimateFailureRate(
        failureModeRef: string,
        componentTypeRef: string,
        dataRegistry: OperationalDataRegistry,
        method: 'maxLikelihood' | 'bayesian' = 'maxLikelihood'
    ): FailureRateEstimationResult {
        // Get relevant data points
        const dataPointIds = dataRegistry.dataByFailureMode?.[failureModeRef] || [];
        const dataPoints = dataPointIds
            .map(id => dataRegistry.dataPoints.find(dp => dp.id === id))
            .filter(dp => dp && dp.componentTypeReference === componentTypeRef) as OperationalDataPoint[];
        
        if (dataPoints.length === 0) {
            throw new Error('Insufficient data for estimation');
        }
        
        // Perform estimation based on method
        return method === 'maxLikelihood' 
            ? this.performMaxLikelihoodEstimation(dataPoints, failureModeRef, componentTypeRef)
            : this.performBayesianEstimation(dataPoints, failureModeRef, componentTypeRef);
    }
    
    /**
     * Performs Maximum Likelihood Estimation for failure rates
     * @param dataPoints - Array of operational data points
     * @param failureModeRef - Reference to the failure mode
     * @param componentTypeRef - Reference to the component type
     * @returns FailureRateEstimationResult containing the MLE results
     */
    private performMaxLikelihoodEstimation(
        dataPoints: OperationalDataPoint[],
        failureModeRef: string,
        componentTypeRef: string
    ): FailureRateEstimationResult {
        // Implementation of Maximum Likelihood Estimation
        // This would involve statistical calculations to fit distributions
        
        // Example simplified implementation (placeholder)
        const operatingHours = dataPoints.map(dp => dp.operatingHours);
        const meanTime = operatingHours.reduce((sum, h) => sum + h, 0) / operatingHours.length;
        
        return {
            failureModeReference: failureModeRef,
            componentTypeReference: componentTypeRef,
            estimatedDistribution: DistributionType.WEIBULL,
            parameters: {
                shape: 2.0,  // Simplified example
                scale: meanTime
            },
            sampleSize: dataPoints.length,
            goodnessOfFit: {
                method: 'Anderson-Darling',
                value: 0.95  // Placeholder
            }
        };
    }
    
    /**
     * Performs Bayesian Estimation for failure rates
     * @param dataPoints - Array of operational data points
     * @param failureModeRef - Reference to the failure mode
     * @param componentTypeRef - Reference to the component type
     * @returns FailureRateEstimationResult containing the Bayesian estimation results
     */
    private performBayesianEstimation(
        dataPoints: OperationalDataPoint[],
        failureModeRef: string,
        componentTypeRef: string
    ): FailureRateEstimationResult {
        // Implementation of Bayesian Estimation
        // More complex implementation would go here
        
        // Simplified placeholder
        return {
            failureModeReference: failureModeRef,
            componentTypeReference: componentTypeRef,
            estimatedDistribution: DistributionType.WEIBULL,
            parameters: {
                shape: 2.1,
                scale: 10000
            },
            confidenceIntervals: {
                lower: { shape: 1.8, scale: 9000 },
                upper: { shape: 2.4, scale: 11000 }
            },
            sampleSize: dataPoints.length
        };
    }
}

/**
 * Interface representing a failure mode type with its characteristics
 * @group Parameter Definition & Boundaries
 * @extends {Unique}
 * @extends {Named}
 */
export interface FailureModeType extends Unique, Named {
    /** Category of the failure mode */
    category: string;
    
    /** Mechanism of failure description */
    mechanismOfFailure: string;
    
    /** Level of detectability of the failure mode */
    detectability: DetectabilityLevel;
    
    /** Default probability model for this failure mode */
    defaultProbabilityModel?: ProbabilityModel;
}

/**
 * Base Data Analysis Parameter - parent of all data analysis parameters
 * 
 * This interface implements several PRA standard requirements:
 * - DA-A4
 * - DA-A5
 * - DA-A6
 * 
 * @group Core Definition and Enums
 * @extends {Unique}
 * @extends {Named}
 */
export interface BaseDataAnalysisParameter extends Unique, Named {
    /** Detailed description of the parameter */
    description?: string;
    
    /**
     * The type of parameter being analyzed.
     * @implements DA-A4
     */
    parameterType: ParameterType;
    
    /**
     * Uncertainty information for the parameter.
     * @implements DA-A5
     */
    uncertainty?: Uncertainty;
    
    /**
     * All data sources used in the analysis, including both general and specific sources.
     * @implements DA-A4
     */
    data_sources?: DataSource[];
    
    /**
     * All assumptions made in the analysis, including both general and specific assumptions.
     * @implements DA-A5
     * @implements DA-A6
     */
    assumptions?: Assumption[];
}

/**
 * Interface representing data sources and their context
 * @group Data Collection, Consistency, Grouping
 * @implements DA-C1
 */
export interface DataSource {
    /**
     * The source of the data (e.g., "Plant maintenance records 2020-2023")
     */
    source: string;
    
    /**
     * The context or type of the data source (e.g., "Industry standard", "Plant specific")
     */
    context?: string;
    
    /**
     * Any additional notes about the data source
     */
    notes?: string;
    
    /**
     * Reference to supporting documentation, technical reports or standards
     */
    documentationReferences?: string[];
    
    /**
     * Type of source (Generic industry, Plant-specific, Expert judgment)
     */
    sourceType?: "GENERIC_INDUSTRY" | "PLANT_SPECIFIC" | "EXPERT_JUDGMENT";
    
    /**
     * Time period covered by the data
     */
    timePeriod?: {
        startDate: string;
        endDate: string;
    };
    
    /**
     * Applicability assessment of this data source to the parameter
     */
    applicabilityAssessment?: string;
}

/**
 * Interface representing an assumption and its context
 * @group Core Definition and Enums
 * @implements DA-A5
 * @implements DA-A6
 */
export interface Assumption extends BaseAssumption {
    /**
     * The context or type of the assumption (e.g., "General", "Value-specific")
     */
    context?: string;
    
    /**
     * Parameters or basic events impacted by this assumption
     */
    impactedParameters?: string[];
    
    /**
     * Criteria or information required to close this assumption
     */
    closureCriteria?: string;
}

//==============================================================================
/**
 * @group Parameter Definition & Boundaries
 * @description Parameter boundaries, definitions, and logical models for events
 * @implements HLR-DA-A
 */
//==============================================================================

/**
 * Data Analysis parameter with specific requirements
 * 
 * This interface implements several PRA standard requirements:
 * - DA-A2
 * - DA-A3
 * - HLR-DA-B
 * 
 * @group Parameter Definition & Boundaries
 * @extends {BaseDataAnalysisParameter}
 * @implements DA-A2, DA-A3, HLR-DA-B
 */
export interface DataAnalysisParameter extends BaseDataAnalysisParameter {
    /**
     * The estimated value for the parameter
     */
    value: number & tags.Minimum<0>;
    
    /**
     * Links to basic event this parameter is associated with
     * @implements DA-A1                
     */
    basicEventId?: string;
    
    /**
     * Links to test/maintenance information this parameter is associated with
     * @implements DA-A1
     */
    testMaintenanceId?: string;

    /**
     * Reference to the system definition this parameter is associated with.
     * This provides access to the component's boundary and grouping information.
     * @implements HLR-DA-B
     */
    systemDefinitionId?: string;

    /**
     * Defines how the component can fail.
     * @implements DA-A2
     */
    failureMode?: FailureModeType | string;

    /**
     * Defines the criteria for success.
     * @implements DA-A2
     */
    successCriteria?: string | string[] | SuccessCriteriaId;

    /**
     * Represents the plant operating state for which the parameter applies.
     * This can be either a reference to a specific plant operating state by ID,
     * or a complete plant operating states table.
     * 
     * @implements HLR-DA-B
     */
    plant_operating_state?: PlantOperatingStateReference;

    /**
     * The probability model used to evaluate event probability.
     * @implements DA-A3
     */
    probability_model?: DistributionType;

    /**
     * Alternative approaches or parameters that could be used.
     * @implements DA-A5
     */
    alternatives?: string[];
    
    /**
     * Specific component boundaries for this parameter
     * @implements DA-A1
     */
    componentBoundaries?: {
        /** System ID - references SystemDefinition */
        systemId: string;
        
        /** Component ID - references a component within SystemDefinition.modeledComponentsAndFailures */
        componentId?: string;
        
        /** Boundary description */
        description: string;
        
        /** 
         * Boundaries array - directly maps to SystemDefinition.boundaries when 
         * referencing a system
         */
        boundaries: string[];
        
        /** Parts included within the boundary - more detailed than boundaries */
        includedParts: string[];
        
        /** Parts excluded from the boundary */
        excludedParts?: string[];
    };
    
    /**
     * Logic model information
     * @implements DA-A4
     */
    logicModelInfo?: {
        /** The logic model type */
        modelType: string;
        /** The basic event boundary */
        basicEventBoundary: string;
        /** The model used for evaluation */
        evaluationModel: string;
    };
}

/**
 * Interface representing system or component boundaries for parameter estimation
 * @group Parameter Definition & Boundaries
 * @implements DA-A1
 */
export interface ComponentBoundary extends Unique, Named {
    /** System identifier - references SystemDefinition */
    systemId: string;
    
    /** Component identifier - references a component within SystemDefinition.modeledComponentsAndFailures */
    componentId?: ComponentReference;
    
    /** Boundary description */
    description: string;
    
    /** 
     * Boundaries array - directly maps to SystemDefinition.boundaries when 
     * referencing a system
     */
    boundaries: string[];
    
    /** Items included in the boundary - more detailed than boundaries */
    includedItems: string[];
    
    /** Items excluded from the boundary */
    excludedItems?: string[];
    
    /** Basis for boundary definition */
    boundaryBasis: string;
    
    /** Reference documents defining the boundary */
    referenceDocuments?: string[];
}

/**
 * Interface representing basic event boundary definitions
 * @group Parameter Definition & Boundaries
 * @implements DA-A1
 * 
 * @description This interface defines boundaries for basic events that are used in data analysis.
 * It references the core BasicEvent type from the upstream core/events.ts module.
 * The BasicEvent type is the most upstream definition and is used across multiple modules.
 */
export interface BasicEventBoundary extends Unique, Named {
    /** 
     * Basic event identifier - references a BasicEvent from the core events module
     * This establishes a link to the upstream BasicEvent definition
     */
    basicEventId: string;
    
    /** Boundary description */
    description: string;
    
    /** Conditions included in the boundary */
    includedConditions: string[];
    
    /** Conditions excluded from the boundary */
    excludedConditions?: string[];
    
    /** Basis for boundary definition */
    boundaryBasis: string;
    
    /** Reference documents defining the boundary */
    referenceDocuments?: string[];
    
    /**
     * Reference to the system where this basic event is used
     * This creates a link to the SystemBasicEvent in the systems-analysis module
     */
    systemReference?: string;
}

//==============================================================================
/**
 * @group Data Collection, Consistency, Grouping
 * @description Data collection and consistency with parameter definitions
 * @implements HLR-DA-C
 */
//==============================================================================

/**
 * Interface for external data source integration
 * @group Data Collection, Consistency, Grouping
 * @implements DA-C1
 */
export interface ExternalDataSource extends Unique, Named {
    /** Type of data source */
    sourceType: "INDUSTRY_DATABASE" | "PLANT_RECORDS" | "EXPERT_JUDGMENT" | "OTHER";
    
    /** Source location or identifier */
    sourceLocation: string;
    
    /** Time period covered */
    timePeriod: {
        start: string;
        end: string;
    };
    
    /** Access method for retrieving data */
    accessMethod: string;
    
    /** Data format description */
    dataFormat: string;
    
    /** Quality assurance information */
    qualityAssurance?: string;
    
    /** Data limitations */
    limitations?: string[];
    
    /** Reference documentation */
    referenceDocumentation: string[];
    
    /** Data validation method */
    validationMethod?: string;
}

/**
 * Interface for data consistency verification
 * @group Data Collection, Consistency, Grouping
 * @implements DA-C2
 */
export interface DataConsistencyCheck extends Unique {
    /** Parameter ID being checked */
    parameterId: string;
    
    /** Data source being checked against */
    dataSourceId: string;
    
    /** Verification method */
    verificationMethod: string;
    
    /** Consistency assessment */
    consistencyAssessment: "CONSISTENT" | "INCONSISTENT" | "PARTIALLY_CONSISTENT";
    
    /** Discrepancies found */
    discrepancies?: string[];
    
    /** Resolution actions for discrepancies */
    resolutionActions?: string[];
    
    /** Verification date */
    verificationDate: string;
    
    /** Verifier name or ID */
    verifierId: string;
}

/**
 * Interface representing a component identified as an outlier and excluded from grouping
 * @group Data Collection, Consistency, Grouping
 * @implements DA-B2
 */
export interface OutlierComponent extends Unique {
    /**
     * System identifier - references SystemDefinition
     */
    systemId: string;
    
    /** 
     * Component ID that is excluded from grouping - references a component within 
     * SystemDefinition.modeledComponentsAndFailures
     * This component should NOT have a componentGroup field set
     */
    componentId: ComponentReference;
    
    /** 
     * Reference to the group this component would otherwise belong to
     * References the groupId of a ComponentGrouping
     */
    potentialGroupId: string;
    
    /** Reason for excluding this component as an outlier */
    exclusionReason: string;
    
    /** Detailed justification for why this component is considered an outlier */
    exclusionJustification: string;
    
    /** Characteristics that make this component different from the group */
    differentiatingCharacteristics: string[];
    
    /** How this component is handled in the analysis instead */
    alternativeHandling: string;
    
    /** References to supporting documentation */
    referenceDocuments?: string[];
    
    /** Status of the outlier determination */
    status: "CONFIRMED" | "TENTATIVE" | "UNDER_REVIEW";
    
    /** Date when the outlier determination was made */
    determinationDate?: string;
    
    /** Person or team who made the outlier determination */
    determinedBy?: string;
}

/**
 * Interface representing grouping rationale for components
 * @group Data Collection, Consistency, Grouping
 * @implements DA-B1
 */
export interface ComponentGrouping extends Unique, Named {
    /** System identifier - references SystemDefinition */
    systemId: string;
    
    /** Group identifier */
    groupId: string;
    
    /** 
     * Component IDs in this group - references components within SystemDefinition.modeledComponentsAndFailures
     * These components should have their componentGroup field set to this group's groupId
     */
    componentIds: ComponentReference[];
    
    /** Design characteristics considered for grouping */
    designCharacteristics: string[];
    
    /** Environmental conditions considered for grouping */
    environmentalConditions: string[];
    
    /** Service conditions considered for grouping */
    serviceConditions: string[];
    
    /** Operational conditions considered for grouping */
    operationalConditions?: string[];
    
    /** Justification for the grouping */
    groupingJustification: string;
    
    /** References to supporting documents */
    referenceDocuments?: string[];
    
    /**
     * Components explicitly excluded from this group as outliers
     * @implements DA-B2
     */
    excludedOutliers?: string[];
    
    /**
     * Criteria used to identify outliers for this group
     * @implements DA-B2
     */
    outlierIdentificationCriteria?: string[];
}

//==============================================================================
/**
 * @group Quantification & Uncertainty
 * @description Uncertainty characterization, Bayesian updates, evidence integration
 * @implements HLR-DA-D
 */
//==============================================================================

/**
 * Interface representing the uncertainty associated with a parameter.
 * The structure of the uncertainty changes based on the distribution type.
 *
 * This interface implements several PRA standard requirements:
 * - **HLR-DA-D**
 * - **DA-A3**
 * - **DA-A5**
 * - **ESQ-E1**
 * - **RI-C1**
 *
 * @group Quantification & Uncertainty
 * @implements HLR-DA-D, DA-A3, DA-A5
 */
export interface Uncertainty {
    /**
     * The probability distribution type for the uncertainty.
     * @implements DA-A3
     */
    distribution: DistributionType;

    /**
     * Parameters associated with the distribution (e.g., mean, standard deviation).
     * @implements DA-A4
     */
    parameters: Record<string, number>;

    /**
     * Sources of uncertainty in the model (e.g., "Limited data", "Model assumptions").
     * @implements DA-A5
     */
    model_uncertainty_sources?: string[];

    /**
     * Risk assessment implications of this uncertainty.
     * @implements HLR-DA-D
     */
    riskImplications?: {
        /**
         * References to risk metrics affected by this uncertainty (e.g., "CDF", "LERF").
         */
        affectedMetrics: string[];

        /**
         * Qualitative assessment of uncertainty significance ("high" | "medium" | "low").
         */
        significanceLevel: "high" | "medium" | "low";

        /**
         * Notes on how this uncertainty propagates through the risk model.
         */
        propagationNotes?: string;
    };

    /**
     * Correlations with other parameters. Captures dependencies between parameters.
     * @implements ESQ-E1
     */
    correlations?: {
        /**
         * Reference to correlated parameter.
         */
        parameterId: string;

        /**
         * Type of correlation ("common_cause" | "environmental" | "operational" | "other").
         */
        correlationType: "common_cause" | "environmental" | "operational" | "other";

        /**
         * Correlation coefficient or factor.
         */
        correlationFactor: number;

        /**
         * Description of correlation basis.
         */
        description?: string;
    }[];

    /**
     * Results of sensitivity studies
     */
    sensitivityStudies?: SensitivityStudy[];
}

/**
 * Interface representing a Bayesian update process for parameter estimation.
 * This is used to combine prior information with new data to produce an updated posterior distribution.
 * 
 * @group Quantification & Uncertainty
 * @implements DA-D4
 */
export interface BayesianUpdate {
    /**
     * Whether a Bayesian update was performed
     */
    performed: boolean;
    
    /**
     * The method used for the Bayesian update (e.g., "Conjugate prior", "MCMC")
     */
    method: string;
    
    /**
     * Convergence criteria used for numerical methods (if applicable)
     */
    convergence_criteria?: number;
    
    /**
     * Prior distribution information
     */
    prior?: {
        /**
         * The distribution type of the prior
         */
        distribution: DistributionType;
        
        /**
         * Parameters of the prior distribution
         */
        parameters: Record<string, number>;
        
        /**
         * Source of the prior information
         */
        source?: string;
    };
    
    /**
     * Posterior distribution information after update
     */
    posterior?: {
        /**
         * The distribution type of the posterior
         */
        distribution: DistributionType;
        
        /**
         * Parameters of the posterior distribution
         */
        parameters: Record<string, number>;
    };
    
    /**
     * Validation of the update process
     */
    validation?: {
        /** Method used for validation */
        method: string;
        /** Results of validation */
        results: string;
        /** Any issues identified */
        issues?: string[];
    };
}

/**
 * Interface representing the quantification of a frequency parameter.
 * This interface is used for frequency-based parameters such as initiating event frequencies.
 * 
 * @group Quantification & Uncertainty
 * @implements DA-D1
 * @implements DA-D3
 */
export interface FrequencyQuantification {
    /**
     * Fraction of time spent in the operating state
     */
    operating_state_fraction: number;
    
    /**
     * Number of modules impacted by the event
     */
    modules_impacted: number;
    
    /**
     * Total number of modules in the plant
     */
    total_modules: number;
    
    /**
     * Generic industry data used for the frequency estimation
     * @implements DA-D1
     */
    generic_data: {
        /**
         * Source of the generic data
         */
        source: string;
        
        /**
         * Applicability of the generic data to the specific plant
         */
        applicability: string;
        
        /**
         * Time period covered by the generic data
         */
        time_period: [Date, Date];
        
        /**
         * Number of events observed in the generic data
         */
        events: number;
        
        /**
         * Exposure time in the generic data
         */
        exposure_time: number;
        
        /**
         * Unit of the exposure time
         */
        exposure_unit: FrequencyUnit;
    };
    
    /**
     * Plant-specific data used for the frequency estimation (if available)
     * @implements DA-D1
     */
    plant_specific_data?: {
        /**
         * Number of events observed in the plant-specific data
         */
        events: number;
        
        /**
         * Exposure time in the plant-specific data
         */
        exposure_time: number;
        
        /**
         * Unit of the exposure time
         */
        exposure_unit: FrequencyUnit;
        
        /**
         * Applicability of the plant-specific data
         */
        applicability: string;
    };
    
    /**
     * Bayesian update information (if performed)
     * @implements DA-D4
     */
    bayesian_update?: BayesianUpdate;
    
    /**
     * Estimated frequency value (mean)
     * @implements DA-D3
     */
    frequency: number;
    
    /**
     * Unit of the frequency
     */
    frequency_unit: FrequencyUnit;
    
    /**
     * Type of probability distribution used for the frequency
     */
    distribution: DistributionType;
    
    /**
     * Parameters of the probability distribution
     */
    distribution_parameters: Record<string, number>;
    
    /**
     * Uncertainty information for the frequency
     * @implements DA-D2
     */
    uncertainty: Uncertainty;
    
    /**
     * Sensitivity studies for this frequency quantification
     */
    sensitivityStudies?: SensitivityStudy[];
}

//==============================================================================
/**
 * @group Documentation & Traceability
 * @description Documentation of the data analysis process and results
 * @implements HLR-DA-E
 */
//==============================================================================

/**
 * Interface representing detailed documentation of the data analysis process.
 * This directly implements DA-E1 requirements (a)-(k).
 * 
 * @group Documentation & Traceability
 * @implements DA-E1
 */
export interface DataAnalysisDocumentation extends Unique, Named {
    /** 
     * Description of the data analysis process
     * Specifies inputs, methods, and results
     * @implements DA-E1
     */
    processDescription: string;
    
    /**
     * System and component boundaries used
     * @implements DA-E1(a
     */
    systemComponentBoundaries: {
        /** System ID - references SystemDefinition */
        systemId: string;
        
        /** Component ID - references a component within SystemDefinition.modeledComponentsAndFailures */
        componentId?: string;
        
        /** 
         * Boundary description - should align with SystemDefinition.boundaries 
         * when referencing a system, or with specific component boundaries
         */
        boundaryDescription: string;
        
        /** 
         * Boundaries array - directly maps to SystemDefinition.boundaries when 
         * referencing a system
         */
        boundaries: string[];
        
        /** Reference documents */
        references?: string[];
    }[];
    
    /**
     * Models used to evaluate basic event probabilities
     * @implements DA-E1(b)
     */
    basicEventProbabilityModels: {
        /** Basic event ID */
        basicEventId: string;
        /** Probability model used */
        model: string;
        /** Justification for model selection */
        justification?: string;
    }[];
    
    /**
     * Sources for generic parameter estimates
     * @implements DA-E1(c): Sources for generic parameter estimates
     */
    genericParameterSources: {
        /** Parameter ID */
        parameterId: string;
        /** Data source */
        source: string;
        /** Reference */
        reference?: string;
    }[];
    
    /**
     * Plant-specific and operating state-specific data sources
     * @implements DA-E1(d)
     */
    plantSpecificDataSources: {
        /** Parameter ID */
        parameterId: string;
        /** Data source */
        source: string;
        /** Operating state(s) */
        operatingState?: string;
        /** Time period */
        timePeriod?: string;
    }[];
    
    /**
     * Time periods for plant-specific data collection
     * @implements DA-E1(e)
     */
    dataCollectionPeriods: {
        /** Parameter ID */
        parameterId: string;
        /** Start date */
        startDate: string;
        /** End date */
        endDate: string;
        /** Justification for censoring */
        censoringJustification?: string;
    }[];
    
    /**
     * Justification for exclusion of any data
     * @implements DA-E1(f)
     */
    dataExclusionJustifications: {
        /** Parameter ID */
        parameterId: string;
        /** Excluded data description */
        excludedData: string;
        /** Justification for exclusion */
        justification: string;
    }[];
    
    /**
     * Basis for CCF probability estimates
     * @implements DA-E1(g)
     */
    ccfProbabilityBasis: {
        /** CCF parameter ID */
        ccfParameterId: string;
        /** Estimation method */
        estimationMethod: string;
        /** Justification for data mapping */
        mappingJustification?: string;
    }[];
    
    /**
     * Rationale for prior distributions in Bayesian updates
     * @implements DA-E1(h)
     */
    bayesianPriorRationales: {
        /** Parameter ID */
        parameterId: string;
        /** Prior distribution */
        priorDistribution: string;
        /** Rationale */
        rationale: string;
    }[];
    
    /**
     * Parameter estimates with uncertainty characterization
     * @implements DA-E1(i)
     */
    parameterEstimates: {
        /** Parameter ID */
        parameterId: string;
        /** Estimate value */
        estimate: number;
        /** Uncertainty characterization */
        uncertaintyCharacterization: string;
    }[];
    
    /**
     * Justification for full power or other plant operating state data
     * @implements DA-E1(j)
     */
    operatingStateDataJustifications: {
        /** Parameter ID */
        parameterId: string;
        /** Operating state */
        operatingState: string;
        /** Justification */
        justification: string;
    }[];
    
    /**
     * Rationale for using generic parameter estimates
     * @implements DA-E1(k)
     */
    genericParameterRationales: {
        /** Parameter ID */
        parameterId: string;
        /** Operating state(s) */
        operatingStates: string[];
        /** Rationale */
        rationale: string;
    }[];
    
    /**
     * Documentation of component grouping and outlier handling
     * @implements DA-B1
     * @implements DA-B2
     */
    componentGroupingDocumentation?: {
        /** Group ID */
        groupId: string;
        
        /** Grouping criteria description */
        groupingCriteria: string;
        
        /** Outlier identification methodology */
        outlierIdentificationMethodology: string;
        
        /** Justification for outlier exclusions */
        outlierExclusionJustifications: {
            /** Component ID - references a component within SystemDefinition.modeledComponentsAndFailures */
            componentId: string;
            
            /** Reason for exclusion */
            exclusionReason: string;
            
            /** Detailed justification */
            detailedJustification: string;
            
            /** Alternative treatment in the analysis */
            alternativeTreatment: string;
        }[];
        
        /** References to supporting analyses */
        supportingAnalyses?: string[];
    }[];
}

/**
 * Interface representing model uncertainty sources in data analysis
 * @group Documentation & Traceability
 * @implements DA-E2
 */
export interface ModelUncertaintyDocumentation extends Unique, Named {
    /** 
     * Description of model uncertainty sources
     * @implements DA-E2
     */
    uncertaintySources: {
        /** Source description */
        source: string;
        /** Impact on analysis */
        impact: string;
        /** Applicable parameter(s) */
        applicableParameters?: string[];
    }[];
    
    /**
     * Related assumptions
     * @implements DA-E2
     */
    relatedAssumptions: {
        /** Assumption description */
        assumption: string;
        /** Basis for assumption */
        basis: string;
        /** Applicable parameter(s) */
        applicableParameters?: string[];
    }[];
    
    /**
     * Reasonable alternatives considered
     * @implements DA-E2
     */
    reasonableAlternatives: {
        /** Alternative description */
        alternative: string;
        /** Reason not selected */
        reasonNotSelected: string;
        /** Applicable parameter(s) */
        applicableParameters?: string[];
    }[];
    
    /**
     * Reference to requirement
     * @implements DA-E2
     */
    requirementReference: string;
}

/**
 * Interface representing pre-operational assumptions documentation
 * @group Documentation & Traceability
 * @implements DA-E3
 */
export interface PreOperationalAssumptionsDocumentation extends BasePreOperationalAssumptionsDocumentation {
    /**
     * Reference to DA-A6
     * @implements DA-E3: See DA-A6
     */
    relatedRequirement: string;
    
    /**
     * Reference to DA-N-5 (Note)
     * @implements DA-E3: See Note DA-N-5
     */
    relatedNote: string;
}

/**
 * Interface representing peer review documentation for data analysis
 * @group Documentation & Traceability
 */
export interface PeerReviewDocumentation extends Unique, Named {
    /** Review date */
    reviewDate: string;
    
    /** Review team members */
    reviewTeam: string[];
    
    /** Findings and observations */
    findings: {
        /** Finding ID */
        id: string;
        /** Finding description */
        description: string;
        /** Significance level */
        significance: "HIGH" | "MEDIUM" | "LOW";
        /** Associated requirement(s) */
        associatedRequirements: string[];
        /** Status */
        status: "OPEN" | "CLOSED" | "IN_PROGRESS";
        /** Resolution plan */
        resolutionPlan?: string;
        /** Resolution date */
        resolutionDate?: string;
    }[];
    
    /** Review scope */
    scope: string;
    
    /** Review methodology */
    methodology: string;
    
    /** Review report reference */
    reportReference: string;
    
    /**
     * Specific review of component grouping and outlier handling
     * @implements DA-B2: DO NOT INCLUDE outliers in the definition of a group
     */
    outlierReview?: {
        /** Whether outlier identification was reviewed */
        outlierIdentificationReviewed: boolean;
        
        /** Assessment of outlier identification methodology */
        methodologyAssessment: string;
        
        /** Assessment of outlier exclusion justifications */
        justificationAssessment: string;
        
        /** Specific outlier findings */
        outlierFindings: {
            /** Component ID */
            componentId: string;
            
            /** Finding description */
            finding: string;
            
            /** Recommendation */
            recommendation: string;
            
            /** Status */
            status: "ACCEPTED" | "REJECTED" | "UNDER_REVIEW";
        }[];
        
        /** Overall assessment of outlier handling */
        overallAssessment: string;
    };
}

//==============================================================================
/**
 * @group API
 * @description Entry point interfaces, validation, and integration components
 */
//==============================================================================

/**
 * Interface for validation rules to ensure parameter data analysis is correctly performed
 * @group API
 */
export interface ParameterValidationRules {
    /**
     * Rules for component boundary validation
     */
    componentBoundaryRules: {
        /** Validation description */
        description: string;
        /** Validation method */
        validationMethod: string;
        /** Required elements for boundary definition */
        requiredElements: string[];
    };
    
    /**
     * Rules for parameter consistency validation
     */
    parameterConsistencyRules: {
        /** Validation description */
        description: string;
        /** Validation method */
        validationMethod: string;
        /** Consistency checks to perform */
        consistencyChecks: string[];
    };
    
    /**
     * Rules for uncertainty characterization validation
     */
    uncertaintyValidationRules: {
        /** Validation description */
        description: string;
        /** Required uncertainty elements */
        requiredElements: string[];
        /** Validation criteria */
        validationCriteria: string[];
    };
    
    /**
     * Rules for data source validation
     */
    dataSourceValidationRules: {
        /** Validation description */
        description: string;
        /** Source quality criteria */
        qualityCriteria: string[];
        /** Applicability assessment requirements */
        applicabilityRequirements: string[];
    };
    
    /**
     * Rules for outlier identification and validation
     * @implements DA-B2
     */
    outlierValidationRules?: {
        /** Validation description */
        description: string;
        
        /** Criteria for identifying outliers */
        outlierIdentificationCriteria: string[];
        
        /** Required justification elements for outlier exclusion */
        requiredJustificationElements: string[];
        
        /** Validation checks for proper outlier handling */
        validationChecks: string[];
        
        /** Review process for outlier determinations */
        reviewProcess: string;
    };
}

/**
 * Interface for export/import of data analysis parameters
 * @group API
 */
export interface DataAnalysisExportImport {
    /**
     * Export format specification
     */
    exportFormat: "JSON" | "CSV" | "XML";
    
    /**
     * Export configuration
     */
    exportConfig: {
        /** Include uncertainty information */
        includeUncertainty: boolean;
        /** Include documentation references */
        includeDocumentation: boolean;
        /** Include source data */
        includeSourceData: boolean;
    };
    
    /**
     * Import validation rules
     */
    importValidation: {
        /** Required fields */
        requiredFields: string[];
        /** Validation checks */
        validationChecks: string[];
        /** Error handling approach */
        errorHandling: "STRICT" | "LENIENT";
    };
    
    /**
     * Mapping for external data sources
     */
    externalSourceMapping: {
        /** Source field */
        sourceField: string;
        /** Target field */
        targetField: string;
        /** Transformation logic */
        transformation?: string;
    }[];
}

/**
 * Interface representing the main Data Analysis container
 * 
 * @group API
 * @extends {TechnicalElement<TechnicalElementTypes.DATA_ANALYSIS>}
 */
export interface DataAnalysis extends TechnicalElement<TechnicalElementTypes.DATA_ANALYSIS> {
    /**
     * Additional metadata specific to Data Analysis
     */
    additionalMetadata?: {
        /** Data analysis specific limitations */
        limitations?: string[];
        
        /** Data analysis specific assumptions */
        assumptions?: string[];
    };
    
    /**
     * Array of data analysis parameters that are part of this analysis.
     * Each parameter represents a specific data point or measurement being analyzed.
     */
    data_parameters: DataAnalysisParameter[];
    
    /**
     * Component groupings for homogeneous populations
     * @implements HLR-DA-B
     */
    componentGroupings?: ComponentGrouping[];
    
    /**
     * Components identified as outliers and excluded from groupings
     * @implements DA-B2
     */
    outlierComponents?: OutlierComponent[];
    
    /**
     * External data sources used in the analysis
     * @implements HLR-DA-C
     */
    externalDataSources?: ExternalDataSource[];
    
    /**
     * Data consistency checks performed
     * @implements DA-C2
     */
    dataConsistencyChecks?: DataConsistencyCheck[];
    
    /**
     * Detailed documentation of the data analysis process
     * @implements HLR-DA-E
     */
    documentation?: {
        /** Process and results documentation */
        processDocumentation?: DataAnalysisDocumentation;
        
        /** Model uncertainty documentation */
        modelUncertainty?: ModelUncertaintyDocumentation;
        
        /** Pre-operational assumptions */
        preOperationalAssumptions?: PreOperationalAssumptionsDocumentation;
        
        /** Peer review documentation */
        peerReview?: PeerReviewDocumentation;
    };
    
    /**
     * Validation rules for parameters
     */
    validationRules?: ParameterValidationRules;
    
    /**
     * Export/import configuration
     */
    exportImportConfig?: DataAnalysisExportImport;
    
    /**
     * Sensitivity studies performed as part of this analysis
     */
    sensitivityStudies?: SensitivityStudy[];
}

/**
 * JSON schema for validating {@link DataAnalysis} entities.
 * 
 * @group API
 * @example
 * ```typescript
 * const isValid = DataAnalysisSchema.validate(someData);
 * ```
 */
export const DataAnalysisSchema = typia.json.application<[DataAnalysis], "3.0">();

/**
 * Service class for managing data analysis operations
 * @group API
 * @implements DA-C3
 * @implements DA-C4
 * @implements DA-D1
 * @implements DA-D2
 * @implements DA-D3
 * @implements DA-D4
 */
export class DataAnalysisService {
    /** Map of component basic events indexed by UUID */
    private basicEvents: Map<tags.Format<"uuid">, ComponentBasicEvent> = new Map();
    
    /** Map of failure modes indexed by UUID */
    private failureModes: Map<tags.Format<"uuid">, FailureModeType> = new Map();
    
    /** Registry containing operational data points */
    private dataRegistry: OperationalDataRegistry | null = null;
    
    /** Estimator for failure rates */
    private estimator: FailureRateEstimator = new FailureRateEstimator();
    
    /**
     * Retrieves a component basic event by ID
     * @param id - The UUID of the basic event to retrieve
     * @returns The requested component basic event
     * @throws Error if the basic event is not found
     */
    getComponentBasicEvent(id: tags.Format<"uuid">): ComponentBasicEvent {
        const event = this.basicEvents.get(id);
        if (!event) throw new Error(`Basic event ${id} not found`);
        return event;
    }
    
    /**
     * Creates a new component basic event
     * @param event - The component basic event to create
     * @returns The UUID of the created event
     */
    createComponentBasicEvent(event: ComponentBasicEvent): tags.Format<"uuid"> {
        this.basicEvents.set(event.uuid, event);
        return event.uuid;
    }
    
    /**
     * Retrieves a failure mode by ID
     * @param id - The UUID of the failure mode to retrieve
     * @returns The requested failure mode
     * @throws Error if the failure mode is not found
     */
    getFailureMode(id: tags.Format<"uuid">): FailureModeType {
        const mode = this.failureModes.get(id);
        if (!mode) throw new Error(`Failure mode ${id} not found`);
        return mode;
    }
    
    /**
     * Creates a new failure mode
     * @param mode - The failure mode to create
     * @returns The UUID of the created failure mode
     */
    createFailureMode(mode: FailureModeType): tags.Format<"uuid"> {
        this.failureModes.set(mode.uuid, mode);
        return mode.uuid;
    }
    
    /**
     * Sets the operational data registry
     * @param registry - The operational data registry to use
     */
    setDataRegistry(registry: OperationalDataRegistry): void {
        this.dataRegistry = registry;
    }
    
    /**
     * Retrieves the current operational data registry
     * @returns The current operational data registry
     * @throws Error if no data registry is available
     */
    getOperationalDataRegistry(): OperationalDataRegistry {
        if (!this.dataRegistry) throw new Error('No data registry available');
        return this.dataRegistry;
    }
    
    /**
     * Estimates failure rate for a given failure mode and component type
     * @param failureModeRef - Reference to the failure mode
     * @param componentTypeRef - Reference to the component type
     * @param method - Estimation method to use
     * @returns The failure rate estimation result
     * @throws Error if no data registry is available
     */
    estimateFailureRate(
        failureModeRef: string,
        componentTypeRef: string,
        method: 'maxLikelihood' | 'bayesian' = 'maxLikelihood'
    ): FailureRateEstimationResult {
        if (!this.dataRegistry) throw new Error('No data registry available');
        
        return this.estimator.estimateFailureRate(
            failureModeRef,
            componentTypeRef,
            this.dataRegistry,
            method
        );
    }
    
    /**
     * Updates a basic event with failure rate estimation results
     * @param basicEventId - UUID of the basic event to update
     * @param estimationResult - Results from failure rate estimation
     * @throws Error if the basic event is not found
     */
    updateBasicEventWithEstimation(
        basicEventId: tags.Format<"uuid">,
        estimationResult: FailureRateEstimationResult
    ): void {
        const event = this.getComponentBasicEvent(basicEventId);
        
        // Update probability model with estimation results
        event.probabilityModel = {
            distribution: estimationResult.estimatedDistribution,
            parameters: estimationResult.parameters,
            source: 'estimated',
            estimationDetails: {
                dataPointReferences: [], // Would be populated with actual data point IDs
                estimationMethod: 'maxLikelihood', // Default to MLE
                estimationDate: new Date().toISOString(),
                confidence: estimationResult.goodnessOfFit?.value || 0.9
            }
        };
        
        // Update the stored event
        this.basicEvents.set(basicEventId, event);
    }
}