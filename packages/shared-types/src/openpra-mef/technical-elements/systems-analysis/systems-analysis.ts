/**
   * @module systems_analysis
   * @description Comprehensive types and interfaces for Systems Analysis (SY)
   * 
   * The objectives of Systems Analysis ensure that HLR-SY-A to HLR-SY-C are met.
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
  import { IdPatterns, ImportanceLevel, SensitivityStudy, BaseUncertaintyAnalysis, SuccessCriteriaId } from "../core/shared-patterns";
  import { BaseEvent, BasicEvent, TopEvent } from "../core/events";
  import { SaphireFieldMapping } from "../integration/SAPHIRE/saphire-annotations";
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
  import { Component, ComponentReference, ComponentTypeReference } from "../core/component";
  import {
      SuccessCriterion,
      SystemSuccessCriterion
  } from "../success-criteria/success-criteria-development";
  import { DistributionType, ProbabilityModel, ComponentBasicEvent } from '../data-analysis/data-analysis';
  import { QuantificationReferenceManager } from "../core/quantification-bridge";
  import { VersionInfo, SCHEMA_VERSION, createVersionInfo } from "../core/version";
  
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
   * Reference to a plant operating state
   * Format: POS-[NAME] (e.g., POS-FULL-POWER)
   * @group Core Definitions & Enums
   */
  export type PlantOperatingStateReference = string & tags.Pattern<"^POS-[A-Z0-9_-]+$">;
  
  /**
   * Simple reference to plant operating states for a system
   * @group Core Definitions & Enums
   */
  export interface PlantOperatingStatesReference {
    /**
     * List of plant operating states where this system is required
     */
    states: PlantOperatingStateReference[];
    
    /**
     * Optional description of how the system's requirements vary across states
     */
    stateSpecificRequirements?: Record<PlantOperatingStateReference, string>;
  }
  
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
   * @extends {BasicEvent} from core events module
   * @description Extends the core BasicEvent type with system-specific properties.
   * The core BasicEvent is defined in the upstream core/events.ts module and is the
   * authoritative source for basic event definitions across the codebase.
   * 
   * This follows the dependency structure where:
   * 1. Core events.ts (most upstream): Defines the base BasicEvent interface
   * 2. Systems-analysis.ts (midstream): Extends BasicEvent with system-specific properties
   * 3. Data-analysis.ts (downstream): Uses both BasicEvent and references SystemBasicEvent
   * @group System Modeling & Failure Modes
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
     * @implements SY-A31 
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
    
    /**
     * Probability model from data analysis module
     * Reuses the data analysis module's definition to avoid duplication
     */
    probabilityModel?: ProbabilityModel;
    
    /**
     * Reference to a ComponentBasicEvent in the data-analysis module
     * This establishes a link between systems analysis and data analysis
     */
    dataAnalysisBasicEventRef?: string;
    
    /**
     * Expression that can be used in place of a fixed probability
     * Used by the quantification adapter for parametric calculations
     * @deprecated Use probabilityModel from data-analysis module instead
     */
    expression?: {
      /** Fixed value (equivalent to the probability field) */
      value?: number;
      
      /** Parameter reference (for using model-wide parameters) */
      parameter?: string;
      
      /** Formula (using mathematical notation) */
      formula?: string;
      
      /** Expression type */
      type?: "constant" | "parameter" | "formula";
    };
    
    /**
     * Unit for the probability/frequency value
     * Used by the quantification adapter for proper unit conversion
     */
    unit?: "bool" | "int" | "float" | "hours" | "hours-1" | "years" | "years-1" | "fit" | "demands" | string;
    
    /**
     * Attributes for the quantification adapter
     * Enables passing additional information to the quantification engine
     */
    attributes?: { name: string; value: string }[];
    
    /**
     * Role of this basic event in quantification
     * Used by the quantification adapter for model organization
     */
    role?: "public" | "private" | "interface";
  }
  
  //==============================================================================
  /**
   * @group Temporal Modeling
   * @description Time-dependent component behaviors and phase modeling
   * @implements SY-A1
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
  
  /**
   * Extended Component interface for Systems Analysis
   * Uses composition pattern for template-instance relationships
   * 
   * @group System Modeling & Failure Modes
   * @extends Component
   */
  export interface SystemComponent extends Component {
    /**
     * Instance properties specific to systems analysis
     */
    instanceProperties?: {
      position?: string;
      serialNumber?: string;
      installationDetails?: {
        dateInstalled?: string;
        installedBy?: string;
      };
    };
    
    /**
     * Template-instance relationship (composition-based)
     */
    isTemplateInstance: boolean;
    templateReference?: ComponentTypeReference;
    
    /**
     * Hierarchical structure support
     */
    parentComponentId?: ComponentReference;
    
    /**
     * References to related entities
     */
    basicEventIds?: string[];  // References to ComponentBasicEvent
    failureModeIds?: string[]; // References to FailureMode
    
    /**
     * Failure data for quantification
     * This information is used directly by the quantification adapter
     */
    failureData?: {
      /** Failure rate for this component (per time unit) */
      failureRate?: number;
      
      /** Failure probability for this component (dimensionless) */
      failureProbability?: number;
      
      /** Time unit for the failure rate */
      timeUnit?: "hours" | "years" | string;
      
      /** Source of the failure data */
      dataSource?: string;
      
      /** Whether this component is part of a CCF group */
      isPartOfCCFGroup?: boolean;
      
      /** Reference to the CCF group */
      ccfGroupReference?: string;
    };
    
    /**
     * Quantification attributes
     * Additional parameters used by the quantification adapter
     */
    quantificationAttributes?: {
      name: string;
      value: string | number | boolean;
    }[];
  }
  
  /**
   * Record of changes made to a component template
   * Used for tracking template changes and propagation to instances
   * 
   * @group System Modeling & Failure Modes
   */
  export interface TemplateChangeRecord {
    /**
     * Reference to the template that was changed
     */
    templateReference: string;
    
    /**
     * Version of the template after the change
     */
    version: string;
    
    /**
     * Timestamp when the change was made
     */
    timestamp: string;
    
    /**
     * Description of changes made to the template
     */
    changes: string[];
    
    /**
     * Indicates if changes have been propagated to instances
     */
    changesPropagated: boolean;
    
    /**
     * Instances to exclude from change propagation
     */
    excludedInstances?: string[]; // Instances to exclude from propagation
  }
  
  /**
   * Configuration for template change propagation
   * Controls how changes to templates are propagated to instances
   * 
   * @group System Modeling & Failure Modes
   */
  export interface TemplatePropagationConfig {
    /**
     * Whether changes are automatically propagated to instances
     */
    autoPropagation: boolean;
    
    /**
     * Fields that should not be propagated when template changes
     */
    excludedFields?: string[];
    
    /**
     * Whether approval is required before propagating changes
     */
    approvalRequired: boolean;
  }
  
  /**
   * Registry for tracking template instances
   * Manages the relationships between templates and their instances
   * 
   * @group System Modeling & Failure Modes
   * @extends {Unique}
   */
  export interface TemplateInstanceRegistry extends Unique {
    /**
     * Registry of instances organized by template
     */
    instancesByTemplate: Record<string, string[]>; // TemplateReference -> InstanceReference[]
    
    /**
     * Current version of each template
     */
    templateVersions: Record<string, string>; // TemplateReference -> version
    
    /**
     * History of changes to templates
     */
    changeHistory: TemplateChangeRecord[];
    
    /**
     * Configuration for propagating changes
     */
    propagationConfig: TemplatePropagationConfig;
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
   * @implements SY-A1
   * @implements SY-A3
   */
  export interface SystemDefinition extends Unique, Named {
    /**
     * Description of the system's function and operation under normal and emergency conditions.
     * @implements SY-C1(a)
     * @example "The RHR system removes decay heat from the reactor core during shutdown conditions."
     */
    description?: string;
    
    /**
     * System boundaries, including components within the scope of the model.
     * @implements SY-A3(a)
     * @implements SY-C1(b)
     * @example ["Pump A", "Pump B", "Heat Exchanger", "Piping from RCS"]
     */
    boundaries: string[];
    
    /**
     * Components that make up this system
     * @implements SY-A7
     */
    components?: Record<ComponentReference, SystemComponent>;
    
    /**
     * Success criteria for the system to perform its intended safety function(s).
     * @implements SY-A2
     * @implements SY-C1(f)
     * @example "One of two pumps capable of delivering required flow."
     */
    successCriteria: string | SystemSuccessCriterion | SuccessCriteriaId;
    
    /**
     * Mission time for which the system is required to function.
     * @implements SY-A1
     * @example "24 hours"
     */
    missionTime?: string;
    
    /**
     * System schematic illustrating all equipment and components necessary for operation.
     * @implements SY-C1(c)
     * @example { reference: "Drawing XYZ-123", description: "P&ID of RHR System" }
     */
    schematic?: {
      reference: string;
      description?: string;
    };
    
    /**
     * Plant operating states where this system is required.
     * @implements SY-B14
     */
    plantOperatingStates?: PlantOperatingStatesReference;
    
    /**
     * Components and failure modes included in the model and justification for any exclusions.
     * @implements SY-A7
     * @implements SY-C1(l)
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
     * @implements SY-A7
     */
    justificationForExclusionOfComponents?: string[];
    
    /**
     * Justification for exclusion of any failure modes.
     * @implements SY-A19
     */
    justificationForExclusionOfFailureModes?: string[];
    
    /**
     * Human actions necessary for the operation of the system.
     * @implements SY-C1(g)
     * @example [{ actionRef: "HRA-001", description: "Operator aligns valves for recirculation." }]
     */
    humanActionsForOperation?: {
      actionRef: HumanActionReference;
      description: string;
    }[];
    
    /**
     * Reference to system-related test and maintenance procedures.
     * @implements SY-C1(h)
     * @example ["Procedure STM-RHR-001: Quarterly Pump Test"]
     */
    testMaintenanceProcedures?: string[];
    
    /**
     * Testing and maintenance requirements and practices relevant to system availability.
     * @implements SY-A3(d)
     * @example ["Quarterly pump testing", "Annual valve maintenance"]
     */
    testAndMaintenance?: string[];
    
    /**
     * Component spatial information and environmental hazards that may impact multiple systems.
     * @implements SY-C1(j)
     * @example [{ location: "Pump Room A", hazards: ["Potential flooding"] }]
     */
    spatialInformation?: {
      location: string;
      hazards?: string[];
      components?: string[];
    }[];
    
    /**
     * Assumptions or simplifications made in the development of the system model.
     * @implements SY-C1(k)
     * @example ["Piping failures are not explicitly modeled."]
     */
    modelAssumptions?: string[];
    
    /**
     * Information and calculations supporting equipment operability considerations and assumptions.
     * @implements SY-C1(d)
     * @example [{ component: "Pump A", calculationRef: "CALC-RHR-001" }]
     */
    operabilityConsiderations?: {
      component: string;
      calculationRef?: string;
      notes?: string;
    }[];
    
    /**
     * Operating limitations as per Technical Specifications or design basis.
     * @implements SY-A3(e)
     * @example ["Minimum of two pumps operable in shutdown."]
     */
    operatingLimitations?: string[];
    
    /**
     * Component operability and design limits.
     * @implements SY-A3(f)
     * @example [{ component: "Pump A", limit: "Flow rate > 500 gpm" }]
     */
    componentOperabilityLimits?: {
      component: string;
      limit: string;
    }[];
    
    /**
     * System configuration during normal and off-normal conditions, including alternative alignments.
     * @implements SY-A3(h)
     * @example ["Normal standby with valves open.", "Emergency injection mode."]
     */
    configurations?: string[];
    
    /**
     * Actual operational history or history in similar systems indicating past problems.
     * @implements SY-C1(e)
     * @example ["Two instances of pump seal failure in the last 5 years."]
     */
    operationalHistory?: string[];
    
    /**
     * Procedures for the operation of the system during normal and off-normal conditions.
     * @implements SY-A3(g)
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
     * @implements SY-A2
     */
    informationBasis: "as-built-as-operated" | "as-designed-as-intended";
    
    /**
     * For pre-operational PRAs, justification for information sources used
     * @implements SY-A4
     */
    preOperationalInformationJustification?: string;
  }
  
  /**
   * Interface for a system logic model (e.g., fault tree).
   * @group System Modeling & Failure Modes
   * @implements SY-A1
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
     * @implements SY-C1
     * @example "[[PumpA_Fail OR PumpB_Fail] AND [Power_Fail OR ControlSignal_Fail]]"
     */
    modelRepresentation: string;
    
    /**
     * Basic events included in the logic model and their descriptions.
     * @implements SY-C1(r)
     */
    basicEvents: SystemBasicEvent[];
    
    /**
     * Records of resolution of logic loops developed during fault tree linking (if used).
     * @implements SY-C1(n)
     * @example [{ loopId: "LOOP-001", resolution: "Implemented time-dependent gate." }]
     */
    logicLoopResolutions?: {
      loopId: string;
      resolution: string;
    }[];
    
    /**
     * The nomenclature used in the system models.
     * @implements SY-C1(s)
     */
    nomenclature?: Record<string, string>;
    
    /**
     * Fault tree representation of the system logic model, if applicable.
     * @implements SY-A1
     */
    faultTree?: FaultTree;
  }
  
  /**
   * Interface for digital instrumentation and control systems modeling.
   * @group System Modeling & Failure Modes
   * @implements SY-C1(t)
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
   * @implements SY-C1(u)
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
   * @implements SY-A1
   * @implements SY-A7
   * @implements SY-B1
   */
  //==============================================================================
  
  /**
   * Interface for a complete fault tree
   * @group Fault Tree Analysis
   * @implements SY-A1
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
     * @implements SY-A1
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
     * Gates in the fault tree - this structure aligns with the quantification adapter expectations
     * @note This field can be derived from nodes but is provided explicitly for adapter compatibility
     */
    gates?: Record<string, {
      id: string;
      name: string;
      description?: string;
      type: string;
      inputs: { id: string }[];
      k?: number; // For ATLEAST gates, the minimum number of inputs required
    }>;
    
    /**
     * Components referenced in this fault tree
     * Used by the quantification adapter for component mapping
     */
    components?: { 
      id: string; 
      name: string; 
      description?: string; 
    }[];
    
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

    /**
     * Validates special events in the fault tree
     * @returns true if all special events are valid, false otherwise
     */
    validateSpecialEvents(): boolean;

    /**
     * Optional SAPHIRE compatibility fields
     */
    saphireCompatibility?: {
        /** Field mappings between OpenPRA and SAPHIRE */
        saphireFieldMappings?: SaphireFieldMapping[];
        
        /** OpenPSA/SCRAM compatibility mappings */
        openPsaFieldMappings?: Record<string, string>;
    };
    
    /**
     * Attributes for quantification adapter
     * These are used by the adapter to provide additional information to the quantification engine
     */
    attributes?: { name: string; value: string }[];
  }
  
  /**
   * Interface representing a minimal cut set in a fault tree
   * @group Fault Tree Analysis
   * @implements SY-A1
   * @implements SY-C1(o)
   * 
   * @remarks
   * This interface defines the core structure of minimal cut sets as they are generated from system fault trees.
   * These cut sets are then used by Event Sequence Quantification to calculate sequence frequencies.
   * 
   * The relationship between Systems Analysis and Event Sequence Quantification is:
   * 1. Systems Analysis generates minimal cut sets from fault trees
   * 2. These cut sets are used as inputs to Event Sequence Quantification
   * 3. Event Sequence Quantification combines cut sets with sequence-specific factors
   * 4. The combined results are used to calculate sequence frequencies
   * 
   * @validation_rules
   * - Cut sets must be properly generated from fault trees
   * - Each event in a cut set must exist in the fault tree
   * - Cut set probabilities must be correctly calculated
   * - Truncation criteria must be consistently applied
   */
  export interface MinimalCutSet {
    /**
     * Array of basic event IDs that constitute this cut set
     */
    events: string[];
    
    /**
     * Order of the cut set (number of events)
     */
    order: number;
    
    /**
     * Individual probabilities of each event in the cut set
     * These are system-level probabilities that will be modified by sequence-specific factors
     * in Event Sequence Quantification
     */
    eventProbabilities: Record<string, number>;
    
    /**
     * Combined probability of the cut set occurring at the system level
     * This is the raw probability before sequence-specific modifications
     */
    probability: number;
    
    /**
     * Importance measure for this cut set at the system level
     */
    importance?: number;
    
    /**
     * Whether this cut set was included or truncated in the system analysis
     */
    truncationStatus?: "included" | "truncated";
    
    /**
     * Justification for truncation if applicable
     */
    truncationJustification?: string;
    
    /**
     * Reference to the fault tree this cut set belongs to
     */
    faultTreeReference: string;
    
    /**
     * Reference to the system this cut set belongs to
     */
    systemReference: SystemReference;
    
    /**
     * Validation status of this cut set
     */
    validationStatus?: {
      /**
       * Whether the cut set has been validated
       */
      isValidated: boolean;
      
      /**
       * Date of last validation
       */
      validationDate?: string;
      
      /**
       * Any validation issues found
       */
      validationIssues?: string[];
    };
  }
  
  /**
   * Enum for fault tree node types, representing standard FTA symbols
   * @group Core Definitions & Enums
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
    
    // Special Events
    TRUE_EVENT = "TRUE_EVENT",           // Probability = 1.0
    FALSE_EVENT = "FALSE_EVENT",         // Probability = 0.0
    PASS_EVENT = "PASS_EVENT",           // Logic flow control
    INIT_EVENT = "INIT_EVENT",           // Initiating event placeholder
    
    // Transfers
    TRANSFER_IN = "TRANSFER_IN",           // Triangle In: continues a branch from another page
    TRANSFER_OUT = "TRANSFER_OUT"          // Triangle Out: continues a branch on another page
  }
  
  /**
   * Unified interface for all fault tree nodes with type-specific properties
   * @group Fault Tree Analysis
   * 
   * @example
   * ```typescript
   * // Example using cross-module reference to data-analysis basic event
   * import { createBasicEventReference } from "../core/reference-types";
   * 
   * const basicEventNode: FaultTreeNode = {
   *   id: "BE1",
   *   nodeType: FaultTreeNodeType.BASIC_EVENT,
   *   name: "Pump Failure",
   *   usesDataAnalysisReference: true,
   *   dataAnalysisBasicEventRef: createBasicEventReference("PUMP_FAILURE_001")
   * };
   * ```
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
     * Reference to a basic event in the data-analysis module
     * Format: data:basic-event:{id}
     */
    dataAnalysisBasicEventRef?: string;
    
    /**
     * Whether this basic event references a data-analysis module entity
     */
    usesDataAnalysisReference?: boolean;
    
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

    /**
     * Value for PASS events
     */
    specialEventValue?: any;

    /**
     * Reference to initiating event for INIT events
     */
    initiatingEventRef?: string;
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
   * @implements SY-B5
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
   * @implements SY-B5
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
   * @implements SY-B1
   * @implements SY-B4
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
     * The common cause model used.
     * @implements SY-B4
     * @example "Multiple Greek Letter (MGL)"
     * The modelType field should align with the types expected by the quantification adapter:
     * - BETA_FACTOR, MGL, ALPHA_FACTOR, PHI_FACTOR are directly mapped
     * - Other types may require mapping in the adapter
     */
    modelType: "BETA_FACTOR" | "MGL" | "ALPHA_FACTOR" | "PHI_FACTOR" | string;
    
    /**
     * Parameters of the CCF model.
     * @example { betaFactor: 0.05 }
     */
    modelParameters?: Record<string, number>;
    
    /**
     * Total failure probability for a single component
     * This field is used directly by the quantification adapter
     */
    totalFailureProbability?: number;
    
    /**
     * Reference to CCF parameter in data analysis module
     * Links this CCF group to its corresponding parameter in data analysis
     */
    dataAnalysisCCFParameterRef?: string;
    
    /**
     * Members of this CCF group formatted for the quantification adapter
     * This structure directly aligns with the adapter's expected format
     */
    members?: {
      basicEvents: { id: string; name?: string }[];
    };
    
    /**
     * Model-specific parameters based on the modelType.
     * Different CCF models require different parameters.
     */
    modelSpecificParameters?: {
      /**
       * Beta factor model parameters (fraction of total component failure rate attributed to common cause)
       */
      betaFactorParameters?: {
        /**
         * Beta factor value (typically between 0.01 and 0.2)
         */
        beta: number;
        
        /**
         * Total failure probability for a single component
         */
        totalFailureProbability: number;
      };
      
      /**
       * Multiple Greek Letter (MGL) model parameters
       */
      mglParameters?: {
        /**
         * Beta factor (fraction of total failure that is common cause)
         */
        beta: number;
        
        /**
         * Gamma factor (conditional probability of three or more components failing)
         */
        gamma?: number;
        
        /**
         * Delta factor (conditional probability of four or more components failing)
         */
        delta?: number;
        
        /**
         * Additional factors for higher-order failures (optional)
         */
        additionalFactors?: Record<string, number>;
        
        /**
         * Total failure probability for a single component
         */
        totalFailureProbability: number;
      };
      
      /**
       * Alpha factor model parameters
       */
      alphaFactorParameters?: {
        /**
         * Alpha factors by failure multiplicity
         * Key is the number of components failing (e.g., "1" for single failures, "2" for double failures)
         * Value is the alpha factor for that multiplicity
         */
        alphaFactors: Record<string, number>;
        
        /**
         * Total failure probability for a single component
         */
        totalFailureProbability: number;
      };
      
      /**
       * Phi factor model parameters (direct specification of CCF probabilities)
       */
      phiFactorParameters?: {
        /**
         * Phi factors by failure multiplicity
         * Key is the number of components failing (e.g., "1" for single failures, "2" for double failures)
         * Value is the fraction of total probability for that multiplicity
         */
        phiFactors: Record<string, number>;
        
        /**
         * Total failure probability for a single component
         */
        totalFailureProbability: number;
      };
    };
    
    /**
     * Probability model from data analysis module
     * Reuses the data analysis module's definition to avoid duplication
     */
    probabilityModel?: ProbabilityModel;
    
    /**
     * CCF factors formatted specifically for the quantification adapter
     * This structure directly maps to the adapter's expected format
     */
    factors?: {
      factor: { level: number; expression: { value: number } }[];
    };
    
    /**
     * Defense mechanisms in place to prevent or mitigate CCF.
     * This is important for CCF analysis and can affect model parameters.
     */
    defenseMechanisms?: string[];
    
    /**
     * Shared cause factors that contribute to CCF potential.
     * These factors help justify the CCF group definition.
     */
    sharedCauseFactors?: {
      /**
       * Hardware design similarities
       */
      hardwareDesign?: boolean;
      
      /**
       * Same manufacturer
       */
      manufacturer?: boolean;
      
      /**
       * Same maintenance procedures
       */
      maintenance?: boolean;
      
      /**
       * Same installation procedures
       */
      installation?: boolean;
      
      /**
       * Shared environment
       */
      environment?: boolean;
      
      /**
       * Other shared factors
       */
      otherFactors?: string[];
    };
    
    /**
     * Justification for why this CCF is or is not risk-significant.
     * @implements SY-B1
     */
    riskSignificanceJustification?: string;
    
    /**
     * Supporting data sources for CCF parameters
     */
    dataSources?: {
      /**
       * Reference to the source
       */
      reference: string;
      
      /**
       * Description of the data source
       */
      description: string;
      
      /**
       * Whether this is plant-specific or generic data
       */
      dataType: "plant-specific" | "generic" | "expert-judgment";
    }[];
    
    /**
     * Mapping to guide how this CCF group should be quantified
     * Maps to the format required by quantification engines
     */
    quantificationMapping?: {
      /**
       * Mapping to OpenPSA/SCRAM format (for integration)
       */
      openPsaMapping?: {
        /**
         * CCF model type in OpenPSA format
         */
        modelType: "beta-factor" | "MGL" | "alpha-factor" | "phi-factor";
        
        /**
         * Factor mappings for OpenPSA
         */
        factorMappings?: Record<string, string>;
      };
    };
    
    /**
     * Attributes for the quantification adapter
     * Enables passing additional information to the quantification engine
     */
    attributes?: { name: string; value: string }[];
  }
  
  /**
   * Interface for a human failure event integrated into system models.
   * @group Dependencies & Common Cause Analysis
   * @implements SY-A1
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
   * @implements SY-C1(i)
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
   * @implements SY-B4
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
   * @implements SY-C1(o)
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
   * @implements SY-C1(p)
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
   * @implements SY-A29
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
   * @implements SY-A33
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
   * @implements SY-C1
   */
  export interface ProcessDocumentation extends BaseProcessDocumentation {
    /**
     * Documentation of system functions and operations.
     * @implements SY-C1(a)
     */
    systemFunctionDocumentation?: Record<SystemReference, string>;
    
    /**
     * Documentation of system boundaries.
     * @implements SY-C1(b)
     */
    systemBoundaryDocumentation?: Record<SystemReference, string>;
    
    /**
     * Documentation of system schematics.
     * @implements SY-C1(c)
     */
    systemSchematicReferences?: Record<SystemReference, {
      reference: string;
      description: string;
    }>;
    
    /**
     * Documentation of equipment operability considerations.
     * @implements SY-C1(d)
     */
    equipmentOperabilityDocumentation?: Record<string, {
      system: SystemReference;
      component: string;
      considerations: string;
      calculationReferences?: string[];
    }>;
    
    /**
     * Documentation of operational history.
     * @implements SY-C1(e)
     */
    operationalHistoryDocumentation?: Record<SystemReference, string[]>;
    
    /**
     * Documentation of success criteria relationship to event sequences.
     * @implements SY-C1(f)
     */
    successCriteriaDocumentation?: Record<SystemReference, {
      criteria: string;
      relationshipToEventSequences: string;
    }>;
    
    /**
     * Documentation of human actions for system operation.
     * @implements SY-C1(g)
     */
    humanActionsDocumentation?: Record<HumanActionReference, {
      system: SystemReference;
      description: string;
    }>;
    
    /**
     * Documentation of test and maintenance procedures.
     * @implements SY-C1(h)
     */
    testMaintenanceProceduresDocumentation?: Record<SystemReference, string[]>;
    
    /**
     * Documentation of system dependencies and search methodology.
     * @implements SY-C1(i)
     */
    dependencySearchDocumentation?: {
      methodology: string;
      dependencyTableReferences: string[];
    };
    
    /**
     * Documentation of spatial information and hazards.
     * @implements SY-C1(j)
     */
    spatialInformationDocumentation?: Record<string, {
      location: string;
      systems: SystemReference[];
      components: string[];
      hazards: string[];
    }>;
    
    /**
     * Documentation of modeling assumptions.
     * @implements SY-C1(k)
     */
    modelingAssumptionsDocumentation?: Record<SystemReference, string[]>;
    
    /**
     * Documentation of components and failure modes included/excluded.
     * @implements SY-C1(l)
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
     * @implements SY-C1(m)
     */
    modularizationDocumentation?: {
      description: string;
      systems: SystemReference[];
    };
    
    /**
     * Documentation of logic loop resolutions.
     * @implements SY-C1(n)
     */
    logicLoopResolutionsDocumentation?: Record<string, {
      system: SystemReference;
      loopDescription: string;
      resolution: string;
    }>;
    
    /**
     * Documentation of system model evaluation results.
     * @implements SY-C1(o)
     */
    evaluationResultsDocumentation?: Record<SystemReference, {
      topEventProbability: number;
      otherResults: Record<string, string>;
    }>;
    
    /**
     * Documentation of sensitivity studies results.
     * @implements SY-C1(p)
     */
    sensitivityStudiesDocumentation?: Record<SystemReference, {
      studyDescription: string;
      results: string;
    }[]>;
    
    /**
     * Documentation of information sources.
     * @implements SY-C1(q)
     */
    informationSourcesDocumentation?: {
      drawings: string[];
      procedures: string[];
      interviews: string[];
      otherSources: string[];
    };
    
    /**
     * Documentation of basic events traceability.
     * @implements SY-C1(r)
     */
    basicEventsDocumentation?: Record<string, {
      system: SystemReference;
      description: string;
      moduleReference?: string;
      cutsetReference?: string;
    }>;
    
    /**
     * Documentation of nomenclature used in system models.
     * @implements SY-C1(s)
     */
    nomenclatureDocumentation?: Record<string, string>;
    
    /**
     * Documentation of digital I&C systems.
     * @implements SY-C1(t)
     */
    digitalICDocumentation?: Record<SystemReference, {
      description: string;
      modelingApproach: string;
      specialConsiderations?: string;
    }>;
    
    /**
     * Documentation of passive systems.
     * @implements SY-C1(u)
     */
    passiveSystemsDocumentation?: Record<SystemReference, {
      description: string;
      uncertaintyEvaluation: string;
    }>;
  }
  
  /**
   * Interface representing documentation of model uncertainty in the systems analysis.
   * @group Documentation & Traceability
   * @implements SY-C2
   */
  export interface ModelUncertaintyDocumentation extends BaseModelUncertaintyDocumentation {
    /**
     * Systems-specific uncertainty impacts.
     * @implements SY-C2
     */
    systemSpecificUncertainties?: Record<SystemReference, {
      /** System-specific uncertainties */
      uncertainties: string[];
      
      /** Impact on system model */
      impact: string;
    }>;
    
    /**
     * Documentation of reasonable alternatives.
     * @implements SY-C2
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
     * @implements SY-A33/B17
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
     * @implements SY-A1
     * @implements SY-A3
     */
    systemDefinitions: Record<SystemReference, SystemDefinition>;
    
    /**
     * System logic models (e.g., fault trees).
     * @implements SY-A1
     */
    systemLogicModels: Record<string, SystemLogicModel>;
    
    /**
     * Dependencies between systems.
     * @implements SY-B5
     */
    systemDependencies: SystemDependency[];
    
    /**
     * Dependencies between components within systems.
     * @implements SY-B5
     */
    componentDependencies: ComponentDependency[];
    
    /**
     * Registry for tracking template instances and managing template changes
     */
    templateInstanceRegistry?: TemplateInstanceRegistry;
    
    /**
     * Common cause failure groups.
     * @implements SY-B1
     * @implements SY-B4
     */
    commonCauseFailureGroups: Record<string, CommonCauseFailureGroup>;
    
    /**
     * Human failure events integrated into system models.
     * @implements SY-A1
     */
    humanFailureEventIntegrations: HumanFailureEventIntegration[];
    
    /**
     * Methodology used to search for dependencies.
     * @implements SY-C1(i)
     */
    dependencySearchMethodology: DependencySearchMethodology;
    
    /**
     * System model evaluation results.
     * @implements SY-C1(o)
     */
    systemModelEvaluations: Record<SystemReference, SystemModelEvaluation>;
    
    /**
     * Sensitivity studies on system models.
     * @implements SY-C1(p)
     */
    sensitivityStudies: SystemSensitivityStudy[];
    
    /**
     * Considerations of potential overload conditions.
     * @implements SY-A29
     */
    overCapacityConsiderations: OverCapacityConsideration[];
    
    /**
     * Model validation methods.
     * @implements SY-A33
     */
    modelValidations: ModelValidation[];
    
    /**
     * Digital instrumentation and control systems modeling.
     * @implements SY-C1(t)
     */
    digitalInstrumentationAndControl: Record<string, DigitalInstrumentationAndControl>;
    
    /**
     * Passive safety systems modeling.
     * @implements SY-C1(u)
     */
    passiveSystemsTreatment: Record<string, PassiveSystemsTreatment>;
    
    /**
     * Documentation of the process used in the systems analysis.
     * @implements SY-C1
     */
    processDocumentation: ProcessDocumentation;
    
    /**
     * Documentation of model uncertainty in the systems analysis.
     * @implements SY-C2
     */
    modelUncertaintyDocumentation: ModelUncertaintyDocumentation;
    
    /**
     * Uncertainty analysis for systems.
     * @implements SY-B4
     */
    uncertaintyAnalysis?: Record<SystemReference, SystemUncertaintyAnalysis>;
    
    /**
     * Fault trees organized in a format directly accessible by the quantification adapter
     * This simplifies the conversion process compared to extracting them from systemLogicModels
     */
    faultTrees?: Record<string, FaultTree>;
    
    /**
     * Basic events organized in a flat structure for the quantification adapter
     * This provides easier access than searching through fault trees
     */
    systemBasicEvents?: Record<string, SystemBasicEvent>;
    
    /**
     * Reference to associated Data Analysis module
     * This field establishes the integration between Systems Analysis and Data Analysis
     * for use in system basic event quantification
     */
    dataAnalysisReference?: string;
    
    /**
     * Global parameters that can be used in expressions across the model
     * These parameters can be referenced by basic events and other model elements
     * Note: For complex parameter definitions, reference data-analysis module parameters
     */
    parameters?: Record<string, {
      id: string;
      name: string;
      description?: string;
      value: number;
      unit?: string;
      /**
       * Optional reference to a parameter in the data-analysis module
       * For more complex parameter types, use the data-analysis module directly
       */
      dataAnalysisParameterRef?: string;
    }>;
    
    /**
     * Attributes for the quantification adapter
     * Enables passing additional information to the quantification engine
     */
    attributes?: { name: string; value: string }[];
  }

  /**
   * Interface mapping systems to safety functions
   * @implements SY-A1
   * @group System Modeling & Failure Modes
   */
  export interface SystemToSafetyFunctionMapping extends Unique {
    /**
     * Reference to the system
     */
    systemReference: SystemReference;
    
    /**
     * Safety functions this system supports
     * @implements SY-A1
     */
    safetyFunctions: string[];
    
    /**
     * Event sequences where this system is credited
     */
    eventSequences: string[];
  }

  /**
   * Interface for Low Power and Shutdown system configurations
   * @implements SY-A5/A6
   * @group System Modeling & Failure Modes
   */
  export interface LPSDSystemConfiguration extends Unique {
    /**
     * Reference to the system
     */
    systemReference: SystemReference;
    
    /**
     * Description of the LPSD-specific configuration
     * @implements SY-A5/A6
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
   * @implements SY-A20
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
     * @implements SY-A20
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
   * @implements SY-B7/B8
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
   * @implements SY-B14
   */
  export interface EnvironmentalDesignBasisConsideration extends Unique {
    /**
     * Reference to the system
     */
    systemReference: SystemReference;
    
    /**
     * Components that may operate beyond environmental design basis
     * @implements SY-B14
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
   * @implements SY-B11/B12
   */
  export interface InitiationActuationSystem extends Unique, Named {
    /**
     * Reference to the system being initiated/actuated
     */
    systemReference: SystemReference;
    
    /**
     * Description of the initiation/actuation system
     * @implements SY-B11/B12
     */
    description: string;
    
    /**
     * Whether detailed modeling is used
     */
    detailedModeling: boolean;
  }

  /**
   * Example of creating a new systems analysis with proper versioning
   * @example
   * ```typescript
   * const analysis: SystemsAnalysis = {
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