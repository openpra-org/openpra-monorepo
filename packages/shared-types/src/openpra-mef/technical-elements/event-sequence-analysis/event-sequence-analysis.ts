/**
 * @module event_sequence_analysis
 * @description Types and interfaces for Event Sequence Analysis
 * 
 * @preferred
 * @category Technical Elements
 */

import typia, { tags } from "typia";
import { TechnicalElement, TechnicalElementTypes } from "../technical-element";
import { Named, Unique } from "../core/meta";
import { Frequency, InitiatingEvent, BaseEvent } from "../core/events";
import { Uncertainty } from "../data-analysis/data-analysis";
import { 
    PlantOperatingState, 
    OperatingState,
    SuccessCriteriaId,
    SafetyFunction as POSSafetyFunction,
    PlantOperatingStatesTable
} from "../plant-operating-states-analysis/plant-operating-states-analysis";
import { SystemComponent, FailureMode, SuccessCriteria, UnavailabilityEvent, System } from "../systems-analysis/systems-analysis";
import { ComponentTimeline } from "../systems-analysis/temporal-modeling";

/**
 * Enum representing the level of prevention or mitigation provided by a safety function.
 */
export enum PreventionMitigationLevel {
    /** Full prevention or mitigation capability */
    FULL = "FULL",
    
    /** Partial prevention or mitigation capability */
    PARTIAL = "PARTIAL",
    
    /** No prevention or mitigation capability */
    NONE = "NONE"
}

/**
 * Type representing the different types of dependencies between systems or components.
 */
export type DependencyType = 
    | "FUNCTIONAL" 
    | "PHYSICAL" 
    | "HUMAN";

/**
 * Interface representing design information sources for traceability
 * @memberof EventSequenceAnalysis
 * @example
 * ```typescript
 * const designInfo: DesignInformation = {
 *   sourceId: "DWG-123",
 *   sourceType: "drawing",
 *   revision: "A",
 *   date: "2025-01-15",
 *   description: "System layout drawing",
 *   requirementId: "ES-001",
 *   standardSection: "4.3.3"
 * };
 * ```
 */
export interface DesignInformation {
    /** 
     * Identifier for the design source document
     */
    sourceId: string;

    /** 
     * Type of source document (e.g., "drawing", "calculation", "specification") 
     */
    sourceType: string;

    /** Document revision identifier */
    revision?: string;

    /** 
     * Date of the source document
     * @format date
     */
    date?: string;

    /** Description of the design information */
    description?: string;

    /** 
     * Requirement identifier for traceability
     */
    requirementId?: string;

    /** 
     * Section number in relevant standard (e.g., "4.3.3" in RA-S-1.4-2021)
     */
    standardSection?: string;
}

/**
 * Interface representing safety function status in a sequence
 * @memberof EventSequenceAnalysis
 * @example
 * ```typescript
 * const reactivityControl: SafetyFunction = {
 *   name: "Reactivity Control",
 *   description: "Core power control through engineered means",
 *   state: "SUCCESS",
 *   criteria: {
 *     success: "Core power reduced below 1% rated power within 10 seconds",
 *     failure: "Failure to achieve subcritical conditions"
 *   },
 *   systemResponses: ["RPS Trip", "Control Rod Insertion"],
 *   dependencies: [{
 *     type: "FUNCTIONAL",
 *     description: "Electric power for control rod drive mechanisms"
 *   }],
 *   category: "REACTIVITY_CONTROL",
 *   implementationMechanisms: [{
 *     name: "Control Rod System",
 *     description: "System for inserting control rods to control reactivity",
 *     status: "AVAILABLE",
 *     type: "ACTIVE"
 *   }]
 * };
 * ```
 */
export interface SafetyFunction extends Omit<POSSafetyFunction, 'uuid'> {
    // Simplified version of POSSafetyFunction for use in event sequences
    // The uuid field is omitted as it's not needed for event sequences
    name: string;
    description?: string;
    state: "SUCCESS" | "FAILURE";
    criteria?: {
        success: string;
        failure: string;
    };
    systemResponses?: string[];
    dependencies?: {
        type: DependencyType;
        description: string;
    }[];
    
