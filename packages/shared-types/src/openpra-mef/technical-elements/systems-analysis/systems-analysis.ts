/**
   * @module systems_analysis
   * @description Comprehensive types and interfaces for Systems Analysis (SY)
   * 
   * The objectives of Systems Analysis ensure that:
   * - (a) there is a reasonably complete set of the independent system failure and unavailability modes
   *       and associated human failure events (HFEs) and system alignments for each system;
   * - (b) there is a reasonably complete identification of the common cause failures (CCFs) and 
   *       dependency effects on system performance;
   * - (c) the Systems Analysis is documented to provide traceability of the work.
   * 
   * Per RG 1.247, the objective of the systems analysis PRA element is to identify the various 
   * combinations of failures that can prevent a system from performing its function as defined by 
   * the success criteria. The model representing the various failure combinations includes the system 
   * hardware and instrumentation (and their associated failure modes) and human failure events (HFEs) 
   * that would prevent the system from performing its defined functions.
   * 
   * @preferred
   * @category Technical Elements
   */
  
  import typia, { tags } from "typia";    
  import { TechnicalElement, TechnicalElementTypes, TechnicalElementMetadata } from "../technical-element";
  import { Named, Unique } from "../core/meta";
  import { IdPatterns, ImportanceLevel, SensitivityStudy, BaseUncertaintyAnalysis } from "../core/shared-patterns";
  import { PlantOperatingStatesTable } from "../plant-operating-states-analysis/plant-operating-states-analysis";
  import { BaseEvent, BasicEvent, TopEvent } from "../core/events";
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
  import {
      SuccessCriterion,
      SystemSuccessCriterion,
      SuccessCriteriaId
  } from "../success-criteria/success-criteria-development";
  import { DistributionType } from "../data-analysis/data-analysis";
  import { ComponentReference } from "../core/component";
  
  //==============================================================================
  /**
   * @group Core Definitions & Enums
   * @description Basic types, enums, and utility interfaces used throughout the module
   */
  //==============================================================================
  
  /**
   * Type for system IDs.
   * Format: SYS-[NAME] (e.g., SYS-RHR)
   * @group Core Definitions & Enums
   */
  export type SystemReference = string & tags.Pattern<"^SYS-[A-Za-z0-9_-]+$">;
  
  /**
   * Reference to a Human Action by its unique identifier.
   * Format: HRA-[NUMBER] (e.g., HRA-001)
   * @group Core Definitions & Enums
   */
  export type HumanActionReference = string & tags.Pattern<"^HRA-[0-9]+$">;
  
  /**
   * Interface representing an assumption made during the analysis.
   * @group Core Definitions & Enums
   */
  export interface Assumption {
    /**
     * The statement of the assumption.
     * @example "It is assumed that offsite power is unavailable during the initiating event."
     */
    statement: string;
  
    /**
     * The potential impact of this assumption on the analysis results.
     * @example "May lead to a conservative estimate of system failure probability."
     */
    impact?: string;
  }
  
  /**
   * The types of system dependencies.
   * @group Core Definitions & Enums
   */
  export enum DependencyType {
    /** Functional dependency (e.g., power, control, cooling) */
    FUNCTIONAL = "FUNCTIONAL",
    
    /** Spatial dependency (e.g., shared location) */
    SPATIAL = "SPATIAL",
    
    /** Environmental dependency (e.g., temperature, radiation) */
    ENVIRONMENTAL = "ENVIRONMENTAL",
    
    /** Human dependency (e.g., shared operator actions) */
    HUMAN = "HUMAN",
    
    /** Other dependencies not covered by the above */
    OTHER = "OTHER"
  }
  
  /**
   * The types of failure modes that can be modeled for components.
   * @group Core Definitions & Enums
   */
  export enum FailureModeType {
    /** Failure to start/open/close/change position */
    FAILURE_TO_START = "FAILURE_TO_START",
    
    /** Failure to run/continue operating */
    FAILURE_TO_RUN = "FAILURE_TO_RUN",
    
    /** Failure due to common cause */
    COMMON_CAUSE_FAILURE = "COMMON_CAUSE_FAILURE",
    
    /** Failure due to test or maintenance unavailability */
    TEST_MAINTENANCE = "TEST_MAINTENANCE",
    
    /** Failure due to human error */
    HUMAN_ERROR = "HUMAN_ERROR",
    
    /** Failure due to external event */
    EXTERNAL_EVENT = "EXTERNAL_EVENT",
    
    /** Other failure modes not covered by the above */
    OTHER = "OTHER"
  }
  
  /**
   * Possible states a component can be in during operation
   * @group Core Definitions & Enums
   * 
   * @example
   * ```typescript
   * const pumpState: ComponentState = "operational"; // Normal operation
   * const valveState: ComponentState = "degraded";   // Operating but with reduced capability
   * ```
   */
  export type ComponentState = 
    | "operational"  // Normal operation
    | "degraded"     // Operating but with reduced capability
    | "failed"       // Complete loss of function
    | "recovering"   // Being restored to service
    | "maintenance"; // Under planned maintenance
  
  /**
   * Interface for a basic event in a system logic model.
   * @group Core Definitions & Enums
   * @extends {BasicEvent} from core events module
   * @description Extends the core BasicEvent type with system-specific properties.
   * The core BasicEvent is defined in the upstream core/events.ts module and is the
   * authoritative source for basic event definitions across the codebase.
   * 
   * This follows the dependency structure where:
   * 1. Core events.ts (most upstream): Defines the base BasicEvent interface
   * 2. Systems-analysis.ts (midstream): Extends BasicEvent with system-specific properties
   * 3. Data-analysis.ts (downstream): Uses both BasicEvent and references SystemBasicEvent
   */
  export interface SystemBasicEvent extends BasicEvent {
    /**
     * Reference to the component associated with this basic event, if applicable.
     */
    componentReference?: string;
    
    /**
     * The failure mode represented by this basic event.
     */
    failureMode?: FailureModeType | string;
    
    /**
     * The probability or frequency of this basic event.
     */
    probability?: number;
    
    /**
     * Whether repair is modeled for this basic event
     * @implements SY-A31: DO NOT MODEL repair unless justified
     */
    repairModeled?: boolean;
    
    /**
     * Justification for modeling repair, if applicable
     */
    repairJustification?: string;
    
    /**
     * Mean time to repair, if repair is modeled
     */
    meanTimeToRepair?: number;
  }
  
  //==============================================================================
  /**
   * @group Temporal Modeling
   * @description Time-dependent component behaviors and phase modeling
   * @implements SY-A1: DEVELOP system logic models that include mission times
   */
  //==============================================================================
  
  /**
   * Interface for modeling resource depletion over time.
   * Used to track consumable resources that impact system availability.
   * 
   * @group Temporal Modeling
   * 
   * @example
   * ```typescript
   * const dieselFuelModel: DepletionModel = {
   *   id: "depletion-789",
   *   resourceType: "fuel",
   *   initialQuantity: 5000,   // Liters
   *   consumptionRate: 250,    // Liters per hour at full load
   *   units: "liters/hour"
   * };
   * ```
   */
  export interface DepletionModel extends Unique {
    /**
     * Type of resource being depleted
     */
    resourceType: "fuel" | "coolant" | "battery" | "other";
    
    /**
     * Description of the resource
     */
    description?: string;
    
    /**
     * Initial quantity available
     */
    initialQuantity: number;
    
    /**
     * Rate at which the resource is consumed
     */
    consumptionRate: number;
    
    /**
     * Units of measurement for consumption rate
     */
    units: string;
    
    /**
     * Component or system using this resource
     */
    associatedSystem?: SystemReference;
    
    /**
     * Whether depletion leads to immediate failure or degraded operation
     */
    depletionImpact?: "immediate-failure" | "degraded-operation";
  }
  
  /**
   * Interface representing a time phase for system or component operation.
   * Defines characteristics and requirements during a specific period.
   * 
   * @group Temporal Modeling
   * 
   * @example
   * ```typescript
   * const startupPhase: TemporalPhase = {
   *   id: "phase-123",
   *   startTime: 0,
   *   endTime: 0.5,  // 30 minutes
   *   state: "operational",
   *   activeFailureModes: ["FAILURE_TO_START"],
   *   successCriteria: ["Achieve rated speed within 10 seconds"]
   * };
   * ```
   */
  export interface TemporalPhase extends Unique {
    /**
     * Start time of the phase in hours from sequence initiation
     * @minimum 0
     */
    startTime: number & tags.Minimum<0>;
    
    /**
     * End time of the phase in hours
     * @minimum 0
     */
    endTime: number & tags.Minimum<0>;
    
    /**
     * Current state of the component or system during this phase
     */
    state: ComponentState;
    
    /**
     * Failure modes that are active during this phase
     */
    activeFailureModes?: (FailureModeType | string)[];
    
    /**
     * Success criteria that must be met during this phase
     * Can be simple string descriptions or references to formal success criteria
     */
    successCriteria?: string[] | SuccessCriterion[] | SuccessCriteriaId[];
    
    /**
     * Description of the phase
     */
    description?: string;
    
    /**
     * Human actions required during this phase
     */
    requiredHumanActions?: HumanActionReference[];
  }
  
  /**
   * Interface representing a component's behavior over time.
   * Tracks changes in state, applicable failure modes, and resource consumption.
   * 
   * @group Temporal Modeling
   * 
   * @example
   * ```typescript
   * const dieselGeneratorTimeline: ComponentTimeline = {
   *   id: "timeline-456",
   *   systemReference: "SYS-EDG",
   *   componentId: "EDG-A", 
   *   description: "Emergency Diesel Generator A timeline during LOOP",
   *   phases: [
   *     // Startup phase
   *     {
   *       id: "phase-1",
   *       startTime: 0,
   *       endTime: 0.1,  // 6 minutes
   *       state: "operational",
   *       activeFailureModes: ["FAILURE_TO_START"],
   *       successCriteria: ["Achieve rated voltage within 10 seconds"]
   *     },
   *     // Run phase
   *     {
   *       id: "phase-2",
   *       startTime: 0.1,
   *       endTime: 24,
   *       state: "operational",
   *       activeFailureModes: ["FAILURE_TO_RUN"],
   *       successCriteria: ["Maintain voltage within 5% of nominal"]
   *     }
   *   ],
   *   depletionModelId: "depletion-789" // References fuel consumption model
   * };
   * ```
   */
  export interface ComponentTimeline extends Unique {
    /**
     * Reference to the system this component belongs to
     */
    systemReference: SystemReference;
    
    /**
     * Component identifier within the system
     */
    componentId: ComponentReference;
    
    /**
     * Description of this timeline
     */
    description?: string;
    
    /**
     * Temporal phases making up this timeline
     */
    phases: TemporalPhase[];
    
    /**
     * Reference to applicable depletion model, if any
     */
    depletionModelId?: string;
    
    /**
     * Applicable plant operating states for this timeline
     */
    applicablePOSs?: string[];
  }
  
  //==============================================================================
  /**
   * @group System Modeling & Failure Modes
   * @description System definitions, logic models, fault trees, and failure modes
   * @implements HLR-SY-A
   */
  //==============================================================================
  
  /**
 * Interface for a system definition, including boundaries, components, and success criteria.
 * @group System Modeling & Failure Modes
 * @implements SY-A1: DEVELOP system logic models
 * @implements SY-A3: DEFINE the boundaries of the system
 */
