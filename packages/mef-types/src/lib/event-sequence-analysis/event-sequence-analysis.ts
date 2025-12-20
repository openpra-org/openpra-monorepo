/**
 * @module event_sequence_analysis
 * @description Comprehensive types and interfaces for Event Sequence Analysis (ES)
 * 
 * The objectives of Event Sequence Analysis ensure that HLR-ES-A to HLR-ES-D are satisfied.

 * 
 * Per RG 1.247, the objective of the event sequence analysis PRA element is to model 
 * chronologically (to the extent practical) the different possible progressions of events 
 * (i.e., event sequences) that can occur from the start of the initiating event to either 
 * successful mitigation or release.
 * 
 * @preferred
 * @category Technical Elements
 */

import typia, { tags } from 'typia';
import {
  TechnicalElement,
  TechnicalElementTypes,
  TechnicalElementMetadata,
} from '../technical-element';
import { Named, Unique } from '../core/meta';
import {
  InitiatingEvent,
  BaseEvent,
  Frequency,
  FrequencyUnit,
} from '../core/events';
import {
  IdPatterns,
  ImportanceLevel,
  SensitivityStudy,
  ScreeningStatus,
  ScreeningCriteria,
  SuccessCriteriaId,
} from '../core/shared-patterns';
import { PlantOperatingStateReference } from '../initiating-event-analysis/initiating-event-analysis';
import { DistributionType } from '../data-analysis/data-analysis';
import {
  BaseDesignInformation,
  BaseProcessDocumentation,
  BaseModelUncertaintyDocumentation,
  BasePreOperationalAssumptionsDocumentation,
  BasePeerReviewDocumentation,
  BaseTraceabilityDocumentation,
  BaseAssumption,
  PreOperationalAssumption,
} from '../core/documentation';
import { ComponentReference } from '../core/component';
import {
  VersionInfo,
  SCHEMA_VERSION,
  createVersionInfo,
} from '../core/version';

interface SuccessCriterion extends Unique, Named {
  description?: string;
  criteriaText: string[];
  engineeringBasisReferences: string[];
  plantOperatingStateReferences?: string[];
  initiatingEventReferences?: string[];
  endState?: string;
}

interface OverallSuccessCriteriaDefinition extends Unique {
  eventSequenceReference: string;
  description: string;
  criteria: string[];
  endStateParameters: Record<string, string>;
  keySafetyFunctions: string[];
  radionuclideBarriers: string[];
  engineeringBasisReferences: string[];
  applicablePlantOperatingStates?: string[];
  isRiskSignificant?: boolean;
  usesRealisticCriteria?: boolean;
}

interface SystemSuccessCriteriaDefinition extends Unique {
  systemId: string;
  description: string;
  requiredCapacities: {
    parameter: string;
    value: string;
    basis: string;
  }[];
  systemDependencies?: {
    systemId: string;
    description: string;
  }[];
}

interface ComponentSuccessCriteriaDefinition extends Unique {
  componentId: string;
  description: string;
  performanceRequirements: {
    parameter: string;
    value: string;
    basis: string;
  }[];
  dependencies?: {
    componentId: string;
    description: string;
  }[];
}

interface HumanActionSuccessCriteriaDefinition extends Unique {
  humanActionId: string;
  description: string;
  requiredActions: {
    action: string;
    timing: string;
    basis: string;
  }[];
  dependencies?: {
    humanActionId: string;
    description: string;
  }[];
}

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
  SUCCESSFUL_MITIGATION = 'SUCCESSFUL_MITIGATION',

  /** Release of radioactive material occurred */
  RADIONUCLIDE_RELEASE = 'RADIONUCLIDE_RELEASE',
}

/**
 * The types of dependencies that can exist between systems, components, or operator actions.
 * @group Core Definitions & Enums
 */
export enum DependencyType {
  /** Functional dependency where one system requires another to operate */
  FUNCTIONAL = 'FUNCTIONAL',

  /** Physical dependency based on physical connections or shared environment */
  PHYSICAL = 'PHYSICAL',

  /** Dependency on human actions */
  HUMAN = 'HUMAN',

  /** Dependency based on operational procedures or practices */
  OPERATIONAL = 'OPERATIONAL',

  /** Dependency based on physical phenomena */
  PHENOMENOLOGICAL = 'PHENOMENOLOGICAL',

