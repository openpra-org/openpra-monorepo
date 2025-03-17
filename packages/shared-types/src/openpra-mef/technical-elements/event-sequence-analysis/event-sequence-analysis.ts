/**
 * @module event_sequence_analysis
 * @description Comprehensive types and interfaces for Event Sequence Analysis (ES)
 * 
 * The objectives of Event Sequence Analysis ensure that:
 * - (a) the sources of radioactive material, the barriers to radionuclide release, and the safety 
 *       functions necessary to protect each barrier for each source within the scope of the PRA 
 *       model are defined as a basis for the event sequence model development and described for 
 *       each plant operating state;
 * - (b) plant-, design- and site-specific dependencies that impact significant event sequences 
 *       are represented in the event sequence structure;
 * - (c) individual function successes, mission times, and time windows for operator actions for 
 *       each reactor-specific safety function and release phenomenon modeled in the event 
 *       sequences are accounted for;
 * - (d) the Event Sequence Analysis is documented to provide traceability of the work.
 * 
 * Per RG 1.247, the objective of the event sequence analysis PRA element is to model 
 * chronologically (to the extent practical) the different possible progressions of events 
 * (i.e., event sequences) that can occur from the start of the initiating event to either 
 * successful mitigation or release.
 * 
 * @preferred
 * @category Technical Elements
 */

import typia, { tags } from "typia";    
import { TechnicalElement, TechnicalElementTypes } from "../technical-element";
import { Named, Unique } from "../core/meta";
import { InitiatingEvent, BaseEvent, Frequency, FrequencyUnit } from "../core/events";
import { IdPatterns, ImportanceLevel, SensitivityStudy, ScreeningStatus, ScreeningCriteria } from "../core/shared-patterns";
import { PlantOperatingState } from "../plant-operating-states-analysis/plant-operating-states-analysis";
import { DistributionType } from "../data-analysis/data-analysis";
import { 
    SuccessCriteriaId, 
    SuccessCriterion, 
    OverallSuccessCriteriaDefinition,
    SystemSuccessCriteriaDefinition,
    ComponentSuccessCriteriaDefinition,
    HumanActionSuccessCriteriaDefinition
} from "../success-criteria/success-criteria-development";
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
 * The possible end states for an event sequence.
 * These represent the final outcome of an event sequence progression.
 * @group Core Definitions & Enums
 */
export enum EndState {
    /** Successful prevention of radioactive material release */
    SUCCESSFUL_MITIGATION = "SUCCESSFUL_MITIGATION",
    
    /** Release of radioactive material occurred */
    RADIONUCLIDE_RELEASE = "RADIONUCLIDE_RELEASE"
}

/**
 * The types of dependencies that can exist between systems, components, or operator actions.
 * @group Core Definitions & Enums
 */
export enum DependencyType {
    /** Functional dependency where one system requires another to operate */
    FUNCTIONAL = "FUNCTIONAL",
    
    /** Physical dependency based on physical connections or shared environment */
    PHYSICAL = "PHYSICAL",
    
    /** Dependency on human actions */
    HUMAN = "HUMAN",
    
    /** Dependency based on operational procedures or practices */
    OPERATIONAL = "OPERATIONAL",
    
    /** Dependency based on physical phenomena */
    PHENOMENOLOGICAL = "PHENOMENOLOGICAL",
    
    /** Dependency based on shared or common components */
    COMMON_CAUSE = "COMMON_CAUSE"
}

/**
 * Type for system references.
 * Format: SYS-[NAME]
 * Example: SYS-RCIC
 * @group Core Definitions & Enums
 */
export type SystemReference = string & tags.Pattern<typeof IdPatterns.SYSTEM_ID>;

/**
 * Type for human action references.
 * Format: HRA-[NUMBER]
 * Example: HRA-001
 * @group Core Definitions & Enums
 */
export type HumanActionReference = string & tags.Pattern<typeof IdPatterns.HUMAN_ACTION_ID>;

/**
 * Type for source term references.
 * Format: ST-[NUMBER]
 * Example: ST-001
 * @group Core Definitions & Enums
 */
export type SourceTermReference = string & tags.Pattern<typeof IdPatterns.SOURCE_TERM_ID>;

/**
 * Type for release category references.
 * Format: RC-[NUMBER]
 * Example: RC-001
 * @group Core Definitions & Enums
 */
export type ReleaseCategoryReference = string & tags.Pattern<typeof IdPatterns.RELEASE_CATEGORY_ID>;

/**
 * Type for event sequence references.
 * Format: ES-[NUMBER]
 * Example: ES-001
 * @group Core Definitions & Enums
 */
export type EventSequenceReference = string & tags.Pattern<typeof IdPatterns.EVENT_SEQUENCE_ID>;

/**
 * Type for event sequence family references.
 * Format: ESF-[NUMBER]
 * Example: ESF-001
 * @group Core Definitions & Enums
 */
export type EventSequenceFamilyReference = string & tags.Pattern<typeof IdPatterns.EVENT_SEQUENCE_FAMILY_ID>;

/**
 * Type for representing the status of a system in an event sequence.
 * @group Core Definitions & Enums
 */
export type SystemStatus = "SUCCESS" | "FAILURE";

/**
 * Type for sequence designator IDs.
 * @group Core Definitions & Enums
 */
export type SequenceDesignatorId = string;

//==============================================================================
/**
 * @group Event Sequences & Progression
 * @description Event sequence interfaces and types, chronological progression representation
 * @implements HLR-ES-A, HLR-ES-B, HLR-ES-C
 */