export interface SystemDefinition extends Unique, Named {
    /**
     * Description of the system's function and operation under normal and emergency conditions.
     * @implements SY-C1(a): system function and operation under normal and emergency operations
     * @example "The RHR system removes decay heat from the reactor core during shutdown conditions."
     */
    description?: string;
    
    /**
     * System boundaries, including components within the scope of the model.
     * @implements SY-A3(a): DEFINE boundaries, equipment, and portions that are not modeled
     * @implements SY-C1(b): system model boundary
     * @example ["Pump A", "Pump B", "Heat Exchanger", "Piping from RCS"]
     */
    boundaries: string[];
    
    /**
     * Success criteria for the system to perform its intended safety function(s).
     * @implements SY-A2: INCLUDE success criteria derived from thermal, structural analyses
     * @implements SY-C1(f): system success criteria and relationship to event sequence models
     * @example "One of two pumps capable of delivering required flow."
     */
    successCriteria: string | SystemSuccessCriterion | SuccessCriteriaId;
    
    /**
     * Mission time for which the system is required to function.
     * @implements SY-A1: DEVELOP system logic models that include mission times
     * @example "24 hours"
     */
    missionTime?: string;
    
    /**
     * System schematic illustrating all equipment and components necessary for operation.
     * @implements SY-C1(c): system schematic illustrating all equipment and components
     * @example { reference: "Drawing XYZ-123", description: "P&ID of RHR System" }
     */
    schematic?: {
      reference: string;
      description?: string;
    };
    
