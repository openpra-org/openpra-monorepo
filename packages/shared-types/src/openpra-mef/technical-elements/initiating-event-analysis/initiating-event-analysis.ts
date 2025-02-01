import typia, { tags } from "typia";

import { TechnicalElement, TechnicalElementTypes } from "../technical-element";
import { Named, Unique } from "../meta";

/**
 * Interface representing an initiating event, which is both unique and named.
 *
 * @interface
 * @extends {Unique}
 * @extends {Named}
 *
 * @example
 * ```
 * const event: InitiatingEvent = {
 *   uuid: "123e4567-e89b-12d3-a456-426614174000",
 *   name: "Loss of Offsite Power",
 *   frequency: 1.2e-7
 * };
 * ```
 */
export interface InitiatingEvent extends Unique, Named {
  /**
   * The frequency of the initiating event. The frequency must be a non-negative number.
   *
   * @remarks
   * The frequency definition here is incomplete because it does not specify a period.
   *
   * @example
   * ```
   * const frequency: number = 1.2e-7
   * ```
   */
  frequency: number & tags.Minimum<0>;
}

/**
 * Interface representing an analysis of initiating events, which is a type of technical element.
 *
 * @interface
 * @extends {TechnicalElement<TechnicalElementTypes.INITIATING_EVENT_ANALYSIS>}
 *
 * @example
 * ```
 * const analysis: InitiatingEventsAnalysis = {
 *   "technical-element-type": TechnicalElementTypes.INITIATING_EVENT_ANALYSIS,
 *   initiating_events: [
 *     {
 *       uuid: "123e4567-e89b-12d3-a456-426614174000",
 *       name: "Event Name",
 *       frequency: 1.2e-7
 *     }
 *     {
 *       uuid: "223e4567-e89b-12d3-a456-426614174001",
 *       name: "Steam Generator Tube Rupture",
 *       frequency: 1.0e-6
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
 * @example
 * ```
 * const isValid = InitiatingEventsAnalysisSchema.validate(someData);
 * ```
 */
export const InitiatingEventsAnalysisSchema = typia.json.application<[InitiatingEventsAnalysis], "3.0">();
