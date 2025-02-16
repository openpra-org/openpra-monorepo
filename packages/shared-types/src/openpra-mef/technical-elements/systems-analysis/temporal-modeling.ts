import { SystemComponent, FailureMode, SuccessCriteria } from "./systems-analysis";
import { tags } from "typia";

/**
 * @namespace Temporal
 * @description Time-dependent component behaviors and phase modeling
 * 
 * This module provides types and interfaces for modeling how components behave over time
 * during an event sequence. It captures:
 * - Time-based phase transitions
 * - Component state changes
 * - Active failure modes in different phases
 * - Resource depletion (e.g., fuel, battery)
 * - Success criteria that must be met
 * 
 * @example Complex Component Timeline
 * ```typescript
 * const emergencyDieselGeneratorTimeline: ComponentTimeline = {
 *   component: {
 *     id: "EDG-A",
 *     name: "Emergency Diesel Generator A",
 *     type: "standby"
 *   },
 *   phases: [
 *     {
 *       // Initial start phase
 *       startTime: 0,
 *       endTime: 0.5, // 30 minutes
 *       state: "operational",
 *       activeFailureModes: [
 *         { id: "FM-EDG-FTS", name: "Failure to Start" }
 *       ],
 *       requiredSuccessCriteria: [
 *         { id: "SC-EDG-START", description: "Start and reach rated speed within 10 seconds" }
 *       ]
 *     },
 *     {
 *       // Extended operation phase
 *       startTime: 0.5,
 *       endTime: 24,
 *       state: "operational",
 *       activeFailureModes: [
 *         { id: "FM-EDG-FTR", name: "Failure to Run" },
 *         { id: "FM-EDG-OVH", name: "Overheating" }
 *       ],
 *       requiredSuccessCriteria: [
 *         { id: "SC-EDG-VOLT", description: "Maintain voltage within ±5% of nominal" },
 *         { id: "SC-EDG-FREQ", description: "Maintain frequency within ±2% of 60Hz" }
 *       ]
 *     }
 *   ],
 *   depletionModel: {
 *     resourceType: "fuel",
 *     initialQuantity: 2000,
 *     consumptionRate: 3.2,
 *     units: "kg/hour"
 *   }
 * };
 * ```
 */

/**
 * Interface representing a component's behavior over time
 * @memberof Temporal
 * 
 * @example Battery-Powered Component
 * ```typescript
 * const batteryBackedComponent: ComponentTimeline = {
 *   component: {
 *     id: "INV-1",
 *     name: "Vital Inverter 1",
 *     type: "active"
 *   },
 *   phases: [
 *     {
 *       startTime: 0,
 *       endTime: 4,
 *       state: "operational",
 *       activeFailureModes: [
 *         { id: "FM-INV-FTO", name: "Failure to Operate" }
 *       ]
 *     },
 *     {
 *       startTime: 4,
 *       endTime: 4.5,
 *       state: "degraded",
 *       activeFailureModes: [
 *         { id: "FM-INV-FTO", name: "Failure to Operate" },
 *         { id: "FM-INV-LOW", name: "Low Output" }
 *       ]
 *     }
 *   ],
 *   depletionModel: {
 *     resourceType: "battery",
 *     initialQuantity: 100,
 *     consumptionRate: 20,
 *     units: "kWh"
 *   }
 * };
 * ```
 */
export interface ComponentTimeline {
  component: SystemComponent;
  phases: TemporalPhase[];
  depletionModel?: DepletionModel;
}

/**
 * Interface representing a time phase in a component's timeline
 * @memberof Temporal
 * 
 * @example Multiple Success Criteria
 * ```typescript
 * const pumpOperationPhase: TemporalPhase = {
 *   startTime: 0,
 *   endTime: 24,
 *   state: "operational",
 *   activeFailureModes: [
 *     { id: "FM-001", name: "Pump Cavitation" },
 *     { id: "FM-002", name: "Seal Failure" },
 *     { id: "FM-003", name: "Motor Overheating" }
 *   ],
 *   requiredSuccessCriteria: [
 *     { id: "SC-001", description: "Maintain flow > 100 gpm" },
 *     { id: "SC-002", description: "Discharge pressure > 50 psig" },
 *     { id: "SC-003", description: "Bearing temperature < 180°F" }
 *   ]
 * };
 * 
 * @example Maintenance Phase
 * ```typescript
 * const maintenancePhase: TemporalPhase = {
 *   startTime: 168,  // After 1 week
 *   endTime: 172,    // 4 hour maintenance
 *   state: "maintenance",
 *   activeFailureModes: [
 *     { id: "FM-HE-001", name: "Human Error During Maintenance" }
 *   ],
 *   requiredSuccessCriteria: [
 *     { id: "SC-MAINT-001", description: "Complete maintenance within 4 hours" }
 *   ]
 * };
 * ```
 */