    // Optional fields from POSSafetyFunction that may be relevant for event sequences
    preventionMitigationLevel?: PreventionMitigationLevel;
    category: "REACTIVITY_CONTROL" | "HEAT_REMOVAL" | "RADIOACTIVE_MATERIAL_RETENTION" | "OTHER";
    
    // Implementation mechanisms are required in POSSafetyFunction and must be required here too
    implementationMechanisms: Array<{
        name: string;
        description: string;
        status: "AVAILABLE" | "UNAVAILABLE" | "DEGRADED" | "MAINTENANCE";
        statusDetails?: string;
        type: "ACTIVE" | "PASSIVE";
        reliability?: {
            mtbf?: number;
            pfd?: number;
        };
    }>;
    
    // Success criteria IDs are required in POSSafetyFunction and must be required here too
    successCriteriaIds: SuccessCriteriaId[];
    
    // Initiating events this safety function responds to
    initiatingEvents: {
        /** ID of the initiating event */
        id: string;
        
        /** Name of the initiating event (for convenience) */
        name?: string;
        
        /** How effective this safety function is against this initiating event */
        effectiveness?: PreventionMitigationLevel;
    }[];
    
    // Operational parameters relevant to this safety function
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
    
    // Degradation mechanisms that could affect this safety function
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
 * Interface representing end states of sequences
 * @memberof EventSequenceAnalysis
 * @example
 * ```typescript
 * const endState: EndState = {
 *   name: "Controlled Release",
 *   description: "Limited release within regulatory limits",
 *   category: "DBE",
 *   releaseType: "Gaseous Release",
 *   classification: "P2",
 *   damageState: "ND",
 *   preventionLevel: PreventionMitigationLevel.PARTIAL,
 *   mitigationLevel: PreventionMitigationLevel.FULL
 * };
 * ```
 */
export interface EndState {
    name: string;
    description?: string;
    category?: string;
    releaseType?: string;
    classification?: string;
    damageState?: string;
    preventionLevel?: PreventionMitigationLevel;
    mitigationLevel?: PreventionMitigationLevel;
    // TODO: Add mechanistic source term linkage
    // mechanisticSourceTermId?: string;
}

/**
 * Interface representing plant operating state details for a sequence
 * @memberof EventSequenceAnalysis
 * 
 * @example
 * ```typescript
 * const operatingState: SequenceOperatingState = {
 *   stateTableId: "POS-TABLE-001",  // References PlantOperatingStatesTable.uuid
 *   stateId: "POS-1",               // References specific state within the table
 *   duration: 168,                  // Hours
 *   successCriteriaIds: ["SC-001"]
 * };
 * ```
 */
export interface SequenceOperatingState {
    /**
     * Reference to the Plant Operating States Table
     * Links to PlantOperatingStatesTable.uuid
     */
    stateTableId: string;

    /**
     * Reference to the specific state within the table
     * This can be one of the predefined states (startUp, fullPower, controlledShutdown)
     * or a custom state key from the PlantOperatingStatesTable
     */
    stateId: string;

    /**
     * Duration of this operating state in hours.
     * This can differ from the default duration defined in the Plant Operating States Table
     * when sequence-specific timing considerations apply.
     */
    duration?: number;

