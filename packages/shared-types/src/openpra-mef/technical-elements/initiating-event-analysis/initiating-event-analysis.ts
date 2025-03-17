/**
 * @module initiating_event_analysis
 * 
 * The objectives of Initiating Event Analysis ensure that:
 * - (a) There is a reasonably complete identification of initiating events;
 * - (b) Grouping the initiating events is conducted so that events in the same group have similar mitigation requirements;
 * - (c) Frequencies of the initiating events are quantified;
 * - (d) The Initiating Event Analysis is documented to provide traceability of the work.
 * 
 * Per RG 1.247, initiating events are perturbations to the steady-state operation of the plant that challenge plant control 
 * and safety systems and could lead to plant damage states of interest, radioactivity release, or both. They also include 
 * failures of plant control and safety systems that may cause perturbation to the steady-state operation of the plant that 
 * could lead to these same outcomes.
 * 
 * @expert_value
 * This schema provides:
 * - Built-in validation for frequency calculations and grouping consistency
 * - Comprehensive hazard analysis integration
 * - Runtime type checking through Typia
 * - Clear separation of identification methods (MLD, HBFT, FMEA)
 * - Automated completeness checking for required initiating event categories
 * - Traceability between plant operating states and initiating events
 * 
 * @dependency_structure
 * This module follows a hierarchical dependency structure:
 * 1. Core events (events.ts) - Most upstream, provides base event types
 * 2. Plant operating states (plant_operating_states_analysis.ts) - Midstream, depends on core events
 * 3. Initiating event analysis (this file) - Downstream, depends on both core events and plant operating states
 * 
 * @preferred
 * @category Technical Elements 
*/

// Core imports (most upstream)
import typia, { tags } from "typia";
import { Named, Unique } from "../core/meta";
import { Frequency, InitiatingEvent, BaseEvent, FrequencyUnit } from "../core/events";
import { ImportanceLevel, SensitivityStudy, ScreeningStatus, ScreeningCriteria } from "../core/shared-patterns";

// Plant operating states imports (midstream)
import { 
  OperatingState, 
  BarrierStatus, 
  ModuleState, 
  SafetyFunction, 
  RadionuclideBarrier,
  PlantOperatingState
} from "../plant-operating-states-analysis/plant-operating-states-analysis";

// Data analysis imports
import { 
  Uncertainty, 
  DataSource, 
  Assumption, 
  DistributionType, 
  FrequencyQuantification, 
  BayesianUpdate 
} from "../data-analysis/data-analysis";

// Success criteria imports
import { SuccessCriteriaId } from "../success-criteria/success-criteria-development";

// Other technical element imports
import { TechnicalElement, TechnicalElementTypes, TechnicalElementMetadata } from "../technical-element";
import { SystemDefinition, FailureModeType } from "../systems-analysis/systems-analysis";

//==============================================================================
/**
 * @group Core Definitions & Enums
 * @description Basic types, enums, and utility interfaces used throughout the module
 */
//==============================================================================

/**
 * Reference to a Plant Operating State by its unique identifier
 * @description Used to reference plant operating states without creating circular dependencies
 * @example
 * ```typescript
 * const posReference: PlantOperatingStateReference = "POS-FULL-POWER-01";
 * ```
 *  @group Core Definitions & Enums
 */
export type PlantOperatingStateReference = string;

/**
 * Reference to a Safety Function by its unique identifier
 * @description Used to reference safety functions without creating circular dependencies
 * @example
 * ```typescript
 * const sfReference: SafetyFunctionReference = "SF-DHR-01";
 * ```
 *  @group Core Definitions & Enums
 */
export type SafetyFunctionReference = string;

/**
 * These categories help in the organization and analysis of different types of events.
 * @remarks **IE-A5**: INCLUDE in the spectrum of initiating event challenges these general categories
 *  @group Core Definitions & Enums
 */
export enum InitiatingEventCategory {
  /** Equipment or human-induced events that disrupt plant operation with intact RCB */
  TRANSIENT = "TRANSIENT",
  
  /** Equipment or human-induced events causing a breach in the RCS */
  RCB_BREACH = "RCB_BREACH",
  
  /** Events in systems interfacing with RCS that could result in loss of coolant */
  INTERFACING_SYSTEMS_RCB_BREACH = "INTERFACING_SYSTEMS_RCB_BREACH",
  
  /** Special initiators not falling into standard categories */
  SPECIAL = "SPECIAL",
  
  /** Events caused by internal plant hazards */
  INTERNAL_HAZARD = "INTERNAL_HAZARD",
  