//==============================================================================

/**
 * Interface representing a time window for operator actions.
 * Used to define the available time for human actions in event sequences.
 * @group Event Sequences & Progression
 */
export interface TimeWindow {
    /** Start time for the action (hours after initiating event) */
    startTime: number & tags.Minimum<0>;
    
    /** End time for the action (hours after initiating event) */
    endTime: number & tags.Minimum<0>;
    
    /** Description of the time window */
    description?: string;
    
    /** Basis for the time window calculation */
    basis?: string;
    
    /** References to deterministic analyses supporting the time window */
    deterministicAnalysisReferences?: string[];
}

/**
 * Interface representing timing information for key events in a sequence.
 * @group Event Sequences & Progression
 * @implements ES-A8: INCLUDE individual function successes, mission times, and time windows
 */
export interface SequenceTiming extends Unique {
    /** Event name or description */
    event: string;
    
    /** Time after initiating event (hours) */
    timeAfterInitiator: number & tags.Minimum<0>;
    
    /** Duration or mission time if applicable (hours) */
    duration?: number & tags.Minimum<0>;
    
    /** Time window for operator actions if applicable */
    timeWindow?: TimeWindow;
    
    /** Basis for the timing information */
    basis?: string;
    
    /** References to deterministic analyses supporting the timing */
    deterministicAnalysisReferences?: string[];
    
    /** Uncertainty in timing (hours) */
    uncertaintyRange?: [number & tags.Minimum<0>, number & tags.Minimum<0>];
}

/**
 * Interface representing a dependency between systems, components, or operator actions.
 * Used to define the relationships and dependencies in event sequences.
 * @group Event Sequences & Progression
 * @implements ES-B1: DEVELOP event sequence models including functional, phenomenological, and operational dependencies
 */
export interface Dependency extends Unique {
    /** Element that depends on another element */
    dependentElement: SystemReference | HumanActionReference;
    
    /** Element that is depended upon */
    dependedUponElement: SystemReference | HumanActionReference;
    
    /** Type of dependency */
    dependencyType: DependencyType;
    
    /** Description of the dependency */
    description: string;
    
    /** Basis for the dependency */
    basis?: string;
    
    /** Applicable plant operating states */
    applicablePlantOperatingStates?: string[];
    
    /** Applicable initiating events */
    applicableInitiatingEvents?: string[];
    
    /** Importance level of the dependency */
    importanceLevel?: ImportanceLevel;
}

/**
 * Interface representing a phenomenological impact in an event sequence.
 * @group Event Sequences & Progression
 * @implements ES-B1: DEVELOP event sequence models including phenomenological dependencies
 * @implements ES-C2: DELINEATE event sequences to account for significant phenomenological conditions
 */
export interface PhenomenologicalImpact extends Unique, Named {
    /** Description of the impact */
    description: string;
    
    /** Affected systems or components */
    affectedElements: (SystemReference | HumanActionReference)[];
    
    /** Timing of the impact (hours after initiating event) */
    timing?: number & tags.Minimum<0>;
    
    /** Duration of the impact (hours) */
    duration?: number & tags.Minimum<0>;
    
    /** Deterministic analyses supporting the impact characterization */
    deterministicAnalysisReferences?: string[];
    
    /** Applicable plant operating states */
    applicablePlantOperatingStates?: string[];
    
    /** Applicable initiating events */
    applicableInitiatingEvents?: string[];
    
    /** Importance level of the impact */
    importanceLevel?: ImportanceLevel;
}

/**
 * Interface representing an intermediate end state in an event sequence.
 * Used to reduce the size and complexity of individual event trees by providing
 * transfer points between event trees.
 * 
 * @group Event Sequences & Progression
 * @implements ES-A13: Intermediate end states and/or transfers between or among event trees
 */
export interface IntermediateEndState extends Unique, Named {
    /** Description of the intermediate end state */
    description: string;
    
    /** Reference to the event tree to transfer to */
    transferToEventTree?: string;
    
    /** Reference to the event sequence or family this intermediate state belongs to */
    parentSequenceId?: EventSequenceReference;
    
    /** Reference to the event sequence family this intermediate state belongs to */
    parentSequenceFamilyId?: EventSequenceFamilyReference;
    
    /** 
     * Plant conditions at this intermediate state 
     * Uses minimal concepts from Plant Operating States Analysis
     */
    plantConditions: {
        /** 
         * Operating mode at this intermediate state 
         * Reuses OperatingState from Plant Operating States
         */
        operatingMode?: "POWER" | "STARTUP" | "SHUTDOWN" | "REFUELING" | "MAINTENANCE";
        
        /** Key plant parameters that define this intermediate state */
        keyParameters: Record<string, string | number>;
        
        /** System statuses at this intermediate state */
        systemStatuses?: Record<SystemReference, SystemStatus>;
        
        /** 
         * Barrier statuses at this intermediate state 
         * Reuses BarrierStatus values from Plant Operating States
         */
        barrierStatuses?: Record<string, "INTACT" | "BREACHED" | "DEGRADED" | "BYPASSED" | "OPEN">;
        
        /** References to success criteria applicable at this state */
        successCriteriaIds?: SuccessCriteriaId[];
    };
    
    /** Conditions that trigger the transfer to another event tree */
    transferConditions?: {
        /** Description of the condition */
        description: string;
        
        /** Logic expression representing the condition */
        logicExpression?: string;
        
        /** References to events that trigger the transfer */
        triggeringEvents?: string[];
    };
    