    /**
     * References to success criteria specific to this operating state
     */
    successCriteriaIds?: SuccessCriteriaId[];
}

/**
 * Interface representing an analysis of event sequences, which is a type of technical element.
 *
 * @memberof EventSequenceAnalysis
 * @extends {TechnicalElement}
 * 
 * @relation PlantOperatingStateAnalysis
 * Links to {@link PlantOperatingStatesTable} through stateTableId reference in each sequence's operatingState
 * 
 * @relation SystemsAnalysis
 * - Links to {@link SystemComponent} through involvedSystemComponentIds
 * - Links to {@link System} through componentTimelines
 * - Links to {@link FailureMode} through failureModeIds
 * - Links to {@link UnavailabilityEvent} through unavailabilityEventIds
 * 
 * @relation DataAnalysis
 * - Links to {@link Uncertainty} through uncertainty field
 * - Links to basic events through basicEventIds
 * 
 * @requirement RA-S-1.4-2021 §4.3.3
 * - §4.3.3.1: Model event sequences following each initiating event
 * - §4.3.3.2: Model temporal dependencies between safety functions
 * - §4.3.3.3: Account for system responses and operator actions
 * - §4.3.3.4: Provide traceability through documentation
 * 
 * @example
 * ```typescript
 * const analysis: EventSequenceAnalysis = {
 *   "technical-element-type": TechnicalElementTypes.EVENT_SEQUENCE_ANALYSIS,
 *   eventSequences: [
 *     {
 *       sequenceId: "SEQ-001",
 *       description: "Loss of coolant accident with successful safety injection",
 *       initiatingEventId: "IE-LOCA-SMALL",
 *       operatingState: {
 *         stateTableId: "POS-TABLE-001",
 *         stateId: "FULL-POWER"
 *       },
 *       // ... other sequence details
 *     }
 *   ]
 * };
 * ```
 */
export interface EventSequenceAnalysis extends TechnicalElement<TechnicalElementTypes.EVENT_SEQUENCE_ANALYSIS> {
    /**
     * A list of event sequences that are part of this analysis.
     * Each sequence represents a specific scenario following an initiating event.
     */
    eventSequences: EventSequence[];
}

/**
 * Interface representing a single event sequence.
 *
 * @memberof EventSequenceAnalysis
 *
 * @example
 * ```typescript
 * const sequence: EventSequence = {
 *  sequenceId: "SEQ-001",
 *  description: "Loss of coolant accident followed by failure of emergency core cooling",
 *  initiatingEventId: "IE-LOCA",
 *  reactivityControl: {
 *    name: "Reactivity Control",
 *    state: "SUCCESS",
 *    systemResponses: ["RPS Trip"]
 *  },
 *  heatRemoval: {
 *    name: "Heat Removal",
 *    state: "FAILURE",
 *    systemResponses: ["ECCS"]
 *  },
 *  confinement: {
 *    name: "Confinement",
 *    state: "SUCCESS"
 *  },
 *  frequency: 1.0E-6,
 *  endState: {
 *    name: "Controlled Release",
 *    category: "DBE",
 *    releaseType: "Gaseous Release",
 *    classification: "P2",
 *    preventionLevel: "PARTIAL",
 *    mitigationLevel: "FULL"
 *  },
 *  operatingState: {
 *    stateId: "POS-1",
 *    duration: 168,
 *    successCriteriaIds: ["SC-001", "SC-002"]
 *  },
 *  componentTimelines: [{
 *    component: { id: "ECCS-PUMP-1" },
 *    phases: [{
 *      startTime: 0,
 *      endTime: 24,
 *      state: "operational"
 *    }]
 *  }],
 *  designInformation: [{
 *    sourceId: "DWG-123",
 *    sourceType: "drawing",
 *    revision: "A"
 *  }]
 * };
 * ```
 *
 * @implements RA-S-1.4-2021 Section 4.3.3
 */
export interface EventSequence extends Unique, Named {
    /**
     * Unique identifier for the event sequence.
     */
    sequenceId: string;

    /**
     * A textual description of what this event sequence represents.
     */
    description: string;

    /**
     * Reference to the initiating event that starts this sequence.
     */
    initiatingEventId: string;

    /**
     * Status of reactivity control safety function
     * @HLR-ES-C Account for necessary system responses
     */
    reactivityControl: SafetyFunction;

    /**
     * Status of heat removal safety function
     * @HLR-ES-C Account for necessary system responses
     */
    heatRemoval: SafetyFunction;

    /**
     * Status of confinement safety function
     * @HLR-ES-C Account for necessary system responses
     */
    confinement: SafetyFunction;

    /**
     * Frequency of the event sequence
     */
    frequency?: Frequency;