  /** Events caused by external hazards */
  EXTERNAL_HAZARD = "EXTERNAL_HAZARD",
  
  /** Events caused by at-initiator human failure events */
  HUMAN_FAILURE = "HUMAN_FAILURE"
}

/**
 * Enum representing the importance of an initiating event.
 * Used for risk insights and prioritization.
*  @group Core Definitions & Enums
 */
// Removed ImportanceLevel enum since it's now imported from shared-patterns

/**
 * Enhanced definition of an initiating event with additional properties
 * @extends {InitiatingEvent}
 *
 * @remarks **HLR-IE-A**: The Initiating Event Analysis shall reasonably identify all initiating events for all modeled plant operating states and sources of radioactive material consistent with the PRA scope and plant pre-operational stage.
 * 
 * @example
 * ```typescript
 * const event: ExtendedInitiatingEvent = {
 *   uuid: "123e4567-e89b-12d3-a456-426614174000",
 *   name: "Loss of Offsite Power",
 *   eventType: "INITIATING",
 *   frequency: 1.2e-7,
 *   category: InitiatingEventCategory.TRANSIENT,
 *   description: "Loss of all AC power from the grid.",
 *   uncertainty: {
 *     distribution: DistributionType.LOGNORMAL,
 *     parameters: {
 *       mean: 1.2e-7,
 *       errorFactor: 3
 *     }
 *   }
 * };
 * ```
 *  @group Core Definitions & Enums
 */
export interface ExtendedInitiatingEvent extends InitiatingEvent {
    /**
     * Category of the initiating event.
     * @remarks **HLR-IE-B**: The Initiating Event Analysis shall group the initiating events so that events in the same group have similar mitigation requirements to facilitate an efficient but realistic estimation of the frequency of each modeled event sequence and event sequence family.
     */
    category: InitiatingEventCategory | string;
    
    /**
     * Optional detailed description of the initiating event.
     */
    description?: string;
    
    /**
     * Model uncertainty, data sources, and assumptions associated with the initiating event.
     * @remarks **IE-C19**: Characterise the uncertainty associated with the frequency of each initiating event or initiating event group.
     * @remarks **IE-D2**: DOCUMENT the sources of model uncertainty, related assumptions, and reasonable alternatives (as identified in Requirements IE-A17) associated with the Initiating Event Analysis.
     */
    uncertainty?: Uncertainty;
    
    /**
     * Grouping of initiating events with similar mitigation requirements.
     * @remarks **HLR-IE-B**: The Initiating Event Analysis shall group the initiating events so that events in the same group have similar mitigation requirements.
     */
    group?: string;
    
    /**
     * Plant operating states in which this initiating event can occur.
     * @remarks **HLR-IE-A**: The Initiating Event Analysis shall reasonably identify all initiating events for all modeled plant operating states ...
     */
    applicableStates?: PlantOperatingStateReference[];
    
    /**
     * Unique identifier for the grouping of initiating events for analysis purposes.
     * @remarks **HLR-IE-B**: ...group the initiating events so that events in the same group have similar mitigation requirements...
     */
    groupId?: string;
    
    /**
     * List of plant-specific experience related to this initiating event (for operating plants).
     * @remarks **IE-A7**: For operating plants, REVIEW the plant-specific initiating-event experience to ensure that the list of challenges addresses plant experience for all modeled plant operating states.
     */
    plantExperience?: string[];
    
    /**
     * Review of generic analyses of similar plants.
     * @remarks **IE-A8**: REVIEW generic analyses of similar plants to assess whether the list of challenges included in the model addresses industry experience for all modeled plant operating states.
     */
    genericAnalysisReview?: string;
    
    /**
     * Assumptions made due to lack of as-built, as-operated details (for pre-operational stage).
     * @remarks **IE-A18**: For PRAs performed during the pre-operational stage, IDENTIFY assumptions made due to the lack of as-built, as-operated details that influence the initiating event identification analysis.
     */
    preOperationalAssumptions?: string[];
    
    /**
     * Basis for screening out this initiating event (if applicable).
     * @remarks **IE-D1**: DOCUMENT ... (f) the basis for screening out initiating events;
     */
    screeningBasis?: string;
    
    /**
     * References to supporting analyses (e.g., fault trees).
     * @remarks **IE-C11**: If fault tree modeling is used for initiating events, USE the applicable Systems Analysis requirements for fault tree modeling found in Systems Analysis (HLR-SY-A).
     */
    supportingAnalyses?: {
        analysisType: string;
        analysisId: string;
        description?: string;
    }[];