    /** Dependencies that must be preserved when transferring */
    preservedDependencies: {
        /** Functional dependencies to preserve */
        functional?: string[];
        
        /** System dependencies to preserve */
        system?: SystemReference[];
        
        /** Initiating event dependencies to preserve */
        initiatingEvent?: string[];
        
        /** Operator action dependencies to preserve */
        operator?: HumanActionReference[];
        
        /** Phenomenological dependencies to preserve */
        phenomenological?: string[];
        
        /** Spatial or environmental dependencies to preserve */
        spatial?: string[];
    };
    
    /** References to supporting analyses */
    supportingAnalysisReferences?: string[];
}

/**
 * Interface representing an event sequence.
 * An event sequence is a chronological progression of events from the initiating event
 * to a specified end state.
 * @group Event Sequences & Progression
 * @extends {Unique}
 * @extends {Named}
 * @implements ES-A6: IDENTIFY event sequences that should be explicitly modeled
 * @implements ES-A7: IDENTIFY event sequences that can be screened on the basis of low probability or frequency
 */
export interface EventSequence extends Unique, Named {
    /** Description of the event sequence */
    description?: string;
    
    /** Reference to the initiating event that starts this sequence */
    initiatingEventId: string;
    
    /** Reference to the plant operating state in which this sequence occurs */
    plantOperatingStateId: string;
    
    /** Design information supporting this event sequence */
    designInformation?: EventSequenceDesignInformation[];
    
    /** Chronological progression of events in the sequence */
    progression?: string;
    
    /** Systems involved in the sequence and their status */
    systemResponses?: Record<SystemReference, SystemStatus>;
    
    /** Operator actions involved in the sequence */
    operatorActions?: HumanActionReference[];
    
    /** Timing information for key events in the sequence */
    timing?: SequenceTiming[];
    
    /** Dependencies between systems and operator actions in this sequence */
    dependencies?: Dependency[];
    
    /** Phenomenological impacts in this sequence */
    phenomenologicalImpacts?: PhenomenologicalImpact[];
    
    /** Intermediate end states in this sequence */
    intermediateEndStates?: IntermediateEndState[];
    
    /** End state of the sequence */
    endState: EndState;
    
    /** Reference to the event sequence family this sequence belongs to */
    sequenceFamilyId?: EventSequenceFamilyReference;
    
    /** Reference to the release category if the end state is radionuclide release */
    releaseCategoryId?: ReleaseCategoryReference;
    
    /** Success criteria applicable to this sequence */
    successCriteriaIds?: SuccessCriteriaId[];
    
    /** Frequency of the sequence (per unit time) */
    frequency?: {
        /** Mean value of the frequency */
        mean: Frequency;
        
        /** Units of the frequency */
        units: FrequencyUnit;
        
        /** Statistical distribution of the frequency */
        distribution?: DistributionType;
        
        /** Parameters of the distribution */
        distributionParameters?: Record<string, number>;
    };
    
    /** 
     * Screening status of the sequence 
     * @implements ES-A7: IDENTIFY event sequences that can be screened
     */
    screening?: {
        /** Screening status of the sequence */
        status: ScreeningStatus;
        
        /** Basis for screening decision */
        screeningBasis?: string;
        
        /** Justification for screening decision */
        screeningJustification?: string;
    };
    
    /** Assumptions specific to this sequence */
    sequenceSpecificAssumptions?: Assumption[];
}

/**
 * Interface representing a sequence designator.
 * @group Event Sequences & Progression
 */
export interface SequenceDesignator extends Unique {
    /** Sequence designator ID */
    id: SequenceDesignatorId;
    
    /** Associated event sequence reference */
    eventSequenceId: EventSequenceReference;
    
    /** Frequency value associated with this sequence path */
    frequency?: Frequency;
    
    /** Description of this sequence path */
    description?: string;
}

//==============================================================================
/**
 * @group Sequence Families & Release Categories
 * @description Event sequence family definitions, grouping criteria and logic
 * @implements ES-C3, ES-C4, ES-C5, ES-C6
 */
//==============================================================================

/**
 * Interface representing criteria for grouping event sequences into families.
 * @group Sequence Families & Release Categories
 * @implements ES-C3: USE consistent end-state definitions for similar scenarios
 */
export interface GroupingCriteria extends Unique, Named {
    /** Description of the criteria */
    description: string;
    
    /** Basis for the criteria */
    basis?: string;
    
    /** Characteristics considered for grouping */
    characteristicsConsidered: string[];
    
    /** Limitations of the grouping criteria */
    limitations?: string[];
}

/**
 * Interface representing an event sequence family.
 * An event sequence family is a group of event sequences with similar characteristics.
 * @group Sequence Families & Release Categories
 * @extends {Unique}
 * @extends {Named}
 * @implements ES-C3: USE consistent end-state definitions for similar scenarios
 * @implements ES-C4: COMBINE event sequences with similar characteristics (source, POS, initiator)
 * @implements ES-C5: COMBINE event sequences with similar plant response
 * @implements ES-C6: COMBINE event sequences with similar characteristics for source term
 */
export interface EventSequenceFamily extends Unique, Named {
    /** Description of the event sequence family */
    description?: string;
    
    /** Criteria used for grouping sequences into this family */
    groupingCriteriaId: string;
    
    /** Representative initiating event for the family */
    representativeInitiatingEventId: string;
    
    /** Representative plant operating state for the family */
    representativePlantOperatingStateId: string;
    
    /** Representative plant response characteristics */
    representativePlantResponse: string;
    
