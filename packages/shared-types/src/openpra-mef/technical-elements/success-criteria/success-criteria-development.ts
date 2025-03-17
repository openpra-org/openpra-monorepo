/**
 * @module success_criteria_development
 * @description Comprehensive types and interfaces for Success Criteria Development (SC)
 * 
 * The objectives of Success Criteria Development ensure that:
 * - (a) overall success criteria are defined (i.e., prevention of a release of radioactive material) 
 *       in each of the modeled event sequences and event sequence families as defined in the Event 
 *       Sequence Analysis element and release categories as defined in the Mechanistic Source Term 
 *       Analysis element;
 * - (b) success criteria are defined for key safety functions, supporting systems, structures, 
 *       barriers to release of radioactive material, components, and operator actions necessary 
 *       to support event sequence development based on a defensible technical basis;
 * - (c) the success criteria is documented to provide traceability of the work.
 * 
 * Per RG 1.247, the objective of the success criteria analysis PRA element is to determine the 
 * minimum requirements for each function (and ultimately the systems used to perform the functions) 
 * to prevent or to mitigate a release given an initiating event.
 * 
 * @preferred
 * @category Technical Elements
 */

import typia, { tags } from "typia";    
import { TechnicalElement, TechnicalElementTypes, TechnicalElementMetadata } from "../technical-element";
import { Named, Unique } from "../core/meta";
import { IdPatterns, ImportanceLevel, SensitivityStudy } from "../core/shared-patterns";
import { 
    BaseDesignInformation, 
    BaseProcessDocumentation, 
    BaseModelUncertaintyDocumentation, 
    BasePreOperationalAssumptionsDocumentation,
    BasePeerReviewDocumentation,
    BaseTraceabilityDocumentation,
    BaseAssumption,
    PreOperationalAssumption
} from "../core/documentation";

//==============================================================================
/**
 * @group Core Definitions & Enums
 * @description Basic types, enums, and utility interfaces used throughout the module
 */
//==============================================================================

/**
 * Type for success criteria IDs.
 * Format: SC-[SYSTEM]-[NUMBER]
 * Example: SC-RCIC-001
 * @group Core Definitions & Enums
 */
export type SuccessCriteriaId = string & tags.Pattern<typeof IdPatterns.SUCCESS_CRITERIA_ID>;

/**
 * The types of analysis that can be used to establish success criteria.
 * @group Core Definitions & Enums
 */
export enum AnalysisType {
    /** Thermal-hydraulic analysis (e.g., coolant flow, heat transfer) */
    THERMAL_HYDRAULIC = "THERMAL_HYDRAULIC",
    
    /** Structural analysis (e.g., containment integrity) */
    STRUCTURAL = "STRUCTURAL",
    
    /** Neutronic analysis (e.g., reactor physics, criticality) */
    NEUTRONIC = "NEUTRONIC",
    
    /** Radiation transport analysis */
    RADIATION_TRANSPORT = "RADIATION_TRANSPORT",
    
    /** Other analysis types not covered by the above */
    OTHER = "OTHER"
}

/**
 * Represents a criterion against which success is determined for any system, structure, component, or action.
 * @group Core Definitions & Enums
 */
export interface SuccessCriterion extends Unique, Named {
    /** Detailed description of the success criterion */
    description?: string;
    
    /** The actual criteria statements */
    criteriaText: string[];
    
    /** References to the engineering basis supporting this criterion */
    engineeringBasisReferences: string[];
    
    /** Links to related plant operating states */
    plantOperatingStateReferences?: string[];
    
    /** Links to related initiating events */
    initiatingEventReferences?: string[];
    
    /** The defined end state if applicable to this criterion */
    endState?: string;
}

/**
 * Represents an overall success criterion for an event sequence family.
 * @group Core Definitions & Enums
 */
export interface OverallSuccessCriterion extends SuccessCriterion {
    /** Reference to the event sequence family this criterion applies to */
    eventSequenceFamilyReference: string;
}

/**
 * Represents a system-level success criterion.
 * @group Core Definitions & Enums
 */
export interface SystemSuccessCriterion extends SuccessCriterion {
    /** Reference to the system this criterion applies to */
    systemReference: string;
    
    /** Required system capacity */
    requiredCapacity: string;
}

/**
 * Represents a component-level success criterion.
 * @group Core Definitions & Enums
 */
export interface ComponentSuccessCriterion extends SuccessCriterion {
    /** Reference to the component this criterion applies to */
    componentReference: string;
    
    /** Component performance requirements */
    performanceRequirements: string;
}

