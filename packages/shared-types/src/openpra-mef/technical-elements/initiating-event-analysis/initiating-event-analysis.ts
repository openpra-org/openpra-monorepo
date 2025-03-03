import typia from "typia";
import { TechnicalElement, TechnicalElementTypes } from "../technical-element";
import { Named, Unique } from "../core/meta";
import { Uncertainty, DataSource, Assumption } from "../data-analysis/data-analysis";
import { Frequency } from "../core/events";

/**
 * @module initiating_event_analysis
 * @description Initiating event types and interfaces
 * 
 * This module provides types and interfaces for modeling initiating events in a PRA.
 * It captures:
 * - Event frequencies and uncertainties
 * - Event categorization and grouping
 * - Recovery actions
 * - Data sources and assumptions
 * 
 * Key concepts:
 * - Events are categorized (e.g., "Transient", "LOCA")
 * - Events with similar mitigation requirements are grouped
 * - Each event has an associated frequency with uncertainty
 * - Recovery actions may be available for some events
 */

/**
 * Initiating Event type
 * @memberof InitiatingEvents
 * @extends {Unique}
 * @extends {Named}
 * 
 * @example Loss of Offsite Power
 * ```typescript
 * const loopEvent: InitiatingEvent = {
 *   uuid: "IE-LOOP-001",
 *   name: "Loss of Offsite Power",
 *   description: "Complete loss of offsite power to plant safety buses",
 *   frequency: 1.2e-2,  // per year
 *   category: "Transient",
 *   group: "Loss of Power",
 *   recoveryActions: [
 *     "Restore power from switchyard",
 *     "Start and load emergency diesel generators",
 *     "Align alternate AC power source"
 *   ],
 *   data_sources: [
 *     {
 *       source: "NUREG/CR-6890",
 *       context: "Industry LOOP frequency data",
 *       notes: "Based on 1990-2020 operating experience"
 *     },
 *     {
 *       source: "Plant records",
 *       context: "Site-specific LOOP events",
 *       notes: "Two events in past 30 years"
 *     }
 *   ],
 *   assumptions: [
 *     {
 *       statement: "Grid reliability remains consistent with historical data",
 *       context: "Frequency estimation",
 *       notes: "Annual validation with grid operator required"
 *     }
 *   ],
 *   uncertainty: {
 *     distribution: "LOGNORMAL",
 *     parameters: {
 *       median: 1.2e-2,
 *       errorFactor: 3
 *     },
 *     model_uncertainty_sources: [
 *       "Grid stability assumptions",
 *       "Weather event frequency trends",
 *       "Switchyard maintenance practices"
 *     ]
 *   }
 * };
 * ```
 * 
 * @example Steam Generator Tube Rupture
 * ```typescript
 * const sgtrEvent: InitiatingEvent = {
 *   uuid: "IE-SGTR-001",
 *   name: "Steam Generator Tube Rupture",
 *   description: "Single tube rupture in any steam generator",
 *   frequency: 3.5e-3,
 *   category: "LOCA",
 *   group: "Steam Generator Tube Rupture",
 *   recoveryActions: [
 *     "Identify and isolate affected steam generator",
 *     "Initiate cooldown and depressurization",
 *     "Establish long-term cooling"
 *   ],
 *   data_sources: [
 *     {
 *       source: "NUREG-0844",
 *       context: "Industry SGTR data",
 *       notes: "Historical events analysis"
 *     }
 *   ],
 *   assumptions: [
 *     {
 *       statement: "Current inspection program maintains tube integrity",
 *       context: "Preventive maintenance",
 *       notes: "Based on current tech specs"
 *     }
 *   ],
 *   uncertainty: {
 *     distribution: "LOGNORMAL",
 *     parameters: {
 *       median: 3.5e-3,
 *       errorFactor: 2
 *     }
 *   }
 * };
 * ```
 */