    /**
     * Screening status of this initiating event
     * @remarks **IE-B7**: SCREEN OUT initiating events if they meet defined criteria
     */
    screeningStatus?: ScreeningStatus;

    /**
     * Importance level of this initiating event for risk insights
     */
    importanceLevel?: ImportanceLevel;
}

//==============================================================================
/**
 * @group Identification Methods
 * @description Methods for systematically identifying initiating events
 * @implements IE-A9, IE-A10, IE-A12, IE-A15
 */
//==============================================================================

/**
 * Base interface for identification methods with version tracking information
 * @remarks **IE-D1**: DOCUMENT the process used in the Initiating Event Analysis specifying what is used as input, the applied methods, and the results.
 * @group Identification Methods
 */
export interface IdentificationMethodBase {
    /** Unique identifier for the method */
    method_id: string;
    
    /** Version of the method */
    version: string;
    
    /** Analyst who performed the method */
    analyst: string;
    
    /** Review date */
    review_date: string;
    
    /** Review status */
    review_status: "DRAFT" | "REVIEWED" | "APPROVED";
    
    /** Supporting document references */
    supporting_documents: string[];
}

/**
 * Master Logic Diagram method for identifying initiating events
 * @remarks **IE-A9**: Perform a systematic evaluation of each system down to the subsystem or train level...
 * @remarks **IE-A12**: Interview at least one knowledgeable resource in plant design or operation to identify potential overlooked initiating events.
 * @example
 * ```typescript
 * const mld: MasterLogicDiagram = {
 *   method_id: "MLD-001",
 *   version: "1.0",
 *   sources: new Set(["NUREG-1829", "Plant_FSAR"]),
 *   operating_states: new Set([OperatingState.POWER]),
 *   // ... other properties
 * };
 * ```
 * @group Identification Methods
 */
export interface MasterLogicDiagram extends IdentificationMethodBase {
    /** Data sources used */
    sources: Set<string>;
    
    /** Operating states considered */
    operating_states: Set<OperatingState>;
    
    /** Radionuclide barriers */
    radionuclide_barriers: Record<string, RadionuclideBarrier>;
    
    /** Safety functions */
    safety_functions: Record<string, SafetyFunction>;
    
    /** Systems and components */
    systems_components: Record<string, SystemDefinition>;
    
    /** Failure modes */
    failure_modes: Record<string, {
        id: string;
        name: string;
        description: string;
        component_id: string;
        failureMode: FailureModeType | string;
    }>;
    
    /** Identified initiators */
    initiators: Record<string, InitiatorDefinition>;
}

/**
 * Heat Balance Fault Tree method for identifying initiating events
 * @remarks **IE-A9**: Perform a systematic evaluation of each system down to the subsystem or train level, including support systems, to identify potential initiating events.
 * @example
 * ```typescript
 * const hbft: HeatBalanceFaultTree = {
 *   method_id: "HBFT-001",
 *   version: "1.0",
 *   operating_states: new Set([OperatingState.POWER]),
 *   interfaces: { "RCS": { name: "RCS Pressure", parameters: ["pressure"], normal_ranges: [[2200, 2300]] } },
 *   // ... other properties
 * };
 * ```
 * @group Identification Methods
 */
export interface HeatBalanceFaultTree extends IdentificationMethodBase {
    /** Operating states considered */
    operating_states: Set<OperatingState>;
    
    /** System interfaces */
    interfaces: Record<string, {
        name: string;
        parameters: string[];
        normal_ranges: [number, number][];
    }>;
    
    /** Process imbalances */
    imbalances: Record<string, {
        description: string;
        threshold: number;
        consequences: string[];
    }>;
    
    /** Causes of imbalances */
    causes: Record<string, {
        description: string;
        probability: number;
        uncertainty?: Uncertainty;
    }>;
    
    /** Systems and components */
    systems_components: Record<string, SystemDefinition>;
}

/**
 * Failure Modes and Effects Analysis method
 * @remarks **IE-A10**: Include initiating events resulting from multiple failures, including common cause failures and equipment unavailabilities due to maintenance or testing.
 * @remarks **IE-A15**: In searching for initiating events, INCLUDE each system and supporting system alignment that could either influence the likelihood that failures cause an initiating event or could increase the severity of the effect on plant safety functions.
 * @example
 * ```typescript
 * const fmea: FailureModesEffectAnalysis = {
 *   method_id: "FMEA-001",
 *   version: "1.0",
 *   systems: { "RHR": { name: "Residual Heat Removal", function: "Core Cooling", boundaries: ["RCS", "CCW"] } },
 *   // ... other properties
 * };
 * ```
 * @group Identification Methods
 */
