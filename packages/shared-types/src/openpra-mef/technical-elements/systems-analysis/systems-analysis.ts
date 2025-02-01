import { Unique, Named } from "../meta";
import { PlantOperatingStatesTable } from "../plant-operating-state-analysis/plant-operating-state-analysis";

/**
 * Interface representing a system.
 * 
 * @interface
 * @extends {Unique}
 * @extends {Named}
 */
export interface System extends Unique, Named {
    description?: string;
    components: SystemComponent[];
    plantOperatingStates: PlantOperatingStatesTable;
}

/**
 * Interface representing a component within a system.
 * 
 * @interface
 * @extends {Unique}
 * @extends {Named}
 */
export interface SystemComponent extends Unique, Named {
    description?: string;
    /**
     * Defines the structure, system, and component (SSC) boundaries.
     * This includes physical and functional boundaries of the component.
     */
    boundary?: string;
    /**
     * Grouping of components for analysis purposes.
     * Used to categorize components with similar characteristics or functions.
     */
    component_group?: string;
    systemId: string; //Refers to the System.uuid
    failureModes: FailureMode[];
    successCriteria: SuccessCriteria[];
    unavailabilityEvents: UnavailabilityEvent[];
}

/**
 * Interface representing a failure mode of a component.
 * 
 * @interface
 * @extends {Unique}
 * @extends {Named}
 */
export interface FailureMode extends Unique, Named {
    description?: string;
     componentId: string; //Refers to SystemComponent.uuid
}

/**
 * Interface representing the success criteria for a component or system.
 * 
 * @interface
 * @extends {Unique}
 * @extends {Named}
 */
export interface SuccessCriteria extends Unique, Named {
    description?: string;
    componentId?: string; //Refers to SystemComponent.uuid
    systemId?: string;  //Refers to the System.uuid
}

/**
 * Interface representing an unavailability event.
 * The UnavailabilityEvent is not about the start of an event sequence like the InitiatingEvent, 
 * or a functional failure like a FunctionalEvent, but instead is related to a system's 
 * reliability and its possible states, which need to be accounted for within the system modelling
 * 
 * @interface
 * @extends {Unique}
 * @extends {Named}
 */
export interface UnavailabilityEvent extends Unique, Named {
    description?: string;
    componentId: string; //Refers to SystemComponent.uuid
}