export interface InitiatingEvent extends Unique, Named {
    description?: string;
    /**
     * The frequency of the initiating event.
     *
     * @remarks
     * The frequency definition here is incomplete because it does not specify a period.
     * Typically expressed as events per reactor-year or per calendar year.
     *
     * @example
     * ```typescript
     * // Loss of Coolant Accident frequency
     * const locaFrequency: Frequency = 1.2e-4;  // per reactor-year
     * 
     * // Turbine Trip frequency
     * const turbineTripFrequency: Frequency = 0.8;  // per reactor-year
     * ```
     */
    frequency: Frequency;

    /**
     * Category of the initiating event
     *
     * @example
     * Common categories include:
     * - "Transient": Power conversion system anomalies
     * - "LOCA": Loss of coolant accidents
     * - "Internal Hazard": Fires, floods
     * - "External Hazard": Seismic, high winds
     */
    category?: string;

    /**
     * Grouping of initiating events with similar mitigation requirements
     *
     * @example
     * Common groups include:
     * - "Loss of Offsite Power": Grid-centered, weather-related, switchyard-centered
     * - "Small Break LOCA": RCP seal LOCAs, small pipe breaks
     * - "Loss of Support System": Service water, component cooling water
     */
    group?: string;

    /**
     * Recovery actions associated with the initiating event.
     * These are actions that can potentially terminate or mitigate the event.
     * 
     * @example
     * ```typescript
     * const recoveryActions = [
     *   "Restore offsite power from alternate grid connection",
     *   "Cross-tie to unit 2 power supplies",
     *   "Start and align station blackout diesel generator"
     * ];
     * ```
     */
    recoveryActions?: string[];

    /**
     * Model uncertainty, data sources, and assumptions associated with the initiating event.
     * Uses the comprehensive modeling from data analysis.
     */
    uncertainty?: Uncertainty;
    data_sources?: DataSource[];
    assumptions?: Assumption[];
}

/**
 * Interface representing an analysis of initiating events, which is a type of technical element.
 *
 * @example Comprehensive Analysis
 * ```typescript
 * const analysis: InitiatingEventsAnalysis = {
 *   "technical-element-type": TechnicalElementTypes.INITIATING_EVENT_ANALYSIS,
 *   initiating_events: [
 *     {
 *       uuid: "IE-LOOP-001",
 *       name: "Loss of Offsite Power",
 *       description: "Complete loss of offsite power to plant safety buses",
 *       frequency: 1.2e-2,
 *       category: "Transient",
 *       group: "Loss of Power",
 *       recoveryActions: ["Restore grid power", "Start EDGs"]
 *     },
 *     {
 *       uuid: "IE-SLOCA-001",
 *       name: "Small Break LOCA",
 *       description: "Primary system break up to 2-inch diameter",
 *       frequency: 5.0e-4,
 *       category: "LOCA",
 *       group: "Small Break LOCA",
 *       recoveryActions: ["Start HPI", "Depressurize RCS"]
 *     },
 *     {
 *       uuid: "IE-FIRE-001",
 *       name: "Control Room Fire",
 *       description: "Fire requiring control room evacuation",
 *       frequency: 1.0e-3,
 *       category: "Internal Hazard",
 *       group: "Control Room Fires",
 *       recoveryActions: ["Evacuate CR", "Establish local control"]
 *     }
 *   ]
 * };
 * ```
 */
export interface InitiatingEventsAnalysis extends TechnicalElement<TechnicalElementTypes.INITIATING_EVENT_ANALYSIS> {
    initiating_events: InitiatingEvent[];
}

/**
 * JSON schema for validating {@link InitiatingEventsAnalysis} entities.
 *
 * @example Validation Usage
 * ```typescript
 * const analysis = {
 *   "technical-element-type": TechnicalElementTypes.INITIATING_EVENT_ANALYSIS,
 *   initiating_events: [
 *     {
 *       uuid: "IE-001",
 *       name: "Test Event",
 *       frequency: -1  // Invalid: negative frequency
 *     }
 *   ]
 * };
 * 
 * const isValid = InitiatingEventsAnalysisSchema.validate(analysis);
 * // isValid will be false due to negative frequency
 * ```
 */
export const InitiatingEventsAnalysisSchema = typia.json.application<[InitiatingEventsAnalysis], "3.0">();