    /**
     * Plant operating states where this system is required.
     * @implements SY-B14: MODEL dependencies on plant operating states
     */
    plantOperatingStates?: PlantOperatingStatesTable;
    
    /**
     * Components and failure modes included in the model and justification for any exclusions.
     * @implements SY-A7: INCLUDE components required to support success criteria
     * @implements SY-C1(l): components and failure modes included and justification for exclusion
     */
    modeledComponentsAndFailures: Record<
      string,
      {
        failureModes: string[];
        justificationForInclusion?: string;
        /**
         * Component group identifier for data analysis purposes.
         * Used to group similar components for statistical analysis.
         * @implements DA-B1: GROUP components considering design, environmental, and service conditions
         */
        componentGroup?: string;
      }
    >;
    
    /**
     * Justification for exclusion of any components.
     * @implements SY-A7: Justification for exclusion of components
     */
    justificationForExclusionOfComponents?: string[];
    
    /**
     * Justification for exclusion of any failure modes.
     * @implements SY-A19: Justification for exclusion of failure modes
     */
    justificationForExclusionOfFailureModes?: string[];
    
    /**
     * Human actions necessary for the operation of the system.
     * @implements SY-C1(g): human actions necessary for operation of system
     * @example [{ actionRef: "HRA-001", description: "Operator aligns valves for recirculation." }]
     */
    humanActionsForOperation?: {
      actionRef: HumanActionReference;
      description: string;
    }[];
    
    /**
     * Reference to system-related test and maintenance procedures.
     * @implements SY-C1(h): reference to system-related test and maintenance procedures
     * @example ["Procedure STM-RHR-001: Quarterly Pump Test"]
     */
    testMaintenanceProcedures?: string[];
    
    /**
     * Testing and maintenance requirements and practices relevant to system availability.
     * @implements SY-A3(d): DEFINE test and maintenance requirements
     * @example ["Quarterly pump testing", "Annual valve maintenance"]
     */
    testAndMaintenance?: string[];
    
    /**
     * Component spatial information and environmental hazards that may impact multiple systems.
     * @implements SY-C1(j): component spatial information, including hazards
     * @example [{ location: "Pump Room A", hazards: ["Potential flooding"] }]
     */
    spatialInformation?: {
      location: string;
      hazards?: string[];
      components?: string[];
    }[];
    
    /**
     * Assumptions or simplifications made in the development of the system model.
     * @implements SY-C1(k): assumptions or simplifications made in development of system models
     * @example ["Piping failures are not explicitly modeled."]
     */
    modelAssumptions?: string[];
    
    /**
     * Information and calculations supporting equipment operability considerations and assumptions.
     * @implements SY-C1(d): information and calculations to support equipment operability
     * @example [{ component: "Pump A", calculationRef: "CALC-RHR-001" }]
     */
    operabilityConsiderations?: {
      component: string;
      calculationRef?: string;
      notes?: string;
    }[];
    
    /**
     * Operating limitations as per Technical Specifications or design basis.
     * @implements SY-A3(e): DEFINE operating limitations
     * @example ["Minimum of two pumps operable in shutdown."]
     */
    operatingLimitations?: string[];
    
    /**
     * Component operability and design limits.
     * @implements SY-A3(f): DEFINE component operability and design limits
     * @example [{ component: "Pump A", limit: "Flow rate > 500 gpm" }]
     */
    componentOperabilityLimits?: {
      component: string;
      limit: string;
    }[];
    
    /**
     * System configuration during normal and off-normal conditions, including alternative alignments.
     * @implements SY-A3(h): DEFINE system configuration during normal and off-normal conditions
     * @example ["Normal standby with valves open.", "Emergency injection mode."]
     */
    configurations?: string[];
    
    /**
     * Actual operational history or history in similar systems indicating past problems.
     * @implements SY-C1(e): actual operational history or history in similar systems
     * @example ["Two instances of pump seal failure in the last 5 years."]
     */
    operationalHistory?: string[];
    
    /**
     * Procedures for the operation of the system during normal and off-normal conditions.
     * @implements SY-A3(g): DEFINE procedures for system operation
     * @example ["EOP-XXX: Loss of Coolant Accident"]
     */
    operatingProcedures?: string[];
    
    /**
     * Temporal behavior of the system with phase-dependent success criteria and failure modes.
     * Used for time-based modeling of system performance.
     */
    temporalBehavior?: ComponentTimeline[];
    
    /**
     * Indicates whether this system definition is based on as-built/as-operated
     * or as-designed/as-intended-to-operate information
     * @implements SY-A2: COLLECT pertinent information
     */
    informationBasis: "as-built-as-operated" | "as-designed-as-intended";
    