//==============================================================================
/**
 * @group Success Criteria & Technical Bases
 * @description Success criteria definitions for various levels and their technical bases
 * @implements HLR-SC-A, HLR-SC-B
 */
//==============================================================================

/**
 * Represents the overall success criteria defined for preventing a release of radioactive material 
 * in each modeled event sequence and event sequence family.
 * @group Success Criteria & Technical Bases
 * @implements SC-A1: SPECIFY plant parameters that define the end states
 * @implements SC-A2: IDENTIFY key safety functions supporting radionuclide transport barriers
 */
export interface OverallSuccessCriteriaDefinition extends Unique {
    /** Reference to the event sequence or family */
    eventSequenceReference: string;
    
    /** Description of the overall success criteria */
    description: string;
    
    /** Specific criteria that must be met */
    criteria: string[];
    
    /** The end state parameters that determine success or failure */
    endStateParameters: Record<string, string>;
    
    /** Key safety functions that must be maintained */
    keySafetyFunctions: string[];
    
    /** Radionuclide transport barriers that must be protected */
    radionuclideBarriers: string[];
    
    /** References to engineering analyses supporting these criteria */
    engineeringBasisReferences: string[];
    
    /** Applicable plant operating states */
    applicablePlantOperatingStates?: string[];
    
    /** Whether this is for a risk-significant sequence (for CC-II differentiation) */
    isRiskSignificant?: boolean;
    
    /** 
     * Whether realistic criteria are used (CC-II for risk-significant, CC-I for non-risk-significant)
     * This helps track compliance with capability category requirements
     */
    usesRealisticCriteria?: boolean;
}

/**
 * Represents system-specific success criteria including required capacities.
 * @group Success Criteria & Technical Bases
 * @implements SC-A3: SPECIFY mitigating systems and functions that determine end states
 * @implements SC-A4: IDENTIFY dependencies among mitigating systems
 */
export interface SystemSuccessCriteriaDefinition extends Unique {
    /** System identifier */
    systemId: string;
    
    /** Description of the system's success criteria */
    description: string;
    
    /** Required capacities for success */
    requiredCapacities: {
        /** Parameter name */
        parameter: string;
        
        /** Required value or range */
        value: string;
        
        /** Basis for this requirement */
        basis: string;
    }[];
    
    /** Dependencies on other systems */
    systemDependencies?: {
        /** Dependent system ID */
        dependentSystemId: string;
        
        /** Nature of the dependency */
        dependencyNature: string;
    }[];
    
    /** References to supporting analyses */
    analysisReferences: string[];
    
    /** Reference to overall success criteria this supports */
    overallSuccessCriteriaId: string;
}

/**
 * Represents component-level success criteria.
 * @group Success Criteria & Technical Bases
 * @implements SC-A5: SPECIFY components required to achieve system functions
 */
export interface ComponentSuccessCriteriaDefinition extends Unique {
    /** Component identifier */
    componentId: string;
    
    /** Component description */
    description: string;
    
    /** Required performance for success */
    requiredPerformance: string;
    
    /** Reference to the system this component is part of */
    systemId: string;
    
    /** References to supporting analyses */
    analysisReferences: string[];
}

/**
 * Represents human action success criteria.
 * @group Success Criteria & Technical Bases
 * @implements SC-A6: SPECIFY requirements for operator actions to achieve system functions
 */
export interface HumanActionSuccessCriteriaDefinition extends Unique {
    /** Human action identifier */
    humanActionId: string;
    
    /** Description of the action */
    description: string;
    
    /** Time available for successful completion */
    timeAvailable: string;
    
    /** Success criteria for the action */
    successCriteria: string;
    
    /** Reference to procedures guiding the action */
    procedureReference?: string;
    
    /** References to supporting analyses */
    analysisReferences: string[];
}

/**
 * Interface for mitigating systems' shared resources.
 * @group Success Criteria & Technical Bases
 * @implements SC-A7: Mitigating systems that are shared between reactors
 */
export interface SharedResourceDefinition extends Unique, Named {
    /** Description of the shared resource */
    description: string;
    
    /** Systems that share this resource */
    sharedBySystems: string[];
    
    /** Reactors or units that share this resource */
    sharedByReactors: string[];
    
    /** Resource capacity allocation strategy */
    allocationStrategy: string;
    
    /** Impact on success criteria */
    successCriteriaImpact: string;
    
    /** References to supporting analyses */
    analysisReferences: string[];
}

/**
 * Interface representing consistency verification with plant design and operation.
 * @group Success Criteria & Technical Bases
 * @implements SC-A7: ENSURE consistency with plant design bases, licensing bases, and operational practices
 * @implements SC-A9: ENSURE consistency with features, procedures, and design/operating philosophy
 */