    /** Reference to the representative source term */
    representativeSourceTermId?: SourceTermReference;
    
    /** References to release categories associated with this family */
    releaseCategoryIds?: ReleaseCategoryReference[];
    
    /** IDs of event sequences that belong to this family */
    memberSequenceIds: EventSequenceReference[];
    
    /** Basis for considering these sequences similar */
    similarityBasis?: string;
    
    /** End state of the sequence family */
    endState: EndState;
    
    /** Mean frequency of the event sequence family */
    frequency?: {
        /** Mean value of the frequency */
        mean: Frequency;
        
        /** Units of the frequency */
        units: FrequencyUnit;
        
        /** Statistical distribution of the frequency */
        distribution?: DistributionType;
        
        /** Parameters of the distribution */
        distributionParameters?: Record<string, number>;
    };
    
    /** Assumptions specific to this family */
    familySpecificAssumptions?: Assumption[];
}

/**
 * Interface representing the mapping of event sequences to release categories.
 * Used to define how event sequences are mapped to release categories for source term analysis.
 * @group Sequence Families & Release Categories
 * @implements ES-C8: MAP each event sequence with a release to a release category
 * @remarks This interface is referenced by the Risk Integration module's EventSequenceToReleaseCategory interface.
 * The Risk Integration module uses this mapping as input for risk calculations.
 */
export interface ReleaseCategoryMapping extends Unique {
    /** References to the event sequences mapped to this release category */
    eventSequenceIds: EventSequenceReference[];
    
    /** Reference to the release category */
    releaseCategoryId: ReleaseCategoryReference;
    
    /** Reference to the source term associated with this release category */
    sourceTermId?: SourceTermReference;
    
    /** Basis for mapping these sequences to this release category */
    mappingBasis: string;
    
    /** Description of the common characteristics */
    commonCharacteristics: string[];
    
    /** References to supporting analyses */
    supportingAnalysisReferences?: string[];
    
    /** 
     * Frequency information for this mapping, if available at this stage.
     * This may be populated during event sequence quantification and used by risk integration.
     */
    frequencyInformation?: {
        /** Mean frequency value */
        mean?: number;
        
        /** Frequency unit */
        units?: FrequencyUnit;
        
        /** Uncertainty in the frequency */
        uncertainty?: {
            /** Distribution type */
            distribution?: DistributionType;
            
            /** Distribution parameters */
            parameters?: Record<string, number>;
        };
    };
    
    /**
     * Flag indicating whether this mapping has been processed by risk integration.
     * Used for traceability between technical elements.
     */
    processedByRiskIntegration?: boolean;
}

//==============================================================================
/**
 * @group Dependencies & Phenomenology
 * @description Dependencies between systems, components, and operator actions
 * @implements ES-B1, ES-B2, ES-B3, ES-B4
 */
//==============================================================================

/**
 * Interface representing a functional dependency model.
 * Used to define and document functional dependencies between systems.
 * @group Dependencies & Phenomenology
 * @implements ES-B1: DEVELOP event sequence models including functional dependencies
 */
export interface FunctionalDependencyModel extends Unique, Named {
    /** Description of the dependency model */
    description: string;
    
    /** Systems involved in the functional dependency */
    involvedSystems: SystemReference[];
    
    /** Specific dependencies modeled */
    dependencies: Dependency[];
    
    /** Logic model representation (e.g., fault tree, event tree) */
    logicModel?: string;
    
    /** References to supporting analyses */
    supportingAnalysisReferences?: string[];
}

/**
 * Interface representing a phenomenological dependency model.
 * Used to define and document dependencies based on physical phenomena.
 * @group Dependencies & Phenomenology
 * @implements ES-B1: DEVELOP event sequence models including phenomenological dependencies
 */
export interface PhenomenologicalDependencyModel extends Unique, Named {
    /** Description of the phenomenological dependency */
    description: string;
    
    /** Physical phenomenon causing the dependency */
    phenomenon: string;
    
    /** Systems affected by the phenomenon */
    affectedSystems: SystemReference[];
    
    /** Environmental conditions involved */
    environmentalConditions?: string[];
    
    /** Specific impacts on each affected system */
    systemSpecificImpacts?: Record<SystemReference, string>;
    
    /** References to deterministic analyses supporting the dependency model */
    deterministicAnalysisReferences?: string[];
}

/**
 * Interface representing an operational dependency model.
 * Used to define and document dependencies based on operational practices.
 * @group Dependencies & Phenomenology
 * @implements ES-B1: DEVELOP event sequence models including operational dependencies
 */
export interface OperationalDependencyModel extends Unique, Named {
    /** Description of the operational dependency */
    description: string;
    
    /** Operational practice or procedure causing the dependency */
    operationalPractice: string;
    
    /** Systems affected by the operational practice */
    affectedSystems: SystemReference[];
    
    /** Human actions involved in the operational dependency */
    involvedHumanActions?: HumanActionReference[];
    
    /** References to procedures or operating instructions */
    procedureReferences?: string[];
}

/**
 * Interface representing a human dependency model.
 * Used to define and document dependencies involving human actions.
 * @group Dependencies & Phenomenology
 * @implements ES-B1: DEVELOP event sequence models including dependencies
 */
export interface HumanDependencyModel extends Unique, Named {
    /** Description of the human dependency */
    description: string;
    
    /** Human actions involved in the dependency */
    involvedHumanActions: HumanActionReference[];
    
    /** Systems affected by the human actions */
    affectedSystems?: SystemReference[];
    
