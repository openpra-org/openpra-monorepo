/**
 * @packageDocumentation
 * @module plant_operating_states_analysis
 */

/**
 * @module plant_operating_states_analysis
 * @description Comprehensive types and interfaces for Plant Operating State Analysis (POS)
 * 
 * The objectives of Plant Operating State Analysis ensure that HLR-POS-A to HLR-POS-D are met.
 * 
 * Per RG 1.247, POSs are used to subdivide the plant operating cycle into unique states, such that the plant 
 * response can be assumed to be the same within the given POS for a given initiating event. The POS analysis 
 * defines the structure of the NLWR PRA, and all POSs and their key attributes should be clearly documented.
 * 
 * @preferred
 * @category Technical Elements
 */

import typia, { tags } from "typia";
import { TechnicalElement, TechnicalElementTypes, TechnicalElementMetadata } from "../technical-element";
import { Named, Unique } from "../core/meta";
import { InitiatingEvent, BaseEvent, Frequency, FrequencyWithDistribution } from "../core/events";
import { IdPatterns, ImportanceLevel, SensitivityStudy, ScreeningStatus, SuccessCriteriaId } from "../core/shared-patterns";
import { DistributionType } from "../data-analysis/data-analysis";
import { BaseAssumption } from "../core/documentation";
import { ComponentReference } from "../core/component";
import { VersionInfo, SCHEMA_VERSION, createVersionInfo } from "../core/version";

//==============================================================================
/**
 * @group Core Definitions & Enums
 * @description Basic types, enums, and utility interfaces used throughout the module
 */
//==============================================================================

/**
 * Represents the different operating states of a nuclear reactor system.
 * These are discrete modes that a plant can be in during its operational cycle.
 * @group Core Definitions & Enums
 * @example
 * const currentState: OperatingState = OperatingState.POWER;
 */
export enum OperatingState {
    /** Normal power operation */
    POWER = "POWER",
    
    /** Reactor startup sequence */
    STARTUP = "STARTUP",
    
    /** Normal shutdown state */
    SHUTDOWN = "SHUTDOWN",
    
    /** Refueling operations */
    REFUELING = "REFUELING",
    
    /** Maintenance period */
    MAINTENANCE = "MAINTENANCE"
}

/**
 * Enum representing the status of a radionuclide barrier.
 * Used to indicate the current state of barriers that prevent the release of radioactive materials.
 * @group Core Definitions & Enums
 */
export enum BarrierStatus {
    /**
     * Barrier is fully functional and providing its intended containment function
     */
    INTACT = "INTACT",
    
    /**
     * Barrier has been compromised and is no longer providing its intended containment function
     */
    BREACHED = "BREACHED",
    
    /**
     * Barrier is functioning below optimal levels but still providing some containment
     */
    DEGRADED = "DEGRADED",
    
    /**
     * Barrier has been intentionally bypassed (e.g., for maintenance)
     */
    BYPASSED = "BYPASSED",
    
    /**
     * Barrier is intentionally open (e.g., during refueling operations)
     */
    OPEN = "OPEN"
}

/**
 * Indicates the impact status of a reactor module in multi-module plants.
 * Used to represent how initiating events or hazards affect individual modules.
 * @group Core Definitions & Enums
 * @example
 * const moduleStatus: ModuleState = ModuleState.NOT_IMPACTED;
 */
export enum ModuleState {
    /** Module is directly impacted by the initiating event or hazard */
    IMPACTED = "IMPACTED",
    
    /** Module is not affected by the initiating event or hazard */
    NOT_IMPACTED = "NOT_IMPACTED",
    
    /** Module is indirectly or partially affected by the initiating event or hazard */
    PARTIALLY_IMPACTED = "PARTIALLY_IMPACTED"
}

/**
 * Interface representing the types of source locations.
 * @group Core Definitions & Enums
 */
export type SourceLocationType = 
    | "IN_CORE_SOURCE" 
    | "OUT_OF_CORE_SOURCE";

/**
 * Interface representing the system status.
 * @group Core Definitions & Enums
 */
export type SystemStatus = 
    | "YES" 
    | "NO";

//==============================================================================
/**
 * @group Plant Evolutions
 * @description Plant evolution definitions, transitions between states, and evolution characteristics
 * @implements POS-A1, POS-A2, POS-A9
 */
//==============================================================================

/**
 * Interface representing a time-varying condition within a plant operating state.
 * Conditions within a POS are not always constant, and certain parameters can change
 * over time, affecting the risk profile.
 * @group Plant Evolutions
 */
export interface TimeVaryingCondition extends Unique, Named {
    /** Time in hours from the start of the POS */
    time: number;
    
    /** Parameter that is changing (e.g., Decay Heat) */
    parameter: string;
    
    /** Value of the parameter at this time */
    value: number;
    
    /** Description of the impact on safety functions */
    impact: string;
    
    /** Units of measurement */
    units?: string;
    
    /** Associated uncertainty */
    uncertainty?: number;
    
    /** Whether this condition requires special monitoring */
    requiresMonitoring: boolean;
}


/**
 * Interface representing a transition event between plant operating states.
 * Transitions between states can introduce unique risks that need to be captured
 * and analyzed.
 * @group Plant Evolutions
 * @extends {Unique}
 */
export interface TransitionEvent extends Unique {
    /** Name of the transition event */
    name: string;
    
    /** Description of the transition */
    description?: string;
    
    /** ID of the source state */
    fromStateId: string;
    