export interface ConsistencyVerification extends Unique {
    /** Success criteria being verified */
    successCriteriaId: SuccessCriteriaId;
    
    /** Verification against design bases */
    designBasesVerification: {
        /** Is consistent with design bases */
        isConsistent: boolean;
        
        /** Description of consistency or inconsistencies */
        description: string;
        
        /** References to design bases documents */
        references: string[];
    };
    
    /** Verification against licensing bases */
    licensingBasesVerification: {
        /** Is consistent with licensing bases */
        isConsistent: boolean;
        
        /** Description of consistency or inconsistencies */
        description: string;
        
        /** References to licensing bases documents */
        references: string[];
    };
    
    /** Verification against operational practices */
    operationalPracticesVerification: {
        /** Is consistent with operational practices */
        isConsistent: boolean;
        
        /** Description of consistency or inconsistencies */
        description: string;
        
        /** References to operational procedures */
        references: string[];
    };
}

//==============================================================================
/**
 * @group Engineering Analysis & Validation
 * @description Analyses supporting success criteria development and their validation
 * @implements SC-B1, SC-B2, SC-B3, SC-B4, SC-B5, SC-B6, SC-B7, SC-B8
 */
//==============================================================================

/**
 * Interface for engineering analysis used to establish success criteria.
 * @group Engineering Analysis & Validation
 * @implements SC-B1: USE appropriate engineering analyses to establish success criteria
 * @implements SC-B3: USE computer codes, models, and methods that are validated and verified
 */
export interface EngineeringAnalysis extends Unique {
    /** Analysis identifier */
    analysisId: string;
    
    /** Type of analysis */
    analysisType: AnalysisType;
    
    /** Description of the analysis */
    description: string;
    
    /** Computer code used (if applicable) */
    computerCode?: string;
    
    /** Code version */
    codeVersion?: string;
    
    /** Validation and verification basis */
    validationVerificationBasis?: string;
    
    /** Personnel who performed the analysis */
    analyst?: string;
    
    /** Applicability to plant conditions */
    applicabilityToPlantConditions: string;
    
    /** Key parameters and results */
    keyParametersAndResults: Record<string, string>;
    
    /** Reference documents */
    referenceDocuments?: string[];
    
    /** Limitations of the analysis */
    limitations?: string[];
    
    /** Success criteria supported by this analysis */
    supportedSuccessCriteria: SuccessCriteriaId[];
}

/**
 * Interface for plant-specific design information used in analysis.
 * @group Engineering Analysis & Validation
 * @implements SC-B2: BASE analyses on plant-specific design and operating philosophy
 */
export interface PlantSpecificDesignInformation extends BaseDesignInformation {
    /** Plant systems described */
    plantSystems: string[];
    
    /** Operating configurations covered */
    operatingConfigurations: string[];
    
    /** Design parameters used in analysis */
    designParameters: Record<string, string>;
    
    /** Operating philosophies reflected */
    operatingPhilosophies?: string[];
}

/**
 * Interface for computer code verification and validation.
 * @group Engineering Analysis & Validation
 * @implements SC-B4: USE computer codes and models validated with plant-specific or applicable benchmarks
 * @implements SC-B5: USE computer codes and models validated for physical phenomena
 */
export interface ComputerCodeValidation extends Unique, Named {
    /** Computer code name */
    computerCode: string;
    
    /** Code version */
    codeVersion: string;
    
    /** Verification documentation */
    verificationDocumentation: string;
    
    /** Validation against experimental data */
    experimentalValidation?: {
        /** Experiment description */
        experimentDescription: string;
        
        /** Validation results */
        validationResults: string;
        
        /** Reference to validation documentation */
        reference: string;
    }[];
    
    /** Validation against plant-specific benchmarks */
    plantSpecificValidation?: {
        /** Benchmark description */
        benchmarkDescription: string;
        
        /** Validation results */
        validationResults: string;
        
        /** Reference to validation documentation */
        reference: string;
    }[];
    
    /** Validation for specific physical phenomena */
    phenomenaValidation: {
        /** Phenomenon description */
        phenomenonDescription: string;
        
        /** Validation results */
        validationResults: string;
        
        /** Reference to validation documentation */
        reference: string;
    }[];
    
    /** Code limitations */
    limitations: string[];
}

/**
 * Interface for analyst qualifications.
 * @group Engineering Analysis & Validation
 * @implements SC-B6: PERFORM analyses (thermal, structural, etc.) with qualified personnel
 */
export interface AnalystQualification extends Unique {
    /** Analyst name */
    analystName: string;
    
    /** Qualifications */
    qualifications: string[];
    
