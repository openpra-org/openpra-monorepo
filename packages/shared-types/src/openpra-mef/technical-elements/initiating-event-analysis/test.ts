import typia, { tags } from "typia";
import { TechnicalElement, TechnicalElementTypes } from "../technical-element";
import { Named, Unique } from "../core/meta";
import { Uncertainty, DataSource, Assumption, DistributionType, FrequencyQuantification, BayesianUpdate } from "../data-analysis/data-analysis";
import { Frequency, InitiatingEvent, BaseEvent, FrequencyUnit } from "../core/events";
import { PlantOperatingState, BarrierStatus, OperatingState, ModuleState, SafetyFunction, PreventionMitigationLevel, RadionuclideBarrier } from "../plant-operating-states-analysis/plant-operating-states-analysis";
import { SystemComponent } from "../systems-analysis/systems-analysis";

/**
 * @module InitiatingEventsAnalysis
 * @description Types and interfaces for Initiating Event Analysis based on RA-S-1.4-2021 Section 4.3.2
 * 
 * @remarks **HLR-IE-A**: The Initiating Event Analysis shall reasonably identify all initiating events for all modeled plant operating states and sources of radioactive material consistent with the PRA scope and plant pre-operational stage.
 * @remarks **HLR-IE-B**: The Initiating Event Analysis shall group the initiating events so that events in the same group have similar mitigation requirements to facilitate an efficient but realistic estimation of the frequency of each modeled event sequence and event sequence family.
 * @remarks **HLR-IE-C**: The Initiating Event Analysis shall quantify the annual frequency of each initiating event or initiating event group based on the plant conditions for each source of radioactive material and plant operating state within the scope of the PRA.
 * @remarks **HLR-IE-D**: The documentation of the Initiating Event Analysis shall provide traceability of the work.
 * 
 * @preferred
 * @category Technical Elements
 */

/**
 * Represents a basic system component with its properties and failure modes
 * @example
 * const pump: SystemComponent = {
 *   uuid: "RHR-P-01",
 *   name: "RHR Pump A",
 *   description: "Residual Heat Removal Pump Train A",
 *   systemId: "RHR-SYS-01",
 *   failureModes: [
 *     { uuid: "FM-001", name: "Fail to Start", componentId: "RHR-P-01" },
 *     { uuid: "FM-002", name: "Fail to Run", componentId: "RHR-P-01" }
 *   ],
 *   successCriteria: [],
 *   unavailabilityEvents: []
 * };
 */

/**
 * Defines a safety function and its success criteria
 * @remarks **IE-A5**: INCLUDE in the spectrum of initiating event challenges at least the following general categories: (a) transient... (b) RCB breach... (c) interfacing systems RCB breaches...
 * @example
 * const decay_heat: SafetyFunction = {
 *   uuid: "DHR-01",
 *   name: "Decay Heat Removal",
 *   description: "Remove residual heat from reactor core",
 *   state: "SUCCESS",
 *   criteria: {
 *     success: "1/2 RHR trains operating",
 *     failure: "No RHR trains operating"
 *   },
 *   systemResponses: ["RHR pump start", "CCW flow established"],
 *   dependencies: [
 *     { type: "FUNCTIONAL", description: "Requires AC power" },
 *     { type: "PHYSICAL", description: "Requires cooling water" }
 *   ],
 *   preventionMitigationLevel: PreventionMitigationLevel.FULL,
 *   category: "HEAT_REMOVAL",
 *   implementationMechanisms: [
 *     {
 *       name: "RHR System",
 *       description: "Residual Heat Removal System",
 *       status: "AVAILABLE",
 *       type: "ACTIVE"
 *     }
 *   ]
 * };
 */

/**
 * Describes a barrier preventing radionuclide release
 * @example
 * const containment: RadionuclideBarrier = {
 *   uuid: "CONT-01",
 *   name: "Primary Containment",
 *   state: BarrierStatus.INTACT,
 *   monitoringParameters: ["pressure", "temperature", "radiation"],
 *   breachCriteria: ["pressure > 60 psig", "temperature > 280°F"],
 *   description: "Steel-lined concrete structure designed to contain radioactive materials"
 * };
 */

/**
 * Base interface for identification methods with version tracking information
 * @remarks **IE-D1**: DOCUMENT the process used in the Initiating Event Analysis specifying what is used as input, the applied methods, and the results.
 */
export interface IdentificationMethodBase {
    method_id: string;
    version: string;
    analyst: string;
    review_date: string;
    review_status: "DRAFT" | "REVIEWED" | "APPROVED";
    supporting_documents: string[];
}