    /** ID of the destination state */
    toStateId: string;
    
    /** Risks associated with this transition */
    risks: string[];
    
    /** Duration of the transition */
    duration?: number;
    
    /** 
     * Frequency of the transition (occurrences per year)
     * @description Can be either a simple numeric frequency or a complex object with distribution information
     */
    frequency?: Frequency | FrequencyWithDistribution;
    
    /** Special considerations during the transition */
    specialConsiderations?: string[];
    
    /** Operating procedures governing this transition */
    procedureIds?: string[];
    
    /** Critical parameters to monitor during the transition */
    criticalParameters?: string[];
    
    /**
     * Specific plant parameters that define this transition
     * Uses the reusable TransitionParameter interface
     */
    transitionParameters?: TransitionParameter[];
    
    /**
     * Risk significance of this transition
     */
    riskSignificance?: ImportanceLevel;
    
    /**
     * Mitigating actions to reduce transition risks
     */
    mitigatingActions?: string[];
    
    /**
     * Human actions required during this transition
     */
    requiredHumanActions?: string[];
    
    /**
     * Equipment that must be available during this transition
     */
    requiredEquipment?: string[];
    
    /**
     * Potential failure modes during this transition
     */
    potentialFailureModes?: string[];
}

/**
 * Interface representing plant evolution information.
 * Combines the original PlantEvolution with PlantEvolutionDescription and PlantEvolutionConsiderations.
 * @group Plant Evolutions
 * @implements POS-A1, POS-A2, POS-A9
 */
export interface PlantEvolution extends Unique, Named {
    /**
     * Description of the plant evolution.
     */
    description?: string;
    
    /**
     * Operating modes or operational conditions during the plant evolution.
     */
    operatingModes: string[];
    
    /**
     * Reactor coolant boundary (RCB) configurations, such as vented or not vented.
     */
    rcbConfigurations: string[];
    
    /**
     * Range of RCS parameters (e.g., power level, temperature, pressure).
     */
    rcsParameters: {
        powerLevel?: number;
        temperature?: number;
        pressure?: number;
        coolantInventory?: number;
    };
    
    /**
     * Available instrumentation for key parameters to be monitored.
     */
    availableInstrumentation: string[];
    
    /**
     * Activities that may lead to changes in the parameters.
     */
    activitiesLeadingToChanges: string[];
    
    /**
     * Status of radionuclide transport barriers.
     */
    radionuclideTransportBarriersStatus: string[];
    
    /**
     * Activities changing the capabilities of SSCs to support safety functions.
     */
    sscCapabilitiesChanges: string[];
    
    /**
     * Operational assumptions on full power, shutdown, refueling, and startup conditions.
     */
    operationalAssumptions: string[];
    
    /**
     * List of plant operating states within this evolution.
     */
    plantOperatingStates: PlantOperatingState[];
    
    /**
     * Descriptions of plant transitions with their PRA modes and screening status
     * @implements POS-A1
     */
    evolutionProperties?: {
        /** PRA mode for this transition */
        praMode: string;
        /** Screening status for this transition */
        screeningStatus: ScreeningStatus;
    };
    
    /**
     * Considerations for plant evolution
     * @implements POS-A2, POS-A9
     */
    evolutionConsiderations?: {
        /** Reactor coolant boundary configurations (e.g., vented, RCS penetrations, decay heat removal mechanism) */
        reactorCoolantBoundaryConfigurations: string[];
        
        /** Reactor coolant system parameter ranges */
        reactorCoolantSystemParameterRanges: string[];
        
        /** Available monitoring devices */
        availableMonitoringDevices: string[];
        
        /** Operator actions */
        operatorActions: string[];
        
        /** Radionuclide transport barrier status */
        radionuclideTransportBarrierStatus: string[];
        
        /** Screening status for these considerations */
        screeningStatus: ScreeningStatus;
        
        /** 
         * Hazard barrier effectiveness changes during transition 
         * Per RG 1.247, POS definitions should include consideration of changing plant conditions that may
         * impair or change the effectiveness of hazard barriers
         */
        hazardBarrierEffectivenessChanges?: string[];
        
        /** 
         * Propagation pathway modifications during transition 
         * Per RG 1.247, POS definitions should consider changes that may affect propagation pathways
         */
        propagationPathwayModifications?: string[];
        
        /** 
         * SSC fragility modifications during transition 
         * Per RG 1.247, POS definitions should consider changes that may modify fragilities of SSCs
         */
        sscFragilityModifications?: string[];
        
        /**
         * Transition parameters that define changes between states
         * Uses the reusable TransitionParameter interface
         */
        transitionParameters?: TransitionParameter[];
    };
    
    /**
     * Transitions between plant operating states within this evolution
     * Captures the details and risks associated with state transitions
     */
    transitions?: TransitionEvent[];
    
    /**
     * List of initiating events applicable to this evolution
     * References to initiating events defined in the core/events module
     */
    initiatingEvents?: InitiatingEvent[];
}

/**
 * Reusable interface for representing time boundaries of plant operating states.
 * Used to define when a POS begins and ends to ensure mutual exclusivity.
 * @group Plant Evolutions
 * @implements POS-B1, POS-B2, POS-B3
 */
export interface TimeBoundary {
    /** 
     * Starting condition or event that marks the beginning of this POS 
     * (e.g., "Reactor trip", "Begin control rod withdrawal")
     */
    startingCondition: string;
    