    /** Experience with relevant analyses */
    relevantExperience: string;
    
    /** Training on computer codes used */
    codeTraining?: {
        /** Code name */
        codeName: string;
        
        /** Training description */
        trainingDescription: string;
        
        /** Date of training */
        trainingDate: string;
    }[];
}

/**
 * Interface for thermal-fluid analysis specifics.
 * @group Engineering Analysis & Validation
 * @implements SC-B7: ENSURE thermal-hydraulic analysis is capable of predicting response to event sequences 
 */
export interface ThermalFluidAnalysis extends Unique {
    /** Reference to the engineering analysis */
    engineeringAnalysisId: string;
    
    /** Event sequences analyzed */
    eventSequencesAnalyzed: string[];
    
    /** System responses modeled */
    systemResponsesModeled: string[];
    
    /** Key thermal parameters analyzed */
    thermalParametersAnalyzed: string[];
    
    /** Time span of the analysis */
    analysisTimeSpan: string;
    
    /** Analysis results summary */
    resultsSummary: string;
}

/**
 * Interface for structural analysis specifics.
 * @group Engineering Analysis & Validation
 * @implements SC-B8: ENSURE structural analysis is capable of determining loads and damage 
 */
export interface StructuralAnalysis extends Unique {
    /** Reference to the engineering analysis */
    engineeringAnalysisId: string;
    
    /** Structures analyzed */
    structuresAnalyzed: string[];
    
    /** Loading conditions analyzed */
    loadingConditionsAnalyzed: string[];
    
    /** Failure modes evaluated */
    failureModesEvaluated: string[];
    
    /** Analysis methods used */
    analysisMethods: string[];
    
    /** Analysis results summary */
    resultsSummary: string;
}

//==============================================================================
/**
 * @group Uncertainty & Expert Judgment
 * @description Model uncertainties, expert judgment, and sensitivity studies
 * @implements SC-B9, SC-B10, SC-A8, SC-A9, SC-A10
 */
//==============================================================================

/**
 * Interface for model uncertainty in success criteria analysis.
 * @group Uncertainty & Expert Judgment
 * @implements SC-B9: IDENTIFY and characterize sources of model uncertainty
 */
export interface ModelUncertainty extends Unique, Named {
    /** Source of uncertainty */
    source: string;
    
    /** Description of the uncertainty */
    description: string;
    
    /** Impact on success criteria */
    impactOnSuccessCriteria: string;
    
    /** Potential alternative approaches */
    potentialAlternatives?: string[];
    
    /** How the uncertainty was characterized */
    characterizationMethod?: string;
    
    /** Related assumptions */
    relatedAssumptions?: string[];
    
    /** Success criteria affected by this uncertainty */
    affectedSuccessCriteria: SuccessCriteriaId[];
}

/**
 * Interface for pre-operational assumptions in success criteria analysis.
 * @group Uncertainty & Expert Judgment
 * @implements SC-A11: IDENTIFY assumptions made due to lack of as-built and as-operated details
 * @implements SC-B10: DOCUMENT assumptions made due to lack of as-built, as-operated details
 */
export interface SuccessCriteriaAssumption extends BaseAssumption {
    /** Success criteria affected by this assumption */
    affectedSuccessCriteria: SuccessCriteriaId[];
    
    /** Specific impact on success criteria */
    impactOnSuccessCriteria: string;
}

/**
 * Interface for expert judgment used in success criteria analysis.
 * @group Uncertainty & Expert Judgment
 * @implements SC-A8: USE expert judgment in a manner that is defensible
 */
export interface ExpertJudgment extends Unique {
    /** Topic of expert judgment */
    topic: string;
    
    /** Justification for using expert judgment */
    justification: string;
    
    /** Panel members involved */
    panelMembers: string[];
    
    /** Process followed */
    processDescription: string;
    
    /** Reference to process documentation */
    processDocumentationReference: string;
    
    /** Outcome of the expert judgment */
    outcome: string;
    
    /** Success criteria informed by this judgment */
    informedSuccessCriteria: SuccessCriteriaId[];
}

/**
 * Interface for sensitivity studies related to success criteria.
 * @group Uncertainty & Expert Judgment
 * @implements SC-A9: PERFORM sensitivity studies for significant assumptions
 * @implements SC-A10: IDENTIFY reasonable alternatives for significant assumptions
 */
export interface SuccessCriteriaSensitivityStudy extends SensitivityStudy {
    /** Success criteria evaluated in this study */
    evaluatedSuccessCriteria: SuccessCriteriaId[];
    
    /** Significant assumptions being evaluated */
    significantAssumptions: string[];
    
