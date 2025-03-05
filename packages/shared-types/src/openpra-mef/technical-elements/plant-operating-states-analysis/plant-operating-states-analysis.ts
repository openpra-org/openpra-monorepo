/**
 * @module plant_operating_states_analysis
 * @description Comprehensive types and interfaces for Plant Operating State Analysis (POS)
 * 
 * The objectives of Plant Operating State Analysis ensure that:
 * - (a) each plant operating state is defined in terms of all important conditions that may affect 
 *       the delineation and evaluation of event sequences;
 * - (b) plant operating states that are grouped together are shown to be represented by the 
 *       characteristics of the remaining group;
 * - (c) the frequencies, decay heat levels, and plant configurations for each plant operating 
 *       state are well characterized;
 * - (d) the Plant Operating State Analysis is documented to provide traceability of the work.
 * 
 * Per RG 1.247, POSs are used to subdivide the plant operating cycle into unique states, such that the plant 
 * response can be assumed to be the same within the given POS for a given initiating event. The POS analysis 
 * defines the structure of the NLWR PRA, and all POSs and their key attributes should be clearly documented.
 * 
 * @preferred
 * @category Technical Elements
 */

import typia, { tags } from "typia";
import { TechnicalElement, TechnicalElementTypes } from "../technical-element";
import { Named, Unique } from "../core/meta";
import { InitiatingEvent, BaseEvent, Frequency } from "../core/events";
import { IdPatterns } from "../core/shared-patterns";
import { DistributionType } from "../data-analysis/data-analysis";

/**
 * @namespace OperatingStates
 * @description Types and interfaces for plant operating states
 */

/**
 * Represents the different operating states of a nuclear reactor system.
 * These are discrete modes that a plant can be in during its operational cycle.
 * 
 * @example
 * const currentState: OperatingState = OperatingState.POWER;
 * 
 * @memberof OperatingStates
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
 * Type for success criteria IDs
 * Format: SC-[SYSTEM]-[NUMBER]
 * Example: SC-RCIC-001
 */
export type SuccessCriteriaId = string;

/**
 * Interface representing the screening status of hazards or sources.
 * @memberof OperatingStates
 */
export type ScreeningStatus = 
    | "FULLY_ANALYSIS" 
    | "QUALITATIVE_ANALYSIS";

/**
 * Interface representing the types of hazards in operating state analysis.
 * @memberof OperatingStates
 */
export type HazardType = 
    | "INTERNAL_EVENT" 
    | "INTERNAL_HAZARD" 
    | "EXTERNAL_HAZARD";

/**
 * Interface representing the types of source locations.
 * @memberof OperatingStates
 */
export type SourceLocationType = 
    | "IN_CORE_SOURCE" 
    | "OUT_OF_CORE_SOURCE";

/**
 * Interface representing the system status.
 * @memberof OperatingStates
 */
export type SystemStatus = 
    | "YES" 
    | "NO";

/**
 * Enum representing the status of a radionuclide barrier.
 * Used to indicate the current state of barriers that prevent the release of radioactive materials.
 * 
 * @memberof OperatingStates
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
 * Describes a barrier preventing radionuclide release
 * @example
 * const containment: RadionuclideBarrier = {
 *   uuid: "CONT-01",
 *   name: "Primary Containment",
 *   state: BarrierStatus.INTACT,
 *   monitoringParameters: ["pressure", "temperature", "radiation"],
 *   breachCriteria: ["pressure > 60 psig", "temperature > 280°F"]
 * };
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
 * Indicates the impact status of a reactor module in multi-module plants.
 * Used to represent how initiating events or hazards affect individual modules.
 * 
 * @example
 * const moduleStatus: ModuleState = ModuleState.NOT_IMPACTED;
 * 
 * @memberof OperatingStates
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
 * Interface representing the types of dependencies for safety functions.
 * @memberof OperatingStates
 */
export type DependencyType = 
    | "FUNCTIONAL" 
    | "PHYSICAL" 
    | "HUMAN";

/**
 * Enum representing the prevention/mitigation level provided by safety functions.
 * @memberof OperatingStates
 */