    /** 
     * Ending condition or event that marks the end of this POS
     * (e.g., "Criticality achieved", "Cold shutdown reached")
     */
    endingCondition: string;
    
    /**
     * Specific plant parameters that define this transition
     * Uses the reusable TransitionParameter interface
     */
    transitionParameters?: TransitionParameter[];
}

/** 
 * Reusable interface for representing transition parameters.
 * Used to define specific plant parameters that mark transitions between states.
 * @group Plant Evolutions
 */
export interface TransitionParameter {
    /** The plant parameter name */
    parameter: string;
    
    /** The threshold value that marks the transition */
    value: string | number;
    
    /** Units of measurement, if applicable */
    units?: string;
    
    /** Whether this parameter is being monitored */
    monitored?: boolean;
    
    /** Instruments used to monitor this parameter */
    monitoringInstruments?: string[];
}

//==============================================================================
/**
 * @group Plant Operating States
 * @description Plant operating states and their characteristics
 * @implements POS-A3, POS-A5, POS-A6, POS-A7, POS-A8
 */
//==============================================================================

/**
 * Interface representing an instrument used to monitor key plant parameters.
 * This helps ensure adequate instrumentation for each plant operating state.
 * @group Plant Operating States
 * @implements POS-A8
 */
export interface Instrument extends Unique, Named {
    /** Parameter being monitored (e.g., Temperature, Pressure) */
    parameter: string;
    
    /** Location of the instrument in the plant */
    location: string;
    
    /** Accuracy of the instrument (e.g., ±1%) */
    accuracy: number;
    
    /** Whether the instrument is available in this plant operating state */
    availability: boolean;
    
    /** Range of the instrument */
    range?: [number, number];
    
    /** Units of measurement */
    units?: string;
    
    /** Calibration requirements */
    calibrationRequirements?: string;
    
    /** Whether the instrument is safety-related */
    safetyRelated: boolean;
}

/**
 * Interface representing decay heat removal systems.
 * @group Plant Operating States
 * @implements POS-A4
 */
export interface DecayHeatRemovalSystems {
    /** Primary cooling systems available */
    primaryCoolingSystems: Record<string, SystemStatus>;
    /** Secondary cooling systems available */
    secondaryCoolingSystems: Record<string, SystemStatus>;
}

/**
 * Interface representing reactor coolant system parameter ranges.
 * Per RG 1.247, POS definitions should consider decay heat level, Reactor Coolant System (RCS) configuration, 
 * reactor level (for reactors with liquid coolant), reactor pressure and temperature,
 * and other parameters needed to determine success criteria.
 * @group Plant Operating States
 * @implements POS-A5, POS-B2
 */
export interface ReactorCoolantSystemParameters {
    /** Power level range [min, max] as fraction of rated power */
    powerLevel: [number & tags.Minimum<0>, number & tags.Maximum<1>];
    
    /** Decay heat level range [min, max] as fraction of rated power */
    decayHeatLevel: [number & tags.Minimum<0>, number & tags.Maximum<1>];
    
    /** Reactor coolant temperature range at control volume 1 [min, max] */
    reactorCoolantTemperatureAtControlVolume1: [number & tags.Minimum<0>, number & tags.Maximum<1>];
    
    /** Coolant pressure range at control volume 1 [min, max] */
    coolantPressureAtControlVolume1: [number & tags.Minimum<0>, number & tags.Maximum<1>];
    
    /** Other parameter ranges [min, max] */
    others?: [number, number];
    
    /** 
     * For reactors with liquid coolant, reactor level range [min, max] 
     * Per RG 1.247, POS definitions should consider reactor level (for reactors with liquid coolant)
     */
    reactorLevel?: [number & tags.Minimum<0>, number & tags.Maximum<1>];
    
    /**
     * Time after shutdown or scram, if applicable [hours]
     * Affects decay heat calculations and time-to-boil estimates
     */
    timeAfterShutdown?: number;
    
    /**
     * RCS configuration description
     * Per RG 1.247, POS definitions should consider RCS configuration
     */
    rcsConfigurationDescription?: string;
}

/**
 * Interface representing radionuclide transport barriers.
 * @group Plant Operating States
 * @implements POS-A5
 */
export interface RadionuclideTransportBarriers {
    /** Status of barrier 1 */
    barrier1: BarrierStatus;
    /** Status of barrier 2 */
    barrier2: BarrierStatus;
    /** Status of other barriers */
    [key: string]: BarrierStatus;
}

/**
 * Interface representing the risk significance of a plant operating state.
 * Different POSs contribute differently to overall plant risk, and this
 * interface captures that information.
 * @group Plant Operating States
 */
export interface OperatingStateRisk {
    /** ID of the plant operating state */
    stateId: string;
    
    /** Name of the plant operating state */
    stateName: string;
    
    /** Contribution to total risk (e.g., percentage) */
    riskContribution: number;
    
    /** Risk metrics for this operating state */
    riskMetrics: {
        /** 
         * Core Damage Frequency 
         * @description Can be either a simple numeric frequency or a complex object with distribution information
         */
        CDF: Frequency | FrequencyWithDistribution;
        
        /** 
         * Large Early Release Frequency 
         * @description Can be either a simple numeric frequency or a complex object with distribution information
         */
        LERF: Frequency | FrequencyWithDistribution;
    };
    
    /** List of risk-significant contributors */
    riskSignificantContributors: string[];
    
