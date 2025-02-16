import { SystemComponent, FailureMode, SuccessCriteria } from "./systems-analysis";
import { tags } from "typia";

/**
 * @namespace Systems.Temporal
 * @description Time-dependent component behaviors and phase modeling, aligned with
 * ASME/ANS RA-S-1.4-2021 System Analysis requirements.
 * 
 * This module provides types and interfaces for modeling how components behave over time
 * during an event sequence. It captures:
 * - Time-based phase transitions (HLR-ES-A)
 * - Component state changes (HLR-SY-A)
 * - Active failure modes in different phases
 * - Resource depletion (e.g., fuel, battery)
 * - Success criteria that must be met
 * 
 * @example Complex Component Timeline with Multiple Phases
 * ```typescript
 * const emergencyDieselGeneratorTimeline: ComponentTimeline = {
 *   component: {
 *     id: "EDG-A",
 *     name: "Emergency Diesel Generator A",
 *     type: "standby"
 *   },
 *   phases: [
 *     {
 *       // Start-up phase with specific success criteria
 *       startTime: 0,
 *       endTime: 0.5, // 30 minutes
 *       state: "operational",
 *       activeFailureModes: [
 *         { id: "FM-EDG-FTS", name: "Failure to Start" }
 *       ],
 *       requiredSuccessCriteria: [
 *         { 
 *           id: "SC-EDG-START", 
 *           description: "Start and reach rated speed/voltage within 10 seconds",
 *           reference: "Tech Spec 3.8.1.2"
 *         }
 *       ]
 *     },
 *     {
 *       // Extended operation with different failure modes
 *       startTime: 0.5,
 *       endTime: 24,
 *       state: "operational",
 *       activeFailureModes: [
 *         { id: "FM-EDG-FTR", name: "Failure to Run" }
 *       ],
 *       requiredSuccessCriteria: [
 *         {
 *           id: "SC-EDG-VOLT",
 *           description: "Maintain voltage within ±5% of nominal",
 *           reference: "IEEE-308"
 *         }
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
 * 
 * @see ASME/ANS RA-S-1.4-2021 Table 4.3.5.1-2 Supporting Requirements for HLR-SY-A
 * @see ASME/ANS RA-S-1.4-2021 Table 4.3.3.1-2 Supporting Requirements for HLR-ES-A
 */

/**
 * Interface representing a component's behavior over time
 * @memberof Systems.Temporal
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
 * @memberof Systems.Temporal
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
 * @memberof Systems.Temporal
 * 
 * @example Safety System Battery Depletion
 * ```typescript
 * const batteryDepletionModel: DepletionModel = {
 *   resourceType: "battery",
 *   initialQuantity: 250,  // Battery capacity in kWh
 *   consumptionRate: 5,    // Discharge rate
 *   units: "kWh"
 * };
 * ```
 * 
 * @example Emergency Cooling System
 * ```typescript
 * const coolantDepletionModel: DepletionModel = {
 *   resourceType: "coolant",
 *   initialQuantity: 5000,  // RWST inventory
 *   consumptionRate: 10,    // Injection flow rate
 *   units: "liters/minute"
 * };
 * ```
 * 
 * @remarks
 * Resource depletion modeling is crucial for:
 * - Mission time calculations
 * - Success criteria validation
 * - System availability assessment
 * 
 * @see ASME/ANS RA-S-1.4-2021 SR-SY-A11 for treatment of support system dependencies
 */
export interface DepletionModel {
  resourceType: "fuel" | "coolant" | "battery";
  initialQuantity: number;
  consumptionRate: number;
  units: "kg/hour" | "liters/minute" | "kWh";
}

/**
 * Possible states a component can be in during a phase
 * @memberof Systems.Temporal
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