    /** Type of dependency between human actions */
    dependencyType: string;
    
    /** References to human reliability analyses */
    hraReferences?: string[];
}

/**
 * Interface representing an interface dependency between systems.
 * @group Dependencies & Phenomenology
 * @implements ES-B2: IDENTIFY interfaces between event sequence models
 */
export interface SystemInterfaceDependency extends Unique, Named {
    /** Description of the interface dependency */
    description: string;
    
    /** Systems involved in the interface */
    involvedSystems: SystemReference[];
    
    /** Type of interface (physical, functional, operational) */
    interfaceType: "PHYSICAL" | "FUNCTIONAL" | "OPERATIONAL";
    
    /** Specific connection points or interfaces */
    connectionPoints?: string[];
    
    /** How the interface is modeled in event sequences */
    modelingApproach: string;
}

/**
 * Interface representing an assumption made in the event sequence analysis.
 * @group Documentation & Traceability
 * @implements ES-A15: IDENTIFY assumptions made due to lack of as-built and as-operated details
 */
export interface Assumption extends BaseAssumption {
    // Additional properties specific to event sequence analysis assumptions can be added here
}

/**
 * Interface representing a source of model uncertainty in the event sequence analysis.
 * @group Documentation & Traceability
 * @implements ES-A14: IDENTIFY and characterize the sources of model uncertainty
 * @implements ES-B9: IDENTIFY and characterize sources of model uncertainty
 * @implements ES-C10: IDENTIFY and characterize sources of model uncertainty
 */
export interface ModelUncertainty extends Unique, Named {
    /** Description of the model uncertainty */
    description: string;
    
    /** Aspects of the analysis affected by this uncertainty */
    affectedAspects?: ("eventSequenceDefinition" | "dependencies" | "releasePhenomena")[];
    
    /** Assumptions related to this uncertainty */
    assumptions?: Assumption[];
    
    /** Reasonable alternatives that could be considered */
    reasonableAlternatives?: string[];
    
    /** Potential impact on the analysis results */
    impact?: string;
    
    /** Plans to address or reduce this uncertainty */
    addressingPlans?: string;
    
    /** Characterization of the uncertainty (qualitative or quantitative) */
    characterization?: {
        /** Type of characterization */
        type: "QUALITATIVE" | "QUANTITATIVE";
        
        /** Description of the characterization */
        description: string;
        
        /** Range or bounds of the uncertainty if quantitative */
        range?: [number, number];
    };
}

/**
 * Interface representing documentation of the process used in the event sequence analysis.
 * @group Documentation & Traceability
 * @implements ES-D1: DOCUMENT the process used in the Event Sequence Analysis
 */
export interface ProcessDocumentation extends BaseProcessDocumentation {
    /** 
     * Linkage between plant operating states, initiating events, and event sequences
     * @implements ES-D1(a): the linkage between the modeled plant operating states, initiating events, and event sequences
     */
    posInitiatorSequenceLinkage?: {
        /** Plant operating state ID */
        plantOperatingStateId: string;
        
        /** Initiating event ID */
        initiatingEventId: string;
        
        /** Event sequence IDs for this combination */
        eventSequenceIds: EventSequenceReference[];
        
        /** Description of the linkage */
        description?: string;
    }[];
    
    /** 
     * Success criteria established for each modeled initiating event
     * @implements ES-D1(b): the success criteria established for each modeled initiating event
     */
    successCriteriaBases?: {
        /** Initiating event ID */
        initiatingEventId: string;
        
        /** Success criteria ID */
        successCriteriaId: SuccessCriteriaId;
        
        /** Basis for the success criteria */
        basis: string;
        
        /** System capacities required */
        systemCapacitiesRequired: string;
        
        /** Components required to achieve these capacities */
        requiredComponents: string;
    }[];
    
    /** 
     * Deterministic analyses performed to support the event sequence analysis
     * @implements ES-D1(c): each deterministic analysis performed to support the Event Sequence Analysis
     */
    deterministicAnalyses?: {
        /** Analysis ID or reference */
        analysisId: string;
        
        /** Description of the analysis */
        description: string;
        
        /** Purpose of the analysis */
        purpose: string;
        
        /** Key results and insights */
        results: string;
        
        /** How the analysis was used in event sequence development */
        applicationInEventSequences: string;
    }[];
    
    /** 
     * Description of event sequences or groups of similar sequences
     * @implements ES-D1(d): a description of the event sequence for each sequence or group of similar sequences
     */
    eventSequenceDescriptions?: {
        /** Event sequence or family ID */
        sequenceOrFamilyId: string;
        
        /** Sequence timing information */
        timing: string;
        
        /** Applicable procedural guidance */
        proceduralGuidance: string;
        
        /** Expected environmental or phenomenological impacts */
        environmentalImpacts: string;
        
        /** Dependencies between systems and operator actions */
        dependencies: string;
        
        /** End states */
        endStates: string;
        
        /** Other pertinent information */
        otherPertinentInformation?: string;
        
        /** Evaluation of uncertainties */
        uncertaintyEvaluation?: string;
    }[];
    
    /** 
     * Technical basis for the treatment of radionuclide transport barriers
     * @implements ES-D1(e): the technical basis for the treatment of each of the radionuclide transport barriers
     */
    barrierTreatmentBasis?: {
        /** Barrier ID or name */
        barrierId: string;
        
        /** Event sequence family */
        eventSequenceFamilyId: EventSequenceFamilyReference;
        
        /** Fuel capabilities credited */
        fuelCapabilitiesCredited: string;
        
        /** Structural capabilities credited */
        structuralCapabilitiesCredited: string;
        
        /** Barrier capacities credited */
        barrierCapacitiesCredited: string;
        
        /** Basis for assignment of end states */
        endStateAssignmentBasis: string;
    }[];
    