    /** Importance measures for key components */
    importanceMeasures?: {
        /** Component ID */
        componentId: ComponentReference;
        
        /** Fussell-Vesely importance */
        fussellVesely?: number;
        
        /** Risk Achievement Worth */
        RAW?: number;
        
        /** Risk Reduction Worth */
        RRW?: number;
    }[];
}

/**
 * Interface representing a plant operating state (POS).
 * Per RG 1.247, a POS represents distinct and relatively constant plant conditions. The POS is defined
 * in terms of all important conditions that may affect the delineation and evaluation of event sequences
 * modeled in the PRA. POS definitions should consider decay heat level, RCS configuration, reactor level,
 * reactor pressure and temperature, radionuclide transport configuration, status of barriers, available
 * instrumentation, and other parameters needed to determine success criteria and source terms.
 * @group Plant Operating States
 * @extends {Unique}
 * @extends {Named}
 * @implements POS-A3, POS-A5, POS-A6, POS-A7, POS-A8, POS-B1, POS-B2, POS-B3
 */
export interface PlantOperatingState extends Unique, Named {
    /** Description of the plant operating state */
    description?: string;
    
    /** Characteristics of the operating state */
    characteristics?: string;
    
    /** Process criteria identification for transitions */
    processCriteriaIdentification?: string;
    
    /**
     * Explicit time boundary that defines when this POS begins and ends
     * Used to ensure mutual exclusivity between operating states
     * @implements POS-B1, POS-B2, POS-B3
     */
    timeBoundary: TimeBoundary;
    
    /** Sources of radioactive material within the scope of the PRA */
    radioactiveMaterialSources: string[];
    
    /** Detailed information about radioactive sources in this POS */
    detailedRadioactiveSources?: RadioactiveSource[];
    
    /** Operating mode or operational condition of the plant */
    operatingMode: OperatingState;
    
    /** Reactor Coolant Boundary configuration */
    rcbConfiguration: string;
    
    /** Reactor coolant system parameter ranges */
    rcsParameters: ReactorCoolantSystemParameters;
    
    /** Decay heat removal systems available */
    decayHeatRemoval: DecayHeatRemovalSystems;
    
    /** Available instrumentation for monitoring key parameters */
    availableInstrumentation: string[];
    
    /** Detailed information about available instruments */
    detailedInstrumentation?: Instrument[];
    
    /** Activities that may lead to changes in parameters */
    activitiesLeadingToChanges?: string[];
    
    /** Radionuclide transport barrier statuses */
    radionuclideTransportBarrier: RadionuclideTransportBarriers;
    
    /** 
     * Initiating events applicable to this state 
     * References to initiating events defined in the core/events module
     */
    initiatingEvents: InitiatingEvent[];
    
    /** Safety functions and their status in this operating state */
    safetyFunctions: SafetyFunction[];
    
    /** Mean duration of the plant operating state in hours */
    meanDuration: number;
    
    /** Mean time since shutdown in hours */
    meanTimeSinceShutdown?: number;
    
    /** 
     * Mean frequency of the plant operating state 
     * @description Can be either a simple numeric frequency or a complex object with distribution information
     */
    meanFrequency?: Frequency | FrequencyWithDistribution;
    
    /** Assumptions made in defining this operating state */
    assumptions?: string[];
    
    /** 
     * References to success criteria specific to this operating state
     * These IDs reference success criteria defined in the success-criteria module
     * Format: SC-[SYSTEM]-[NUMBER], e.g., "SC-RCIC-001"
     */
    successCriteriaIds?: SuccessCriteriaId[];
    
    /**
     * Time-varying conditions within this POS
     * Captures how conditions change over time during the POS
     */
    timeVaryingConditions?: TimeVaryingCondition[];
    
    /**
     * Risk significance of this operating state
     * Captures the contribution to overall plant risk
     */
    riskSignificance?: OperatingStateRisk;
    
    /**
     * Plant representation accuracy for this POS
     * Documents how closely the PRA model represents the as-built and as-operated plant
     */
    plantRepresentationAccuracy?: PlantRepresentationAccuracy & {
        /** Areas with high confidence */
        highConfidenceAreas?: string[];
        
        /** Areas with lower confidence */
        lowerConfidenceAreas?: string[];
        
        /** Plans for improvement */
        improvementPlans?: string[];
    };
}

/**
 * Interface representing plant operating states table.
 * @group Plant Operating States
 * @implements POS-A3, POS-B3
 */
export interface PlantOperatingStatesTable {
    /** Startup operating state */
    startUp: PlantOperatingState;
    /** Controlled shutdown operating state */
    controlledShutdown: PlantOperatingState;
    /** Full power operating state */
    fullPower: PlantOperatingState;
    /** Other operating states */
    [key: string]: PlantOperatingState;
}

/**
 * Interface representing operating states frequency and duration data.
 * Per RG 1.247, the duration and number of entries into each POS must be determined.
 * This interface captures the historical data used to determine these frequencies and durations.
 * @description Operating state frequency calculation, duration tracking, and time-based relationships
 * @group Plant Operating States
 * @implements POS-C1, POS-C2, POS-C3, POS-C4
 */
export interface OperatingStatesFrequencyDuration {
    /** Outage plans and records */
    outagePlansRecords: {
        startDate: string;
        endDate: string;
        description: string;
        /** 
         * Frequency per year
         * @description Can be either a simple numeric frequency or a complex object with distribution information
         */
        frequencyPerYear: Frequency | FrequencyWithDistribution;
    }[];
    