    /** Reasonable alternatives considered */
    reasonableAlternatives: string[];
    
    /** Impact on success criteria definitions */
    impactOnDefinitions: string;
}

//==============================================================================
/**
 * @group Documentation & Traceability
 * @description Documentation for success criteria development and traceability
 * @implements HLR-SC-C, SC-C1, SC-C2, SC-C3
 */
//==============================================================================

/**
 * Interface representing documentation of the process used in the success criteria development.
 * @group Documentation & Traceability
 * @implements SC-C1: DOCUMENT the process used in the Success Criteria Development
 */
export interface ProcessDocumentation extends BaseProcessDocumentation {
    /** 
     * Documentation of the definition of end states
     * @implements SC-C1(a): Definition of end states, events, and parameters
     */
    endStateDefinitions?: {
        /** End state identifier */
        endStateId: string;
        
        /** Definition of the end state */
        definition: string;
        
        /** Event sequences leading to this end state */
        eventSequences: string[];
        
        /** Key parameters used to define this end state */
        parameters: Record<string, string>;
        
        /** Basis for parameter values */
        parameterBasis: string;
    }[];
    
    /**
     * Documentation of calculations used to establish success criteria
     * @implements SC-C1(b): Calculations used to establish success criteria
     */
    calculationsUsed?: {
        /** Calculation identifier */
        calculationId: string;
        
        /** Description of the calculation */
        description: string;
        
        /** Whether it's generic or plant-specific */
        calculationType: "GENERIC" | "PLANT_SPECIFIC";
        
        /** References to the calculation documentation */
        references: string[];
        
        /** Success criteria established by this calculation */
        establishedCriteria: string[];
    }[];
    
    /**
     * Documentation of computer codes used
     * @implements SC-C1(c): Computer codes used to establish success criteria
     */
    computerCodesUsed?: {
        /** Code identifier */
        codeId: string;
        
        /** Code name and version */
        nameAndVersion: string;
        
        /** Description of the code */
        description: string;
        
        /** References to validation documentation */
        validationReferences: string[];
        
        /** Success criteria established using this code */
        establishedCriteria: string[];
    }[];
    
    /**
     * Documentation of limitations of calculations and codes
     * @implements SC-C1(d): Limitations of calculations and codes
     */
    calculationLimitations?: {
        /** Limitation identifier */
        limitationId: string;
        
        /** Description of the limitation */
        description: string;
        
        /** Affected calculations or codes */
        affectedItems: string[];
        
        /** Mitigation strategies */
        mitigation?: string;
        
        /** Impact on success criteria */
        impact: string;
    }[];
    
    /**
     * Documentation of expert judgment use
     * @implements SC-C1(e): Expert judgment used in PRA
     */
    expertJudgmentUse?: {
        /** Identifier for the expert judgment */
        judgmentId: string;
        
        /** Topic of the judgment */
        topic: string;
        
        /** Rationale for using expert judgment */
        rationale: string;
        
        /** Success criteria impacted */
        impactedCriteria: string[];
    }[];
    
    /**
     * Documentation of success criteria for mitigating systems
     * @implements SC-C1(f): Success criteria for mitigating systems
     */
    mitigatingSystemsCriteria?: {
        /** System identifier */
        systemId: string;
        
        /** Success criteria for this system */
        successCriteria: string;
        
        /** Technical basis */
        technicalBasis: string;
        
        /** Initiating events where this system is credited */
        applicableInitiatingEvents: string[];
    }[];
    
    /**
     * Documentation of time available for human actions
     * @implements SC-C1(g): Basis for establishing time for human actions
     */
    humanActionTimingBasis?: {
        /** Human action identifier */
        actionId: string;
        
        /** Time available */
        timeAvailable: string;
        
        /** Basis for this time */
        basis: string;
        
        /** References to supporting analyses */
        supportingAnalyses: string[];
    }[];
    
    /**
     * Documentation of grouped initiating events criteria
     * @implements SC-C1(h): Process used to define success criteria for grouped events
     */
    groupedEventsCriteria?: {
        /** Group identifier */
        groupId: string;
        
        /** Initiating events in this group */
        groupedEvents: string[];
        
        /** Process for defining common success criteria */
        process: string;
        
        /** Basis for the grouping */
        groupingBasis: string;
        
        /** Limitations of the grouping */
        limitations?: string;
    }[];
    
    /**
     * Documentation of success criteria for digital systems
     * @implements SC-C1(i): Technical basis for digital I&C success criteria
     */
    digitalSystemsCriteria?: {
        /** Digital system identifier */
        systemId: string;
        
        /** Success criteria */
        criteria: string;
        
        /** Technical basis */
        technicalBasis: string;
        
        /** Failure modes considered */
        failureModes: string[];
        
        /** References to supporting analyses */
        supportingAnalyses: string[];
    }[];
    