export interface FailureModesEffectAnalysis extends IdentificationMethodBase {
    /** Systems analyzed */
    systems: Record<string, {
        name: string;
        function: string;
        boundaries: string[];
    }>;
    
    /** Components analyzed */
    components: Record<string, SystemDefinition>;
    
    /** Failure modes analyzed */
    failure_modes: Record<string, {
        mode: FailureModeType | string;
        causes: string[];
        local_effects: string[];
        system_effects: string[];
        detection: string[];
        safeguards: string[];
        severity: number;
        probability: number;
    }>;
}

/**
 * Comprehensive definition of an initiating event
 * @remarks **IE-A7**: For operating plants, REVIEW the plant-specific initiating-event experience to ensure that the list of challenges addresses plant experience for all modeled plant operating states.
 * @remarks **IE-A8**: REVIEW generic analyses of similar plants to assess whether the list of challenges included in the model addresses industry experience for all modeled plant operating states.
 * @example
 * ```typescript
 * const loca: InitiatorDefinition = {
 *   id: "IE-LOCA-LARGE",
 *   name: "Large Break LOCA",
 *   eventType: "INITIATING",
 *   frequency: 1.0e-6,
 *   category: InitiatingEventCategory.RCB_BREACH,
 *   operating_states: [OperatingState.POWER],
 *   // ... other properties
 * };
 * ```
 * @group Identification Methods
 */
export interface InitiatorDefinition extends ExtendedInitiatingEvent {
    /**
     * Alternative ID for the initiator
     */
    id: string;
    
    /**
     * Subcategory of the initiating event
     */
    subcategory?: string;
    
    /**
     * Method used to identify this initiating event
     */
    identification_method: string;
    
    /**
     * Basis for identification of this initiator
     */
    identification_basis: string[];
    
    /**
     * Operating states in which this initiator can occur
     * @remarks This property uses the OperatingState enum from plant-operating-states-analysis
     * to ensure type consistency across the codebase.
     */
    operating_states: OperatingState[];
    
    /**
     * Parameters that trigger reactor/plant trips
     */
    trip_parameters: Record<string, {
        parameter: string;
        setpoint: number;
        uncertainty: number;
        basis: string;
    }>;
    
    /**
     * Systems that can mitigate this initiating event
     */
    mitigating_systems: Record<string, {
        system: string;
        function: string;
        success_criteria: string | string[] | SuccessCriteriaId;
        dependencies: string[];
    }>;
    
    /**
     * Impact on radionuclide barriers
     * @remarks Uses the BarrierStatus enum from plant-operating-states-analysis
     */
    barrier_impacts: Record<string, {
        barrier: string;
        state: BarrierStatus;
        timing: string;
        mechanism: string;
    }>;
    
    /**
     * Impact on reactor modules (for multi-module plants)
     * @remarks Uses the ModuleState enum from plant-operating-states-analysis
     */
    module_impacts: Record<string, {
        module: string;
        state: ModuleState;
        propagation_path?: string;
        timing?: string;
    }>;
}

/**
 * Hazard-induced initiating event
 * @remarks **IE-A6**: When identifying initiating events caused by internal or external hazards, INCLUDE initiating events caused by a combination of hazards.
 * @group Identification Methods
 */
export interface HazardInducedInitiator extends InitiatorDefinition {
    /** Type of hazard (e.g., "SEISMIC", "FIRE", "FLOOD") */
    hazard_type: string;
    
    /** Hazard severity level */
    hazard_severity: string;
    
    /** Combination of hazards (if applicable) */
    combined_hazards?: string[];
    
    /** Areas of the plant affected */
    affected_areas: string[];
    
    /** Hazard-specific frequency calculation factors */
    hazard_frequency_factors: {
        return_period?: number;
        exceedance_probability?: number;
        fragility_parameters?: Record<string, number>;
    };
}

//==============================================================================
/**
 * @group Event Grouping & Screening
 * @description Grouping logic, screening criteria, and methodology
 * @implements IE-B1, IE-B2, IE-B3, IE-B4, IE-B5, IE-B6, IE-B7, IE-B8
 */
//==============================================================================

/**
 * Criteria for screening out initiating events
 * @remarks **IE-B7**: SCREEN OUT initiating events if they meet criteria
 * @group Event Grouping & Screening
 */