    /** 
     * Evaluation of failure modes and degradation mechanisms
     * @implements ES-D1(f): the evaluation of failure modes, failure and degradation mechanisms
     */
    failureModeEvaluation?: {
        /** Barrier or system ID */
        barrierId: string;
        
        /** Failure modes evaluated */
        failureModes: string[];
        
        /** Degradation mechanisms considered */
        degradationMechanisms: string[];
        
        /** Loading conditions evaluated */
        loadingConditions: string[];
        
        /** Assessment of capability to withstand loads */
        loadCapabilityAssessment: string;
        
        /** Impacts of modeling uncertainties */
        uncertaintyImpacts: string;
    }[];
    
    /** 
     * Definition of event sequence end states, families, and release categories
     * @implements ES-D1(g): a clear definition of the event sequence end states, event sequence families, and release categories
     */
    endStateAndFamilyDefinitions?: {
        /** End state or family ID */
        id: string;
        
        /** Definition of the end state or family */
        definition: string;
        
        /** Detail provided for determining event sequence family */
        familyDeterminationDetail: string;
        
        /** Release category identification */
        releaseCategoryId?: ReleaseCategoryReference;
        
        /** Mechanistic source term information */
        mechanisticSourceTermId?: SourceTermReference;
    }[];
    
    /** 
     * Operator actions represented in the event trees
     * @implements ES-D1(h): the operator actions represented in the event trees
     */
    operatorActionsRepresentation?: {
        /** Human action ID */
        humanActionId: HumanActionReference;
        
        /** Sequence-specific timing */
        timing: string;
        
        /** Dependencies traceable to human reliability analysis */
        hraDependencies: string;
    }[];
    
    /** 
     * Interface of event sequence models with release categories
     * @implements ES-D1(i): the interface of the event sequence models with the release categories
     */
    releaseInterfaceDescription?: {
        /** Description of the interface */
        description: string;
        
        /** How event sequences map to release categories */
        mappingApproach: string;
        
        /** How mechanistic source terms are assigned */
        sourceTermAssignment: string;
    };
    
    /** 
     * Use of single top event fault tree approach
     * @implements ES-D1(j): the manner in which the requirements for Event Sequence Analysis has been satisfied
     */
    singleTopEventApproach?: {
        /** Whether a single top event fault tree is used */
        useSingleTopEvent: boolean;
        
        /** Description of the approach */
        approachDescription?: string;
        
        /** How requirements are satisfied */
        requirementsSatisfactionDescription?: string;
    };
    
    /** 
     * Mitigating systems challenged by initiating events
     * @implements ES-D1(k): mitigating systems that are challenged, degraded, or failed by each specific initiating event
     */
    mitigatingSystemChallenges?: {
        /** Initiating event ID */
        initiatingEventId: string;
        
        /** Challenged systems */
        challengedSystems: Record<SystemReference, string>;
        
        /** Impact on the system */
        systemImpact: string;
    }[];
    
    /** 
     * Dependence of mitigating systems on other functions
     * @implements ES-D1(l): the dependence of modeled mitigating systems on the success or failure of preceding system's functions and human actions
     */
    mitigatingSystemDependencies?: {
        /** Mitigating system ID */
        mitigatingSystemId: SystemReference;
        
        /** Dependencies on other systems */
        systemDependencies: SystemReference[];
        
        /** Dependencies on human actions */
        humanActionDependencies: HumanActionReference[];
        
        /** Description of dependencies */
        dependencyDescription: string;
    }[];

    /**
     * Methodology details for the event sequence analysis
     * @implements ES-D1(m): the methodology details for the event sequence analysis
     */
    methodologyDetails?: {
        approachDescription: string;
        modelingTechniques: string[];
        toolsUsed: string[];
        validationApproach: string;
        conformanceToStandards?: string[];
    };
}

/**
 * Interface representing documentation of model uncertainty in the event sequence analysis.
 * @group Documentation & Traceability
 * @implements ES-D2: DOCUMENT the sources of model uncertainty, related assumptions, and reasonable alternatives
 */
export interface ModelUncertaintyDocumentation extends BaseModelUncertaintyDocumentation {
    /** 
     * Event sequence specific uncertainty impacts
     * @implements ES-D2: DOCUMENT the sources of model uncertainty specific to event sequences
     */
    eventSequenceSpecificUncertainties?: {
        /** Event sequence ID */
        eventSequenceId: EventSequenceReference;
        
        /** Specific uncertainties for this sequence */
        uncertainties: string[];
        
        /** Impact on sequence outcomes */
        sequenceImpact: string;
    }[];
}

/**
 * Interface representing documentation of pre-operational assumptions.
 * @group Documentation & Traceability
 * @implements ES-D3: DOCUMENT assumptions and limitations due to lack of as-built, as-operated details
 */
export interface PreOperationalAssumptionsDocumentation extends BasePreOperationalAssumptionsDocumentation {
    /** 
     * Event sequence specific assumptions
     * @implements ES-D3: DOCUMENT assumptions specific to event sequences
     */
    eventSequenceSpecificAssumptions?: {
        /** Event sequence ID */
        eventSequenceId: EventSequenceReference;
        
        /** Specific assumptions for this sequence */
        assumptions: string[];
        
        /** Impact on sequence modeling */
        modelingImpact: string;
    }[];
}