  /** Dependency based on shared or common components */
  COMMON_CAUSE = 'COMMON_CAUSE',
}

/**
 * Type for system references.
 * Format: SYS-[NAME]
 * Example: SYS-RCIC
 * @group Core Definitions & Enums
 */
export type SystemReference = string &
  tags.Pattern<typeof IdPatterns.SYSTEM_ID>;

/**
 * Type for human action references.
 * Format: HRA-[NUMBER]
 * Example: HRA-001
 * @group Core Definitions & Enums
 */
export type HumanActionReference = string &
  tags.Pattern<typeof IdPatterns.HUMAN_ACTION_ID>;

/**
 * Type for source term references.
 * Format: ST-[NUMBER]
 * Example: ST-001
 * @group Core Definitions & Enums
 */
export type SourceTermReference = string &
  tags.Pattern<typeof IdPatterns.SOURCE_TERM_ID>;

/**
 * Type for release category references.
 * Format: RC-[NUMBER]
 * Example: RC-001
 * @group Core Definitions & Enums
 */
export type ReleaseCategoryReference = string &
  tags.Pattern<typeof IdPatterns.RELEASE_CATEGORY_ID>;

/**
 * Type for event sequence references.
 * Format: ES-[NUMBER]
 * Example: ES-001
 * @group Core Definitions & Enums
 */
export type EventSequenceReference = string &
  tags.Pattern<typeof IdPatterns.EVENT_SEQUENCE_ID>;

/**
 * Type for event sequence family references.
 * Format: ESF-[NUMBER]
 * Example: ESF-001
 * @group Core Definitions & Enums
 */
export type EventSequenceFamilyReference = string &
  tags.Pattern<typeof IdPatterns.EVENT_SEQUENCE_FAMILY_ID>;

/**
 * Type for representing the status of a system in an event sequence.
 * @group Core Definitions & Enums
 */
export type SystemStatus = 'SUCCESS' | 'FAILURE';

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
 * @implements ES-A8
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
 * @implements ES-B1
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
 * @implements ES-B1
 * @implements ES-C2
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
 * @implements ES-A13
 */
export interface IntermediateEndState extends Unique, Named {
  /** Description of the intermediate end state */
  description: string;

  /** Reference to the event tree to transfer to */
  transferToEventTree?: string;

  /**
   * Reference to specific branch in the target event tree for the transfer
   * This allows more precise targeting within the destination event tree
   */
  transferToEventTreeBranch?: string;

  /** Reference to the event sequence or family this intermediate state belongs to */
  parentSequenceId?: EventSequenceReference;

  /** Reference to the event sequence family this intermediate state belongs to */
  parentSequenceFamilyId?: EventSequenceFamilyReference;

  /** Reference to the source event tree if this is a transfer point */
  sourceEventTreeId?: string;