    /**
     * Documentation of passive safety function criteria
     * @implements SC-C1(j): Success criteria for passive safety functions
     */
    passiveSafetyCriteria?: {
        /** Passive safety function identifier */
        functionId: string;
        
        /** Description of the function */
        description: string;
        
        /** Success criteria */
        criteria: string;
        
        /** Technical basis */
        technicalBasis: string;
        
        /** Uncertainties in these criteria */
        uncertainties: string;
        
        /** How uncertainties were addressed */
        uncertaintyTreatment: string;
    }[];
    
    /**
     * Documentation of shared systems criteria
     * @implements SC-C1(k): Criteria for shared systems between reactors
     */
    sharedSystemsCriteria?: {
        /** Shared system identifier */
        systemId: string;
        
        /** Reactors sharing this system */
        sharedByReactors: string[];
        
        /** Success criteria */
        criteria: string;
        
        /** Common initiating events considered */
        commonInitiatingEvents: string[];
        
        /** Technical basis */
        technicalBasis: string;
    }[];
}

/**
 * Interface representing documentation of model uncertainty in the success criteria analysis.
 * @group Documentation & Traceability
 * @implements SC-C2: DOCUMENT the sources of model uncertainty
 */
export interface ModelUncertaintyDocumentation extends BaseModelUncertaintyDocumentation {
    /** 
     * Success criteria specific uncertainty impacts
     * @implements SC-C2: DOCUMENT the sources of model uncertainty specific to success criteria
     */
    successCriteriaSpecificUncertainties?: {
        /** Success criteria ID */
        successCriteriaId: SuccessCriteriaId;
        
        /** Specific uncertainties for these criteria */
        uncertainties: string[];
        
        /** Impact on success criteria definition */
        impact: string;
    }[];
    
    /**
     * Documentation of reasonable alternatives
     * @implements SC-C2: DOCUMENT reasonable alternatives associated with the Success Criteria Development
     */
    reasonableAlternatives: {
        /** Alternative approach */
        alternative: string;
        
        /** Reason not selected */
        reasonNotSelected: string;
        
        /** Affected elements (success criteria) */
        applicableElements?: string[];
    }[];
}

/**
 * Interface representing documentation of pre-operational assumptions.
 * @group Documentation & Traceability
 * @implements SC-C3: DOCUMENT assumptions and limitations due to lack of as-built, as-operated details
 */
export interface PreOperationalAssumptionsDocumentation extends BasePreOperationalAssumptionsDocumentation {
    /** 
     * Success criteria specific assumptions
     * @implements SC-C3: DOCUMENT assumptions specific to success criteria
     */
    successCriteriaSpecificAssumptions?: {
        /** Success criteria ID */
        successCriteriaId: SuccessCriteriaId;
        
        /** Specific assumptions for these criteria */
        assumptions: string[];
        
        /** Impact on criteria definition */
        impact: string;
        
        /** Plans to resolve these assumptions */
        resolutionPlans?: string;
    }[];
}

/**
 * Interface representing peer review documentation.
 * @group Documentation & Traceability
 */
export interface PeerReviewDocumentation extends BasePeerReviewDocumentation {
    /** Consistency with event sequence analysis */
    consistencyWithEventSequenceAnalysis?: string;
    
    /** Consistency with mechanistic source term analysis */
    consistencyWithSourceTermAnalysis?: string;
    
    /** Reviewer experience specific to success criteria analysis */
    reviewerExperience?: string;
    
    /** Recognition of plant-specific features */
    plantSpecificFeaturesRecognition?: string;
}

/**
 * Interface representing success criteria design information.
 * @group Documentation & Traceability
 */
export interface SuccessCriteriaDesignInformation extends BaseDesignInformation {
    /** 
     * Specific aspects of the success criteria supported by this design information.
     */
    supportedAspects: {
        /** Whether this supports system capacities (e.g., flow rates, power levels) */
        systemCapacities?: boolean;
        
        /** Whether this supports component performance (e.g., pump curves, valve response times) */
        componentPerformance?: boolean;
        
        /** Whether this supports human actions (e.g., action times, task complexity) */
        humanActions?: boolean;
        
        /** Whether this supports end state definitions (e.g., barriers, release paths) */
        endStateDefinitions?: boolean;
    };
    
    /** 
     * How this design information was used in developing the success criteria.
     */
    applicationInSuccessCriteria: string;
    
