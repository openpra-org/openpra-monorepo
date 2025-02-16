import typia, { tags } from "typia";
import { TechnicalElement, TechnicalElementTypes } from "../technical-element";
import { Named, Unique } from "../meta";
import { Uncertainty, DataSource, Assumption } from "../data-analysis/data-analysis";
import { Frequency } from "../events";

/**
 * @module InitiatingEvents
 * @description Initiating event types and interfaces
 */

/**
 * Initiating Event type
 * @memberof InitiatingEvents
 * @extends {Unique}
 * @extends {Named}
 */
export interface InitiatingEvent extends Unique, Named {
    description?: string;
    /**
     * The frequency of the initiating event.
     *
     * @remarks
     * The frequency definition here is incomplete because it does not specify a period.
     *
     * @example
     * ```
     * const frequency: number = 1.2e-7
     * ```
     */
    frequency: Frequency;

    /**
     * Category of the initiating event
     *
     * @example
     * "Transient", "LOCA", "Internal Hazard", "External Hazard"
     */
    category?: string;

    /**
     * Grouping of initiating events with similar mitigation requirements
     *
     * @example
     * "Loss of Offsite Power", "Small Break LOCA"
     */
    group?: string;

    /**
     *  Recovery actions associated with the initiating event.
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
 * @example
 * ```
 * const analysis: InitiatingEventsAnalysis = {
 *  "technical-element-type": TechnicalElementTypes.INITIATING_EVENT_ANALYSIS,
 *  initiating_events: [
 *   {
 *    uuid: "123e4567-e89b-12d3-a456-426614174000",
 *    name: "Event Name",
 *    frequency: 1.2e-7
 *   }
 *   {
 *    uuid: "223e4567-e89b-12d3-a456-426614174001",
 *    name: "Steam Generator Tube Rupture",
 *    frequency: 1.0e-6
 *   }
 *  ]
 * };
 * ```
 */
export interface InitiatingEventsAnalysis extends TechnicalElement<TechnicalElementTypes.INITIATING_EVENT_ANALYSIS> {
    initiating_events: InitiatingEvent[];
}

/**
 * JSON schema for validating {@link InitiatingEventsAnalysis} entities.
 *
 * @example
 * ```typescript
 * const isValid = InitiatingEventsAnalysisSchema.validate(someData);
 * ```
 */
export const InitiatingEventsAnalysisSchema = typia.json.application<[InitiatingEventsAnalysis], "3.0">();