    /** Maintenance plans and records */
    maintenancePlansRecords: {
        startDate: string;
        endDate: string;
        description: string;
        /** 
         * Frequency per year
         * @description Can be either a simple numeric frequency or a complex object with distribution information
         */
        frequencyPerYear: Frequency | FrequencyWithDistribution;
    }[];
    
    /** Operations data */
    operationsData: {
        startDate: string;
        endDate: string;
    }[];
    
    /** Trip history */
    tripHistory: {
        date: string;
        description: string;
    }[];
    
    /** 
     * Summary of POS frequency and duration analysis 
     * Per RG 1.247, the duration and number of entries into each POS must be determined
     */
    summary?: {
        /** Name of the plant operating state */
        posName: string;
        /** Average duration of the operating state in hours */
        averageDuration: number;
        /** Number of entries per year */
        entriesPerYear: number;
        /** Fraction of time spent in this operating state */
        fractionOfTime: number;
    }[];
}

//==============================================================================
/**
 * @group State Screening & Grouping
 * @description Grouping logic for both states and evolutions, screening criteria and implementation
 * @implements POS-B1, POS-B2, POS-B3, POS-B4, POS-B5, POS-B6, POS-B7, POS-B8
 */
//==============================================================================

/**
 * Interface for grouping plant operating states based on similar characteristics.
 *
 * Per RG 1.247, "LPSD types of POSs that are subsumed into each other are shown 
 * to be represented by the characteristics of the subsuming group."
 * @group State Screening & Grouping
 * @extends {Unique}
 * @extends {Named}
 * @implements POS-B4, POS-B5, POS-B6
 */
export interface PlantOperatingStatesGroup extends Unique, Named {
    /** Description of the plant operating state group */
    description?: string;
    
    /** IDs of plant operating states included in this group */
    plantOperatingStateIds: string[];
    
    /** Justification for grouping these plant operating states together */
    groupingJustification: string;
    
    /** Representative characteristics of the group */
    representativeCharacteristics: string[];
}

/**
 * Assumptions made due to lack of as-built and as-operated details
 * @group State Screening & Grouping
 * @implements POS-A13, POS-B8
 */
export interface AssumptionsLackOfDetail {
    /**
     * Description of the assumption made
     */
    description: string;
    
    /**
     * Influences of plant operating state definitions
     */
    influence: string;
    
    /**
     * Impact assessment of this assumption on risk
     */
    riskImpact: ImportanceLevel;
    
    /**
     * Justification for the assumption
     */
    justification?: string;
    
    /**
     * Planned actions to validate or refine this assumption
     */
    plannedActions?: string[];
    
    /**
     * Affected plant operating states
     */
    affectedPOSIds?: string[];
    
    /**
     * Potential alternatives to this assumption
     */
    potentialAlternatives?: string[];
    
    /**
     * Sensitivity analysis results, if performed
     */
    sensitivityAnalysis?: string;
}

/**
 * Reusable interface for representing subsumed plant operating states.
 * Used to document when one POS is subsumed into another for analysis simplification.
 
 * This interface is critical for regulatory compliance as it provides structured
 * documentation of POS grouping decisions. It directly supports HLR-POS-B requirements
 * 
 * Key regulatory requirements addressed:
 * - POS-B3
 * - POS-B5
 * - POS-B6
 * - POS-D1
 * 
 * Without this interface, it would be difficult to maintain a clear record of which
 * plant operating states were combined, why they were combined, and what analysis
 * was performed to ensure the combination doesn't impact risk insights.
 * @group State Screening & Grouping
 * @implements POS-B5, POS-B6
 */
export interface SubsumedPOS {
    /** ID or name of the POS being subsumed */
    subsumedPOS: string;
    
    /** ID or name of the POS that is subsuming the other */
    subsumingPOS: string;
    
    /** Justification for why this subsumption is valid */
    justification: string;
    
    /** Risk impact assessment of this subsumption */
    riskImpact?: ImportanceLevel;
    
    /** Limitations introduced by this subsumption */
    limitations?: string[];
    
    /** Validation method used to confirm the subsumption is appropriate */
    validationMethod?: string;
    
    /** 
     * Sensitivity analysis for this subsumption
     * Replaced simple string with standardized SensitivityStudy interface
     */
    sensitivityAnalysis?: SensitivityStudy;
}


//==============================================================================
/**
 * @group Safety Functions, Barriers & Sources
 * @description Safety function definitions, implementation mechanisms, and success criteria. Radioactive/hazardous sources and barrier-related interfaces
 * @implements POS-A4
 */
//==============================================================================

/**
 * Interface representing a safety function in the plant operating state.
 * 
 * Safety functions include reactivity control, reactor coolant chemistry control,
 * decay heat removal control, RCS inventory/barrier control, radionuclide transport
 * barrier control, and ex-vessel fission product control.
 * 
 * Per RG 1.247, "The POS safety functions to consider include reactivity control, 
 * reactor coolant chemistry control, decay heat removal control, reactor coolant system (RCS) 
 * inventory/barrier control, radionuclide transport barrier control, and ex-vessel 
 * fission product control (e.g., off-gas tanks/fuel salt storage tanks/spent fuel pools)."
 * @group Safety Functions, Barriers & Sources
 * @extends {Unique}
 * @extends {Named}
 * @implements POS-A4
 */
export interface SafetyFunction extends Unique, Named {
    /** Description of the safety function */
    description?: string;
    
