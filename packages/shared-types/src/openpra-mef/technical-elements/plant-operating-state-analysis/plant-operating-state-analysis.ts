import typia from "typia";
import { TechnicalElement, TechnicalElementTypes } from "../technical-element";
import { Unique } from "../meta";

/**
 * Interface representing a table of plant operating states, which is unique.
 *
 * @example
 * ```
 * const table: PlantOperatingStatesTable = {
 *   uuid: "123e4567-e89b-12d3-a456-426614174000",
 *   state_fields: []
 * };
 * ```
 */
export interface PlantOperatingStatesTable extends Unique {
  state_fields: unknown[];
}

/**
 * Interface representing an analysis of plant operating states, which is a type of technical element.
 *
 * @example
 * ```
 * const analysis: PlantOperatingStatesAnalysis = {
 *   "technical-element-type": TechnicalElementTypes.PLANT_OPERATING_STATES_ANALYSIS,
 *   states: {
 *     uuid: "123e4567-e89b-12d3-a456-426614174000",
 *     state_fields: []
 *   }
 * };
 * ```
 */
export interface PlantOperatingStatesAnalysis
  extends TechnicalElement<TechnicalElementTypes.PLANT_OPERATING_STATES_ANALYSIS> {
  states: PlantOperatingStatesTable;
}

/**
 * JSON schema for validating {@link PlantOperatingStatesAnalysis} entities.
 *
 * @example
 * ```
 * const isValid = PlantOperatingStatesAnalysisSchema.validate(someData);
 * ```
 */
export const PlantOperatingStatesAnalysisSchema = typia.json.application<[PlantOperatingStatesAnalysis], "3.0">();