    /** 
     * Any assumptions or limitations in applying this design information.
     */
    assumptions?: string[];
}

//==============================================================================
/**
 * @group API
 * @description Main interface for Success Criteria Development and schema validation
 */
//==============================================================================

/**
 * Interface representing the main Success Criteria Development container.
 * 
 * The objectives of Success Criteria Development ensure that:
 * - (a) overall success criteria are defined (i.e., prevention of a release of radioactive material) 
 *       in each of the modeled event sequences and event sequence families;
 * - (b) success criteria are defined for key safety functions, supporting systems, structures, 
 *       barriers to release of radioactive material, components, and operator actions;
 * - (c) the success criteria is documented to provide traceability of the work.
 * 
 * @group API
 * @extends {TechnicalElement<TechnicalElementTypes.SUCCESS_CRITERIA_DEVELOPMENT>}
 */
export interface SuccessCriteriaDevelopment extends TechnicalElement<TechnicalElementTypes.SUCCESS_CRITERIA_DEVELOPMENT> {
    /**
     * Additional metadata specific to Success Criteria Development
     * @implements SC-C1: DOCUMENT the process used in the Success Criteria Development
     */
    additionalMetadata?: {
        /** Known limitations */
        limitations?: string[];
        
        /** High-level assumptions */
        assumptions?: string[];
    };
    
    /**
     * Overall success criteria defined for preventing a release of radioactive material
     * @implements HLR-SC-A: Overall success criteria for the system, structure, component, and human action
     */
    overallSuccessCriteria: Record<SuccessCriteriaId, OverallSuccessCriteriaDefinition>;
    
    /**
     * System-specific success criteria
     * @implements SC-A3: SPECIFY mitigating systems and functions
     * @implements SC-A4: IDENTIFY dependencies
     */
    systemSuccessCriteria?: Record<string, SystemSuccessCriteriaDefinition>;
    
    /**
     * Component-level success criteria
     * @implements SC-A5: SPECIFY components required
     */
    componentSuccessCriteria?: Record<string, ComponentSuccessCriteriaDefinition>;
    
    /**
     * Human action success criteria
     * @implements SC-A6: SPECIFY requirements for operator actions
     */
    humanActionSuccessCriteria?: Record<string, HumanActionSuccessCriteriaDefinition>;
    
    /**
     * Shared resource definitions between reactors
     * @implements SC-A7: IDENTIFY mitigating systems shared between reactors
     */
    sharedResources?: Record<string, SharedResourceDefinition>;
    
    /**
     * Engineering analyses supporting success criteria
     * @implements HLR-SC-B: Engineering bases shall be capable of providing success criteria
     */
    engineeringAnalyses: Record<string, EngineeringAnalysis>;
    
    /**
     * Plant-specific design information
     * @implements SC-B2: BASE analyses on realistic plant-specific design and procedural information
     */
    plantSpecificDesign?: Record<string, PlantSpecificDesignInformation>;
    
    /**
     * Computer code validation information
     * @implements SC-B3: USE computer codes, models, and methods that are validated and verified
     * @implements SC-B4: USE computer codes and models validated with plant-specific or applicable benchmarks
     * @implements SC-B5: USE computer codes and models validated for physical phenomena
     */
    computerCodeValidation?: Record<string, ComputerCodeValidation>;
    
    /**
     * Analyst qualifications
     * @implements SC-B6: PERFORM analyses (thermal, structural, etc.) with qualified personnel
     */
    analystQualifications?: Record<string, AnalystQualification>;
    
    /**
     * Thermal-fluid analyses
     * @implements SC-B7: ENSURE thermal-hydraulic analysis is capable of predicting response
     */
    thermalFluidAnalyses?: Record<string, ThermalFluidAnalysis>;
    
    /**
     * Structural analyses
     * @implements SC-B8: ENSURE structural analysis is capable of determining loads and damage
     */
    structuralAnalyses?: Record<string, StructuralAnalysis>;
    
    /**
     * Sources of model uncertainty
     * @implements SC-B9: IDENTIFY and characterize the sources of model uncertainty
     */
    modelUncertainties?: Record<string, ModelUncertainty>;
    
    /**
     * Assumptions made due to lack of as-built, as-operated details
     * @implements SC-A11: IDENTIFY assumptions made due to lack of as-built and as-operated details
     * @implements SC-B10: DOCUMENT assumptions made due to lack of as-built, as-operated details
     */
    preOperationalAssumptions?: Record<string, SuccessCriteriaAssumption>;
    
    /**
     * Expert judgments used
     * @implements SC-A8: USE expert judgment in a manner that is defensible
     */
    expertJudgments?: Record<string, ExpertJudgment>;
    