/**
 * Master Logic Diagram method for identifying initiating events
 * @remarks **IE-A9**: Perform a systematic evaluation of each system down to the subsystem or train level...
 * @remarks **IE-A12**: Interview at least one knowledgeable resource in plant design or operation to identify potential overlooked initiating events.
 * @example
 * const mld: MasterLogicDiagram = {
 *   method_id: "MLD-001",
 *   version: "1.0",
 *   sources: new Set(["NUREG-1829", "Plant_FSAR"]),
 *   operating_states: new Set([OperatingState.POWER]),
 *   // ... other properties
 * };
 */
export interface MasterLogicDiagram extends IdentificationMethodBase {
    sources: Set<string>;
    operating_states: Set<OperatingState>;
    radionuclide_barriers: Record<string, RadionuclideBarrier>;
    safety_functions: Record<string, SafetyFunction>;
    systems_components: Record<string, SystemComponent>;
    failure_modes: Record<string, {
        id: string;
        name: string;
        description: string;
        component_id: string;
    }>;
    initiators: Record<string, InitiatorDefinition>;
}

/**
 * Heat Balance Fault Tree method for identifying initiating events
 * @remarks **IE-A9**: Perform a systematic evaluation of each system down to the subsystem or train level, including support systems, to identify potential initiating events (e.g., functional failures, spatial failures, human-induced failure) that may challenge expected plant operation.
 * @example
 * const hbft: HeatBalanceFaultTree = {
 *   method_id: "HBFT-001",
 *   version: "1.0",
 *   operating_states: new Set([OperatingState.POWER]),
 *   interfaces: new Map([["RCS", { name: "RCS Pressure", parameters: ["pressure"], normal_ranges: [[2200, 2300]] }]]),
 *   // ... other properties
 * };
 */
export interface HeatBalanceFaultTree extends IdentificationMethodBase {
    operating_states: Set<OperatingState>;
    interfaces: Record<string, {
        name: string;
        parameters: string[];
        normal_ranges: [number, number][];
    }>;
    imbalances: Record<string, {
        description: string;
        threshold: number;
        consequences: string[];
    }>;
    causes: Record<string, {
        description: string;
        probability: number;
        uncertainty?: Uncertainty;
    }>;
    systems_components: Record<string, SystemComponent>;
}

/**
 * Failure Modes and Effects Analysis method
 * @remarks **IE-A10**: Include initiating events resulting from multiple failures, including common cause failures and equipment unavailabilities due to maintenance or testing.
 * @remarks **IE-A15**: In searching for initiating events, INCLUDE each system and supporting system alignment, such as temporary alignments during maintenance, that could either influence the likelihood that failures cause an initiating event or could increase the severity of the effect on plant safety functions that would result from such an event.
 * @example
 * const fmea: FailureModesEffectAnalysis = {
 *   method_id: "FMEA-001",
 *   version: "1.0",
 *   systems: new Map([["RHR", { name: "Residual Heat Removal", function: "Core Cooling", boundaries: ["RCS", "CCW"] }]]),
 *   // ... other properties
 * };
 */