export interface InitiatingEventScreeningCriteria extends ScreeningCriteria {
    /** List of screened-out initiating events */
    screened_out_events: {
        event_id: string;
        reason: string;
        justification: string;
    }[];
}

/**
 * Initiating event group defined by similar mitigation requirements
 * @remarks **IE-B1**: Group initiating events to facilitate definition of event sequences and quantification. Justify that grouping does not affect the determination of risk-significant event sequences.
 * @remarks **IE-B2**: Use a structured, systematic process for grouping initiating events.
 * @group Event Grouping & Screening
 */
export interface InitiatingEventGroup extends Unique, Named {
    /** Description of the group */
    description: string;
    
    /** Member initiating events IDs */
    member_ids: string[];
    
    /** Basis for grouping */
    grouping_basis: string;
    
    /** The bounding (worst-case) initiator in the group */
    bounding_initiator_id: string;
    
    /** Shared mitigation requirements */
    shared_mitigation_requirements: string[];
    
    /** Safety functions challenged */
    challenged_safety_functions: SafetyFunctionReference[];
    
    /** Applicable operating states */
    applicable_operating_states: PlantOperatingStateReference[];
    
    /** Frequency quantification for the group */
    quantification?: FrequencyQuantification;
    
    /** Risk importance of the group */
    risk_importance?: ImportanceLevel;
}

//==============================================================================
/**
 * @group Quantification & Uncertainty
 * @description Frequency calculation, uncertainty analysis, and data sources
 * @implements IE-C1, IE-C2, IE-C3, IE-C4, IE-C5, IE-C6, IE-C7, IE-C8, IE-C9, IE-C10, IE-C11, IE-C12, IE-C13, IE-C14, IE-C15, IE-C16, IE-C17, IE-C18, IE-C19
 */
//==============================================================================

/**
 * Quantification details for an initiating event
 * @remarks **HLR-IE-C**: The Initiating Event Analysis shall quantify the annual frequency of each initiating event or initiating event group based on the plant conditions for each source of radioactive material and plant operating state within the scope of the PRA.
 * @remarks **IE-C1**: For operating plants, calculate initiating event frequency using applicable generic and plant- or design-specific data representative of current design and performance, unless adequate plant-specific data exists.
 * @group Quantification & Uncertainty
 */
export interface InitiatingEventQuantification {
    /** ID of the initiating event or group */
    event_id: string;
    
    /** Frequency quantification */
    quantification: FrequencyQuantification;
    
    /** Basis for excluding data, if any */
    data_exclusion_justification?: string;
    
    /** Basis for applying data from other reactor types */
    other_reactor_data_justification?: string;
    
    /** Fault tree details, if used for quantification */
    fault_tree_details?: {
        model_id: string;
        top_event: string;
        modifications: string[];
    };
    
    /** Sensitivity studies performed */
    sensitivityStudies?: SensitivityStudy[];
}

//==============================================================================
/**
 * @group Documentation & Traceability
 * @description Process documentation, requirements tracing, and peer review
 * @implements IE-D1, IE-D2, IE-D3
 */
//==============================================================================

/**
 * Documentation of the Initiating Event Analysis process
 * @remarks **HLR-IE-D**: The documentation of the Initiating Event Analysis shall provide traceability of the work.
 * @remarks **IE-D1**: DOCUMENT the process used in the Initiating Event Analysis specifying what is used as input, the applied methods, and the results.
 * @group Documentation & Traceability
 */
export interface InitiatingEventDocumentation {
    /** Description of the analysis process */
    processDescription: string;
    
    /** Input sources used in the analysis */
    inputSources: string[];
    
    /** Methods applied in the analysis */
    appliedMethods: string[];
    
    /** Summary of analysis results */
    resultsSummary: string;
    
    /** Functional categories considered */
    functionalCategories: string[];
    
    /** Search process for plant-unique initiators */
    plantUniqueInitiatorsSearch: string;
    
    /** Process for identifying state-specific initiators */
    stateSpecificInitiatorsSearch: string;
    
    /** Process for identifying RCB failures */
    rcbFailureSearch: string;
    
    /** Assessment of initiating events completeness */
    completenessAssessment: string;
    
    /** Basis for screening out initiating events */
    screeningBasis: string;
    
    /** Basis for grouping initiating events */
    groupingBasis: string;
    
    /** Justification for dismissing observed events */
    dismissalJustification: string;
    
    /** Method for deriving initiating event frequencies */
    frequencyDerivation: string;
    