export enum PreventionMitigationLevel {
    FULL = "FULL",
    PARTIAL = "PARTIAL",
    NONE = "NONE"
}

/**
 * Interface representing the hazard screening information.
 * @memberof OperatingStates
 * @implements POS-A2
 */
export interface HazardScreening {
    /** The type of hazard */
    hazardType: HazardType;
    /** The screening status of the hazard */
    screeningStatus: ScreeningStatus;
}

/**
 * Interface representing source definition and screening.
 * @memberof OperatingStates
 * @implements POS-A7
 */
export interface SourceDefinition {
    /** The location of the source */
    sourceLocation: SourceLocationType;
    /** The screening status of the source */
    screeningStatus: ScreeningStatus;
}

/**
 * Interface for representing a radioactive source in the plant.
 * This covers both in-vessel (e.g., reactor core) and ex-vessel (e.g., spent fuel pool) sources.
 * 
 * @memberof OperatingStates
 * @implements POS-A6, POS-A7
 */
export interface RadioactiveSource extends Unique, Named {
    /** Location of the source - in-vessel or ex-vessel */
    location: "IN_VESSEL" | "EX_VESSEL";
    
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
 * Interface representing decay heat removal systems.
 * @memberof OperatingStates
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
 * 
 * Per RG 1.247, POS definitions should consider decay heat level, Reactor Coolant System (RCS) configuration, 
 * reactor level (for reactors with liquid coolant), reactor pressure and temperature,
 * and other parameters needed to determine success criteria.
 * 
 * @memberof OperatingStates
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
 * Interface representing an instrument used to monitor key plant parameters.
 * This helps ensure adequate instrumentation for each plant operating state.
 * 
 * @memberof OperatingStates
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
 * Interface representing a time-varying condition within a plant operating state.
 * Conditions within a POS are not always constant, and certain parameters can change
 * over time, affecting the risk profile.
 * 
 * @memberof OperatingStates
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
 * 
 * @memberof OperatingStates
 * @extends {Unique}
 * @extends {Named}
 * @implements POS-A4
 * 
 * @example
 * ```typescript
 * // Example of defining safety functions in a technology-agnostic way
 * const safetyFunctions: SafetyFunction[] = [
 *   // Reactivity control safety function
 *   {
 *     uuid: "sf-reactivity-001",
 *     name: "Reactivity Control",
 *     description: "Controls reactivity to maintain the reactor in a safe state",
 *     state: "SUCCESS",
 *     category: "REACTIVITY_CONTROL",
 *     implementationMechanisms: [
 *       {
 *         name: "Primary Reactivity Control System",
 *         description: "Primary system for controlling reactivity",
 *         status: "AVAILABLE",
 *         type: "ACTIVE",
 *         reliability: {
 *           pfd: 1e-4
 *         }
 *       },
 *       {
 *         name: "Secondary Reactivity Control System",
 *         description: "Backup system for controlling reactivity",
 *         status: "AVAILABLE",
 *         type: "PASSIVE",
 *         reliability: {
 *           pfd: 1e-3
 *         }
 *       }
 *     ],
 *     operationalParameters: [
 *       {
 *         name: "Shutdown Margin",
 *         value: 5.2,
 *         units: "%dk/k",
 *         acceptableRange: [3.0, 10.0],
 *         monitored: true,
 *         monitoringInstruments: ["Neutron Flux Monitor", "Control Position Indicator"]
 *       }
 *     ]
 *   },
 *   
 *   // Heat removal safety function
 *   {
 *     uuid: "sf-heat-removal-001",
 *     name: "Core Heat Removal",
 *     description: "Removes heat from the reactor core to maintain safe temperatures",
 *     state: "SUCCESS",
 *     category: "HEAT_REMOVAL",
 *     implementationMechanisms: [
 *       {
 *         name: "Primary Cooling System",
 *         description: "Primary system for removing heat from the core",
 *         status: "AVAILABLE",
 *         type: "ACTIVE",
 *         reliability: {
 *           mtbf: 8760
 *         }
 *       },
 *       {
 *         name: "Passive Cooling System",
 *         description: "Passive system for removing heat from the core",
 *         status: "AVAILABLE",
 *         type: "PASSIVE"
 *       }
 *     ],
 *     operationalParameters: [
 *       {
 *         name: "Core Exit Temperature",
 *         value: 320,
 *         units: "°C",
 *         acceptableRange: [0, 350],
 *         monitored: true,
 *         monitoringInstruments: ["Core Exit Thermocouple"]
 *       },
 *       {
 *         name: "Coolant Flow Rate",
 *         value: 1200,
 *         units: "kg/s",
 *         acceptableRange: [1000, 1500],
 *         monitored: true,
 *         monitoringInstruments: ["Flow Meter"]
 *       }
 *     ],
 *     degradationMechanisms: [
 *       {
 *         name: "Heat Exchanger Fouling",
 *         description: "Buildup of deposits on heat exchanger surfaces",
 *         status: "MITIGATED",
 *         mitigationMeasures: ["Regular cleaning", "Water chemistry control"]
 *       }
 *     ]
 *   },
 *   
 *   // Radioactive material retention safety function
 *   {
 *     uuid: "sf-containment-001",
 *     name: "Containment Integrity",
 *     description: "Maintains containment integrity to prevent release of radioactive materials",
 *     state: "SUCCESS",
 *     category: "RADIOACTIVE_MATERIAL_RETENTION",
 *     implementationMechanisms: [
 *       {
 *         name: "Containment Structure",
 *         description: "Physical barrier to prevent release of radioactive materials",
 *         status: "AVAILABLE",
 *         type: "PASSIVE"
 *       },
 *       {
 *         name: "Containment Isolation System",
 *         description: "System for isolating containment penetrations",
 *         status: "AVAILABLE",
 *         type: "ACTIVE",
 *         reliability: {
 *           pfd: 1e-3
 *         }
 *       }
 *     ],
 *     operationalParameters: [
 *       {
 *         name: "Containment Pressure",
 *         value: 101.3,
 *         units: "kPa",
 *         acceptableRange: [90, 120],
 *         monitored: true,
 *         monitoringInstruments: ["Pressure Transmitter"]
 *       },
 *       {
 *         name: "Containment Leakage Rate",
 *         value: 0.1,
 *         units: "%/day",
 *         acceptableRange: [0, 0.5],
 *         monitored: true
 *       }
 *     ]
 *   }
 * ];
 * ```
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
        type: DependencyType;
        /** Description of the dependency */
        description: string;
    }[];
    
    /** Prevention or mitigation level provided by this safety function */
    preventionMitigationLevel?: PreventionMitigationLevel;
    
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
        effectiveness?: PreventionMitigationLevel;
    }[];
    
    /**
     * Category of safety function
     * Technology-agnostic categorization of the safety function
     */
    category: "REACTIVITY_CONTROL" | "HEAT_REMOVAL" | "RADIOACTIVE_MATERIAL_RETENTION" | "OTHER";
    
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
        status: "AVAILABLE" | "UNAVAILABLE" | "DEGRADED" | "MAINTENANCE";
        
        /** Detailed status information */
        statusDetails?: string;
        
        /** Whether this is an active or passive mechanism */
        type: "ACTIVE" | "PASSIVE";
        
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
        status: "ACTIVE" | "POTENTIAL" | "MITIGATED";
        
        /** Mitigation measures in place */
        mitigationMeasures?: string[];
    }>;
}