    /**
     * End state of the sequence including release category
     * @HLR-ES-A Describe scenarios that can lead to release
     */
    endState: EndState;

    /**
     * Operating state details for this sequence
     */
    operatingState: SequenceOperatingState;

    /**
     * Component timelines for this sequence
     */
    componentTimelines?: ComponentTimeline[];

    /**
     * Design information sources for traceability
     * @HLR-ES-D Provide traceability of the work
     */
    designInformation?: DesignInformation[];

    /**
     * References to the system components involved in this event sequence.
     * @HLR-ES-B DEVELOP the event sequence models to a level of detail sufficient to identify intersystem dependencies and train level interfaces, either in the event trees or through a combination of event tree and fault tree models and associated logic [2].
     */
    involvedSystemComponentIds?: string[];

    /**
     * References to unavailability events relevant to this sequence.
     */
    unavailabilityEventIds?: string[];

    /**
     * References to specific failure modes relevant in this sequence.
     */
    failureModeIds?: string[];

    /**
     * References to basic events (from Data Analysis) impacting this sequence.
     * Connects the event sequence to the underlying data and probabilities.
     */
    basicEventIds?: string[];

    /**
     * References to success criteria that must be met in this sequence.
     * Ties the sequence to defined success standards.
     */
    successCriteriaIds?: string[];

    /**
     * @ES-A14 IDENTIFY the sources of model uncertainty, the related assumptions, and reasonable alternatives associated with event sequence definition in a manner that supports the applicable requirements of HLR-ESQ-E [1].
     */
    uncertainty?: Uncertainty;

    /**
     * References to supporting analyses
     * @HLR-ES-D Provide traceability of the work
     */
    supportingAnalyses?: {
        analysisType: string;
        analysisId: string;
        description?: string;
    }[];

    // TODO: Future enhancement for train/subsystem dependencies
    // trainDependencies?: {
    //     systemId: string;
    //     trainId: string;
    //     dependencyType: DependencyType;
    // }[];
}

/**
 * Runtime validation functions for EventSequenceAnalysis
 */
export const validateEventSequenceAnalysis = {
    /**
     * Validates that all stateIds referenced in sequences exist in the provided plant states table
     */
    validateStateReferences: (
        analysis: EventSequenceAnalysis,
        plantStatesTable: PlantOperatingStatesTable
    ): string[] => {
        const errors: string[] = [];
        
        // Get all valid state keys from the PlantOperatingStatesTable
        // This includes the predefined states (startUp, fullPower, controlledShutdown)
        // and any custom states
        const validStateKeys = new Set([
            'startUp',
            'fullPower',
            'controlledShutdown',
            ...Object.keys(plantStatesTable).filter(key => 
                key !== 'startUp' && key !== 'fullPower' && key !== 'controlledShutdown'
            )
        ]);
        
        analysis.eventSequences.forEach((seq, index) => {
            if (!validStateKeys.has(seq.operatingState.stateId)) {
                errors.push(
                    `Invalid stateId "${seq.operatingState.stateId}" in sequence ${index} (${seq.sequenceId})`
                );
            }
        });
        
        return errors;
    }
};

/**
 * JSON schema for validating {@link EventSequenceAnalysis} entities.
 * Includes both type-level and runtime validations.
 * 
 * @example
 * ```typescript
 * // Type-level validation (compile time)
 * const analysis: EventSequenceAnalysis = { ... };
 * 
 * // Runtime validation
 * const schema = EventSequenceAnalysisSchema;
 * const validationResult = schema.validateSync(analysis);
 * if (!validationResult.success) {
 *   console.error(validationResult.errors);
 * }
 * 
 * // Additional runtime checks
 * const stateErrors = validateEventSequenceAnalysis.validateStateReferences(
 *   analysis,
 *   plantStatesTable
 * );
 * if (stateErrors.length > 0) {
 *   console.error(stateErrors);
 * }
 * ```
 */
export const EventSequenceAnalysisSchema = typia.json.application<[EventSequenceAnalysis], "3.0">();