    /** Approach to quantification */
    quantificationApproach: string;
    
    /** Justification for excluding certain data */
    dataExclusionJustification: string;
    
    /** Justification for applying data from other reactor types */
    otherDataApplicationJustification: string;
}

/**
 * Peer review documentation for Initiating Event Analysis
 * @remarks **HLR-IE-D**: The documentation of the Initiating Event Analysis shall provide traceability of the work.
 * @remarks **IE-D1**: DOCUMENT the process used in the Initiating Event Analysis specifying what is used as input, the applied methods, and the results.
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
}

/**
 * Pre-operational assumptions for Initiating Event Analysis
 * @remarks **IE-D3**: For PRAs performed during the pre-operational stage, DOCUMENT assumptions and limitations due to the lack of as-built, as-operated details...
 * @group Documentation & Traceability
 */
export interface PreOperationalAssumptions {
    /** The assumption statement */
    statement: string;
    
    /** Impact on the analysis */
    impact: string;
    
    /** How the assumption is addressed */
    treatmentApproach: string;
    
    /** Plans for validation once the plant is built */
    validationPlan?: string;
}

//==============================================================================
/**
 * @group API
 * @description Main interfaces for external consumption, validation schemas, and integration points
 */
//==============================================================================

/**
 * Main interface for initiating events analysis
 * Implements comprehensive analysis of initiating events including identification,
 * grouping, quantification, and insights
 * 
 * @remarks **HLR-IE-A**: The Initiating Event Analysis shall reasonably identify all initiating events for all modeled plant operating states and sources of radioactive material consistent with the PRA scope and plant pre-operational stage.
 * @remarks **HLR-IE-B**: The Initiating Event Analysis shall group the initiating events so that events in the same group have similar mitigation requirements to facilitate an efficient but realistic estimation of the frequency of each modeled event sequence and event sequence family.
 * @remarks **HLR-IE-C**: The Initiating Event Analysis shall quantify the annual frequency of each initiating event or initiating event group based on the plant conditions for each source of radioactive material and plant operating state within the scope of the PRA.
 * @remarks **HLR-IE-D**: The documentation of the Initiating Event Analysis shall provide traceability of the work.
 * 
 * @example
 * ```typescript
 * const analysis: InitiatingEventsAnalysis = {
 *   "technical-element-type": TechnicalElementTypes.INITIATING_EVENT_ANALYSIS,
 *   "technical-element-code": "IE",
 *   metadata: {
 *     version: "1.0",
 *     analysis_date: "2024-02-21",
 *     analyst: "John Doe",
 *     // ... other metadata
 *   },
 *   // ... complete analysis data
 * };
 * ```
 *  @group API
 */
export interface InitiatingEventsAnalysis extends TechnicalElement<TechnicalElementTypes.INITIATING_EVENT_ANALYSIS> {
    /**
     * Additional metadata specific to Initiating Events Analysis
     */
    additionalMetadata?: {
        /** Assumptions specific to initiating events analysis */
        assumptions: Assumption[];
    };
    
    /**
     * References to plant operating states that are considered in this analysis
     * @remarks This property stores references to plant operating state IDs rather than the full objects
     * to avoid circular dependencies. These IDs can be used to look up the full PlantOperatingState objects.
     * @remarks **HLR-IE-A**: The Initiating Event Analysis shall reasonably identify all initiating events for all modeled plant operating states...
     */
    applicable_plant_operating_states: PlantOperatingStateReference[];
    
    /**
     * Methods used for identifying initiating events
     * @remarks **IE-A9**: Perform a systematic evaluation of each system down to the subsystem or train level...
     * @remarks **IE-A10**: Include initiating events resulting from multiple failures, including common cause failures and equipment unavailabilities due to maintenance or testing.
     * @remarks **IE-A12**: Interview at least one knowledgeable resource in plant design or operation to identify potential overlooked initiating events.
     * @remarks **IE-A13**: For operating plants, review operating experience for initiating event precursors and initiating events caused by human failures impacting later operator mitigation actions.
     */
    identification: {
        master_logic_diagram: MasterLogicDiagram;
        heat_balance_fault_tree: HeatBalanceFaultTree;
        failure_modes_analysis: FailureModesEffectAnalysis;
    };
    
    /**
     * Identified initiating events
     * @remarks **HLR-IE-A**: The Initiating Event Analysis shall reasonably identify all initiating events...
     */
    initiators: Record<string, InitiatorDefinition>;
    