/**
 * Interface representing time boundary for a plant operating state.
 * Used to ensure mutual exclusivity between operating states.
 * 
 * @memberof OperatingStates
 * @implements POS-B1, POS-B2, POS-B3
 */
export interface POSTimeBoundary {
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
     * For example: [{ parameter: "RCS Temperature", value: "350°F" }]
     */
    transitionParameters?: Array<{
        /** The plant parameter name */
        parameter: string;
        /** The threshold value that marks the transition */
        value: string;
    }>;
}

/**
 * Interface representing the risk significance of a plant operating state.
 * Different POSs contribute differently to overall plant risk, and this
 * interface captures that information.
 * 
 * @memberof OperatingStates
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
        /** Core Damage Frequency */
        CDF: Frequency;
        
        /** Large Early Release Frequency */
        LERF: Frequency;
    };
    
    /** List of risk-significant contributors */
    riskSignificantContributors: string[];
    
    /** Importance measures for key components */
    importanceMeasures?: {
        /** Component ID */
        componentId: string;
        
        /** Fussell-Vesely importance */
        fussellVesely?: number;
        
        /** Risk Achievement Worth */
        RAW?: number;
        
        /** Risk Reduction Worth */
        RRW?: number;
    }[];
}

/**
 * Interface representing a transition event between plant operating states.
 * Transitions between states can introduce unique risks that need to be captured
 * and analyzed.
 * 
 * @memberof OperatingStates
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
    
    /** Frequency of the transition (occurrences per year) */
    frequency?: Frequency;
    
    /** Special considerations during the transition */
    specialConsiderations?: string[];
    
    /** Operating procedures governing this transition */
    procedureIds?: string[];
    
    /** Critical parameters to monitor during the transition */
    criticalParameters?: string[];
}