    /** Current state of the safety function */
    state: "SUCCESS" | "FAILURE";
    
    /** Success and failure criteria */
    criteria?: {
        success: string;
        failure: string;
    };
    
    /** System responses related to this safety function */
    systemResponses?: string[];
    
    /** Dependencies for this safety function */
    dependencies?: {
        /** Type of dependency */
        type: string;
        /** Description of the dependency */
        description: string;
    }[];
    
    /** Prevention or mitigation level provided by this safety function */
    preventionMitigationLevel?: string;
    
    /** 
     * References to success criteria for this safety function
     * These IDs reference success criteria defined in the success-criteria module
     * Format: SC-[SYSTEM]-[NUMBER], e.g., "SC-RCIC-001"
     */
    successCriteriaIds?: SuccessCriteriaId[];
    
    /**
     * Initiating events this safety function responds to
     * These reference initiating events defined in the core/events module
     */
    initiatingEvents?: {
        /** ID of the initiating event */
        id: string;
        
        /** Name of the initiating event (for convenience) */
        name?: string;
        
        /** How effective this safety function is against this initiating event */
        effectiveness?: string;
    }[];
    
    /**
     * Category of safety function
     * Technology-agnostic categorization of the safety function
     */
    category: string;
    
    /**
     * Implementation mechanisms for this safety function
     * Technology-agnostic description of how the safety function is implemented
     */
    implementationMechanisms: Array<{
        /** Name of the mechanism */
        name: string;
        
        /** Description of the mechanism */
        description: string;
        
        /** Current operational status of this mechanism */
        status: string;
        
        /** Detailed status information */
        statusDetails?: string;
        
        /** Whether this is an active or passive mechanism */
        type: string;
        
        /** Reliability information for this mechanism */
        reliability?: {
            /** Mean time between failures (hours) */
            mtbf?: number;
            
            /** Probability of failure on demand */
            pfd?: number;
        };
    }>;
    
    /**
     * Operational parameters relevant to this safety function
     * Technology-agnostic parameters that affect the function's performance
     */
    operationalParameters?: Array<{
        /** Name of the parameter */
        name: string;
        
        /** Current value or state of the parameter */
        value: string | number;
        
        /** Units of measurement, if applicable */
        units?: string;
        
        /** Acceptable range for this parameter */
        acceptableRange?: [number, number];
        
        /** Whether this parameter is being monitored */
        monitored: boolean;
        
        /** Instruments used to monitor this parameter */
        monitoringInstruments?: string[];
    }>;
    
    /**
     * Degradation mechanisms that could affect this safety function
     */
    degradationMechanisms?: Array<{
        /** Name of the degradation mechanism */
        name: string;
        
        /** Description of the mechanism */
        description: string;
        
        /** Current status of this degradation mechanism */
        status: string;
        
        /** Mitigation measures in place */
        mitigationMeasures?: string[];
    }>;
}

/**
 * Describes a barrier preventing radionuclide release
 * @example
 * const containment: RadionuclideBarrier = {
 *   uuid: "CONT-01",
 *   name: "Primary Containment",
 *   state: BarrierStatus.INTACT,
 *   monitoringParameters: ["pressure", "temperature", "radiation"],
 *   breachCriteria: ["pressure > 60 psig", "temperature > 280°F"]
 * };
 * @group Safety Functions, Barriers & Sources
 */
export interface RadionuclideBarrier extends Unique, Named {
    /** Current status of the barrier */
    state: BarrierStatus;
    /** Parameters being monitored for this barrier */
    monitoringParameters?: string[];
    /** Criteria that would indicate a breach of this barrier */
    breachCriteria?: string[];
    /** Description of the barrier */
    description?: string;
}

/**
 * Interface for representing a radioactive source in the plant.
 * This covers both in-vessel (e.g., reactor core) and ex-vessel (e.g., spent fuel pool) sources.
 * Incorporates SourceDefinition to reduce fragmentation.
 * @group Safety Functions, Barriers & Sources
 * @implements POS-A6, POS-A7
 */
export interface RadioactiveSource extends Unique, Named {
    /** Location of the source - in-vessel or ex-vessel */
    location: "IN_VESSEL" | "EX_VESSEL";
    
    /** Source location type for screening purposes */
    sourceLocation?: SourceLocationType;
    
    /** Detailed description of the source */
    description: string;
    
    /** List of significant radionuclides present in this source */
    radionuclides: string[];
    
    /** Current status of the source */
    status: string;
    
    /** Potential release pathways for this source */
    releasePaths?: string[];
    
    /** Barriers in place to prevent release */
    barriers?: string[];
    
    /** Screening status of this source */
    screeningStatus: ScreeningStatus;
}

/**
 * Interface representing hazardous sources in operating state analysis.
 * Per RG 1.247, POS definitions should include all sources of radioactive material within the scope of the PRA,
 * including ex-vessel sources, unless there is a documented technical justification for excluding ex-vessel sources.
 * @group Safety Functions, Barriers & Sources
 * @implements POS-A6, POS-A7
 */
export interface HazardousSources {
    /** Source definitions with their screening status */
    sourceDefinition: Record<SourceLocationType, ScreeningStatus>;
    
    /** Detailed information about radioactive sources */
    detailedSources?: RadioactiveSource[];
    
    /** Operating states information */
    operatingStates: PlantOperatingStatesTable;
    
    /** Operating states frequency and duration data */
    operatingStatesFrequencyDuration: OperatingStatesFrequencyDuration;
    