export interface FailureModesEffectAnalysis extends IdentificationMethodBase {
    systems: Record<string, {
        name: string;
        function: string;
        boundaries: string[];
    }>;
    components: Record<string, SystemComponent>;
    failure_modes: Record<string, {
        mode: string;
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
 * Enhanced definition of an initiating event with additional properties
 * @memberof InitiatingEventsAnalysis
 * @extends {InitiatingEvent}
 *
 * @remarks **HLR-IE-A**: The Initiating Event Analysis shall reasonably identify all initiating events for all modeled plant operating states and sources of radioactive material consistent with the PRA scope and plant pre-operational stage.
 * @remarks **IE-A5**: INCLUDE in the spectrum of initiating event challenges at least the following general categories: (a) transient INCLUDE among the transient category both equipment- and human-induced events that disrupt the plant and leave the reactor coolant system boundary (RCB) intact. DELINEATE transient initiators in a manner that resolves the unique challenges to the reactor-specific safety functions; (b) RCB breach INCLUDE in the RCB breach category both equipment- and human-induced events that disrupt the plant by causing a breach in the reactor coolant system (RCS) with a resulting loss of coolant inventory or pressure. DELINEATE the RCB breach initiators, using a defined rationale for the differentiation; (c) interfacing systems RCB breaches INCLUDE postulated events in systems interfacing with the RCS that could fail or be operated in such a manner as to result in an uncontrolled loss of core coolant or release of radioactive material bypassing a radionuclide transport barrier as applicable; (d) special initiators; (e) any of the above caused by an internal plant hazard; (f) any of the above caused by an external hazard; (g) other categories of initiating events caused by at-initiator human failure events.
 * @remarks **IE-A6**: When identifying initiating events caused by internal or external hazards, INCLUDE initiating events caused by a combination of hazards (e.g., seismically induced fires, flooding caused by fire sprinkler actuation) included in the scope of the PRA.
 * 
 * @example
 * ```typescript
 * const event: ExtendedInitiatingEvent = {
 *   uuid: "123e4567-e89b-12d3-a456-426614174000",
 *   name: "Loss of Offsite Power",
 *   eventType: "INITIATING",
 *   frequency: 1.2e-7,
 *   category: "Transient",
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
 */
export interface ExtendedInitiatingEvent extends InitiatingEvent {
    /**
     * Category of the initiating event.
     * @remarks **HLR-IE-B**: The Initiating Event Analysis shall group the initiating events so that events in the same group have similar mitigation requirements to facilitate an efficient but realistic estimation of the frequency of each modeled event sequence and event sequence family.
     * @remarks **IE-A5**: See the categories mentioned in the remarks for the InitiatingEvent interface.
     *
     * @example
     * ```typescript
     * category: "RCB Breach";
     * ```
     */
    category: string;
    
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
     * @remarks **HLR-IE-B**: The Initiating Event Analysis shall group the initiating events so that events in the same group have similar mitigation requirements (i.e., the requirements for all events in the group are either equally or less restrictive than the limiting mitigation requirements for the group) to facilitate an efficient but realistic estimation of the frequency of each modeled event sequence and event sequence family.
     * @remarks **IE-B1**: Group initiating events to facilitate definition of event sequences and quantification. Justify that grouping does not affect the determination of risk-significant event sequences.
     */
    group?: string;
    
    /**
     * Plant operating states in which this initiating event can occur.
     * @remarks **HLR-IE-A**: The Initiating Event Analysis shall reasonably identify all initiating events for all modeled plant operating states ...
     * @remarks **IE-A7**: For operating plants, REVIEW the plant-specific initiating-event experience to ensure that the list of challenges addresses plant experience for all modeled plant operating states.
     */
    applicableStates?: string[];
    
    /**
     * Unique identifier for the grouping of initiating events for analysis purposes.
     * @remarks **HLR-IE-B**: ...group the initiating events so that events in the same group have similar mitigation requirements...
     * @remarks **IE-B2**: Use a structured, systematic process for grouping initiating events.
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
     * @remarks **IE-D3**: For pre-operational stage PRAs, DOCUMENT assumptions and limitations due to lack of as-built, as-operated details.
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
     * @remarks **IE-C12**: If fault tree modeling is used for initiating events, MODIFY, as necessary, the fault tree computational methods that are used so that the top event quantification produces a failure frequency rather than a top event probability as normally computed.
     */
    supportingAnalyses?: {
        analysisType: string;
        analysisId: string;
        description?: string;
    }[];
}

/**
 * Comprehensive definition of an initiating event
 * @remarks **IE-A7**: For operating plants, REVIEW the plant-specific initiating-event experience to ensure that the list of challenges addresses plant experience for all modeled plant operating states.
 * @remarks **IE-A8**: REVIEW generic analyses of similar plants to assess whether the list of challenges included in the model addresses industry experience for all modeled plant operating states.
 * @example
 * const loca: InitiatorDefinition = {
 *   id: "IE-LOCA-LARGE",
 *   name: "Large Break LOCA",
 *   category: "LOCA",
 *   operating_states: [OperatingState.POWER],
 *   // ... other properties
 * };
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
        success_criteria: string;
        dependencies: string[];
    }>;
    
    /**
     * Impact on radionuclide barriers
     */
    barrier_impacts: Record<string, {
        barrier: string;
        state: BarrierStatus;
        timing: string;
        mechanism: string;
    }>;
    
    /**
     * Impact on reactor modules (for multi-module plants)
     */
    module_impacts: Record<string, {
        module: string;
        state: ModuleState;
        propagation_path?: string;
        timing?: string;
    }>;
}

/**
 * @example
 * const quantification: FrequencyQuantification = {
 *   operating_state_fraction: 0.8,
 *   modules_impacted: 1,
 *   total_modules: 1,
 *   generic_data: {
 *     source: "NUREG/CR-6928",
 *     applicability: "Similar PWR designs",
 *     time_period: [new Date("2000-01-01"), new Date("2020-12-31")],
 *     events: 0,
 *     exposure_time: 3000,
 *     exposure_unit: FrequencyUnit.PER_REACTOR_YEAR
 *   },
 *   // ... other properties
 * };
 */

/**
 * Main interface for initiating events analysis
 * Implements comprehensive analysis of initiating events including identification,
 * grouping, quantification, and insights
 * 
 * @remarks **HLR-IE-A**: The Initiating Event Analysis shall reasonably identify all initiating events for all modeled plant operating states and sources of radioactive material consistent with the PRA scope and plant pre-operational stage.
 * @remarks **HLR-IE-B**: The Initiating Event Analysis shall group the initiating events so that events in the same group have similar mitigation requirements to facilitate an efficient but realistic estimation of the frequency of each modeled event sequence and event sequence family.
 * @remarks **HLR-IE-C**: The Initiating Event Analysis shall quantify the annual frequency of each initiating event or initiating event group based on the plant conditions for each source of radioactive material and plant operating state within the scope of the PRA.
 * @remarks **HLR-IE-D**: The documentation of the Initiating Event Analysis shall provide traceability of the work.
 * @remarks **IE-D1**: DOCUMENT the process used in the Initiating Event Analysis specifying what is used as input, the applied methods, and the results.
 * @remarks **IE-D2**: DOCUMENT the sources of model uncertainty, related assumptions, and reasonable alternatives ...
 * @remarks **IE-D3**: For PRAs performed during the pre-operational stage, DOCUMENT assumptions and limitations due to the lack of as-built, as-operated details ...
 * 
 * @example
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
 */
export interface InitiatingEventsAnalysis extends TechnicalElement<TechnicalElementTypes.INITIATING_EVENT_ANALYSIS> {
    metadata: {
        version: string;
        analysis_date: string;
        analyst: string;
        reviewer: string;
        approval_status: string;
        scope: string[];
        limitations: string[];
        assumptions: Assumption[];
    };
    
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
    initiating_event_groups: Record<string, {
        group_id: string;
        name: string;
        description: string;
        members: string[];
        basis: string;
        bounding_initiator: string;
        quantification: FrequencyQuantification;
    }>;
    
    /**
     * Frequency quantification for initiating events
     * @remarks **HLR-IE-C**: The Initiating Event Analysis shall quantify the annual frequency of each initiating event or initiating event group based on the plant conditions for each source of radioactive material and plant operating state within the scope of the PRA.
     * @remarks **IE-C1**: For operating plants, calculate initiating event frequency using applicable generic and plant- or design-specific data representative of current design and performance, unless adequate plant-specific data exists.
     */
    quantification: Record<string, FrequencyQuantification>;
    
    insights: {
        key_assumptions: string[];
        sensitivity_studies: Record<string, {
            parameter: string;
            range: [number, number];
            results: string;
            insights: string;
        }>;
        dominant_contributors: string[];
        uncertainty_drivers: string[];
    };
    
    /**
     * Documentation of the Initiating Event Analysis process.
     * @remarks **HLR-IE-D**: The documentation of the Initiating Event Analysis shall provide traceability of the work.
     * @remarks **IE-D1**: DOCUMENT the process used in the Initiating Event Analysis specifying what is used as input, the applied methods, and the results.
     */
    documentation?: {
        processDescription: string;
        inputSources: string[];
        appliedMethods: string[];
        resultsSummary: string;
        functionalCategories: string[];
        plantUniqueInitiatorsSearch: string;
        stateSpecificInitiatorsSearch: string;
        rcbFailureSearch: string;
        completenessAssessment: string;
        screeningBasis: string;
        groupingBasis: string;
        dismissalJustification: string;
        frequencyDerivation: string;
        quantificationApproach: string;
        dataExclusionJustification: string;
        otherDataApplicationJustification: string;
    };
}

/**
 * Runtime validation functions for InitiatingEventsAnalysis
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
            for (const memberId of group.members) {
                if (!(memberId in analysis.initiators)) {
                    errors.push(`Group ${groupId} references non-existent initiator ${memberId}`);
                }
            }
            
            // Check if bounding initiator exists and is a member of the group
            if (!(group.bounding_initiator in analysis.initiators)) {
                errors.push(`Group ${groupId} has non-existent bounding initiator ${group.bounding_initiator}`);
            } else if (!group.members.includes(group.bounding_initiator)) {
                errors.push(`Bounding initiator ${group.bounding_initiator} is not a member of group ${groupId}`);
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
 */
export const InitiatingEventsAnalysisSchema = typia.json.application<[InitiatingEventsAnalysis], "3.0">();

// List of interfaces that are dependent on the IE technical element file:
/**
 * - {@link EventSequence} (in `event-sequence-analysis.ts`): An event sequence will have a reference to an `InitiatingEvent`.
 */

// List of other technical elements that need to import this typescript file for IE:
/**
 * - `event-sequence-analysis.ts`: To reference the `InitiatingEvent` that starts an event sequence
 */

export interface HazardAnalysis extends Unique, Named {
    // ... existing code ...
    /**
     * Radionuclide barriers considered in the analysis
     */
    radionuclide_barriers: Record<string, RadionuclideBarrier>;
    // ... existing code ...
}