/**
 * Interface representing peer review documentation.
 * @group Documentation & Traceability
 */
export interface PeerReviewDocumentation extends BasePeerReviewDocumentation {
    /** Consistency with initiating event analysis */
    consistencyWithInitiatingEvents?: string;
    
    /** Reviewer experience specific to event sequence analysis */
    reviewerExperience?: string;
    
    /** Recognition of plant-specific features */
    plantSpecificFeaturesRecognition?: string;

    /**
     * Methodology review for the event sequence analysis
     * @implements ES-D1(n): the methodology review for the event sequence analysis
     */
    methodologyReview?: {
        peerReviewProcess: string;
        qualificationOfReviewers: string[];
        methodologyAssessment: string;
        findingsAndResolutions?: Record<string, string>;
    };
}

/**
 * Interface representing design information specific to event sequences.
 * Used to document the design basis and technical information supporting event sequence development.
 * 
 * @example
 * ```typescript
 * const designInfo: EventSequenceDesignInformation = {
 *   sourceId: "DWG-123",
 *   sourceType: "drawing",
 *   revision: "A",
 *   date: "2025-01-15",
 *   description: "System layout drawing",
 *   requirementId: "ES-001",
 *   standardSection: "4.3.3",
 *   supportedAspects: {
 *     timing: true,
 *     systemDependencies: true,
 *     operatorActions: false,
 *     phenomenologicalImpacts: false,
 *     successCriteria: true
 *   },
 *   applicationInSequence: "Used to determine system layout and physical dependencies",
 *   assumptions: ["Drawing represents as-designed configuration"]
 * };
 * ```
 * 
 * @group Documentation & Traceability
 * @implements ES-D1: DOCUMENT the process used in the Event Sequence Analysis
 */
export interface EventSequenceDesignInformation extends BaseDesignInformation {
    /** 
     * Specific aspects of the event sequence supported by this design information.
     * Indicates which parts of the event sequence this design information is used to support.
     */
    supportedAspects: {
        /** Whether this supports sequence timing (e.g., system response times, mission times) */
        timing?: boolean;
        
        /** Whether this supports system dependencies (e.g., physical connections, shared components) */
        systemDependencies?: boolean;
        
        /** Whether this supports operator actions (e.g., access paths, control locations) */
        operatorActions?: boolean;
        
        /** Whether this supports phenomenological impacts (e.g., environmental conditions, physical phenomena) */
        phenomenologicalImpacts?: boolean;
        
        /** Whether this supports success criteria (e.g., system capabilities, performance requirements) */
        successCriteria?: boolean;
    };
    
    /** 
     * How this design information was used in developing the event sequence.
     * Describes the specific application and relevance of the design information.
     */
    applicationInSequence: string;
    
    /** 
     * Any assumptions or limitations in applying this design information.
     * Documents important considerations when using this design information.
     */
    assumptions?: string[];
}

/**
 * Criteria for screening out event sequences
 * @remarks **ES-A7**: IDENTIFY event sequences that can be screened
 * @group Sequence Families & Release Categories
 */
export interface EventSequenceScreeningCriteria extends ScreeningCriteria {
    /** List of screened-out event sequences */
    screened_out_sequences: {
        /** ID of the screened-out sequence */
        sequence_id: EventSequenceReference;
        
        /** Reason for screening out */
        reason: string;
        
        /** Detailed justification for screening decision */
        justification: string;
    }[];
}

//==============================================================================
/**
 * @group API
 * @description Main interface for Event Sequence Analysis and schema validation
 */
//==============================================================================

/**
 * Interface representing event sequence analysis validation rules.
 * Used to validate the event sequence analysis for completeness and consistency.
 * @group API
 */
export interface EventSequenceValidationRules {
    /**
     * Rules for initiating event coverage validation
     */
    initiatingEventCoverageRules: {
        /** Validation description */
        description: string;
        
        /** Validation method */
        validationMethod: string;
        
        /** Required analysis elements */
        requiredElements: string[];
    };
    
    /**
     * Rules for plant operating state coverage validation
     */
    plantOperatingStateCoverageRules: {
        /** Validation description */
        description: string;
        
        /** Validation method */
        validationMethod: string;
        
        /** Required analysis elements */
        requiredElements: string[];
    };
    
    /**
     * Rules for end state definition validation
     */
    endStateDefinitionRules: {
        /** Validation description */
        description: string;
        
        /** Required end states */
        requiredEndStates: string[];
        
        /** End state definition criteria */
        definitionCriteria: string[];
    };
    
    /**
     * Rules for dependency modeling validation
     */
    dependencyModelingRules: {
        /** Validation description */
        description: string;
        
        /** Dependency types that must be addressed */
        requiredDependencyTypes: string[];
        
        /** Documentation requirements */
        documentationRequirements: string[];
    };
    
    /**
     * Rules for release category mapping validation
     */
    releaseCategoryMappingRules: {
        /** Validation description */
        description: string;
        
        /** Mapping criteria */
        mappingCriteria: string[];
        
        /** Required documentation */
        requiredDocumentation: string[];
    };
}