    /** Plant evolution information */
    plantEvolution: PlantEvolution;
    
    /** Technical justification for excluding any ex-vessel sources, if applicable */
    exVesselSourceExclusionJustification?: string;
}

//==============================================================================
/**
 * @group Documentation & Traceability
 * @description Process documentation, uncertainty and assumption tracking, peer review findings, and validation and verification elements
 * @implements POS-D1, POS-D2, POS-D3, POS-B1, POS-B7
 */
//==============================================================================

/**
 * Interface for validation rules to ensure plant operating states are correctly defined
 * and cover the entire plant operating cycle.
 * 
 * This is part of the Documentation & Traceability group but has a critical validation role.
 * @group Documentation & Traceability
 * @implements POS-B1, POS-B7
 */
export interface POSValidationRules {
    /**
     * Validates that the defined POSs are mutually exclusive (no overlap between states)
     * This ensures that a given plant condition belongs to exactly one POS
     */
    mutualExclusivityRules: {
        /** Description of how mutual exclusivity is ensured */
        description: string;
        
        /** Parameters used to clearly delineate between POSs */
        delineationParameters: string[];
        
        /** Verification method used to confirm mutual exclusivity */
        verificationMethod: string;
    };
    
    /**
     * Validates that the defined POSs are collectively exhaustive (cover the entire plant cycle)
     * This ensures that all plant conditions are captured by the defined POSs
     */
    collectiveExhaustivityRules: {
        /** Description of how collective exhaustivity is ensured */
        description: string;
        
        /** Method to verify complete coverage of the operating cycle */
        verificationMethod: string;
        
        /** Confirmation that all possible plant configurations are covered */
        configurationCoverage: string;
    };
    
    /**
     * Rules for transitions between POSs
     * Ensures that transitions between POSs are well-defined and complete
     */
    transitionRules: {
        /** Matrix or list documenting all possible transitions between POSs */
        transitionMatrix: Record<string, string[]>;
        
        /** Parameters or conditions that trigger transitions */
        transitionTriggers: Record<string, string>;
    };
}



/**
 * Reusable interface for representing model uncertainty information.
 * Used to document sources of uncertainty in the model.
 * @group Documentation & Traceability
 */
export interface ModelUncertaintyInfo {
    /** Source of the uncertainty */
    source: string;
    
    /** Description of the uncertainty */
    description: string;
    
    /** Impact level of the uncertainty */
    impact: ImportanceLevel;
    
    /** How the uncertainty is treated in the model */
    treatment: string;
    
    /** Reasonable alternatives that could be considered */
    reasonableAlternatives?: string[];
}

/**
 * Reusable interface for representing peer review findings.
 * Used to document feedback from peer reviews and responses.
 * @group Documentation & Traceability
 */
export interface PeerReviewFinding {
    /** ID of the peer review finding */
    findingId: string;
    
    /** Description of the finding */
    description: string;
    
    /** Category of the finding */
    category: string;
    
    /** Significance of the finding (HIGH/MEDIUM/LOW) */
    significance: ImportanceLevel;
    
    /** Response to the finding */
    response: string;
    
    /** Actions taken to address the finding */
    actions?: string[];
    
    /** Resolution status */
    status: "OPEN" | "CLOSED" | "IN_PROGRESS";
}

/**
 * Reusable interface for representing transition risks.
 * Used to document risks associated with transitions between operating states.
 * @group Documentation & Traceability
 */
export interface TransitionRisk {
    /** ID of the transition */
    transitionId: string;
    
    /** Description of the transition */
    description: string;
    
    /** Risks associated with the transition */
    risks: string[];
    
    /** Significance of the risks */
    significance: ImportanceLevel;
    
    /** Mitigating actions */
    mitigatingActions?: string[];
    
    /** Human actions required during this transition */
    requiredHumanActions?: string[];
    
    /** Equipment that must be available during this transition */
    requiredEquipment?: string[];
}

/**
 * Reusable interface for representing plant representation accuracy assessments.
 * Used to document how closely the PRA model represents the as-built and as-operated plant.
 * @group Documentation & Traceability
 */
export interface PlantRepresentationAccuracy {
    /** Degree of accuracy */
    accuracy: ImportanceLevel;
    
    /** Basis for accuracy assessment */
    basis: string;
    
    /** Limitations in plant representation */
    limitations?: string[];
    
    /** Actions to improve accuracy */
    improvementActions?: string[];
    
    /** 
     * Assessment of whether the detail level is sufficient to identify risk-significant contributors
     * For operating plants, this must be explicitly evaluated
     */
    sufficientForRiskSignificantContributors: boolean;
    
    /** Justification for the sufficiency assessment */
    sufficiencyJustification?: string;
}

/**
 * Data structure to document the Plant Operating State Analysis
 * This comprehensive documentation structure captures all aspects of the analysis process,
 * findings, and provides traceability for the work.
 * @group Documentation & Traceability
 * @implements POS-D1, POS-D2, POS-D3
 */
export interface PlantOperatingStatesDocumentation {
    /**
     * Description of the process used in the Plant Operating State Analysis.
     */
    processDescription: string;
    
    /**
     * Details on the selection and definitions of the plant evolutions.
     */
    plantEvolutionsDetails: string;
    
    /**
     * Details on the process and criteria used to identify plant operating states.
     */
    identificationProcessDetails: string;
    
    /**
     * Details on the process and criteria used to group plant operating states.
     */
    groupingProcessDetails: string;
    