export interface TemporalPhase {
    /** 
     * Start time of the phase in hours from sequence initiation
     * @minimum 0 
     */
    startTime: number & tags.Minimum<0>;
    
    /** 
     * End time of the phase in hours
     * Must be greater than startTime
     * @minimum 0
     */
    endTime: number & tags.Minimum<0>;
    
    /**
     * Current state of the component during this phase
     */
    state: ComponentState;

    /**
     * Failure modes that could be active during this phase
     * Links to {@link FailureMode} definitions
     */
    activeFailureModes?: FailureMode[];

    /**
     * Success criteria that must be met during this phase
     * Links to {@link SuccessCriteria} definitions
     */
    requiredSuccessCriteria?: SuccessCriteria[];
}

/**
 * Runtime validation for TemporalPhase
 * @example Validation Usage
 * ```typescript
 * const phase: TemporalPhase = {
 *   startTime: 10,
 *   endTime: 5,  // Invalid: end before start
 *   state: "operational"
 * };
 * 
 * const errors = validateTemporalPhase(phase);
 * // errors = ["End time (5) must be after start time (10)"]
 * ```
 */
export const validateTemporalPhase = (phase: TemporalPhase): string[] => {
    const errors: string[] = [];
    
    if (phase.endTime <= phase.startTime) {
        errors.push(`End time (${phase.endTime}) must be after start time (${phase.startTime})`);
    }
    
    return errors;
};

/**
 * Interface for modeling resource depletion over time
 * @memberof Temporal
 * 
 * @example Coolant System
 * ```typescript
 * const coolantDepletion: DepletionModel = {
 *   resourceType: "coolant",
 *   initialQuantity: 5000,
 *   consumptionRate: 10,
 *   units: "liters/minute"
 * };
 * ```
 * 
 * @example Battery System
 * ```typescript
 * const batteryDepletion: DepletionModel = {
 *   resourceType: "battery",
 *   initialQuantity: 250,
 *   consumptionRate: 5,
 *   units: "kWh"
 * };
 * ```
 */
export interface DepletionModel {
  resourceType: "fuel" | "coolant" | "battery";
  initialQuantity: number;
  consumptionRate: number;
  units: "kg/hour" | "liters/minute" | "kWh";
}

/**
 * Possible states a component can be in during a phase
 * @memberof Temporal
 * 
 * @example State Transitions
 * ```typescript
 * const componentStates: ComponentState[] = [
 *   "operational",   // Normal operation
 *   "degraded",      // Operating but with reduced capability
 *   "failed",        // Complete loss of function
 *   "recovering",    // Being restored to service
 *   "maintenance"    // Under planned maintenance
 * ];
 * ```
 */
export type ComponentState = 
  | "operational"
  | "degraded"
  | "failed"
  | "recovering"
  | "maintenance";



//   // In event sequence analysis
// import { ComponentTimeline } from "@/systems-analysis/temporal-modeling";

// const sequence: EventSequence = {
//   componentTimelines: [
//     {
//       component: { $ref: "components/EDG-A" }, // Reference to core component
//       phases: [
//         {
//           startTime: 0,
//           endTime: 600,
//           state: "operational",
//           activeFailureModes: [{ $ref: "failure-modes/EDG-START-FAIL" }]
//         }
//       ],
//       depletionModel: {
//         resourceType: "fuel",
//         initialQuantity: 2000,
//         consumptionRate: 3.2,
//         units: "kg/hour"
//       }
//     }
//   ]
// };

const phase: TemporalPhase = {
    startTime: 0,
    endTime: -1, // This will fail both type and runtime validation
    state: "operational"
};

// Runtime validation
const errors = validateTemporalPhase(phase);
if (errors.length > 0) {
    console.error("Invalid temporal phase:", errors);
}