    /**
     * Grouping of initiating events with similar mitigation requirements
     * @remarks **HLR-IE-B**: The Initiating Event Analysis shall group the initiating events so that events in the same group have similar mitigation requirements (i.e., the requirements for all events in the group are either equally or less restrictive than the limiting mitigation requirements for the group) to facilitate an efficient but realistic estimation of the frequency of each modeled event sequence and event sequence family.
     * @remarks **IE-B1**: Group initiating events to facilitate definition of event sequences and quantification. Justify that grouping does not affect the determination of risk-significant event sequences.
     */
    initiating_event_groups: Record<string, InitiatingEventGroup>;
    
    /**
     * Frequency quantification for initiating events
     * @remarks **HLR-IE-C**: The Initiating Event Analysis shall quantify the annual frequency of each initiating event or initiating event group based on the plant conditions for each source of radioactive material and plant operating state within the scope of the PRA.
     * @remarks **IE-C1**: For operating plants, calculate initiating event frequency using applicable generic and plant- or design-specific data representative of current design and performance, unless adequate plant-specific data exists.
     */
    quantification: Record<string, InitiatingEventQuantification>;
    
    /**
     * Screening criteria used to exclude initiating events
     * @remarks **IE-B7**: SCREEN OUT initiating events if they meet defined criteria
     */
    screening_criteria: InitiatingEventScreeningCriteria;
    
    /**
     * Risk insights from the analysis
     */
    insights: {
        key_assumptions: string[];
        sensitivityStudies: Record<string, SensitivityStudy>;
        dominant_contributors: string[];
        uncertainty_drivers: string[];
    };
    
    /**
     * Documentation of the Initiating Event Analysis process.
     * @remarks **HLR-IE-D**: The documentation of the Initiating Event Analysis shall provide traceability of the work.
     * @remarks **IE-D1**: DOCUMENT the process used in the Initiating Event Analysis specifying what is used as input, the applied methods, and the results.
     */
    documentation?: InitiatingEventDocumentation;
    
    /**
     * Peer review documentation
     * @remarks **HLR-IE-D**: The documentation of the Initiating Event Analysis shall provide traceability of the work.
     */
    peer_review?: PeerReviewDocumentation;
    
    /**
     * Pre-operational assumptions and limitations
     * @remarks **IE-D3**: For PRAs performed during the pre-operational stage, DOCUMENT assumptions and limitations due to the lack of as-built, as-operated details...
     */
    pre_operational_assumptions?: PreOperationalAssumptions[];
}

/**
 * Interface representing hazard analysis that may induce initiating events
 * @remarks **IE-A6**: When identifying initiating events caused by internal or external hazards, INCLUDE initiating events caused by a combination of hazards
 * @group API
 */
export interface HazardAnalysis extends Unique, Named {
    /** Description of the hazard */
    description: string;
    
    /** Type of hazard (internal or external) */
    hazard_type: "INTERNAL" | "EXTERNAL";
    
    /** Hazard subcategory (e.g., "SEISMIC", "FLOOD", "FIRE") */
    subcategory: string;
    
    /** Hazard severity levels considered */
    severity_levels: string[];
    
    /** Plant areas or locations affected */
    affected_areas: string[];
    
    /** Radionuclide barriers considered in the analysis */
    radionuclide_barriers: Record<string, RadionuclideBarrier>;
    
    /** Potential inducing mechanisms for initiating events */
    inducing_mechanisms: string[];
    
    /** Initiating events that may be induced by this hazard */
    induced_initiating_events: string[];
    
    /** Other hazards that may combine with this one */
    potential_combinations: string[];
    
    /** Analysis methods used */
    analysis_methods: string[];
    
    /** Screening status and basis */
    screening: {
        status: ScreeningStatus;
        basis: string;
    };
}

/**
 * Runtime validation functions for InitiatingEventsAnalysis
 * @group API
 */