  /**
   * Plant conditions at this intermediate state
   * Uses minimal concepts from Plant Operating States Analysis
   */
  plantConditions: {
    /**
     * Operating mode at this intermediate state
     * Reuses OperatingState from Plant Operating States
     */
    operatingMode?:
      | 'POWER'
      | 'STARTUP'
      | 'SHUTDOWN'
      | 'REFUELING'
      | 'MAINTENANCE';

    /** Key plant parameters that define this intermediate state */
    keyParameters: Record<string, string | number>;

    /** System statuses at this intermediate state */
    systemStatuses?: Record<SystemReference, SystemStatus>;

    /**
     * Barrier statuses at this intermediate state
     * Reuses BarrierStatus values from Plant Operating States
     */
    barrierStatuses?: Record<
      string,
      'INTACT' | 'BREACHED' | 'DEGRADED' | 'BYPASSED' | 'OPEN'
    >;

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
 * @implements ES-A6, HLR-ES-D, ES-D1, ES-A7
 *
 * An event sequence is typically modeled using event trees. The relationship between
 * event sequences and event trees is captured through the `eventTreeId` and `eventTreeSequenceId`
 * properties. Each event sequence can be linked to a specific path through an event tree,
 * and the `functionalEventStates` property mirrors the states of functional events in that path.
 * This bidirectional traceability between event sequences and event trees supports the
 * documentation requirements in the ANS standards.
 */
export interface EventSequence extends Unique, Named {
  /** Description of the event sequence */
  description?: string;

  /** Reference to the initiating event that starts this sequence */
  initiatingEventId: string;

  /** Reference to the plant operating state in which this sequence occurs */
  plantOperatingStateId: PlantOperatingStateReference;

  /**
   * Reference to the event tree that models this sequence.
   * This property explicitly links the event sequence to its event tree representation,
   * establishing bidirectional traceability between the sequence and tree models.
   * @implements HLR-ES-D, ES-D1
   */
  eventTreeId?: string;

  /**
   * Reference to the specific sequence within the event tree.
   * This connects the event sequence to a specific path through the event tree,
   * allowing for precise mapping between sequence analysis and event tree models.
   * @implements ES-A6, A-7 and A-10
   */
  eventTreeSequenceId?: string;

  /**
   * The states of functional events for this sequence path.
   * Maps functional event IDs to their states (SUCCESS/FAILURE).
   * This property mirrors the functional event states from the corresponding
   * path in the event tree, ensuring consistency between representations.
   * @implements ES-A6, A-10
   */
  functionalEventStates?: Record<string, 'SUCCESS' | 'FAILURE'>;

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
   * @implements ES-A7
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
 * @implements ES-C3
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
 * @implements ES-C3
 * @implements ES-C4
 * @implements ES-C5
 * @implements ES-C6
 */
export interface EventSequenceFamily extends Unique, Named {
  /** Description of the event sequence family */
  description?: string;

  /** Criteria used for grouping sequences into this family */
  groupingCriteriaId: string;

  /** Representative initiating event for the family */
  representativeInitiatingEventId: string;

  /** Representative plant operating state for the family */
  representativePlantOperatingStateId: PlantOperatingStateReference;

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
 * @implements ES-C8
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
 * @implements ES-B1
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
 * @implements ES-B1
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
 * @implements ES-B1
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
 * @implements ES-B1
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
 * @implements ES-B2
 */
export interface SystemInterfaceDependency extends Unique, Named {
  /** Description of the interface dependency */
  description: string;

  /** Systems involved in the interface */
  involvedSystems: SystemReference[];

  /** Type of interface (physical, functional, operational) */
  interfaceType: 'PHYSICAL' | 'FUNCTIONAL' | 'OPERATIONAL';

  /** Specific connection points or interfaces */
  connectionPoints?: string[];

  /** How the interface is modeled in event sequences */
  modelingApproach: string;
}

/**
 * Interface representing an assumption made in the event sequence analysis.
 * @group Documentation & Traceability
 * @implements ES-A15
 */
export interface Assumption extends BaseAssumption {
  // Additional properties specific to event sequence analysis assumptions can be added here
}

/**
 * Interface representing a source of model uncertainty in the event sequence analysis.
 * @group Documentation & Traceability
 * @implements ES-A14
 * @implements ES-B9
 * @implements ES-C10
 */
export interface ModelUncertainty extends Unique, Named {
  /** Description of the model uncertainty */
  description: string;

  /** Aspects of the analysis affected by this uncertainty */
  affectedAspects?: (
    | 'eventSequenceDefinition'
    | 'dependencies'
    | 'releasePhenomena'
  )[];

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
    type: 'QUALITATIVE' | 'QUANTITATIVE';

    /** Description of the characterization */
    description: string;

    /** Range or bounds of the uncertainty if quantitative */
    range?: [number, number];
  };
}

/**
 * Interface representing documentation of the process used in the event sequence analysis.
 * @group Documentation & Traceability
 * @implements ES-D1
 */
export interface ProcessDocumentation extends BaseProcessDocumentation {
  /**
   * Linkage between plant operating states, initiating events, and event sequences
   * @implements ES-D1(a)
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
   * @implements ES-D1(b)
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
   * @implements ES-D1(c)
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
   * @implements ES-D1(d)
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
   * @implements ES-D1(e)
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
   * @implements ES-D1(f)
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
   * @implements ES-D1(g)
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
   * @implements ES-D1(h)
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
   * @implements ES-D1(i)
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
   * @implements ES-D1(j)
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
   * @implements ES-D1(k)
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
   * @implements ES-D1(l)
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
   * @implements ES-D1(m)
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
 * @implements ES-D2
 */
export interface ModelUncertaintyDocumentation
  extends BaseModelUncertaintyDocumentation {
  /**
   * Event sequence specific uncertainty impacts
   * @implements ES-D2
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
 * @implements ES-D3
 */
export interface PreOperationalAssumptionsDocumentation
  extends BasePreOperationalAssumptionsDocumentation {
  /**
   * Event sequence specific assumptions
   * @implements ES-D3
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
   * @implements ES-D1(n)
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
 * @implements ES-D1
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
 * @remarks **ES-A7**
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
 * @group Event Trees
 * @description Event tree structures for representing event sequence progression
 * @implements ES-A6, ES-B1
 *
 * Event tree interfaces provide a structured way to model event trees, which are a key tool
 * for performing Event Sequence Analysis as required by the ANS standards. They support the
 * definition of event sequences, the consideration of system and operator responses, the
 * handling of dependencies and progression, and the identification of end states.
 */
//==============================================================================

/**
 * Interface representing a functional event in an event tree.
 * Functional events represent the branch points in an event tree.
 * @group Event Trees
 * @implements HLR-ES-A,ES-A4,ES-A5, ES-A12
 */
export interface FunctionalEvent extends Unique, Named {
  /** Unique name/identifier for the functional event */
  name: string;

  /** Optional descriptive label */
  label?: string;

  /** Order/position in the event tree */
  order?: number;

  /** Description of the functional event */
  description?: string;

  /** The system or component this functional event represents */
  systemReference?: SystemReference;

  /** Human action reference if this functional event involves operator action */
  humanActionReference?: HumanActionReference;
}

/**
 * Interface representing a path in an event tree.
 * Paths connect branch points to other branches or end states.
 * @group Event Trees
 * @implements HLR-ES-A, ES-A6, ES-A10
 */
export interface EventTreePath {
  /** State of the path (SUCCESS/FAILURE) */
  state: 'SUCCESS' | 'FAILURE';

  /** Target of the path (could be another branch, sequence, or end state) */
  target: string;

  /** Type of target (BRANCH, SEQUENCE, END_STATE) */
  targetType: 'BRANCH' | 'SEQUENCE' | 'END_STATE';

  /** Optional description of this path */
  description?: string;
}

/**
 * Interface representing a branch in an event tree.
 * Branches contain paths to other branches, sequences, or end states.
 * @group Event Trees
 * @implements HLR-ES-A, ES-A5, ES-B5
 */
export interface EventTreeBranch extends Unique, Named {
  /** Unique name/identifier for the branch */
  name: string;

  /** Optional descriptive label */
  label?: string;

  /** Functional event associated with this branch */
  functionalEventId?: string;

  /** Paths from this branch */
  paths: EventTreePath[];

  /** Instructions or logic for this branch */
  instructions?: string[];
}

/**
 * Interface representing an event tree sequence.
 * Sequences are paths through an event tree leading to an end state.
 * @group Event Trees
 * @implements HLR-ES-A, ES-C1, ES-A6
 */
export interface EventTreeSequence extends Unique, Named {
  /** Unique name/identifier for the sequence */
  name: string;

  /** Optional descriptive label */
  label?: string;

  /** End state reference */
  endState?: EndState | string;

  /** Instructions or logic for this sequence */
  instructions?: string[];

  /** Associated event sequence reference */
  eventSequenceId?: EventSequenceReference;

  /** The states of functional events in this sequence */
  functionalEventStates?: Record<string, 'SUCCESS' | 'FAILURE'>;
}

/**
 * Interface representing an event tree.
 * Event trees model the progression from an initiating event through various
 * system states to different end states.
 * @group Event Trees
 * @implements HLR-ES-A, ES-A6, ES-A7, ES-A13, ES-A8
 */
export interface EventTree extends Unique, Named {
  /** Unique name/identifier for the event tree */
  name: string;

  /** Optional descriptive label */
  label?: string;

  /** Associated initiating event */
  initiatingEventId: string;

  /** Associated plant operating state */
  plantOperatingStateId?: PlantOperatingStateReference;

  /** Functional events that represent branch points in the event tree */
  functionalEvents: Record<string, FunctionalEvent>;

  /** Sequences that represent paths through the event tree */
  sequences: Record<string, EventTreeSequence>;

  /** Branches in the event tree */
  branches: Record<string, EventTreeBranch>;

  /** Initial state that starts the event tree */
  initialState: {
    /** Initial branch ID */
    branchId: string;
  };

  /** Optional transfers to other event trees */
  transfers?: Record<
    string,
    {
      /** Target event tree name */
      targetEventTreeId: string;

      /** Conditions for transfer */
      transferConditions?: string[];

      /** Dependencies to preserve during transfer */
      preservedDependencies?: string[];
    }
  >;

  /** Description of the event tree */
  description?: string;

  /** Mission time for the event tree analysis */
  missionTime?: number;

  /** Units for mission time */
  missionTimeUnits?: string;
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
 * @group API
 * @extends {TechnicalElement<TechnicalElementTypes.EVENT_SEQUENCE_ANALYSIS>}
 */
export interface EventSequenceAnalysis
  extends TechnicalElement<TechnicalElementTypes.EVENT_SEQUENCE_ANALYSIS> {
  /**
   * Additional metadata specific to Event Sequence Analysis
   * @implements ES-D1
   */
  additionalMetadata?: {
    /** Traceability information */
    traceability?: string;
  };

  /**
   * Definition of the scope of the analysis
   * @implements ES-A1
   */
  scopeDefinition: {
    /** Plant operating states included in the analysis */
    plantOperatingStateIds: PlantOperatingStateReference[];

    /** Initiating events included in the analysis */
    initiatingEventIds: string[];

    /** Sources of radioactive material within scope */
    radioactiveMaterialSources: string[];

    /** Barriers to radionuclide release */
    radionuclideBarriers: string[];
  };

  /**
   * Key safety functions that form the basis for event sequence development
   * @implements ES-A3
   */
  keySafetyFunctions: string[];

  /**
   * Event sequences analyzed
   * @implements ES-A6
   */
  eventSequences: Record<EventSequenceReference, EventSequence>;

  /**
   * Sequence designators for referencing specific paths through event sequences
   */
  sequenceDesignators?: Record<string, SequenceDesignator>;

  /**
   * Event sequence families defined
   * @implements ES-C3
   * @implements ES-C4
   */
  eventSequenceFamilies: Record<
    EventSequenceFamilyReference,
    EventSequenceFamily
  >;

  /**
   * Intermediate end states used in the analysis
   * @implements ES-A13
   */
  intermediateEndStates?: Record<string, IntermediateEndState>;

  /**
   * Mappings of event sequences to release categories
   * @implements ES-C8
   */
  releaseCategoryMappings?: ReleaseCategoryMapping[];

  /**
   * Dependency models used in the analysis
   * @implements ES-B1
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
   * @implements ES-A14
   */
  modelUncertainties?: ModelUncertainty[];

  /**
   * Sensitivity studies for uncertainty assessment
   * @implements ES-A14
   */
  sensitivityStudies?: SensitivityStudy[];

  /**
   * Assumptions made due to lack of as-built, as-operated details
   * @implements ES-A15
   */
  preOperationalAssumptions?: Assumption[];

  /**
   * References to supporting plant response analyses
   * @implements ES-A2
   * @implements ES-C7
   */
  plantResponseAnalysisReferences?: string[];

  /**
   * Documentation of the analysis
   * @implements ES-D1
   * @implements ES-D2
   * @implements ES-D3
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
     * @implements ES-D
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

  /**
   * Event trees used in the analysis
   * @implements ES-A6
   */
  eventTrees?: Record<string, EventTree>;
}

/**
 * Runtime validation functions for EventTree structure and relationships
 * @group API
 */
export const validateEventTree = {
  /**
   * Validates the basic structure of an event tree
   * @param eventTree - The EventTree to validate
   * @returns Array of validation error messages
   */
  validateStructure: (eventTree: EventTree): string[] => {
    const errors: string[] = [];

    // Check if initiating event is specified
    if (!eventTree.initiatingEventId) {
      errors.push(`Event tree ${eventTree.name} must have an initiating event`);
    }

    // Check if initial state points to a valid branch
    if (!eventTree.initialState.branchId) {
      errors.push(
        `Event tree ${eventTree.name} must have an initial state branch ID`,
      );
    } else if (!eventTree.branches[eventTree.initialState.branchId]) {
      errors.push(
        `Event tree ${eventTree.name} has invalid initial state branch ID: ${eventTree.initialState.branchId}`,
      );
    }

    // Check if all paths target valid elements
    Object.entries(eventTree.branches).forEach(([branchId, branch]) => {
      branch.paths.forEach((path, index) => {
        const { target, targetType } = path;

        // Check if target exists based on targetType
        if (targetType === 'BRANCH' && !eventTree.branches[target]) {
          errors.push(
            `Branch ${branchId} path ${index} references non-existent branch: ${target}`,
          );
        } else if (targetType === 'SEQUENCE' && !eventTree.sequences[target]) {
          errors.push(
            `Branch ${branchId} path ${index} references non-existent sequence: ${target}`,
          );
        }
        // END_STATE targets don't need to exist within the event tree
      });

      // Check if functional event exists if referenced
      if (
        branch.functionalEventId &&
        !eventTree.functionalEvents[branch.functionalEventId]
      ) {
        errors.push(
          `Branch ${branchId} references non-existent functional event: ${branch.functionalEventId}`,
        );
      }
    });

    // Check for cycles in the event tree structure
    const visited = new Set<string>();
    const stack = new Set<string>();

    const checkForCycles = (branchId: string): boolean => {
      if (stack.has(branchId)) {
        errors.push(
          `Event tree ${eventTree.name} has a cycle involving branch: ${branchId}`,
        );
        return true;
      }

      if (visited.has(branchId)) {
        return false;
      }

      visited.add(branchId);
      stack.add(branchId);

      const branch = eventTree.branches[branchId];
      for (const path of branch.paths) {
        if (path.targetType === 'BRANCH' && checkForCycles(path.target)) {
          return true;
        }
      }

      stack.delete(branchId);
      return false;
    };

    checkForCycles(eventTree.initialState.branchId);

    return errors;
  },

  /**
   * Validates the relationship integrity between event trees and event sequences
   * @param eventTree - The event tree to validate
   * @param sequences - Record of event sequences
   * @returns Array of validation error messages
   */
  validateEventSequenceIntegrity: (
    eventTree: EventTree,
    sequences: Record<EventSequenceReference, EventSequence>,
  ): string[] => {
    const errors: string[] = [];

    // Check for consistency in initiating events
    Object.entries(eventTree.sequences).forEach(([seqId, treeSeq]) => {
      if (treeSeq.eventSequenceId) {
        const eventSeq = sequences[treeSeq.eventSequenceId];

        if (eventSeq) {
          // Validate initiating event consistency
          if (eventSeq.initiatingEventId !== eventTree.initiatingEventId) {
            errors.push(
              `Inconsistent initiating event: Event tree ${eventTree.name} has initiating event ${eventTree.initiatingEventId} but linked sequence ${eventSeq.name} has initiating event ${eventSeq.initiatingEventId}`,
            );
          }

          // Validate functional event states match the sequence path
          if (treeSeq.functionalEventStates && eventSeq.systemResponses) {
            // Map tree functional events to system references where possible
            for (const [funcEventId, state] of Object.entries(
              treeSeq.functionalEventStates,
            )) {
              const funcEvent = eventTree.functionalEvents[funcEventId];
              if (funcEvent?.systemReference) {
                const sysRef = funcEvent.systemReference;
                if (
                  eventSeq.systemResponses[sysRef] &&
                  eventSeq.systemResponses[sysRef] !== state
                ) {
                  errors.push(
                    `Inconsistent system state: Event tree sequence ${seqId} has state ${state} for functional event ${funcEventId} (system ${sysRef}) but event sequence ${eventSeq.name} has system response ${eventSeq.systemResponses[sysRef]}`,
                  );
                }
              }
            }
          }

          // Validate end states match
          if (treeSeq.endState && eventSeq.endState !== treeSeq.endState) {
            errors.push(
              `Inconsistent end state: Event tree sequence ${seqId} has end state ${treeSeq.endState} but event sequence ${eventSeq.name} has end state ${eventSeq.endState}`,
            );
          }

          // Validate timing consistency if applicable
          if (
            treeSeq.functionalEventStates &&
            eventSeq.timing &&
            eventSeq.timing.length > 0
          ) {
            // Ensure events in sequence timing align with functional events in the event tree
            // This would need custom logic based on naming conventions or explicit mappings
          }
        }
      }
    });

    // Validate that all sequences linked to this event tree exist in the tree
    Object.values(sequences).forEach((seq) => {
      if (seq.eventTreeId === eventTree.name && seq.eventTreeSequenceId) {
        if (!eventTree.sequences[seq.eventTreeSequenceId]) {
          errors.push(
            `Event sequence ${seq.name} references non-existent event tree sequence ${seq.eventTreeSequenceId} in event tree ${eventTree.name}`,
          );
        }
      }
    });

    // Validate chronological ordering of functional events
    const functionalEventsByOrder = Object.values(eventTree.functionalEvents)
      .filter((fe) => fe.order !== undefined)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

    // Check if ordering in the event tree structure matches the declared order
    // This would require analyzing the structure of branches and paths

    return errors;
  },

  /**
   * Validates that all paths through the event tree have corresponding event sequences
   * @param eventTree - The EventTree to validate
   * @param sequences - Record of EventSequence objects
   * @returns Array of validation error messages
   */
  validateSequenceCoverage: (
    eventTree: EventTree,
    sequences: Record<EventSequenceReference, EventSequence>,
  ): string[] => {
    const errors: string[] = [];

    // Check if all event tree sequences have a corresponding event sequence
    Object.entries(eventTree.sequences).forEach(([treeSeqId, treeSeq]) => {
      if (!treeSeq.eventSequenceId) {
        errors.push(
          `Event tree sequence ${treeSeqId} has no corresponding event sequence reference`,
        );
      } else if (!sequences[treeSeq.eventSequenceId]) {
        errors.push(
          `Event tree sequence ${treeSeqId} references non-existent event sequence ${treeSeq.eventSequenceId}`,
        );
      }
    });

    // Find all unique paths through the event tree and ensure they map to sequences
    // This would require traversing the event tree structure

    return errors;
  },

  /**
   * Validates transfers between event trees
   * @param eventTrees - Record of EventTree objects
   * @returns Array of validation error messages
   */
  validateTransfers: (eventTrees: Record<string, EventTree>): string[] => {
    const errors: string[] = [];

    // Check all transfers between event trees
    Object.entries(eventTrees).forEach(([treeId, tree]) => {
      if (tree.transfers) {
        Object.entries(tree.transfers).forEach(([transferId, transfer]) => {
          // Check if target event tree exists
          if (!eventTrees[transfer.targetEventTreeId]) {
            errors.push(
              `Event tree ${treeId} transfer ${transferId} references non-existent target event tree: ${transfer.targetEventTreeId}`,
            );
          }
        });
      }
    });

    // Check for intermediate end states with transfers
    Object.entries(eventTrees).forEach(([treeId, tree]) => {
      Object.entries(tree.sequences).forEach(([seqId, seq]) => {
        // For sequences with event sequence references
        if (seq.eventSequenceId) {
          // This would need to access the intermediate end states from the analysis object
          // This is a placeholder for that logic
          // intermediateEndStates.forEach(state => {
          //     if (state.parentSequenceId === seq.eventSequenceId &&
          //         state.transferToEventTree &&
          //         !eventTrees[state.transferToEventTree]) {
          //         errors.push(`Intermediate end state in sequence ${seq.eventSequenceId} references non-existent target event tree: ${state.transferToEventTree}`);
          //     }
          // });
        }
      });
    });

    return errors;
  },
};

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
export const EventSequenceAnalysisSchema =
  typia.json.schemas<[EventSequenceAnalysis]>();

/**
 * Example of creating a new event sequence analysis with proper versioning
 * @example
 * ```typescript
 * const analysis: EventSequenceAnalysis = {
 *   metadata: {
 *     versionInfo: createVersionInfo("1.0.0", SCHEMA_VERSION),
 *     analysisDate: "2024-03-30",
 *     analysts: ["John Doe"],
 *     reviewers: ["Jane Smith"],
 *     approvalStatus: "APPROVED",
 *     scope: "Full plant analysis",
 *     limitations: ["Limited to normal operating conditions"],
 *     lastModifiedDate: "2024-03-30",
 *     lastModifiedBy: "John Doe"
 *   },
 *   // ... rest of the analysis data ...
 * };
 * ```
 */