    /**
     * Sensitivity studies performed
     * @implements SC-A9: PERFORM sensitivity studies for significant assumptions
     * @implements SC-A10: IDENTIFY reasonable alternatives for significant assumptions
     */
    sensitivityStudies?: Record<string, SuccessCriteriaSensitivityStudy>;
    
    /**
     * References to supporting plant response analyses
     */
    plantResponseAnalysisReferences?: string[];
    
    /**
     * Documentation of the analysis
     * @implements HLR-SC-C: The documentation of the Success Criteria Development shall provide traceability of the work
     * @implements SC-C1: DOCUMENT the process used
     * @implements SC-C2: DOCUMENT the sources of model uncertainty
     * @implements SC-C3: DOCUMENT assumptions and limitations
     */
    documentation?: {
        /** Process documentation */
        processDocumentation?: ProcessDocumentation;
        
        /** Model uncertainty documentation */
        modelUncertaintyDocumentation?: ModelUncertaintyDocumentation;
        
        /** Pre-operational assumptions documentation */
        preOperationalAssumptionsDocumentation?: PreOperationalAssumptionsDocumentation;
        
        /** Peer review documentation */
        peerReviewDocumentation?: PeerReviewDocumentation;
        
        /** 
         * Traceability documentation 
         * @implements HLR-SC-C: The documentation of the Success Criteria Development shall provide traceability of the work
         */
        traceabilityDocumentation?: BaseTraceabilityDocumentation;
    };
    
    /**
     * Mission times for event sequences
     * @implements SC-A2: SPECIFY the mission time for each modeled event sequence
     */
    missionTimes?: Record<string, MissionTimeDefinition>;
    
    /**
     * Component mission times
     * @implements SC-A8: ENSURE component mission time supports full sequence mission time
     */
    componentMissionTimes?: Record<string, ComponentMissionTimeDefinition>;
    
    /**
     * Consistency verifications
     * @implements SC-A7: ENSURE consistency with plant design bases, licensing bases, and operational practices
     * @implements SC-A9: ENSURE consistency with features, procedures, and design/operating philosophy
     */
    consistencyVerifications?: Record<string, ConsistencyVerification>;
}

/**
 * JSON schema for validating {@link SuccessCriteriaDevelopment} entities.
 * Provides validation and ensures type safety throughout the application.
 *
 * @group API
 * @example
 * ```typescript
 * const isValid = SuccessCriteriaDevelopmentSchema.validate(someData);
 * ```
 */
export const SuccessCriteriaDevelopmentSchema = typia.json.application<[SuccessCriteriaDevelopment], "3.0">();

/**
 * Runtime validation for Success Criteria Development.
 * @group API
 */
export const validateSuccessCriteriaDevelopment = typia.createValidate<SuccessCriteriaDevelopment>();

/**
 * Type guard for Success Criteria Development.
 * @group API
 */
export const isSuccessCriteriaDevelopment = typia.createIs<SuccessCriteriaDevelopment>();

/**
 * Runtime validation for Consistency Verification.
 * @group API
 */
export const validateConsistencyVerification = typia.createValidate<ConsistencyVerification>();

/**
 * Type guard for Consistency Verification.
 * @group API
 */
export const isConsistencyVerification = typia.createIs<ConsistencyVerification>();

/**
 * Interface representing mission time information for event sequences.
 * @group Success Criteria & Technical Bases
 * @implements SC-A2: SPECIFY the mission time for each modeled event sequence
 */
export interface MissionTimeDefinition extends Unique {
    /** Reference to the event sequence */
    eventSequenceReference: string;
    
    /** Mission time in hours */
    missionTimeHours: number & tags.Minimum<0>;
    
    /** Basis for the mission time */
    basis: string;
    
    /** References to supporting analyses */
    analysisReferences: string[];
    
    /** Whether this is a risk-significant sequence (for CC-II differentiation) */
    isRiskSignificant?: boolean;
}

/**
 * Interface representing component mission time information.
 * @group Success Criteria & Technical Bases
 * @implements SC-A8: ENSURE component mission time supports full sequence mission time
 */
export interface ComponentMissionTimeDefinition extends Unique {
    /** Component identifier */
    componentId: string;
    
    /** Mission time in hours */
    missionTimeHours: number & tags.Minimum<0>;
    
    /** Reference to the event sequence */
    eventSequenceReference: string;
    
    /** 
     * Justification if component mission time is shorter than sequence mission time
     * Required if component mission time < sequence mission time
     */
    shorterMissionTimeJustification?: string;
    
    /** References to supporting analyses */
    analysisReferences: string[];
}