    /**
     * For pre-operational PRAs, justification for information sources used
     * @implements SY-A4: SPECIFY and JUSTIFY information sources
     */
    preOperationalInformationJustification?: string;
  }
  
  /**
   * Interface for a system logic model (e.g., fault tree).
   * @group System Modeling & Failure Modes
   * @implements SY-A1: DEVELOP system logic models
   */
  export interface SystemLogicModel extends Unique {
    /**
     * Reference to the system this logic model belongs to.
     */
    systemReference: SystemReference;
    
    /**
     * Description of the logic model (e.g., top event).
     * @example "Failure of RHR System to provide required flow."
     */
    description: string;
    
    /**
     * Representation of the logic model (e.g., a textual representation or a link to an external file).
     * @implements SY-C1: DOCUMENT the process used in the Systems Analysis
     * @example "[[PumpA_Fail OR PumpB_Fail] AND [Power_Fail OR ControlSignal_Fail]]"
     */
    modelRepresentation: string;
    
    /**
     * Basic events included in the logic model and their descriptions.
     * @implements SY-C1(r): basic events in the system fault trees
     */
    basicEvents: SystemBasicEvent[];
    
    /**
     * Records of resolution of logic loops developed during fault tree linking (if used).
     * @implements SY-C1(n): records of resolution of logic loops developed during fault tree linking
     * @example [{ loopId: "LOOP-001", resolution: "Implemented time-dependent gate." }]
     */
    logicLoopResolutions?: {
      loopId: string;
      resolution: string;
    }[];
    
    /**
     * The nomenclature used in the system models.
     * @implements SY-C1(s): the nomenclature used in the system models
     */
    nomenclature?: Record<string, string>;
    
    /**
     * Fault tree representation of the system logic model, if applicable.
     * @implements SY-A1: DEVELOP system logic models
     */
    faultTree?: FaultTree;
  }
  
  /**
   * Interface for digital instrumentation and control systems modeling.
   * @group System Modeling & Failure Modes
   * @implements SY-C1(t): treatment of digital instrumentation and control systems
   */
  export interface DigitalInstrumentationAndControl extends Unique, Named {
    /**
     * System reference this digital I&C is associated with.
     */
    systemReference: SystemReference;
    
    /**
     * Description of the digital I&C system.
     */
    description: string;
    
    /**
     * Methodology used for modeling the digital I&C system.
     * @example "Detailed fault tree with software failure modes."
     */
    methodology: string;
    
    /**
     * Assumptions made in modeling the digital I&C system.
     */
    assumptions?: string[];
    
    /**
     * Failure modes considered for the digital I&C system.
     */
    failureModes?: string[];
    
    /**
     * Specific concerns for digital I&C systems (e.g., software validation).
     */
    specialConsiderations?: string[];
  }
  
  /**
   * Interface for passive safety systems modeling.
   * @group System Modeling & Failure Modes
   * @implements SY-C1(u): treatment of systems that perform their safety functions using passive means
   */
  export interface PassiveSystemsTreatment extends Unique, Named {
    /**
     * System reference this passive system is associated with.
     */
    systemReference: SystemReference;
    
    /**
     * Description of the passive system.
     */
    description: string;
    
    /**
     * Reference to performance analysis for this passive system.
     */
    performanceAnalysisRef?: string;
    
    /**
     * Methodology for uncertainty analysis of passive system performance.
     */
    uncertaintyAnalysis?: string;
    
    /**
     * Specific physical phenomena relevant to this passive system.
     */
    relevantPhysicalPhenomena?: string[];
    
    /**
     * Documentation of the evaluation of uncertainties in system performance.
     */
    uncertaintyEvaluation?: string;
  }
  
  //==============================================================================
  /**
   * @group Fault Tree Analysis
   * @description Fault tree modeling, symbols, and analysis methods
   * @implements SY-A1: DEVELOP system logic models
   * @implements SY-A7: INCLUDE components required to support success criteria
   * @implements SY-B1: IDENTIFY and MODEL the common cause failures
   */
  //==============================================================================
  
  /**
   * Enum for fault tree node types, representing standard FTA symbols
   * @group Fault Tree Analysis
   */
  export enum FaultTreeNodeType {
    // Gates
    AND_GATE = "AND_GATE",           // Output occurs if and only if all inputs occur
    OR_GATE = "OR_GATE",             // Output occurs if one or more inputs occur
    INHIBIT_GATE = "INHIBIT_GATE",   // Output exists when input exists and condition is met
    
    // Events
    BASIC_EVENT = "BASIC_EVENT",           // Circle: Independent Primary Fault Event
    INTERMEDIATE_EVENT = "INTERMEDIATE_EVENT", // Rectangle: Fault Event (result of logical combination)
    UNDEVELOPED_EVENT = "UNDEVELOPED_EVENT",   // Diamond: Undeveloped Event
    HOUSE_EVENT = "HOUSE_EVENT",           // House: Normally Occurring Basic Event
    
    // Transfers
    TRANSFER_IN = "TRANSFER_IN",           // Triangle In: continues a branch from another page
    TRANSFER_OUT = "TRANSFER_OUT"          // Triangle Out: continues a branch on another page
  }
  
  /**
   * Unified interface for all fault tree nodes with type-specific properties
   * @group Fault Tree Analysis
   */
  export interface FaultTreeNode extends Unique {
    /**
     * Type of node in the fault tree
     */
    nodeType: FaultTreeNodeType;
    
    /**
     * Name of the node
     */
    name: string;
    
    /**
     * Description of the node
     */
    description?: string;
    
    /**
     * IDs of input nodes (for gates)
     */
    inputs?: string[];
    
    /**
     * Condition for INHIBIT gates
     */
    condition?: string;
    
    /**
     * Probability for basic events
     */
    probability?: number;
    
    /**
     * Reference to a SystemBasicEvent
     */
    basicEventReference?: string;
    
    /**
     * Reference to a human action for human-related events
     */
    humanActionReference?: HumanActionReference;
    
    /**
     * For house events, whether the event is TRUE or FALSE
     */
    houseEventValue?: boolean;
    
    /**
     * For transfers: ID of the target/source fault tree
     */
    transferTreeId?: string;
    
    /**
     * For TRANSFER_IN: ID of the source node
     */
    sourceNodeId?: string;
  }
  
  /**
   * Interface for a complete fault tree
   * @group Fault Tree Analysis
   * @implements SY-A1: DEVELOP system logic models
   */
  export interface FaultTree extends Unique, Named {
    /**
     * Reference to the system this fault tree belongs to
     */
    systemReference: SystemReference;
    
    /**
     * Description of the fault tree
     */
    description: string;
    
    /**
     * ID of the top event node within this fault tree's nodes map
     * This is an internal reference to identify which node in the fault tree represents the top event
     * @implements SY-A1: DEVELOP system logic models that represent the top event
     */
    topEventId: string;
    
    /**
     * Reference to a top event from the core events module
     * This allows linking the fault tree to a formally defined TopEvent in the core/events.ts file
     * This is different from topEventId, which references a node within this fault tree
     */
    topEventReference?: string;
    
    /**
     * Map of node IDs to nodes
     */
    nodes: Record<string, FaultTreeNode>;
    
    /**
     * Minimal cut sets as arrays of basic event IDs
     */
    minimalCutSets?: string[][];
    
    /**
     * Calculated probability of the top event
     * @implements SY-C1(o): results of the system model evaluations
     */
    topEventProbability?: number;
    
    /**
     * Quantification settings
     */
    quantificationSettings?: {
      method?: "mincut" | "exact" | "rare-event" | "mcub";
      truncationLimit?: number;
      maxOrder?: number;
    };
    
    /**
     * Assumptions made in the fault tree analysis
     */
    assumptions?: string[];
  }
  
  //==============================================================================
  /**
   * @group Dependencies & Common Cause Analysis
   * @description Dependencies, common cause failures, and their impacts on system performance
   * @implements HLR-SY-B
   */
  //==============================================================================
  
  /**
   * Interface for a dependency between systems.
   * @group Dependencies & Common Cause Analysis
   * @implements SY-B5: INCLUDE both intersystem and intrasystem dependencies
   */
  export interface SystemDependency extends Unique {
    /**
     * Description of the dependency.
     */
    description?: string;
    
    /**
     * The dependent system.
     */
    dependentSystem: SystemReference;
    
    /**
     * The supporting system.
     */
    supportingSystem: SystemReference;
    
    /**
     * The type of dependency.
     * @remarks Support system dependencies are a critical type of FUNCTIONAL dependency
     * where a main system requires a support system (e.g., power, cooling, control) to operate.
     */
    type: DependencyType | string;
    
    /**
     * Additional details about the dependency.
     */
    details?: string;
    
    /**
     * The impact of this dependency on system performance.
     */
    impact?: string;
  }
  
  /**
   * Interface for a dependency between components within a system.
   * @group Dependencies & Common Cause Analysis
   * @implements SY-B5: INCLUDE both intersystem and intrasystem dependencies
   */
  export interface ComponentDependency extends Unique {
    /**
     * Description of the dependency.
     */
    description?: string;
    
    /**
     * The system this dependency exists within.
     */
    system: SystemReference;
    
    /**
     * The first component in the dependency relationship.
     */
    componentA: string;
    
    /**
     * The second component in the dependency relationship.
     */
    componentB: string;
    
    /**
     * The type of dependency.
     */
    type: DependencyType | string;
    
    /**
     * Additional details about the dependency.
     */
    details?: string;
    
    /**
     * The impact of this dependency on component performance.
     */
    impact?: string;
  }
  
  /**
   * Interface for a common cause failure group.
   * @group Dependencies & Common Cause Analysis
   * @implements SY-B1: IDENTIFY and MODEL the common cause failures
   * @implements SY-B4: EVALUATE appropriate common cause failure probabilities
   */
  export interface CommonCauseFailureGroup extends Unique, Named {
    /**
     * Description of the common cause failure group.
     * @example "Failure of both emergency diesel generators due to a common manufacturing defect."
     */
    description: string;
    
    /**
     * Components affected by this CCF group.
     * @example ["EDG-01", "EDG-02"]
     */
    affectedComponents: string[];
    
    /**
     * Systems affected by this CCF group.
     */
    affectedSystems: SystemReference[];
    
    /**
     * The common cause model used (reference to Data Analysis).
     * @implements SY-B4: EVALUATE appropriate common cause failure probabilities
     * @example "Multiple Greek Letter (MGL)"
     */
    modelType: string;
    
    /**
     * Parameters of the CCF model (reference to Data Analysis parameters).
     * @example { betaFactor: 0.05 }
     */
    modelParameters?: Record<string, number>;
    
    /**
     * Justification for why this CCF is or is not risk-significant.
     * @implements SY-B1: Justification for risk-significance
     */
    riskSignificanceJustification?: string;
  }
  
  /**
   * Interface for a human failure event integrated into system models.
   * @group Dependencies & Common Cause Analysis
   * @implements SY-A1: INCLUDE human failures that can contribute to system unavailability
   */
  export interface HumanFailureEventIntegration extends Unique {
    /**
     * Reference to the human action.
     */
    hfeReference: HumanActionReference;
    
    /**
     * The system affected by this human failure event.
     */
    system: SystemReference;
    
    /**
     * Description of the task that can be failed.
     * @example "Operator fails to manually start pump."
     */
    taskDescription: string;
    
    /**
     * Whether this is related to test and maintenance activities.
     */
    isTestMaintenance: boolean;
    
    /**
     * The impact of this human failure on system performance.
     */
    impact?: string;
  }
  
  /**
   * Interface for systematic dependency search methodology.
   * @group Dependencies & Common Cause Analysis
   * @implements SY-C1(i): process used for systematic search for dependencies including dependency tables
   */
  export interface DependencySearchMethodology extends Unique, Named {
    /**
     * Description of the methodology used to search for dependencies.
     */
    description: string;
    
    /**
     * Reference to documentation of the search methodology.
     */
    reference: string;
    
    /**
     * Dependency tables or matrices used in the analysis.
     */
    dependencyTables?: {
      tableId: string;
      description: string;
      reference?: string;
    }[];
    
    /**
     * Systems analyzed for dependencies.
     */
    systemsAnalyzed: SystemReference[];
  }
  
  //==============================================================================
  /**
   * @group Engineering Analysis & Validation
   * @description Analyses supporting system model development and their validation
   */
  //==============================================================================
  
  /**
   * Interface for system uncertainty analysis.
   * @group Engineering Analysis & Validation
   * @implements SY-B4: EVALUATE appropriate common cause failure probabilities
   */
  export interface SystemUncertaintyAnalysis extends BaseUncertaintyAnalysis {
    /**
     * The system being analyzed.
     */
    system: SystemReference;
    
    /**
     * Parameter uncertainties specific to this system.
     */
    parameterUncertainties: {
      /** Parameter name or ID */
      parameterId: string;
      
      /** Distribution type */
      distributionType: DistributionType;
      
      /** Distribution parameters */
      distributionParameters: Record<string, number>;
      
      /** Basis for the distribution */
      basis: string;
      
      /** Component or failure mode this parameter is associated with */
      associatedComponent?: string;
    }[];
    
    /**
     * Common cause failure model uncertainties.
     */
    ccfUncertainties?: {
      /** CCF group ID */
      ccfGroupId: string;
      
      /** Description of the uncertainty */
      description: string;
      
      /** Impact on system reliability */
      impact: string;
    }[];
    
    /**
     * Uncertainty in system success criteria.
     */
    successCriteriaUncertainties?: {
      /** Success criterion ID */
      criterionId: string;
      
      /** Description of the uncertainty */
      description: string;
      
      /** Impact on system reliability */
      impact: string;
    }[];
  }
  
  /**
   * Interface for system model evaluation results.
   * @group Engineering Analysis & Validation
   * @implements SY-C1(o): results of the system model evaluations
   */
  export interface SystemModelEvaluation extends Unique {
    /**
     * The system being evaluated.
     */
    system: SystemReference;
    
    /**
     * Top event probability or unavailability.
     */
    topEventProbability?: number;
    
    /**
     * Other quantitative results from the evaluation.
     * @example { unavailability: 0.005, failureRate: 1e-6 }
     */
    quantitativeResults?: Record<string, number>;
    
    /**
     * Qualitative insights from the evaluation.
     */
    qualitativeInsights?: string[];
    
    /**
     * Dominant failure modes or contributors.
     */
    dominantContributors?: {
      contributor: string;
      contribution: number;
    }[];
  }
  
  /**
   * Interface for sensitivity studies on system models.
   * @group Engineering Analysis & Validation
   * @implements SY-C1(p): results of sensitivity studies
   */
  export interface SystemSensitivityStudy extends SensitivityStudy {
    /**
     * The system being analyzed.
     */
    system: SystemReference;
    
    /**
     * Parameter changed in the sensitivity study.
     * @example "Pump Failure Rate"
     */
    parameterChanged: string;
    
    /**
     * Impact on the system performance.
     * @example "Increased top event probability by 10%"
     */
    impactOnSystem: string;
    
    /**
     * Insights gained from the sensitivity study.
     * This should be a comma-separated string of insights rather than an array
     * to maintain compatibility with the parent SensitivityStudy interface.
     */
    insights?: string;
  }
  
  /**
   * Interface for considerations of potential overload conditions.
   * @group Engineering Analysis & Validation
   * @implements SY-A29: IDENTIFY conditions that may require designed capabilities to be exceeded
   */
  export interface OverCapacityConsideration extends Unique {
    /**
     * The system that could experience overload.
     */
    system: SystemReference;
    
    /**
     * Scenarios where the system's rated capacity might be exceeded.
     */
    potentialExceedanceScenarios: string[];
    
    /**
     * Justification for capability to handle overload conditions.
     */
    justificationForCapability?: string;
    
    /**
     * References to supporting data or analyses.
     */
    supportingDataReferences?: string[];
    
    /**
     * Impact of exceeding design capacity on system performance.
     */
    impactOnPerformance?: string;
  }
  
  /**
   * Interface for model validation methods.
   * @group Engineering Analysis & Validation
   * @implements SY-A33: USE of external or independent reviews
   */
  export interface ModelValidation extends Unique, Named {
    /**
     * Description of the validation method.
     */
    description: string;
    
    /**
     * The system model being validated.
     */
    systemReference: SystemReference;
    
    /**
     * Validation techniques used.
     * @example ["Peer review", "Comparison with operating experience"]
     */
    techniques: string[];
    
    /**
     * Results of the validation.
     */
    results: string;
    
    /**
     * Any issues identified during validation.
     */
    issuesIdentified?: string[];
    
    /**
     * Resolution of identified issues.
     */
    issueResolutions?: string[];
  }
  
  //==============================================================================
  /**
   * @group Documentation & Traceability
   * @description Documentation for systems analysis and traceability
   * @implements HLR-SY-C
   */
  //==============================================================================
  
  /**
   * Interface representing documentation of the process used in the systems analysis.
   * @group Documentation & Traceability
   * @implements SY-C1: DOCUMENT the process used in the Systems Analysis
   */
  export interface ProcessDocumentation extends BaseProcessDocumentation {
    /**
     * Documentation of system functions and operations.
     * @implements SY-C1(a): system function and operation under normal and emergency operations
     */
    systemFunctionDocumentation?: Record<SystemReference, string>;
    
    /**
     * Documentation of system boundaries.
     * @implements SY-C1(b): system model boundary
     */
    systemBoundaryDocumentation?: Record<SystemReference, string>;
    
    /**
     * Documentation of system schematics.
     * @implements SY-C1(c): system schematic illustrating all equipment and components
     */
    systemSchematicReferences?: Record<SystemReference, {
      reference: string;
      description: string;
    }>;
    
    /**
     * Documentation of equipment operability considerations.
     * @implements SY-C1(d): information and calculations to support equipment operability
     */
    equipmentOperabilityDocumentation?: Record<string, {
      system: SystemReference;
      component: string;
      considerations: string;
      calculationReferences?: string[];
    }>;
    
    /**
     * Documentation of operational history.
     * @implements SY-C1(e): actual operational history or history in similar systems
     */
    operationalHistoryDocumentation?: Record<SystemReference, string[]>;
    
    /**
     * Documentation of success criteria relationship to event sequences.
     * @implements SY-C1(f): system success criteria and relationship to event sequence models
     */
    successCriteriaDocumentation?: Record<SystemReference, {
      criteria: string;
      relationshipToEventSequences: string;
    }>;
    
    /**
     * Documentation of human actions for system operation.
     * @implements SY-C1(g): human actions necessary for operation of system
     */
    humanActionsDocumentation?: Record<HumanActionReference, {
      system: SystemReference;
      description: string;
    }>;
    
    /**
     * Documentation of test and maintenance procedures.
     * @implements SY-C1(h): reference to system-related test and maintenance procedures
     */
    testMaintenanceProceduresDocumentation?: Record<SystemReference, string[]>;
    
    /**
     * Documentation of system dependencies and search methodology.
     * @implements SY-C1(i): system dependencies and shared component interface
     */
    dependencySearchDocumentation?: {
      methodology: string;
      dependencyTableReferences: string[];
    };
    
    /**
     * Documentation of spatial information and hazards.
     * @implements SY-C1(j): component spatial information, including hazards
     */
    spatialInformationDocumentation?: Record<string, {
      location: string;
      systems: SystemReference[];
      components: string[];
      hazards: string[];
    }>;
    
    /**
     * Documentation of modeling assumptions.
     * @implements SY-C1(k): assumptions or simplifications made in development of system models
     */
    modelingAssumptionsDocumentation?: Record<SystemReference, string[]>;
    
    /**
     * Documentation of components and failure modes included/excluded.
     * @implements SY-C1(l): components and failure modes included and justification for exclusion
     */
    componentsFailureModesDocumentation?: Record<SystemReference, {
      includedComponents: string[];
      excludedComponents: string[];
      justificationForExclusion: string;
      includedFailureModes: string[];
      excludedFailureModes: string[];
      justificationForFailureModeExclusion: string;
    }>;
    
    /**
     * Documentation of modularization process.
     * @implements SY-C1(m): description of the modularization process
     */
    modularizationDocumentation?: {
      description: string;
      systems: SystemReference[];
    };
    
    /**
     * Documentation of logic loop resolutions.
     * @implements SY-C1(n): records of resolution of logic loops developed during fault tree linking
     */
    logicLoopResolutionsDocumentation?: Record<string, {
      system: SystemReference;
      loopDescription: string;
      resolution: string;
    }>;
    
    /**
     * Documentation of system model evaluation results.
     * @implements SY-C1(o): results of the system model evaluations
     */
    evaluationResultsDocumentation?: Record<SystemReference, {
      topEventProbability: number;
      otherResults: Record<string, string>;
    }>;
    
    /**
     * Documentation of sensitivity studies results.
     * @implements SY-C1(p): results of sensitivity studies
     */
    sensitivityStudiesDocumentation?: Record<SystemReference, {
      studyDescription: string;
      results: string;
    }[]>;
    
    /**
     * Documentation of information sources.
     * @implements SY-C1(q): sources of information
     */
    informationSourcesDocumentation?: {
      drawings: string[];
      procedures: string[];
      interviews: string[];
      otherSources: string[];
    };
    
    /**
     * Documentation of basic events traceability.
     * @implements SY-C1(r): basic events in the system fault trees
     */
    basicEventsDocumentation?: Record<string, {
      system: SystemReference;
      description: string;
      moduleReference?: string;
      cutsetReference?: string;
    }>;
    
    /**
     * Documentation of nomenclature used in system models.
     * @implements SY-C1(s): nomenclature used in the system models
     */
    nomenclatureDocumentation?: Record<string, string>;
    
    /**
     * Documentation of digital I&C systems.
     * @implements SY-C1(t): treatment of digital instrumentation and control systems
     */
    digitalICDocumentation?: Record<SystemReference, {
      description: string;
      modelingApproach: string;
      specialConsiderations?: string;
    }>;
    
    /**
     * Documentation of passive systems.
     * @implements SY-C1(u): treatment of systems that perform their safety functions using passive means
     */
    passiveSystemsDocumentation?: Record<SystemReference, {
      description: string;
      uncertaintyEvaluation: string;
    }>;
  }
  
  /**
   * Interface representing documentation of model uncertainty in the systems analysis.
   * @group Documentation & Traceability
   * @implements SY-C2: DOCUMENT the sources of model uncertainty
   */
  export interface ModelUncertaintyDocumentation extends BaseModelUncertaintyDocumentation {
    /**
     * Systems-specific uncertainty impacts.
     * @implements SY-C2: DOCUMENT the sources of model uncertainty specific to systems analysis
     */
    systemSpecificUncertainties?: Record<SystemReference, {
      /** System-specific uncertainties */
      uncertainties: string[];
      
      /** Impact on system model */
      impact: string;
    }>;
    
    /**
     * Documentation of reasonable alternatives.
     * @implements SY-C2: DOCUMENT reasonable alternatives associated with the Systems Analysis
     */
    reasonableAlternatives: {
      /** Alternative approach */
      alternative: string;
      
      /** Reason not selected */
      reasonNotSelected: string;
      
      /** Affected systems */
      applicableSystems?: SystemReference[];
    }[];
    
    /**
     * Pre-operational assumptions affecting systems analysis
     * @implements SY-A33/B17: IDENTIFY pre-operational assumptions
     */
    preOperationalAssumptions?: Record<SystemReference, {
      assumptions: string[];
      impact: string;
    }>;
  }

  /**
   * Interface representing the Systems Analysis technical element.
   * @group Documentation & Traceability
   * @implements HLR-SY-A, HLR-SY-B, HLR-SY-C
   */
  export interface SystemsAnalysis extends TechnicalElement<TechnicalElementTypes.SYSTEMS_ANALYSIS> {
    /**
     * System definitions, including boundaries, components, and success criteria.
     * @implements SY-A1: DEVELOP system logic models
     * @implements SY-A3: DEFINE the boundaries of the system
     */
    systemDefinitions: Record<SystemReference, SystemDefinition>;
    
    /**
     * System logic models (e.g., fault trees).
     * @implements SY-A1: DEVELOP system logic models
     */
    systemLogicModels: Record<string, SystemLogicModel>;
    
    /**
     * Dependencies between systems.
     * @implements SY-B5: INCLUDE both intersystem and intrasystem dependencies
     */
    systemDependencies: SystemDependency[];
    
    /**
     * Dependencies between components within systems.
     * @implements SY-B5: INCLUDE both intersystem and intrasystem dependencies
     */
    componentDependencies: ComponentDependency[];
    
    /**
     * Common cause failure groups.
     * @implements SY-B1: IDENTIFY and MODEL the common cause failures
     * @implements SY-B4: EVALUATE appropriate common cause failure probabilities
     */
    commonCauseFailureGroups: Record<string, CommonCauseFailureGroup>;
    
    /**
     * Human failure events integrated into system models.
     * @implements SY-A1: INCLUDE human failures that can contribute to system unavailability
     */
    humanFailureEventIntegrations: HumanFailureEventIntegration[];
    
    /**
     * Methodology used to search for dependencies.
     * @implements SY-C1(i): process used for systematic search for dependencies including dependency tables
     */
    dependencySearchMethodology: DependencySearchMethodology;
    
    /**
     * System model evaluation results.
     * @implements SY-C1(o): results of the system model evaluations
     */
    systemModelEvaluations: Record<SystemReference, SystemModelEvaluation>;
    
    /**
     * Sensitivity studies on system models.
     * @implements SY-C1(p): results of sensitivity studies
     */
    sensitivityStudies: SystemSensitivityStudy[];
    
    /**
     * Considerations of potential overload conditions.
     * @implements SY-A29: IDENTIFY conditions that may require designed capabilities to be exceeded
     */
    overCapacityConsiderations: OverCapacityConsideration[];
    
    /**
     * Model validation methods.
     * @implements SY-A33: USE of external or independent reviews
     */
    modelValidations: ModelValidation[];
    
    /**
     * Digital instrumentation and control systems modeling.
     * @implements SY-C1(t): treatment of digital instrumentation and control systems
     */
    digitalInstrumentationAndControl: Record<string, DigitalInstrumentationAndControl>;
    
    /**
     * Passive safety systems modeling.
     * @implements SY-C1(u): treatment of systems that perform their safety functions using passive means
     */
    passiveSystemsTreatment: Record<string, PassiveSystemsTreatment>;
    
    /**
     * Documentation of the process used in the systems analysis.
     * @implements SY-C1: DOCUMENT the process used in the Systems Analysis
     */
    processDocumentation: ProcessDocumentation;
    
    /**
     * Documentation of model uncertainty in the systems analysis.
     * @implements SY-C2: DOCUMENT the sources of model uncertainty
     */
    modelUncertaintyDocumentation: ModelUncertaintyDocumentation;
    
    /**
     * Uncertainty analysis for systems.
     * @implements SY-B4: EVALUATE appropriate common cause failure probabilities
     */
    uncertaintyAnalysis?: Record<SystemReference, SystemUncertaintyAnalysis>;
  }

  /**
   * Interface mapping systems to safety functions
   * @implements SY-A1: IDENTIFY systems needed to provide or support safety functions
   * @group System Modeling & Failure Modes
   */
  export interface SystemToSafetyFunctionMapping extends Unique {
    /**
     * Reference to the system
     */
    systemReference: SystemReference;
    
    /**
     * Safety functions this system supports
     * @implements SY-A1: IDENTIFY systems needed to provide or support safety functions
     */
    safetyFunctions: string[];
    
    /**
     * Event sequences where this system is credited
     */
    eventSequences: string[];
  }

  /**
   * Interface for Low Power and Shutdown system configurations
   * @implements SY-A5/A6: INVESTIGATE systems and alignments unique to LPSD
   * @group System Modeling & Failure Modes
   */
  export interface LPSDSystemConfiguration extends Unique {
    /**
     * Reference to the system
     */
    systemReference: SystemReference;
    
    /**
     * Description of the LPSD-specific configuration
     * @implements SY-A5/A6: INVESTIGATE systems and alignments unique to LPSD
     */
    description: string;
    
    /**
     * Plant operating states where this configuration applies
     */
    applicablePOSs: string[];
    
    /**
     * Whether this configuration is unique to LPSD (not in Full-Power PRA)
     */
    uniqueToLPSD: boolean;
    
    /**
     * Source of information (e.g., past outage data, design information)
     */
    informationSource: string;
  }

  /**
   * Interface for documenting component screening justifications
   * @implements SY-A20: Screening criteria for excluding components
   * @group Documentation & Traceability
   */
  export interface ComponentScreeningJustification extends Unique {
    /**
     * Reference to the system
     */
    systemReference: SystemReference;
    
    /**
     * Component that was screened out
     */
    componentId: ComponentReference;
    
    /**
     * Failure modes that were screened out
     */
    failureModes?: FailureModeType[];
    
    /**
     * Screening criterion used (a or b from SY-A20)
     * @implements SY-A20: Screening criteria for excluding components
     */
    screeningCriterion: "a" | "b";
    
    /**
     * Quantitative justification for screening
     */
    quantitativeJustification: string;
  }

  /**
   * Minimal interface for support system success criteria
   * @group System Modeling & Failure Modes
   * @implements SY-B7/B8: Conservative vs. realistic success criteria
   */
  export interface SupportSystemSuccessCriteria extends Unique {
    /**
     * Reference to the support system
     */
    systemReference: SystemReference;
    
    /**
     * Success criteria for the support system
     */
    successCriteria: string;
    
    /**
     * Whether the success criteria are conservative or realistic
     */
    criteriaType: "conservative" | "realistic";
    
    /**
     * Systems supported by this support system
     */
    supportedSystems: SystemReference[];
  }

  /**
   * Minimal interface for environmental design basis considerations
   * @group System Modeling & Failure Modes
   * @implements SY-B14: IDENTIFY SSCs that may operate beyond design basis
   */
  export interface EnvironmentalDesignBasisConsideration extends Unique {
    /**
     * Reference to the system
     */
    systemReference: SystemReference;
    
    /**
     * Components that may operate beyond environmental design basis
     * @implements SY-B14: IDENTIFY SSCs that may operate beyond design basis
     */
    components: string[];
    
    /**
     * Event sequences where this may occur
     */
    eventSequences: string[];
    
    /**
     * Environmental conditions beyond design basis
     */
    environmentalConditions: string;
  }

  /**
   * Minimal interface for initiation and actuation systems
   * @group System Modeling & Failure Modes
   * @implements SY-B11/B12: MODEL initiation and actuation systems
   */
  export interface InitiationActuationSystem extends Unique, Named {
    /**
     * Reference to the system being initiated/actuated
     */
    systemReference: SystemReference;
    
    /**
     * Description of the initiation/actuation system
     * @implements SY-B11/B12: MODEL initiation and actuation systems
     */
    description: string;
    
    /**
     * Whether detailed modeling is used
     */
    detailedModeling: boolean;
  }