/**
 * Interface representing a plant operating state (POS).
 * 
 * Per RG 1.247, a POS represents distinct and relatively constant plant conditions. The POS is defined
 * in terms of all important conditions that may affect the delineation and evaluation of event sequences
 * modeled in the PRA. POS definitions should consider decay heat level, RCS configuration, reactor level,
 * reactor pressure and temperature, radionuclide transport configuration, status of barriers, available
 * instrumentation, and other parameters needed to determine success criteria and source terms.
 * 
 * @memberof OperatingStates
 * @extends {Unique}
 * @extends {Named}
 * @implements POS-A3, POS-A5, POS-A6, POS-A7, POS-A8, POS-B1, POS-B2, POS-B3
 * 
 * @example
 * ```typescript
 * const fullPowerState: PlantOperatingState = {
 *   uuid: "pos-12345-e89b-12d3-a456-426614174000",
 *   name: "Full Power Operation",
 *   description: "Normal operation at 100% power with all systems available",
 *   characteristics: "Steady state operation at rated thermal power",
 *   processCriteriaIdentification: "Technical Specifications Section 3.1",
 *   timeBoundary: {
 *     startingCondition: "Generator synchronization complete and power ascension to >95% complete",
 *     endingCondition: "Operator initiates power reduction for shutdown or reactor trip occurs",
 *     transitionParameters: [
 *       { parameter: "Reactor Power", value: "≥ 95% rated thermal power" }
 *     ]
 *   },
 *   radioactiveMaterialSources: ["Reactor Core", "Primary Coolant"],
 *   operatingMode: "Power Operation",
 *   rcbConfiguration: "Intact",
 *   rcsParameters: {
 *     powerLevel: [0.98, 1.0],
 *     decayHeatLevel: [0.06, 0.07],
 *     reactorCoolantTemperatureAtControlVolume1: [550, 558],
 *     coolantPressureAtControlVolume1: [2200, 2250],
 *     rcsConfigurationDescription: "All primary loops in operation"
 *   },
 *   decayHeatRemoval: {
 *     primaryCoolingSystems: {
 *       "Main-Feedwater": "YES",
 *       "Auxiliary-Feedwater": "YES"
 *     },
 *     secondaryCoolingSystems: {
 *       "Main-Condenser": "YES",
 *       "Atmospheric-Dump": "YES"
 *     }
 *   },
 *   availableInstrumentation: [
 *     "Neutron-Flux-Monitoring",
 *     "RCS-Pressure",
 *     "RCS-Temperature"
 *   ],
 *   keyActivity: {
 *     controlRodInsertion: "YES",
 *     feedwaterPump: "YES",
 *     reactorCoolantCirculator: "YES"
 *   },
 *   activitiesLeadingToChanges: [
 *     "Load changes",
 *     "Control rod movement for axial offset control"
 *   ],
 *   radionuclideTransportBarrier: {
 *     barrier1: "INTACT",
 *     barrier2: "INTACT"
 *   },
 *   initiatingEvents: ["LOSS-OF-OFFSITE-POWER", "LOSS-OF-FEEDWATER"],
 *   safetyFunctions: [reactivityControlFunction], // Reference to the safety function defined above
 *   meanDuration: 8000,
 *   meanTimeSinceShutdown: 0,
 *   meanFrequency: 1,
 *   assumptions: [
 *     "All safety systems are operable as per technical specifications"
 *   ],
 *   successCriteriaIds: ["SC-RCIC-001", "SC-HPCI-001"]
 * };
 * ```
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
     */
    timeBoundary: POSTimeBoundary;
    
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
    
    /** Mean frequency of the plant operating state */
    meanFrequency?: Frequency;
    
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
    plantRepresentationAccuracy?: {
        /** Degree of accuracy (HIGH/MEDIUM/LOW) */
        accuracy: "HIGH" | "MEDIUM" | "LOW";
        
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
    };
}

