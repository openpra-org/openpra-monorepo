import { Unique, Named } from "../core/meta";
import { PlantOperatingStatesTable } from "../plant-operating-states-analysis/plant-operating-states-analysis";
import * as temporal from './temporal-modeling';

/**
 * @namespace Systems
 * @description Core system types and interfaces, including temporal modeling capabilities
 */

// Re-export temporal modeling as part of Systems namespace
export { temporal };

/**
 * Interface representing a system.
 * A system is a collection of components that work together to perform specific functions.
 * 
 * @memberof Systems
 * @extends {Unique}
 * @extends {Named}
 * 
 * @example
 * ```typescript
 * const system: System = {
 *   uuid: "sys-123",
 *   name: "Emergency Core Cooling System",
 *   description: "Provides emergency cooling in case of LOCA",
 *   components: [...],
 *   plantOperatingStates: {...}
 * };
 * ```
 */
export interface System extends Unique, Named {
    description?: string;
    components: SystemComponent[];
    plantOperatingStates: PlantOperatingStatesTable;
}

/**
 * @namespace Components
 * @description Component-related types and interfaces
 */

/**
 * Interface representing a component within a system.
 * Components are the building blocks of systems and can have various failure modes,
 * success criteria, and unavailability events associated with them.
 * 
 * @memberof Components
 * @extends {Unique}
 * @extends {Named}
 * 
 * @example
 * ```typescript
 * const component: SystemComponent = {
 *   uuid: "comp-456",
 *   name: "Emergency Diesel Generator A",
 *   description: "Primary emergency power source",
 *   boundary: "Includes fuel system, cooling system, and control circuits",
 *   component_group: "Emergency Power Sources",
 *   systemId: "sys-123",
 *   failureModes: [...],
 *   successCriteria: [...],
 *   unavailabilityEvents: [...]
 * };
 * ```
 */
export interface SystemComponent extends Unique, Named {
    description?: string;
    /**
     * Defines the structure, system, and component (SSC) boundaries.
     * This includes physical and functional boundaries of the component.
     * 
     * @example
     * "Includes motor, pump, suction line up to first isolation valve"
     */
    boundary?: string;
    /**
     * Grouping of components for analysis purposes.
     * Used to categorize components with similar characteristics or functions.
     * 
     * @example
     * "Motor Operated Valves", "Diesel Generators"
     */
    component_group?: string;
    /** Reference to the parent system */
    systemId: string; //Refers to the System.uuid
    /** All possible failure modes of this component */
    failureModes: FailureMode[];
    /** Success criteria applicable to this component */
    successCriteria: SuccessCriteria[];
    /** Unavailability events that can affect this component */
    unavailabilityEvents: UnavailabilityEvent[];
}

/**
 * @namespace Failures
 * @description Failure modes and related concepts
 */

/**
 * Interface representing a failure mode of a component.
 * A failure mode describes how a component can fail to perform its intended function.
 * 
 * @memberof Failures
 * @extends {Unique}
 * @extends {Named}
 * 
 * @example
 * ```typescript
 * const failureMode: FailureMode = {
 *   uuid: "fm-789",
 *   name: "Fail to Start",
 *   description: "Component fails to initiate operation when demanded",
 *   componentId: "comp-456"
 * };
 * ```
 */
export interface FailureMode extends Unique, Named {
    description?: string;
    /** Reference to the component this failure mode belongs to */
    componentId: string; //Refers to SystemComponent.uuid
}

/**
 * @namespace Success
 * @description Success criteria and related concepts
 */

/**
 * Interface representing the success criteria for a component or system.
 * Success criteria define the conditions under which a component or system
 * is considered to be performing its intended function adequately.
 * 
 * @memberof Success
 * @extends {Unique}
 * @extends {Named}
 * 
 * @example
 * ```typescript
 * const criteria: SuccessCriteria = {
 *   uuid: "sc-101",
 *   name: "EDG Start Time",
 *   description: "Must start and reach rated speed within 10 seconds",
 *   componentId: "comp-456"
 * };
 * ```
 */
export interface SuccessCriteria extends Unique, Named {
    description?: string;
    /** Reference to the component if criteria applies to a component */
    componentId?: string; //Refers to SystemComponent.uuid
    /** Reference to the system if criteria applies to a system */
    systemId?: string;  //Refers to the System.uuid
}

/**
 * @namespace Unavailability
 * @description Unavailability events and related concepts
 */

/**
 * Interface representing an unavailability event.
 * The UnavailabilityEvent is not about the start of an event sequence like the InitiatingEvent, 
 * or a functional failure like a FunctionalEvent, but instead is related to a system's 
 * reliability and its possible states, which need to be accounted for within the system modelling.
 * 
 * @memberof Unavailability
 * @extends {Unique}
 * @extends {Named}
 * 
 * @example
 * ```typescript
 * const unavailability: UnavailabilityEvent = {
 *   uuid: "ue-202",
 *   name: "EDG-A Maintenance",
 *   description: "Planned maintenance outage of EDG-A",
 *   componentId: "comp-456"
 * };
 * ```
 */
export interface UnavailabilityEvent extends Unique, Named {
    description?: string;
    /** Reference to the component this unavailability event affects */
    componentId: string; //Refers to SystemComponent.uuid
}