    /**
     * Definition of each plant operating state group.
     */
    stateGroupDefinitions: string;
    
    /**
     * Defining characteristics of each plant operating state.
     */
    stateCharacteristics: string;
    
    /**
     * Details on the mean durations, mean times since shutdown, and mean frequencies of plant operating states.
     */
    meanDurationsDetails: string;
    
    /**
     * Details on the decay heat associated with each plant operating state of each plant evolution.
     */
    decayHeatDetails: string;
    
    /**
     * Specific interfaces with other PRA tasks for traceability.
     */
    praTaskInterfaces: string;
    
    /**
     * Sources of model uncertainty, related assumptions, and reasonable alternatives.
     */
    modelUncertaintySources: string;
    
    /**
     * Assumptions and limitations due to the lack of as-built, as-operated details.
     */
    asBuiltLimitations: string;
    
    /**
     * Documentation of peer review findings and responses
     * Especially important for PRAs performed during pre-operational stages
     */
    peerReviewFindings?: PeerReviewFinding[];
    
    /**
     * Documentation of transition risks
     * Captures the risks associated with transitions between operating states
     */
    transitionRisks?: TransitionRisk[];
}

/**
 * Interface representing plant operating state analysis.
 * 
 * This is the main container interface that brings together all aspects of the Plant Operating States Analysis.
 * It implements multiple High-Level Requirements (HLRs) and their Supporting Requirements (SRs).
 * 
 * @extends {TechnicalElement<TechnicalElementTypes.PLANT_OPERATING_STATES_ANALYSIS>}
 * @implements POS-A1, POS-A2, POS-A7, POS-A11, POS-A12, POS-A13, POS-B1, POS-B4, POS-B5, POS-B6, POS-B7, POS-B8, POS-D1, POS-D2, POS-D3
 * 
 * @example
 * ```typescript
 * const posAnalysis: PlantOperatingStatesAnalysis = {
 *   "technical-element-type": TechnicalElementTypes.PLANT_OPERATING_STATES_ANALYSIS,
 *   "technical-element-code": "POS",
 *   // ... other properties
 * };
 * ```
 *  @group API
 */
export interface PlantOperatingStatesAnalysis extends TechnicalElement<TechnicalElementTypes.PLANT_OPERATING_STATES_ANALYSIS> {
    /**
     * Additional metadata specific to Plant Operating States Analysis
     */
    additionalMetadata?: {
        /** Plant operating states specific limitations */
        limitations?: string[];
        
        /** Plant operating states specific assumptions */
        assumptions?: string[];
    };
    
    /** 
     * List of plant evolutions to be analyzed
     * Must include, at a minimum, plant evolutions from at-power operations
     * @implements POS-A1
     */
    plantEvolutions: PlantEvolution[];
    
    /**
     * Flag indicating whether at-power operations are included in the analysis
     * Per regulatory guidance, at-power operations must be included at a minimum
     */
    includesAtPowerOperations: boolean;
    
    /** 
     * Hazardous sources information
     * @implements POS-A7
     */
    hazardousSources: HazardousSources;
    
    /** 
     * Plant operating state groups for analysis simplification
     * @implements POS-B4
     */
    plantOperatingStatesGroups?: PlantOperatingStatesGroup[];
    
    /** 
     * Sources of model uncertainty related to POS definitions
     * @implements POS-A12
     */
    modelUncertainty?: ModelUncertaintyInfo[];
    
    /** 
     * Documentation of subsumed POSs
     * @implements POS-B5, POS-B6
     */
    subsumedPOSs?: SubsumedPOS[];
    
    /** 
     * List of assumptions due to lack of as-built details
     * @implements POS-A13, POS-B8
     */
    assumptionsLackOfDetail?: AssumptionsLackOfDetail[];
    
    /** 
     * SSCs and operational characteristics needed for safety
     * @implements POS-A11
     */
    sscsAndOperationalCharacteristics?: string[];
    
    /** 
     * Documentation of the analysis
     * @implements POS-D1, POS-D2, POS-D3
     */
    documentation?: PlantOperatingStatesDocumentation;
    
    /**
     * Validation rules to ensure POSs are mutually exclusive and collectively exhaustive
     * @implements POS-B1, POS-B7
     */
    posValidationRules: POSValidationRules;
    
    /**
     * Transition events between plant operating states
     * Documents the transitions and associated risks
     */
    transitionEvents?: TransitionEvent[];
    
    /**
     * Plant representation accuracy assessment
     * Documents how closely the PRA represents the as-built and as-operated plant
     */
    plantRepresentationAccuracy?: PlantRepresentationAccuracy & {
        /** Areas with high confidence */
        highConfidenceAreas?: string[];
        
        /** Areas with lower confidence */
        lowerConfidenceAreas?: string[];
        
        /** Plans for improvement */
        improvementPlans?: string[];
    };
    
    /**
     * Time-varying conditions across multiple POSs
     * Captures changes in conditions over time that span multiple operating states
     */
    timeVaryingConditions?: TimeVaryingCondition[];
}

/**
 * JSON schema for validating {@link PlantOperatingStatesAnalysis} entities.
 * Provides validation and ensures type safety throughout the application.
 *
 * @example
 * ```typescript
 * const isValid = PlantOperatingStatesAnalysisSchema.validate(someData);
 * ```
 * @group API
 */
export const PlantOperatingStatesAnalysisSchema = typia.json.application<[PlantOperatingStatesAnalysis], "3.0">();