/**
 * Interface representing plant operating states table.
 * @memberof OperatingStates
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
 * Interface for grouping plant operating states based on similar characteristics.
 *
 * Per RG 1.247, "LPSD types of POSs that are subsumed into each other are shown 
 * to be represented by the characteristics of the subsuming group."
 *
 * @memberof OperatingStates
 * @extends {Unique}
 * @extends {Named}
 * @implements POS-B4, POS-B5, POS-B6
 * 
 * @example
 * ```typescript
 * const startupGroup: PlantOperatingStatesGroup = {
 *   uuid: "posg-12345-e89b-12d3-a456-426614174000",
 *   name: "Startup Operating States",
 *   description: "Groups all startup-related operating states",
 *   plantOperatingStateIds: [
 *     "pos-startup1",
 *     "pos-startup2",
 *     "pos-lowpower"
 *   ],
 *   groupingJustification: "All states have similar thermal-hydraulic conditions and safety system availability",
 *   representativeCharacteristics: [
 *     "Low power operation (<25% rated power)",
 *     "All safety systems available",
 *     "Similar operator response expectations"
 *   ]
 * };
 * ```
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
 * Interface for grouping scenarios based on similar risk characteristics.
 * This helps streamline the analysis while ensuring that the grouped scenarios
 * have similar risk profiles.
 * 
 * @memberof OperatingStates
 */
export interface ScenarioGroup extends Unique, Named {
    /** List of scenario IDs included in this group */
    scenarios: string[];
    
    /** Justification for grouping these scenarios */
    justification: string;
    
    /** Risk characteristics of this group */
    riskCharacteristics: {
        /** Range of Core Damage Frequency values */
        CDF_Range: [Frequency, Frequency];
        
        /** Range of Large Early Release Frequency values */
        LERF_Range: [Frequency, Frequency];
    };
    
    /** Verification that grouping does not mask important risk insights */
    verificationOfGrouping?: string;
    
    /** Representative scenario used for detailed analysis */
    representativeScenario?: string;
}

/**
 * Interface representing operating states frequency and duration data.
 * 
 * Per RG 1.247, the duration and number of entries into each POS must be determined.
 * This interface captures the historical data used to determine these frequencies and durations.
 * 
 * @memberof OperatingStates
 * @implements POS-C1, POS-C2, POS-C3, POS-C4
 */
export interface OperatingStatesFrequencyDuration {
    /** Outage plans and records */
    outagePlansRecords: {
        startDate: string;
        endDate: string;
        description: string;
        frequencyPerYear: Frequency;
    }[];
    