/**
 * Interface representing the main Event Sequence Analysis container.
 * 
 * The objectives of Event Sequence Analysis ensure that:
 * - (a) the sources of radioactive material, the barriers to radionuclide release, and the safety 
 *       functions necessary to protect each barrier for each source within the scope of the PRA 
 *       model are defined as a basis for the event sequence model development and described for 
 *       each plant operating state;
 * - (b) plant-, design- and site-specific dependencies that impact significant event sequences 
 *       are represented in the event sequence structure;
 * - (c) individual function successes, mission times, and time windows for operator actions for 
 *       each reactor-specific safety function and release phenomenon modeled in the event 
 *       sequences are accounted for;
 * - (d) the Event Sequence Analysis is documented to provide traceability of the work.
 * 
 * @group API
 * @extends {TechnicalElement<TechnicalElementTypes.EVENT_SEQUENCE_ANALYSIS>}
 */
export interface EventSequenceAnalysis extends TechnicalElement<TechnicalElementTypes.EVENT_SEQUENCE_ANALYSIS> {
    /**
     * Additional metadata specific to Event Sequence Analysis
     * @implements ES-D1: DOCUMENT the process used in the Event Sequence Analysis
     */
    additionalMetadata?: {
        /** Traceability information */
        traceability?: string;
    };
    
    /**
     * Definition of the scope of the analysis
     * @implements ES-A1: DELINEATE the plant scenarios addressed in the event sequence analysis
     */
    scopeDefinition: {
        /** Plant operating states included in the analysis */
        plantOperatingStateIds: string[];
        
        /** Initiating events included in the analysis */
        initiatingEventIds: string[];
        
        /** Sources of radioactive material within scope */
        radioactiveMaterialSources: string[];
        
        /** Barriers to radionuclide release */
        radionuclideBarriers: string[];
    };
    
    /**
     * Key safety functions that form the basis for event sequence development
     * @implements ES-A3: DEFINE the key safety functions as a basis for event sequence model development
     */
    keySafetyFunctions: string[];
    
    /**
     * Event sequences analyzed
     * @implements ES-A6: IDENTIFY event sequences that should be explicitly modeled
     */
    eventSequences: Record<EventSequenceReference, EventSequence>;
    
    /**
     * Sequence designators for referencing specific paths through event sequences
     */
    sequenceDesignators?: Record<string, SequenceDesignator>;
    
    /**
     * Event sequence families defined
     * @implements ES-C3: USE consistent end-state definitions for similar scenarios
     * @implements ES-C4: COMBINE event sequences with similar characteristics
     */
    eventSequenceFamilies: Record<EventSequenceFamilyReference, EventSequenceFamily>;
    
    /**
     * Intermediate end states used in the analysis
     * @implements ES-A13: Intermediate end states and/or transfers between or among event trees
     */
    intermediateEndStates?: Record<string, IntermediateEndState>;
    
    /**
     * Mappings of event sequences to release categories
     * @implements ES-C8: MAP each event sequence with a release to a release category
     */
    releaseCategoryMappings?: ReleaseCategoryMapping[];
    
    /**
     * Dependency models used in the analysis
     * @implements ES-B1: DEVELOP event sequence models including functional, phenomenological, and operational dependencies
     */
    dependencyModels?: {
        /** Functional dependency models */
        functionalDependencies?: FunctionalDependencyModel[];
        
        /** Phenomenological dependency models */
        phenomenologicalDependencies?: PhenomenologicalDependencyModel[];
        
        /** Operational dependency models */
        operationalDependencies?: OperationalDependencyModel[];
        
        /** Human dependency models */
        humanDependencies?: HumanDependencyModel[];
        
        /** System interface dependencies */
        systemInterfaces?: SystemInterfaceDependency[];
    };
    
    /**
     * Sources of model uncertainty and related assumptions
     * @implements ES-A14: IDENTIFY and characterize the sources of model uncertainty
     */
    modelUncertainties?: ModelUncertainty[];
    
    /**
     * Sensitivity studies for uncertainty assessment
     * @implements ES-A14: Characterize the sources of model uncertainty
     */
    sensitivityStudies?: SensitivityStudy[];
    
    /**
     * Assumptions made due to lack of as-built, as-operated details
     * @implements ES-A15: IDENTIFY assumptions made due to lack of as-built and as-operated details
     */
    preOperationalAssumptions?: Assumption[];
    
    /**
     * References to supporting plant response analyses
     * @implements ES-A2: IDENTIFY the plant response analyses needed to determine success criteria
     * @implements ES-C7: IDENTIFY the plant response analyses used to develop event sequences and assess success criteria
     */
    plantResponseAnalysisReferences?: string[];
    
    /**
     * Documentation of the analysis
     * @implements ES-D1: DOCUMENT the process used in the Event Sequence Analysis
     * @implements ES-D2: DOCUMENT the sources of model uncertainty, related assumptions, and reasonable alternatives
     * @implements ES-D3: DOCUMENT assumptions and limitations due to lack of as-built, as-operated details
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
         * @implements ES-D: The documentation of the Event Sequence Analysis shall provide traceability of the work
         */
        traceabilityDocumentation?: BaseTraceabilityDocumentation;
    };
    
    /**
     * Validation rules for the analysis
     */
    validationRules?: EventSequenceValidationRules;
    
    /**
     * Screening criteria used to exclude event sequences
     * @implements ES-A7: IDENTIFY event sequences that can be screened
     */
    screening_criteria?: EventSequenceScreeningCriteria;
}

/**
 * JSON schema for validating {@link EventSequenceAnalysis} entities.
 * Provides validation and ensures type safety throughout the application.
 *
 * @group API
 * @example
 * ```typescript
 * const isValid = EventSequenceAnalysisSchema.validate(someData);
 * ```
 */
export const EventSequenceAnalysisSchema = typia.json.application<[EventSequenceAnalysis], "3.0">();