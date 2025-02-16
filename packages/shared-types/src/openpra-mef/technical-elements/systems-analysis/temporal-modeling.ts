import { SystemComponent, FailureMode, SuccessCriteria } from "./systems-analysis";
import { tags } from "typia";

/**
 * @namespace Temporal
 * @description Time-dependent component behaviors and phase modeling
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
 * @example
 * ```typescript
 * const phase: TemporalPhase = {
 *   startTime: 0,
 *   endTime: 24,
 *   state: "operational",
 *   activeFailureModes: [{ id: "FM-001", name: "Pump Cavitation" }],
 *   requiredSuccessCriteria: [{ id: "SC-001", description: "Flow > 100 gpm" }]
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
 */
export const validateTemporalPhase = (phase: TemporalPhase): string[] => {
    const errors: string[] = [];
    
    if (phase.endTime <= phase.startTime) {
        errors.push(`End time (${phase.endTime}) must be after start time (${phase.startTime})`);
    }
    
    return errors;
};

export interface DepletionModel {
  resourceType: "fuel" | "coolant" | "battery";
  initialQuantity: number;
  consumptionRate: number;
  units: "kg/hour" | "liters/minute" | "kWh";
}

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