    /** Maintenance plans and records */
    maintenancePlansRecords: {
        startDate: string;
        endDate: string;
        description: string;
        frequencyPerYear: Frequency;
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

/**
 * Interface representing plant evolution description.
 * @memberof OperatingStates
 * @implements POS-A1
 */
export interface PlantEvolutionDescription {
    /** PRA mode for this transition */
    praMode: string;
    /** Screening status for this transition */
    screeningStatus: ScreeningStatus;
}

/**
 * Interface representing plant evolution considerations.
 * 
 * Plant evolutions involve transitions between operating states. Per RG 1.247, LPSD (low-power shutdown)
 * plant evolutions should be divided into POSs based on differences in plant response to initiating events.
 * These considerations track important aspects of plant transitions that may affect risk.
 * 
 * @memberof OperatingStates
 * @implements POS-A2, POS-A9
 */
export interface PlantEvolutionConsiderations {
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
}

/**
 * Interface representing plant evolution information.
 * @memberof OperatingStates
 * @implements POS-A1, POS-A2
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
    
    /** Descriptions of plant transitions with their PRA modes and screening status */
    descriptions?: Record<string, PlantEvolutionDescription>;
    
    /** Considerations for plant evolution */
    considerations?: PlantEvolutionConsiderations;
    
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
 * Assumptions made due to lack of as-built and as-operated details
 *
 * @memberof OperatingStates
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
}

/**
 * Interface representing hazardous sources in operating state analysis.
 * 
 * Per RG 1.247, POS definitions should include all sources of radioactive material within the scope of the PRA,
 * including ex-vessel sources, unless there is a documented technical justification for excluding ex-vessel sources.
 * 
 * @memberof OperatingStates
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

/**
 * Data structure to document the Plant Operating State Analysis
 *
 * @memberof PlantOperatingStatesAnalysis
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
    peerReviewFindings?: {
        /** ID of the peer review finding */
        findingId: string;
        
        /** Description of the finding */
        description: string;
        
        /** Category of the finding */
        category: string;
        
        /** Significance of the finding (HIGH/MEDIUM/LOW) */
        significance: "HIGH" | "MEDIUM" | "LOW";
        
        /** Response to the finding */
        response: string;
        
        /** Actions taken to address the finding */
        actions?: string[];
        
        /** Resolution status */
        status: "OPEN" | "CLOSED" | "IN_PROGRESS";
    }[];
    
    /**
     * Documentation of transition risks
     * Captures the risks associated with transitions between operating states
     */
    transitionRisks?: {
        /** ID of the transition */
        transitionId: string;
        
        /** Description of the transition */
        description: string;
        
        /** Risks associated with the transition */
        risks: string[];
        
        /** Significance of the risks (HIGH/MEDIUM/LOW) */
        significance: "HIGH" | "MEDIUM" | "LOW";
        
        /** Mitigating actions */
        mitigatingActions?: string[];
    }[];
}

/**
 * Interface for validation rules to ensure plant operating states are correctly defined
 * and cover the entire plant operating cycle.
 * 
 * @memberof PlantOperatingStatesAnalysis
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
 * Interface representing radionuclide transport barriers.
 * @memberof OperatingStates
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
 * Interface representing plant operating state analysis.
 * 
 * @memberof OperatingStates
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
 */
export interface PlantOperatingStatesAnalysis extends TechnicalElement<TechnicalElementTypes.PLANT_OPERATING_STATES_ANALYSIS> {
    /** 
     * Hazard type information
     * @implements POS-A2
     */
    hazardType: HazardScreening;
    
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
    modelUncertainty?: Array<{
        source: string;
        description: string;
        impact: "HIGH" | "MEDIUM" | "LOW";
        treatment: string;
    }>;
    
    /** 
     * Documentation of subsumed POSs
     * @implements POS-B5, POS-B6
     */
    subsumedPOSs?: Array<{
        subsumedPOS: string;
        subsumingPOS: string;
        justification: string;
    }>;
    
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
     * Scenario groups for risk analysis
     * Groups scenarios with similar risk characteristics
     */
    scenarioGroups?: ScenarioGroup[];
    
    /**
     * Transition events between plant operating states
     * Documents the transitions and associated risks
     */
    transitionEvents?: TransitionEvent[];
    
    /**
     * Plant representation accuracy assessment
     * Documents how closely the PRA represents the as-built and as-operated plant
     */
    plantRepresentationAccuracy?: {
        /** Overall accuracy assessment */
        overallAssessment: "HIGH" | "MEDIUM" | "LOW";
        
        /** Basis for the assessment */
        basis: string;
        
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
 *
 * @memberof PlantOperatingStateAnalysis
 * @example
 * ```typescript
 * const isValid = PlantOperatingStatesAnalysisSchema.validate(someData);
 * ```
 */
export const PlantOperatingStatesAnalysisSchema = typia.json.application<[PlantOperatingStatesAnalysis], "3.0">();