export const validateInitiatingEventsAnalysis = {
    validateFrequency: (event: InitiatorDefinition): string[] => {
        const errors: string[] = [];
        if (event.frequency < 0) {
            errors.push(`Initiating event frequency for ${event.name} (${event.id}) cannot be negative.`);
        }
        return errors;
    },
    
    validateGroupConsistency: (analysis: InitiatingEventsAnalysis): string[] => {
        const errors: string[] = [];
        // Check if all initiators referenced in groups exist
        Object.entries(analysis.initiating_event_groups).forEach(([groupId, group]) => {
            for (const memberId of group.member_ids) {
                if (!(memberId in analysis.initiators)) {
                    errors.push(`Group ${groupId} references non-existent initiator ${memberId}`);
                }
            }
            
            // Check if bounding initiator exists and is a member of the group
            if (!(group.bounding_initiator_id in analysis.initiators)) {
                errors.push(`Group ${groupId} has non-existent bounding initiator ${group.bounding_initiator_id}`);
            } else if (!group.member_ids.includes(group.bounding_initiator_id)) {
                errors.push(`Bounding initiator ${group.bounding_initiator_id} is not a member of group ${groupId}`);
            }
        });
        return errors;
    },
    
    validateOperatingStates: (analysis: InitiatingEventsAnalysis): string[] => {
        const errors: string[] = [];
        // Check if all initiators have at least one operating state
        Object.entries(analysis.initiators).forEach(([id, initiator]) => {
            if (initiator.operating_states.length === 0) {
                errors.push(`Initiator ${id} has no operating states defined`);
            }
        });
        return errors;
    },
    
    validateApplicableStates: (analysis: InitiatingEventsAnalysis): string[] => {
        const errors: string[] = [];
        // Check if all referenced plant operating states are included in applicable_plant_operating_states
        Object.entries(analysis.initiators).forEach(([id, initiator]) => {
            if (initiator.applicableStates) {
                for (const stateId of initiator.applicableStates) {
                    if (!analysis.applicable_plant_operating_states.includes(stateId)) {
                        errors.push(`Initiator ${id} references non-applicable plant operating state ${stateId}`);
                    }
                }
            }
        });
        return errors;
    },
    
    validateScreening: (analysis: InitiatingEventsAnalysis): string[] => {
        const errors: string[] = [];
        // Check if all screened out events have proper documentation
        for (const screenedEvent of analysis.screening_criteria.screened_out_events) {
            if (!screenedEvent.justification) {
                errors.push(`Screened out event ${screenedEvent.event_id} has no justification`);
            }
            
            // Check if the screened out event exists
            if (!(screenedEvent.event_id in analysis.initiators)) {
                errors.push(`Screened out event ${screenedEvent.event_id} is not defined in initiators`);
            }
        }
        return errors;
    },
    
    validateCompleteness: (analysis: InitiatingEventsAnalysis): string[] => {
        const errors: string[] = [];
        // Check if all categories from IE-A5 are represented
        const categories = new Set(Object.values(analysis.initiators).map(ie => ie.category));
        const requiredCategories = [
            InitiatingEventCategory.TRANSIENT,
            InitiatingEventCategory.RCB_BREACH,
            InitiatingEventCategory.INTERFACING_SYSTEMS_RCB_BREACH
        ];
        
        for (const requiredCategory of requiredCategories) {
            if (!categories.has(requiredCategory)) {
                errors.push(`Required initiating event category ${requiredCategory} is not represented`);
            }
        }
        return errors;
    }
};

/**
 * JSON schema for validating {@link InitiatingEventsAnalysis} entities.
 * Includes both type-level and runtime validations.
 *
 * @example
 * ```typescript
 * // Type-level validation (compile time)
 * const analysis: InitiatingEventsAnalysis = { ... };
 *
 * // Runtime validation
 * const schema = InitiatingEventsAnalysisSchema;
 * const validationResult = schema.validateSync(analysis);
 * if (!validationResult.success) {
 *   console.error(validationResult.errors);
 * }
 *
 * // Additional runtime checks
 * const frequencyErrors = validateInitiatingEventsAnalysis.validateFrequency(someInitiator);
 * const groupingErrors = validateInitiatingEventsAnalysis.validateGroupConsistency(analysis);
 * const operatingStateErrors = validateInitiatingEventsAnalysis.validateOperatingStates(analysis);
 * 
 * if (frequencyErrors.length > 0 || groupingErrors.length > 0 || operatingStateErrors.length > 0) {
 *   console.error("Validation errors found:", {
 *     frequencyErrors,
 *     groupingErrors,
 *     operatingStateErrors
 *   });
 * }
 * ```
 * @group API
 */
export const InitiatingEventsAnalysisSchema = typia.json.application<[InitiatingEventsAnalysis], "3.0">();

// List of interfaces that are dependent on the IE technical element file:
/**
 * - {@link EventSequence} (in `event_sequence_analysis.ts`): An event sequence will have a reference to an `InitiatingEvent`.
 */

// List of other technical elements that need to import this typescript file for IE:
/**
 * - `event_sequence_analysis.ts`: To reference the `InitiatingEvent` that starts an event sequence
 */